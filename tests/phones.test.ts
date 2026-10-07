import { describe, expect, it } from 'vitest';
import { advance, newGame } from '../src/core/game';
import { buyPart, launchPhone } from '../src/core/phones';
import { emptyDesign, fairPrice, marketLevel, modelIncome, PART_KINDS, partsOf, rateDesign, type PhoneDesign } from '../src/core/phonecore';
import type { Character } from '../src/core/types';

const char: Character = { role: 'inmigrante', name: 'Test', age: 30, look: { outfit: 'a', hair: 'b', skin: 'c', hairColor: 'd', outfitColor: 'e' } };
const at = new Date(2026, 0, 3, 20).getTime();

/** El mejor móvil con piezas gratis, bien montado. */
const goodFree = (): PhoneDesign => ({
  name: 'Brooklyn Uno',
  shape: 'f-concha',
  pantalla: { id: 'p-gris', x: 0, y: 2, rot: false },
  camara: { id: 'c-1mp', x: 3, y: 0, rot: false },
  procesador: { id: 'u-32bit', x: 0, y: 6, rot: false },
  bateria: { id: 'b-nimh-s', x: 2, y: 3, rot: false },
});

describe('taller de móviles', () => {
  it('cinco piezas gratis y cinco de pago de cada tipo', () => {
    for (const k of PART_KINDS) {
      const list = partsOf(k);
      expect(list.filter((p) => p.price === 0).length).toBe(5);
      expect(list.filter((p) => p.price > 0).length).toBe(5);
    }
  });

  it('un móvil a medias no se puede fabricar', () => {
    expect(rateDesign(emptyDesign()).ok).toBe(false);
    const d = goodFree();
    d.bateria = { ...d.bateria!, x: 0, y: 6 };
    const r = rateDesign(d);
    expect(r.ok).toBe(false);
    expect(r.issues.some((i) => /encima/.test(i.text))).toBe(true);
  });

  it('la colocación cuenta: cámara abajo y procesador pegado a la batería restan', () => {
    const good = rateDesign(goodFree());
    expect(good.ok).toBe(true);
    const bad = goodFree();
    bad.camara = { id: 'c-1mp', x: 3, y: 7, rot: false };
    bad.procesador = { id: 'u-32bit', x: 0, y: 3, rot: false };
    expect(rateDesign(bad).total).toBeLessThan(good.total);
  });

  it('con piezas gratis cuesta triunfar y el mercado sube con los días', () => {
    const r = rateDesign(goodFree());
    expect(marketLevel(30)).toBeGreaterThan(marketLevel(1) + 20);
    expect(r.total).toBeLessThan(marketLevel(14));
    expect(fairPrice(r)).toBeGreaterThan(r.unitCost);
  });

  it('lanzar cuesta dinero, crea el modelo y da ingresos que se apagan', () => {
    const s = newGame(char, at, 3);
    advance(s, at);
    s.bars.dinero = 5000;
    const before = s.bars.dinero;
    const r = rateDesign(goodFree());
    const out = launchPhone(s, goodFree(), fairPrice(r), at);
    expect(s.bars.dinero).toBeLessThan(before);
    expect(s.phoneLab!.models.length).toBe(1);
    const m = out.model;
    expect(modelIncome(m, m.launchedDay + 1)).toBeGreaterThanOrEqual(modelIncome(m, m.launchedDay + 20));
    expect(() => launchPhone(s, goodFree(), 100, at)).toThrow(/Hoy ya/);
  });

  it('las piezas de pago hay que comprarlas', () => {
    const s = newGame(char, at, 3);
    advance(s, at);
    s.bars.dinero = 5000;
    const d = goodFree();
    d.procesador = { id: 'u-risc', x: 0, y: 6, rot: false };
    expect(() => launchPhone(s, d, 200, at)).toThrow(/aún no la tienes/);
    buyPart(s, 'u-risc', at);
    expect(s.phoneLab!.owned).toContain('u-risc');
  });
});
