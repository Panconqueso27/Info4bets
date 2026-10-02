/** Generador pseudoaleatorio con semilla (mulberry32): mismo seed, mismos sorteos. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Deriva una semilla nueva a partir de otra y un número (p. ej. un timestamp). */
export function mixSeed(seed: number, n: number): number {
  let h = (seed ^ 0x9e3779b9) >>> 0;
  h = Math.imul(h ^ (n >>> 0), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ Math.floor(n / 4294967296), 0xc2b2ae35) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

export function pickWeighted<T extends { weight: number }>(items: readonly T[], rand: () => number): T {
  const total = items.reduce((s, i) => s + Math.max(0, i.weight), 0);
  let r = rand() * total;
  for (const item of items) {
    r -= Math.max(0, item.weight);
    if (r < 0) return item;
  }
  return items[items.length - 1];
}

export function randRange(rand: () => number, min: number, max: number): number {
  return min + rand() * (max - min);
}

export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
