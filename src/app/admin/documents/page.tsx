import { requireAdmin } from '@/lib/auth/requireAdmin';
import AdminShell from '@/components/admin/AdminShell';
import DocumentManager from './DocumentManager';

export default async function AdminDocumentsPage() {
  await requireAdmin();

  return (
    <AdminShell
      active="documents"
      eyebrow="DOCUMENT CONTROL"
      title="Document library"
      description="Review uploaded PDFs, edit document details, inspect revision history and publish approved drafts."
    >
      <DocumentManager />
    </AdminShell>
  );
}
