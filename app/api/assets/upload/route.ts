import { NextRequest } from 'next/server';
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { body, failure, json, user } from '@/lib/media/http';
import { enqueueAsset, uploadPermission } from '@/lib/media/repository';
import { scheduleMediaWork } from '@/lib/media/dispatch';
export async function POST(req: NextRequest) {
  try {
    const input = await body(req) as HandleUploadBody;
    const response = await handleUpload({ request: req, body: input,
      onBeforeGenerateToken: async pathname => {
        const account = await user(req, true);
        const asset = await uploadPermission(account.id, pathname);
        return { allowedContentTypes: [asset.declared_type], maximumSizeInBytes: Number(asset.size_bytes), validUntil: new Date(asset.upload_deadline).getTime(), allowOverwrite: false, addRandomSuffix: false, tokenPayload: JSON.stringify({ id: asset.id, pathname: asset.pathname }) };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        // handleUpload verifies the provider's signature before invoking this callback.
        const data = JSON.parse(tokenPayload || '{}');
        if (data.pathname !== blob.pathname) throw new Error('Path mismatch');
        await enqueueAsset(data.id, data.pathname);
        scheduleMediaWork(req);
      },
    });
    return json(response);
  } catch (error) { return failure(error); }
}
