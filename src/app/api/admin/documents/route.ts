import { NextResponse } from 'next/server';
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
        // Keep one live revision per document. The previous live file remains
        // stored as a draft so an administrator can review or republish it.
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
