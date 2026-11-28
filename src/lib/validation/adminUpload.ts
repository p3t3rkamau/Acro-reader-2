import { z } from 'zod';

export const adminUploadMetadataSchema = z.object({
  variantIds: z.array(z.string().trim().min(1)).min(1).max(100),
  categoryId: z.string().trim().min(1),
  title: z.string().trim().min(2).max(180),
  referenceNumber: z.string().trim().max(120).optional().transform((value) => value || undefined),
  revision: z.string().trim().min(1).max(40),
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  originalFileName: z.string().trim().min(1).max(255),
});

export type AdminUploadMetadata = z.infer<typeof adminUploadMetadataSchema>;

export const uploadedBlobSchema = z.object({
  pathname: z.string().min(1).max(500).startsWith('acroreader/'),
  url: z.string().url(),
});
