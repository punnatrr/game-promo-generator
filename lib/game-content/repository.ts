import { randomUUID } from "node:crypto";

import { getDb, hasDatabaseUrl } from "@/lib/db";

import { calculateContentPriority, clampScore } from "./scoring";
import {
  GAME_CONTENT_GAME_SEEDS,
  GAME_CONTENT_SOURCE_SEEDS,
  gameContentIconPath,
} from "./seed";
import type {
  ActivityFilters,
  ActivityType,
  ContentStatus,
  GameActivity,
  GameContentGame,
  GameContentSource,
  GeneratedGameContent,
  SourceAutomationMode,
  SourceType,
  VerificationStatus,
} from "./types";

type GameRow = {
  id: string;
  slug: string;
  name: string;
  icon_url: string | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
};

type SourceRow = {
  id: string;
  game_id: string;
  game_name: string;
  name: string;
  url: string;
  source_type: SourceType;
  credibility_score: number;
  language: string;
  is_active: boolean;
  adapter_key: string | null;
  automation_mode: SourceAutomationMode;
  limitation_note: string | null;
  last_checked_at: Date | null;
  last_error: string | null;
  created_at: Date;
  updated_at: Date;
};

type ActivityRow = {
  id: string;
  game_id: string;
  game_slug: string;
  game_name: string;
  title: string;
  original_title: string | null;
  activity_type: ActivityType;
  description: string;
  start_date: Date | null;
  end_date: Date | null;
  announcement_date: Date | null;
  expected_release_date: Date | null;
  region: string;
  platform: string;
  source_name: string;
  source_url: string;
  source_type: SourceType;
  source_published_at: Date | null;
  discovered_at: Date;
  verification_status: VerificationStatus;
  confidence_score: number;
  popularity_score: number;
  monetization_score: number;
  urgency_score: number;
  content_priority: GameActivity["contentPriority"];
  content_priority_score: number;
  content_deadline: Date | null;
  recommended_publish_date: Date | null;
  thumbnail_url: string | null;
  official_image_url: string | null;
  tags: unknown;
  ai_summary_th: string | null;
  ai_caption_th: string | null;
  content_angle: string | null;
  status: ContentStatus;
  is_featured: boolean;
  created_at: Date;
  updated_at: Date;
  last_checked_at: Date;
};

type ActivityUpsertRow = ActivityRow & {
  was_inserted: boolean;
};

export type CreateActivityInput = {
  gameId: string;
  title: string;
  originalTitle?: string | null;
  activityType: ActivityType;
  description: string;
  startDate?: string | null;
  endDate?: string | null;
  announcementDate?: string | null;
  expectedReleaseDate?: string | null;
  region: string;
  platform: string;
  sourceName: string;
  sourceUrl: string;
  sourceType: SourceType;
  sourcePublishedAt?: string | null;
  verificationStatus: VerificationStatus;
  confidenceScore: number;
  popularityScore: number;
  monetizationScore: number;
  urgencyScore: number;
  contentDeadline?: string | null;
  recommendedPublishDate?: string | null;
  thumbnailUrl?: string | null;
  officialImageUrl?: string | null;
  tags?: string[];
  status?: ContentStatus;
};

let tablesEnsured = false;
let tablesEnsurePromise: Promise<void> | null = null;

const memoryGames: GameContentGame[] = GAME_CONTENT_GAME_SEEDS.map(
  ([slug, name]) => ({
    id: `seed-${slug}`,
    slug,
    name,
    iconUrl: gameContentIconPath(slug),
    isActive: true,
  })
);
const memorySources: GameContentSource[] = GAME_CONTENT_SOURCE_SEEDS.map(
  (source, index) => {
    const game = memoryGames.find((item) => item.slug === source.gameSlug);
    if (!game) {
      throw new Error(`Missing seeded game: ${source.gameSlug}`);
    }
    return {
      id: `seed-source-${source.gameSlug}-${index}`,
      gameId: game.id,
      gameName: game.name,
      name: source.name,
      url: source.url,
      sourceType: source.sourceType,
      credibilityScore: source.credibilityScore,
      language: source.language,
      isActive: true,
      adapterKey: "adapterKey" in source ? source.adapterKey : null,
      automationMode:
        "automationMode" in source
          ? source.automationMode
          : "SEARCH_DISCOVERY",
      limitationNote:
        "limitationNote" in source ? source.limitationNote : null,
      lastCheckedAt: null,
      lastError: null,
    };
  }
);
const memoryActivities: GameActivity[] = [];

function iso(value: Date | string | null | undefined) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function mapGame(row: GameRow): GameContentGame {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    iconUrl: row.icon_url,
    isActive: row.is_active,
    createdAt: iso(row.created_at) || undefined,
    updatedAt: iso(row.updated_at) || undefined,
  };
}

function mapSource(row: SourceRow): GameContentSource {
  return {
    id: row.id,
    gameId: row.game_id,
    gameName: row.game_name,
    name: row.name,
    url: row.url,
    sourceType: row.source_type,
    credibilityScore: row.credibility_score,
    language: row.language,
    isActive: row.is_active,
    adapterKey: row.adapter_key,
    automationMode: row.automation_mode || "SEARCH_DISCOVERY",
    limitationNote: row.limitation_note,
    lastCheckedAt: iso(row.last_checked_at),
    lastError: row.last_error,
    createdAt: iso(row.created_at) || undefined,
    updatedAt: iso(row.updated_at) || undefined,
  };
}

function mapActivity(row: ActivityRow): GameActivity {
  return {
    id: row.id,
    gameId: row.game_id,
    gameSlug: row.game_slug,
    gameName: row.game_name,
    title: row.title,
    originalTitle: row.original_title,
    activityType: row.activity_type,
    description: row.description,
    startDate: iso(row.start_date),
    endDate: iso(row.end_date),
    announcementDate: iso(row.announcement_date),
    expectedReleaseDate: iso(row.expected_release_date),
    region: row.region,
    platform: row.platform,
    sourceName: row.source_name,
    sourceUrl: row.source_url,
    sourceType: row.source_type,
    sourcePublishedAt: iso(row.source_published_at),
    discoveredAt: iso(row.discovered_at) || new Date().toISOString(),
    verificationStatus: row.verification_status,
    confidenceScore: row.confidence_score,
    popularityScore: row.popularity_score,
    monetizationScore: row.monetization_score,
    urgencyScore: row.urgency_score,
    contentPriority: row.content_priority,
    contentPriorityScore: row.content_priority_score,
    contentDeadline: iso(row.content_deadline),
    recommendedPublishDate: iso(row.recommended_publish_date),
    thumbnailUrl: row.thumbnail_url,
    officialImageUrl: row.official_image_url,
    tags: stringArray(row.tags),
    aiSummaryTh: row.ai_summary_th,
    aiCaptionTh: row.ai_caption_th,
    contentAngle: row.content_angle,
    status: row.status,
    isFeatured: row.is_featured,
    createdAt: iso(row.created_at) || new Date().toISOString(),
    updatedAt: iso(row.updated_at) || new Date().toISOString(),
    lastCheckedAt: iso(row.last_checked_at) || new Date().toISOString(),
  };
}

async function createGameContentTables() {
  const sql = getDb();

  await sql`
    alter table users
      add column if not exists content_role text not null default 'VIEWER'
  `;
  await sql`
    create table if not exists games (
      id uuid primary key default gen_random_uuid(),
      slug text not null unique,
      name text not null,
      icon_url text,
      is_active boolean not null default true,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `;
  await sql`
    create table if not exists game_sources (
      id uuid primary key default gen_random_uuid(),
      game_id uuid not null references games(id) on delete cascade,
      name text not null,
      url text not null,
      source_type text not null,
      credibility_score integer not null default 50,
      language text not null default 'th',
      is_active boolean not null default true,
      adapter_key text,
      automation_mode text not null default 'SEARCH_DISCOVERY',
      limitation_note text,
      last_checked_at timestamptz,
      last_error text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      unique (game_id, url)
    )
  `;
  await sql`
    alter table game_sources
      add column if not exists adapter_key text,
      add column if not exists automation_mode text not null default 'SEARCH_DISCOVERY',
      add column if not exists limitation_note text
  `;
  await sql`
    create table if not exists game_activities (
      id uuid primary key default gen_random_uuid(),
      game_id uuid not null references games(id) on delete cascade,
      title text not null,
      original_title text,
      activity_type text not null,
      description text not null default '',
      start_date timestamptz,
      end_date timestamptz,
      announcement_date timestamptz,
      expected_release_date timestamptz,
      region text not null default 'TH',
      platform text not null default 'ALL',
      source_name text not null,
      source_url text not null,
      source_type text not null,
      source_published_at timestamptz,
      discovered_at timestamptz not null default now(),
      verification_status text not null default 'UNKNOWN',
      confidence_score integer not null default 0,
      popularity_score integer not null default 0,
      monetization_score integer not null default 0,
      urgency_score integer not null default 0,
      content_priority text not null default 'LOW',
      content_priority_score integer not null default 0,
      content_deadline timestamptz,
      recommended_publish_date timestamptz,
      thumbnail_url text,
      official_image_url text,
      tags jsonb not null default '[]'::jsonb,
      raw_content text,
      ai_summary_th text,
      ai_caption_th text,
      content_angle text,
      status text not null default 'DISCOVERED',
      is_featured boolean not null default false,
      fingerprint text not null unique,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      last_checked_at timestamptz not null default now()
    )
  `;
  await sql`
    create table if not exists activity_sources (
      id uuid primary key default gen_random_uuid(),
      activity_id uuid not null references game_activities(id) on delete cascade,
      source_id uuid references game_sources(id) on delete set null,
      source_name text not null,
      source_url text not null,
      source_type text not null,
      source_published_at timestamptz,
      raw_content text,
      created_at timestamptz not null default now(),
      unique (activity_id, source_url)
    )
  `;
  await sql`
    create table if not exists activity_tags (
      activity_id uuid not null references game_activities(id) on delete cascade,
      tag text not null,
      created_at timestamptz not null default now(),
      primary key (activity_id, tag)
    )
  `;
  await sql`
    create table if not exists content_tasks (
      id uuid primary key default gen_random_uuid(),
      activity_id uuid not null references game_activities(id) on delete cascade,
      assignee_user_id uuid references users(id) on delete set null,
      status text not null,
      note text,
      due_at timestamptz,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `;
  await sql`
    create table if not exists content_calendar (
      id uuid primary key default gen_random_uuid(),
      activity_id uuid references game_activities(id) on delete cascade,
      calendar_type text not null,
      scheduled_at timestamptz not null,
      post_type text,
      status text not null default 'PLANNED',
      metadata jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `;
  await sql`
    create table if not exists generated_contents (
      id uuid primary key default gen_random_uuid(),
      activity_id uuid not null references game_activities(id) on delete cascade,
      generated_by_user_id uuid references users(id) on delete set null,
      provider text not null,
      model text,
      output jsonb not null,
      created_at timestamptz not null default now()
    )
  `;
  await sql`
    create table if not exists activity_status_logs (
      id uuid primary key default gen_random_uuid(),
      activity_id uuid not null references game_activities(id) on delete cascade,
      actor_user_id uuid references users(id) on delete set null,
      previous_status text,
      new_status text not null,
      note text,
      created_at timestamptz not null default now()
    )
  `;
  await sql`
    create table if not exists crawler_runs (
      id uuid primary key default gen_random_uuid(),
      run_type text not null,
      status text not null,
      source_count integer not null default 0,
      candidate_count integer not null default 0,
      discovered_count integer not null default 0,
      duplicate_count integer not null default 0,
      counting_version integer not null default 2,
      error_count integer not null default 0,
      error_message text,
      started_at timestamptz not null default now(),
      finished_at timestamptz
    )
  `;
  await sql`
    alter table crawler_runs
      add column if not exists candidate_count integer not null default 0,
      add column if not exists duplicate_count integer not null default 0,
      add column if not exists counting_version integer not null default 1
  `;
  await sql`
    alter table crawler_runs
      alter column counting_version set default 2
  `;
  await sql`
    create table if not exists system_settings (
      key text primary key,
      value jsonb not null default '{}'::jsonb,
      updated_at timestamptz not null default now()
    )
  `;

  await sql`
    update game_sources
    set url = 'https://ff.garena.com/th/news/'
    where url = 'https://www.freefiremobile.com/th/news/'
      and game_id = (select id from games where slug = 'free-fire')
      and not exists (
        select 1 from game_sources current_source
        where current_source.game_id = game_sources.game_id
          and current_source.url = 'https://ff.garena.com/th/news/'
      )
  `;
  await sql`
    update game_sources source
    set
      name = 'Mobile Legends: Bang Bang Thailand Official Facebook',
      url = 'https://www.facebook.com/MobileLegendsGameTHLA/',
      language = 'th',
      updated_at = now()
    where source.game_id = (select id from games where slug = 'mobile-legends')
      and lower(trim(trailing '/' from source.url)) =
        'https://www.facebook.com/mobilelegendsgame'
      and not exists (
        select 1
        from game_sources current_source
        where current_source.game_id = source.game_id
          and lower(trim(trailing '/' from current_source.url)) =
            'https://www.facebook.com/mobilelegendsgamethla'
      )
  `;
  await sql`
    update game_sources source
    set is_active = false, updated_at = now()
    where source.game_id = (select id from games where slug = 'mobile-legends')
      and lower(trim(trailing '/' from source.url)) =
        'https://www.facebook.com/mobilelegendsgame'
      and exists (
        select 1
        from game_sources current_source
        where current_source.game_id = source.game_id
          and lower(trim(trailing '/' from current_source.url)) =
            'https://www.facebook.com/mobilelegendsgamethla'
      )
  `;
  await sql`
    update game_sources
    set
      is_active = false,
      automation_mode = 'MANUAL_REVIEW',
      limitation_note = 'Legacy source URL; replaced by the current official adapter source.'
    where url = 'https://www.freefiremobile.com/th/news/'
      and game_id = (select id from games where slug = 'free-fire')
  `;
  await sql`
    update game_sources
    set url = 'https://devforum.roblox.com/c/updates/announcements/36.json'
    where url = 'https://devforum.roblox.com/c/updates/45'
      and game_id = (select id from games where slug = 'roblox')
      and not exists (
        select 1 from game_sources current_source
        where current_source.game_id = game_sources.game_id
          and current_source.url =
            'https://devforum.roblox.com/c/updates/announcements/36.json'
      )
  `;
  await sql`
    update game_sources
    set
      is_active = false,
      automation_mode = 'MANUAL_REVIEW',
      limitation_note = 'Legacy category URL; replaced by the staff announcements adapter source.'
    where url = 'https://devforum.roblox.com/c/updates/45'
      and game_id = (select id from games where slug = 'roblox')
  `;

  const sourceUrlReplacements = [
    {
      gameSlug: "efootball",
      previousUrl: "https://www.konami.com/efootball/en-us/",
      currentUrl:
        "https://www.konami.com/efootball/en-us/topic/news/list",
    },
    {
      gameSlug: "garena-rov",
      previousUrl: "https://www.facebook.com/ROVTH",
      currentUrl: "https://rov.in.th/patch-notes",
    },
    {
      gameSlug: "last-war",
      previousUrl: "https://www.lastwar.com/",
      currentUrl: "https://www.lastwar.com/en/home.html",
    },
    {
      gameSlug: "digimon-up",
      previousUrl: "https://dgup.bn-ent.net/en/",
      currentUrl: "https://dgup.bn-ent.net/en/news/",
    },
    {
      gameSlug: "love-and-deepspace",
      previousUrl:
        "https://loveanddeepspace.infoldgames.com/en-EN/news",
      currentUrl: "https://loveanddeepspace.infoldgames.com/en-EN/",
    },
    {
      gameSlug: "wuthering-waves",
      previousUrl: "https://wutheringwaves.kurogames.com/en/",
      currentUrl:
        "https://wutheringwaves.kurogames.com/en/main/news",
    },
  ] as const;
  for (const replacement of sourceUrlReplacements) {
    await sql`
      update game_sources
      set url = ${replacement.currentUrl}
      where url = ${replacement.previousUrl}
        and game_id = (
          select id from games where slug = ${replacement.gameSlug}
        )
        and not exists (
          select 1
          from game_sources current_source
          where current_source.game_id = game_sources.game_id
            and current_source.url = ${replacement.currentUrl}
        )
    `;
    await sql`
      update game_sources
      set
        is_active = false,
        automation_mode = 'MANUAL_REVIEW',
        limitation_note =
          'Legacy source URL; replaced by the current official adapter source.'
      where url = ${replacement.previousUrl}
        and game_id = (
          select id from games where slug = ${replacement.gameSlug}
        )
    `;
  }

  for (const [slug, name] of GAME_CONTENT_GAME_SEEDS) {
    await sql`
      insert into games (slug, name, icon_url)
      values (${slug}, ${name}, ${gameContentIconPath(slug)})
      on conflict (slug)
      do update set icon_url = coalesce(games.icon_url, excluded.icon_url)
    `;
  }

  for (const source of GAME_CONTENT_SOURCE_SEEDS) {
    await sql`
      insert into game_sources (
        game_id, name, url, source_type, credibility_score, language,
        adapter_key, automation_mode, limitation_note
      )
      select
        id,
        ${source.name},
        ${source.url},
        ${source.sourceType},
        ${source.credibilityScore},
        ${source.language},
        ${"adapterKey" in source ? source.adapterKey : null},
        ${
          "automationMode" in source
            ? source.automationMode
            : "SEARCH_DISCOVERY"
        },
        ${"limitationNote" in source ? source.limitationNote : null}
      from games
      where slug = ${source.gameSlug}
      on conflict (game_id, url)
      do update set
        name = excluded.name,
        source_type = excluded.source_type,
        credibility_score = excluded.credibility_score,
        language = excluded.language,
        is_active = true,
        adapter_key = excluded.adapter_key,
        automation_mode = excluded.automation_mode,
        limitation_note = excluded.limitation_note,
        updated_at = now()
    `;
  }

  await sql`
    update game_activities activity
    set
      verification_status = 'UNKNOWN',
      confidence_score = least(activity.confidence_score, 69),
      updated_at = now()
    from game_sources source
    where activity.game_id = source.game_id
      and activity.source_name = source.name
      and activity.source_url like 'https://news.google.com/%'
      and source.automation_mode in ('SEARCH_DISCOVERY', 'MANUAL_REVIEW')
      and activity.status in ('DISCOVERED', 'REVIEWING')
      and (
        activity.verification_status <> 'UNKNOWN'
        or activity.confidence_score > 69
      )
  `;
}

export async function ensureGameContentTables() {
  if (!hasDatabaseUrl() || tablesEnsured) return;
  if (!tablesEnsurePromise) {
    tablesEnsurePromise = createGameContentTables()
      .then(() => {
        tablesEnsured = true;
      })
      .finally(() => {
        tablesEnsurePromise = null;
      });
  }
  await tablesEnsurePromise;
}

export async function listGames(includeInactive = false) {
  if (!hasDatabaseUrl()) {
    return memoryGames.filter((game) => includeInactive || game.isActive);
  }
  await ensureGameContentTables();
  const sql = getDb();
  const rows = includeInactive
    ? await sql<GameRow[]>`select * from games order by name`
    : await sql<GameRow[]>`
        select * from games where is_active = true order by name
      `;
  return rows.map(mapGame);
}

export async function createGame(input: {
  slug: string;
  name: string;
  iconUrl: string | null;
}) {
  if (!hasDatabaseUrl()) {
    const game: GameContentGame = {
      id: randomUUID(),
      slug: input.slug,
      name: input.name,
      iconUrl: input.iconUrl,
      isActive: true,
    };
    memoryGames.push(game);
    return game;
  }
  await ensureGameContentTables();
  const sql = getDb();
  const [row] = await sql<GameRow[]>`
    insert into games (slug, name, icon_url)
    values (${input.slug}, ${input.name}, ${input.iconUrl})
    returning *
  `;
  return mapGame(row);
}

export async function updateGame(
  id: string,
  input: { name?: string; iconUrl?: string | null; isActive?: boolean }
) {
  if (!hasDatabaseUrl()) {
    const game = memoryGames.find((item) => item.id === id);
    if (!game) return null;
    if (input.name !== undefined) game.name = input.name;
    if (input.iconUrl !== undefined) game.iconUrl = input.iconUrl;
    if (input.isActive !== undefined) game.isActive = input.isActive;
    return game;
  }
  await ensureGameContentTables();
  const sql = getDb();
  const currentRows = await sql<GameRow[]>`
    select * from games where id = ${id} limit 1
  `;
  const current = currentRows[0];
  if (!current) return null;
  const [row] = await sql<GameRow[]>`
    update games set
      name = ${input.name ?? current.name},
      icon_url = ${
        input.iconUrl === undefined ? current.icon_url : input.iconUrl
      },
      is_active = ${input.isActive ?? current.is_active},
      updated_at = now()
    where id = ${id}
    returning *
  `;
  return mapGame(row);
}

export async function deleteGame(id: string) {
  if (!hasDatabaseUrl()) {
    const index = memoryGames.findIndex((item) => item.id === id);
    if (index < 0) return false;
    memoryGames.splice(index, 1);
    return true;
  }
  await ensureGameContentTables();
  const sql = getDb();
  const rows = await sql<{ id: string }[]>`
    delete from games where id = ${id} returning id
  `;
  return rows.length > 0;
}

export async function listSources(gameId?: string) {
  if (!hasDatabaseUrl()) {
    return memorySources.filter((source) => !gameId || source.gameId === gameId);
  }
  await ensureGameContentTables();
  const sql = getDb();
  const rows = gameId
    ? await sql<SourceRow[]>`
        select s.*, g.name as game_name
        from game_sources s join games g on g.id = s.game_id
        where s.game_id = ${gameId}
        order by s.credibility_score desc, s.name
      `
    : await sql<SourceRow[]>`
        select s.*, g.name as game_name
        from game_sources s join games g on g.id = s.game_id
        order by g.name, s.credibility_score desc, s.name
      `;
  return rows.map(mapSource);
}

export async function createSource(input: {
  gameId: string;
  name: string;
  url: string;
  sourceType: SourceType;
  credibilityScore: number;
  language: string;
}) {
  const game = (await listGames(true)).find((item) => item.id === input.gameId);
  if (!game) throw new Error("ไม่พบเกมที่เลือก");

  if (!hasDatabaseUrl()) {
    const source: GameContentSource = {
      id: randomUUID(),
      gameId: input.gameId,
      gameName: game.name,
      name: input.name,
      url: input.url,
      sourceType: input.sourceType,
      credibilityScore: input.credibilityScore,
      language: input.language,
      isActive: true,
      adapterKey: null,
      automationMode: "MANUAL_REVIEW",
      limitationNote:
        "ยังไม่มี Source Adapter เฉพาะสำหรับแหล่งนี้ ต้องตรวจสอบและบันทึกข่าวด้วยตนเอง",
      lastCheckedAt: null,
      lastError: null,
    };
    memorySources.push(source);
    return source;
  }
  await ensureGameContentTables();
  const sql = getDb();
  const [row] = await sql<SourceRow[]>`
    insert into game_sources (
      game_id, name, url, source_type, credibility_score, language,
      automation_mode, limitation_note
    )
    values (
      ${input.gameId}, ${input.name}, ${input.url}, ${input.sourceType},
      ${input.credibilityScore}, ${input.language}, ${"MANUAL_REVIEW"},
      ${"ยังไม่มี Source Adapter เฉพาะสำหรับแหล่งนี้ ต้องตรวจสอบและบันทึกข่าวด้วยตนเอง"}
    )
    returning *, ${game.name}::text as game_name
  `;
  return mapSource(row);
}

export async function updateSource(
  id: string,
  input: Partial<
    Pick<
      GameContentSource,
      "name" | "sourceType" | "credibilityScore" | "language" | "isActive"
    >
  >
) {
  if (!hasDatabaseUrl()) {
    const source = memorySources.find((item) => item.id === id);
    if (!source) return null;
    Object.assign(source, input);
    return source;
  }
  await ensureGameContentTables();
  const sql = getDb();
  const currentRows = await sql<SourceRow[]>`
    select s.*, g.name as game_name
    from game_sources s join games g on g.id = s.game_id
    where s.id = ${id}
    limit 1
  `;
  const current = currentRows[0];
  if (!current) return null;
  const [row] = await sql<SourceRow[]>`
    update game_sources set
      name = ${input.name ?? current.name},
      source_type = ${input.sourceType ?? current.source_type},
      credibility_score = ${
        input.credibilityScore ?? current.credibility_score
      },
      language = ${input.language ?? current.language},
      is_active = ${input.isActive ?? current.is_active},
      updated_at = now()
    where id = ${id}
    returning *, ${current.game_name}::text as game_name
  `;
  return mapSource(row);
}

export async function recordSourceCheck(
  id: string,
  errorMessage: string | null
) {
  if (!hasDatabaseUrl()) {
    const source = memorySources.find((item) => item.id === id);
    if (!source) return;
    source.lastCheckedAt = new Date().toISOString();
    source.lastError = errorMessage;
    return;
  }
  await ensureGameContentTables();
  const sql = getDb();
  await sql`
    update game_sources
    set
      last_checked_at = now(),
      last_error = ${errorMessage},
      updated_at = now()
    where id = ${id}
  `;
}

function matchesFilters(activity: GameActivity, filters: ActivityFilters) {
  if (filters.gameId && activity.gameId !== filters.gameId) return false;
  if (
    filters.activityType &&
    activity.activityType !== filters.activityType
  ) {
    return false;
  }
  if (filters.priority && activity.contentPriority !== filters.priority) {
    return false;
  }
  if (
    filters.verificationStatus &&
    activity.verificationStatus !== filters.verificationStatus
  ) {
    return false;
  }
  if (filters.status && activity.status !== filters.status) return false;
  if (filters.region && activity.region !== filters.region) return false;
  if (filters.platform && activity.platform !== filters.platform) return false;
  if (filters.highMonetization && activity.monetizationScore < 70) return false;
  if (filters.hasOfficialImage && !activity.officialImageUrl) return false;
  if (filters.withoutContent && activity.aiSummaryTh) return false;

  const date = activity.startDate || activity.announcementDate || activity.discoveredAt;
  if (filters.dateFrom && new Date(date) < new Date(filters.dateFrom)) return false;
  if (filters.dateTo && new Date(date) > new Date(`${filters.dateTo}T23:59:59+07:00`)) {
    return false;
  }

  const now = Date.now();
  const start = activity.startDate ? new Date(activity.startDate).getTime() : null;
  if (filters.view === "today") {
    const discoveredAge = now - new Date(activity.discoveredAt).getTime();
    if (discoveredAge > 86_400_000) return false;
  }
  if (filters.view === "week") {
    const discoveredAge = now - new Date(activity.discoveredAt).getTime();
    const discoveredThisWeek =
      discoveredAge >= -2 * 60 * 60 * 1000 &&
      discoveredAge <= 7 * 86_400_000;
    const startsSoon =
      start !== null &&
      start >= now - 86_400_000 &&
      start <= now + 14 * 86_400_000;
    if (!discoveredThisWeek && !startsSoon) {
      return false;
    }
  }
  if (filters.view === "month") {
    if (!start || start < now - 86_400_000 || start > now + 31 * 86_400_000) {
      return false;
    }
  }
  if (filters.view === "rumors") {
    if (!["RUMOR", "DATAMINED", "UNKNOWN"].includes(activity.verificationStatus)) {
      return false;
    }
  }
  if (filters.view === "published" && activity.status !== "PUBLISHED") return false;

  return true;
}

export async function listActivities(filters: ActivityFilters = {}) {
  let activities: GameActivity[];
  if (!hasDatabaseUrl()) {
    activities = [...memoryActivities];
  } else {
    await ensureGameContentTables();
    const sql = getDb();
    const rows = await sql<ActivityRow[]>`
      select
        a.*,
        g.slug as game_slug,
        g.name as game_name
      from game_activities a
      join games g on g.id = a.game_id
      order by
        a.content_priority_score desc,
        coalesce(a.start_date, a.expected_release_date, a.discovered_at) asc
      limit 500
    `;
    activities = rows.map(mapActivity);
  }
  return activities.filter((activity) => matchesFilters(activity, filters));
}

export async function getActivity(id: string) {
  return (await listActivities()).find((activity) => activity.id === id) || null;
}

export async function createActivity(input: CreateActivityInput) {
  return (await createActivityWithResult(input)).activity;
}

export async function createActivityWithResult(input: CreateActivityInput) {
  const game = (await listGames(true)).find((item) => item.id === input.gameId);
  if (!game) throw new Error("ไม่พบเกมที่เลือก");
  const priority = calculateContentPriority(input);
  const now = new Date().toISOString();
  const fingerprint = `${game.slug}|${input.title}|${input.startDate || ""}`
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .slice(0, 500);

  if (!hasDatabaseUrl()) {
    const activity: GameActivity = {
      id: randomUUID(),
      gameId: game.id,
      gameSlug: game.slug,
      gameName: game.name,
      title: input.title,
      originalTitle: input.originalTitle || null,
      activityType: input.activityType,
      description: input.description,
      startDate: input.startDate || null,
      endDate: input.endDate || null,
      announcementDate: input.announcementDate || null,
      expectedReleaseDate: input.expectedReleaseDate || null,
      region: input.region,
      platform: input.platform,
      sourceName: input.sourceName,
      sourceUrl: input.sourceUrl,
      sourceType: input.sourceType,
      sourcePublishedAt: input.sourcePublishedAt || null,
      discoveredAt: now,
      verificationStatus: input.verificationStatus,
      confidenceScore: clampScore(input.confidenceScore),
      popularityScore: clampScore(input.popularityScore),
      monetizationScore: clampScore(input.monetizationScore),
      urgencyScore: clampScore(input.urgencyScore),
      contentPriority: priority.level,
      contentPriorityScore: priority.score,
      contentDeadline: input.contentDeadline || null,
      recommendedPublishDate: input.recommendedPublishDate || null,
      thumbnailUrl: input.thumbnailUrl || null,
      officialImageUrl: input.officialImageUrl || null,
      tags: input.tags || [],
      aiSummaryTh: null,
      aiCaptionTh: null,
      contentAngle: null,
      status: input.status || "DISCOVERED",
      isFeatured: false,
      createdAt: now,
      updatedAt: now,
      lastCheckedAt: now,
    };
    const duplicate = memoryActivities.find(
      (item) =>
        `${item.gameSlug}|${item.title}|${item.startDate || ""}`
          .normalize("NFKC")
          .toLowerCase()
          .replace(/\s+/g, " ")
          .slice(0, 500) === fingerprint
    );
    if (duplicate) return { activity: duplicate, created: false };
    memoryActivities.push(activity);
    return { activity, created: true };
  }

  await ensureGameContentTables();
  const sql = getDb();
  const [row] = await sql<ActivityUpsertRow[]>`
    insert into game_activities (
      game_id, title, original_title, activity_type, description,
      start_date, end_date, announcement_date, expected_release_date,
      region, platform, source_name, source_url, source_type,
      source_published_at, verification_status, confidence_score,
      popularity_score, monetization_score, urgency_score,
      content_priority, content_priority_score, content_deadline,
      recommended_publish_date, thumbnail_url, official_image_url,
      tags, status, fingerprint
    )
    values (
      ${input.gameId}, ${input.title}, ${input.originalTitle || null},
      ${input.activityType}, ${input.description}, ${input.startDate || null},
      ${input.endDate || null}, ${input.announcementDate || null},
      ${input.expectedReleaseDate || null}, ${input.region}, ${input.platform},
      ${input.sourceName}, ${input.sourceUrl}, ${input.sourceType},
      ${input.sourcePublishedAt || null}, ${input.verificationStatus},
      ${clampScore(input.confidenceScore)}, ${clampScore(input.popularityScore)},
      ${clampScore(input.monetizationScore)}, ${clampScore(input.urgencyScore)},
      ${priority.level}, ${priority.score}, ${input.contentDeadline || null},
      ${input.recommendedPublishDate || null}, ${input.thumbnailUrl || null},
      ${input.officialImageUrl || null}, ${sql.json(input.tags || [])},
      ${input.status || "DISCOVERED"}, ${fingerprint}
    )
    on conflict (fingerprint)
    do update set
      last_checked_at = now(),
      updated_at = now()
    returning
      *, (xmax = 0) as was_inserted,
      ${game.slug}::text as game_slug, ${game.name}::text as game_name
  `;
  await sql`
    insert into activity_sources (
      activity_id, source_name, source_url, source_type, source_published_at
    )
    values (
      ${row.id}, ${input.sourceName}, ${input.sourceUrl}, ${input.sourceType},
      ${input.sourcePublishedAt || null}
    )
    on conflict (activity_id, source_url) do nothing
  `;
  return { activity: mapActivity(row), created: row.was_inserted };
}

export async function updateActivity(
  id: string,
  input: Partial<
    Pick<
      GameActivity,
      | "title"
      | "description"
      | "activityType"
      | "startDate"
      | "endDate"
      | "expectedReleaseDate"
      | "verificationStatus"
      | "confidenceScore"
      | "popularityScore"
      | "monetizationScore"
      | "urgencyScore"
      | "contentDeadline"
      | "recommendedPublishDate"
      | "status"
      | "isFeatured"
    >
  >,
  actorId: string,
  note?: string
) {
  const current = await getActivity(id);
  if (!current) return null;
  const effectiveStartDate =
    input.startDate === undefined ? current.startDate : input.startDate;
  const effectiveExpectedReleaseDate =
    input.expectedReleaseDate === undefined
      ? current.expectedReleaseDate
      : input.expectedReleaseDate;
  if (
    input.status === "APPROVED" &&
    !effectiveStartDate &&
    !effectiveExpectedReleaseDate
  ) {
    throw new Error(
      "ต้องระบุวันเริ่มกิจกรรมก่อน APPROVED เพื่อวางลงปฏิทินให้ถูกวัน"
    );
  }
  const effectiveEndDate =
    input.endDate === undefined ? current.endDate : input.endDate;
  if (
    effectiveStartDate &&
    effectiveEndDate &&
    new Date(effectiveEndDate).getTime() <
      new Date(effectiveStartDate).getTime()
  ) {
    throw new Error("วันสิ้นสุดกิจกรรมต้องไม่อยู่ก่อนวันเริ่มกิจกรรม");
  }
  const priority = calculateContentPriority({
    popularityScore: input.popularityScore ?? current.popularityScore,
    monetizationScore: input.monetizationScore ?? current.monetizationScore,
    urgencyScore: input.urgencyScore ?? current.urgencyScore,
  });

  if (!hasDatabaseUrl()) {
    Object.assign(current, input, {
      contentPriority: priority.level,
      contentPriorityScore: priority.score,
      updatedAt: new Date().toISOString(),
    });
    return current;
  }

  await ensureGameContentTables();
  const sql = getDb();
  const [row] = await sql<ActivityRow[]>`
    update game_activities set
      title = ${input.title ?? current.title},
      description = ${input.description ?? current.description},
      activity_type = ${input.activityType ?? current.activityType},
      start_date = ${
        input.startDate === undefined ? current.startDate : input.startDate
      },
      end_date = ${input.endDate === undefined ? current.endDate : input.endDate},
      expected_release_date = ${
        input.expectedReleaseDate === undefined
          ? current.expectedReleaseDate
          : input.expectedReleaseDate
      },
      verification_status = ${
        input.verificationStatus ?? current.verificationStatus
      },
      confidence_score = ${
        input.confidenceScore ?? current.confidenceScore
      },
      popularity_score = ${
        input.popularityScore ?? current.popularityScore
      },
      monetization_score = ${
        input.monetizationScore ?? current.monetizationScore
      },
      urgency_score = ${input.urgencyScore ?? current.urgencyScore},
      content_priority = ${priority.level},
      content_priority_score = ${priority.score},
      content_deadline = ${
        input.contentDeadline === undefined
          ? current.contentDeadline
          : input.contentDeadline
      },
      recommended_publish_date = ${
        input.recommendedPublishDate === undefined
          ? current.recommendedPublishDate
          : input.recommendedPublishDate
      },
      status = ${input.status ?? current.status},
      is_featured = ${input.isFeatured ?? current.isFeatured},
      updated_at = now()
    where id = ${id}
    returning
      *, ${current.gameSlug}::text as game_slug,
      ${current.gameName}::text as game_name
  `;
  if (input.status && input.status !== current.status) {
    await sql`
      insert into activity_status_logs (
        activity_id, actor_user_id, previous_status, new_status, note
      )
      values (${id}, ${actorId}, ${current.status}, ${input.status}, ${note || null})
    `;
  }
  return mapActivity(row);
}

export async function deleteActivity(id: string) {
  if (!hasDatabaseUrl()) {
    const index = memoryActivities.findIndex((item) => item.id === id);
    if (index < 0) return false;
    memoryActivities.splice(index, 1);
    return true;
  }
  await ensureGameContentTables();
  const sql = getDb();
  const rows = await sql<Array<{ id: string }>>`
    delete from game_activities
    where id = ${id}
    returning id
  `;
  return rows.length > 0;
}

export async function bulkUpdateActivities(
  ids: string[],
  status: ContentStatus,
  actorId: string,
  note?: string
) {
  const updated = [];
  for (const id of ids.slice(0, 100)) {
    const activity = await updateActivity(id, { status }, actorId, note);
    if (activity) updated.push(activity);
  }
  return updated;
}

export async function saveGeneratedContent(
  activityId: string,
  actorId: string,
  content: GeneratedGameContent,
  provider: string,
  model: string | null
) {
  const activity = await getActivity(activityId);
  if (!activity) return null;
  const summary = JSON.stringify(content.summary);
  const captions = JSON.stringify(content.captions);
  const angle = content.contentAngles.join(", ");

  if (!hasDatabaseUrl()) {
    activity.aiSummaryTh = summary;
    activity.aiCaptionTh = captions;
    activity.contentAngle = angle;
    return activity;
  }
  await ensureGameContentTables();
  const sql = getDb();
  await sql`
    insert into generated_contents (
      activity_id, generated_by_user_id, provider, model, output
    )
    values (
      ${activityId}, ${actorId}, ${provider}, ${model}, ${sql.json(content)}
    )
  `;
  await sql`
    update game_activities set
      ai_summary_th = ${summary},
      ai_caption_th = ${captions},
      content_angle = ${angle},
      updated_at = now()
    where id = ${activityId}
  `;
  return { ...activity, aiSummaryTh: summary, aiCaptionTh: captions, contentAngle: angle };
}

export async function getDashboardSummary() {
  const activities = await listActivities();
  const now = Date.now();
  const inDays = (date: string | null, days: number) => {
    if (!date) return false;
    const time = new Date(date).getTime();
    return time >= now && time <= now + days * 86_400_000;
  };
  const alerts = activities.flatMap((item) => {
    const itemAlerts: Array<{
      id: string;
      type: string;
      title: string;
      message: string;
    }> = [];
    if (
      item.verificationStatus === "OFFICIAL" &&
      now - new Date(item.discoveredAt).getTime() <= 7 * 86_400_000
    ) {
      itemAlerts.push({
        id: `${item.id}:official`,
        type: "OFFICIAL_NEW",
        title: item.title,
        message: `พบประกาศทางการใหม่ของ ${item.gameName}`,
      });
    }
    if (item.popularityScore > 75) {
      itemAlerts.push({
        id: `${item.id}:popular`,
        type: "POPULARITY_HIGH",
        title: item.title,
        message: `Popularity Score ${item.popularityScore}`,
      });
    }
    if (item.monetizationScore > 70) {
      itemAlerts.push({
        id: `${item.id}:monetization`,
        type: "MONETIZATION_HIGH",
        title: item.title,
        message: `Monetization Score ${item.monetizationScore}`,
      });
    }
    if (
      item.contentDeadline &&
      new Date(item.contentDeadline).getTime() < now &&
      !["PUBLISHED", "SKIPPED"].includes(item.status)
    ) {
      itemAlerts.push({
        id: `${item.id}:overdue`,
        type: "CONTENT_OVERDUE",
        title: item.title,
        message: "งานคอนเทนต์เลยกำหนด",
      });
    }
    return itemAlerts;
  });

  return {
    newThisWeek: activities.filter(
      (item) => now - new Date(item.discoveredAt).getTime() <= 7 * 86_400_000
    ).length,
    startsWithin7Days: activities.filter((item) => inDays(item.startDate, 7)).length,
    contentTasks: activities.filter(
      (item) => !["PUBLISHED", "SKIPPED", "EXPIRED"].includes(item.status)
    ).length,
    nearDeadline: activities.filter((item) => inDays(item.contentDeadline, 3)).length,
    trendingGames: new Set(
      activities
        .filter((item) => item.popularityScore > 75)
        .map((item) => item.gameId)
    ).size,
    highTopupOpportunity: activities.filter(
      (item) => item.monetizationScore > 70
    ).length,
    alerts: alerts.slice(0, 20),
  };
}

export async function saveCalendarItem(input: {
  activityId: string | null;
  calendarType: string;
  scheduledAt: string;
  postType: string;
  status?: string;
}) {
  if (!hasDatabaseUrl()) {
    return { id: randomUUID(), ...input, status: input.status || "PLANNED" };
  }
  await ensureGameContentTables();
  const sql = getDb();
  const [row] = await sql`
    insert into content_calendar (
      activity_id, calendar_type, scheduled_at, post_type, status
    )
    values (
      ${input.activityId}, ${input.calendarType}, ${input.scheduledAt},
      ${input.postType}, ${input.status || "PLANNED"}
    )
    returning *
  `;
  return row;
}

export async function recordCrawlerRun(input: {
  runType: string;
  status: string;
  sourceCount: number;
  candidateCount: number;
  discoveredCount: number;
  duplicateCount: number;
  errorCount: number;
  errorMessage?: string | null;
}) {
  if (!hasDatabaseUrl()) return { id: randomUUID(), ...input };
  await ensureGameContentTables();
  const sql = getDb();
  const [row] = await sql`
    insert into crawler_runs (
      run_type, status, source_count, candidate_count, discovered_count,
      duplicate_count, counting_version, error_count, error_message, finished_at
    )
    values (
      ${input.runType}, ${input.status}, ${input.sourceCount},
      ${input.candidateCount}, ${input.discoveredCount},
      ${input.duplicateCount}, 2, ${input.errorCount},
      ${input.errorMessage || null}, now()
    )
    returning *
  `;
  return row;
}

export async function listCrawlerRuns(limit = 20) {
  if (!hasDatabaseUrl()) return [];
  await ensureGameContentTables();
  const sql = getDb();
  const rows = await sql<
    Array<{
      id: string;
      run_type: string;
      status: string;
      source_count: number;
      candidate_count: number;
      discovered_count: number;
      duplicate_count: number;
      counting_version: number;
      error_count: number;
      error_message: string | null;
      started_at: Date;
      finished_at: Date | null;
    }>
  >`
    select *
    from crawler_runs
    order by started_at desc
    limit ${Math.max(1, Math.min(100, limit))}
  `;
  return rows.map((row) => ({
    id: row.id,
    runType: row.run_type,
    status: row.status,
    sourceCount: row.source_count,
    candidateCount: row.candidate_count,
    discoveredCount: row.discovered_count,
    duplicateCount: row.duplicate_count,
    countingVersion: row.counting_version,
    errorCount: row.error_count,
    errorMessage: row.error_message,
    startedAt: row.started_at.toISOString(),
    finishedAt: row.finished_at?.toISOString() || null,
  }));
}
