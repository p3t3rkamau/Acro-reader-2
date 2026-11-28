-- Preserve the old public Blob location when a revision is copied to private storage.
-- This lets the administrator verify the private copy before deleting the old public object.
ALTER TABLE "document_revisions"
ADD COLUMN "legacyPublicStoragePath" TEXT,
ADD COLUMN "legacyPublicUrl" TEXT;
