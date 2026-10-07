import { useEffect, useRef } from 'preact/hooks';
import { drawIcon } from '../art/icons';

/** Icono pixel art de 12×12 (de art/icons.ts) escalado sin suavizado. */
export function PixelIcon({ id, size = 2 }: { id: string; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (ref.current) drawIcon(ref.current, id, size);
  }, [id, size]);
  return <canvas ref={ref} class="pixel-icon" style={{ width: 12 * size, height: 12 * size }} />;
}
