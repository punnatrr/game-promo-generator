import { getDb } from "@/lib/db";
import { BrandConflictError, BrandValidationError, EMPTY_BRAND, type BrandProfile, type BrandState } from "./model";

export async function readBrand(userId: string): Promise<BrandState> {
  const db = getDb();
  const [row] = await db<{ profile: BrandProfile; version: number; created_at: Date }[]>`
    select p.profile, p.version, p.created_at from shops s
    join brand_profiles p on p.shop_id = s.id and p.version = s.current_brand_version
    where s.owner_user_id = ${userId}::uuid
  `;
  return row ? { profile: row.profile, version: row.version, updatedAt: row.created_at.toISOString() }
    : { profile: EMPTY_BRAND, version: 0, updatedAt: null };
}

export async function saveBrand(userId: string, profile: BrandProfile, expectedVersion: number): Promise<BrandState> {
  const db = getDb();
  return db.begin(async (tx) => {
    await tx`insert into shops (owner_user_id) values (${userId}::uuid) on conflict (owner_user_id) do nothing`;
    const [shop] = await tx<{ id: string; current_brand_version: number }[]>`
      select id, current_brand_version from shops where owner_user_id = ${userId}::uuid for update
    `;
    if (shop.current_brand_version !== expectedVersion) throw new BrandConflictError("ข้อมูลถูกแก้ไขจากอีกแท็บแล้ว กรุณาโหลดข้อมูลล่าสุดก่อนบันทึกใหม่");
    if (profile.logoId) {
      const [logo] = await tx`select id from brand_logos where id = ${profile.logoId}::uuid and owner_user_id = ${userId}::uuid and ready for share`;
      if (!logo) throw new BrandValidationError("ไม่พบโลโก้ของบัญชีนี้ กรุณาอัปโหลดใหม่");
    }
    const version = expectedVersion + 1;
    const [saved] = await tx<{ created_at: Date }[]>`
      insert into brand_profiles (shop_id, version, profile, created_by)
      values (${shop.id}::uuid, ${version}, ${tx.json(profile)}, ${userId}::uuid) returning created_at
    `;
    await tx`update shops set current_brand_version = ${version} where id = ${shop.id}::uuid`;
    return { profile, version, updatedAt: saved.created_at.toISOString() };
  });
}

export async function readLogo(userId: string, id: string) {
  const db = getDb();
  const [row] = await db<{ blob_pathname: string }[]>`
    select blob_pathname from brand_logos where id = ${id}::uuid and owner_user_id = ${userId}::uuid and ready
  `;
  return row?.blob_pathname;
}
