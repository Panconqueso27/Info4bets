import { advance, applyBars, dayNumber, log, pay, todayWeather, weekOf, withCat, type LogFn } from './game';
import { auctionPrice, BIZ_BY_ID, CIVIC_BY_ID, districtLevel, LOT_BY_ID, lotLevel, MEGA_BY_ID, ownedLots } from './lots';
import { hashString, mixSeed, mulberry32 } from './rng';
import { ROLES } from './roles';
import { DAY, HOUR, startOfDay } from './time';
import type { GameState, Mission, Role } from './types';

/**
 * Economía de la ciudad fuera del trabajo: misiones diarias, actividades
 * que dan dinero, apuestas, lotería, bonos, impuestos y el libro de cuentas.
 */

const fmtOf = (s: GameState) => ROLES[s.character.role].formatMoney;
/** Escala de dinero: el alcalde maneja miles. */
const K = (s: GameState) => (s.character.role === 'alcalde' ? 1000 : 1);
export const weekday = (date: string) => new Date(startOfDay(date)).getDay();
const isWeekend = (date: string) => [0, 6].includes(weekday(date));

function busy(state: GameState, now: number): string | null {
  if (state.gameOver) return 'Partida terminada';
  if (state.shift && !state.shift.cancelled && now < state.shift.endsAt) return 'Estás en tu jornada';
  if (state.errand) return 'Ya estás en otro trabajo';
  if (state.detainedUntil > now) return 'Estás detenido';
  return null;
}

/** Marca de "hecho hoy" para actividades de una vez al día. */
const doneToday = (state: GameState, key: string, now: number) => state.flags[key] === dayNumber(state, now);
const markToday = (state: GameState, key: string, now: number) => (state.flags[key] = dayNumber(state, now));

// ---------------------------------------------------------------------------
// Misiones diarias
// ---------------------------------------------------------------------------

interface MissionDef {
  id: string;
  key: string;
  label: (t: string) => string;
  target: number;
  /** Recompensa en unidades del rol (el alcalde ×1000). */
  reward: number;
  /** Solo para este rol. */
  role?: Role;
}

const MISSIONS: MissionDef[] = [
  { id: 'jornada', key: 'jornada', label: () => 'Termina tu jornada y cobra', target: 1, reward: 15 },
  { id: 'mini15', key: 'minijuego', label: () => 'Consigue 15 aciertos en minijuegos', target: 15, reward: 25 },
  { id: 'mini30', key: 'minijuego', label: () => 'Consigue 30 aciertos en minijuegos', target: 30, reward: 40 },
  { id: 'extra', key: 'extra', label: () => 'Haz un trabajo fuera de la jornada', target: 1, reward: 20, role: 'inmigrante' },
  { id: 'ganar', key: 'ganar', label: (t) => `Gana ${t} hoy`, target: 250, reward: 30 },
  { id: 'suceso3', key: 'suceso', label: () => 'Resuelve 3 sucesos', target: 3, reward: 15 },
  { id: 'bolsa', key: 'bolsa', label: () => 'Gana una apuesta en la bolsa', target: 1, reward: 25 },
  { id: 'construir', key: 'construir', label: () => 'Construye, compra o mejora algo', target: 1, reward: 30 },
  { id: 'apuesta', key: 'apuesta', label: () => 'Juega a la lotería o apuesta en el hipódromo', target: 1, reward: 10 },
  { id: 'actividad', key: 'actividad', label: () => 'Haz una actividad de la ciudad (🎯 Extras)', target: 1, reward: 20 },
];

/** Crea las 3 misiones del día (al empezar cada día). */
export function ensureMissions(state: GameState) {
  const date = state.today.date;
  if (state.missions?.date === date) return;
  const role = state.character.role;
  const rand = mulberry32(mixSeed(state.seed, hashString(`mis-${date}`)));
  const pool = MISSIONS.filter((m) => !m.role || m.role === role);
  const list: Mission[] = [];
  const usedKeys = new Set<string>();
  while (list.length < 3 && pool.length) {
    const m = pool.splice(Math.floor(rand() * pool.length), 1)[0];
    if (usedKeys.has(m.key)) continue;
    usedKeys.add(m.key);
    const k = role === 'alcalde' ? 1000 : 1;
    const target = m.key === 'ganar' ? m.target * (role === 'alcalde' ? 400 : 1) : m.target;
    list.push({ id: m.id, key: m.key, label: m.label(ROLES[role].formatMoney(target)), target, reward: m.reward * k, progress: 0, done: false });
  }
  state.missions = { date, list };
}

/** Suma progreso a las misiones del día con esa clave; paga las completadas. */
export function countMission(state: GameState, key: string, n: number) {
  const ms = state.missions;
  if (!ms || ms.date !== state.today.date || n <= 0) return;
  for (const m of ms.list) {
    if (m.done || m.key !== key) continue;
    m.progress = Math.min(m.target, m.progress + n);
    if (m.progress < m.target) continue;
    m.done = true;
    withCat('premios', () => applyBars(state, { dinero: m.reward }));
    state.notices.push({ kind: 'aviso', title: 'MISIÓN CUMPLIDA', text: `🎯 ${m.label}: +${fmtOf(state)(m.reward)}` });
    if (ms.list.every((x) => x.done)) {
      const bonus = 25 * K(state);
      withCat('premios', () => applyBars(state, { dinero: bonus }));
      state.notices.push({ kind: 'racha', title: 'MISIONES DEL DÍA', text: `¡Las 3 cumplidas! Bonus +${fmtOf(state)(bonus)}` });
      state.flags.misionesCompletas = Number(state.flags.misionesCompletas ?? 0) + 1;
    }
  }
}

// ---------------------------------------------------------------------------
// Inmigrante: taxi, clases, puesto de perritos y rastro
// ---------------------------------------------------------------------------

export const TAXI_HOURS = 2;
export const TAXI_PAY = 90;
export const CLASS_PAY = 35;
export const HOTDOG_PER_POINT = 4;

export function taxiPay(state: GameState, now: number) {
  const h = new Date(now).getHours();
  const night = h >= 20 || h < 5;
  const w = todayWeather(state);
  const rain = w === 'lluvia' || w === 'tormenta' ? 1.5 : w === 'nieve' ? 1.3 : 1;
  return { pay: Math.round(TAXI_PAY * (night ? 1.3 : 1) * rain), night, rain: rain > 1 };
}

export function canTaxi(state: GameState, now: number): string | null {
  if (state.character.role !== 'inmigrante') return 'Solo para el inmigrante';
  if (!state.flags.auto) return 'Necesitas un auto (⬆ Mejora)';
  if (doneToday(state, 'taxiDia', now)) return 'Hoy ya hiciste el taxi';
  return busy(state, now);
}

export function startTaxi(state: GameState, now: number) {
  advance(state, now);
  const why = canTaxi(state, now);
  if (why) throw new Error(why);
  const t = taxiPay(state, now);
  state.errand = { startedAt: now, endsAt: now + TAXI_HOURS * HOUR, kind: 'taxi', label: 'Carreras de taxi por la ciudad', pay: t.pay, wear: { estres: 2, salud: -1 } };
  markToday(state, 'taxiDia', now);
  countMission(state, 'actividad', 1);
  log(state, now, 'info', 'Taxi', `${state.character.name} pone el cartel de LIBRE en el parabrisas (${TAXI_HOURS} h${t.night ? ', tarifa nocturna' : ''}${t.rain ? ', con lluvia todos quieren taxi' : ''}).`);
}

export function canTeach(state: GameState, now: number): string | null {
  if (state.character.role !== 'inmigrante') return 'Solo para el inmigrante';
  if (doneToday(state, 'clasesDia', now)) return 'Hoy ya diste clase';
  return busy(state, now);
}

export function startClasses(state: GameState, now: number) {
  advance(state, now);
  const why = canTeach(state, now);
  if (why) throw new Error(why);
  state.errand = { startedAt: now, endsAt: now + HOUR, kind: 'clases', label: 'Clase de español a los vecinos', pay: CLASS_PAY, wear: { reputacion: 2, esperanza: 1 } };
  markToday(state, 'clasesDia', now);
  countMission(state, 'actividad', 1);
  log(state, now, 'info', 'Clases', `${state.character.name} reúne a cuatro vecinos en la cocina con una pizarra y mucha paciencia.`);
}

export function canHotdogs(state: GameState, now: number): string | null {
  if (state.character.role !== 'inmigrante') return 'Solo para el inmigrante';
  if (doneToday(state, 'perritosDia', now)) return 'Hoy ya abriste el puesto';
  return busy(state, now);
}

/** Resultado del puesto de perritos (minijuego): cada perrito bien servido da dinero. */
export function applyHotdogs(state: GameState, points: number, now: number) {
  advance(state, now);
  const why = canHotdogs(state, now);
  if (why) throw new Error(why);
  const n = Math.max(0, Math.min(60, Math.floor(points)));
  const money = n * HOTDOG_PER_POINT;
  markToday(state, 'perritosDia', now);
  const deltas = withCat('extras', () => applyBars(state, { dinero: money, estres: 1 }));
  countMission(state, 'actividad', 1);
  countMission(state, 'extra', 1);
  log(state, now, money ? 'bueno' : 'info', 'Puesto de perritos', `Vendes ${n} perrito${n === 1 ? '' : 's'} calientes en la esquina: ${fmtOf(state)(money)} en la caja.`, deltas);
}

export interface RastroItem {
  id: string;
  label: string;
  price: number;
  /** Multiplicador de reventa (oculto hasta comprar). */
  resale: number;
}

const RASTRO: [string, number][] = [
  ['Radio de válvulas', 30],
  ['Chaqueta de cuero', 25],
  ['Discos de vinilo', 15],
  ['Bicicleta oxidada', 40],
  ['Cámara de fotos', 50],
  ['Lámpara art déco', 35],
  ['Máquina de escribir', 45],
  ['Cromos de béisbol', 20],
  ['Reloj de bolsillo', 60],
  ['Tostadora cromada', 18],
];

/** El rastro solo abre los domingos. */
export const rastroOpen = (state: GameState) => weekday(state.today.date) === 0;

export function rastroItems(state: GameState): RastroItem[] {
  const rand = mulberry32(mixSeed(state.seed, hashString(`rastro-${state.today.date}`)));
  const pool = [...RASTRO];
  const out: RastroItem[] = [];
  while (out.length < 4) {
    const [label, base] = pool.splice(Math.floor(rand() * pool.length), 1)[0];
    const price = Math.round(base * (0.7 + rand() * 0.6));
    // A veces una ganga, a veces un chasco
    const resale = rand() < 0.62 ? 1.3 + rand() * 1.4 : 0.3 + rand() * 0.6;
    out.push({ id: label, label, price, resale });
  }
  return out;
}

export function canRastro(state: GameState, now: number): string | null {
  if (state.character.role !== 'inmigrante') return 'Solo para el inmigrante';
  if (!rastroOpen(state)) return 'El rastro abre los domingos';
  if (Number(state.flags.rastroCompras ?? 0) >= 2 && state.flags.rastroDia === dayNumber(state, now)) return 'Ya compraste 2 cosas hoy';
  return null;
}

/** Compra algo en el rastro y lo revende al momento. */
export function buyRastro(state: GameState, id: string, now: number) {
  advance(state, now);
  const why = canRastro(state, now);
  if (why) throw new Error(why);
  const items = rastroItems(state);
  const idx = items.findIndex((i) => i.id === id);
  const item = items[idx];
  if (!item) throw new Error('Ya no está a la venta.');
  if (state.flags.rastroDia !== dayNumber(state, now)) {
    state.flags.rastroDia = dayNumber(state, now);
    state.flags.rastroCompras = 0;
    state.flags.rastroVisto = 0;
  }
  if (Number(state.flags.rastroVisto ?? 0) & (1 << idx)) throw new Error('Eso ya lo compraste.');
  pay(state, item.price);
  const sale = Math.round(item.price * item.resale);
  withCat('extras', () => applyBars(state, { dinero: sale }));
  state.flags.rastroCompras = Number(state.flags.rastroCompras ?? 0) + 1;
  state.flags.rastroVisto = Number(state.flags.rastroVisto ?? 0) | (1 << idx);
  countMission(state, 'actividad', 1);
  const net = sale - item.price;
  log(state, now, net >= 0 ? 'bueno' : 'malo', 'Rastro del domingo', `${item.label}: lo compras por ${fmtOf(state)(item.price)} y lo revendes por ${fmtOf(state)(sale)}. ${net >= 0 ? '¡Buen ojo!' : 'Te la colaron.'}`, { dinero: net });
  return { sale, net };
}

// ---------------------------------------------------------------------------
// Alcalde: bonos municipales y subasta de solares
// ---------------------------------------------------------------------------

export const BOND_TERMS = [
  { days: 3, rate: 0.05 },
  { days: 7, rate: 0.14 },
];
export const MAX_BONDS = 3;

export function buyBond(state: GameState, amount: number, days: number, now: number) {
  advance(state, now);
  if (state.character.role !== 'alcalde') throw new Error('Solo el alcalde emite bonos.');
  const term = BOND_TERMS.find((t) => t.days === days);
  if (!term) throw new Error('Plazo no válido.');
  if ((state.bonds ?? []).length >= MAX_BONDS) throw new Error(`Máximo ${MAX_BONDS} bonos a la vez.`);
  pay(state, amount);
  (state.bonds ??= []).push({ amount, rate: term.rate, until: now + days * DAY });
  countMission(state, 'actividad', 1);
  log(state, now, 'info', 'Bonos municipales', `Inviertes ${fmtOf(state)(amount)} a ${days} días al ${Math.round(term.rate * 100)}%.`);
}

/** Paga los bonos vencidos. */
export function matureBonds(state: GameState, now: number): boolean {
  const due = (state.bonds ?? []).filter((b) => b.until <= now);
  if (!due.length) return false;
  state.bonds = state.bonds!.filter((b) => b.until > now);
  for (const b of due) {
    const back = Math.round(b.amount * (1 + b.rate));
    const deltas = withCat('extras', () => applyBars(state, { dinero: back }));
    log(state, b.until, 'bueno', 'Bonos vencidos', `Tus bonos devuelven ${fmtOf(state)(back)} (${fmtOf(state)(back - b.amount)} de intereses).`, deltas);
  }
  return true;
}

export function auctionLot(state: GameState, lotId: string, now: number) {
  advance(state, now);
  if (state.character.role !== 'alcalde') throw new Error('Solo el alcalde subasta solares.');
  if (state.lots?.[lotId]) throw new Error('Ese solar no está libre.');
  const def = LOT_BY_ID[lotId];
  const price = auctionPrice(def, districtLevel(state, def.district, dayNumber(state, now)));
  (state.lots ??= {})[lotId] = { owner: 'privado', building: 'oficinas', phase: 1, buildingUntil: 0, level: 1 };
  const deltas = withCat('extras', () => applyBars(state, { dinero: price, control: -2 }));
  countMission(state, 'actividad', 1);
  log(state, now, 'info', 'Subasta', `${def.label} se adjudica a Hudson Developments por ${fmtOf(state)(price)}. Levantarán oficinas.`, deltas);
}

// ---------------------------------------------------------------------------
// Los dos: hipódromo, béisbol y lotería
// ---------------------------------------------------------------------------

export const HORSES = [
  { name: 'Relámpago', odds: 2, color: '#e8414f' },
  { name: 'Señor Bronx', odds: 3, color: '#2f6fb3' },
  { name: 'Brisa de Coney', odds: 5, color: '#ffcc33' },
  { name: 'Tío Sam', odds: 8, color: '#3fbf6a' },
  { name: 'La Ruina', odds: 14, color: '#7b4fa0' },
];
export const MAX_RACES = 3;
export const betStakes = (s: GameState) => [5, 10, 25, 50].map((x) => x * K(s));

/** Apuestas solo los fines de semana. */
export const racesOpen = (state: GameState) => isWeekend(state.today.date);

export function canRace(state: GameState, now: number): string | null {
  if (!racesOpen(state)) return 'El hipódromo abre el fin de semana';
  if (state.flags.carrerasDia === dayNumber(state, now) && Number(state.flags.carreras ?? 0) >= MAX_RACES) return `Máximo ${MAX_RACES} carreras al día`;
  return null;
}

/** Corre una carrera: devuelve el orden de llegada (índices de caballo) y lo ganado. */
export function betRace(state: GameState, horse: number, stake: number, now: number) {
  advance(state, now);
  const why = canRace(state, now);
  if (why) throw new Error(why);
  if (state.flags.carrerasDia !== dayNumber(state, now)) {
    state.flags.carrerasDia = dayNumber(state, now);
    state.flags.carreras = 0;
  }
  pay(state, stake);
  state.flags.carreras = Number(state.flags.carreras) + 1;
  const rand = mulberry32(mixSeed(state.seed, now));
  // Probabilidad de ganar ≈ 0.88 / cuota (margen de la casa)
  const weights = HORSES.map((h) => 0.88 / h.odds);
  const total = weights.reduce((a, b) => a + b, 0);
  let roll = rand() * total;
  let winner = HORSES.length - 1;
  for (let i = 0; i < weights.length; i++) {
    roll -= weights[i];
    if (roll <= 0) {
      winner = i;
      break;
    }
  }
  const rest = HORSES.map((_, i) => i).filter((i) => i !== winner).sort(() => rand() - 0.5);
  const order = [winner, ...rest];
  const won = winner === horse ? stake * HORSES[horse].odds : 0;
  if (won) withCat('apuestas', () => applyBars(state, { dinero: won }));
  withCat('apuestas', () => {
    // el importe apostado se apunta como apuesta, no como inversión
    if (state.ledger) {
      state.ledger.cats.inversiones = (state.ledger.cats.inversiones ?? 0) + stake;
      state.ledger.cats.apuestas = (state.ledger.cats.apuestas ?? 0) - stake;
    }
  });
  countMission(state, 'apuesta', 1);
  log(state, now, won ? 'bueno' : 'malo', 'Hipódromo', `Apuestas ${fmtOf(state)(stake)} por ${HORSES[horse].name}. Gana ${HORSES[winner].name}. ${won ? `¡Cobras ${fmtOf(state)(won)}!` : 'Otra vez será.'}`, { dinero: won - stake });
  return { order, won };
}

/** Partido de béisbol del día (fin de semana): Yankees contra Mets. */
export function baseballGame(state: GameState) {
  const rand = mulberry32(mixSeed(state.seed, hashString(`beisbol-${state.today.date}`)));
  const yankees = Math.floor(rand() * 9);
  let mets = Math.floor(rand() * 9);
  if (mets === yankees) mets += 1;
  return { yankees, mets, winner: yankees > mets ? 'yankees' : 'mets' } as const;
}

export function canBaseball(state: GameState, now: number): string | null {
  if (!racesOpen(state)) return 'Solo hay partido el fin de semana';
  if (doneToday(state, 'beisbolDia', now)) return 'Ya apostaste en el partido de hoy';
  return null;
}

export function betBaseball(state: GameState, team: 'yankees' | 'mets', stake: number, now: number) {
  advance(state, now);
  const why = canBaseball(state, now);
  if (why) throw new Error(why);
  pay(state, stake);
  markToday(state, 'beisbolDia', now);
  const g = baseballGame(state);
  const won = g.winner === team ? Math.round(stake * 1.9) : 0;
  if (won) withCat('apuestas', () => applyBars(state, { dinero: won }));
  if (state.ledger) {
    state.ledger.cats.inversiones = (state.ledger.cats.inversiones ?? 0) + stake;
    state.ledger.cats.apuestas = (state.ledger.cats.apuestas ?? 0) - stake;
  }
  countMission(state, 'apuesta', 1);
  log(state, now, won ? 'bueno' : 'malo', 'Béisbol', `Yankees ${g.yankees} - Mets ${g.mets}. ${won ? `Acertaste: cobras ${fmtOf(state)(won)}.` : 'Perdiste la apuesta.'}`, { dinero: won - stake });
  return { ...g, won };
}

export const ticketPrice = (s: GameState) => 2 * K(s);
export const MAX_TICKETS = 5;

export function buyTicket(state: GameState, numbers: [number, number, number], now: number) {
  advance(state, now);
  const week = weekOf(state);
  const mine = (state.lottery ?? []).filter((t) => t.week === week);
  if (mine.length >= MAX_TICKETS) throw new Error(`Máximo ${MAX_TICKETS} boletos por semana.`);
  if (numbers.some((n) => !Number.isInteger(n) || n < 0 || n > 9)) throw new Error('Elige tres números del 0 al 9.');
  pay(state, ticketPrice(state));
  if (state.ledger) {
    state.ledger.cats.inversiones = (state.ledger.cats.inversiones ?? 0) + ticketPrice(state);
    state.ledger.cats.apuestas = (state.ledger.cats.apuestas ?? 0) - ticketPrice(state);
  }
  (state.lottery ??= []).push({ week, numbers });
  countMission(state, 'apuesta', 1);
}

/** Números ganadores de una semana. */
export function lotteryDraw(state: GameState, week: number): [number, number, number] {
  const rand = mulberry32(mixSeed(state.seed, hashString(`loteria-${week}`)));
  return [0, 0, 0].map(() => Math.floor(rand() * 10)) as [number, number, number];
}

/** Aciertos en su posición: 3 → ×500, 2 → ×10. */
export function lotteryPrize(state: GameState, numbers: number[], draw: number[]) {
  const hits = numbers.filter((n, i) => n === draw[i]).length;
  return { hits, prize: hits === 3 ? ticketPrice(state) * 500 : hits === 2 ? ticketPrice(state) * 10 : 0 };
}

// ---------------------------------------------------------------------------
// Cierres: semana (cuentas y lotería) y mes (impuestos y alquiler)
// ---------------------------------------------------------------------------

export const CAT_LABEL: Record<string, string> = {
  sueldo: '💼 Sueldo',
  negocios: '🏪 Negocios y alquileres',
  extras: '🎯 Trabajos y actividades',
  bolsa: '📈 Bolsa',
  apuestas: '🎲 Apuestas y lotería',
  sucesos: '⚡ Sucesos',
  premios: '🏆 Premios y misiones',
  concursos: '🥇 Concursos',
  inversiones: '🏗 Compras e inversiones',
  gastos: '🏠 Gastos del día a día',
  impuestos: '🧾 Impuestos',
  otros: '· Otros',
};

/** Cierre de semana: sorteo de la lotería y resumen de cuentas. */
export function closeWeek(state: GameState, day: number, entry: LogFn) {
  if (day % 7 !== 0) return;
  const week = Math.floor((day - 1) / 7);
  // Lotería
  const draw = lotteryDraw(state, week);
  const tickets = (state.lottery ?? []).filter((t) => t.week === week);
  if (tickets.length) {
    let total = 0;
    let best = 0;
    for (const t of tickets) {
      const p = lotteryPrize(state, t.numbers, draw);
      total += p.prize;
      best = Math.max(best, p.hits);
    }
    const fmt = fmtOf(state);
    const deltas = total ? withCat('apuestas', () => applyBars(state, { dinero: total })) : undefined;
    entry(total ? 'bueno' : 'info', 'Sorteo de la lotería', `Números ganadores: ${draw.join(' · ')}. ${total ? `¡Premio! Cobras ${fmt(total)}.` : best ? `Acertaste ${best} número${best > 1 ? 's' : ''}, sin premio.` : 'Ni un número. La semana que viene.'}`, deltas);
    if (total) state.notices.push({ kind: 'racha', title: 'LOTERÍA', text: `🎟 ¡Premio de ${fmt(total)}!` });
  }
  state.lottery = (state.lottery ?? []).filter((t) => t.week > week);
  // Libro de cuentas
  if (state.ledger && state.ledger.week === week) {
    state.lastLedger = state.ledger;
    const net = Object.values(state.ledger.cats).reduce((a, b) => a + b, 0);
    state.notices.push({ kind: 'aviso', title: 'CUENTAS DE LA SEMANA', text: `Semana ${week + 1}: ${net >= 0 ? '+' : ''}${fmtOf(state)(net)}. Míralo en 🏗 Propiedades.` });
  }
}

/** Facturas del mes: suben los alquileres y llegan los impuestos. */
export function monthlyBills(state: GameState, day: number, entry: LogFn) {
  if (day % 30 !== 0) return;
  const fmt = fmtOf(state);
  const parts: string[] = [];
  let tax = 0;
  if (state.character.role === 'inmigrante') {
    const before = Number(state.flags.alquilerExtra ?? 0);
    if (before < 30) {
      state.flags.alquilerExtra = before + 5;
      parts.push(`tu casero sube el alquiler ${fmt(5)} al día`);
    }
    for (const id of ownedLots(state)) tax += 10 + 8 * lotLevel(state.lots![id]);
    tax += 6 * (state.vending?.count ?? 0);
    if (tax) parts.push(`impuesto municipal sobre tus propiedades y licencias ${fmt(tax)}`);
  } else {
    for (const lot of Object.values(state.lots ?? {})) {
      if (lot.owner !== 'ciudad' || lot.phase === 0) continue;
      tax += Math.round(CIVIC_BY_ID[lot.building].cost * 0.03 * lotLevel(lot));
    }
    for (const [id, p] of Object.entries(state.projects ?? {})) if (p.done) tax += Math.round(MEGA_BY_ID[id].cost * 0.015);
    if (tax) parts.push(`mantenimiento de obras públicas ${fmt(tax)}`);
  }
  if (!parts.length) return;
  const deltas = tax ? withCat('impuestos', () => applyBars(state, { dinero: -tax })) : undefined;
  entry('malo', 'Facturas del mes', `Día ${day}: ${parts.join(' y ')}.`, deltas);
}

/** Nombre del negocio (para la interfaz). */
export function lotTitle(state: GameState, id: string) {
  const lot = state.lots?.[id];
  if (!lot) return LOT_BY_ID[id].label;
  if (lot.owner === 'privado') return 'Oficinas Hudson';
  if (lot.owner === 'ciudad') return CIVIC_BY_ID[lot.building].levels[Math.max(0, lotLevel(lot) - 1)];
  if (lot.building === 'vacio') return 'Solar sin construir';
  const def = BIZ_BY_ID[lot.building];
  const lvl = lotLevel(lot);
  return lvl ? def.levels[lvl - 1].name : `${def.label} (en obras)`;
}

/** ¿Ya compraste este objeto del rastro hoy? */
export function rastroBought(state: GameState, now: number, idx: number) {
  return state.flags.rastroDia === dayNumber(state, now) && !!(Number(state.flags.rastroVisto ?? 0) & (1 << idx));
}
