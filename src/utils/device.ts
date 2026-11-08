import type { LayoutMode } from '@/types/pdf';

/**
 * Layout buckets. "phone" also covers landscape phones (short + touch) so the toolbar
 * never eats a quarter of a 390px-tall screen.
 */
const QUERIES = {
  phone: '(max-width: 639px), (pointer: coarse) and (max-height: 500px)',
  desktop: '(min-width: 1024px)',
} as const;

export function getLayoutMode(): LayoutMode {
  if (typeof window === 'undefined') return 'desktop';
  if (window.matchMedia(QUERIES.phone).matches) return 'phone';
  if (window.matchMedia(QUERIES.desktop).matches) return 'desktop';
  return 'tablet';
}

export function subscribeLayout(cb: () => void): () => void {
  const lists = Object.values(QUERIES).map((q) => window.matchMedia(q));
  lists.forEach((l) => l.addEventListener('change', cb));
  return () => lists.forEach((l) => l.removeEventListener('change', cb));
}

export function isTouchDevice(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;
}
