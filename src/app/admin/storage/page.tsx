import Link from 'next/link';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import StorageMigrationManager from './StorageMigrationManager';
import styles from '../admin.module.scss';

export default async function AdminStoragePage() {
  await requireAdmin();

  return (
    <main className={styles.dashboard}>
      <header className={styles.dashboardHeader}>
        <Link href="/" className={styles.brand}>ACRO<span>READER</span></Link>
        <Link href="/admin" className={styles.logout}>Back to dashboard</Link>
      </header>
      <section className={styles.dashboardMain}>
        <p className={styles.eyebrow}>PROTECTED FILE STORAGE</p>
        <h1>Private PDF migration</h1>
        <p>Copy published and historical PDFs from the old public store into private storage. Verify every private copy before deleting its public original.</p>
        <StorageMigrationManager />
      </section>
    </main>
  );
}
