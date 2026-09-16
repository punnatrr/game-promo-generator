import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import sharp from 'sharp';
const { chromium } = createRequire(import.meta.url)('playwright');
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const bytes = await sharp({ create: { width: 320, height: 320, channels: 3, background: '#2288cc' } }).png().toBuffer();
  let requests = 0;
  await page.route('**/api/**', async route => {
    if (!route.request().url().endsWith('/api/generate')) return route.fulfill({ json: { databaseConfigured: false, user: null, subscription: null } });
    const body = route.request().postDataBuffer().toString();
    assert.ok(!body.includes('extract-products'));
    assert.ok(!body.includes('catalogConfirmed'));
    for (const name of ['image1', 'image2', 'image3']) assert.ok(body.includes(`name="${name}"`));
    requests++;
    await route.fulfill({ json: { image: `data:image/png;base64,${bytes.toString('base64')}` } });
  });
  await page.goto(process.env.VERIFY_URL || 'http://localhost:3021');
  for (const name of ['image1', 'image2', 'image3']) await page.locator(`input[name="${name}"]`).setInputFiles({ name: `${name}.png`, mimeType: 'image/png', buffer: bytes });
  await page.locator('input[name="targetShop"]').fill('THUNDER TOPUP');
  await page.getByRole('button', { name: 'สร้างภาพโปรโมท', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('button[type="submit"]')?.getAttribute('aria-busy') !== 'true');
  assert.equal(requests, 1);
  assert.equal(await page.locator('#catalog-heading').count(), 0);
  assert.deepEqual(errors, []);
  console.log('PASS: single click sends three references; no extraction or confirmation step');
} finally {
  await browser.close();
}
