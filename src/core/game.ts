import { ACHIEVEMENT_BY_ID, achievementsFor, BIG_BET, FINAL_TEXT, MONEY_FLOOR } from './achievements';
import { EVENTS, eventsFor } from './events/catalog';
import type { ChoiceDef, Effects, EventDef, OutcomeDef } from './events/types';
import { betReturn, closePrices, dayPlan, initialPrices, priceAt, type NewsItem } from './market';
import { ROLES, SHIFT_HOURS } from './roles';
import { hashString, mixSeed, mulberry32, pickWeighted, randRange } from './rng';
import { addDays, dateKey, DAY, daysBetween, HOUR, startOfDay } from './time';
import { nextUpgrade, UPGRADES } from './upgrades';
import { errandWeather, weatherFor, weatherWeight, type Weather } from './weather';
import { CIVIC_BY_ID, HOUSE_PHASES, HOUSE_RENT, LOT_BY_ID, LOT_PRICE, ownedLot, RENOVATION } from './lots';
import { RADIO_BY_ID, radioJobs } from './radio';
import type { BarId, Bars, Character, GameState, LogEntry, LogKind, OtherCharacter, PendingEvent, Role } from './types';
import { ACHIEVEMENT_UNLOCKS, COSMETIC_BY_ID, STREAK_REWARDS } from './cosmetics';
import { NPC_EFFECTS, NPCS, rememberNpc } from './npcs';

const LOG_LIMIT = 120;
/** Si el jugador vuelve tras mucho tiempo, no simulamos más de un año de días perdidos. */
const MAX_DAYS_TO_CATCH_UP = 366;

/** Huecos de la jornada donde puede aparecer un suceso (horas desde el inicio). */
const EVENT_WINDOWS: Array<[number, number]> = [
  [0.75, 2.5],
  [3, 5],
  [5.5, 7.5],
];
const EVENT_WINDOW_CHANCE = 0.45;
/** El suceso de apertura llega entre 20 s y 2 min después de empezar la jornada. */
const OPENING_WINDOW: [number, number] = [20_000, 110_000];
export const MAX_BETS_PER_SHIFT = 3;

export const STAKES: Record<Role, number[]> = {
  inmigrante: [20, 50, 100, 300],
  alcalde: [10_000, 50_000, 100_000, 250_000],
};

/** Coste de que la salud llegue a cero (hospital). */
const HOSPITAL_BILL: Record<Role, number> = { inmigrante: 300, alcalde: 50_000 };

/** El otro protagonista por defecto, si el jugador no tiene una partida anterior con ese rol. */
export const DEFAULT_OTHER: Record<Role, OtherCharacter> = {
  alcalde: { role: 'alcalde', name: 'Harold Brennan', legacy: false, look: { outfit: 'traje', hair: 'tupe', skin: '#f2d0b0', hairColor: '#c9c4bc', outfitColor: '#3a3a46' } },
  inmigrante: { role: 'inmigrante', name: 'Manny Ortiz', legacy: false, look: { outfit: 'camarero', hair: 'corto', skin: '#9a6440', hairColor: '#1c1818', outfitColor: '#c0392b' } },
};

export function newGame(character: Character, now: number, seed = Math.floor(Math.random() * 2 ** 32), other?: OtherCharacter, cosmetics: string[] = []): GameState {
  const role = ROLES[character.role];
  const today = dateKey(now);
  const state: GameState = {
    version: 2,
    character,
    bars: { ...role.initialBars },
    createdAt: now,
    startDate: today,
    lastSeenAt: now,
    today: { date: today, worked: false, detained: false },
    streak: 0,
    bestStreak: 0,
    daysWorked: 0,
    shift: null,
    detainedUntil: 0,
    pending: [],
    log: [],
    flags: {},
    seed: seed >>> 0,
    gameOver: null,
    upgradeLevel: 0,
    market: { open: initialPrices(), bets: [] },
    streaks: {},
    achievements: {},
    dayStartBars: { ...role.initialBars },
    eventHistory: [],
    cooldowns: {},
    dailyCheckDate: '',
    newsSeenDate: '',
    notices: [],
    ending: null,
    term: 1,
    npcs: {},
    other: other ?? DEFAULT_OTHER[character.role === 'inmigrante' ? 'alcalde' : 'inmigrante'],
    cosmetics: [...cosmetics],
    highlights: [],
  };
  log(state, now, 'info', 'Día 1', `${character.name} empieza su vida en la ciudad. Cada día tendrás que ir ${role.toWorkplace}.`);
  dailyCheck(state, now);
  return state;
}

export function dayNumber(state: GameState, now: number): number {
  return Math.max(1, daysBetween(state.startDate, dateKey(now)) + 1);
}

function log(state: GameState, at: number, kind: LogKind, title: string, text: string, deltas?: Bars, day?: number) {
  const entry: LogEntry = { at, day: day ?? dayNumber(state, at), kind, title, text };
  if (deltas && Object.keys(deltas).length) entry.deltas = deltas;
  state.log.unshift(entry);
  if (state.log.length > LOG_LIMIT) state.log.length = LOG_LIMIT;
}

function clampBar(id: BarId, v: number): number {
  return id === 'dinero' ? Math.round(v) : Math.max(0, Math.min(100, Math.round(v * 10) / 10));
}

/** Aplica cambios de barras y devuelve los cambios reales (tras recortar a 0–100). */
export function applyBars(state: GameState, delta: Bars): Bars {
  const applied: Bars = {};
  for (const [k, d] of Object.entries(delta) as [BarId, number][]) {
    if (!d || state.bars[k] === undefined) continue;
    const before = state.bars[k]!;
    const after = clampBar(k, before + d);
    state.bars[k] = after;
    if (after !== before) applied[k] = Math.round((after - before) * 10) / 10;
  }
  return applied;
}

function mergeDeltas(a: Bars, ...rest: Bars[]): Bars {
  const out: Bars = { ...a };
  for (const b of rest)
    for (const [k, v] of Object.entries(b) as [BarId, number][]) {
      const sum = Math.round(((out[k] ?? 0) + v) * 10) / 10;
      if (sum) out[k] = sum;
      else delete out[k];
    }
  return out;
}

function onCooldown(state: GameState, def: EventDef, day: number): boolean {
  const last = state.cooldowns[def.id];
  return !!def.cooldownDays && last !== undefined && day - last < def.cooldownDays;
}

function eligible(state: GameState, def: EventDef, day: number): boolean {
  return (!def.condition || def.condition(state, day)) && !onCooldown(state, def, day) && !state.pending.some((p) => p.eventId === def.id);
}

// ---------------------------------------------------------------------------
// Paso del tiempo
// ---------------------------------------------------------------------------

/**
 * Lleva el estado hasta el instante `now`: cierra los días pasados (racha,
 * gastos, descanso), dispara los sucesos programados y comprueba el final.
 * Devuelve true si algo cambió.
 */
export function advance(state: GameState, now: number): boolean {
  if (state.gameOver) return false;
  // Si el reloj del dispositivo retrocede, no rehacemos nada.
  if (now < state.lastSeenAt) return false;
  let changed = false;

  const todayKey = dateKey(now);
  let steps = 0;
  while (state.today.date < todayKey && steps < MAX_DAYS_TO_CATCH_UP) {
    closeDay(state, now);
    steps++;
    changed = true;
    if (state.gameOver) return true;
  }
  if (state.today.date < todayKey) {
    // Ausencia larguísima: saltamos directamente a hoy.
    state.today = { date: todayKey, worked: false, detained: false };
  }

  if (state.shift && !state.shift.cancelled) {
    for (const slot of state.shift.slots) {
      if (!slot.fired && slot.at <= now) {
        slot.fired = true;
        const def = EVENTS[slot.eventId];
        // Si ya no aplica (p. ej. ya tiene asesoría), se descarta en silencio.
        if (def.condition && !def.condition(state, dayNumber(state, slot.at))) continue;
        state.pending.push({ instanceId: `${slot.eventId}-${slot.at}`, eventId: slot.eventId, firedAt: slot.at, seed: mixSeed(state.seed, slot.at) });
        state.cooldowns[slot.eventId] = dayNumber(state, slot.at);
        changed = true;
      }
    }
  }

  changed = finishWorks(state, now) || changed;

  if (state.errand && now >= state.errand.endsAt) {
    finishErrand(state, state.errand.endsAt);
    changed = true;
  }

  if (state.detainedUntil && now >= state.detainedUntil) {
    state.detainedUntil = 0;
    log(state, now, 'info', 'Libertad', `${state.character.name} sale del centro de detención.`);
    changed = true;
  }
  if (state.detainedUntil) state.today.detained = true;

  if (state.dailyCheckDate !== state.today.date) {
    dailyCheck(state, now);
    changed = true;
  }

  changed = checkGameOver(state, now) || changed;
  changed = evaluateAchievements(state, now) || changed;
  state.lastSeenAt = now;
  return changed;
}

/** Inicio de cada día: foto de las barras y sucesos diarios (remesa, elecciones...). */
function dailyCheck(state: GameState, now: number) {
  state.dailyCheckDate = state.today.date;
  state.dayStartBars = { ...state.bars };
  const day = dayNumber(state, now);
  for (const def of eventsFor(state.character.role, 'diario')) {
    if (!eligible(state, def, day)) continue;
    state.pending.push({ instanceId: `${def.id}-${state.today.date}`, eventId: def.id, firedAt: now, seed: mixSeed(state.seed, hashString(`${def.id}${state.today.date}`)) });
    state.cooldowns[def.id] = day;
    if (def.id === 'elecciones') state.flags.ultimaEleccion = day;
  }
}

function track(state: GameState, name: string, ok: boolean) {
  state.streaks[name] = ok ? (state.streaks[name] ?? 0) + 1 : 0;
}

function closeDay(state: GameState, now: number) {
  const roleId = state.character.role;
  const role = ROLES[roleId];
  const closing = state.today;
  const closingDay = daysBetween(state.startDate, closing.date) + 1;
  const at = Math.min(now, startOfDay(addDays(closing.date, 1)) - 1);
  const entry = (kind: LogKind, title: string, text: string, deltas?: Bars) => log(state, at, kind, title, text, deltas, closingDay);

  if (!closing.worked) {
    if (closing.detained) {
      entry('info', 'Racha congelada', `Día ${closingDay}: estuviste detenido y no pudiste trabajar. Sin sueldo, pero la racha se mantiene.`);
    } else {
      if (state.streak > 0) {
        entry('malo', 'Racha perdida', `Día ${closingDay}: no fuiste ${role.toWorkplace}. La racha de ${state.streak} días se rompe y hoy no hubo sueldo.`);
      } else {
        entry('malo', 'Día perdido', `Día ${closingDay}: no fuiste ${role.toWorkplace}. Sin sueldo.`);
      }
      state.streak = 0;
    }
  }

  // --- Seguimiento de logros (con las barras al cierre, antes de dormir)
  const b = state.bars;
  const start = state.dayStartBars;
  if ((b.salud ?? 0) > (start.salud ?? 0) && (b.dinero ?? 0) > (start.dinero ?? 0) && (b.estres ?? 0) < (start.estres ?? 0)) state.flags.tresBarras = true;
  track(state, 'dineroMin', (b.dinero ?? 0) >= MONEY_FLOOR[roleId]);
  if (roleId === 'inmigrante') {
    track(state, 'repAlta', (b.reputacion ?? 0) >= 70);
    track(state, 'esperanza50', (b.esperanza ?? 0) >= 50);
    track(state, 'grupoDias', !!state.flags.grupoApoyo);
  } else {
    track(state, 'control40', (b.control ?? 0) >= 40);
    track(state, 'control50', (b.control ?? 0) >= 50);
    track(state, 'estresBajo', (b.estres ?? 0) <= 40);
  }

  // --- Efectos pasivos diarios
  const passive: Bars = {};
  const passiveNotes: string[] = [];
  if (roleId === 'inmigrante') {
    if (state.flags.grupoApoyo) {
      passive.reputacion = (passive.reputacion ?? 0) + 1;
      passiveNotes.push('el grupo de apoyo');
    }
    const idioma = Number(state.flags.idioma ?? 0);
    if (idioma > 0) {
      passive.reputacion = (passive.reputacion ?? 0) + idioma * 0.3;
      passiveNotes.push('tu inglés');
    }
  } else if (state.upgradeLevel > 0) {
    passive.control = (UPGRADES.alcalde.perLevel.dailyControl ?? 0) * state.upgradeLevel;
    passiveNotes.push('tu ayudante');
  }

  // --- Gastos fijos y descanso nocturno
  const overnight: Bars = { ...role.overnight };
  // La mascota ayuda a dormir mejor.
  if (state.pet) {
    overnight.estres = (overnight.estres ?? 0) - 2;
    overnight.esperanza = (overnight.esperanza ?? 0) + 1;
  }
  const extraHealth = (UPGRADES[roleId].perLevel.overnightHealth ?? 0) * state.upgradeLevel;
  if (extraHealth) overnight.salud = (overnight.salud ?? 0) + extraHealth;
  // Noche de nieve sin casa propia: frío en el cuarto compartido.
  const cold = roleId === 'inmigrante' && state.upgradeLevel === 0 && weatherFor(state.seed, closing.date) === 'nieve';
  if (cold) overnight.salud = (overnight.salud ?? 0) - 3;
  let deltas = mergeDeltas(applyBars(state, passive), applyBars(state, { dinero: -role.dailyCost }), applyBars(state, overnight));
  const extra = (passiveNotes.length ? ` Te ayudan ${passiveNotes.join(' y ')}.` : '') + (cold ? ' Sin calefacción, la nieve se cuela por la ventana.' : '');
  if ((state.bars.dinero ?? 0) < 0) {
    deltas = mergeDeltas(deltas, applyBars(state, role.debtPenalty));
    entry('malo', 'Deudas', `Día ${closingDay}: cerraste el día en números rojos. Las deudas pesan.${extra}`, deltas);
  } else {
    entry('info', 'Fin del día', `Día ${closingDay}: gastos pagados (${role.formatMoney(role.dailyCost)}) y una noche de descanso.${extra}`, deltas);
  }

  // --- Ingresos pasivos y gastos recurrentes
  passiveIncome(state, closing.date, closingDay, entry);

  // --- Encuesta semanal del alcalde
  if (roleId === 'alcalde' && closingDay % 7 === 0) {
    const pop = Math.round(state.bars.popularidad ?? 0);
    const first = !state.flags.encuestas;
    state.flags.encuestas = Number(state.flags.encuestas ?? 0) + 1;
    if (first && pop >= 50) state.flags.primeraEncuestaGanada = true;
    entry(pop >= 50 ? 'bueno' : 'malo', 'Encuesta semanal', `Las encuestas te dan un ${pop}% de aprobación. ${pop >= 50 ? 'La ciudad está contigo.' : 'La ciudad empieza a dudar.'}`);
  }

  // --- La bolsa cierra el día
  state.market.open = closePrices(state.seed, closing.date, state.market.open);

  const next = addDays(closing.date, 1);
  state.today = { date: next, worked: false, detained: state.detainedUntil > startOfDay(next) };
  checkGameOver(state, now);
}

// ---------------------------------------------------------------------------
// Rutina diaria
// ---------------------------------------------------------------------------

export type StartBlock = 'game-over' | 'already-worked' | 'in-shift' | 'detained' | 'on-errand';

export function canStartShift(state: GameState, now: number): StartBlock | null {
  if (state.gameOver) return 'game-over';
  if (state.shift) return 'in-shift';
  if (state.detainedUntil > now) return 'detained';
  if (state.errand) return 'on-errand';
  if (state.today.worked && state.today.date === dateKey(now)) return 'already-worked';
  return null;
}

export function startShift(state: GameState, now: number): void {
  advance(state, now);
  const block = canStartShift(state, now);
  if (block) throw new Error(`No se puede iniciar la jornada: ${block}`);
  const role = ROLES[state.character.role];
  const rand = mulberry32(mixSeed(state.seed, now));
  const day = dayNumber(state, now);

  // Los sucesos de la jornada se sortean al empezar, para poder programar
  // las notificaciones aunque la app esté cerrada.
  // El clima del día cambia qué sucesos son más probables.
  const w = todayWeather(state);
  const pool = eventsFor(state.character.role, 'aleatorio', 'personal')
    .filter((e) => eligible(state, e, day))
    .map((e) => ({ ...e, weight: e.weight * weatherWeight(e.id, w) * (e.id === 'huelga' && state.flags.treguaSindical ? 0.25 : 1) }));
  const used = new Set<string>();
  const slots = [];
  // Siempre hay un suceso ligero en los primeros 2 minutos, para enganchar.
  const opening = eventsFor(state.character.role, 'apertura').filter((e) => eligible(state, e, day));
  if (opening.length) {
    const ev = pickWeighted(opening, rand);
    slots.push({ at: Math.round(now + randRange(rand, OPENING_WINDOW[0], OPENING_WINDOW[1])), eventId: ev.id, fired: false });
  }
  for (const [from, to] of EVENT_WINDOWS) {
    const available = pool.filter((e) => !used.has(e.id));
    if (!available.length || rand() >= EVENT_WINDOW_CHANCE) continue;
    const ev = pickWeighted(available, rand);
    used.add(ev.id);
    slots.push({ at: Math.round(now + randRange(rand, from, to) * HOUR), eventId: ev.id, fired: false });
  }

  state.shift = { startedAt: now, endsAt: now + SHIFT_HOURS * HOUR, slots, marketOpen: { ...state.market.open } };
  state.market.bets = [];
  state.today.worked = true;
  state.daysWorked += 1;
  state.streak += 1;
  state.bestStreak = Math.max(state.bestStreak, state.streak);
  log(state, now, 'info', role.goToWork, `${state.character.name} llega ${role.toWorkplace}. Racha: ${state.streak} 🔥`);
  streakReward(state, now);
}

export function canRetire(state: GameState, now: number): boolean {
  return !!state.shift && (!!state.shift.cancelled || now >= state.shift.endsAt);
}

export function retire(state: GameState, now: number): void {
  advance(state, now);
  if (!state.shift || !canRetire(state, now)) throw new Error('Aún no terminan las 8 horas');
  const roleId = state.character.role;
  const role = ROLES[roleId];
  const shift = state.shift;
  if (!shift.cancelled) settleBets(state, now, 1);
  state.shift = null;
  if (shift.cancelled) {
    log(state, now, 'info', 'Jornada perdida', `${shift.cancelled}. Hoy no hay sueldo.`);
    return;
  }
  const wear: Bars = { ...role.shiftWear };
  const relief = (UPGRADES[roleId].perLevel.shiftStressRelief ?? 0) * state.upgradeLevel;
  if (relief) wear.estres = Math.max(0, (wear.estres ?? 0) - relief);
  const pay = shiftPay(state);
  const deltas = mergeDeltas(applyBars(state, { dinero: pay }), applyBars(state, wear));
  state.flags.jornadas = Number(state.flags.jornadas ?? 0) + 1;
  addStat(state, 'ingresos', pay);
  log(state, now, 'bueno', 'Jornada completa', `${state.character.name} termina sus 8 horas en ${role.workplace} y cobra ${role.formatMoney(pay)}.`, deltas);
  checkGameOver(state, now);
  evaluateAchievements(state, now);
}

// ---------------------------------------------------------------------------
// Bolsa
// ---------------------------------------------------------------------------

export interface Session {
  date: string;
  p: number;
  open: Record<string, number>;
}

/** La bolsa solo se puede operar durante la jornada de 8 horas. */
export function marketSession(state: GameState, now: number): Session | null {
  const s = state.shift;
  if (!s || s.cancelled || state.gameOver) return null;
  return {
    date: dateKey(s.startedAt),
    p: Math.max(0, Math.min(1, (now - s.startedAt) / (SHIFT_HOURS * HOUR))),
    open: s.marketOpen,
  };
}

export function quote(state: GameState, ticker: string, now: number, at?: number): number {
  const s = marketSession(state, now);
  if (!s) return state.market.open[ticker];
  return priceAt(state.seed, s.date, ticker, s.open[ticker], at ?? s.p);
}

export function todayNews(state: GameState): NewsItem[] {
  return dayPlan(state.seed, state.shift ? dateKey(state.shift.startedAt) : state.today.date).news;
}

export function markNewsSeen(state: GameState) {
  state.newsSeenDate = state.today.date;
}

export function placeBet(state: GameState, ticker: string, dir: 1 | -1, stake: number, now: number) {
  advance(state, now);
  const s = marketSession(state, now);
  if (!s || s.p >= 1) throw new Error('La bolsa solo abre durante tu jornada.');
  if (state.market.bets.length >= MAX_BETS_PER_SHIFT) throw new Error(`Máximo ${MAX_BETS_PER_SHIFT} operaciones por jornada.`);
  if ((state.bars.dinero ?? 0) < stake) throw new Error('No tienes suficiente dinero.');
  const role = ROLES[state.character.role];
  const entry = quote(state, ticker, now);
  applyBars(state, { dinero: -stake });
  state.market.bets.push({ id: `${ticker}-${now}`, ticker, dir, stake, entryPrice: entry, date: s.date, open: s.open[ticker], placedAt: now });
  log(state, now, 'info', 'Bolsa', `Apuestas ${role.formatMoney(stake)} a que ${ticker} ${dir > 0 ? 'SUBE ▲' : 'BAJA ▼'} (entrada ${entry.toFixed(2)}).`, { dinero: -stake });
}

/** Liquida las apuestas abiertas al progreso p de la sesión. */
function settleBets(state: GameState, now: number, p: number) {
  const bets = state.market.bets;
  if (!bets.length) return;
  const roleId = state.character.role;
  const role = ROLES[roleId];
  let back = 0;
  let net = 0;
  const lines: string[] = [];
  for (const bet of bets) {
    const exit = priceAt(state.seed, bet.date, bet.ticker, bet.open, p);
    const ret = betReturn(bet.stake, bet.dir, bet.entryPrice, exit);
    back += bet.stake + ret;
    net += ret;
    const won = ret > 0;
    if (won && bet.stake >= BIG_BET[roleId]) state.flags.apuestaGrande = true;
    lines.push(`${bet.ticker} ${bet.dir > 0 ? '▲' : '▼'} ${bet.entryPrice.toFixed(2)}→${exit.toFixed(2)}: ${won ? 'acertaste' : 'fallaste'} (${ret >= 0 ? '+' : ''}${role.formatMoney(ret)})`);
  }
  state.market.bets = [];
  addStat(state, net >= 0 ? 'bolsaGanado' : 'bolsaPerdido', Math.abs(net));
  // El resultado afecta al dinero y al ánimo.
  const mood: Bars = net > 0 ? { estres: -3 } : net < 0 ? { estres: 4 } : {};
  if (roleId === 'inmigrante' && net !== 0) mood.esperanza = net > 0 ? 2 : -2;
  const deltas = mergeDeltas(applyBars(state, { dinero: back }), applyBars(state, mood));
  const headline = net > 0 ? `Ganaste ${role.formatMoney(net)} en la bolsa. Sales con una sonrisa.` : net < 0 ? `Perdiste ${role.formatMoney(-net)} en la bolsa. Te pesa en el ánimo.` : 'La bolsa cerró sin ganancias ni pérdidas.';
  log(state, now, net >= 0 ? 'bueno' : 'malo', 'Cierre de la bolsa', `${headline} ${lines.join(' · ')}`, mergeDeltas(deltas, { dinero: -bets.reduce((s, x) => s + x.stake, 0) }));
  state.notices.push({ kind: 'aviso', title: 'BOLSA', text: headline });
}

// ---------------------------------------------------------------------------
// Mejoras permanentes
// ---------------------------------------------------------------------------

export function buyUpgrade(state: GameState, now: number) {
  advance(state, now);
  const roleId = state.character.role;
  const next = nextUpgrade(roleId, state.upgradeLevel);
  if (!next) throw new Error('Ya tienes el nivel máximo.');
  const role = ROLES[roleId];
  const money = state.bars.dinero ?? 0;
  const cost = upgradeCost(state, next.cost);
  if (money < cost) throw new Error(`Te faltan ${role.formatMoney(cost - money)}.`);
  const deltas = mergeDeltas(applyBars(state, { dinero: -cost }), applyBars(state, next.instant));
  if (cost < next.cost) state.flags.descuentoCasa = false;
  state.upgradeLevel = next.level;
  log(state, now, 'bueno', `${UPGRADES[roleId].title}: nivel ${next.level}`, `${next.name}. ${next.description}`, deltas);
  evaluateAchievements(state, now);
}

// ---------------------------------------------------------------------------
// Acciones (decisiones que toma el jugador)
// ---------------------------------------------------------------------------

export function actionsFor(state: GameState): EventDef[] {
  return eventsFor(state.character.role, 'accion');
}

export function actionStatus(state: GameState, def: EventDef, now: number): { ok: boolean; reason?: string } {
  const day = dayNumber(state, now);
  if (state.gameOver) return { ok: false, reason: 'Partida terminada' };
  if (state.detainedUntil > now) return { ok: false, reason: 'Estás detenido' };
  if (def.condition && !def.condition(state, day)) return { ok: false, reason: 'Completado' };
  if (state.pending.some((p) => p.eventId === def.id)) return { ok: false, reason: 'Pendiente' };
  const blocked = def.choices.find((c) => c.requires && !c.requires.check(state));
  if (blocked && def.choices.every((c) => c.requires && !c.requires.check(state))) return { ok: false, reason: blocked.requires!.label };
  if (onCooldown(state, def, day)) {
    const left = def.cooldownDays! - (day - state.cooldowns[def.id]);
    return { ok: false, reason: left === 1 ? 'Disponible mañana' : `Disponible en ${left} días` };
  }
  return { ok: true };
}

export function startAction(state: GameState, id: string, now: number): PendingEvent {
  advance(state, now);
  const def = EVENTS[id];
  const status = actionStatus(state, def, now);
  if (!status.ok) throw new Error(status.reason);
  const pending = { instanceId: `${id}-a-${now}`, eventId: id, firedAt: now, seed: mixSeed(state.seed, now) };
  state.pending.unshift(pending);
  state.cooldowns[id] = dayNumber(state, now);
  return pending;
}

// ---------------------------------------------------------------------------
// Sucesos
// ---------------------------------------------------------------------------

export interface EventView {
  pending: PendingEvent;
  def: EventDef;
  intro: string;
  vars: Record<string, string>;
}

function eventVars(state: GameState, def: EventDef, seed: number): Record<string, string> {
  const rand = mulberry32(seed ^ 0xabcdef);
  const vars: Record<string, string> = {
    name: state.character.name,
    place: ROLES[state.character.role].workplace,
    otro: state.other?.name ?? DEFAULT_OTHER[state.character.role === 'inmigrante' ? 'alcalde' : 'inmigrante'].name,
    pet: state.pet?.name ?? 'tu mascota',
  };
  for (const [k, options] of Object.entries(def.variants ?? {})) {
    vars[k] = options[Math.floor(rand() * options.length)];
  }
  return vars;
}

export function fillText(text: string, vars: Record<string, string>): string {
  return text.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? `{${k}}`);
}

export function viewEvent(state: GameState, pending: PendingEvent): EventView {
  const def = EVENTS[pending.eventId];
  const vars = eventVars(state, def, pending.seed);
  return { pending, def, vars, intro: fillText(def.intro, vars) };
}

export interface ResolvedOutcome {
  event: EventDef;
  choice: ChoiceDef;
  outcome: OutcomeDef;
  message: string;
  deltas: Bars;
}

/** Sortea el resultado de una opción (ponderado y con la semilla del suceso). */
export function rollOutcome(state: GameState, def: EventDef, choice: ChoiceDef, seed: number): OutcomeDef {
  const rand = mulberry32(mixSeed(seed, hashString(choice.id)));
  const weighted = choice.outcomes.map((o) => ({ o, weight: def.adjustWeight ? def.adjustWeight(o, state) : o.weight }));
  return pickWeighted(weighted, rand).o;
}

export function resolveEvent(state: GameState, instanceId: string, choiceId: string, now: number): ResolvedOutcome {
  const idx = state.pending.findIndex((p) => p.instanceId === instanceId);
  if (idx < 0) throw new Error('Suceso no encontrado');
  const pending = state.pending[idx];
  const def = EVENTS[pending.eventId];
  const choice = def.choices.find((c) => c.id === choiceId);
  if (!choice) throw new Error('Opción no válida');
  if (choice.requires && !choice.requires.check(state)) throw new Error(choice.requires.label);
  const outcome = rollOutcome(state, def, choice, pending.seed);
  const vars = eventVars(state, def, pending.seed);
  const message = fillText(outcome.message, vars);

  state.pending.splice(idx, 1);
  let deltas = choice.cost ? applyBars(state, { dinero: -choice.cost }) : {};
  deltas = mergeDeltas(deltas, applyEffects(state, outcome.effects, now));
  let previous: string | undefined;
  if (def.kind === 'aleatorio') {
    previous = state.eventHistory[state.eventHistory.length - 1];
    state.eventHistory.push(def.id);
    if (state.eventHistory.length > 10) state.eventHistory.shift();
  }
  // La relación con los personajes recurrentes recuerda esta decisión.
  const rel = NPC_EFFECTS[def.id]?.byChoice[choice.id];
  if (rel) rememberNpc(state, NPC_EFFECTS[def.id].npc, rel.afinidad, rel.recuerdo);
  addStat(state, outcome.result === 'bueno' ? 'sucesosBuenos' : 'sucesosMalos', 1);
  remember(state, `${def.title}: ${outcome.title}`, dayNumber(state, now), deltas, outcome.result);
  log(state, now, outcome.result, `${def.title}: ${outcome.title}`, message, deltas);
  if (outcome.effects.endGame) endGame(state, now, outcome.effects.endGame.title, outcome.effects.endGame.text);
  checkGameOver(state, now);
  def.onResolve?.(state, { outcome, deltas, previous, unlock: (id) => unlock(state, id, now), day: dayNumber(state, now), vars });
  for (const id of outcome.effects.unlock ?? []) unlock(state, id, now);
  evaluateAchievements(state, now);
  return { event: def, choice, outcome, message, deltas };
}

function applyEffects(state: GameState, fx: Effects, now: number): Bars {
  let deltas: Bars = {};
  if (fx.moneyPct) {
    const money = state.bars.dinero ?? 0;
    // El porcentaje solo se aplica sobre saldo positivo.
    deltas = mergeDeltas(deltas, applyBars(state, { dinero: Math.round((Math.max(0, money) * fx.moneyPct) / 100) }));
  }
  if (fx.bars) deltas = mergeDeltas(deltas, applyBars(state, fx.bars));
  if (fx.cancelShift && state.shift && !state.shift.cancelled) {
    const s = marketSession(state, now);
    if (s) settleBets(state, now, s.p);
    state.shift.cancelled = fx.cancelShift;
    // Los sucesos pendientes de esta jornada ya no ocurrirán.
    state.shift.slots = state.shift.slots.filter((sl) => sl.fired);
  }
  if (fx.detainHours) {
    state.detainedUntil = Math.max(state.detainedUntil, now + fx.detainHours * HOUR);
    state.today.detained = true;
  }
  if (fx.flags) Object.assign(state.flags, fx.flags);
  for (const c of fx.counters ?? []) state.flags[c] = Number(state.flags[c] ?? 0) + 1;
  if (fx.npc) rememberNpc(state, fx.npc.id, fx.npc.afinidad, fx.npc.recuerdo);
  return deltas;
}

// ---------------------------------------------------------------------------
// Logros y finales
// ---------------------------------------------------------------------------

function unlock(state: GameState, id: string, now: number) {
  const def = ACHIEVEMENT_BY_ID[id];
  if (!def || def.role !== state.character.role || state.achievements[id] || state.gameOver) return;
  state.achievements[id] = now;
  const deltas = def.reward ? applyBars(state, def.reward) : undefined;
  log(state, now, 'bueno', `🏆 Logro: ${def.title}`, def.description, deltas);
  state.notices.push({ kind: 'logro', title: 'LOGRO DESBLOQUEADO', text: `🏆 ${def.title}` });
  if (def.final && !state.ending) {
    const t = FINAL_TEXT[state.character.role];
    state.ending = { at: now, day: dayNumber(state, now), title: t.title, text: t.text };
    log(state, now, 'bueno', `Final: ${t.title}`, t.text);
    state.notices.push({ kind: 'final', title: 'FINAL', text: t.title });
  }
}

export function evaluateAchievements(state: GameState, now: number): boolean {
  if (state.gameOver) return false;
  const day = dayNumber(state, now);
  if (day <= 7 && state.character.role === 'inmigrante' && (state.bars.esperanza ?? 100) < 40) state.flags.esperanzaBajaSemana1 = true;
  let changed = false;
  for (let pass = 0; pass < 3; pass++) {
    let any = false;
    for (const a of achievementsFor(state.character.role)) {
      if (state.achievements[a.id] || !a.check || !a.check(state, day)) continue;
      unlock(state, a.id, now);
      any = changed = true;
    }
    if (!any) break;
  }
  const count = Object.keys(state.achievements).length;
  for (const u of ACHIEVEMENT_UNLOCKS) {
    const id = u.cosmetic[state.character.role];
    if (count >= u.count && id) changed = grantCosmetic(state, id, `${u.count} logros`) || changed;
  }
  return changed;
}

function endGame(state: GameState, now: number, title: string, text: string) {
  if (state.gameOver) return;
  state.gameOver = { at: now, day: dayNumber(state, now), title, text };
  state.shift = null;
  state.pending = [];
  state.market.bets = [];
  state.errand = null;
  log(state, now, 'malo', title, text);
}

export function checkGameOver(state: GameState, now: number): boolean {
  if (state.gameOver) return false;
  const b = state.bars;
  const name = state.character.name;
  let changed = false;

  // Salud a cero: hospital (no es fin de partida, pero cuesta caro).
  if ((b.salud ?? 1) <= 0) {
    const roleId = state.character.role;
    const deltas = mergeDeltas(applyBars(state, { salud: 25, estres: 15, dinero: -HOSPITAL_BILL[roleId] }));
    if (state.shift && !state.shift.cancelled) {
      const s = marketSession(state, now);
      if (s) settleBets(state, now, s.p);
      state.shift.cancelled = 'Hospitalizado';
      state.shift.slots = state.shift.slots.filter((sl) => sl.fired);
    }
    log(state, now, 'malo', 'Hospitalizado', `${name} se desploma y despierta en un hospital. La factura llega antes que el alta.`, deltas);
    state.notices.push({ kind: 'aviso', title: 'HOSPITAL', text: `${name} acabó en el hospital.` });
    changed = true;
  }

  let title = '';
  let text = '';
  if (state.character.role === 'alcalde') {
    if ((b.popularidad ?? 1) <= 0) {
      title = 'Destituido';
      text = `El concejo vota tu destitución. La ciudad ya no quiere a ${name} en la alcaldía.`;
    } else if ((b.control ?? 1) <= 0) {
      title = 'Renuncia';
      text = `La ciudad se te escapó de las manos. ${name} presenta su renuncia ante la prensa.`;
    }
  } else {
    if ((b.estres ?? 0) >= 100) {
      title = 'Ya no puedo más';
      text = `El estrés pudo más que el sueño. ${name} compra un pasaje de vuelta a su tierra.`;
    } else if ((b.esperanza ?? 1) <= 0) {
      title = 'De vuelta a casa';
      text = `Sin esperanza no hay motivo para quedarse. ${name} hace la maleta y vuelve a su país.`;
    }
  }
  if (!title) return changed;
  endGame(state, now, title, text);
  return true;
}

/** Herramienta de desarrollo: dispara un suceso ahora mismo. */
export function forceEvent(state: GameState, eventId: string, now: number): void {
  if (!EVENTS[eventId] || state.gameOver) return;
  state.pending.push({ instanceId: `${eventId}-dev-${now}`, eventId, firedAt: now, seed: mixSeed(state.seed, now) });
}

/** Saca el siguiente aviso pendiente (logros, bolsa...). */
export function takeNotice(state: GameState) {
  return state.notices.shift();
}

// ---------------------------------------------------------------------------
// Minijuegos (lavaplatos / papeleo): adelantan la jornada
// ---------------------------------------------------------------------------

export const MINUTES_PER_POINT = 10;
const MAX_POINTS_PER_GAME = 80;

export function canPlayMinigame(state: GameState, now: number): boolean {
  const s = state.shift;
  return !!s && !s.cancelled && !state.gameOver && now < s.endsAt;
}

/** Aplica el resultado de un minijuego: cada acierto descuenta 10 minutos de la jornada. */
/** Nombre de cada minijuego en el diario. */
export const MINIGAME_LABEL: Record<string, string> = {
  dishes: 'Lavaplatos',
  burgers: 'Plancha',
  orders: 'Pedidos',
  coffee: 'Café',
  mop: 'Fregona',
  paperwork: 'Papeleo',
  traffic: 'Semáforos',
  press: 'Rueda de prensa',
  budget: 'Presupuestos',
  handshake: 'Mitin',
};

export function applyMinigame(state: GameState, points: number, now: number, game?: string): number {
  advance(state, now);
  if (!canPlayMinigame(state, now)) throw new Error('Solo puedes hacerlo durante tu jornada.');
  const n = Math.max(0, Math.min(MAX_POINTS_PER_GAME, Math.floor(points)));
  const shift = state.shift!;
  const before = shift.endsAt;
  shift.endsAt = Math.max(now, shift.endsAt - n * MINUTES_PER_POINT * 60_000);
  const saved = Math.round((before - shift.endsAt) / 60_000);
  const roleId = state.character.role;
  const classic = !game || game === 'dishes' || game === 'paperwork';
  if (classic) {
    const counter = roleId === 'inmigrante' ? 'platosLavados' : 'documentosFirmados';
    state.flags[counter] = Number(state.flags[counter] ?? 0) + n;
  }
  addStat(state, 'minijuegos', n);
  const what = classic
    ? roleId === 'inmigrante'
      ? `Lavaste ${n} plato${n === 1 ? '' : 's'}`
      : `Despachaste ${n} documento${n === 1 ? '' : 's'}`
    : `${n} acierto${n === 1 ? '' : 's'}`;
  const title = MINIGAME_LABEL[game ?? ''] ?? (roleId === 'inmigrante' ? 'Lavaplatos' : 'Papeleo');
  log(state, now, n > 0 ? 'bueno' : 'info', title, `${what}: la jornada avanza ${saved} min.`);
  return saved;
}

// ---------------------------------------------------------------------------
// Reparto de paquetes (trabajo extra del inmigrante)
// ---------------------------------------------------------------------------

export const ERRAND_PAY = 110;
export const ERRAND_WEAR: Bars = { salud: -2, estres: 2 };
export const CAR_COST = 1200;

export function errandHours(state: GameState): number {
  return state.flags.auto ? 2 : 4;
}

export type ErrandBlock = 'rol' | 'game-over' | 'in-shift' | 'detained' | 'done-today' | 'on-errand';

export function canStartErrand(state: GameState, now: number): ErrandBlock | null {
  if (state.character.role !== 'inmigrante') return 'rol';
  if (state.gameOver) return 'game-over';
  if (state.errand) return 'on-errand';
  if (state.shift) return 'in-shift';
  if (state.detainedUntil > now) return 'detained';
  if (state.flags.repartoDia === dayNumber(state, now)) return 'done-today';
  return null;
}

export function startErrand(state: GameState, now: number) {
  advance(state, now);
  const block = canStartErrand(state, now);
  if (block) throw new Error(block === 'done-today' ? 'Hoy ya hiciste el reparto.' : 'Ahora no puedes salir a repartir.');
  state.errand = { startedAt: now, endsAt: now + errandHours(state) * HOUR, kind: 'reparto' };
  state.flags.repartoDia = dayNumber(state, now);
  log(state, now, 'info', 'Reparto', `${state.character.name} sale a repartir paquetes por la ciudad (${errandHours(state)} h).`);
}

function finishErrand(state: GameState, at: number) {
  const job = state.errand;
  state.errand = null;
  if (job?.kind === 'radio') {
    const pay = job.pay ?? 0;
    const deltas = mergeDeltas(applyBars(state, { dinero: pay }), applyBars(state, job.wear ?? {}));
    addStat(state, 'ingresos', pay);
    addStat(state, 'trabajosRadio', 1);
    const fmt = ROLES.inmigrante.formatMoney;
    log(state, at, 'bueno', 'Trabajo de la radio', `${job.label}: hecho. Cobras ${fmt(pay)} en mano.`, deltas);
    state.notices.push({ kind: 'aviso', title: 'RADIO', text: `${job.label}: +${fmt(pay)}` });
    return;
  }
  const w = errandWeather(todayWeather(state));
  const pay = ERRAND_PAY + w.extraPay;
  const wear: Bars = { salud: (ERRAND_WEAR.salud ?? 0) - w.extraWear, estres: (ERRAND_WEAR.estres ?? 0) + w.extraWear };
  const deltas = mergeDeltas(applyBars(state, { dinero: pay }), applyBars(state, wear));
  state.flags.repartos = Number(state.flags.repartos ?? 0) + 1;
  addStat(state, 'ingresos', pay);
  const fmt = ROLES.inmigrante.formatMoney;
  log(state, at, 'bueno', 'Reparto terminado', `${state.character.name} vuelve con los pies molidos y ${fmt(pay)} en el bolsillo.${w.note ? ` ${w.note}` : ''}`, deltas);
  state.notices.push({ kind: 'aviso', title: 'REPARTO', text: `Reparto terminado: +${fmt(pay)}` });
}

/** Clima del día actual de la partida. */
export function todayWeather(state: GameState): Weather {
  return weatherFor(state.seed, state.today.date);
}

export function buyCar(state: GameState, now: number) {
  advance(state, now);
  if (state.character.role !== 'inmigrante' || state.flags.auto) throw new Error('Ya tienes auto.');
  const money = state.bars.dinero ?? 0;
  if (money < CAR_COST) throw new Error(`Te faltan ${ROLES.inmigrante.formatMoney(CAR_COST - money)}.`);
  const deltas = applyBars(state, { dinero: -CAR_COST });
  state.flags.auto = true;
  log(state, now, 'bueno', 'Auto propio', 'Un sedán usado del 79, con la radio que solo coge una emisora. Ahora el reparto dura 2 horas.', deltas);
  evaluateAchievements(state, now);
}

// ---------------------------------------------------------------------------
// Racha, armario y estadísticas
// ---------------------------------------------------------------------------

/** Sueldo de la jornada (Sal puede subirlo). */
export function shiftPay(state: GameState): number {
  return ROLES[state.character.role].shiftPay + (state.flags.aumento ? 20 : 0);
}

/** Precio de la siguiente mejora (con el descuento de Don Ramiro, si lo hay). */
export function upgradeCost(state: GameState, base: number): number {
  return state.flags.descuentoCasa && state.character.role === 'inmigrante' ? Math.round(base * 0.8) : base;
}

function addStat(state: GameState, key: string, n: number) {
  state.flags[key] = Number(state.flags[key] ?? 0) + n;
}

/** Guarda las decisiones con más impacto para el resumen final. */
function remember(state: GameState, title: string, day: number, deltas: Bars, kind: LogKind) {
  const role = ROLES[state.character.role];
  let score = 0;
  for (const [k, v] of Object.entries(deltas) as [BarId, number][]) {
    const def = role.bars.find((b) => b.id === k);
    score += def?.moneyScale ? (Math.abs(v) / def.moneyScale) * 100 : Math.abs(v);
  }
  const list = (state.highlights ??= []);
  list.push({ title, day, score: Math.round(score), kind });
  list.sort((a, b) => b.score - a.score);
  list.length = Math.min(list.length, 5);
}

export function grantCosmetic(state: GameState, id: string, why: string): boolean {
  const list = (state.cosmetics ??= []);
  if (list.includes(id) || !COSMETIC_BY_ID[id]) return false;
  list.push(id);
  state.notices.push({ kind: 'armario', title: 'ARMARIO', text: `Nuevo: ${COSMETIC_BY_ID[id].label} (${why}). Cámbiate en el menú ☰.` });
  return true;
}

function streakReward(state: GameState, now: number) {
  const r = STREAK_REWARDS.find((x) => x.days === state.streak);
  if (!r || state.flags[`racha${r.days}`]) return;
  state.flags[`racha${r.days}`] = true;
  const roleId = state.character.role;
  const deltas = applyBars(state, { dinero: r.money[roleId] });
  log(state, now, 'bueno', `🔥 ${r.title}`, `Recompensa por tu racha de ${r.days} días: ${ROLES[roleId].formatMoney(r.money[roleId])}.`, deltas);
  state.notices.push({ kind: 'racha', title: `RACHA DE ${r.days} DÍAS`, text: `${r.title} +${ROLES[roleId].formatMoney(r.money[roleId])}` });
  const cos = r.cosmetic?.[roleId];
  if (cos) grantCosmetic(state, cos, `racha de ${r.days} días`);
}

/** Cambia la ropa o el peinado (solo lo básico o lo desbloqueado). */
export function changeLook(state: GameState, look: Character['look']) {
  state.character.look = { ...look };
}

export interface Stats {
  dias: number;
  mejorRacha: number;
  jornadas: number;
  platos: number;
  documentos: number;
  repartos: number;
  ingresos: number;
  bolsaNeta: number;
  buenos: number;
  malos: number;
  logros: number;
  personas: number;
  destacadas: NonNullable<GameState['highlights']>;
}

export function gameStats(state: GameState, now: number): Stats {
  const f = (k: string) => Number(state.flags[k] ?? 0);
  return {
    dias: state.gameOver?.day ?? dayNumber(state, now),
    mejorRacha: state.bestStreak,
    jornadas: f('jornadas'),
    platos: f('platosLavados'),
    documentos: f('documentosFirmados'),
    repartos: f('repartos'),
    ingresos: f('ingresos'),
    bolsaNeta: f('bolsaGanado') - f('bolsaPerdido'),
    buenos: f('sucesosBuenos'),
    malos: f('sucesosMalos'),
    logros: Object.keys(state.achievements).length,
    personas: Object.keys(state.npcs ?? {}).filter((id) => NPCS[id]?.role === state.character.role).length,
    destacadas: state.highlights ?? [],
  };
}

// ---------------------------------------------------------------------------
// Solares, obras y casa por fases
// ---------------------------------------------------------------------------

function pay(state: GameState, cost: number) {
  const money = state.bars.dinero ?? 0;
  if (money < cost) throw new Error(`Te faltan ${ROLES[state.character.role].formatMoney(cost - money)}.`);
  return applyBars(state, { dinero: -cost });
}

/** El inmigrante compra un solar (solo uno). */
export function buyLot(state: GameState, lotId: string, now: number) {
  advance(state, now);
  if (state.character.role !== 'inmigrante') throw new Error('Solo el inmigrante compra solares.');
  if (ownedLot(state)) throw new Error('Ya tienes un solar.');
  if (state.lots?.[lotId]) throw new Error('Ese solar ya no está libre.');
  const deltas = pay(state, LOT_PRICE);
  (state.lots ??= {})[lotId] = { owner: 'jugador', building: 'casa', phase: 0, buildingUntil: 0 };
  log(state, now, 'bueno', 'Solar comprado', `${LOT_BY_ID[lotId].label} es tuyo. Ahora, a construir poco a poco.`, deltas);
  state.notices.push({ kind: 'aviso', title: 'SOLAR', text: `¡${LOT_BY_ID[lotId].label} es tuyo!` });
}

/** Siguiente fase de la casa del inmigrante (tarda un día). */
export function buildHousePhase(state: GameState, now: number) {
  advance(state, now);
  const id = ownedLot(state);
  const lot = id ? state.lots![id] : undefined;
  if (!lot) throw new Error('Primero compra un solar.');
  if (lot.buildingUntil) throw new Error('Ya hay obras en marcha.');
  const phase = HOUSE_PHASES[lot.phase];
  if (!phase) throw new Error('Tu casa ya está terminada.');
  const deltas = pay(state, phase.cost);
  lot.buildingUntil = now + phase.hours * HOUR;
  log(state, now, 'info', `Obras: ${phase.label}`, `${phase.text} Estará lista en ${phase.hours} horas.`, deltas);
}

/** El alcalde levanta una obra pública en un solar libre. */
export function buildCivic(state: GameState, lotId: string, civicId: string, now: number) {
  advance(state, now);
  if (state.character.role !== 'alcalde') throw new Error('Solo el alcalde construye obras públicas.');
  if (state.lots?.[lotId]) throw new Error('Ese solar ya está ocupado.');
  const def = CIVIC_BY_ID[civicId];
  const deltas = pay(state, def.cost);
  (state.lots ??= {})[lotId] = { owner: 'ciudad', building: civicId, phase: 0, buildingUntil: now + def.days * DAY };
  log(state, now, 'info', `Obras: ${def.label}`, `Empiezan las obras en ${LOT_BY_ID[lotId].label}. Inauguración en ${def.days} días.`, deltas);
}

/** El alcalde renueva una manzana (dos niveles). */
export function renovateBlock(state: GameState, key: string, now: number) {
  advance(state, now);
  if (state.character.role !== 'alcalde') throw new Error('Solo el alcalde renueva edificios.');
  if (state.renovating?.[key]) throw new Error('Esa manzana ya está en obras.');
  const level = state.renovated?.[key] ?? 0;
  const next = RENOVATION[level];
  if (!next) throw new Error('Esa manzana ya está renovada al máximo.');
  const deltas = pay(state, next.cost);
  (state.renovating ??= {})[key] = now + next.hours * HOUR;
  log(state, now, 'info', `Renovación: ${next.label}`, `Andamios en la manzana ${key}. Lista en ${next.hours} horas.`, deltas);
}

/** Termina las obras cuyo plazo ha vencido. */
function finishWorks(state: GameState, now: number): boolean {
  let changed = false;
  for (const [id, lot] of Object.entries(state.lots ?? {})) {
    if (!lot.buildingUntil || lot.buildingUntil > now) continue;
    lot.buildingUntil = 0;
    lot.phase += 1;
    changed = true;
    if (lot.owner === 'ciudad') {
      const def = CIVIC_BY_ID[lot.building];
      const deltas = applyBars(state, def.instant);
      log(state, now, 'bueno', `Inauguración: ${def.label}`, `${def.description} Cortas la cinta en ${LOT_BY_ID[id].label}.`, deltas);
      state.notices.push({ kind: 'aviso', title: 'INAUGURACIÓN', text: `${def.icon} ${def.label}` });
      addStat(state, 'obras', 1);
    } else {
      const done = lot.phase >= HOUSE_PHASES.length;
      const deltas = applyBars(state, done ? { esperanza: 20, salud: 8 } : { esperanza: 3 });
      const label = HOUSE_PHASES[lot.phase - 1].label;
      log(state, now, 'bueno', done ? '¡Tu casa está terminada!' : `Fase terminada: ${label}`, done ? `Tienes una casa con tu nombre. La alquilas: te dará ${ROLES.inmigrante.formatMoney(HOUSE_RENT)} cada día.` : 'Un paso más hacia tu casa propia.', deltas);
      state.notices.push({ kind: 'aviso', title: 'TU CASA', text: done ? '¡Casa terminada!' : `${label}: hecho` });
    }
  }
  for (const [key, until] of Object.entries(state.renovating ?? {})) {
    if (until > now) continue;
    delete state.renovating![key];
    const level = (state.renovated ?? {})[key] ?? 0;
    const r = RENOVATION[level];
    (state.renovated ??= {})[key] = level + 1;
    const deltas = applyBars(state, r.instant);
    log(state, now, 'bueno', `Renovación: ${r.label}`, `La manzana ${key} luce como nueva. Los vecinos sacan fotos.`, deltas);
    changed = true;
  }
  return changed;
}

// ---------------------------------------------------------------------------
// Ingresos pasivos: máquinas, alquiler, mascota (inmigrante) y turismo (alcalde)
// ---------------------------------------------------------------------------

export const VENDING_PRICES = [350, 450, 600, 750, 900];
export const VENDING_INCOME = 15;
export const PET_MONTHLY = 20;
export const TOURIST_SPEND = 40;

export function buyVending(state: GameState, now: number) {
  advance(state, now);
  const v = (state.vending ??= { count: 0, broken: 0 });
  const price = VENDING_PRICES[v.count];
  if (price === undefined) throw new Error('Ya tienes todas las máquinas.');
  const deltas = pay(state, price);
  v.count += 1;
  log(state, now, 'bueno', 'Máquina expendedora', `Instalas tu máquina nº ${v.count}: refrescos y chocolatinas. Dará unos ${ROLES.inmigrante.formatMoney(VENDING_INCOME)} al día.`, deltas);
}

export function repairVending(state: GameState, now: number) {
  advance(state, now);
  const v = state.vending;
  if (!v?.broken) throw new Error('No hay máquinas rotas.');
  const deltas = pay(state, 40 * v.broken);
  v.broken = 0;
  log(state, now, 'info', 'Máquinas reparadas', 'El técnico deja tus máquinas como nuevas.', deltas);
}

export interface Tourism {
  tourists: number;
  income: number;
  attractions: number;
  weather: number;
}

/** Turistas del día: popularidad × atractivo de la ciudad × clima. */
export function tourismFor(state: GameState, date: string): Tourism {
  let attractions = 1;
  for (const lot of Object.values(state.lots ?? {})) if (lot.owner === 'ciudad' && lot.phase > 0) attractions += CIVIC_BY_ID[lot.building]?.tourism ?? 0;
  for (const lvl of Object.values(state.renovated ?? {})) attractions += lvl * 0.08;
  const w = weatherFor(state.seed, date);
  const weather = { despejado: 1, nublado: 0.9, lluvia: 0.6, tormenta: 0.3, nieve: 0.75 }[w];
  const tourists = Math.round(1000 * ((state.bars.popularidad ?? 0) / 100) * attractions * weather);
  return { tourists, income: tourists * TOURIST_SPEND, attractions, weather };
}

/** Ingresos diarios de obras públicas (taquillas, abonos, alquileres). */
export function civicIncome(state: GameState): number {
  let sum = 0;
  for (const lot of Object.values(state.lots ?? {})) if (lot.owner === 'ciudad' && lot.phase > 0) sum += CIVIC_BY_ID[lot.building]?.income ?? 0;
  return sum;
}

function passiveIncome(state: GameState, date: string, day: number, entry: (kind: LogKind, title: string, text: string, deltas?: Bars) => void) {
  const fmt = ROLES[state.character.role].formatMoney;
  if (state.character.role === 'inmigrante') {
    const parts: string[] = [];
    let money = 0;
    const v = state.vending;
    if (v?.count) {
      const working = Math.max(0, v.count - v.broken);
      const inc = working * VENDING_INCOME;
      money += inc;
      parts.push(`máquinas ${fmt(inc)}${v.broken ? ` (${v.broken} rota${v.broken > 1 ? 's' : ''})` : ''}`);
    }
    const lot = ownedLot(state);
    if (lot && state.lots![lot].phase >= HOUSE_PHASES.length) {
      money += HOUSE_RENT;
      parts.push(`alquiler ${fmt(HOUSE_RENT)}`);
    }
    if (state.pet && day > state.pet.since && (day - state.pet.since) % 30 === 0) {
      money -= PET_MONTHLY;
      parts.push(`comida y veterinario de ${state.pet.name} -${fmt(PET_MONTHLY)}`);
    }
    if (!parts.length) return;
    addStat(state, 'pasivos', Math.max(0, money));
    entry(money >= 0 ? 'bueno' : 'malo', 'Ingresos pasivos', `Día ${day}: ${parts.join(' · ')}.`, applyBars(state, { dinero: money }));
  } else {
    const t = tourismFor(state, date);
    const civic = civicIncome(state);
    const total = t.income + civic;
    if (!total) return;
    state.flags.turistasAyer = t.tourists;
    addStat(state, 'pasivos', total);
    entry('bueno', 'Turismo e ingresos', `Día ${day}: ${t.tourists.toLocaleString('es')} turistas dejaron ${fmt(t.income)}${civic ? ` · obras públicas ${fmt(civic)}` : ''}.`, applyBars(state, { dinero: total }));
  }
}

// ---------------------------------------------------------------------------
// Radio: trabajos extra del inmigrante
// ---------------------------------------------------------------------------

export function todayJobs(state: GameState) {
  return radioJobs(state.seed, state.today.date);
}

export function canTakeRadioJob(state: GameState, now: number): string | null {
  if (state.character.role !== 'inmigrante') return 'Solo para el inmigrante';
  if (state.gameOver) return 'Partida terminada';
  if (state.errand) return 'Ya estás en otro trabajo';
  if (state.shift) return 'Estás en tu jornada';
  if (state.detainedUntil > now) return 'Estás detenido';
  if (state.flags.radioDia === dayNumber(state, now)) return 'Hoy ya hiciste un trabajo de la radio';
  return null;
}

export function takeRadioJob(state: GameState, jobId: string, now: number) {
  advance(state, now);
  const why = canTakeRadioJob(state, now);
  if (why) throw new Error(why);
  const job = RADIO_BY_ID[jobId];
  if (!todayJobs(state).some((j) => j.id === jobId)) throw new Error('Ese trabajo ya no está disponible.');
  state.errand = { startedAt: now, endsAt: now + job.hours * HOUR, kind: 'radio', label: job.label, pay: job.pay, wear: job.wear };
  state.flags.radioDia = dayNumber(state, now);
  log(state, now, 'info', 'Radio', `${state.character.name} acepta el trabajo: ${job.label} (${job.hours} h).`);
}
