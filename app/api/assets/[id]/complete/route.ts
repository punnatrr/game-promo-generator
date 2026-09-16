import { NextRequest } from 'next/server';
import { failure, json, user } from '@/lib/media/http';
import { id } from '@/lib/media/model';
import { enqueueAsset, ownAsset } from '@/lib/media/repository';
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) { try {
  const account = await user(req, true); const asset = await ownAsset(account.id, id((await params).id));
  await enqueueAsset(asset.id, asset.pathname, account.id); return json({ queued: true }, 202);
} catch (error) { return failure(error); } }
