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

  if (!slug) throw new Error('The document title cannot be converted into a valid slug.');
  return slug;
}

export async function registerPublicDocument(input: unknown) {
  const parsed = uploadSchema.safeParse(input);
  if (!parsed.success) throw new Error('The document details are invalid.');

  const data = parsed.data;
  const effectiveDate = new Date(data.effectiveDate + 'T00:00:00.000Z');

  if (Number.isNaN(effectiveDate.getTime()) || effectiveDate.toISOString().slice(0, 10) !== data.effectiveDate) {
    throw new Error('Enter a valid effective date.');
  }

  const blob = await head(data.pathname);

  if (
    blob.pathname !== data.pathname ||
    blob.url !== data.url ||
    blob.contentType !== 'application/pdf'
  ) {
    throw new Error('The uploaded file could not be verified as a PDF.');
  }

  const category = await prisma.documentCategory.findUnique({
    where: { slug: data.categorySlug },
    select: { id: true },
  });

  if (!category) {
    throw new Error('The selected document category is not available. Run the category seed first.');
  }

  const slug = createDocumentSlug(data.title);

  return prisma.$transaction(async (tx) => {
    const existingRevision = await tx.documentRevision.findUnique({
      where: { storagePath: data.pathname },
    });
    if (existingRevision) return existingRevision;

    const document = await tx.document.upsert({
      where: {
        aircraftSeries_slug: {
          aircraftSeries: data.aircraftSeries,
          slug,
        },
      },
      create: {
        aircraftSeries: data.aircraftSeries,
        categoryId: category.id,
        slug,
        title: data.title,
      },
      update: {
        categoryId: category.id,
        title: data.title,
      },
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
        originalFileName: data.originalFileName,
        mimeType: 'application/pdf',
        publishedAt: new Date(),
      },
    });
  });
}
