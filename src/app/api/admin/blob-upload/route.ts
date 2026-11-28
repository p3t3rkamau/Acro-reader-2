import { issueSignedToken, presignUrl } from '@vercel/blob';
import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { auth } from '../../../../../auth';
import { adminUploadMetadataSchema } from '@/lib/validation/adminUpload';

export const runtime = 'nodejs';

const MAX_PDF_SIZE = 5 * 1024 * 1024 * 1024;
const requestSchema = z.object({
  metadata: adminUploadMetadataSchema,
  fileSize: z.number().int().positive().max(MAX_PDF_SIZE),
});

function safeFilename(value: string): string {
  const name = value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(-160);

  if (!name || !name.toLowerCase().endsWith('.pdf')) {
    throw new Error('Choose a valid PDF filename.');
  }

  return name;
}

export async function POST(request: Request) {
  const session = await auth();
  if (session?.user?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Administrator access required.' }, { status: 401 });
  }

  const parsed = requestSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: 'The upload details are invalid.', details: parsed.error.flatten() }, { status: 400 });
  }

  const privateToken = process.env.ACROR_PRIVATE_READ_WRITE_TOKEN;
  if (!privateToken) {
    console.error('[AcroReader] ACROR_PRIVATE_READ_WRITE_TOKEN is not configured.');
    return NextResponse.json({ error: 'Private Blob storage is not configured.' }, { status: 503 });
  }

  try {
    const filename = safeFilename(parsed.data.metadata.originalFileName);
    const pathname = `acroreader/${randomUUID()}-${filename}`;
    const validUntil = Date.now() + 15 * 60 * 1000;

    // The delegation is limited to one private PDF path, one PUT operation,
    // the PDF content type and the configured maximum file size.
    const signedToken = await issueSignedToken({
      pathname,
      operations: ['put'],
      validUntil,
      allowedContentTypes: ['application/pdf'],
      maximumSizeInBytes: MAX_PDF_SIZE,
      token: privateToken,
    });

    const { presignedUrl } = await presignUrl(signedToken, {
      pathname,
      operation: 'put',
      access: 'private',
      validUntil,
      allowedContentTypes: ['application/pdf'],
      maximumSizeInBytes: MAX_PDF_SIZE,
    });

    return NextResponse.json({ pathname, presignedUrl, validUntil });
  } catch (error) {
    console.error('[AcroReader] Could not create a private upload URL:', error);
    return NextResponse.json({ error: 'Could not prepare the private PDF upload.' }, { status: 500 });
  }
}
