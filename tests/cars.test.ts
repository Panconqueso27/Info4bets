import { describe, expect, it } from 'vitest';
import { advance, newGame } from '../src/core/game';
import { brandCars, buyCarItem, launchCar } from '../src/core/cars';
import { CAR_KINDS, carFairPrice, carIncome, carMarket, carMarketLevel, carPartsOf, carScore, defaultCar, emissionLimit, testCar, trendOf, TRENDS } from '../src/core/carcore';
import type { Character } from '../src/core/types';

const mayor: Character = { role: 'alcalde', name: 'Test', age: 50, look: { outfit: 'a', hair: 'b', skin: 'c', hairColor: 'd', outfitColor: 'e' } };
const at = new Date(2026, 0, 3, 20).getTime();

describe('fábrica de coches', () => {
  it('cinco piezas de serie y cinco de pago por tipo', () => {
    for (const k of CAR_KINDS) {
      expect(carPartsOf(k).filter((p) => p.price === 0).length).toBe(5);
      expect(carPartsOf(k).filter((p) => p.price > 0).length).toBe(5);
    }
  });

  it('la ficha técnica responde a las piezas', () => {
    const base = testCar(defaultCar());
    const fast = testCar({ ...defaultCar(), motor: 'e-v8', caja: 'g-m5', ruedas: 'w-sport' });
    expect(fast.cv).toBeGreaterThan(base.cv);
    expect(fast.aceleracion).toBeLessThan(base.aceleracion);
    expect(fast.consumo).toBeGreaterThan(base.consumo);
    const safe = testCar({ ...defaultCar(), seguridad: 's-total' });
    expect(safe.estrellas).toBeGreaterThan(base.estrellas);
  });

  it('el motor central solo cabe en deportivos', () => {
    const fam = testCar({ ...defaultCar(), motorPos: 'centro' });
    expect(fam.confort).toBeLessThan(testCar(defaultCar()).confort);
    expect(fam.warnings.some((w) => /no cabe/.test(w))).toBe(true);
  });

  it('la ley de emisiones se endurece y el diésel acaba suspendiendo', () => {
    expect(emissionLimit(60)).toBeLessThan(emissionLimit(1));
    const d = { ...defaultCar(), motor: 'e-diesel' };
    expect(testCar(d, 1).emisionesOk).toBe(true);
    expect(testCar(d, 40).emisionesOk).toBe(false);
  });

  it('la tendencia de la semana cambia lo que se valora', () => {
    const d = { ...defaultCar(), carroceria: 'k-compacto', motor: 'e-12', caja: 'g-m5' };
    const r = testCar(d);
    const oil = TRENDS.find((t) => t.id === 'petroleo')!;
    const speed = TRENDS.find((t) => t.id === 'velocidad')!;
    expect(carScore(r, d, oil)).toBeGreaterThan(carScore(r, d, speed));
    expect(trendOf(1, 5).id).toBe(trendOf(7, 5).id);
  });

  it('el resultado viene con sus causas buenas y malas', () => {
    const d = defaultCar();
    const r = testCar(d);
    const res = carMarket(d, r, carFairPrice(r, 50) * 3, 30, 1, 0, 'nada', 'media');
    expect(res.causes.some((c) => !c.good && /caro/.test(c.text))).toBe(true);
    expect(carMarketLevel(30)).toBeGreaterThan(carMarketLevel(1));
  });

  it('lanzar cuesta dinero, deja ingresos y pone coches en la ciudad', () => {
    const s = newGame(mayor, at, 4);
    advance(s, at);
    s.missions = { date: s.today.date, list: [] };
    s.bars.dinero = 5_000_000;
    const d = defaultCar();
    const r = testCar(d);
    const out = launchCar(s, d, carFairPrice(r, 50), at, 'tv', 'media');
    expect(s.bars.dinero).toBeLessThan(5_000_000);
    expect(s.carLab!.models.length).toBe(1);
    expect(carIncome(out.model, out.model.launchedDay + 1)).toBeGreaterThanOrEqual(carIncome(out.model, out.model.launchedDay + 15));
    if (out.model.outcome !== 'fracaso') expect(brandCars(s)[0].color).toBe('rojo');
    expect(() => launchCar(s, d, 10000, at)).toThrow(/ocupada/);
  });

  it('las piezas de pago hay que desarrollarlas', () => {
    const s = newGame(mayor, at, 4);
    advance(s, at);
    s.bars.dinero = 5_000_000;
    expect(() => launchCar(s, { ...defaultCar(), motor: 'e-v8' }, 20000, at)).toThrow(/desarrollada/);
    buyCarItem(s, 'e-v8', at);
    buyCarItem(s, 'color:oro', at);
    expect(s.carLab!.owned).toEqual(['e-v8', 'color:oro']);
  });
});
