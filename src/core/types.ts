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

export interface GameState {
  version: 1;
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
}
