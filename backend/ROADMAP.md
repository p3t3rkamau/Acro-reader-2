# AcroReader backend rebuild roadmap

## Non-negotiable boundary

The existing PDF reader is protected. Do not rewrite or replace PDF.js, its loading/range behaviour, page rendering, text/annotation layers, InDesign links/actions, zoom, gestures, navigation, or its viewer UI as part of the backend migration.

Backend changes must adapt to the reader's existing document-opening contract. If the current viewer expects a URL or a particular document descriptor, build an adapter/API response that preserves that contract rather than changing the PDF engine.

All work happens in this repository. No second repository will be created.

## Target architecture

- Next.js App Router and Route Handlers for the backend API.
- Prisma ORM with Neon PostgreSQL, following the proven connection pattern from p3t3rkamau/vcard-platform.
- Auth.js for authentication and sessions.
- Zod for request validation.
- Vercel Blob for PDF storage. Protected manuals must use a private Blob store and authenticated server-side delivery.
- Existing React/SCSS frontend and PDF.js viewer remain in place.

Suggested locations:
- `prisma/schema.prisma`, `prisma/migrations/`: database schema and versioned migrations.
- `src/app/api/**/route.ts`: API endpoints.
- `src/lib/db/prisma.ts`: singleton Prisma client.
- `src/lib/auth/**`: authentication and session helpers.
- `src/lib/permissions/**`: organisation and document access rules.
- `src/lib/storage/**`: private Blob operations.
- `src/lib/services/**`: business logic.
- `backend/README.md`, `backend/ARCHITECTURE.md`, `backend/API.md`: backend documentation.

## Milestones

### M0 — Protect and inventory (completed)
- Work on a dedicated feature branch.
- Inventory Payload references, dependencies, routes and environment variables.
- Identify frontend data contracts and the PDF viewer's exact document-loading contract.
- Record files that must remain untouched.
- No schema changes, dependency removal or reader edits in this milestone.

Acceptance: inventory is documented; the reader files to protect are identified.

### M1 — Remove Payload and establish Prisma + Neon (in progress)
- Add Prisma using the same Neon adapter approach as the vCard project, after checking its current package versions and schema conventions.
- Define an initial AcroReader schema.
- Add a health/database connectivity check that does not expose secrets.
- Replace Payload catalogue reads with a local service/API adapter returning the current `LibraryFolder` shape.
- Remove Payload-only dependencies, environment variables and code only after all references are replaced.
- Do not reset or overwrite the existing Neon database. Use a dedicated AcroReader database/schema or a reviewed baseline migration. Back up first.
- Generate and inspect migration SQL before applying it.

Acceptance: no Payload imports/dependencies/configuration remain; app builds; Prisma connects to the intended Neon database; catalogue uses the new data layer.

### M2 — Authentication and users
- Auth.js login/session integration.
- User model, password hashing if credentials are used, roles and active/suspended status.
- Protect server routes and admin pages.
- Session expiry and logout.

Acceptance: registration/login/admin authorization tests pass.

### M3 — Organisations and licensing
- Organisation and membership models.
- Organisation roles.
- Aircraft-series entitlements, optional document-level restrictions, effective dates, expiry and revocation.
- Central server-side permission service.

Acceptance: test users can access only the aircraft series/documents licensed to their active organisation.

### M4 — Aviation document catalogue
- Aircraft series, categories, document types.
- Documents and revisions.
- Draft/published/superseded lifecycle, effective dates, revision notes, uploader and audit history.
- Admin CRUD and validation.

Acceptance: admin can create a document and publish a revision without editing database rows manually.

### M5 — Private file storage and range delivery
- Create a new private Vercel Blob store.
- Store only Blob pathname and metadata in PostgreSQL; never expose tokens or permanent public URLs.
- Upload and verify files.
- Authenticated route checks session, account, membership, entitlement, document and revision state on every request.
- Correct HTTP Range/206/Content-Range/Accept-Ranges/Content-Length/ETag behaviour for PDF.js.
- Plan migration of any existing public PDFs; do not assume changing code makes old public files private.

Acceptance: authorised PDF.js requests load incrementally; unauthorised and copied requests fail; large-file and multi-range tests pass.

### M6 — Frontend integration (adapter-first)
- Replace Payload data fetching with the new API/service.
- Preserve the existing catalogue component contract.
- Connect document selection to the protected file endpoint.
- Keep the existing reader component and PDF.js API unchanged wherever possible.

Acceptance: catalogue and existing reader work end-to-end against the new backend; InDesign internal navigation remains functional.

### M7 — Administration
- Manage users, organisations, memberships, aircraft entitlements, documents and revisions.
- Audit important actions.
- Safe publish/retire workflows.

Acceptance: routine operations can be performed through the admin UI.

### M8 — Verification and production
- Typecheck/build, unit/integration/e2e tests.
- Desktop/tablet/mobile tests.
- InDesign links/actions, search, annotations, zoom, gestures and large PDFs.
- Access-control and range-request security tests.
- Backup/restore rehearsal and production environment checklist.

Acceptance: release checklist passed and production rollout approved.

## Working rules

1. Never change the PDF viewer engine as a shortcut for backend integration.
2. No direct public Blob URLs for protected manuals.
3. No secrets in client components, NEXT_PUBLIC variables or API responses.
4. Validate all input and enforce authorization server-side on every protected operation.
5. Use additive, reviewed Prisma migrations. Never run `migrate reset` against any valuable database.
6. Never apply a production migration without a verified backup, staging test and explicit approval.
7. Keep each milestone small, typechecked and build-verified before proceeding.
8. Do not merge to main or trigger production deployment without the user's approval.

## Initial inventory (M0)

Known from the current feature branch:
- Payload catalogue fetch: `src/lib/server/getDocumentLibrary.ts`.
- Catalogue entry points: `src/app/page.tsx` and `src/app/library/[...segments]/page.tsx`.
- Catalogue presentation/data contract: `src/components/library/DocumentLibrary.tsx` and `src/data/documentLibrary.ts`.
- Existing reader route: `src/app/reader/page.tsx`.
- PDF.js dependency: `pdfjs-dist` in `package.json`.
- Current dependencies do not include Payload or Prisma; the Payload integration is an HTTP catalogue fetch, not an installed CMS SDK.
- Current Payload environment variable: `PAYLOAD_API_URL`.
- Existing frontend uses Next.js 15, React 19, TypeScript and Sass.

See `backend/ARCHITECTURE.md` for the traced reader loading flow, exact URL/range contract, catalogue data contract, and protected file list.
