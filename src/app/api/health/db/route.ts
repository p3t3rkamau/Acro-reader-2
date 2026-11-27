import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;

    return NextResponse.json(
      { status: 'ok', database: 'connected' },
      { status: 200 },
    );
  } catch (error) {
    console.error('[AcroReader] Database health check failed:', error);

    return NextResponse.json(
      { status: 'error', database: 'unavailable' },
      { status: 503 },
    );
  }
}
