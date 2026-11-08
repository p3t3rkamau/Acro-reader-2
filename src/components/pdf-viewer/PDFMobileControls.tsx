'use client';
import type { ViewerState } from '@/types/pdf';
import { IconBack } from '../ui/Icons';
import { PDFPageNavigation } from './PDFPageNavigation';
import { PDFZoomControls } from './PDFZoomControls';
import styles from './PDFMobileControls.module.scss';

interface Props {
  state: ViewerState;
  visible: boolean;
  onReveal: () => void;
  onGoToPage: (n: number) => void;
  onPrev: () => void;
  onNext: () => void;
  onBack: () => void;
  onZoomStep: (dir: 1 | -1) => void;
  onZoomSet: (v: string | number) => void;
}

/**
 * Phone controls in the thumb zone: Previous view (only when there is somewhere to go back
 * to), page navigation, zoom. While the user reads, the controls tuck away and only a small
 * page chip remains; tapping it brings them back.
 */
export function PDFMobileControls(p: Props) {
  const { state } = p;
  return (
    <>
      <div className={`${styles.dock} ${p.visible ? '' : styles.hidden}`} aria-hidden={!p.visible}>
        <div className={styles.side}>
          {state.canGoBack && (
            <button className={styles.round} onClick={p.onBack} aria-label="Previous view" title="Previous view"><IconBack /></button>
          )}
        </div>
        <PDFPageNavigation variant="pill" current={state.currentPage} total={state.numPages}
          onGo={p.onGoToPage} onPrev={p.onPrev} onNext={p.onNext} />
        <div className={`${styles.side} ${styles.end}`}>
          <PDFZoomControls variant="compact" scale={state.scale} scaleValue={state.scaleValue}
            disabled={state.status !== 'ready'} onStep={p.onZoomStep} onSet={p.onZoomSet} />
        </div>
      </div>
      {!p.visible && state.numPages > 0 && (
        <button className={styles.chip} onClick={p.onReveal} aria-label={`Page ${state.currentPage} of ${state.numPages}. Show controls.`}>
          {state.currentPage} / {state.numPages}
        </button>
      )}
    </>
  );
}
