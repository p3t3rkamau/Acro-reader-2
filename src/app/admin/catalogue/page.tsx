import Link from 'next/link';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import CatalogueManager from './CatalogueManager';
import styles from '../admin.module.scss';

export default async function AdminCataloguePage() {
  await requireAdmin();

  return (
    <main className={styles.dashboard}>
      <header className={styles.dashboardHeader}>
        <Link href="/" className={styles.brand}>ACRO<span>READER</span></Link>
        <Link href="/admin" className={styles.logout}>Back to dashboard</Link>
      </header>
      <section className={styles.dashboardMain}>
        <p className={styles.eyebrow}>LIBRARY STRUCTURE</p>
        <h1>Aircraft and folder management</h1>
        <p>Create and maintain the aircraft hierarchy and nested document folders. Deactivation preserves existing document history.</p>
        <CatalogueManager />
      </section>
    </main>
  );
}
