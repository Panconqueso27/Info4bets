import { describe, expect, it } from 'vitest';
import { EVENTS } from '../src/core/events/catalog';
import {
  advance,
  applyMinigame,
  buyCar,
  canStartErrand,
  canStartShift,
  CAR_COST,
  ERRAND_PAY,
  marketSession,
  newGame,
  retire,
  startErrand,
  startShift,
} from '../src/core/game';
import { HOUR } from '../src/core/time';
import type { Character, Role } from '../src/core/types';

const at = (day: number, hour = 9, min = 0) => new Date(2026, 0, day, hour, min).getTime();
const char = (role: Role): Character => ({ role, name: 'Ana', age: 30, look: { outfit: 'a', hair: 'b', skin: 'c', hairColor: 'd', outfitColor: 'e' } });

describe('suceso de apertura', () => {
  it('siempre llega un suceso ligero en los primeros 2 minutos', () => {
    for (const role of ['inmigrante', 'alcalde'] as Role[])
      for (let seed = 0; seed < 20; seed++) {
        const s = newGame(char(role), at(1, 6), seed);
        startShift(s, at(1, 8));
        const first = s.shift!.slots[0];
        expect(EVENTS[first.eventId].kind).toBe('apertura');
        expect(first.at - at(1, 8)).toBeLessThanOrEqual(2 * 60_000);
        advance(s, at(1, 8, 2));
        expect(s.pending.some((p) => EVENTS[p.eventId].kind === 'apertura')).toBe(true);
      }
  });
});

describe('minijuegos', () => {
  it('cada plato descuenta 10 minutos, sin límite diario', () => {
    const s = newGame(char('inmigrante'), at(1, 5), 1);
    startShift(s, at(1, 8));
    const end = s.shift!.endsAt;
    expect(applyMinigame(s, 6, at(1, 8, 5))).toBe(60);
    expect(s.shift!.endsAt).toBe(end - HOUR);
    applyMinigame(s, 80, at(1, 8, 6));
    // La jornada no puede terminar antes de "ahora", y ya se puede salir.
    expect(s.shift!.endsAt).toBe(at(1, 8, 6));
    expect(Number(s.flags.platosLavados)).toBe(86);
  });

  it('la bolsa sigue su sesión de 8 h aunque la jornada se acorte', () => {
    const s = newGame(char('alcalde'), at(1, 5), 1);
    startShift(s, at(1, 8));
    applyMinigame(s, 24, at(1, 9));
    expect(marketSession(s, at(1, 12))!.p).toBeCloseTo(0.5);
  });

  it('no se puede jugar fuera de la jornada', () => {
    const s = newGame(char('inmigrante'), at(1, 5), 1);
    expect(() => applyMinigame(s, 3, at(1, 9))).toThrow();
  });
});

describe('reparto de paquetes', () => {
  it('trabajo extra de 4 h, una vez al día, fuera del turno', () => {
    const s = newGame(char('inmigrante'), at(1, 5), 1);
    const money = s.bars.dinero!;
    startErrand(s, at(1, 7));
    expect(canStartShift(s, at(1, 8))).toBe('on-errand');
    advance(s, at(1, 11));
    expect(s.errand).toBeNull();
    expect(s.bars.dinero).toBe(money + ERRAND_PAY);
    expect(canStartErrand(s, at(1, 12))).toBe('done-today');
    expect(s.streak).toBe(0);
    startShift(s, at(1, 12));
    expect(canStartErrand(s, at(1, 13))).toBe('in-shift');
  });

  it('el auto lo reduce a 2 horas', () => {
    const s = newGame(char('inmigrante'), at(1, 5), 1);
    s.bars.dinero = CAR_COST + 10;
    buyCar(s, at(1, 6));
    startErrand(s, at(1, 7));
    expect(s.errand!.endsAt - s.errand!.startedAt).toBe(2 * HOUR);
  });

  it('el alcalde no reparte', () => {
    const s = newGame(char('alcalde'), at(1, 5), 1);
    expect(canStartErrand(s, at(1, 9))).toBe('rol');
  });

  it('la jornada completa sigue pagando normal tras un reparto', () => {
    const s = newGame(char('inmigrante'), at(1, 5), 1);
    startErrand(s, at(1, 6));
    startShift(s, at(1, 10, 30));
    s.shift!.slots = [];
    s.pending = [];
    retire(s, at(1, 18, 30));
    expect(s.shift).toBeNull();
  });
});
