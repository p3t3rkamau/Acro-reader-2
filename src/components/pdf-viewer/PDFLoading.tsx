import styles from './Dialog.module.scss';

interface Props { name: string; numPages: number; progress: number | null }

/** Shown over the page area while the file opens. The app shell is already visible. */
export function PDFLoading({ name, numPages, progress }: Props) {
  const pct = progress === null ? null : Math.round(progress * 100);
  return (
    <div className={styles.loading} role="status" aria-live="polite">
      <div className={styles.spinner} aria-hidden />
      <p className={styles.loadingTitle}>Opening {name}</p>
      <p className={styles.loadingMeta}>
        {numPages > 0 ? `${numPages.toLocaleString()} pages · preparing the first page` : 'Reading the document…'}
      </p>
      <div className={styles.track} aria-hidden>
        <div className={`${styles.fill} ${pct === null ? styles.indeterminate : ''}`} style={pct === null ? undefined : { width: `${pct}%` }} />
      </div>
    </div>
  );
}
