import { h } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import { Bubble, Portrait, R, type Talk } from './stage';
import { randomPerson, voiceOf, type Mood, type Person } from '../../art/portrait';
import { shade } from '../../art/character';
import { babble, play } from '../../platform/audio';

/**
 * Escenarios de los minijuegos de la alcaldía (semáforos, prensa,
 * presupuestos y mitin) y piezas compartidas por todos los escenarios:
 * letra de píxeles 3×5, presentador que habla, charla espaciada.
 */

// ===========================================================================
// Utilidades compartidas
// ===========================================================================

export { R };

/** El jugador pidió efectos reducidos. */
export const lowFx = () => typeof document !== 'undefined' && document.documentElement.classList.contains('lowfx');
/** Fotogramas por segundo del fondo según los efectos. */
export const sceneFps = (hi = 12) => (lowFx() ? Math.max(6, Math.round(hi / 2)) : hi);

/** Ruido determinista 0..1. */
export function hash(n: number) {
  let x = Math.imul((n | 0) ^ 0x9e3779b9, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

/** Persona fija por semilla con algunos rasgos forzados. */
export const personOf = (seed: number, over: Partial<Person> = {}): Person => ({ ...randomPerson(seed), ...over });

// --- letra de píxeles 3×5 ---------------------------------------------------
const FONT: Record<string, string> = {
  A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110', E: '111100110100111',
  F: '111100110100100', G: '011100101101011', H: '101101111101101', I: '111010010010111', J: '001001001101010',
  K: '101101110101101', L: '100100100100111', M: '101111111101101', N: '110101101101101', O: '010101101101010',
  P: '110101110100100', Q: '010101101110011', R: '110101110101101', S: '011100010001110', T: '111010010010010',
  U: '101101101101111', V: '101101101101010', W: '101101111111101', X: '101101010101101', Y: '101101010010010',
  Z: '111001010100111', '0': '111101101101111', '1': '010110010010111', '2': '110001010100111', '3': '110001010001110',
  '4': '101101111001001', '5': '111100110001110', '6': '011100111101111', '7': '111001010010010', '8': '111101111101111',
  '9': '111101111001110', '!': '010010010000010', '¡': '010000010010010', '.': '000000000000010', ',': '000000000010100',
  '-': '000000111000000', "'": '010010000000000', $: '011110010011110', '&': '010101010101011', '/': '001001010100100',
  ':': '000010000010000', '#': '101111101111101', '*': '101010101000000', '?': '110001010000010', '+': '000010111010000',
  '%': '101001010100101', '<': '001010100010001', '>': '100010001010100',
};

const norm = (s: string) => s.toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Texto en letra de píxeles 3×5 (sc = tamaño del píxel). */
export function txt(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, c: string, sc = 1) {
  ctx.fillStyle = c;
  let cx = Math.round(x);
  const y0 = Math.round(y);
  for (const ch of norm(s)) {
    const g = FONT[ch];
    if (g) for (let i = 0; i < 15; i++) if (g[i] === '1') ctx.fillRect(cx + (i % 3) * sc, y0 + Math.floor(i / 3) * sc, sc, sc);
    cx += 4 * sc;
  }
}
export const txtW = (s: string, sc = 1) => (s.length * 4 - 1) * sc;
/** Texto centrado en x. */
export const txtC = (ctx: CanvasRenderingContext2D, s: string, cx: number, y: number, c: string, sc = 1) => txt(ctx, s, cx - txtW(s, sc) / 2, y, c, sc);

/** Rótulo de neón: halo + tubo (apagado si on = false). */
export function neon(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, c: string, on = true, sc = 1) {
  if (!on) {
    txt(ctx, s, x, y, shade(c, -0.65), sc);
    return;
  }
  ctx.globalAlpha = 0.28;
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) txt(ctx, s, x + dx, y + dy, c, sc);
  ctx.globalAlpha = 1;
  txt(ctx, s, x, y, shade(c, 0.45), sc);
}

/** Círculo de píxeles relleno. */
export function disc(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, c: string) {
  ctx.fillStyle = c;
  for (let y = -r; y <= r; y++) {
    const w = Math.floor(Math.sqrt(r * r - y * y + r * 0.6));
    ctx.fillRect(Math.round(cx - w), Math.round(cy + y), w * 2 + 1, 1);
  }
}

/** Halo de luz (degradado radial aditivo). */
export function glow(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, c: string, a = 0.5) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, c);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.globalAlpha = a;
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
}

/** Degradado vertical a bandas (cielos de píxel). */
export function bands(ctx: CanvasRenderingContext2D, y0: number, y1: number, w: number, cols: string[]) {
  const n = cols.length;
  const step = (y1 - y0) / n;
  cols.forEach((c, i) => R(ctx, 0, y0 + i * step, w, step + 1, c));
}

/** Lienzo auxiliar (capas estáticas que se pintan una vez). */
export function layer(w: number, h: number, paint: (ctx: CanvasRenderingContext2D) => void) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  if (ctx) paint(ctx);
  return c;
}

/** Bocina de coche (dos notas a la vez). */
export function honk() {
  play.tone(349);
  play.tone(440);
}

let lastShout = 0;
/** Voz corta de alguien del público (sin amontonar voces). */
export function shout(text: string, seed: number) {
  const now = performance.now();
  if (now - lastShout < 900) return;
  lastShout = now;
  babble(text, voiceOf(randomPerson(seed)), 1.4);
}

// --- presentador con bocadillo ---------------------------------------------

/** Retrato que habla + nombre + bocadillo, para colocar sobre el escenario. */
export function Host({ person, talk, name, side = 'left', scale = 2, class: cls = '' }: { person: Person; talk: Talk; name?: string; side?: 'left' | 'right'; scale?: number; class?: string }) {
  return h(
    'div',
    { class: `host host-${side} ${talk.line ? 'speaking' : ''} ${cls}` },
    h('div', { class: 'host-face' }, h(Portrait, { person, talking: talk.talking, mood: talk.mood, scale }), name ? h('span', { class: 'host-name' }, name) : null),
    h(Bubble, { text: talk.line, k: talk.key, side, speed: 44 }),
  );
}

/**
 * Charla espaciada: `speak` dice una frase (sin repetir hasta agotar la
 * lista) y respeta un respiro entre frases salvo que se fuerce; mientras
 * `active`, cada 7–11 s dice algo de `idle`. El bocadillo se oculta solo.
 */
export function useChatter(talk: Talk, active: boolean, idle: string[] = [], every: [number, number] = [7, 11]) {
  const ref = useRef(talk);
  ref.current = talk;
  const st = useRef({ last: -1e9, used: new Set<string>(), hide: 0 as unknown as ReturnType<typeof setTimeout> });
  const speak = (lines: string | string[], mood: Mood = 'normal', force = false) => {
    const now = performance.now();
    if (!force && now - st.current.last < 2600) return false;
    const arr = typeof lines === 'string' ? [lines] : lines;
    let opts = arr.filter((l) => !st.current.used.has(l));
    if (!opts.length) {
      arr.forEach((l) => st.current.used.delete(l));
      opts = arr;
    }
    const line = opts[Math.floor(Math.random() * opts.length)];
    st.current.used.add(line);
    st.current.last = now;
    ref.current.say(line, mood);
    clearTimeout(st.current.hide);
    st.current.hide = setTimeout(() => ref.current.clear(), 2300 + line.length * 55);
    return true;
  };
  const idleRef = useRef(idle);
  idleRef.current = idle;
  useEffect(() => {
    if (!active) return;
    let id: ReturnType<typeof setTimeout>;
    const loop = () => {
      id = setTimeout(
        () => {
          if (idleRef.current.length && performance.now() - st.current.last > 4500) speak(idleRef.current);
          loop();
        },
        (every[0] + Math.random() * (every[1] - every[0])) * 1000,
      );
    };
    loop();
    return () => clearTimeout(id);
  }, [active]);
  useEffect(() => () => clearTimeout(st.current.hide), []);
  return speak;
}

/** Llama a fn una vez cuando quedan `at` segundos. */
export function useCountdownCue(left: number, playing: boolean, at: number, fn: () => void) {
  const done = useRef(false);
  useEffect(() => {
    if (!playing) {
      done.current = false;
      return;
    }
    if (left === at && !done.current) {
      done.current = true;
      fn();
    }
  }, [left, playing]);
}

// ===========================================================================
// Semáforos: cruce de la Quinta con la 34 visto desde arriba
// ===========================================================================

export type TLane = 'h' | 'v' | 'w' | 's';
export interface TCar {
  id: number;
  color: string;
  taxi: boolean;
  /** Recorrido del morro a lo largo del carril (px del lienzo). */
  s: number;
  v: number;
  jam?: boolean;
}
interface TPed {
  axis: 'x' | 'y';
  at: number;
  p: number;
  dir: 1 | -1;
  sp: number;
  body: string;
  head: string;
}
export interface TrafficView {
  green: 'h' | 'v';
  q: { h: TCar[]; v: TCar[] };
  movers: { lane: TLane; car: TCar }[];
  peds: TPed[];
  amb: number;
  last: number;
  id: number;
}

const CAR_L = 13;
export const T_SLOT = 15;
/** Línea de detención de cada cola (en s). */
export const T_STOP = { h: 98, v: 160 };
const T_EXIT: Record<TLane, number> = { h: 205, v: 385, w: 205, s: 385 };
const PED_BODY = ['#c0392b', '#2f6fb3', '#2e8b57', '#e2a23b', '#7b4fa0', '#e8619e', '#3a3a46', '#c8b48a', '#e8e4d8'];
const PED_HEAD = ['#1c1818', '#4a2e1c', '#8a5a2b', '#d8b45e', '#b5442c', '#c9c4bc'];

export function trafficView(): TrafficView {
  const peds: TPed[] = [];
  const tracks: [TPed['axis'], number][] = [['y', 105], ['y', 155], ['x', 143], ['x', 193]];
  for (let i = 0; i < 16; i++) {
    const [axis, at] = tracks[i % 4];
    peds.push({ axis, at: at + (hash(i * 7) < 0.5 ? -2 : 2), p: hash(i * 13) * (axis === 'y' ? 360 : 180), dir: hash(i * 3) < 0.5 ? 1 : -1, sp: 7 + hash(i * 5) * 7, body: PED_BODY[i % PED_BODY.length], head: PED_HEAD[(i * 5) % PED_HEAD.length] });
  }
  return { green: 'h', q: { h: [], v: [] }, movers: [], peds, amb: 1, last: -1, id: 1 };
}

/** Posición en pantalla del coche: esquina, sentido. */
export function carBox(lane: TLane, s: number): { x: number; y: number; dir: 'e' | 'n' | 'w' | 's' } {
  if (lane === 'h') return { x: s - CAR_L, y: 173, dir: 'e' };
  if (lane === 'v') return { x: 135, y: 360 - s, dir: 'n' };
  if (lane === 'w') return { x: 180 - s, y: 155, dir: 'w' };
  return { x: 117, y: s - CAR_L, dir: 's' };
}

function drawCar(ctx: CanvasRenderingContext2D, lane: TLane, car: TCar, braking: boolean, t: number) {
  const { x, y, dir } = carBox(lane, car.s);
  const W = 8;
  // u: de la trasera (0) al morro (CAR_L); v: de lado a lado
  const rect = (u: number, v: number, lu: number, lv: number, c: string) => {
    if (dir === 'e') R(ctx, x + u, y + v, lu, lv, c);
    else if (dir === 'w') R(ctx, x + CAR_L - u - lu, y + v, lu, lv, c);
    else if (dir === 'n') R(ctx, x + v, y + CAR_L - u - lu, lv, lu, c);
    else R(ctx, x + v, y + u, lv, lu, c);
  };
  // sombra
  ctx.globalAlpha = 0.35;
  if (dir === 'e' || dir === 'w') R(ctx, x + 1, y + 2, CAR_L, W, '#000');
  else R(ctx, x + 2, y + 1, W, CAR_L, '#000');
  ctx.globalAlpha = 1;
  const body = car.color;
  rect(0, 0, CAR_L, W, '#15121c');
  rect(1, 1, CAR_L - 2, W - 2, body);
  rect(1, 1, CAR_L - 2, 1, shade(body, 0.3));
  rect(4, 2, 5, W - 4, shade(body, 0.12));
  rect(9, 1, 2, W - 2, '#24324f');
  rect(9, 1, 1, 2, '#6f8fbf');
  rect(3, 1, 1, W - 2, '#24324f');
  if (car.taxi) {
    rect(6, 3, 2, 2, '#fff7c2');
    rect(1, W - 2, CAR_L - 2, 1, '#15121c');
  }
  // faros y pilotos
  rect(CAR_L - 1, 1, 1, 1, '#fff6c0');
  rect(CAR_L - 1, W - 2, 1, 1, '#fff6c0');
  const tail = braking ? '#ff3a3a' : '#8a1d1d';
  rect(0, 1, 1, 1, tail);
  rect(0, W - 2, 1, 1, tail);
  if (car.jam && Math.floor(t * 6) % 2 === 0) {
    rect(0, 0, 1, 1, '#ffb020');
    rect(0, W - 1, 1, 1, '#ffb020');
    rect(CAR_L - 1, 0, 1, 1, '#ffb020');
    rect(CAR_L - 1, W - 1, 1, 1, '#ffb020');
  }
}

let trafficBase: HTMLCanvasElement | null = null;
function paintTrafficBase(ctx: CanvasRenderingContext2D) {
  const W = 180;
  const H = 360;
  // acera
  R(ctx, 0, 0, W, H, '#a39c90');
  for (let y = 0; y < H; y += 6) R(ctx, 0, y, W, 1, '#968f83');
  for (let x = 0; x < W; x += 6) R(ctx, x, 0, 1, H, '#9a9387');
  // calzadas
  const road = (x: number, y: number, w: number, hh: number) => {
    R(ctx, x, y, w, hh, '#3a3940');
    for (let i = 0; i < (w * hh) / 40; i++) R(ctx, x + hash(i * 3 + x) * w, y + hash(i * 7 + y) * hh, 1, 1, hash(i) < 0.5 ? '#44434b' : '#33323a');
  };
  road(0, 150, W, 36);
  road(112, 0, 36, H);
  // bordillos
  R(ctx, 0, 149, 112, 1, '#d6d0c4');
  R(ctx, 148, 149, 32, 1, '#d6d0c4');
  R(ctx, 0, 186, 112, 1, '#d6d0c4');
  R(ctx, 148, 186, 32, 1, '#d6d0c4');
  R(ctx, 111, 0, 1, 150, '#d6d0c4');
  R(ctx, 148, 0, 1, 150, '#d6d0c4');
  R(ctx, 111, 187, 1, 173, '#d6d0c4');
  R(ctx, 148, 187, 1, 173, '#d6d0c4');
  // doble línea amarilla
  for (const [x0, x1] of [[0, 100], [160, W]]) {
    R(ctx, x0, 167, x1 - x0, 1, '#e8c440');
    R(ctx, x0, 169, x1 - x0, 1, '#e8c440');
  }
  for (const [y0, y1] of [[0, 138], [198, H]]) {
    R(ctx, 129, y0, 1, y1 - y0, '#e8c440');
    R(ctx, 131, y0, 1, y1 - y0, '#e8c440');
  }
  // pasos de cebra y líneas de detención
  for (let y = 151; y < 185; y += 4) {
    R(ctx, 101, y, 9, 2, '#e9e5da');
    R(ctx, 150, y, 9, 2, '#e9e5da');
  }
  for (let x = 113; x < 147; x += 4) {
    R(ctx, x, 139, 2, 9, '#e9e5da');
    R(ctx, x, 189, 2, 9, '#e9e5da');
  }
  R(ctx, 98, 169, 2, 17, '#f4f0e6');
  R(ctx, 131, 199, 17, 2, '#f4f0e6');
  // alcantarilla
  disc(ctx, 60, 159, 4, '#2a292e');
  disc(ctx, 60, 159, 3, '#4c4a52');
  for (let i = -2; i <= 2; i += 2) R(ctx, 58, 159 + i, 5, 1, '#2a292e');
  // --- tejados
  const roof = (x: number, y: number, w: number, hh: number, c: string) => {
    R(ctx, x + 4, y + 4, w, hh, 'rgba(0,0,0,0.28)');
    R(ctx, x, y, w, hh, shade(c, -0.35));
    R(ctx, x + 2, y + 2, w - 4, hh - 4, c);
    R(ctx, x, y, w, 2, shade(c, 0.25));
    R(ctx, x, y, 2, hh, shade(c, 0.15));
    for (let i = 0; i < (w * hh) / 30; i++) R(ctx, x + 3 + hash(i * 11 + x) * (w - 6), y + 3 + hash(i * 17 + y) * (hh - 6), 1, 1, shade(c, hash(i) < 0.5 ? -0.12 : 0.08));
  };
  roof(0, 0, 50, 136, '#7d4a3e');
  roof(50, 0, 48, 92, '#5f6066');
  roof(50, 92, 48, 44, '#6e6252');
  roof(160, 0, 20, 136, '#56606b');
  roof(0, 270, 98, 90, '#6e5a4e');
  roof(160, 199, 20, 161, '#7a6a58');
  // depósito de agua (círculo de madera con bandas)
  disc(ctx, 26, 98, 10, 'rgba(0,0,0,0.3)');
  disc(ctx, 24, 95, 10, '#6a4326');
  disc(ctx, 24, 95, 8, '#8a5a33');
  for (let a = 0; a < 6; a++) R(ctx, 24 + Math.cos(a) * 6, 95 + Math.sin(a) * 6, 1, 1, '#5a3820');
  disc(ctx, 24, 95, 3, '#a4724a');
  R(ctx, 23, 92, 2, 2, '#c8996b');
  // máquinas de aire, claraboyas, trampillas
  for (const [x, y] of [[60, 18], [78, 50], [62, 70], [12, 30], [170, 40]]) {
    R(ctx, x + 1, y + 1, 9, 7, 'rgba(0,0,0,0.3)');
    R(ctx, x, y, 9, 7, '#9aa0a6');
    disc(ctx, x + 4, y + 3, 2, '#5a6066');
    R(ctx, x, y, 9, 1, '#c8ced2');
  }
  for (const [x, y] of [[60, 104], [78, 112], [10, 290], [30, 290], [50, 290], [70, 290]]) {
    R(ctx, x, y, 12, 8, '#3a5a7a');
    R(ctx, x + 1, y + 1, 10, 3, '#7fa6c8');
    R(ctx, x + 5, y, 1, 8, '#2a3a4a');
  }
  R(ctx, 28, 20, 8, 8, '#4a3a30');
  R(ctx, 29, 21, 6, 6, '#5d4b3e');
  // parque de bolsillo
  R(ctx, 0, 199, 98, 69, '#4f8a3e');
  for (let i = 0; i < 120; i++) R(ctx, hash(i * 5) * 98, 199 + hash(i * 9) * 69, 1, 1, hash(i) < 0.5 ? '#5f9b4a' : '#437a34');
  R(ctx, 0, 228, 98, 6, '#c9b892');
  R(ctx, 44, 199, 6, 69, '#c9b892');
  disc(ctx, 47, 231, 7, '#9a9387');
  disc(ctx, 47, 231, 5, '#6fa8d8');
  R(ctx, 46, 229, 2, 2, '#e8f4ff');
  for (const [x, y] of [[14, 240], [70, 214]]) {
    R(ctx, x, y, 14, 3, '#7a4a2a');
    R(ctx, x, y + 3, 14, 1, '#3a2a1a');
  }
}

const TREES: [number, number][] = [[106, 18], [106, 62], [106, 116], [154, 228], [154, 280], [154, 330], [18, 210], [80, 255], [28, 258], [170, 172]];

/** Dibuja el cruce (a 60 fps): coches que se deslizan, peatones, semáforos. */
export function drawTraffic(ctx: CanvasRenderingContext2D, t: number, view: TrafficView) {
  const dt = view.last < 0 ? 0 : Math.min(0.1, t - view.last);
  view.last = t;
  if (!trafficBase) trafficBase = layer(180, 360, paintTrafficBase);
  ctx.drawImage(trafficBase, 0, 0);
  const g = view.green;
  // luz del semáforo sobre el asfalto
  ctx.globalAlpha = 0.14;
  R(ctx, 70, 168, 28, 18, g === 'h' ? '#3dff7a' : '#ff3b3b');
  R(ctx, 130, 200, 18, 28, g === 'v' ? '#3dff7a' : '#ff3b3b');
  ctx.globalAlpha = 1;

  // peatones (cruzan cuando su calle está en rojo)
  for (const p of view.peds) {
    const next = p.p + p.dir * p.sp * dt;
    const inBand = (v: number) => (p.axis === 'y' ? v > 147 && v < 189 : v > 109 && v < 151);
    const blocked = p.axis === 'y' ? g === 'h' : g === 'v';
    if (!(blocked && !inBand(p.p) && inBand(next))) p.p = next;
    const max = p.axis === 'y' ? 364 : 184;
    if (p.p > max) p.p = -4;
    if (p.p < -4) p.p = max;
    const step = Math.floor(t * 5 + p.sp) % 2;
    const x = p.axis === 'y' ? p.at : p.p;
    const y = p.axis === 'y' ? p.p : p.at;
    ctx.globalAlpha = 0.3;
    R(ctx, x, y + 1, 4, 3, '#000');
    ctx.globalAlpha = 1;
    R(ctx, x - 1, y - 1, 4, 3, p.body);
    R(ctx, x - 1 + step * 3, y - 1, 1, 1, shade(p.body, -0.3));
    R(ctx, x, y - 1, 2, 2, p.head);
  }

  // coches en cola: se deslizan hasta su hueco
  for (const lane of ['h', 'v'] as const) {
    view.q[lane].forEach((car, i) => {
      const target = T_STOP[lane] - i * T_SLOT;
      const gap = target - car.s;
      if (gap > 0) {
        car.v = Math.min(car.v + 220 * dt, 95, gap * 7 + 6);
        car.s = Math.min(target, car.s + car.v * dt);
      } else car.v = 0;
      drawCar(ctx, lane, car, gap < 3, t);
    });
  }
  // coches que cruzan y salen
  view.amb -= dt;
  if (view.amb <= 0) {
    view.amb = 1.4 + Math.random() * 1.8;
    view.movers.push({ lane: g === 'h' ? 'w' : 's', car: { id: view.id++, color: PED_BODY[Math.floor(Math.random() * 7)], taxi: Math.random() < 0.35, s: -16, v: 70 } });
  }
  view.movers = view.movers.filter((m) => m.car.s < T_EXIT[m.lane]);
  for (const m of view.movers) {
    m.car.v = Math.min(m.car.v + 150 * dt, m.car.jam ? 170 : 140);
    m.car.s += m.car.v * dt;
    drawCar(ctx, m.lane, m.car, false, t);
  }

  // árboles de la acera (por encima de la gente)
  for (const [x, y] of TREES) {
    const sw = Math.round(Math.sin(t * 1.3 + x) * 0.6);
    disc(ctx, x + 3, y + 3, 6, 'rgba(0,0,0,0.25)');
    disc(ctx, x + sw, y, 6, '#2f6b2e');
    disc(ctx, x + sw - 1, y - 1, 4, '#3f8a3a');
    R(ctx, x + sw - 2, y - 3, 2, 2, '#6fb85a');
  }

  // vapor de la alcantarilla
  for (let i = 0; i < 6; i++) {
    const k = (t * 0.5 + i / 6) % 1;
    ctx.globalAlpha = 0.45 * (1 - k);
    disc(ctx, 60 + Math.sin(t * 2 + i) * 3 + k * 6, 158 - k * 26, 2 + Math.floor(k * 4), '#e8eef2');
  }
  ctx.globalAlpha = 1;

  // semáforos
  const light = (x: number, y: number, on: boolean) => {
    R(ctx, x + 3, y + 17, 1, 6, '#2a2a30');
    R(ctx, x - 1, y - 1, 9, 19, '#0c0c10');
    R(ctx, x, y, 7, 17, '#1d1d24');
    R(ctx, x + 1, y + 1, 5, 4, on ? '#4a1414' : '#ff3b3b');
    R(ctx, x + 1, y + 6, 5, 4, '#4a3a10');
    R(ctx, x + 1, y + 11, 5, 4, on ? '#3dff7a' : '#103a1a');
    glow(ctx, x + 3.5, on ? y + 13 : y + 3, 12, on ? '#3dff7a' : '#ff3b3b', 0.55 + Math.sin(t * 6) * 0.1);
  };
  light(100, 120, g === 'h');
  light(150, 202, g === 'v');
}

// ===========================================================================
// Rueda de prensa: la sala vista desde el atril
// ===========================================================================

export interface PressView {
  flashes: { x: number; y: number; t: number }[];
  /** Momento del último aplauso/abucheo (s del escenario) y si fue bueno. */
  react: { t: number; ok: boolean };
  burst: number;
  now: number;
}
export const pressView = (): PressView => ({ flashes: [], react: { t: -9, ok: true }, burst: 0, now: 0 });

let pressBase: HTMLCanvasElement | null = null;
function paintPressBase(ctx: CanvasRenderingContext2D) {
  const W = 180;
  // pared del fondo: paneles azules y cortinas
  bands(ctx, 0, 150, W, ['#141c3c', '#17214a', '#1a2654', '#1d2a5c']);
  for (let x = 0; x < W; x += 12) {
    R(ctx, x, 0, 1, 150, '#0f1530');
    R(ctx, x + 5, 0, 2, 150, 'rgba(255,255,255,0.04)');
  }
  // cortinas laterales granate
  for (const x0 of [0, 150]) {
    R(ctx, x0, 0, 30, 150, '#5a1424');
    for (let x = x0; x < x0 + 30; x += 5) {
      R(ctx, x, 0, 2, 150, '#7a1e32');
      R(ctx, x + 3, 0, 1, 150, '#3a0c18');
    }
  }
  R(ctx, 0, 0, W, 8, '#3a0c18');
  for (let x = 0; x < W; x += 6) R(ctx, x, 8, 4, 3, '#c9a24a');
  // escudo de la ciudad en la pared
  disc(ctx, 90, 48, 22, '#0c1230');
  disc(ctx, 90, 47, 21, '#c9a24a');
  disc(ctx, 90, 47, 18, '#1c3a7a');
  disc(ctx, 90, 47, 13, '#e8e0c8');
  R(ctx, 86, 40, 8, 12, '#c9a24a');
  R(ctx, 84, 44, 12, 2, '#c9a24a');
  R(ctx, 89, 36, 2, 4, '#c9a24a');
  txtC(ctx, 'CITY OF NEW YORK', 90, 74, '#c9a24a');
  // bandera y reloj
  R(ctx, 36, 20, 1, 70, '#c9a24a');
  for (let i = 0; i < 7; i++) R(ctx, 37, 22 + i * 3, 22, 3, i % 2 ? '#e8e4d8' : '#b22234');
  R(ctx, 37, 22, 9, 9, '#3c3b6e');
  disc(ctx, 140, 30, 7, '#0c0c10');
  disc(ctx, 140, 30, 6, '#f4efe2');
  R(ctx, 140, 26, 1, 4, '#14101f');
  R(ctx, 140, 30, 3, 1, '#14101f');
  // suelo de moqueta
  bands(ctx, 150, 290, W, ['#3a1e2e', '#40222f', '#462534', '#4c2838']);
}

const REPORTERS = Array.from({ length: 22 }, (_, i) => {
  const row = i < 6 ? 0 : i < 13 ? 1 : 2;
  const inRow = row === 0 ? i : row === 1 ? i - 6 : i - 13;
  const n = row === 0 ? 6 : row === 1 ? 7 : 9;
  return {
    row,
    x: 10 + (inRow + (row === 1 ? 0.5 : 0)) * (160 / n) + hash(i * 3) * 6,
    skin: ['#f2d0b0', '#deac84', '#c18a5c', '#9a6440', '#6c4228'][i % 5],
    hair: PED_HEAD[(i * 7) % PED_HEAD.length],
    coat: ['#3a3a46', '#5a4a3a', '#2f4f6e', '#6e5a3a', '#4a2e3a', '#7a7a80'][i % 6],
    cam: hash(i * 11) < 0.35,
    hat: hash(i * 19) < 0.18,
  };
});

/** Sala de prensa: periodistas que se mueven, flashes, cámara de TV y atril. */
export function drawPress(ctx: CanvasRenderingContext2D, t: number, view: PressView) {
  view.now = t;
  if (!pressBase) pressBase = layer(180, 360, paintPressBase);
  ctx.drawImage(pressBase, 0, 0);
  // cámara de televisión al fondo
  R(ctx, 152, 96, 18, 12, '#2a2a30');
  R(ctx, 146, 99, 6, 6, '#14141a');
  R(ctx, 160, 108, 2, 30, '#2a2a30');
  R(ctx, 154, 136, 14, 2, '#2a2a30');
  R(ctx, 166, 98, 3, 3, Math.floor(t * 2) % 2 ? '#ff2a2a' : '#5a1010');
  txt(ctx, 'TV', 154, 100, '#c8ced2');
  // filas de periodistas (de atrás hacia delante)
  const react = t - view.react.t < 1.6;
  for (const r of REPORTERS) {
    const sc = [1, 1.35, 1.8][r.row];
    const baseY = [150, 182, 222][r.row];
    const bob = Math.round(Math.sin(t * (2 + r.row) + r.x) * (react && view.react.ok ? 2 : 0.6));
    const x = r.x;
    const y = baseY + bob;
    const hw = Math.round(5 * sc);
    // hombros
    R(ctx, x - hw * 1.6, y + hw * 1.5, hw * 3.2, hw * 3, r.coat);
    R(ctx, x - hw * 1.6, y + hw * 1.5, hw * 3.2, 1, shade(r.coat, 0.2));
    // cabeza
    R(ctx, x - hw / 2 - 1, y, hw + 2, hw + 3, r.skin);
    R(ctx, x - hw / 2 - 1, y - 1, hw + 2, Math.ceil(hw / 2), r.hair);
    if (r.hat) {
      R(ctx, x - hw, y - 2, hw * 2, 2, '#2a2420');
      R(ctx, x - hw / 2 - 1, y - Math.round(hw * 0.8), hw + 2, Math.round(hw * 0.8), '#3a322a');
    }
    // mano levantada con libreta cuando reaccionan mal
    if (react && !view.react.ok && hash(Math.floor(r.x)) < 0.5) {
      R(ctx, x + hw * 1.4, y - hw - Math.round(Math.sin(t * 14 + r.x) * 2), 3 * sc, hw * 2.2, r.skin);
    }
    if (r.cam) {
      const cx = x - hw - 2;
      R(ctx, cx, y + 2, Math.round(7 * sc), Math.round(5 * sc), '#1a1a20');
      R(ctx, cx + 1, y + 3, Math.round(3 * sc), Math.round(3 * sc), '#4a5a7a');
      R(ctx, cx, y + 1, Math.round(3 * sc), 2, '#d8d8e0');
      if (Math.random() < 0.006 + (react && view.react.ok ? 0.05 : 0)) view.flashes.push({ x: cx + 2, y: y + 2, t });
    }
  }
  // flashes de fotógrafo
  if (view.burst > 0) {
    for (let i = 0; i < view.burst; i++) view.flashes.push({ x: 20 + Math.random() * 140, y: 150 + Math.random() * 90, t: t + Math.random() * 0.5 });
    view.burst = 0;
  }
  view.flashes = view.flashes.filter((f) => t - f.t < 0.25);
  for (const f of view.flashes) {
    if (t < f.t) continue;
    const k = 1 - (t - f.t) / 0.25;
    glow(ctx, f.x, f.y, 34 * k + 6, '#fffbe6', 0.9 * k);
    R(ctx, f.x - 6 * k, f.y, 12 * k + 1, 1, '#ffffff');
    R(ctx, f.x, f.y - 6 * k, 1, 12 * k + 1, '#ffffff');
  }
  // atril con micrófonos en primer plano
  const py = 292;
  R(ctx, 30, py, 120, 68, '#4a2a16');
  R(ctx, 34, py + 4, 112, 64, '#6b3f22');
  for (let y = py + 8; y < 360; y += 5) R(ctx, 34, y, 112, 1, '#5e3720');
  R(ctx, 24, py - 6, 132, 8, '#7a4a2a');
  R(ctx, 24, py - 6, 132, 2, '#a4724a');
  disc(ctx, 90, py + 34, 18, '#c9a24a');
  disc(ctx, 90, py + 34, 15, '#1c3a7a');
  disc(ctx, 90, py + 34, 9, '#e8e0c8');
  R(ctx, 88, py + 28, 4, 12, '#c9a24a');
  txtC(ctx, 'NYC', 90, py + 55, '#c9a24a');
  for (const [mx, lean, c] of [[66, -1, '#c0392b'], [82, 0, '#2f6fb3'], [98, 0, '#e8e4d8'], [114, 1, '#e2a23b']] as [number, number, string][]) {
    for (let i = 0; i < 22; i++) R(ctx, mx + Math.round(lean * i * 0.3), py - 6 - i, 1, 1, '#2a2a30');
    const tx = mx + Math.round(lean * 6.6);
    R(ctx, tx - 3, py - 34, 7, 8, '#2a2a30');
    R(ctx, tx - 2, py - 33, 5, 6, '#4a4a54');
    R(ctx, tx - 3, py - 26, 7, 4, c);
  }
}

// ===========================================================================
// Presupuestos: el despacho del alcalde de noche
// ===========================================================================

let officeBase: HTMLCanvasElement | null = null;
function paintOfficeBase(ctx: CanvasRenderingContext2D) {
  const W = 180;
  // paneles de madera
  R(ctx, 0, 0, W, 240, '#3d2618');
  for (let x = 0; x < W; x += 30) {
    R(ctx, x + 3, 6, 24, 104, '#46301e');
    R(ctx, x + 3, 6, 24, 1, '#5a3e28');
    R(ctx, x + 3, 120, 24, 100, '#46301e');
    R(ctx, x + 3, 120, 24, 1, '#5a3e28');
  }
  R(ctx, 0, 112, W, 4, '#5a3a22');
  R(ctx, 0, 222, W, 18, '#2a180e');
  // ventana grande
  R(ctx, 34, 14, 112, 130, '#1a120c');
  R(ctx, 37, 17, 106, 124, '#0a1030');
  for (let i = 0; i < 8; i++) {
    ctx.fillStyle = ['#0a1030', '#0d1438', '#101a42', '#14204c', '#1a2858', '#22305e', '#2c3866', '#36406a'][i];
    ctx.fillRect(37, 17 + i * 15.5, 106, 16);
  }
  // rascacielos (silueta)
  const tower = (x: number, w: number, top: number, c: string) => R(ctx, x, top, w, 141 - top, c);
  tower(38, 14, 92, '#141a30');
  tower(52, 10, 80, '#182040');
  // Empire State
  tower(64, 18, 64, '#1a2244');
  tower(68, 10, 50, '#1a2244');
  tower(71, 4, 38, '#1a2244');
  R(ctx, 72, 28, 2, 10, '#c8ced2');
  // Chrysler
  tower(96, 14, 70, '#182040');
  for (let i = 0; i < 6; i++) R(ctx, 97 + i, 70 - i * 3, 12 - i * 2, 3, i % 2 ? '#8a94a8' : '#c8ced2');
  R(ctx, 102, 48, 2, 6, '#c8ced2');
  tower(112, 16, 88, '#141a30');
  tower(128, 15, 76, '#182040');
  R(ctx, 37, 128, 106, 13, '#0c1024');
  // marco y travesaño
  R(ctx, 89, 17, 2, 124, '#1a120c');
  R(ctx, 37, 78, 106, 2, '#1a120c');
  R(ctx, 30, 142, 120, 6, '#5a3a22');
  R(ctx, 30, 142, 120, 1, '#7a5232');
  // estanterías con libros a los lados
  for (const x0 of [4, 150]) {
    R(ctx, x0, 150, 26, 70, '#2a180e');
    for (let s = 0; s < 3; s++) {
      R(ctx, x0, 170 + s * 22, 26, 2, '#5a3a22');
      for (let b = 0; b < 6; b++) R(ctx, x0 + 1 + b * 4, 152 + s * 22, 3, 18 - (b % 3), ['#7a1e32', '#1f4a6b', '#2e6b3a', '#8a6a2a', '#4a2a5a', '#6b3a1a'][(b + s + x0) % 6]);
    }
  }
  // cuadro (retrato de un alcalde antiguo)
  R(ctx, 64, 160, 52, 40, '#c9a24a');
  R(ctx, 67, 163, 46, 34, '#2a2018');
  disc(ctx, 90, 176, 6, '#c18a5c');
  R(ctx, 80, 184, 20, 13, '#14101f');
  R(ctx, 88, 184, 4, 6, '#e8e4d8');
  R(ctx, 84, 168, 12, 3, '#c9c4bc');
  // mesa
  R(ctx, 0, 240, W, 120, '#5a3018');
  for (let y = 244; y < 360; y += 4) R(ctx, 0, y, W, 1, hash(y) < 0.5 ? '#63361c' : '#552c16');
  for (let i = 0; i < 40; i++) R(ctx, hash(i * 5) * W, 244 + hash(i * 3) * 116, 6 + hash(i) * 14, 1, '#6e3e20');
  R(ctx, 0, 238, W, 4, '#7a4a2a');
  R(ctx, 0, 238, W, 1, '#a4724a');
  // vade de piel verde
  R(ctx, 20, 262, 140, 90, '#1e4a32');
  R(ctx, 22, 264, 136, 86, '#245a3c');
  // teléfono rojo, taza y placa
  R(ctx, 6, 248, 22, 10, '#8a1d1d');
  R(ctx, 8, 244, 18, 5, '#b22a2a');
  R(ctx, 10, 250, 14, 6, '#5a1010');
  R(ctx, 152, 250, 10, 12, '#e8e4d8');
  R(ctx, 162, 253, 3, 5, '#e8e4d8');
  R(ctx, 153, 251, 8, 2, '#3a2010');
  R(ctx, 60, 244, 60, 10, '#c9a24a');
  R(ctx, 61, 245, 58, 8, '#8a6a2a');
  txtC(ctx, 'ALCALDE', 90, 247, '#f4e6b0');
}

/** Despacho: skyline con ventanas que se encienden, flexo y café humeante. */
export function drawOffice(ctx: CanvasRenderingContext2D, t: number) {
  if (!officeBase) officeBase = layer(180, 360, paintOfficeBase);
  ctx.drawImage(officeBase, 0, 0);
  // estrellas
  for (let i = 0; i < 14; i++) if (Math.sin(t * 2 + i * 7) > -0.4) R(ctx, 38 + hash(i) * 104, 18 + hash(i * 9) * 30, 1, 1, '#c8d8ff');
  // ventanas encendidas que cambian
  const blocks: [number, number, number, number][] = [[38, 92, 14, 49], [52, 80, 10, 61], [64, 64, 18, 77], [96, 70, 14, 71], [112, 88, 16, 53], [128, 76, 15, 65]];
  let k = 0;
  for (const [bx, by, bw, bh] of blocks)
    for (let y = by + 3; y < by + bh - 12; y += 4)
      for (let x = bx + 2; x < bx + bw - 1; x += 3) {
        k++;
        if (hash(k + Math.floor(t / 4 + hash(k) * 4) * 977) < 0.42) R(ctx, x, y, 1, 2, hash(k) < 0.8 ? '#ffd27a' : '#bfe0ff');
      }
  // luz de la antena del Empire State
  if (Math.floor(t * 1.5) % 2) R(ctx, 72, 27, 2, 1, '#ff3a3a');
  // persianas venecianas medio bajadas
  for (let y = 17; y < 54; y += 4) {
    R(ctx, 37, y, 106, 2, '#c8b48a');
    R(ctx, 37, y + 2, 106, 1, '#8a7a5a');
  }
  R(ctx, 37, 54, 106, 2, '#6b5a3a');
  // flexo de banquero (pantalla verde) y su cono de luz
  ctx.globalAlpha = 0.16 + Math.sin(t * 9) * 0.01;
  ctx.fillStyle = '#ffe08a';
  ctx.beginPath();
  ctx.moveTo(140, 214);
  ctx.lineTo(176, 214);
  ctx.lineTo(196, 330);
  ctx.lineTo(96, 330);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;
  R(ctx, 156, 214, 3, 30, '#c9a24a');
  R(ctx, 148, 242, 20, 4, '#c9a24a');
  R(ctx, 138, 204, 40, 10, '#1e6a3a');
  R(ctx, 140, 204, 36, 2, '#3a9a5a');
  R(ctx, 140, 213, 36, 2, '#fff2c0');
  glow(ctx, 158, 216, 30, '#ffd27a', 0.35);
  // vapor del café
  for (let i = 0; i < 3; i++) {
    const kk = (t * 0.6 + i / 3) % 1;
    ctx.globalAlpha = 0.5 * (1 - kk);
    R(ctx, 155 + Math.sin(t * 3 + i * 2) * 2, 246 - kk * 16, 2, 2, '#e8eef2');
  }
  ctx.globalAlpha = 1;
}

// ===========================================================================
// Mitin: plaza con escenario, banderolas, globos y confeti
// ===========================================================================

export interface RallyView {
  cheer: number;
  now: number;
}

let rallyBase: HTMLCanvasElement | null = null;
function paintRallyBase(ctx: CanvasRenderingContext2D) {
  const W = 180;
  bands(ctx, 0, 70, W, ['#4a8ad0', '#5a98d8', '#6aa6de', '#7ab4e4', '#8ac0e8']);
  // fachadas al fondo
  const fac: [number, number, string][] = [[0, 26, '#8a4a3a'], [24, 36, '#a4683e'], [52, 18, '#6e5a4e'], [70, 40, '#9a8a7a'], [104, 30, '#7d4a3e'], [132, 22, '#a4683e'], [152, 34, '#6a5a6e']];
  for (const [x, top, c] of fac) {
    const ww = 30;
    R(ctx, x, top, ww, 100 - top, c);
    R(ctx, x, top, ww, 2, shade(c, 0.25));
    for (let y = top + 6; y < 90; y += 9) for (let wx = x + 3; wx < x + ww - 4; wx += 7) {
      R(ctx, wx, y, 4, 5, '#2a3a5a');
      R(ctx, wx, y, 4, 1, shade(c, -0.3));
    }
  }
  // plaza de adoquines
  R(ctx, 0, 112, W, 248, '#8d8a86');
  for (let y = 116; y < 360; y += 8) {
    R(ctx, 0, y, W, 1, '#7a7773');
    for (let x = (y / 8) % 2 ? 0 : 6; x < W; x += 12) R(ctx, x, y, 1, 8, '#7a7773');
  }
  for (let i = 0; i < 200; i++) R(ctx, hash(i * 3) * W, 116 + hash(i * 7) * 244, 1, 1, hash(i) < 0.5 ? '#9a9792' : '#82807b');
  // escenario
  R(ctx, 30, 74, 120, 28, '#2a2030');
  R(ctx, 30, 74, 120, 2, '#4a4050');
  R(ctx, 26, 100, 128, 10, '#5a3a22');
  R(ctx, 26, 100, 128, 2, '#8a5a33');
  for (let x = 28; x < 152; x += 8) {
    R(ctx, x, 102, 4, 6, '#b22234');
    R(ctx, x + 4, 102, 4, 6, '#e8e4d8');
  }
  // altavoces
  for (const x of [18, 152]) {
    R(ctx, x, 66, 12, 36, '#1a1a20');
    disc(ctx, x + 6, 76, 4, '#3a3a44');
    disc(ctx, x + 6, 92, 4, '#3a3a44');
  }
}

const CONFETTI = Array.from({ length: 44 }, (_, i) => ({ x: hash(i * 3) * 180, sp: 14 + hash(i * 5) * 20, ph: hash(i * 7) * 9, c: ['#ff4f9a', '#ffcc33', '#4ff0ff', '#7dff6a', '#ffffff', '#b22234', '#2f6fb3'][i % 7] }));
const BALLOONS = Array.from({ length: 7 }, (_, i) => ({ x: 8 + i * 26 + hash(i) * 10, sp: 6 + hash(i * 3) * 6, c: ['#b22234', '#e8e4d8', '#2f6fb3'][i % 3], ph: hash(i * 11) * 200 }));

/** Plaza del mitin: público que salta, globos, banderolas y confeti. */
export function drawRally(ctx: CanvasRenderingContext2D, t: number, view: RallyView) {
  view.now = t;
  if (!rallyBase) rallyBase = layer(180, 360, paintRallyBase);
  ctx.drawImage(rallyBase, 0, 0);
  // nubes
  for (let i = 0; i < 3; i++) {
    const x = ((t * (3 + i) + i * 70) % 230) - 40;
    R(ctx, x, 8 + i * 9, 26, 5, '#eef6ff');
    R(ctx, x + 5, 5 + i * 9, 14, 4, '#eef6ff');
  }
  // pancarta VOTE 1985 que ondea
  for (let x = 0; x < 90; x += 2) {
    const yy = Math.round(Math.sin(t * 3 + x / 9) * 1.2);
    R(ctx, 45 + x, 77 + yy, 2, 18, x < 2 || x > 86 ? '#7a1020' : '#b22234');
    R(ctx, 45 + x, 77 + yy, 2, 1, '#e8e4d8');
    R(ctx, 45 + x, 94 + yy, 2, 1, '#e8e4d8');
  }
  txtC(ctx, 'VOTE 1985', 90, 81 + Math.round(Math.sin(t * 3 + 5) * 1.2), '#fff7d0', 2);
  // banderolas en zigzag
  for (let x = 0; x < 180; x += 6) {
    const y = 64 + Math.round(Math.abs(((x % 60) - 30) / 6));
    R(ctx, x, y, 4, 4, ['#b22234', '#e8e4d8', '#2f6fb3'][(x / 6) % 3]);
    R(ctx, x + 1, y + 4, 2, 1, ['#b22234', '#e8e4d8', '#2f6fb3'][(x / 6) % 3]);
  }
  // público tras la valla
  const cheer = Math.max(0, 1 - (t - view.cheer) / 1.5);
  for (let i = 0; i < 30; i++) {
    const x = i * 6 + hash(i) * 4;
    const jump = Math.round(Math.abs(Math.sin(t * (4 + cheer * 6) + i)) * (1 + cheer * 3));
    const y = 104 - jump;
    const coat = PED_BODY[i % PED_BODY.length];
    R(ctx, x, y + 4, 6, 8, coat);
    R(ctx, x + 1, y, 4, 4, ['#f2d0b0', '#deac84', '#c18a5c', '#9a6440', '#6c4228'][i % 5]);
    R(ctx, x + 1, y - 1, 4, 1, PED_HEAD[i % PED_HEAD.length]);
    if ((i + Math.floor(t * 2)) % 5 === 0 || cheer > 0.3) R(ctx, x + (i % 2 ? 5 : -1), y - 4 + (jump % 2), 2, 5, ['#f2d0b0', '#deac84', '#c18a5c'][i % 3]);
    if (i % 7 === 3) {
      R(ctx, x - 2, y - 12, 12, 8, '#f4efe2');
      R(ctx, x + 3, y - 4, 1, 6, '#6b3f22');
      txt(ctx, i % 2 ? 'SI' : '85', x, y - 10, i % 2 ? '#b22234' : '#2f6fb3');
    }
  }
  // valla
  R(ctx, 0, 112, 180, 2, '#c8ced2');
  for (let x = 2; x < 180; x += 10) R(ctx, x, 112, 2, 8, '#9aa0a6');
  R(ctx, 0, 118, 180, 1, '#9aa0a6');
  // globos
  for (const b of BALLOONS) {
    const y = 120 - ((t * b.sp + b.ph) % 160);
    const x = b.x + Math.sin(t * 1.5 + b.ph) * 3;
    for (let i = 0; i < 8; i++) R(ctx, x + Math.round(Math.sin(t * 3 + i / 2) * 1), y + 8 + i, 1, 1, '#e8e4d8');
    disc(ctx, x, y + 3, 3, b.c);
    R(ctx, x - 1, y + 1, 1, 2, '#ffffff');
  }
  // confeti
  const n = lowFx() ? 14 : CONFETTI.length;
  for (let i = 0; i < n; i++) {
    const c = CONFETTI[i];
    const speed = c.sp * (1 + cheer * 1.5);
    const y = ((t * speed + c.ph * 40) % 380) - 20;
    const x = (c.x + Math.sin(t * 2 + c.ph) * 6 + 180) % 180;
    const flip = Math.floor(t * 8 + c.ph) % 2;
    R(ctx, x, y, flip ? 2 : 1, flip ? 1 : 2, c.c);
  }
}
