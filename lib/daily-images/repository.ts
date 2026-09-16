import { getDb } from "@/lib/db";
import { isDailyImageBlobUrl } from "@/lib/daily-images/storage";

export type DailyImageSlot = "image1" | "image2";

export type DailyImageItem = {
  id: string;
  gameName: string;
  gameTag: string;
  imageSlot: DailyImageSlot;
  imageUrl: string;
  isActive: boolean;
  createdAt: string;
};

type DailyImageRow = {
  id: string;
  game_name: string;
  game_tag: string | null;
  image_slot: DailyImageSlot;
  image_url: string;
  is_active: boolean;
  created_at: Date;
};

let tableEnsured = false;

async function ensureDailyImagesTable() {
  if (tableEnsured) return;

  const db = getDb();
  await db`
    create table if not exists daily_images (
      id uuid primary key default gen_random_uuid(),
      game_name text not null,
      game_tag text not null default '',
      image_slot text not null check (image_slot in ('image1', 'image2')),
      image_url text not null,
      is_active boolean not null default true,
      uploaded_by_user_id uuid references users(id) on delete set null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `;
  await db`
    alter table daily_images
      add column if not exists game_tag text not null default ''
  `;
  await db`
    create index if not exists daily_images_game_slot_idx
      on daily_images(game_name, image_slot, is_active, created_at desc)
  `;
  await db`
    create index if not exists daily_images_game_tag_idx
      on daily_images(game_tag, image_slot, is_active, created_at desc)
  `;

  tableEnsured = true;
}

function toDailyImageItem(row: DailyImageRow): DailyImageItem {
  return {
    id: row.id,
    gameName: row.game_name,
    gameTag: row.game_tag || "",
    imageSlot: row.image_slot,
    imageUrl: isDailyImageBlobUrl(row.image_url)
      ? `/api/daily-images/assets/${row.id}`
      : row.image_url,
    isActive: row.is_active,
    createdAt: row.created_at.toISOString(),
  };
}

export async function listDailyImages({
  includeInactive = false,
}: {
  includeInactive?: boolean;
} = {}) {
  await ensureDailyImagesTable();

  const db = getDb();
  const rows = includeInactive
    ? await db<DailyImageRow[]>`
        select id, game_name, game_tag, image_slot, image_url, is_active, created_at
        from daily_images
        order by created_at desc, id desc
      `
    : await db<DailyImageRow[]>`
        select id, game_name, game_tag, image_slot, image_url, is_active, created_at
        from daily_images
        where is_active = true
        order by created_at desc, id desc
      `;

  return rows.map(toDailyImageItem);
}

export async function createDailyImage({
  gameName,
  gameTag,
  imageSlot,
  imageUrl,
  uploadedByUserId,
}: {
  gameName: string;
  gameTag?: string;
  imageSlot: DailyImageSlot;
  imageUrl: string;
  uploadedByUserId: string;
}) {
  await ensureDailyImagesTable();

  const db = getDb();
  const [row] = await db<DailyImageRow[]>`
    insert into daily_images (
      game_name,
      game_tag,
      image_slot,
      image_url,
      uploaded_by_user_id
    )
    values (
      ${gameName},
      ${gameTag || ""},
      ${imageSlot},
      ${imageUrl},
      ${uploadedByUserId}
    )
    returning id, game_name, game_tag, image_slot, image_url, is_active, created_at
  `;

  return toDailyImageItem(row);
}

export async function getDailyImageSource({
  id,
  includeInactive = false,
}: {
  id: string;
  includeInactive?: boolean;
}) {
  await ensureDailyImagesTable();

  const db = getDb();
  const rows = includeInactive
    ? await db<{ id: string; image_url: string; is_active: boolean }[]>`
        select id, image_url, is_active
        from daily_images
        where id = ${id}
        limit 1
      `
    : await db<{ id: string; image_url: string; is_active: boolean }[]>`
        select id, image_url, is_active
        from daily_images
        where id = ${id}
          and is_active = true
        limit 1
      `;

  return rows[0] || null;
}

export async function deleteDailyImage(id: string) {
  await ensureDailyImagesTable();

  const db = getDb();
  const rows = await db<{ id: string; image_url: string }[]>`
    delete from daily_images
    where id = ${id}
    returning id, image_url
  `;

  const row = rows[0];
  return row ? { id: row.id, imageUrl: row.image_url } : null;
}
