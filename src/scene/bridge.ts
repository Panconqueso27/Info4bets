import type { PlaceId } from '../art/cityMap';
import type { Look, OtherCharacter, Role } from '../core/types';
import type { Weather } from '../core/weather';

/** Estado que la interfaz (Preact) comparte con la escena (Phaser). */
export type Spot = 'home' | 'work' | 'away' | 'errand';

export interface SceneModel {
  role: Role | null;
  look: Look | null;
  /** home: en casa; work: dentro del trabajo; errand: repartiendo; away: detenido. */
  spot: Spot;
  /** Con auto, el reparto se hace en coche. */
  vehicle: 'pie' | 'auto';
  weather: Weather;
  /** El otro protagonista, que también vive en la ciudad. */
  other: OtherCharacter | null;
  now: () => number;
}

type Listener = (m: SceneModel) => void;

let model: SceneModel = { role: null, look: null, spot: 'home', vehicle: 'pie', weather: 'despejado', other: null, now: () => Date.now() };
const listeners = new Set<Listener>();
let tapHandler: ((id: PlaceId) => void) | null = null;

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
  /** La interfaz decide qué hacer al tocar un lugar del mapa. */
  onTap(fn: ((id: PlaceId) => void) | null) {
    tapHandler = fn;
  },
  tap(id: PlaceId) {
    tapHandler?.(id);
  },
};
