/**
 * Calidad gráfica en cuatro niveles. Cada nivel decide la resolución, el
 * detalle de las texturas (el pack HD), cuánta vida hay en la calle y los
 * efectos de cámara. Se guarda en este dispositivo y se aplica en directo.
 */
export type GfxLevel = 0 | 1 | 2 | 3;

export const GFX_NAMES = ['Ahorro', 'Media', 'Alta', 'Ultra'] as const;
export const GFX_HINTS = [
  'Lo más fluido: para móviles sencillos o con poca batería.',
  'Buen equilibrio: texturas normales y algo menos de gente.',
  'Pack de texturas HD, luces vivas, agua con reflejos y humo.',
  'Todo al máximo: más resolución, texturas 4×, resplandor nocturno. Para móviles potentes.',
] as const;

export interface GfxProfile {
  level: GfxLevel;
  /** Píxeles del juego por unidad de pantalla (300 × res de ancho). */
  res: number;
  /** Escala de los lienzos de edificios y del suelo. */
  art: number;
  ground: number;
  /** Pack HD: ladrillo con variación, suciedad, aparatos de aire, grietas, manchas… */
  hd: boolean;
  walkers: number;
  cars: number;
  pigeons: number;
  steam: number;
  /** Destellos del agua en el río y la bahía. */
  glints: number;
  /** Ventanas que se encienden y apagan a la vez (y teles). */
  windows: number;
  /** Chimeneas con humo. */
  smoke: number;
  birds: boolean;
  clouds: boolean;
  /** Viñeta de cámara y resplandor nocturno. */
  vignette: boolean;
  bloom: boolean;
  /** Multiplicador de gotas y copos. */
  precip: number;
}

const PROFILES: GfxProfile[] = [
  { level: 0, res: 1, art: 2, ground: 2, hd: false, walkers: 16, cars: 30, pigeons: 4, steam: 4, glints: 0, windows: 0, smoke: 0, birds: false, clouds: false, vignette: false, bloom: false, precip: 0.6 },
  { level: 1, res: 2, art: 2, ground: 2, hd: false, walkers: 28, cars: 45, pigeons: 7, steam: 6, glints: 50, windows: 8, smoke: 4, birds: true, clouds: true, vignette: false, bloom: false, precip: 0.8 },
  { level: 2, res: 2, art: 3, ground: 2, hd: true, walkers: 40, cars: 60, pigeons: 10, steam: 9, glints: 110, windows: 16, smoke: 8, birds: true, clouds: true, vignette: true, bloom: false, precip: 1 },
  { level: 3, res: 3, art: 4, ground: 3, hd: true, walkers: 54, cars: 72, pigeons: 14, steam: 12, glints: 170, windows: 26, smoke: 14, birds: true, clouds: true, vignette: true, bloom: true, precip: 1.15 },
];

const KEY = 'laciudad.gfx';
const LEGACY_LOW = 'laciudad.lowfx';
const FPS_KEY = 'laciudad.fps';

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, v: string | null) {
  try {
    if (v === null) localStorage.removeItem(key);
    else localStorage.setItem(key, v);
  } catch {
    /* sin almacenamiento */
  }
}

/** Nivel guardado (las versiones anteriores solo tenían «modo ahorro»). */
export function gfxLevel(): GfxLevel {
  const n = Number(read(KEY));
  if (read(KEY) !== null && n >= 0 && n <= 3) return n as GfxLevel;
  return read(LEGACY_LOW) === '1' ? 0 : 2;
}

export function gfxProfile(level: GfxLevel = gfxLevel()): GfxProfile {
  return PROFILES[level];
}

const listeners = new Set<(p: GfxProfile, auto: boolean) => void>();
export function onGfxChange(fn: (p: GfxProfile, auto: boolean) => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Cambia el nivel (auto: lo ha bajado el juego porque el móvil no llegaba). */
export function setGfxLevel(level: GfxLevel, auto = false) {
  write(KEY, String(level));
  write(LEGACY_LOW, null);
  document.documentElement.classList.toggle('lowfx', level === 0);
  for (const fn of listeners) fn(PROFILES[level], auto);
}

/** Modo ahorro (la interfaz quita animaciones caras). */
export function lowFx(): boolean {
  return gfxLevel() === 0;
}

export function showFps(): boolean {
  return read(FPS_KEY) === '1';
}
export function setShowFps(on: boolean) {
  write(FPS_KEY, on ? '1' : null);
  for (const fn of listeners) fn(gfxProfile(), false);
}
