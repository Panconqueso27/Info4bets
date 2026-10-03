import type { Bars, GameState, Role } from './types';

/**
 * Solares vacíos de la ciudad (cada partida tiene los suyos).
 * - El alcalde construye obras públicas y renueva manzanas.
 * - El inmigrante compra un solar y levanta su casa por fases.
 */
export interface LotDef {
  id: string;
  /** Manzana y mitad que ocupa. */
  c: number;
  r: number;
  side: 'oeste' | 'este';
  label: string;
}

export const LOTS: LotDef[] = [
  { id: 'L1', c: 0, r: 2, side: 'este', label: 'Solar de la calle 4' },
  { id: 'L2', c: 2, r: 2, side: 'oeste', label: 'Solar de la avenida C' },
  { id: 'L3', c: 3, r: 5, side: 'este', label: 'Solar del muelle' },
  { id: 'L4', c: 2, r: 6, side: 'oeste', label: 'Solar de Little Italy' },
  { id: 'L5', c: 1, r: 8, side: 'este', label: 'Solar del Bronx' },
  { id: 'L6', c: 3, r: 0, side: 'oeste', label: 'Solar de Harlem' },
];

export const LOT_BY_ID = Object.fromEntries(LOTS.map((l) => [l.id, l])) as Record<string, LotDef>;
export const lotAt = (c: number, r: number) => LOTS.find((l) => l.c === c && l.r === r);

/** Obras públicas del alcalde. */
export interface CivicDef {
  id: string;
  label: string;
  icon: string;
  cost: number;
  days: number;
  /** Efecto al inaugurarla. */
  instant: Bars;
  /** Atractivo turístico (multiplica los turistas). */
  tourism: number;
  /** Ingreso diario directo (taquillas, abonos...). */
  income: number;
  description: string;
}

export const CIVIC: CivicDef[] = [
  { id: 'parque', label: 'Parque de barrio', icon: '🌳', cost: 200_000, days: 2, instant: { popularidad: 6, estres: -3 }, tourism: 0.25, income: 0, description: 'Árboles, bancos y una fuente. Los vecinos lo agradecen.' },
  { id: 'escuela', label: 'Escuela pública', icon: '🏫', cost: 350_000, days: 3, instant: { popularidad: 8, control: 4 }, tourism: 0, income: 0, description: 'Aulas nuevas para mil niños del barrio.' },
  { id: 'hospital', label: 'Centro de salud', icon: '🏥', cost: 500_000, days: 3, instant: { popularidad: 10, control: 3 }, tourism: 0, income: 5_000, description: 'Urgencias abiertas 24 horas en un barrio que no tenía.' },
  { id: 'metro', label: 'Estación de metro', icon: '🚇', cost: 600_000, days: 4, instant: { control: 8, popularidad: 4 }, tourism: 0.3, income: 12_000, description: 'Una línea más que conecta el barrio con el centro.' },
  { id: 'museo', label: 'Museo de la ciudad', icon: '🏛', cost: 450_000, days: 3, instant: { popularidad: 5 }, tourism: 0.6, income: 4_000, description: 'Historia de Nueva York, del puerto a los rascacielos.' },
  { id: 'viviendas', label: 'Viviendas sociales', icon: '🏘', cost: 400_000, days: 3, instant: { popularidad: 10, control: -2 }, tourism: 0, income: 6_000, description: 'Pisos asequibles para familias trabajadoras.' },
];

export const CIVIC_BY_ID = Object.fromEntries(CIVIC.map((c) => [c.id, c])) as Record<string, CivicDef>;

/** Renovación de manzanas (alcalde): dos niveles. */
export const RENOVATION = [
  { level: 1, label: 'Fachadas restauradas', cost: 120_000, hours: 24, instant: { popularidad: 2 } as Bars, tourism: 0.08 },
  { level: 2, label: 'Neones y arbolado', cost: 90_000, hours: 24, instant: { popularidad: 2, control: 1 } as Bars, tourism: 0.08 },
];

/** La casa del inmigrante en su solar, por fases (una por día). */
export const LOT_PRICE = 600;
export const HOUSE_PHASES = [
  { label: 'Cimientos', cost: 400, hours: 24, text: 'Una hormigonera, tres amigos y mucho sudor.' },
  { label: 'Estructura', cost: 800, hours: 24, text: 'Vigas y ladrillo: ya se ve la forma de la casa.' },
  { label: 'Tejado', cost: 600, hours: 24, text: 'Tejas rojas como las de tu pueblo.' },
  { label: 'Acabados', cost: 500, hours: 24, text: 'Pintura, ventanas y una puerta con tu nombre.' },
];
/** Al terminarla la alquilas: ingreso diario. */
export const HOUSE_RENT = 30;

export function lotState(state: GameState, id: string) {
  return state.lots?.[id];
}

export function ownedLot(state: GameState): string | undefined {
  return Object.entries(state.lots ?? {}).find(([, l]) => l.owner === 'jugador')?.[0];
}

export function canUseLots(role: Role) {
  return role === 'alcalde' ? 'construir' : 'comprar';
}

/** Lo que el mapa necesita saber de solares y obras para dibujarse. */
export interface CityLook {
  lots: Record<string, { owner: 'ciudad' | 'jugador'; building: string; phase: number; works: boolean }>;
  renovated: Record<string, number>;
  renovating: string[];
}

export function cityLook(state: GameState | null): CityLook {
  const lots: CityLook['lots'] = {};
  for (const [id, l] of Object.entries(state?.lots ?? {})) lots[id] = { owner: l.owner, building: l.building, phase: l.phase, works: !!l.buildingUntil };
  return { lots, renovated: { ...(state?.renovated ?? {}) }, renovating: Object.keys(state?.renovating ?? {}).sort() };
}

/** Firma del estado visual de la ciudad: si cambia, se redibuja el mapa. */
export function citySignature(state: GameState | null): string {
  if (!state) return '';
  return JSON.stringify(cityLook(state));
}
