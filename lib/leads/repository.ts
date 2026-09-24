import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/db";
import { shopFor } from "@/lib/media/repository";
import type { GameDictionaryItem } from "./logic";
import type { AiLeadAnalysis, LeadStatus, RuleAnalysis } from "./types";

export type LeadListFilters = {
  status?: string | null;
  gameId?: string | null;
  intent?: string | null;
  minScore?: number | null;
  query?: string | null;
  saved?: boolean | null;
  page?: number;
  limit?: number;
};

async function readWorkspace(userId: string) {
  const [row] = await getDb()<[{ id: string }]>`
    select id from shops where owner_user_id = ${userId}::uuid limit 1
  `;
  return row?.id || null;
}

async function ensureWorkspace(userId: string) {
  return getDb().begin(async (tx) => (await shopFor(tx, userId)).id);
}

export async function gameDictionary(): Promise<GameDictionaryItem[]> {
  const db = getDb();
  const games = await db<{ id: string; slug: string; name: string; icon_url: string | null }[]>`
    select id, slug, coalesce(display_name, name) as name, icon_url
    from games
    where is_active
    order by name
  `;
  if (!games.length) return [];
  const aliases = await db<{ game_id: string; alias: string }[]>`
    select game_id, alias from game_aliases
  `;
  const grouped = new Map<string, string[]>();
  for (const row of aliases) {
    grouped.set(row.game_id, [...(grouped.get(row.game_id) || []), row.alias]);
  }
  return games.map((game) => ({
    id: game.id,
    slug: game.slug,
    name: game.name,
    iconUrl: game.icon_url,
    aliases: [game.name, game.slug, ...(grouped.get(game.id) || [])],
  }));
}

export async function insertLeadFromAnalysis(args: {
  userId: string;
  text: string;
  sourceType: string;
  sourceUrl?: string | null;
  sourceExternalId?: string | null;
  authorName?: string | null;
  normalizedText: string;
  textHash: string;
  gameId?: string | null;
  gameConfidence: number;
  rules: RuleAnalysis;
}) {
  const db = getDb();
  return db.begin(async (tx) => {
    const shop = await shopFor(tx, args.userId);
    const [settings] = await tx`
      select duplicate_window_hours
      from user_lead_settings
      where workspace_id = ${shop.id} and user_id = ${args.userId}::uuid
    `;
    const windowHours = Number(settings?.duplicate_window_hours || 168);

    let existing: { id: string } | null = null;
    if (args.sourceExternalId) {
      [existing] = await tx<{ id: string }[]>`
        select id from leads
        where workspace_id = ${shop.id}
          and source_type = ${args.sourceType}
          and source_external_id = ${args.sourceExternalId}
        limit 1
      `;
    }
    if (!existing) {
      [existing] = await tx<{ id: string }[]>`
        select id from leads
        where workspace_id = ${shop.id}
          and normalized_text_hash = ${args.textHash}
          and last_seen_at > now() - (${windowHours}::text || ' hours')::interval
        order by last_seen_at desc
        limit 1
      `;
    }

    if (existing) {
      await tx`
        update leads
        set last_seen_at = now(), updated_at = now(), is_duplicate = true
        where id = ${existing.id} and workspace_id = ${shop.id}
      `;
      await tx`
        insert into lead_occurrences
          (lead_id, workspace_id, source_type, source_url, source_external_id, author_name, original_text)
        values
          (${existing.id}, ${shop.id}, ${args.sourceType}, ${args.sourceUrl || null},
           ${args.sourceExternalId || null}, ${args.authorName || null}, ${args.text})
        on conflict do nothing
      `;
      return { id: existing.id, duplicate: true };
    }

    const id = randomUUID();
    const initialStatus = args.rules.isSeller || args.rules.isSpam ? "IGNORED" : "NEW";
    await tx`
      insert into leads (
        id, workspace_id, source_type, source_url, source_external_id, author_name,
        original_text, normalized_text, normalized_text_hash, game_id, intent,
        buyer_confidence, game_confidence, intent_confidence, lead_score, temperature,
        status, detected_currency, detected_amount, detected_package, detected_budget,
        detected_location, detected_platform, detected_region, detected_device,
        detected_urgency, detected_payment_method, language, matched_keywords,
        ai_summary, analysis_status, is_spam, is_seller
      ) values (
        ${id}, ${shop.id}, ${args.sourceType}, ${args.sourceUrl || null},
        ${args.sourceExternalId || null}, ${args.authorName || null},
        ${args.text}, ${args.normalizedText}, ${args.textHash}, ${args.gameId || null},
        ${args.rules.intent}, ${args.rules.buyerConfidence}, ${args.gameConfidence},
        ${args.rules.intentConfidence}, ${args.rules.leadScore}, ${args.rules.temperature},
        ${initialStatus}, ${args.rules.product.currency}, ${args.rules.product.amount},
        ${args.rules.product.package}, ${args.rules.budget}, ${args.rules.location},
        ${args.rules.platform}, ${args.rules.region}, ${args.rules.device},
        ${args.rules.urgency}, ${args.rules.paymentMethod}, ${args.rules.language},
        ${tx.json(args.rules.matchedKeywords)}, ${args.rules.summary}, 'AI_PENDING',
        ${args.rules.isSpam}, ${args.rules.isSeller}
      )
    `;
    await tx`
      insert into lead_occurrences
        (lead_id, workspace_id, source_type, source_url, source_external_id, author_name, original_text)
      values
        (${id}, ${shop.id}, ${args.sourceType}, ${args.sourceUrl || null},
         ${args.sourceExternalId || null}, ${args.authorName || null}, ${args.text})
    `;
    await tx`
      insert into lead_status_history
        (lead_id, workspace_id, old_status, new_status, changed_by)
      values (${id}, ${shop.id}, null, ${initialStatus}, ${args.userId}::uuid)
    `;
    await tx`
      insert into lead_events(workspace_id, lead_id, actor_user_id, event, metadata)
      values (${shop.id}, ${id}, ${args.userId}::uuid, 'LEAD_CREATED', '{}'::jsonb)
    `;
    if (args.rules.leadScore >= 80 && initialStatus !== "IGNORED") {
      const [setting] = await tx`
        select hot_lead_enabled, minimum_hot_score
        from notification_settings
        where workspace_id = ${shop.id} and user_id = ${args.userId}::uuid
      `;
      const enabled = setting?.hot_lead_enabled ?? true;
      const threshold = Number(setting?.minimum_hot_score || 80);
      if (enabled && args.rules.leadScore >= threshold) {
        await tx`
          insert into notifications(user_id, type, title, message)
          values (${args.userId}::uuid, 'HOT_LEAD', 'Lead ใหม่ที่ควรตอบ', ${args.text.slice(0, 180)})
        `;
      }
    }
    return { id, duplicate: false };
  });
}

export async function applyAiAnalysis(args: {
  userId: string;
  leadId: string;
  analysis: AiLeadAnalysis;
  model: string;
  promptVersion: string;
  sourceHash: string;
  latencyMs: number;
}) {
  const workspaceId = await readWorkspace(args.userId);
  if (!workspaceId) throw new Error("LEAD_WORKSPACE_NOT_FOUND");
  const db = getDb();
  const [game] = args.analysis.gameSlug
    ? await db<{ id: string }[]>`select id from games where slug = ${args.analysis.gameSlug} and is_active limit 1`
    : [];
  const needsReview =
    args.analysis.gameConfidence < 0.65 ||
    args.analysis.intentConfidence < 0.65 ||
    args.analysis.buyerConfidence < 0.55;

  await db.begin(async (tx) => {
    await tx`
      insert into lead_ai_analysis
        (lead_id, workspace_id, model, prompt_version, analysis_version, source_text_hash, latency_ms, status, result)
      values
        (${args.leadId}, ${workspaceId}, ${args.model}, ${args.promptVersion}, '1',
         ${args.sourceHash}, ${args.latencyMs}, 'SUCCEEDED', ${tx.json(args.analysis)})
    `;
    await tx`
      update leads set
        game_id = coalesce(${game?.id || null}::uuid, game_id),
        game_confidence = ${args.analysis.gameConfidence},
        intent = ${args.analysis.intent},
        intent_confidence = ${args.analysis.intentConfidence},
        buyer_confidence = ${args.analysis.buyerConfidence},
        is_seller = ${args.analysis.isSeller},
        is_spam = ${args.analysis.isSpam},
        detected_currency = ${args.analysis.product.currency},
        detected_amount = ${args.analysis.product.amount},
        detected_package = ${args.analysis.product.package},
        detected_budget = ${args.analysis.budget},
        detected_location = ${args.analysis.location},
        detected_platform = ${args.analysis.platform},
        detected_region = ${args.analysis.region},
        detected_device = ${args.analysis.device},
        detected_urgency = ${args.analysis.urgency},
        detected_payment_method = ${args.analysis.paymentMethod},
        language = ${args.analysis.language},
        ai_summary = ${args.analysis.summary},
        analysis_status = ${needsReview ? "NEEDS_REVIEW" : "AI_SUCCEEDED"},
        status = case when ${args.analysis.isSeller || args.analysis.isSpam} then 'IGNORED' else status end,
        updated_at = now()
      where id = ${args.leadId} and workspace_id = ${workspaceId}
    `;
  });
}

export async function markAiFailed(userId: string, leadId: string, sourceHash: string, errorCode: string) {
  const workspaceId = await readWorkspace(userId);
  if (!workspaceId) return;
  const db = getDb();
  await db.begin(async (tx) => {
    await tx`
      insert into lead_ai_analysis
        (lead_id, workspace_id, model, prompt_version, analysis_version, source_text_hash, status, result, error_code)
      values
        (${leadId}, ${workspaceId}, 'unavailable', 'lead-radar-v1', '1',
         ${sourceHash}, 'FAILED', '{}'::jsonb, ${errorCode.slice(0, 64)})
    `;
    await tx`
      update leads set analysis_status = 'AI_FAILED', updated_at = now()
      where id = ${leadId} and workspace_id = ${workspaceId}
    `;
  });
}

export async function markAiFailed(
  userId: string,
  leadId: string,
  sourceHash: string,
  errorCode: string
) {
  const workspaceId = await readWorkspace(userId);
  if (!workspaceId) return;
  const db = getDb();
  await db.begin(async (tx) => {
    await tx`
      insert into lead_ai_analysis
        (lead_id, workspace_id, model, prompt_version, analysis_version, source_text_hash, status, result, error_code)
      values
        (${leadId}, ${workspaceId}, 'unavailable', 'lead-radar-v1', '1',
         ${sourceHash}, 'FAILED', '{}'::jsonb, ${errorCode.slice(0, 64)})
    `;
    await tx`
      update leads
      set analysis_status = 'AI_FAILED', updated_at = now()
      where id = ${leadId} and workspace_id = ${workspaceId}
    `;
  });
}

export async function listLeads(userId: string, filters: LeadListFilters = {}) {
  const workspaceId = await readWorkspace(userId);
  if (!workspaceId) return { items: [], page: 1, limit: 30, total: 0 };
  const page = Math.max(1, filters.page || 1);
  const limit = Math.max(1, Math.min(100, filters.limit || 30));
  const offset = (page - 1) * limit;
  const q = (filters.query || "").trim();
  const status = filters.status || null;
  const gameId = filters.gameId || null;
  const intent = filters.intent || null;
  const minScore = filters.minScore ?? null;
  const saved = filters.saved ?? null;
  const db = getDb();

  const [{ count }] = await db<{ count: number | string }[]>`
    select count(*) as count from leads l
    where l.workspace_id = ${workspaceId}
      and (${status}::text is null or l.status = ${status})
      and (${gameId}::uuid is null or l.game_id = ${gameId}::uuid)
      and (${intent}::text is null or l.intent = ${intent})
      and (${minScore}::int is null or l.lead_score >= ${minScore})
      and (${saved}::boolean is null or l.is_saved = ${saved})
      and (${q} = '' or l.original_text ilike ${"%" + q + "%"} or coalesce(l.author_name, '') ilike ${"%" + q + "%"})
      and not (l.is_seller or l.is_spam)
  `;
  const items = await db`
    select l.*, g.slug as game_slug, coalesce(g.display_name, g.name) as game_name, g.icon_url
    from leads l
    left join games g on g.id = l.game_id
    where l.workspace_id = ${workspaceId}
      and (${status}::text is null or l.status = ${status})
      and (${gameId}::uuid is null or l.game_id = ${gameId}::uuid)
      and (${intent}::text is null or l.intent = ${intent})
      and (${minScore}::int is null or l.lead_score >= ${minScore})
      and (${saved}::boolean is null or l.is_saved = ${saved})
      and (${q} = '' or l.original_text ilike ${"%" + q + "%"} or coalesce(l.author_name, '') ilike ${"%" + q + "%"})
      and not (l.is_seller or l.is_spam)
    order by l.created_at desc
    limit ${limit} offset ${offset}
  `;
  return { items, page, limit, total: Number(count || 0) };
}

export async function getLead(userId: string, leadId: string) {
  const workspaceId = await readWorkspace(userId);
  if (!workspaceId) return null;
  const db = getDb();
  const [lead] = await db`
    select l.*, g.slug as game_slug, coalesce(g.display_name, g.name) as game_name, g.icon_url
    from leads l left join games g on g.id = l.game_id
    where l.id = ${leadId}::uuid and l.workspace_id = ${workspaceId}
  `;
  if (!lead) return null;
  const [notes, replies, history, occurrences] = await Promise.all([
    db`select * from lead_notes where lead_id = ${leadId} and workspace_id = ${workspaceId} order by created_at desc`,
    db`select * from lead_replies where lead_id = ${leadId} and workspace_id = ${workspaceId} order by created_at desc limit 10`,
    db`select * from lead_status_history where lead_id = ${leadId} and workspace_id = ${workspaceId} order by created_at desc`,
    db`select * from lead_occurrences where lead_id = ${leadId} and workspace_id = ${workspaceId} order by discovered_at desc`,
  ]);
  return { lead, notes, replies, history, occurrences };
}

export async function updateLeadStatus(
  userId: string,
  leadId: string,
  newStatus: LeadStatus,
  followUpAt?: string | null,
  followUpNote?: string | null
) {
  const workspaceId = await readWorkspace(userId);
  if (!workspaceId) throw new Error("LEAD_NOT_FOUND");
  const db = getDb();
  return db.begin(async (tx) => {
    const [current] = await tx<{ status: string }[]>`
      select status from leads
      where id = ${leadId}::uuid and workspace_id = ${workspaceId}
      for update
    `;
    if (!current) throw new Error("LEAD_NOT_FOUND");
    await tx`
      update leads set
        status = ${newStatus},
        follow_up_at = ${newStatus === "FOLLOW_UP" && followUpAt ? new Date(followUpAt) : null},
        follow_up_note = ${newStatus === "FOLLOW_UP" ? followUpNote || null : null},
        updated_at = now()
      where id = ${leadId} and workspace_id = ${workspaceId}
    `;
    await tx`
      insert into lead_status_history
        (lead_id, workspace_id, old_status, new_status, changed_by)
      values (${leadId}, ${workspaceId}, ${current.status}, ${newStatus}, ${userId}::uuid)
    `;
    return { id: leadId, status: newStatus };
  });
}

export async function addLeadNote(userId: string, leadId: string, body: string) {
  const workspaceId = await readWorkspace(userId);
  if (!workspaceId) throw new Error("LEAD_NOT_FOUND");
  const id = randomUUID();
  const rows = await getDb()`
    insert into lead_notes(id, lead_id, workspace_id, author_user_id, body)
    select ${id}, l.id, l.workspace_id, ${userId}::uuid, ${body}
    from leads l
    where l.id = ${leadId}::uuid and l.workspace_id = ${workspaceId}
    returning id
  `;
  if (!rows.length) throw new Error("LEAD_NOT_FOUND");
  return { id };
}

export async function getLeadForReply(userId: string, leadId: string) {
  const workspaceId = await readWorkspace(userId);
  if (!workspaceId) return null;
  const [row] = await getDb()`
    select l.*, coalesce(g.display_name, g.name) as game_name
    from leads l left join games g on g.id = l.game_id
    where l.id = ${leadId}::uuid and l.workspace_id = ${workspaceId}
  `;
  return row || null;
}

export async function findPriceForLead(userId: string, leadId: string) {
  const workspaceId = await readWorkspace(userId);
  if (!workspaceId) return null;
  const db = getDb();
  const [lead] = await db<{ game_id: string | null; detected_currency: string | null; detected_amount: number | null }[]>`
    select game_id, detected_currency, detected_amount
    from leads
    where id = ${leadId}::uuid and workspace_id = ${workspaceId}
  `;
  if (!lead?.game_id) return null;
  const [row] = await db`
    select id, package_name, currency_code, amount, price_thb
    from game_price_packages
    where workspace_id = ${workspaceId}
      and game_id = ${lead.game_id}
      and is_active
      and (starts_at is null or starts_at <= now())
      and (ends_at is null or ends_at > now())
      and (${lead.detected_currency}::text is null or upper(coalesce(currency_code,'')) = upper(${lead.detected_currency}))
      and (${lead.detected_amount}::numeric is null or amount = ${lead.detected_amount})
    order by case when amount = ${lead.detected_amount} then 0 else 1 end, updated_at desc
    limit 1
  `;
  return row || null;
}

export async function saveLeadReply(args: {
  userId: string;
  leadId: string;
  content: string;
  tone: string;
  model?: string | null;
  pricePackageId?: string | null;
}) {
  const workspaceId = await readWorkspace(args.userId);
  if (!workspaceId) throw new Error("LEAD_NOT_FOUND");
  const id = randomUUID();
  const rows = await getDb()`
    insert into lead_replies
      (id, lead_id, workspace_id, generated_by_user_id, tone, content, price_package_id, model, prompt_version)
    select ${id}, l.id, l.workspace_id, ${args.userId}::uuid, ${args.tone}, ${args.content},
           ${args.pricePackageId || null}::uuid, ${args.model || null}, 'lead-reply-v1'
    from leads l
    where l.id = ${args.leadId}::uuid and l.workspace_id = ${workspaceId}
    returning id
  `;
  if (!rows.length) throw new Error("LEAD_NOT_FOUND");
  return { id, content: args.content };
}


export async function createLeadImportJob(userId: string) {
  const workspaceId = await ensureWorkspace(userId);
  const id = randomUUID();
  await getDb()`
    insert into lead_import_jobs(id, workspace_id, created_by_user_id, source_type, status)
    values (${id}, ${workspaceId}, ${userId}::uuid, 'CSV', 'PROCESSING')
  `;
  return { id, workspaceId };
}

export async function finishLeadImportJob(
  userId: string,
  jobId: string,
  counts: { imported: number; duplicate: number; invalid: number; failed: number },
  errorMessage?: string | null
) {
  const workspaceId = await readWorkspace(userId);
  if (!workspaceId) throw new Error("LEAD_WORKSPACE_NOT_FOUND");
  await getDb()`
    update lead_import_jobs set
      status = ${errorMessage ? "FAILED" : "COMPLETED"},
      imported_count = ${counts.imported},
      duplicate_count = ${counts.duplicate},
      invalid_count = ${counts.invalid},
      failed_count = ${counts.failed},
      error_message = ${errorMessage || null},
      completed_at = now()
    where id = ${jobId}::uuid and workspace_id = ${workspaceId}
  `;
  return { id: jobId, ...counts, status: errorMessage ? "FAILED" : "COMPLETED" };
}

export async function listReplyTemplates(userId: string) {
  const workspaceId = await readWorkspace(userId);
  if (!workspaceId) return [];
  return getDb()`
    select t.*, coalesce(g.display_name, g.name) as game_name
    from reply_templates t
    left join games g on g.id = t.game_id
    where t.workspace_id = ${workspaceId} and t.active
    order by t.name
  `;
}

export async function createReplyTemplate(
  userId: string,
  input: { name: string; gameId?: string | null; intent?: string | null; content: string }
) {
  const workspaceId = await ensureWorkspace(userId);
  const id = randomUUID();
  await getDb()`
    insert into reply_templates
      (id, workspace_id, created_by_user_id, name, game_id, intent, content, variables)
    values
      (${id}, ${workspaceId}, ${userId}::uuid, ${input.name},
       ${input.gameId || null}::uuid, ${input.intent || null}, ${input.content},
       '["game","package","price","store_name","promotion","contact"]'::jsonb)
  `;
  return { id };
}

export async function getLeadAnalytics(userId: string, days = 30) {
  const workspaceId = await readWorkspace(userId);
  if (!workspaceId) {
    return {
      total: 0, hot: 0, contacted: 0, won: 0, conversionRate: 0,
      averageScore: 0, topGames: [], topIntent: [], sources: [],
    };
  }
  const safeDays = Math.max(1, Math.min(365, Math.floor(days)));
  const db = getDb();
  const [summary] = await db`
    select
      count(*)::int as total,
      count(*) filter (where lead_score >= 80 and not is_seller and not is_spam)::int as hot,
      count(*) filter (where status in ('CONTACTED','WAITING','FOLLOW_UP','WON'))::int as contacted,
      count(*) filter (where status = 'WON')::int as won,
      coalesce(round(avg(lead_score), 1), 0) as average_score
    from leads
    where workspace_id = ${workspaceId}
      and created_at >= now() - (${safeDays}::text || ' days')::interval
  `;
  const [topGames, topIntent, sources] = await Promise.all([
    db`
      select coalesce(g.display_name, g.name, 'ไม่ระบุเกม') as name, count(*)::int as count
      from leads l left join games g on g.id = l.game_id
      where l.workspace_id = ${workspaceId}
        and l.created_at >= now() - (${safeDays}::text || ' days')::interval
        and not (l.is_seller or l.is_spam)
      group by coalesce(g.display_name, g.name, 'ไม่ระบุเกม')
      order by count(*) desc limit 10
    `,
    db`
      select intent as name, count(*)::int as count
      from leads
      where workspace_id = ${workspaceId}
        and created_at >= now() - (${safeDays}::text || ' days')::interval
        and not (is_seller or is_spam)
      group by intent order by count(*) desc limit 10
    `,
    db`
      select source_type as name, count(*)::int as count
      from leads
      where workspace_id = ${workspaceId}
        and created_at >= now() - (${safeDays}::text || ' days')::interval
      group by source_type order by count(*) desc limit 10
    `,
  ]);
  const total = Number(summary?.total || 0);
  const won = Number(summary?.won || 0);
  return {
    total,
    hot: Number(summary?.hot || 0),
    contacted: Number(summary?.contacted || 0),
    won,
    conversionRate: total ? Math.round((won / total) * 1000) / 10 : 0,
    averageScore: Number(summary?.average_score || 0),
    topGames,
    topIntent,
    sources,
  };
}

export async function getLeadSettings(userId: string) {
  const workspaceId = await ensureWorkspace(userId);
  const [row] = await getDb()`
    select minimum_lead_score, ai_language, default_reply_tone, duplicate_window_hours,
           monitored_game_ids, custom_keywords, negative_keywords
    from user_lead_settings
    where workspace_id = ${workspaceId} and user_id = ${userId}::uuid
  `;
  return row || {
    minimum_lead_score: 0,
    ai_language: "th",
    default_reply_tone: "SHORT_FRIENDLY",
    duplicate_window_hours: 168,
    monitored_game_ids: [],
    custom_keywords: {},
    negative_keywords: [],
  };
}

export async function saveLeadSettings(
  userId: string,
  input: {
    minimumLeadScore: number;
    aiLanguage: string;
    defaultReplyTone: string;
    duplicateWindowHours: number;
    monitoredGameIds: string[];
    negativeKeywords: string[];
  }
) {
  const workspaceId = await ensureWorkspace(userId);
  const db = getDb();
  await db`
    insert into user_lead_settings
      (workspace_id, user_id, minimum_lead_score, ai_language, default_reply_tone,
       duplicate_window_hours, monitored_game_ids, negative_keywords)
    values
      (${workspaceId}, ${userId}::uuid, ${input.minimumLeadScore}, ${input.aiLanguage},
       ${input.defaultReplyTone}, ${input.duplicateWindowHours},
       ${db.json(input.monitoredGameIds)}, ${db.json(input.negativeKeywords)})
    on conflict (workspace_id, user_id) do update set
      minimum_lead_score = excluded.minimum_lead_score,
      ai_language = excluded.ai_language,
      default_reply_tone = excluded.default_reply_tone,
      duplicate_window_hours = excluded.duplicate_window_hours,
      monitored_game_ids = excluded.monitored_game_ids,
      negative_keywords = excluded.negative_keywords,
      updated_at = now()
  `;
  return getLeadSettings(userId);
}
