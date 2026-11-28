import 'server-only';

import { redirect } from 'next/navigation';
import { auth } from '../../../auth';

export async function requireAdmin() {
  const session = await auth();

  if (session?.user?.role !== 'ADMIN') {
    redirect('/admin/login');
  }

  return session;
}
