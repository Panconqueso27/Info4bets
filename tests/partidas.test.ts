import { beforeEach, describe, expect, it } from 'vitest';
import { newGame } from '../src/core/game';
import type { Character } from '../src/core/types';

// localStorage mínimo para node
const mem = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (k: string) => (mem.has(k) ? mem.get(k)! : null),
  setItem: (k: string, v: string) => void mem.set(k, String(v)),
  removeItem: (k: string) => void mem.delete(k),
};
const save = await import('../src/platform/save');
const char = (name: string): Character => ({ role: 'inmigrante', name, age: 30, look: { outfit: 'a', hair: 'b', skin: 'c', hairColor: 'd', outfitColor: 'e' } });
const at = new Date(2026, 0, 1, 9).getTime();

describe('partidas guardadas', () => {
  beforeEach(() => mem.clear());

  it('la partida antigua pasa a la ranura 1', () => {
    mem.set('laciudad.save.v2', JSON.stringify(newGame(char('Vieja'), at, 1)));
    expect(save.loadGame()?.character.name).toBe('Vieja');
    expect(save.activeSlot()).toBe(1);
    expect(mem.has('laciudad.save.v2')).toBe(false);
  });

  it('cada ranura guarda su partida', () => {
    save.setActiveSlot(2);
    save.saveGame(newGame(char('Dos'), at, 2));
    save.setActiveSlot(4);
    save.saveGame(newGame(char('Cuatro'), at, 4));
    const slots = save.listSlots();
    expect(slots.map((s) => s.state?.character.name ?? null)).toEqual([null, 'Dos', null, 'Cuatro', null]);
    expect(save.firstFreeSlot()).toBe(1);
    save.setActiveSlot(2);
    expect(save.loadGame()?.character.name).toBe('Dos');
    save.deleteSlot(2);
    expect(save.loadSlot(2)).toBeNull();
  });

  it('si la principal se estropea, se usa la copia de respaldo', () => {
    save.setActiveSlot(3);
    save.saveGame(newGame(char('Tres'), at, 3));
    save.saveGame(newGame(char('Tres'), at, 3)); // la segunda guarda deja copia
    mem.set('laciudad.slot.3', '{roto');
    const s = save.listSlots()[2];
    expect(s.state?.character.name).toBe('Tres');
    expect(s.recovered).toBe(true);
  });
});
