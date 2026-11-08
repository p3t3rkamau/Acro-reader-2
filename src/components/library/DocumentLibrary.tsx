import Link from 'next/link';
import { documentLibrary, findLibraryFolder, getLibraryBreadcrumbs, type LibraryFolder } from '@/data/documentLibrary';
import styles from './DocumentLibrary.module.scss';

type Props = { path?: string[] };

function Glyph({ name, size = 20 }: { name: 'folder' | 'plane' | 'book' | 'tools' | 'arrow' | 'chevron' | 'file'; size?: number }) {
  const props = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true as const };
  if (name === 'plane') return <svg {...props}><path d="m2 16 20-8-8-3-3 7-4-2-2 2 5 3-2 4 2 1 4-4" /></svg>;
  if (name === 'book') return <svg {...props}><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v17H6.5A2.5 2.5 0 0 0 4 22zM4 5.5v14A2.5 2.5 0 0 1 6.5 17H20" /></svg>;
  if (name === 'tools') return <svg {...props}><path d="m14 7 3-3 4 4-3 3M3 21l9-9M7 7l4-4 6 6-4 4z" /></svg>;
  if (name === 'file') return <svg {...props}><path d="M6 2h8l5 5v15H6zM14 2v6h5M9 13h7M9 17h7" /></svg>;
  if (name === 'arrow') return <svg {...props}><path d="M5 12h14m-6-6 6 6-6 6" /></svg>;
  if (name === 'chevron') return <svg {...props}><path d="m9 18 6-6-6-6" /></svg>;
  return <svg {...props}><path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v10H3z" /></svg>;
}

function FolderIcon({ title }: { title: string }) {
  if (title === 'Flight Operations') return <Glyph name="book" size={23} />;
  if (title === 'Maintenance') return <Glyph name="tools" size={23} />;
  if (title.startsWith('DASH')) return <Glyph name="plane" size={24} />;
  return <Glyph name="folder" size={23} />;
}

function FolderCard({ folder, href, index }: { folder: LibraryFolder; href: string; index: number }) {
  const count = folder.folders?.length ?? folder.documents?.length ?? 0;
  return (
    <Link className={styles.folderCard} href={href}>
      <span className={styles.folderTop}><span className={styles.folderIcon}><FolderIcon title={folder.title} /></span><span className={styles.index}>{String(index + 1).padStart(2, '0')}</span></span>
      <span className={styles.folderCopy}><strong>{folder.title}</strong><small>{folder.description ?? 'Browse documents in this folder.'}</small></span>
      <span className={styles.folderBottom}><em>{count ? `${count} ${count === 1 ? 'item' : 'items'}` : 'Explore folder'}</em><Glyph name="arrow" size={17} /></span>
    </Link>
  );
}

export default function DocumentLibrary({ path = [], library = documentLibrary }: Props & { library?: LibraryFolder }) {
  const folder = findLibraryFolder(path, library);
  if (!folder) return <main className={styles.page}><div className={styles.empty}><h1>Folder not found</h1><Link href="/">Return to library</Link></div></main>;
  const breadcrumbs = getLibraryBreadcrumbs(path, library);
  const childFolders = folder.folders ?? [];
  const documents = folder.documents ?? [];
  return (
    <main className={styles.page}>
      <header className={styles.header}><Link href="/" className={styles.brand}>ACRO<span>READER</span></Link><Link className={styles.openButton} href="/reader">Open PDF from device <Glyph name="arrow" size={17} /></Link></header>
      <div className={styles.content}>
        <nav className={styles.breadcrumbs} aria-label="Breadcrumb">{breadcrumbs.map((crumb, i) => <span key={crumb.href}>{i > 0 && <Glyph name="chevron" size={14} />}{i === breadcrumbs.length - 1 ? <strong>{crumb.title}</strong> : <Link href={crumb.href}>{crumb.title}</Link>}</span>)}</nav>
        <section className={styles.hero}>
          <div className={styles.heroText}><span className={styles.eyebrow}><i /> AVIATION DOCUMENT PORTAL</span><h1>{path.length ? folder.title : <>Your aviation library.<br /><span>Clear, current, accessible.</span></>}</h1><p>{folder.description}</p>{!path.length && <a href="#aircraft-library" className={styles.heroLink}>Explore aircraft library <Glyph name="arrow" size={18} /></a>}</div>
          <div className={styles.art}><div /><Glyph name="plane" size={104} /><small>DOCUMENTS<br />AT YOUR FINGERTIPS</small></div>
        </section>
        {childFolders.length > 0 && <section className={styles.section} id="aircraft-library"><div className={styles.heading}><div><span>BROWSE THE LIBRARY</span><h2>{path.length ? 'Explore folders' : 'Aircraft families'}</h2><p>Choose a category to continue to the available manuals.</p></div><b>{String(childFolders.length).padStart(2, '0')} <small>ITEMS</small></b></div><div className={styles.grid}>{childFolders.map((child, i) => <FolderCard key={child.slug} folder={child} index={i} href={`/library/${[...path, child.slug].join('/')}`} />)}</div></section>}
        {documents.length > 0 && <section className={styles.section}><div className={styles.heading}><div><span>AVAILABLE ONLINE</span><h2>Published documents</h2></div></div><div className={styles.documents}>{documents.map((doc) => <article className={styles.document} key={doc.id}><Glyph name="file" size={21} /><span><strong>{doc.title}</strong><small>Revision {doc.revision} · Effective {doc.effectiveDate}</small></span><b>{doc.status === 'current' ? 'Current' : 'Superseded'}</b></article>)}</div></section>}
        {!childFolders.length && !documents.length && <div className={styles.empty}><Glyph name="folder" size={28} /><h2>No documents published here yet</h2><p>No published documents were returned for this folder. Check the Payload catalogue and the PAYLOAD_API_URL configuration.</p><Link href="/">Back to aircraft library <Glyph name="arrow" size={16} /></Link></div>}
        <footer className={styles.footer}>© {new Date().getFullYear()} AcroReader <span>AVIATION DOCUMENTATION</span></footer>
      </div>
    </main>
  );
}
