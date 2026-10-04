import { advance, applyBars, dayNumber, log, pay, withCat } from './game';
import { countMission, weekday } from './economy';
import { hashString, mixSeed, mulberry32 } from './rng';
import { ROLES } from './roles';
import type { GameState } from './types';

/**
 * Concursos de la Nueva York de los 80: se juegan como minijuegos contra
 * rivales del barrio. Inscripción, puesto y premio. Dificultad media-alta:
 * el campeón del barrio exige jugar muy bien.
 */
export interface ContestDef {
  id: string;
  label: string;
  icon: string;
  /** Lugar del mapa donde se celebra (el personaje va allí y entra). */
  place: string;
  where: string;
  /** Días de la semana (0 = domingo). */
  days: number[];
  /** Inscripción y premios (1º, 2º, 3º) en dólares; el alcalde ×1000. */
  fee: number;
  prizes: [number, number, number];
  /** Puntuaciones de los rivales: media y dispersión. */
  rival: { mean: number; spread: number; top: number };
  unit: string;
  description: string;
  rivals: string[];
  /** Decimales de la puntuación. */
  decimals?: number;
}

export const CONTESTS: ContestDef[] = [
  {
    id: 'breakdance',
    label: 'Batalla de breakdance',
    icon: 'estrella',
    place: 'plaza',
    where: 'Times Square',
    days: [5, 6],
    fee: 10,
    prizes: [220, 70, 20],
    rival: { mean: 88, spread: 14, top: 108 },
    unit: 'puntos',
    description: 'Cartón en el suelo, un radiocasete gigante y el público haciendo corro. Pulsa al ritmo de las flechas.',
    rivals: ['Crazy Legs', 'Lil Rocco', 'B-Boy Tito', 'Lady Spin', 'Kid Freeze'],
  },
  {
    id: 'perritos',
    label: 'Concurso de comer perritos',
    icon: 'perrito',
    place: 'coney',
    where: 'Coney Island',
    days: [0],
    fee: 5,
    prizes: [180, 60, 15],
    rival: { mean: 7.2, spread: 1.1, top: 9.1 },
    unit: 'perritos',
    decimals: 1,
    description: 'El clásico de Nathan’s. Muerde y traga alternando, pero sin atragantarte.',
    rivals: ['Big Sal', 'Hambre Hernández', 'Tommy Tragón', 'La Aspiradora', 'Joe Bocazas'],
  },
  {
    id: 'simon',
    label: 'Torneo de Simon',
    icon: 'boleto',
    place: 'hotel',
    where: 'la sala recreativa de la calle 42',
    days: [2, 4, 6],
    fee: 5,
    prizes: [150, 50, 12],
    rival: { mean: 10, spread: 2, top: 13 },
    unit: 'rondas',
    description: 'El juego electrónico de moda: repite la secuencia de colores. Cada ronda, una nota más y más rápido.',
    rivals: ['Marty el Cerebro', 'Gina Memoria', 'Nerd de Queens', 'Ray Teclas', 'Doc Electrónico'],
  },
  {
    id: 'maraton',
    label: 'Maratón de Nueva York',
    icon: 'reloj',
    place: 'parque',
    where: 'el parque',
    days: [0, 3],
    fee: 10,
    prizes: [260, 80, 25],
    rival: { mean: 36.5, spread: 2.4, top: 40.8 },
    unit: 'km',
    decimals: 1,
    description: 'Mantén el ritmo en la zona verde: si te pasas, te quedas sin aire.',
    rivals: ['Grete la Noruega', 'Bill del Bronx', 'Alberto Fuego', 'Rosie Rápida', 'Frank Zancadas'],
  },
];
export const CONTEST_BY_ID = Object.fromEntries(CONTESTS.map((c) => [c.id, c])) as Record<string, ContestDef>;

const K = (s: GameState) => (s.character.role === 'alcalde' ? 1000 : 1);
export const contestFee = (s: GameState, c: ContestDef) => c.fee * K(s);
export const contestPrizes = (s: GameState, c: ContestDef) => c.prizes.map((p) => p * K(s) * (c.id === 'perritos' && isJuly4(s) ? 3 : 1)) as [number, number, number];
const isJuly4 = (s: GameState) => s.today.date.slice(5) === '07-04';

/** ¿Hay concurso hoy? (el 4 de julio, el de perritos siempre). */
export function contestOpen(s: GameState, c: ContestDef) {
  return c.days.includes(weekday(s.today.date)) || (c.id === 'perritos' && isJuly4(s));
}

const DAY_NAMES = ['domingos', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábados'];
export function contestDays(c: ContestDef) {
  return c.days.map((d) => DAY_NAMES[d]).join(', ').replace(/, ([^,]*)$/, ' y $1');
}

export function canEnterContest(s: GameState, id: string, now: number): string | null {
  const c = CONTEST_BY_ID[id];
  if (!contestOpen(s, c)) return `Solo los ${contestDays(c)}`;
  if (s.gameOver) return 'Partida terminada';
  if (s.shift && !s.shift.cancelled && now < s.shift.endsAt) return 'Estás en tu jornada';
  if (s.errand) return 'Estás en otro trabajo';
  if (s.detainedUntil > now) return 'Estás detenido';
  if (s.flags[`concurso_${id}`] === dayNumber(s, now)) return 'Ya participaste hoy';
  if ((s.bars.dinero ?? 0) < contestFee(s, c)) return 'No te llega para la inscripción';
  return null;
}

/** Rivales de hoy y sus puntuaciones (deterministas por fecha). */
export function contestRivals(s: GameState, id: string): { name: string; score: number }[] {
  const c = CONTEST_BY_ID[id];
  const rand = mulberry32(mixSeed(s.seed, hashString(`${id}-${s.today.date}`)));
  const names = [...c.rivals].sort(() => rand() - 0.5).slice(0, 4);
  const round = (x: number) => (c.decimals ? Math.round(x * 10) / 10 : Math.round(x));
  return names
    .map((name, i) => {
      // Siempre hay un favorito que roza el récord del barrio.
      const base = i === 0 ? c.rival.top - rand() * c.rival.spread * 0.6 : c.rival.mean + (rand() + rand() - 1) * c.rival.spread * 1.4;
      return { name, score: round(Math.max(0, base)) };
    })
    .sort((a, b) => b.score - a.score);
}

/** Paga la inscripción y marca la participación de hoy. */
export function enterContest(s: GameState, id: string, now: number) {
  advance(s, now);
  const why = canEnterContest(s, id, now);
  if (why) throw new Error(why);
  const c = CONTEST_BY_ID[id];
  pay(s, contestFee(s, c));
  if (s.ledger) {
    s.ledger.cats.inversiones = (s.ledger.cats.inversiones ?? 0) + contestFee(s, c);
    s.ledger.cats.concursos = (s.ledger.cats.concursos ?? 0) - contestFee(s, c);
  }
  s.flags[`concurso_${id}`] = dayNumber(s, now);
}

export interface ContestResult {
  place: number;
  prize: number;
  table: { name: string; score: number; you?: boolean }[];
}

/** Resultado: puesto entre los rivales y premio. */
export function finishContest(s: GameState, id: string, score: number, now: number): ContestResult {
  const c = CONTEST_BY_ID[id];
  const round = (x: number) => (c.decimals ? Math.round(x * 10) / 10 : Math.round(x));
  const you = { name: s.character.name, score: round(score), you: true };
  // En caso de empate, gana el rival (el público es del barrio).
  const table: { name: string; score: number; you?: boolean }[] = [...contestRivals(s, id), you].sort((a, b) => b.score - a.score || ((a as { you?: boolean }).you ? 1 : -1));
  const place = table.indexOf(you) + 1;
  const prize = place <= 3 ? contestPrizes(s, c)[place - 1] : 0;
  const fmt = ROLES[s.character.role].formatMoney;
  const deltas = withCat('concursos', () => applyBars(s, { dinero: prize, estres: place === 1 ? -6 : place <= 3 ? -2 : 3, ...(s.character.role === 'inmigrante' ? { reputacion: place === 1 ? 4 : 0 } : { popularidad: place === 1 ? 3 : 0 }) }));
  countMission(s, 'actividad', 1);
  if (place === 1) {
    s.flags.concursosGanados = Number(s.flags.concursosGanados ?? 0) + 1;
    s.notices.push({ kind: 'racha', title: '¡CAMPEÓN!', text: `🏆 Ganas el ${c.label.toLowerCase()}: +${fmt(prize)}` });
  }
  log(s, now, place <= 3 ? 'bueno' : 'malo', c.label, `Quedas ${place}º de ${table.length} con ${you.score} ${c.unit}.${prize ? ` Premio: ${fmt(prize)}.` : ' Sin premio esta vez.'} Ganó ${table[0].you ? 'tú' : table[0].name} (${table[0].score}).`, deltas);
  return { place, prize, table };
}

/** Se retira antes de empezar: le devuelven la inscripción. */
export function withdrawContest(s: GameState, id: string) {
  const c = CONTEST_BY_ID[id];
  if (!s.flags[`concurso_${id}`]) return;
  delete s.flags[`concurso_${id}`];
  withCat('concursos', () => applyBars(s, { dinero: contestFee(s, c) }));
  if (s.ledger) s.ledger.cats.inversiones = (s.ledger.cats.inversiones ?? 0) - contestFee(s, c);
}
