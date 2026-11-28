import { z } from 'zod';

export const adminUploadMetadataSchema = z.object({
  aircraftSeries: z.enum(['DASH_100', 'DASH_200', 'DASH_300', 'DASH_400']),
  categorySlug: z.enum(['afm', 'qrh', 'aom', 'checklists', 'maintenance']),
  title: z.string().trim().min(2).max(180),
  revision: z.string().trim().min(1).max(40),
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  originalFileName: z.string().trim().min(1).max(255),
});

export type AdminUploadMetadata = z.infer<typeof adminUploadMetadataSchema>;

export const uploadedBlobSchema = z.object({
  pathname: z.string().min(1).max(500).startsWith('acroreader/'),
  url: z.string().url(),
});
