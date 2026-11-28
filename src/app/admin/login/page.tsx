import Link from 'next/link';
import { auth } from '../../../../auth';
import { redirect } from 'next/navigation';
import AdminLoginForm from './AdminLoginForm';
import styles from '../admin.module.scss';

export default async function AdminLoginPage() {
  const session = await auth();
  if (session?.user?.role === 'ADMIN') redirect('/admin');

  return (
    <main className={styles.shell}>
      <section className={styles.panel}>
        <Link href="/" className={styles.brand}>ACRO<span>READER</span></Link>
        <p className={styles.eyebrow}>ADMINISTRATION</p>
        <h1>Welcome back.</h1>
        <p className={styles.intro}>Sign in to manage the aviation document library.</p>
        <AdminLoginForm />
        <Link href="/" className={styles.back}>← Back to public library</Link>
      </section>
    </main>
  );
}
