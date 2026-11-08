'use client';
import { useEffect, useRef, useState } from 'react';
import { parsePageInput } from '@/lib/pdf/pdfNavigation';
import { IconChevronDown, IconChevronUp } from '../ui/Icons';
import styles from './PDFPageNavigation.module.scss';

interface Props {
  current: number;
  total: number;
  variant: 'bar' | 'pill';
  onGo: (page: number) => void;
  onPrev: () => void;
  onNext: () => void;
}

/** "12 / 850": tap the number to type a page, Enter to go. Invalid pages are rejected. */
export function PDFPageNavigation({ current, total, variant, onGo, onPrev, onNext }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [invalid, setInvalid] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (editing) inputRef.current?.select(); }, [editing]);

  const commit = () => {
    const page = parsePageInput(draft, total);
    if (page === null) { setInvalid(true); return; }
    setEditing(false); setInvalid(false);
    onGo(page);
  };
  const cancel = () => { setEditing(false); setInvalid(false); };

  return (
    <div className={`${styles.nav} ${variant === 'pill' ? styles.pill : ''}`} role="group" aria-label="Page navigation">
      <button className={styles.step} onClick={onPrev} disabled={current <= 1} aria-label="Previous page" title="Previous page (Page Up)">
        <IconChevronUp />
      </button>

      {editing ? (
        <span className={styles.edit}>
          <input
            ref={inputRef}
            className={styles.input}
            value={draft}
            inputMode="numeric"
            pattern="[0-9]*"
            autoFocus
            aria-label={`Go to page, 1 to ${total}`}
            aria-invalid={invalid}
            onChange={(e) => { setDraft(e.target.value); setInvalid(false); }}
            onKeyDown={(e) => { if (e.key === 'Enter') commit(); else if (e.key === 'Escape') { e.stopPropagation(); cancel(); } }}
            onBlur={cancel}
          />
          <span className={styles.total}>/ {total}</span>
          {invalid && <span className={styles.hint} role="alert">Enter 1–{total}</span>}
        </span>
      ) : (
        <button
          className={styles.page}
          disabled={total === 0}
          onClick={() => { setDraft(String(current)); setEditing(true); }}
          aria-label={`Page ${current} of ${total}. Activate to enter a page number.`}
          title="Go to page"
        >
          <span className={styles.current}>{current}</span>
          <span className={styles.total}>/ {total || '–'}</span>
        </button>
      )}

      <button className={styles.step} onClick={onNext} disabled={current >= total} aria-label="Next page" title="Next page (Page Down)">
        <IconChevronDown />
      </button>
    </div>
  );
}
