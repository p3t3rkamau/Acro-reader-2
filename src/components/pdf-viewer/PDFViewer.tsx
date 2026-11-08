'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useLayoutMode } from '@/hooks/useLayoutMode';
import { usePDFDocument } from '@/hooks/usePDFDocument';
import { usePDFGestures } from '@/hooks/usePDFGestures';
import { usePDFKeyboard } from '@/hooks/usePDFKeyboard';
import type { OutlineNode, PDFSource } from '@/types/pdf';
import { ErrorBoundary } from '../ui/ErrorBoundary';
import { PDFBookmarks } from './PDFBookmarks';
import { PDFError } from './PDFError';
import { PDFLoading } from './PDFLoading';
import { PDFMobileControls } from './PDFMobileControls';
import { PDFPasswordDialog } from './PDFPasswordDialog';
import { PDFReport } from './PDFReport';
import { PDFToolbar } from './PDFToolbar';
import styles from './PDFViewer.module.scss';

interface Props { source: PDFSource; onClose: () => void }

function sourceName(source: PDFSource): string {
  if (source.kind === 'file') return source.file.name;
  try { return decodeURIComponent(new URL(source.url).pathname.split('/').pop() || source.url); } catch { return source.url; }
}

/**
 * Reader screen: toolbar, bookmarks, the PDF.js scroll container, overlays.
 * All document logic lives in PDFEngine; this component only wires UI to it.
 */
export default function PDFViewer({ source, onClose }: Props) {
  const layout = useLayoutMode();
  const phone = layout === 'phone';
  const layoutRef = useRef(layout);
  layoutRef.current = layout;

  // PDF.js needs the scroll container and the inner ".pdfViewer" element to exist as real DOM nodes.
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewerRef = useRef<HTMLDivElement>(null);
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const setContainerRef = useCallback((node: HTMLDivElement | null) => { containerRef.current = node; setContainer(node); }, []);

  const [outlineOpen, setOutlineOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [headerVisible, setHeaderVisible] = useState(true);
  const [pillVisible, setPillVisible] = useState(true);
  const [notice, setNotice] = useState<{ id: number; text: string } | null>(null);
  const suppressScrollUntil = useRef(0);
  const visRef = useRef({ header: true, pill: true });
  visRef.current = { header: headerVisible, pill: pillVisible };

  // After a jump on a phone, hide the header so the target page is not covered by it.
  const onJump = useCallback(() => {
    if (layoutRef.current === 'phone') { suppressScrollUntil.current = performance.now() + 600; setHeaderVisible(false); }
  }, []);
  const onNotice = useCallback((text: string) => setNotice({ id: Date.now(), text }), []);

  const { state, engine, passwordRequest } = usePDFDocument(source, containerRef, viewerRef, { onJump, onNotice, compactPages: phone });
  const name = sourceName(source);
  const title = state.title ?? name;

  usePDFKeyboard(engine);

  const onSingleTap = useCallback(() => {
    const show = !(visRef.current.header && visRef.current.pill);
    setHeaderVisible(show); setPillVisible(show);
  }, []);
  usePDFGestures(engine, container, { onSingleTap: phone ? onSingleTap : undefined });

  // Phone: tuck the toolbars away while scrolling down, bring them back on scroll up.
  useEffect(() => {
    if (!container || !phone) { setHeaderVisible(true); setPillVisible(true); return; }
    let last = container.scrollTop;
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const y = container.scrollTop;
        const delta = y - last;
        if (performance.now() < suppressScrollUntil.current) { last = y; return; }
        if (Math.abs(delta) < 14) return;
        if (delta > 0 && y > 60) { setHeaderVisible(false); setPillVisible(false); }
        else if (delta < 0) { setHeaderVisible(true); setPillVisible(true); }
        last = y;
      });
    };
    container.addEventListener('scroll', onScroll, { passive: true });
    return () => { container.removeEventListener('scroll', onScroll); cancelAnimationFrame(raf); };
  }, [container, phone]);

  // Keep "fit width / fit page" correct when the panel opens, the window resizes or the phone rotates.
  useEffect(() => {
    if (!container || !engine) return;
    let raf = 0;
    let w = container.clientWidth, h = container.clientHeight;
    const ro = new ResizeObserver(() => {
      if (container.clientWidth === w && container.clientHeight === h) return;
      w = container.clientWidth; h = container.clientHeight;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => engine.refitIfPreset());
    });
    ro.observe(container);
    return () => { ro.disconnect(); cancelAnimationFrame(raf); };
  }, [container, engine]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 5000);
    return () => clearTimeout(t);
  }, [notice]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !reportOpen && outlineOpen) setOutlineOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [outlineOpen, reportOpen]);

  const download = useCallback(async () => {
    const file = await engine?.getOriginalBlob();
    if (!file) return;
    const url = URL.createObjectURL(file.blob);
    const a = document.createElement('a');
    a.href = url; a.download = file.name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  }, [engine]);

  const selectBookmark = useCallback((node: OutlineNode) => {
    engine?.goToBookmark(node);
    if (layoutRef.current !== 'desktop') setOutlineOpen(false);
  }, [engine]);

  const common = {
    onGoToPage: (n: number) => engine?.goToPage(n),
    onPrev: () => engine?.previousPage(),
    onNext: () => engine?.nextPage(),
    onBack: () => engine?.goBack(),
    onZoomStep: (d: 1 | -1) => engine?.zoomStep(d),
    onZoomSet: (v: string | number) => engine?.setScale(v),
  };

  return (
    <ErrorBoundary onReset={onClose}>
      <div className={styles.shell} data-layout={layout}>
        <PDFToolbar layout={layout} title={title} state={state} outlineOpen={outlineOpen} visible={!phone || headerVisible}
          onToggleOutline={() => setOutlineOpen((o) => !o)} onClose={onClose} onDownload={download}
          onReport={() => setReportOpen(true)} {...common} />

        <div className={styles.body}>
          {outlineOpen && layout === 'desktop' && (
            <PDFBookmarks mode="docked" outline={state.outline} onSelect={selectBookmark} onClose={() => setOutlineOpen(false)} />
          )}

          <main className={styles.stage}>
            <div ref={setContainerRef} className={styles.container} tabIndex={0} aria-label={`${title}, ${state.numPages} pages`}>
              <div ref={viewerRef} className="pdfViewer" />
            </div>

            {state.status === 'loading' && <PDFLoading name={name} numPages={state.numPages} progress={state.loadProgress} />}
            {state.status === 'error' && state.error && <PDFError error={state.error} onClose={onClose} />}
            {state.renderErrors.length > 0 && (
              <div className={styles.banner} role="alert">
                {state.renderErrors.length === 1 ? `Page ${state.renderErrors[0]} could not be displayed.` : `${state.renderErrors.length} pages could not be displayed.`}
              </div>
            )}
            {phone && state.status === 'ready' && (
              <PDFMobileControls state={state} visible={pillVisible} {...common}
                onReveal={() => { setHeaderVisible(true); setPillVisible(true); }} />
            )}
          </main>
        </div>

        {outlineOpen && layout !== 'desktop' && (
          <>
            <div className={styles.scrim} onClick={() => setOutlineOpen(false)} />
            <PDFBookmarks mode="overlay" outline={state.outline} onSelect={selectBookmark} onClose={() => setOutlineOpen(false)} />
          </>
        )}
        {reportOpen && engine && <PDFReport engine={engine} state={state} onClose={() => setReportOpen(false)} />}
        {passwordRequest && (
          <PDFPasswordDialog wrong={passwordRequest.wrong} onSubmit={passwordRequest.resolve} onCancel={() => passwordRequest.resolve(null)} />
        )}
        {notice && <div key={notice.id} className={styles.toast} role="status">{notice.text}</div>}
      </div>
    </ErrorBoundary>
  );
}
