import type { Bars, GameState, Role } from '../types';

/**
 * Consecuencias mecánicas de un resultado. Siempre van acompañadas de un
 * mensaje narrativo en el OutcomeDef: nunca hay cambios silenciosos.
 */
export interface Effects {
  /** Cambios absolutos de barra (dinero en unidades monetarias). */
  bars?: Bars;
  /** Cambio porcentual sobre el dinero actual (p. ej. -25 = pierde el 25%). */
  moneyPct?: number;
  /** Interrumpe la jornada en curso: hoy no se cobra. */
  cancelShift?: string;
  /** Deja al personaje detenido estas horas: no puede iniciar jornada. */
  detainHours?: number;
  /** Marcas persistentes (logros, protecciones futuras...). */
  flags?: Record<string, number | boolean>;
  /** Suma 1 a estos contadores en flags. */
  counters?: string[];
  /** Desbloquea estos logros. */
  unlock?: string[];
  /** Termina la partida con este final. */
  endGame?: { title: string; text: string };
}

export type ResultKind = 'bueno' | 'malo';

export interface OutcomeDef {
  id: string;
  result: ResultKind;
  weight: number;
  title: string;
  /** Texto narrativo. Admite {name} y las variables del suceso. */
  message: string;
  effects: Effects;
}

export interface ChoiceDef {
  id: string;
  label: string;
  hint?: string;
  /** Dinero que se paga al elegir, salga bien o mal. */
  cost?: number;
  /** Condición para poder elegir esta opción. */
  requires?: { check: (s: GameState) => boolean; label: string };
  outcomes: OutcomeDef[];
}

export interface ResolveContext {
  outcome: OutcomeDef;
  deltas: Bars;
  /** Suceso aleatorio anterior a este (para logros de "dos seguidos"). */
  previous: string | undefined;
  unlock: (id: string) => void;
}

export interface EventDef {
  id: string;
  role: Role;
  /**
   * aleatorio: aparece durante la jornada.
   * personal: mini-evento ocasional durante la jornada.
   * diario: se revisa una vez al día al abrir el juego.
   * accion: decisión que el jugador toma desde la agenda.
   * apertura: suceso ligero de los primeros 2 minutos de la jornada.
   */
  kind: 'aleatorio' | 'personal' | 'diario' | 'accion' | 'apertura';
  /** Ilustración de la tarjeta (ver art/icons.ts). */
  icon?: string;
  title: string;
  /** Texto de la notificación push. */
  notification: string;
  /** Planteamiento del suceso (separado de sus consecuencias). */
  intro: string;
  /** Peso al sortear qué suceso aparece en un hueco de la jornada. */
  weight: number;
  /** Solo puede aparecer (o elegirse) si se cumple. */
  condition?: (s: GameState, day: number) => boolean;
  /** Días mínimos entre dos apariciones / usos. */
  cooldownDays?: number;
  /** Resumen corto para la agenda de acciones. */
  summary?: string;
  /** Variables de texto que se sortean al crear la instancia. */
  variants?: Record<string, string[]>;
  /** Ajusta pesos de resultados según el estado (protección legal, etc.). */
  adjustWeight?: (outcome: OutcomeDef, state: GameState) => number;
  /** Lógica extra al resolverse (logros que dependen del contexto). */
  onResolve?: (state: GameState, ctx: ResolveContext) => void;
  choices: ChoiceDef[];
}
