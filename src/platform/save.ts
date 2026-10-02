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
