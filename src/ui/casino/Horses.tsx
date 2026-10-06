import type { JSX } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { randomPerson } from '../../art/portrait';
import { fx, play } from '../../platform/audio';
import { PopLayer, Talker, usePops, useShake, useTalk } from '../games/stage';
import type { CasinoTableProps } from './types';
import { ChipFace } from './Roulette';
import { shortAmount } from './roulette-logic';
import {
  drawOrder,
  fracText,
  makeField,
  planRace,
  progress,
  settleRace,
  standings,
  TRACK_LEN,
  TRACK_METRES,
  type Horse,
  type HorseBet,
  type HorseBetKind,
  type RacePlan,
  type SilkPattern,
} from './horses-logic';
import './horses.css';

/**
 * Carreras de caballos: hipódromo en pixel art con scroll y paralaje,
 * caballos que galopan, polvo, cámara que sigue al que va en cabeza, foto
 * finish y un locutor que narra la carrera.
 */

const lowFx = () => typeof document !== 'undefined' && document.documentElement.classList.contains('lowfx');

// ---------------------------------------------------------------------------
// Utilidades de pixel art
// ---------------------------------------------------------------------------

function shade(hex: string, f: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number) => Math.max(0, Math.min(255, Math.round(f >= 0 ? v + (255 - v) * f : v * (1 + f))));
  return `rgb(${ch((n >> 16) & 255)},${ch((n >> 8) & 255)},${ch(n & 255)})`;
}

const DIGITS: Record<string, string[]> = {
  '0': ['111', '101', '101', '101', '111'],
  '1': ['010', '110', '010', '010', '111'],
  '2': ['111', '001', '111', '100', '111'],
  '3': ['111', '001', '111', '001', '111'],
  '4': ['101', '101', '111', '001', '001'],
  '5': ['111', '100', '111', '001', '111'],
  '6': ['111', '100', '111', '101', '111'],
  '7': ['111', '001', '010', '010', '010'],
  '8': ['111', '101', '111', '101', '111'],
  '9': ['111', '101', '111', '001', '111'],
  M: ['10001', '11011', '10101', '10001', '10001'],
};
function digits(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color: string) {
  ctx.fillStyle = color;
  let cx = x;
  for (const ch of text) {
    const g = DIGITS[ch];
    if (!g) {
      cx += 2;
      continue;
    }
    g.forEach((row, j) => [...row].forEach((b, i) => b === '1' && ctx.fillRect(cx + i, y + j, 1, 1)));
    cx += g[0].length + 1;
  }
}
const digitsW = (t: string) => [...t].reduce((a, ch) => a + (DIGITS[ch]?.[0].length ?? 1) + 1, -1);

const canvas = (w: number, h: number) => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  return [c, ctx] as const;
};

/** Contorno oscuro de 1 px alrededor de lo pintado (a lo sprite de 16 bits). */
function outlined(src: HTMLCanvasElement, color = '#140c08') {
  const [sil, sctx] = canvas(src.width, src.height);
  sctx.drawImage(src, 0, 0);
  sctx.globalCompositeOperation = 'source-in';
  sctx.fillStyle = color;
  sctx.fillRect(0, 0, src.width, src.height);
  const [out, octx] = canvas(src.width, src.height);
  for (const [dx, dy] of [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ])
    octx.drawImage(sil, dx, dy);
  octx.drawImage(src, 0, 0);
  return out;
}

// ---------------------------------------------------------------------------
// Sprites de los caballos
// ---------------------------------------------------------------------------

export const SPR_W = 40;
export const SPR_H = 30;
const FRAMES = 8;
const SKIN = '#e0a878';

function patternPx(pattern: SilkPattern, x: number, y: number): boolean {
  switch (pattern) {
    case 'rayas':
      return x % 2 === 1;
    case 'banda':
      return (x + y) % 4 === 0;
    case 'estrella':
      return (x === 3 && y === 1) || (x === 2 && y === 1) || (x === 4 && y === 1) || (x === 3 && (y === 0 || y === 2));
    case 'cuartos':
      return (x < 3) === (y < 1.5);
    case 'aros':
      return y === 1;
    default:
      return false;
  }
}

function drawLeg(ctx: CanvasRenderingContext2D, hx: number, hy: number, th: number, bend: number, col: string, hoof: string) {
  const L1 = 5;
  const L2 = 5.5;
  const kx = hx + Math.sin(th) * L1;
  const ky = hy + Math.cos(th) * L1;
  const th2 = th - bend;
  const fx_ = kx + Math.sin(th2) * L2;
  const fy = ky + Math.cos(th2) * L2;
  ctx.fillStyle = col;
  for (let s = 0; s <= 1; s += 0.12) {
    ctx.fillRect(Math.round(hx + (kx - hx) * s) - 1, Math.round(hy + (ky - hy) * s), 3, 1);
  }
  for (let s = 0; s <= 1; s += 0.12) {
    ctx.fillRect(Math.round(kx + (fx_ - kx) * s), Math.round(ky + (fy - ky) * s), 2, 1);
  }
  ctx.fillStyle = hoof;
  ctx.fillRect(Math.round(fx_), Math.round(fy), 2, 1);
}

function horseFrame(h: Horse, f: number, idle = false): HTMLCanvasElement {
  const [cv, ctx] = canvas(SPR_W, SPR_H);
  const P = (x: number, y: number, w: number, hh: number, c: string) => {
    ctx.fillStyle = c;
    ctx.fillRect(x, y, w, hh);
  };
  const coat = h.coat;
  const dark = shade(coat, -0.35);
  const light = shade(coat, 0.25);
  const mane = shade(coat, -0.6);
  const ph = (f / FRAMES) * Math.PI * 2;
  const bob = idle ? 0 : [0, -1, -1, 0, 0, 1, 1, 0][f];
  const B = 1 + bob; // desplazamiento vertical del cuerpo
  // patas: [cadera x, desfase, delantera]
  const legs: [number, number, boolean, boolean][] = [
    [13, 0, false, true],
    [27, 2.6, true, true],
  ];
  const near: [number, number, boolean, boolean][] = [
    [12, 0.7, false, false],
    [26, 3.3, true, false],
  ];
  const leg = ([hx, o, front, far]: [number, number, boolean, boolean]) => {
    const a = ph + o;
    const th = idle ? (front ? 0.05 : -0.05) : 0.62 * Math.sin(a) + (front ? 0.1 : -0.05);
    const bend = idle ? 0 : front ? 1.1 * Math.max(0, Math.sin(a - 1.4)) : -0.5 + 0.9 * Math.max(0, Math.sin(a + 1.8));
    drawLeg(ctx, hx, 17 + B, th, bend, far ? dark : coat, '#1a120c');
  };
  legs.forEach(leg);
  // cola
  const tw = idle ? 0 : Math.round(Math.sin(ph) * 1.5);
  P(7, 12 + B, 4, 2, mane);
  P(4, 13 + B + tw, 4, 2, mane);
  P(2, 15 + B + tw, 3, 2, mane);
  P(1, 17 + B + tw * 2, 2, 2, mane);
  // cuerpo
  P(11, 11 + B, 16, 1, coat);
  P(10, 12 + B, 19, 5, coat);
  P(11, 17 + B, 16, 1, coat);
  P(12, 11 + B, 12, 1, light);
  P(11, 16 + B, 17, 1, dark);
  P(11, 17 + B, 15, 1, dark);
  // cuello y cabeza (sube y baja con el galope)
  const nb = idle ? 0 : bob;
  P(26, 9 + B, 4, 4, coat);
  P(27, 7 + B + nb, 4, 3, coat);
  P(29, 5 + B + nb, 4, 3, coat);
  P(31, 4 + B + nb, 4, 3, coat);
  P(34, 5 + B + nb, 2, 2, coat);
  P(35, 6 + B + nb, 1, 1, dark);
  P(32, 2 + B + nb, 1, 2, coat);
  P(31, 3 + B + nb, 1, 1, dark);
  P(32, 5 + B + nb, 1, 1, '#140c08');
  // crin
  P(25, 9 + B, 2, 2, mane);
  P(26, 7 + B + nb, 2, 2, mane);
  P(28, 5 + B + nb, 2, 2, mane);
  P(30, 4 + B + nb, 1, 1, mane);
  // brida
  P(33, 6 + B + nb, 1, 2, '#2a1a10');
  // patas cercanas
  near.forEach(leg);
  // mantilla con el dorsal
  P(15, 11 + B, 7, 6, '#fffaf0');
  P(15, 16 + B, 7, 1, h.silk[0]);
  digits(ctx, String(h.no), 17, 11 + B, '#14101f');
  // silla
  P(16, 10 + B, 6, 1, '#3a2414');
  // jockey (más quieto que el caballo: amortigua)
  const J = 1 + (idle ? 0 : Math.round(bob * 0.3));
  const [c1, c2] = h.silk;
  P(19, 8 + J, 3, 2, '#f4f0e6'); // pantalón
  P(20, 10 + J, 2, 2, '#1a1a1a'); // bota
  for (let y = 0; y < 3; y++)
    for (let x = 0; x < 7; x++) {
      const sx = 16 + x + (y === 0 ? 1 : 0);
      if (y === 0 && x === 6) continue;
      ctx.fillStyle = patternPx(h.pattern, x, y) ? c2 : c1;
      ctx.fillRect(sx, 5 + J + y, 1, 1);
    }
  // brazo con las riendas
  P(22, 7 + J, 4, 1, h.pattern === 'liso' ? c2 : c1);
  P(26, 7 + J, 1, 1, SKIN);
  P(27, 8 + J, 3, 1, '#2a1a10');
  // cabeza y gorra
  P(23, 3 + J, 3, 3, c2);
  P(26, 4 + J, 1, 1, c2);
  P(24, 5 + J, 2, 1, SKIN);
  P(23, 3 + J, 1, 1, shade(c2, 0.4));
  return outlined(cv);
}

interface Sprites {
  run: HTMLCanvasElement[];
  idle: HTMLCanvasElement;
}
function buildSprites(field: Horse[]): Sprites[] {
  return field.map((h) => ({ run: Array.from({ length: FRAMES }, (_, f) => horseFrame(h, f)), idle: horseFrame(h, 0, true) }));
}

/** Icono de las sedas (chaquetilla) en SVG. */
export function Silk({ horse, size = 22 }: { horse: Horse; size?: number }) {
  const [c1, c2] = horse.silk;
  const px: JSX.Element[] = [];
  for (let y = 0; y < 3; y++)
    for (let x = 0; x < 7; x++)
      px.push(<rect key={`${x}${y}`} x={2.5 + x} y={2 + y * 2.6} width="1" height="2.6" fill={patternPx(horse.pattern, x, y) ? c2 : c1} />);
  return (
    <svg class="hr-silk" viewBox="0 0 12 11" width={size} height={size} shape-rendering="crispEdges" aria-hidden="true">
      <rect x="1.5" y="1" width="9" height="10" fill="#14101f" />
      <rect x="0" y="2" width="3" height="5" fill="#14101f" />
      <rect x="9" y="2" width="3" height="5" fill="#14101f" />
      <rect x="1" y="3" width="2" height="3" fill={horse.pattern === 'liso' ? c2 : c1} />
      <rect x="9" y="3" width="2" height="3" fill={horse.pattern === 'liso' ? c2 : c1} />
      {px}
      <rect x="5" y="2" width="2" height="1" fill="#14101f" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Decorados (en caché)
// ---------------------------------------------------------------------------

const SKY = ['#1a0b3a', '#2a0f4a', '#3d1458', '#5a1a63', '#7d2069', '#a3296b', '#c93a67', '#e85a5e', '#f78a55', '#ffb35a'];

function buildSky(w: number, h: number) {
  const [c, ctx] = canvas(w, h);
  const band = h / SKY.length;
  SKY.forEach((col, i) => {
    ctx.fillStyle = col;
    ctx.fillRect(0, Math.floor(i * band), w, Math.ceil(band) + 1);
  });
  // estrellas
  for (let i = 0; i < w * 0.25; i++) {
    const x = (i * 97) % w;
    const y = (i * 53) % Math.max(1, Math.floor(h * 0.4));
    ctx.fillStyle = i % 3 ? 'rgba(255,255,255,0.5)' : '#fff';
    ctx.fillRect(x, y, 1, 1);
  }
  return c;
}

function drawSun(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  const cols = ['#ffe36b', '#ffc65a', '#ffa04f', '#ff7a4f', '#ff5a6a', '#ff4f9a'];
  for (let y = -r; y <= 0; y++) {
    const k = Math.floor(((y + r) / r) * (cols.length - 1));
    // franjas horizontales de sol synthwave
    if (y > -r * 0.55 && (y + r) % 4 === 0) continue;
    const hw = Math.floor(Math.sqrt(r * r - y * y));
    ctx.fillStyle = cols[k];
    ctx.fillRect(cx - hw, cy + y, hw * 2, 1);
  }
}

const SKYLINE_W = 320;
function buildSkyline(h: number) {
  const [c, ctx] = canvas(SKYLINE_W, h);
  let x = 0;
  let i = 0;
  const R = (n: number) => ((Math.sin(n * 127.1) * 43758.5453) % 1 + 1) % 1;
  while (x < SKYLINE_W) {
    const w = 8 + Math.floor(R(i) * 14);
    let bh = 10 + Math.floor(R(i + 7) * (h - 14));
    const special = i % 9 === 4 ? 'twin' : i % 11 === 7 ? 'empire' : '';
    if (special === 'twin') bh = h - 1;
    const col = i % 2 ? '#24123d' : '#2d1748';
    if (special === 'twin') {
      ctx.fillStyle = '#2f1a4e';
      ctx.fillRect(x, h - bh, 7, bh);
      ctx.fillRect(x + 9, h - bh + 2, 7, bh - 2);
      ctx.fillStyle = '#3e2463';
      for (let yy = h - bh + 2; yy < h; yy += 2) {
        ctx.fillRect(x + 1, yy, 1, 1);
        ctx.fillRect(x + 10, yy + 1, 1, 1);
      }
      ctx.fillStyle = '#ff4f9a';
      ctx.fillRect(x + 3, h - bh - 4, 1, 4);
      x += 18;
    } else if (special === 'empire') {
      bh = Math.floor(h * 0.85);
      ctx.fillStyle = col;
      ctx.fillRect(x, h - bh * 0.6, 12, bh * 0.6);
      ctx.fillRect(x + 2, h - bh * 0.82, 8, bh * 0.82);
      ctx.fillRect(x + 4, h - bh, 4, bh);
      ctx.fillRect(x + 5, h - bh - 6, 2, 6);
      ctx.fillStyle = '#4ff0ff';
      ctx.fillRect(x + 5, h - bh - 7, 1, 1);
      x += 14;
    } else {
      ctx.fillStyle = col;
      ctx.fillRect(x, h - bh, w, bh);
      // ventanas
      for (let yy = h - bh + 2; yy < h - 1; yy += 3)
        for (let xx = x + 1; xx < x + w - 1; xx += 2) {
          const r = R(xx * 3.1 + yy * 7.7);
          if (r > 0.72) {
            ctx.fillStyle = r > 0.93 ? '#ffe39a' : r > 0.85 ? '#ffb35a' : '#5a3a8a';
            ctx.fillRect(xx, yy, 1, 1);
          }
        }
      if (R(i + 3) > 0.7) {
        ctx.fillStyle = '#3a1f5c';
        ctx.fillRect(x + Math.floor(w / 2), h - bh - 3, 1, 3);
      }
      x += w + (R(i + 11) > 0.6 ? 1 : 0);
    }
    i++;
  }
  return c;
}

const STAND_W = 192;
const STAND_H = 44;
function buildStand(alt: boolean) {
  const [c, ctx] = canvas(STAND_W, STAND_H);
  const P = (x: number, y: number, w: number, h: number, col: string) => {
    ctx.fillStyle = col;
    ctx.fillRect(x, y, w, h);
  };
  // estructura
  P(0, 8, STAND_W, STAND_H - 8, '#3a2650');
  // gradas: filas de público
  const shirts = ['#e8323c', '#2f6fdf', '#ffd23f', '#f4f0e6', '#2fbf5a', '#ff7a1a', '#b04fe0', '#4ff0ff', '#ff4f9a', '#7a4622'];
  const skins = ['#f2d0b0', '#deac84', '#c18a5c', '#9a6440', '#6c4228'];
  const R = (n: number) => ((Math.sin(n * 91.7) * 15731.31) % 1 + 1) % 1;
  for (let row = 0; row < 6; row++) {
    const y = 14 + row * 5;
    P(0, y + 3, STAND_W, 2, row % 2 ? '#2a1a3c' : '#30203f');
    for (let x = (row % 2) * 2; x < STAND_W; x += 4) {
      const n = row * 1000 + x;
      if (R(n) < 0.08) continue;
      const up = alt && R(n + 5) < 0.35 ? 1 : 0;
      P(x, y + 1 - up, 3, 2, shirts[Math.floor(R(n + 1) * shirts.length)]);
      P(x + 1, y - 1 - up, 1, 2, skins[Math.floor(R(n + 2) * skins.length)]);
      if (alt && R(n + 3) < 0.15) P(x - 1 + (R(n + 4) < 0.5 ? 0 : 4), y - 2 - up, 1, 2, skins[Math.floor(R(n + 2) * skins.length)]);
      if (R(n + 9) < 0.06) P(x, y - 2 - up, 3, 1, '#14101f'); // sombrero
    }
  }
  // columnas
  for (let x = 4; x < STAND_W; x += 48) P(x, 6, 2, STAND_H - 6, '#c9c2d8');
  // tejadillo de rayas
  for (let x = 0; x < STAND_W; x += 8) {
    P(x, 2, 4, 5, '#e8323c');
    P(x + 4, 2, 4, 5, '#f4f0e6');
    P(x, 7, 4, 1, '#a01c28');
    P(x + 4, 7, 4, 1, '#b8b0a8');
  }
  P(0, 0, STAND_W, 2, '#14101f');
  // banderines
  for (let x = 20; x < STAND_W; x += 48) {
    P(x, -6 + 6, 1, 2, '#c9c2d8');
  }
  // valla delante de la grada
  P(0, STAND_H - 3, STAND_W, 3, '#1f1430');
  return c;
}

// ---------------------------------------------------------------------------
// Estado de la animación
// ---------------------------------------------------------------------------

interface Dust {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  s: number;
}

type Phase = 'bet' | 'race' | 'result';

interface Sim {
  phase: Phase;
  field: Horse[];
  sprites: Sprites[];
  plan: RacePlan | null;
  t: number;
  cam: number;
  /** Desfase suavizado de la cámara respecto al que va en cabeza. */
  camOff: number;
  freeze: number;
  frozeDone: boolean;
  finishedAt: number;
  dust: Dust[];
  myHorses: Set<number>;
  flash: number;
}

const START_X = 14;
const horseX = (plan: RacePlan | null, h: number, t: number) => START_X + (plan && t > 0 ? progress(plan.runners[h], t) * TRACK_LEN : 0);

function lengthsText(margin: number, finish: number): string {
  const len = (margin * (TRACK_LEN / finish)) / 30;
  if (len < 0.12) return 'por una nariz';
  if (len < 0.35) return 'por una cabeza';
  if (len < 0.75) return 'por medio cuerpo';
  if (len < 1.3) return 'por un cuerpo';
  const half = Math.round(len * 2) / 2;
  const whole = Math.floor(half);
  return `por ${whole === 1 ? 'un cuerpo' : `${whole} cuerpos`}${half > whole ? ' y medio' : ''}`;
}

/** Clasificación en directo bajo la pista. */
function LiveBoard({ sim, field }: { sim: { current: Sim }; field: Horse[] }) {
  const [rows, setRows] = useState<{ h: number; gap: number; done: boolean }[]>([]);
  const [left, setLeft] = useState(TRACK_METRES);
  useEffect(() => {
    const upd = () => {
      const s = sim.current;
      const plan = s.plan;
      if (!plan) return;
      const t = Math.max(0, s.t);
      const st = standings(plan, t);
      const lead = progress(plan.runners[st[0]], t);
      setLeft(Math.max(0, Math.round((TRACK_METRES * (1 - Math.min(1, lead))) / 10) * 10));
      setRows(
        st.map((h) => {
          const r = plan.runners[h];
          const done = progress(r, t) >= 1;
          const gap = done ? (r.finish - plan.runners[plan.order[0]].finish) * (TRACK_LEN / r.finish) / 30 : ((lead - progress(r, t)) * TRACK_LEN) / 30;
          return { h, gap, done };
        }),
      );
    };
    upd();
    const id = setInterval(upd, 180);
    return () => clearInterval(id);
  }, []);
  return (
    <div class="hr-board">
      <div class="hr-board-head">
        <span>CLASIFICACIÓN</span>
        <span>{left > 0 ? `Faltan ${left} m` : 'Llegada'}</span>
      </div>
      {rows.map((r, i) => (
        <div key={r.h} class={`hr-board-row ${sim.current.myHorses.has(r.h) ? 'mine' : ''}`} style={{ transform: `translateY(0)`, order: i }}>
          <b class="hr-pos">{i + 1}º</b>
          <Silk horse={field[r.h]} size={16} />
          <span class="hr-bname">
            <i>{field[r.h].no}</i> {field[r.h].name}
          </span>
          <span class="hr-gap">{i === 0 ? (r.done ? 'GANADOR' : 'CABEZA') : `+${r.gap.toFixed(1)} c.`}</span>
        </div>
      ))}
    </div>
  );
}

const ANNOUNCER = { ...randomPerson(4242), wear: 'traje' as const, hair: 'sombrero' as const, outfit: '#2f6fb3', name: 'Locutor' };

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

export function HorseRace(p: CasinoTableProps) {
  const { chips, fmt } = p;
  const talk = useTalk(ANNOUNCER);
  const { pops, pop } = usePops();
  const shake = useShake();
  const [field, setField] = useState<Horse[]>(() => makeField());
  const [phase, setPhase] = useState<Phase>('bet');
  const [bets, setBets] = useState<HorseBet[]>([]);
  const [chipIdx, setChipIdx] = useState(0);
  const [msg, setMsg] = useState('');
  const [photo, setPhoto] = useState<'' | 'foto' | 'meta'>('');
  const [result, setResult] = useState<{ order: number[]; lines: (HorseBet & { returned: number })[]; net: number } | null>(null);
  const cvRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const alive = useRef(true);
  const settleRef = useRef<(() => void) | null>(null);
  const sim = useRef<Sim>({ phase: 'bet', field, sprites: [], plan: null, t: 0, cam: -60, camOff: 0, freeze: 0, frozeDone: false, finishedAt: 0, dust: [], myHorses: new Set(), flash: 0 });
  const events = useRef<{ say: (s: string, mood?: 'normal' | 'feliz' | 'nervios') => void; onWinner: () => void; onDone: () => void }>(null!);

  const later = (ms: number, f: () => void) => alive.current && timers.current.push(setTimeout(() => alive.current && f(), ms));
  const total = bets.reduce((a, b) => a + b.amount, 0);
  const limit = Math.max(0, Math.min(p.money, p.maxBet));
  const chip = chips[chipIdx] ?? chips[0];

  useEffect(() => {
    sim.current.field = field;
    sim.current.sprites = buildSprites(field);
  }, [field]);

  useEffect(() => {
    const fav = [...field].sort((a, b) => b.p - a.p)[0];
    later(400, () => talk.say(`¡Bienvenidos al hipódromo! Favorito: ${fav.name}, a ${fracText(fav.frac)}.`));
    return () => {
      alive.current = false;
      timers.current.forEach(clearTimeout);
      settleRef.current?.();
    };
  }, []);

  // --- bucle de dibujo -----------------------------------------------------
  useEffect(() => {
    const cv = cvRef.current;
    const wrap = wrapRef.current;
    const ctx = cv?.getContext('2d');
    if (!cv || !wrap || !ctx) return;
    let W = 0;
    let H = 0;
    let sky: HTMLCanvasElement | null = null;
    let skyline: HTMLCanvasElement | null = null;
    const stands = [buildStand(false), buildStand(true)];
    const resize = () => {
      const w = Math.max(80, Math.round(wrap.clientWidth / 2));
      const h = Math.max(60, Math.round(wrap.clientHeight / 2));
      if (w === W && h === H) return;
      W = cv.width = w;
      H = cv.height = h;
      ctx.imageSmoothingEnabled = false;
      sky = buildSky(W, H);
      skyline = buildSkyline(Math.max(20, Math.min(46, Math.floor(H * 0.2))));
    };
    resize();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
    ro?.observe(wrap);
    let raf = 0;
    let last = performance.now();
    let gallopAt = 0;
    // comentarios
    let lastSay = -10;
    let lastLeader = -1;
    const posHist: { t: number; st: number[] }[] = [];
    const said = new Set<string>();
    const low = lowFx();

    const frame = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const s = sim.current;
      const plan = s.plan;
      const ev = events.current;
      const name = (h: number) => s.field[h].name;
      // ---- tiempo de carrera
      if (s.phase === 'race' && plan) {
        if (s.freeze > 0) {
          s.freeze -= dt;
          if (s.freeze <= 0) ev.onWinner();
        } else {
          const winT = plan.runners[plan.order[0]].finish;
          const slow = s.t > winT - 1.2 && s.t < winT && !s.frozeDone ? 0.55 : 1;
          const nt = s.t + dt * slow;
          if (!s.frozeDone && nt >= winT) {
            s.t = winT;
            s.frozeDone = true;
            s.freeze = plan.photo ? 2.4 : 1.3;
            s.flash = 1;
            ev.say(plan.photo ? '¡Foto finish! ¡No se puede ajustar más!' : `¡${name(plan.order[0])} cruza la meta!`, 'nervios');
            setPhoto(plan.photo ? 'foto' : 'meta');
            play.clink();
            fx.crowd(2.5);
          } else s.t = nt;
          const lastT = plan.runners[plan.order[plan.order.length - 1]].finish;
          if (s.frozeDone && s.t > lastT + 1 && !s.finishedAt) {
            s.finishedAt = now;
            ev.onDone();
          }
        }
        // galope
        if (s.t > 0 && now > gallopAt && s.freeze <= 0) {
          gallopAt = now + 330;
          fx.gallop();
        }
        // comentarios
        if (s.t > 0 && s.freeze <= 0 && !s.frozeDone) {
          const st = standings(plan, s.t);
          posHist.push({ t: s.t, st });
          while (posHist.length && posHist[0].t < s.t - 2.6) posHist.shift();
          const lead = st[0];
          const lp = progress(plan.runners[lead], s.t);
          const quiet = s.t - lastSay > 2.3;
          const once = (k: string, line: string) => {
            if (said.has(k)) return false;
            said.add(k);
            lastSay = s.t;
            ev.say(line);
            return true;
          };
          if (s.t > 2.2 && once('salida', `¡Sale en cabeza ${name(lead)}, seguido de ${name(st[1])}!`)) {
            /* dicho */
          } else if (lp > 0.78 && once('recta', progress(plan.runners[st[1]], s.t) > lp - 0.012 ? `¡Recta final! ${name(lead)} y ${name(st[1])}, cabeza con cabeza.` : `¡Recta final! ${name(lead)} se escapa…`)) {
            fx.crowd(3);
          } else if (quiet && lead !== lastLeader && lastLeader >= 0 && s.t > 3) {
            const old = posHist[0]?.st.indexOf(lead) ?? 0;
            lastSay = s.t;
            ev.say(old >= 2 ? `¡${name(lead)} remonta por el exterior y se pone primero!` : `¡${name(lead)} toma el mando!`);
          } else if (quiet && posHist.length > 10) {
            const old = posHist[0].st;
            const mover = st.find((h, i) => i > 0 && old.indexOf(h) - i >= 2);
            if (mover !== undefined && once(`mov${mover}`, `¡Atención a ${name(mover)}, que viene lanzado!`)) {
              /* dicho */
            } else if (lp > 0.45) once('mitad', `Mitad de carrera: manda ${name(lead)}, ${name(st[1])} segundo.`);
          }
          lastLeader = lead;
        }
      }

      // ---- cámara
      const xs = s.field.map((_, h) => horseX(plan, h, s.phase === 'race' ? s.t : 0));
      const leadX = Math.max(...xs);
      // encuadre: el que va en cabeza a la derecha y, si cabe, el grueso del pelotón
      const sorted = [...xs].sort((a, b) => b - a);
      const pack = sorted[Math.min(3, sorted.length - 1)];
      let target = s.phase === 'bet' || !plan || s.t <= 0 ? -W * 0.45 : Math.max(leadX - W * 0.8, Math.min(leadX - W * 0.6, pack - W * 0.18));
      if (s.frozeDone && s.freeze > 0) target = START_X + TRACK_LEN - W * 0.6;
      if (plan && s.phase === 'race' && s.t > 0 && s.freeze <= 0 && !s.frozeDone) {
        // se suaviza el encuadre, no la posición: la cámara no se queda atrás
        s.camOff += (target - leadX - s.camOff) * Math.min(1, dt * 2.5);
        s.cam = leadX + s.camOff;
      } else {
        s.cam += (target - s.cam) * Math.min(1, dt * (s.freeze > 0 ? 8 : 3.2));
        s.camOff = s.cam - leadX;
      }
      const cam = Math.round(s.cam);

      // ---- escena
      const fgH = 10;
      const nearRail = H - fgH - 6;
      const lane0 = nearRail - 4 - 5 * 8;
      const farRail = lane0 - 21;
      const standBottom = farRail - 1;
      const standTop = standBottom - STAND_H;
      if (sky) ctx.drawImage(sky, 0, 0);
      // sol synthwave
      drawSun(ctx, Math.round(W * 0.7 - cam * 0.02), standTop - 4, Math.min(28, Math.floor(H * 0.12)));
      if (skyline) {
        const sx = -((cam * 0.12) % SKYLINE_W) - SKYLINE_W;
        for (let x = sx; x < W; x += SKYLINE_W) ctx.drawImage(skyline, Math.round(x), standTop + 8 - skyline.height);
      }
      // grada
      const excited = s.phase === 'race' && (s.frozeDone || (plan && progress(plan.runners[standings(plan, s.t)[0]], s.t) > 0.75));
      const standImg = stands[!low && excited && Math.floor(now / 140) % 2 ? 1 : 0];
      const gx = -((cam * 0.55) % STAND_W) - STAND_W;
      for (let x = gx; x < W; x += STAND_W) ctx.drawImage(standImg, Math.round(x), standTop);
      // banderines sobre la grada
      for (let x = Math.round(gx); x < W; x += 48) {
        const wave = Math.floor(now / 200 + x) % 2;
        ctx.fillStyle = '#c9c2d8';
        ctx.fillRect(x + 20, standTop - 7, 1, 7);
        ctx.fillStyle = ['#ff4f9a', '#4ff0ff', '#ffcc33'][Math.abs(Math.floor(x / 48)) % 3];
        ctx.fillRect(x + 21, standTop - 7 + wave, 4, 2);
        ctx.fillRect(x + 21, standTop - 5 + wave, 2, 1);
      }
      // césped interior entre grada y pista
      ctx.fillStyle = '#2d6a2a';
      ctx.fillRect(0, standBottom, W, farRail - standBottom + 3);
      // pista
      const trackTop = farRail + 3;
      const trackH = nearRail + 4 - trackTop;
      const dirt = ['#b5793f', '#ad7139', '#a66b35', '#9f6531'];
      dirt.forEach((c, i) => {
        ctx.fillStyle = c;
        ctx.fillRect(0, trackTop + Math.floor((trackH * i) / dirt.length), W, Math.ceil(trackH / dirt.length) + 1);
      });
      // marcas de cascos en la arena
      ctx.fillStyle = 'rgba(80,45,20,0.35)';
      for (let k = 0; k < 90; k++) {
        const wx = Math.floor(cam / 6) * 6 + k * 6 - 30;
        const hsh = ((Math.sin(wx * 12.9898) * 43758.5453) % 1 + 1) % 1;
        const y = trackTop + 2 + Math.floor(hsh * (trackH - 4));
        ctx.fillRect(wx - cam + Math.floor(hsh * 5), y, 2, 1);
      }
      ctx.fillStyle = 'rgba(255,230,190,0.18)';
      for (let k = 0; k < 50; k++) {
        const wx = Math.floor(cam / 11) * 11 + k * 11;
        const hsh = ((Math.sin(wx * 78.233) * 12345.678) % 1 + 1) % 1;
        ctx.fillRect(wx - cam, trackTop + 1 + Math.floor(hsh * (trackH - 2)), 1, 1);
      }
      // raya de meta
      const finX = START_X + TRACK_LEN - cam;
      if (finX > -20 && finX < W + 20) {
        ctx.fillStyle = '#fffaf0';
        for (let y = trackTop; y < nearRail + 4; y++) ctx.fillRect(finX + Math.floor((nearRail - y) * 0.25), y, 2, 1);
      }
      // valla del fondo con postes de distancia
      ctx.fillStyle = '#e8e4f0';
      ctx.fillRect(0, farRail, W, 2);
      ctx.fillStyle = '#9890a8';
      ctx.fillRect(0, farRail + 2, W, 1);
      for (let wx = Math.floor(cam / 16) * 16; wx < cam + W + 16; wx += 16) {
        ctx.fillStyle = '#e8e4f0';
        ctx.fillRect(wx - cam, farRail, 1, 4);
      }
      const post = TRACK_LEN / 6;
      for (let k = 0; k <= 6; k++) {
        const wx = START_X + k * post;
        const x = wx - cam;
        if (x < -30 || x > W + 30) continue;
        const left = Math.round(TRACK_METRES - (k * TRACK_METRES) / 6);
        if (k === 6) {
          // poste de meta
          ctx.fillStyle = '#14101f';
          ctx.fillRect(x - 1, farRail - 26, 4, 30);
          for (let y = 0; y < 26; y += 4) {
            ctx.fillStyle = (y / 4) % 2 ? '#e8323c' : '#fffaf0';
            ctx.fillRect(x, farRail - 26 + y, 2, 4);
          }
          ctx.fillStyle = '#14101f';
          ctx.fillRect(x - 6, farRail - 34, 14, 9);
          ctx.fillStyle = '#e8323c';
          ctx.fillRect(x - 5, farRail - 33, 12, 7);
          digits(ctx, 'M', x - 1, farRail - 32, '#fffaf0');
        } else if (k > 0) {
          const label = String(left);
          const lw = digitsW(label);
          ctx.fillStyle = '#14101f';
          ctx.fillRect(x - 1, farRail - 15, 3, 18);
          ctx.fillStyle = '#fffaf0';
          ctx.fillRect(x, farRail - 14, 1, 16);
          ctx.fillStyle = '#14101f';
          ctx.fillRect(x - Math.ceil(lw / 2) - 2, farRail - 22, lw + 4, 9);
          ctx.fillStyle = '#e8323c';
          ctx.fillRect(x - Math.ceil(lw / 2) - 1, farRail - 21, lw + 2, 7);
          digits(ctx, label, x - Math.ceil(lw / 2), farRail - 20, '#fffaf0');
        }
      }
      // cajones de salida (detrás)
      const gateX = START_X + 2 - cam;
      const gateOpen = s.phase === 'race' && s.t > 0;
      if (gateX > -60 && gateX < W + 60) {
        for (let l = 0; l < 6; l++) {
          const by = lane0 + l * 8;
          ctx.fillStyle = '#1f6b3a';
          ctx.fillRect(gateX - 30, by - 22, 30, 2);
        }
      }
      // polvo (detrás de los caballos de cada carril se pinta todo junto)
      for (let i = s.dust.length - 1; i >= 0; i--) {
        const d = s.dust[i];
        if (s.freeze <= 0) {
          d.life -= dt;
          d.x += d.vx * dt;
          d.y += d.vy * dt;
          d.vy += 10 * dt;
        }
        if (d.life <= 0) {
          s.dust.splice(i, 1);
          continue;
        }
        const a = d.life / d.max;
        ctx.fillStyle = `rgba(222,186,140,${(a * 0.7).toFixed(2)})`;
        ctx.fillRect(Math.round(d.x - cam), Math.round(d.y), d.s, d.s);
      }
      // caballos, del carril de atrás al de delante
      const racing = s.phase === 'race' && s.t > 0;
      for (let h = 0; h < s.field.length; h++) {
        const sp = s.sprites[h];
        if (!sp) continue;
        const base = lane0 + h * 8;
        const nose = xs[h];
        const x = Math.round(nose - cam - SPR_W + 4);
        if (x < -SPR_W - 4 || x > W + 4) continue;
        let img = sp.idle;
        if (racing) {
          const f = Math.floor(nose / 7 + h * 3) % FRAMES;
          img = sp.run[f];
          // polvo de los cascos
          if (s.freeze <= 0 && Math.random() < (low ? 0.12 : 0.55)) {
            const life = 0.3 + Math.random() * 0.4;
            s.dust.push({ x: nose - SPR_W + 10 + Math.random() * 18, y: base - 1 - Math.random() * 2, vx: -10 - Math.random() * 25, vy: -12 - Math.random() * 14, life, max: life, s: Math.random() < 0.3 ? 2 : 1 });
          }
        } else if (s.phase === 'bet') {
          // inquietos en los cajones
          const fidget = Math.floor(now / 500 + h * 1.7) % 7 === 0 ? 1 : 0;
          img = fidget ? sp.run[1] : sp.idle;
        }
        // sombra
        ctx.fillStyle = 'rgba(40,20,8,0.35)';
        ctx.fillRect(x + 8, base - 1, 24, 2);
        ctx.drawImage(img, x, base - SPR_H + 1);
        // marca sobre tus caballos
        if (s.myHorses.has(h) && s.phase !== 'bet') {
          const bobY = Math.floor(now / 250) % 2;
          ctx.fillStyle = '#14101f';
          ctx.fillRect(x + 20, base - SPR_H - 4 + bobY, 5, 3);
          ctx.fillStyle = '#ffcc33';
          ctx.fillRect(x + 21, base - SPR_H - 4 + bobY, 3, 1);
          ctx.fillRect(x + 22, base - SPR_H - 3 + bobY, 1, 1);
        }
      }
      // puertas de los cajones (delante)
      if (gateX > -60 && gateX < W + 60) {
        for (let l = 0; l < 6; l++) {
          const by = lane0 + l * 8;
          ctx.fillStyle = '#14101f';
          ctx.fillRect(gateX - 31, by - 21, 2, 22);
          ctx.fillStyle = '#2f9a52';
          ctx.fillRect(gateX - 30, by - 21, 1, 21);
          if (!gateOpen) {
            ctx.fillStyle = '#14101f';
            ctx.fillRect(gateX, by - 14, 3, 15);
            ctx.fillStyle = l % 2 ? '#f4f0e6' : '#e8323c';
            ctx.fillRect(gateX + 1, by - 13, 1, 13);
          }
          ctx.fillStyle = '#fffaf0';
          digits(ctx, String(l + 1), gateX - 27, by - 20, '#fffaf0');
        }
        ctx.fillStyle = '#1f6b3a';
        ctx.fillRect(gateX - 33, lane0 - 26, 38, 4);
        ctx.fillStyle = '#4ac46e';
        ctx.fillRect(gateX - 33, lane0 - 26, 38, 1);
      }
      // valla de delante
      ctx.fillStyle = '#14101f';
      ctx.fillRect(0, nearRail - 1, W, 4);
      ctx.fillStyle = '#f4f0e6';
      ctx.fillRect(0, nearRail, W, 2);
      for (let wx = Math.floor(cam / 12) * 12; wx < cam + W + 12; wx += 12) {
        const x = wx - cam;
        ctx.fillStyle = '#14101f';
        ctx.fillRect(x - 1, nearRail, 3, 7);
        ctx.fillStyle = '#e8e4f0';
        ctx.fillRect(x, nearRail, 1, 6);
      }
      // tablero de meta en la valla
      if (finX > -20 && finX < W + 20) {
        for (let k = 0; k < 6; k++) {
          ctx.fillStyle = k % 2 ? '#14101f' : '#fffaf0';
          ctx.fillRect(finX - 6 + k * 2, nearRail, 2, 2);
        }
      }
      // primer plano: seto con flores (paralaje rápido)
      const fy = H - fgH;
      ctx.fillStyle = '#1d4a22';
      ctx.fillRect(0, fy, W, fgH);
      const fcam = cam * 1.3;
      for (let wx = Math.floor(fcam / 5) * 5; wx < fcam + W + 5; wx += 5) {
        const hsh = ((Math.sin(wx * 4.123) * 9871.13) % 1 + 1) % 1;
        const x = Math.round(wx - fcam);
        ctx.fillStyle = '#2f7a34';
        ctx.fillRect(x, fy - 1 - Math.floor(hsh * 3), 4, 3 + Math.floor(hsh * 3));
        if (hsh > 0.7) {
          ctx.fillStyle = hsh > 0.88 ? '#ff4f9a' : hsh > 0.8 ? '#ffd23f' : '#fffaf0';
          ctx.fillRect(x + 1, fy + 2 + Math.floor(hsh * 4), 1, 1);
        }
      }
      // mini mapa de la carrera
      if (plan && s.phase !== 'bet') {
        const mx = 6;
        const mw = W - 12;
        const my = 5;
        ctx.fillStyle = 'rgba(10,6,22,0.75)';
        ctx.fillRect(mx - 3, my - 3, mw + 6, 9);
        ctx.fillStyle = '#5a4a7a';
        ctx.fillRect(mx, my + 1, mw, 1);
        ctx.fillStyle = '#fffaf0';
        ctx.fillRect(mx + mw, my - 2, 1, 7);
        const order = standings(plan, Math.max(0, s.t)).slice().reverse();
        for (const h of order) {
          const pr = Math.min(1, Math.max(0, s.t > 0 ? progress(plan.runners[h], s.t) : 0));
          const x = Math.round(mx + pr * mw) - 1;
          ctx.fillStyle = '#14101f';
          ctx.fillRect(x - 1, my - 1, 4, 5);
          ctx.fillStyle = s.field[h].silk[0];
          ctx.fillRect(x, my, 2, 3);
          if (s.myHorses.has(h)) {
            ctx.fillStyle = '#ffcc33';
            ctx.fillRect(x, my - 2, 2, 1);
          }
        }
      }
      // flash de la cámara de meta
      if (s.flash > 0) {
        ctx.fillStyle = `rgba(255,255,255,${s.flash.toFixed(2)})`;
        ctx.fillRect(0, 0, W, H);
        s.flash = Math.max(0, s.flash - dt * 2.5);
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      ro?.disconnect();
    };
  }, []);

  // --- eventos del bucle --------------------------------------------------
  events.current = {
    say: (s, mood = 'normal') => talk.say(s, mood),
    onWinner: () => {
      const s = sim.current;
      const plan = s.plan!;
      setPhoto('');
      const w = plan.order[0];
      talk.say(`¡Gana ${s.field[w].name} ${lengthsText(plan.margin, plan.runners[w].finish)}! Segundo, ${s.field[plan.order[1]].name}.`, 'feliz');
      settleRef.current?.();
    },
    onDone: () => {
      later(400, () => setPhase('result'));
    },
  };

  const flashMsg = (s: string) => {
    setMsg(s);
    shake.shake();
    play.error();
    later(1800, () => setMsg((x) => (x === s ? '' : x)));
  };

  const addBet = (kind: HorseBetKind, horse: number) => {
    if (phase !== 'bet') return;
    if (total + chip > limit) return flashMsg(total + chip > p.maxBet ? `Límite por carrera: ${fmt(p.maxBet)}` : 'No te queda dinero para esa ficha');
    const i = bets.findIndex((b) => b.kind === kind && b.horse === horse);
    setBets(i >= 0 ? bets.map((b, j) => (j === i ? { ...b, amount: b.amount + chip } : b)) : [...bets, { kind, horse, amount: chip }]);
    fx.chip();
  };
  const stake = (kind: HorseBetKind, horse: number) => bets.find((b) => b.kind === kind && b.horse === horse)?.amount ?? 0;

  const start = () => {
    if (phase !== 'bet' || !bets.length) return;
    if (total > limit) return flashMsg('La apuesta supera tu saldo o el límite');
    const order = drawOrder(field.map((h) => h.p));
    const plan = planRace(field, order);
    const s = sim.current;
    Object.assign(s, { phase: 'race', plan, t: -2.4, freeze: 0, frozeDone: false, finishedAt: 0, dust: [], flash: 0, myHorses: new Set(bets.map((b) => b.horse)) });
    setPhase('race');
    setResult(null);
    fx.bugle();
    talk.say('¡Caballos en los cajones…!');
    later(2400, () => {
      talk.say('¡Y salen! ¡Arranca la carrera!', 'nervios');
      fx.crowd(2);
      play.clink();
    });
    const placed = bets;
    let done = false;
    settleRef.current = () => {
      if (done) return;
      done = true;
      settleRef.current = null;
      const res = settleRace(placed, field, order);
      const detail = `Carrera: gana ${field[order[0]].name} (${fracText(field[order[0]].frac)}) · ${res.lines.map((l) => `${l.kind === 'ganador' ? 'Gan.' : 'Col.'} ${field[l.horse].name} ${fmt(l.amount)}${l.returned ? ' ✔' : ''}`).join(', ')}`;
      const ok = p.settle(res.staked, res.returned, detail);
      if (!alive.current) return;
      if (!ok) {
        setMsg('La ventanilla no acepta la apuesta: se te devuelve el dinero.');
        setResult({ order, lines: res.lines.map((l) => ({ ...l, returned: 0 })), net: 0 });
        return;
      }
      const net = res.returned - res.staked;
      setResult({ order, lines: res.lines, net });
      later(1800, () => {
        if (res.returned > 0) {
          (net > res.staked * 3 ? fx.jackpot : play.good)();
          play.coin();
        } else play.bad();
      });
    };
  };

  // pops del resultado
  useEffect(() => {
    if (phase !== 'result' || !result) return;
    result.lines
      .filter((l) => l.returned > 0)
      .forEach((l, i) => later(500 + i * 200, () => pop(`+${fmt(l.returned)}`, 50, 46 - i * 6, l.kind === 'ganador' ? 'gold' : 'good')));
    later(1600, () =>
      talk.say(result.net > 0 ? `¡Enhorabuena! Pase por ventanilla a cobrar ${fmt(result.lines.reduce((a, l) => a + l.returned, 0))}.` : result.lines.some((l) => l.returned > 0) ? 'Algo recupera. ¡Otra carrera!' : 'Así son las carreras. ¡La próxima es la suya!', result.net > 0 ? 'feliz' : 'normal'),
    );
  }, [phase]);

  const nextRace = () => {
    const f = makeField();
    setField(f);
    setBets([]);
    setResult(null);
    setMsg('');
    setPhase('bet');
    Object.assign(sim.current, { phase: 'bet', plan: null, t: 0, freeze: 0, frozeDone: false, dust: [], myHorses: new Set() });
    const fav = [...f].sort((a, b) => b.p - a.p)[0];
    talk.say(`Nueva carrera. Favorito: ${fav.name}, a ${fracText(fav.frac)}.`);
  };

  const racing = phase === 'race';
  const styleName = { puntero: 'Puntero', medio: 'Regular', remontador: 'Remontador' };

  return (
    <div class={`hr-room hr-ph-${phase} ${shake.cls}`}>
      <div class="mg-head hr-head">
        <button class="btn small secondary" disabled={racing} onClick={p.onExit}>
          ◀ Vestíbulo
        </button>
        <span class="mg-title">CARRERAS</span>
        <span class="mg-score hr-money">{fmt(p.money)}</span>
      </div>
      <div class="hr-top">
        <Talker person={ANNOUNCER} talk={talk} scale={2} class="hr-announcer" />
      </div>
      <div class="hr-stage">
        <div class={`hr-track ${photo ? `hr-photo-${photo}` : ''}`} ref={wrapRef}>
          <canvas ref={cvRef} class="hr-canvas" />
          {photo && <div class="hr-photo-banner">{photo === 'foto' ? 'FOTO FINISH' : '¡LLEGADA!'}</div>}
          {msg && <div class="hr-msg">{msg}</div>}
        </div>
        {phase !== 'bet' && <LiveBoard sim={sim} field={field} />}
        {phase === 'result' && result && (
          <div class="hr-podium">
            <div class="hr-podium-title">RESULTADO OFICIAL</div>
            <div class="hr-steps">
              {[1, 0, 2].map((pos) => {
                const h = field[result.order[pos]];
                return (
                  <div key={pos} class={`hr-step hr-step-${pos + 1}`}>
                    <Silk horse={h} size={pos === 0 ? 34 : 26} />
                    <b>{h.name}</b>
                    <small>
                      #{h.no} · {fracText(h.frac)}
                    </small>
                    <div class="hr-block">{pos + 1}º</div>
                  </div>
                );
              })}
            </div>
            <div class="hr-lines">
              {result.lines.map((l, i) => (
                <div key={i} class={l.returned ? 'win' : 'lose'}>
                  <span>
                    {l.kind === 'ganador' ? 'Ganador' : 'Colocado'} · {field[l.horse].name}
                  </span>
                  <b>{l.returned ? `+${fmt(l.returned)}` : `−${fmt(l.amount)}`}</b>
                </div>
              ))}
            </div>
            <div class={`hr-net ${result.net > 0 ? 'good' : result.net < 0 ? 'bad' : ''}`}>{result.net > 0 ? `¡Ganas ${fmt(result.net)}!` : result.net < 0 ? `Pierdes ${fmt(-result.net)}` : 'Quedas igual'}</div>
          </div>
        )}
        <PopLayer pops={pops} />
      </div>
      {phase === 'bet' && (
        <>
          <div class="hr-list">
            <div class="hr-list-head">
              <span>CABALLO</span>
              <span>GANADOR</span>
              <span>COLOCADO (1º-2º)</span>
            </div>
            {field.map((h, i) => (
              <div key={h.name} class="hr-row">
                <div class="hr-horse">
                  <Silk horse={h} />
                  <div class="hr-name">
                    <b>
                      <i>{h.no}</i> {h.name}
                    </b>
                    <small>
                      Forma {h.form} · {styleName[h.style]}
                    </small>
                  </div>
                </div>
                <button class={`hr-bet ${stake('ganador', i) ? 'on' : ''}`} onClick={() => addBet('ganador', i)}>
                  <span class="hr-odds">{fracText(h.frac)}</span>
                  {stake('ganador', i) ? <ChipFace value={chip} chips={chips} size={22} label={shortAmount(stake('ganador', i))} /> : null}
                </button>
                <button class={`hr-bet place ${stake('colocado', i) ? 'on' : ''}`} onClick={() => addBet('colocado', i)}>
                  <span class="hr-odds">×{h.place.toFixed(2)}</span>
                  {stake('colocado', i) ? <ChipFace value={chip} chips={chips} size={22} label={shortAmount(stake('colocado', i))} /> : null}
                </button>
              </div>
            ))}
          </div>
          <div class="hr-info">
            <span>
              En juego · <b>{fmt(total)}</b>
            </span>
            <span class="hr-limit">Máx. {fmt(p.maxBet)}</span>
          </div>
          <div class="hr-chips">
            {chips.map((v, i) => (
              <button key={v} class={`rl-chip-btn ${i === chipIdx ? 'on' : ''}`} disabled={v > limit} onClick={() => (setChipIdx(i), fx.chip())}>
                <ChipFace value={v} chips={chips} size={42} />
              </button>
            ))}
          </div>
          <div class="hr-actions">
            <button class="btn small secondary" disabled={!bets.length} onClick={() => setBets([])}>
              Borrar
            </button>
            <button class="btn hr-go" disabled={!bets.length} onClick={start}>
              ¡A CORRER!
            </button>
          </div>
        </>
      )}
      {phase !== 'bet' && (
        <div class="hr-slip">
          <div class="hr-slip-bets">
            {bets.map((b, i) => (
              <span key={i} class="hr-ticket">
                <Silk horse={field[b.horse]} size={14} /> {b.kind === 'ganador' ? 'GAN' : 'COL'} {fmt(b.amount)}
              </span>
            ))}
          </div>
          {phase === 'result' && (
            <button class="btn big-cta hr-next" onClick={nextRace}>
              Nueva carrera
            </button>
          )}
        </div>
      )}
    </div>
  );
}
