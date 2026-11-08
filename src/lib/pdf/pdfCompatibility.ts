import type { PDFDocumentProxy } from 'pdfjs-dist';

/**
 * Compatibility report.
 *
 * The scan reads the REAL annotations and actions of every page via PDF.js and counts what
 * the document contains. Each feature is then looked up in FEATURES, which says how this
 * reader/PDF.js treats it and whether that has been verified by an actual test.
 *
 * Rule: `verified` may only be set to true after the behaviour has been exercised against a
 * real document (see TESTING.md). Everything else is labelled "not yet tested".
 */
export type Support = 'supported' | 'partial' | 'unsupported' | 'not-exported';

export interface FeatureInfo {
  label: string;
  support: Support;
  note: string;
  /** True only when an automated/manual test has confirmed it on a real document. */
  verified: boolean;
}

export const FEATURES: Record<string, FeatureInfo> = {
  'link:goto': { label: 'Internal links (GoTo page / named destination)', support: 'supported', note: 'Navigates through PDFLinkService. Tested: mouse click and touch tap on the Q400 QRH (explicit page destinations). Named destinations are not yet tested.', verified: true },
  'link:uri': { label: 'External links (URI)', support: 'supported', note: 'Opens in a new tab. Only http, https, mailto and tel are allowed.', verified: false },
  'link:named': { label: 'Named actions (Next/Prev/First/Last page, Go back)', support: 'supported', note: 'Handled by PDFLinkService. "Go forward" and menu actions such as Print are not wired yet.', verified: false },
  'link:gotor': { label: 'Links to other PDF files (GoToR)', support: 'unsupported', note: 'Needs the other file. Browsers cannot resolve a relative file path.', verified: false },
  'link:launch': { label: 'Launch / open-file actions', support: 'unsupported', note: 'Not possible in a web page.', verified: false },
  'link:javascript': { label: 'JavaScript actions on links', support: 'unsupported', note: 'Scripting is disabled in this version for safety.', verified: false },
  'link:other': { label: 'Links with other or unknown actions', support: 'unsupported', note: 'The action type is not handled.', verified: false },
  'widget:pushButton': { label: 'Push buttons (form widgets)', support: 'partial', note: 'Rendered. Only buttons whose action is a link/GoTo work; scripted buttons need scripting.', verified: false },
  'widget:Tx': { label: 'Text fields', support: 'partial', note: 'Rendered and editable in the page. Values are not saved back to the file.', verified: false },
  'widget:Ch': { label: 'Dropdowns / list boxes', support: 'partial', note: 'Rendered and selectable. Values are not saved.', verified: false },
  'widget:checkBox': { label: 'Checkboxes', support: 'partial', note: 'Rendered and toggleable. State is not saved.', verified: false },
  'widget:radioButton': { label: 'Radio buttons', support: 'partial', note: 'Rendered and selectable. State is not saved.', verified: false },
  'widget:Sig': { label: 'Signature fields', support: 'partial', note: 'Shown, signatures are not validated.', verified: false },
  'sub:FreeText': { label: 'Free-text annotations', support: 'supported', note: 'Rendered from the annotation appearance.', verified: false },
  'sub:Text': { label: 'Sticky-note annotations', support: 'partial', note: 'Icon shown; pop-up content is limited.', verified: false },
  'sub:Highlight': { label: 'Highlights / underlines / strikeouts', support: 'supported', note: 'Rendered from appearance streams.', verified: false },
  'sub:Stamp': { label: 'Stamps', support: 'supported', note: 'Rendered from appearance streams.', verified: false },
  'sub:Movie': { label: 'Movie annotations', support: 'unsupported', note: 'PDF.js does not play embedded video.', verified: false },
  'sub:Screen': { label: 'Screen annotations (media renditions)', support: 'unsupported', note: 'PDF.js does not play embedded media.', verified: false },
  'sub:Sound': { label: 'Sound annotations', support: 'unsupported', note: 'PDF.js does not play embedded audio.', verified: false },
  'sub:RichMedia': { label: 'Rich media (Flash / video / 3D players)', support: 'unsupported', note: 'Not implemented by PDF.js.', verified: false },
  'sub:3D': { label: '3D annotations', support: 'unsupported', note: 'Not implemented by PDF.js.', verified: false },
  'sub:FileAttachment': { label: 'File attachments', support: 'partial', note: 'Icon shown; attachment viewing is limited.', verified: false },
  'doc:javascript': { label: 'Document-level JavaScript', support: 'unsupported', note: 'Scripting is off. Scripts are detected, not run.', verified: false },
};

/** Features that exist in Acrobat but cannot be detected from the PDF.js API at all. */
export const NOT_DETECTABLE = [
  { label: 'Page transitions (fade, wipe, push)', support: 'unsupported' as Support, note: 'Stored as /Trans on the page. PDF.js neither exposes nor plays them. InDesign page transitions only apply in Acrobat full-screen mode.' },
  { label: 'InDesign object animations (motion presets, fades)', support: 'not-exported' as Support, note: 'InDesign exports these to SWF/HTML/EPUB. The PDF export does not embed them, so no PDF viewer can show them.' },
  { label: 'Buttons that show/hide other objects', support: 'partial' as Support, note: 'Needs PDF JavaScript or widget actions. Detected if present, but not executed while scripting is off.' },
];

export interface CompatReport {
  pagesScanned: number;
  totalAnnotations: number;
  /** Feature key -> number of occurrences found in the document. */
  found: Record<string, number>;
  /** Raw subtype names that are not in FEATURES (reported, never hidden). */
  unknownSubtypes: Record<string, number>;
  documentHasJavaScript: boolean;
  hasFormFields: boolean;
  isXfa: boolean;
  attachments: number;
  creator: string | null;
  producer: string | null;
  cancelled: boolean;
}

interface AnnotationData {
  subtype?: string;
  url?: string | null;
  unsafeUrl?: string | null;
  dest?: unknown;
  action?: string;
  attachment?: unknown;
  actions?: Record<string, unknown> | null;
  fieldType?: string;
  pushButton?: boolean;
  checkBox?: boolean;
  radioButton?: boolean;
  resetForm?: unknown;
  setOCGState?: unknown;
}

function bump(map: Record<string, number>, key: string): void { map[key] = (map[key] ?? 0) + 1; }

function classify(a: AnnotationData, found: Record<string, number>, unknown: Record<string, number>): void {
  const subtype = a.subtype ?? 'Unknown';
  if (subtype === 'Link') {
    if (a.actions && Object.keys(a.actions).length) bump(found, 'link:javascript');
    else if (a.url?.startsWith('javascript:') || a.unsafeUrl?.startsWith('javascript:')) bump(found, 'link:javascript');
    else if (a.url || a.unsafeUrl) bump(found, 'link:uri');
    else if (a.action) bump(found, 'link:named');
    else if (a.dest !== undefined && a.dest !== null) bump(found, 'link:goto');
    else if (a.attachment) bump(found, 'link:other');
    else bump(found, 'link:other');
    return;
  }
  if (subtype === 'Widget') {
    const key = a.pushButton ? 'widget:pushButton' : a.checkBox ? 'widget:checkBox' : a.radioButton ? 'widget:radioButton' : `widget:${a.fieldType ?? 'Tx'}`;
    if (FEATURES[key]) bump(found, key); else bump(unknown, `Widget (${a.fieldType ?? '?'})`);
    return;
  }
  const key = `sub:${subtype}`;
  if (FEATURES[key]) bump(found, key);
  else if (['Square', 'Circle', 'Line', 'Ink', 'Polygon', 'PolyLine', 'Underline', 'Squiggly', 'StrikeOut', 'Caret'].includes(subtype)) bump(found, 'sub:Highlight');
  else bump(unknown, subtype);
}

/**
 * Scans pages sequentially, yielding to the browser between pages so the UI stays responsive
 * even on documents with thousands of pages. Pages are cleaned up after each read.
 */
export async function scanDocument(
  pdf: PDFDocumentProxy,
  onProgress: (done: number, total: number) => void,
  signal: AbortSignal,
): Promise<CompatReport> {
  const found: Record<string, number> = {};
  const unknown: Record<string, number> = {};
  let total = 0;
  let done = 0;

  for (let i = 1; i <= pdf.numPages; i++) {
    if (signal.aborted) break;
    const page = await pdf.getPage(i);
    const annotations = (await page.getAnnotations()) as AnnotationData[];
    total += annotations.length;
    annotations.forEach((a) => classify(a, found, unknown));
    page.cleanup();
    done = i;
    if (i % 5 === 0 || i === pdf.numPages) {
      onProgress(i, pdf.numPages);
      await new Promise((r) => setTimeout(r, 0));
    }
  }

  const [hasJs, fields, attachments, meta] = await Promise.all([
    pdf.hasJSActions().catch(() => false),
    pdf.getFieldObjects().catch(() => null),
    pdf.getAttachments().catch(() => null),
    pdf.getMetadata().catch(() => null),
  ]);
  // hasJSActions() is true when ANY JavaScript exists (document, field or link actions).
  const docActions = await pdf.getJSActions().catch(() => null);
  const documentHasJavaScript = !!hasJs || (!!docActions && Object.keys(docActions).length > 0);
  if (documentHasJavaScript) found['doc:javascript'] = docActions ? Object.keys(docActions).length || 1 : 1;

  const info = (meta?.info ?? {}) as Record<string, unknown>;
  return {
    pagesScanned: done,
    totalAnnotations: total,
    found,
    unknownSubtypes: unknown,
    documentHasJavaScript,
    hasFormFields: !!fields && Object.keys(fields).length > 0,
    isXfa: !!(pdf as unknown as { isPureXfa?: boolean }).isPureXfa,
    attachments: attachments ? Object.keys(attachments).length : 0,
    creator: typeof info.Creator === 'string' ? info.Creator : null,
    producer: typeof info.Producer === 'string' ? info.Producer : null,
    cancelled: signal.aborted,
  };
}
