import Link from 'next/link';
import { ArrowRight, BookOpen, ChevronRight, FileText, Folder, Plane, Wrench } from 'lucide-react';
import { documentLibrary, findLibraryFolder, getLibraryBreadcrumbs, type LibraryFolder } from '@/data/documentLibrary';
import styles from './DocumentLibrary.module.scss';

type Props = { path?: string[] };

function FolderIcon({ title }: { title: string }) {
  if (title === 'Flight Operations') return <BookOpen size={23} />;
  if (title === 'Maintenance') return <Wrench size={23} />;
  if (title.startsWith('DASH')) return <Plane size={24} />;
  return <Folder size={23} />;
}

function FolderCard({ folder, href, index }: { folder: LibraryFolder; href: string; index: number }) {
  const count = folder.folders?.length ?? folder.documents?.length ?? 0;
  return (
    <Link className={styles.folderCard} href={href}>
      <span className={styles.folderTop}><span className={styles.folderIcon}><FolderIcon title={folder.title} /></span><span className={styles.index}>{String(index + 1).padStart(2, '0')}</span></span>
      <span className={styles.folderCopy}><strong>{folder.title}</strong><small>{folder.description ?? 'Browse documents in this folder.'}</small></span>
      <span className={styles.folderBottom}><em>{count ? `${count} ${count === 1 ? 'item' : 'items'}` : 'Explore folder'}</em><ArrowRight size={17} /></span>
    </Link>
  );
}

export default function DocumentLibrary({ path = [] }: Props) {
  const folder = findLibraryFolder(path);
  if (!folder) return <main className={styles.page}><div className={styles.empty}><h1>Folder not found</h1><Link href="/">Return to library</Link></div></main>;
  const breadcrumbs = getLibraryBreadcrumbs(path);
  const childFolders = folder.folders ?? [];
  const documents = folder.documents ?? [];
  return (
    <main className={styles.page}>
      <header className={styles.header}><Link href="/" className={styles.brand}>ACRO<span>READER</span></Link><Link className={styles.openButton} href="/reader">Open PDF from device <ArrowRight size={17} /></Link></header>
      <div className={styles.content}>
        <nav className={styles.breadcrumbs} aria-label="Breadcrumb">{breadcrumbs.map((crumb, i) => <span key={crumb.href}>{i > 0 && <ChevronRight size={14} />}{i === breadcrumbs.length - 1 ? <strong>{crumb.title}</strong> : <Link href={crumb.href}>{crumb.title}</Link>}</span>)}</nav>
        <section className={styles.hero}>
          <div className={styles.heroText}><span className={styles.eyebrow}><i /> AVIATION DOCUMENT PORTAL</span><h1>{path.length ? folder.title : <>Your aviation library.<br /><span>Clear, current, accessible.</span></>}</h1><p>{folder.description}</p>{!path.length && <a href="#aircraft-library" className={styles.heroLink}>Explore aircraft library <ArrowRight size={18} /></a>}</div>
          <div className={styles.art}><div /><Plane size={104} strokeWidth={0.8} /><small>DOCUMENTS<br />AT YOUR FINGERTIPS</small></div>
        </section>
        {childFolders.length > 0 && <section className={styles.section} id="aircraft-library"><div className={styles.heading}><div><span>BROWSE THE LIBRARY</span><h2>{path.length ? 'Explore folders' : 'Aircraft families'}</h2><p>Choose a category to continue to the available manuals.</p></div><b>{String(childFolders.length).padStart(2, '0')} <small>ITEMS</small></b></div><div className={styles.grid}>{childFolders.map((child, i) => <FolderCard key={child.slug} folder={child} index={i} href={`/library/${[...path, child.slug].join('/')}`} />)}</div></section>}
        {documents.length > 0 && <section className={styles.section}><div className={styles.heading}><div><span>AVAILABLE ONLINE</span><h2>Published documents</h2></div></div><div className={styles.documents}>{documents.map((doc) => <a className={styles.document} key={doc.id} href={`/reader?url=${encodeURIComponent(doc.fileUrl)}&title=${encodeURIComponent(doc.title)}`}><FileText size={21} /><span><strong>{doc.title}</strong><small>Revision {doc.revision} · Effective {doc.effectiveDate}</small></span><b>{doc.status === 'current' ? 'Current' : 'Superseded'}</b><ArrowRight size={18} /></a>)}</div></section>}
        {!childFolders.length && !documents.length && <div className={styles.empty}><Folder size={28} /><h2>No documents published here yet</h2><p>This folder is ready for published manuals. Documents will appear here when connected to the catalogue.</p><Link href="/">Back to aircraft library <ArrowRight size={16} /></Link></div>}
        <footer className={styles.footer}>© {new Date().getFullYear()} AcroReader <span>AVIATION DOCUMENTATION</span></footer>
      </div>
    </main>
  );
}
