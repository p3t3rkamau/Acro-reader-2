import { NextResponse } from 'next/server';
import argon2 from 'argon2';
import { z } from 'zod';
import { auth } from '../../../../../auth';
import { prisma } from '@/lib/db/prisma';

export const runtime = 'nodejs';

const createSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  email: z.string().trim().email().max(320),
  password: z.string().min(12).max(200),
});

const updateSchema = z.object({
  id: z.string().min(1),
  status: z.enum(['ACTIVE', 'SUSPENDED']),
});

async function isAdmin() {
  const session = await auth();
  return session?.user?.role === 'ADMIN';
}

export async function GET() {
  if (!await isAdmin()) {
    return NextResponse.json({ error: 'Administrator access required.' }, { status: 401 });
  }

  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      email: true,
      status: true,
      emailVerified: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ users });
}

export async function POST(request: Request) {
  if (!await isAdmin()) {
    return NextResponse.json({ error: 'Administrator access required.' }, { status: 401 });
  }

  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: 'Enter a valid email and a password of at least 12 characters.' }, { status: 400 });
  }

  try {
    const user = await prisma.user.create({
      data: {
        name: parsed.data.name,
        email: parsed.data.email.toLowerCase(),
        passwordHash: await argon2.hash(parsed.data.password, { type: argon2.argon2id }),
        // These accounts are explicitly provisioned and verified by the administrator.
        emailVerified: new Date(),
        status: 'ACTIVE',
      },
      select: { id: true, email: true },
    });

    return NextResponse.json({ success: true, user }, { status: 201 });
  } catch (error) {
    const code = (error as { code?: string })?.code;
    if (code === 'P2002') {
      return NextResponse.json({ error: 'An account with this email already exists.' }, { status: 409 });
    }
    console.error('[AcroReader] Viewer account creation failed:', error);
    return NextResponse.json({ error: 'Could not create the viewer account.' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  if (!await isAdmin()) {
    return NextResponse.json({ error: 'Administrator access required.' }, { status: 401 });
  }

  const parsed = updateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: 'The account update is invalid.' }, { status: 400 });
  }

  try {
    await prisma.user.update({
      where: { id: parsed.data.id },
      data: { status: parsed.data.status },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    const code = (error as { code?: string })?.code;
    if (code === 'P2025') {
      return NextResponse.json({ error: 'The account no longer exists.' }, { status: 404 });
    }
    console.error('[AcroReader] Viewer account update failed:', error);
    return NextResponse.json({ error: 'Could not update the viewer account.' }, { status: 500 });
  }
}
