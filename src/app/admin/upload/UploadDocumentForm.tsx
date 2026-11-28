'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import styles from '../admin.module.scss';

type VariantOption = { id: string; name: string };
type ModelOption = { id: string; name: string; variants: VariantOption[] };
type ManufacturerOption = { id: string; name: string; models: ModelOption[] };
type CategoryOption = { id: string; title: string; parentId: string | null; sortOrder: number };
type CatalogueOptions = { manufacturers: ManufacturerOption[]; categories: CategoryOption[] };
type FolderOption = { id: string; label: string };
type PublicationStatus = 'DRAFT' | 'PUBLISHED';
type UploadMetadata = {
  variantIds: string[];
  categoryId: string;
  title: string;
  referenceNumber: string;
  revision: string;
  effectiveDate: string;
  publicationStatus: PublicationStatus;
  originalFileName: string;
};
type PendingRegistration = { pathname: string; metadata: UploadMetadata };
type UploadPhase = 'idle' | 'preparing' | 'uploading' | 'verifying' | 'registering';

function uploadToPrivateBlob(
  presignedUrl: string,
  file: File,
  onProgress: (percentage: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', presignedUrl);
    xhr.timeout = 15 * 60 * 1000;
    xhr.setRequestHeader('Content-Type', 'application/pdf');

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) {
        onProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(100);
        resolve();
      } else {
        reject(new Error('Private Blob rejected the PDF upload. Check the store and upload URL configuration.'));
      }
    };
    xhr.onerror = () => reject(new Error('The connection to private Blob storage failed.'));
    xhr.ontimeout = () => reject(new Error('The upload timed out. Check the storage object before trying again.'));
    xhr.onabort = () => reject(new Error('The PDF upload was cancelled.'));
    xhr.send(file);
  });
}

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
      return [{ id: category.id, label }, ...getDescendantFolders(categories, category.id, label, nextVisited)];
    });
}

async function readJson(response: Response) {
  try { return await response.json(); }
  catch { throw new Error(`The server returned an unreadable response (HTTP ${response.status}).`); }
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
  const [phase, setPhase] = useState<UploadPhase>('idle');
  const [pendingRegistration, setPendingRegistration] = useState<PendingRegistration | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    fetch('/api/admin/catalogue-options')
      .then(async (response) => {
        const result = await readJson(response);
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
      .finally(() => { if (active) setOptionsLoading(false); });
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
    () => options && departmentId ? getDescendantFolders(options.categories, departmentId) : [],
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
    setVariantIds((current) => checked ? [...current, id] : current.filter((item) => item !== id));
  }

  async function registerUploadedFile(pending: PendingRegistration) {
    setPhase('registering');
    setError('');
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 90_000);
    try {
      const response = await fetch('/api/admin/documents/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...pending.metadata, pathname: pending.pathname }),
        signal: controller.signal,
      });
      const result = await readJson(response);
      if (!response.ok) throw new Error(result.error ?? 'The PDF uploaded, but its catalogue record could not be saved.');
      setPendingRegistration(null);
      setMessage(
        pending.metadata.publicationStatus === 'DRAFT'
          ? 'PDF saved as a draft. It is stored privately and is not visible in the public catalogue.'
          : 'PDF published successfully and added to the public catalogue.',
      );
      setPhase('idle');
      setProgress(100);
      router.refresh();
      return true;
    } catch (cause) {
      const timedOut = cause instanceof DOMException && cause.name === 'AbortError';
      setError(timedOut
        ? 'The PDF is safely uploaded to private storage, but catalogue registration timed out. Retry registration below — the PDF will not upload again.'
        : cause instanceof Error
          ? cause.message
          : 'The PDF is uploaded, but catalogue registration failed. Retry registration; the file will not upload again.');
      setPhase('idle');
      return false;
    } finally {
      window.clearTimeout(timeout);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setMessage('');
    setProgress(0);

    // If a previous registration failed or timed out, retry the same pathname.
    // The server registration is idempotent, so this cannot create a duplicate revision.
    if (pendingRegistration) {
      setBusy(true);
      await registerUploadedFile(pendingRegistration);
      setBusy(false);
      return;
    }

    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const publicationStatus: PublicationStatus = submitter?.value === 'DRAFT' ? 'DRAFT' : 'PUBLISHED';
    const file = fileRef.current?.files?.[0];

    if (!variantIds.length) return setError('Select at least one aircraft variant.');
    if (!departmentId) return setError('Create or select a document department first.');
    if (!file || !file.name.toLowerCase().endsWith('.pdf')) return setError('Choose a valid PDF file.');

    const metadata: UploadMetadata = {
      variantIds,
      categoryId: folderId || departmentId,
      title: String(form.get('title') ?? '').trim(),
      referenceNumber: String(form.get('referenceNumber') ?? '').trim(),
      revision: String(form.get('revision') ?? '').trim(),
      effectiveDate: String(form.get('effectiveDate') ?? ''),
      publicationStatus,
      originalFileName: file.name,
    };

    setBusy(true);
    setPhase('preparing');
    try {
      const uploadPlanResponse = await fetch('/api/admin/blob-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ metadata, fileSize: file.size }),
      });
      const uploadPlan = await readJson(uploadPlanResponse);
      if (!uploadPlanResponse.ok) throw new Error(uploadPlan.error ?? 'Could not prepare the private PDF upload.');

      setPhase('uploading');
      await uploadToPrivateBlob(uploadPlan.presignedUrl, file, setProgress);

      const pending = { pathname: uploadPlan.pathname as string, metadata };
      setPendingRegistration(pending);
      setPhase('verifying');
      await registerUploadedFile(pending);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The PDF upload failed.');
      setPhase('idle');
    } finally {
      setBusy(false);
    }
  }

  const isLocked = busy || !!pendingRegistration;
  const phaseLabel: Record<UploadPhase, string> = {
    idle: '',
    preparing: 'Preparing secure upload…',
    uploading: `Uploading PDF to private storage… ${progress}%`,
    verifying: 'Upload complete. Verifying the private PDF…',
    registering: 'Saving document details and revision in the catalogue…',
  };

  return (
    <form className={styles.uploadForm} onSubmit={handleSubmit}>
      {optionsLoading && <p className={styles.status}>Loading aircraft and document folders…</p>}
      {optionsError && <p className={styles.error} role="alert">{optionsError}</p>}

      <div className={styles.formGrid}>
        <label>Manufacturer
          <select value={manufacturerId} onChange={(event) => handleManufacturerChange(event.target.value)} required disabled={!options || isLocked}>
            <option value="">Select manufacturer</option>
            {options?.manufacturers.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}
          </select>
        </label>
        <label>Aircraft model
          <select value={modelId} onChange={(event) => handleModelChange(event.target.value)} required disabled={!models.length || isLocked}>
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
                  <input type="checkbox" name="variantIds" value={variant.id} checked={variantIds.includes(variant.id)}
                    onChange={(event) => toggleVariant(variant.id, event.target.checked)} disabled={isLocked} />
                  {variant.name}
                </label>
              ))}
            </div>
          ) : <small>No active variants exist for this model yet. Add one in catalogue management.</small>}
        </fieldset>

        <label>Department
          <select value={departmentId} onChange={(event) => { setDepartmentId(event.target.value); setFolderId(''); }}
            required disabled={!departments.length || isLocked}>
            <option value="">Select department</option>
            {departments.map((item) => <option value={item.id} key={item.id}>{item.title}</option>)}
          </select>
        </label>
        <label>Folder
          <select value={folderId} onChange={(event) => setFolderId(event.target.value)} disabled={!departmentId || isLocked}>
            <option value="">Use department root</option>
            {folderOptions.map((item) => <option value={item.id} key={item.id}>{item.label}</option>)}
          </select>
        </label>

        <label className={styles.fullWidth}>Document title
          <input name="title" placeholder="e.g. Dash 8 Q400 Quick Reference Handbook" minLength={2} maxLength={180} required disabled={isLocked} />
        </label>
        <label>Publication / reference number
          <input name="referenceNumber" placeholder="e.g. PSM 1-84-1" maxLength={120} disabled={isLocked} />
        </label>
        <label>Revision
          <input name="revision" placeholder="e.g. Rev 12" maxLength={40} required disabled={isLocked} />
        </label>
        <label>Effective date
          <input name="effectiveDate" type="date" required disabled={isLocked} />
        </label>
        <label className={styles.fullWidth}>PDF document
          <input ref={fileRef} name="file" type="file" accept="application/pdf,.pdf" required disabled={isLocked} />
          <small>PDFs upload directly to private Vercel Blob storage. Maximum file size: 5 GB.</small>
        </label>
      </div>

      {busy && <div className={styles.progress}><span style={{ width: (phase === 'uploading' ? progress : phase === 'preparing' ? 3 : 100) + '%' }} /></div>}
      {busy && <p className={styles.status} role="status">{phaseLabel[phase]}</p>}
      {pendingRegistration && !busy && (
        <div className={styles.warning} role="status">
          The PDF is already uploaded privately, but its catalogue record is not confirmed yet. Retry registration below. The file will not be uploaded again.
        </div>
      )}
      {error && <p className={styles.error} role="alert">{error}</p>}
      {message && <p className={styles.success} role="status">{message}</p>}

      {pendingRegistration ? (
        <button type="submit" disabled={busy}>Retry catalogue registration</button>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          <button type="submit" name="publicationStatus" value="DRAFT" disabled={busy || optionsLoading || !options || !!optionsError}>
            {busy ? 'Please wait…' : 'Save as draft'}
          </button>
          <button type="submit" name="publicationStatus" value="PUBLISHED" disabled={busy || optionsLoading || !options || !!optionsError}>
            {busy ? 'Please wait…' : 'Publish document'}
          </button>
        </div>
      )}
    </form>
  );
}
