import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { writeFile } from 'node:fs/promises';
import { test } from 'node:test';
import sharp from 'sharp';
import postgres from 'postgres';

// Fixed loopback-only fixtures: never import real environment files.
process.env.DATABASE_URL = 'postgresql://postgres:postgres@127.0.0.1:55439/postgres';
process.env.MEDIA_TEST_STORAGE = '1'; process.env.NODE_ENV = 'test';
const require = createRequire(import.meta.url);
const { runOne, claimJob, sweepExpired } = require('../.test-build/media-worker/media/worker.js');
const { getDb } = require('../.test-build/media-worker/db.js');
const db = postgres(process.env.DATABASE_URL, { max: 1, prepare: false });
const origin = 'http://localhost:3107';
const request = (path, cookie = '', options = {}) => fetch(origin + path, { ...options, headers: { Origin: origin, Cookie: cookie, 'Content-Type': 'application/json', ...options.headers } });
async function account() {
  const response = await request('/api/auth/sign-up', '', { method: 'POST', body: JSON.stringify({ email: `media-${randomUUID()}@example.test`, password: randomUUID() }) });
  assert.equal(response.status, 200); return { cookie: response.headers.get('set-cookie').split(';')[0], user: (await response.json()).user };
}
test('M2 end-to-end: private files, persisted jobs, quota, revisions, expiry and failures', async () => {
  try {
    assert.equal((await request('/api/assets')).status, 401);
    const a = await account(), b = await account();
    const bytes = await sharp({ create: { width: 320, height: 180, channels: 3, background: '#8b5cf6' } }).png().toBuffer();
    await writeFile('.test-build/media-browser-fixture.png', bytes);
    const list = async () => (await request('/api/assets', a.cookie)).json();
    const info = { name: 'โปรโมชั่นทดสอบ.png', size: bytes.length, contentType: 'image/png', requestKey: randomUUID() };
    const create = (body, cookie = a.cookie, headers = {}) => request('/api/assets', cookie, { method: 'POST', headers, body: JSON.stringify(body) });
    assert.equal((await create(info, a.cookie, { Origin: 'https://other.example' })).status, 403);
    assert.equal((await create({ ...info, contentType: 'text/html' })).status, 400);
    const first = await create(info); assert.equal(first.status, 201); const asset = await first.json();
    const duplicated = await Promise.all([create(info), create(info)]);
    for (const duplicate of duplicated) assert.equal((await duplicate.json()).id, asset.id);
    assert.equal((await create({ ...info, name: 'different.png' })).status, 409);
    let state = await list(); assert.equal(state.assets.length, 1); assert.equal(state.usage.reserved, bytes.length); assert.equal(state.usage.used, 0);
    assert.equal((await request(`/api/assets/${asset.id}`, a.cookie)).status, 404);
    assert.equal((await request(`/api/assets/${asset.id}`, b.cookie)).status, 404);
    const sent = await request(`/api/assets/${asset.id}/local-upload`, a.cookie, { method: 'PUT', body: bytes }); assert.equal(sent.status, 202);
    assert.equal((await request(`/api/assets/${asset.id}/local-upload`, a.cookie, { method: 'PUT', body: bytes })).status, 409);
    assert.equal((await request(`/api/assets/${asset.id}/complete`, a.cookie, { method: 'POST' })).status, 202);
    assert.equal((await list()).jobs.length, 1);
    assert.equal(await runOne(), true);
    state = await list(); assert.equal(state.assets[0].state, 'ready'); assert.equal(state.usage.used, bytes.length); assert.equal(state.usage.reserved, 0);
    const downloaded = await request(`/api/assets/${asset.id}`, a.cookie); assert.equal(downloaded.status, 200);
    assert.deepEqual(Buffer.from(await downloaded.arrayBuffer()), bytes); // Original prices/pixels preserved.
    assert.equal((await request(`/api/assets/${asset.id}`, b.cookie)).status, 404);
    assert.equal((await (await request('/api/assets', b.cookie)).json()).assets.length, 0);
    const project = { id: randomUUID(), title: 'ชุดโปรโมชั่น', version: 0, assetIds: [asset.id] };
    const save = (payload, cookie = a.cookie) => request('/api/projects', cookie, { method: 'POST', body: JSON.stringify(payload) });
    assert.equal((await save(project, b.cookie)).status, 400);
    assert.equal((await save(project)).status, 201);
    assert.equal((await save({ ...project, version: 1, title: 'ชื่อชุดใหม่' })).status, 201);
    assert.equal((await save(project)).status, 409);
    const versions = await db`select title,brand_version from media_project_versions where project_id=${project.id} order by version`;
    assert.deepEqual(versions.map(v => v.title), ['ชุดโปรโมชั่น','ชื่อชุดใหม่']);
    assert.equal((await request(`/api/assets/${asset.id}`, a.cookie, { method: 'DELETE' })).status, 409);
    await request(`/api/projects/${project.id}`, b.cookie, { method: 'DELETE' }); assert.equal((await list()).projects.length, 1);
    await request(`/api/projects/${project.id}`, a.cookie, { method: 'DELETE' });
    assert.equal((await request(`/api/assets/${asset.id}`, a.cookie, { method: 'DELETE' })).status, 202);
    assert.equal((await list()).usage.used, bytes.length); // No refund until physical deletion succeeds.
    await db`update media_jobs set available_at=now() where asset_id=${asset.id}`; // advance cleanup clock, loopback test only
    await runOne(); state = await list(); assert.equal(state.usage.used, 0); assert.equal(state.usage.reserved, 0);
    assert.equal((await request(`/api/assets/${asset.id}`, a.cookie)).status, 404);

    const bad = await (await create({ ...info, name: 'broken.png', size: 8, requestKey: randomUUID() })).json();
    await request(`/api/assets/${bad.id}/local-upload`, a.cookie, { method: 'PUT', body: Buffer.from('notimage') });
    await runOne(); state = await list(); assert.equal(state.assets.find(x=>x.id===bad.id).state, 'deleting'); assert.equal(state.usage.reserved, 8);
    await db`update media_jobs set available_at=now() where asset_id=${bad.id}`;
    await runOne(); state = await list(); assert.equal(state.usage.reserved, 0); assert.equal(state.assets.find(x=>x.id===bad.id).state, 'rejected');
    const ledger = await db`select event from usage_ledger l join quota_reservations r on r.id=l.reservation_id where r.asset_id=${bad.id}`;
    assert.deepEqual(ledger.map(x=>x.event).sort(), ['release','reserve']);

    const abandoned = await (await create({ ...info, requestKey: randomUUID() })).json();
    await db`update media_assets set upload_deadline=now()-interval '25 hours' where id=${abandoned.id}`;
    await sweepExpired(); await runOne(); assert.equal((await list()).usage.reserved, 0);

    const recover = await (await create({ ...info, requestKey: randomUUID() })).json();
    await request(`/api/assets/${recover.id}/local-upload`, a.cookie, { method: 'PUT', body: bytes });
    const claims = await Promise.all([claimJob(), claimJob()]);
    assert.equal(claims.filter(Boolean).length, 1);
    const oldClaim = claims.find(Boolean); assert.equal(oldClaim.asset_id, recover.id);
    await db`update media_jobs set lease_until=now()-interval '1 second' where id=${oldClaim.id}`;
    await runOne();
    const [current] = await db`select state,attempts from media_jobs where id=${oldClaim.id}`;
    assert.equal(current.state,'succeeded'); assert.equal(current.attempts,2);
    const [charges] = await db`select count(*)::int as n from usage_ledger l join quota_reservations r on r.id=l.reservation_id where r.asset_id=${recover.id} and l.event='charge'`;
    assert.equal(charges.n,1);
    const [shop] = await db`select id from shops where owner_user_id=${a.user.id}`;
    await db`update usage_buckets set limit_units=used_units+reserved_units+${bytes.length} where shop_id=${shop.id}`;
    const competing = await Promise.all([create({ ...info, requestKey: randomUUID() }), create({ ...info, requestKey: randomUUID() })]);
    assert.deepEqual(competing.map(r => r.status).sort(), [201,409]);
    assert.equal((await list()).usage.reserved,bytes.length);
    assert.equal((await create({ ...info, requestKey: randomUUID() })).status, 409);
    assert.equal((await db`select count(*)::int as n from usage_events where user_id=${a.user.id}`)[0].n,0);
    assert.equal((await db`select count(*)::int as n from subscriptions where user_id=${a.user.id}`)[0].n,0);
  } finally { await db.end(); await getDb().end(); }
});
