import 'server-only';

import { documentLibrary, type LibraryDocument, type LibraryFolder } from '@/data/documentLibrary';

type PayloadFolderNode = { slug: string; title: string; description?: string | null; sortOrder?: number };
type PayloadDocument = {
  id: string | number;
  title: string;
  revision: string;
  effectiveDate: string;
  status: 'published' | 'superseded';
  aircraft: string;
  folderNodes?: PayloadFolderNode[];
  folderPath?: string;
};
type PayloadResponse = { docs?: PayloadDocument[] };

function cloneFolder(folder: LibraryFolder): LibraryFolder {
  return { ...folder, folders: folder.folders?.map(cloneFolder), documents: [] };
}

function findOrCreateFolder(
  root: LibraryFolder,
  aircraftSeries: string,
  nodes: PayloadFolderNode[],
): LibraryFolder | null {
  let current: LibraryFolder | undefined = root.folders?.find(
    (folder: LibraryFolder) => folder.slug === aircraftSeries,
  );

  if (!current) return null;

  for (const node of nodes) {
    if (!current) return null;

    // Keep the recursive folder array explicitly typed. Separating the
    // parent reference from the traversal variable avoids TypeScript's
    // circular inference around current.folders and current reassignment.
    const parent: LibraryFolder = current;
    const children: LibraryFolder[] = parent.folders ?? [];
    parent.folders = children;

    let next: LibraryFolder | undefined = children.find(
      (folder: LibraryFolder) => folder.slug === node.slug,
    );

    if (!next) {
      next = {
        slug: node.slug,
        title: node.title || node.slug,
        description: node.description ?? undefined,
        folders: [],
        documents: [],
      };
      children.push(next);
      children.sort(
        (a: LibraryFolder, b: LibraryFolder) =>
          a.title.localeCompare(b.title),
      );
    }

    current = next;
  }

  return current ?? null;
}

export async function getDocumentLibrary(): Promise<LibraryFolder> {
  const root = cloneFolder(documentLibrary);
  const configuredUrl = process.env.PAYLOAD_API_URL;
  if (!configuredUrl) {
    console.warn('[AcroReader] PAYLOAD_API_URL is missing; showing the empty catalogue.');
    return root;
  }

  try {
    const endpoint = new URL('/api/acro-documents', configuredUrl.replace(/\/$/, ''));
    endpoint.searchParams.set('limit', '1000');

    const response = await fetch(endpoint, {
      headers: { Accept: 'application/json' },
      next: { revalidate: 60 },
    });
    if (!response.ok) throw new Error(`Payload returned HTTP ${response.status}`);

    const payload = (await response.json()) as PayloadResponse;
    for (const record of payload.docs ?? []) {
      if (!record.id || !record.title || !record.aircraft) continue;
      const nodes = record.folderNodes ?? (record.folderPath
        ? record.folderPath.split('/').filter(Boolean).map((slug) => ({ slug, title: slug }))
        : []);
      const target = findOrCreateFolder(root, record.aircraft, nodes);
      if (!target) continue;

      const doc: LibraryDocument = {
        id: String(record.id),
        title: record.title,
        revision: record.revision,
        effectiveDate: record.effectiveDate,
        status: record.status === 'published' ? 'current' : 'superseded',
      };
      target.documents ??= [];
      target.documents.push(doc);
    }
  } catch (error) {
    console.error('[AcroReader] Could not load the Payload catalogue.', error);
  }
  return root;
}
