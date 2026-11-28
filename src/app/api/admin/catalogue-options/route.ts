import { NextResponse } from 'next/server';
import { auth } from '../../../../../auth';
import { prisma } from '@/lib/db/prisma';

export const runtime = 'nodejs';

export async function GET() {
  const session = await auth();

  if (session?.user?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Administrator access required.' }, { status: 401 });
  }

  try {
    const [manufacturers, categories] = await Promise.all([
      prisma.aircraftManufacturer.findMany({
        where: { isActive: true },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        select: {
          id: true,
          name: true,
          models: {
            where: { isActive: true },
            orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
            select: {
              id: true,
              name: true,
              variants: {
                where: { isActive: true },
                orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
                select: { id: true, name: true },
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
          title: true,
          parentId: true,
          sortOrder: true,
        },
      }),
    ]);

    return NextResponse.json({ manufacturers, categories });
  } catch (error) {
    console.error('[AcroReader] Could not load admin catalogue options:', error);
    return NextResponse.json({ error: 'Could not load aircraft and folder options.' }, { status: 500 });
  }
}
