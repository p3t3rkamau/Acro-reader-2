import type { LoadError } from '@/types/pdf';
import styles from './Dialog.module.scss';

export function PDFError({ error, onClose }: { error: LoadError; onClose: () => void }) {
  return (
    <div className={styles.loading} role="alert">
      <h2 className={styles.errorTitle}>{error.title}</h2>
      <p className={styles.errorDetail}>{error.detail}</p>
      <div className={styles.actions}>
        <button className={styles.primary} onClick={onClose}>Choose another document</button>
      </div>
    </div>
  );
}
