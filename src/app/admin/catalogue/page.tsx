import { requireAdmin } from '@/lib/auth/requireAdmin';
import AdminShell from '@/components/admin/AdminShell';
import CatalogueManager from './CatalogueManager';

export default async function AdminCataloguePage() {
  await requireAdmin();

  return (
    <AdminShell active="catalogue" eyebrow="LIBRARY STRUCTURE" title="Aircraft & folders" description="Build and maintain the aircraft hierarchy and document folder structure. Deactivating an item hides it from new selections while preserving its history.">
      <CatalogueManager />
    </AdminShell>
  );
}
