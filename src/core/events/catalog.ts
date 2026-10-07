import { ALCALDE_EVENTS } from './alcalde';
import { APERTURA_EVENTS } from './apertura';
import { HISTORIAS_EVENTS } from './historias';
import { INMIGRANTE_EVENTS } from './inmigrante';
import { PASIVOS_EVENTS } from './pasivos';
import { EXTRAS_EVENTS } from './extras';
import type { EventDef } from './types';

/**
 * Catálogo de sucesos. Cada suceso describe solo la situación; las
 * consecuencias viven en sus resultados (bueno/malo), cada uno con su mensaje.
 */
export const EVENTS: Record<string, EventDef> = Object.fromEntries(
  [...INMIGRANTE_EVENTS, ...ALCALDE_EVENTS, ...APERTURA_EVENTS, ...HISTORIAS_EVENTS, ...PASIVOS_EVENTS, ...EXTRAS_EVENTS].map((e) => [e.id, e]),
);

export function eventsFor(role: EventDef['role'], ...kinds: EventDef['kind'][]): EventDef[] {
  return Object.values(EVENTS).filter((e) => e.role === role && (!kinds.length || kinds.includes(e.kind)));
}
