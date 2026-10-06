import { describe, expect, it } from 'vitest';
import { advance, newGame } from '../src/core/game';
import { canCasino, casinoChips, casinoLossLimit, casinoSettle, casinoToday } from '../src/core/economy';
import { BAD_LINES, citizenLine, GOOD_LINES } from '../src/core/citizens';
import type { Character, Role } from '../src/core/types';

const char = (role: Role, age = 30): Character => ({ role, name: 'Test', age, look: { outfit: 'a', hair: 'b', skin: 'c', hairColor: 'd', outfitColor: 'e' } });
// sábado a las 20:00 (sin jornada en curso)
const at = new Date(2026, 0, 3, 20).getTime();

describe('casino', () => {
  it('solo entran los mayores de 21', () => {
    expect(canCasino(newGame(char('inmigrante', 19), at, 1), at)).toMatch(/21/);
    expect(canCasino(newGame(char('inmigrante', 30), at, 1), at)).toBeNull();
  });

  it('cobra lo apostado y paga lo devuelto', () => {
    const s = newGame(char('inmigrante'), at, 1);
    advance(s, at);
    // sin misiones del día (una misión de apostar daría su premio)
    s.missions = { date: s.today.date, list: [] };
    const before = s.bars.dinero!;
    expect(casinoSettle(s, at, 'blackjack', 20, 50, 'Blackjack.')).toBe(30);
    expect(s.bars.dinero).toBe(before + 30);
    expect(casinoSettle(s, at, 'ruleta', 25, 0, 'Rojo.')).toBe(-25);
    expect(s.bars.dinero).toBe(before + 5);
    expect(casinoToday(s, at)).toBe(5);
  });

  it('no deja apostar más de lo que hay', () => {
    const s = newGame(char('inmigrante'), at, 1);
    expect(() => casinoSettle(s, at, 'poker', s.bars.dinero! + 1, 0, 'Póker.')).toThrow();
  });

  it('cierra al llegar al límite de pérdidas del día', () => {
    const s = newGame(char('alcalde'), at, 1);
    s.bars.dinero = 10 * casinoLossLimit(s);
    casinoSettle(s, at, 'ruleta', casinoLossLimit(s), 0, 'Todo al negro.');
    expect(canCasino(s, at)).toMatch(/Límite/);
    // al día siguiente se puede volver
    expect(canCasino(s, at + 86_400_000)).toBeNull();
  });

  it('las fichas del alcalde van en miles', () => {
    expect(casinoChips(newGame(char('alcalde'), at, 1))[0]).toBe(1000);
    expect(casinoChips(newGame(char('inmigrante'), at, 1))[0]).toBe(1);
  });
});

describe('vecinos', () => {
  it('hay 50 frases buenas y 50 malas, sin repetir', () => {
    expect(GOOD_LINES.length).toBe(50);
    expect(BAD_LINES.length).toBe(50);
    expect(new Set([...GOOD_LINES, ...BAD_LINES]).size).toBe(100);
  });

  it('cuanto mejor va la ciudad, más frases buenas', () => {
    let r = 1;
    const rand = () => ((r = (r * 16807) % 2147483647) / 2147483647);
    const share = (mood: number) => Array.from({ length: 2000 }, () => citizenLine(mood, rand).good).filter(Boolean).length / 2000;
    expect(share(0.9)).toBeGreaterThan(0.6);
    expect(share(0.1)).toBeLessThan(0.35);
  });
});
