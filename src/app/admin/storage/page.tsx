import { requireAdmin } from '@/lib/auth/requireAdmin';
import AdminShell from '@/components/admin/AdminShell';
import StorageMigrationManager from './StorageMigrationManager';

export default async function AdminStoragePage() {
  await requireAdmin();

  return (
    <AdminShell active="storage" eyebrow="PROTECTED FILE STORAGE" title="Private PDF storage" description="Move legacy PDFs into private storage. Every private copy is verified before you are offered the option to remove its old public copy.">
      <StorageMigrationManager />
    </AdminShell>
  );
}
