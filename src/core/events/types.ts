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
  outcomes: OutcomeDef[];
}

export interface EventDef {
  id: string;
  role: Role;
  kind: 'aleatorio' | 'personal' | 'diario';
  title: string;
  /** Texto de la notificación push. */
  notification: string;
  /** Planteamiento del suceso (separado de sus consecuencias). */
  intro: string;
  /** Peso al sortear qué suceso aparece en un hueco de la jornada. */
  weight: number;
  /** Variables de texto que se sortean al crear la instancia, p. ej. el servicio en huelga. */
  variants?: Record<string, string[]>;
  /** Ajusta pesos de resultados según el estado (protección legal, etc.). */
  adjustWeight?: (outcome: OutcomeDef, state: GameState) => number;
  choices: ChoiceDef[];
}
