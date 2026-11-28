-- Dynamic aircraft catalogue.
-- This migration is deliberately additive: legacy AircraftSeries columns and enum remain
-- nullable as a rollback bridge until the new catalogue and upload flow are verified.

CREATE TABLE "aircraft_manufacturers" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "aircraft_manufacturers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "aircraft_models" (
    "id" TEXT NOT NULL,
    "manufacturerId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "aircraft_models_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "aircraft_variants" (
    "id" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "legacySeriesCode" TEXT,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "aircraft_variants_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "document_aircraft_variants" (
    "documentId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "document_aircraft_variants_pkey" PRIMARY KEY ("documentId", "variantId")
);

CREATE TABLE "organization_entitlement_variants" (
    "entitlementId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "organization_entitlement_variants_pkey" PRIMARY KEY ("entitlementId", "variantId")
);

ALTER TABLE "document_categories"
ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "documents"
ALTER COLUMN "aircraftSeries" DROP NOT NULL;

ALTER TABLE "organization_entitlements"
ALTER COLUMN "aircraftSeries" DROP NOT NULL;

CREATE UNIQUE INDEX "aircraft_manufacturers_slug_key" ON "aircraft_manufacturers"("slug");
CREATE INDEX "aircraft_manufacturers_isActive_sortOrder_idx" ON "aircraft_manufacturers"("isActive", "sortOrder");

CREATE UNIQUE INDEX "aircraft_models_manufacturerId_slug_key" ON "aircraft_models"("manufacturerId", "slug");
CREATE INDEX "aircraft_models_manufacturerId_isActive_sortOrder_idx" ON "aircraft_models"("manufacturerId", "isActive", "sortOrder");

CREATE UNIQUE INDEX "aircraft_variants_legacySeriesCode_key" ON "aircraft_variants"("legacySeriesCode");
CREATE UNIQUE INDEX "aircraft_variants_modelId_slug_key" ON "aircraft_variants"("modelId", "slug");
CREATE INDEX "aircraft_variants_modelId_isActive_sortOrder_idx" ON "aircraft_variants"("modelId", "isActive", "sortOrder");

CREATE INDEX "document_aircraft_variants_variantId_idx" ON "document_aircraft_variants"("variantId");
CREATE INDEX "organization_entitlement_variants_variantId_idx" ON "organization_entitlement_variants"("variantId");
CREATE INDEX "document_categories_isActive_sortOrder_idx" ON "document_categories"("isActive", "sortOrder");
CREATE INDEX "documents_categoryId_slug_idx" ON "documents"("categoryId", "slug");

ALTER TABLE "aircraft_models"
ADD CONSTRAINT "aircraft_models_manufacturerId_fkey"
FOREIGN KEY ("manufacturerId") REFERENCES "aircraft_manufacturers"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "aircraft_variants"
ADD CONSTRAINT "aircraft_variants_modelId_fkey"
FOREIGN KEY ("modelId") REFERENCES "aircraft_models"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "document_aircraft_variants"
ADD CONSTRAINT "document_aircraft_variants_documentId_fkey"
FOREIGN KEY ("documentId") REFERENCES "documents"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "document_aircraft_variants"
ADD CONSTRAINT "document_aircraft_variants_variantId_fkey"
FOREIGN KEY ("variantId") REFERENCES "aircraft_variants"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "organization_entitlement_variants"
ADD CONSTRAINT "organization_entitlement_variants_entitlementId_fkey"
FOREIGN KEY ("entitlementId") REFERENCES "organization_entitlements"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "organization_entitlement_variants"
ADD CONSTRAINT "organization_entitlement_variants_variantId_fkey"
FOREIGN KEY ("variantId") REFERENCES "aircraft_variants"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- Seed the manufacturers and models discussed for the initial aviation catalogue.
INSERT INTO "aircraft_manufacturers" ("id", "slug", "name", "sortOrder", "createdAt", "updatedAt")
VALUES
  ('acro-mfr-de-havilland', 'de-havilland', 'De Havilland', 1, NOW(), NOW()),
  ('acro-mfr-boeing', 'boeing', 'Boeing', 2, NOW(), NOW()),
  ('acro-mfr-airbus', 'airbus', 'Airbus', 3, NOW(), NOW()),
  ('acro-mfr-cessna', 'cessna', 'Cessna', 4, NOW(), NOW())
ON CONFLICT ("slug") DO NOTHING;

INSERT INTO "aircraft_models" ("id", "manufacturerId", "slug", "name", "sortOrder", "createdAt", "updatedAt")
VALUES
  ('acro-model-dash-8', 'acro-mfr-de-havilland', 'dash-8', 'Dash 8', 1, NOW(), NOW()),
  ('acro-model-737', 'acro-mfr-boeing', '737', '737', 1, NOW(), NOW()),
  ('acro-model-a320', 'acro-mfr-airbus', 'a320', 'A320', 1, NOW(), NOW())
ON CONFLICT ("manufacturerId", "slug") DO NOTHING;

INSERT INTO "aircraft_variants"
  ("id", "modelId", "slug", "name", "legacySeriesCode", "sortOrder", "createdAt", "updatedAt")
VALUES
  ('acro-variant-dash-100', 'acro-model-dash-8', 'dash-8-100', 'Dash 8-100', 'DASH_100', 1, NOW(), NOW()),
  ('acro-variant-dash-200', 'acro-model-dash-8', 'dash-8-200', 'Dash 8-200', 'DASH_200', 2, NOW(), NOW()),
  ('acro-variant-dash-300', 'acro-model-dash-8', 'dash-8-300', 'Dash 8-300', 'DASH_300', 3, NOW(), NOW()),
  ('acro-variant-dash-400', 'acro-model-dash-8', 'dash-8-400', 'Dash 8-400', 'DASH_400', 4, NOW(), NOW())
ON CONFLICT ("modelId", "slug") DO NOTHING;

-- Preserve every existing document-to-series assignment in the new many-to-many table.
INSERT INTO "document_aircraft_variants" ("documentId", "variantId")
SELECT d."id", v."id"
FROM "documents" d
JOIN "aircraft_variants" v
  ON v."legacySeriesCode" = d."aircraftSeries"::text
ON CONFLICT ("documentId", "variantId") DO NOTHING;

-- Preserve existing organisation entitlements against the corresponding Dash 8 variants.
INSERT INTO "organization_entitlement_variants" ("entitlementId", "variantId")
SELECT e."id", v."id"
FROM "organization_entitlements" e
JOIN "aircraft_variants" v
  ON v."legacySeriesCode" = e."aircraftSeries"::text
ON CONFLICT ("entitlementId", "variantId") DO NOTHING;
