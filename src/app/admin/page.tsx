import Link from 'next/link';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import AdminLogoutButton from '@/components/admin/AdminLogoutButton';
import styles from './admin.module.scss';

export default async function AdminDashboardPage() {
  const session = await requireAdmin();

  return (
    <main className={styles.dashboard}>
      <header className={styles.dashboardHeader}>
        <Link href="/" className={styles.brand}>ACRO<span>READER</span></Link>
        <AdminLogoutButton />
      </header>
      <section className={styles.dashboardMain}>
        <p className={styles.eyebrow}>ADMINISTRATION</p>
        <h1>Document management</h1>
        <p>Signed in as {session.user.email}. Manage the aviation library from here.</p>
        <div className={styles.card}>
          <h2>Document uploads</h2>
          <p>The upload manager is the next MVP implementation step. It will save PDF files and their revision details to the AcroReader catalogue.</p>
        </div>
      </section>
    </main>
  );
}
