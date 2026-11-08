'use client';
import { useCallback, useEffect, useState } from 'react';
import type { PDFSource } from '@/types/pdf';
import { parsePDFUrl } from '@/utils/fileValidation';
import { OpenScreen } from './OpenScreen';
import PDFViewer from './PDFViewer';

/** Top-level switch: open screen <-> reader. Supports /?url=https://... for direct links. */
export default function PDFApp() {
  const [source, setSource] = useState<PDFSource | null>(null);
  const [startupError, setStartupError] = useState<string | null>(null);

  useEffect(() => {
    const raw = new URLSearchParams(window.location.search).get('url');
    if (!raw) return;
    const parsed = parsePDFUrl(raw);
    if (parsed) setSource({ kind: 'url', url: parsed.href });
    else setStartupError('The link in the address bar is not a valid web address.');
  }, []);

  const close = useCallback(() => {
    setSource(null);
    if (window.location.search) window.history.replaceState(null, '', window.location.pathname);
  }, []);

  // A new object per opened document so re-opening the same file creates a fresh engine.
  return source
    ? <PDFViewer key={source.kind === 'file' ? `${source.file.name}-${source.file.lastModified}-${source.file.size}` : source.url} source={source} onClose={close} />
    : <OpenScreen onOpen={setSource} initialError={startupError} />;
}
