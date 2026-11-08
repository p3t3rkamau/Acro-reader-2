'use client';
import { useRef, useState, type DragEvent, type FormEvent } from 'react';
import type { PDFSource } from '@/types/pdf';
import { parsePDFUrl, validatePDFFile } from '@/utils/fileValidation';
import { IconFile } from '../ui/Icons';
import styles from './OpenScreen.module.scss';

interface Props { onOpen: (source: PDFSource) => void; initialError?: string | null }

export function OpenScreen({ onOpen, initialError = null }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(initialError);
  const [url, setUrl] = useState('');
  const [dragging, setDragging] = useState(false);

  const openFile = async (file: File | undefined) => {
    if (!file) return;
    const check = await validatePDFFile(file);
    if (!check.ok) { setError(check.message ?? 'This file cannot be opened.'); return; }
    setError(null);
    onOpen({ kind: 'file', file });
  };

  const submitUrl = (e: FormEvent) => {
    e.preventDefault();
    const parsed = parsePDFUrl(url);
    if (!parsed) { setError('Enter a full web address starting with http:// or https://'); return; }
    setError(null);
    onOpen({ kind: 'url', url: parsed.href });
  };

  const onDrop = (e: DragEvent) => { e.preventDefault(); setDragging(false); void openFile(e.dataTransfer.files[0]); };

  return (
    <main className={`${styles.screen} ${dragging ? styles.dragging : ''}`}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={onDrop}>
      <div className={styles.card}>
        <h1>Open an interactive PDF</h1>
        <p className={styles.lead}>Buttons, links and bookmarks inside your PDF work here, on your phone, tablet or computer.</p>

        <input ref={inputRef} type="file" accept="application/pdf,.pdf" hidden aria-label="Choose a PDF file"
          onChange={(e) => { void openFile(e.target.files?.[0]); e.target.value = ''; }} />
        <button className={styles.primary} onClick={() => inputRef.current?.click()}>
          <IconFile /> Choose a PDF
        </button>
        <p className={styles.hint}>or drop a file anywhere on this page. Files stay on your device.</p>

        <form className={styles.urlForm} onSubmit={submitUrl}>
          <label htmlFor="pdf-url">Open from a web address</label>
          <div className={styles.urlRow}>
            <input id="pdf-url" type="url" inputMode="url" placeholder="https://example.com/manual.pdf" value={url}
              onChange={(e) => setUrl(e.target.value)} autoComplete="off" />
            <button type="submit" className={styles.secondary} disabled={!url.trim()}>Open</button>
          </div>
        </form>

        {error && <p className={styles.error} role="alert">{error}</p>}
      </div>
    </main>
  );
}
