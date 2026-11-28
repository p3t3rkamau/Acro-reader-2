import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '../../../../../auth';
import { prisma } from '@/lib/db/prisma';

export const runtime = 'nodejs';

const slugify = (value: string) => value
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '')
  .slice(0, 80);

const createSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('manufacturer'),
    name: z.string().trim().min(2).max(100),
    description: z.string().trim().max(500).optional(),
    sortOrder: z.number().int().min(0).max(10000).default(0),
  }),
  z.object({
    type: z.literal('model'),
    manufacturerId: z.string().min(1),
    name: z.string().trim().min(1).max(100),
    description: z.string().trim().max(500).optional(),
    sortOrder: z.number().int().min(0).max(10000).default(0),
  }),
  z.object({
    type: z.literal('variant'),
    modelId: z.string().min(1),
    name: z.string().trim().min(1).max(100),
    description: z.string().trim().max(500).optional(),
    sortOrder: z.number().int().min(0).max(10000).default(0),
  }),
  z.object({
    type: z.literal('category'),
    parentId: z.string().nullable().optional(),
    title: z.string().trim().min(1).max(120),
    description: z.string().trim().max(500).optional(),
    sortOrder: z.number().int().min(0).max(10000).default(0),
  }),
]);

const updateSchema = z.object({
  type: z.enum(['manufacturer', 'model', 'variant', 'category']),
  id: z.string().min(1),
  name: z.string().trim().min(1).max(120).optional(),
  title: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(500).nullable().optional(),
  sortOrder: z.number().int().min(0).max(10000).optional(),
  isActive: z.boolean().optional(),
}).refine((value) => (
  value.name !== undefined ||
  value.title !== undefined ||
  value.description !== undefined ||
  value.sortOrder !== undefined ||
  value.isActive !== undefined
), 'Provide at least one field to update.');

const deactivateSchema = z.object({
  type: z.enum(['manufacturer', 'model', 'variant', 'category']),
  id: z.string().min(1),
});

async function requireAdministrator() {
  const session = await auth();
  return session?.user?.role === 'ADMIN';
}

export async function GET() {
  if (!await requireAdministrator()) {
    return NextResponse.json({ error: 'Administrator access required.' }, { status: 401 });
  }

  try {
    const [manufacturers, categories] = await Promise.all([
      prisma.aircraftManufacturer.findMany({
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        include: {
          models: {
            orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
            include: {
              variants: { orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] },
            },
          },
        },
      }),
      prisma.documentCategory.findMany({
        orderBy: [{ sortOrder: 'asc' }, { title: 'asc' }],
      }),
    ]);

    return NextResponse.json({ manufacturers, categories });
  } catch (error) {
    console.error('[AcroReader] Catalogue management read failed:', error);
    return NextResponse.json({ error: 'Could not load catalogue management data.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!await requireAdministrator()) {
    return NextResponse.json({ error: 'Administrator access required.' }, { status: 401 });
  }

  try {
    const parsed = createSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'The catalogue details are invalid.', details: parsed.error.flatten() }, { status: 400 });
    }

    const data = parsed.data;
    let created: { id: string };

    if (data.type === 'manufacturer') {
      created = await prisma.aircraftManufacturer.create({
        data: {
          name: data.name,
          slug: slugify(data.name),
          description: data.description,
          sortOrder: data.sortOrder,
        },
        select: { id: true },
      });
    } else if (data.type === 'model') {
      const manufacturer = await prisma.aircraftManufacturer.findFirst({
        where: { id: data.manufacturerId, isActive: true },
        select: { id: true },
      });
      if (!manufacturer) return NextResponse.json({ error: 'Select an active manufacturer.' }, { status: 400 });

      created = await prisma.aircraftModel.create({
        data: {
          manufacturerId: manufacturer.id,
          name: data.name,
          slug: slugify(data.name),
          description: data.description,
          sortOrder: data.sortOrder,
        },
        select: { id: true },
      });
    } else if (data.type === 'variant') {
      const model = await prisma.aircraftModel.findFirst({
        where: { id: data.modelId, isActive: true, manufacturer: { isActive: true } },
        select: { id: true },
      });
      if (!model) return NextResponse.json({ error: 'Select an active aircraft model.' }, { status: 400 });

      created = await prisma.aircraftVariant.create({
        data: {
          modelId: model.id,
          name: data.name,
          slug: slugify(data.name),
          description: data.description,
          sortOrder: data.sortOrder,
        },
        select: { id: true },
      });
    } else {
      if (data.parentId) {
        const parent = await prisma.documentCategory.findFirst({
          where: { id: data.parentId, isActive: true },
          select: { id: true },
        });
        if (!parent) return NextResponse.json({ error: 'Select an active parent folder.' }, { status: 400 });
      }

      const baseSlug = slugify(data.title) || 'folder';
      let slug = baseSlug;
      let suffix = 2;
      while (await prisma.documentCategory.findUnique({ where: { slug }, select: { id: true } })) {
        slug = `${baseSlug}-${suffix++}`;
      }

      created = await prisma.documentCategory.create({
        data: {
          title: data.title,
          slug,
          parentId: data.parentId ?? null,
          description: data.description,
          sortOrder: data.sortOrder,
        },
        select: { id: true },
      });
    }

    return NextResponse.json({ success: true, id: created.id }, { status: 201 });
  } catch (error) {
    console.error('[AcroReader] Catalogue management create failed:', error);
    const code = (error as { code?: string })?.code;
    if (code === 'P2002') {
      return NextResponse.json({ error: 'An item with that name or slug already exists at this level.' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Could not create the catalogue item.' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  if (!await requireAdministrator()) {
    return NextResponse.json({ error: 'Administrator access required.' }, { status: 401 });
  }

  try {
    const parsed = updateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'The catalogue update is invalid.' }, { status: 400 });
    }

    const { type, id, name, title, description, sortOrder, isActive } = parsed.data;
    const common = {
      ...(description !== undefined ? { description } : {}),
      ...(sortOrder !== undefined ? { sortOrder } : {}),
      ...(isActive !== undefined ? { isActive } : {}),
    };

    if (type === 'manufacturer') {
      await prisma.aircraftManufacturer.update({
        where: { id },
        data: { ...common, ...(name ? { name, slug: slugify(name) } : {}) },
      });
    } else if (type === 'model') {
      await prisma.aircraftModel.update({
        where: { id },
        data: { ...common, ...(name ? { name, slug: slugify(name) } : {}) },
      });
    } else if (type === 'variant') {
      await prisma.aircraftVariant.update({
        where: { id },
        data: { ...common, ...(name ? { name, slug: slugify(name) } : {}) },
      });
    } else {
      await prisma.documentCategory.update({
        where: { id },
        data: { ...common, ...(title ? { title, slug: slugify(title) } : {}) },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[AcroReader] Catalogue management update failed:', error);
    const code = (error as { code?: string })?.code;
    if (code === 'P2002') {
      return NextResponse.json({ error: 'That name or slug is already in use.' }, { status: 409 });
    }
    if (code === 'P2025') {
      return NextResponse.json({ error: 'The catalogue item no longer exists.' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Could not update the catalogue item.' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  if (!await requireAdministrator()) {
    return NextResponse.json({ error: 'Administrator access required.' }, { status: 401 });
  }

  try {
    const parsed = deactivateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'The catalogue item is invalid.' }, { status: 400 });
    }

    const { type, id } = parsed.data;
    if (type === 'manufacturer') {
      await prisma.aircraftManufacturer.update({ where: { id }, data: { isActive: false } });
    } else if (type === 'model') {
      await prisma.aircraftModel.update({ where: { id }, data: { isActive: false } });
    } else if (type === 'variant') {
      await prisma.aircraftVariant.update({ where: { id }, data: { isActive: false } });
    } else {
      await prisma.documentCategory.update({ where: { id }, data: { isActive: false } });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[AcroReader] Catalogue management deactivation failed:', error);
    const code = (error as { code?: string })?.code;
    if (code === 'P2025') {
      return NextResponse.json({ error: 'The catalogue item no longer exists.' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Could not deactivate the catalogue item.' }, { status: 500 });
  }
}
