import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import type { GameState } from '../core/types';

/**
 * Partidas guardadas: hasta MAX_SLOTS ranuras. Cada una se escribe en
 * localStorage (lectura inmediata) y, en la app, también en el
 * almacenamiento nativo, que el sistema no borra. Además se guarda una
 * copia de respaldo cada pocos minutos por si la principal se estropea.
 */
export const MAX_SLOTS = 5;
/** Ranura de las versiones anteriores (una sola partida). */
const LEGACY_KEY = 'laciudad.save.v2';
const ACTIVE_KEY = 'laciudad.slot.active';
const slotKey = (n: number) => `laciudad.slot.${n}`;
const bakKey = (n: number) => `laciudad.slot.${n}.bak`;
const BAK_EVERY = 10 * 60 * 1000;
const native = Capacitor.isNativePlatform();

function parse(raw: string | null): GameState | null {
  if (!raw) return null;
  try {
    const s = JSON.parse(raw) as GameState;
    return s && s.version === 2 && s.character && s.bars ? s : null;
  } catch {
    return null;
  }
}

function get(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function put(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* almacenamiento lleno o bloqueado */
  }
  if (native) Preferences.set({ key, value }).catch(() => {});
}
function drop(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    /* nada que borrar */
  }
  if (native) Preferences.remove({ key }).catch(() => {});
}

/** La partida de las versiones anteriores pasa a la ranura 1. */
function migrate() {
  const old = get(LEGACY_KEY);
  if (old && !get(slotKey(1)) && parse(old)) {
    put(slotKey(1), old);
    put(ACTIVE_KEY, '1');
  }
  if (old && get(slotKey(1))) drop(LEGACY_KEY);
}

export function activeSlot(): number {
  const n = Number(get(ACTIVE_KEY));
  return n >= 1 && n <= MAX_SLOTS ? n : 1;
}
export function setActiveSlot(n: number) {
  put(ACTIVE_KEY, String(n));
}

/** La partida de una ranura; si la principal está dañada, la copia de respaldo. */
export function loadSlot(n: number): GameState | null {
  return parse(get(slotKey(n))) ?? parse(get(bakKey(n)));
}

export function loadGame(): GameState | null {
  migrate();
  return loadSlot(activeSlot());
}

let lastBak = 0;
export function saveGame(state: GameState) {
  const n = activeSlot();
  const raw = JSON.stringify({ ...state, savedAt: Date.now() });
  const prev = get(slotKey(n));
  if (prev && Date.now() - lastBak > BAK_EVERY && parse(prev)) {
    put(bakKey(n), prev);
    lastBak = Date.now();
  }
  put(slotKey(n), raw);
}

export function deleteSlot(n: number) {
  drop(slotKey(n));
  drop(bakKey(n));
}
export function deleteGame() {
  deleteSlot(activeSlot());
}

export interface SlotInfo {
  slot: number;
  state: GameState | null;
  savedAt: number | null;
  /** La principal estaba dañada y se usa la copia de respaldo. */
  recovered: boolean;
}

export function listSlots(): SlotInfo[] {
  migrate();
  return Array.from({ length: MAX_SLOTS }, (_, i) => {
    const n = i + 1;
    const main = parse(get(slotKey(n)));
    const state = main ?? parse(get(bakKey(n)));
    return { slot: n, state, savedAt: state ? Number((state as GameState & { savedAt?: number }).savedAt ?? 0) || null : null, recovered: !main && !!state };
  });
}

export function firstFreeSlot(): number | null {
  return listSlots().find((s) => !s.state)?.slot ?? null;
}

/** Al arrancar la app: si localStorage se perdió, recupera las copias nativas. */
export async function restoreNativeSave(): Promise<void> {
  if (!native) return;
  try {
    const keys = [LEGACY_KEY, ACTIVE_KEY];
    for (let n = 1; n <= MAX_SLOTS; n++) keys.push(slotKey(n), bakKey(n));
    for (const key of keys) {
      if (get(key)) continue;
      const { value } = await Preferences.get({ key });
      if (value) localStorage.setItem(key, value);
    }
  } catch {
    /* sin copia */
  }
}

// ---------------------------------------------------------------------------
// Copia de seguridad: toda la partida en un código de texto
// ---------------------------------------------------------------------------

const EXTRA_KEYS = ['laciudad.legacy', 'laciudad.records'];
const PREFIX = 'LC1:';

/** Código con la partida activa, el legado y los récords (para guardarlo fuera del móvil). */
export function exportCode(): string | null {
  try {
    const save = get(slotKey(activeSlot()));
    if (!save) return null;
    const extra: Record<string, string> = {};
    for (const k of EXTRA_KEYS) {
      const v = get(k);
      if (v) extra[k] = v;
    }
    const json = JSON.stringify({ save, extra, at: Date.now() });
    const bytes = new TextEncoder().encode(json);
    let bin = '';
    for (const b of bytes) bin += String.fromCharCode(b);
    return PREFIX + btoa(bin);
  } catch {
    return null;
  }
}

/** Restaura una copia en la ranura activa. Devuelve un mensaje de error o null si todo fue bien. */
export function importCode(code: string): string | null {
  try {
    const clean = code.trim().replace(/\s+/g, '');
    if (!clean.startsWith(PREFIX)) return 'Ese código no es una copia de Pixelopolis.';
    const bin = atob(clean.slice(PREFIX.length));
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    const data = JSON.parse(new TextDecoder().decode(bytes)) as { save: string; extra?: Record<string, string> };
    if (!parse(data.save)) return 'La copia está dañada.';
    put(slotKey(activeSlot()), data.save);
    for (const [k, v] of Object.entries(data.extra ?? {})) if (EXTRA_KEYS.includes(k)) put(k, v);
    return null;
  } catch {
    return 'No se pudo leer el código. Cópialo entero.';
  }
}
