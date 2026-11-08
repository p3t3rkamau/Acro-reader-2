'use client';
import type { LayoutMode, ViewerState } from '@/types/pdf';
import { IconBack, IconClose, IconDownload, IconInfo, IconOutline } from '../ui/Icons';
import { PDFPageNavigation } from './PDFPageNavigation';
import { PDFZoomControls } from './PDFZoomControls';
import styles from './PDFToolbar.module.scss';

interface Props {
  layout: LayoutMode;
  title: string;
  state: ViewerState;
  outlineOpen: boolean;
  visible: boolean;
  onToggleOutline: () => void;
  onClose: () => void;
  onDownload: () => void;
  onReport: () => void;
  onGoToPage: (n: number) => void;
  onPrev: () => void;
  onNext: () => void;
  onBack: () => void;
  onZoomStep: (dir: 1 | -1) => void;
  onZoomSet: (v: string | number) => void;
}

/**
 * Top bar. Desktop/tablet: everything in one compact row (Acrobat style).
 * Phone: a slim header (title + essentials); page and zoom controls move to the bottom
 * thumb zone (see PDFMobileControls) and the header hides while reading.
 */
export function PDFToolbar(p: Props) {
  const phone = p.layout === 'phone';
  const ready = p.state.status === 'ready';

  return (
    <header className={`${styles.bar} ${phone ? styles.phone : ''} ${p.visible ? '' : styles.hidden}`} aria-hidden={!p.visible}>
      {phone && (
        <button className={styles.btn} onClick={p.onClose} aria-label="Close document" title="Close document"><IconClose /></button>
      )}
      {!phone && (
        <button className={`${styles.btn} ${p.outlineOpen ? styles.on : ''}`} onClick={p.onToggleOutline} aria-pressed={p.outlineOpen}
          aria-label="Bookmarks" title="Bookmarks"><IconOutline /></button>
      )}

      <h1 className={styles.title} title={p.title}>{p.title}</h1>

      {!phone && (
        <div className={styles.center}>
          <PDFPageNavigation variant="bar" current={p.state.currentPage} total={p.state.numPages}
            onGo={p.onGoToPage} onPrev={p.onPrev} onNext={p.onNext} />
        </div>
      )}

      <div className={styles.right}>
        {!phone && (
          <>
            <button className={styles.btn} onClick={p.onBack} disabled={!p.state.canGoBack} aria-label="Previous view" title="Previous view (Alt ←)"><IconBack /></button>
            <PDFZoomControls variant="inline" scale={p.state.scale} scaleValue={p.state.scaleValue} disabled={!ready}
              onStep={p.onZoomStep} onSet={p.onZoomSet} />
          </>
        )}
        <button className={styles.btn} onClick={p.onDownload} disabled={!ready} aria-label="Download original PDF" title="Download original PDF"><IconDownload /></button>
        <button className={styles.btn} onClick={p.onReport} disabled={!ready} aria-label="Document details and compatibility" title="Document details and compatibility"><IconInfo /></button>
        {phone && (
          <button className={`${styles.btn} ${p.outlineOpen ? styles.on : ''}`} onClick={p.onToggleOutline} aria-pressed={p.outlineOpen}
            aria-label="Bookmarks"><IconOutline /></button>
        )}
        {!phone && (
          <button className={styles.btn} onClick={p.onClose} aria-label="Close document" title="Close document"><IconClose /></button>
        )}
      </div>
    </header>
  );
}
