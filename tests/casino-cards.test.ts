import { describe, expect, it } from 'vitest';
import {
  act,
  aiDecide,
  awardPots,
  bjLabel,
  bjTotal,
  buildPots,
  C,
  chen,
  dealerHits,
  equity,
  evaluate,
  finish,
  isBlackjack,
  legal,
  makeDeck,
  nextStreet,
  potTotal,
  seeded,
  shuffle,
  startHand,
  type Card,
  type PState,
} from '../src/ui/casino/poker-eval';

const H = (s: string): Card[] => s.split(' ').map(C);

describe('baraja', () => {
  it('52 cartas distintas por baraja y 312 en el sabot de 6', () => {
    const d = makeDeck();
    expect(d).toHaveLength(52);
    expect(new Set(d.map((c) => `${c.r}${c.s}`)).size).toBe(52);
    expect(makeDeck(6)).toHaveLength(312);
    expect(new Set(makeDeck(6).map((c) => c.id)).size).toBe(312);
  });
  it('barajar conserva las cartas', () => {
    const d = makeDeck();
    const s = shuffle(d.slice(), seeded(3));
    expect(s.map((c) => c.id).sort()).toEqual(d.map((c) => c.id).sort());
    expect(s.map((c) => c.id)).not.toEqual(d.map((c) => c.id));
  });
});

describe('blackjack', () => {
  it('totales duros y blandos', () => {
    expect(bjTotal(H('As 6h'))).toEqual({ total: 17, soft: true });
    expect(bjLabel(H('As 6h'))).toBe('7/17');
    expect(bjTotal(H('As 6h Td'))).toEqual({ total: 17, soft: false });
    expect(bjTotal(H('As Ad 9c'))).toEqual({ total: 21, soft: true });
    expect(bjLabel(H('As Kd'))).toBe('21');
    expect(bjTotal(H('Kd Qs 5c')).total).toBe(25);
  });
  it('blackjack natural, no tras dividir', () => {
    expect(isBlackjack(H('As Kd'))).toBe(true);
    expect(isBlackjack(H('As Kd'), true)).toBe(false);
    expect(isBlackjack(H('7s 7d 7c'))).toBe(false);
  });
  it('la banca se planta con 17 blando (S17)', () => {
    expect(dealerHits(H('As 6h'))).toBe(false);
    expect(dealerHits(H('Ts 6h'))).toBe(true);
    expect(dealerHits(H('As 5h'))).toBe(true);
  });
});

describe('evaluador de póker', () => {
  const cat = (s: string) => evaluate(H(s));
  it('reconoce todas las categorías', () => {
    expect(cat('As Ks Qs Js Ts 2d 3c').name).toBe('Escalera real');
    expect(cat('9h 8h 7h 6h 5h Ad Ac').name).toBe('Escalera de color');
    expect(cat('9h 9d 9c 9s 5h Ad Ac').name).toBe('Póker');
    expect(cat('9h 9d 9c 5s 5h Ad 2c').name).toBe('Full');
    expect(cat('2h 9h Jh 5h Kh Ad Ac').name).toBe('Color');
    expect(cat('Ah 2d 3c 4s 5h Kd Kc').name).toBe('Escalera');
    expect(cat('9h 9d 9c Js 5h Ad 2c').name).toBe('Trío');
    expect(cat('9h 9d Jc Js 5h Ad 2c').name).toBe('Doble pareja');
    expect(cat('9h 9d Jc Qs 5h Ad 2c').name).toBe('Pareja');
    expect(cat('9h 7d Jc Qs 5h Ad 2c').name).toBe('Carta alta');
  });
  it('describe la mano en español', () => {
    expect(cat('Kh Kd Kc 3s 3h').desc).toBe('Full de reyes y treses');
    expect(cat('Ah Ad 7c 3s 2h').desc).toBe('Pareja de ases');
    expect(cat('Ah 2d 3c 4s 5h').desc).toBe('Escalera al 5');
  });
  it('la rueda (A-5) pierde con la escalera al 6', () => {
    expect(cat('Ah 2d 3c 4s 5h').score).toBeLessThan(cat('2d 3c 4s 5h 6d').score);
  });
  it('desempata por pateador y empata manos iguales', () => {
    const a = evaluate(H('Ah Ad Kc 7s 2h 3d 4c'));
    const b = evaluate(H('As Ac Qc 7d 2h 3d 4c'));
    expect(a.score).toBeGreaterThan(b.score);
    // misma escalera en la mesa: empate
    const board = H('5c 6d 7h 8s 9c');
    expect(evaluate([...H('2h 2d'), ...board]).score).toBe(evaluate([...H('3h Kd'), ...board]).score);
    // doble pareja: decide la carta suelta
    expect(evaluate(H('Kh Kd 9c 9s Ah')).score).toBeGreaterThan(evaluate(H('Ks Kc 9d 9h Qh')).score);
  });
  it('elige las 5 mejores cartas de 7', () => {
    const r = evaluate(H('2h 2d 2c 9s 9h 9d Kc'));
    expect(r.name).toBe('Full');
    expect(r.desc).toBe('Full de nueves y doses');
    expect(r.best).toHaveLength(5);
  });
});

describe('botes', () => {
  it('bote principal y laterales con all-in', () => {
    // A all-in 50, B 100, C 100 y D se retira tras poner 20
    const pots = buildPots([50, 100, 100, 20], [false, false, false, true]);
    expect(pots).toEqual([
      { amount: 170, eligible: [0, 1, 2] },
      { amount: 100, eligible: [1, 2] },
    ]);
    // gana A el principal; B y C empatan el lateral
    const { win } = awardPots(pots, [900, 500, 500, null], 3);
    expect(win).toEqual([170, 50, 50, 0]);
  });
  it('la apuesta no igualada vuelve a su dueño', () => {
    const pots = buildPots([40, 100], [false, false]);
    expect(pots).toEqual([
      { amount: 80, eligible: [0, 1] },
      { amount: 60, eligible: [1] },
    ]);
  });
  it('fichas sueltas al primero a la izquierda del botón', () => {
    const { win } = awardPots([{ amount: 5, eligible: [0, 1] }], [7, 7], 0);
    expect(win).toEqual([2, 3]);
  });
});

describe('motor de Hold’em', () => {
  const rng = seeded(42);
  it('ciegas, reparto y primero en hablar', () => {
    const st = startHand([200, 200, 200, 200], 0, 1, 2, rng);
    expect(st.sbSeat).toBe(1);
    expect(st.bbSeat).toBe(2);
    expect(st.seats[1].stack).toBe(199);
    expect(st.seats[2].stack).toBe(198);
    expect(st.toAct).toBe(3);
    expect(st.seats.every((s) => s.hole.length === 2)).toBe(true);
    expect(potTotal(st)).toBe(3);
  });
  it('mano a mano: el botón es ciega pequeña y habla primero', () => {
    const st = startHand([200, 200, 0, 0], 0, 1, 2, rng);
    expect(st.sbSeat).toBe(0);
    expect(st.bbSeat).toBe(1);
    expect(st.toAct).toBe(0);
  });
  it('subida mínima y opción de la ciega grande', () => {
    const st = startHand([200, 200, 200, 200], 0, 1, 2, rng);
    expect(legal(st).minTo).toBe(4);
    act(st, { type: 'raise', to: 3 }); // se corrige a 4
    expect(st.currentBet).toBe(4);
    act(st, { type: 'raise', to: 10 }); // sube 6
    expect(st.minRaise).toBe(6);
    expect(legal(st).minTo).toBe(16);
    act(st, { type: 'call' }); // ciega pequeña iguala
    act(st, { type: 'call' }); // ciega grande iguala
    act(st, { type: 'call' }); // el primero iguala
    expect(st.toAct).toBe(-1);
    nextStreet(st);
    expect(st.board).toHaveLength(3);
    expect(st.toAct).toBe(1);
    expect(potTotal(st)).toBe(40);
  });
  it('la ciega grande puede pasar si nadie sube', () => {
    const st = startHand([200, 200, 200, 200], 0, 1, 2, rng);
    act(st, { type: 'call' });
    act(st, { type: 'call' });
    act(st, { type: 'call' });
    expect(st.toAct).toBe(2);
    expect(legal(st).canCheck).toBe(true);
    act(st, { type: 'check' });
    expect(st.toAct).toBe(-1);
  });
  it('un all-in corto no reabre la apuesta', () => {
    const st = startHand([200, 200, 200, 13], 0, 1, 2, rng);
    act(st, { type: 'raise', to: 13 }); // 3: all-in 13 (sube 11, completa)
    act(st, { type: 'raise', to: 30 }); // 0: sube a 30 (17)
    act(st, { type: 'fold' }); // 1
    act(st, { type: 'call' }); // 2
    expect(st.toAct).toBe(-1);
    // otra mano: un all-in corto tras una subida
    const s2 = startHand([200, 200, 200, 25], 0, 1, 2, rng);
    act(s2, { type: 'call' }); // 3 iguala 2 (le quedan 23)
    act(s2, { type: 'raise', to: 20 }); // 0 sube a 20
    act(s2, { type: 'fold' }); // 1
    act(s2, { type: 'fold' }); // 2
    expect(s2.toAct).toBe(3);
    act(s2, { type: 'raise', to: 999 }); // all-in a 25 (sube solo 5)
    expect(s2.currentBet).toBe(25);
    expect(s2.toAct).toBe(0);
    expect(legal(s2).canRaise).toBe(false); // 0 ya actuó: solo igualar o retirarse
  });
  it('todos se retiran: gana el último sin enseñar', () => {
    const st = startHand([200, 200, 200, 200], 0, 1, 2, rng);
    act(st, { type: 'fold' });
    act(st, { type: 'fold' });
    act(st, { type: 'fold' });
    act(st, { type: 'fold' });
    expect(st.toAct).toBe(-1);
    const sd = finish(st);
    expect(sd.win[2]).toBe(3);
    expect(st.seats[2].stack).toBe(201);
    expect(sd.ranks.every((r) => r === null)).toBe(true);
  });
  it('all-in de todos: se reparte hasta el river y cuadran las fichas', () => {
    const st = startHand([50, 120, 200, 200], 0, 1, 2, seeded(7));
    act(st, { type: 'raise', to: 200 }); // 3
    act(st, { type: 'call' }); // 0 (all-in 50)
    act(st, { type: 'call' }); // 1 (all-in 120)
    act(st, { type: 'call' }); // 2
    expect(st.toAct).toBe(-1);
    let guard = 0;
    while (st.board.length < 5 && guard++ < 5) nextStreet(st);
    expect(st.board).toHaveLength(5);
    const sd = finish(st);
    expect(st.seats.reduce((a, s) => a + s.stack, 0)).toBe(570);
    expect(sd.pots.length).toBeGreaterThanOrEqual(2);
  });
});

describe('rivales de la máquina', () => {
  it('fórmula de Chen', () => {
    expect(chen(H('As Ad'))).toBe(20);
    expect(chen(H('Ks Qs'))).toBe(10); // 8 + 2 (mismo palo) + 0 hueco
    expect(chen(H('7h 2d'))).toBe(-1);
    expect(chen(H('2c 2d'))).toBe(5);
  });
  it('equidad razonable', () => {
    const r = seeded(9);
    expect(equity(H('As Ad'), [], 1, 400, r)).toBeGreaterThan(0.75);
    expect(equity(H('7h 2d'), [], 1, 400, r)).toBeLessThan(0.42);
    expect(equity(H('Ah Kh'), H('Qh Jh Th'), 3, 100, r)).toBe(1);
  });
  it('siempre propone jugadas legales', () => {
    const r = seeded(11);
    const style = { tight: 0.5, aggr: 0.5, bluff: 0.1 };
    for (let h = 0; h < 30; h++) {
      const st: PState = startHand([200, 150, 300, 80], h % 4, 1, 2, r);
      let guard = 0;
      while (st.street < 4 && guard++ < 60) {
        if (st.toAct < 0) {
          if (st.seats.filter((s) => !s.folded).length <= 1) break;
          nextStreet(st);
          continue;
        }
        const L = legal(st);
        const d = aiDecide(st, style, r, 40);
        if (d.action.type === 'check') expect(L.canCheck).toBe(true);
        if (d.action.type === 'raise') {
          expect(L.canRaise).toBe(true);
          expect(d.action.to).toBeGreaterThanOrEqual(L.minTo);
          expect(d.action.to).toBeLessThanOrEqual(L.maxTo);
        }
        act(st, d.action);
      }
      finish(st);
      expect(st.seats.reduce((a, s) => a + s.stack, 0)).toBe(730);
    }
  });
});
