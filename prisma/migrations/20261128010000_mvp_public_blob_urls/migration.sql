-- Add the public Blob URL used by the deadline MVP.
-- This is additive; existing revision records remain unchanged.
ALTER TABLE "document_revisions"
ADD COLUMN "fileUrl" TEXT;
