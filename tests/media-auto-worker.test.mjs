import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import postgres from 'postgres';

const origin = 'http://localhost:3107';
const signUp = await fetch(origin + '/api/auth/sign-up', {
  method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: `auto-${randomUUID()}@example.test`, password: randomUUID() }),
});
assert.equal(signUp.status, 200);
const { user } = await signUp.json();
const cookie = signUp.headers.get('set-cookie').split(';')[0];
const headers = { Origin: origin, Cookie: cookie };
const bytes = await sharp({ create: { width: 200, height: 120, channels: 3, background: '#56338a' } }).png().toBuffer();
const create = await fetch(origin + '/api/assets', {
  method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: 'auto.png', size: bytes.length, contentType: 'image/png', requestKey: randomUUID() }),
});
assert.equal(create.status, 201);
const asset = await create.json();
const upload = await fetch(`${origin}/api/assets/${asset.id}/local-upload`, {
  method: 'PUT', headers: { ...headers, 'Content-Type': 'image/png' }, body: bytes,
});
assert.equal(upload.status, 202);
let state;
for (let attempt = 0; attempt < 30; attempt++) {
  const response = await fetch(origin + '/api/assets', { headers });
  assert.equal(response.status, 200);
  const data = await response.json();
  state = data.assets.find(item => item.id === asset.id)?.state;
  if (state === 'ready') break;
  await new Promise(resolve => setTimeout(resolve, 500));
}
assert.equal(state, 'ready');
const db = postgres('postgresql://postgres:postgres@127.0.0.1:55439/postgres', { max: 1 });
try {
  const [shop] = await db`select id from shops where owner_user_id=${user.id}`;
  await db`insert into motion_entitlements values (${shop.id},true,2)`;
  const jobId = randomUUID();
  const draft = await fetch(origin + '/api/motion', {
    method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: jobId, sourceAssetId: asset.id, title: 'Automatic render' }),
  });
  assert.equal(draft.status, 201);
  let job;
  for (let attempt = 0; attempt < 30; attempt++) {
    const response = await fetch(origin + '/api/motion', { headers });
    assert.equal(response.status, 200);
    job = (await response.json()).jobs.find(item => item.id === jobId);
    if (job?.state === 'review') break;
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  assert.equal(job?.state, 'review');
  const render = await fetch(`${origin}/api/motion/${jobId}`, {
    method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ revision: job.revision, confirmed: true, plan: { duration: 6, ratio: '9:16', effect: 'still', boxes: [] } }),
  });
  assert.equal(render.status, 202);
  for (let attempt = 0; attempt < 60; attempt++) {
    const response = await fetch(origin + '/api/motion', { headers });
    assert.equal(response.status, 200);
    job = (await response.json()).jobs.find(item => item.id === jobId);
    if (job?.state === 'succeeded') break;
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  assert.equal(job?.state, 'succeeded');
  console.log('Automatic upload verification and video render completed.');
} finally { await db.end({ timeout: 5 }); }
