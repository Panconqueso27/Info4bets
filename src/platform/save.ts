import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import type { GameState } from '../core/types';

/**
 * Guardado de la partida. Se escribe en localStorage (lectura inmediata) y,
 * en la app, también en el almacenamiento nativo, que el sistema no borra.
 */
const KEY = 'laciudad.save.v2';
const native = Capacitor.isNativePlatform();

function parse(raw: string | null): GameState | null {
  if (!raw) return null;
  try {
    const s = JSON.parse(raw) as GameState;
    return s.version === 2 ? s : null;
  } catch {
    return null;
  }
}

export function loadGame(): GameState | null {
  try {
    return parse(localStorage.getItem(KEY));
  } catch {
    return null;
  }
}

/** Al arrancar la app: si localStorage se perdió, recupera la copia nativa. */
export async function restoreNativeSave(): Promise<void> {
  if (!native) return;
  try {
    if (localStorage.getItem(KEY)) return;
    const { value } = await Preferences.get({ key: KEY });
    if (parse(value)) localStorage.setItem(KEY, value!);
  } catch {
    /* sin copia */
  }
}

export function saveGame(state: GameState) {
  const raw = JSON.stringify(state);
  try {
    localStorage.setItem(KEY, raw);
  } catch {
    /* almacenamiento lleno o bloqueado */
  }
  if (native) Preferences.set({ key: KEY, value: raw }).catch(() => {});
}

export function deleteGame() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* nada que borrar */
  }
  if (native) Preferences.remove({ key: KEY }).catch(() => {});
}

// ---------------------------------------------------------------------------
// Copia de seguridad: toda la partida en un código de texto
// ---------------------------------------------------------------------------

const EXTRA_KEYS = ['laciudad.legacy', 'laciudad.records'];
const PREFIX = 'LC1:';

/** Código con la partida, el legado y los récords (para guardarlo fuera del móvil). */
export function exportCode(): string | null {
  try {
    const save = localStorage.getItem(KEY);
    if (!save) return null;
    const extra: Record<string, string> = {};
    for (const k of EXTRA_KEYS) {
      const v = localStorage.getItem(k);
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

/** Restaura una copia. Devuelve un mensaje de error o null si todo fue bien. */
export function importCode(code: string): string | null {
  try {
    const clean = code.trim().replace(/\s+/g, '');
    if (!clean.startsWith(PREFIX)) return 'Ese código no es una copia de La Ciudad.';
    const bin = atob(clean.slice(PREFIX.length));
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    const data = JSON.parse(new TextDecoder().decode(bytes)) as { save: string; extra?: Record<string, string> };
    if (!parse(data.save)) return 'La copia está dañada.';
    localStorage.setItem(KEY, data.save);
    for (const [k, v] of Object.entries(data.extra ?? {})) if (EXTRA_KEYS.includes(k)) localStorage.setItem(k, v);
    if (native) Preferences.set({ key: KEY, value: data.save }).catch(() => {});
    return null;
  } catch {
    return 'No se pudo leer el código. Cópialo entero.';
  }
}
