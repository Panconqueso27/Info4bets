import { EVENTS, eventsFor } from './events/catalog';
import type { ChoiceDef, Effects, EventDef, OutcomeDef } from './events/types';
import { ROLES, SHIFT_HOURS } from './roles';
import { hashString, mixSeed, mulberry32, pickWeighted, randRange } from './rng';
import { addDays, dateKey, daysBetween, HOUR, startOfDay } from './time';
import type { BarId, Bars, Character, GameState, LogEntry, LogKind, PendingEvent } from './types';

const LOG_LIMIT = 80;
/** Si el jugador vuelve tras mucho tiempo, no simulamos más de un año de días perdidos. */
const MAX_DAYS_TO_CATCH_UP = 366;

/** Huecos de la jornada donde puede aparecer un suceso aleatorio (horas desde el inicio). */
const EVENT_WINDOWS: Array<[number, number]> = [
  [1, 3.5],
  [4, 7],
];
const EVENT_WINDOW_CHANCE = 0.7;

export function newGame(character: Character, now: number, seed = Math.floor(Math.random() * 2 ** 32)): GameState {
  const role = ROLES[character.role];
  const today = dateKey(now);
  const state: GameState = {
    version: 1,
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
  };
  log(state, now, 'info', 'Día 1', `${character.name} empieza su vida en la ciudad. Cada día tendrás que ir ${role.toWorkplace}.`);
  return state;
}

export function dayNumber(state: GameState, now: number): number {
  return Math.max(1, daysBetween(state.startDate, dateKey(now)) + 1);
}

function log(state: GameState, at: number, kind: LogKind, title: string, text: string, deltas?: Bars) {
  const entry: LogEntry = { at, day: dayNumber(state, at), kind, title, text };
  if (deltas && Object.keys(deltas).length) entry.deltas = deltas;
  state.log.unshift(entry);
  if (state.log.length > LOG_LIMIT) state.log.length = LOG_LIMIT;
}

function clampBar(id: BarId, v: number): number {
  return id === 'dinero' ? Math.round(v) : Math.max(0, Math.min(100, v));
}

/** Aplica cambios de barras y devuelve los cambios reales (tras recortar a 0–100). */
export function applyBars(state: GameState, delta: Bars): Bars {
  const applied: Bars = {};
  for (const [k, d] of Object.entries(delta) as [BarId, number][]) {
    if (!d || state.bars[k] === undefined) continue;
    const before = state.bars[k]!;
    const after = clampBar(k, before + d);
    state.bars[k] = after;
    if (after !== before) applied[k] = after - before;
  }
  return applied;
}

function mergeDeltas(a: Bars, b: Bars): Bars {
  const out: Bars = { ...a };
  for (const [k, v] of Object.entries(b) as [BarId, number][]) out[k] = (out[k] ?? 0) + v;
  return out;
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
    if (state.gameOver) break;
  }
  if (state.today.date < todayKey) {
    // Ausencia larguísima: saltamos directamente a hoy.
    state.today = { date: todayKey, worked: false, detained: false };
  }

  if (!state.gameOver && state.shift && !state.shift.cancelled) {
    for (const slot of state.shift.slots) {
      if (!slot.fired && slot.at <= now) {
        slot.fired = true;
        const pending: PendingEvent = {
          instanceId: `${slot.eventId}-${slot.at}`,
          eventId: slot.eventId,
          firedAt: slot.at,
          seed: mixSeed(state.seed, slot.at),
        };
        state.pending.push(pending);
        changed = true;
      }
    }
  }

  if (state.detainedUntil && now >= state.detainedUntil) {
    state.detainedUntil = 0;
    log(state, now, 'info', 'Libertad', `${state.character.name} sale del centro de detención.`);
    changed = true;
  }
  if (state.detainedUntil) state.today.detained = true;

  if (!state.gameOver) changed = checkGameOver(state, now) || changed;
  if (now !== state.lastSeenAt) {
    state.lastSeenAt = now;
  }
  return changed;
}

function closeDay(state: GameState, now: number) {
  const role = ROLES[state.character.role];
  const closing = state.today;
  const closingDay = daysBetween(state.startDate, closing.date) + 1;
  const at = state.lastSeenAt;
  const entry = (kind: LogKind, title: string, text: string, deltas?: Bars) => {
    state.log.unshift({ at, day: closingDay, kind, title, text, ...(deltas && Object.keys(deltas).length ? { deltas } : {}) });
  };

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

  // Gastos fijos y descanso nocturno.
  let deltas = applyBars(state, { dinero: -role.dailyCost });
  deltas = mergeDeltas(deltas, applyBars(state, role.overnight));
  if ((state.bars.dinero ?? 0) < 0) {
    deltas = mergeDeltas(deltas, applyBars(state, role.debtPenalty));
    entry('malo', 'Deudas', `Día ${closingDay}: cerraste el día en números rojos. Las deudas pesan.`, deltas);
  } else {
    entry('info', 'Fin del día', `Día ${closingDay}: gastos del día pagados y una noche de descanso.`, deltas);
  }
  if (state.log.length > LOG_LIMIT) state.log.length = LOG_LIMIT;

  const next = addDays(closing.date, 1);
  state.today = { date: next, worked: false, detained: state.detainedUntil > startOfDay(next) };
  checkGameOver(state, now);
}

// ---------------------------------------------------------------------------
// Rutina diaria
// ---------------------------------------------------------------------------

export type StartBlock = 'game-over' | 'already-worked' | 'in-shift' | 'detained';

export function canStartShift(state: GameState, now: number): StartBlock | null {
  if (state.gameOver) return 'game-over';
  if (state.shift) return 'in-shift';
  if (state.detainedUntil > now) return 'detained';
  if (state.today.worked && state.today.date === dateKey(now)) return 'already-worked';
  return null;
}

export function startShift(state: GameState, now: number): void {
  advance(state, now);
  const block = canStartShift(state, now);
  if (block) throw new Error(`No se puede iniciar la jornada: ${block}`);
  const role = ROLES[state.character.role];
  const rand = mulberry32(mixSeed(state.seed, now));

  // Los sucesos de la jornada se sortean al empezar, para poder programar
  // las notificaciones aunque la app esté cerrada.
  const pool = eventsFor(state.character.role, 'aleatorio');
  const used = new Set<string>();
  const slots = [];
  for (const [from, to] of EVENT_WINDOWS) {
    const available = pool.filter((e) => !used.has(e.id));
    if (!available.length || rand() >= EVENT_WINDOW_CHANCE) continue;
    const ev = pickWeighted(available, rand);
    used.add(ev.id);
    slots.push({ at: Math.round(now + randRange(rand, from, to) * HOUR), eventId: ev.id, fired: false });
  }

  state.shift = { startedAt: now, endsAt: now + SHIFT_HOURS * HOUR, slots };
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
  const role = ROLES[state.character.role];
  const shift = state.shift;
  state.shift = null;
  if (shift.cancelled) {
    log(state, now, 'info', 'Jornada perdida', `${shift.cancelled}. Hoy no hay sueldo.`);
    return;
  }
  const deltas = mergeDeltas(applyBars(state, { dinero: role.shiftPay }), applyBars(state, role.shiftWear));
  log(state, now, 'bueno', 'Jornada completa', `${state.character.name} termina sus 8 horas en ${role.workplace} y cobra ${role.formatMoney(role.shiftPay)}.`, deltas);
  checkGameOver(state, now);
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
  const outcome = rollOutcome(state, def, choice, pending.seed);
  const vars = eventVars(state, def, pending.seed);
  const message = fillText(outcome.message, vars);

  state.pending.splice(idx, 1);
  const deltas = applyEffects(state, outcome.effects, now);
  log(state, now, outcome.result, `${def.title}: ${outcome.title}`, message, deltas);
  checkGameOver(state, now);
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
    state.shift.cancelled = fx.cancelShift;
    // Los sucesos pendientes de esta jornada ya no ocurrirán.
    state.shift.slots = state.shift.slots.filter((s) => s.fired);
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
// Fin de partida
// ---------------------------------------------------------------------------

export function checkGameOver(state: GameState, now: number): boolean {
  if (state.gameOver) return false;
  const b = state.bars;
  const name = state.character.name;
  const day = dayNumber(state, now);
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
  if (!title) return false;
  state.gameOver = { at: now, day, title, text };
  state.shift = null;
  state.pending = [];
  log(state, now, 'malo', title, text);
  return true;
}

/** Herramienta de desarrollo: dispara un suceso ahora mismo. */
export function forceEvent(state: GameState, eventId: string, now: number): void {
  if (!EVENTS[eventId] || state.gameOver) return;
  state.pending.push({ instanceId: `${eventId}-dev-${now}`, eventId, firedAt: now, seed: mixSeed(state.seed, now) });
}
