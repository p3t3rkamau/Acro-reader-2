import 'server-only';

import { redirect } from 'next/navigation';
import { auth } from '../../../auth';
import { prisma } from '@/lib/db/prisma';

export async function requireViewer() {
  const session = await auth();

  if (session?.user?.role === 'ADMIN') return session;

  if (session?.user?.role !== 'VIEWER' || !session.user.id) {
    redirect('/login');
  }

  // Re-check account state on every protected document request. A suspended
  // account must not remain authorised merely because its JWT has not expired.
  const user = await prisma.user.findFirst({
    where: {
      id: session.user.id,
      status: 'ACTIVE',
      emailVerified: { not: null },
    },
    select: { id: true },
  });

  if (!user) redirect('/login?error=account');

  return session;
}
