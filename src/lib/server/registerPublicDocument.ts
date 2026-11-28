import 'server-only';

import { head } from '@vercel/blob';
import { prisma } from '@/lib/db/prisma';
import {
  adminUploadMetadataSchema,
  uploadedBlobSchema,
} from '@/lib/validation/adminUpload';

const uploadSchema = adminUploadMetadataSchema.extend({
  pathname: uploadedBlobSchema.shape.pathname,
  url: uploadedBlobSchema.shape.url,
});

function createDocumentSlug(title: string): string {
  const slug = title
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 100);

  if (!slug) {
    throw new Error('The document title cannot be converted into a valid slug.');
  }

  return slug;
}

export async function registerPublicDocument(input: unknown) {
  const parsed = uploadSchema.safeParse(input);

  if (!parsed.success) {
    console.error('[AcroReader] Invalid document metadata:', parsed.error.flatten());
    throw new Error('The document details are invalid.');
  }

  const data = parsed.data;
  const effectiveDate = new Date(data.effectiveDate + 'T00:00:00.000Z');

  if (
    Number.isNaN(effectiveDate.getTime()) ||
    effectiveDate.toISOString().slice(0, 10) !== data.effectiveDate
  ) {
    throw new Error('Enter a valid effective date.');
  }

  const blobToken = process.env.ACRO_PRIVATE_READ_WRITE_TOKEN;

  if (!blobToken) {
    console.error('[AcroReader] ACRO_PRIVATE_READ_WRITE_TOKEN is not configured.');
    throw new Error('Private Blob storage is not configured.');
  }

  let blob;

  try {
    blob = await head(data.pathname, { token: blobToken });
  } catch (error) {
    console.error('[AcroReader] Blob verification failed:', error);
    throw new Error(
      'The PDF was uploaded, but Blob verification failed. Check the Blob token and storage configuration.',
    );
  }

  const blobHost = new URL(blob.url).hostname;

  if (
    blob.pathname !== data.pathname ||
    blob.url !== data.url ||
    !blobHost.endsWith('.private.blob.vercel-storage.com') ||
    blob.contentType !== 'application/pdf'
  ) {
    throw new Error('The uploaded file could not be verified as a PDF.');
  }

  const [category, variants] = await Promise.all([
    prisma.documentCategory.findFirst({
      where: { id: data.categoryId, isActive: true },
      select: { id: true },
    }),
    prisma.aircraftVariant.findMany({
      where: {
        id: { in: data.variantIds },
        isActive: true,
        model: {
          isActive: true,
          manufacturer: { isActive: true },
        },
      },
      select: { id: true },
    }),
  ]);

  if (!category) {
    throw new Error('The selected document folder is not available.');
  }

  if (variants.length !== new Set(data.variantIds).size) {
    throw new Error('One or more selected aircraft variants are unavailable.');
  }

  const slug = createDocumentSlug(data.title);

  return prisma.$transaction(async (tx) => {
    const existingRevision = await tx.documentRevision.findUnique({
      where: { storagePath: data.pathname },
    });

    if (existingRevision) return existingRevision;

    const variantIds = variants.map((variant) => variant.id);

    // A publication/reference number is the most reliable way to identify
    // an existing publication when adding a new revision.
    let document = data.referenceNumber
      ? await tx.document.findFirst({
          where: {
            referenceNumber: data.referenceNumber,
            categoryId: category.id,
          },
        })
      : await tx.document.findFirst({
          where: {
            title: data.title,
            categoryId: category.id,
            variants: { some: { variantId: { in: variantIds } } },
          },
        });

    if (!document) {
      document = await tx.document.create({
        data: {
          categoryId: category.id,
          slug,
          title: data.title,
          referenceNumber: data.referenceNumber,
        },
      });
    } else {
      document = await tx.document.update({
        where: { id: document.id },
        data: {
          title: data.title,
          referenceNumber: data.referenceNumber ?? document.referenceNumber,
        },
      });
    }

    await tx.documentAircraftVariant.createMany({
      data: variantIds.map((variantId) => ({
        documentId: document!.id,
        variantId,
      })),
      skipDuplicates: true,
    });

    await tx.documentRevision.updateMany({
      where: { documentId: document.id, status: 'PUBLISHED' },
      data: { status: 'SUPERSEDED' },
    });

    return tx.documentRevision.create({
      data: {
        documentId: document.id,
        revision: data.revision,
        effectiveDate,
        status: 'PUBLISHED',
        storagePath: data.pathname,
        fileUrl: data.url,
        storageVisibility: 'PRIVATE',
        originalFileName: data.originalFileName,
        mimeType: 'application/pdf',
        publishedAt: new Date(),
      },
    });
  });
}
