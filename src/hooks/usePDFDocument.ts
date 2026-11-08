import { useEffect, useRef, useState, type RefObject } from 'react';
import { PDFEngine } from '@/lib/pdf/PDFEngine';
import { loadPdfjs } from '@/lib/pdf/pdfLoader';
import { initialViewerState, type PDFSource, type ViewerState } from '@/types/pdf';

export interface PasswordRequest { wrong: boolean; resolve: (pw: string | null) => void }

interface Options {
  onJump: () => void;
  onNotice: (message: string) => void;
  /** Phones use edge-to-edge pages (no side gutter). Read once when the engine is created. */
  compactPages: boolean;
}

/**
 * Creates one PDFEngine per document and mirrors its state into React.
 * The engine is destroyed (worker task, canvases, listeners) when the source changes or the
 * component unmounts.
 */
export function usePDFDocument(
  source: PDFSource,
  containerRef: RefObject<HTMLDivElement | null>,
  viewerRef: RefObject<HTMLDivElement | null>,
  options: Options,
) {
  const [state, setState] = useState<ViewerState>(initialViewerState);
  const [engine, setEngine] = useState<PDFEngine | null>(null);
  const [passwordRequest, setPasswordRequest] = useState<PasswordRequest | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    let cancelled = false;
    let created: PDFEngine | null = null;
    setState({ ...initialViewerState, fileSize: source.kind === 'file' ? source.file.size : null });

    loadPdfjs()
      .then((rt) => {
        const container = containerRef.current;
        const viewerEl = viewerRef.current;
        if (cancelled || !container || !viewerEl) return;
        created = new PDFEngine(rt, container, viewerEl, {
          onState: (patch) => { if (!cancelled) setState((s) => ({ ...s, ...patch })); },
          onPassword: (wrong) => new Promise((resolve) => setPasswordRequest({ wrong, resolve: (pw) => { setPasswordRequest(null); resolve(pw); } })),
          onJump: () => optionsRef.current.onJump(),
          onNotice: (m) => optionsRef.current.onNotice(m),
        }, optionsRef.current.compactPages);
        setEngine(created);
        return created.open(source);
      })
      .catch(() => {
        if (!cancelled) setState((s) => ({ ...s, status: 'error', error: { kind: 'unknown', title: 'The PDF engine could not start', detail: 'PDF.js failed to load. Check your connection and reload the page.' } }));
      });

    return () => {
      cancelled = true;
      created?.destroy();
      setEngine(null);
    };
  }, [source, containerRef, viewerRef]);

  return { state, engine, passwordRequest };
}
