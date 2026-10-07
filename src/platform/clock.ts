/**
 * Reloj del juego. En modo normal es la hora real del dispositivo.
 * En modo desarrollo se puede acelerar o adelantar para probar sin esperar
 * 8 horas reales; ese desfase se guarda para que sobreviva a recargas.
 */
const KEY = 'laciudad.devclock';

interface DevClock {
  anchorReal: number;
  anchorGame: number;
  speed: number;
}

let dev: DevClock | null = load();

function load(): DevClock | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as DevClock) : null;
  } catch {
    return null;
  }
}

function save() {
  try {
    if (dev) localStorage.setItem(KEY, JSON.stringify(dev));
    else localStorage.removeItem(KEY);
  } catch {
    /* sin almacenamiento: el desfase dura solo esta sesión */
  }
}

export function now(): number {
  if (!dev) return Date.now();
  return dev.anchorGame + (Date.now() - dev.anchorReal) * dev.speed;
}

export function isDevEnabled(): boolean {
  return import.meta.env.DEV || new URLSearchParams(location.search).has('dev') || devFlag();
}

export function getSpeed(): number {
  return dev?.speed ?? 1;
}

export function isShifted(): boolean {
  return dev !== null;
}

export function setSpeed(speed: number) {
  dev = { anchorReal: Date.now(), anchorGame: now(), speed };
  save();
}

export function skip(ms: number) {
  const current = now();
  dev = { anchorReal: Date.now(), anchorGame: current + ms, speed: dev?.speed ?? 1 };
  save();
}

/** Vuelve a la hora real. Si el juego ya estaba en el futuro, el estado ignora el retroceso. */
export function resetClock() {
  dev = null;
  save();
}

const DEV_KEY = 'laciudad.dev';

/** Modo pruebas activado desde el menú (persiste entre sesiones). */
export function setDevEnabled(on: boolean) {
  try {
    if (on) localStorage.setItem(DEV_KEY, '1');
    else localStorage.removeItem(DEV_KEY);
  } catch {
    /* sin almacenamiento */
  }
  if (!on) resetClock();
}

export function devFlag(): boolean {
  try {
    return localStorage.getItem(DEV_KEY) === '1';
  } catch {
    return false;
  }
}
