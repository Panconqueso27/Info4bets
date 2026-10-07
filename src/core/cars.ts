import { advance, applyBars, dayNumber, log, pay, withCat } from './game';
import { countMission } from './economy';
import { CAR_MARKETING, CAR_OUTCOME_LABEL, carItemName, carItemPrice, carLaunchCost, carMarket, emptyCarLab, hasCarItem, testCar, type CarDesign, type CarLab, type CarMarketingId, type CarModel, type CarRunId } from './carcore';
import { mixSeed, mulberry32 } from './rng';
import { ROLES } from './roles';
import type { GameState } from './types';

/**
 * Pixelopolis Motors: el alcalde diseña coches en la mesa de planos de la
 * fábrica y los lanza al mercado. Un éxito da empleo (popularidad), sale
 * en el periódico, deja ingresos y sus coches circulan por la ciudad.
 */
export function carLab(state: GameState): CarLab {
  if (!state.carLab) state.carLab = emptyCarLab();
  return state.carLab;
}

export function canFactory(state: GameState, now: number): string | null {
  if (state.character.role !== 'alcalde') return 'Solo para el alcalde';
  if (state.gameOver) return 'Partida terminada';
  if (state.detainedUntil > now) return 'Estás detenido';
  return null;
}

/** Desbloquea una pieza, una pintura ("color:id") o un extra ("extra:id"). */
export function buyCarItem(state: GameState, key: string, now: number) {
  advance(state, now);
  if (!carItemName(key)) throw new Error('Eso no existe.');
  const L = carLab(state);
  if (hasCarItem(L, key)) return;
  const price = carItemPrice(key);
  withCat('inversiones', () => pay(state, price));
  L.owned.push(key);
  log(state, now, 'info', 'Pixelopolis Motors', `Los ingenieros desarrollan ${carItemName(key)} por ${ROLES[state.character.role].formatMoney(price)}.`, { dinero: -price });
}

export function saveCarDraft(state: GameState, d: CarDesign) {
  carLab(state).draft = JSON.parse(JSON.stringify(d));
}

export function launchCar(state: GameState, d: CarDesign, price: number, now: number, mkt: CarMarketingId = 'nada', run: CarRunId = 'media') {
  advance(state, now);
  const why = canFactory(state, now);
  if (why) throw new Error(why);
  const L = carLab(state);
  const keys = [d.carroceria, d.motor, d.caja, d.ruedas, d.interior, d.seguridad, `color:${d.color}`, ...d.extras.map((e) => `extra:${e}`)];
  for (const k of keys) if (!hasCarItem(L, k)) throw new Error('Esa pieza aún no está desarrollada.');
  const day = dayNumber(state, now);
  if (L.models.some((m) => m.launchedDay === day)) throw new Error('La cadena de montaje ya está ocupada hoy.');
  const r = testCar(d, day);
  const cost = carLaunchCost(r, run, mkt);
  withCat('inversiones', () => pay(state, cost));
  const rand = mulberry32(mixSeed(state.seed, now + 7));
  const res = carMarket(d, r, price, day, state.seed, rand() * 2 - 1, mkt, run);
  const base = d.name.trim().slice(0, 18).replace(/ \d+$/, '') || 'Pixel';
  const prev = L.models.filter((m) => m.name.replace(/ \d+$/, '') === base);
  const version = prev.length ? Math.max(...prev.map((m) => m.version)) + 1 : 1;
  for (const m of prev) m.retired = true;
  const name = version > 1 ? `${base} ${version}` : base;
  const model: CarModel = { id: `c${day}-${L.models.length}`, name, version, design: JSON.parse(JSON.stringify({ ...d, name })), score: res.score, price, margin: res.margin, units: res.units, launchedDay: day, outcome: res.outcome, causes: res.causes, earned: 0 };
  L.models.push(model);
  L.draft = JSON.parse(JSON.stringify({ ...d, name }));
  const good = res.outcome === 'exito' || res.outcome === 'bombazo';
  const headline = good
    ? { title: res.outcome === 'bombazo' ? `El ${name} arrasa: colas en los concesionarios` : `El ${name}, el coche del momento`, text: `Pixelopolis Motors, la fábrica impulsada por el alcalde, da trabajo a cientos de vecinos.` }
    : res.outcome === 'discreto'
      ? { title: `El ${name} llega sin hacer ruido`, text: 'Ventas correctas, pero la competencia de Detroit aprieta.' }
      : { title: `El ${name}, un fracaso del alcalde`, text: 'La oposición pide explicaciones por el dinero invertido.' };
  // empleo y prensa: la fábrica pesa en la popularidad
  const pop = res.outcome === 'bombazo' ? 6 : res.outcome === 'exito' ? 3 : res.outcome === 'fracaso' ? -3 : 0;
  const scandal = !r.emisionesOk ? -3 : 0;
  if (pop || scandal) withCat('negocios', () => applyBars(state, { popularidad: pop + scandal }));
  if (good || res.outcome === 'fracaso') {
    L.press.unshift({ date: state.today.date, ...headline });
    L.press = L.press.slice(0, 12);
    state.notices.push({ kind: 'aviso', title: '📰 MOTOR', text: headline.title });
  }
  countMission(state, 'actividad', 1);
  const fmt = ROLES[state.character.role].formatMoney;
  log(
    state,
    now,
    res.outcome === 'fracaso' ? 'malo' : 'bueno',
    `Lanzamiento: ${name}`,
    `${CAR_OUTCOME_LABEL[res.outcome]} ${res.causes.map((c) => (c.good ? '✔ ' : '✖ ') + c.text).join(' ')} Campaña: ${CAR_MARKETING.find((m) => m.id === mkt)!.name.toLowerCase()}. Costó ${fmt(cost)}.`,
    { dinero: -cost, ...(pop + scandal ? { popularidad: pop + scandal } : {}) },
  );
  return { model, result: res, cost, headline, report: r };
}

/** Colores de los coches de la marca que circulan por la ciudad (para el mapa). */
export function brandCars(state: GameState): { color: string; n: number }[] {
  const out: { color: string; n: number }[] = [];
  for (const m of state.carLab?.models ?? []) {
    if (m.retired || m.outcome === 'fracaso') continue;
    const n = m.outcome === 'bombazo' ? 8 : m.outcome === 'exito' ? 5 : 2;
    out.push({ color: m.design.color, n });
  }
  return out;
}
