export type LibraryDocument = {
  id: string;
  title: string;
  referenceNumber?: string;
  revision: string;
  effectiveDate: string;
  status: 'current' | 'superseded';
  fileUrl?: string;
};

export type LibraryFolder = {
  slug: string;
  title: string;
  description?: string;
  folders?: LibraryFolder[];
  documents?: LibraryDocument[];
};

// Empty structural fallback only. Actual manufacturers, models, variants and
// category folders are loaded from Neon by getDocumentLibrary().
export const documentLibrary: LibraryFolder = {
  slug: 'library',
  title: 'Aircraft Documentation',
  description: 'Browse published aircraft manuals and operational documents.',
  folders: [],
  documents: [],
};

export function findLibraryFolder(path: string[], root: LibraryFolder = documentLibrary): LibraryFolder | null {
  let current = root;
  for (const segment of path) {
    const next = current.folders?.find((folder) => folder.slug === segment);
    if (!next) return null;
    current = next;
  }
  return current;
}

export function getLibraryBreadcrumbs(path: string[], root: LibraryFolder = documentLibrary) {
  const crumbs = [{ title: root.title, href: '/' }];
  let current = root;
  const parts: string[] = [];
  for (const segment of path) {
    const next = current.folders?.find((folder) => folder.slug === segment);
    if (!next) break;
    parts.push(segment);
    crumbs.push({ title: next.title, href: `/library/${parts.join('/')}` });
    current = next;
  }
  return crumbs;
}
