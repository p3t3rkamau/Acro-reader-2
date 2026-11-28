import 'server-only';

import {
  documentLibrary,
  type LibraryDocument,
  type LibraryFolder,
} from '@/data/documentLibrary';
import { prisma } from '@/lib/db/prisma';

const aircraftSeriesMap = {
  'dash-100': 'DASH_100',
  'dash-200': 'DASH_200',
  'dash-300': 'DASH_300',
  'dash-400': 'DASH_400',
} as const;

const supportedAircraftSeries = [
  'DASH_100',
  'DASH_200',
  'DASH_300',
  'DASH_400',
] as const;

type AircraftSeriesValue = (typeof supportedAircraftSeries)[number];
type AircraftFolderSlug = keyof typeof aircraftSeriesMap;
type FolderNode = {
  slug: string;
  title: string;
  description?: string;
};

const seriesSlugByValue: Record<AircraftSeriesValue, AircraftFolderSlug> = {
  DASH_100: 'dash-100',
  DASH_200: 'dash-200',
  DASH_300: 'dash-300',
  DASH_400: 'dash-400',
};

function cloneFolder(folder: LibraryFolder): LibraryFolder {
  return {
    ...folder,
    folders: folder.folders?.map(cloneFolder),
    documents: [],
  };
}

function findOrCreateFolder(
  root: LibraryFolder,
  aircraftSlug: string,
  nodes: FolderNode[],
): LibraryFolder | null {
  let current = root.folders?.find((folder) => folder.slug === aircraftSlug);

  if (!current) return null;

  for (const node of nodes) {
    const parent: LibraryFolder = current;
    const children: LibraryFolder[] = parent.folders ?? [];
    parent.folders = children;

    let next = children.find((folder) => folder.slug === node.slug);

    if (!next) {
      next = {
        slug: node.slug,
        title: node.title || node.slug,
        description: node.description,
        folders: [],
        documents: [],
      };
      children.push(next);
      children.sort((a, b) => a.title.localeCompare(b.title));
    }

    current = next;
  }

  return current;
}

export async function getDocumentLibrary(): Promise<LibraryFolder> {
  const root = cloneFolder(documentLibrary);

  try {
    const [categories, documents] = await Promise.all([
      prisma.documentCategory.findMany({
        select: {
          id: true,
          slug: true,
          title: true,
          description: true,
          parentId: true,
        },
      }),
      prisma.document.findMany({
        where: {
          aircraftSeries: { in: [...supportedAircraftSeries] },
          revisions: {
            some: {
              status: { in: ['PUBLISHED', 'SUPERSEDED'] },
            },
          },
        },
        select: {
          id: true,
          title: true,
          aircraftSeries: true,
          categoryId: true,
          revisions: {
            where: {
              status: { in: ['PUBLISHED', 'SUPERSEDED'] },
            },
            select: {
              id: true,
              revision: true,
              effectiveDate: true,
              status: true,
              fileUrl: true,
            },
            orderBy: [
              { effectiveDate: 'desc' },
              { createdAt: 'desc' },
            ],
          },
        },
      }),
    ]);

    const categoriesById = new Map(
      categories.map((category) => [category.id, category]),
    );

    function getCategoryPath(categoryId: string): FolderNode[] {
      const path: FolderNode[] = [];
      const visited = new Set<string>();
      let current = categoriesById.get(categoryId);

      // The visited set protects the catalogue from malformed category cycles.
      while (current && !visited.has(current.id)) {
        visited.add(current.id);
        path.unshift({
          slug: current.slug,
          title: current.title,
          description: current.description ?? undefined,
        });
        current = current.parentId
          ? categoriesById.get(current.parentId)
          : undefined;
      }

      return path;
    }

    for (const record of documents) {
      const aircraftSlug = seriesSlugByValue[record.aircraftSeries];
      const categoryPath = getCategoryPath(record.categoryId);

      if (!aircraftSlug || categoryPath.length === 0) continue;

      const target = findOrCreateFolder(root, aircraftSlug, categoryPath);
      if (!target) continue;

      for (const revision of record.revisions) {
        const libraryDocument: LibraryDocument = {
          id: revision.id,
          title: record.title,
          revision: revision.revision,
          effectiveDate: revision.effectiveDate.toISOString().slice(0, 10),
          status: revision.status === 'PUBLISHED' ? 'current' : 'superseded',
          fileUrl: revision.fileUrl ?? undefined,
        };

        target.documents ??= [];
        target.documents.push(libraryDocument);
      }
    }

    function sortDocuments(folder: LibraryFolder): void {
      folder.documents?.sort((a, b) => {
        const titleOrder = a.title.localeCompare(b.title);
        return titleOrder || b.effectiveDate.localeCompare(a.effectiveDate);
      });
      folder.folders?.forEach(sortDocuments);
    }

    sortDocuments(root);
  } catch (error) {
    console.error('[AcroReader] Could not load the document catalogue from Prisma.', error);
  }

  return root;
}
