import type { Bars, Role } from './types';

/**
 * Mejoras permanentes por niveles. Cuestan varios días de ahorro y cada nivel
 * es más caro y mejor que el anterior.
 */
export interface UpgradeLevel {
  level: number;
  name: string;
  cost: number;
  description: string;
  /** Efecto inmediato al comprar. */
  instant: Bars;
}

export interface UpgradeDef {
  title: string;
  icon: string;
  levels: UpgradeLevel[];
  /** Efecto permanente por cada nivel: se aplica según el tipo. */
  perLevel: {
    /** Salud extra al dormir. */
    overnightHealth?: number;
    /** Control extra cada día. */
    dailyControl?: number;
    /** Menos estrés por jornada. */
    shiftStressRelief?: number;
  };
}

export const UPGRADES: Record<Role, UpgradeDef> = {
  inmigrante: {
    title: 'Tu casa',
    icon: '🏠',
    levels: [
      { level: 1, name: 'Cuarto propio', cost: 900, description: 'Se acabó dormir en un sofá compartido.', instant: { salud: 10, esperanza: 5 } },
      { level: 2, name: 'Apartamento', cost: 2000, description: 'Cocina propia y una ventana que da a la calle.', instant: { salud: 15, esperanza: 8 } },
      { level: 3, name: 'Casa con patio', cost: 3800, description: 'Un lugar para echar raíces. Y plantar tomates.', instant: { salud: 20, esperanza: 12 } },
    ],
    perLevel: { overnightHealth: 2 },
  },
  alcalde: {
    title: 'Tu ayudante',
    icon: '🗂',
    levels: [
      { level: 1, name: 'Secretario eficiente', cost: 300_000, description: 'Alguien que filtra las llamadas.', instant: { control: 8, estres: -6 } },
      { level: 2, name: 'Jefe de gabinete', cost: 600_000, description: 'Resuelve los incendios pequeños antes de que llegues.', instant: { control: 12, estres: -10 } },
      { level: 3, name: 'Vicealcalde de confianza', cost: 1_000_000, description: 'La ciudad funciona aunque tú duermas.', instant: { control: 16, estres: -14 } },
    ],
    perLevel: { dailyControl: 1, shiftStressRelief: 2 },
  },
};

export function nextUpgrade(role: Role, level: number): UpgradeLevel | null {
  return UPGRADES[role].levels[level] ?? null;
}
