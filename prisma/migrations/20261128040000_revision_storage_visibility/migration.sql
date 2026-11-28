-- Track whether each PDF revision is stored in public or private Blob storage.
-- Existing records remain PUBLIC until their files are migrated and verified.
CREATE TYPE "StorageVisibility" AS ENUM ('PUBLIC', 'PRIVATE');

ALTER TABLE "document_revisions"
ADD COLUMN "storageVisibility" "StorageVisibility" NOT NULL DEFAULT 'PUBLIC';
