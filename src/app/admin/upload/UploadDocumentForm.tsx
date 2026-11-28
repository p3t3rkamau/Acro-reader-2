'use client';

import { upload } from '@vercel/blob/client';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import styles from '../admin.module.scss';

type VariantOption = { id: string; name: string };
type ModelOption = { id: string; name: string; variants: VariantOption[] };
type ManufacturerOption = { id: string; name: string; models: ModelOption[] };
type CategoryOption = { id: string; title: string; parentId: string | null; sortOrder: number };
type CatalogueOptions = {
  manufacturers: ManufacturerOption[];
  categories: CategoryOption[];
};
type FolderOption = { id: string; label: string };

function getDescendantFolders(
  categories: CategoryOption[],
  parentId: string,
  prefix = '',
  visited = new Set<string>(),
): FolderOption[] {
  if (visited.has(parentId)) return [];
  const nextVisited = new Set(visited);
  nextVisited.add(parentId);

  return categories
    .filter((category) => category.parentId === parentId)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title))
    .flatMap((category) => {
      const label = prefix ? `${prefix} / ${category.title}` : category.title;
      return [
        { id: category.id, label },
        ...getDescendantFolders(categories, category.id, label, nextVisited),
      ];
    });
}

export default function UploadDocumentForm() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [options, setOptions] = useState<CatalogueOptions | null>(null);
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [optionsError, setOptionsError] = useState('');
  const [manufacturerId, setManufacturerId] = useState('');
  const [modelId, setModelId] = useState('');
  const [variantIds, setVariantIds] = useState<string[]>([]);
  const [departmentId, setDepartmentId] = useState('');
  const [folderId, setFolderId] = useState('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    fetch('/api/admin/catalogue-options')
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? 'Could not load catalogue options.');
        return result as CatalogueOptions;
      })
      .then((result) => {
        if (!active) return;
        setOptions(result);
        setManufacturerId(result.manufacturers[0]?.id ?? '');
        setModelId(result.manufacturers[0]?.models[0]?.id ?? '');
        setDepartmentId(result.categories.find((category) => category.parentId === null)?.id ?? '');
      })
      .catch((cause) => {
        if (active) setOptionsError(cause instanceof Error ? cause.message : 'Could not load catalogue options.');
      })
      .finally(() => {
        if (active) setOptionsLoading(false);
      });

    return () => { active = false; };
  }, []);

  const selectedManufacturer = options?.manufacturers.find((item) => item.id === manufacturerId);
  const models = selectedManufacturer?.models ?? [];
  const selectedModel = models.find((item) => item.id === modelId);
  const variants = selectedModel?.variants ?? [];

  const departments = useMemo(
    () => (options?.categories ?? []).filter((category) => category.parentId === null),
    [options],
  );

  const folderOptions = useMemo(
    () => options && departmentId
      ? getDescendantFolders(options.categories, departmentId)
      : [],
    [options, departmentId],
  );

  function handleManufacturerChange(nextId: string) {
    const nextManufacturer = options?.manufacturers.find((item) => item.id === nextId);
    setManufacturerId(nextId);
    setModelId(nextManufacturer?.models[0]?.id ?? '');
    setVariantIds([]);
  }

  function handleModelChange(nextId: string) {
    setModelId(nextId);
    setVariantIds([]);
  }

  function toggleVariant(id: string, checked: boolean) {
    setVariantIds((current) => checked
      ? [...current, id]
      : current.filter((item) => item !== id));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setError('');
    setMessage('');
    setProgress(0);

    const form = new FormData(formElement);
    const file = fileRef.current?.files?.[0];

    if (!variantIds.length) {
      setError('Select at least one aircraft variant.');
      return;
    }

    if (!departmentId) {
      setError('Create or select a document department first.');
      return;
    }

    if (!file || !file.name.toLowerCase().endsWith('.pdf')) {
      setError('Choose a valid PDF file.');
      return;
    }

    const metadata = {
      variantIds,
      categoryId: folderId || departmentId,
      title: String(form.get('title') ?? '').trim(),
      referenceNumber: String(form.get('referenceNumber') ?? '').trim(),
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
      if (!response.ok) {
        throw new Error(result.error ?? 'The PDF uploaded, but its catalogue record could not be saved.');
      }

      formElement.reset();
      if (fileRef.current) fileRef.current.value = '';
      setVariantIds([]);
      setFolderId('');
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
      {optionsLoading && <p className={styles.status}>Loading aircraft and document folders…</p>}
      {optionsError && <p className={styles.error} role="alert">{optionsError}</p>}

      <div className={styles.formGrid}>
        <label>Manufacturer
          <select value={manufacturerId} onChange={(event) => handleManufacturerChange(event.target.value)} required disabled={!options || busy}>
            <option value="">Select manufacturer</option>
            {options?.manufacturers.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}
          </select>
        </label>

        <label>Aircraft model
          <select value={modelId} onChange={(event) => handleModelChange(event.target.value)} required disabled={!models.length || busy}>
            <option value="">Select model</option>
            {models.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}
          </select>
        </label>

        <fieldset className={styles.fullWidth}>
          <legend>Aircraft variant(s)</legend>
          {variants.length ? (
            <div className={styles.formGrid}>
              {variants.map((variant) => (
                <label key={variant.id}>
                  <input
                    type="checkbox"
                    name="variantIds"
                    value={variant.id}
                    checked={variantIds.includes(variant.id)}
                    onChange={(event) => toggleVariant(variant.id, event.target.checked)}
                    disabled={busy}
                  />
                  {variant.name}
                </label>
              ))}
            </div>
          ) : <small>No active variants exist for this model yet. Add one in catalogue management.</small>}
        </fieldset>

        <label>Department
          <select
            value={departmentId}
            onChange={(event) => { setDepartmentId(event.target.value); setFolderId(''); }}
            required
            disabled={!departments.length || busy}
          >
            <option value="">Select department</option>
            {departments.map((item) => <option value={item.id} key={item.id}>{item.title}</option>)}
          </select>
        </label>

        <label>Folder
          <select value={folderId} onChange={(event) => setFolderId(event.target.value)} disabled={!departmentId || busy}>
            <option value="">Use department root</option>
            {folderOptions.map((item) => <option value={item.id} key={item.id}>{item.label}</option>)}
          </select>
        </label>

        <label className={styles.fullWidth}>Document title
          <input name="title" placeholder="e.g. Dash 8 Q400 Aircraft Flight Manual" minLength={2} maxLength={180} required />
        </label>

        <label>Publication / reference number
          <input name="referenceNumber" placeholder="e.g. PSM 1-84-1" maxLength={120} />
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

      <button type="submit" disabled={busy || optionsLoading || !options || !!optionsError}>
        {busy ? 'Uploading...' : 'Upload and publish document'}
      </button>
    </form>
  );
}
