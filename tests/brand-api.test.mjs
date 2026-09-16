import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import postgres from "postgres";

// Deliberately fixed to the disposable server; never use DATABASE_URL or .env.local.
const origin = "http://localhost:3107";
const db = postgres("postgresql://postgres:postgres@127.0.0.1:55439/postgres", { max: 1, prepare: false });
const request = (path, cookie, options = {}) => fetch(`${origin}${path}`, {
  ...options, headers: { Origin: origin, Cookie: cookie || "", "Content-Type": "application/json", ...options.headers },
});
async function account() {
  const res = await request("/api/auth/sign-up", "", { method: "POST", body: JSON.stringify({ email: `brand-${randomUUID()}@example.test`, password: randomUUID() }) });
  assert.equal(res.status, 200);
  return { cookie: res.headers.get("set-cookie").split(";")[0], user: (await res.json()).user };
}
test("Brand API: persisted revisions, ownership, conflicts and request boundaries", async () => {
  try {
    assert.equal((await request("/api/brand", "")).status, 401);
    const a = await account(); const b = await account();
    const empty = await (await request("/api/brand", a.cookie)).json();
    assert.equal(empty.version, 0);
    const profile = { ...empty.profile, shopName: "ร้านทดสอบ", contacts: { ...empty.profile.contacts, line: "@testshop" } };
    const save = (cookie, version, changes = {}, headers = {}) => request("/api/brand", cookie, {
      method: "PUT", headers, body: JSON.stringify({ profile: { ...profile, ...changes }, version }),
    });
    assert.equal((await save(a.cookie, 0, {}, { Origin: "https://other.example" })).status, 403);
    assert.equal((await save(a.cookie, 0, { contacts: { ...profile.contacts, website: "javascript:alert(1)" } })).status, 400);
    assert.equal((await save(a.cookie, 0, { trustStatements: ["อ้างข้อมูล"], claimsConfirmed: false })).status, 400);
    const first = await save(a.cookie, 0); assert.equal(first.status, 200);
    assert.equal((await first.json()).version, 1);
    assert.equal((await (await request("/api/brand", b.cookie)).json()).version, 0);
    assert.equal((await save(a.cookie, 0, { shopName: "stale" })).status, 409);
    const updated = await save(a.cookie, 1, { shopName: "ร้านชื่อใหม่" }); assert.equal(updated.status, 200);
    const reloaded = await (await request("/api/brand", a.cookie)).json();
    assert.equal(reloaded.profile.shopName, "ร้านชื่อใหม่");
    assert.equal(reloaded.version, 2);
    const history = await db`select p.version, p.profile from brand_profiles p join shops s on s.id=p.shop_id where s.owner_user_id=${a.user.id} order by p.version`;
    assert.equal(history.length, 2);
    assert.equal(history[0].profile.shopName, "ร้านทดสอบ");
    const foreignLogo = randomUUID();
    await db`insert into brand_logos (id, owner_user_id, blob_pathname, ready) values (${foreignLogo}, ${b.user.id}, ${`test-only/${foreignLogo}`}, true)`;
    assert.equal((await save(a.cookie, 2, { logoId: foreignLogo })).status, 400);
    assert.equal((await request(`/api/brand/logo/${foreignLogo}`, a.cookie)).status, 404);
    assert.equal((await request(`/api/brand/logo/${foreignLogo}`, "")).status, 401);
    // PGlite multiplexes one backend; it cannot verify real concurrent transactions.
    // Verify stale-tab protection sequentially; production lock contention needs PostgreSQL.
    assert.equal((await save(a.cookie, 2, { shopName: "edit A" })).status, 200);
    assert.equal((await save(a.cookie, 2, { shopName: "edit B" })).status, 409);
    const oversized = await request("/api/brand", a.cookie, { method: "PUT", body: "x".repeat(17000) });
    assert.equal(oversized.status, 413);
    const malformed = await request("/api/brand", a.cookie, { method: "PUT", body: "{" });
    assert.equal(malformed.status, 400);
    const noStorage = await request("/api/brand/logo", a.cookie, { method: "POST", body: "test" });
    assert.equal(noStorage.status, 503);
    assert.equal((await (await request("/api/brand", a.cookie)).json()).version, 3);
  } finally { await db.end(); }
});
