/**
 * Carreras de caballos del casino: seis caballos con probabilidades,
 * cuotas con margen de la casa (~12 %), apuestas a ganador y colocado, el
 * orden de llegada (sorteado al salir) y la trayectoria de cada caballo
 * para que la carrera parezca natural. Todo puro, sin DOM.
 */

export const RUNNERS = 6;
export const HOUSE_MARGIN = 0.12;

export type Rng = () => number;

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const HORSE_NAMES = [
  'Lucky Star',
  'Brooklyn Bomber',
  'Midnight Express',
  'Wall Street',
  'Disco Fever',
  'Coney Flash',
  'Yellow Cab',
  'Big Apple',
  'Harlem Shuffle',
  'Neon Knight',
  'Queens Pride',
  'Bronx Thunder',
  'Manhattan Gold',
  'Liberty Belle',
  'Broadway Joe',
  'Hudson Rocket',
  'Subway Surfer',
  'Times Square',
  'Staten Rose',
  'Jersey Devil',
];

/** Colores de las sedas del jockey: [cuerpo, mangas/detalle]. */
export const SILKS: [string, string][] = [
  ['#e8323c', '#ffffff'],
  ['#2f6fdf', '#ffd23f'],
  ['#2fbf5a', '#14101f'],
  ['#ffd23f', '#e8323c'],
  ['#b04fe0', '#4ff0ff'],
  ['#ff7a1a', '#14101f'],
  ['#4ff0ff', '#ff4f9a'],
  ['#ffffff', '#2f6fdf'],
  ['#ff4f9a', '#ffffff'],
  ['#14101f', '#ffcc33'],
];
export type SilkPattern = 'liso' | 'rayas' | 'banda' | 'estrella' | 'cuartos' | 'aros';
export const PATTERNS: SilkPattern[] = ['liso', 'rayas', 'banda', 'estrella', 'cuartos', 'aros'];
export const COATS = ['#7a4622', '#5a3018', '#a0602c', '#2a1a12', '#c9c2b8', '#8c5a3a', '#3b2416'];

export type Style = 'puntero' | 'medio' | 'remontador';

export interface Horse {
  /** Dorsal (1..6). */
  no: number;
  name: string;
  silk: [string, string];
  pattern: SilkPattern;
  coat: string;
  /** Últimas 5 carreras (posiciones, la más reciente a la derecha). */
  form: string;
  style: Style;
  /** Probabilidad real de ganar. */
  p: number;
  /** Cuota fraccionaria de ganador [a, b] → "a/b". */
  frac: [number, number];
  /** Cuota decimal a ganador (devuelve stake × odds). */
  win: number;
  /** Cuota decimal a colocado (top 2). */
  place: number;
}

/** Cuotas fraccionarias típicas de los corredores de apuestas. */
export const FRACTIONS: [number, number][] = [
  [1, 5],
  [1, 4],
  [2, 7],
  [1, 3],
  [2, 5],
  [1, 2],
  [4, 7],
  [8, 13],
  [4, 6],
  [8, 11],
  [4, 5],
  [10, 11],
  [1, 1],
  [11, 10],
  [6, 5],
  [5, 4],
  [11, 8],
  [6, 4],
  [13, 8],
  [7, 4],
  [15, 8],
  [2, 1],
  [9, 4],
  [5, 2],
  [11, 4],
  [3, 1],
  [10, 3],
  [7, 2],
  [4, 1],
  [9, 2],
  [5, 1],
  [11, 2],
  [6, 1],
  [13, 2],
  [7, 1],
  [15, 2],
  [8, 1],
  [9, 1],
  [10, 1],
  [12, 1],
  [14, 1],
  [16, 1],
  [20, 1],
  [25, 1],
  [33, 1],
  [40, 1],
  [50, 1],
];

/** La mayor cuota fraccionaria que no supera la decimal dada (para que la casa mantenga su margen). */
export function toFraction(decimal: number): [number, number] {
  let best = FRACTIONS[0];
  for (const f of FRACTIONS) if (1 + f[0] / f[1] <= decimal + 1e-9) best = f;
  return best;
}

export const fracText = (f: [number, number]) => `${f[0]}/${f[1]}`;

/** Probabilidad de quedar entre los dos primeros (modelo de Harville). */
export function placeProb(ps: number[], i: number): number {
  let q = ps[i];
  for (let j = 0; j < ps.length; j++) if (j !== i) q += (ps[j] * ps[i]) / (1 - ps[j]);
  return q;
}

/** Cuota decimal de colocado, redondeada hacia abajo a 0,05. */
export function placeOdds(q: number, margin = HOUSE_MARGIN): number {
  const fair = 1 / (q * (1 + margin));
  return Math.max(1.05, Math.floor(fair * 20) / 20);
}

const styleOf = (r: number): Style => (r < 0.33 ? 'puntero' : r < 0.66 ? 'medio' : 'remontador');

/** Prepara una carrera: seis caballos con sus cuotas. */
export function makeField(rnd: Rng = Math.random): Horse[] {
  const names = [...HORSE_NAMES];
  const silks = [...SILKS];
  const strengths: number[] = [];
  for (let i = 0; i < RUNNERS; i++) strengths.push(Math.exp((rnd() - 0.5) * 1.9 + (rnd() - 0.5) * 0.6));
  const sum = strengths.reduce((a, b) => a + b, 0);
  const ps = strengths.map((s) => s / sum);
  return ps.map((p, i) => {
    const name = names.splice(Math.floor(rnd() * names.length), 1)[0];
    const silk = silks.splice(Math.floor(rnd() * silks.length), 1)[0];
    const frac = toFraction(1 / (p * (1 + HOUSE_MARGIN)));
    // forma coherente con su nivel
    const form = Array.from({ length: 5 }, () => {
      const pos = Math.min(9, 1 + Math.floor(rnd() * 5 * (1.3 - Math.min(1, p * 2.6)) + rnd() * 2));
      return rnd() < 0.06 ? 'C' : String(pos);
    }).join('');
    return {
      no: i + 1,
      name,
      silk,
      pattern: PATTERNS[Math.floor(rnd() * PATTERNS.length)],
      coat: COATS[Math.floor(rnd() * COATS.length)],
      form,
      style: styleOf(rnd()),
      p,
      frac,
      win: 1 + frac[0] / frac[1],
      place: placeOdds(placeProb(ps, i)),
    };
  });
}

/** Orden de llegada (índices) sorteado según las probabilidades (Plackett-Luce). */
export function drawOrder(ps: number[], rnd: Rng = Math.random): number[] {
  const left = ps.map((p, i) => ({ p, i }));
  const out: number[] = [];
  while (left.length) {
    const tot = left.reduce((a, b) => a + b.p, 0);
    let r = rnd() * tot;
    let k = 0;
    while (k < left.length - 1 && r >= left[k].p) r -= left[k++].p;
    out.push(left.splice(k, 1)[0].i);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Apuestas
// ---------------------------------------------------------------------------

export type HorseBetKind = 'ganador' | 'colocado';

export interface HorseBet {
  kind: HorseBetKind;
  /** Índice del caballo. */
  horse: number;
  amount: number;
}

/** Lo que devuelve una apuesta (incluida) según el orden de llegada. */
export function betReturn(bet: HorseBet, field: Horse[], order: number[]): number {
  const pos = order.indexOf(bet.horse);
  if (bet.kind === 'ganador') return pos === 0 ? Math.floor(bet.amount * field[bet.horse].win) : 0;
  return pos >= 0 && pos <= 1 ? Math.floor(bet.amount * field[bet.horse].place) : 0;
}

export function settleRace(bets: HorseBet[], field: Horse[], order: number[]) {
  let staked = 0;
  let returned = 0;
  const lines = bets.map((b) => {
    const r = betReturn(b, field, order);
    staked += b.amount;
    returned += r;
    return { ...b, returned: r };
  });
  return { staked, returned, lines };
}

/** Margen de la casa implícito en las cuotas de ganador (suma de 1/cuota − 1). */
export const overround = (field: Horse[]) => field.reduce((a, h) => a + 1 / h.win, 0) - 1;

// ---------------------------------------------------------------------------
// Trayectorias
// ---------------------------------------------------------------------------

/** Longitud de la pista en píxeles del mundo y metros que representa. */
export const TRACK_LEN = 3000;
export const TRACK_METRES = 1200;

export interface Runner {
  horse: number;
  /** Puesto de llegada (0 = ganador). */
  rank: number;
  /** Momento en que cruza la meta (s). */
  finish: number;
  /** Forma de la carrera: positivo sale fuerte, negativo remonta. */
  shape: number;
  /** Ondulaciones [amplitud, armónico]. */
  wobble: [number, number][];
}

export interface RacePlan {
  order: number[];
  runners: Runner[];
  /** Diferencia entre 1º y 2º (s): foto finish si es pequeña. */
  margin: number;
  photo: boolean;
}

const START_EASE = 0.07;

/** Arranque suave: posición normalizada (0..1) con velocidad 0 al principio. */
function ease(u: number): number {
  const u0 = START_EASE;
  const k = 1 - u0 / 2;
  if (u <= 0) return 0;
  if (u < u0) return (u * u) / (2 * u0) / k;
  return Math.min(1, (u - u0 / 2) / k);
}

/** Planifica la carrera con el orden ya decidido. */
export function planRace(field: Horse[], order: number[], rnd: Rng = Math.random, base = 17): RacePlan {
  const photo = rnd() < 0.3;
  const runners: Runner[] = [];
  let t = base + rnd() * 1.5;
  order.forEach((h, rank) => {
    if (rank === 1) t += photo ? 0.015 + rnd() * 0.04 : 0.12 + rnd() * 0.45;
    else if (rank > 1) t += 0.06 + rnd() * (rank > 3 ? 0.7 : 0.4);
    const st = field[h].style;
    // los remontadores van detrás a mitad de carrera; el ganador a veces remonta mucho
    let shape = st === 'puntero' ? 0.022 + rnd() * 0.018 : st === 'remontador' ? -0.022 - rnd() * 0.018 : (rnd() - 0.5) * 0.02;
    if (rank === 0 && rnd() < 0.35) shape = -0.04 - rnd() * 0.01;
    const wobble: [number, number][] = [
      [(rnd() - 0.5) * 0.012, 2],
      [(rnd() - 0.5) * 0.008, 3],
    ];
    runners[h] = { horse: h, rank, finish: t, shape, wobble };
  });
  const r1 = runners[order[0]].finish;
  const r2 = runners[order[1]].finish;
  return { order, runners, margin: r2 - r1, photo: r2 - r1 < 0.08 };
}

/** Fracción recorrida (0..1+) del caballo en el instante t; sigue algo más allá de la meta. */
export function progress(r: Runner, t: number): number {
  if (t >= r.finish) {
    // tras la meta va frenando
    const d = t - r.finish;
    const v = 1 / r.finish;
    return 1 + v * (d - (d * d) / 8) * (d < 4 ? 1 : 0) + (d >= 4 ? v * 2 : 0);
  }
  const u = ease(t / r.finish);
  let x = u + r.shape * Math.sin(Math.PI * u);
  for (const [a, k] of r.wobble) x += a * Math.sin(k * Math.PI * u);
  return Math.max(0, Math.min(0.99999, x));
}

/** Clasificación en el instante t (índices de caballo, primero el que va delante). */
export function standings(plan: RacePlan, t: number): number[] {
  return plan.runners
    .map((r) => ({ h: r.horse, x: progress(r, t), f: r.finish }))
    .sort((a, b) => (a.x >= 1 && b.x >= 1 ? a.f - b.f : b.x - a.x))
    .map((o) => o.h);
}
