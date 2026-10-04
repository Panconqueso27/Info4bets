import { describe, expect, it } from 'vitest';
import {
  advance,
  buildBusiness,
  buildCivic,
  buildHousePhase,
  buyLot,
  businessIncome,
  civicIncome,
  newGame,
  priceOfLot,
  retire,
  startMega,
  startShift,
  upgradeCivic,
  upgradeLot,
} from '../src/core/game';
import {
  applyHotdogs,
  auctionLot,
  betBaseball,
  betRace,
  buyBond,
  buyRastro,
  buyTicket,
  canRace,
  canRastro,
  canTaxi,
  countMission,
  ensureMissions,
  lotteryDraw,
  rastroItems,
  startClasses,
  startTaxi,
} from '../src/core/economy';
import { districtOf } from '../src/core/city';
import { LOTS, MEGA, MAX_LOTS, citySignature, districtLevel, lotLevel } from '../src/core/lots';
import type { Character, Role } from '../src/core/types';

// 1 de enero de 2026 es jueves: el 3 es sábado y el 4, domingo.
const at = (day: number, hour = 9, min = 0) => new Date(2026, 0, day, hour, min).getTime();
const char = (role: Role): Character => ({ role, name: 'Ana', age: 30, look: { outfit: 'a', hair: 'b', skin: 'c', hairColor: 'd', outfitColor: 'e' } });
const game = (role: Role = 'inmigrante') => {
  const s = newGame(char(role), at(1, 5), 3);
  s.missions = { date: s.today.date, list: [] };
  return s;
};

describe('ciudad doble', () => {
  it('tiene 16 solares en 7 barrios de Manhattan y Brooklyn', () => {
    expect(LOTS).toHaveLength(16);
    expect(new Set(LOTS.map((l) => l.district)).size).toBe(7);
    expect(LOTS.filter((l) => l.c >= 4).length).toBe(10);
    expect(districtOf(0, 0)).toBe('midtown');
    expect(districtOf(4, 0)).toBe('muelles');
    expect(districtOf(6, 8)).toBe('coney');
  });

  it('el precio del solar depende del barrio', () => {
    const s = game();
    expect(priceOfLot(s, 'L1', at(1, 6))).toBeGreaterThan(priceOfLot(s, 'L7', at(1, 6)));
  });
});

describe('construcciones del inmigrante', () => {
  it('hasta 3 solares, con casa por fases y negocios con niveles', () => {
    const s = game();
    s.bars.dinero = 50_000;
    buyLot(s, 'L7', at(1, 6));
    buyLot(s, 'L8', at(1, 6));
    buyLot(s, 'L9', at(1, 6));
    expect(() => buyLot(s, 'L10', at(1, 6))).toThrow(String(MAX_LOTS));
    buildBusiness(s, 'L7', 'lavanderia', at(1, 7));
    buildHousePhase(s, at(1, 7), 'L8');
    advance(s, at(2, 8));
    expect(lotLevel(s.lots!.L7)).toBe(1);
    expect(s.lots!.L8.phase).toBe(1);
    upgradeLot(s, 'L7', at(2, 9));
    advance(s, at(3, 10));
    expect(lotLevel(s.lots!.L7)).toBe(2);
    expect(businessIncome(s).find((b) => b.id === 'L7')!.income).toBeGreaterThan(40);
    // La casa sigue por fases y luego sube a dúplex
    for (let d = 3; d <= 5; d++) {
      buildHousePhase(s, at(d, 11), 'L8');
      advance(s, at(d + 1, 12));
    }
    expect(lotLevel(s.lots!.L8)).toBe(1);
    upgradeLot(s, 'L8', at(6, 12));
    advance(s, at(9, 13));
    expect(lotLevel(s.lots!.L8)).toBe(2);
    expect(s.log.some((l) => l.title === 'Ingresos pasivos' && l.text.includes('dúplex'))).toBe(true);
  });

  it('construir sube el nivel del barrio', () => {
    const s = game();
    s.bars.dinero = 50_000;
    const before = citySignature(s);
    buyLot(s, 'L7', at(1, 6));
    buildBusiness(s, 'L7', 'taller', at(1, 6));
    advance(s, at(3, 7));
    upgradeLot(s, 'L7', at(3, 7));
    advance(s, at(6, 7));
    expect(districtLevel(s, 'muelles')).toBeGreaterThanOrEqual(1);
    expect(citySignature(s)).not.toBe(before);
  });
});

describe('alcalde: obras, grandes proyectos, bonos y subastas', () => {
  it('las obras públicas suben a nivel 3 y multiplican sus ingresos', () => {
    const s = game('alcalde');
    s.bars.dinero = 20_000_000;
    buildCivic(s, 'L3', 'metro', at(1, 6));
    advance(s, at(6, 7));
    const base = civicIncome(s);
    upgradeCivic(s, 'L3', at(6, 7));
    advance(s, at(9, 8));
    expect(lotLevel(s.lots!.L3)).toBe(2);
    expect(civicIncome(s)).toBeGreaterThan(base);
    upgradeCivic(s, 'L3', at(9, 8));
    advance(s, at(13, 9));
    expect(lotLevel(s.lots!.L3)).toBe(3);
    expect(() => upgradeCivic(s, 'L3', at(13, 9))).toThrow();
  });

  it('un gran proyecto tarda días y da turismo e ingresos', () => {
    const s = game('alcalde');
    s.bars.dinero = 20_000_000;
    const m = MEGA.find((x) => x.id === 'estadio')!;
    startMega(s, 'estadio', at(1, 6));
    expect(() => startMega(s, 'estadio', at(1, 6))).toThrow();
    advance(s, at(1 + m.days, 7));
    expect(s.projects!.estadio.done).toBe(true);
    expect(civicIncome(s)).toBe(m.income);
  });

  it('los bonos devuelven intereses y la subasta da dinero', () => {
    const s = game('alcalde');
    const m0 = s.bars.dinero!;
    buyBond(s, 100_000, 3, at(1, 6));
    advance(s, at(4, 7));
    expect(s.bonds).toHaveLength(0);
    expect(s.log.some((l) => l.title === 'Bonos vencidos')).toBe(true);
    const m1 = s.bars.dinero!;
    auctionLot(s, 'L7', at(4, 8));
    expect(s.lots!.L7.owner).toBe('privado');
    expect(s.bars.dinero!).toBeGreaterThan(m1);
    expect(m0).toBeGreaterThan(0);
  });
});

describe('dinero fuera del trabajo', () => {
  it('taxi con auto y clases de español, una vez al día', () => {
    const s = game();
    expect(canTaxi(s, at(1, 18))).toMatch(/auto/);
    s.flags.auto = true;
    startTaxi(s, at(1, 18));
    expect(s.errand?.kind).toBe('taxi');
    const m = s.bars.dinero!;
    advance(s, at(1, 20, 1));
    expect(s.bars.dinero!).toBeGreaterThan(m);
    expect(canTaxi(s, at(1, 21))).toMatch(/Hoy/);
    startClasses(s, at(1, 21));
    advance(s, at(1, 22, 1));
    expect(s.log.some((l) => l.title === 'Clases de español')).toBe(true);
  });

  it('el puesto de perritos paga por cada perrito servido', () => {
    const s = game();
    const m = s.bars.dinero!;
    applyHotdogs(s, 12, at(1, 18));
    expect(s.bars.dinero!).toBe(m + 48);
    expect(() => applyHotdogs(s, 5, at(1, 19))).toThrow();
  });

  it('el rastro solo abre los domingos y el hipódromo el fin de semana', () => {
    const s = game();
    s.bars.dinero = 1000;
    expect(canRastro(s, at(1, 10))).toMatch(/domingo/);
    expect(canRace(s, at(1, 10))).toMatch(/fin de semana/);
    advance(s, at(4, 10));
    expect(canRastro(s, at(4, 10))).toBeNull();
    const item = rastroItems(s)[0];
    buyRastro(s, item.id, at(4, 10));
    expect(() => buyRastro(s, item.id, at(4, 10))).toThrow();
    const r = betRace(s, 0, 10, at(4, 11));
    expect(r.order).toHaveLength(5);
    const g = betBaseball(s, 'yankees', 10, at(4, 12));
    expect(g.winner === 'yankees' ? g.won : 0).toBe(g.won);
  });

  it('la lotería sortea al cerrar la semana', () => {
    const s = game();
    const draw = lotteryDraw(s, 0);
    buyTicket(s, draw, at(1, 10));
    advance(s, at(8, 6));
    expect(s.log.some((l) => l.title === 'Sorteo de la lotería' && l.text.includes('Premio'))).toBe(true);
    expect(s.lottery).toHaveLength(0);
  });
});

describe('economía de fondo', () => {
  it('el libro de cuentas apunta cada categoría y cierra cada semana', () => {
    const s = game();
    startShift(s, at(1, 6));
    s.pending = [];
    retire(s, at(1, 14, 1));
    expect(s.ledger!.cats.sueldo).toBeGreaterThan(0);
    advance(s, at(8, 6));
    expect(s.lastLedger!.cats.gastos).toBeLessThan(0);
    expect(s.notices.some((n) => n.title === 'CUENTAS DE LA SEMANA')).toBe(true);
  });

  it('cada mes sube el alquiler y llegan impuestos', () => {
    const s = game();
    s.bars.dinero = 10_000;
    buyLot(s, 'L7', at(1, 6));
    advance(s, at(31, 6));
    expect(Number(s.flags.alquilerExtra)).toBe(5);
    expect(s.log.some((l) => l.title === 'Facturas del mes')).toBe(true);
  });

  it('las misiones del día pagan al completarse', () => {
    const s = game();
    s.missions = undefined;
    ensureMissions(s);
    expect(s.missions!.list).toHaveLength(3);
    const m = s.missions!.list[0];
    const before = s.bars.dinero!;
    countMission(s, m.key, m.target);
    expect(m.done).toBe(true);
    expect(s.bars.dinero!).toBeGreaterThanOrEqual(before + m.reward);
  });
});
