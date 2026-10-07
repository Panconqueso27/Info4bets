import { hashString, mixSeed, mulberry32 } from './rng';
import type { Bars } from './types';

/**
 * Radio WNYC-80 (inventada): cada mañana anuncia trabajos extra para el
 * inmigrante. Son como el reparto: se hacen fuera del turno, una vez al día.
 */
export interface RadioJob {
  id: string;
  label: string;
  /** Lo que dice el locutor. */
  ad: string;
  hours: number;
  pay: number;
  wear: Bars;
}

const POOL: RadioJob[] = [
  { id: 'oficinas', label: 'Limpiar oficinas en Midtown', ad: '"Empresa de limpieza busca gente seria para el turno de noche en Midtown."', hours: 3, pay: 70, wear: { salud: -2, estres: 1 } },
  { id: 'puerto', label: 'Cargar camiones en el puerto', ad: '"¡Se necesitan brazos fuertes en el muelle 42! Pago en efectivo."', hours: 5, pay: 130, wear: { salud: -7, estres: 2 } },
  { id: 'ninos', label: 'Cuidar niños en el Upper East Side', ad: '"Familia del Upper East busca niñera de confianza por horas."', hours: 4, pay: 90, wear: { estres: 2, esperanza: 2 } },
  { id: 'pintar', label: 'Pintar un apartamento en Queens', ad: '"Pintor con experiencia para un piso de dos habitaciones. Material incluido."', hours: 6, pay: 150, wear: { salud: -4, estres: 2 } },
  { id: 'volantes', label: 'Repartir volantes en Times Square', ad: '"Discoteca nueva busca repartidores de volantes. Horario flexible."', hours: 2, pay: 35, wear: { estres: 1 } },
  { id: 'mudanza', label: 'Ayudar en una mudanza', ad: '"Mudanzas Brooklyn Bros: necesitamos un ayudante hoy mismo."', hours: 4, pay: 100, wear: { salud: -5, estres: 2 } },
  { id: 'cocina', label: 'Pinche de cocina en Little Italy', ad: '"Trattoria de Mulberry Street busca pinche para el servicio de cena."', hours: 5, pay: 110, wear: { salud: -3, estres: 3 } },
  { id: 'obra', label: 'Peón de obra en el Bronx', ad: '"Constructora busca peones para una obra en el Bronx. Se paga al día."', hours: 6, pay: 160, wear: { salud: -8, estres: 2 } },
  { id: 'traduccion', label: 'Traducir en una clínica', ad: '"Clínica del barrio busca voluntarios bilingües… con una pequeña ayuda."', hours: 3, pay: 60, wear: { estres: 1, reputacion: 3 } },
  { id: 'taxi', label: 'Lavar taxis en el garaje', ad: '"Garaje de taxis en la 11ª Avenida busca lavacoches para hoy."', hours: 4, pay: 85, wear: { salud: -3, estres: 1 } },
];

/** Los tres trabajos que anuncia la radio hoy. */
export function radioJobs(seed: number, date: string): RadioJob[] {
  const rand = mulberry32(mixSeed(seed, hashString(`radio-${date}`)));
  const pool = [...POOL];
  const out: RadioJob[] = [];
  while (out.length < 3 && pool.length) out.push(pool.splice(Math.floor(rand() * pool.length), 1)[0]);
  return out;
}

export const RADIO_BY_ID = Object.fromEntries(POOL.map((j) => [j.id, j])) as Record<string, RadioJob>;

/** Dónde se hace cada trabajo de la radio: un lugar ("place:id") o una manzana ("block:c,r"). */
export const RADIO_PLACE: Record<string, string> = {
  oficinas: 'place:bolsa',
  puerto: 'block:4,6',
  ninos: 'block:6,3',
  pintar: 'block:7,3',
  volantes: 'place:plaza',
  mudanza: 'block:5,5',
  cocina: 'place:pizza',
  obra: 'block:7,1',
  traduccion: 'block:0,4',
  taxi: 'block:3,8',
};
