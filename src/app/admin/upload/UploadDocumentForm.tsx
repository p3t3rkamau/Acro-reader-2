'use client';

import { upload } from '@vercel/blob/client';
import { useRouter } from 'next/navigation';
import { useRef, useState, type FormEvent } from 'react';
import styles from '../admin.module.scss';

const aircraftOptions = [
  ['DASH_100', 'DASH 100'],
  ['DASH_200', 'DASH 200'],
  ['DASH_300', 'DASH 300'],
  ['DASH_400', 'DASH 400'],
] as const;

const categoryOptions = [
  ['afm', 'AFM - Aircraft Flight Manual'],
  ['qrh', 'QRH - Quick Reference Handbook'],
  ['aom', 'AOM - Aircraft Operating Manual'],
  ['checklists', 'Checklists'],
  ['maintenance', 'Maintenance'],
] as const;

export default function UploadDocumentForm() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setError('');
    setMessage('');
    setProgress(0);

    const form = new FormData(formElement);
    const file = fileRef.current?.files?.[0];
    if (!file || !file.name.toLowerCase().endsWith('.pdf')) {
      setError('Choose a valid PDF file.');
      return;
    }

    const metadata = {
      aircraftSeries: String(form.get('aircraftSeries') ?? ''),
      categorySlug: String(form.get('categorySlug') ?? ''),
      title: String(form.get('title') ?? '').trim(),
      revision: String(form.get('revision') ?? '').trim(),
      effectiveDate: String(form.get('effectiveDate') ?? ''),
      originalFileName: file.name,
    };

    setBusy(true);
    try {
      const blob = await upload('acroreader/' + file.name, file, {
        access: 'public',
        contentType: 'application/pdf',
        handleUploadUrl: '/api/admin/blob-upload',
        clientPayload: JSON.stringify(metadata),
        multipart: file.size > 100 * 1024 * 1024,
        onUploadProgress: ({ percentage }) => setProgress(Math.round(percentage)),
      });

      const response = await fetch('/api/admin/documents/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...metadata, pathname: blob.pathname, url: blob.url }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'The PDF uploaded, but its catalogue record could not be saved.');

      formElement.reset();
      if (fileRef.current) fileRef.current.value = '';
      setProgress(100);
      setMessage('PDF uploaded and added to the public catalogue.');
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The PDF upload failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className={styles.uploadForm} onSubmit={handleSubmit}>
      <div className={styles.formGrid}>
        <label>Aircraft series
          <select name="aircraftSeries" defaultValue="DASH_400" required>
            {aircraftOptions.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
          </select>
        </label>
        <label>Document category
          <select name="categorySlug" defaultValue="afm" required>
            {categoryOptions.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
          </select>
        </label>
        <label className={styles.fullWidth}>Document title
          <input name="title" placeholder="e.g. Dash 8 Q400 Aircraft Flight Manual" minLength={2} maxLength={180} required />
        </label>
        <label>Revision
          <input name="revision" placeholder="e.g. Rev 12" maxLength={40} required />
        </label>
        <label>Effective date
          <input name="effectiveDate" type="date" required />
        </label>
        <label className={styles.fullWidth}>PDF document
          <input ref={fileRef} name="file" type="file" accept="application/pdf,.pdf" required />
          <small>Large PDFs upload directly to Vercel Blob. Only PDF files are accepted.</small>
        </label>
      </div>
      {busy && <div className={styles.progress}><span style={{ width: progress + '%' }} /></div>}
      {busy && <p className={styles.status}>Uploading PDF... {progress}%</p>}
      {error && <p className={styles.error} role="alert">{error}</p>}
      {message && <p className={styles.success} role="status">{message}</p>}
      <button type="submit" disabled={busy}>{busy ? 'Uploading...' : 'Upload and publish document'}</button>
    </form>
  );
}
