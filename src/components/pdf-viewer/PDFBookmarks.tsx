'use client';
import { useState } from 'react';
import type { OutlineNode } from '@/types/pdf';
import { IconChevronRight, IconClose } from '../ui/Icons';
import styles from './PDFBookmarks.module.scss';

interface Props {
  outline: OutlineNode[] | null;
  mode: 'docked' | 'overlay';
  onSelect: (node: OutlineNode) => void;
  onClose: () => void;
}

/** The document's real bookmark tree. Branches expand/collapse; leaves navigate. */
export function PDFBookmarks({ outline, mode, onSelect, onClose }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setExpanded((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });

  return (
    <aside className={`${styles.panel} ${mode === 'docked' ? styles.docked : styles.overlay}`} aria-label="Bookmarks">
      <header className={styles.head}>
        <h2>Bookmarks</h2>
        <button className={styles.close} onClick={onClose} aria-label="Close bookmarks"><IconClose /></button>
      </header>
      <div className={styles.body}>
        {outline === null && <p className={styles.empty}>Loading bookmarks…</p>}
        {outline?.length === 0 && <p className={styles.empty}>This document has no bookmarks.</p>}
        {outline && outline.length > 0 && (
          <ul className={styles.tree} role="tree" aria-label="Document bookmarks">
            {outline.map((n) => <Node key={n.id} node={n} depth={0} expanded={expanded} toggle={toggle} onSelect={onSelect} />)}
          </ul>
        )}
      </div>
    </aside>
  );
}

interface NodeProps {
  node: OutlineNode; depth: number; expanded: Set<string>;
  toggle: (id: string) => void; onSelect: (n: OutlineNode) => void;
}

function Node({ node, depth, expanded, toggle, onSelect }: NodeProps) {
  const hasChildren = node.children.length > 0;
  const isOpen = expanded.has(node.id);
  return (
    <li role="none">
      <div className={styles.row} style={{ paddingInlineStart: 6 + depth * 16 }}>
        {hasChildren ? (
          <button className={`${styles.twisty} ${isOpen ? styles.open : ''}`} onClick={() => toggle(node.id)}
            aria-label={`${isOpen ? 'Collapse' : 'Expand'} ${node.title}`} aria-expanded={isOpen}>
            <IconChevronRight />
          </button>
        ) : <span className={styles.twistySpace} />}
        <button role="treeitem" aria-expanded={hasChildren ? isOpen : undefined} className={styles.label}
          style={{ fontWeight: node.bold ? 650 : 400, fontStyle: node.italic ? 'italic' : 'normal' }}
          onClick={() => onSelect(node)}>
          {node.title}
        </button>
      </div>
      {hasChildren && isOpen && (
        <ul role="group" className={styles.group}>
          {node.children.map((c) => <Node key={c.id} node={c} depth={depth + 1} expanded={expanded} toggle={toggle} onSelect={onSelect} />)}
        </ul>
      )}
    </li>
  );
}
