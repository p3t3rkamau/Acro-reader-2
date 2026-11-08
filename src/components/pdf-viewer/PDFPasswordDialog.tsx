'use client';
import { useState } from 'react';
import styles from './Dialog.module.scss';

interface Props { wrong: boolean; onSubmit: (pw: string) => void; onCancel: () => void }

export function PDFPasswordDialog({ wrong, onSubmit, onCancel }: Props) {
  const [pw, setPw] = useState('');
  return (
    <div className={styles.backdrop} role="presentation">
      <div className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="pw-title">
        <h2 id="pw-title">This document is password protected</h2>
        <p>{wrong ? 'That password is not correct. Try again.' : 'Enter the password to open it.'}</p>
        <input className={styles.field} type="password" autoFocus autoComplete="off" value={pw} aria-label="Document password"
          aria-invalid={wrong} onChange={(e) => setPw(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && pw) onSubmit(pw); if (e.key === 'Escape') onCancel(); }} />
        <div className={styles.actions}>
          <button className={styles.secondary} onClick={onCancel}>Cancel</button>
          <button className={styles.primary} disabled={!pw} onClick={() => onSubmit(pw)}>Open</button>
        </div>
      </div>
    </div>
  );
}
