import { after } from 'next/server';

function dispatch(request: Request, kind: 'media' | 'motion') {
  if (process.env.MEDIA_TEST_STORAGE === '1' && process.env.MEDIA_WORKER_AUTO_TEST !== '1') return;
  const secret = process.env.CRON_SECRET;
  if (!secret) { console.error('media_dispatch_secret_missing'); return; }
  const origin = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : request.url;
  const url = new URL(`/api/internal/media/drain?kind=${kind}`, origin);
  after(async () => {
    try {
      const headers: Record<string, string> = { Authorization: `Bearer ${secret}` };
      if (process.env.VERCEL_AUTOMATION_BYPASS_SECRET) headers['x-vercel-protection-bypass'] = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
      const response = await fetch(url, { method: 'POST', headers, cache: 'no-store', redirect: 'manual' });
      if (!response.ok) console.error('media_dispatch_failed', kind, response.status);
    } catch (error) { console.error('media_dispatch_failed', kind, error); }
  });
}

export const scheduleMediaWork = (request: Request) => dispatch(request, 'media');
export const scheduleMotionWork = (request: Request) => dispatch(request, 'motion');
