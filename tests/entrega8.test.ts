import { describe, expect, it } from 'vitest';
import { advance, newGame } from '../src/core/game';
import { CONTESTS, canEnterContest, contestOpen, contestRivals, enterContest, finishContest, withdrawContest } from '../src/core/contests';
import type { Character, Role } from '../src/core/types';

// 1 de enero de 2026 es jueves: el 3 es sábado y el 4, domingo.
const at = (day: number, hour = 9) => new Date(2026, 0, day, hour).getTime();
const char = (role: Role): Character => ({ role, name: 'Ana', age: 30, look: { outfit: 'a', hair: 'b', skin: 'c', hairColor: 'd', outfitColor: 'e' } });
const game = (role: Role = 'inmigrante') => {
  const s = newGame(char(role), at(1, 5), 3);
  s.missions = { date: s.today.date, list: [] };
  return s;
};

describe('concursos', () => {
  it('cada concurso abre sus días y tiene un favorito difícil de batir', () => {
    const s = game();
    advance(s, at(4, 10)); // domingo
    const open = CONTESTS.filter((c) => contestOpen(s, c)).map((c) => c.id);
    expect(open).toContain('perritos');
    expect(open).toContain('maraton');
    expect(open).not.toContain('breakdance');
    const rivals = contestRivals(s, 'perritos');
    expect(rivals).toHaveLength(4);
    expect(rivals[0].score).toBeGreaterThanOrEqual(CONTESTS.find((c) => c.id === 'perritos')!.rival.top - 1.2);
  });

  it('inscribirse cobra, ganar paga y solo se compite una vez al día', () => {
    const s = game();
    advance(s, at(4, 10));
    s.missions = { date: s.today.date, list: [] };
    const m = s.bars.dinero!;
    enterContest(s, 'perritos', at(4, 10));
    expect(s.bars.dinero!).toBe(m - 5);
    const r = finishContest(s, 'perritos', 99, at(4, 10));
    expect(r.place).toBe(1);
    expect(s.bars.dinero!).toBe(m - 5 + 180);
    expect(canEnterContest(s, 'perritos', at(4, 11))).toMatch(/hoy/);
    // con una marca floja no hay premio
    enterContest(s, 'maraton', at(4, 12));
    const r2 = finishContest(s, 'maraton', 5, at(4, 12));
    expect(r2.place).toBe(5);
    expect(r2.prize).toBe(0);
  });

  it('retirarse antes de empezar devuelve la inscripción', () => {
    const s = game();
    advance(s, at(4, 10));
    const m = s.bars.dinero!;
    enterContest(s, 'maraton', at(4, 10));
    withdrawContest(s, 'maraton');
    expect(s.bars.dinero!).toBe(m);
    expect(canEnterContest(s, 'maraton', at(4, 11))).toBeNull();
  });
});
