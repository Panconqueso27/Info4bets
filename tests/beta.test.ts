import { describe, expect, it } from 'vitest';
import { ROLES } from '../src/core/roles';
import { ACHIEVEMENTS, achievementsFor } from '../src/core/achievements';
import { EVENTS, eventsFor } from '../src/core/events/catalog';
import {
  actionStatus,
  advance,
  buyUpgrade,
  canStartShift,
  checkGameOver,
  dayNumber,
  evaluateAchievements,
  marketSession,
  newGame,
  placeBet,
  quote,
  resolveEvent,
  retire,
  rollOutcome,
  startAction,
  startShift,
} from '../src/core/game';
import { betReturn, COMPANIES, dayPlan, NEWS_ACCURACY, priceAt } from '../src/core/market';
import { UPGRADES } from '../src/core/upgrades';
import type { Character, GameState, Role } from '../src/core/types';

const at = (day: number, hour = 9) => new Date(2026, 0, day, hour).getTime();
const char = (role: Role): Character => ({ role, name: 'Ana', age: 30, look: { outfit: 'a', hair: 'b', skin: 'c', hairColor: 'd', outfitColor: 'e' } });
/** Sin misiones del día: sus premios alterarían los importes exactos. */
const noMissions = <T extends { missions?: unknown; today: { date: string } }>(s: T) => ((s.missions = { date: s.today.date, list: [] }), s);
const game = (role: Role = 'inmigrante', seed = 42) => noMissions(newGame(char(role), at(1), seed));

/** Juega una jornada completa sin sucesos. */
function workDay(s: GameState, day: number) {
  startShift(s, at(day, 8));
  s.shift!.slots = [];
  retire(s, at(day, 16));
  s.pending = s.pending.filter((p) => EVENTS[p.eventId].kind === 'diario');
}

describe('bolsa', () => {
  it('es determinista y las noticias aciertan la mayoría de las veces', () => {
    expect(dayPlan(1, '2026-01-05')).toEqual(dayPlan(1, '2026-01-05'));
    let hits = 0, total = 0;
    for (let d = 1; d <= 28; d++) {
      const plan = dayPlan(9, `2026-02-${String(d).padStart(2, '0')}`);
      for (const n of plan.news) {
        total++;
        if ((plan.moves[n.ticker] >= 0 ? 'up' : 'down') === n.hint) hits++;
      }
    }
    expect(hits / total).toBeGreaterThan(NEWS_ACCURACY - 0.15);
    expect(hits / total).toBeLessThan(1);
  });

  it('el precio va de la apertura al cierre del día', () => {
    const plan = dayPlan(3, '2026-01-02');
    const c = COMPANIES[0];
    expect(priceAt(3, '2026-01-02', c.ticker, 100, 0)).toBeCloseTo(100);
    expect(priceAt(3, '2026-01-02', c.ticker, 100, 1)).toBeCloseTo(100 * (1 + plan.moves[c.ticker]));
  });

  it('acertar gana dinero y fallar lo pierde', () => {
    expect(betReturn(100, 1, 10, 10.5)).toBeGreaterThan(0);
    expect(betReturn(100, -1, 10, 10.5)).toBeLessThan(0);
    expect(betReturn(100, -1, 10, 20)).toBe(-100);
  });

  it('solo se apuesta durante la jornada y se liquida al salir', () => {
    const s = game();
    expect(() => placeBet(s, 'ATLM', 1, 50, at(1, 9))).toThrow();
    startShift(s, at(1, 8));
    s.shift!.slots = [];
    expect(marketSession(s, at(1, 10))).not.toBeNull();
    const before = s.bars.dinero!;
    placeBet(s, 'ATLM', 1, 50, at(1, 9));
    expect(s.bars.dinero).toBe(before - 50);
    const entry = quote(s, 'ATLM', at(1, 9), 1 / 8);
    const exit = quote(s, 'ATLM', at(1, 16), 1);
    retire(s, at(1, 16));
    const expected = before + betReturn(50, 1, entry, exit) + ROLES.inmigrante.shiftPay;
    expect(Math.abs(s.bars.dinero! - expected)).toBeLessThanOrEqual(1);
    expect(s.market.bets).toHaveLength(0);
    expect(s.log.some((l) => l.title === 'Cierre de la bolsa')).toBe(true);
  });
});

describe('mejoras permanentes', () => {
  it('cuestan varios días y suben por niveles', () => {
    const s = game();
    expect(() => buyUpgrade(s, at(1))).toThrow(/Te faltan/);
    const lv = UPGRADES.inmigrante.levels;
    expect(lv[0].cost).toBeLessThan(lv[1].cost);
    expect(lv[1].cost).toBeLessThan(lv[2].cost);
    // Con el sueldo neto diario no se compra de un día para otro.
    expect(lv[0].cost - s.bars.dinero!).toBeGreaterThan(5 * (ROLES.inmigrante.shiftPay - ROLES.inmigrante.dailyCost));
    s.bars.dinero = 10_000;
    buyUpgrade(s, at(1));
    expect(s.upgradeLevel).toBe(1);
    expect(s.achievements.inm04).toBeDefined();
  });

  it('la casa mejora la recuperación de salud cada noche', () => {
    const a = game();
    const b = game();
    a.bars.salud = 50;
    b.bars.salud = 50;
    b.upgradeLevel = 2;
    advance(a, at(2));
    advance(b, at(2));
    expect(b.bars.salud! - a.bars.salud!).toBe(4);
  });

  it('el ayudante del alcalde sube el control a diario', () => {
    const s = game('alcalde');
    s.upgradeLevel = 3;
    const c = s.bars.control!;
    advance(s, at(2));
    expect(s.bars.control).toBe(c + 3);
  });
});

describe('logros', () => {
  it('hay 25 por personaje y el último es el final', () => {
    for (const role of ['inmigrante', 'alcalde'] as Role[]) {
      const list = achievementsFor(role);
      expect(list).toHaveLength(25);
      expect(list[24].final).toBe(true);
    }
  });

  it('todos los logros sin comprobación se desbloquean desde algún suceso', () => {
    const fromEvents = new Set<string>();
    for (const e of Object.values(EVENTS)) for (const c of e.choices) for (const o of c.outcomes) for (const u of o.effects.unlock ?? []) fromEvents.add(u);
    const hooks = ['alc02', 'alc04', 'alc16', 'alc21', 'alc22', 'alc23'];
    for (const a of ACHIEVEMENTS) if (!a.check) expect(fromEvents.has(a.id) || hooks.includes(a.id)).toBe(true);
  });

  it('tres jornadas = trabajo estable, con recompensa', () => {
    const s = game();
    workDay(s, 1);
    workDay(s, 2);
    const hope = s.bars.esperanza!;
    workDay(s, 3);
    expect(s.achievements.inm01).toBeDefined();
    expect(s.bars.esperanza).toBeGreaterThan(hope - 1);
    expect(s.log.some((l) => l.title.includes('Trabajo estable'))).toBe(true);
  });

  it('el final positivo se alcanza y se puede seguir jugando', () => {
    const s = game();
    s.upgradeLevel = 3;
    Object.assign(s.bars, { esperanza: 90, reputacion: 90, estres: 10, dinero: 5000 });
    for (const a of achievementsFor('inmigrante').slice(0, 15)) s.achievements[a.id] = 1;
    evaluateAchievements(s, at(1, 10));
    expect(s.ending?.title).toBe('Estabilidad total');
    expect(s.gameOver).toBeNull();
  });
});

describe('sucesos diarios y acciones', () => {
  it('cada 7 días toca decidir si enviar dinero a la familia', () => {
    const s = game();
    advance(s, at(7, 9));
    expect(s.pending.some((p) => p.eventId === 'remesa')).toBe(true);
    const res = resolveEvent(s, s.pending.find((p) => p.eventId === 'remesa')!.instanceId, 'cien', at(7, 10));
    expect(res.deltas.dinero).toBeLessThan(0);
    expect(res.deltas.esperanza).toBeDefined();
  });

  it('al día 31 el alcalde va a elecciones', () => {
    const s = game('alcalde');
    s.bars.dinero = 10_000_000;
    s.bars.popularidad = 100;
    s.bars.control = 100;
    advance(s, at(31, 9));
    const ev = s.pending.find((p) => p.eventId === 'elecciones');
    expect(ev).toBeDefined();
    const res = resolveEvent(s, ev!.instanceId, 'recuento', at(31, 10));
    expect(res.outcome.id).toBe('reelecto');
    expect(s.term).toBe(2);
    expect(s.achievements.alc24).toBeDefined();
  });

  it('perder las elecciones termina la partida', () => {
    const s = game('alcalde');
    s.bars.popularidad = 1;
    s.bars.dinero = 10_000_000;
    s.bars.control = 100;
    const pending = { instanceId: 'e', eventId: 'elecciones', firedAt: at(1), seed: 0 };
    let seed = 0;
    while (rollOutcome(s, EVENTS.elecciones, EVENTS.elecciones.choices[0], seed).id !== 'derrota') seed++;
    s.pending.push({ ...pending, seed });
    resolveEvent(s, 'e', 'recuento', at(1, 10));
    expect(s.gameOver?.title).toBe('Derrotado en las urnas');
  });

  it('las acciones tienen enfriamiento', () => {
    const s = game('alcalde');
    const def = EVENTS.prensa;
    expect(actionStatus(s, def, at(1)).ok).toBe(true);
    const p = startAction(s, 'prensa', at(1));
    resolveEvent(s, p.instanceId, 'entrevistas', at(1, 10));
    expect(actionStatus(s, def, at(2)).ok).toBe(false);
    advance(s, at(4));
    expect(actionStatus(s, def, at(4)).ok).toBe(true);
  });

  it('las opciones con requisito no se pueden elegir sin cumplirlo', () => {
    const s = game();
    s.bars.reputacion = 10;
    s.pending.push({ instanceId: 'm', eventId: 'manifestacion', firedAt: at(1), seed: 1 });
    expect(() => resolveEvent(s, 'm', 'organizar', at(1, 10))).toThrow(/reputación/);
  });

  it('la asesoría legal reduce los resultados graves de las redadas', () => {
    const s = game();
    const def = EVENTS.redada;
    const bad = (st: GameState) => {
      let n = 0;
      for (let seed = 0; seed < 3000; seed++) if (['detenido', 'cerco'].includes(rollOutcome(st, def, def.choices[0], seed).id)) n++;
      return n;
    };
    const sin = bad(s);
    s.flags.asesoriaLegal = true;
    expect(bad(s)).toBeLessThan(sin * 0.7);
  });
});

describe('integridad del catálogo', () => {
  it('cada suceso tiene resultados buenos o malos con mensaje, y existe para ambos roles', () => {
    expect(eventsFor('inmigrante', 'aleatorio').length).toBeGreaterThanOrEqual(2);
    expect(eventsFor('alcalde', 'aleatorio').length).toBeGreaterThanOrEqual(3);
    expect(eventsFor('alcalde', 'accion')).toHaveLength(7);
    for (const e of Object.values(EVENTS))
      for (const c of e.choices) {
        expect(c.outcomes.length).toBeGreaterThan(0);
        for (const o of c.outcomes) {
          expect(o.message.length).toBeGreaterThan(30);
          expect(['bueno', 'malo']).toContain(o.result);
        }
      }
  });

  it('los sucesos que llegan solos siempre tienen una opción sin requisitos', () => {
    for (const e of Object.values(EVENTS)) if (e.kind !== 'accion') expect(e.choices.some((c) => !c.requires)).toBe(true);
  });

  it('no se puede empezar una acción que no puedes pagar', () => {
    const s = game();
    s.bars.dinero = 10;
    expect(actionStatus(s, EVENTS.idioma, at(1)).ok).toBe(false);
    expect(() => startAction(s, 'idioma', at(1))).toThrow(/\$60/);
  });

  it('salud a cero lleva al hospital, no al fin de partida', () => {
    const s = game();
    s.bars.salud = 0;
    checkGameOver(s, at(1, 10));
    expect(s.gameOver).toBeNull();
    expect(s.bars.salud).toBe(25);
  });

  it('una partida larga simulada no se rompe', () => {
    for (const role of ['inmigrante', 'alcalde'] as Role[]) {
      const s = game(role, 77);
      for (let d = 1; d <= 60 && !s.gameOver; d++) {
        if (!canStartShift(s, at(d, 8))) startShift(s, at(d, 8));
        advance(s, at(d, 17));
        for (let i = 0; i < 5 && s.pending.length; i++) {
          const p = s.pending[0];
          const def = EVENTS[p.eventId];
          const choice = def.choices.find((c) => !c.requires || c.requires.check(s))!;
          resolveEvent(s, p.instanceId, choice.id, at(d, 17));
        }
        if (s.shift) retire(s, at(d, 17));
      }
      expect(dayNumber(s, at(60, 18))).toBe(60);
      expect(Number.isFinite(s.bars.dinero)).toBe(true);
    }
  });
});
