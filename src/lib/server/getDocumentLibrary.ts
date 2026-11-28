import 'server-only';

import { headers } from 'next/headers';
import type { LibraryDocument, LibraryFolder } from '@/data/documentLibrary';
import { prisma } from '@/lib/db/prisma';

type CategoryRecord = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  parentId: string | null;
  sortOrder: number;
};

function makeCategoryFolder(category: CategoryRecord): LibraryFolder {
  return {
    slug: category.slug,
    title: category.title,
    description: category.description ?? undefined,
    folders: [],
    documents: [],
  };
}

function createCategoryTree(categories: CategoryRecord[]): {
  roots: LibraryFolder[];
  folderById: Map<string, LibraryFolder>;
} {
  const folderById = new Map<string, LibraryFolder>();
  const categoryById = new Map(categories.map((category) => [category.id, category]));

  for (const category of categories) {
    folderById.set(category.id, makeCategoryFolder(category));
  }

  const roots: LibraryFolder[] = [];

  for (const category of categories) {
    const folder = folderById.get(category.id)!;

    if (category.parentId) {
      const parent = folderById.get(category.parentId);
      if (parent) {
        parent.folders ??= [];
        parent.folders.push(folder);
      }
      // If a parent is inactive or missing, keep this node hidden rather than
      // promoting a nested folder to a top-level department.
    } else {
      roots.push(folder);
    }
  }

  const sortFolders = (folders: LibraryFolder[]) => {
    folders.sort((a, b) => {
      const aOrder = categories.find((item) => item.slug === a.slug)?.sortOrder ?? 0;
      const bOrder = categories.find((item) => item.slug === b.slug)?.sortOrder ?? 0;
      return aOrder - bOrder || a.title.localeCompare(b.title);
    });
    for (const folder of folders) sortFolders(folder.folders ?? []);
  };

  sortFolders(roots);
  return { roots, folderById };
}

function findCategoryPath(
  categoryId: string,
  categoriesById: Map<string, CategoryRecord>,
): CategoryRecord[] {
  const path: CategoryRecord[] = [];
  const visited = new Set<string>();
  let current = categoriesById.get(categoryId);

  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    path.unshift(current);
    current = current.parentId
      ? categoriesById.get(current.parentId)
      : undefined;
  }

  return path;
}

function findFolderAtPath(root: LibraryFolder, path: string[]): LibraryFolder | null {
  let current = root;

  for (const slug of path) {
    const next = current.folders?.find((folder) => folder.slug === slug);
    if (!next) return null;
    current = next;
  }

  return current;
}

export async function getDocumentLibrary(): Promise<LibraryFolder> {
  const root: LibraryFolder = {
    slug: 'library',
    title: 'Aircraft Documentation',
    description: 'Browse published aircraft manuals and operational documents.',
    folders: [],
    documents: [],
  };

  try {
    const requestHeaders = await headers();
    const host = requestHeaders.get('x-forwarded-host') ?? requestHeaders.get('host');
    const protocol = requestHeaders.get('x-forwarded-proto')
      ?? (host?.startsWith('localhost') ? 'http' : 'https');
    const appOrigin = process.env.APP_URL ?? (host ? `${protocol}://${host}` : 'http://localhost:3000');

    const [manufacturers, categories, documents] = await Promise.all([
      prisma.aircraftManufacturer.findMany({
        where: { isActive: true },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        select: {
          id: true,
          slug: true,
          name: true,
          description: true,
          models: {
            where: { isActive: true },
            orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
            select: {
              id: true,
              slug: true,
              name: true,
              description: true,
              variants: {
                where: { isActive: true },
                orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
                select: {
                  id: true,
                  slug: true,
                  name: true,
                  description: true,
                },
              },
            },
          },
        },
      }),
      prisma.documentCategory.findMany({
        where: { isActive: true },
        orderBy: [{ sortOrder: 'asc' }, { title: 'asc' }],
        select: {
          id: true,
          slug: true,
          title: true,
          description: true,
          parentId: true,
          sortOrder: true,
        },
      }),
      prisma.document.findMany({
        where: {
          archivedAt: null,
          variants: {
            some: {
              variant: {
                isActive: true,
                model: {
                  isActive: true,
                  manufacturer: { isActive: true },
                },
              },
            },
          },
          revisions: {
            some: { status: { in: ['PUBLISHED', 'SUPERSEDED'] } },
          },
        },
        select: {
          id: true,
          title: true,
          referenceNumber: true,
          categoryId: true,
          variants: { select: { variantId: true } },
          revisions: {
            where: { status: { in: ['PUBLISHED', 'SUPERSEDED'] } },
            select: {
              id: true,
              revision: true,
              effectiveDate: true,
              status: true,
            },
            orderBy: [{ effectiveDate: 'desc' }, { createdAt: 'desc' }],
          },
        },
      }),
    ]);

    const categoriesById = new Map(categories.map((category) => [category.id, category]));
    const variantFolders = new Map<string, LibraryFolder>();

    root.folders = manufacturers.map((manufacturer) => ({
      slug: manufacturer.slug,
      title: manufacturer.name,
      description: manufacturer.description ?? undefined,
      folders: manufacturer.models.map((model) => ({
        slug: model.slug,
        title: model.name,
        description: model.description ?? undefined,
        folders: model.variants.map((variant) => {
          const categoryTree = createCategoryTree(categories);
          const variantFolder: LibraryFolder = {
            slug: variant.slug,
            title: variant.name,
            description: variant.description ?? undefined,
            folders: categoryTree.roots,
            documents: [],
          };
          variantFolders.set(variant.id, variantFolder);
          return variantFolder;
        }),
        documents: [],
      })),
      documents: [],
    }));

    for (const record of documents) {
      const categoryPath = findCategoryPath(record.categoryId, categoriesById)
        .map((category) => category.slug);

      if (categoryPath.length === 0) continue;

      for (const variantLink of record.variants) {
        const variantFolder = variantFolders.get(variantLink.variantId);
        if (!variantFolder) continue;

        const target = findFolderAtPath(variantFolder, categoryPath);
        if (!target) continue;

        for (const revision of record.revisions) {
          const libraryDocument: LibraryDocument = {
            id: revision.id,
            title: record.title,
            referenceNumber: record.referenceNumber ?? undefined,
            revision: revision.revision,
            effectiveDate: revision.effectiveDate.toISOString().slice(0, 10),
            status: revision.status === 'PUBLISHED' ? 'current' : 'superseded',
            // The browser receives only our same-origin route, never a Blob URL.
            fileUrl: new URL(`/api/documents/${record.id}/file?revision=${encodeURIComponent(revision.id)}`, appOrigin).toString(),
          };

          target.documents ??= [];
          target.documents.push(libraryDocument);
        }
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
