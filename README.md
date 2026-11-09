# Interactive PDF Reader

A Next.js (App Router) + TypeScript + SCSS Modules PDF reader built on Mozilla PDF.js, designed so
interactive PDFs exported from InDesign (buttons, links, bookmarks) work on phones, tablets and desktop.
This is **Phases 1–3**: foundation, rendering/navigation/zoom, and the interactive layer.

## Run it

```bash
npm install        # also copies PDF.js assets into public/pdfjs (postinstall)
npm run dev        # http://localhost:3000
npm run build && npm start
```

Open a PDF with "Choose a PDF", drag and drop, or `/?url=https://host/file.pdf`.
For older iOS/Android browsers, install with `PDFJS_LEGACY=1 npm run copy-pdfjs` to ship PDF.js's legacy build.

## Architecture

| Layer | Files | Responsibility |
|---|---|---|
| Engine (no React) | `src/lib/pdf/PDFEngine.ts`, `pdfLoader`, `pdfAnnotations`, `pdfNavigation`, `pdfPerformance`, `pdfCompatibility` | Owns PDF.js: loading, viewer, link service, back history, zoom, outline, compatibility scan |
| Hooks | `src/hooks/*` | Connect the engine to React (lifecycle, gestures, keyboard, layout) |
| UI | `src/components/pdf-viewer/*` | Toolbar, mobile controls, bookmarks, report, dialogs |

The UI can be redesigned without touching the engine.

**How interactivity works.** Every page is canvas + text layer + *annotation layer*. The annotation layer turns the
PDF's real link/widget annotations into DOM elements wired to `PDFLinkService`, which follows GoTo, named
destinations and named actions. Nothing is hardcoded. Bookmarks come from `getOutline()`.

**Performance.** PDF.js's viewer only renders visible pages, keeps an LRU buffer of ≥10 pages, destroys canvases
that leave it and cancels in-flight renders. We add a device-based `maxCanvasPixels` cap, and load local files with
`File.slice()` ranges and URLs with HTTP range requests so large files are not read into memory at once.

## Not included yet (Phases 4–5)

Search, print, share, PDF JavaScript (scripting is deliberately off), `Go forward` named action, saving form values.
No button for these is shown, so nothing looks functional that is not.

See `TESTING.md` for exactly what was tested and what was not.


## Payload CMS catalogue connection

Set `PAYLOAD_API_URL` in the frontend deployment environment to the base URL of the Payload backend, for example:

```env
PAYLOAD_API_URL=https://your-payload-backend.example.com
```

The server-rendered catalogue requests `/api/acro-documents` from Payload and maps the returned aircraft series, category hierarchy, revision number, effective date and publication status into the library. The request is cached for 60 seconds. Do not prefix this variable with `NEXT_PUBLIC_`; it is only needed on the server.

**PDF opening is intentionally not wired to the media URL yet.** The current Payload endpoint includes a media URL and the current backend media access marks published files public. That is not an entitlement-protected document delivery flow. Do not expose those URLs in the browser or treat hiding them in the UI as access control. Before enabling catalogue-to-reader opening for paid documents, implement and test an authenticated backend document endpoint that checks the user's organisation membership, aircraft-series entitlement, document/revision publication status, and streams/range-serves the PDF without revealing a reusable public Blob URL.
