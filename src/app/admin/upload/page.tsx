import Link from 'next/link';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import UploadDocumentForm from './UploadDocumentForm';
import styles from '../admin.module.scss';

export default async function AdminUploadPage() {
  await requireAdmin();

  return (
    <main className={styles.dashboard}>
      <header className={styles.dashboardHeader}>
        <Link href="/" className={styles.brand}>ACRO<span>READER</span></Link>
        <Link href="/admin" className={styles.logout}>Back to dashboard</Link>
      </header>
      <section className={styles.dashboardMain}>
        <p className={styles.eyebrow}>DOCUMENT MANAGEMENT</p>
        <h1>Upload aviation document</h1>
        <p>Add a PDF to one or more aircraft variants and publish its revision to the public catalogue.</p>
        <div className={styles.card}><UploadDocumentForm /></div>
        <p className={styles.warning}>The catalogue is public, but PDF files are stored privately and require an authorised viewer account.</p>
      </section>
    </main>
  );
}
