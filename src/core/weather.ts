import { hashString, mixSeed, mulberry32 } from './rng';

/**
 * Clima diario de la ciudad. Se decide con la semilla de la partida y la
 * fecha, según la estación (Nueva York: nieve en invierno, tormentas en verano).
 */
export type Weather = 'despejado' | 'nublado' | 'lluvia' | 'tormenta' | 'nieve';

export const WEATHER_LABEL: Record<Weather, { icon: string; label: string }> = {
  despejado: { icon: '☀', label: 'Despejado' },
  nublado: { icon: '☁', label: 'Nublado' },
  lluvia: { icon: '🌧', label: 'Lluvia' },
  tormenta: { icon: '⛈', label: 'Tormenta' },
  nieve: { icon: '❄', label: 'Nieve' },
};

/** Probabilidades por estación: [nublado, lluvia, tormenta, nieve]; el resto, despejado. */
const SEASONS: Record<'invierno' | 'primavera' | 'verano' | 'otono', [number, number, number, number]> = {
  invierno: [0.25, 0.1, 0, 0.35],
  primavera: [0.25, 0.25, 0.05, 0],
  verano: [0.15, 0.1, 0.15, 0],
  otono: [0.3, 0.25, 0.05, 0.02],
};

function season(month: number): keyof typeof SEASONS {
  if (month === 12 || month <= 2) return 'invierno';
  if (month <= 5) return 'primavera';
  if (month <= 8) return 'verano';
  return 'otono';
}

export function weatherFor(seed: number, date: string): Weather {
  const month = Number(date.slice(5, 7));
  const [nub, llu, tor, nie] = SEASONS[season(month)];
  const r = mulberry32(mixSeed(seed, hashString(`clima-${date}`)))();
  if (r < nie) return 'nieve';
  if (r < nie + tor) return 'tormenta';
  if (r < nie + tor + llu) return 'lluvia';
  if (r < nie + tor + llu + nub) return 'nublado';
  return 'despejado';
}

/** Cómo cambia la probabilidad de cada suceso con el clima. */
export function weatherWeight(eventId: string, w: Weather): number {
  const bad = w === 'tormenta' || w === 'nieve';
  if (eventId === 'desastre') return bad ? 2.5 : 1;
  if (eventId === 'emergencia') return w === 'nieve' ? 1.6 : 1;
  if (eventId === 'manifestacion' || eventId === 'protesta') return w === 'lluvia' || bad ? 0.5 : 1;
  return 1;
}

/** Repartir con mal tiempo cansa más, pero se cobra un plus. */
export function errandWeather(w: Weather): { extraPay: number; extraWear: number; note: string } {
  if (w === 'nieve') return { extraPay: 30, extraWear: 3, note: 'Plus por nieve.' };
  if (w === 'tormenta') return { extraPay: 25, extraWear: 3, note: 'Plus por tormenta.' };
  if (w === 'lluvia') return { extraPay: 15, extraWear: 1, note: 'Plus por lluvia.' };
  return { extraPay: 0, extraWear: 0, note: '' };
}
