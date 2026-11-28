# AcroReader backend architecture

## Current integration boundary

The catalogue is server-rendered. Both `src/app/page.tsx` and `src/app/library/[...segments]/page.tsx` call `getDocumentLibrary()`, then pass its result to the existing `DocumentLibrary` component. The stable UI contract is exported from `src/data/documentLibrary.ts`:

- `LibraryFolder`: `slug`, `title`, optional `description`, recursive `folders`, optional `documents`.
- `LibraryDocument`: `id`, `title`, `revision`, `effectiveDate`, `status` (`current | superseded`).

The new repository/service layer must continue returning this shape. Catalogue UI changes are not required for the backend migration.

## PDF opening contract (must remain compatible)

The reader currently accepts this discriminated union from `src/types/pdf.ts`:

```ts
type PDFSource =
  | { kind: 'file'; file: File }
  | { kind: 'url'; url: string };
```

- Local uploads are read through PDF.js `PDFDataRangeTransport` and `File.slice()` in 1 MiB chunks.
- URL sources are passed directly to `pdfjsLib.getDocument({ url, rangeChunkSize })`.
- The URL range chunk size is 256 KiB.
- The engine also probes `Range: bytes=0-0` and treats HTTP 206 as range support.
- PDF.js owns the HTTP range requests, streaming/fallback behaviour, loading progress, password handling and document lifecycle.
- `PDFViewer` is a presentation/wiring component; `PDFEngine` owns PDF.js objects and configures PDF.js `PDFViewer` + `PDFLinkService`. The annotation layer is required for InDesign buttons and links.

For catalogue documents, the future adapter should supply a same-origin URL such as `/api/documents/{documentId}/file` as the existing `{ kind: 'url', url }` source. Do not fetch the whole PDF into a client-side ArrayBuffer or Blob. The API must support PDF.js byte-range requests and return correct 200/206 response headers. Each range request must independently authenticate and authorize the user.

## Protected reader files

Treat these files as off-limits during backend work unless a specific, separately approved reader change is required:

- `src/types/pdf.ts`
- `src/components/pdf-viewer/PDFApp.tsx`
- `src/components/pdf-viewer/PDFViewer.tsx` and its UI children/styles
- `src/components/pdf-viewer/OpenScreen.tsx`
- `src/hooks/usePDFDocument.ts`
- `src/lib/pdf/PDFEngine.ts`
- `src/lib/pdf/pdfLoader.ts`
- `src/lib/pdf/pdfAnnotations.ts`
- `src/lib/pdf/pdfNavigation.ts`
- `src/lib/pdf/pdfPerformance.ts`
- PDF.js worker/assets and `scripts/copy-pdfjs.mjs`

The full PDF viewer folder contains controls for bookmarks, password prompts, loading/error states, mobile navigation and diagnostics. Preserve its component contract and behaviour.

## Backend request flow

1. Server-rendered catalogue calls a server-side service to fetch published document metadata.
2. The service maps database records to the existing `LibraryFolder` contract.
3. A user opens a catalogue document; the app supplies its same-origin protected file endpoint as a URL source.
4. PDF.js makes normal GET and Range requests to that endpoint.
5. Every request checks the authenticated session, active user, active organisation membership, relevant aircraft-series entitlement, optional document restriction, and published revision state.
6. The server streams only the requested bytes from private storage. It never returns a reusable public Blob URL or storage token.

## Neon / Prisma conventions

The vCard reference project uses Prisma 7 with `@prisma/adapter-neon`, a generated client under `src/generated/prisma`, and a singleton in `src/lib/prisma.ts` created with `new PrismaNeon({ connectionString: process.env.DATABASE_URL })`. Treat this as a proven pattern, not a copy-paste template: verify the installed package versions and Prisma 7 configuration requirements against this repository's Next.js 15 setup before adding dependencies.

Use a dedicated AcroReader Neon database or an explicitly isolated schema. Never point migrations at the vCard database. Do not run destructive migrations, reset, or migrate production without a verified backup, staging validation and explicit approval.

## Payload retirement

The only confirmed live Payload integration in the current inventory is the HTTP fetch in `src/lib/server/getDocumentLibrary.ts` using `PAYLOAD_API_URL` and `/api/acro-documents`. The app package currently has no Payload SDK dependency. Replace this data source before removing its references. Existing catalogue components and the reader should not need Payload-specific knowledge.


## M2 authentication architecture

### Confirmed product decisions

- Registration is hybrid: public self-registration is available, and organisation administrators can invite users.
- Email verification is mandatory before a user can sign in.
- A newly registered account has `UserStatus.ACTIVE` immediately. Email verification is a separate gate: an active account with `emailVerified = null` cannot authenticate.
- Public registration does not create an organisation membership or grant access to manuals.
- An invitation grants only the organisation membership and role encoded in that invitation. Aircraft/document access remains governed by the entitlement checks described above.

### Authentication method

Use Auth.js with its Credentials provider and JWT sessions for the initial email/password implementation. Credentials authentication requires application-owned user/password persistence and JWT sessions; Auth.js does not automatically store credentials users. The application will create users through its own Prisma service, hash passwords with Argon2id, and validate credentials server-side with Zod.

Do not add a Prisma adapter solely for Credentials authentication. Keep the existing Auth.js-compatible `Account`, `Session` and `VerificationToken` models available for a future provider/session strategy, but do not imply that Credentials sign-ins create database `Session` rows.

### Verification and invitation records

Add purpose-specific Prisma records in an additive migration:

- `EmailVerificationToken`: user ID, unique SHA-256 token digest, expiry and consumed timestamp. Generate high-entropy random tokens; send the raw token only in the verification URL; persist only its digest. Verification must be single-use and expiry-checked.
- `OrganizationInvitation`: organisation ID, normalized invited email, invited role, unique token digest, inviter user ID, expiry, accepted and revoked timestamps. Invitation acceptance must require a verified account whose normalized email matches the invitation. It must be single-use and must not create duplicate memberships.

Use a transaction when consuming a token and changing `emailVerified` or creating a membership, so a partially completed acceptance cannot leave inconsistent state. Never trust an organisation ID, role, user ID or entitlement supplied by the browser when accepting an invitation.

### Sign-in and authorization rules

- Reject sign-in when the account is suspended, email is unverified, the password is invalid, or the user does not exist. Return generic credential errors to avoid account enumeration.
- On every protected server operation, re-read the user status from Neon rather than trusting a potentially stale JWT. Membership and entitlement checks remain separate server-side authorization steps.
- Use short-lived JWT sessions (initial target: 12 hours), secure HttpOnly cookies in production, and explicit logout. A status suspension must block protected requests even if the browser still holds a valid JWT.
- Do not use middleware as the only security boundary. Protect Route Handlers, Server Actions and server-rendered protected pages at the data/service boundary.
- Registration and invitation endpoints need input validation, abuse controls and durable rate limiting before public production launch. Do not rely on in-memory rate limits in serverless deployments.

### Email delivery and configuration

Keep email delivery behind a server-only `sendEmail` service so the provider can be changed without changing registration or token logic. Required messages: verify email, resend verification, organisation invitation, and later password reset. Do not log raw verification/invitation tokens or expose them in API responses.

Before production, configure a transactional email provider and a durable rate limiter. Provider credentials and `AUTH_SECRET` remain server-only environment variables. The sender domain must be verified and links must use the canonical application URL, never localhost in production.

### Suggested code layout

- `src/auth.ts` — Auth.js configuration and Credentials provider.
- `src/app/api/auth/[...nextauth]/route.ts` — Auth.js handlers.
- `src/lib/auth/password.ts` — Argon2id hash and verify helpers.
- `src/lib/auth/session.ts` — current-user and active-account helpers.
- `src/lib/auth/tokens.ts` — secure token generation/digest/consumption.
- `src/lib/services/registration.ts` — registration and verification workflows.
- `src/lib/services/invitations.ts` — invite creation, validation and acceptance.
- `src/lib/email/send-email.ts` — provider-neutral email service.
- `src/lib/validation/auth.ts` — Zod request schemas.
- `src/app/(auth)/register/page.tsx`, `login/page.tsx` and verification result pages — auth UI.
- `src/app/api/auth/register/route.ts`, `verify/route.ts`, `resend-verification/route.ts` and invitation routes — application workflows.

Do not modify the protected PDF reader files for M2.
