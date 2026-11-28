import Link from 'next/link';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import AdminShell from '@/components/admin/AdminShell';
import styles from './admin.module.scss';

const sections = [
  { href: '/admin/upload', number: '01', title: 'Upload documents', description: 'Add a new manual, select aircraft applicability and publish a revision.', action: 'Start an upload', icon: '↥' },
  { href: '/admin/documents', number: '02', title: 'Document library', description: 'View uploaded PDFs, edit document details, review revisions and publish drafts.', action: 'Manage documents', icon: '▣' },
  { href: '/admin/catalogue', number: '03', title: 'Aircraft & folders', description: 'Organise manufacturers, aircraft models, variants and document folders.', action: 'Manage structure', icon: '▤' },
  { href: '/admin/viewers', number: '04', title: 'Viewer access', description: 'Create authorised accounts and manage who can open protected PDFs.', action: 'Manage viewers', icon: '♙' },
  { href: '/admin/storage', number: '05', title: 'Private storage', description: 'Review legacy files and migrate public PDFs into protected storage.', action: 'Review storage', icon: '▣' },
];

export default async function AdminDashboardPage() {
  const session = await requireAdmin();

  return (
    <AdminShell active="overview" title="Good to see you" eyebrow="ADMINISTRATION OVERVIEW" email={session.user.email ?? undefined} description="Your control centre for the AcroReader aviation document library. Choose a task below to get started.">
      <div className={styles.welcomePanel}>
        <div><span className={styles.welcomeEyebrow}>ACROREADER WORKSPACE</span><h2>Everything in its place.</h2><p>Manage your aircraft library, documents and authorised readers from one workspace.</p></div>
        <div className={styles.welcomeSymbol}>A<span>R</span></div>
      </div>
      <div className={styles.sectionIntro}><div><h2>Management tools</h2><p>Choose an area to manage. Changes are saved to your AcroReader database.</p></div><span>5 WORKSPACES</span></div>
      <div className={styles.workspaceGrid}>
        {sections.map((section) => (
          <Link href={section.href} key={section.href} className={styles.workspaceCard}>
            <div className={styles.workspaceTop}><span className={styles.workspaceIcon}>{section.icon}</span><span className={styles.workspaceNumber}>{section.number}</span></div>
            <h3>{section.title}</h3><p>{section.description}</p>
            <span className={styles.workspaceAction}>{section.action}<span>→</span></span>
          </Link>
        ))}
      </div>
      <div className={styles.helpPanel}><span className={styles.helpIcon}>i</span><div><strong>Not sure where to begin?</strong><p>Start with Aircraft & folders to organise the library, then use Upload documents to add your PDFs. Viewer access is managed separately.</p></div></div>
    </AdminShell>
  );
}
