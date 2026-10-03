export type Role = 'inmigrante' | 'alcalde';

export type SharedBar = 'salud' | 'estres' | 'dinero';
export type ImmigrantBar = 'esperanza' | 'reputacion';
export type MayorBar = 'popularidad' | 'control';
export type BarId = SharedBar | ImmigrantBar | MayorBar;

export type Bars = Partial<Record<BarId, number>>;

export interface Look {
  outfit: string;
  hair: string;
  skin: string;
  hairColor: string;
  outfitColor: string;
}

export interface Character {
  role: Role;
  name: string;
  age: number;
  look: Look;
}

export interface EventSlot {
  at: number;
  eventId: string;
  fired: boolean;
}

export interface Shift {
  startedAt: number;
  endsAt: number;
  slots: EventSlot[];
  /** La jornada se interrumpió (detención, cerco...): no se cobra. */
  cancelled?: string;
  /** Precios de apertura de la bolsa al empezar la jornada. */
  marketOpen: Record<string, number>;
}

export interface PendingEvent {
  instanceId: string;
  eventId: string;
  firedAt: number;
  seed: number;
}

export type LogKind = 'bueno' | 'malo' | 'info';

export interface LogEntry {
  at: number;
  day: number;
  kind: LogKind;
  title: string;
  text: string;
  deltas?: Bars;
}

export interface GameOver {
  at: number;
  day: number;
  title: string;
  text: string;
}

export interface TodayState {
  /** Fecha local YYYY-MM-DD */
  date: string;
  /** Mandó al personaje al trabajo/alcaldía hoy. */
  worked: boolean;
  /** Estuvo detenido en algún momento del día (la racha se congela). */
  detained: boolean;
}

export interface MarketBet {
  id: string;
  ticker: string;
  dir: 1 | -1;
  stake: number;
  entryPrice: number;
  /** Sesión (fecha) y precio de apertura del plan con el que se cotiza. */
  date: string;
  open: number;
  placedAt: number;
}

export interface MarketState {
  /** Precios de apertura del día actual. */
  open: Record<string, number>;
  bets: MarketBet[];
}

export interface Notice {
  kind: 'logro' | 'aviso' | 'final';
  title: string;
  text: string;
}

export interface Ending {
  at: number;
  day: number;
  title: string;
  text: string;
}

export interface GameState {
  version: 2;
  character: Character;
  bars: Bars;
  createdAt: number;
  startDate: string;
  lastSeenAt: number;
  today: TodayState;
  streak: number;
  bestStreak: number;
  daysWorked: number;
  shift: Shift | null;
  /** Detenido hasta este instante (ms). 0 = libre. */
  detainedUntil: number;
  pending: PendingEvent[];
  log: LogEntry[];
  flags: Record<string, number | boolean>;
  seed: number;
  gameOver: GameOver | null;
  /** Nivel de la mejora permanente: casa (inmigrante) o ayudante (alcalde). */
  upgradeLevel: number;
  market: MarketState;
  /** Días seguidos cumpliendo una condición (para logros). */
  streaks: Record<string, number>;
  /** Logros desbloqueados: id → instante. */
  achievements: Record<string, number>;
  /** Barras al empezar el día, para comparar al cerrarlo. */
  dayStartBars: Bars;
  /** Últimos sucesos aleatorios, el más reciente al final. */
  eventHistory: string[];
  /** Acción → número de día en que se usó por última vez. */
  cooldowns: Record<string, number>;
  /** Último día en que se revisaron los sucesos diarios. */
  dailyCheckDate: string;
  /** Último día en que el jugador vio las noticias de la bolsa. */
  newsSeenDate: string;
  /** Avisos pendientes de mostrar (logros, etc.). */
  notices: Notice[];
  /** Final positivo alcanzado (se puede seguir jugando). */
  ending: Ending | null;
  /** Mandato actual del alcalde (empieza en 1). */
  term: number;
  /** Reparto de paquetes en curso (trabajo extra del inmigrante). */
  errand?: { startedAt: number; endsAt: number } | null;
}
