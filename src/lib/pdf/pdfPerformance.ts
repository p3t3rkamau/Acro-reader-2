/**
 * Device-aware rendering limits.
 *
 * What PDF.js already does for us (and we rely on): the PDFViewer only creates canvases for
 * visible pages, keeps an LRU buffer of recently viewed pages (>= 10), destroys the canvas of
 * pages that fall out of it, and cancels in-flight render tasks when a page leaves the buffer.
 * What we control: the maximum canvas size, which is what actually exhausts memory on phones.
 */
export interface RenderBudget {
  /** Hard cap on pixels per page canvas. PDF.js lowers the render resolution to fit. */
  maxCanvasPixels: number;
  /** Hint for GPU-backed canvases. Off on low-memory devices. */
  enableHWA: boolean;
  tier: 'low' | 'standard' | 'high';
}

export function getRenderBudget(): RenderBudget {
  const nav = navigator as Navigator & { deviceMemory?: number };
  const touch = window.matchMedia('(pointer: coarse)').matches;
  const memory = nav.deviceMemory; // undefined on Safari/Firefox
  const cores = navigator.hardwareConcurrency ?? 4;

  if ((memory !== undefined && memory <= 2) || cores <= 2) {
    return { maxCanvasPixels: 2 ** 23, enableHWA: false, tier: 'low' }; // ~8M px (~32 MB)
  }
  // 2^24 also matches the classic iOS Safari canvas area limit (4096 x 4096).
  if (touch || (memory !== undefined && memory <= 4)) {
    return { maxCanvasPixels: 2 ** 24, enableHWA: true, tier: 'standard' };
  }
  return { maxCanvasPixels: 2 ** 25, enableHWA: true, tier: 'high' };
}
