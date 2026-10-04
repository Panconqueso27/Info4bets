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
  kind: 'logro' | 'aviso' | 'final' | 'racha' | 'armario';
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
  /** Trabajo extra en curso: reparto de paquetes o un trabajo de la radio. */
  errand?: Errand | null;
  /** Solares de esta partida: id → estado. */
  lots?: Record<string, LotState>;
  /** Manzanas renovadas por el alcalde: "c,r" → nivel (1-2). */
  renovated?: Record<string, number>;
  /** Obras de renovación en curso: "c,r" → instante en que terminan. */
  renovating?: Record<string, number>;
  /** Mascota del inmigrante. */
  pet?: Pet | null;
  /** Máquinas expendedoras del inmigrante. */
  vending?: { count: number; broken: number };
  /** Personajes recurrentes: afinidad y recuerdos. */
  npcs?: Record<string, { afinidad: number; recuerdos: string[] }>;
  /** El otro protagonista que vive en la misma ciudad (de una partida anterior o por defecto). */
  other?: OtherCharacter;
  /** Ropa y peinados desbloqueados en esta partida. */
  cosmetics?: string[];
  /** Decisiones más marcadas de la partida (para las estadísticas). */
  highlights?: { title: string; day: number; score: number; kind: LogKind }[];
  /** Grandes proyectos del alcalde: id → obras en marcha o inaugurado. */
  projects?: Record<string, { done: boolean; until: number }>;
  /** Bonos municipales del alcalde. */
  bonds?: Bond[];
  /** Boletos de lotería de la semana. */
  lottery?: LotteryTicket[];
  /** Libro de cuentas de la semana en curso y de la anterior. */
  ledger?: Ledger;
  lastLedger?: Ledger;
  /** Misiones del día. */
  missions?: Missions;
}

export interface Bond {
  amount: number;
  /** Interés total al vencer (0.05 = 5%). */
  rate: number;
  until: number;
}

export interface LotteryTicket {
  /** Semana del sorteo (número de semana de la partida). */
  week: number;
  numbers: [number, number, number];
}

export interface Ledger {
  /** Semana de la partida (0 = días 1-7). */
  week: number;
  /** Categoría → dinero neto (positivo = ingreso). */
  cats: Record<string, number>;
}

export interface Mission {
  id: string;
  label: string;
  key: string;
  target: number;
  reward: number;
  progress: number;
  done: boolean;
}

export interface Missions {
  date: string;
  list: Mission[];
}

export interface OtherCharacter {
  role: Role;
  name: string;
  look: Look;
  /** Viene de una partida anterior del jugador. */
  legacy: boolean;
}

export interface Errand {
  startedAt: number;
  endsAt: number;
  kind?: 'reparto' | 'radio' | 'taxi' | 'clases';
  /** Trabajo de la radio (para saber a qué sitio de la ciudad va). */
  job?: string;
  label?: string;
  pay?: number;
  wear?: Bars;
}

export interface LotState {
  /** Quién lo tiene: la ciudad (alcalde), el jugador (inmigrante) o una empresa (subastado). */
  owner: 'ciudad' | 'jugador' | 'privado';
  /** Obra del alcalde (parque, escuela...), del inmigrante ('vacio', 'casa', 'lavanderia'...) u 'oficinas'. */
  building: string;
  /** Nivel de lo construido (1-3); en la casa, tras terminar las fases. */
  level?: number;
  /** Fases completadas (casa del inmigrante: 0-4; obra del alcalde: 0-1). */
  phase: number;
  /** En obras hasta este instante (0 = nada en marcha). */
  buildingUntil: number;
}

export interface Pet {
  kind: 'gato' | 'perro';
  name: string;
  /** Día de adopción (para cobrar cada 30 días). */
  since: number;
}
