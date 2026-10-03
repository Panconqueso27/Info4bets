import { ACHIEVEMENT_BY_ID, achievementsFor, BIG_BET, FINAL_TEXT, MONEY_FLOOR } from './achievements';
import { EVENTS, eventsFor } from './events/catalog';
import type { ChoiceDef, Effects, EventDef, OutcomeDef } from './events/types';
import { betReturn, closePrices, dayPlan, initialPrices, priceAt, type NewsItem } from './market';
import { ROLES, SHIFT_HOURS } from './roles';
import { hashString, mixSeed, mulberry32, pickWeighted, randRange } from './rng';
import { addDays, dateKey, daysBetween, HOUR, startOfDay } from './time';
import { nextUpgrade, UPGRADES } from './upgrades';
import { errandWeather, weatherFor, weatherWeight, type Weather } from './weather';
import type { BarId, Bars, Character, GameState, LogEntry, LogKind, PendingEvent, Role } from './types';

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

export function newGame(character: Character, now: number, seed = Math.floor(Math.random() * 2 ** 32)): GameState {
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
    .map((e) => ({ ...e, weight: e.weight * weatherWeight(e.id, w) }));
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
  const deltas = mergeDeltas(applyBars(state, { dinero: role.shiftPay }), applyBars(state, wear));
  state.flags.jornadas = Number(state.flags.jornadas ?? 0) + 1;
  log(state, now, 'bueno', 'Jornada completa', `${state.character.name} termina sus 8 horas en ${role.workplace} y cobra ${role.formatMoney(role.shiftPay)}.`, deltas);
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
  if (money < next.cost) throw new Error(`Te faltan ${role.formatMoney(next.cost - money)}.`);
  const deltas = mergeDeltas(applyBars(state, { dinero: -next.cost }), applyBars(state, next.instant));
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
  log(state, now, outcome.result, `${def.title}: ${outcome.title}`, message, deltas);
  if (outcome.effects.endGame) endGame(state, now, outcome.effects.endGame.title, outcome.effects.endGame.text);
  checkGameOver(state, now);
  def.onResolve?.(state, { outcome, deltas, previous, unlock: (id) => unlock(state, id, now) });
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
export function applyMinigame(state: GameState, points: number, now: number): number {
  advance(state, now);
  if (!canPlayMinigame(state, now)) throw new Error('Solo puedes hacerlo durante tu jornada.');
  const n = Math.max(0, Math.min(MAX_POINTS_PER_GAME, Math.floor(points)));
  const shift = state.shift!;
  const before = shift.endsAt;
  shift.endsAt = Math.max(now, shift.endsAt - n * MINUTES_PER_POINT * 60_000);
  const saved = Math.round((before - shift.endsAt) / 60_000);
  const roleId = state.character.role;
  const counter = roleId === 'inmigrante' ? 'platosLavados' : 'documentosFirmados';
  state.flags[counter] = Number(state.flags[counter] ?? 0) + n;
  const what = roleId === 'inmigrante' ? `Lavaste ${n} plato${n === 1 ? '' : 's'}` : `Despachaste ${n} documento${n === 1 ? '' : 's'}`;
  log(state, now, n > 0 ? 'bueno' : 'info', roleId === 'inmigrante' ? 'Lavaplatos' : 'Papeleo', `${what}: la jornada avanza ${saved} min.`);
  return saved;
}

// ---------------------------------------------------------------------------
// Reparto de paquetes (trabajo extra del inmigrante)
// ---------------------------------------------------------------------------

export const ERRAND_PAY = 110;
export const ERRAND_WEAR: Bars = { salud: -3, estres: 3 };
export const CAR_COST = 1500;

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
  state.errand = { startedAt: now, endsAt: now + errandHours(state) * HOUR };
  state.flags.repartoDia = dayNumber(state, now);
  log(state, now, 'info', 'Reparto', `${state.character.name} sale a repartir paquetes por la ciudad (${errandHours(state)} h).`);
}

function finishErrand(state: GameState, at: number) {
  state.errand = null;
  const w = errandWeather(todayWeather(state));
  const pay = ERRAND_PAY + w.extraPay;
  const wear: Bars = { salud: (ERRAND_WEAR.salud ?? 0) - w.extraWear, estres: (ERRAND_WEAR.estres ?? 0) + w.extraWear };
  const deltas = mergeDeltas(applyBars(state, { dinero: pay }), applyBars(state, wear));
  state.flags.repartos = Number(state.flags.repartos ?? 0) + 1;
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
