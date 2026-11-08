import { useEffect } from 'react';
import type { PDFEngine } from '@/lib/pdf/PDFEngine';

/** Anything the user can operate inside a page: PDF buttons, links, form widgets, inputs. */
const INTERACTIVE = 'a, button, input, select, textarea, label, .annotationLayer section';
/** Things that mean "the user is selecting or reading text", so dragging must not pan. */
const TEXTY = '.textLayer span, .textLayer br';

interface Options {
  /** A single tap on empty page area (used to show/hide toolbars on phones). */
  onSingleTap?: () => void;
}

const isInteractive = (t: EventTarget | null) => t instanceof Element && !!t.closest(INTERACTIVE);

/**
 * Pointer/touch/wheel input for the reading surface.
 *
 *  - Two-finger pinch: live zoom around the fingers' midpoint, plus two-finger panning.
 *  - Double-tap: toggle fit-width <-> zoomed in at the tapped point.
 *  - Ctrl/Cmd + wheel (and trackpad pinch, which browsers send as ctrl+wheel): zoom at cursor.
 *  - Mouse drag: pan the page when it is zoomed in wider than the screen.
 *
 * One-finger scrolling is left entirely to the browser (native momentum, no lag). Taps on
 * PDF buttons/links are never intercepted, so interactive elements always get their click.
 */
export function usePDFGestures(engine: PDFEngine | null, container: HTMLDivElement | null, opts: Options): void {
  const { onSingleTap } = opts;

  useEffect(() => {
    if (!engine || !container) return;
    const el = container;

    // -------- pinch --------
    let pinch: { startDist: number; startScale: number; cx: number; cy: number } | null = null;
    let suppressTapUntil = 0;
    const dist = (t: TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    const mid = (t: TouchList): [number, number] => [(t[0].clientX + t[1].clientX) / 2, (t[0].clientY + t[1].clientY) / 2];

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        const [cx, cy] = mid(e.touches);
        pinch = { startDist: dist(e.touches), startScale: engine.scale, cx, cy };
        clearTimeout(tapTimer);
        lastTap = null;
      }
    };
    const onTouchMove = (e: TouchEvent) => {
      if (!pinch || e.touches.length !== 2) return;
      e.preventDefault(); // we drive both zoom and pan while two fingers are down
      const [cx, cy] = mid(e.touches);
      el.scrollLeft -= cx - pinch.cx;
      el.scrollTop -= cy - pinch.cy;
      pinch.cx = cx; pinch.cy = cy;
      // Absolute target (not incremental) so PDF.js's 2-decimal rounding cannot eat small moves.
      const target = pinch.startScale * (dist(e.touches) / pinch.startDist);
      engine.zoomBy(target / engine.scale, [cx, cy], 300);
    };
    const onTouchEnd = (e: TouchEvent) => {
      if (pinch && e.touches.length < 2) { pinch = null; suppressTapUntil = Date.now() + 350; }
    };
    // Safari fires its own pinch gesture events; cancel them so the page never zooms natively.
    const stopGesture = (e: Event) => e.preventDefault();

    // -------- tap / double tap --------
    let down: { x: number; y: number; t: number } | null = null;
    let lastTap: { x: number; y: number; t: number } | null = null;
    let tapTimer: ReturnType<typeof setTimeout>;
    let anim = 0;

    const animateZoomTo = (target: number, origin: [number, number]) => {
      cancelAnimationFrame(anim);
      const start = engine.scale;
      const t0 = performance.now();
      const step = (now: number) => {
        const p = Math.min(1, (now - t0) / 180);
        const eased = 1 - (1 - p) ** 3;
        const wanted = start + (target - start) * eased;
        engine.zoomBy(wanted / engine.scale, origin, p < 1 ? 400 : 0);
        if (p < 1) anim = requestAnimationFrame(step);
      };
      anim = requestAnimationFrame(step);
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType === 'mouse') return;
      down = e.isPrimary ? { x: e.clientX, y: e.clientY, t: performance.now() } : null;
    };
    const onPointerUp = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' || !down) return;
      const d = down; down = null;
      const now = performance.now();
      if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 10 || now - d.t > 300) return;
      if (pinch || Date.now() < suppressTapUntil) return;
      if (isInteractive(e.target)) { lastTap = null; return; }
      if (window.getSelection()?.toString()) return;

      if (lastTap && now - lastTap.t < 300 && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 40) {
        clearTimeout(tapTimer);
        lastTap = null;
        if (engine.scaleValue === 'page-width') animateZoomTo(engine.scale * 2.2, [e.clientX, e.clientY]);
        else engine.setScale('page-width');
        return;
      }
      lastTap = { x: e.clientX, y: e.clientY, t: now };
      // Wait out the double-tap window before treating it as a single tap.
      tapTimer = setTimeout(() => { lastTap = null; onSingleTap?.(); }, 300);
    };

    // -------- wheel zoom --------
    const onWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      const unit = e.deltaMode === 1 ? 0.05 : 0.01;
      engine.zoomBy(Math.exp(-e.deltaY * unit), [e.clientX, e.clientY], 150);
    };

    // -------- mouse drag-to-pan when zoomed in --------
    let drag: { x: number; y: number; left: number; top: number } | null = null;
    const onMouseDown = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      if (el.scrollWidth <= el.clientWidth + 1) return;
      const t = e.target as Element;
      if (t.closest(INTERACTIVE) || t.closest(TEXTY)) return;
      drag = { x: e.clientX, y: e.clientY, left: el.scrollLeft, top: el.scrollTop };
      el.setPointerCapture(e.pointerId);
      el.dataset.panning = 'true';
    };
    const onMouseMove = (e: PointerEvent) => {
      if (!drag) return;
      el.scrollLeft = drag.left - (e.clientX - drag.x);
      el.scrollTop = drag.top - (e.clientY - drag.y);
    };
    const endDrag = () => { drag = null; delete el.dataset.panning; };

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd, { passive: true });
    el.addEventListener('touchcancel', onTouchEnd, { passive: true });
    el.addEventListener('gesturestart', stopGesture);
    el.addEventListener('gesturechange', stopGesture);
    el.addEventListener('pointerdown', onPointerDown, { passive: true });
    el.addEventListener('pointerup', onPointerUp, { passive: true });
    el.addEventListener('pointercancel', () => { down = null; }, { passive: true });
    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('pointerdown', onMouseDown);
    el.addEventListener('pointermove', onMouseMove);
    el.addEventListener('pointerup', endDrag);
    el.addEventListener('pointercancel', endDrag);

    return () => {
      clearTimeout(tapTimer);
      cancelAnimationFrame(anim);
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('touchcancel', onTouchEnd);
      el.removeEventListener('gesturestart', stopGesture);
      el.removeEventListener('gesturechange', stopGesture);
      el.removeEventListener('pointerdown', onPointerDown);
      el.removeEventListener('pointerup', onPointerUp);
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('pointerdown', onMouseDown);
      el.removeEventListener('pointermove', onMouseMove);
      el.removeEventListener('pointerup', endDrag);
      el.removeEventListener('pointercancel', endDrag);
    };
  }, [engine, container, onSingleTap]);
}
