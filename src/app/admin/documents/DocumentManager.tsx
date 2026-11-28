'use client';

import { useEffect, useMemo, useState } from 'react';
import styles from '../admin.module.scss';

type Revision = {
  id: string;
  revision: string;
  effectiveDate: string;
  status: 'DRAFT' | 'PUBLISHED' | 'SUPERSEDED' | 'WITHDRAWN';
  originalFileName: string | null;
  sizeBytes: string | null;
  createdAt: string;
  publishedAt: string | null;
  changeSummary: string | null;
  storageVisibility: 'PUBLIC' | 'PRIVATE';
};
type DocumentRecord = {
  id: string;
  title: string;
  referenceNumber: string | null;
  description: string | null;
  categoryId: string;
  category: { id: string; title: string };
  variants: Array<{ variant: { id: string; name: string; model: { name: string; manufacturer: { name: string } } } }>;
  revisions: Revision[];
};

function formatBytes(value: string | null) {
  if (!value) return '—';
  const bytes = Number(value);
  if (!Number.isFinite(bytes)) return '—';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function statusLabel(status: Revision['status']) {
  return status === 'PUBLISHED' ? 'Published' : status === 'DRAFT' ? 'Draft' : status === 'SUPERSEDED' ? 'Previous revision' : 'Withdrawn';
}

export default function DocumentManager() {
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [query, setQuery] = useState('');
  const [expandedId, setExpandedId] = useState('');
  const [editingId, setEditingId] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function load() {
    const response = await fetch('/api/admin/documents', { cache: 'no-store' });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error ?? 'Could not load documents.');
    setDocuments(result.documents as DocumentRecord[]);
  }

  useEffect(() => {
    let active = true;
    fetch('/api/admin/documents', { cache: 'no-store' })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? 'Could not load documents.');
        return result.documents as DocumentRecord[];
      })
      .then((result) => { if (active) setDocuments(result); })
      .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : 'Could not load documents.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return documents;
    return documents.filter((document) =>
      [document.title, document.referenceNumber ?? '', document.category.title,
        ...document.variants.map((item) => `${item.variant.model.manufacturer.name} ${item.variant.model.name} ${item.variant.name}`)]
        .join(' ').toLowerCase().includes(term),
    );
  }, [documents, query]);

  async function publish(revisionId: string) {
    if (!window.confirm('Publish this draft? The current published revision will become historical, and viewers will receive this revision as the current document.')) return;
    setBusyId(revisionId);
    setError('');
    setMessage('');
    try {
      const response = await fetch('/api/admin/documents', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'publish-revision', revisionId }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'Could not publish this revision.');
      await load();
      setMessage('Draft published. The previous published revision has been preserved in history.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not publish this revision.');
    } finally {
      setBusyId('');
    }
  }

  async function save(event: React.FormEvent<HTMLFormElement>, document: DocumentRecord) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const variantIds = form.getAll('variantIds').map(String);
    setBusyId(document.id);
    setError('');
    setMessage('');
    try {
      const response = await fetch('/api/admin/documents', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update-document',
          documentId: document.id,
          title: form.get('title'),
          referenceNumber: form.get('referenceNumber'),
          description: form.get('description'),
          categoryId: form.get('categoryId'),
          variantIds,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'Could not save document details.');
      await load();
      setEditingId('');
      setMessage('Document details updated.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save document details.');
    } finally {
      setBusyId('');
    }
  }

  if (loading) return <p className={styles.status}>Loading uploaded documents…</p>;

  return (
    <div className={styles.uploadForm}>
      <div className={styles.formGrid}>
        <label className={styles.fullWidth}>Search documents
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search title, reference, folder or aircraft…" />
        </label>
      </div>
      {error && <p className={styles.error} role="alert">{error}</p>}
      {message && <p className={styles.success} role="status">{message}</p>}
      <p className={styles.status}>{filtered.length} document record(s) · Drafts are visible here, not in the public catalogue.</p>

      {filtered.map((document) => {
        const current = document.revisions.find((revision) => revision.status === 'PUBLISHED');
        const drafts = document.revisions.filter((revision) => revision.status === 'DRAFT');
        const expanded = expandedId === document.id;
        const editing = editingId === document.id;
        return (
          <section className={styles.card} key={document.id}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 18, flexWrap: 'wrap' }}>
              <div>
                <h3>{document.title}</h3>
                <p>{document.referenceNumber || 'No reference number'} · {document.category.title}</p>
                <small>{document.variants.map((item) => `${item.variant.model.manufacturer.name} / ${item.variant.model.name} / ${item.variant.name}`).join(' · ')}</small>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span className={styles.adminBadge}>{current ? `LIVE · ${current.revision}` : 'NO PUBLISHED REVISION'}</span>
                <button type="button" className={styles.secondaryButton} onClick={() => setExpandedId(expanded ? '' : document.id)}>
                  {expanded ? 'Hide revisions' : `View revisions (${document.revisions.length})`}
                </button>
                <button type="button" onClick={() => setEditingId(editing ? '' : document.id)} className={styles.secondaryButton}>
                  {editing ? 'Close editor' : 'Edit details'}
                </button>
              </div>
            </div>

            {editing && (
              <form className={styles.formGrid} onSubmit={(event) => save(event, document)} style={{ marginTop: 20 }}>
                <label>Document title<input name="title" defaultValue={document.title} required maxLength={180} /></label>
                <label>Reference number<input name="referenceNumber" defaultValue={document.referenceNumber ?? ''} maxLength={120} /></label>
                <label className={styles.fullWidth}>Description<textarea name="description" defaultValue={document.description ?? ''} rows={3} /></label>
                <label>Folder / department
                  <select name="categoryId" defaultValue={document.categoryId} required>
                    <option value={document.categoryId}>{document.category.title}</option>
                  </select>
                </label>
                <div className={styles.fullWidth}>
                  <strong>Aircraft applicability</strong>
                  <p>{document.variants.map((item) => item.variant.name).join(', ')}</p>
                  <small>To change aircraft applicability, use catalogue management. This editor preserves existing variant links.</small>
                  {document.variants.map((item) => <input key={item.variant.id} type="hidden" name="variantIds" value={item.variant.id} />)}
                </div>
                <button type="submit" disabled={busyId === document.id}>Save document details</button>
              </form>
            )}

            {expanded && (
              <div style={{ marginTop: 22, borderTop: '1px solid #e7edf1', paddingTop: 16 }}>
                <h4>Revision history</h4>
                {document.revisions.map((revision) => (
                  <div key={revision.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '13px 0', borderBottom: '1px solid #edf1f4' }}>
                    <div>
                      <strong>{revision.revision}</strong> <span className={styles.adminBadge}>{statusLabel(revision.status)}</span>
                      <p>{revision.originalFileName || 'PDF'} · Effective {new Date(revision.effectiveDate).toLocaleDateString()} · {formatBytes(revision.sizeBytes)}</p>
                      <small>Uploaded {new Date(revision.createdAt).toLocaleString()} · {revision.storageVisibility.toLowerCase()} storage</small>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {revision.status !== 'DRAFT' && (
                        <a className={styles.secondaryButton} href={`/api/documents/${document.id}/file?revision=${revision.id}`} target="_blank" rel="noreferrer">Open PDF</a>
                      )}
                      {revision.status === 'DRAFT' && (
                        <>
                          <a className={styles.secondaryButton} href={`/api/documents/${document.id}/file?revision=${revision.id}`} target="_blank" rel="noreferrer">Preview draft</a>
                          <button type="button" disabled={!!busyId} onClick={() => publish(revision.id)}>Publish draft</button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
                {!document.revisions.length && <p>No revisions have been uploaded.</p>}
              </div>
            )}
          </section>
        );
      })}
      {!filtered.length && <div className={styles.card}><h3>No documents found</h3><p>Try a different search, or upload a document to begin.</p></div>}
    </div>
  );
}
