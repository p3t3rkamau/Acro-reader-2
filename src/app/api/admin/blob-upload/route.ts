import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { NextResponse } from 'next/server';
import { auth } from '../../../../../auth';
import { adminUploadMetadataSchema } from '@/lib/validation/adminUpload';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  let body: HandleUploadBody;

  try {
    body = (await request.json()) as HandleUploadBody;
  } catch {
    return NextResponse.json({ error: 'Invalid upload request.' }, { status: 400 });
  }

  const requestType = (body as { type?: string }).type;

  // Blob completion webhooks are verified by handleUpload itself.
  // Only client token generation requires an AcroReader admin session.
  if (requestType !== 'blob.upload-completed') {
    const session = await auth();
    if (session?.user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Administrator access required.' }, { status: 401 });
    }
  }

  try {
    const response = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (_pathname, clientPayload) => {
        let metadata: unknown;

        try {
          metadata = JSON.parse(clientPayload ?? '');
        } catch {
          throw new Error('Document details are missing or invalid.');
        }

        const parsed = adminUploadMetadataSchema.safeParse(metadata);
        if (!parsed.success) throw new Error('Document details are invalid.');

        return {
          allowedContentTypes: ['application/pdf'],
          addRandomSuffix: true,
        };
      },
      onUploadCompleted: async () => {
        // The authenticated browser flow registers the verified Blob after upload.
      },
    });

    return NextResponse.json(response);
  } catch (error) {
    console.error('[AcroReader] Blob upload handshake failed:', error);
    return NextResponse.json({ error: 'Could not prepare the PDF upload.' }, { status: 400 });
  }
}
