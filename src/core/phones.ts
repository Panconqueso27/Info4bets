import { advance, applyBars, dayNumber, log, pay, withCat } from './game';
import { countMission } from './economy';
import { emptyDesign, emptyLab, hasPart, launchCost, marketResult, OUTCOME_LABEL, PART_BY_ID, rateDesign, type PhoneDesign, type PhoneLab, type PhoneModel } from './phonecore';
import { mixSeed, mulberry32 } from './rng';
import { ROLES } from './roles';
import type { GameState } from './types';

/**
 * Taller de móviles (trabajo opcional del inmigrante): comprar piezas,
 * guardar el diseño y lanzar modelos al mercado. Un éxito sale en el
 * periódico y deja ingresos cada día mientras se venda.
 */
export function lab(state: GameState): PhoneLab {
  if (!state.phoneLab) state.phoneLab = emptyLab();
  return state.phoneLab;
}

export function canWorkshop(state: GameState, now: number): string | null {
  if (state.character.role !== 'inmigrante') return 'Solo para el inmigrante';
  if (state.gameOver) return 'Partida terminada';
  if (state.detainedUntil > now) return 'Estás detenido';
  return null;
}

/** Desbloquea una pieza de pago (para siempre). */
export function buyPart(state: GameState, id: string, now: number) {
  advance(state, now);
  const p = PART_BY_ID[id];
  if (!p) throw new Error('Esa pieza no existe.');
  const L = lab(state);
  if (hasPart(L, id)) return;
  withCat('inversiones', () => pay(state, p.price));
  L.owned.push(id);
  log(state, now, 'info', 'Taller de móviles', `Compras ${p.name} (${p.kind}) por ${ROLES[state.character.role].formatMoney(p.price)}.`, { dinero: -p.price });
}

/** Guarda el diseño en la mesa (sin coste). */
export function saveDraft(state: GameState, d: PhoneDesign) {
  lab(state).draft = JSON.parse(JSON.stringify(d));
}

/** Lanza el modelo de la mesa con ese nombre y precio. */
export function launchPhone(state: GameState, d: PhoneDesign, price: number, now: number) {
  advance(state, now);
  const why = canWorkshop(state, now);
  if (why) throw new Error(why);
  const L = lab(state);
  for (const id of [d.shape, d.pantalla?.id, d.camara?.id, d.procesador?.id, d.bateria?.id]) if (id && !hasPart(L, id)) throw new Error('Esa pieza aún no la tienes.');
  const r = rateDesign(d);
  if (!r.ok) throw new Error(r.issues.find((i) => i.level === 'grave')?.text ?? 'El móvil no está terminado.');
  const name = d.name.trim().slice(0, 18) || 'Mi móvil';
  const day = dayNumber(state, now);
  if (L.models.some((m) => m.launchedDay === day)) throw new Error('Hoy ya lanzaste un móvil. Las fábricas necesitan un día.');
  const cost = launchCost(r);
  withCat('inversiones', () => pay(state, cost));
  const rand = mulberry32(mixSeed(state.seed, now));
  const res = marketResult(r, price, day, rand() * 2 - 1);
  // versión: mismo nombre que uno anterior = nueva versión que lo sustituye
  const prev = L.models.filter((m) => m.name.replace(/ \d+$/, '') === name.replace(/ \d+$/, ''));
  const version = prev.length ? Math.max(...prev.map((m) => m.version)) + 1 : 1;
  for (const m of prev) m.retired = true;
  const fullName = version > 1 ? `${name.replace(/ \d+$/, '')} ${version}` : name;
  const model: PhoneModel = {
    id: `m${day}-${L.models.length}`,
    name: fullName,
    version,
    design: JSON.parse(JSON.stringify({ ...d, name: fullName })),
    total: r.total,
    price,
    margin: res.margin,
    units: res.units,
    launchedDay: day,
    outcome: res.outcome,
    earned: 0,
  };
  L.models.push(model);
  L.draft = JSON.parse(JSON.stringify({ ...d, name: fullName }));
  const fmt = ROLES[state.character.role].formatMoney;
  const me = state.character.name;
  const headline =
    res.outcome === 'bombazo'
      ? { title: `Locura por el ${fullName}: colas en la Quinta Avenida`, text: `El móvil de ${me}, un inventor del barrio, se agota en las tiendas. Los expertos hablan de revolución.` }
      : res.outcome === 'exito'
        ? { title: `El ${fullName} triunfa en Nueva York`, text: `${me} lo diseñó en un taller de Brooklyn y ya se ve en todos los bolsillos.` }
        : res.outcome === 'discreto'
          ? { title: `Llega el ${fullName}, un móvil «correcto»`, text: 'Las críticas lo ven aceptable, pero la competencia aprieta.' }
          : { title: `El ${fullName}, otro móvil que nadie pidió`, text: 'Las tiendas devuelven las cajas. Habrá que volver a la mesa de trabajo.' };
  if (res.outcome === 'exito' || res.outcome === 'bombazo') {
    L.press.unshift({ date: state.today.date, ...headline });
    L.press = L.press.slice(0, 12);
    state.notices.push({ kind: 'aviso', title: '📰 TECNOLOGÍA', text: headline.title });
    withCat('negocios', () => applyBars(state, { reputacion: res.outcome === 'bombazo' ? 6 : 3, esperanza: res.outcome === 'bombazo' ? 6 : 3 }));
  }
  countMission(state, 'actividad', 1);
  log(
    state,
    now,
    res.outcome === 'fracaso' ? 'malo' : 'bueno',
    `Lanzamiento: ${fullName}`,
    `${OUTCOME_LABEL[res.outcome]} Nota ${r.total} frente a ${res.level} que exige el mercado. Precio ${fmt(price)} (justo: ${fmt(res.fair)}). Lanzarlo costó ${fmt(cost)}.`,
    { dinero: -cost },
  );
  return { model, result: res, cost, headline };
}

/** Lleva un modelo a la mesa para sacar una versión mejorada. */
export function improveModel(state: GameState, modelId: string) {
  const L = lab(state);
  const m = L.models.find((x) => x.id === modelId);
  if (!m) return;
  L.draft = JSON.parse(JSON.stringify(m.design));
}

export function newDraft(state: GameState) {
  lab(state).draft = emptyDesign();
}
