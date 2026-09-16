import { parseGoogleNewsRss } from "./rss";
import { getGameSourceAdapter } from "./adapters/registry";
import type { SourceAdapterItem } from "./adapters/types";
import {
  DISCOVERY_LOOKBACK_DAYS,
  isFreshGameUpdate,
} from "./freshness";
import { assessGameContentAffinity } from "./game-affinity";
import { buildIndexedSocialQuery } from "./social-post";

import {
  createActivityWithResult,
  listGames,
  listSources,
  recordCrawlerRun,
  recordSourceCheck,
} from "./repository";
import { isSafePublicUrl } from "./validation";
import type {
  ActivityType,
  GameContentGame,
  GameContentSource,
  SourceType,
  VerificationStatus,
} from "./types";

const UPDATE_TYPE_MAP: Record<string, ActivityType> = {
  character: "NEW_CHARACTER",
  skin: "NEW_SKIN",
  item: "NEW_ITEM",
  collaboration: "COLLABORATION",
  patch: "VERSION_UPDATE",
  mode: "NEW_MODE",
  map: "NEW_MAP",
};

function verificationFromSource(
  sourceType: SourceType
): VerificationStatus {
  if (
    [
      "OFFICIAL_WEBSITE",
      "OFFICIAL_SOCIAL",
      "IN_GAME",
      "APP_STORE",
      "OFFICIAL_COMMUNITY",
    ].includes(sourceType)
  ) {
    return "OFFICIAL";
  }
  if (sourceType === "TRUSTED_MEDIA") return "CONFIRMED";
  if (sourceType === "DATAMINING") return "DATAMINED";
  return "RUMOR";
}

function defaultScores(source: GameContentSource, publishedAt: string) {
  const ageHours = Math.max(
    0,
    (Date.now() - new Date(publishedAt).getTime()) / 3_600_000
  );
  const recency = ageHours <= 24 ? 25 : ageHours <= 72 ? 18 : 10;
  return {
    confidenceScore: Math.min(100, source.credibilityScore),
    popularityScore: Math.min(100, source.credibilityScore * 0.55 + recency),
    urgencyScore: ageHours <= 24 ? 80 : ageHours <= 72 ? 60 : 35,
  };
}

async function fetchSourceFeed(source: GameContentSource, gameName: string) {
  if (!isSafePublicUrl(source.url)) {
    throw new Error("Source URL is not allowed");
  }
  const sourceUrl = new URL(source.url);
  const sourceScope = `${sourceUrl.hostname}${sourceUrl.pathname}`.replace(
    /\/+$/,
    ""
  );
  const params = new URLSearchParams({
    q:
      source.sourceType === "OFFICIAL_SOCIAL"
        ? buildIndexedSocialQuery(
            source.name,
            source.url,
            gameName,
            DISCOVERY_LOOKBACK_DAYS
          )
        : `"${gameName}" site:${sourceScope} when:${DISCOVERY_LOOKBACK_DAYS}d`,
    hl: "th",
    gl: "TH",
    ceid: "TH:th",
  });
  const url = `https://news.google.com/rss/search?${params.toString()}`;
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          Accept: "application/rss+xml, application/xml, text/xml",
          "User-Agent": "LAZY TOPUP Game Calendar/1.0",
        },
        signal: AbortSignal.timeout(8_000),
        cache: "no-store",
      });
      if (!response.ok) throw new Error(`Feed returned ${response.status}`);
      return response.text();
    } catch (error) {
      lastError = error;
      if (attempt === 0) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error("Source request failed");
}

export async function testDiscoverySource(sourceId: string) {
  const [games, sources] = await Promise.all([listGames(), listSources()]);
  const source = sources.find((item) => item.id === sourceId);
  if (!source) throw new Error("ไม่พบ Source");
  const game = games.find((item) => item.id === source.gameId);
  if (!game) throw new Error("ไม่พบเกมของ Source");
  try {
    const adapter = getGameSourceAdapter(source.adapterKey);
    if (adapter) {
      if (adapter.gameSlug !== game.slug) {
        throw new Error(`Adapter ${adapter.key} is not for ${game.slug}`);
      }
      const result = await adapter.fetch(source);
      const items = result.items.filter((item) =>
        isFreshGameUpdate(item)
      );
      await recordSourceCheck(source.id, null);
      return {
        sourceId,
        gameName: game.name,
        mode: result.mode,
        limitationNote: result.limitationNote,
        itemCount: items.length,
        classifiedCount: items.filter(
          (item) => item.activityType !== "OTHER"
        ).length,
        latest: items.slice(0, 3).map((item) => ({
          title: item.title,
          publishedAt: item.publishedAt,
          updateType: item.activityType,
          url: item.url,
        })),
      };
    }
    if (source.automationMode === "MANUAL_REVIEW") {
      await recordSourceCheck(source.id, null);
      return {
        sourceId,
        gameName: game.name,
        mode: "MANUAL_REVIEW" as const,
        limitationNote: source.limitationNote,
        itemCount: 0,
        classifiedCount: 0,
        latest: [],
      };
    }
    if (source.automationMode === "ADAPTER") {
      throw new Error(`Source Adapter not found: ${source.adapterKey || "-"}`);
    }
    const xml = await fetchSourceFeed(source, game.name);
    const items = parseGoogleNewsRss(xml).filter(
      (item) =>
        isFreshGameUpdate(item) &&
        assessGameContentAffinity(game.slug, item.title, item.description)
          .affinity !== "CONFLICT"
    );
    await recordSourceCheck(source.id, null);
    return {
      sourceId,
      gameName: game.name,
      mode: "SEARCH_DISCOVERY" as const,
      limitationNote: source.limitationNote,
      itemCount: items.length,
      classifiedCount: items.filter((item) => item.updateType).length,
      latest: items.slice(0, 3).map((item) => ({
        title: item.title,
        publishedAt: item.publishedAt,
        updateType: item.updateType,
        url: item.url,
      })),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    await recordSourceCheck(source.id, message);
    throw new Error(message);
  }
}

export async function runDiscovery(runType = "manual") {
  const [games, allSources] = await Promise.all([
    listGames(),
    listSources(),
  ]);
  const activeSources = allSources
    .filter((source) => source.isActive)
    .slice(0, 100);
  let discoveredCount = 0;
  let candidateCount = 0;
  let duplicateCount = 0;
  let errorCount = 0;
  let manualReviewCount = 0;
  let gameMismatchCount = 0;
  const errors: string[] = [];

  async function saveAdapterItem(
    source: GameContentSource,
    game: GameContentGame,
    item: SourceAdapterItem
  ) {
    const scores = defaultScores(source, item.publishedAt);
    candidateCount += 1;
    const result = await createActivityWithResult({
      gameId: game.id,
      title: item.title,
      originalTitle: item.title,
      activityType: item.activityType,
      description: item.description,
      announcementDate: item.publishedAt,
      region: "TH",
      platform: item.platform,
      sourceName: source.name,
      sourceUrl: item.url,
      sourceType: source.sourceType,
      sourcePublishedAt: item.publishedAt,
      verificationStatus: verificationFromSource(source.sourceType),
      confidenceScore: scores.confidenceScore,
      popularityScore: item.popularityScore ?? scores.popularityScore,
      monetizationScore: [
        "NEW_ITEM",
        "NEW_SKIN",
        "NEW_CHARACTER",
        "NEW_PACKAGE",
        "BATTLE_PASS",
        "TOPUP_EVENT",
        "GACHA",
      ].includes(item.activityType)
        ? 60
        : 30,
      urgencyScore: scores.urgencyScore,
      thumbnailUrl: item.thumbnailUrl,
      tags: [...item.tags, source.sourceType],
    });
    if (result.created) discoveredCount += 1;
    else duplicateCount += 1;
  }

  async function saveSearchCandidates(
    source: GameContentSource,
    game: GameContentGame
  ) {
    const xml = await fetchSourceFeed(source, game.name);
    const items = parseGoogleNewsRss(xml)
      .filter((item) => isFreshGameUpdate(item))
      .slice(0, 20);
    for (const item of items) {
      if (!item.updateType) continue;
      const affinity = assessGameContentAffinity(
        game.slug,
        item.title,
        item.description
      );
      if (affinity.affinity === "CONFLICT") {
        gameMismatchCount += 1;
        console.info("[game-content:discovery] skipped game mismatch", {
          sourceId: source.id,
          sourceName: source.name,
          expectedGameSlug: game.slug,
          conflictingGameSlugs: affinity.conflictingGameSlugs,
          title: item.title.slice(0, 160),
        });
        continue;
      }
      const activityType = UPDATE_TYPE_MAP[item.updateType] || "OTHER";
      const scores = defaultScores(source, item.publishedAt);
      candidateCount += 1;
      const result = await createActivityWithResult({
        gameId: game.id,
        title: item.title,
        originalTitle: item.title,
        activityType,
        description: item.description,
        announcementDate: item.publishedAt,
        region: "TH",
        platform: item.platform,
        sourceName: source.name,
        sourceUrl: item.url,
        sourceType: source.sourceType,
        sourcePublishedAt: item.publishedAt,
        verificationStatus: "UNKNOWN",
        confidenceScore: Math.min(69, scores.confidenceScore),
        popularityScore: scores.popularityScore,
        monetizationScore: [
          "NEW_ITEM",
          "NEW_SKIN",
          "NEW_CHARACTER",
        ].includes(activityType)
          ? 60
          : 30,
        urgencyScore: scores.urgencyScore,
        tags: [
          item.updateType,
          source.sourceType,
          "search-candidate",
          "manual-review-required",
        ],
      });
      if (result.created) discoveredCount += 1;
      else duplicateCount += 1;
    }
  }

  async function processSource(source: GameContentSource) {
    const game = games.find((item) => item.id === source.gameId);
    if (!game) return;

    try {
      const adapter = getGameSourceAdapter(source.adapterKey);
      if (adapter) {
        if (adapter.gameSlug !== game.slug) {
          throw new Error(`Adapter ${adapter.key} is not for ${game.slug}`);
        }
        const result = await adapter.fetch(source);
        if (result.mode === "MANUAL_REVIEW") {
          manualReviewCount += 1;
          await saveSearchCandidates(source, game);
          await recordSourceCheck(source.id, null);
          return;
        }
        const items = result.items
          .filter((item) => isFreshGameUpdate(item))
          .slice(0, 20);
        for (const item of items) {
          await saveAdapterItem(source, game, item);
        }
        await recordSourceCheck(source.id, null);
        return;
      }
      if (source.automationMode === "MANUAL_REVIEW") {
        manualReviewCount += 1;
        await saveSearchCandidates(source, game);
        await recordSourceCheck(source.id, null);
        return;
      }
      if (source.automationMode === "ADAPTER") {
        throw new Error(`Source Adapter not found: ${source.adapterKey || "-"}`);
      }
      await saveSearchCandidates(source, game);
      await recordSourceCheck(source.id, null);
    } catch (error) {
      errorCount += 1;
      const message =
        error instanceof Error ? error.message : "unknown error";
      errors.push(`${source.name}: ${message}`);
      await recordSourceCheck(source.id, message);
    }
  }

  const concurrency = 5;
  for (let index = 0; index < activeSources.length; index += concurrency) {
    await Promise.all(
      activeSources.slice(index, index + concurrency).map(processSource)
    );
  }

  const status =
    errorCount === 0 ? "SUCCEEDED" : candidateCount > 0 ? "PARTIAL" : "FAILED";
  const run = await recordCrawlerRun({
    runType,
    status,
    sourceCount: activeSources.length,
    candidateCount,
    discoveredCount,
    duplicateCount,
    errorCount,
    errorMessage: errors.slice(0, 10).join("\n") || null,
  });

  console.info("[game-content:discovery] run completed", {
    runType,
    sourceCount: activeSources.length,
    candidateCount,
    discoveredCount,
    duplicateCount,
    gameMismatchCount,
    errorCount,
  });

  return {
    run,
    sourceCount: activeSources.length,
    candidateCount,
    discoveredCount,
    duplicateCount,
    errorCount,
    manualReviewCount,
    gameMismatchCount,
    errors: errors.slice(0, 10),
  };
}
