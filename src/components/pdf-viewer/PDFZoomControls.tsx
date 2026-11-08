'use client';
import { useCallback, useRef, useState } from 'react';
import { useDismiss } from '@/hooks/useDismiss';
import { IconCheck, IconMinus, IconPlus } from '../ui/Icons';
import styles from './PDFZoomControls.module.scss';

interface Props {
  scale: number;
  scaleValue: string;
  /** "inline" shows − / % / + in a row. "compact" shows one % button; −/+ live in the menu. */
  variant: 'inline' | 'compact';
  disabled?: boolean;
  onStep: (dir: 1 | -1) => void;
  onSet: (value: string | number) => void;
}

const PRESETS: { label: string; value: string | number }[] = [
  { label: 'Fit width', value: 'page-width' },
  { label: 'Fit page', value: 'page-fit' },
  { label: 'Actual size (100%)', value: 1 },
  { label: '150%', value: 1.5 },
  { label: '200%', value: 2 },
  { label: '300%', value: 3 },
];

export function PDFZoomControls({ scale, scaleValue, variant, disabled, onStep, onSet }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(ref, open, close);
  const percent = `${Math.round(scale * 100)}%`;

  const isActive = (v: string | number) =>
    typeof v === 'string' ? scaleValue === v : scaleValue === 'page-width' || scaleValue === 'page-fit' ? false : Math.abs(scale - v) < 0.005;

  return (
    <div className={`${styles.zoom} ${variant === 'compact' ? styles.compact : ''}`} ref={ref}>
      {variant === 'inline' && (
        <button className={styles.btn} onClick={() => onStep(-1)} disabled={disabled} aria-label="Zoom out" title="Zoom out (Ctrl −)"><IconMinus /></button>
      )}
      <button
        className={styles.value}
        onClick={() => setOpen((o) => !o)}
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Zoom ${percent}. Open zoom options.`}
        title="Zoom options"
      >
        {percent}
      </button>
      {variant === 'inline' && (
        <button className={styles.btn} onClick={() => onStep(1)} disabled={disabled} aria-label="Zoom in" title="Zoom in (Ctrl +)"><IconPlus /></button>
      )}

      {open && (
        <div className={styles.menu} role="menu" aria-label="Zoom options">
          {variant === 'compact' && (
            <div className={styles.stepper}>
              <button className={styles.btn} onClick={() => onStep(-1)} aria-label="Zoom out"><IconMinus /></button>
              <span className={styles.readout} aria-live="polite">{percent}</span>
              <button className={styles.btn} onClick={() => onStep(1)} aria-label="Zoom in"><IconPlus /></button>
            </div>
          )}
          {PRESETS.map((p) => (
            <button key={p.label} role="menuitemradio" aria-checked={isActive(p.value)} className={styles.item}
              onClick={() => { onSet(p.value); setOpen(false); }}>
              <span className={styles.check}>{isActive(p.value) && <IconCheck />}</span>
              {p.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
