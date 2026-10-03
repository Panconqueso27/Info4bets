import { describe, expect, it } from 'vitest';
import { ROLES } from '../src/core/roles';
import { EVENTS } from '../src/core/events/catalog';
import {
  advance,
  buyUpgrade,
  DEFAULT_OTHER,
  evaluateAchievements,
  gameStats,
  newGame,
  resolveEvent,
  retire,
  rollOutcome,
  shiftPay,
  startShift,
  viewEvent,
} from '../src/core/game';
import { afinidad, knownNpcs } from '../src/core/npcs';
import { achievementsFor } from '../src/core/achievements';
import { UPGRADES } from '../src/core/upgrades';
import type { Character, GameState, Role } from '../src/core/types';

const at = (day: number, hour = 9, min = 0) => new Date(2026, 0, day, hour, min).getTime();
const char = (role: Role): Character => ({ role, name: 'Ana', age: 30, look: { outfit: 'a', hair: 'b', skin: 'c', hairColor: 'd', outfitColor: 'e' } });
const game = (role: Role = 'inmigrante') => newGame(char(role), at(1, 5), 3);

function decide(s: GameState, eventId: string, choiceId: string, when = at(1, 10)) {
  s.pending.push({ instanceId: `t-${eventId}-${when}`, eventId, firedAt: when, seed: 1 });
  return resolveEvent(s, `t-${eventId}-${when}`, choiceId, when);
}

describe('personajes recurrentes', () => {
  it('recuerdan tus decisiones y cambian la afinidad', () => {
    const s = game();
    decide(s, 'vecino', 'ayudar');
    expect(afinidad(s, 'carmen')).toBe(2);
    expect(knownNpcs(s)[0].recuerdos[0]).toContain('$40');
    decide(s, 'vecino', 'negar', at(1, 11));
    expect(afinidad(s, 'carmen')).toBe(0);
  });

  it('vuelven con sucesos según cómo los trataste', () => {
    const s = game();
    expect(EVENTS['carmen-favor'].condition!(s, 1)).toBe(false);
    decide(s, 'vecino', 'ayudar');
    expect(EVENTS['carmen-favor'].condition!(s, 1)).toBe(true);
    decide(s, 'vecino', 'negar', at(1, 11));
    decide(s, 'vecino', 'negar', at(1, 12));
    expect(EVENTS['carmen-chisme'].condition!(s, 1)).toBe(true);
  });

  it('Sal te sube el sueldo si te ganas su confianza', () => {
    const s = game();
    decide(s, 'ap-cubrir', 'si');
    decide(s, 'ap-cubrir', 'si', at(1, 11));
    expect(EVENTS['sal-aumento'].condition!(s, 1)).toBe(true);
    let seed = 0;
    while (rollOutcome(s, EVENTS['sal-aumento'], EVENTS['sal-aumento'].choices[0], seed).id !== 'sube') seed++;
    s.pending.push({ instanceId: 'x', eventId: 'sal-aumento', firedAt: at(1, 12), seed });
    resolveEvent(s, 'x', 'aceptar', at(1, 12));
    expect(shiftPay(s)).toBe(ROLES.inmigrante.shiftPay + 20);
  });

  it('Don Ramiro, al que escondiste, te consigue descuento en la casa', () => {
    const s = game();
    s.flags.ramiroEscondido = true;
    expect(EVENTS['ramiro-pista'].condition!(s, 1)).toBe(true);
    s.flags.descuentoCasa = true;
    s.bars.dinero = UPGRADES.inmigrante.levels[0].cost * 0.8;
    buyUpgrade(s, at(1, 12));
    expect(s.upgradeLevel).toBe(1);
    expect(s.bars.dinero).toBe(0);
    expect(s.flags.descuentoCasa).toBe(false);
  });
});

describe('encuentros entre protagonistas', () => {
  it('el otro protagonista aparece con su nombre', () => {
    const s = game();
    expect(s.other?.name).toBe(DEFAULT_OTHER.alcalde.name);
    const v = viewEvent(s, { instanceId: 'c', eventId: 'cruce-visita', firedAt: at(1), seed: 1 });
    expect(v.intro).toContain(DEFAULT_OTHER.alcalde.name);
  });

  it('usa tu personaje de una partida anterior', () => {
    const s = newGame(char('alcalde'), at(1, 5), 3, { role: 'inmigrante', name: 'Rosa', look: char('inmigrante').look, legacy: true });
    const v = viewEvent(s, { instanceId: 'c', eventId: 'cruce-diner', firedAt: at(1), seed: 1 });
    expect(v.intro).toContain('Rosa');
  });
});

describe('rachas y armario', () => {
  it('a los 7 días hay recompensa y ropa nueva', () => {
    const s = game();
    for (let d = 1; d <= 7; d++) {
      startShift(s, at(d, 8));
      s.shift!.slots = [];
      s.pending = s.pending.filter((p) => EVENTS[p.eventId].kind === 'diario');
      retire(s, at(d, 16));
      s.pending = [];
    }
    expect(s.streak).toBe(7);
    expect(s.cosmetics).toContain('cuero');
    expect(s.flags.racha7).toBe(true);
    expect(s.notices.some((n) => n.kind === 'racha')).toBe(true);
  });

  it('5 logros desbloquean la permanente', () => {
    const s = game();
    for (const a of achievementsFor('inmigrante').slice(0, 5)) s.achievements[a.id] = 1;
    evaluateAchievements(s, at(1, 10));
    expect(s.cosmetics).toContain('permanente');
  });
});

describe('temporada y estadísticas', () => {
  it('Halloween solo sale a finales de octubre', () => {
    const def = EVENTS['halloween-inmigrante'];
    const s = game();
    expect(def.condition!(s, 1)).toBe(false);
    s.today.date = '2026-10-30';
    expect(def.condition!(s, 1)).toBe(true);
  });

  it('las estadísticas cuentan lo que hiciste', () => {
    const s = game();
    decide(s, 'vecino', 'ayudar');
    startShift(s, at(1, 8));
    s.shift!.slots = [];
    s.pending = [];
    retire(s, at(1, 16));
    advance(s, at(1, 17));
    const st = gameStats(s, at(1, 17));
    expect(st.jornadas).toBe(1);
    expect(st.ingresos).toBe(ROLES.inmigrante.shiftPay);
    expect(st.buenos + st.malos).toBe(1);
    expect(st.personas).toBe(1);
    expect(st.destacadas.length).toBe(1);
  });
});
