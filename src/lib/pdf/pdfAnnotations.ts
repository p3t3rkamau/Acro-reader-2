import type { OutlineNode } from '@/types/pdf';
import type { PdfjsViewerLib } from './pdfLoader';

/** Shape of the items returned by PDFDocumentProxy.getOutline(). */
interface RawOutlineItem {
  title: string;
  bold?: boolean;
  italic?: boolean;
  dest?: unknown;
  url?: string | null;
  items?: RawOutlineItem[];
}

/**
 * Converts PDF.js's outline into our own typed tree, preserving the original hierarchy.
 * Nothing is generated: if the PDF has no bookmarks, the result is an empty array.
 */
export function convertOutline(raw: RawOutlineItem[] | null, prefix = 'o'): OutlineNode[] {
  if (!raw) return [];
  return raw.map((item, i) => {
    const id = `${prefix}-${i}`;
    return {
      id,
      title: item.title?.trim() || 'Untitled',
      dest: item.dest ?? null,
      url: item.url ?? null,
      bold: !!item.bold,
      italic: !!item.italic,
      children: convertOutline(item.items ?? null, id),
    };
  });
}

/**
 * PDFLinkService turns link annotations into navigation:
 *  - GoTo / named destinations / explicit destinations -> scroll to the target page
 *  - Named actions (NextPage, PrevPage, FirstPage, LastPage, GoBack, GoForward)
 *  - URI actions -> real <a href target=_blank> links (http/https/mailto/tel only;
 *    PDF.js drops javascript: and other unsafe schemes)
 */
export function createLinkService(
  lib: PdfjsViewerLib,
  eventBus: InstanceType<PdfjsViewerLib['EventBus']>,
) {
  return new lib.PDFLinkService({
    eventBus,
    externalLinkTarget: lib.LinkTarget.BLANK,
    externalLinkRel: 'noopener noreferrer nofollow',
  });
}
