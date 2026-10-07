import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { Letters } from './AnimText';
import { MINUTES_PER_POINT } from '../core/game';
import { fx, play } from '../platform/audio';
import { drawPortrait, type Mood } from '../art/portrait';
import { Bubble, PopLayer, usePops, useTalk } from './games/stage';
import { glow, hash, lowFx, personOf, txt, useChatter } from './games/scenes-office';
import './dishwasher.css';

/**
 * Minijuego "Lavaplatos" (inmigrante): 1 minuto frente al fregadero del diner.
 * Frota el plato hasta quitar la suciedad y arrástralo al escurridor.
 * Cada plato limpio descuenta 10 minutos de la jornada.
 *
 * La cocina se ve entera: el cocinero asoma por la ventanilla y te mete
 * prisa, por la ventana anochece sobre la ciudad y pasa el tren elevado.
 */
const W = 180;
const H = 350;
const GAME_SECONDS = 60;
const PLATE = { x: 78, y: 246, r: 30 };
const RACK = { x: 128, y: 170, w: 46, h: 110 };
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

interface Drip {
  x: number;
  y: number;
  v: number;
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

const mix = (a: string, b: string, k: number) => {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (s: number) => Math.round(((pa >> s) & 255) * (1 - k) + ((pb >> s) & 255) * k);
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
};
const DUSK = ['#f2a65a', '#e0806a', '#b0607a', '#6a4a7a'];
const NIGHT = ['#0a0e2a', '#101640', '#18204e', '#202a5a'];

const BOSS_IDLE = [
  '¡Más rápido, que se acaban los platos!',
  'En este diner no se para, chaval.',
  '¡Que el turno de noche viene con hambre!',
  'Frota bien, que viene el de Sanidad.',
  '¡Oído cocina! Dos de huevos con beicon.',
  '¡Ese plato tiene más grasa que mi delantal!',
  'Mira cómo anochece… ¡y tú sin acabar!',
];
const BOSS_STREAK = ['¡Así me gusta!', '¡Eres una máquina, chaval!', '¡Reluciente! Como en el Plaza.', '¡Con esas manos, te subo el sueldo! Es broma.'];
const BOSS_PILE = ['¡Se nos amontonan! ¡Venga, venga!', '¡Esa pila llega al techo!', '¡Que no tengo platos para servir!'];

export function Dishwasher({ onFinish, onClose }: { onFinish: (plates: number) => void; onClose: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [phase, setPhase] = useState<Phase>('intro');
  const [count, setCount] = useState(3);
  const [plates, setPlates] = useState(0);
  const [left, setLeft] = useState(GAME_SECONDS);
  const boss = useMemo(() => personOf(1955, { wear: 'uniforme', outfit: '#e8e4d8', hair: 'calvo', mustache: true, skin: '#c18a5c', pitch: 140 }), []);
  const talk = useTalk(boss);
  const speak = useChatter(talk, phase === 'play', BOSS_IDLE, [7, 10]);
  const bossState = useRef<{ talking: boolean; mood: Mood }>({ talking: false, mood: 'normal' });
  bossState.current = { talking: talk.talking, mood: talk.mood };
  const { pops, pop } = usePops();
  const game = useRef({
    dirt: newDirt(),
    total: 0,
    clean: false,
    dragging: false,
    plate: { x: PLATE.x, y: PLATE.y },
    pointer: null as null | { x: number; y: number },
    bubbles: [] as Bubble[],
    drips: [] as Drip[],
    rack: 0,
    stack: 4,
    slideIn: 0,
    lastScrub: 0,
    sparkle: 0,
    t: 0,
    started: 0,
    pileWarn: 0,
  });

  useEffect(() => {
    game.current.total = game.current.dirt.length;
  }, []);

  // Cuenta atrás y reloj de 60 s
  useEffect(() => {
    if (phase === 'count') {
      if (count === 3) speak('¡A fregar, que hay cola de platos!', 'normal', true);
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
      game.current.started = performance.now();
      let warned = false;
      const id = setInterval(() => {
        const l = Math.max(0, GAME_SECONDS - Math.floor((Date.now() - started) / 1000));
        setLeft(l);
        if (l === 10 && !warned) {
          warned = true;
          speak('¡Diez segundos! ¡Aprieta, chaval!', 'nervios', true);
        }
        if (l === 0) {
          clearInterval(id);
          setPhase('end');
          play.achievement();
        }
      }, 200);
      // Los platos sucios se van acumulando
      const pile = setInterval(() => {
        const g = game.current;
        g.stack = Math.min(9, g.stack + 1);
        if (g.stack >= 7 && performance.now() - g.pileWarn > 9000) {
          g.pileWarn = performance.now();
          speak(BOSS_PILE, 'enfado');
        }
      }, 5000);
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
    let blinkAt = performance.now() + 2000;
    let trainPass = -1;
    const low = lowFx();
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
    const star = (x: number, y: number, s: number, col: string) => {
      px(x - s, y, s * 2 + 1, 1, col);
      px(x, y - s, 1, s * 2 + 1, col);
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

    const frame = (now: number) => {
      const g = game.current;
      g.t++;
      const T = now / 1000;
      // anochece durante la partida
      const prog = phase === 'play' ? Math.min(1, (now - g.started) / (GAME_SECONDS * 1000)) : phase === 'end' ? 1 : 0;
      // --- pared de azulejos (subway tiles)
      px(0, 0, W, H, '#cfd6d4');
      for (let y = 0; y < 196; y += 8)
        for (let x = (y / 8) % 2 ? -8 : 0; x < W; x += 16) {
          px(x, y, 16, 8, '#e6ecea');
          px(x, y, 16, 1, '#b5bfbc');
          px(x, y, 1, 8, '#b5bfbc');
          px(x + 2, y + 2, 4, 1, '#f6faf8');
        }
      // franja de azulejos verdes
      for (let x = 0; x < W; x += 8) px(x, 132, 8, 4, (x / 8) % 2 ? '#2e8b57' : '#3fa86a');

      // --- ventanilla del comedor con el cocinero
      px(2, 2, 76, 12, '#8a5a33');
      for (let i = 0; i < 4; i++) {
        const tx = 8 + i * 17;
        const sway = Math.round(Math.sin(T * 2 + i) * 0.6);
        px(tx + sway, 6, 12, 14, '#fffbe6');
        px(tx + 2 + sway, 9, 8, 1, '#8a8a9a');
        px(tx + 2 + sway, 12, 6, 1, '#8a8a9a');
        px(tx + 2 + sway, 15, 7, 1, '#c0392b');
      }
      px(4, 20, 72, 60, '#9aa0a6');
      px(6, 22, 68, 54, '#f2d6a0');
      px(6, 22, 68, 18, '#e8c88a');
      // comedor: lámpara, reservado rojo y clientes al fondo
      px(38, 22, 1, 6, '#3a3a44');
      px(34, 28, 9, 3, '#2e8b57');
      glow(ctx, 38, 32, 18, '#ffe9a8', 0.45);
      px(6, 52, 68, 24, '#c0392b');
      px(6, 52, 68, 2, '#e05a4a');
      for (const [hx, hc] of [[12, '#4a2e1c'], [62, '#d8b45e']] as [number, string][]) {
        circle(hx, 46, 4, hc);
        px(hx - 5, 50, 10, 8, '#2f6fb3');
      }
      // el jefe de cocina
      const bs = bossState.current;
      const blink = now > blinkAt;
      if (now > blinkAt + 130) blinkAt = now + 1800 + Math.random() * 3000;
      const mouth = bs.talking ? ([1, 2, 1, 0] as const)[Math.floor(now / 85) % 4] : 0;
      const bob = bs.talking ? Math.round(Math.sin(now / 90)) : 0;
      drawPortrait(ctx, boss, { mouth, blink, mood: bs.mood }, 24, 32 + bob);
      // gorro de cocinero
      px(30, 26 + bob, 20, 8, '#ffffff');
      px(28, 20 + bob, 24, 8, '#ffffff');
      px(30, 33 + bob, 20, 2, '#d8d8e0');
      // repisa de la ventanilla con timbre
      px(2, 72, 76, 8, '#c8ced2');
      px(2, 72, 76, 1, '#eef2f4');
      px(2, 79, 76, 1, '#6b7278');
      circle(66, 70, 3, '#c9a24a');
      px(66, 66, 1, 2, '#c9a24a');

      // --- ventana: la ciudad anochece y pasa el tren elevado
      const wx = 94;
      const wy = 8;
      const ww = 80;
      const wh = 66;
      px(wx - 3, wy - 3, ww + 6, wh + 6, '#6b4a2a');
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = mix(DUSK[i], NIGHT[i], prog);
        ctx.fillRect(wx, wy + (i * wh) / 4, ww, wh / 4 + 1);
      }
      if (prog > 0.35) {
        ctx.globalAlpha = Math.min(1, (prog - 0.35) * 3);
        circle(wx + 64, wy + 12, 5, '#f4f0d8');
        circle(wx + 62, wy + 11, 4, mix(DUSK[0], NIGHT[0], prog));
        for (let i = 0; i < 8; i++) if (Math.sin(T * 2 + i * 3) > -0.5) px(wx + hash(i) * ww, wy + hash(i * 7) * 22, 1, 1, '#ffffff');
        ctx.globalAlpha = 1;
      } else circle(wx + 20, wy + 34 + prog * 40, 7, '#ffd27a');
      const bcol = mix('#5a4a6a', '#141830', prog);
      const blds: [number, number, number][] = [[0, 30, 14], [14, 18, 12], [26, 38, 16], [42, 24, 12], [54, 34, 14], [68, 20, 12]];
      blds.forEach(([bx, top, bw], bi) => {
        px(wx + bx, wy + top, bw, wh - top, bcol);
        for (let y = wy + top + 3; y < wy + wh - 4; y += 4)
          for (let x = wx + bx + 2; x < wx + bx + bw - 1; x += 3) {
            const k = bi * 100 + x * 7 + y;
            if (hash(k) < 0.15 + prog * 0.6) px(x, y, 1, 2, hash(k * 3) < 0.85 ? '#ffd27a' : '#9fd0ff');
          }
      });
      // rótulo de neón EAT
      const eatOn = Math.floor(T * 1.5) % 4 !== 3;
      px(wx + 44, wy + 30, 15, 8, '#14101f');
      txt(ctx, 'EAT', wx + 46, wy + 32, eatOn ? '#ff4f6d' : '#5a1a2a');
      if (eatOn && prog > 0.2) glow(ctx, wx + 51, wy + 34, 10, '#ff4f6d', 0.4 * prog);
      // vía y tren elevado
      px(wx, wy + 48, ww, 3, '#2a2a30');
      for (let x = wx + 4; x < wx + ww; x += 14) px(x, wy + 51, 2, 15, '#2a2a30');
      const cyc = (T % 9) / 9;
      const tx = wx + ww + 10 - cyc * (ww + 140);
      ctx.save();
      ctx.beginPath();
      ctx.rect(wx, wy, ww, wh);
      ctx.clip();
      for (let k = 0; k < 3; k++) {
        const cx = tx + k * 36;
        px(cx, wy + 38, 34, 10, '#8a9098');
        px(cx, wy + 38, 34, 1, '#b8bec4');
        for (let w2 = 0; w2 < 5; w2++) px(cx + 3 + w2 * 6, wy + 40, 4, 4, prog > 0.4 ? '#ffe9a8' : '#3a4a6a');
        px(cx + 2, wy + 47, 30, 1, '#c0392b');
      }
      ctx.restore();
      if (cyc > 0.5 && trainPass !== Math.floor(T / 9)) {
        trainPass = Math.floor(T / 9);
        if (phase === 'play' && !low) fx.whoosh();
      }
      // marco y cruz de la ventana
      px(wx + ww / 2 - 1, wy, 2, wh, '#6b4a2a');
      px(wx, wy + wh / 2 - 1, ww, 2, '#6b4a2a');
      px(wx - 4, wy + wh + 2, ww + 8, 4, '#8a5a33');

      // letrero de la cocina y reloj
      px(100, 82, 50, 14, '#1d1d24');
      ctx.fillStyle = '#ff4f6d';
      ctx.font = '7px "Press Start 2P"';
      ctx.fillText('KITCHEN', 102, 93);
      circle(164, 100, 9, '#14101f');
      circle(164, 100, 8, '#fffbe6');
      const ang = (prog * 2 + 0.75) * Math.PI * 2;
      px(164, 100, 1, 1, '#14101f');
      for (let i = 1; i < 6; i++) px(164 + Math.cos(ang) * i, 100 + Math.sin(ang) * i, 1, 1, '#14101f');
      for (let i = 1; i < 4; i++) px(164 + Math.cos(ang / 12 - 1) * i, 100 + Math.sin(ang / 12 - 1) * i, 1, 1, '#c0392b');
      // repisa con botes y cazos colgados
      px(0, 112, 92, 3, '#8a5a33');
      for (let i = 0; i < 6; i++) px(4 + i * 14, 100, 9, 12, ['#c0392b', '#e2a23b', '#2e8b57', '#2f6fb3', '#e8619e', '#c8b48a'][i]);
      for (let i = 0; i < 6; i++) px(5 + i * 14, 100, 7, 2, '#f4efe2');
      for (const [hx, r] of [[104, 7], [122, 9], [142, 6]] as [number, number][]) {
        const sw = Math.round(Math.sin(T * 1.2 + hx) * 1);
        px(hx + sw, 104, 1, 6, '#6b7278');
        circle(hx + sw, 112 + r, r, '#3a3a44');
        circle(hx + sw, 112 + r, r - 2, '#5a5a66');
        px(hx + sw - r + 2, 110 + r, 2, 2, '#9aa0a6');
      }

      // --- encimera de acero
      px(0, 190, W, H - 190, '#8f969c');
      for (let y = 192; y < H; y += 6) px(0, y, W, 1, '#a5acb1');
      px(0, 190, W, 3, '#c8ced2');
      // fregadero
      px(14, 208, 112, 86, '#5d656c');
      px(18, 212, 104, 78, '#3c4349');
      px(18, 250, 104, 40, '#4f8fb8');
      for (let i = 0; i < 26; i++) px(20 + ((i * 37 + g.t) % 100), 251 + (i % 3), 3, 1, '#9cd2ef');
      // grifo
      px(64, 162, 12, 6, '#c8ced2');
      px(68, 168, 4, 30, '#b6bcc1');
      px(68, 162, 30, 4, '#c8ced2');
      px(94, 162, 4, 14, '#b6bcc1');
      px(92, 158, 8, 4, '#e0e4e7');
      // chorro de agua
      if (phase === 'play') for (let y = 176; y < 246; y += 3) px(95 + ((y + g.t) % 2), y, 2, 2, (y + g.t) % 6 < 3 ? '#bfe6ff' : '#7ec4ef');
      // jabón, estropajo y la radio del friegaplatos
      px(132, 296, 10, 18, '#2e8b57');
      px(134, 292, 6, 4, '#3fa86a');
      px(136, 288, 2, 4, '#e8e4d8');
      px(133, 300, 3, 8, '#7ad09a');
      px(104, 308, 16, 7, '#e2c23a');
      px(104, 308, 16, 3, '#2e8b57');
      px(150, 312, 26, 16, '#6b3f22');
      px(152, 314, 12, 12, '#3a2a1a');
      for (let y = 315; y < 326; y += 2) px(153, y, 10, 1, '#8a6a4a');
      px(166, 315, 7, 3, '#e8d8a8');
      px(168, 320, 3, 3, '#c9a24a');
      px(170, 304, 1, 8, '#9aa0a6');
      if (phase === 'play' && !low)
        for (let i = 0; i < 2; i++) {
          const k = (T * 0.6 + i / 2) % 1;
          ctx.globalAlpha = 1 - k;
          txt(ctx, i ? '*' : '+', 156 + i * 8 + Math.sin(T * 3 + i) * 3, 304 - k * 20, i ? '#ff4f9a' : '#2f6fb3');
        }
      ctx.globalAlpha = 1;
      // pila de platos sucios a la izquierda
      for (let i = 0; i < g.stack; i++) {
        px(2, 302 - i * 4, 30, 4, i % 2 ? '#e9e6dc' : '#d8d3c6');
        px(6 + (i % 3) * 6, 302 - i * 4, 4, 1, '#9b5a2a');
      }
      if (g.stack >= 7) {
        const fx2 = 16 + Math.sin(T * 7) * 10;
        const fy = 302 - g.stack * 4 - 8 + Math.cos(T * 11) * 5;
        px(fx2, fy, 2, 1, '#14101f');
        px(fx2, fy - 1, 1, 1, g.t % 4 < 2 ? '#c8d8ff' : '#14101f');
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
        if (!low && Math.random() < 0.012 && g.drips.length < 12) g.drips.push({ x: x + 1, y: y + 44, v: 0 });
      }
      g.drips = g.drips.filter((d) => (d.y += (d.v += 0.08)) < RACK.y + RACK.h);
      for (const d of g.drips) px(d.x, d.y, 1, 2, '#7ec4ef');
      ctx.fillStyle = '#2b2a33';
      ctx.font = '6px "Press Start 2P"';
      ctx.fillText('SECADO', RACK.x + 5, RACK.y + 14);

      // vapor del agua caliente
      if (!low)
        for (let i = 0; i < 7; i++) {
          const k = (T * 0.25 + i / 7) % 1;
          glow(ctx, 24 + ((i * 41) % 92) + Math.sin(T * 0.8 + i) * 6, 248 - k * 80, 6 + k * 12, '#ffffff', 0.32 * Math.sin(k * Math.PI));
        }

      // --- plato actual
      if (phase === 'play' || phase === 'count' || phase === 'intro') {
        if (g.slideIn > 0) g.slideIn = Math.max(0, g.slideIn - 6);
        const x = g.plate.x - g.slideIn;
        drawPlate(x, g.plate.y, g.dirt, g.clean ? 0.6 + Math.sin(g.t / 4) * 0.4 : 0);
        if (g.clean) {
          for (let i = 0; i < 4; i++) {
            const a = T * 2 + i * 1.6;
            const tw = Math.floor(T * 6 + i) % 3;
            star(x + Math.cos(a) * (PLATE.r + 6), g.plate.y + Math.sin(a) * (PLATE.r + 4), tw, '#fffbe6');
          }
          if (!g.dragging) {
            ctx.fillStyle = '#0d5d2c';
            ctx.font = '6px "Press Start 2P"';
            ctx.fillText('¡AL ESCURRIDOR! →', 22, 206 - ((g.t >> 3) % 2));
          }
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
      pop('¡Reluciente!', (PLATE.x / W) * 100, ((PLATE.y - 40) / H) * 100, 'gold');
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
      pop('+1 🍽', ((RACK.x + RACK.w / 2) / W) * 100, (RACK.y / H) * 100, 'good');
      if (g.rack % 3 === 0) {
        fx.bell();
        speak(BOSS_STREAK, 'feliz');
      }
      g.dirt = newDirt();
      g.total = g.dirt.length;
      g.clean = false;
      g.stack = Math.max(1, g.stack - 1);
      g.slideIn = 60;
    }
    g.plate = { x: PLATE.x, y: PLATE.y };
  };

  return (
    <div class="minigame mg-dishes">
      <div class="mg-head">
        <span class="mg-title">LAVAPLATOS</span>
        <span class={`mg-timer ${left <= 10 ? 'hot' : ''}`}>⏱ {left}s</span>
        <span class="mg-score">🍽 {plates} · −{plates * MINUTES_PER_POINT} min</span>
      </div>
      <div class="dw-stage">
        <div class="dw-box">
          <canvas ref={canvas} width={W} height={H} class="dw-canvas" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} />
          <div class="dw-say">
            <Bubble text={talk.line} k={talk.key} side="left" speed={44} />
          </div>
          <PopLayer pops={pops} />
        </div>
      </div>
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
