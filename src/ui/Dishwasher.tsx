import { useEffect, useRef, useState } from 'preact/hooks';
import { Letters } from './AnimText';
import { MINUTES_PER_POINT } from '../core/game';
import { play } from '../platform/audio';

/**
 * Minijuego "Lavaplatos" (inmigrante): 1 minuto frente al fregadero del diner.
 * Frota el plato hasta quitar la suciedad y arrástralo al escurridor.
 * Cada plato limpio descuenta 10 minutos de la jornada.
 */
const W = 180;
const H = 300;
const GAME_SECONDS = 60;
const PLATE = { x: 78, y: 196, r: 30 };
const RACK = { x: 128, y: 120, w: 46, h: 110 };
const CELL = 3;

type Phase = 'intro' | 'count' | 'play' | 'end';

interface Dirt {
  x: number;
  y: number;
  c: string;
}

interface Bubble {
  x: number;
  y: number;
  r: number;
  life: number;
}

const DIRT_COLORS = ['#7a4a22', '#9b5a2a', '#c8452e', '#d9a23a', '#5e3a1a', '#a3b04a'];

function newDirt(): Dirt[] {
  const dirt: Dirt[] = [];
  const blobs = 6 + Math.floor(Math.random() * 4);
  for (let b = 0; b < blobs; b++) {
    const a = Math.random() * Math.PI * 2;
    const d = Math.random() * (PLATE.r - 8);
    const cx = Math.cos(a) * d;
    const cy = Math.sin(a) * d;
    const size = 2 + Math.floor(Math.random() * 3);
    const c = DIRT_COLORS[Math.floor(Math.random() * DIRT_COLORS.length)];
    for (let i = -size; i <= size; i++)
      for (let j = -size; j <= size; j++) {
        if (i * i + j * j > size * size + 1 || Math.random() < 0.25) continue;
        const x = Math.round(cx / CELL + i);
        const y = Math.round(cy / CELL + j);
        if ((x * CELL) ** 2 + (y * CELL) ** 2 > (PLATE.r - 5) ** 2) continue;
        if (!dirt.some((p) => p.x === x && p.y === y)) dirt.push({ x, y, c });
      }
  }
  return dirt;
}

export function Dishwasher({ onFinish, onClose }: { onFinish: (plates: number) => void; onClose: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [phase, setPhase] = useState<Phase>('intro');
  const [count, setCount] = useState(3);
  const [plates, setPlates] = useState(0);
  const [left, setLeft] = useState(GAME_SECONDS);
  const game = useRef({
    dirt: newDirt(),
    total: 0,
    clean: false,
    dragging: false,
    plate: { x: PLATE.x, y: PLATE.y },
    pointer: null as null | { x: number; y: number },
    bubbles: [] as Bubble[],
    rack: 0,
    stack: 4,
    slideIn: 0,
    lastScrub: 0,
    sparkle: 0,
    t: 0,
  });

  useEffect(() => {
    game.current.total = game.current.dirt.length;
  }, []);

  // Cuenta atrás y reloj de 60 s
  useEffect(() => {
    if (phase === 'count') {
      if (count === 0) {
        setPhase('play');
        play.splash();
        return;
      }
      play.click();
      const t = setTimeout(() => setCount(count - 1), 600);
      return () => clearTimeout(t);
    }
    if (phase === 'play') {
      const started = Date.now();
      const id = setInterval(() => {
        const l = Math.max(0, GAME_SECONDS - Math.floor((Date.now() - started) / 1000));
        setLeft(l);
        if (l === 0) {
          clearInterval(id);
          setPhase('end');
          play.achievement();
        }
      }, 200);
      // Los platos sucios se van acumulando
      const pile = setInterval(() => (game.current.stack = Math.min(9, game.current.stack + 1)), 5000);
      return () => {
        clearInterval(id);
        clearInterval(pile);
      };
    }
  }, [phase, count]);

  // Bucle de dibujo
  useEffect(() => {
    const c = canvas.current!;
    const ctx = c.getContext('2d')!;
    let raf = 0;
    const px = (x: number, y: number, w: number, h: number, col: string) => {
      ctx.fillStyle = col;
      ctx.fillRect(Math.round(x), Math.round(y), w, h);
    };
    const circle = (cx: number, cy: number, r: number, col: string) => {
      ctx.fillStyle = col;
      for (let y = -r; y <= r; y++) {
        const w = Math.floor(Math.sqrt(r * r - y * y));
        ctx.fillRect(Math.round(cx - w), Math.round(cy + y), w * 2 + 1, 1);
      }
    };
    const drawPlate = (x: number, y: number, dirty: Dirt[] | null, shine = 0) => {
      circle(x + 2, y + 3, PLATE.r, 'rgba(0,0,0,0.25)');
      circle(x, y, PLATE.r, '#e9e6dc');
      circle(x, y, PLATE.r - 2, '#f7f5ee');
      circle(x, y, PLATE.r - 7, '#ece8dd');
      circle(x, y, PLATE.r - 8, '#f9f8f3');
      // filete azul de vajilla de diner
      for (let a = 0; a < 64; a++) {
        const ang = (a / 64) * Math.PI * 2;
        px(x + Math.cos(ang) * (PLATE.r - 4), y + Math.sin(ang) * (PLATE.r - 4), 1, 1, '#4f7fc4');
      }
      if (dirty) for (const d of dirty) px(x + d.x * CELL - 1, y + d.y * CELL - 1, CELL, CELL, d.c);
      if (shine > 0) {
        ctx.globalAlpha = shine;
        px(x - 14, y - 16, 6, 2, '#ffffff');
        px(x - 16, y - 14, 2, 6, '#ffffff');
        px(x + 12, y + 8, 3, 3, '#ffffff');
        ctx.globalAlpha = 1;
      }
    };

    const frame = () => {
      const g = game.current;
      g.t++;
      // --- pared de azulejos (subway tiles)
      px(0, 0, W, H, '#cfd6d4');
      for (let y = 0; y < 150; y += 8)
        for (let x = (y / 8) % 2 ? -8 : 0; x < W; x += 16) {
          px(x, y, 16, 8, '#e6ecea');
          px(x, y, 16, 1, '#b5bfbc');
          px(x, y, 1, 8, '#b5bfbc');
          px(x + 2, y + 2, 4, 1, '#f6faf8');
        }
      // ventana con la ciudad de noche/día al fondo
      px(8, 14, 54, 40, '#2b2340');
      px(10, 16, 50, 36, '#1d2a52');
      for (let i = 0; i < 6; i++) px(12 + i * 8, 34 - (i % 3) * 6, 7, 18 + (i % 3) * 6, '#2f2a4a');
      for (let i = 0; i < 14; i++) px(13 + ((i * 7) % 44), 38 + ((i * 5) % 12), 1, 2, '#ffd27a');
      px(34, 16, 2, 36, '#2b2340');
      px(10, 33, 50, 2, '#2b2340');
      // letrero de la cocina
      px(70, 14, 50, 14, '#1d1d24');
      ctx.fillStyle = '#ff4f6d';
      ctx.font = '7px "Press Start 2P"';
      ctx.fillText('KITCHEN', 72, 25);
      // repisa con botes
      px(0, 60, W, 3, '#8a5a33');
      for (let i = 0; i < 5; i++) px(70 + i * 14, 48, 9, 12, ['#c0392b', '#e2a23b', '#2e8b57', '#2f6fb3', '#e8619e'][i]);
      // --- encimera de acero
      px(0, 140, W, H - 140, '#8f969c');
      for (let y = 142; y < H; y += 6) px(0, y, W, 1, '#a5acb1');
      px(0, 140, W, 3, '#c8ced2');
      // fregadero
      px(14, 158, 112, 86, '#5d656c');
      px(18, 162, 104, 78, '#3c4349');
      px(18, 200, 104, 40, '#4f8fb8');
      for (let i = 0; i < 26; i++) px(20 + ((i * 37 + g.t) % 100), 201 + (i % 3), 3, 1, '#9cd2ef');
      // grifo
      px(64, 112, 12, 6, '#c8ced2');
      px(68, 118, 4, 30, '#b6bcc1');
      px(68, 112, 30, 4, '#c8ced2');
      px(94, 112, 4, 14, '#b6bcc1');
      px(92, 108, 8, 4, '#e0e4e7');
      // chorro de agua
      if (phase === 'play') for (let y = 126; y < 196; y += 3) px(95 + ((y + g.t) % 2), y, 2, 2, (y + g.t) % 6 < 3 ? '#bfe6ff' : '#7ec4ef');
      // pila de platos sucios a la izquierda
      for (let i = 0; i < g.stack; i++) {
        px(2, 252 - i * 4, 30, 4, i % 2 ? '#e9e6dc' : '#d8d3c6');
        px(6 + (i % 3) * 6, 252 - i * 4, 4, 1, '#9b5a2a');
      }
      // escurridor
      px(RACK.x, RACK.y, RACK.w, RACK.h, 'rgba(0,0,0,0.12)');
      for (let x = RACK.x; x <= RACK.x + RACK.w; x += 5) px(x, RACK.y + 20, 1, RACK.h - 20, '#6b7278');
      px(RACK.x, RACK.y + RACK.h - 4, RACK.w, 4, '#6b7278');
      for (let i = 0; i < Math.min(g.rack, 14); i++) {
        const x = RACK.x + 3 + (i % 7) * 6;
        const y = RACK.y + RACK.h - 48 - Math.floor(i / 7) * 10;
        px(x, y, 4, 44, '#f4f2ea');
        px(x + 3, y, 1, 44, '#c9c5b8');
        px(x, y + 2, 4, 1, '#4f7fc4');
      }
      ctx.fillStyle = '#2b2a33';
      ctx.font = '6px "Press Start 2P"';
      ctx.fillText('SECADO', RACK.x + 5, RACK.y + 14);

      // --- plato actual
      if (phase === 'play' || phase === 'count' || phase === 'intro') {
        if (g.slideIn > 0) g.slideIn = Math.max(0, g.slideIn - 6);
        const x = g.plate.x - g.slideIn;
        drawPlate(x, g.plate.y, g.dirt, g.clean ? 0.6 + Math.sin(g.t / 4) * 0.4 : 0);
        if (g.clean && !g.dragging) {
          ctx.fillStyle = '#0d5d2c';
          ctx.font = '6px "Press Start 2P"';
          ctx.fillText('¡AL ESCURRIDOR! →', 22, 156 - ((g.t >> 3) % 2));
        }
      }
      // burbujas de espuma
      g.bubbles = g.bubbles.filter((b) => (b.life -= 1) > 0);
      for (const b of g.bubbles) {
        b.y -= 0.4;
        circle(b.x, b.y, b.r, 'rgba(255,255,255,0.85)');
        px(b.x - 1, b.y - 1, 1, 1, '#c9ecff');
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [phase]);

  const toLocal = (e: PointerEvent) => {
    const r = canvas.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
  };

  const onDown = (e: PointerEvent) => {
    if (phase !== 'play') return;
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    const p = toLocal(e);
    const g = game.current;
    g.pointer = p;
    if (g.clean && Math.hypot(p.x - g.plate.x, p.y - g.plate.y) < PLATE.r + 8) g.dragging = true;
  };

  const onMove = (e: PointerEvent) => {
    const g = game.current;
    if (phase !== 'play' || !g.pointer) return;
    const p = toLocal(e);
    if (g.dragging) {
      g.plate.x = p.x;
      g.plate.y = p.y;
      return;
    }
    if (g.clean) return;
    // Frotar: quita la suciedad cerca del dedo
    const lx = (p.x - g.plate.x) / CELL;
    const ly = (p.y - g.plate.y) / CELL;
    const moved = Math.hypot(p.x - g.pointer.x, p.y - g.pointer.y);
    g.pointer = p;
    if (moved < 0.5) return;
    const before = g.dirt.length;
    g.dirt = g.dirt.filter((d) => Math.hypot(d.x - lx, d.y - ly) > 3.2 || Math.random() < 0.35);
    if (g.dirt.length < before && Math.hypot(p.x - g.plate.x, p.y - g.plate.y) < PLATE.r + 4) {
      if (g.bubbles.length < 40) g.bubbles.push({ x: p.x + (Math.random() * 10 - 5), y: p.y + (Math.random() * 10 - 5), r: 1 + Math.floor(Math.random() * 3), life: 30 });
      const now = performance.now();
      if (now - g.lastScrub > 90) {
        play.scrub();
        g.lastScrub = now;
      }
    }
    if (g.dirt.length <= Math.max(2, g.total * 0.06)) {
      g.dirt = [];
      g.clean = true;
      play.coin();
    }
  };

  const onUp = () => {
    const g = game.current;
    g.pointer = null;
    if (!g.dragging) return;
    g.dragging = false;
    const inRack = g.plate.x > RACK.x - 10 && g.plate.y > RACK.y - 10 && g.plate.y < RACK.y + RACK.h + 10;
    if (inRack) {
      play.clink();
      g.rack++;
      setPlates((n) => n + 1);
      g.dirt = newDirt();
      g.total = g.dirt.length;
      g.clean = false;
      g.stack = Math.max(1, g.stack - 1);
      g.slideIn = 60;
    }
    g.plate = { x: PLATE.x, y: PLATE.y };
  };

  return (
    <div class="minigame">
      <div class="mg-head">
        <span class="mg-title">LAVAPLATOS</span>
        <span class={`mg-timer ${left <= 10 ? 'hot' : ''}`}>⏱ {left}s</span>
        <span class="mg-score">🍽 {plates} · −{plates * MINUTES_PER_POINT} min</span>
      </div>
      <canvas ref={canvas} width={W} height={H} class="mg-canvas" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} />
      {phase === 'intro' && (
        <div class="mg-overlay">
          <h3><Letters text="Fregadero del diner" /></h3>
          <p>
            <b>1.</b> Frota el plato con el dedo hasta dejarlo brillante.
            <br />
            <b>2.</b> Arrástralo al escurridor.
            <br />
            Cada plato limpio descuenta <b>{MINUTES_PER_POINT} minutos</b> de tu jornada. Tienes 1 minuto.
          </p>
          <button
            class="btn big-cta"
            onClick={() => {
              setCount(3);
              setPhase('count');
            }}
          >
            ¡A fregar!
          </button>
          <button class="btn secondary" onClick={onClose}>
            Ahora no
          </button>
        </div>
      )}
      {phase === 'count' && <div class="mg-count">{count || '¡YA!'}</div>}
      {phase === 'end' && (
        <div class="mg-overlay">
          <h3><Letters text="¡Tiempo!" /></h3>
          <div class="mg-big">{plates}</div>
          <p>
            platos limpios · tu jornada se acorta <b>{plates * MINUTES_PER_POINT} minutos</b>
          </p>
          <button class="btn big-cta" onClick={() => onFinish(plates)}>
            Volver al diner
          </button>
        </div>
      )}
    </div>
  );
}
