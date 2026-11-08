/** Where the reader was before a jump, so "Back" can return the user there. */
export interface SavedPosition {
  pageNumber: number;
  scrollTop: number;
  scrollLeft: number;
  scale: number;
  scaleValue: string;
}

/**
 * Back stack for jumps made by buttons, links and bookmarks. Acrobat's "Previous View".
 * Essential for button-heavy documents: tap a checklist link, read it, go back.
 */
export class PositionHistory {
  private stack: SavedPosition[] = [];
  constructor(private readonly limit = 100) {}

  get size(): number { return this.stack.length; }

  push(pos: SavedPosition): void {
    const top = this.stack[this.stack.length - 1];
    // Ignore duplicate pushes (some actions notify twice).
    if (top && top.pageNumber === pos.pageNumber && Math.abs(top.scrollTop - pos.scrollTop) < 2) return;
    this.stack.push(pos);
    if (this.stack.length > this.limit) this.stack.shift();
  }

  pop(): SavedPosition | undefined { return this.stack.pop(); }
  clear(): void { this.stack = []; }
}

/** Parses text typed in the page box. Returns null when it is not a valid page. */
export function parsePageInput(text: string, numPages: number): number | null {
  const trimmed = text.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const n = Number(trimmed);
  return n >= 1 && n <= numPages ? n : null;
}
