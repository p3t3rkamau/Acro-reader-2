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
          <h2>Aircraft and folders</h2>
          <p>Manage manufacturers, aircraft models, variants, departments and nested folders.</p>
          <p><Link href="/admin/catalogue">Manage library structure</Link></p>
        </div>
        <div className={styles.card}>
          <h2>Authorised viewers</h2>
          <p>Create or suspend accounts that can open protected manuals.</p>
          <p><Link href="/admin/viewers">Manage viewer access</Link></p>
        </div>
        <div className={styles.card}>
          <h2>Private PDF storage</h2>
          <p>Migrate old public PDFs into private storage and review legacy public copies.</p>
          <p><Link href="/admin/storage">Manage PDF storage</Link></p>
        </div>
        <div className={styles.card}>
          <h2>Document uploads</h2>
          <p>Upload a PDF, assign its aircraft family and category, and publish its revision.</p>
          <p><Link href="/admin/upload">Open document uploader</Link></p>
        </div>
      </section>
    </main>
  );
}
