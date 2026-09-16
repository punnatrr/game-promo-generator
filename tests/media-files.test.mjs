import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile } from 'node:fs/promises';
import sharp from 'sharp';
const require = createRequire(import.meta.url);
const { inspectMedia, InvalidMedia } = require('../.test-build/media-worker/media/inspect.js');
const { parseUpload, parseProject } = require('../.test-build/media-worker/media/model.js');
const { randomUUID } = require('node:crypto');
const exec = promisify(execFile);
process.env.FFPROBE_PATH = require('../.test-build/brand-tools/node_modules/ffprobe-static').path;
const ffmpeg = require('../.test-build/brand-tools/node_modules/ffmpeg-static');

test('M2 preserves image bytes and detects decoded dimensions, corruption and animation', async () => {
  const bytes = await sharp({ create: { width: 640, height: 320, channels: 4, background: '#8b5cf6' } }).png().toBuffer();
  const copy = Buffer.from(bytes); const metadata = await inspectMedia(bytes, 'image');
  assert.deepEqual(metadata, { width: 640, height: 320, contentType: 'image/png' });
  assert.deepEqual(bytes, copy);
  await assert.rejects(inspectMedia(bytes.subarray(0, 60), 'image'), InvalidMedia);
  await assert.rejects(inspectMedia(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>'), 'image'), InvalidMedia);
});
test('M2 reads real MP4 metadata and rejects clips over two minutes and playlists', async () => {
  const clip = '.test-build/media-fixture.mp4';
  await exec(ffmpeg, ['-y','-f','lavfi','-i','color=c=purple:s=320x180:r=5','-t','2','-c:v','libx264','-pix_fmt','yuv420p',clip], { windowsHide: true, timeout: 30_000 });
  const metadata = await inspectMedia(await readFile(clip), 'video');
  assert.equal(metadata.width,320); assert.equal(metadata.height,180); assert.equal(metadata.duration,2);
  const long = '.test-build/media-too-long.mp4';
  await exec(ffmpeg, ['-y','-f','lavfi','-i','color=c=black:s=32x32:r=1','-t','121','-c:v','libx264','-pix_fmt','yuv420p',long], { windowsHide: true, timeout: 30_000 });
  await assert.rejects(inspectMedia(await readFile(long), 'video'), InvalidMedia);
  await assert.rejects(inspectMedia(Buffer.from('#EXTM3U\nhttp://127.0.0.1/private'), 'video'), InvalidMedia);
  await assert.rejects(inspectMedia(Buffer.from('not video'), 'video'), InvalidMedia);
});
test('M2 validates allowed types, bounds, UUIDs and project selections', () => {
  const valid = { name: 'poster.png', size: 50, contentType: 'image/png', requestKey: randomUUID() };
  assert.equal(parseUpload(valid).kind,'image');
  for (const extra of [{ size: -1 }, { size: 1.5 }, { contentType: 'text/html' }, { requestKey: '../../x' }, { name: '\n' }]) assert.throws(() => parseUpload({ ...valid, ...extra }));
  assert.throws(() => parseProject({ id: randomUUID(), title: 'x', version: 0, assetIds: [] }));
  assert.throws(() => parseProject({ id: randomUUID(), title: 'x', version: 0, assetIds: Array.from({ length: 11 }, randomUUID) }));
});
