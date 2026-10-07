import { describe, expect, it } from 'vitest';
import { lightAt } from '../src/art/daynight';

const at = (h: number, m = 0) => new Date(2026, 5, 1, h, m).getTime();

describe('ciclo día/noche', () => {
  it('es de noche de madrugada y de día al mediodía', () => {
    expect(lightAt(at(2)).night).toBe(1);
    expect(lightAt(at(13)).night).toBe(0);
    expect(lightAt(at(13)).sun).not.toBeNull();
    expect(lightAt(at(2)).moon).not.toBeNull();
    expect(lightAt(at(13)).moon).toBeNull();
  });
  it('transiciona al atardecer', () => {
    const n = lightAt(at(19, 30)).night;
    expect(n).toBeGreaterThan(0.2);
    expect(n).toBeLessThan(1);
  });
  it('es continuo a medianoche', () => {
    expect(lightAt(at(23, 59)).skyTop).toBe(lightAt(at(0, 0)).skyTop);
  });
});
