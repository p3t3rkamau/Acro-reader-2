'use client';

import { signOut } from 'next-auth/react';
import styles from '@/app/admin/admin.module.scss';

export default function AdminLogoutButton() {
  return <button className={styles.logout} onClick={() => signOut({ redirectTo: '/' })}>Sign out</button>;
}
