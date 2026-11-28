import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '../../../auth';
import ViewerLoginForm from './ViewerLoginForm';
import styles from '../admin/admin.module.scss';

export default async function ViewerLoginPage() {
  const session = await auth();
  if (session?.user?.role === 'ADMIN') redirect('/admin');
  if (session?.user?.role === 'VIEWER') redirect('/');

  return (
    <main className={styles.shell}>
      <section className={styles.panel}>
        <Link href="/" className={styles.brand}>ACRO<span>READER</span></Link>
        <p className={styles.eyebrow}>AUTHORISED DOCUMENT ACCESS</p>
        <h1>Sign in to read.</h1>
        <p className={styles.intro}>The catalogue is public. Viewing protected aviation manuals requires an authorised account.</p>
        <ViewerLoginForm />
        <Link href="/" className={styles.back}>← Browse public catalogue</Link>
      </section>
    </main>
  );
}
