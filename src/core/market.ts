import { hashString, mixSeed, mulberry32 } from './rng';

/**
 * Bolsa simulada (NO usa datos reales). Cada día, a partir de la semilla de
 * la partida y la fecha, se decide cuánto se mueve cada empresa y qué
 * noticias salen. Las noticias aciertan la mayoría de las veces, no siempre.
 * Durante la jornada de 8 horas el precio recorre su camino hasta el cierre.
 */
export interface Company {
  ticker: string;
  name: string;
  sector: 'autos' | 'musica' | 'acero' | 'aerolinea' | 'computacion' | 'petroleo' | 'comida' | 'video';
  base: number;
}

export const COMPANIES: Company[] = [
  { ticker: 'ATLM', name: 'Atlas Motors', sector: 'autos', base: 42 },
  { ticker: 'NEON', name: 'Neón Records', sector: 'musica', base: 18 },
  { ticker: 'HDST', name: 'Hudson Steel', sector: 'acero', base: 31 },
  { ticker: 'SKYW', name: 'Skyway Airlines', sector: 'aerolinea', base: 24 },
  { ticker: 'MBIT', name: 'MicroBit Computers', sector: 'computacion', base: 57 },
  { ticker: 'LBOL', name: 'Liberty Oil', sector: 'petroleo', base: 66 },
  { ticker: 'BKBG', name: 'Brooklyn Burgers', sector: 'comida', base: 12 },
  { ticker: 'VDKG', name: 'Video Kingdom', sector: 'video', base: 21 },
];

const HEADLINES: Record<Company['sector'], { up: string[]; down: string[] }> = {
  autos: {
    up: ['{n} presenta un deportivo que todos quieren', 'Récord de ventas en los concesionarios de {n}'],
    down: ['{n} llama a revisión 40.000 coches', 'Huelga en la planta de {n} en Detroit'],
  },
  musica: {
    up: ['El nuevo disco de {n} arrasa en las radios', '{n} firma a la banda de moda del verano'],
    down: ['Las ventas de vinilos de {n} se desploman', '{n} pierde a su estrella por un escándalo'],
  },
  acero: {
    up: ['Contrato federal gigante para {n}', '{n} reabre sus altos hornos'],
    down: ['El acero importado hunde los precios de {n}', '{n} anuncia despidos masivos'],
  },
  aerolinea: {
    up: ['{n} estrena rutas a Europa con lleno total', 'Baja el combustible: {n} respira'],
    down: ['Avería deja en tierra a la flota de {n}', 'Huelga de pilotos en {n}'],
  },
  computacion: {
    up: ['El ordenador personal de {n} es un éxito', '{n} lanza un chip que duplica la velocidad'],
    down: ['Retrasos en el nuevo modelo de {n}', 'Un rival japonés aplasta a {n}'],
  },
  petroleo: {
    up: ['{n} encuentra un nuevo yacimiento', 'El barril sube y {n} lo celebra'],
    down: ['Derrame de crudo: multa millonaria a {n}', 'El petróleo se abarata y {n} lo sufre'],
  },
  comida: {
    up: ['{n} abre 50 locales nuevos', 'Las colas en {n} dan la vuelta a la manzana'],
    down: ['Intoxicación en un local de {n}', '{n} sube precios y los clientes huyen'],
  },
  video: {
    up: ['Fiebre del VHS: {n} no da abasto', '{n} consigue los estrenos más esperados'],
    down: ['{n} cierra tiendas en el Bronx', 'Las salas de cine le ganan a {n} este mes'],
  },
};

export interface TickerPlan {
  ticker: string;
  /** Cambio total del día, p. ej. 0.04 = +4% */
  move: number;
}

export interface NewsItem {
  ticker: string;
  headline: string;
  /** Lo que sugiere la noticia (puede no cumplirse). */
  hint: 'up' | 'down';
}

export interface DayPlan {
  date: string;
  moves: Record<string, number>;
  news: NewsItem[];
}

/** Probabilidad de que una noticia acierte la dirección real. */
export const NEWS_ACCURACY = 0.75;

const planCache = new Map<string, DayPlan>();

/** Plan del día (memoizado: la terminal lo pide decenas de veces por segundo). */
export function dayPlan(seed: number, date: string): DayPlan {
  const key = `${seed}|${date}`;
  let plan = planCache.get(key);
  if (!plan) {
    plan = makeDayPlan(seed, date);
    if (planCache.size > 64) planCache.clear();
    planCache.set(key, plan);
  }
  return plan;
}

function makeDayPlan(seed: number, date: string): DayPlan {
  const rand = mulberry32(mixSeed(seed, hashString(`market-${date}`)));
  const moves: Record<string, number> = {};
  for (const c of COMPANIES) {
    const big = rand() < 0.12;
    const mag = big ? 0.08 + rand() * 0.08 : rand() * 0.06;
    moves[c.ticker] = Math.round((rand() < 0.5 ? -1 : 1) * mag * 10000) / 10000;
  }
  const shuffled = [...COMPANIES].sort(() => rand() - 0.5).slice(0, 4);
  const news = shuffled.map((c) => {
    const real: 'up' | 'down' = moves[c.ticker] >= 0 ? 'up' : 'down';
    const hint = rand() < NEWS_ACCURACY ? real : real === 'up' ? 'down' : 'up';
    const list = HEADLINES[c.sector][hint];
    return { ticker: c.ticker, hint, headline: list[Math.floor(rand() * list.length)].replace('{n}', c.name) };
  });
  return { date, moves, news };
}

/**
 * Precio dentro de la sesión. p = 0 apertura, p = 1 cierre.
 * Recorrido determinista: tendencia del día + ruido suave.
 */
export function priceAt(seed: number, date: string, ticker: string, open: number, p: number): number {
  const plan = dayPlan(seed, date);
  const move = plan.moves[ticker] ?? 0;
  const t = Math.max(0, Math.min(1, p));
  const [a1, a2, a3] = phases(seed, date, ticker);
  const amp = 0.012 + Math.abs(move) * 0.35;
  // El ruido vale 0 en la apertura y en el cierre.
  const noise = Math.sin(t * Math.PI) * amp * (Math.sin(t * 9 + a1) * 0.6 + Math.sin(t * 23 + a2) * 0.3 + Math.sin(t * 51 + a3) * 0.1);
  return Math.max(0.5, open * (1 + move * t + noise));
}

const phaseCache = new Map<string, [number, number, number]>();
function phases(seed: number, date: string, ticker: string): [number, number, number] {
  const key = `${seed}|${date}|${ticker}`;
  let ph = phaseCache.get(key);
  if (!ph) {
    const r = mulberry32(mixSeed(seed, hashString(`path-${date}-${ticker}`)));
    ph = [r() * 6.28, r() * 6.28, r() * 6.28];
    if (phaseCache.size > 512) phaseCache.clear();
    phaseCache.set(key, ph);
  }
  return ph;
}

export function initialPrices(): Record<string, number> {
  return Object.fromEntries(COMPANIES.map((c) => [c.ticker, c.base]));
}

export function closePrices(seed: number, date: string, open: Record<string, number>): Record<string, number> {
  const plan = dayPlan(seed, date);
  return Object.fromEntries(
    COMPANIES.map((c) => [c.ticker, Math.round(open[c.ticker] * (1 + (plan.moves[c.ticker] ?? 0)) * 100) / 100]),
  );
}

/** Multiplicador de la apuesta: un 5% a favor duplica lo apostado (tope +150%, pérdida máx. 100%). */
export const LEVERAGE = 20;

export function betReturn(stake: number, dir: 1 | -1, entry: number, exit: number): number {
  const change = (exit - entry) / entry;
  const r = Math.max(-1, Math.min(1.5, dir * change * LEVERAGE));
  return Math.round(stake * r);
}
