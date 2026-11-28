import { requireAdmin } from '@/lib/auth/requireAdmin';
import AdminShell from '@/components/admin/AdminShell';
import ViewerManager from './ViewerManager';

export default async function AdminViewersPage() {
  await requireAdmin();

  return (
    <AdminShell active="viewers" eyebrow="ACCESS MANAGEMENT" title="Authorised viewers" description="Create accounts for people who need to read protected aviation manuals. There is no public self-registration.">
      <ViewerManager />
    </AdminShell>
  );
}
