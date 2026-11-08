'use client';
import { useEffect, useState } from 'react';
import type { PDFEngine } from '@/lib/pdf/PDFEngine';
import { FEATURES, NOT_DETECTABLE, scanDocument, type CompatReport, type Support } from '@/lib/pdf/pdfCompatibility';
import type { ViewerState } from '@/types/pdf';
import { IconClose } from '../ui/Icons';
import styles from './PDFReport.module.scss';

const SUPPORT_LABEL: Record<Support, string> = {
  supported: 'Supported',
  partial: 'Partly supported',
  unsupported: 'Not supported by PDF.js',
  'not-exported': 'Not stored in PDF',
};

const formatBytes = (n: number | null) =>
  n === null ? 'Unknown' : n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;

interface Props { engine: PDFEngine; state: ViewerState; onClose: () => void }

/**
 * Document details + compatibility report. Scans the real annotations of every page (nothing
 * is guessed) and labels each feature found with how this reader handles it, and whether
 * that has actually been tested.
 */
export function PDFReport({ engine, state, onClose }: Props) {
  const [report, setReport] = useState<CompatReport | null>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const pdf = engine.document;
    if (!pdf) return;
    const ctl = new AbortController();
    scanDocument(pdf, (done, total) => setProgress(done / total), ctl.signal)
      .then((r) => { if (!ctl.signal.aborted) setReport(r); })
      .catch(() => { /* document closed mid-scan */ });
    return () => ctl.abort();
  }, [engine]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const rows = report ? Object.entries(report.found).sort((a, b) => b[1] - a[1]) : [];
  const range = { yes: 'Yes', no: 'No (full download)', unknown: 'Unknown', 'n/a': 'Local file (read in chunks)' }[state.rangeSupport];

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <section className={styles.sheet} role="dialog" aria-modal="true" aria-labelledby="rep-title" onClick={(e) => e.stopPropagation()}>
        <header className={styles.head}>
          <h2 id="rep-title">Document details</h2>
          <button className={styles.close} onClick={onClose} aria-label="Close"><IconClose /></button>
        </header>

        <div className={styles.scroll}>
          <dl className={styles.facts}>
            <dt>Pages</dt><dd>{state.numPages.toLocaleString()}</dd>
            <dt>File size</dt><dd>{formatBytes(state.fileSize)}</dd>
            <dt>Created with</dt><dd>{report ? [report.creator, report.producer].filter(Boolean).join(' · ') || 'Unknown' : '…'}</dd>
            <dt>Bookmarks</dt><dd>{state.outline === null ? '…' : state.outline.length ? `${state.outline.length} top-level` : 'None'}</dd>
            <dt>Partial loading</dt><dd>{range}</dd>
          </dl>

          <h3>Interactive features in this document</h3>
          {!report && (
            <div role="status" className={styles.scan}>
              Scanning pages… {Math.round(progress * 100)}%
              <div className={styles.track}><div className={styles.fill} style={{ width: `${progress * 100}%` }} /></div>
            </div>
          )}
          {report && (
            <>
              <p className={styles.sum}>{report.totalAnnotations.toLocaleString()} interactive elements found on {report.pagesScanned} pages.</p>
              {rows.length === 0 && <p className={styles.sum}>No interactive elements.</p>}
              <ul className={styles.list}>
                {rows.map(([key, count]) => {
                  const f = FEATURES[key];
                  return (
                    <li key={key} className={styles.row}>
                      <div className={styles.rowTop}>
                        <strong>{f.label}</strong>
                        <span className={styles.count}>{count.toLocaleString()}</span>
                      </div>
                      <div className={styles.badges}>
                        <span className={`${styles.badge} ${styles[f.support === 'not-exported' ? 'notexp' : f.support]}`}>{SUPPORT_LABEL[f.support]}</span>
                        <span className={`${styles.badge} ${f.verified ? styles.tested : styles.untested}`}>{f.verified ? 'Tested' : 'Not yet tested'}</span>
                      </div>
                      <p>{f.note}</p>
                    </li>
                  );
                })}
                {Object.entries(report.unknownSubtypes).map(([name, count]) => (
                  <li key={name} className={styles.row}>
                    <div className={styles.rowTop}><strong>Unrecognised: {name}</strong><span className={styles.count}>{count}</span></div>
                    <div className={styles.badges}><span className={`${styles.badge} ${styles.unsupported}`}>Not handled</span></div>
                    <p>This element type is reported but not handled by the reader.</p>
                  </li>
                ))}
              </ul>
              {report.isXfa && <p className={styles.sum}>This is an XFA form. XFA is disabled; fields may not display.</p>}
              {report.attachments > 0 && <p className={styles.sum}>{report.attachments} embedded file attachment(s) detected; they cannot be opened here.</p>}
            </>
          )}

          <h3>Cannot be detected or shown</h3>
          <p className={styles.sum}>These exist in Acrobat or InDesign, but a PDF file either does not store them or PDF.js does not expose them.</p>
          <ul className={styles.list}>
            {NOT_DETECTABLE.map((f) => (
              <li key={f.label} className={styles.row}>
                <div className={styles.rowTop}><strong>{f.label}</strong></div>
                <div className={styles.badges}><span className={`${styles.badge} ${styles[f.support === 'not-exported' ? 'notexp' : f.support]}`}>{SUPPORT_LABEL[f.support]}</span></div>
                <p>{f.note}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
