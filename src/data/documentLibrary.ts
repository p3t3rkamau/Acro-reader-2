export type LibraryDocument = {
  id: string;
  title: string;
  revision: string;
  effectiveDate: string;
  fileUrl: string;
  status: 'current' | 'superseded';
};

export type LibraryFolder = {
  slug: string;
  title: string;
  description?: string;
  folders?: LibraryFolder[];
  documents?: LibraryDocument[];
};

const flightOperations: LibraryFolder[] = [
  { slug: 'afm', title: 'AFM', description: 'Aircraft Flight Manual', documents: [] },
  { slug: 'qrh', title: 'QRH', description: 'Quick Reference Handbook', documents: [] },
  { slug: 'aom', title: 'AOM', description: 'Aircraft Operating Manual', documents: [] },
  { slug: 'checklists', title: 'Checklists', description: 'Operational checklists and guidance', documents: [] },
];

function aircraft(slug: string, title: string): LibraryFolder {
  return {
    slug, title, description: `Technical and operational documentation for ${title} aircraft.`,
    folders: [
      { slug: 'flight-operations', title: 'Flight Operations', description: 'Operational manuals and flight crew references.', folders: flightOperations },
      { slug: 'maintenance', title: 'Maintenance', description: 'Maintenance documentation and technical references.', folders: [] },
    ],
  };
}

export const documentLibrary: LibraryFolder = {
  slug: 'library',
  title: 'Aircraft Documentation',
  description: 'Browse published aircraft manuals and operational documents.',
  folders: [
    aircraft('dash-100', 'DASH 100'),
    aircraft('dash-200', 'DASH 200'),
    aircraft('dash-300', 'DASH 300'),
    aircraft('dash-400', 'DASH 400'),
  ],
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

export function getLibraryBreadcrumbs(path: string[]) {
  const crumbs = [{ title: documentLibrary.title, href: '/' }];
  let current = documentLibrary;
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
