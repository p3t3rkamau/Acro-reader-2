-- Optional publication / reference number shown in the document catalogue.
ALTER TABLE "documents"
ADD COLUMN "referenceNumber" TEXT;

CREATE INDEX "documents_referenceNumber_idx"
ON "documents"("referenceNumber");
