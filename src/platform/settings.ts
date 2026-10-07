/** Ajustes del jugador que no son de sonido (los de sonido están en audio.ts). */
export interface Settings {
  /** Vibrar con los avisos importantes. */
  vibrate: boolean;
  /** Notificaciones del sistema (fin de jornada, sucesos, recordatorios). */
  notifications: boolean;
  /** Letra un poco más grande en los paneles. */
  bigText: boolean;
}

const KEY = 'laciudad.settings';
const DEFAULTS: Settings = { vibrate: true, notifications: true, bigText: false };
let current: Settings = load();

function load(): Settings {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') };
  } catch {
    return { ...DEFAULTS };
  }
}

export function getSettings(): Settings {
  return { ...current };
}

export function setSettings(p: Partial<Settings>) {
  current = { ...current, ...p };
  try {
    localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    /* sin almacenamiento */
  }
  applySettings();
}

/** Aplica lo que afecta al aspecto (tamaño de letra). */
export function applySettings() {
  document.documentElement.classList.toggle('big-text', current.bigText);
}
