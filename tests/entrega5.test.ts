import { describe, expect, it } from 'vitest';
import { EVENTS } from '../src/core/events/catalog';
import {
  advance,
  buildCivic,
  buildHousePhase,
  buyLot,
  buyVending,
  canTakeRadioJob,
  civicIncome,
  newGame,
  renovateBlock,
  repairVending,
  resolveEvent,
  rollOutcome,
  takeRadioJob,
  todayJobs,
  tourismFor,
  VENDING_INCOME,
} from '../src/core/game';
import { CIVIC_BY_ID, HOUSE_PHASES, HOUSE_RENT, citySignature, ownedLot } from '../src/core/lots';
import type { Character, GameState, Role } from '../src/core/types';

const at = (day: number, hour = 9, min = 0) => new Date(2026, 0, day, hour, min).getTime();
const char = (role: Role): Character => ({ role, name: 'Ana', age: 30, look: { outfit: 'a', hair: 'b', skin: 'c', hairColor: 'd', outfitColor: 'e' } });
const game = (role: Role = 'inmigrante') => newGame(char(role), at(1, 5), 3);

function decideOutcome(s: GameState, eventId: string, choiceId: string, outcomeId: string, when: number) {
  const def = EVENTS[eventId];
  const choice = def.choices.find((c) => c.id === choiceId)!;
  let seed = 0;
  while (rollOutcome(s, def, choice, seed).id !== outcomeId) seed++;
  s.pending.push({ instanceId: `t-${eventId}-${when}`, eventId, firedAt: when, seed });
  return resolveEvent(s, `t-${eventId}-${when}`, choiceId, when);
}

describe('solares y casa por fases', () => {
  it('el inmigrante compra un solar y construye su casa fase a fase', () => {
    const s = game();
    s.bars.dinero = 5000;
    buyLot(s, 'L1', at(1, 6));
    expect(ownedLot(s)).toBe('L1');
    expect(() => buyLot(s, 'L2', at(1, 6))).toThrow();
    const sig0 = citySignature(s);
    for (let i = 0; i < HOUSE_PHASES.length; i++) {
      buildHousePhase(s, at(1 + i, 6));
      expect(() => buildHousePhase(s, at(1 + i, 7))).toThrow();
      advance(s, at(2 + i, 6, 30));
      expect(s.lots!.L1.phase).toBe(i + 1);
    }
    expect(citySignature(s)).not.toBe(sig0);
    expect(() => buildHousePhase(s, at(6, 8))).toThrow();
    // La casa terminada se alquila.
    const before = s.bars.dinero!;
    advance(s, at(7, 6));
    expect(s.log.some((l) => l.text.includes('alquiler'))).toBe(true);
    expect(s.bars.dinero!).toBeGreaterThanOrEqual(before - 200 + HOUSE_RENT);
  });

  it('el alcalde construye obras públicas y renueva manzanas', () => {
    const s = game('alcalde');
    s.bars.dinero = 2_000_000;
    expect(() => buyLot(s, 'L1', at(1, 6))).toThrow();
    buildCivic(s, 'L3', 'museo', at(1, 6));
    expect(() => buildCivic(s, 'L3', 'parque', at(1, 6))).toThrow();
    renovateBlock(s, '1,1', at(1, 6));
    advance(s, at(1 + CIVIC_BY_ID.museo.days, 7));
    expect(s.lots!.L3.phase).toBe(1);
    expect(s.renovated!['1,1']).toBe(1);
    expect(civicIncome(s)).toBe(CIVIC_BY_ID.museo.income);
    const t = tourismFor(s, s.today.date);
    expect(t.attractions).toBeCloseTo(1 + 0.6 + 0.08);
  });
});

describe('ingresos pasivos', () => {
  it('las máquinas expendedoras dan dinero cada día, salvo las rotas', () => {
    const s = game();
    s.bars.dinero = 3000;
    buyVending(s, at(1, 6));
    buyVending(s, at(1, 6));
    s.vending!.broken = 1;
    const m = s.bars.dinero!;
    advance(s, at(2, 6));
    const entry = s.log.find((l) => l.title === 'Ingresos pasivos');
    expect(entry?.deltas?.dinero).toBe(VENDING_INCOME);
    expect(s.bars.dinero!).toBeLessThan(m + 2 * VENDING_INCOME);
    repairVending(s, at(2, 7));
    expect(s.vending!.broken).toBe(0);
  });

  it('el turismo depende de la popularidad y el clima', () => {
    const s = game('alcalde');
    s.bars.popularidad = 80;
    const hi = tourismFor(s, s.today.date).tourists;
    s.bars.popularidad = 20;
    expect(tourismFor(s, s.today.date).tourists).toBeLessThan(hi);
    const m = s.bars.dinero!;
    advance(s, at(2, 6));
    expect(s.log.some((l) => l.title === 'Turismo e ingresos')).toBe(true);
    expect(Number(s.flags.turistasAyer)).toBeGreaterThan(0);
    expect(m).toBeGreaterThan(0);
  });
});

describe('mascota', () => {
  it('se adopta en un suceso y cuesta $20 al mes', () => {
    const s = game();
    expect(EVENTS.mascota.condition!(s, 1)).toBe(true);
    decideOutcome(s, 'mascota', 'adoptar', 'familia', at(1, 10));
    expect(s.pet).toBeTruthy();
    expect(s.pet!.since).toBe(1);
    expect(EVENTS.mascota.condition!(s, 1)).toBe(false);
    expect(EVENTS['mascota-enferma'].condition!(s, 1)).toBe(true);
    s.bars.dinero = 1000;
    advance(s, at(32, 6));
    expect(s.log.some((l) => l.text.includes(s.pet!.name) && l.text.includes('-$20'))).toBe(true);
  });
});

describe('radio', () => {
  it('anuncia 3 trabajos al día y solo se acepta uno', () => {
    const s = game();
    const jobs = todayJobs(s);
    expect(jobs).toHaveLength(3);
    expect(canTakeRadioJob(s, at(1, 6))).toBeNull();
    takeRadioJob(s, jobs[0].id, at(1, 6));
    expect(s.errand?.kind).toBe('radio');
    const m = s.bars.dinero!;
    advance(s, at(1, 6) + jobs[0].hours * 3600_000 + 1000);
    expect(s.errand).toBeFalsy();
    expect(s.bars.dinero!).toBe(m + jobs[0].pay);
    expect(canTakeRadioJob(s, at(1, 20))).toMatch(/radio/);
  });
});
