import { listActivities, saveCalendarItem } from "./repository";
import type { GameActivity } from "./types";

function comparePriority(first: GameActivity, second: GameActivity) {
  return second.contentPriorityScore - first.contentPriorityScore;
}

export async function buildWeeklyPlan({ persist = false } = {}) {
  const activities = (await listActivities({ view: "week" }))
    .filter((item) => !["SKIPPED", "EXPIRED", "PUBLISHED"].includes(item.status))
    .sort(comparePriority);
  const gameCounts = new Map<string, number>();
  const dayCounts = new Map<string, number>();
  const selected: Array<
    GameActivity & { plannedPublishDate: string; recommendedPostType: string }
  > = [];

  for (const activity of activities) {
    if ((gameCounts.get(activity.gameId) || 0) >= 3) continue;
    const publishDate =
      activity.recommendedPublishDate ||
      activity.contentDeadline ||
      activity.startDate ||
      new Date().toISOString();
    const dayKey = publishDate.slice(0, 10);
    if (
      (dayCounts.get(dayKey) || 0) >= 5 &&
      activity.contentPriority !== "URGENT"
    ) {
      continue;
    }
    const recommendedPostType =
      activity.contentPriority === "URGENT"
        ? "Breaking update"
        : activity.monetizationScore >= 70
          ? "Top-up opportunity"
          : "Game update";
    selected.push({ ...activity, plannedPublishDate: publishDate, recommendedPostType });
    gameCounts.set(activity.gameId, (gameCounts.get(activity.gameId) || 0) + 1);
    dayCounts.set(dayKey, (dayCounts.get(dayKey) || 0) + 1);
  }

  if (persist) {
    for (const item of selected) {
      await saveCalendarItem({
        activityId: item.id,
        calendarType: "WEEKLY",
        scheduledAt: item.plannedPublishDate,
        postType: item.recommendedPostType,
      });
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    timezone: "Asia/Bangkok",
    items: selected,
  };
}

export async function buildMonthlyPlan({ persist = false } = {}) {
  const activities = (await listActivities({ view: "month" })).sort(
    comparePriority
  );
  const groups: Record<string, GameActivity[]> = {
    "Major Update": [],
    "New Character": [],
    "New Skin": [],
    Collaboration: [],
    "Battle Pass": [],
    "Top-up Opportunity": [],
    "Seasonal Event": [],
    Anniversary: [],
    "Community Content": [],
  };

  for (const item of activities) {
    let group = "Community Content";
    if (["VERSION_UPDATE", "SEASON_UPDATE", "NEW_MODE", "NEW_MAP"].includes(item.activityType)) {
      group = "Major Update";
    } else if (item.activityType === "NEW_CHARACTER") group = "New Character";
    else if (item.activityType === "NEW_SKIN") group = "New Skin";
    else if (item.activityType === "COLLABORATION") group = "Collaboration";
    else if (item.activityType === "BATTLE_PASS") group = "Battle Pass";
    else if (item.activityType === "ANNIVERSARY") group = "Anniversary";
    else if (item.monetizationScore >= 70) group = "Top-up Opportunity";
    groups[group].push(item);

    if (persist) {
      await saveCalendarItem({
        activityId: item.id,
        calendarType: "MONTHLY",
        scheduledAt:
          item.recommendedPublishDate ||
          item.contentDeadline ||
          item.startDate ||
          new Date().toISOString(),
        postType: group,
      });
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    timezone: "Asia/Bangkok",
    groups,
  };
}

