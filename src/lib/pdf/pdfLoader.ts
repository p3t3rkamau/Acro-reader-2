import type * as PdfjsLibNS from 'pdfjs-dist';
import type * as PdfjsViewerNS from 'pdfjs-dist/web/pdf_viewer.mjs';

export type PdfjsLib = typeof PdfjsLibNS;
export type PdfjsViewerLib = typeof PdfjsViewerNS;

export interface PdfjsRuntime {
  pdfjsLib: PdfjsLib;
  pdfjsViewer: PdfjsViewerLib;
  /** Public URL prefix where scripts/copy-pdfjs.mjs put the PDF.js assets. */
  assetBase: string;
}

const ASSET_BASE = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ''}/pdfjs`;
let runtime: Promise<PdfjsRuntime> | null = null;

/**
 * Loads PDF.js lazily, once, in the browser only.
 *
 * PDF.js is loaded as a native ES module from /public (webpackIgnore) rather than bundled:
 * the viewer build expects `globalThis.pdfjsLib` to exist before it is evaluated, so the
 * order below matters.
 */
export function loadPdfjs(): Promise<PdfjsRuntime> {
  runtime ??= (async () => {
    const pdfjsLib = (await import(/* webpackIgnore: true */ `${ASSET_BASE}/pdf.min.mjs`)) as PdfjsLib;
    pdfjsLib.GlobalWorkerOptions.workerSrc = `${ASSET_BASE}/pdf.worker.min.mjs`;
    (globalThis as unknown as { pdfjsLib: PdfjsLib }).pdfjsLib = pdfjsLib;
    const pdfjsViewer = (await import(/* webpackIgnore: true */ `${ASSET_BASE}/pdf_viewer.mjs`)) as PdfjsViewerLib;
    return { pdfjsLib, pdfjsViewer, assetBase: ASSET_BASE };
  })().catch((err) => {
    runtime = null; // allow a retry after a transient failure
    throw err;
  });
  return runtime;
}
