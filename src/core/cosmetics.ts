import type { Role } from './types';

/** Ropa y peinados que se desbloquean con rachas y logros. */
export interface CosmeticDef {
  id: string;
  kind: 'outfit' | 'hair';
  /** Solo para un personaje (la ropa); los peinados valen para ambos. */
  role?: Role;
  label: string;
  /** Cómo se consigue. */
  requirement: string;
}

export const COSMETICS: CosmeticDef[] = [
  { id: 'cuero', kind: 'outfit', role: 'inmigrante', label: 'Chaqueta de cuero', requirement: 'Racha de 7 días' },
  { id: 'esmoquin', kind: 'outfit', role: 'alcalde', label: 'Esmoquin', requirement: 'Racha de 7 días' },
  { id: 'domingo', kind: 'outfit', role: 'inmigrante', label: 'Traje de domingo', requirement: '10 logros' },
  { id: 'jogging', kind: 'outfit', role: 'alcalde', label: 'Chándal ochentero', requirement: '10 logros' },
  { id: 'permanente', kind: 'hair', label: 'Permanente', requirement: '5 logros' },
  { id: 'gorra', kind: 'hair', label: 'Gorra de béisbol', requirement: 'Racha de 14 días' },
  { id: 'cresta', kind: 'hair', label: 'Cresta punk', requirement: 'Racha de 30 días' },
];

export const COSMETIC_BY_ID = Object.fromEntries(COSMETICS.map((c) => [c.id, c])) as Record<string, CosmeticDef>;

/** Recompensas por racha (estilo Duolingo). */
export interface StreakReward {
  days: number;
  money: Record<Role, number>;
  cosmetic?: Partial<Record<Role, string>>;
  title: string;
}

export const STREAK_REWARDS: StreakReward[] = [
  { days: 3, money: { inmigrante: 30, alcalde: 20_000 }, title: '¡3 días seguidos!' },
  { days: 7, money: { inmigrante: 60, alcalde: 40_000 }, cosmetic: { inmigrante: 'cuero', alcalde: 'esmoquin' }, title: '¡Una semana entera!' },
  { days: 14, money: { inmigrante: 100, alcalde: 80_000 }, cosmetic: { inmigrante: 'gorra', alcalde: 'gorra' }, title: '¡Dos semanas!' },
  { days: 30, money: { inmigrante: 200, alcalde: 150_000 }, cosmetic: { inmigrante: 'cresta', alcalde: 'cresta' }, title: '¡Un mes sin fallar!' },
  { days: 60, money: { inmigrante: 400, alcalde: 300_000 }, title: '¡Dos meses!' },
  { days: 100, money: { inmigrante: 800, alcalde: 600_000 }, title: '¡100 días! Leyenda de la ciudad' },
];

/** Desbloqueos por número de logros. */
export const ACHIEVEMENT_UNLOCKS: { count: number; cosmetic: Partial<Record<Role, string>> }[] = [
  { count: 5, cosmetic: { inmigrante: 'permanente', alcalde: 'permanente' } },
  { count: 10, cosmetic: { inmigrante: 'domingo', alcalde: 'jogging' } },
];
