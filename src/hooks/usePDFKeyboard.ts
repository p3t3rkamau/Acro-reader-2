import { useEffect } from 'react';
import type { PDFEngine } from '@/lib/pdf/PDFEngine';

const isTextInput = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));

/**
 * Reader shortcuts. Ignored while typing in a field. Arrow keys and Space are left to the
 * browser: the scroll container is focusable, so native scrolling already handles them.
 */
export function usePDFKeyboard(engine: PDFEngine | null): void {
  useEffect(() => {
    if (!engine) return;
    const onKey = (e: KeyboardEvent) => {
      if (isTextInput(e.target)) return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && (e.key === '+' || e.key === '=')) { e.preventDefault(); engine.zoomStep(1); }
      else if (mod && (e.key === '-' || e.key === '_')) { e.preventDefault(); engine.zoomStep(-1); }
      else if (mod && e.key === '0') { e.preventDefault(); engine.setScale(1); }
      else if (e.altKey && e.key === 'ArrowLeft') { e.preventDefault(); engine.goBack(); }
      else if (!mod && !e.altKey && e.key === 'PageDown') { e.preventDefault(); engine.nextPage(); }
      else if (!mod && !e.altKey && e.key === 'PageUp') { e.preventDefault(); engine.previousPage(); }
      else if (!mod && e.key === 'Home') { e.preventDefault(); engine.goToPage(1); }
      else if (!mod && e.key === 'End') { e.preventDefault(); engine.goToPage(engine.numPages); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [engine]);
}
