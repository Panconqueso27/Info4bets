/**
 * Geografía de la ciudad (compartida por la lógica y el dibujo):
 * Manhattan (columnas 0-3) y Brooklyn (columnas 4-7), separados por el
 * East River y unidos por el puente de Brooklyn.
 */
export const COLS = 8;
export const ROWS = 9;
/** Las columnas de Manhattan son 0..MANHATTAN_COLS-1. */
export const MANHATTAN_COLS = 4;
/** Calle (índice 0..ROWS) por la que cruza el puente. */
export const BRIDGE_STREET = 4;

export type Side = 'manhattan' | 'brooklyn';
export const sideOf = (c: number): Side => (c < MANHATTAN_COLS ? 'manhattan' : 'brooklyn');

export type District = 'midtown' | 'lowereast' | 'chinatown' | 'muelles' | 'industrial' | 'heights' | 'coney';

export const DISTRICTS: Record<District, { label: string; priceMul: number; side: Side; poor?: boolean }> = {
  midtown: { label: 'Midtown', priceMul: 1.4, side: 'manhattan' },
  chinatown: { label: 'Chinatown', priceMul: 1, side: 'manhattan' },
  lowereast: { label: 'Lower East Side', priceMul: 0.8, side: 'manhattan', poor: true },
  muelles: { label: 'Los Muelles', priceMul: 0.7, side: 'brooklyn', poor: true },
  industrial: { label: 'Williamsburg', priceMul: 0.7, side: 'brooklyn', poor: true },
  heights: { label: 'Brooklyn Heights', priceMul: 1.2, side: 'brooklyn' },
  coney: { label: 'Coney Island', priceMul: 1, side: 'brooklyn' },
};

export function districtOf(c: number, r: number): District {
  if (c < MANHATTAN_COLS) {
    if (r <= 4) return 'midtown';
    return c <= 1 ? 'lowereast' : 'chinatown';
  }
  if (c === MANHATTAN_COLS) return 'muelles';
  if (r <= 2) return 'industrial';
  if (r <= 5) return 'heights';
  return 'coney';
}
