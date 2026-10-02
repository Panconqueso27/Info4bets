import type { GameState } from '../core/types';

const KEY = 'laciudad.save.v1';

export function loadGame(): GameState | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as GameState;
    return s.version === 1 ? s : null;
  } catch {
    return null;
  }
}

export function saveGame(state: GameState) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* almacenamiento lleno o bloqueado */
  }
}

export function deleteGame() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* nada que borrar */
  }
}
