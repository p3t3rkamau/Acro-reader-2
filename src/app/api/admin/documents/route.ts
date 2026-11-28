import { NextResponse } from 'next/server';
import { del, head } from '@vercel/blob';
import { z } from 'zod';
import { auth } from '../../../../../auth';
import { prisma } from '@/lib/db/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function isAdmin() {
  const session = await auth();
  return session?.user?.role === 'ADMIN';
}

export async function GET() {
  if (!await isAdmin()) return NextResponse.json({ error: 'Administrator access required.' }, { status: 401 });

  try {
    const documents = await prisma.document.findMany({
      orderBy: [{ updatedAt: 'desc' }],
      include: {
        category: { select: { id: true, title: true } },
        variants: {
          include: {
            variant: {
              select: {
                id: true,
                name: true,
                model: { select: { name: true, manufacturer: { select: { name: true } } } },
              },
            },
          },
        },
        revisions: {
          orderBy: [{ createdAt: 'desc' }],
          select: {
            id: true,
            revision: true,
            effectiveDate: true,
            status: true,
            originalFileName: true,
            sizeBytes: true,
            createdAt: true,
            publishedAt: true,
            changeSummary: true,
            storageVisibility: true,
          },
        },
      },
    });

    return NextResponse.json({
      documents: documents.map((document) => ({
        ...document,
        revisions: document.revisions.map((revision) => ({
          ...revision,
          sizeBytes: revision.sizeBytes?.toString() ?? null,
        })),
      })),
    });
  } catch (error) {
    console.error('[AcroReader] Admin document listing failed:', error);
    return NextResponse.json({ error: 'Could not load document management.' }, { status: 500 });
  }
}

const updateSchema = z.object({
  action: z.literal('update-document'),
  documentId: z.string().min(1),
  title: z.string().trim().min(2).max(180),
  referenceNumber: z.string().trim().max(120).optional().nullable(),
  description: z.string().trim().max(4000).optional().nullable(),
  categoryId: z.string().min(1),
  variantIds: z.array(z.string().min(1)).min(1).max(100),
});

const publishSchema = z.object({
  action: z.literal('publish-revision'),
  revisionId: z.string().min(1),
});

const documentActionSchema = z.object({
  action: z.enum(['unpublish-document', 'archive-document', 'restore-document']),
  documentId: z.string().min(1),
});

const deleteSchema = z.object({
  documentId: z.string().min(1),
  confirmTitle: z.string().min(1).max(180),
});

export async function PATCH(request: Request) {
  if (!await isAdmin()) return NextResponse.json({ error: 'Administrator access required.' }, { status: 401 });

  const input: unknown = await request.json();
  const publish = publishSchema.safeParse(input);

  if (publish.success) {
    try {
      const target = await prisma.documentRevision.findUnique({
        where: { id: publish.data.revisionId },
        select: { id: true, documentId: true, status: true },
      });
      if (!target) return NextResponse.json({ error: 'The revision could not be found.' }, { status: 404 });
      if (target.status !== 'DRAFT') {
        return NextResponse.json({ error: 'Only a draft revision can be published.' }, { status: 409 });
      }

      await prisma.$transaction(async (tx) => {
        await tx.documentRevision.updateMany({
          where: { documentId: target.documentId, status: 'PUBLISHED' },
          data: { status: 'DRAFT' },
        });
        await tx.documentRevision.update({
          where: { id: target.id },
          data: { status: 'PUBLISHED', publishedAt: new Date() },
        });
      });

      return NextResponse.json({ success: true });
    } catch (error) {
      console.error('[AcroReader] Publishing draft revision failed:', error);
      return NextResponse.json({ error: 'Could not publish this revision.' }, { status: 500 });
    }
  }

  const documentAction = documentActionSchema.safeParse(input);
  if (documentAction.success) {
    try {
      const { action, documentId } = documentAction.data;
      const document = await prisma.document.findUnique({
        where: { id: documentId },
        select: { id: true, archivedAt: true },
      });
      if (!document) return NextResponse.json({ error: 'The document could not be found.' }, { status: 404 });

      if (action === 'unpublish-document') {
        const result = await prisma.documentRevision.updateMany({
          where: { documentId, status: { in: ['PUBLISHED', 'SUPERSEDED'] } },
          data: { status: 'DRAFT' },
        });
        if (result.count === 0) {
          return NextResponse.json({ error: 'This document has no published or historical revision to move to draft.' }, { status: 409 });
        }
        return NextResponse.json({ success: true, changed: result.count });
      }

      if (action === 'archive-document') {
        if (document.archivedAt) return NextResponse.json({ success: true, alreadyArchived: true });
        await prisma.document.update({ where: { id: documentId }, data: { archivedAt: new Date() } });
        return NextResponse.json({ success: true });
      }

      if (!document.archivedAt) return NextResponse.json({ success: true, alreadyActive: true });
      await prisma.document.update({ where: { id: documentId }, data: { archivedAt: null } });
      return NextResponse.json({ success: true });
    } catch (error) {
      console.error('[AcroReader] Document state change failed:', error);
      return NextResponse.json({ error: 'Could not change this document.' }, { status: 500 });
    }
  }

  const update = updateSchema.safeParse(input);
  if (!update.success) {
    return NextResponse.json({ error: 'The document update details are invalid.' }, { status: 400 });
  }

  try {
    const data = update.data;
    const [category, variants] = await Promise.all([
      prisma.documentCategory.findFirst({ where: { id: data.categoryId, isActive: true }, select: { id: true } }),
      prisma.aircraftVariant.findMany({
        where: {
          id: { in: data.variantIds },
          isActive: true,
          model: { isActive: true, manufacturer: { isActive: true } },
        },
        select: { id: true },
      }),
    ]);

    if (!category) return NextResponse.json({ error: 'Select an active document folder.' }, { status: 400 });
    if (variants.length !== new Set(data.variantIds).size) {
      return NextResponse.json({ error: 'One or more selected aircraft variants are unavailable.' }, { status: 400 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.document.update({
        where: { id: data.documentId },
        data: {
          title: data.title,
          referenceNumber: data.referenceNumber || null,
          description: data.description || null,
          categoryId: data.categoryId,
        },
      });
      await tx.documentAircraftVariant.deleteMany({ where: { documentId: data.documentId } });
      await tx.documentAircraftVariant.createMany({
        data: [...new Set(data.variantIds)].map((variantId) => ({
          documentId: data.documentId,
          variantId,
        })),
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[AcroReader] Document metadata update failed:', error);
    const code = (error as { code?: string })?.code;
    return NextResponse.json(
      { error: code === 'P2025' ? 'The document no longer exists.' : 'Could not update document details.' },
      { status: code === 'P2025' ? 404 : 500 },
    );
  }
}

export async function DELETE(request: Request) {
  if (!await isAdmin()) return NextResponse.json({ error: 'Administrator access required.' }, { status: 401 });

  const parsed = deleteSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: 'Confirm the document title to continue.' }, { status: 400 });

  const { documentId, confirmTitle } = parsed.data;
  const token = process.env.ACROR_READ_WRITE_TOKEN;
  if (!token) return NextResponse.json({ error: 'Private Blob storage is not configured.' }, { status: 503 });

  try {
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      select: {
        id: true,
        title: true,
        revisions: { select: { id: true, storagePath: true, storageVisibility: true } },
      },
    });

    if (!document) return NextResponse.json({ error: 'The document could not be found.' }, { status: 404 });
    if (confirmTitle !== document.title) {
      return NextResponse.json({ error: 'The confirmation title does not match this document.' }, { status: 400 });
    }

    // Never silently delete a record that still points to a public or unknown
    // storage location. All revisions must be confirmed private first.
    const nonPrivate = document.revisions.filter((revision) => revision.storageVisibility !== 'PRIVATE');
    if (nonPrivate.length) {
      return NextResponse.json({
        error: 'This document still has revision(s) marked as public storage. Migrate and verify them before permanent deletion.',
      }, { status: 409 });
    }

    const paths = [...new Set(document.revisions.map((revision) => revision.storagePath).filter((path): path is string => Boolean(path)))];

    // Verify every private object before deleting any of them.
    for (const pathname of paths) {
      const blob = await head(pathname, { token });
      const hostname = new URL(blob.url).hostname;
      if (
        blob.pathname !== pathname ||
        !hostname.endsWith('.private.blob.vercel-storage.com') ||
        blob.contentType !== 'application/pdf'
      ) {
        return NextResponse.json({ error: 'A private PDF could not be verified. Nothing was deleted.' }, { status: 409 });
      }
    }

    if (paths.length) await del(paths, { token });

    // DocumentRevision and join records are configured to cascade with Document.
    await prisma.document.delete({ where: { id: documentId } });

    return NextResponse.json({ success: true, deletedFiles: paths.length });
  } catch (error) {
    console.error('[AcroReader] Permanent document deletion failed:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Could not permanently delete this document.',
    }, { status: 500 });
  }
}
