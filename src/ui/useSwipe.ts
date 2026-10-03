import { useRef, useState } from 'preact/hooks';

export type Dir = 'left' | 'right' | 'up';

const THRESHOLD = 95;

/**
 * Arrastre con el dedo o el ratón. Devuelve el desplazamiento actual, la
 * dirección que se elegiría al soltar y los manejadores de puntero.
 */
export function useSwipe(opts: { allowUp: boolean; onRelease: (dir: Dir | null) => void }) {
  const start = useRef<{ x: number; y: number; id: number } | null>(null);
  const [drag, setDrag] = useState({ dx: 0, dy: 0, active: false });

  const dirOf = (dx: number, dy: number, threshold: number): Dir | null => {
    if (opts.allowUp && dy < -threshold && Math.abs(dy) > Math.abs(dx)) return 'up';
    if (dx > threshold) return 'right';
    if (dx < -threshold) return 'left';
    return null;
  };

  const handlers = {
    onPointerDown: (e: PointerEvent) => {
      start.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
      (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
      setDrag({ dx: 0, dy: 0, active: true });
    },
    onPointerMove: (e: PointerEvent) => {
      if (!start.current || start.current.id !== e.pointerId) return;
      setDrag({ dx: e.clientX - start.current.x, dy: Math.min(0, e.clientY - start.current.y) * (opts.allowUp ? 1 : 0.2), active: true });
    },
    onPointerUp: (e: PointerEvent) => {
      if (!start.current || start.current.id !== e.pointerId) return;
      start.current = null;
      const d = dirOf(drag.dx, drag.dy, THRESHOLD);
      setDrag({ dx: 0, dy: 0, active: false });
      opts.onRelease(d);
    },
    onPointerCancel: () => {
      start.current = null;
      setDrag({ dx: 0, dy: 0, active: false });
    },
  };

  /** Dirección "insinuada" (umbral más bajo) para mostrar la etiqueta mientras se arrastra. */
  const hint = dirOf(drag.dx, drag.dy, 30);
  return { drag, hint, handlers };
}
