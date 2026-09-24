import { isAuthorizedCron } from '@/lib/game-content/cron';
import { runOne, sweepExpired } from '@/lib/media/worker';
import { runMotion, expireMotionReviews } from '@/lib/motion/worker';
import { after } from 'next/server';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  if (!isAuthorizedCron(request)) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const kind = new URL(request.url).searchParams.get('kind');
  if (kind !== 'media' && kind !== 'motion') return Response.json({ error: 'Invalid kind' }, { status: 400 });
  after(async () => {
    try { if (kind === 'media') await runOne(); else await runMotion(); }
    catch (error) { console.error('media_worker_failed', kind, error); }
  });
  return Response.json({ queued: true }, { status: 202 });
}

export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  await sweepExpired();
  await expireMotionReviews();
  const deadline = Date.now() + 240_000;
  let media = 0;
  let motion = 0;
  while (Date.now() < deadline && media + motion < 30) {
    const asset = await runOne();
    const video = await runMotion();
    if (!asset && !video) break;
    media += Number(asset);
    motion += Number(video);
  }
  return Response.json({ media, motion });
}
