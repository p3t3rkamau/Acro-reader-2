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
