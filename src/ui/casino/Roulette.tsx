import type { ComponentChildren } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { randomPerson, type Mood } from '../../art/portrait';
import { fx, play } from '../../platform/audio';
import { PopLayer, Talker, usePops, useShake, useTalk } from '../games/stage';
import type { CasinoTableProps } from './types';
import {
  ballAt,
  chipBreakdown,
  chipSpot,
  CLOTH,
  CLOTH_H,
  CLOTH_W,
  colorOf,
  cornerAt,
  hotCold,
  lineAt,
  makeBet,
  outsideBets,
  planSpin,
  POCKET,
  pocketAngle,
  resolveSpin,
  shortAmount,
  spinNumber,
  splitOf,
  streetAt,
  wheelAngle,
  WHEEL_ORDER,
  type Bet,
  type BetResult,
  type Placed,
  type SpinPlan,
} from './roulette-logic';
import './roulette.css';

/**
 * Ruleta europea: cilindro en canvas con la bola, tapete vertical con todas
 * las apuestas y un crupier que canta los números.
 */

const HIST_KEY = 'pixelopolis.ruleta.hist';
const lowFx = () => typeof document !== 'undefined' && document.documentElement.classList.contains('lowfx');

function loadHistory(): number[] {
  try {
    const h = JSON.parse(localStorage.getItem(HIST_KEY) ?? '[]');
    if (Array.isArray(h) && h.length) return h.filter((n) => Number.isInteger(n) && n >= 0 && n <= 36).slice(-120);
  } catch {
    /* sin almacenamiento */
  }
  // la mesa ya llevaba un rato abierta
  return Array.from({ length: 40 }, () => spinNumber());
}
function saveHistory(h: number[]) {
  try {
    localStorage.setItem(HIST_KEY, JSON.stringify(h.slice(-120)));
  } catch {
    /* sin almacenamiento */
  }
}

const COLOR_WORD = { rojo: 'rojo', negro: 'negro', verde: 'verde' } as const;

function announce(n: number): string {
  if (n === 0) return '¡Cero! ¡Verde!';
  return `¡${n} ${COLOR_WORD[colorOf(n)]}, ${n % 2 ? 'impar' : 'par'} y ${n <= 18 ? 'falta' : 'pasa'}!`;
}

type Mode = 'pleno' | 'caballo' | 'calle' | 'cuadro' | 'linea';
const MODES: { id: Mode; name: string; pay: string; hint: string }[] = [
  { id: 'pleno', name: 'Pleno', pay: '35:1', hint: 'Toca un número' },
  { id: 'caballo', name: 'Caballo', pay: '17:1', hint: 'Toca dos números contiguos' },
  { id: 'calle', name: 'Calle', pay: '11:1', hint: 'Toca un número: su fila de 3' },
  { id: 'cuadro', name: 'Cuadro', pay: '8:1', hint: 'Toca la esquina superior izq. del cuadro' },
  { id: 'linea', name: 'Línea', pay: '5:1', hint: 'Toca un número: su fila y la de abajo' },
];

type Phase = 'bet' | 'spin' | 'result';

// ---------------------------------------------------------------------------
// Fichas
// ---------------------------------------------------------------------------

const CHIP_STYLE = [
  { c: '#f1ece0', s: '#2d6cdf', t: '#14101f' },
  { c: '#d8263a', s: '#fff4e6', t: '#fff' },
  { c: '#1f9a4c', s: '#fff4e6', t: '#fff' },
  { c: '#221b2e', s: '#ffcc33', t: '#ffcc33' },
];

function chipStyle(value: number, chips: number[]) {
  const i = chips.indexOf(value);
  return CHIP_STYLE[i < 0 ? 0 : Math.min(3, i)];
}

export function ChipFace({ value, chips, size = 26, label }: { value: number; chips: number[]; size?: number; label?: string }) {
  const st = chipStyle(value, chips);
  return (
    <span class="rl-chip" style={`--c:${st.c};--s:${st.s};--t:${st.t};width:${size}px;height:${size}px;font-size:${Math.max(7, Math.round(size * 0.3))}px`}>
      <b>{label ?? shortAmount(value)}</b>
    </span>
  );
}

function ChipStack({ amount, chips, x, y, cls = '', delay = 0 }: { amount: number; chips: number[]; x: number; y: number; cls?: string; delay?: number }) {
  const parts = chipBreakdown(amount, chips).slice(0, 6).reverse();
  return (
    <div class={`rl-stack ${cls}`} style={{ left: `${(x / CLOTH_W) * 100}%`, top: `${(y / CLOTH_H) * 100}%`, animationDelay: `${delay}ms` }}>
      {parts.map((v, i) => (
        <span key={i} class="rl-stack-chip" style={{ transform: `translate(-50%, calc(-50% - ${i * 3}px))` }}>
          <ChipFace value={v} chips={chips} size={24} label={i === parts.length - 1 ? shortAmount(amount) : ''} />
        </span>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Cilindro (canvas)
// ---------------------------------------------------------------------------

const PIX_FONT = "'LC Display', 'Press Start 2P', monospace";

function ring(ctx: CanvasRenderingContext2D, c: number, r0: number, r1: number, color: string) {
  ctx.beginPath();
  ctx.arc(c, c, r1, 0, Math.PI * 2);
  ctx.arc(c, c, r0, 0, Math.PI * 2, true);
  ctx.fillStyle = color;
  ctx.fill();
}
function circle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
}
/** Segmento de corona entre ángulos (0 arriba, horario). */
function segment(ctx: CanvasRenderingContext2D, c: number, r0: number, r1: number, a0: number, a1: number) {
  ctx.beginPath();
  ctx.arc(c, c, r1, a0 - Math.PI / 2, a1 - Math.PI / 2);
  ctx.arc(c, c, r0, a1 - Math.PI / 2, a0 - Math.PI / 2, true);
  ctx.closePath();
}

const mk = (S: number) => {
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  return [cv, cv.getContext('2d')!] as const;
};

/** Cuenco fijo: aro de madera, pista de la bola y diamantes. */
function drawBowl(S: number) {
  const [cv, ctx] = mk(S);
  const c = S / 2;
  const R = S / 2 - 1;
  // sombra
  circle(ctx, c, c + R * 0.02, R, 'rgba(0,0,0,0.5)');
  // madera en bandas (sombreado escalonado, a lo pixel art)
  const woods = ['#3a1c0c', '#6b3519', '#874621', '#9c5628', '#874621', '#6b3519', '#552a12'];
  const steps = [1, 0.985, 0.97, 0.95, 0.925, 0.905, 0.89];
  steps.forEach((s, i) => circle(ctx, c, c, R * s, woods[i]));
  // vetas
  ctx.save();
  ctx.globalAlpha = 0.18;
  for (let i = 0; i < 70; i++) {
    const a = (i / 70) * Math.PI * 2 + Math.sin(i * 7.3) * 0.03;
    const r = R * (0.9 + ((i * 37) % 9) / 100);
    ctx.fillStyle = i % 3 ? '#2a1206' : '#c27a3c';
    ctx.fillRect(c + Math.sin(a) * r - 1, c - Math.cos(a) * r - 1, Math.max(2, S / 160), Math.max(2, S / 160));
  }
  ctx.restore();
  // tachuelas de latón
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2;
    const r = R * 0.945;
    const s = Math.max(3, S / 95);
    ctx.fillStyle = '#5a3a08';
    ctx.fillRect(c + Math.sin(a) * r - s / 2, c - Math.cos(a) * r - s / 2 + 1, s, s);
    ctx.fillStyle = '#f4cd5a';
    ctx.fillRect(c + Math.sin(a) * r - s / 2, c - Math.cos(a) * r - s / 2, s, s);
    ctx.fillStyle = '#fff3c0';
    ctx.fillRect(c + Math.sin(a) * r - s / 2, c - Math.cos(a) * r - s / 2, s / 2, s / 2);
  }
  // borde dorado
  ring(ctx, c, R * 0.875, R * 0.89, '#d9a93a');
  // pista de la bola (madera oscura pulida)
  const track = ['#2b170b', '#3a2112', '#472a17', '#3e2413', '#30190c'];
  track.forEach((col, i) => circle(ctx, c, c, R * (0.875 - i * 0.026), col));
  // brillo de la pista
  ctx.save();
  ctx.globalAlpha = 0.12;
  ring(ctx, c, R * 0.8, R * 0.83, '#ffe0b0');
  ctx.restore();
  // pared interior con filo dorado
  ring(ctx, c, R * 0.735, R * 0.75, '#b8862a');
  ring(ctx, c, R * 0.735, R * 0.742, '#ffe08a');
  // diamantes (deflectores)
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    const r = R * 0.79;
    const big = i % 2 === 0;
    ctx.save();
    ctx.translate(c + Math.sin(a) * r, c - Math.cos(a) * r);
    ctx.rotate(a + (big ? 0 : Math.PI / 2));
    const w = R * (big ? 0.022 : 0.03);
    const h = R * (big ? 0.045 : 0.018);
    ctx.beginPath();
    ctx.moveTo(0, -h);
    ctx.lineTo(w, 0);
    ctx.lineTo(0, h);
    ctx.lineTo(-w, 0);
    ctx.closePath();
    ctx.fillStyle = '#e8b847';
    ctx.fill();
    ctx.fillStyle = '#fff4c4';
    ctx.fillRect(-w * 0.35, -h * 0.5, w * 0.35, h * 0.5);
    ctx.restore();
  }
  // fondo bajo el rotor
  circle(ctx, c, c, R * 0.735, '#120a06');
  return cv;
}

/** Rotor: números, casillas con trastes y el cono con la cruceta. */
function drawRotor(S: number) {
  const [cv, ctx] = mk(S);
  const c = S / 2;
  const R = S / 2 - 1;
  const colors = { rojo: ['#c9202f', '#8a1220'], negro: ['#1d1824', '#0b0910'], verde: ['#17a04d', '#0b6a30'] };
  WHEEL_ORDER.forEach((n, i) => {
    const a0 = i * POCKET - POCKET / 2;
    const a1 = a0 + POCKET;
    const col = colors[colorOf(n)];
    // número
    segment(ctx, c, R * 0.615, R * 0.732, a0, a1);
    ctx.fillStyle = col[0];
    ctx.fill();
    // banda de luz arriba del segmento
    segment(ctx, c, R * 0.71, R * 0.732, a0, a1);
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fill();
    // casilla
    segment(ctx, c, R * 0.5, R * 0.615, a0, a1);
    ctx.fillStyle = col[1];
    ctx.fill();
    segment(ctx, c, R * 0.5, R * 0.53, a0, a1);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fill();
    // texto
    ctx.save();
    ctx.translate(c, c);
    ctx.rotate(i * POCKET);
    ctx.fillStyle = '#fffaf0';
    ctx.font = `700 ${Math.round(R * 0.07)}px ${PIX_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(n), 0, -R * 0.672);
    ctx.restore();
  });
  // trastes metálicos
  for (let i = 0; i < 37; i++) {
    const a = i * POCKET - POCKET / 2;
    ctx.save();
    ctx.translate(c, c);
    ctx.rotate(a);
    const w = Math.max(2, R * 0.012);
    ctx.fillStyle = '#7d7f8c';
    ctx.fillRect(-w / 2, -R * 0.615, w, R * 0.115);
    ctx.fillStyle = '#e9ebf4';
    ctx.fillRect(-w / 2, -R * 0.615, w / 2, R * 0.115);
    // separador fino entre números
    ctx.fillStyle = '#e6b84a';
    ctx.fillRect(-0.6, -R * 0.732, 1.2, R * 0.117);
    ctx.restore();
  }
  ring(ctx, c, R * 0.612, R * 0.62, '#e6b84a');
  ring(ctx, c, R * 0.495, R * 0.505, '#e6b84a');
  // cono de madera en bandas
  const cone = ['#5e2f12', '#753c18', '#8c4a1f', '#a05a28', '#b46a32'];
  cone.forEach((col, i) => circle(ctx, c, c, R * (0.495 - i * 0.06), col));
  // vetas del cono
  ctx.save();
  ctx.globalAlpha = 0.2;
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2;
    ctx.save();
    ctx.translate(c, c);
    ctx.rotate(a);
    ctx.fillStyle = i % 2 ? '#2a1206' : '#e09a58';
    ctx.fillRect(-0.8, -R * 0.48, 1.6, R * 0.2);
    ctx.restore();
  }
  ctx.restore();
  // cruceta
  for (let k = 0; k < 4; k++) {
    ctx.save();
    ctx.translate(c, c);
    ctx.rotate((k * Math.PI) / 2 + Math.PI / 4);
    const w = R * 0.04;
    ctx.fillStyle = '#7a5410';
    ctx.fillRect(-w / 2 + 1, -R * 0.4 + 1, w, R * 0.4);
    ctx.fillStyle = '#e6b84a';
    ctx.fillRect(-w / 2, -R * 0.4, w, R * 0.4);
    ctx.fillStyle = '#fff1b0';
    ctx.fillRect(-w / 2, -R * 0.4, w / 3, R * 0.4);
    circle(ctx, 1, -R * 0.4 + 1, R * 0.045, '#7a5410');
    circle(ctx, 0, -R * 0.4, R * 0.045, '#f2c95a');
    circle(ctx, -R * 0.012, -R * 0.412, R * 0.016, '#fff6cc');
    ctx.restore();
  }
  // torreta
  circle(ctx, c, c, R * 0.13, '#7a5410');
  circle(ctx, c, c, R * 0.115, '#e6b84a');
  circle(ctx, c, c, R * 0.075, '#c4922c');
  circle(ctx, c, c, R * 0.04, '#fff1b0');
  circle(ctx, c - R * 0.03, c - R * 0.03, R * 0.02, '#ffffff');
  return cv;
}

/** Brillo fijo encima (cristal, viñeta). */
function drawGloss(S: number) {
  const [cv, ctx] = mk(S);
  const c = S / 2;
  const R = S / 2 - 1;
  const g = ctx.createRadialGradient(c - R * 0.35, c - R * 0.45, R * 0.05, c - R * 0.2, c - R * 0.25, R * 0.95);
  g.addColorStop(0, 'rgba(255,255,255,0.16)');
  g.addColorStop(0.5, 'rgba(255,255,255,0.03)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(c, c, R * 0.88, 0, Math.PI * 2);
  ctx.fill();
  const v = ctx.createRadialGradient(c, c, R * 0.6, c, c, R * 0.74);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(0,0,0,0.35)');
  ctx.fillStyle = v;
  ctx.beginPath();
  ctx.arc(c, c, R * 0.74, 0, Math.PI * 2);
  ctx.fill();
  return cv;
}

function Wheel({ plan, size, onSettle, idleAngle }: { plan: SpinPlan | null; size: number; onSettle: () => void; idleAngle: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const cb = useRef(onSettle);
  cb.current = onSettle;
  useEffect(() => {
    const cv = ref.current;
    const ctx = cv?.getContext('2d');
    if (!cv || !ctx) return;
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    const S = Math.round(size * dpr);
    cv.width = cv.height = S;
    let bowl = drawBowl(S);
    let rotor = drawRotor(S);
    const gloss = drawGloss(S);
    // con la fuente pixelada ya cargada, se repintan los números
    let alive = true;
    document.fonts?.load(`700 12px 'LC Display'`).then(() => alive && (rotor = drawRotor(S), bowl = drawBowl(S)));
    const c = S / 2;
    const R = S / 2 - 1;
    const low = lowFx();
    const t0 = performance.now();
    let settled = false;
    let lastPocket = NaN;
    let lastTick = 0;
    let raf = 0;
    const frame = (now: number) => {
      const t = (now - t0) / 1000;
      const w = plan ? wheelAngle(plan, t) : idleAngle + t * 0.35;
      ctx.clearRect(0, 0, S, S);
      ctx.drawImage(bowl, 0, 0);
      ctx.save();
      ctx.translate(c, c);
      ctx.rotate(w);
      ctx.drawImage(rotor, -c, -c);
      if (plan && t >= plan.settle) {
        // casilla ganadora que late
        const a = pocketAngle(plan.result);
        const pulse = 0.5 + 0.5 * Math.sin((t - plan.settle) * 8);
        ctx.translate(-c, -c);
        segment(ctx, c, R * 0.5, R * 0.732, a - POCKET / 2, a + POCKET / 2);
        ctx.fillStyle = `rgba(255,214,90,${0.18 + pulse * 0.3})`;
        ctx.fill();
        ctx.lineWidth = Math.max(2, R * 0.012);
        ctx.strokeStyle = '#ffd65a';
        ctx.stroke();
      }
      ctx.restore();
      if (plan) {
        const b = ballAt(plan, Math.min(t, plan.settle + 30));
        const r = R * (0.805 - b.depth * 0.248 + b.hop * 0.05);
        const bx = c + Math.sin(b.angle) * r;
        const by = c - Math.cos(b.angle) * r;
        const br = R * 0.03 * (1 + b.hop * 0.35);
        // sombra
        circle(ctx, bx + br * (0.3 + b.hop * 1.4), by + br * (0.5 + b.hop * 1.8), br, 'rgba(0,0,0,0.45)');
        if (!low && !b.settled && b.depth < 0.2) {
          // estela
          for (let k = 1; k <= 3; k++) {
            const bb = ballAt(plan, t - k * 0.014);
            const rr = R * (0.805 - bb.depth * 0.248);
            circle(ctx, c + Math.sin(bb.angle) * rr, c - Math.cos(bb.angle) * rr, br * (1 - k * 0.15), `rgba(255,255,255,${0.16 - k * 0.04})`);
          }
        }
        const g = ctx.createRadialGradient(bx - br * 0.35, by - br * 0.4, br * 0.1, bx, by, br);
        g.addColorStop(0, '#ffffff');
        g.addColorStop(0.6, '#e4e4ec');
        g.addColorStop(1, '#8e8ea0');
        ctx.beginPath();
        ctx.arc(bx, by, br, 0, Math.PI * 2);
        ctx.fillStyle = g;
        ctx.fill();
        // tic por casilla (solo cuando toca los trastes suena fuerte)
        const pocket = Math.floor((b.rel + POCKET / 2) / POCKET);
        if (!b.settled && pocket !== lastPocket) {
          if (!Number.isNaN(lastPocket) && now - lastTick > 32) {
            lastTick = now;
            fx.tick(b.depth > 0.3 ? 0.06 + b.hop * 0.05 : 0.018);
          }
          lastPocket = pocket;
        }
        if (!settled && t >= plan.settle) {
          settled = true;
          fx.tick(0.1);
          cb.current();
        }
      }
      ctx.drawImage(gloss, 0, 0);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
    };
  }, [plan, size]);
  return <canvas ref={ref} class="rl-wheel" style={{ width: `${size}px`, height: `${size}px` }} />;
}

// ---------------------------------------------------------------------------
// Tapete
// ---------------------------------------------------------------------------

const pct = (v: number, of: number) => `${(v / of) * 100}%`;

function Dolly() {
  // peón de metacrilato, en píxeles
  return (
    <svg class="rl-dolly" viewBox="0 0 10 14" shape-rendering="crispEdges" aria-hidden="true">
      <rect x="3" y="0" width="4" height="1" fill="#14101f" />
      <rect x="2" y="1" width="6" height="4" fill="#14101f" />
      <rect x="3" y="1" width="4" height="3" fill="#fffaf0" />
      <rect x="3" y="1" width="1" height="1" fill="#fff" />
      <rect x="3" y="5" width="4" height="4" fill="#14101f" />
      <rect x="4" y="5" width="2" height="4" fill="#ffcc33" />
      <rect x="1" y="9" width="8" height="1" fill="#14101f" />
      <rect x="0" y="10" width="10" height="4" fill="#14101f" />
      <rect x="1" y="10" width="8" height="3" fill="#ffcc33" />
      <rect x="1" y="10" width="8" height="1" fill="#fff1b0" />
    </svg>
  );
}

function Cloth({
  bets,
  chips,
  onNumber,
  onOutside,
  pending,
  flash,
  result,
  lines,
  pops,
}: {
  bets: Placed[];
  chips: number[];
  onNumber: (n: number) => void;
  onOutside: (b: Bet) => void;
  pending: number | null;
  flash: { nums: number[]; k: number };
  result: number | null;
  lines: BetResult[] | null;
  pops: ReturnType<typeof usePops>['pops'];
}) {
  const ref = useRef<HTMLDivElement>(null);
  const NX = CLOTH.evenW + CLOTH.dozenW;
  const tap = (e: PointerEvent) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const ux = ((e.clientX - r.left) / r.width) * CLOTH_W;
    const uy = ((e.clientY - r.top) / r.height) * CLOTH_H;
    const inRows = uy >= CLOTH.zeroH && uy < CLOTH.zeroH + 12;
    const row = Math.floor(uy - CLOTH.zeroH);
    if (ux >= NX) {
      const col = Math.max(0, Math.min(2, Math.floor((ux - NX) / CLOTH.numW))) as 0 | 1 | 2;
      if (uy < CLOTH.zeroH) onNumber(0);
      else if (inRows) onNumber(row * 3 + col + 1);
      else onOutside(outsideBets.columna(col));
    } else if (inRows) {
      if (ux >= CLOTH.evenW) onOutside(outsideBets.docena(Math.floor(row / 4) as 0 | 1 | 2));
      else onOutside(outsideBets[(['falta', 'par', 'rojo', 'negro', 'impar', 'pasa'] as const)[Math.floor(row / 2)]]());
    }
  };
  const winSet = useMemo(() => new Set(lines?.filter((l) => l.won).map((l) => l.bet.key)), [lines]);
  const cells = [];
  for (let n = 0; n <= 36; n++) {
    const r = n === 0 ? { x: NX, y: 0, w: CLOTH.numW * 3, h: CLOTH.zeroH } : { x: NX + ((n - 1) % 3) * CLOTH.numW, y: CLOTH.zeroH + Math.floor((n - 1) / 3), w: CLOTH.numW, h: 1 };
    const cls = [
      'rl-cell',
      n === 0 ? 'rl-zero' : '',
      `rl-${colorOf(n)}`,
      pending === n ? 'rl-pending' : '',
      flash.nums.includes(n) ? 'rl-flash' : '',
      result === n ? 'rl-hit' : '',
    ].join(' ');
    cells.push(
      <div key={`n${n}-${flash.nums.includes(n) ? flash.k : 0}`} class={cls} style={{ left: pct(r.x, CLOTH_W), top: pct(r.y, CLOTH_H), width: pct(r.w, CLOTH_W), height: pct(r.h, CLOTH_H) }}>
        <span class="rl-num">{n}</span>
      </div>,
    );
  }
  const outside: { bet: Bet; label: ComponentChildren; x: number; y: number; w: number; h: number; cls?: string; vertical?: boolean }[] = [];
  (['falta', 'par', 'rojo', 'negro', 'impar', 'pasa'] as const).forEach((k, i) => {
    const label = k === 'rojo' ? <span class="rl-diamond red" /> : k === 'negro' ? <span class="rl-diamond black" /> : { falta: '1-18', par: 'PAR', impar: 'IMPAR', pasa: '19-36' }[k];
    outside.push({ bet: outsideBets[k](), label, x: 0, y: CLOTH.zeroH + i * 2, w: CLOTH.evenW, h: 2, vertical: true });
  });
  ([0, 1, 2] as const).forEach((d) => outside.push({ bet: outsideBets.docena(d), label: `${d + 1}ª 12`, x: CLOTH.evenW, y: CLOTH.zeroH + d * 4, w: CLOTH.dozenW, h: 4, vertical: true }));
  ([0, 1, 2] as const).forEach((c) => outside.push({ bet: outsideBets.columna(c), label: '2:1', x: NX + c * CLOTH.numW, y: CLOTH.zeroH + 12, w: CLOTH.numW, h: CLOTH.colH }));
  const resultIn = (b: Bet) => result !== null && b.numbers.includes(result);
  const spot = result !== null ? chipSpot(makeBet('pleno', [result])) : null;
  return (
    <div class="rl-cloth" ref={ref} onPointerDown={tap}>
      <div class="rl-felt-logo" style={{ left: 0, top: 0, width: pct(NX, CLOTH_W), height: pct(CLOTH.zeroH, CLOTH_H) }}>
        <span>PIXELOPOLIS</span>
        <small>CASINO · 1985</small>
      </div>
      <div class="rl-felt-logo rl-felt-foot" style={{ left: 0, top: pct(CLOTH.zeroH + 12, CLOTH_H), width: pct(NX, CLOTH_W), height: pct(CLOTH.colH, CLOTH_H) }}>
        <small>MÁX. 35 a 1</small>
      </div>
      {cells}
      {outside.map((o) => (
        <div
          key={o.bet.key}
          class={`rl-cell rl-out ${o.vertical ? 'rl-vert' : ''} ${resultIn(o.bet) ? 'rl-hit' : ''}`}
          style={{ left: pct(o.x, CLOTH_W), top: pct(o.y, CLOTH_H), width: pct(o.w, CLOTH_W), height: pct(o.h, CLOTH_H) }}
        >
          <span class="rl-out-label">{o.label}</span>
        </div>
      ))}
      {bets.map(({ bet, amount }, i) => {
        const s = chipSpot(bet);
        const won = winSet.has(bet.key);
        const swept = lines && !won;
        return <ChipStack key={bet.key} amount={amount} chips={chips} x={s.x} y={s.y} cls={swept ? 'rl-swept' : won ? 'rl-won' : 'rl-placed'} delay={swept ? 500 + i * 70 : 0} />;
      })}
      {lines
        ?.filter((l) => l.won)
        .map((l, i) => {
          const s = chipSpot(l.bet);
          return <ChipStack key={`pay-${l.bet.key}`} amount={l.returned - l.amount} chips={chips} x={s.x + 0.45} y={s.y - 0.25} cls="rl-payout" delay={700 + i * 120} />;
        })}
      {spot && (
        <div class="rl-dolly-wrap" style={{ left: pct(spot.x, CLOTH_W), top: pct(spot.y, CLOTH_H) }}>
          <Dolly />
        </div>
      )}
      <PopLayer pops={pops} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mesa
// ---------------------------------------------------------------------------

const CROUPIER = { ...randomPerson(19851), wear: 'traje' as const, outfit: '#3a3a46', hair: 'tupe' as const, hairColor: '#1c1818', name: 'Monsieur Dubois' };

export function Roulette(p: CasinoTableProps) {
  const { chips, fmt } = p;
  const talk = useTalk(CROUPIER);
  const { pops, pop } = usePops();
  const shake = useShake();
  const [chipIdx, setChipIdx] = useState(0);
  const [mode, setMode] = useState<Mode>('pleno');
  const [pending, setPending] = useState<number | null>(null);
  const [bets, setBets] = useState<Placed[]>([]);
  const [undo, setUndo] = useState<Placed[][]>([]);
  const [last, setLast] = useState<Placed[]>([]);
  const [phase, setPhase] = useState<Phase>('bet');
  const [plan, setPlan] = useState<SpinPlan | null>(null);
  const [showWheel, setShowWheel] = useState(false);
  const [result, setResult] = useState<number | null>(null);
  const [lines, setLines] = useState<BetResult[] | null>(null);
  const [net, setNet] = useState<number | null>(null);
  const [history, setHistory] = useState<number[]>(loadHistory);
  const [flash, setFlash] = useState({ nums: [] as number[], k: 0 });
  const [msg, setMsg] = useState('');
  const [wheelSize, setWheelSize] = useState(300);
  const areaRef = useRef<HTMLDivElement>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const settleRef = useRef<(() => void) | null>(null);
  const wheelAng = useRef(Math.random() * Math.PI * 2);

  const alive = useRef(true);
  const later = (ms: number, f: () => void) => alive.current && timers.current.push(setTimeout(() => alive.current && f(), ms));
  useEffect(() => {
    later(350, () => talk.say('Bienvenido. Hagan juego, señores.'));
    return () => {
      alive.current = false;
      timers.current.forEach(clearTimeout);
      // si se cierra la mesa con la bola girando, la jugada se liquida igual
      settleRef.current?.();
    };
  }, []);

  // tamaño del cilindro según el hueco del tapete
  useEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    const fit = () => setWheelSize(Math.max(200, Math.min(400, el.clientWidth - 24, el.clientHeight - 90)));
    fit();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(fit) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, []);

  const total = bets.reduce((a, b) => a + b.amount, 0);
  const limit = Math.max(0, Math.min(p.money, p.maxBet));
  const chip = chips[chipIdx] ?? chips[0];
  const { hot, cold } = useMemo(() => hotCold(history.slice(-100)), [history]);
  const say = (s: string, m: Mood = 'normal') => talk.say(s, m);

  const flashMsg = (s: string) => {
    setMsg(s);
    shake.shake();
    play.error();
    later(1800, () => setMsg((x) => (x === s ? '' : x)));
  };

  /** Empieza una ronda nueva si veníamos de un resultado. */
  const fresh = () => {
    if (phase !== 'result') return bets;
    setPhase('bet');
    setResult(null);
    setLines(null);
    setNet(null);
    setUndo([]);
    return [] as Placed[];
  };

  const place = (bet: Bet) => {
    if (phase === 'spin') return;
    const cur = fresh();
    const curTotal = cur.reduce((a, b) => a + b.amount, 0);
    if (curTotal + chip > limit) {
      flashMsg(curTotal + chip > p.maxBet ? `Límite de la mesa: ${fmt(p.maxBet)}` : 'No te queda dinero para esa ficha');
      return;
    }
    const i = cur.findIndex((b) => b.bet.key === bet.key);
    const next = i >= 0 ? cur.map((b, j) => (j === i ? { ...b, amount: b.amount + chip } : b)) : [...cur, { bet, amount: chip }];
    setUndo((u) => [...u.slice(-30), cur]);
    setBets(next);
    setFlash((f) => ({ nums: bet.numbers.length <= 6 ? bet.numbers : [], k: f.k + 1 }));
    fx.chip();
  };

  const onNumber = (n: number) => {
    if (phase === 'spin') return;
    if (mode === 'pleno') return place(makeBet('pleno', [n]));
    if (mode === 'calle') return place(streetAt(n));
    if (mode === 'cuadro') return place(cornerAt(n));
    if (mode === 'linea') {
      if (n === 0) return flashMsg('La línea no incluye el cero');
      return place(lineAt(n));
    }
    // caballo: dos toques
    if (pending === null || pending === n) {
      setPending(pending === n ? null : n);
      if (pending !== n) fx.pop();
      return;
    }
    const s = splitOf(pending, n);
    if (s) {
      setPending(null);
      place(s);
    } else {
      setPending(n);
      fx.pop();
    }
  };

  const clearAll = () => {
    if (phase === 'spin') return;
    fresh();
    if (bets.length && phase !== 'result') setUndo((u) => [...u, bets]);
    setBets([]);
    setPending(null);
  };
  const undoLast = () => {
    if (phase !== 'bet' || !undo.length) return;
    setBets(undo[undo.length - 1]);
    setUndo((u) => u.slice(0, -1));
    fx.chip();
  };
  const repeat = () => {
    if (phase === 'spin' || !last.length) return;
    const t = last.reduce((a, b) => a + b.amount, 0);
    if (t > limit) return flashMsg('No llega para repetir la apuesta');
    fresh();
    setUndo((u) => [...u, phase === 'result' ? [] : bets]);
    setBets(last);
    fx.chip();
  };
  const double = () => {
    if (phase !== 'bet' || !bets.length) return;
    if (total * 2 > limit) return flashMsg(total * 2 > p.maxBet ? `Límite de la mesa: ${fmt(p.maxBet)}` : 'No te llega para doblar');
    setUndo((u) => [...u, bets]);
    setBets(bets.map((b) => ({ ...b, amount: b.amount * 2 })));
    fx.chip();
    later(60, () => fx.chip());
  };

  const spin = () => {
    if (phase !== 'bet' || !bets.length) return;
    if (total > limit) return flashMsg('La apuesta supera tu saldo o el límite');
    const n = spinNumber();
    const pl = planSpin(n, wheelAng.current);
    const placed = bets;
    setPending(null);
    setLast(placed);
    setPhase('spin');
    setShowWheel(true);
    setPlan(pl);
    fx.whoosh();
    say(['¡Bola en juego!', 'Allá va la bola…', 'Suerte, señores.'][Math.floor(Math.random() * 3)]);
    later(Math.max(1200, pl.drop * 1000 - 900), () => say('No va más.'));
    let done = false;
    settleRef.current = () => {
      if (done) return;
      done = true;
      settleRef.current = null;
      const res = resolveSpin(placed, n);
      const detail = `Ruleta: ${n} ${n ? colorOf(n) : 'cero'} · ${res.lines.map((l) => `${l.bet.label} ${fmt(l.amount)}${l.won ? ' ✔' : ''}`).join(', ')}`;
      const ok = p.settle(res.staked, res.returned, detail);
      return void finish(n, pl, res, ok);
    };
  };

  const finish = (n: number, pl: SpinPlan, res: ReturnType<typeof resolveSpin>, ok: boolean) => {
    wheelAng.current = wheelAngle(pl, pl.settle + 2);
    const h = [...history, n].slice(-120);
    setHistory(h);
    saveHistory(h);
    setResult(n);
    say(announce(n), 'normal');
    if (!ok) {
      setMsg('La banca no acepta la jugada: se te devuelven las fichas.');
      later(1900, () => {
        setShowWheel(false);
        setPhase('bet');
        setResult(null);
        say('Disculpe, la banca no puede aceptar esa apuesta.', 'nervios');
      });
      return;
    }
    const gain = res.returned - res.staked;
    later(1900, () => {
      setShowWheel(false);
      setPhase('result');
      setLines(res.lines);
      setNet(gain);
      setBets(res.lines.map((l) => ({ bet: l.bet, amount: l.amount })));
      if (res.returned > 0) {
        res.lines
          .filter((l) => l.won)
          .forEach((l, i) => {
            const s = chipSpot(l.bet);
            later(800 + i * 140, () => pop(`+${fmt(l.returned - l.amount)}`, (s.x / CLOTH_W) * 100, (s.y / CLOTH_H) * 100 - 3, l.bet.kind === 'pleno' ? 'gold' : 'good'));
          });
        const big = res.lines.some((l) => l.won && l.bet.kind === 'pleno');
        later(700, () => (big ? fx.jackpot() : play.good()));
        later(600, () => play.coin());
        later(2300, () =>
          say(
            big
              ? `¡Pleno! La casa paga 35 a 1. Enhorabuena.`
              : gain > 0
                ? `Buen ojo. Le pago ${fmt(res.returned)}.`
                : `Recupera ${fmt(res.returned)}. Por poco.`,
            'feliz',
          ),
        );
      } else {
        later(900, () => play.bad());
        later(2300, () => say(n === 0 ? 'El cero. La casa se lo lleva todo.' : ['Lo siento. La bola no perdona.', 'Otra vez será. Hagan juego.', 'La próxima es la buena, señor.'][Math.floor(Math.random() * 3)], n === 0 ? 'normal' : 'triste'));
      }
    });
  };

  const onWheelSettle = () => settleRef.current?.();
  const spinning = phase === 'spin';
  const recent = history.slice(-12).reverse();
  const modeInfo = MODES.find((m) => m.id === mode)!;

  return (
    <div class={`rl-room ${shake.cls}`}>
      <div class="mg-head rl-head">
        <button class="btn small secondary" disabled={spinning} onClick={p.onExit}>
          ◀ Vestíbulo
        </button>
        <span class="mg-title">RULETA</span>
        <span class="mg-score rl-money">{fmt(p.money)}</span>
      </div>
      <div class="rl-top">
        <Talker person={CROUPIER} talk={talk} scale={2} class="rl-croupier" />
        <div class="rl-board">
          <div class="rl-hist">
            {recent.map((n, i) => (
              <span key={`${history.length}-${i}`} class={`rl-h rl-h-${colorOf(n)} ${i === 0 ? 'rl-h-last' : ''}`}>
                {n}
              </span>
            ))}
          </div>
          <div class="rl-hotcold">
            <span class="rl-hot">CALIENTES</span>
            {hot.map((n) => (
              <span key={`h${n}`} class={`rl-mini rl-h-${colorOf(n)}`}>{n}</span>
            ))}
            <span class="rl-cold">FRÍOS</span>
            {cold.map((n) => (
              <span key={`c${n}`} class={`rl-mini rl-h-${colorOf(n)}`}>{n}</span>
            ))}
          </div>
        </div>
      </div>
      <div class="rl-modes">
        {MODES.map((m) => (
          <button key={m.id} class={`rl-mode ${mode === m.id ? 'on' : ''}`} onClick={() => (setMode(m.id), setPending(null))}>
            {m.name}
            <small>{m.pay}</small>
          </button>
        ))}
      </div>
      <div class="rl-area" ref={areaRef}>
        <Cloth bets={bets} chips={chips} onNumber={onNumber} onOutside={place} pending={pending} flash={flash} result={phase === 'result' ? result : null} lines={phase === 'result' ? lines : null} pops={pops} />
        {showWheel && (
          <div class="rl-wheel-stage">
            <Wheel plan={plan} size={wheelSize} onSettle={onWheelSettle} idleAngle={wheelAng.current} />
            {result !== null && phase === 'spin' && (
              <div class={`rl-result rl-h-${colorOf(result)}`}>
                <b>{result}</b>
                <span>{result === 0 ? 'CERO' : colorOf(result).toUpperCase()}</span>
              </div>
            )}
            {result === null && <div class="rl-novamas">{talk.line === 'No va más.' ? 'NO VA MÁS' : 'BOLA EN JUEGO'}</div>}
          </div>
        )}
        {msg && <div class="rl-msg">{msg}</div>}
      </div>
      <div class="rl-info">
        {phase === 'result' && net !== null ? (
          <span class={net > 0 ? 'rl-good' : net < 0 ? 'rl-bad' : ''}>{net > 0 ? `¡Ganas ${fmt(net)}!` : net < 0 ? `Pierdes ${fmt(-net)}` : 'Quedas igual'}</span>
        ) : (
          <span>
            {mode !== 'pleno' && phase === 'bet' ? modeInfo.hint : 'En mesa'} · <b>{fmt(total)}</b>
          </span>
        )}
        <span class="rl-limit">Máx. {fmt(p.maxBet)}</span>
      </div>
      <div class="rl-chips">
        {chips.map((v, i) => (
          <button key={v} class={`rl-chip-btn ${i === chipIdx ? 'on' : ''}`} disabled={v > limit} onClick={() => (setChipIdx(i), fx.chip())}>
            <ChipFace value={v} chips={chips} size={46} />
          </button>
        ))}
      </div>
      <div class="rl-actions">
        <button class="btn small secondary" disabled={spinning || phase !== 'bet' || !undo.length} onClick={undoLast}>
          ↶
        </button>
        <button class="btn small secondary" disabled={spinning || !bets.length} onClick={clearAll}>
          Borrar
        </button>
        {phase === 'bet' && bets.length ? (
          <button class="btn small secondary" disabled={spinning} onClick={double}>
            Doblar
          </button>
        ) : (
          <button class="btn small secondary" disabled={spinning || !last.length} onClick={repeat}>
            Repetir
          </button>
        )}
        <button class="btn rl-spin" disabled={phase !== 'bet' || !bets.length} onClick={spin}>
          {spinning ? '…' : 'GIRAR'}
        </button>
      </div>
    </div>
  );
}
