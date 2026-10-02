import type { BarId, Bars, Role } from './types';

export interface BarDef {
  id: BarId;
  label: string;
  icon: string;
  /** true = cuanto más llena, peor (estrés). */
  inverted?: boolean;
  /** Las barras de dinero guardan una cantidad; se dibujan relativas a este tope. */
  moneyScale?: number;
}

export interface RoleDef {
  id: Role;
  title: string;
  tagline: string;
  description: string;
  workplace: string;
  /** 'al diner' / 'a la alcaldía' */
  toWorkplace: string;
  goToWork: string;
  retire: string;
  atWork: string;
  ageRange: [number, number];
  bars: BarDef[];
  initialBars: Bars;
  /** Lo que se cobra al retirar al personaje tras las 8 horas. */
  shiftPay: number;
  /** Gastos fijos de cada día (alquiler, comida / gasto corriente de la ciudad). */
  dailyCost: number;
  /** Desgaste de una jornada completa. */
  shiftWear: Bars;
  /** Recuperación al dormir, cada cambio de día. */
  overnight: Bars;
  /** Penalización diaria si el dinero está en negativo. */
  debtPenalty: Bars;
  formatMoney: (n: number) => string;
  loseConditions: string;
}

const shared = (moneyScale: number): BarDef[] => [
  { id: 'salud', label: 'Salud', icon: '♥' },
  { id: 'estres', label: 'Estrés', icon: '⚡', inverted: true },
  { id: 'dinero', label: 'Dinero', icon: '$', moneyScale },
];

export const ROLES: Record<Role, RoleDef> = {
  inmigrante: {
    id: 'inmigrante',
    title: 'El inmigrante',
    tagline: 'Llegaste con una maleta y un plan.',
    description:
      'Acabas de llegar a la ciudad para rehacer tu vida. Trabajo duro, alquiler caro y una comunidad que puede ser tu red… o tu único refugio.',
    workplace: 'el diner',
    toWorkplace: 'al diner',
    goToWork: 'Ir a trabajar',
    retire: 'Salir del trabajo',
    atWork: 'Trabajando en el diner',
    ageRange: [18, 70],
    bars: [
      ...shared(3000),
      { id: 'esperanza', label: 'Esperanza', icon: '☀' },
      { id: 'reputacion', label: 'Reputación', icon: '★' },
    ],
    initialBars: { salud: 75, estres: 35, dinero: 300, esperanza: 60, reputacion: 30 },
    shiftPay: 140,
    dailyCost: 70,
    shiftWear: { salud: -4, estres: 5 },
    overnight: { salud: 5, estres: -9, esperanza: 1 },
    debtPenalty: { estres: 3, esperanza: -2 },
    formatMoney: (n) => `${n < 0 ? '-' : ''}$${Math.abs(Math.round(n)).toLocaleString('es')}`,
    loseConditions: 'Si el estrés llega al máximo o la esperanza se agota, vuelves a tu país.',
  },
  alcalde: {
    id: 'alcalde',
    title: 'El alcalde',
    tagline: 'La ciudad es tuya. Y todos sus problemas.',
    description:
      'Gobiernas la misma ciudad desde el despacho más alto. Presupuesto, prensa, sindicatos y concejales: todos quieren algo de ti.',
    workplace: 'la alcaldía',
    toWorkplace: 'a la alcaldía',
    goToWork: 'Ir a la alcaldía',
    retire: 'Salir de la alcaldía',
    atWork: 'Despachando en la alcaldía',
    ageRange: [30, 80],
    bars: [
      ...shared(2_000_000),
      { id: 'popularidad', label: 'Popularidad', icon: '☺' },
      { id: 'control', label: 'Control', icon: '♜' },
    ],
    initialBars: { salud: 75, estres: 30, dinero: 300_000, popularidad: 55, control: 50 },
    shiftPay: 70_000,
    dailyCost: 40_000,
    shiftWear: { salud: -3, estres: 6, control: 2, popularidad: 1 },
    overnight: { salud: 4, estres: -7 },
    debtPenalty: { estres: 4, control: -2 },
    formatMoney: (n) => {
      const sign = n < 0 ? '-' : '';
      const a = Math.abs(n);
      if (a >= 1_000_000) return `${sign}$${(a / 1_000_000).toFixed(2)}M`;
      if (a >= 1000) return `${sign}$${Math.round(a / 1000)}K`;
      return `${sign}$${Math.round(a)}`;
    },
    loseConditions: 'Si la popularidad o el control llegan a cero, te destituyen o renuncias.',
  },
};

export const SHIFT_HOURS = 8;
