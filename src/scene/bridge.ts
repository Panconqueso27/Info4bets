import type { Look, Role } from '../core/types';

/** Estado que la interfaz (Preact) comparte con la escena (Phaser). */
export type Spot = 'home' | 'work' | 'away';

export interface SceneModel {
  role: Role | null;
  look: Look | null;
  /** home: en casa; work: dentro del trabajo; away: fuera de escena (detenido). */
  spot: Spot;
  now: () => number;
}

type Listener = (m: SceneModel) => void;

let model: SceneModel = { role: null, look: null, spot: 'home', now: () => Date.now() };
const listeners = new Set<Listener>();

export const bridge = {
  get: () => model,
  set(patch: Partial<SceneModel>) {
    const next = { ...model, ...patch };
    const changed = (Object.keys(patch) as (keyof SceneModel)[]).some((k) => next[k] !== model[k]);
    model = next;
    if (changed) listeners.forEach((l) => l(model));
  },
  subscribe(l: Listener) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
};
