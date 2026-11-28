import Link from 'next/link';
import type { ReactNode } from 'react';
import AdminLogoutButton from '@/components/admin/AdminLogoutButton';
import styles from '../../app/admin/admin.module.scss';

const navigation = [
  { href: '/admin', label: 'Overview', key: 'overview', icon: '⌂' },
  { href: '/admin/upload', label: 'Upload documents', key: 'upload', icon: '＋' },
  { href: '/admin/documents', label: 'Document library', key: 'documents', icon: '▣' },
  { href: '/admin/catalogue', label: 'Aircraft & folders', key: 'catalogue', icon: '▤' },
  { href: '/admin/viewers', label: 'Viewer access', key: 'viewers', icon: '♙' },
  { href: '/admin/storage', label: 'Private storage', key: 'storage', icon: '▣' },
] as const;

export default function AdminShell({
  active,
  title,
  eyebrow,
  description,
  email,
  children,
}: {
  active: (typeof navigation)[number]['key'];
  title: string;
  eyebrow: string;
  description: string;
  email?: string;
  children: ReactNode;
}) {
  return (
    <div className={styles.adminApp}>
      <aside className={styles.sidebar}>
        <Link href="/admin" className={styles.sidebarBrand}>
          <span className={styles.brandMark}>A</span>
          <span>ACRO<span>READER</span><small>DOCUMENT CONTROL</small></span>
        </Link>
        <div className={styles.navLabel}>WORKSPACE</div>
        <nav className={styles.navigation} aria-label="Administration">
          {navigation.map((item) => (
            <Link
              key={item.key}
              href={item.href}
              className={item.key === active ? styles.navActive : styles.navLink}
              aria-current={item.key === active ? 'page' : undefined}
            >
              <span className={styles.navIcon}>{item.icon}</span>
              {item.label}
              {item.key === active && <span className={styles.navIndicator} />}
            </Link>
          ))}
        </nav>
        <div className={styles.sidebarFooter}>
          <span className={styles.secureDot} />
          <span><strong>Secure workspace</strong><small>Administrator access</small></span>
        </div>
      </aside>

      <div className={styles.adminContent}>
        <header className={styles.topbar}>
          <div className={styles.breadcrumb}><span>AcroReader</span><span>/</span><strong>Administration</strong></div>
          <div className={styles.topbarRight}>
            {email && <span className={styles.accountEmail}>{email}</span>}
            <AdminLogoutButton />
          </div>
        </header>
        <main className={styles.dashboardMain}>
          <div className={styles.pageHeading}>
            <div>
              <p className={styles.eyebrow}>{eyebrow}</p>
              <h1>{title}</h1>
              <p className={styles.pageDescription}>{description}</p>
            </div>
            <span className={styles.adminBadge}><span /> ADMIN AREA</span>
          </div>
          {children}
        </main>
        <footer className={styles.adminFooter}>ACROREADER <span>·</span> Aviation document management</footer>
      </div>
    </div>
  );
}
