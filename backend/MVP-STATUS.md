# AcroReader MVP status and execution plan

This document supersedes the earlier MVP access assumptions in `ROADMAP.md` where they conflict with the decisions below.

## Confirmed access policy

- The aircraft/document catalogue is public and does not require sign-in.
- Opening a PDF requires an authorised AcroReader viewer account.
- Viewer accounts are created and suspended by the administrator. Public self-registration is not enabled in the MVP.
- The administrator can manage the catalogue, upload documents and provision viewer accounts.
- Every protected PDF request re-checks the viewer's active account status.
- MVP viewer accounts are not yet scoped to organisations or aircraft entitlements. Organisation licensing remains part of M3.
- The reader's download button and download callback are removed. This is a deterrent, not DRM: an authorised browser must receive PDF bytes to render them, so determined users can still capture those bytes.

## MVP sequence and current implementation status

### 1. Finish current MVP verification
- [ ] Confirm a newly uploaded PDF appears in the public catalogue.
- [ ] Confirm the selected PDF opens in the existing PDF.js reader through the same-origin file route.
- [ ] Confirm the reader's range probe receives HTTP 206 and inspect actual Range/Content-Range responses.
- [ ] Test a large PDF without buffering the entire file in the browser.
- [ ] Test desktop, tablet and phone navigation and InDesign links/actions.
- Note: local runtime verification must be performed against the user's Neon and Vercel environments.

### 2. Remove the download action
- [x] Remove the toolbar download control.
- [x] Remove the browser download callback from the reader component.
- [x] Leave PDFEngine, PDF.js loading, range handling, rendering, annotations and navigation unchanged.
- [ ] Run local typecheck/build and verify desktop/mobile toolbars.

### 3. Redesign the Prisma database
- [x] Add manufacturers, aircraft models and aircraft variants.
- [x] Add many-to-many document-to-variant assignments.
- [x] Add many-to-many organisation-entitlement-to-variant assignments for future M3 licensing.
- [x] Seed De Havilland, Boeing, Airbus and Cessna manufacturers; seed Dash 8, 737 and A320 models; seed Dash 8-100/-200/-300/-400 variants.
- [x] Preserve legacy Dash 8 series and entitlement values through an additive data migration and nullable legacy columns.
- [x] Add document publication/reference number.
- [x] Add category active state for safe deactivation.
- [ ] Run Prisma validation and generate the client locally.
- [ ] Review and apply the additive migrations to the dedicated Neon database.
- [ ] Verify every existing document and entitlement has a matching variant join row before considering legacy columns for removal.

### 4. Build administration management pages
- [x] Create manufacturer, model and variant management UI.
- [x] Create dynamic nested department/folder management UI.
- [x] Support rename, sort order and soft deactivation/reactivation.
- [x] Preserve historical records by deactivating rather than deleting referenced catalogue items.
- [ ] Test CRUD, duplicate names, nested folders, inactive parents and mobile admin layout.

### 5. Redesign the upload form
- [x] Load manufacturers, models, variants and categories from Neon.
- [x] Select one or more aircraft variants.
- [x] Select a department and nested folder.
- [x] Capture document title, publication/reference number, revision and effective date.
- [x] Preserve automatic upload timestamps.
- [ ] Test a first publication and a later revision of the same publication.
- [ ] Confirm multiple-variant documents appear under every selected variant.

### 6. Implement protected PDF delivery
- [x] Add viewer login using database-backed accounts.
- [x] Add admin UI to create and suspend authorised viewers; no public registration.
- [x] Re-check viewer account status on every PDF request.
- [x] Add a same-origin GET/HEAD route that forwards Range and If-Range headers and streams the upstream body.
- [x] Hide direct Blob URLs from the public catalogue.
- [x] Make new uploads target a private Blob store.
- [x] Add an admin migration flow that streams existing public PDFs to private storage and verifies size, content type and private URL before changing Neon.
- [x] Preserve the old public pathname/URL until the private copy has been verified.
- [ ] Create a separate private Vercel Blob store and configure `ACRO_PRIVATE_READ_WRITE_TOKEN` locally and in Vercel.
- [ ] Verify new uploads are private and direct unauthenticated Blob reads fail.
- [ ] Migrate all existing public revisions.
- [ ] Review each verified private copy, then explicitly delete its legacy public object.
- [ ] Verify copied old public URLs no longer work.
- [ ] Test unauthorised, suspended and authorised viewer requests, including Range and HEAD requests.

### 7. Final MVP testing
- [ ] Test upload, registration, revision history and publication state.
- [ ] Test public catalogue browsing without a session.
- [ ] Test protected PDF viewing with an active viewer account.
- [ ] Test denied access after viewer suspension, including an already-open browser session.
- [ ] Test range loading, 206 responses, 416 handling and large files.
- [ ] Test desktop, tablet and mobile.
- [ ] Confirm the reader's InDesign links/actions, bookmarks, zoom and navigation remain intact.
- [ ] Complete security review and production checklist before deployment approval.

## Migrations added on this branch

1. `20261128020000_dynamic_aircraft_catalogue` — new aircraft hierarchy, variant joins and Dash 8 data mapping. Legacy enum columns remain nullable as a rollback bridge.
2. `20261128030000_document_reference_number` — optional publication/reference number.
3. `20261128040000_revision_storage_visibility` — public/private storage marker; existing rows remain PUBLIC until copied.
4. `20261128050000_track_legacy_public_blob_locations` — records the old public object path/URL until the administrator deletes it.

All migrations are designed to preserve existing records. Do not run `migrate reset`. Do not remove the legacy series fields or delete public Blob objects until the new records and private copies have been verified.

## Required Blob environment variables

```env
# Existing public store: read and delete old objects during migration only.
ACROR_READ_WRITE_TOKEN=...

# New private store: upload, verify and stream protected PDFs.
ACROR_PRIVATE_READ_WRITE_TOKEN=...
```

Never commit either value or expose either one through a `NEXT_PUBLIC_*` variable.

## Protected reader boundary

The following remain off-limits: `src/types/pdf.ts`, `src/components/pdf-viewer/PDFApp.tsx`, `src/components/pdf-viewer/PDFViewer.tsx` and the PDF.js engine/loading/annotation modules. The only approved reader UI change in this MVP is removal of the download control/action.
