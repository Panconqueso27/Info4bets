import { useEffect, useRef } from 'preact/hooks';
import { CHAR_H, CHAR_W, drawCharacter } from '../art/character';
import type { Look } from '../core/types';

/** Vista previa del personaje en pixel art, escalada sin suavizado. */
export function CharacterCanvas({ look, scale = 4, walk = false }: { look: Look; scale?: number; walk?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (!ctx) return;
    let frame = 0;
    const draw = () => {
      ctx.clearRect(0, 0, CHAR_W, CHAR_H);
      drawCharacter(ctx, look, walk ? [1, 0, 2, 0][frame % 4] : 0);
    };
    draw();
    if (!walk) return;
    const id = setInterval(() => {
      frame++;
      draw();
    }, 170);
    return () => clearInterval(id);
  }, [look, walk]);

  return (
    <canvas
      ref={ref}
      width={CHAR_W}
      height={CHAR_H}
      style={{ width: CHAR_W * scale, height: CHAR_H * scale, imageRendering: 'pixelated' }}
    />
  );
}
