import { NextResponse } from 'next/server';
import { del, head, put } from '@vercel/blob';
import { z } from 'zod';
import { auth } from '../../../../../../auth';
import { prisma } from '@/lib/db/prisma';

export const runtime = 'nodejs';
export const maxDuration = 300;

const migrateSchema = z.object({
  revisionId: z.string().min(1),
});

async function isAdmin() {
  const session = await auth();
  return session?.user?.role === 'ADMIN';
}

export async function GET() {
  if (!await isAdmin()) {
    return NextResponse.json({ error: 'Administrator access required.' }, { status: 401 });
  }

  const [revisions, legacyCopies] = await Promise.all([
    prisma.documentRevision.findMany({
      where: {
        storageVisibility: 'PUBLIC',
        storagePath: { not: null },
        fileUrl: { not: null },
      },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        revision: true,
        originalFileName: true,
        document: { select: { title: true } },
      },
    }),
    prisma.documentRevision.findMany({
      where: {
        storageVisibility: 'PRIVATE',
        legacyPublicStoragePath: { not: null },
      },
      orderBy: { updatedAt: 'asc' },
      select: {
        id: true,
        revision: true,
        originalFileName: true,
        legacyPublicStoragePath: true,
        document: { select: { title: true } },
      },
    }),
  ]);

  return NextResponse.json({
    count: revisions.length,
    revisions: revisions.map((revision) => ({
      id: revision.id,
      title: revision.document.title,
      revision: revision.revision,
      originalFileName: revision.originalFileName,
    })),
    legacyCopies: legacyCopies.map((revision) => ({
      id: revision.id,
      title: revision.document.title,
      revision: revision.revision,
      originalFileName: revision.originalFileName,
      legacyPublicStoragePath: revision.legacyPublicStoragePath,
    })),
  });
}

export async function POST(request: Request) {
  if (!await isAdmin()) {
    return NextResponse.json({ error: 'Administrator access required.' }, { status: 401 });
  }

  const parsed = migrateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: 'Select a valid document revision.' }, { status: 400 });
  }

  const publicToken = process.env.ACRO_READ_WRITE_TOKEN;
  const privateToken = process.env.ACROR_PRIVATE_READ_WRITE_TOKEN;

  if (!publicToken || !privateToken) {
    return NextResponse.json(
      { error: 'Both the existing public Blob token and the new private Blob token must be configured.' },
      { status: 503 },
    );
  }

  const revision = await prisma.documentRevision.findUnique({
    where: { id: parsed.data.revisionId },
    select: {
      id: true,
      revision: true,
      storagePath: true,
      fileUrl: true,
      storageVisibility: true,
      mimeType: true,
      originalFileName: true,
    },
  });

  if (!revision || !revision.storagePath || !revision.fileUrl) {
    return NextResponse.json({ error: 'The source PDF could not be found.' }, { status: 404 });
  }

  if (revision.storageVisibility === 'PRIVATE') {
    return NextResponse.json({ success: true, alreadyPrivate: true });
  }

  let sourceUrl: URL;
  try {
    sourceUrl = new URL(revision.fileUrl);
  } catch {
    return NextResponse.json({ error: 'The existing Blob URL is invalid.' }, { status: 400 });
  }

  if (
    sourceUrl.protocol !== 'https:' ||
    !sourceUrl.hostname.endsWith('.blob.vercel-storage.com') ||
    sourceUrl.hostname.endsWith('.private.blob.vercel-storage.com')
  ) {
    return NextResponse.json({ error: 'The source is not a public Vercel Blob URL.' }, { status: 400 });
  }

  try {
    const sourceMetadata = await head(revision.storagePath, { token: publicToken });
    if (sourceMetadata.contentType !== 'application/pdf') {
      return NextResponse.json({ error: 'The source object is not a PDF.' }, { status: 400 });
    }

    const sourceResponse = await fetch(sourceUrl, { cache: 'no-store' });
    if (!sourceResponse.ok || !sourceResponse.body) {
      return NextResponse.json({ error: 'Could not stream the existing public PDF.' }, { status: 502 });
    }

    const destinationPath = `acroreader-private/${revision.storagePath.replace(/^acroreader\//, '')}`;
    const privateBlob = await put(destinationPath, sourceResponse.body, {
      access: 'private',
      token: privateToken,
      contentType: 'application/pdf',
      addRandomSuffix: true,
    });

    const privateMetadata = await head(privateBlob.pathname, { token: privateToken });
    const privateHost = new URL(privateBlob.url).hostname;

    if (
      privateMetadata.pathname !== privateBlob.pathname ||
      privateMetadata.contentType !== 'application/pdf' ||
      !privateHost.endsWith('.private.blob.vercel-storage.com') ||
      privateMetadata.size !== sourceMetadata.size
    ) {
      throw new Error('The private copy failed verification. The original public object was left untouched.');
    }

    await prisma.documentRevision.update({
      where: { id: revision.id },
      data: {
        storagePath: privateBlob.pathname,
        fileUrl: privateBlob.url,
        storageVisibility: 'PRIVATE',
        legacyPublicStoragePath: revision.storagePath,
        legacyPublicUrl: revision.fileUrl,
      },
    });

    // Intentionally do not delete the public source here. The administrator
    // must verify the private copy and approve public-object deletion separately.
    return NextResponse.json({
      success: true,
      revisionId: revision.id,
      privatePath: privateBlob.pathname,
      verifiedSize: privateMetadata.size,
      legacyPublicPath: revision.storagePath,
      legacyPublicUrl: revision.fileUrl,
      legacyPublicDeleted: false,
    });
  } catch (error) {
    console.error('[AcroReader] Public-to-private Blob migration failed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Could not migrate this PDF.' },
      { status: 500 },
    );
  }
}


export async function DELETE(request: Request) {
  if (!await isAdmin()) {
    return NextResponse.json({ error: 'Administrator access required.' }, { status: 401 });
  }

  const parsed = migrateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: 'Select a valid document revision.' }, { status: 400 });
  }

  const publicToken = process.env.ACRO_READ_WRITE_TOKEN;
  const privateToken = process.env.ACROR_PRIVATE_READ_WRITE_TOKEN;
  if (!publicToken || !privateToken) {
    return NextResponse.json({ error: 'Both public and private Blob tokens must be configured.' }, { status: 503 });
  }

  const revision = await prisma.documentRevision.findUnique({
    where: { id: parsed.data.revisionId },
    select: {
      id: true,
      storagePath: true,
      storageVisibility: true,
      legacyPublicStoragePath: true,
    },
  });

  if (
    !revision ||
    revision.storageVisibility !== 'PRIVATE' ||
    !revision.storagePath ||
    !revision.legacyPublicStoragePath
  ) {
    return NextResponse.json({ error: 'No verified legacy public copy is pending deletion.' }, { status: 409 });
  }

  try {
    const privateCopy = await head(revision.storagePath, { token: privateToken });
    if (
      privateCopy.contentType !== 'application/pdf' ||
      !new URL(privateCopy.url).hostname.endsWith('.private.blob.vercel-storage.com')
    ) {
      return NextResponse.json({ error: 'The private copy could not be verified. The public original was not deleted.' }, { status: 409 });
    }

    await del(revision.legacyPublicStoragePath, { token: publicToken });
    await prisma.documentRevision.update({
      where: { id: revision.id },
      data: {
        legacyPublicStoragePath: null,
        legacyPublicUrl: null,
      },
    });

    return NextResponse.json({ success: true, legacyPublicDeleted: true });
  } catch (error) {
    console.error('[AcroReader] Legacy public Blob deletion failed:', error);
    return NextResponse.json({ error: 'Could not delete the legacy public copy.' }, { status: 500 });
  }
}
