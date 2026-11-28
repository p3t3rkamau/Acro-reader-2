import Link from 'next/link';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import ViewerManager from './ViewerManager';
import styles from '../admin.module.scss';

export default async function AdminViewersPage() {
  await requireAdmin();

  return (
    <main className={styles.dashboard}>
      <header className={styles.dashboardHeader}>
        <Link href="/" className={styles.brand}>ACRO<span>READER</span></Link>
        <Link href="/admin" className={styles.logout}>Back to dashboard</Link>
      </header>
      <section className={styles.dashboardMain}>
        <p className={styles.eyebrow}>ACCESS MANAGEMENT</p>
        <h1>Authorised viewers</h1>
        <p>Create and suspend accounts that are allowed to open protected aviation manuals.</p>
        <ViewerManager />
      </section>
    </main>
  );
}
