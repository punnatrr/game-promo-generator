import { getDb } from "@/lib/db";
import type { ActiveSubscriptionAccess } from "@/lib/subscription/repository";

const DEFAULT_HISTORY_LIMIT = 50;

type GenerationAction = "generate" | "refine";

type GenerationImageRow = {
  id: string;
  generation_id: string;
  image_url: string;
  thumbnail_url: string | null;
  action: GenerationAction;
  model: string;
  image_quality: string;
  aspect_ratio: string;
  created_at: Date;
  expires_at: Date;
};

export type GenerationHistoryItem = {
  id: string;
  generationId: string;
  imageUrl: string;
  thumbnailUrl: string | null;
  action: GenerationAction;
  model: string;
  imageQuality: string;
  aspectRatio: string;
  createdAt: string;
  expiresAt: string;
};

export async function recordGenerationHistory({
  access,
  action,
  model,
  imageQuality,
  aspectRatio,
  requestedImageCount,
  images,
}: {
  access: ActiveSubscriptionAccess | null;
  action: GenerationAction;
  model: string;
  imageQuality: string;
  aspectRatio: string;
  requestedImageCount: number;
  images: string[];
}) {
  if (!access || images.length === 0) return null;

  const db = getDb();
  const generatedImageCount = images.length;
  const status =
    generatedImageCount >= requestedImageCount ? "succeeded" : "partial";
  const retentionDays = Math.max(1, access.plan.historyRetentionDays || 30);

  const [generation] = await db<{ id: string }[]>`
    insert into generations (
      user_id,
      subscription_id,
      action,
      model,
      image_quality,
      aspect_ratio,
      requested_image_count,
      generated_image_count,
      status
    )
    values (
      ${access.userId},
      ${access.subscriptionId},
      ${action},
      ${model},
      ${imageQuality},
      ${aspectRatio},
      ${requestedImageCount},
      ${generatedImageCount},
      ${status}
    )
    returning id
  `;

  if (!generation) return null;

  for (const imageUrl of images) {
    await db`
      insert into generated_images (
        generation_id,
        user_id,
        image_url,
        expires_at
      )
      values (
        ${generation.id},
        ${access.userId},
        ${imageUrl},
        now() + (${retentionDays} * interval '1 day')
      )
    `;
  }

  return generation.id;
}

export async function listUserGenerationHistory({
  userId,
  limit = DEFAULT_HISTORY_LIMIT,
}: {
  userId: string;
  limit?: number;
}): Promise<GenerationHistoryItem[]> {
  const db = getDb();
  const safeLimit = Math.min(Math.max(limit, 1), 100);
  const rows = await db<GenerationImageRow[]>`
    select
      gi.id,
      gi.generation_id,
      gi.image_url,
      gi.thumbnail_url,
      g.action,
      g.model,
      g.image_quality,
      g.aspect_ratio,
      gi.created_at,
      gi.expires_at
    from generated_images gi
    join generations g on g.id = gi.generation_id
    where gi.user_id = ${userId}
      and gi.expires_at > now()
    order by gi.created_at desc
    limit ${safeLimit}
  `;

  return rows.map((row) => ({
    id: row.id,
    generationId: row.generation_id,
    imageUrl: row.image_url,
    thumbnailUrl: row.thumbnail_url,
    action: row.action,
    model: row.model,
    imageQuality: row.image_quality,
    aspectRatio: row.aspect_ratio,
    createdAt: row.created_at.toISOString(),
    expiresAt: row.expires_at.toISOString(),
  }));
}
