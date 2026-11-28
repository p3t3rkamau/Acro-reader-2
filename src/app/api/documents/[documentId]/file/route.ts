import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { getViewerSession } from '@/lib/auth/requireViewer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = {
  params: Promise<{ documentId: string }>;
};

async function deliverFile(request: Request, context: RouteContext, method: 'GET' | 'HEAD') {
  const session = await getViewerSession();
  if (!session) {
    return NextResponse.json({ error: 'An authorised viewer session is required.' }, { status: 401 });
  }

  const { documentId } = await context.params;
  const revisionId = new URL(request.url).searchParams.get('revision');

  const document = await prisma.document.findUnique({
    where: { id: documentId },
    select: {
      id: true,
      revisions: {
        where: revisionId
          ? {
              id: revisionId,
              status: session.user.role === 'ADMIN'
                ? { in: ['DRAFT', 'PUBLISHED', 'SUPERSEDED'] }
                : { in: ['PUBLISHED', 'SUPERSEDED'] },
            }
          : { status: 'PUBLISHED' },
        orderBy: [{ effectiveDate: 'desc' }, { createdAt: 'desc' }],
        take: 1,
        select: {
          id: true,
          storagePath: true,
          fileUrl: true,
          storageVisibility: true,
          originalFileName: true,
          mimeType: true,
        },
      },
    },
  });

  const revision = document?.revisions[0];
  if (!document || !revision || !revision.storagePath || !revision.fileUrl) {
    return NextResponse.json({ error: 'The requested document is unavailable.' }, { status: 404 });
  }

  let blobUrl: URL;
  try {
    blobUrl = new URL(revision.fileUrl);
  } catch {
    return NextResponse.json({ error: 'The document storage record is invalid.' }, { status: 500 });
  }

  if (
    blobUrl.protocol !== 'https:' ||
    !blobUrl.hostname.endsWith('.blob.vercel-storage.com')
  ) {
    return NextResponse.json({ error: 'The document storage record is invalid.' }, { status: 500 });
  }

  const headers = new Headers();
  const range = request.headers.get('range');
  const ifRange = request.headers.get('if-range');
  if (range) headers.set('Range', range);
  if (ifRange) headers.set('If-Range', ifRange);

  if (revision.storageVisibility === 'PRIVATE') {
    const token = process.env.ACROR_READ_WRITE_TOKEN;
    if (!token) {
      console.error('[AcroReader] ACROR_READ_WRITE_TOKEN is not configured.');
      return NextResponse.json({ error: 'Private document storage is not configured.' }, { status: 503 });
    }
    headers.set('Authorization', `Bearer ${token}`);
  }

  let upstream: Response;
  try {
    upstream = await fetch(blobUrl, {
      method,
      headers,
      cache: 'no-store',
      redirect: 'error',
    });
  } catch (error) {
    console.error('[AcroReader] Private document delivery failed:', error);
    return NextResponse.json({ error: 'Could not retrieve the document.' }, { status: 502 });
  }

  if (upstream.status !== 200 && upstream.status !== 206 && upstream.status !== 416) {
    console.error('[AcroReader] Blob delivery returned status:', upstream.status);
    return NextResponse.json(
      { error: upstream.status === 404 ? 'The stored PDF could not be found.' : 'Document delivery failed.' },
      { status: upstream.status === 404 ? 404 : 502 },
    );
  }

  const responseHeaders = new Headers();
  for (const name of [
    'accept-ranges',
    'content-range',
    'content-length',
    'content-type',
    'etag',
    'last-modified',
  ]) {
    const value = upstream.headers.get(name);
    if (value) responseHeaders.set(name, value);
  }

  responseHeaders.set('Content-Type', revision.mimeType || 'application/pdf');
  responseHeaders.set('Content-Disposition', 'inline');
  responseHeaders.set('Cache-Control', 'private, no-store, max-age=0');
  responseHeaders.set('X-Content-Type-Options', 'nosniff');
  responseHeaders.set('Referrer-Policy', 'same-origin');

  if (upstream.status === 200 || upstream.status === 206) {
    const acceptRanges = upstream.headers.get('accept-ranges');
    if (acceptRanges) responseHeaders.set('Accept-Ranges', acceptRanges);
  }

  return new Response(method === 'HEAD' ? null : upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });
}

export async function GET(request: Request, context: RouteContext) {
  return deliverFile(request, context, 'GET');
}

export async function HEAD(request: Request, context: RouteContext) {
  return deliverFile(request, context, 'HEAD');
}
