import { requireAdmin } from '@/lib/auth/requireAdmin';
import AdminShell from '@/components/admin/AdminShell';
import UploadDocumentForm from './UploadDocumentForm';
import styles from '../admin.module.scss';

export default async function AdminUploadPage() {
  await requireAdmin();

  return (
    <AdminShell active="upload" eyebrow="DOCUMENT MANAGEMENT" title="Upload aviation document" description="Assign a PDF to aircraft variants and a folder, then save it as a private draft or publish it to authorised viewers.">
      <div className={styles.card}><UploadDocumentForm /></div>
      <p className={styles.warning}>The catalogue is publicly browsable, but PDF files are stored privately and require an authorised viewer account to open.</p>
    </AdminShell>
  );
}
