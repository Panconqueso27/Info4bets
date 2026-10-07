import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { drawPortrait, PORTRAIT_H, PORTRAIT_W, randomPerson, type Person } from '../../art/portrait';
import { R, type SceneDraw } from '../games/stage';
import { isRed, rankLabel, SUIT_CHAR, type Card } from './poker-eval';
import './cards.css';

/**
 * Piezas comunes de las mesas de cartas (blackjack y póker): naipes con
 * reparto y volteo animados, fichas apilables que vuelan por la mesa y el
 * fondo animado de la sala del casino.
 */

export * from './poker-eval';

export const lowFx = () => typeof document !== 'undefined' && document.documentElement.classList.contains('lowfx');
export const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, lowFx() ? ms * 0.6 : ms));
export const pickOne = <T,>(a: readonly T[]) => a[Math.floor(Math.random() * a.length)];

// ---------------------------------------------------------------------------
// Figuras: retratos de pixel art de J, Q y K (se generan una vez)
// ---------------------------------------------------------------------------

const courtCache = new Map<string, string>();
function courtImage(r: number, s: Card['s']): string {
  const key = `${r}${s}`;
  const hit = courtCache.get(key);
  if (hit) return hit;
  const cv = document.createElement('canvas');
  cv.width = PORTRAIT_W;
  cv.height = PORTRAIT_H;
  const ctx = cv.getContext('2d');
  if (!ctx) return '';
  const base = randomPerson(r * 31 + 'shdc'.indexOf(s) * 7 + 3);
  const red = isRed(s);
  const p: Person = {
    ...base,
    outfit: red ? '#c8283c' : '#2b2f6b',
    wear: r === 11 ? 'jersey' : r === 12 ? 'vestido' : 'traje',
    hair: r === 12 ? (s === 'h' || s === 's' ? 'largo' : 'permanente') : r === 11 ? 'tupe' : 'corto',
    lipstick: r === 12,
    earrings: r === 12,
    mustache: r === 13,
    beard: r === 13 && (s === 's' || s === 'd'),
    glasses: false,
  };
  drawPortrait(ctx, p, { mood: 'normal', mouth: 0 });
  // corona (reina y rey) o gorro de bufón (jota)
  const g = (x: number, y: number, w: number, h: number, c: string) => {
    ctx.fillStyle = c;
    ctx.fillRect(x, y, w, h);
  };
  if (r >= 12) {
    g(9, 3, 14, 4, '#f6c445');
    g(9, 6, 14, 1, '#b8862a');
    for (const x of [9, 14, 19]) g(x, 0, 2 + (x === 14 ? 2 : 0), 3, '#f6c445');
    g(15, 4, 2, 2, red ? '#ff4f9a' : '#4ff0ff');
  } else {
    g(10, 2, 12, 4, red ? '#2b2f6b' : '#c8283c');
    g(8, 0, 4, 3, red ? '#2b2f6b' : '#c8283c');
    g(20, 0, 4, 3, red ? '#2b2f6b' : '#c8283c');
    g(8, 0, 2, 2, '#f6c445');
    g(22, 0, 2, 2, '#f6c445');
  }
  const url = cv.toDataURL();
  courtCache.set(key, url);
  return url;
}

// ---------------------------------------------------------------------------
// Pintas de las cartas numéricas (posiciones en % de la zona central)
// ---------------------------------------------------------------------------

const L = 22;
const M = 50;
const Rr = 78;
const PIPS: Record<number, [number, number][]> = {
  2: [[M, 10], [M, 90]],
  3: [[M, 10], [M, 50], [M, 90]],
  4: [[L, 10], [Rr, 10], [L, 90], [Rr, 90]],
  5: [[L, 10], [Rr, 10], [M, 50], [L, 90], [Rr, 90]],
  6: [[L, 10], [Rr, 10], [L, 50], [Rr, 50], [L, 90], [Rr, 90]],
  7: [[L, 10], [Rr, 10], [M, 30], [L, 50], [Rr, 50], [L, 90], [Rr, 90]],
  8: [[L, 10], [Rr, 10], [M, 30], [L, 50], [Rr, 50], [M, 70], [L, 90], [Rr, 90]],
  9: [[L, 8], [Rr, 8], [L, 36], [Rr, 36], [M, 50], [L, 64], [Rr, 64], [L, 92], [Rr, 92]],
  10: [[L, 8], [Rr, 8], [M, 24], [L, 36], [Rr, 36], [L, 64], [Rr, 64], [M, 76], [L, 92], [Rr, 92]],
};

function CardFace({ card }: { card: Card }) {
  const sym = SUIT_CHAR[card.s];
  const lab = rankLabel(card.r);
  let center;
  if (card.r === 14) center = <span class="pc-ace">{sym}</span>;
  else if (card.r >= 11)
    center = (
      <span class="pc-court">
        <img src={courtImage(card.r, card.s)} alt="" draggable={false} />
        <i>{sym}</i>
      </span>
    );
  else
    center = (
      <span class="pc-pips">
        {PIPS[card.r].map(([x, y], k) => (
          <i key={k} style={{ left: `${x}%`, top: `${y}%` }} class={y > 55 ? 'flip' : ''}>
            {sym}
          </i>
        ))}
      </span>
    );
  return (
    <div class={`pc-face ${isRed(card.s) ? 'red' : 'black'}`}>
      <span class="pc-corner tl">
        <b>{lab}</b>
        <i>{sym}</i>
      </span>
      {center}
      <span class="pc-corner br">
        <b>{lab}</b>
        <i>{sym}</i>
      </span>
    </div>
  );
}

export function CardBack() {
  return (
    <div class="pc-back">
      <span class="pc-back-logo">P</span>
    </div>
  );
}

/**
 * Naipe. Al montarse vuela desde el elemento `from` (selector buscado dentro
 * de la mesa más cercana `[data-table]`) girando un poco, y si `up` se da la
 * vuelta al llegar. Cambiar `up` después lo voltea (rotateY).
 */
export function PlayingCard({ card, up = true, from, delay = 0, class: cls = '', style }: { card: Card; up?: boolean; from?: string; delay?: number; class?: string; style?: Record<string, string | number> }) {
  const ref = useRef<HTMLDivElement>(null);
  const animate = !!from && !lowFx();
  const [shown, setShown] = useState(animate ? false : up);
  const landed = useRef(!animate);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !animate) return;
    const src = el.closest('[data-table]')?.querySelector(from!);
    let t = 0;
    if (src) {
      const a = src.getBoundingClientRect();
      const b = el.getBoundingClientRect();
      const dx = a.left + a.width / 2 - (b.left + b.width / 2);
      const dy = a.top + a.height / 2 - (b.top + b.height / 2);
      const rot = (Math.random() - 0.5) * 50 - 20;
      el.animate(
        [
          { transform: `translate(${dx}px, ${dy}px) rotate(${rot}deg) scale(0.7)`, opacity: 0.4 },
          { opacity: 1, offset: 0.25 },
          { transform: 'translate(0, 0) rotate(0) scale(1)', opacity: 1 },
        ],
        { duration: 420, delay, easing: 'cubic-bezier(.2,.75,.3,1)', fill: 'backwards' },
      );
      t = delay + 400;
    }
    const id = setTimeout(() => {
      landed.current = true;
      setShown(up);
    }, t);
    return () => clearTimeout(id);
  }, []);

  useEffect(() => {
    if (landed.current) setShown(up);
  }, [up]);

  return (
    <div ref={ref} class={`pc ${shown ? '' : 'down'} ${cls}`} style={style}>
      <div class="pc-in">
        <CardFace card={card} />
        <CardBack />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Fichas
// ---------------------------------------------------------------------------

/** Etiqueta corta de una ficha: 5, 25, 1K, 100K, 1M. */
export function short(n: number): string {
  if (n >= 1e6) return `${+(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${+(n / 1e3).toFixed(1)}K`;
  return String(+n.toFixed(1));
}

/** Descompone una cantidad en fichas (mayor primero). Devuelve índices de `chips`. */
export function decompose(amount: number, chips: number[], max = 40): number[] {
  const out: number[] = [];
  let left = amount;
  for (let i = chips.length - 1; i >= 0 && out.length < max; i--) {
    while (left >= chips[i] - 1e-9 && out.length < max) {
      out.push(i);
      left -= chips[i];
    }
  }
  return out;
}

export function Chip({ idx, label, size = 40, class: cls = '', onClick, disabled }: { idx: number; label?: string; size?: number; class?: string; onClick?: (e: MouseEvent) => void; disabled?: boolean }) {
  const Tag = onClick ? 'button' : 'span';
  return (
    <Tag class={`chip chip-${idx} ${cls}`} style={{ '--cs': `${size}px` }} onClick={onClick} disabled={disabled} type={onClick ? 'button' : undefined}>
      {label && <span class="chip-lab">{label}</span>}
    </Tag>
  );
}

/**
 * Pila de fichas para una cantidad: columnas de hasta 10 fichas. La ficha
 * de arriba "salta" al cambiar la cantidad.
 */
export function ChipStack({ amount, chips, fmt, size = 30, label = true, class: cls = '' }: { amount: number; chips: number[]; fmt?: (n: number) => string; size?: number; label?: boolean; class?: string }) {
  if (amount <= 0) return null;
  const list = decompose(amount, chips, 30);
  if (!list.length) list.push(0);
  const cols: number[][] = [];
  for (const c of list) {
    const col = cols[cols.length - 1];
    if (!col || col.length >= 10 || col[0] !== c) cols.push([c]);
    else col.push(c);
  }
  const shown = cols.slice(0, 3);
  return (
    <div class={`chip-stack ${cls}`} style={{ '--cs': `${size}px` }}>
      <div class="chip-cols">
        {shown.map((col, ci) => (
          <div class="chip-col" key={ci}>
            {col.map((c, k) => (
              <span key={`${amount}-${k}`} class={`chip chip-${c} ${k === col.length - 1 && ci === shown.length - 1 ? 'hop' : ''}`} style={{ '--cs': `${size}px`, transform: `translateY(${-k * Math.max(3, size * 0.14)}px)` }} />
            ))}
          </div>
        ))}
      </div>
      {label && fmt && <span class="chip-amt">{fmt(amount)}</span>}
    </div>
  );
}

/**
 * Lanza fichas volando de un elemento a otro (DOM temporal, solo transform).
 * No hace nada en modo de pocos efectos.
 */
export function flyChips(from: Element | null | undefined, to: Element | null | undefined, idxs: number[], delay = 0) {
  if (!from || !to || lowFx() || typeof document === 'undefined') return;
  const a = from.getBoundingClientRect();
  const b = to.getBoundingClientRect();
  const size = 26;
  idxs.slice(0, 8).forEach((idx, k) => {
    const el = document.createElement('span');
    el.className = `chip chip-${idx} chip-fly`;
    el.style.setProperty('--cs', `${size}px`);
    const x0 = a.left + a.width / 2 - size / 2 + (Math.random() - 0.5) * 10;
    const y0 = a.top + a.height / 2 - size / 2 + (Math.random() - 0.5) * 6;
    const x1 = b.left + b.width / 2 - size / 2 + (Math.random() - 0.5) * 10;
    const y1 = b.top + b.height / 2 - size / 2 - k * 3;
    el.style.left = `${x0}px`;
    el.style.top = `${y0}px`;
    document.body.appendChild(el);
    const dx = x1 - x0;
    const dy = y1 - y0;
    const anim = el.animate(
      [
        { transform: 'translate(0,0) scale(1)', opacity: 0 },
        { opacity: 1, offset: 0.1 },
        { transform: `translate(${dx * 0.5}px, ${dy * 0.5 - 40}px) scale(1.15)`, offset: 0.5 },
        { transform: `translate(${dx}px, ${dy}px) scale(1)`, opacity: 1 },
      ],
      { duration: 520, delay: delay + k * 70, easing: 'cubic-bezier(.3,.6,.4,1)', fill: 'both' },
    );
    anim.onfinish = () => el.remove();
    setTimeout(() => el.remove(), 2000 + delay + k * 70);
  });
}

// ---------------------------------------------------------------------------
// Tapete: textura de fieltro (una vez) y fondo de la sala
// ---------------------------------------------------------------------------

let feltUrl = '';
/** Textura de fieltro en pixel art (data URL), para `--felt-tex`. */
export function feltTexture(): string {
  if (feltUrl || typeof document === 'undefined') return feltUrl;
  const cv = document.createElement('canvas');
  cv.width = cv.height = 48;
  const ctx = cv.getContext('2d');
  if (!ctx) return '';
  let s = 12345;
  const rnd = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  for (let y = 0; y < 48; y++)
    for (let x = 0; x < 48; x++) {
      const v = rnd();
      if (v < 0.18) {
        ctx.fillStyle = `rgba(0,0,0,${0.08 + rnd() * 0.1})`;
        ctx.fillRect(x, y, 1, 1);
      } else if (v > 0.9) {
        ctx.fillStyle = `rgba(160,255,190,${0.05 + rnd() * 0.07})`;
        ctx.fillRect(x, y, 1, 1);
      }
    }
  feltUrl = `url(${cv.toDataURL()})`;
  return feltUrl;
}

/** Hook: aplica la textura de fieltro como variable CSS al elemento. */
export function useFelt() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.style.setProperty('--felt-tex', feltTexture());
  }, []);
  return ref;
}

let hallStatic: HTMLCanvasElement | null = null;
function hallBase(w: number, h: number): HTMLCanvasElement {
  if (hallStatic && hallStatic.width === w && hallStatic.height === h) return hallStatic;
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext('2d')!;
  // pared con papel pintado
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, '#120a24');
  grad.addColorStop(0.45, '#1f0f33');
  grad.addColorStop(1, '#0b0614');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  for (let y = 18; y < 96; y += 8)
    for (let x = (y / 8) % 2 ? 4 : 0; x < w; x += 8) {
      R(ctx, x + 3, y, 2, 2, '#2a1645');
      R(ctx, x + 2, y + 1, 4, 1, '#26133f');
    }
  // moldura y friso dorado
  R(ctx, 0, 14, w, 2, '#5a3c1a');
  R(ctx, 0, 16, w, 1, '#a07a2e');
  R(ctx, 0, 96, w, 3, '#3a2312');
  R(ctx, 0, 96, w, 1, '#8a6428');
  // moqueta del casino
  for (let y = 99; y < h; y += 6)
    for (let x = 0; x < w; x += 6) {
      const k = ((x / 6) + (y / 6)) % 4;
      R(ctx, x, y, 6, 6, k === 0 ? '#3a0f22' : '#2c0a1a');
      if (k === 2) R(ctx, x + 2, y + 2, 2, 2, '#6a4a14');
      if (k === 0) R(ctx, x + 1, y + 1, 1, 1, '#1d5a5a');
    }
  // máquinas tragaperras
  for (let i = 0; i < 8; i++) {
    const x = 4 + i * 23;
    R(ctx, x, 44, 18, 54, '#140a1c');
    R(ctx, x + 1, 45, 16, 52, i % 2 ? '#7a1430' : '#5a1a6a');
    R(ctx, x + 1, 45, 16, 2, i % 2 ? '#c03050' : '#9a3ab0');
    R(ctx, x + 3, 56, 12, 9, '#0c0814');
    R(ctx, x + 3, 70, 12, 3, '#b8862a');
    R(ctx, x + 2, 76, 14, 10, '#2a1430');
    R(ctx, x + 17, 58, 2, 10, '#888');
    R(ctx, x + 16, 56, 4, 3, '#e03040');
    // taburete y algún jugador de espaldas
    R(ctx, x + 5, 98, 8, 3, '#4a2a18');
    if (i % 3 === 1) {
      R(ctx, x + 4, 76, 10, 22, '#1b1430');
      R(ctx, x + 6, 70, 6, 6, '#3a2a40');
    }
  }
  hallStatic = cv;
  return cv;
}

/** Fondo animado: sala del casino con tragaperras que parpadean y lámparas. */
export const casinoHall: SceneDraw = (ctx, t, w, h) => {
  ctx.drawImage(hallBase(w, h), 0, 0);
  const neon = ['#ff4f9a', '#4ff0ff', '#ffcc33', '#7dff6a'];
  // luces de las tragaperras: persecución
  for (let i = 0; i < 8; i++) {
    const x = 4 + i * 23;
    for (let k = 0; k < 6; k++) {
      const on = (Math.floor(t * 8) + k + i) % 3 === 0;
      R(ctx, x + 2 + k * 3, 48, 2, 2, on ? neon[(i + k) % 4] : '#3a2040');
    }
    // rodillos
    for (let k = 0; k < 3; k++) {
      const spin = Math.floor(t * (6 + ((i * 7 + k * 3) % 5))) + i * 5 + k;
      R(ctx, x + 4 + k * 4, 58, 3, 5, '#e8e2d4');
      R(ctx, x + 4 + k * 4, 59 + (spin % 3), 3, 2, neon[spin % 4]);
    }
    // jackpot ocasional
    if (Math.floor(t / 3 + i) % 7 === 0 && Math.floor(t * 6) % 2) R(ctx, x + 1, 45, 16, 2, '#fff6b0');
  }
  // lámparas del techo
  for (let i = 0; i < 4; i++) {
    const x = 22 + i * 46;
    const fl = 0.8 + Math.sin(t * 3 + i * 1.7) * 0.08 + (Math.random() < 0.02 ? -0.3 : 0);
    ctx.globalAlpha = 0.16 * fl;
    ctx.fillStyle = '#ffd27a';
    ctx.beginPath();
    ctx.ellipse(x, 10, 20, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    R(ctx, x - 5, 4, 10, 4, '#d8a840');
    R(ctx, x - 3, 8, 6, 2, '#fff2c0');
    R(ctx, x, 0, 1, 4, '#5a3c1a');
  }
  // letrero de neón
  const on = Math.floor(t * 2) % 6 !== 0;
  ctx.globalAlpha = on ? 1 : 0.35;
  const sx = w / 2 - 26;
  const sign = 'PIXELOPOLIS';
  for (let i = 0; i < sign.length; i++) R(ctx, sx + i * 5, 24, 4, 1, i % 2 ? '#ff4f9a' : '#4ff0ff');
  R(ctx, sx - 2, 22, sign.length * 5 + 3, 1, '#ff4f9a');
  R(ctx, sx - 2, 27, sign.length * 5 + 3, 1, '#ff4f9a');
  ctx.globalAlpha = 1;
  // gente que pasa al fondo (siluetas)
  for (let i = 0; i < 2; i++) {
    const px = ((t * (6 + i * 3) + i * 90) % (w + 30)) - 15;
    R(ctx, px, 84 - i * 2, 6, 14, '#0a0612');
    R(ctx, px + 1, 79 - i * 2, 4, 5, '#0a0612');
  }
};
