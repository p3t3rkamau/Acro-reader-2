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
