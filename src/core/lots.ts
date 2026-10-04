import { DISTRICTS, districtOf, type District } from './city';
import type { Bars, GameState, LotState, Role } from './types';

/**
 * Solares de la ciudad (cada partida tiene los suyos):
 * - El alcalde levanta obras públicas (con 3 niveles), renueva manzanas,
 *   lanza grandes proyectos y puede subastar solares.
 * - El inmigrante compra hasta 3 solares: en cada uno, una casa de alquiler
 *   (por fases y luego dúplex y edificio) o un negocio con niveles.
 */
export interface LotDef {
  id: string;
  /** Manzana y mitad que ocupa. */
  c: number;
  r: number;
  side: 'oeste' | 'este';
  label: string;
  district: District;
}

const RAW: [string, number, number, 'oeste' | 'este', string][] = [
  ['L1', 0, 2, 'este', 'Solar de la calle 4'],
  ['L2', 2, 2, 'oeste', 'Solar de la avenida C'],
  ['L3', 3, 5, 'este', 'Solar de Canal Street'],
  ['L4', 2, 6, 'oeste', 'Solar de Little Italy'],
  ['L5', 1, 8, 'este', 'Solar de Delancey'],
  ['L6', 3, 0, 'oeste', 'Solar de Harlem'],
  ['L7', 4, 1, 'este', 'Solar del muelle 9'],
  ['L8', 4, 5, 'oeste', 'Solar del astillero'],
  ['L9', 5, 2, 'oeste', 'Solar de la fábrica de azúcar'],
  ['L10', 7, 2, 'este', 'Solar de Bedford'],
  ['L11', 5, 4, 'este', 'Solar de Montague'],
  ['L12', 6, 3, 'oeste', 'Solar de Henry Street'],
  ['L13', 7, 5, 'este', 'Solar de Atlantic Avenue'],
  ['L14', 5, 7, 'oeste', 'Solar de Surf Avenue'],
  ['L15', 7, 7, 'este', 'Solar de Brighton'],
  ['L16', 5, 8, 'este', 'Solar del paseo marítimo'],
];

export const LOTS: LotDef[] = RAW.map(([id, c, r, side, label]) => ({ id, c, r, side, label, district: districtOf(c, r) }));
export const LOT_BY_ID = Object.fromEntries(LOTS.map((l) => [l.id, l])) as Record<string, LotDef>;
export const lotAt = (c: number, r: number) => LOTS.find((l) => l.c === c && l.r === r);

// ---------------------------------------------------------------------------
// Obras públicas del alcalde (3 niveles)
// ---------------------------------------------------------------------------

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
  /** Nombre de cada nivel (1-3). */
  levels: [string, string, string];
}

export const CIVIC: CivicDef[] = [
  { id: 'parque', label: 'Parque de barrio', icon: '🌳', cost: 150_000, days: 2, instant: { popularidad: 6, estres: -3 }, tourism: 0.25, income: 0, description: 'Árboles, bancos y una fuente. Los vecinos lo agradecen.', levels: ['Parque de barrio', 'Parque con lago', 'Jardín botánico'] },
  { id: 'escuela', label: 'Escuela pública', icon: '🏫', cost: 250_000, days: 3, instant: { popularidad: 8, control: 4 }, tourism: 0, income: 2_000, description: 'Aulas nuevas para mil niños del barrio.', levels: ['Escuela pública', 'Instituto', 'Universidad'] },
  { id: 'hospital', label: 'Centro de salud', icon: '🏥', cost: 350_000, days: 3, instant: { popularidad: 10, control: 3 }, tourism: 0, income: 5_000, description: 'Urgencias abiertas 24 horas en un barrio que no tenía.', levels: ['Centro de salud', 'Hospital', 'Hospital general'] },
  { id: 'metro', label: 'Estación de metro', icon: '🚇', cost: 450_000, days: 4, instant: { control: 8, popularidad: 4 }, tourism: 0.3, income: 12_000, description: 'Una línea más que conecta el barrio con el centro.', levels: ['Estación de metro', 'Línea completa', 'Estación central'] },
  { id: 'museo', label: 'Museo de la ciudad', icon: '🏛', cost: 300_000, days: 3, instant: { popularidad: 5 }, tourism: 0.6, income: 4_000, description: 'Historia de Nueva York, del puerto a los rascacielos.', levels: ['Museo de la ciudad', 'Museo ampliado', 'Gran museo'] },
  { id: 'viviendas', label: 'Viviendas sociales', icon: '🏘', cost: 300_000, days: 3, instant: { popularidad: 10, control: -2 }, tourism: 0, income: 6_000, description: 'Pisos asequibles para familias trabajadoras.', levels: ['Viviendas sociales', 'Barrio nuevo', 'Ciudad jardín'] },
];

export const CIVIC_BY_ID = Object.fromEntries(CIVIC.map((c) => [c.id, c])) as Record<string, CivicDef>;

/** Mejorar una obra pública al nivel `to` (2 o 3). */
export function civicUpgrade(def: CivicDef, to: number) {
  return { cost: Math.round(def.cost * (to === 2 ? 0.8 : 1.2)), days: to === 2 ? 2 : 3 };
}

/** Cada nivel multiplica turismo e ingresos de la obra. */
export const civicMul = (level: number) => (level <= 1 ? 1 : level === 2 ? 1.6 : 2.4);

/** Subasta de un solar libre a una empresa privada (alcalde). */
export const auctionPrice = (l: LotDef, districtLevel = 0) => Math.round((180_000 * DISTRICTS[l.district].priceMul * (1 + 0.15 * districtLevel)) / 1000) * 1000;

// ---------------------------------------------------------------------------
// Renovación de manzanas (alcalde): dos niveles
// ---------------------------------------------------------------------------

export const RENOVATION = [
  { level: 1, label: 'Fachadas restauradas', cost: 80_000, hours: 24, instant: { popularidad: 2 } as Bars, tourism: 0.08 },
  { level: 2, label: 'Neones y arbolado', cost: 60_000, hours: 24, instant: { popularidad: 2, control: 1 } as Bars, tourism: 0.08 },
];

// ---------------------------------------------------------------------------
// Grandes proyectos (alcalde)
// ---------------------------------------------------------------------------

export interface MegaDef {
  id: string;
  label: string;
  icon: string;
  /** Terreno: manzanas que ocupa (o el lugar existente que transforma). */
  site: { c: number; r: number; cw: number; rh: number } | { place: 'plaza' };
  cost: number;
  days: number;
  instant: Bars;
  tourism: number;
  income: number;
  description: string;
  /** En la partida del inmigrante, la ciudad lo inaugura este día. */
  autoDay: number;
}

export const MEGA: MegaDef[] = [
  { id: 'timessquare', label: 'Reforma de Times Square', icon: '🎭', site: { place: 'plaza' }, cost: 900_000, days: 3, instant: { popularidad: 8, control: 4 }, tourism: 0.7, income: 20_000, description: 'Teatros restaurados, pantallas gigantes y una plaza para pasear.', autoDay: 10 },
  { id: 'puerto', label: 'Puerto de cruceros', icon: '🛳', site: { c: 4, r: 7, cw: 1, rh: 2 }, cost: 1_200_000, days: 4, instant: { popularidad: 6 }, tourism: 0.8, income: 30_000, description: 'Una terminal moderna donde atracan los cruceros del Atlántico.', autoDay: 20 },
  { id: 'estadio', label: 'Estadio de béisbol', icon: '⚾', site: { c: 6, r: 4, cw: 2, rh: 1 }, cost: 1_600_000, days: 5, instant: { popularidad: 12 }, tourism: 1, income: 40_000, description: 'Los Dodgers vuelven a Brooklyn. 50.000 gargantas cada partido.', autoDay: 32 },
  { id: 'aeropuerto', label: 'Aeropuerto de Brooklyn', icon: '✈', site: { c: 6, r: 0, cw: 2, rh: 2 }, cost: 2_500_000, days: 7, instant: { popularidad: 10, control: 6 }, tourism: 1.5, income: 60_000, description: 'Vuelos a todo el país desde la otra orilla del río.', autoDay: 45 },
];
export const MEGA_BY_ID = Object.fromEntries(MEGA.map((m) => [m.id, m])) as Record<string, MegaDef>;

/** ¿Está inaugurado el gran proyecto? (el inmigrante los ve aparecer con los días). */
export function megaDone(state: GameState, id: string, day: number): boolean {
  if (state.character.role === 'alcalde') return !!state.projects?.[id]?.done;
  return day >= MEGA_BY_ID[id].autoDay;
}
export function megaWorks(state: GameState, id: string, day: number): boolean {
  if (state.character.role === 'alcalde') return !!state.projects?.[id] && !state.projects[id].done;
  const d = MEGA_BY_ID[id].autoDay;
  return day >= d - 3 && day < d;
}

// ---------------------------------------------------------------------------
// Inmigrante: casa por fases y negocios con niveles
// ---------------------------------------------------------------------------

export const LOT_PRICE = 500;
export const MAX_LOTS = 3;
export const lotPrice = (l: LotDef, districtLevel = 0) => Math.round((LOT_PRICE * DISTRICTS[l.district].priceMul * (1 + 0.15 * districtLevel)) / 10) * 10;

export const HOUSE_PHASES = [
  { label: 'Cimientos', cost: 300, hours: 24, text: 'Una hormigonera, tres amigos y mucho sudor.' },
  { label: 'Estructura', cost: 600, hours: 24, text: 'Vigas y ladrillo: ya se ve la forma de la casa.' },
  { label: 'Tejado', cost: 500, hours: 24, text: 'Tejas rojas como las de tu pueblo.' },
  { label: 'Acabados', cost: 400, hours: 24, text: 'Pintura, ventanas y una puerta con tu nombre.' },
];
/** Alquiler de la casa terminada (nivel 1). */
export const HOUSE_RENT = 35;

export interface BizLevel {
  name: string;
  cost: number;
  days: number;
  income: number;
}

export interface BizDef {
  id: string;
  label: string;
  icon: string;
  description: string;
  /** Niveles 1-3 (en la casa, el nivel 1 se consigue con las fases). */
  levels: [BizLevel, BizLevel, BizLevel];
}

export const BUSINESSES: BizDef[] = [
  {
    id: 'casa',
    label: 'Casa de alquiler',
    icon: '🏠',
    description: 'Levántala por fases y alquílala. Luego crece a dúplex y a edificio.',
    levels: [
      { name: 'Casa', cost: 0, days: 0, income: HOUSE_RENT },
      { name: 'Dúplex', cost: 1500, days: 2, income: 70 },
      { name: 'Edificio de 4 pisos', cost: 3500, days: 3, income: 140 },
    ],
  },
  {
    id: 'lavanderia',
    label: 'Lavandería',
    icon: '🧺',
    description: 'Lavadoras de monedas: el barrio entero lava aquí los domingos.',
    levels: [
      { name: 'Lavandería', cost: 900, days: 1, income: 25 },
      { name: 'Lavandería con secadoras', cost: 1200, days: 1, income: 45 },
      { name: 'Lavandería 24 horas', cost: 2200, days: 2, income: 80 },
    ],
  },
  {
    id: 'comida',
    label: 'Puesto de comida',
    icon: '🌮',
    description: 'Las recetas de tu tierra en un puesto con toldo.',
    levels: [
      { name: 'Puesto de comida', cost: 600, days: 1, income: 18 },
      { name: 'Cafetería', cost: 900, days: 1, income: 35 },
      { name: 'Restaurante', cost: 1800, days: 2, income: 65 },
    ],
  },
  {
    id: 'taller',
    label: 'Taller mecánico',
    icon: '🔧',
    description: 'Taxis y furgonetas que necesitan manos expertas.',
    levels: [
      { name: 'Taller mecánico', cost: 1400, days: 2, income: 40 },
      { name: 'Taller con grúa', cost: 1800, days: 2, income: 70 },
      { name: 'Concesionario', cost: 3000, days: 3, income: 120 },
    ],
  },
];
export const BIZ_BY_ID = Object.fromEntries(BUSINESSES.map((b) => [b.id, b])) as Record<string, BizDef>;

/** Nivel de lo construido en el solar (0 = aún no funciona). */
export function lotLevel(lot: LotState): number {
  if (lot.owner === 'privado') return 1;
  if (lot.owner === 'ciudad') return lot.phase > 0 ? lot.level ?? 1 : 0;
  if (lot.building === 'vacio') return 0;
  if (lot.building === 'casa') return lot.phase >= HOUSE_PHASES.length ? lot.level ?? 1 : 0;
  return lot.level ?? 0;
}

/** Ingreso diario de un solar del inmigrante. */
export function bizIncome(lot: LotState, districtLevel = 0): number {
  const lvl = lotLevel(lot);
  const def = BIZ_BY_ID[lot.building];
  if (!def || lvl <= 0) return 0;
  return Math.round(def.levels[lvl - 1].income * (1 + 0.1 * districtLevel));
}

export function lotState(state: GameState, id: string) {
  return state.lots?.[id];
}

export function ownedLots(state: GameState): string[] {
  return Object.entries(state.lots ?? {})
    .filter(([, l]) => l.owner === 'jugador')
    .map(([id]) => id);
}

/** Compatibilidad: el primer solar del jugador. */
export function ownedLot(state: GameState): string | undefined {
  return ownedLots(state)[0];
}

export function canUseLots(role: Role) {
  return role === 'alcalde' ? 'construir' : 'comprar';
}

// ---------------------------------------------------------------------------
// Nivel de barrio: cuanto más se construye, más vida y más caro
// ---------------------------------------------------------------------------

export function districtScores(state: GameState, day = 1): Record<District, number> {
  const out = Object.fromEntries(Object.keys(DISTRICTS).map((d) => [d, 0])) as Record<District, number>;
  for (const [id, lot] of Object.entries(state.lots ?? {})) out[LOT_BY_ID[id].district] += lotLevel(lot);
  for (const [key, lvl] of Object.entries(state.renovated ?? {})) {
    const [c, r] = key.split(',').map(Number);
    out[districtOf(c, r)] += lvl * 0.5;
  }
  for (const m of MEGA) {
    if (!megaDone(state, m.id, day)) continue;
    const d = 'place' in m.site ? 'midtown' : districtOf(m.site.c, m.site.r);
    out[d] += 3;
  }
  return out;
}

export function districtLevel(state: GameState, d: District, day = 1): number {
  return Math.min(3, Math.floor(districtScores(state, day)[d] / 2));
}

// ---------------------------------------------------------------------------
// Lo que el mapa necesita para dibujarse
// ---------------------------------------------------------------------------

export interface CityLook {
  lots: Record<string, { owner: 'ciudad' | 'jugador' | 'privado'; building: string; phase: number; level: number; works: boolean }>;
  renovated: Record<string, number>;
  renovating: string[];
  /** Grandes proyectos: id → 'obras' | 'listo'. */
  mega: Record<string, 'obras' | 'listo'>;
  /** Nivel de cada barrio (0-3). */
  districts: Partial<Record<District, number>>;
}

export function cityLook(state: GameState | null, day = 1): CityLook {
  const lots: CityLook['lots'] = {};
  for (const [id, l] of Object.entries(state?.lots ?? {})) lots[id] = { owner: l.owner, building: l.building, phase: l.phase, level: lotLevel(l), works: !!l.buildingUntil };
  const mega: CityLook['mega'] = {};
  const districts: CityLook['districts'] = {};
  if (state) {
    for (const m of MEGA) {
      if (megaDone(state, m.id, day)) mega[m.id] = 'listo';
      else if (megaWorks(state, m.id, day)) mega[m.id] = 'obras';
    }
    for (const d of Object.keys(DISTRICTS) as District[]) {
      const lvl = districtLevel(state, d, day);
      if (lvl) districts[d] = lvl;
    }
  }
  return { lots, renovated: { ...(state?.renovated ?? {}) }, renovating: Object.keys(state?.renovating ?? {}).sort(), mega, districts };
}

/** Firma del estado visual de la ciudad: si cambia, se redibuja el mapa. */
export function citySignature(state: GameState | null, day = 1): string {
  if (!state) return '';
  return JSON.stringify(cityLook(state, day));
}
