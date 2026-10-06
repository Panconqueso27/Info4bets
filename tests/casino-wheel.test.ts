import { describe, expect, it } from 'vitest';
import {
  adjacent,
  ballAt,
  chipBreakdown,
  chipSpot,
  CLOTH_H,
  CLOTH_W,
  colorOf,
  cornerAt,
  hotCold,
  lineAt,
  makeBet,
  outsideBets,
  PAYOUT,
  planSpin,
  pocketAngle,
  POCKET,
  resolveSpin,
  shortAmount,
  splitOf,
  streetAt,
  wheelAngle,
  WHEEL_ORDER,
  type Bet,
} from '../src/ui/casino/roulette-logic';
import {
  betReturn,
  drawOrder,
  makeField,
  mulberry32,
  overround,
  placeProb,
  planRace,
  progress,
  settleRace,
  standings,
  toFraction,
} from '../src/ui/casino/horses-logic';

const REDS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];

describe('ruleta: cilindro', () => {
  it('orden europeo real, 37 casillas distintas', () => {
    expect(WHEEL_ORDER.join(',')).toBe('0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26');
    expect(new Set(WHEEL_ORDER).size).toBe(37);
  });
  it('colores correctos y alternos en el cilindro', () => {
    expect(colorOf(0)).toBe('verde');
    for (let n = 1; n <= 36; n++) expect(colorOf(n)).toBe(REDS.includes(n) ? 'rojo' : 'negro');
    for (let i = 1; i < 36; i++) expect(colorOf(WHEEL_ORDER[i])).not.toBe(colorOf(WHEEL_ORDER[i + 1]));
  });
  it('la bola acaba exactamente en la casilla del resultado', () => {
    for (const n of [0, 17, 26, 32]) {
      const plan = planSpin(n, 1.3, mulberry32(n + 1));
      const b = ballAt(plan, plan.settle);
      expect(b.settled).toBe(true);
      const rel = (((b.angle - wheelAngle(plan, plan.settle)) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
      expect(Math.abs(rel - pocketAngle(n))).toBeLessThan(1e-9);
      // justo antes, ya cerca de la casilla y bajando
      const pre = ballAt(plan, plan.settle - 0.01);
      expect(Math.abs(pre.rel - pocketAngle(n))).toBeLessThan(POCKET);
      // al principio va en sentido contrario al cilindro
      const a0 = ballAt(plan, 0).angle;
      const a1 = ballAt(plan, 0.05).angle;
      expect(a1 - a0).toBeLessThan(0);
      expect(wheelAngle(plan, 0.05) - wheelAngle(plan, 0)).toBeGreaterThan(0);
    }
  });
});

describe('ruleta: apuestas y pagos', () => {
  const pay = (bet: Bet, result: number, amount = 10) => resolveSpin([{ bet, amount }], result).returned;

  it('tabla de pagos', () => {
    expect(PAYOUT).toMatchObject({ pleno: 35, caballo: 17, calle: 11, cuadro: 8, linea: 5, docena: 2, columna: 2, rojo: 1, negro: 1, par: 1, impar: 1, falta: 1, pasa: 1 });
  });
  it('pleno 35:1 (incluido el cero)', () => {
    expect(pay(makeBet('pleno', [17]), 17)).toBe(360);
    expect(pay(makeBet('pleno', [17]), 18)).toBe(0);
    expect(pay(makeBet('pleno', [0]), 0)).toBe(360);
  });
  it('caballo 17:1 solo entre casillas contiguas', () => {
    expect(splitOf(17, 20)?.numbers).toEqual([17, 20]);
    expect(splitOf(17, 18)?.numbers).toEqual([17, 18]);
    expect(splitOf(18, 19)).toBeNull(); // fin de fila
    expect(splitOf(0, 2)?.numbers).toEqual([0, 2]);
    expect(splitOf(0, 4)).toBeNull();
    expect(adjacent(3, 6)).toBe(true);
    const s = splitOf(17, 20)!;
    expect(pay(s, 20)).toBe(180);
    expect(pay(s, 17)).toBe(180);
    expect(pay(s, 19)).toBe(0);
  });
  it('calle 11:1', () => {
    expect(streetAt(14).numbers).toEqual([13, 14, 15]);
    expect(streetAt(0).numbers).toEqual([0, 1, 2]);
    expect(pay(streetAt(14), 15)).toBe(120);
    expect(pay(streetAt(14), 16)).toBe(0);
  });
  it('cuadro 8:1 (y los cuatro primeros)', () => {
    expect(cornerAt(1).numbers).toEqual([1, 2, 4, 5]);
    expect(cornerAt(3).numbers).toEqual([2, 3, 5, 6]);
    expect(cornerAt(36).numbers).toEqual([32, 33, 35, 36]);
    expect(cornerAt(0).numbers).toEqual([0, 1, 2, 3]);
    expect(pay(cornerAt(1), 5)).toBe(90);
    expect(pay(cornerAt(1), 3)).toBe(0);
  });
  it('línea 5:1', () => {
    expect(lineAt(1).numbers).toEqual([1, 2, 3, 4, 5, 6]);
    expect(lineAt(35).numbers).toEqual([31, 32, 33, 34, 35, 36]);
    expect(pay(lineAt(4), 9)).toBe(60);
    expect(pay(lineAt(4), 10)).toBe(0);
  });
  it('docenas y columnas 2:1', () => {
    expect(outsideBets.docena(1).numbers).toEqual([13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24]);
    expect(outsideBets.columna(0).numbers).toEqual([1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34]);
    expect(outsideBets.columna(2).numbers).toContain(36);
    expect(pay(outsideBets.docena(2), 30)).toBe(30);
    expect(pay(outsideBets.columna(1), 2)).toBe(30);
    expect(pay(outsideBets.docena(0), 0)).toBe(0);
  });
  it('sencillas 1:1 y el cero pierde (con la partage, recupera la mitad)', () => {
    expect(outsideBets.rojo().numbers).toEqual(REDS);
    expect(outsideBets.rojo().numbers.length).toBe(18);
    expect(outsideBets.negro().numbers.length).toBe(18);
    expect(pay(outsideBets.rojo(), 3)).toBe(20);
    expect(pay(outsideBets.negro(), 3)).toBe(0);
    expect(pay(outsideBets.par(), 8)).toBe(20);
    expect(pay(outsideBets.impar(), 8)).toBe(0);
    expect(pay(outsideBets.falta(), 18)).toBe(20);
    expect(pay(outsideBets.pasa(), 19)).toBe(20);
    for (const k of ['rojo', 'negro', 'par', 'impar', 'falta', 'pasa'] as const) {
      expect(pay(outsideBets[k](), 0)).toBe(0);
      expect(resolveSpin([{ bet: outsideBets[k](), amount: 10 }], 0, true).returned).toBe(5);
    }
  });
  it('ventaja de la casa 1/37 en todas las apuestas', () => {
    const bets: Bet[] = [makeBet('pleno', [7]), splitOf(7, 8)!, streetAt(7), cornerAt(7), lineAt(7), outsideBets.docena(0), outsideBets.columna(0), outsideBets.rojo(), outsideBets.par()];
    for (const b of bets) {
      let back = 0;
      for (let n = 0; n <= 36; n++) back += pay(b, n, 1);
      expect(back / 37).toBeCloseTo(36 / 37, 10);
    }
  });
  it('varias apuestas a la vez', () => {
    const r = resolveSpin(
      [
        { bet: makeBet('pleno', [17]), amount: 5 },
        { bet: outsideBets.negro(), amount: 10 },
        { bet: outsideBets.par(), amount: 10 },
      ],
      17,
    );
    expect(r.staked).toBe(25);
    expect(r.returned).toBe(180 + 20);
    expect(r.lines.map((l) => l.won)).toEqual([true, true, false]);
  });
  it('fichas en el tapete dentro de sus límites', () => {
    const all: Bet[] = [makeBet('pleno', [0]), makeBet('pleno', [36]), splitOf(0, 1)!, streetAt(0), cornerAt(0), lineAt(34), outsideBets.columna(2), outsideBets.pasa()];
    for (const b of all) {
      const s = chipSpot(b);
      expect(s.x).toBeGreaterThanOrEqual(0);
      expect(s.x).toBeLessThanOrEqual(CLOTH_W);
      expect(s.y).toBeGreaterThanOrEqual(0);
      expect(s.y).toBeLessThanOrEqual(CLOTH_H);
    }
  });
  it('utilidades', () => {
    expect(chipBreakdown(131, [1, 5, 25, 100])).toEqual([100, 25, 5, 1]);
    expect(shortAmount(1500)).toBe('1.5K');
    expect(shortAmount(25000)).toBe('25K');
    const hc = hotCold([17, 17, 17, 5, 5, 3]);
    expect(hc.hot[0]).toBe(17);
    expect(hc.hot[1]).toBe(5);
    expect(hc.cold).not.toContain(17);
  });
});

describe('carreras de caballos', () => {
  it('cuotas con margen de la casa ≈12 % (nunca a favor del jugador)', () => {
    const rnd = mulberry32(7);
    for (let k = 0; k < 200; k++) {
      const field = makeField(rnd);
      expect(field).toHaveLength(6);
      expect(field.reduce((a, h) => a + h.p, 0)).toBeCloseTo(1, 9);
      expect(overround(field)).toBeGreaterThanOrEqual(0.119);
      for (const h of field) {
        // valor esperado de ganador y colocado por debajo de 1
        expect(h.p * h.win).toBeLessThan(0.9);
        const q = placeProb(
          field.map((x) => x.p),
          h.no - 1,
        );
        expect(q * h.place).toBeLessThanOrEqual(1 / 1.12 + 1e-9);
        expect(h.place).toBeGreaterThanOrEqual(1.05);
      }
      // el favorito paga menos
      const fav = [...field].sort((a, b) => b.p - a.p);
      expect(fav[0].win).toBeLessThanOrEqual(fav[5].win);
    }
    expect(toFraction(6)).toEqual([5, 1]);
    expect(toFraction(3.4)).toEqual([9, 4]);
  });
  it('las probabilidades de colocado suman 2', () => {
    const ps = [0.4, 0.2, 0.15, 0.1, 0.1, 0.05];
    expect(ps.reduce((a, _, i) => a + placeProb(ps, i), 0)).toBeCloseTo(2, 9);
  });
  it('el orden se sortea según las probabilidades', () => {
    const ps = [0.5, 0.2, 0.1, 0.1, 0.05, 0.05];
    const rnd = mulberry32(99);
    const wins = new Array(6).fill(0);
    const N = 20000;
    for (let i = 0; i < N; i++) {
      const o = drawOrder(ps, rnd);
      expect(new Set(o).size).toBe(6);
      wins[o[0]]++;
    }
    ps.forEach((p, i) => expect(wins[i] / N).toBeCloseTo(p, 1));
  });
  it('pagos de ganador y colocado', () => {
    const field = makeField(mulberry32(3));
    const order = [2, 0, 5, 1, 3, 4];
    expect(betReturn({ kind: 'ganador', horse: 2, amount: 10 }, field, order)).toBe(Math.floor(10 * field[2].win));
    expect(betReturn({ kind: 'ganador', horse: 0, amount: 10 }, field, order)).toBe(0);
    expect(betReturn({ kind: 'colocado', horse: 0, amount: 10 }, field, order)).toBe(Math.floor(10 * field[0].place));
    expect(betReturn({ kind: 'colocado', horse: 2, amount: 10 }, field, order)).toBe(Math.floor(10 * field[2].place));
    expect(betReturn({ kind: 'colocado', horse: 5, amount: 10 }, field, order)).toBe(0);
    const r = settleRace(
      [
        { kind: 'ganador', horse: 2, amount: 10 },
        { kind: 'colocado', horse: 5, amount: 20 },
      ],
      field,
      order,
    );
    expect(r.staked).toBe(30);
    expect(r.returned).toBe(Math.floor(10 * field[2].win));
  });
  it('la carrera avanza siempre hacia delante y llegan en el orden sorteado', () => {
    for (let k = 0; k < 60; k++) {
      const rnd = mulberry32(1000 + k);
      const field = makeField(rnd);
      const order = drawOrder(
        field.map((h) => h.p),
        rnd,
      );
      const plan = planRace(field, order, rnd);
      let backwards = 0;
      let early = 0;
      for (const r of plan.runners) {
        let prev = -1;
        for (let t = 0; t < r.finish + 3; t += 0.02) {
          const x = progress(r, t);
          if (x < prev - 1e-12) backwards++;
          if (t < r.finish - 1e-6 && x >= 1) early++;
          prev = x;
        }
        expect(progress(r, r.finish)).toBeCloseTo(1, 9);
      }
      expect(backwards).toBe(0);
      expect(early).toBe(0);
      const finishOrder = [...plan.runners].sort((a, b) => a.finish - b.finish).map((r) => r.horse);
      expect(finishOrder).toEqual(order);
      expect(standings(plan, plan.runners[order[5]].finish + 0.5)).toEqual(order);
    }
  });
});
