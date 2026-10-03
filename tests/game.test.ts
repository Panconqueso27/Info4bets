import { describe, expect, it } from 'vitest';
import { EVENTS } from '../src/core/events/catalog';
import {
  advance,
  canRetire,
  canStartShift,
  dayNumber,
  newGame,
  resolveEvent,
  retire,
  rollOutcome,
  startShift,
} from '../src/core/game';
import { ROLES } from '../src/core/roles';
import { HOUR } from '../src/core/time';
import type { Character, GameState, Role } from '../src/core/types';

const at = (day: number, hour = 9) => new Date(2026, 0, day, hour).getTime();

function char(role: Role): Character {
  return { role, name: 'Ana', age: 30, look: { outfit: 'a', hair: 'b', skin: 'c', hairColor: 'd', outfitColor: 'e' } };
}

function game(role: Role = 'inmigrante'): GameState {
  return newGame(char(role), at(1), 42);
}

describe('días y racha', () => {
  it('el contador de días avanza con el calendario', () => {
    const s = game();
    expect(dayNumber(s, at(1))).toBe(1);
    expect(dayNumber(s, at(5, 23))).toBe(5);
  });

  it('ir a trabajar suma racha; faltar la rompe sin reiniciar los días', () => {
    const s = game();
    startShift(s, at(1));
    retire(s, at(1, 18));
    startShift(s, at(2));
    retire(s, at(2, 18));
    expect(s.streak).toBe(2);
    advance(s, at(4, 10)); // el día 3 no fue
    expect(s.streak).toBe(0);
    expect(s.bestStreak).toBe(2);
    expect(dayNumber(s, at(4, 10))).toBe(4);
    expect(s.gameOver).toBeNull();
  });

  it('faltar un día deja sin sueldo pero cobra los gastos', () => {
    const s = game();
    const r = ROLES.inmigrante;
    const start = s.bars.dinero!;
    advance(s, at(2));
    expect(s.bars.dinero).toBe(start - r.dailyCost);
  });

  it('solo una jornada por día', () => {
    const s = game();
    startShift(s, at(1, 8));
    retire(s, at(1, 16));
    expect(canStartShift(s, at(1, 17))).toBe('already-worked');
    expect(canStartShift(s, at(2, 8))).toBeNull();
  });
});

describe('jornada de 8 horas', () => {
  it('no se puede retirar antes de 8 horas y se cobra al salir', () => {
    const s = game();
    const money = s.bars.dinero!;
    startShift(s, at(1, 8));
    expect(canRetire(s, at(1, 15) + 59 * 60_000)).toBe(false);
    expect(() => retire(s, at(1, 15))).toThrow();
    expect(canRetire(s, at(1, 16))).toBe(true);
    s.pending = [];
    retire(s, at(1, 16));
    expect(s.bars.dinero).toBe(money + ROLES.inmigrante.shiftPay);
    expect(s.shift).toBeNull();
  });

  it('los sucesos sorteados aparecen cuando llega su hora', () => {
    // Buscamos una semilla con al menos un suceso en la jornada.
    let s = game();
    for (let seed = 0; seed < 50; seed++) {
      s = newGame(char('inmigrante'), at(1), seed);
      startShift(s, at(1, 8));
      if (s.shift!.slots.some((x) => x.eventId === 'redada')) break;
    }
    const slot = s.shift!.slots.find((x) => x.eventId === 'redada')!;
    expect(slot.at).toBeGreaterThan(at(1, 8));
    expect(slot.at).toBeLessThan(at(1, 16));
    advance(s, slot.at - 1);
    expect(s.pending.some((p) => p.eventId === 'redada')).toBe(false);
    s.pending = [];
    advance(s, slot.at);
    expect(s.pending.map((p) => p.eventId)).toContain('redada');
  });
});

function withPending(role: Role, eventId: string, seed: number): GameState {
  const s = newGame(char(role), at(1), 7);
  startShift(s, at(1, 8));
  s.shift!.slots = [];
  s.pending = [{ instanceId: 'x', eventId, firedAt: at(1, 10), seed }];
  return s;
}

describe('redada', () => {
  it('sortea entre 5 resultados equiprobables (2 buenos, 3 malos)', () => {
    const def = EVENTS.redada;
    const counts: Record<string, number> = {};
    const s = game();
    for (let seed = 0; seed < 5000; seed++) {
      const o = rollOutcome(s, def, def.choices[0], seed);
      counts[o.id] = (counts[o.id] ?? 0) + 1;
    }
    expect(Object.keys(counts).sort()).toEqual(['cerco', 'comunidad', 'detenido', 'esconder', 'familiar']);
    for (const n of Object.values(counts)) expect(n).toBeGreaterThan(850);
    expect(def.choices[0].outcomes.filter((o) => o.result === 'bueno')).toHaveLength(2);
  });

  it('la detención dura un día, anula el sueldo y congela la racha', () => {
    const def = EVENTS.redada;
    let seed = 0;
    while (rollOutcome(game(), def, def.choices[0], seed).id !== 'detenido') seed++;
    const s = withPending('inmigrante', 'redada', seed);
    const before = { ...s.bars };
    const res = resolveEvent(s, 'x', 'aguantar', at(1, 10));
    expect(res.outcome.result).toBe('malo');
    expect(res.message).toContain('24 horas');
    expect(s.bars.esperanza).toBeLessThan(before.esperanza!);
    expect(s.bars.reputacion).toBeLessThan(before.reputacion!);
    expect(s.shift!.cancelled).toBeTruthy();

    retire(s, at(1, 11)); // jornada anulada: no cobra
    expect(s.bars.dinero).toBe(before.dinero! - 150);

    expect(canStartShift(s, at(2, 9))).toBe('detained');
    expect(canStartShift(s, at(2, 10))).toBeNull();
    // Si tras salir no va a trabajar, la racha no se rompe (estuvo detenido).
    advance(s, at(3, 9));
    expect(s.streak).toBe(1);
  });
});

describe('huelga', () => {
  it('ceder cuesta el 25% del dinero y sube popularidad y control', () => {
    const s = withPending('alcalde', 'huelga', 1);
    const before = { ...s.bars };
    const res = resolveEvent(s, 'x', 'ceder', at(1, 10));
    expect(res.outcome.result).toBe('bueno');
    expect(s.bars.dinero).toBe(Math.round(before.dinero! * 0.75));
    expect(s.bars.popularidad).toBeGreaterThan(before.popularidad!);
    expect(s.bars.control).toBeGreaterThan(before.control!);
    expect(res.message.length).toBeGreaterThan(20);
  });

  it('no ceder suele salir mal', () => {
    const def = EVENTS.huelga;
    const choice = def.choices.find((c) => c.id === 'resistir')!;
    let bad = 0;
    for (let seed = 0; seed < 2000; seed++) if (rollOutcome(game('alcalde'), def, choice, seed).result === 'malo') bad++;
    expect(bad / 2000).toBeGreaterThan(0.68);
    expect(bad / 2000).toBeLessThan(0.82);
  });
});

describe('fin de partida', () => {
  it('el alcalde cae si la popularidad llega a cero', () => {
    const s = game('alcalde');
    s.bars.popularidad = 1;
    s.pending = [];
    startShift(s, at(1, 8));
    s.bars.popularidad = 0;
    advance(s, at(1, 9));
    expect(s.gameOver?.title).toBe('Destituido');
    expect(canStartShift(s, at(2))).toBe('game-over');
  });

  it('el inmigrante se va si el estrés llega al máximo o la esperanza a cero', () => {
    const a = game();
    a.bars.estres = 100;
    advance(a, at(1, 10));
    expect(a.gameOver?.title).toBe('Ya no puedo más');
    const b = game();
    b.bars.esperanza = 0;
    advance(b, at(1, 10));
    expect(b.gameOver?.title).toBe('De vuelta a casa');
  });

  it('todos los resultados de sucesos traen mensaje narrativo', () => {
    for (const def of Object.values(EVENTS))
      for (const c of def.choices)
        for (const o of c.outcomes) {
          expect(o.message.length).toBeGreaterThan(40);
          expect(['bueno', 'malo']).toContain(o.result);
        }
  });
});

it('volver tras una larga ausencia no rompe el juego', () => {
  const s = game('alcalde');
  advance(s, at(1) + 400 * 24 * HOUR);
  expect(s.today.date).toBeDefined();
});
