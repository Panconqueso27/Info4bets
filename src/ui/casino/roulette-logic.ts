/**
 * Ruleta europea (un solo cero): orden real del cilindro, colores, tipos de
 * apuesta con sus pagos, geometría del tapete vertical (para colocar las
 * fichas donde irían en una mesa de verdad) y resolución de una tirada.
 * Todo puro, sin DOM, para poder probarlo.
 */

/** Orden de las casillas en el cilindro, en el sentido de las agujas del reloj. */
export const WHEEL_ORDER = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26] as const;

export const RED_NUMBERS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);

export type PocketColor = 'verde' | 'rojo' | 'negro';

export function colorOf(n: number): PocketColor {
  if (n === 0) return 'verde';
  return RED_NUMBERS.has(n) ? 'rojo' : 'negro';
}

/** Posición de un número en el cilindro (0..36). */
export const wheelIndex = (n: number) => WHEEL_ORDER.indexOf(n as (typeof WHEEL_ORDER)[number]);

// ---------------------------------------------------------------------------
// Apuestas
// ---------------------------------------------------------------------------

export type BetKind =
  | 'pleno'
  | 'caballo'
  | 'calle'
  | 'cuadro'
  | 'linea'
  | 'docena'
  | 'columna'
  | 'rojo'
  | 'negro'
  | 'par'
  | 'impar'
  | 'falta'
  | 'pasa';

/** Pago "a uno" de cada tipo (35 → 35:1, se devuelve además lo apostado). */
export const PAYOUT: Record<BetKind, number> = {
  pleno: 35,
  caballo: 17,
  calle: 11,
  cuadro: 8,
  linea: 5,
  docena: 2,
  columna: 2,
  rojo: 1,
  negro: 1,
  par: 1,
  impar: 1,
  falta: 1,
  pasa: 1,
};

/** Apuestas sencillas (a la par), las únicas a las que afecta "la partage". */
export const EVEN_MONEY: BetKind[] = ['rojo', 'negro', 'par', 'impar', 'falta', 'pasa'];

export interface Bet {
  kind: BetKind;
  /** Números que cubre, ordenados. */
  numbers: number[];
  /** Clave única (tipo + números). */
  key: string;
  /** Texto corto para el resumen ("Caballo 17-20"). */
  label: string;
}

const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

const NAMES: Record<BetKind, string> = {
  pleno: 'Pleno',
  caballo: 'Caballo',
  calle: 'Calle',
  cuadro: 'Cuadro',
  linea: 'Línea',
  docena: 'Docena',
  columna: 'Columna',
  rojo: 'Rojo',
  negro: 'Negro',
  par: 'Par',
  impar: 'Impar',
  falta: 'Falta (1-18)',
  pasa: 'Pasa (19-36)',
};

export function makeBet(kind: BetKind, numbers: number[]): Bet {
  const nums = [...numbers].sort((a, b) => a - b);
  let label = NAMES[kind];
  if (kind === 'docena') label = `${nums[0] === 1 ? '1ª' : nums[0] === 13 ? '2ª' : '3ª'} docena`;
  else if (kind === 'columna') label = `${nums[0]}ª columna`;
  else if (!EVEN_MONEY.includes(kind)) label = `${NAMES[kind]} ${nums.join('-')}`;
  return { kind, numbers: nums, key: `${kind}:${nums.join(',')}`, label };
}

/** Fila (0..11) y columna (0..2) de un número en el tapete. */
export const rowOf = (n: number) => Math.floor((n - 1) / 3);
export const colOf = (n: number) => (n - 1) % 3;

export const outsideBets = {
  rojo: () => makeBet('rojo', range(1, 36).filter((n) => colorOf(n) === 'rojo')),
  negro: () => makeBet('negro', range(1, 36).filter((n) => colorOf(n) === 'negro')),
  par: () => makeBet('par', range(1, 36).filter((n) => n % 2 === 0)),
  impar: () => makeBet('impar', range(1, 36).filter((n) => n % 2 === 1)),
  falta: () => makeBet('falta', range(1, 18)),
  pasa: () => makeBet('pasa', range(19, 36)),
  docena: (d: 0 | 1 | 2) => makeBet('docena', range(d * 12 + 1, d * 12 + 12)),
  columna: (c: 0 | 1 | 2) => makeBet('columna', range(1, 36).filter((n) => colOf(n) === c)),
};

/** ¿Están dos casillas una junto a otra en el tapete? (caballo válido) */
export function adjacent(a: number, b: number): boolean {
  if (a === b) return false;
  if (a === 0 || b === 0) return Math.max(a, b) <= 3;
  if (rowOf(a) === rowOf(b)) return Math.abs(a - b) === 1;
  return colOf(a) === colOf(b) && Math.abs(a - b) === 3;
}

/** Calle (fila de 3) del número. Con el 0: 0-1-2 si es 0. */
export function streetAt(n: number): Bet {
  if (n === 0) return makeBet('calle', [0, 1, 2]);
  const r = rowOf(n);
  return makeBet('calle', [r * 3 + 1, r * 3 + 2, r * 3 + 3]);
}

/**
 * Cuadro: el número es la esquina superior izquierda del bloque 2×2, y si
 * no cabe se desplaza hacia dentro. Con el 0: los "cuatro primeros" 0-1-2-3.
 */
export function cornerAt(n: number): Bet {
  if (n === 0) return makeBet('cuadro', [0, 1, 2, 3]);
  const r = Math.min(rowOf(n), 10);
  const c = Math.min(colOf(n), 1);
  const a = r * 3 + c + 1;
  return makeBet('cuadro', [a, a + 1, a + 3, a + 4]);
}

/** Línea (seisena): la fila del número y la siguiente (o la anterior si es la última). */
export function lineAt(n: number): Bet {
  const r = n === 0 ? 0 : Math.min(rowOf(n), 10);
  return makeBet('linea', range(r * 3 + 1, r * 3 + 6));
}

export function splitOf(a: number, b: number): Bet | null {
  return adjacent(a, b) ? makeBet('caballo', [a, b]) : null;
}

/** Pago a uno de una apuesta (por tipo). */
export const payoutOf = (bet: Bet) => PAYOUT[bet.kind];

export interface Placed {
  bet: Bet;
  amount: number;
}

export interface BetResult {
  bet: Bet;
  amount: number;
  /** Lo que devuelve la mesa (incluida la apuesta) — 0 si pierde. */
  returned: number;
  won: boolean;
}

/**
 * Resuelve una tirada. `laPartage`: con el 0, las sencillas recuperan la
 * mitad.
 */
export function resolveSpin(bets: Placed[], result: number, laPartage = false): { staked: number; returned: number; lines: BetResult[] } {
  let staked = 0;
  let returned = 0;
  const lines = bets.map(({ bet, amount }) => {
    staked += amount;
    let back = 0;
    if (bet.numbers.includes(result)) back = amount * (PAYOUT[bet.kind] + 1);
    else if (result === 0 && laPartage && EVEN_MONEY.includes(bet.kind)) back = Math.floor(amount / 2);
    returned += back;
    return { bet, amount, returned: back, won: back > amount };
  });
  return { staked, returned, lines };
}

/** Número al azar (0..36) con la misma probabilidad. */
export const spinNumber = (rnd: () => number = Math.random) => Math.floor(rnd() * 37) % 37;

/** Calientes y fríos: los más y menos repetidos del historial. */
export function hotCold(history: number[], n = 3): { hot: number[]; cold: number[] } {
  const count = new Map<number, number>();
  for (let i = 0; i <= 36; i++) count.set(i, 0);
  for (const h of history) count.set(h, (count.get(h) ?? 0) + 1);
  // a igualdad, manda el que salió más recientemente (calientes) o hace más (fríos)
  const last = (x: number) => history.lastIndexOf(x);
  const all = [...count.entries()];
  const hot = all
    .filter(([, c]) => c > 0)
    .sort((a, b) => b[1] - a[1] || last(b[0]) - last(a[0]))
    .slice(0, n)
    .map(([k]) => k);
  const cold = all
    .sort((a, b) => a[1] - b[1] || last(a[0]) - last(b[0]) || a[0] - b[0])
    .slice(0, n)
    .map(([k]) => k);
  return { hot, cold };
}

// ---------------------------------------------------------------------------
// Geometría del tapete vertical (en unidades; el componente lo pasa a %)
// ---------------------------------------------------------------------------
// Columnas: [sencillas | docenas | 3 columnas de números]; filas: [0 | 12
// filas | columnas 2:1].

export const CLOTH = {
  evenW: 1.25,
  dozenW: 1.1,
  numW: 2,
  zeroH: 1.15,
  rowH: 1,
  colH: 1.1,
} as const;
export const CLOTH_W = CLOTH.evenW + CLOTH.dozenW + CLOTH.numW * 3;
export const CLOTH_H = CLOTH.zeroH + CLOTH.rowH * 12 + CLOTH.colH;
const NX = CLOTH.evenW + CLOTH.dozenW;
const NY = CLOTH.zeroH;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Casilla de un número en el tapete. */
export function cellRect(n: number): Rect {
  if (n === 0) return { x: NX, y: 0, w: CLOTH.numW * 3, h: CLOTH.zeroH };
  return { x: NX + colOf(n) * CLOTH.numW, y: NY + rowOf(n) * CLOTH.rowH, w: CLOTH.numW, h: CLOTH.rowH };
}

/** Casillas de las apuestas exteriores. */
export function outsideRect(bet: Bet): Rect {
  const rows = (a: number, n: number, x: number, w: number): Rect => ({ x, y: NY + a * CLOTH.rowH, w, h: n * CLOTH.rowH });
  switch (bet.kind) {
    case 'docena':
      return rows(Math.floor((bet.numbers[0] - 1) / 12) * 4, 4, CLOTH.evenW, CLOTH.dozenW);
    case 'columna':
      return { x: NX + colOf(bet.numbers[0]) * CLOTH.numW, y: NY + 12 * CLOTH.rowH, w: CLOTH.numW, h: CLOTH.colH };
    default: {
      const order: BetKind[] = ['falta', 'par', 'rojo', 'negro', 'impar', 'pasa'];
      return rows(order.indexOf(bet.kind) * 2, 2, 0, CLOTH.evenW);
    }
  }
}

const center = (r: Rect) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });

/** Dónde se pone la ficha de una apuesta (centro, en unidades del tapete). */
export function chipSpot(bet: Bet): { x: number; y: number } {
  const nums = bet.numbers;
  switch (bet.kind) {
    case 'pleno':
      return center(cellRect(nums[0]));
    case 'calle':
    case 'linea': {
      // en el borde exterior de la(s) fila(s)
      const ys = nums.filter((n) => n > 0).map((n) => center(cellRect(n)).y);
      if (nums[0] === 0) return { x: NX + CLOTH.numW * 1, y: NY };
      return { x: NX, y: (Math.min(...ys) + Math.max(...ys)) / 2 };
    }
    case 'caballo':
    case 'cuadro': {
      if (nums[0] === 0) {
        if (nums.length === 4) return { x: NX, y: NY };
        const xs = nums.slice(1).map((n) => center(cellRect(n)).x);
        return { x: xs.reduce((a, b) => a + b, 0) / xs.length, y: NY };
      }
      const cs = nums.map((n) => center(cellRect(n)));
      return { x: cs.reduce((a, c) => a + c.x, 0) / cs.length, y: cs.reduce((a, c) => a + c.y, 0) / cs.length };
    }
    default:
      return center(outsideRect(bet));
  }
}

/** Reparte una cantidad en fichas (de mayor a menor), para pintar la pila. */
export function chipBreakdown(amount: number, chips: number[]): number[] {
  const out: number[] = [];
  let left = amount;
  const sorted = [...chips].sort((a, b) => b - a);
  for (const c of sorted) {
    while (left >= c && out.length < 40) {
      out.push(c);
      left -= c;
    }
  }
  if (left > 0) out.push(left);
  return out;
}

/** Cantidad abreviada para las fichas (1.5K, 2M). */
export function shortAmount(n: number): string {
  const f = (v: number, s: string) => `${Number.isInteger(v) ? v : v.toFixed(v < 10 ? 1 : 0)}${s}`;
  if (n >= 1e6) return f(Math.round(n / 1e5) / 10, 'M');
  if (n >= 1e3) return f(Math.round(n / 100) / 10, 'K');
  return String(Math.round(n));
}

// ---------------------------------------------------------------------------
// Animación del cilindro y la bola (pura: ángulos en función del tiempo)
// ---------------------------------------------------------------------------

export const POCKET = (Math.PI * 2) / 37;

export interface SpinPlan {
  result: number;
  /** Ángulo del cilindro al empezar. */
  wheel0: number;
  /** Velocidad inicial del cilindro (rad/s, positiva: horario). */
  wheelV: number;
  /** Constante de frenado del cilindro (s). */
  wheelTau: number;
  /** Vueltas relativas de la bola respecto al cilindro hasta encajar. */
  ballTurns: number;
  /** Momento en que la bola deja la pista y empieza a caer (s). */
  drop: number;
  /** Momento en que la bola queda quieta en la casilla (s). */
  settle: number;
  /** Rebotes: [momento relativo 0..1 entre drop y settle, desvío en casillas]. */
  bounces: [number, number][];
}

export function planSpin(result: number, wheel0 = 0, rnd: () => number = Math.random): SpinPlan {
  const settle = 6.6 + rnd() * 1.2;
  const bounces: [number, number][] = [];
  const nb = 2 + Math.floor(rnd() * 3);
  for (let i = 0; i < nb; i++) bounces.push([0.25 + (i / nb) * 0.6 + rnd() * 0.08, (rnd() < 0.5 ? -1 : 1) * (0.6 + rnd() * 1.8) * (1 - i / (nb + 1))]);
  return {
    result,
    wheel0,
    wheelV: 2.6 + rnd() * 0.8,
    wheelTau: 5 + rnd() * 2,
    ballTurns: 8 + Math.floor(rnd() * 3) + rnd(),
    drop: settle * (0.58 + rnd() * 0.06),
    settle,
    bounces,
  };
}

/** Ángulo del cilindro en el instante t. Sigue girando (despacio) al acabar. */
export function wheelAngle(p: SpinPlan, t: number): number {
  const slow = p.wheelV * 0.18;
  return p.wheel0 + slow * t + (p.wheelV - slow) * p.wheelTau * (1 - Math.exp(-t / p.wheelTau));
}

/** Ángulo de la casilla `n` en el cilindro (medido desde arriba, horario). */
export const pocketAngle = (n: number) => wheelIndex(n) * POCKET;

export interface BallState {
  /** Ángulo absoluto de la bola. */
  angle: number;
  /** Ángulo relativo al cilindro. */
  rel: number;
  /** 0 en la pista exterior → 1 en el fondo de la casilla. */
  depth: number;
  /** Altura del rebote (0..1). */
  hop: number;
  settled: boolean;
}

/**
 * Bola: corre en sentido contrario al cilindro y frena; cae en espiral,
 * rebota en los trastes y acaba en la casilla del resultado.
 */
export function ballAt(p: SpinPlan, t: number): BallState {
  const w = wheelAngle(p, t);
  const target = pocketAngle(p.result);
  if (t >= p.settle) return { angle: w + target, rel: target, depth: 1, hop: 0, settled: true };
  const u = t / p.settle;
  // relativo: de muchas vueltas en contra a 0, con velocidad que se anula al final
  let rel = target + p.ballTurns * Math.PI * 2 * Math.pow(1 - u, 2.4);
  let depth = 0;
  let hop = 0;
  if (t > p.drop) {
    const v = (t - p.drop) / (p.settle - p.drop); // 0..1
    depth = Math.min(1, v < 0.3 ? (v / 0.3) * 0.75 : 0.75 + ((v - 0.3) / 0.7) * 0.25);
    for (const [at, dev] of p.bounces) {
      const d = v - at;
      if (d > 0 && d < 0.22) {
        const k = d / 0.22;
        hop = Math.max(hop, Math.sin(k * Math.PI) * (0.45 + Math.abs(dev) * 0.15) * (1 - at * 0.6));
        rel += dev * POCKET * Math.sin(k * Math.PI) * (1 - k * 0.3);
      }
    }
  }
  return { angle: w + rel, rel, depth, hop, settled: false };
}
