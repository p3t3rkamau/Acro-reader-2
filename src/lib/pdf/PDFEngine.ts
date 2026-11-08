import type { PDFDocumentLoadingTask, PDFDocumentProxy } from 'pdfjs-dist';
import type { LoadError, PDFSource, RangeSupport, ViewerState } from '@/types/pdf';
import { createLinkService, convertOutline } from './pdfAnnotations';
import type { PdfjsRuntime } from './pdfLoader';
import { PositionHistory } from './pdfNavigation';
import { getRenderBudget } from './pdfPerformance';

type Viewer = InstanceType<PdfjsRuntime['pdfjsViewer']['PDFViewer']>;
type LinkService = InstanceType<PdfjsRuntime['pdfjsViewer']['PDFLinkService']>;

export interface EngineEvents {
  /** Partial state updates for the UI. */
  onState(patch: Partial<ViewerState>): void;
  /** Asked when the PDF needs a password. Resolve with null to cancel. */
  onPassword(wrongPassword: boolean): Promise<string | null>;
  /** Called before any programmatic jump (link, bookmark, page box, back). */
  onJump(): void;
  /** Human-readable notice, e.g. an action this reader cannot perform. */
  onNotice(message: string): void;
}

const FILE_CHUNK = 1 << 20;   // 1 MB reads from local files
const URL_CHUNK = 1 << 18;    // 256 KB range requests from servers
const MIN_SCALE = 0.25;
const MAX_SCALE = 8;

/**
 * Framework-agnostic PDF engine. It owns PDF.js objects and knows nothing about React or the
 * UI, so the interface can be redesigned without touching document handling.
 *
 * Rendering stack (all provided by PDF.js's PDFViewer, per page):
 *   canvas (pixels) -> text layer (selectable text) -> annotation layer (links, buttons, forms)
 * The annotation layer is what makes InDesign buttons and hyperlinks work: each link becomes
 * a real <a> element positioned over the page and wired to PDFLinkService.
 */
export class PDFEngine {
  private readonly eventBus: InstanceType<PdfjsRuntime['pdfjsViewer']['EventBus']>;
  private readonly linkService: LinkService;
  private readonly viewer: Viewer;
  private readonly history = new PositionHistory();
  private task: PDFDocumentLoadingTask | null = null;
  private pdf: PDFDocumentProxy | null = null;
  private source: PDFSource | null = null;
  private destroyed = false;
  private probe = new AbortController();
  private renderErrors = new Set<number>();

  constructor(
    private readonly rt: PdfjsRuntime,
    private readonly container: HTMLDivElement,
    private readonly viewerEl: HTMLDivElement,
    private readonly events: EngineEvents,
    private readonly compactPages: boolean,
  ) {
    const { pdfjsLib, pdfjsViewer } = rt;
    const budget = getRenderBudget();

    this.eventBus = new pdfjsViewer.EventBus();
    this.linkService = createLinkService(pdfjsViewer, this.eventBus);
    this.viewer = new pdfjsViewer.PDFViewer({
      container,
      viewer: viewerEl,
      eventBus: this.eventBus,
      linkService: this.linkService,
      // ENABLE_FORMS: draw annotations and make form widgets interactive.
      annotationMode: pdfjsLib.AnnotationMode.ENABLE_FORMS,
      // This is a reader, not an editor: disable the annotation editor UI entirely.
      annotationEditorMode: pdfjsLib.AnnotationEditorType.DISABLE,
      textLayerMode: 1, // TextLayerMode.ENABLE: selectable text, needed for search and copy
      removePageBorders: compactPages,
      maxCanvasPixels: budget.maxCanvasPixels,
      enableHWA: budget.enableHWA,
    });
    this.linkService.setViewer(this.viewer);
    // PDFLinkService calls pushCurrentPosition() before every link/bookmark jump and back()
    // for the "GoBack" named action. We plug our own history in to power the Back button.
    this.linkService.setHistory({
      pushCurrentPosition: () => this.rememberPosition(),
      push: () => {},
      pushPage: () => {},
      back: () => this.goBack(),
      forward: () => this.events.onNotice('“Go forward” is not supported yet.'),
    } as unknown as Parameters<LinkService['setHistory']>[0]);

    this.bindEvents();
  }

  // ---- lifecycle ------------------------------------------------------------------------

  async open(source: PDFSource): Promise<void> {
    this.source = source;
    const { pdfjsLib, assetBase } = this.rt;
    this.events.onState({
      status: 'loading',
      loadProgress: 0,
      fileSize: source.kind === 'file' ? source.file.size : null,
      rangeSupport: source.kind === 'file' ? 'n/a' : 'unknown',
    });

    const common = {
      cMapUrl: `${assetBase}/cmaps/`,
      cMapPacked: true,
      standardFontDataUrl: `${assetBase}/standard_fonts/`,
      isEvalSupported: false, // never eval() code from a PDF
      enableXfa: false,
    };

    try {
      let params: Parameters<typeof pdfjsLib.getDocument>[0];
      if (source.kind === 'file') {
        params = { ...common, ...(await this.fileTransportParams(source.file)) };
      } else {
        void this.probeRangeSupport(source.url);
        // Range requests + streaming are on by default; PDF.js falls back automatically
        // when the server does not support them.
        params = { ...common, url: source.url, rangeChunkSize: URL_CHUNK };
      }
      const task = pdfjsLib.getDocument(params);
      this.task = task;
      task.onProgress = ({ loaded, total }: { loaded: number; total?: number }) => {
        if (!this.destroyed) this.events.onState({ loadProgress: total ? Math.min(1, loaded / total) : null });
      };
      task.onPassword = (update: (pw: string) => void, reason: number) => {
        const wrong = reason === pdfjsLib.PasswordResponses.INCORRECT_PASSWORD;
        void this.events.onPassword(wrong).then((pw) => {
          if (this.destroyed) return;
          if (pw === null) {
            void task.destroy();
            this.events.onState({ status: 'error', error: { kind: 'password', title: 'Password required', detail: 'This document is protected. Open it again and enter the password to read it.' } });
          } else update(pw);
        });
      };

      const pdf = await task.promise;
      if (this.destroyed) { void pdf.destroy(); return; }
      this.pdf = pdf;
      this.events.onState({ numPages: pdf.numPages });
      this.viewer.setDocument(pdf);
      this.linkService.setDocument(pdf, null);
      void this.loadMetadata(pdf);
      void this.loadOutline(pdf);
    } catch (err) {
      if (this.destroyed) return;
      const error = classifyError(err, source);
      if (error.kind !== 'password') this.events.onState({ status: 'error', error });
    }
  }

  /** Releases the document, worker task, canvases and listeners. Safe to call twice. */
  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.probe.abort();
    try { this.viewer.setDocument(null as never); } catch { /* viewer already empty */ }
    try { this.linkService.setDocument(null as never, null); } catch { /* ignore */ }
    void this.task?.destroy();   // also destroys the document and frees the worker side
    this.viewerEl.replaceChildren();
    this.history.clear();
    this.pdf = null;
  }

  get document(): PDFDocumentProxy | null { return this.pdf; }

  // ---- local files: range-style loading without reading the whole file ------------------

  /**
   * Feeds PDF.js from a File via slice(), so a 300 MB file is never copied into memory at
   * once: PDF.js asks for the byte ranges it needs (xref, first pages, ...) and then
   * background-fetches the rest in chunks.
   */
  private async fileTransportParams(file: File) {
    const { pdfjsLib } = this.rt;
    const initial = new Uint8Array(await file.slice(0, FILE_CHUNK).arrayBuffer());
    let loaded = initial.length;
    class FileTransport extends pdfjsLib.PDFDataRangeTransport {
      requestDataRange(begin: number, end: number): void {
        void file.slice(begin, end).arrayBuffer().then((buf) => {
          this.onDataRange(begin, new Uint8Array(buf));
          loaded += buf.byteLength;
          this.onDataProgress(Math.min(loaded, file.size), file.size);
        });
      }
    }
    return { range: new FileTransport(file.size, initial), length: file.size, rangeChunkSize: FILE_CHUNK };
  }

  /** Informational: asks the server for 1 byte to find out whether Range requests work. */
  private async probeRangeSupport(url: string): Promise<void> {
    let result: RangeSupport = 'unknown';
    try {
      const res = await fetch(url, { headers: { Range: 'bytes=0-0' }, signal: this.probe.signal });
      result = res.status === 206 ? 'yes' : res.ok ? 'no' : 'unknown';
      void res.body?.cancel();
    } catch { /* CORS or network: stays unknown, the real load reports the error */ }
    if (!this.destroyed) this.events.onState({ rangeSupport: result });
  }

  // ---- metadata / outline ---------------------------------------------------------------

  private async loadMetadata(pdf: PDFDocumentProxy): Promise<void> {
    try {
      const meta = await pdf.getMetadata();
      const info = meta.info as Record<string, unknown>;
      const dc = (meta.metadata as { get?: (k: string) => unknown } | null)?.get?.('dc:title');
      const title = [info?.Title, dc].find((t): t is string => typeof t === 'string' && t.trim().length > 0);
      if (!this.destroyed && title) this.events.onState({ title: title.trim() });
    } catch { /* title is optional */ }
  }

  private async loadOutline(pdf: PDFDocumentProxy): Promise<void> {
    try {
      const raw = await pdf.getOutline();
      if (!this.destroyed) this.events.onState({ outline: convertOutline(raw as never) });
    } catch {
      if (!this.destroyed) this.events.onState({ outline: [] });
    }
  }

  // ---- events from PDF.js ---------------------------------------------------------------

  private bindEvents(): void {
    const bus = this.eventBus;
    bus.on('pagesinit', () => {
      // Narrow screens (phones, tablets): fit the page width. Wide screens: "auto" = fit width
      // but never above 100%, like Acrobat, so pages are not blown up on large monitors.
      this.viewer.currentScaleValue = this.container.clientWidth < 1000 ? 'page-width' : 'auto';
      this.events.onState({ status: 'ready', loadProgress: 1, numPages: this.viewer.pagesCount });
    });
    bus.on('pagechanging', (e: { pageNumber: number }) => this.events.onState({ currentPage: e.pageNumber }));
    bus.on('scalechanging', (e: { scale: number; presetValue?: string }) =>
      this.events.onState({ scale: e.scale, scaleValue: e.presetValue ?? String(e.scale) }));
    bus.on('pagerendered', (e: { pageNumber: number; error?: unknown }) => {
      const div = this.viewer.getPageView(e.pageNumber - 1)?.div;
      if (e.error) {
        this.renderErrors.add(e.pageNumber);
        div?.setAttribute('data-render-error', 'true');
      } else if (this.renderErrors.delete(e.pageNumber)) {
        div?.removeAttribute('data-render-error');
      } else return;
      this.events.onState({ renderErrors: [...this.renderErrors].sort((a, b) => a - b) });
    });
    // Named actions PDFLinkService does not handle itself (Print, SaveAs, Find...).
    bus.on('namedaction', (e: { action: string }) =>
      this.events.onNotice(`This button runs the “${e.action}” action, which this reader does not support yet.`));
  }

  // ---- navigation -----------------------------------------------------------------------

  get numPages(): number { return this.viewer.pagesCount; }

  goToPage(pageNumber: number): void {
    if (!Number.isInteger(pageNumber) || pageNumber < 1 || pageNumber > this.numPages) return;
    this.events.onJump();
    // linkService.goToPage records the current position first (our history hook).
    this.linkService.goToPage(pageNumber);
  }

  nextPage(): void { this.viewer.nextPage(); }
  previousPage(): void { this.viewer.previousPage(); }

  /** Follows a bookmark: explicit/named destination through PDFLinkService, or a URL. */
  goToBookmark(node: { dest: unknown; url: string | null }): void {
    this.events.onJump();
    if (node.dest) { this.linkService.goToDestination(node.dest as never); return; }
    if (node.url && /^(https?:|mailto:|tel:)/i.test(node.url)) window.open(node.url, '_blank', 'noopener,noreferrer');
  }

  private rememberPosition(): void {
    this.events.onJump();
    this.history.push({
      pageNumber: this.viewer.currentPageNumber,
      scrollTop: this.container.scrollTop,
      scrollLeft: this.container.scrollLeft,
      scale: this.viewer.currentScale,
      scaleValue: this.viewer.currentScaleValue,
    });
    this.events.onState({ canGoBack: this.history.size > 0 });
  }

  /** Returns to the position before the last jump (Acrobat's "Previous View"). */
  goBack(): void {
    const pos = this.history.pop();
    this.events.onState({ canGoBack: this.history.size > 0 });
    if (!pos) return;
    this.events.onJump();
    // Restore the zoom first: changing scale re-lays out the pages synchronously.
    if (Math.abs(this.viewer.currentScale - pos.scale) > 0.001) {
      if (Number.isNaN(Number(pos.scaleValue))) this.viewer.currentScaleValue = pos.scaleValue;
      else this.viewer.currentScale = pos.scale;
    }
    this.container.scrollTo({ top: pos.scrollTop, left: pos.scrollLeft, behavior: 'instant' });
  }

  // ---- zoom -----------------------------------------------------------------------------

  get scale(): number { return this.viewer.currentScale; }
  get scaleValue(): string { return this.viewer.currentScaleValue; }

  /** value: "page-width" | "page-fit" | "auto" | a number (1 = 100%). */
  setScale(value: string | number): void {
    const v = typeof value === 'number' ? Math.min(MAX_SCALE, Math.max(MIN_SCALE, value)) : value;
    this.viewer.currentScaleValue = String(v);
  }

  /** Step zoom, keeping the given client-space point (or the viewport centre) fixed. */
  zoomStep(direction: 1 | -1): void {
    const rect = this.container.getBoundingClientRect();
    const origin: [number, number] = [rect.left + rect.width / 2, rect.top + rect.height / 2];
    this.viewer.updateScale({ steps: direction, drawingDelay: 0, origin } as never);
  }

  /**
   * Multiplicative zoom used by pinch / ctrl+wheel / double-tap. `origin` is a client-space
   * point that stays under the user's fingers. `drawingDelay` postpones the sharp re-render
   * so pages are CSS-stretched (instant) during the gesture and redrawn once it settles.
   */
  zoomBy(factor: number, origin: [number, number], drawingDelay = 250): void {
    const target = this.viewer.currentScale * factor;
    const clamped = Math.min(MAX_SCALE, Math.max(MIN_SCALE, target));
    const f = clamped / this.viewer.currentScale;
    if (Math.abs(f - 1) < 0.003) return;
    this.viewer.updateScale({ scaleFactor: f, drawingDelay, origin } as never);
  }

  // ---- download -------------------------------------------------------------------------

  /** The original, unmodified file. Never a rasterised copy. */
  async getOriginalBlob(): Promise<{ blob: Blob; name: string } | null> {
    if (this.source?.kind === 'file') return { blob: this.source.file, name: this.source.file.name };
    if (!this.pdf) return null;
    const data = await this.pdf.getData();
    const url = this.source?.kind === 'url' ? this.source.url : '';
    const name = decodeURIComponent(url.split('?')[0].split('/').pop() || 'document.pdf');
    return { blob: new Blob([data as BlobPart], { type: 'application/pdf' }), name: /\.pdf$/i.test(name) ? name : `${name}.pdf` };
  }

  /** Re-applies preset zoom (fit width / fit page) after the container changed size. */
  refitIfPreset(): void {
    const v = this.viewer.currentScaleValue;
    if (v === 'page-width' || v === 'page-fit' || v === 'auto' || v === 'page-actual') {
      this.viewer.currentScaleValue = v;
    }
  }
}

function classifyError(err: unknown, source: PDFSource): LoadError {
  const name = (err as { name?: string })?.name;
  const message = (err as { message?: string })?.message ?? String(err);
  const status = (err as { status?: number })?.status;
  if (name === 'InvalidPDFException') {
    return { kind: 'invalid', title: 'This PDF is damaged or incomplete', detail: 'The file could not be read. Try downloading it again or export it again from InDesign.' };
  }
  if (name === 'MissingPDFException') {
    return { kind: 'missing', title: 'Document not found', detail: 'The server could not find a PDF at this address (404).' };
  }
  if (name === 'UnexpectedResponseException') {
    return { kind: 'network', title: 'The server refused the request', detail: `The server answered with status ${status ?? 'unknown'}.` };
  }
  if (source.kind === 'url' && (err instanceof TypeError || /fetch|network|cors/i.test(message))) {
    return {
      kind: 'network',
      title: 'Could not reach this document',
      detail: 'Either you are offline, or the website does not allow other sites to read its files (CORS). Download the PDF and open it from your device instead.',
    };
  }
  return { kind: 'unknown', title: 'This PDF could not be opened', detail: message };
}
