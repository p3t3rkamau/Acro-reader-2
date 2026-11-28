'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import styles from '../admin.module.scss';

type Variant = { id: string; name: string; slug: string; sortOrder: number; isActive: boolean };
type Model = { id: string; name: string; slug: string; sortOrder: number; isActive: boolean; variants: Variant[] };
type Manufacturer = { id: string; name: string; slug: string; sortOrder: number; isActive: boolean; models: Model[] };
type Category = { id: string; title: string; slug: string; parentId: string | null; description: string | null; sortOrder: number; isActive: boolean };
type Data = { manufacturers: Manufacturer[]; categories: Category[] };
type EntityType = 'manufacturer' | 'model' | 'variant' | 'category';

function EditorRow({
  type,
  item,
  onSave,
  onToggle,
}: {
  type: EntityType;
  item: { id: string; name?: string; title?: string; sortOrder: number; isActive: boolean };
  onSave: (type: EntityType, id: string, values: { name?: string; title?: string; sortOrder?: number }) => Promise<void>;
  onToggle: (type: EntityType, id: string, active: boolean) => Promise<void>;
}) {
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const sortOrder = Number(form.get('sortOrder') ?? 0);
    if (type === 'category') {
      await onSave(type, item.id, { title: String(form.get('title') ?? '').trim(), sortOrder });
    } else {
      await onSave(type, item.id, { name: String(form.get('name') ?? '').trim(), sortOrder });
    }
  }

  return (
    <form className={styles.formGrid} onSubmit={submit}>
      <label>
        {type === 'category' ? 'Folder / department name' : 'Name'}
        <input name={type === 'category' ? 'title' : 'name'} defaultValue={type === 'category' ? item.title : item.name} required />
      </label>
      <label>
        Sort order
        <input name="sortOrder" type="number" min="0" max="10000" defaultValue={item.sortOrder} required />
      </label>
      <div className={styles.fullWidth} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <button type="submit">Save changes</button>
        <button
          type="button"
          className={item.isActive ? styles.dangerButton : styles.secondaryButton}
          onClick={() => {
            if (!item.isActive || window.confirm(`Deactivate this ${type}? It will be hidden from new selections, but existing documents and history will be preserved.`)) {
              void onToggle(type, item.id, !item.isActive);
            }
          }}
        >
          {item.isActive ? 'Deactivate' : 'Reactivate'}
        </button>
        <small>{item.isActive ? 'Active' : 'Inactive'}</small>
      </div>
    </form>
  );
}

export default function CatalogueManager() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function load() {
    const response = await fetch('/api/admin/catalogue');
    const result = await response.json();
    if (!response.ok) throw new Error(result.error ?? 'Could not load catalogue data.');
    setData(result as Data);
  }

  useEffect(() => {
    let active = true;
    fetch('/api/admin/catalogue')
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? 'Could not load catalogue data.');
        return result as Data;
      })
      .then((result) => { if (active) setData(result); })
      .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : 'Could not load catalogue data.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const allModels = useMemo(
    () => data?.manufacturers.flatMap((manufacturer) => manufacturer.models.map((model) => ({
      ...model,
      manufacturerName: manufacturer.name,
      manufacturerId: manufacturer.id,
    }))) ?? [],
    [data],
  );

  const categoryDepth = useMemo(() => {
    const byId = new Map((data?.categories ?? []).map((category) => [category.id, category]));
    return (category: Category) => {
      let depth = 0;
      let parentId = category.parentId;
      const seen = new Set<string>([category.id]);
      while (parentId && byId.has(parentId) && !seen.has(parentId)) {
        seen.add(parentId);
        depth += 1;
        parentId = byId.get(parentId)?.parentId ?? null;
      }
      return depth;
    };
  }, [data]);

  async function request(url: string, method: 'POST' | 'PATCH' | 'DELETE', body: unknown): Promise<boolean> {
    setBusy(true);
    setMessage('');
    setError('');
    try {
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'The catalogue update failed.');
      await load();
      setMessage('Catalogue updated successfully.');
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The catalogue update failed.');
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function create(event: FormEvent<HTMLFormElement>, type: EntityType) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    let body: Record<string, unknown>;

    if (type === 'manufacturer') {
      body = { type, name: form.get('name'), sortOrder: Number(form.get('sortOrder') ?? 0) };
    } else if (type === 'model') {
      body = { type, manufacturerId: form.get('manufacturerId'), name: form.get('name'), sortOrder: Number(form.get('sortOrder') ?? 0) };
    } else if (type === 'variant') {
      body = { type, modelId: form.get('modelId'), name: form.get('name'), sortOrder: Number(form.get('sortOrder') ?? 0) };
    } else {
      body = {
        type,
        parentId: form.get('parentId') ? String(form.get('parentId')) : null,
        title: form.get('title'),
        description: form.get('description'),
        sortOrder: Number(form.get('sortOrder') ?? 0),
      };
    }

    const saved = await request('/api/admin/catalogue', 'POST', body);
    if (saved) formElement.reset();
  }

  async function save(type: EntityType, id: string, values: { name?: string; title?: string; sortOrder?: number }) {
    await request('/api/admin/catalogue', 'PATCH', { type, id, ...values });
  }

  async function toggle(type: EntityType, id: string, active: boolean) {
    if (active) {
      await request('/api/admin/catalogue', 'PATCH', { type, id, isActive: true });
    } else {
      await request('/api/admin/catalogue', 'DELETE', { type, id });
    }
  }

  if (loading) return <p>Loading catalogue management…</p>;
  if (!data) return <p className={styles.error}>{error || 'Catalogue management is unavailable.'}</p>;

  return (
    <div className={styles.uploadForm}>
      {message && <p className={styles.success} role="status">{message}</p>}
      {error && <p className={styles.error} role="alert">{error}</p>}

      <div><h2>Aircraft hierarchy</h2><p>Add each level in order: manufacturer → model → variant. Existing documents keep their links when an item is deactivated.</p></div>
      <div className={styles.card}>
        <h3>Add manufacturer</h3>
        <form className={styles.formGrid} onSubmit={(event) => create(event, 'manufacturer')}>
          <label>Manufacturer name<input name="name" placeholder="e.g. Boeing" required /></label>
          <label>Sort order<input name="sortOrder" type="number" min="0" defaultValue="0" /></label>
          <button type="submit" disabled={busy}>Add manufacturer</button>
        </form>
      </div>

      <div className={styles.card}>
        <h3>Add aircraft model</h3>
        <form className={styles.formGrid} onSubmit={(event) => create(event, 'model')}>
          <label>Manufacturer
            <select name="manufacturerId" required defaultValue="">
              <option value="" disabled>Select manufacturer</option>
              {data.manufacturers.filter((item) => item.isActive).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
          <label>Model name<input name="name" placeholder="e.g. Dash 8" required /></label>
          <label>Sort order<input name="sortOrder" type="number" min="0" defaultValue="0" /></label>
          <button type="submit" disabled={busy}>Add model</button>
        </form>
      </div>

      <div className={styles.card}>
        <h3>Add aircraft variant / series</h3>
        <form className={styles.formGrid} onSubmit={(event) => create(event, 'variant')}>
          <label>Aircraft model
            <select name="modelId" required defaultValue="">
              <option value="" disabled>Select model</option>
              {allModels.filter((item) => item.isActive).map((item) => <option key={item.id} value={item.id}>{item.manufacturerName} / {item.name}</option>)}
            </select>
          </label>
          <label>Variant name<input name="name" placeholder="e.g. Dash 8-400" required /></label>
          <label>Sort order<input name="sortOrder" type="number" min="0" defaultValue="0" /></label>
          <button type="submit" disabled={busy}>Add variant</button>
        </form>
      </div>

      {data.manufacturers.map((manufacturer) => (
        <div className={styles.card} key={manufacturer.id}>
          <h3>Manufacturer: {manufacturer.name}</h3>
          <EditorRow type="manufacturer" item={manufacturer} onSave={save} onToggle={toggle} />
          {manufacturer.models.map((model) => (
            <div key={model.id} style={{ margin: '20px 0 0 18px', paddingLeft: 16, borderLeft: '2px solid #e1e8ed' }}>
              <h4>Model: {model.name}</h4>
              <EditorRow type="model" item={model} onSave={save} onToggle={toggle} />
              {model.variants.map((variant) => (
                <div key={variant.id} style={{ margin: '16px 0 0 18px', paddingLeft: 16, borderLeft: '2px solid #e1e8ed' }}>
                  <h4>Variant: {variant.name}</h4>
                  <EditorRow type="variant" item={variant} onSave={save} onToggle={toggle} />
                </div>
              ))}
            </div>
          ))}
        </div>
      ))}

      <div><h2>Departments and nested folders</h2><p>Create a top-level department first, then choose it as the parent when adding subfolders.</p></div>
      <div className={styles.card}>
        <h3>Add department or folder</h3>
        <form className={styles.formGrid} onSubmit={(event) => create(event, 'category')}>
          <label>Parent folder
            <select name="parentId" defaultValue="">
              <option value="">Create top-level department</option>
              {data.categories.filter((item) => item.isActive).map((item) => (
                <option key={item.id} value={item.id}>{'— '.repeat(categoryDepth(item) + 1)}{item.title}</option>
              ))}
            </select>
          </label>
          <label>Folder name<input name="title" placeholder="e.g. QRH" required /></label>
          <label className={styles.fullWidth}>Description<input name="description" placeholder="Optional description" /></label>
          <label>Sort order<input name="sortOrder" type="number" min="0" defaultValue="0" /></label>
          <button type="submit" disabled={busy}>Add folder</button>
        </form>
      </div>

      {data.categories.map((category) => (
        <div className={styles.card} key={category.id} style={{ marginLeft: Math.min(categoryDepth(category), 4) * 12 }}>
          <h3>{categoryDepth(category) === 0 ? 'Department' : 'Folder'}: {category.title}</h3>
          <EditorRow type="category" item={category} onSave={save} onToggle={toggle} />
        </div>
      ))}

      {busy && <p className={styles.status}>Saving catalogue changes…</p>}
    </div>
  );
}
