import { useRef, useState, type CSSProperties, type MouseEvent, type PointerEvent } from 'react';

/**
 * Drag-or-tap moving. Every draggable object is a <button data-obj="id"> and every
 * destination a <button data-zone="id">:
 *  - drag an object and release over a zone → move it there;
 *  - or tap/click (or press Enter on) an object to select it, then tap a zone.
 * No gesture depends on dragging alone.
 */
export function useDragOrTap(onDrop: (obj: string, zone: string) => void, enabled = true) {
  const [selected, setSelected] = useState<string | null>(null);
  const [drag, setDrag] = useState<{ id: string; dx: number; dy: number } | null>(null);
  const start = useRef<{ id: string; x: number; y: number; moved: boolean } | null>(null);
  const justDragged = useRef(false);

  const objProps = (id: string) => ({
    'data-obj': id,
    'aria-pressed': selected === id,
    style: (drag?.id === id ? { transform: `translate(${drag.dx}px, ${drag.dy}px)`, zIndex: 20, position: 'relative' } : undefined) as CSSProperties | undefined,
    onPointerDown: (e: PointerEvent) => {
      if (!enabled || e.button > 0) return;
      // a drag whose element was removed on drop never receives its trailing click
      justDragged.current = false;
      start.current = { id, x: e.clientX, y: e.clientY, moved: false };
      (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    },
    onPointerMove: (e: PointerEvent) => {
      const s = start.current;
      if (!s || s.id !== id) return;
      if (!s.moved && Math.hypot(e.clientX - s.x, e.clientY - s.y) > 12) s.moved = true;
      if (s.moved) setDrag({ id, dx: e.clientX - s.x, dy: e.clientY - s.y });
    },
    onPointerUp: (e: PointerEvent) => {
      const s = start.current;
      start.current = null;
      setDrag(null);
      if (!s || !enabled || !s.moved) return;
      justDragged.current = true;
      const el = document.elementsFromPoint(e.clientX, e.clientY).find((n) => (n as HTMLElement).dataset?.zone);
      const zone = (el as HTMLElement | undefined)?.dataset.zone;
      if (zone) {
        onDrop(id, zone);
        setSelected(null);
      }
    },
    onPointerCancel: () => {
      start.current = null;
      setDrag(null);
    },
    onClick: () => {
      if (justDragged.current) {
        justDragged.current = false;
        return;
      }
      if (!enabled) return;
      setSelected((cur) => (cur === id ? null : id));
    },
  });

  const zoneProps = (zone: string) => ({
    'data-zone': zone,
    onClick: (e: MouseEvent) => {
      // clicks on an object inside the zone select that object instead
      if ((e.target as HTMLElement).closest?.('[data-obj]')) return;
      if (!enabled || !selected) return;
      onDrop(selected, zone);
      setSelected(null);
    },
  });

  return { selected, setSelected, objProps, zoneProps };
}
