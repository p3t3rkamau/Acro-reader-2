-- Idempotent starter categories for the shared AcroReader document catalogue.
-- Aircraft series are stored on Document; these categories are shared across series.
BEGIN;

INSERT INTO "document_categories"
  ("id", "slug", "title", "description", "sortOrder", "parentId", "createdAt", "updatedAt")
VALUES
  ('acro-cat-flight-operations', 'flight-operations', 'Flight Operations',
   'Operational manuals and flight crew references.', 1, NULL, NOW(), NOW()),
  ('acro-cat-maintenance', 'maintenance', 'Maintenance',
   'Maintenance documentation and technical references.', 2, NULL, NOW(), NOW())
ON CONFLICT ("slug") DO UPDATE SET
  "title" = EXCLUDED."title",
  "description" = EXCLUDED."description",
  "sortOrder" = EXCLUDED."sortOrder",
  "parentId" = EXCLUDED."parentId",
  "updatedAt" = NOW();

INSERT INTO "document_categories"
  ("id", "slug", "title", "description", "sortOrder", "parentId", "createdAt", "updatedAt")
SELECT
  seed.id, seed.slug, seed.title, seed.description, seed."sortOrder",
  parent.id, NOW(), NOW()
FROM (
  VALUES
    ('acro-cat-afm', 'afm', 'AFM', 'Aircraft Flight Manual', 1),
    ('acro-cat-qrh', 'qrh', 'QRH', 'Quick Reference Handbook', 2),
    ('acro-cat-aom', 'aom', 'AOM', 'Aircraft Operating Manual', 3),
    ('acro-cat-checklists', 'checklists', 'Checklists', 'Operational checklists and guidance', 4)
) AS seed(id, slug, title, description, "sortOrder")
JOIN "document_categories" parent ON parent.slug = 'flight-operations'
ON CONFLICT ("slug") DO UPDATE SET
  "title" = EXCLUDED."title",
  "description" = EXCLUDED."description",
  "sortOrder" = EXCLUDED."sortOrder",
  "parentId" = EXCLUDED."parentId",
  "updatedAt" = NOW();

COMMIT;
