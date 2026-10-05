import { mulberry32 } from '../core/rng';
import type { Role } from '../core/types';
import { LOTS, MEGA, type CityLook, type LotDef } from '../core/lots';
import { BRIDGE_STREET, COLS, DISTRICTS, districtOf, MANHATTAN_COLS, ROWS, type District } from '../core/city';

export { COLS, ROWS, BRIDGE_STREET, MANHATTAN_COLS };
import { shade } from './character';
import { drawText, textWidth } from './pixelfont';

/**
 * La ciudad en vista isométrica (como los juegos de construir ciudades):
 * el suelo es un rombo y cada edificio es un volumen con azotea, fachada
 * sur (a la izquierda, iluminada) y fachada este (a la derecha, en sombra).
 *
 * La lógica sigue en coordenadas del plano (x hacia el este, y hacia el
 * sur, en unidades del mapa); solo el dibujo se proyecta con iso().
 *
 * Manhattan a la izquierda (oeste), el East River con el puente de Brooklyn
 * y Brooklyn a la derecha, con sus barrios.
 *
 * Capas (para el ciclo día/noche y el clima):
 * - base: suelo, calles y edificios (se tiñe con la luz ambiente)
 * - lights: farolas, escaparates y ventanas encendidas (de noche)
 * - neon: letreros de neón
 * - snow: nieve sobre azoteas y aceras (días de nieve)
 *
 * El suelo va en un lienzo; los edificios, en un lienzo por manzana con su
 * propia profundidad, para que tapen a quien pase por detrás.
 */
export const AVE_W = 18;
export const ST_H = 14;
export const BLOCK_W = 78;
export const BLOCK_H = 56;
const MC = MANHATTAN_COLS;
/** Ancho de cada orilla (Manhattan y Brooklyn tienen las mismas columnas). */
export const SIDE_W = AVE_W * (MC + 1) + BLOCK_W * MC;
export const RIVER_W = 72;
/** El río va de RIVER_X a BROOKLYN_X. */
export const RIVER_X = SIDE_W;
export const BROOKLYN_X = SIDE_W + RIVER_W;
export const MAP_W = BROOKLYN_X + AVE_W * (COLS - MC + 1) + BLOCK_W * (COLS - MC);
export const MAP_H = ST_H * (ROWS + 1) + BLOCK_H * ROWS;
/** Avenidas: 0..MC en Manhattan y MC+1..COLS+1 en Brooklyn. */
export const AVES = COLS + 2;
const SIDEWALK = 3;

export const blockX = (c: number) => (c < MC ? AVE_W + c * (BLOCK_W + AVE_W) : BROOKLYN_X + AVE_W + (c - MC) * (BLOCK_W + AVE_W));
export const blockY = (r: number) => ST_H + r * (BLOCK_H + ST_H);
/** Centro de la avenida a (0..AVES-1) y de la calle j (0..ROWS). */
export const aveX = (a: number) => (a <= MC ? a * (BLOCK_W + AVE_W) + AVE_W / 2 : BROOKLYN_X + (a - MC - 1) * (BLOCK_W + AVE_W) + AVE_W / 2);
export const stY = (j: number) => j * (BLOCK_H + ST_H) + ST_H / 2;
/** Tramo horizontal de una calle en una orilla (la del puente cruza el río). */
export function streetSpan(j: number, side: 'manhattan' | 'brooklyn'): [number, number] {
  if (j === BRIDGE_STREET) return [0, MAP_W];
  return side === 'manhattan' ? [0, RIVER_X] : [BROOKLYN_X, MAP_W];
}
/**
 * Sentido de circulación, como en Manhattan: avenidas y calles de sentido
 * único alternado (la del puente es de doble sentido).
 * Avenidas: +1 hacia el sur, -1 hacia el norte. Calles: +1 al este, -1 al oeste.
 */
export const aveDir = (a: number): 1 | -1 => (a % 2 === 0 ? 1 : -1);
export const stDir = (j: number): 1 | -1 | 0 => (j === BRIDGE_STREET ? 0 : j % 2 === 0 ? 1 : -1);

/** Altura de la acera por la que se cruza el puente a pie. */
export const BRIDGE_WALK_Y = blockY(BRIDGE_STREET - 1) + BLOCK_H - 1.5;
/**
 * Líneas de acera por las que caminan los personajes: la acera este y la
 * acera sur de cada manzana, las que dan a la cámara en la vista isométrica.
 */
export const walkX = (c: number) => blockX(c) + BLOCK_W - 1.5;
export const walkY = (r: number) => blockY(r) + BLOCK_H - 1.5;

export type PlaceId = 'casa' | 'diner' | 'alcaldia' | 'residencia' | 'bolsa' | 'parque' | 'plaza' | 'hotel' | 'pizza' | 'bar' | 'fabrica' | 'mercado' | 'hipodromo' | 'coney';

export interface Place {
  id: PlaceId;
  label: string;
  c: number;
  r: number;
  /** Ancho y alto en manzanas. */
  cw?: number;
  rh?: number;
}

export const PLACES_MAP: Place[] = [
  { id: 'parque', label: 'Parque', c: 1, r: 0, cw: 2, rh: 2 },
  { id: 'residencia', label: 'Residencia oficial', c: 3, r: 1 },
  { id: 'plaza', label: 'Times Square', c: 2, r: 3 },
  { id: 'alcaldia', label: 'Alcaldía', c: 1, r: 4 },
  { id: 'hotel', label: 'Hotel', c: 3, r: 4 },
  { id: 'diner', label: 'Diner', c: 0, r: 5 },
  { id: 'pizza', label: 'Pizzería', c: 1, r: 6 },
  { id: 'bar', label: 'Bar', c: 3, r: 6 },
  { id: 'casa', label: 'Tu edificio', c: 0, r: 7 },
  { id: 'bolsa', label: 'Bolsa de valores', c: 2, r: 7 },
  { id: 'fabrica', label: 'Fábrica de azúcar', c: 5, r: 0 },
  { id: 'mercado', label: 'Rastro de Brooklyn', c: 5, r: 3 },
  { id: 'hipodromo', label: 'Hipódromo', c: 6, r: 6, cw: 2 },
  { id: 'coney', label: 'Coney Island', c: 6, r: 8, cw: 2 },
];

export const PLACE_BY_ID = Object.fromEntries(PLACES_MAP.map((p) => [p.id, p])) as Record<PlaceId, Place>;

/** Casa y trabajo de cada personaje. */
export const ROLE_PLACES: Record<Role, { home: PlaceId; work: PlaceId }> = {
  inmigrante: { home: 'casa', work: 'diner' },
  alcalde: { home: 'residencia', work: 'alcaldia' },
};

export function placeRect(p: Place) {
  const x = blockX(p.c);
  const y = blockY(p.r);
  const cw = p.cw ?? 1;
  const rh = p.rh ?? 1;
  return { x, y, w: BLOCK_W * cw + AVE_W * (cw - 1), h: BLOCK_H * rh + ST_H * (rh - 1) };
}

/** Centro del lugar en el plano. */
export function placeCenter(p: Place) {
  const r = placeRect(p);
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
}
/** Esquina sureste de la acera del lugar: donde empiezan las rutas. */
export function placeDoor(p: Place) {
  return { x: walkX(p.c + (p.cw ?? 1) - 1), y: walkY(p.r + (p.rh ?? 1) - 1) };
}
/** Puerta del edificio, en la acera sur (delante de la fachada). */
export function placeEntrance(p: Place) {
  const r = placeRect(p);
  return { x: r.x + r.w / 2, y: walkY(p.r + (p.rh ?? 1) - 1) };
}

/**
 * Ruta por las aceras: horizontal por la calle de origen y vertical por la
 * avenida de destino. Para cambiar de orilla se cruza por el puente.
 */
export function route(from: Place, to: Place): { x: number; y: number }[] {
  const a = placeDoor(from);
  const b = placeDoor(to);
  const ea = placeEntrance(from);
  const eb = placeEntrance(to);
  if ((from.c < MC) === (to.c < MC))
    return [
      { x: ea.x, y: ea.y },
      { x: a.x, y: a.y },
      { x: b.x, y: a.y },
      { x: b.x, y: b.y },
      { x: eb.x, y: eb.y },
    ];
  return [
    { x: ea.x, y: ea.y },
    { x: a.x, y: a.y },
    { x: a.x, y: BRIDGE_WALK_Y },
    { x: b.x, y: BRIDGE_WALK_Y },
    { x: b.x, y: b.y },
    { x: eb.x, y: eb.y },
  ];
}

export const rowOf = (y: number) => Math.max(0, Math.min(ROWS - 1, Math.floor((y - ST_H) / (BLOCK_H + ST_H))));
export const colOf = (x: number) => {
  if (x < RIVER_X + RIVER_W / 2) return Math.max(0, Math.min(MC - 1, Math.floor((x - AVE_W) / (BLOCK_W + AVE_W))));
  return MC + Math.max(0, Math.min(COLS - MC - 1, Math.floor((x - BROOKLYN_X - AVE_W) / (BLOCK_W + AVE_W))));
};

// --------------------------------------------------------------------------
// Proyección isométrica
// --------------------------------------------------------------------------

/** Margen de agua alrededor del mapa (en pantalla). */
export const PAD = 90;
/** Altura máxima de lo que se dibuja (rascacielos, grúas, el puente). */
export const Z_TOP = 170;
const OX = MAP_H + PAD;
const OY = Z_TOP + PAD;
/** Tamaño de la ciudad en pantalla (unidades del mundo de Phaser). */
export const ISO_W = MAP_W + MAP_H + PAD * 2;
export const ISO_H = (MAP_W + MAP_H) / 2 + Z_TOP + PAD * 2;

/** Del plano (x, y) y la altura z a la pantalla. */
export function iso(x: number, y: number, z = 0) {
  return { x: x - y + OX, y: (x + y) / 2 - z + OY };
}
/** De la pantalla al suelo (z = 0). */
export function unIso(sx: number, sy: number) {
  const u = sx - OX;
  const v = (sy - OY) * 2;
  return { x: (u + v) / 2, y: (v - u) / 2 };
}

/**
 * Celda de profundidad: la manzana con su acera este, la avenida de al lado
 * y la acera oeste de la siguiente (en vertical, lo mismo con calles).
 * Lo que está en una celda va delante de su manzana y detrás de las de
 * más al este o al sur.
 */
export function cellCol(x: number) {
  if (x < BROOKLYN_X + AVE_W + SIDEWALK) return Math.min(MC - 1, Math.floor((x - AVE_W - SIDEWALK) / (BLOCK_W + AVE_W)));
  return MC + Math.floor((x - BROOKLYN_X - AVE_W - SIDEWALK) / (BLOCK_W + AVE_W));
}
export function cellRow(y: number) {
  return Math.floor((y - ST_H - SIDEWALK) / (BLOCK_H + ST_H));
}
export const cellDepth = (c: number, r: number) => (c + r) * 10;
/** Profundidad de algo que está de pie en el suelo (personas, coches). */
export function depthAt(x: number, y: number) {
  return cellDepth(cellCol(x), cellRow(y)) + 5 + Math.max(0, Math.min(4, ((x + y) / (MAP_W + MAP_H)) * 4));
}

/** ¿El punto de pantalla cae sobre el volumen (huella en el suelo × altura)? */
export function prismHit(sx: number, sy: number, r: { x: number; y: number; w: number; h: number }, H: number) {
  const g = unIso(sx, sy);
  const lo = Math.max(r.x - g.x, r.y - g.y, 0);
  const hi = Math.min(r.x + r.w - g.x, r.y + r.h - g.y, H);
  return lo <= hi;
}

/** Altura máxima de un lugar (para tocarlo y poner la etiqueta encima). */
export function placeHeight(p: Place, heights: Record<string, number>) {
  let h = 4;
  for (let c = p.c; c < p.c + (p.cw ?? 1); c++) for (let r = p.r; r < p.r + (p.rh ?? 1); r++) h = Math.max(h, heights[`${c},${r}`] ?? 4);
  return h;
}

// --------------------------------------------------------------------------
// Lienzos y utilidades de dibujo
// --------------------------------------------------------------------------

type Ctx = CanvasRenderingContext2D;

/**
 * Escala del arte: la capa base se dibuja al doble de resolución para tener
 * detalle fino; luces, neones y nieve van a resolución normal y se suavizan.
 */
let ART_SCALE = 3;
/** El suelo va a 2× (calles y aceras); los edificios, a 3× para que se vean nítidos con zoom. */
const GROUND_SCALE = 2;
/** Detalle de los edificios: 3× en calidad alta, 2× en modo ahorro (menos memoria). */
export function setArtScale(k: number) {
  ART_SCALE = k;
}
/** Escala de cada lienzo (los patrones se ajustan a ella). */
const SCALE = new WeakMap<Ctx, number>();

/** Transformación de base de cada lienzo (para anidar planos sin acumular). */
const BASE = new WeakMap<Ctx, DOMMatrix>();

function layer(rx: number, ry: number, w: number, h: number, scale: number, ground = false) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w * scale));
  c.height = Math.max(1, Math.ceil(h * scale));
  const ctx = c.getContext('2d')!;
  ctx.setTransform(scale, 0, 0, scale, -rx * scale, -ry * scale);
  // El suelo se dibuja directamente en coordenadas del plano.
  if (ground) ctx.transform(1, 0.5, -1, 0.5, OX, OY);
  BASE.set(ctx, ctx.getTransform());
  SCALE.set(ctx, scale);
  return { c, ctx };
}

function rect(ctx: Ctx, x: number, y: number, w: number, h: number, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

/** Rectángulo con precisión de medio píxel. */
function fine(ctx: Ctx, x: number, y: number, w: number, h: number, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x * 2) / 2, Math.round(y * 2) / 2, Math.max(0.5, Math.round(w * 2) / 2), Math.max(0.5, Math.round(h * 2) / 2));
}

/** Rectángulo exacto (sin redondear): para las caras de los volúmenes. */
function fill(ctx: Ctx, x: number, y: number, w: number, h: number, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

function poly(ctx: Ctx, pts: number[], color: string) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.closePath();
  ctx.fill();
}

function ellipse(ctx: Ctx, cx: number, cy: number, rx: number, ry: number, color: string) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(cx, cy, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, Math.PI * 2);
  ctx.fill();
}

const patterns: Record<string, CanvasPattern> = {};
/** Texturas repetidas: grano de asfalto, grava, ladrillo y baldosas (una sola llamada). */
function pattern(ctx: Ctx, kind: 'grano' | 'grava' | 'ladrillo' | 'baldosa' | 'cesped'): CanvasPattern {
  const sc = SCALE.get(ctx) ?? 2;
  const key = `${kind}${sc}`;
  if (patterns[key]) return patterns[key];
  const c = document.createElement('canvas');
  const rnd = mulberry32(hashKind(kind));
  const px = c.getContext('2d')!;
  if (kind === 'grano' || kind === 'grava' || kind === 'cesped') {
    c.width = c.height = 48;
    const n = kind === 'grano' ? 520 : 700;
    for (let i = 0; i < n; i++) {
      px.fillStyle = kind === 'cesped' ? (rnd() < 0.5 ? 'rgba(20,60,20,0.22)' : 'rgba(190,240,140,0.16)') : rnd() < 0.5 ? 'rgba(0,0,0,0.16)' : 'rgba(255,255,255,0.09)';
      px.fillRect(Math.floor(rnd() * 48), Math.floor(rnd() * 48), 1, kind === 'cesped' ? 2 : 1);
    }
    if (kind === 'grano')
      for (let i = 0; i < 6; i++) {
        px.fillStyle = 'rgba(0,0,0,0.08)';
        px.fillRect(Math.floor(rnd() * 40), Math.floor(rnd() * 44), 4 + Math.floor(rnd() * 6), 2 + Math.floor(rnd() * 3));
      }
  } else if (kind === 'ladrillo') {
    c.width = 12;
    c.height = 6;
    px.fillStyle = 'rgba(0,0,0,0.12)';
    px.fillRect(0, 2, 12, 1);
    px.fillRect(0, 5, 12, 1);
    px.fillRect(3, 0, 1, 2);
    px.fillRect(9, 3, 1, 2);
  } else {
    c.width = c.height = 6;
    px.fillStyle = 'rgba(0,0,0,0.07)';
    px.fillRect(0, 5, 6, 1);
    px.fillRect(5, 0, 1, 6);
  }
  const p = ctx.createPattern(c, 'repeat')!;
  // un píxel del patrón = medio píxel del mapa
  // un píxel del patrón = medio píxel del mapa (con el lienzo a la escala que sea)
  p.setTransform(new DOMMatrix().scale(1 / 2));
  patterns[key] = p;
  return p;
}
function hashKind(k: string) {
  let h = 7;
  for (let i = 0; i < k.length; i++) h = (h * 31 + k.charCodeAt(i)) >>> 0;
  return h;
}
function patch(ctx: Ctx, kind: 'grano' | 'grava' | 'ladrillo' | 'baldosa' | 'cesped', x: number, y: number, w: number, h: number) {
  ctx.fillStyle = pattern(ctx, kind);
  ctx.fillRect(x, y, w, h);
}

/** Disco con precisión de medio píxel. */
function fineDisc(ctx: Ctx, cx: number, cy: number, r: number, color: string) {
  ctx.fillStyle = color;
  for (let y = -r; y <= r; y += 0.5) {
    const w = Math.sqrt(Math.max(0, r * r - y * y));
    ctx.fillRect(Math.round((cx - w) * 2) / 2, Math.round((cy + y) * 2) / 2, Math.round(w * 4) / 2, 0.5);
  }
}

function glow(ctx: Ctx, x: number, y: number, r: number, rgb: string, a = 0.5) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(${rgb},${a})`);
  g.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

/** Halo de una ventana encendida (precalculado: se estampa miles de veces). */
let haloCache: HTMLCanvasElement | null = null;
function halo(ctx: Ctx, x: number, y: number) {
  if (!haloCache) {
    haloCache = document.createElement('canvas');
    haloCache.width = haloCache.height = 12;
    const h = haloCache.getContext('2d')!;
    const g = h.createRadialGradient(6, 6, 0, 6, 6, 6);
    g.addColorStop(0, 'rgba(255,190,110,0.32)');
    g.addColorStop(1, 'rgba(255,190,110,0)');
    h.fillStyle = g;
    h.fillRect(0, 0, 12, 12);
  }
  ctx.drawImage(haloCache, x - 6, y - 6);
}

const ROOFS = ['#4a4858', '#5b5966', '#3f3e4e', '#6b6478', '#7a5a4a', '#56607a', '#4a6a6a', '#8a5a48'];
/** Fachadas: ladrillo, piedra, brownstone, estuco… */
const FACADES = ['#a8452e', '#8e3b2e', '#b85a3a', '#7a4a3a', '#d8c09a', '#c8a880', '#6a4a58', '#8a6a5c', '#5a6a8a', '#a8805a', '#c87850', '#4a5a7a'];
const GLASS = ['#4f6a86', '#5a7a9a', '#3f5a74', '#6a8aa6', '#8aa0b0', '#46607a'];
const AWNINGS = ['#c0392b', '#2e8b57', '#2f6fb3', '#e2a23b', '#7b4fa0'];
const WARM = ['#ffd27a', '#ffc85e', '#ffe2a0', '#f9b85a'];

// --------------------------------------------------------------------------
// El dibujo: suelo inmediato y volúmenes diferidos por manzana
// --------------------------------------------------------------------------

interface Item {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  h: number;
  draw: () => void;
  /** Va delante de lo que se mueve por su celda (pilares que tapan a los coches que pasan por debajo). */
  front?: boolean;
}

/** Estado del dibujo. Las capas cambian: primero el suelo y luego cada manzana. */
class Art {
  base!: Ctx;
  /** Suelo (para las sombras que proyectan los edificios). */
  ground!: Ctx;
  _lights!: Ctx;
  _neon!: Ctx;
  _snow!: Ctx;
  used = { lights: false, neon: false, snow: false };
  queue: Item[] = [];
  heights: Record<string, number> = {};
  signals: { x: number; y: number }[] = [];
  constructor(
    public rand: () => number,
    public seed: number,
  ) {}
  get lights() {
    this.used.lights = true;
    return this._lights;
  }
  get neon() {
    this.used.neon = true;
    return this._neon;
  }
  get snow() {
    this.used.snow = true;
    return this._snow;
  }
}

/**
 * Elemento con volumen: se dibuja después, en el lienzo de su manzana y en
 * orden de atrás hacia delante. (x0, y0)-(x1, y1) es su huella en el suelo
 * y h su altura (para el recorte y para saber dónde tocar).
 */
function later(a: Art, x0: number, y0: number, x1: number, y1: number, h: number, draw: () => void, front = false) {
  a.queue.push({ x0, y0, x1, y1, h, draw, front });
  const k = `${colOf((x0 + x1) / 2)},${rowOf((y0 + y1) / 2)}`;
  a.heights[k] = Math.max(a.heights[k] ?? 0, h);
}

type V3 = [number, number, number];

function withM(a: Art, m: [number, number, number, number, number, number], fn: () => void) {
  const cs = [a.base, a._lights, a._neon, a._snow];
  for (const c of cs) {
    c.save();
    c.setTransform(BASE.get(c)!);
    c.transform(...m);
  }
  fn();
  for (const c of cs) c.restore();
}

/** Dibuja en un plano: origen o y ejes u, v (vectores 3D). */
function plane(a: Art, o: V3, u: V3, v: V3, fn: () => void) {
  const p = iso(o[0], o[1], o[2]);
  withM(a, [u[0] - u[1], (u[0] + u[1]) / 2 - u[2], v[0] - v[1], (v[0] + v[1]) / 2 - v[2], p.x, p.y], fn);
}
/** Plano horizontal a la altura z: se dibuja con coordenadas del plano. */
const onTop = (a: Art, z: number, fn: () => void) => plane(a, [0, 0, z], [1, 0, 0], [0, 1, 0], fn);
/** Fachada sur (plano y = Y): u = x del plano, v = hacia abajo desde zTop. */
const onSouth = (a: Art, Y: number, zTop: number, fn: () => void) => plane(a, [0, Y, zTop], [1, 0, 0], [0, 0, -1], fn);
/** Fachada este (plano x = X): u = 0 en la esquina sur y crece hacia el norte. */
const onEast = (a: Art, X: number, Ys: number, zTop: number, fn: () => void) => plane(a, [X, Ys, zTop], [0, -1, 0], [0, 0, -1], fn);
/**
 * De pie, mirando a la cámara (árboles, farolas, letreros): el punto (X, Y)
 * del dibujo cae sobre el punto (X, Y, z) del mapa.
 */
function sprite(a: Art, X: number, Y: number, fn: () => void, z = 0) {
  const p = iso(X, Y, z);
  withM(a, [1, 0, 0, 1, p.x - X, p.y - Y], fn);
}

/**
 * De pie en un plano que mira al sur (letreros, carteles, la noria): mismo
 * dibujo que sprite(), pero en perspectiva isométrica, pegado a la ciudad.
 */
function standS(a: Art, Y: number, fn: () => void, z = 0) {
  plane(a, [0, Y, Y + z], [1, 0, 0], [0, 0, -1], fn);
}

interface BoxCol {
  top: string;
  south: string;
  east?: string;
}

/** Volumen: fachada sur, fachada este y tapa (con sus adornos). */
function box(a: Art, x: number, y: number, w: number, d: number, H: number, col: BoxCol, o: { z?: number; top?: () => void; south?: () => void; east?: () => void; snow?: boolean } = {}) {
  const z = o.z ?? 0;
  const east = col.east ?? shade(col.south, -0.24);
  onSouth(a, y + d, z + H, () => {
    fill(a.base, x - 0.05, -0.05, w + 0.1, H + 0.1, col.south);
    o.south?.();
  });
  onEast(a, x + w, y + d, z + H, () => {
    fill(a.base, -0.05, -0.05, d + 0.1, H + 0.1, east);
    o.east?.();
  });
  onTop(a, z + H, () => {
    fill(a.base, x, y, w, d, col.top);
    if (o.snow !== false) fill(a.snow, x, y, w, d, 'rgba(240,246,255,0.92)');
    o.top?.();
  });
}

/** Sombra en el suelo hacia el noreste (el sol viene del suroeste). */
function groundShadow(a: Art, x: number, y: number, w: number, d: number, H: number, alpha = 0.26) {
  const s = Math.min(H * 0.55, 26);
  const t = s * 0.5;
  poly(a.ground, [x, y, x + s, y - t, x + w + s, y - t, x + w + s, y + d - t, x + w, y + d, x, y + d], `rgba(16,12,36,${alpha})`);
}

/** Tejado a dos aguas (cumbrera a lo largo de x). */
function gable(a: Art, x: number, y: number, w: number, d: number, H: number, rh: number, roofA: string, roofB: string, wall: string, z = 0) {
  const k = (2 * rh) / d;
  // vertiente norte (se ve un poco) y vertiente sur
  plane(a, [x, y, z + H], [1, 0, 0], [0, 1, k], () => {
    fill(a.base, -0.3, -0.1, w + 0.6, d / 2 + 0.2, roofB);
    for (let v = 1; v < d / 2; v += 1.5) fine(a.base, -0.3, v, w + 0.6, 0.5, shade(roofB, -0.1));
    fill(a.snow, 0, 0, w, d / 2, 'rgba(245,250,255,0.9)');
  });
  // hastial este (triángulo)
  onEast(a, x + w, y + d, z + H, () => poly(a.base, [0, 0.05, d, 0.05, d / 2, -rh], shade(wall, -0.24)));
  plane(a, [x, y + d / 2, z + H + rh], [1, 0, 0], [0, 1, -k], () => {
    fill(a.base, -0.3, -0.1, w + 0.6, d / 2 + 0.6, roofA);
    for (let v = 1.5; v < d / 2; v += 1.5) fine(a.base, -0.3, v, w + 0.6, 0.5, shade(roofA, -0.12));
    fine(a.base, -0.3, d / 2 - 0.2, w + 0.6, 0.6, shade(roofA, -0.3));
    fill(a.snow, 0, 0, w, d / 2, 'rgba(245,250,255,0.9)');
  });
  // cumbrera
  plane(a, [x, y + d / 2, z + H + rh], [1, 0, 0], [0, 1, 0], () => fill(a.base, -0.3, -0.35, w + 0.6, 0.7, shade(roofA, 0.25)));
}

// --------------------------------------------------------------------------
// Edificios genéricos
// --------------------------------------------------------------------------

/** Alto de cada planta (ventanas). */
const FLOOR = 5;

interface FacadeOpts {
  /** Planta baja comercial con toldo y escaparate. */
  shop?: boolean;
  fireEscape?: boolean;
  /** Ancho de ventana (2 = estrecha, 3 = ancha). */
  win?: number;
  /** Tira de neón bajo el toldo (manzanas renovadas). */
  trim?: string;
  /** Letrero de la tienda (en inglés). */
  sign?: string;
  /** Escalinata de entrada (casas de ladrillo de Brooklyn). */
  stoop?: boolean;
  /** Muro cortina de cristal (rascacielos). */
  glass?: boolean;
}

/** Fachada en coordenadas de la cara: u de u0 a u0 + w, v de 0 (arriba) a H (suelo). */
function facadeArt(a: Art, u0: number, w: number, H: number, color: string, o: FacadeOpts) {
  const { base, rand } = a;
  const shopH = o.shop ? 6 : 0;
  if (o.glass) {
    glassWall(a, u0, w, H - shopH, color);
  } else {
    // luz cenital: arriba más claro, abajo en sombra; ladrillo
    fill(base, u0, H * 0.55, w, H * 0.45, shade(color, -0.06));
    patch(base, 'ladrillo', u0 + 0.5, 2, w - 1, H - 2);
    // cornisa con dentículos
    fine(base, u0, 0, w, 1, shade(color, 0.3));
    for (let xx = u0; xx < u0 + w; xx += 1) fine(base, xx, 1, 0.5, 0.5, shade(color, -0.3));
    fine(base, u0, 1.5, w, 0.5, shade(color, -0.18));
    fine(a.snow, u0, 0, w, 1, 'rgba(245,250,255,0.95)');
    const ww = o.win ?? 2;
    const frame = shade(color, -0.4);
    const n = Math.max(1, Math.floor((w - 2) / (ww + 2.5)));
    const gap = (w - n * ww) / (n + 1);
    for (let v = 3.5; v + 3 <= H - shopH - 1; v += FLOOR)
      for (let i = 0; i < n; i++) {
        const xx = u0 + gap + i * (ww + gap);
        fine(base, xx - 0.5, v - 0.5, ww + 1, 3.5, frame);
        fill(base, xx, v, ww, 2.6, '#24304c');
        fine(base, xx, v, 0.5, 0.5, '#5a7aa8');
        fine(base, xx + ww / 2 - 0.25, v, 0.5, 2.6, frame);
        fine(base, xx - 0.5, v + 2.6, ww + 1, 0.5, shade(color, 0.28));
        if (rand() < 0.42) {
          const warm = rand() < 0.12 ? '#9fd3ff' : WARM[Math.floor(rand() * WARM.length)];
          fill(a.lights, xx, v, ww, 2.6, warm);
          if (rand() < 0.2) halo(a.lights, xx + ww / 2, v + 1.3);
        }
      }
    // escalera de incendios en zigzag con barandilla
    if (o.fireEscape && w > 12 && H > 12) {
      const fx = u0 + Math.floor(w / 2) - 4;
      for (let v = 3; v < H - shopH - 3; v += FLOOR) {
        fine(base, fx, v + 3, 8, 0.5, '#14101f');
        for (let k = 0; k < 8; k += 1.5) fine(base, fx + k, v + 2, 0.5, 1, 'rgba(20,16,31,0.7)');
        fine(base, fx, v + 2, 8, 0.5, 'rgba(20,16,31,0.6)');
        const up = Math.floor(v / FLOOR) % 2;
        for (let k = 0; k < FLOOR; k += 0.5) fine(base, fx + (up ? k * 1.4 : 7 - k * 1.4), v + 3 - k, 0.5, 0.5, '#14101f');
      }
    }
  }
  // aristas: luz a la izquierda, sombra a la derecha
  fine(base, u0, 0, 0.5, H, shade(color, 0.16));
  fine(base, u0 + w - 0.5, 0, 0.5, H, shade(color, -0.28));
  if (o.shop) {
    const sy = H - shopH;
    const aw = AWNINGS[Math.floor(rand() * AWNINGS.length)];
    // toldo a rayas con volante
    for (let xx = u0 + 0.5; xx < u0 + w - 0.5; xx += 1) fine(base, xx, sy - 0.5, 0.5, 2, (xx - u0) % 2 < 1 ? aw : '#f1ede3');
    for (let xx = u0 + 0.5; xx < u0 + w - 0.5; xx += 1) fine(base, xx, sy + 1.5, 0.5, 0.5, shade(aw, -0.25));
    fill(base, u0 + 1, sy + 2, w - 2, shopH - 2, '#2c3446');
    fine(base, u0 + 1, sy + 2.5, w - 2, 0.5, '#46526a');
    fill(a.lights, u0 + 1, sy + 2, w - 2, shopH - 2, '#ffdb94');
    halo(a.lights, u0 + w / 2, sy + 4);
    // mercancía en el escaparate
    for (let xx = u0 + 2; xx < u0 + w - 2; xx += 2.5) fine(base, xx, sy + shopH - 2, 1, 1.5, ['#e8414f', '#ffd24a', '#3fbf6a', '#f4efe2', '#2f6fb3'][Math.floor(rand() * 5)]);
    if (o.trim) fill(a.neon, u0 + 1, sy - 1, w - 2, 1, o.trim);
    if (o.sign && H >= 16) {
      const tw = textWidth(o.sign);
      const tx = u0 + Math.floor((w - tw) / 2);
      rect(base, tx - 1, sy - 7, tw + 2, 6, '#1d1d24');
      fine(base, tx - 1, sy - 7, tw + 2, 0.5, '#4a4a58');
      drawText(base, o.sign, tx, sy - 6, '#f4efe2');
      drawText(a.lights, o.sign, tx, sy - 6, rand() < 0.5 ? '#ffd27a' : '#9fe8ff');
    }
    const door = u0 + 1 + Math.floor(rand() * Math.max(1, w - 6));
    fill(base, door, sy + 2, 3, shopH - 2, '#3a2a20');
    fine(base, door + 2, sy + 4, 0.5, 0.5, '#ffd24a');
    fine(a.snow, u0, sy - 0.5, w, 1, 'rgba(245,250,255,0.9)');
  }
  if (o.stoop) {
    const sx = u0 + Math.floor(w / 2) - 2;
    fill(base, sx, H - 4, 4, 4, '#3a2a20');
    for (let k = 0; k < 3; k++) fill(base, sx - 1 - k, H - 2 + k * 0.7, 6 + k * 2, 0.7, '#9a8a78');
  }
}

/** Muro cortina: cristal azul con forjados, montantes y reflejos. */
function glassWall(a: Art, u0: number, w: number, H: number, color: string) {
  const { base, rand } = a;
  const g = base.createLinearGradient(u0, 0, u0 + w, H);
  g.addColorStop(0, shade(color, 0.22));
  g.addColorStop(0.5, color);
  g.addColorStop(1, shade(color, -0.18));
  base.fillStyle = g;
  base.fillRect(u0, 0, w, H);
  // reflejo diagonal
  base.fillStyle = 'rgba(255,255,255,0.10)';
  base.beginPath();
  base.moveTo(u0 + w * 0.2, 0);
  base.lineTo(u0 + w * 0.45, 0);
  base.lineTo(u0 + w * 0.15, H);
  base.lineTo(u0, H);
  base.lineTo(u0, H * 0.7);
  base.closePath();
  base.fill();
  for (let v = 2; v < H; v += FLOOR / 1.25) fine(base, u0, v, w, 0.5, shade(color, -0.28));
  for (let u = u0 + 2; u < u0 + w - 1; u += 3) fine(base, u, 0, 0.5, H, shade(color, -0.12));
  fine(base, u0, 0, w, 1.5, shade(color, 0.35));
  // plantas encendidas (oficinas): bandas enteras de luz fría
  for (let v = 2.5; v < H - 2; v += FLOOR / 1.25)
    if (rand() < 0.45) {
      const from = u0 + Math.floor(rand() * w * 0.4);
      fill(a.lights, from, v + 0.4, Math.min(u0 + w - from - 1, w * (0.3 + rand() * 0.5)), 1.8, rand() < 0.5 ? 'rgba(200,230,255,0.55)' : 'rgba(255,220,160,0.6)');
    }
}

/** Andamio con red verde delante de una fachada en obras (en la cara sur). */
function scaffoldFace(a: Art, u0: number, w: number, H: number) {
  fill(a.base, u0, 0, w, H, 'rgba(40,110,60,0.35)');
  for (let xx = u0; xx <= u0 + w - 1; xx += 5) fill(a.base, xx, 0, 0.8, H, '#c8a040');
  for (let yy = 2; yy < H; yy += 4) fill(a.base, u0, yy, w, 0.6, '#a8862e');
}

function waterTower(a: Art, x: number, y: number, z: number) {
  // patas, cuba de madera y tejado cónico (de pie, en la azotea)
  sprite(
    a,
    x,
    y,
    () => {
      const { base } = a;
      fine(base, x - 3, y - 4, 0.8, 4, '#2a1c10');
      fine(base, x + 2.2, y - 4, 0.8, 4, '#2a1c10');
      fine(base, x - 0.4, y - 3.5, 0.8, 3.5, '#2a1c10');
      fill(base, x - 4, y - 12, 8, 8, '#7a5232');
      for (let i = x - 4; i < x + 4; i += 1.5) fine(base, i, y - 12, 0.5, 8, '#6a4628');
      fine(base, x + 2, y - 12, 2, 8, 'rgba(20,10,0,0.25)');
      fine(base, x - 4, y - 10, 8, 0.5, '#2a1c10');
      fine(base, x - 4, y - 6.5, 8, 0.5, '#2a1c10');
      poly(base, [x - 5, y - 12, x + 5, y - 12, x, y - 16.5], '#4a3524');
      poly(base, [x, y - 12, x + 5, y - 12, x, y - 16.5], '#3a2818');
      poly(a.snow, [x - 5, y - 12, x + 5, y - 12, x, y - 16.5], 'rgba(245,250,255,0.95)');
    },
    z,
  );
}

/** Azotea en coordenadas del plano a la altura z: grava, pretil y detalles. */
function roofArt(a: Art, x: number, y: number, w: number, d: number, z: number, color: string, opts: { tower?: boolean; laundry?: boolean; corrugated?: boolean; sawtooth?: boolean } = {}) {
  const { base, rand } = a;
  patch(base, 'grava', x, y, w, d);
  for (let i = 0; i < (w * d) / 140; i++) fine(base, x + 2 + rand() * (w - 6), y + 2 + rand() * (d - 5), 2 + rand() * 3, 1 + rand() * 2, shade(color, -0.07));
  // pretil: borde claro al norte y oeste (le da el sol), sombra interior
  fine(base, x, y, w, 0.8, shade(color, 0.3));
  fine(base, x, y, 0.8, d, shade(color, 0.22));
  fine(base, x + 0.8, y + 0.8, w - 1.6, 0.5, shade(color, -0.2));
  fine(base, x + 0.8, y + 0.8, 0.5, d - 1.6, shade(color, -0.2));
  fine(base, x, y + d - 0.8, w, 0.8, shade(color, 0.12));
  fine(base, x + w - 0.8, y, 0.8, d, shade(color, 0.05));
  if (opts.corrugated) for (let xx = x + 1; xx < x + w - 1; xx += 2) fine(base, xx, y + 1, 0.8, d - 2, shade(color, -0.12));
  if (opts.sawtooth)
    for (let yy = y + 2; yy < y + d - 3; yy += 5) {
      fill(base, x + 1, yy, w - 2, 2, shade(color, 0.25));
      fill(base, x + 1, yy + 2, w - 2, 1, '#6fa7c7');
      fill(a.lights, x + 1, yy + 2, w - 2, 1, 'rgba(255,214,140,0.8)');
    }
  const spot = (sw: number, sh: number) => ({ x: x + 2 + rand() * Math.max(1, w - sw - 4), y: y + 2 + rand() * Math.max(1, d - sh - 4) });
  // claraboya
  if (w > 14 && d > 8 && rand() < 0.45) {
    const s = spot(6, 3);
    fill(base, s.x, s.y, 6, 3, '#6fa7c7');
    fill(base, s.x, s.y, 6, 1, '#a9d4ea');
    for (let k = 1; k < 6; k += 2) fine(base, s.x + k, s.y, 0.5, 3, '#4f87a7');
    fill(a.lights, s.x, s.y, 6, 3, 'rgba(255,214,140,0.8)');
  }
  if (opts.laundry && w > 16 && d > 6) {
    const ly = y + 2 + Math.floor(rand() * (d - 4));
    for (let i = x + 4; i < x + w - 4; i += 2.5) {
      const col = ['#e8414f', '#3b7bdc', '#ffd24a', '#f4efe2', '#3fbf6a'][Math.floor(rand() * 5)];
      sprite(a, i, ly, () => {
        fine(a.base, i - 1.25, ly - 4, 2.5, 0.4, '#d8d4c6');
        fine(a.base, i - 0.6, ly - 3.6, 1.4, 2, col);
      }, z);
    }
  }
  // aparatos de aire acondicionado y escotilla: pequeños volúmenes
  const acs = Math.floor(rand() * 3);
  for (let i = 0; i < acs && w > 10 && d > 8; i++) {
    const s = spot(4, 3);
    box(a, s.x, s.y, 4, 3, 2, { top: '#a9adb3', south: '#7d8187', east: '#55595f' }, { z, top: () => fine(a.base, s.x + 1, s.y + 1, 2, 1, '#55595f') });
  }
  if (w > 12 && d > 8 && rand() < 0.6) {
    const s = spot(4, 4);
    box(a, s.x, s.y, 4, 4, 3, { top: '#7a7580', south: '#5a5560', east: '#45404a' }, { z });
  }
  if ((opts.tower ?? rand() < 0.4) && w > 12 && d > 8) {
    const s = spot(10, 6);
    waterTower(a, s.x + 5, s.y + 4, z);
  }
}

interface BuildingOpts extends FacadeOpts {
  roof?: string;
  facadeColor?: string;
  tower?: boolean;
  laundry?: boolean;
  scaffold?: boolean;
  corrugated?: boolean;
  sawtooth?: boolean;
  /** La fachada este da a la avenida: también con tienda. */
  eastShop?: boolean;
  /** Rascacielos con cuerpo superior retranqueado y antena. */
  setback?: boolean;
}

/** Edificio completo: huella (x, y, w, d) en el suelo y altura H. */
function building(a: Art, x: number, y: number, w: number, d: number, H: number, opts: BuildingOpts = {}) {
  const roofColor = opts.roof ?? ROOFS[Math.floor(a.rand() * ROOFS.length)];
  const fc = opts.facadeColor ?? FACADES[Math.floor(a.rand() * FACADES.length)];
  // Cada edificio con su propio azar: cambiar un solar no altera el resto del mapa.
  const own = mulberry32(Math.floor(a.rand() * 0x7fffffff));
  later(a, x, y, x + w, y + d, H + (opts.tower ? 18 : opts.setback ? 16 : 4), () => {
    const prev = a.rand;
    a.rand = own;
    groundShadow(a, x, y, w, d, H);
    const east = shade(fc, -0.24);
    const H1 = opts.setback ? Math.round(H * 0.62) : H;
    const eastOpts: FacadeOpts = { win: opts.win, glass: opts.glass, shop: !!opts.eastShop };
    box(a, x, y, w, d, H1, { top: roofColor, south: fc, east }, {
      south: () => {
        facadeArt(a, x, w, H1, fc, opts);
        if (opts.scaffold) scaffoldFace(a, x, w, H1);
      },
      east: () => facadeArt(a, 0, d, H1, east, eastOpts),
      top: () => roofArt(a, x, y, w, d, H1, roofColor, { tower: opts.tower && !opts.setback, laundry: opts.laundry, corrugated: opts.corrugated, sawtooth: opts.sawtooth }),
    });
    if (opts.setback) {
      const ix = x + w * 0.16;
      const iy = y + d * 0.16;
      const iw = w * 0.68;
      const id = d * 0.68;
      const H2 = H - H1;
      const fc2 = shade(fc, 0.06);
      box(a, ix, iy, iw, id, H2, { top: roofColor, south: fc2, east: shade(fc2, -0.24) }, {
        z: H1,
        south: () => facadeArt(a, ix, iw, H2, fc2, { glass: opts.glass, win: opts.win }),
        east: () => facadeArt(a, 0, id, H2, shade(fc2, -0.24), { glass: opts.glass, win: opts.win }),
        top: () => roofArt(a, ix, iy, iw, id, H, roofColor, { tower: false }),
      });
      // antena con luz roja
      const ax = ix + iw / 2;
      const ay = iy + id / 2;
      sprite(a, ax, ay, () => {
        fine(a.base, ax - 0.25, ay - 12, 0.5, 12, '#2a2a33');
        fine(a.base, ax - 1, ay - 4, 2, 0.5, '#2a2a33');
        fill(a.lights, ax - 0.5, ay - 12.5, 1, 1, '#ff3b3b');
        glow(a.lights, ax, ay - 12, 3, '255,60,60', 0.6);
      }, H);
    }
    a.rand = prev;
  });
}

/** Divide una manzana en edificios de alturas variadas. */
const RESTORED = ['#b5523e', '#c98a5a', '#d8c7a4', '#a8584a', '#c2b08c', '#8fa3b5', '#b98e72', '#d3a07a'];
const TRIMS = ['#ff4f9a', '#4ff0ff', '#ffcc33', '#7dff6a', '#ff8a3b'];

interface BlockOpts {
  /** Solo media manzana (la otra mitad es un solar). */
  half?: 'oeste' | 'este';
  /** Nivel de renovación (alcalde). */
  renov?: number;
  /** Andamios: la manzana está en obras. */
  works?: boolean;
}

/** Cómo es cada barrio: colores, alturas, anchos de parcela y extras. */
interface DistrictStyle {
  facades: string[];
  roofs?: string[];
  h: [number, number];
  w: [number, number];
  laundry: number;
  fire: number;
  tower?: number;
  /** Probabilidad de rascacielos de cristal. */
  sky?: number;
  /** Letreros de tienda en inglés. */
  signs?: string[];
}

const STYLES: Record<District, DistrictStyle> = {
  midtown: { facades: FACADES, h: [22, 44], w: [12, 30], laundry: 0.15, fire: 0.35, tower: 0.4, sky: 0.3, signs: ['DELI', 'SHOES', 'BOOKS', 'DRUGS', 'BANK', 'CAFE', 'RADIO', 'HATS'] },
  lowereast: { facades: ['#8e3b2e', '#7a3a2c', '#9a4a34', '#6b4a3a', '#5a4a48'], h: [16, 28], w: [12, 22], laundry: 0.6, fire: 0.65, tower: 0.5, signs: ['PAWN', 'DELI', 'BAR', 'LAUNDRY'] },
  chinatown: { facades: ['#a8352c', '#2f6b4a', '#c8a040', '#7a3a2c', '#8a2a2a', '#3a5a4a'], h: [16, 30], w: [12, 20], laundry: 0.3, fire: 0.4, signs: ['TEA', 'NOODLE', 'DIM SUM', 'HERBS', 'JADE'] },
  muelles: { facades: ['#5a6470', '#6a5040', '#4a5a6a', '#7a4a32', '#5c5c5c'], roofs: ['#5d6268', '#6d5a48', '#4a525a'], h: [11, 17], w: [28, 40], laundry: 0, fire: 0.1, tower: 0 },
  industrial: { facades: ['#7a3a2c', '#6a4a3a', '#5a4a48', '#8a5a40'], roofs: ['#4a4850', '#56606a'], h: [15, 24], w: [24, 36], laundry: 0, fire: 0.2, tower: 0.3 },
  heights: { facades: ['#6b4a3a', '#7a5040', '#5a3a2c', '#8a5a44', '#6a4030'], h: [18, 23], w: [12, 14], laundry: 0.05, fire: 0.1, tower: 0.15 },
  coney: { facades: ['#e8a0b0', '#a0d0e0', '#f0d080', '#b0e0a0', '#e0b0e0', '#f4efe2'], h: [9, 15], w: [14, 24], laundry: 0.1, fire: 0, tower: 0, signs: ['HOT DOGS', 'ICE', 'GAMES', 'CANDY', 'BEACH'] },
};

const between = (a: Art, [lo, hi]: [number, number]) => lo + Math.floor(a.rand() * (hi - lo + 1));

function genericBlock(a: Art, c: number, r: number, o: BlockOpts = {}) {
  const prevRand = a.rand;
  a.rand = mulberry32((a.seed ^ (c * 7919 + r * 104729)) >>> 0);
  const district = districtOf(c, r);
  const st = STYLES[district];
  const half = Math.floor(BLOCK_W / 2);
  const x0 = blockX(c) + (o.half === 'oeste' ? half : SIDEWALK);
  const y0 = blockY(r) + SIDEWALK;
  const w0 = o.half ? half - SIDEWALK : BLOCK_W - SIDEWALK * 2;
  const h0 = BLOCK_H - SIDEWALK * 2;
  const renov = o.renov ?? 0;
  const yard = district === 'muelles' || district === 'industrial';
  // dos filas de parcelas: la de atrás (norte) y la de delante (sur, con tiendas)
  const backD = Math.round(h0 * (yard ? 0.55 : 0.4 + a.rand() * 0.15));
  const rows: [number, number, boolean][] = [
    [y0, backD, false],
    [y0 + backD, h0 - backD, !yard],
  ];
  for (const [ry, rd, front] of rows) {
    if (yard && front === false && ry !== y0) continue;
    let x = x0;
    while (x < x0 + w0 - 4) {
      const lw = Math.min(x0 + w0 - x, between(a, st.w));
      const finalW = x0 + w0 - (x + lw) < 10 ? x0 + w0 - x : lw;
      let H = between(a, st.h);
      const fe = a.rand() < st.fire;
      const win = a.rand() < 0.3 ? 3 : 2;
      const laundry = a.rand() < st.laundry;
      const pick = a.rand();
      const sign = front && st.signs && a.rand() < 0.45 ? st.signs[Math.floor(a.rand() * st.signs.length)] : undefined;
      // Midtown: algunos rascacielos de cristal en las parcelas de atrás
      const sky = !front && !renov && (st.sky ?? 0) > a.rand() && finalW >= 16;
      if (sky) H = 70 + Math.floor(a.rand() * 46);
      const eastEdge = x + finalW >= x0 + w0 - 0.5;
      building(a, x, ry, finalW, rd, H, {
        shop: front,
        fireEscape: fe && !sky,
        win,
        laundry: laundry && !renov && !sky,
        tower: !sky && (st.tower ?? 0.4) > a.rand(),
        roof: sky ? '#5a5f6a' : st.roofs ? st.roofs[Math.floor(pick * st.roofs.length)] : undefined,
        facadeColor: sky ? GLASS[Math.floor(pick * GLASS.length)] : renov ? RESTORED[Math.floor(pick * RESTORED.length)] : st.facades[Math.floor(pick * st.facades.length)],
        trim: renov >= 2 && front ? TRIMS[Math.floor(pick * TRIMS.length)] : undefined,
        scaffold: o.works && front,
        sign: sign && textWidth(sign) + 4 <= finalW ? sign : undefined,
        stoop: district === 'heights' && front,
        corrugated: district === 'muelles',
        sawtooth: district === 'industrial' && !front,
        eastShop: front && eastEdge && !o.half,
        glass: sky,
        setback: sky && a.rand() < 0.6,
      });
      x += finalW;
    }
  }
  if (yard) yardExtras(a, district, x0, y0 + backD, w0, h0 - backD, district === 'industrial');
  if (district === 'chinatown') lanterns(a, x0, y0 + h0 + 1, w0);
  // Árboles en la acera: renovación nivel 2, Brooklyn Heights y la mitad del resto.
  const leafy = renov >= 2 || district === 'heights' || (district !== 'muelles' && district !== 'industrial' && a.rand() < 0.55);
  if (leafy) for (let tx = x0 + 6 + Math.floor(a.rand() * 4); tx < x0 + w0 - 3; tx += 12 + Math.floor(a.rand() * 6)) tree(a, tx, blockY(r) + BLOCK_H - 1, 3 + (a.rand() < 0.4 ? 1 : 0));
  a.rand = prevRand;
}

/** Patio de almacén o fábrica: contenedores en fila (sin pisarse) y, en las fábricas, la chimenea. */
function yardExtras(a: Art, d: District, x: number, y: number, w: number, h: number, stack = false) {
  rect(a.base, x, y, w, h, d === 'muelles' ? '#6d6a66' : '#5f5c58');
  patch(a.base, 'grava', x, y, w, h);
  rect(a.snow, x, y, w, h, 'rgba(240,246,255,0.8)');
  const colors = ['#c0392b', '#2f6fb3', '#3a7a4a', '#e2a23b', '#7a5232'];
  // huecos de 16 × 8 en cuadrícula: cada contenedor (14 × 6) en el suyo
  const cols = Math.floor((w - 4) / 16);
  const rows = Math.max(1, Math.floor((h - 4) / 8));
  const slots: [number, number][] = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) slots.push([x + 2 + c * 16, y + 2 + r * 8]);
  if (stack && slots.length) {
    const [sx, sy] = slots.splice(Math.floor(a.rand() * slots.length), 1)[0];
    chimney(a, sx + 7, sy + 3.5, 34 + Math.floor(a.rand() * 14));
  }
  for (let i = 0; i < 4 && slots.length; i++) {
    const [cx, cy] = slots.splice(Math.floor(a.rand() * slots.length), 1)[0];
    container(a, cx, cy, colors[Math.floor(a.rand() * colors.length)]);
  }
  glow(a.lights, x + w / 2, y + h / 2, 14, '255,214,140', 0.35);
}

function container(a: Art, x: number, y: number, col: string) {
  later(a, x, y, x + 14, y + 6, 6, () => {
    groundShadow(a, x, y, 14, 6, 6, 0.2);
    box(a, x, y, 14, 6, 6, { top: shade(col, 0.15), south: col, east: shade(col, -0.25) }, {
      south: () => {
        for (let k = x + 1; k < x + 14; k += 1.5) fine(a.base, k, 0, 0.5, 6, shade(col, -0.18));
      },
      east: () => {
        fine(a.base, 3, 0.5, 0.5, 5, shade(col, -0.45));
        fine(a.base, 3, 0.5, 0.5, 5, shade(col, -0.45));
      },
    });
  });
}

function chimney(a: Art, x: number, y: number, H: number, z = 0) {
  later(a, x - 3, y - 3, x + 3, y + 3, H + z + 4, () => {
    if (!z) groundShadow(a, x - 3, y - 3, 6, 6, H, 0.2);
    box(a, x - 3, y - 3, 6, 6, H, { top: '#3a2a20', south: '#8e3b2e', east: '#6a2a20' }, {
      z,
      south: () => {
        patch(a.base, 'ladrillo', x - 3, 0, 6, H);
        for (let v = 3; v < H; v += 6) fine(a.base, x - 3, v, 6, 0.6, '#5a2018');
      },
      east: () => {
        for (let v = 3; v < H; v += 6) fine(a.base, 0, v, 6, 0.6, '#4a1810');
      },
      top: () => {
        fill(a.base, x - 2, y - 2, 4, 4, '#14101f');
        fill(a.lights, x - 0.5, y - 3, 1, 1, '#ff3b3b');
      },
    });
  });
}

/** Guirnalda de farolillos rojos (Chinatown), colgada sobre la acera. */
function lanterns(a: Art, x: number, y: number, w: number) {
  later(a, x, y - 0.4, x + w, y, 14, () => {
    onSouth(a, y, 14, () => {
      for (let xx = x + 2; xx < x + w - 2; xx += 5) {
        const sag = Math.sin(((xx - x) / w) * Math.PI) * 2;
        fine(a.base, xx, 1 + sag, 5, 0.5, '#3a2a20');
        fill(a.base, xx + 2, 1.5 + sag, 2, 2.5, '#e8414f');
        fill(a.neon, xx + 2, 1.5 + sag, 2, 2.5, '#ff5a4a');
      }
    });
  });
}

function neonSign(a: Art, text: string, cx: number, y: number, color: string, rgb: string, board = '#1d1d24') {
  const w = textWidth(text) + 4;
  const x = Math.round(cx - w / 2);
  rect(a.base, x, y, w, 9, board);
  rect(a.base, x, y + 9, w, 1, '#000');
  glow(a.neon, cx, y + 4, w * 0.75, rgb, 0.4);
  drawText(a.neon, text, x + 2, y + 2, color);
}

/** Letrero de neón sobre postes, de pie (se lee de frente). */
function roofSign(a: Art, text: string, X: number, Y: number, z: number, color: string, rgb: string) {
  standS(a, Y, () => {
    fine(a.base, X - 8, Y - 4, 0.8, 4, '#14101f');
    fine(a.base, X + 7, Y - 4, 0.8, 4, '#14101f');
    neonSign(a, text, X, Y - 13, color, rgb);
  }, z);
}

/** Letrero vertical (de hotel) colgado de una fachada. */
function neonVertical(a: Art, text: string, x: number, y: number, color: string, rgb: string) {
  rect(a.base, x, y, 6, text.length * 6 + 2, '#1d1d24');
  glow(a.neon, x + 3, y + text.length * 3, text.length * 5, rgb, 0.35);
  for (let i = 0; i < text.length; i++) drawText(a.neon, text[i], x + 1, y + 2 + i * 6, color);
}

/** Árbol frondoso, de pie: copa de varias matas con luz arriba a la izquierda. */
function tree(a: Art, x: number, y: number, r: number) {
  const seed = (x * 73856093) ^ (y * 19349663);
  const R = r * 1.25;
  later(a, x - R, y - 0.6, x + R, y, R * 2 + 6, () => {
    const rnd = mulberry32(seed >>> 0);
    // sombra en el suelo
    ellipse(a.ground, x + R * 0.4, y - R * 0.3, R * 1.1, R * 0.8, 'rgba(10,20,15,0.22)');
    sprite(a, x, y, () => {
      const { base } = a;
      fine(base, x - 0.5, y - 4.5, 1.5, 4.5, '#4a3020');
      fine(base, x - 0.5, y - 4.5, 0.5, 4.5, '#6a4830');
      const clumps = R <= 3 ? 4 : 6;
      const cy = y - 4 - R;
      const pts = Array.from({ length: clumps }, (_, i) => {
        const an = (i / clumps) * Math.PI * 2 + rnd();
        return { x: x + Math.cos(an) * R * 0.55, y: cy + Math.sin(an) * R * 0.45, r: R * (0.6 + rnd() * 0.25) };
      });
      for (const p of pts) fineDisc(base, p.x, p.y + 0.5, p.r + 0.5, '#1d3d22');
      fineDisc(base, x, cy, R * 0.8, '#2a5a2c');
      for (const p of pts) fineDisc(base, p.x, p.y, p.r, '#2f6b2b');
      for (const p of pts) fineDisc(base, p.x - p.r * 0.25, p.y - p.r * 0.3, p.r * 0.6, '#3f8236');
      for (const p of pts) fineDisc(base, p.x - p.r * 0.4, p.y - p.r * 0.5, p.r * 0.28, '#5f9f48');
      for (let k = 0; k < R * 4; k++) fine(base, x - R + rnd() * R * 1.4, cy - R + rnd() * R, 0.5, 0.5, '#8ac06a');
      fineDisc(a.snow, x, cy - 0.5, R, 'rgba(245,250,255,0.92)');
    });
  });
}

/** Pino oscuro (para los parques). */
function pine(a: Art, x: number, y: number, h: number) {
  later(a, x - 3, y - 0.6, x + 3, y, h + 2, () => {
    ellipse(a.ground, x + 2, y - 1, 3.5, 2.2, 'rgba(10,20,15,0.22)');
    sprite(a, x, y, () => {
      fine(a.base, x - 0.4, y - 3, 0.8, 3, '#4a3020');
      for (let k = 0; k < 3; k++) {
        const ty = y - 2 - k * (h / 4);
        const tw = 3.6 - k * 0.8;
        poly(a.base, [x - tw, ty, x + tw, ty, x, ty - h / 2.2], k % 2 ? '#24502a' : '#1f4524');
        poly(a.base, [x - tw, ty, x - tw * 0.2, ty, x, ty - h / 2.2], '#2f6332');
      }
      poly(a.snow, [x - 2.5, y - 2 - h / 2, x + 2.5, y - 2 - h / 2, x, y - 2 - h], 'rgba(245,250,255,0.9)');
    });
  });
}

// --------------------------------------------------------------------------
// Lugares especiales
// --------------------------------------------------------------------------

function park(a: Art, p: Place) {
  const { x, y, w, h } = placeRect(p);
  rect(a.base, x, y, w, h, '#3f7a3a');
  patch(a.base, 'cesped', x, y, w, h);
  rect(a.snow, x, y, w, h, 'rgba(240,246,255,0.85)');
  rect(a.base, x, y + h - 3, w, 3, '#8a8478');
  rect(a.base, x, y + h - 3, w, 1, '#a49d90');
  rect(a.base, x, y, 2, h, '#8a8478');
  rect(a.base, x + w - 2, y, 2, h, '#8a8478');
  const cx = x + w / 2;
  const cy = y + h / 2;
  for (let t = 0; t < 360; t += 2) {
    const ang = (t * Math.PI) / 180;
    rect(a.base, cx + Math.cos(ang) * w * 0.36 - 1, cy + Math.sin(ang) * h * 0.34 - 1, 3, 3, '#c9b98e');
  }
  rect(a.base, x + 2, cy - 1, w - 4, 3, '#c9b98e');
  rect(a.base, cx - 1, y + 2, 3, h - 4, '#c9b98e');
  // estanque
  ellipse(a.base, cx + 20, cy - 22, 24, 10, '#2f6fb3');
  ellipse(a.base, cx + 18, cy - 24, 20, 7, '#3f86c8');
  ellipse(a.snow, cx + 20, cy - 22, 24, 10, 'rgba(200,225,255,0.9)');
  // glorieta en el centro
  later(a, cx - 5, cy - 3, cx + 5, cy + 3, 14, () => {
    box(a, cx - 5, cy - 3, 10, 6, 6, { top: '#e8dcc0', south: '#e8dcc0', east: '#c9bc9e' }, {
      south: () => {
        for (let u = cx - 4; u < cx + 4; u += 2.5) fill(a.base, u, 1, 1.5, 5, 'rgba(40,30,20,0.55)');
      },
    });
    sprite(a, cx, cy, () => {
      poly(a.base, [cx - 7, cy - 6, cx + 7, cy - 6, cx, cy - 13], '#7a3a2a');
      poly(a.base, [cx, cy - 6, cx + 7, cy - 6, cx, cy - 13], '#5a2a1e');
      poly(a.snow, [cx - 7, cy - 6, cx + 7, cy - 6, cx, cy - 13], 'rgba(245,250,255,0.95)');
      glow(a.lights, cx, cy - 4, 12, '255,214,130', 0.5);
    });
  });
  for (let i = 0; i < 70; i++) {
    const tx = x + 6 + a.rand() * (w - 12);
    const ty = y + 10 + a.rand() * (h - 14);
    if (Math.abs(ty - cy) < 6 || Math.abs(tx - cx) < 6 || (Math.abs(ty - cy) < 12 && Math.abs(tx - cx) < 14)) continue;
    if (Math.hypot(tx - (cx + 20), (ty - (cy - 22)) * 2.4) < 30) continue;
    if (a.rand() < 0.3) pine(a, Math.round(tx), Math.round(ty), 9 + Math.floor(a.rand() * 5));
    else tree(a, Math.round(tx), Math.round(ty), 2 + Math.floor(a.rand() * 3));
  }
  for (const [lx, ly] of [[cx - w * 0.36, cy], [cx + w * 0.36, cy], [cx, cy - h * 0.34], [cx, cy + h * 0.34]]) glow(a.lights, lx, ly, 8, '255,214,130', 0.45);
}

/** Fachada clásica de columnas (alcaldía, bolsa, museo) en la cara sur. */
function columns(a: Art, u0: number, w: number, H: number, light: string, step = 6) {
  for (let i = u0 + 3; i < u0 + w - 3; i += step) {
    fill(a.base, i, 3, 3, H - 4, light);
    fine(a.base, i + 2.5, 3, 0.5, H - 4, shade(light, -0.2));
    fill(a.base, i - 0.5, 2.5, 4, 1, shade(light, 0.05));
  }
  for (let i = u0 + 3 + step / 2 + 1; i < u0 + w - 4; i += step) {
    fill(a.base, i, 5, 2, 5, '#2c3446');
    fill(a.lights, i, 5, 2, 5, '#ffd27a');
  }
}

/** Frontón triangular sobre la fachada sur (en su plano, por encima). */
function pediment(a: Art, u0: number, w: number, color: string) {
  poly(a.base, [u0 + 1, 0.2, u0 + w - 1, 0.2, u0 + w / 2, -6], color);
  poly(a.base, [u0 + 3, -0.3, u0 + w - 3, -0.3, u0 + w / 2, -4.5], shade(color, -0.08));
}

function steps(a: Art, x: number, y: number, w: number, color: string) {
  for (let s = 0; s < 3; s++) rect(a.base, x - 2 + s, y + s * 1.3, w + 4 - s * 2, 1.3, shade(color, -s * 0.05));
}

function cityHall(a: Art, p: Place) {
  const { x, y, w, h } = placeRect(p);
  rect(a.base, x, y, w, h, '#b9b3a6');
  for (let yy = y; yy < y + h; yy += 4) for (let xx = x + ((yy / 4) % 2 ? 2 : 0); xx < x + w; xx += 4) rect(a.base, xx, yy, 2, 2, '#c6c0b3');
  rect(a.snow, x, y, w, h, 'rgba(240,246,255,0.8)');
  const bx = x + 8, by = y + 6, bw = w - 16, bd = 24, H = 22;
  steps(a, bx, by + bd, bw, '#cfc8b8');
  later(a, bx, by, bx + bw, by + bd, H + 42, () => {
    groundShadow(a, bx, by, bw, bd, H + 12);
    box(a, bx, by, bw, bd, H, { top: '#d8d0bf', south: '#e6dfd0', east: '#c4bba8' }, {
      south: () => {
        fill(a.base, bx, 0, bw, 2, '#f6f1e6');
        columns(a, bx, bw, H, '#f8f4ea');
        fill(a.base, bx + bw / 2 - 3, H - 8, 6, 8, '#4a2e1c');
        fill(a.lights, bx + bw / 2 - 3, H - 8, 6, 2, '#ffe2a0');
      },
      east: () => {
        for (let u = 3; u < bd - 3; u += 5) {
          fill(a.base, u, 5, 2, 6, '#2c3446');
          fill(a.lights, u, 5, 2, 6, '#ffd27a');
        }
      },
    });
    // frontón delante del tejado
    onSouth(a, by + bd, H, () => {
      pediment(a, bx + 14, bw - 28, '#fffaf0');
      drawText(a.base, 'ALCALDIA', Math.round(bx + bw / 2 - textWidth('ALCALDIA') / 2), -4.5, '#6d6656');
    });
    // tambor y cúpula sobre el tejado
    const dx = bx + bw / 2;
    const dy = by + bd / 2;
    box(a, dx - 7, dy - 7, 14, 14, 9, { top: '#d8d0bf', south: '#efe9dc', east: '#cfc6b2' }, {
      z: H,
      south: () => {
        for (let u = dx - 6; u < dx + 6; u += 3) {
          fill(a.base, u, 2, 1.6, 5, '#2c3446');
          fill(a.lights, u, 2, 1.6, 5, '#ffd27a');
        }
      },
      east: () => {
        for (let u = 1.5; u < 13; u += 3) fill(a.base, u, 2, 1.6, 5, '#26304a');
      },
    });
    const cz = H + 9;
    sprite(a, dx, dy, () => {
      for (let r = 0; r <= 13; r += 0.5) {
        const ww = Math.sqrt(1 - (r / 13) ** 2) * 13;
        fine(a.base, dx - ww, dy - r, ww * 2, 0.5, r > 9 ? '#efe0a8' : '#d9c48a');
        fine(a.base, dx + ww * 0.35, dy - r, ww * 0.65, 0.5, r > 9 ? '#d8c890' : '#bda870');
      }
      for (let k = -2; k <= 2; k++) fine(a.base, dx + k * 4.5, dy - 11, 0.5, 11, 'rgba(120,96,48,0.45)');
      fill(a.base, dx - 2, dy - 18, 4, 5, '#efe0a8');
      fill(a.base, dx + 0.5, dy - 18, 1.5, 5, '#c9b47c');
      poly(a.base, [dx - 2.5, dy - 18, dx + 2.5, dy - 18, dx, dy - 21], '#c9b47c');
      fine(a.base, dx - 0.3, dy - 31, 0.6, 10, '#333');
      fill(a.base, dx + 0.3, dy - 31, 7, 4, '#2f6fb3');
      fine(a.base, dx + 0.3, dy - 29.5, 7, 0.6, '#f1ede3');
      fill(a.snow, dx - 12, dy - 13, 24, 4, 'rgba(245,250,255,0.92)');
      glow(a.lights, dx, dy - 8, 20, '255,220,140', 0.35);
    }, cz);
  });
  // fuente
  const fx = x + w / 2, fy = y + h - 12;
  ellipse(a.base, fx, fy, 7, 7, '#8a8478');
  ellipse(a.base, fx, fy, 5, 5, '#4f8fb8');
  glow(a.lights, fx, fy, 10, '150,210,255', 0.45);
  later(a, fx - 1, fy - 1, fx + 1, fy + 1, 7, () =>
    sprite(a, fx, fy, () => {
      fill(a.base, fx - 0.8, fy - 6, 1.6, 6, '#bfe6ff');
      fill(a.base, fx - 2.5, fy - 6.5, 5, 1, '#dff2ff');
    }),
  );
  for (let i = x + 6; i < x + w - 4; i += 14) tree(a, i, y + h - 3, 3);
}

function residence(a: Art, p: Place) {
  const { x, y, w, h } = placeRect(p);
  rect(a.base, x, y, w, h, '#4a7a3e');
  patch(a.base, 'cesped', x, y, w, h);
  rect(a.snow, x, y, w, h, 'rgba(240,246,255,0.88)');
  for (let t = 0; t <= 1; t += 0.02) rect(a.base, x + w / 2 - 2 + Math.sin(t * Math.PI * 2) * 6, y + 30 + t * (h - 32), 4, 2, '#cfc6ad');
  const mx = x + 16, my = y + 10, mw = 46, md = 18, H = 14;
  later(a, mx, my, mx + mw, my + md, H + 12, () => {
    groundShadow(a, mx, my, mw, md, H + 4);
    box(a, mx, my, mw, md, H, { top: '#ede4cc', south: '#ede4cc', east: '#cfc4a8' }, {
      south: () => {
        fill(a.base, mx, 0, mw, 1, '#fffaf0');
        for (let i = mx + 3; i < mx + mw - 3; i += 6) {
          if (Math.abs(i - (mx + mw / 2)) < 6) continue;
          for (const v of [2.5, 8]) {
            fill(a.base, i - 1, v, 1, 3.5, '#2f5a3a');
            fill(a.base, i, v, 2, 3.5, '#26304a');
            fill(a.base, i + 2, v, 1, 3.5, '#2f5a3a');
            fill(a.lights, i, v, 2, 3.5, '#ffd27a');
          }
        }
        // pórtico
        fill(a.base, mx + mw / 2 - 7, 4, 14, 1, '#ffffff');
        for (let i = 0; i < 4; i++) fill(a.base, mx + mw / 2 - 6 + i * 4, 5, 1.2, H - 5, '#ffffff');
        fill(a.base, mx + mw / 2 - 1.5, 7, 3, H - 7, '#2f4f6e');
      },
      east: () => {
        for (let u = 3; u < md - 2; u += 6) {
          fill(a.base, u, 3, 2, 3.5, '#26304a');
          fill(a.lights, u, 3, 2, 3.5, '#ffd27a');
        }
      },
    });
    gable(a, mx - 1, my - 1, mw + 2, md + 2, H, 7, '#4f6b4a', '#3c4f3a', '#ede4cc');
    sprite(a, mx + 8, my + 4, () => fill(a.base, mx + 7, my - 2, 3, 6, '#7a3a2a'), H + 3);
    sprite(a, mx + mw - 8, my + 4, () => fill(a.base, mx + mw - 9, my - 2, 3, 6, '#7a3a2a'), H + 3);
  });
  glow(a.lights, mx + mw / 2, my + md + 3, 14, '255,214,130', 0.5);
  // reja delantera
  later(a, x, y + h - 4.5, x + w, y + h - 4, 6, () =>
    onSouth(a, y + h - 4, 6, () => {
      fill(a.base, x, 1, w, 0.6, '#151518');
      for (let i = x; i < x + w; i += 2) if (Math.abs(i - (x + w / 2)) > 5) fill(a.base, i, 0, 0.6, 6, '#151518');
    }),
  );
  tree(a, x + 8, y + 24, 5);
  tree(a, x + 70, y + 22, 5);
  tree(a, x + 68, y + 46, 4);
  tree(a, x + 10, y + 48, 4);
}

/** Coche aparcado (dos volúmenes: carrocería y cabina). */
function parkedCar(a: Art, x: number, y: number, axis: 'x' | 'y', col: string) {
  const L = 9, W = 5;
  const w = axis === 'x' ? L : W;
  const d = axis === 'x' ? W : L;
  later(a, x, y, x + w, y + d, 5, () => carBoxes(a, x, y, axis, col, false));
}

function carBoxes(a: Art, x: number, y: number, axis: 'x' | 'y', col: string, police: boolean) {
  const L = 9, W = 5;
  const w = axis === 'x' ? L : W;
  const d = axis === 'x' ? W : L;
  ellipse(a.ground, x + w / 2 + 1, y + d / 2 - 0.5, w * 0.62, d * 0.62, 'rgba(10,8,20,0.3)');
  const dark = shade(col, -0.3);
  // ruedas
  for (const [wx, wy] of axis === 'x' ? [[x + 1.5, y + d], [x + w - 3, y + d]] : [[x + w, y + 1.5], [x + w, y + d - 3]])
    sprite(a, wx, wy, () => ellipse(a.base, wx + 0.6, wy - 0.9, 1.1, 1, '#151518'));
  box(a, x, y, w, d, 2.2, { top: col, south: col, east: dark }, { z: 0.6, snow: false, south: () => {
    if (axis === 'y') {
      fill(a.base, x + 0.6, 0.6, 1, 0.8, '#fff4c0');
      fill(a.base, x + w - 1.6, 0.6, 1, 0.8, '#fff4c0');
    } else fine(a.base, x, 1.4, w, 0.5, shade(col, -0.2));
  }, east: () => {
    if (axis === 'x') {
      fill(a.base, 0.6, 0.6, 1, 0.8, '#fff4c0');
      fill(a.base, d - 1.6, 0.6, 1, 0.8, '#fff4c0');
    } else fine(a.base, 0, 1.4, d, 0.5, shade(col, -0.4));
  } });
  const cx = axis === 'x' ? x + 2.2 : x + 0.4;
  const cy = axis === 'x' ? y + 0.4 : y + 2.2;
  const cw = axis === 'x' ? 4.6 : 4.2;
  const cd = axis === 'x' ? 4.2 : 4.6;
  box(a, cx, cy, cw, cd, 1.7, { top: shade(col, 0.12), south: '#2c3446', east: '#1f2638' }, { z: 2.8, snow: true, top: () => {
    if (col === '#f2c230') fill(a.base, cx + cw / 2 - 1, cy + cd / 2 - 0.6, 2, 1.2, '#1d1d24');
    if (police) {
      fill(a.base, cx + 0.5, cy + cd / 2 - 0.5, cw / 2 - 0.5, 1, '#ff3b3b');
      fill(a.base, cx + cw / 2, cy + cd / 2 - 0.5, cw / 2 - 0.5, 1, '#3b7bff');
    }
  }, south: () => fine(a.base, cx, 0, cw, 0.5, '#5a7aa8'), east: () => fine(a.base, 0, 0, cd, 0.5, '#4a6a98') });
}

function diner(a: Art, p: Place) {
  const { x, y, w, h } = placeRect(p);
  // edificios de atrás
  let bx = x + SIDEWALK;
  while (bx < x + w - SIDEWALK - 4) {
    const lw = Math.min(x + w - SIDEWALK - bx, 18 + Math.floor(a.rand() * 12));
    building(a, bx, y + SIDEWALK, lw, 18, 18 + Math.floor(a.rand() * 12), { fireEscape: a.rand() < 0.5, laundry: true });
    bx += lw;
  }
  // aparcamiento
  rect(a.base, x + SIDEWALK, y + 22, 22, h - 22 - SIDEWALK, '#45434a');
  patch(a.base, 'grano', x + SIDEWALK, y + 22, 22, h - 22 - SIDEWALK);
  for (let i = y + 26; i < y + h - 6; i += 8) rect(a.base, x + 4, i, 18, 1, '#d8d4c6');
  parkedCar(a, x + 6, y + 27, 'x', '#c0392b');
  parkedCar(a, x + 7, y + 43, 'x', '#2f6fb3');
  // el diner: vagón de acero con franja roja y ventanales
  const dx = x + 28, dy = y + 28, dw = w - 32, dd = 18, H = 12;
  later(a, dx, dy, dx + dw, dy + dd, H + 18, () => {
    groundShadow(a, dx, dy, dw, dd, H);
    box(a, dx, dy, dw, dd, H, { top: '#aeb2ba', south: '#d6d9e0', east: '#a6aab4' }, {
      top: () => {
        for (let i = dx; i < dx + dw; i += 2) fine(a.base, i, dy, 0.6, dd, '#c4c8cf');
      },
      south: () => {
        fill(a.base, dx, 0, dw, 1, '#f4f6fa');
        fill(a.base, dx, H - 2.5, dw, 2.5, '#c0392b');
        for (let i = dx + 2; i < dx + dw - 4; i += 6) {
          fill(a.base, i, 2.5, 5, 5, '#4f86a8');
          fill(a.lights, i, 2.5, 5, 5, '#ffe7a8');
        }
        fill(a.base, dx + 4, 2.5, 4, H - 2.5, '#8d1f1f');
        drawText(a.neon, 'OPEN', dx + dw - 18, 2.5, '#5cf0ff');
      },
      east: () => {
        fill(a.base, 0, H - 2.5, dd, 2.5, '#9a2a20');
        for (let u = 2; u < dd - 4; u += 6) {
          fill(a.base, u, 2.5, 4, 5, '#3f6a88');
          fill(a.lights, u, 2.5, 4, 5, '#ffe7a8');
        }
      },
    });
    roofSign(a, 'DINER', dx + dw / 2, dy + dd / 2, H, '#ff4f6d', '255,79,109');
  });
  glow(a.lights, dx + dw / 2, dy + dd + 3, 24, '255,231,168', 0.4);
}

function tenement(a: Art, p: Place) {
  const { x, y, w, h } = placeRect(p);
  const x0 = x + SIDEWALK, y0 = y + SIDEWALK, w0 = w - SIDEWALK * 2, h0 = h - SIDEWALK * 2;
  building(a, x0 + 30, y0, w0 - 30, 22, 22, { laundry: true });
  building(a, x0, y0, 30, 22, 26, { fireEscape: true });
  // tu edificio, delante: ladrillo rojo, depósito de agua y escalera de incendios
  building(a, x0, y0 + 22, 36, h0 - 22, 32, { facadeColor: '#8e3b2e', roof: '#5b5960', fireEscape: true, shop: true, tower: true, laundry: true });
  building(a, x0 + 36, y0 + 22, w0 - 36, h0 - 22, 22, { shop: true, eastShop: true });
}

function exchange(a: Art, p: Place) {
  const { x, y, w, h } = placeRect(p);
  rect(a.base, x + SIDEWALK, y + SIDEWALK, w - SIDEWALK * 2, h - SIDEWALK * 2, '#a9a397');
  const bx = x + 6, by = y + 8, bw = w - 12, bd = 30, H = 26;
  steps(a, bx, by + bd, bw, '#cfc8b8');
  later(a, bx, by, bx + bw, by + bd, H + 14, () => {
    groundShadow(a, bx, by, bw, bd, H);
    box(a, bx, by, bw, bd, H, { top: '#ddd6c6', south: '#ece6d8', east: '#cbc4b4' }, {
      top: () => {
        fill(a.base, bx + 10, by + 5, bw - 20, bd - 10, '#6fa7c7');
        for (let i = bx + 12; i < bx + bw - 10; i += 4) fine(a.base, i, by + 5, 0.6, bd - 10, '#a9d4ea');
        fill(a.lights, bx + 10, by + 5, bw - 20, bd - 10, 'rgba(220,255,235,0.7)');
      },
      south: () => {
        fill(a.base, bx, 0, bw, 2, '#fffaf0');
        for (let i = bx + 3; i < bx + bw - 3; i += 6) {
          fill(a.base, i, 3, 3, H - 4, '#fbf8f0');
          fine(a.base, i + 2.5, 3, 0.5, H - 4, '#c9c1b0');
          fill(a.base, i + 3.2, 6, 2.6, H - 9, '#26304a');
          fill(a.lights, i + 3.2, 6, 2.6, H - 9, 'rgba(200,255,220,0.8)');
        }
        // ticker de neón verde
        fill(a.base, bx + bw / 2 - 15, 2.5, 30, 7, '#001a0b');
        glow(a.neon, bx + bw / 2, 6, 26, '0,255,127', 0.4);
        drawText(a.neon, 'BOLSA', Math.round(bx + bw / 2 - textWidth('BOLSA') / 2), 3.5, '#00ff7f');
      },
      east: () => {
        for (let u = 3; u < bd - 3; u += 5) {
          fill(a.base, u, 5, 2, H - 8, '#26304a');
          fill(a.lights, u, 5, 2, H - 8, 'rgba(200,255,220,0.8)');
        }
      },
    });
    onSouth(a, by + bd, H, () => pediment(a, bx + 6, bw - 12, '#f4efe2'));
    // banderas en lo alto
    for (let i = 0; i < 3; i++) {
      const fx = bx + 14 + i * 22;
      const fy = by + bd - 2;
      sprite(a, fx, fy, () => {
        fine(a.base, fx, fy - 10, 0.6, 10, '#333');
        fill(a.base, fx + 0.6, fy - 10, 5, 3, ['#2f6fb3', '#f1ede3', '#c0392b'][i]);
      }, H);
    }
  });
}

function timesSquare(a: Art, p: Place) {
  const { x, y, w, h } = placeRect(p);
  const x0 = x + SIDEWALK, y0 = y + SIDEWALK;
  const boards: [string, string, string][] = [
    ['LIVE', '#ff4f9a', '255,79,154'],
    ['ROCK', '#4ff0ff', '79,240,255'],
    ['CINE', '#ffcc33', '255,204,51'],
    ['SALE', '#7dff6a', '125,255,106'],
    ['1985', '#ff8a3b', '255,138,59'],
    ['TAXI', '#ffe066', '255,224,102'],
  ];
  const lots: [number, number, number, number, number][] = [
    [x0, y0, 26, 22, 40],
    [x0 + 26, y0, 24, 22, 52],
    [x0 + 50, y0, w - SIDEWALK * 2 - 50, 22, 36],
    [x0, y0 + 22, 24, h - SIDEWALK * 2 - 22, 28],
    [x0 + 24, y0 + 22, 26, h - SIDEWALK * 2 - 22, 32],
    [x0 + 50, y0 + 22, w - SIDEWALK * 2 - 50, h - SIDEWALK * 2 - 22, 26],
  ];
  lots.forEach(([lx, ly, lw, ld, H], i) => {
    building(a, lx, ly, lw, ld, H, { facadeColor: '#3a3448', roof: '#2e2a38', shop: i >= 3, eastShop: i === 5 });
    const [t, col, rgb] = boards[i];
    // cartel luminoso en la fachada sur, en lo alto
    later(a, lx, ly + ld - 0.2, lx + lw, ly + ld, H, () =>
      onSouth(a, ly + ld + 0.05, H, () => {
        const bw = Math.min(lw - 4, textWidth(t) + 10);
        const bx = lx + (lw - bw) / 2;
        fill(a.base, bx, 3, bw, 11, '#101018');
        glow(a.neon, bx + bw / 2, 8, bw * 0.8, rgb, 0.45);
        fill(a.neon, bx + 1, 4, bw - 2, 0.6, col);
        fill(a.neon, bx + 1, 12.4, bw - 2, 0.6, col);
        drawText(a.neon, t, Math.round(bx + bw / 2 - textWidth(t) / 2), 6, col);
      }),
    );
  });
  glow(a.neon, x + w / 2, y + h + 6, 50, '255,120,200', 0.16);
}

function signBlock(a: Art, p: Place, text: string, color: string, rgb: string, vertical = false) {
  genericBlock(a, p.c, p.r);
  const { x, y, w, h } = placeRect(p);
  const fy = y + h - SIDEWALK + 0.4;
  if (vertical) {
    later(a, x + w - 22, fy - 0.3, x + w - 16, fy, 36, () => standS(a, fy, () => neonVertical(a, text, x + w - 22, fy - 36, color, rgb), 0));
  } else {
    later(a, x + w / 2 - 8, fy - 0.3, x + w / 2 + 8, fy, 20, () => standS(a, fy, () => neonSign(a, text, x + w / 2, fy - 19, color, rgb), 0));
  }
}

// --------------------------------------------------------------------------
// Solares: vacíos, en obras, casa del inmigrante y obras públicas
// --------------------------------------------------------------------------

/** Rectángulo de la media manzana que ocupa un solar. */
export function lotRect(l: LotDef) {
  const half = Math.floor(BLOCK_W / 2);
  return { x: blockX(l.c) + (l.side === 'este' ? half : 0), y: blockY(l.r), w: half, h: BLOCK_H };
}

/** Parte edificable del solar (sin la acera exterior). */
function lotInner(l: LotDef) {
  const r = lotRect(l);
  const x = r.x + (l.side === 'oeste' ? SIDEWALK : 0);
  return { x, y: r.y + SIDEWALK, w: r.w - SIDEWALK, h: r.h - SIDEWALK * 2 };
}

function dirt(a: Art, x: number, y: number, w: number, h: number) {
  rect(a.base, x, y, w, h, '#6b5a44');
  for (let i = 0; i < (w * h) / 5; i++) rect(a.base, x + a.rand() * w, y + a.rand() * h, 1, 1, a.rand() < 0.5 ? '#5c4c38' : '#7d6a52');
  rect(a.snow, x, y, w, h, 'rgba(240,246,255,0.85)');
}

/** Valla de obra o de alambre en el borde sur del solar. */
function fence(a: Art, x: number, y: number, w: number, hoarding: boolean) {
  later(a, x, y - 0.4, x + w, y, 6, () =>
    onSouth(a, y, 6, () => {
      if (hoarding) {
        fill(a.base, x, 0, w, 6, '#2b2f36');
        for (let xx = x; xx < x + w; xx += 4) fill(a.base, xx, 0, 2, 1, '#f2c230');
        fill(a.base, x, 5.4, w, 0.6, '#14101f');
      } else {
        for (let xx = x; xx < x + w; xx += 1) fine(a.base, xx, 1 + ((xx * 2) % 2), 0.5, 0.5, '#9aa0a6');
        for (let yy = 1; yy < 6; yy += 1.2) fine(a.base, x, yy, w, 0.3, 'rgba(154,160,166,0.6)');
        fill(a.base, x, 0.5, w, 0.6, '#9aa0a6');
        for (let xx = x; xx < x + w; xx += 8) fill(a.base, xx, 0.5, 0.8, 5.5, '#5d6268');
      }
    }),
  );
}

/** Cartel sobre postes, de pie. */
function boardSign(a: Art, text: string, cx: number, cy: number, board: string, ink: string) {
  later(a, cx - 6, cy - 0.5, cx + 6, cy, 14, () =>
    standS(a, cy, () => {
      const w = textWidth(text) + 4;
      const x = Math.round(cx - w / 2);
      const y = cy - 13;
      fine(a.base, x + 2, y + 8, 0.8, 5, '#4a3020');
      fine(a.base, x + w - 3, y + 8, 0.8, 5, '#4a3020');
      rect(a.base, x, y, w, 8, board);
      rect(a.base, x, y + 7, w, 1, shade(board, -0.3));
      drawText(a.base, text, x + 2, y + 1, ink);
    }),
  );
}

function crane(a: Art, x: number, y: number, h: number) {
  later(a, x - 1.5, y - 3, x + 1.5, y, h + 4, () => {
    groundShadow(a, x - 1.5, y - 3, 3, 3, h * 0.5, 0.18);
    const lattice = () => {
      for (let v = 0; v < h; v += 2) {
        fine(a.base, 0, v, 3, 0.4, '#c99a1e');
        fine(a.base, (v / 2) % 2 ? 0 : 2.4, v, 0.6, 2, '#c99a1e');
      }
    };
    box(a, x - 1.5, y - 3, 3, 3, h, { top: '#f2c230', south: 'rgba(242,194,48,0.35)', east: 'rgba(201,154,30,0.35)' }, {
      snow: false,
      south: () => {
        fill(a.base, x - 1.5, 0, 0.6, h, '#f2c230');
        fill(a.base, x + 0.9, 0, 0.6, h, '#f2c230');
        plane(a, [x - 1.5, y, h], [1, 0, 0], [0, 0, -1], lattice);
      },
      east: () => {
        fill(a.base, 2.4, 0, 0.6, h, '#c99a1e');
        plane(a, [x + 1.5, y, h], [0, -1, 0], [0, 0, -1], lattice);
      },
    });
    // pluma a lo largo de la calle, con contrapeso y gancho
    standS(a, y - 1.5, () => {
      const t = y - 1.5 - h;
      rect(a.base, x - 12, t - 2, 30, 2, '#f2c230');
      for (let xx = x - 12; xx < x + 18; xx += 3) fine(a.base, xx, t - 1, 0.8, 0.8, '#c99a1e');
      rect(a.base, x - 11, t, 4, 3, '#55595f');
      fine(a.base, x + 15, t, 0.5, 11, '#14101f');
      rect(a.base, x + 14, t + 11, 3, 2, '#7a5232');
      rect(a.lights, x, t - 3, 1, 1, '#ff3b3b');
      rect(a.snow, x - 12, t - 3, 30, 1, 'rgba(245,250,255,0.9)');
    }, 0);
  });
}

function emptyLot(a: Art, l: LotDef, sold: boolean) {
  const { x, y, w, h } = lotInner(l);
  dirt(a, x, y, w, h);
  for (let i = 0; i < 18; i++) rect(a.base, x + 2 + a.rand() * (w - 4), y + 2 + a.rand() * (h - 6), 1, 2, a.rand() < 0.6 ? '#5f8a3a' : '#7aa04a');
  for (let i = 0; i < 4; i++) rect(a.base, x + 3 + a.rand() * (w - 8), y + 4 + a.rand() * (h - 12), 3, 2, '#8a8478');
  fence(a, x, y + h, w, false);
  boardSign(a, sold ? 'SOLD' : 'FOR SALE', x + w / 2, y + h - 10, sold ? '#c0392b' : '#f4efe2', sold ? '#ffffff' : '#c0392b');
}

/** Casa del inmigrante, según las fases terminadas. */
function houseLot(a: Art, l: LotDef, phase: number, works: boolean) {
  const { x, y, w, h } = lotInner(l);
  if (phase < 4) dirt(a, x, y, w, h);
  else {
    rect(a.base, x, y, w, h, '#4f8a3e');
    patch(a.base, 'cesped', x, y, w, h);
    rect(a.snow, x, y, w, h, 'rgba(240,246,255,0.88)');
    rect(a.base, x + w / 2 - 1, y + 26, 2, h - 30, '#cfc6ad');
  }
  const hx = x + 4, hw = w - 8, hy = y + 6, hd = 20;
  const H = 12;
  if (phase >= 1) {
    // cimientos: losa de hormigón con varillas
    rect(a.base, hx - 1, hy - 1, hw + 2, hd + 2, '#9c9890');
    rect(a.base, hx, hy, hw, hd, '#b9b5ac');
    if (phase === 1) for (let xx = hx + 2; xx < hx + hw - 1; xx += 4) for (let yy = hy + 2; yy < hy + hd - 1; yy += 4) rect(a.base, xx, yy, 1, 1, '#7a4a2a');
  }
  if (phase === 2) {
    // estructura de madera
    later(a, hx, hy, hx + hw, hy + hd, H + 2, () => {
      onSouth(a, hy + hd, H, () => {
        for (let xx = hx; xx <= hx + hw - 1; xx += 5) fill(a.base, xx, 0, 0.8, H, '#c99a5a');
        fill(a.base, hx, 0, hw, 0.8, '#a8783a');
        fill(a.base, hx, H / 2, hw, 0.8, '#a8783a');
      });
      onEast(a, hx + hw, hy + hd, H, () => {
        for (let u = 0; u <= hd; u += 5) fill(a.base, u, 0, 0.8, H, '#a8783a');
        fill(a.base, 0, 0, hd, 0.8, '#8a6030');
      });
      onSouth(a, hy, H, () => {
        for (let xx = hx; xx <= hx + hw - 1; xx += 5) fill(a.base, xx, 0, 0.8, H, 'rgba(201,154,90,0.6)');
      });
    });
  }
  if (phase >= 3) {
    const finished = phase >= 4;
    const wall = finished ? '#e8dcc0' : '#c9a46a';
    later(a, hx, hy, hx + hw, hy + hd, H + 9, () => {
      groundShadow(a, hx, hy, hw, hd, H + 4);
      box(a, hx, hy, hw, hd, H, { top: wall, south: wall, east: shade(wall, -0.2) }, {
        south: () => {
          fill(a.base, hx, 0, hw, 1, shade(wall, 0.2));
          if (finished) {
            for (const wx of [hx + 3, hx + hw - 7]) {
              fill(a.base, wx, 3, 4, 4, '#26304a');
              fill(a.base, wx - 1, 3, 1, 4, '#2f6fb3');
              fill(a.base, wx + 4, 3, 1, 4, '#2f6fb3');
              fill(a.lights, wx, 3, 4, 4, '#ffd27a');
            }
            fill(a.base, hx + hw / 2 - 2, 4, 4, H - 4, '#7a3a2a');
            fine(a.base, hx + hw / 2 + 1, 8, 0.6, 0.6, '#ffd24a');
          } else {
            for (let xx = hx + 1; xx < hx + hw; xx += 3) fine(a.base, xx, 1, 0.5, H - 1, shade(wall, -0.08));
            fill(a.base, hx + 3, 3, 4, 4, '#3a2a20');
            fill(a.base, hx + hw - 7, 3, 4, 4, '#3a2a20');
            fill(a.base, hx + hw / 2 - 2, 4, 4, H - 4, '#3a2a20');
          }
        },
        east: () => {
          if (finished) {
            fill(a.base, hd / 2 - 2, 3, 4, 4, '#26304a');
            fill(a.lights, hd / 2 - 2, 3, 4, 4, '#ffd27a');
          }
        },
      });
      gable(a, hx - 1, hy - 1, hw + 2, hd + 2, H, 7, '#b8442e', '#9a3424', wall);
      if (finished) sprite(a, hx + hw - 5, hy + 5, () => fill(a.base, hx + hw - 6, hy - 1, 3, 6, '#7a3a2a'), H + 3);
    });
    if (finished) glow(a.lights, hx + hw / 2, hy + hd + 2, 10, '255,214,130', 0.5);
  }
  if (phase >= 4) {
    // valla blanca y buzón
    later(a, x, y + h - 4.4, x + w, y + h - 4, 5, () =>
      onSouth(a, y + h - 4, 4, () => {
        for (let xx = x; xx < x + w; xx += 2) if (Math.abs(xx - (x + w / 2)) > 3) fill(a.base, xx, 0, 0.8, 4, '#ffffff');
        fill(a.base, x, 1.5, w, 0.6, '#e8e4d8');
      }),
    );
    later(a, x + w / 2 + 6, y + h - 3.5, x + w / 2 + 8, y + h - 3, 7, () =>
      sprite(a, x + w / 2 + 7, y + h - 3, () => {
        fine(a.base, x + w / 2 + 6.6, y + h - 8, 0.8, 5, '#4a3020');
        fill(a.base, x + w / 2 + 5.5, y + h - 10, 4, 2.5, '#2f6fb3');
      }),
    );
    tree(a, x + 5, y + h - 6, 3);
  }
  if (works) {
    later(a, hx - 1, hy + hd, hx + hw + 1, hy + hd + 0.5, H + 4, () => onSouth(a, hy + hd + 0.5, H + 3, () => scaffoldFace(a, hx - 1, hw + 2, H + 3)));
    // hormigonera
    later(a, x + w - 10, y + h - 12, x + w - 4, y + h - 8, 7, () =>
      sprite(a, x + w - 7, y + h - 8, () => {
        rect(a.base, x + w - 10, y + h - 14, 6, 5, '#e2a23b');
        rect(a.base, x + w - 9, y + h - 15, 4, 1, '#c07a1a');
        rect(a.base, x + w - 10, y + h - 9, 1, 1, '#14101f');
        rect(a.base, x + w - 5, y + h - 9, 1, 1, '#14101f');
      }),
    );
  }
  if (phase < 4) fence(a, x, y + h, w, works);
  if (phase === 0 && !works) boardSign(a, 'SOLD', x + w / 2, y + h - 10, '#c0392b', '#ffffff');
}

function civicBox(a: Art, x: number, y: number, w: number, d: number, H: number, wall: string, roofC: string, win: string, extra?: () => void) {
  const own = mulberry32(Math.floor(a.rand() * 0x7fffffff));
  later(a, x, y, x + w, y + d, H + 12, () => {
    groundShadow(a, x, y, w, d, H);
    const winGrid = (u0: number, uw: number) => {
      for (let v = 3; v <= H - 6; v += FLOOR)
        for (let u = u0 + 2; u <= u0 + uw - 3; u += 4) {
          fill(a.base, u, v, 2, 2.6, '#26304a');
          if (own() < 0.6) fill(a.lights, u, v, 2, 2.6, win);
        }
    };
    box(a, x, y, w, d, H, { top: roofC, south: wall, east: shade(wall, -0.22) }, {
      south: () => {
        fill(a.base, x, 0, w, 1, shade(wall, 0.25));
        winGrid(x, w);
        fill(a.base, x + w / 2 - 2, H - 5, 4, 5, '#3a2a20');
        fill(a.lights, x + w / 2 - 2, H - 5, 4, 1, '#ffe2a0');
      },
      east: () => winGrid(0, d),
      top: () => fine(a.base, x, y, w, 0.8, shade(roofC, 0.3)),
    });
    extra?.();
  });
}

function civicLot(a: Art, l: LotDef, id: string) {
  const { x, y, w, h } = lotInner(l);
  const pave = (c: string) => {
    rect(a.base, x, y, w, h, c);
    rect(a.snow, x, y, w, h, 'rgba(240,246,255,0.8)');
  };
  if (id === 'parque') {
    rect(a.base, x, y, w, h, '#3f7a3a');
    patch(a.base, 'cesped', x, y, w, h);
    rect(a.snow, x, y, w, h, 'rgba(240,246,255,0.85)');
    rect(a.base, x + w / 2 - 1, y, 3, h, '#c9b98e');
    rect(a.base, x, y + h / 2, w, 3, '#c9b98e');
    ellipse(a.base, x + w / 2, y + h / 2 + 1, 4.5, 4.5, '#8a8478');
    ellipse(a.base, x + w / 2, y + h / 2 + 1, 2.5, 2.5, '#4f8fb8');
    glow(a.lights, x + w / 2, y + h / 2, 10, '150,210,255', 0.4);
    for (const [tx, ty] of [[x + 7, y + 12], [x + w - 7, y + 14], [x + 8, y + h - 8], [x + w - 8, y + h - 6], [x + w / 2 + 9, y + 6]]) tree(a, Math.round(tx), Math.round(ty), 3);
    later(a, x + 4, y + h / 2 + 5, x + 10, y + h / 2 + 7, 3, () =>
      box(a, x + 4, y + h / 2 + 5, 6, 1.5, 1.4, { top: '#9a6a3a', south: '#7a5232' }),
    );
    return;
  }
  if (id === 'escuela') {
    pave('#a9a397');
    civicBox(a, x + 2, y + 6, w - 4, 22, 24, '#9a4a34', '#4a4850', '#ffd27a', () => {
      onSouth(a, y + 28, 24, () => {
        fill(a.base, x + w / 2 - 12, 1.5, 24, 6, '#f4efe2');
        drawText(a.base, 'SCHOOL', Math.round(x + w / 2 - textWidth('SCHOOL') / 2), 2, '#2f6fb3');
      });
      sprite(a, x + w - 5, y + 10, () => {
        fine(a.base, x + w - 5, y, 0.6, 10, '#333');
        fill(a.base, x + w - 4.4, y, 5, 3, '#2f6fb3');
        fine(a.base, x + w - 4.4, y + 1, 5, 0.8, '#c0392b');
      }, 24);
    });
    // autobús escolar
    later(a, x + 4, y + h - 12, x + 22, y + h - 7, 7, () =>
      box(a, x + 4, y + h - 12, 18, 5, 5, { top: '#ffe066', south: '#f2c230', east: '#c99a1e' }, {
        z: 0.6,
        south: () => {
          for (let u = x + 6; u < x + 21; u += 3) fill(a.base, u, 1, 2, 1.6, '#26304a');
          fine(a.base, x + 4, 3.4, 18, 0.5, '#14101f');
        },
      }),
    );
    return;
  }
  if (id === 'hospital') {
    pave('#b9b3a6');
    civicBox(a, x + 2, y + 4, w - 4, 24, 34, '#ece6d8', '#c9c3b6', '#cfe6ff', () => {
      onTop(a, 34, () => {
        // helipuerto con cruz roja
        ellipse(a.base, x + w / 2, y + 16, 7, 7, '#5a5f6a');
        fill(a.base, x + w / 2 - 1.2, y + 12, 2.4, 8, '#e8414f');
        fill(a.base, x + w / 2 - 4, y + 14.8, 8, 2.4, '#e8414f');
      });
      onSouth(a, y + 28, 34, () => {
        fill(a.base, x + w / 2 - 17, 3, 34, 9, '#1d1d24');
        glow(a.neon, x + w / 2, 7.5, 24, '255,79,109', 0.4);
        drawText(a.neon, 'HOSPITAL', Math.round(x + w / 2 - textWidth('HOSPITAL') / 2), 5, '#ff4f6d');
      });
    });
    // ambulancia
    later(a, x + w - 16, y + h - 12, x + w - 4, y + h - 7, 6, () =>
      box(a, x + w - 16, y + h - 12, 12, 5, 4.6, { top: '#f4efe2', south: '#f4efe2', east: '#d8d4c6' }, {
        z: 0.6,
        south: () => {
          fill(a.base, x + w - 16, 2, 12, 1, '#e8414f');
          fill(a.lights, x + w - 13, 0, 2, 0.8, '#ff3b3b');
        },
      }),
    );
    return;
  }
  if (id === 'metro') {
    pave('#8d8a86');
    for (let yy = y; yy < y + h; yy += 4) for (let xx = x + ((yy / 4) % 2 ? 2 : 0); xx < x + w; xx += 4) rect(a.base, xx, yy, 2, 2, '#9a9792');
    // boca de metro con barandilla y escaleras
    const ex = x + w / 2 - 8, ey = y + 18;
    rect(a.base, ex, ey, 16, 14, '#26242a');
    for (let s = 0; s < 6; s++) rect(a.base, ex + 2, ey + 2 + s * 2, 12, 1, '#55505c');
    later(a, ex - 1, ey - 1, ex + 17, ey + 14, 14, () => {
      onSouth(a, ey - 1, 3, () => fill(a.base, ex - 1, 0, 18, 0.8, '#2e5a3a'));
      for (const gx of [ex - 1, ex + 16]) {
        onEast(a, gx + 0.8, ey + 14, 3, () => fill(a.base, 0, 0, 15, 0.8, '#2e5a3a'));
        sprite(a, gx, ey - 1, () => {
          fine(a.base, gx, ey - 9, 0.8, 8, '#2e5a3a');
          fineDisc(a.base, gx + 0.4, ey - 10.5, 1.8, '#3fbf6a');
          glow(a.lights, gx, ey - 10.5, 8, '120,255,150', 0.6);
        });
      }
      sprite(a, ex + 8, ey - 1, () => {
        rect(a.base, ex + 1, ey - 12, 14, 7, '#14101f');
        drawText(a.neon, 'SUB', ex + 3, ey - 11, '#7dff6a');
        glow(a.neon, ex + 8, ey - 9, 12, '125,255,106', 0.35);
      });
    });
    tree(a, x + 6, y + h - 6, 3);
    tree(a, x + w - 6, y + h - 6, 3);
    return;
  }
  if (id === 'museo') {
    pave('#c6c0b3');
    const bx = x + 2, by = y + 6, bw = w - 4, bd = 22, H = 20;
    steps(a, bx, by + bd, bw, '#cfc8b8');
    later(a, bx, by, bx + bw, by + bd, H + 8, () => {
      groundShadow(a, bx, by, bw, bd, H);
      box(a, bx, by, bw, bd, H, { top: '#d8d0bf', south: '#ece6d8', east: '#cbc4b4' }, {
        south: () => {
          for (let i = bx + 2; i < bx + bw - 2; i += 5) {
            fill(a.base, i, 2, 2, H - 3, '#fbf8f0');
            fill(a.base, i + 2, 4, 3, H - 6, '#26304a');
            fill(a.lights, i + 2, 4, 3, H - 6, 'rgba(255,220,160,0.7)');
          }
          fill(a.base, bx + 2, 3, 3, 9, '#c0392b');
          fill(a.base, bx + bw - 5, 3, 3, 9, '#2f6fb3');
        },
      });
      onSouth(a, by + bd, H, () => {
        pediment(a, bx + 2, bw - 4, '#f4efe2');
        drawText(a.base, 'MUSEUM', Math.round(bx + bw / 2 - textWidth('MUSEUM') / 2), -4.5, '#6d6656');
      });
    });
    return;
  }
  // viviendas sociales: dos bloques altos de ladrillo
  pave('#8d8a86');
  building(a, x + 1, y + 2, Math.floor((w - 2) / 2), 22, 44, { facadeColor: '#9a5a44', roof: '#4a4850', fireEscape: true });
  building(a, x + 1 + Math.floor((w - 2) / 2), y + 2, Math.ceil((w - 2) / 2), 22, 40, { facadeColor: '#8e4a3a', roof: '#56606a', fireEscape: true, tower: true });
  tree(a, x + 6, y + h - 6, 3);
  tree(a, x + w - 8, y + h - 6, 3);
}

function civicWorks(a: Art, l: LotDef) {
  const { x, y, w, h } = lotInner(l);
  dirt(a, x, y, w, h);
  // estructura a medias con andamio y grúa
  later(a, x + 4, y + 6, x + w - 4, y + 26, 16, () => {
    box(a, x + 4, y + 6, w - 8, 20, 14, { top: '#8f8b84', south: '#8f8b84', east: '#6d6a64' }, {
      south: () => {
        for (let xx = x + 4; xx < x + w - 4; xx += 6) fill(a.base, xx, 0, 1, 14, '#6d6a64');
        fill(a.base, x + 4, 6, w - 8, 1, '#6d6a64');
        scaffoldFace(a, x + 3, w - 6, 14);
      },
    });
  });
  crane(a, x + w - 8, y + 28, 52);
  later(a, x + 5, y + h - 12, x + 26, y + h - 8, 6, () => {
    box(a, x + 5, y + h - 12, 8, 4, 4, { top: '#e2a23b', south: '#e2a23b', east: '#c07a1a' }, { z: 0.6 });
    for (let i = 0; i < 3; i++) box(a, x + 16 + i * 4, y + h - 11, 3, 3, 3, { top: '#d8b47a', south: '#c9a46a' });
  });
  fence(a, x, y + h, w, true);
}

function drawLot(a: Art, l: LotDef, st: CityLook['lots'][string] | undefined) {
  const prev = a.rand;
  a.rand = mulberry32((a.seed ^ (l.c * 31 + l.r * 977 + 5)) >>> 0);
  if (!st) emptyLot(a, l, false);
  else if (st.owner === 'privado') officeLot(a, l);
  else if (st.owner === 'jugador') {
    if (st.building === 'vacio') emptyLot(a, l, true);
    else if (st.building === 'casa' && st.level <= 1) houseLot(a, l, st.phase, st.works);
    else if (st.building === 'casa') rentalLot(a, l, st.level, st.works);
    else bizLot(a, l, st.building, st.level, st.works);
  } else if (st.works && st.phase === 0) civicWorks(a, l);
  else {
    civicLot(a, l, st.building);
    civicExtras(a, l, st.building, st.level, st.works);
  }
  a.rand = prev;
}

/** Casa de alquiler ampliada: dúplex (nivel 2) o edificio de 4 pisos (nivel 3). */
function rentalLot(a: Art, l: LotDef, level: number, works: boolean) {
  const { x, y, w, h } = lotInner(l);
  rect(a.base, x, y, w, h, '#8d8a86');
  rect(a.snow, x, y, w, h, 'rgba(240,246,255,0.8)');
  if (level === 2) {
    building(a, x + 2, y + 6, w - 4, 22, 22, { facadeColor: '#c98a5a', roof: '#9a3424', shop: false, win: 3, fireEscape: false });
    tree(a, x + 5, y + h - 4, 3);
    tree(a, x + w - 6, y + h - 4, 3);
  } else {
    building(a, x + 2, y + 4, w - 4, 26, 30, { facadeColor: '#b5523e', roof: '#5b5960', shop: true, fireEscape: true, tower: true, sign: textWidth('ROOMS') + 4 <= w - 4 ? 'ROOMS' : undefined });
  }
  if (works) later(a, x + 2, y + 30, x + w - 2, y + 30.5, 32, () => onSouth(a, y + 30.5, 30, () => scaffoldFace(a, x + 2, w - 4, 30)));
  later(a, x + 4, y + h - 3.5, x + 10, y + h - 3, 7, () =>
    sprite(a, x + 7, y + h - 3, () => {
      fine(a.base, x + 6.6, y + h - 7, 0.8, 4, '#4a3020');
      rect(a.base, x + 4, y + h - 13, 6, 6, '#f4efe2');
      drawText(a.base, 'R', x + 5, y + h - 12, '#c0392b');
    }),
  );
}

/** Negocios del inmigrante: lavandería, puesto de comida o taller (3 niveles). */
function bizLot(a: Art, l: LotDef, id: string, level: number, works: boolean) {
  const { x, y, w, h } = lotInner(l);
  if (level === 0) {
    // en obras para abrir
    dirt(a, x, y, w, h);
    later(a, x + 4, y + 10, x + w - 4, y + 30, 16, () =>
      box(a, x + 4, y + 10, w - 8, 20, 14, { top: '#8f8b84', south: '#8f8b84', east: '#6d6a64' }, { south: () => scaffoldFace(a, x + 3, w - 6, 14) }),
    );
    fence(a, x, y + h, w, true);
    return;
  }
  rect(a.base, x, y, w, h, '#8d8a86');
  for (let xx = x; xx < x + w; xx += 6) rect(a.base, xx, y + h - 3, 1, 3, '#7c7975');
  rect(a.snow, x, y, w, h, 'rgba(240,246,255,0.8)');
  const H = 12 + level * 6;
  const conf = {
    lavanderia: { color: '#4f7fc8', sign: level >= 3 ? 'WASH 24' : 'WASH', neon: ['#4ff0ff', '79,240,255'] },
    comida: { color: '#e2a23b', sign: level >= 3 ? 'DINING' : level === 2 ? 'CAFE' : 'TACOS', neon: ['#ffcc33', '255,204,51'] },
    taller: { color: '#5a5c60', sign: level >= 3 ? 'CARS' : 'GARAGE', neon: ['#ff8a3b', '255,138,59'] },
  }[id] ?? { color: '#7a6a5a', sign: 'SHOP', neon: ['#ffffff', '255,255,255'] };
  const bd = 16 + level * 3;
  const by = y + h - bd - 12;
  building(a, x + 2, by, w - 4, bd, H, { facadeColor: conf.color, roof: '#4a4850', shop: true, win: 3, scaffold: works });
  later(a, x + w / 2 - 6, by + bd / 2, x + w / 2 + 6, by + bd / 2 + 1, H + 16, () => {
    const [col, rgb] = conf.neon;
    if (textWidth(conf.sign) + 4 <= w + 6) roofSign(a, conf.sign, x + w / 2, by + bd / 2 + 1, H, col, rgb);
  });
  // delante: mesas (comida), coches (taller), lavadoras (lavandería)
  if (id === 'comida')
    for (let k = 0; k < level + 1; k++) {
      const tx = x + 4 + k * 9;
      later(a, tx, y + h - 9, tx + 6, y + h - 6, 7, () => {
        box(a, tx, y + h - 9, 6, 3, 2.4, { top: '#f4efe2', south: '#d8d4c6' });
        sprite(a, tx + 3, y + h - 7.5, () => {
          fine(a.base, tx + 2.8, y + h - 13, 0.5, 4, '#555');
          poly(a.base, [tx, y + h - 12.5, tx + 6, y + h - 12.5, tx + 3, y + h - 15], ['#c0392b', '#3a7a4a', '#2f6fb3'][k % 3]);
        }, 2.4);
      });
    }
  if (id === 'taller') for (let k = 0; k < level; k++) parkedCar(a, x + 3 + k * 11, y + h - 10, 'x', ['#f2c230', '#c0392b', '#2f6fb3'][k % 3]);
  if (id === 'lavanderia')
    for (let k = 0; k < Math.min(4, level * 2); k++) {
      const mx = x + 4 + k * 7;
      later(a, mx, y + h - 10, mx + 5, y + h - 6, 6, () =>
        box(a, mx, y + h - 10, 5, 4, 5, { top: '#e8e4d8', south: '#f4efe2', east: '#c8c4b8' }, { south: () => ellipse(a.base, mx + 2.5, 2.6, 1.6, 1.6, '#4f86a8') }),
      );
    }
}

/** Solar subastado: torre de oficinas acristalada. */
function officeLot(a: Art, l: LotDef) {
  const { x, y, w, h } = lotInner(l);
  rect(a.base, x, y, w, h, '#9a9792');
  rect(a.snow, x, y, w, h, 'rgba(240,246,255,0.8)');
  building(a, x + 3, y + 6, w - 6, 28, 78, { facadeColor: '#4f6a86', roof: '#56606a', glass: true, setback: true });
  later(a, x + w / 2 - 6, y + 34, x + w / 2 + 6, y + 34.5, 20, () =>
    onSouth(a, y + 34.05, 60, () => {
      fill(a.base, x + w / 2 - 13, 2, 26, 9, '#101820');
      glow(a.neon, x + w / 2, 6.5, 20, '159,232,255', 0.4);
      drawText(a.neon, 'HUDSON', Math.round(x + w / 2 - textWidth('HUDSON') / 2), 4, '#9fe8ff');
    }),
  );
}

/** Obras públicas ampliadas: adornos de nivel 2 y 3 y andamios si se amplían. */
function civicExtras(a: Art, l: LotDef, id: string, level: number, works: boolean) {
  const { x, y, w, h } = lotInner(l);
  if (works) {
    later(a, x + 2, y + 29, x + w - 2, y + 29.5, 30, () => onSouth(a, y + 29.5, 28, () => scaffoldFace(a, x + 2, w - 4, 28)));
    crane(a, x + w - 6, y + 30, 48);
  }
  if (level < 2) return;
  // banderas y farolas de gala
  for (let k = 0; k < level; k++) {
    const fx = x + 3 + k * 10;
    const fy = y + h - 2;
    later(a, fx - 0.5, fy - 0.5, fx + 0.5, fy, 14, () =>
      sprite(a, fx, fy, () => {
        fine(a.base, fx, fy - 13, 0.6, 13, '#333');
        fill(a.base, fx + 0.6, fy - 13, 4, 3, ['#2f6fb3', '#c0392b', '#ffcc33'][k % 3]);
      }),
    );
  }
  if (level >= 3) glow(a.lights, x + w / 2, y + h / 2, 24, '255,214,140', 0.4);
  if (id === 'parque' && level >= 2) ellipse(a.base, x + w / 2 + 6, y + 14, 9, 4.5, '#3f86c8');
}

// --------------------------------------------------------------------------
// Calles
// --------------------------------------------------------------------------

/** Flecha pintada en el asfalto (sentido de circulación). */
function arrow(ctx: Ctx, x: number, y: number, dx: number, dy: number) {
  const col = 'rgba(232,228,216,0.75)';
  if (dy) {
    fine(ctx, x - 0.25, y - 2.5 * dy, 0.5, 4, col);
    for (let k = 0; k < 3; k++) fine(ctx, x - 0.25 - k * 0.5, y + (1.5 - k * 0.5) * dy, 0.5 + k, 0.5, col);
  } else {
    fine(ctx, x - 2.5 * dx, y - 0.25, 4, 0.5, col);
    for (let k = 0; k < 3; k++) fine(ctx, x + (1.5 - k * 0.5) * dx, y - 0.25 - k * 0.5, 0.5, 0.5 + k, col);
  }
}

function lamp(a: Art, lx: number, ly: number) {
  later(a, lx - 0.5, ly - 0.5, lx + 0.5, ly, 14, () =>
    sprite(a, lx, ly, () => {
      const { base } = a;
      fine(base, lx - 0.4, ly - 13, 0.8, 13, '#1f2a24');
      fine(base, lx, ly - 13, 0.4, 13, '#2e3b33');
      fine(base, lx - 2, ly - 13.5, 4, 0.6, '#2e3b33');
      fill(base, lx - 2.6, ly - 13, 1.4, 1.2, '#d8c890');
      fill(base, lx + 1.2, ly - 13, 1.4, 1.2, '#d8c890');
      fine(base, lx - 1, ly - 1, 2, 1, '#1f2a24');
      fill(a.lights, lx - 2.6, ly - 13, 1.4, 1.2, '#ffe2a0');
      fill(a.lights, lx + 1.2, ly - 13, 1.4, 1.2, '#ffe2a0');
      glow(a.lights, lx, ly - 12.5, 4, '255,230,170', 0.6);
    }),
  );
}

/** Poste del semáforo (la luz la pone la escena, que cambia de color). */
function signalPole(a: Art, x: number, y: number) {
  a.signals.push({ x, y });
  later(a, x - 0.5, y - 0.5, x + 0.5, y, 13, () =>
    sprite(a, x, y, () => {
      fine(a.base, x - 0.4, y - 10, 0.8, 10, '#1a1a1f');
      fill(a.base, x - 1.2, y - 12.5, 2.4, 3, '#1a1a1f');
    }),
  );
}

function streets(a: Art, lamps: { x: number; y: number }[]) {
  const { base, snow } = a;
  rect(base, 0, 0, MAP_W, MAP_H, '#34323a');
  // asfalto con grano fino y parches
  patch(base, 'grano', 0, 0, MAP_W, MAP_H);
  for (let i = 0; i < 160; i++) fine(base, a.rand() * MAP_W, a.rand() * MAP_H, 2 + a.rand() * 5, 1 + a.rand() * 2, '#302e36');
  for (let i = 0; i < AVES; i++) {
    const cx = aveX(i);
    // avenidas de sentido único: dos carriles separados por línea discontinua
    for (let yy = 0; yy < MAP_H; yy += 8) fine(base, cx - 0.25, yy, 0.5, 4, '#cfcabe');
    fine(base, cx - AVE_W / 2 + 1.5, 0, 0.5, MAP_H, '#d8b23a');
    fine(base, cx + AVE_W / 2 - 2, 0, 0.5, MAP_H, '#cfcabe');
    for (let j = 0; j < ROWS; j++) {
      const ay = blockY(j) + BLOCK_H / 2;
      arrow(base, cx - 4, ay, 0, aveDir(i));
      arrow(base, cx + 4, ay, 0, aveDir(i));
    }
  }
  for (let j = 0; j <= ROWS; j++) {
    const cy = stY(j);
    if (stDir(j)) for (let xx = 0; xx < MAP_W; xx += 8) fine(base, xx, cy - 0.25, 4, 0.5, '#cfcabe');
    else {
      fine(base, 0, cy - 0.75, MAP_W, 0.5, '#d8b23a');
      fine(base, 0, cy + 0.25, MAP_W, 0.5, '#d8b23a');
    }
    for (let c = 0; c < COLS; c++) {
      const ax = blockX(c) + BLOCK_W / 2;
      const d = stDir(j);
      if (d) {
        arrow(base, ax - 10, cy - 3.5, d, 0);
        arrow(base, ax + 10, cy + 3.5, d, 0);
      } else {
        arrow(base, ax - 10, cy - 3.5, -1, 0);
        arrow(base, ax + 10, cy + 3.5, 1, 0);
      }
    }
  }
  for (let c = 0; c < COLS; c++)
    for (let r = 0; r < ROWS; r++) {
      const x = blockX(c), y = blockY(r);
      const d = districtOf(c, r);
      rect(base, x, y, BLOCK_W, BLOCK_H, '#8d8a86');
      patch(base, 'baldosa', x, y, BLOCK_W, BLOCK_H);
      // bordillo: luz al norte y oeste, sombra en la cuneta
      fine(base, x, y + BLOCK_H - 0.5, BLOCK_W, 0.5, '#5a5752');
      fine(base, x + BLOCK_W - 0.5, y, 0.5, BLOCK_H, '#5a5752');
      fine(base, x, y, BLOCK_W, 0.5, '#b9b6b0');
      fine(base, x, y, 0.5, BLOCK_H, '#b9b6b0');
      rect(snow, x, y, BLOCK_W, BLOCK_H, 'rgba(235,242,252,0.7)');
      // farolas en la acera sur, con charco de luz cálida
      for (const lx of [x + 6, x + BLOCK_W - 6]) {
        const ly = y + BLOCK_H - 1.2;
        lamps.push({ x: lx, y: ly });
        lamp(a, lx, ly);
      }
      // semáforo en la esquina suroeste
      signalPole(a, x + 1, y + BLOCK_H - 1);
      sidewalkProps(a, x, y, d);
    }
  // Cruces: asfalto limpio, pasos de cebra y alcantarillas
  for (let i = 0; i < AVES; i++)
    for (let j = 0; j <= ROWS; j++) {
      const cx = aveX(i), cy = stY(j);
      rect(base, cx - AVE_W / 2, cy - ST_H / 2, AVE_W, ST_H, '#38363e');
      patch(base, 'grano', cx - AVE_W / 2, cy - ST_H / 2, AVE_W, ST_H);
      for (let k = -AVE_W / 2 + 1; k < AVE_W / 2 - 1; k += 2) {
        fine(base, cx + k, cy - ST_H / 2 - 3, 1, 3, '#e8e4d8');
        fine(base, cx + k, cy + ST_H / 2, 1, 3, '#e8e4d8');
      }
      for (let k = -ST_H / 2 + 1; k < ST_H / 2 - 1; k += 2) {
        fine(base, cx - AVE_W / 2 - 3, cy + k, 3, 1, '#e8e4d8');
        fine(base, cx + AVE_W / 2, cy + k, 3, 1, '#e8e4d8');
      }
      if (a.rand() < 0.45) {
        const mx = Math.round(cx - 3 + a.rand() * 6);
        const my = Math.round(cy - 2 + a.rand() * 4);
        ellipse(base, mx + 1.5, my + 1, 1.5, 1.5, '#252427');
        fine(base, mx + 0.5, my + 0.5, 2, 0.5, '#4a484e');
        fine(base, mx + 0.5, my + 1.5, 2, 0.5, '#4a484e');
      }
    }
  for (let i = 0; i < AVES; i++) {
    rect(snow, aveX(i) - AVE_W / 2, 0, 2, MAP_H, 'rgba(235,242,252,0.8)');
    rect(snow, aveX(i) + AVE_W / 2 - 2, 0, 2, MAP_H, 'rgba(235,242,252,0.8)');
  }
  // bordes del mapa: muro de piedra del malecón
  rect(base, -3, -3, MAP_W + 6, 3, '#6a6660');
  rect(base, -3, MAP_H, MAP_W + 6, 3, '#6a6660');
  rect(base, -3, 0, 3, MAP_H, '#6a6660');
  rect(base, MAP_W, 0, 3, MAP_H, '#6a6660');
  river(a);
}

/** Cabinas, buzones, quioscos, bocas de incendio y basura en la acera sur (pequeños volúmenes). */
function sidewalkProps(a: Art, x: number, y: number, d: District) {
  const sy = y + BLOCK_H - 3.6;
  const spots = [x + 14, x + 30, x + 46, x + 62];
  const poor = DISTRICTS[d].poor;
  const vol = (px: number, w: number, dd: number, h: number, col: BoxCol, o: Parameters<typeof box>[7] = {}) =>
    later(a, px, sy, px + w, sy + dd, h + 2, () => {
      groundShadow(a, px, sy, w, dd, h, 0.18);
      box(a, px, sy, w, dd, h, col, o);
    });
  for (const px of spots) {
    const roll = a.rand();
    if (roll < 0.12) {
      // cabina telefónica
      vol(px, 2.6, 2.6, 9, { top: '#2f6fb3', south: '#9a9ea6', east: '#7a7e86' }, {
        south: () => {
          fill(a.base, px + 0.5, 1.5, 1.6, 5, '#6fa7c7');
          fill(a.lights, px + 0.5, 1.5, 1.6, 5, 'rgba(220,240,255,0.8)');
          fill(a.base, px, 0, 2.6, 1, '#2f6fb3');
        },
        east: () => fill(a.base, 0.5, 1.5, 1.6, 5, '#5f97b7'),
      });
    } else if (roll < 0.22) {
      // buzón azul
      vol(px, 2, 1.6, 4, { top: '#4f7fc8', south: '#2f5fa8', east: '#234a88' }, { south: () => fill(a.base, px + 0.4, 1, 1.2, 0.4, '#14101f') });
    } else if (roll < 0.3 && (d === 'midtown' || d === 'chinatown')) {
      // quiosco de prensa
      vol(px - 2, 6, 2.6, 6, { top: '#2a5a3a', south: '#3a7a4a', east: '#2a5a3a' }, {
        south: () => {
          fill(a.base, px - 1.4, 1.5, 4.8, 2.4, '#f4efe2');
          fill(a.base, px - 1, 2, 1, 0.8, '#e8414f');
          fill(a.base, px + 1, 2, 1.6, 0.8, '#2f6fb3');
          fill(a.lights, px - 1.4, 1.5, 4.8, 2.4, 'rgba(255,230,170,0.6)');
        },
      });
    } else if (roll < 0.4) {
      vol(px, 1.2, 1.2, 2.4, { top: '#e8414f', south: '#c0392b', east: '#8e2a20' }); // boca de incendios
    } else if (poor && roll < 0.72) {
      // bolsas de basura y un cubo
      vol(px, 2.4, 2, 2, { top: '#2a2a30', south: '#1f1f24', east: '#151518' });
      vol(px + 3, 2, 2, 3.4, { top: '#8a8e94', south: '#6a6e74', east: '#4a4e54' });
    }
  }
}

/** East River: agua, olas, muelles de madera y el puente de Brooklyn. */
function river(a: Art) {
  const { base, snow } = a;
  const x = RIVER_X;
  rect(base, x, 0, RIVER_W, MAP_H, '#1d3a58');
  for (let i = 0; i < 700; i++) rect(base, x + a.rand() * RIVER_W, a.rand() * MAP_H, 1, 3 + a.rand() * 4, a.rand() < 0.5 ? '#2a4e72' : '#17304a');
  // orillas de piedra
  rect(base, x, 0, 2, MAP_H, '#6a6660');
  rect(base, x + RIVER_W - 2, 0, 2, MAP_H, '#6a6660');
  rect(snow, x, 0, RIVER_W, MAP_H, 'rgba(200,220,240,0.25)');
  // muelles en la orilla de Brooklyn (los Muelles)
  for (let r = 0; r < ROWS; r++) {
    if (r === BRIDGE_STREET || r === BRIDGE_STREET - 1 || a.rand() < 0.35) continue;
    const py = blockY(r) + 10 + Math.floor(a.rand() * 20);
    const pw = 16 + Math.floor(a.rand() * 10);
    rect(base, x + RIVER_W - 2 - pw, py, pw, 6, '#7a5232');
    for (let k = x + RIVER_W - 2 - pw; k < x + RIVER_W - 2; k += 3) rect(base, k, py, 1, 6, '#5e3e24');
    rect(base, x + RIVER_W - 2 - pw, py + 6, pw, 1, 'rgba(0,0,0,0.4)');
    rect(snow, x + RIVER_W - 2 - pw, py, pw, 6, 'rgba(245,250,255,0.85)');
  }
  // puente: tablero con calzada, pasarela, dos torres de piedra con arcos y cables
  const by = stY(BRIDGE_STREET);
  const top = by - ST_H / 2 - 3;
  const D = ST_H + 6;
  rect(base, x - 2, top, RIVER_W + 4, D, '#4a4044');
  rect(base, x - 2, top, RIVER_W + 4, 2, '#7a6a5a');
  rect(base, x - 2, top + D - 2, RIVER_W + 4, 2, '#7a6a5a');
  rect(base, x - 2, by - 1, RIVER_W + 4, 1, '#d8b23a');
  for (let xx = x; xx < x + RIVER_W; xx += 8) rect(base, xx, by + 3, 4, 1, '#bdb8ac');
  rect(base, x - 2, top + D, RIVER_W + 4, 3, 'rgba(0,0,0,0.35)');
  rect(snow, x - 2, top, RIVER_W + 4, D, 'rgba(240,246,255,0.8)');
  const TH = 64;
  const towers = [x + 14, x + RIVER_W - 22];
  const cables = (Y: number) => {
    onSouth(a, Y, TH, () => {
      const t1 = towers[0] + 4;
      const t2 = towers[1] + 4;
      for (let xx = x - 10; xx <= x + RIVER_W + 10; xx += 0.5) {
        let cy: number;
        if (xx < t1) cy = ((t1 - xx) / (t1 - x + 10)) * (TH - 4);
        else if (xx > t2) cy = ((xx - t2) / (x + RIVER_W + 10 - t2)) * (TH - 4);
        else cy = Math.sin(((xx - t1) / (t2 - t1)) * Math.PI) * (TH - 14);
        fine(a.base, xx, cy + 2, 0.5, 0.5, '#d8d4c6');
        if (Math.round(xx * 2) % 6 === 0 && cy + 3 < TH) fine(a.base, xx, cy + 3, 0.3, TH - cy - 3, 'rgba(216,212,198,0.45)');
        if (Math.round(xx * 2) % 12 === 0) fill(a.lights, xx, cy + 2, 0.8, 0.8, '#fff2c0');
      }
    });
  };
  later(a, x - 10, top, x + RIVER_W + 10, top + 0.4, TH, () => cables(top));
  // Torres: dos pilares (la calzada pasa entre ellos) y un dintel con arcos.
  const stone = { top: '#8a7560', south: '#b8a488', east: '#8a7560' };
  const PD = 4;
  const pier = (tx: number, py: number) =>
    box(a, tx, py, 8, PD, TH - 20, stone, {
      south: () => patch(a.base, 'ladrillo', tx, 0, 8, TH - 20),
      east: () => patch(a.base, 'ladrillo', 0, 0, PD, TH - 20),
    });
  for (const tx of towers) {
    later(a, tx, top, tx + 8, top + PD, TH + 4, () => {
      groundShadow(a, tx, top, 8, D, TH * 0.4, 0.2);
      pier(tx, top);
      box(a, tx, top, 8, D, 20, stone, {
        z: TH - 20,
        south: () => {
          patch(a.base, 'ladrillo', tx, 0, 8, 20);
          fill(a.base, tx - 0.5, 0, 9, 2, '#9a8570');
        },
        east: () => {
          patch(a.base, 'ladrillo', 0, 0, D, 20);
          fill(a.base, 0, 0, D, 2, '#7a6550');
          // arco ojival sobre la calzada
          poly(a.base, [PD, 20.2, D - PD, 20.2, D / 2, 12], '#3a3040');
          for (const u of [6, D - 9]) {
            fill(a.base, u, 5, 3, 6, '#3a3040');
            poly(a.base, [u, 5.2, u + 3, 5.2, u + 1.5, 3], '#3a3040');
          }
        },
        top: () => fill(a.lights, tx + 3, top + D / 2 - 1, 2, 2, '#ff3b3b'),
      });
    });
    // el pilar sur va delante de los coches que cruzan
    later(a, tx, top + D - PD, tx + 8, top + D, TH - 18, () => pier(tx, top + D - PD), true);
  }
  later(a, x - 10, top + D - 0.4, x + RIVER_W + 10, top + D, TH, () => cables(top + D), true);
}

// --------------------------------------------------------------------------
// Brooklyn: lugares
// --------------------------------------------------------------------------

function sugarFactory(a: Art, p: Place) {
  const { x, y, w, h } = placeRect(p);
  rect(a.base, x + SIDEWALK, y + SIDEWALK, w - 6, h - 6, '#5f5c58');
  building(a, x + 4, y + 6, w - 8, 26, 34, { facadeColor: '#8e3b2e', roof: '#4a4850', fireEscape: true, win: 3 });
  // chimeneas sobre la azotea de la fábrica (no atraviesan el edificio)
  chimney(a, x + 14, y + 12, 30, 34);
  chimney(a, x + w - 16, y + 12, 24, 34);
  later(a, x + w / 2 - 6, y + 31.5, x + w / 2 + 6, y + 32, 34, () =>
    onSouth(a, y + 32.05, 34, () => {
      fill(a.base, x + w / 2 - 14, 3, 28, 9, '#1d1d24');
      glow(a.neon, x + w / 2, 7.5, 22, '255,204,51', 0.4);
      drawText(a.neon, 'SUGAR', Math.round(x + w / 2 - textWidth('SUGAR') / 2), 5, '#ffcc33');
    }),
  );
  yardExtras(a, 'industrial', x + 4, y + 34, w - 8, h - 38);
}

function fleaMarket(a: Art, p: Place) {
  const { x, y, w, h } = placeRect(p);
  rect(a.base, x + SIDEWALK, y + SIDEWALK, w - 6, h - 6, '#b0a48e');
  for (let i = 0; i < 200; i++) rect(a.base, x + 3 + a.rand() * (w - 6), y + 3 + a.rand() * (h - 6), 1, 1, '#a0947e');
  rect(a.snow, x, y, w, h, 'rgba(240,246,255,0.8)');
  const tents = ['#c0392b', '#2f6fb3', '#ffcc33', '#3a7a4a', '#e8a0b0', '#7b4fa0'];
  for (let ry = 0; ry < 3; ry++)
    for (let cx = 0; cx < 4; cx++) {
      const tx = x + 6 + cx * 18;
      const ty = y + 8 + ry * 14;
      const col = tents[(ry * 4 + cx) % tents.length];
      later(a, tx, ty, tx + 13, ty + 9, 9, () => {
        // mostrador con género y toldo a rayas
        box(a, tx, ty + 4, 13, 4, 3, { top: '#8a5a33', south: '#6a4628' }, {
          top: () => {
            for (let k = 0; k < 4; k++) fill(a.base, tx + 1 + k * 3, ty + 5, 2, 2, ['#9fd3ff', '#ffd24a', '#e8414f', '#f4efe2'][(k + cx) % 4]);
          },
        });
        for (const px of [tx, tx + 12.4]) sprite(a, px, ty + 8, () => fine(a.base, px, ty + 1, 0.6, 7, '#4a3020'));
        plane(a, [tx, ty + 1, 8], [1, 0, 0], [0, 1, -0.4], () => {
          for (let u = 0; u < 13; u += 2) fill(a.base, tx + u, ty + 1, 1, 7, col);
          for (let u = 1; u < 13; u += 2) fill(a.base, tx + u, ty + 1, 1, 7, '#f4efe2');
          fill(a.snow, tx, ty + 1, 13, 7, 'rgba(245,250,255,0.9)');
        });
      });
    }
  boardSign(a, 'FLEA MARKET', x + w / 2, y + h - 4, '#f4efe2', '#c0392b');
}

function racetrack(a: Art, p: Place) {
  const { x, y, w, h } = placeRect(p);
  rect(a.base, x + 2, y + 2, w - 4, h - 4, '#3f7a3a');
  patch(a.base, 'cesped', x + 2, y + 2, w - 4, h - 4);
  const cx = x + w / 2, cy = y + h / 2 + 4;
  a.base.lineWidth = 5;
  a.base.strokeStyle = '#a8784a';
  a.base.beginPath();
  a.base.ellipse(cx, cy, w / 2 - 12, h / 2 - 11, 0, 0, Math.PI * 2);
  a.base.stroke();
  a.base.lineWidth = 0.5;
  a.base.strokeStyle = '#f4efe2';
  a.base.setLineDash([1, 2]);
  a.base.beginPath();
  a.base.ellipse(cx, cy, w / 2 - 8.5, h / 2 - 7.5, 0, 0, Math.PI * 2);
  a.base.stroke();
  a.base.setLineDash([]);
  rect(a.snow, x, y, w, h, 'rgba(240,246,255,0.8)');
  // tribuna con gradas a rayas
  const tx = x + 22, ty = y + 3, tw = w - 44;
  later(a, tx, ty, tx + tw, ty + 10, 18, () => {
    groundShadow(a, tx, ty, tw, 10, 14);
    box(a, tx, ty, tw, 10, 12, { top: '#e8e4d8', south: '#e8e4d8', east: '#c8c4b8' }, {
      south: () => {
        for (let i = 0; i < 4; i++) fill(a.base, tx + 1, 2 + i * 2.5, tw - 2, 1.4, i % 2 ? '#c0392b' : '#2f6fb3');
        fill(a.lights, tx + 1, 2, tw - 2, 9, 'rgba(255,230,170,0.35)');
      },
    });
    box(a, tx - 2, ty - 1, tw + 4, 12, 1, { top: '#3a3a46', south: '#2a2a33' }, { z: 15 });
    for (const px of [tx, tx + tw / 2, tx + tw]) sprite(a, px, ty + 10, () => fine(a.base, px - 0.3, ty - 5, 0.6, 15, '#55595f'));
  });
  // caballos en la pista
  for (let i = 0; i < 4; i++) {
    const an = (i * 0.5 + 0.3) * Math.PI;
    const hx = cx + Math.cos(an) * (w / 2 - 12);
    const hy = cy + Math.sin(an) * (h / 2 - 11);
    later(a, hx - 2, hy - 0.5, hx + 2, hy, 5, () =>
      sprite(a, hx, hy, () => {
        const col = ['#4a2e1c', '#8a5a33', '#1c1818', '#f4efe2'][i];
        fill(a.base, hx - 2, hy - 3.5, 4, 2, col);
        fill(a.base, hx + 1.5, hy - 5, 1.2, 2.2, col);
        fine(a.base, hx - 1.6, hy - 1.5, 0.5, 1.5, col);
        fine(a.base, hx + 1.2, hy - 1.5, 0.5, 1.5, col);
        fill(a.base, hx - 0.8, hy - 4.6, 1.4, 1.2, ['#e8414f', '#ffd24a', '#2f6fb3', '#3fbf6a'][i]);
      }),
    );
  }
  later(a, cx - 8, y + h - 3.5, cx + 8, y + h - 3, 20, () => standS(a, y + h - 3, () => neonSign(a, 'RACES', cx, y + h - 22, '#7dff6a', '125,255,106')));
}

function coneyIsland(a: Art, p: Place) {
  const { x, y, w, h } = placeRect(p);
  // paseo de madera, playa y mar
  rect(a.base, x + 2, y + 2, w - 4, h - 4, '#e8d29a');
  for (let i = 0; i < 300; i++) rect(a.base, x + 2 + a.rand() * (w - 4), y + 2 + a.rand() * (h - 4), 1, 1, '#d8c08a');
  rect(a.base, x + 2, y + h - 16, w - 4, 6, '#9a6a3a');
  for (let k = x + 2; k < x + w - 2; k += 3) rect(a.base, k, y + h - 16, 1, 6, '#7a4a2a');
  rect(a.base, x + 2, y + h - 10, w - 4, 8, '#3f86c8');
  for (let k = x + 4; k < x + w - 4; k += 7) rect(a.base, k, y + h - 8, 4, 1, '#cfe6ff');
  rect(a.snow, x, y, w, h - 10, 'rgba(240,246,255,0.8)');
  // noria (de pie, de frente a la cámara)
  const cx = x + 36, cy = y + 26, R = 24;
  later(a, cx - R, cy - 2, cx + R, cy + 2, R * 2 + 10, () =>
    standS(a, cy, () => {
      const top = cy - R - 6;
      fine(a.base, cx - 9, top + R, 1, R + 6, '#c9c4bc');
      fine(a.base, cx + 8, top + R, 1, R + 6, '#c9c4bc');
      for (let t = 0; t < 360; t += 2) {
        const an = (t * Math.PI) / 180;
        fine(a.base, cx + Math.cos(an) * R, top + Math.sin(an) * R, 0.6, 0.6, '#e8e4d8');
      }
      for (let k = 0; k < 10; k++) {
        const an = (k / 10) * Math.PI * 2;
        for (let rr = 2; rr < R; rr += 1.5) fine(a.base, cx + Math.cos(an) * rr, top + Math.sin(an) * rr, 0.5, 0.5, '#a9adb3');
        const gx = cx + Math.cos(an) * R, gy = top + Math.sin(an) * R;
        fill(a.base, gx - 1.5, gy, 3, 3, ['#e8414f', '#ffcc33', '#2f6fb3', '#3fbf6a'][k % 4]);
        fill(a.neon, gx - 0.5, gy - 1, 1, 1, ['#ff4f9a', '#ffcc33', '#4ff0ff', '#7dff6a'][k % 4]);
      }
      glow(a.neon, cx, top, R + 10, '255,120,200', 0.25);
    }),
  );
  // montaña rusa: estructura de madera
  later(a, x + 70, y + 20, x + w - 8, y + 24, 30, () =>
    standS(a, y + 24, () => {
      for (let xx = x + 70; xx < x + w - 8; xx += 0.5) {
        const yy = y + 2 - Math.abs(Math.sin((xx - x) / 9)) * 22;
        fine(a.base, xx, yy, 0.6, 0.6, '#f4efe2');
        if (Math.round(xx * 2) % 6 === 0) fine(a.base, xx, yy + 1, 0.5, y + 24 - yy - 1, '#9a6a3a');
      }
    }),
  );
  later(a, x + w - 58, y + h - 16.5, x + w - 42, y + h - 16, 22, () => standS(a, y + h - 16, () => neonSign(a, 'CONEY ISLAND', x + w - 50, y + h - 36, '#ff4f9a', '255,79,154')));
}

// --------------------------------------------------------------------------
// Grandes proyectos del alcalde
// --------------------------------------------------------------------------

function megaRect(m: (typeof MEGA)[number]) {
  if ('place' in m.site) return placeRect(PLACE_BY_ID.plaza);
  const s = m.site;
  return placeRect({ id: 'plaza', label: '', c: s.c, r: s.r, cw: s.cw, rh: s.rh });
}

function megaSite(a: Art, m: (typeof MEGA)[number], st: 'obras' | 'listo' | undefined) {
  const { x, y, w, h } = megaRect(m);
  if (st !== 'listo') {
    dirt(a, x + 2, y + 2, w - 4, h - 4);
    for (let i = 0; i < 30; i++) rect(a.base, x + 4 + a.rand() * (w - 8), y + 4 + a.rand() * (h - 10), 1, 2, '#6a8a3a');
    fence(a, x + 2, y + h - 2, w - 4, st === 'obras');
    if (st === 'obras') {
      later(a, x + 10, y + h / 2 - 10, x + w - 10, y + h / 2 + 8, 22, () =>
        box(a, x + 10, y + h / 2 - 10, w - 20, 18, 20, { top: '#8f8b84', south: '#8f8b84', east: '#6d6a64' }, { south: () => scaffoldFace(a, x + 9, w - 18, 20) }),
      );
      crane(a, x + 12, y + h / 2 + 12, 60);
      if (w > 100) crane(a, x + w - 20, y + h / 2 + 8, 54);
    } else boardSign(a, 'FUTURE SITE', x + w / 2, y + h - 8, '#f4efe2', '#2f6fb3');
    return;
  }
  if (m.id === 'estadio') {
    rect(a.base, x + 2, y + 2, w - 4, h - 4, '#8d8a86');
    const cx = x + w / 2, cy = y + h / 2;
    // gradas (anillo) y césped
    ellipse(a.base, cx, cy, w / 2 - 4, h / 2 - 4, '#b0aaa0');
    for (let k = 0; k < 6; k++) {
      a.base.lineWidth = 0.6;
      a.base.strokeStyle = k % 2 ? '#c9c4bc' : '#9a948a';
      a.base.beginPath();
      a.base.ellipse(cx, cy, w / 2 - 6 - k * 2, h / 2 - 6 - k * 1.5, 0, 0, Math.PI * 2);
      a.base.stroke();
    }
    ellipse(a.base, cx, cy, w / 2 - 20, h / 2 - 16, '#3f8a3a');
    patch(a.base, 'cesped', cx - w / 2 + 22, cy - h / 2 + 18, w - 44, h - 36);
    poly(a.base, [cx, cy - 6, cx + 8, cy + 2, cx, cy + 10, cx - 8, cy + 2], '#c99a5a');
    rect(a.base, cx - 1, cy + 1, 2, 2, '#f4efe2');
    // muro exterior
    later(a, x + 4, y + 4, x + w - 4, y + h - 4, 30, () => {
      onSouth(a, y + h - 4, 6, () => fill(a.base, x + 8, 0, w - 16, 6, '#7a7468'));
      onEast(a, x + w - 4, y + h - 8, 6, () => fill(a.base, 0, 0, h - 16, 6, '#5a5448'));
      for (const lx of [x + 12, x + w - 14]) {
        sprite(a, lx, y + 8, () => {
          fine(a.base, lx - 0.5, y - 20, 1, 28, '#55595f');
          rect(a.base, lx - 4, y - 25, 8, 5, '#d8d4c6');
          fill(a.lights, lx - 4, y - 25, 8, 5, '#ffffff');
          glow(a.lights, lx, y - 22, 22, '255,255,230', 0.45);
        });
      }
      standS(a, y + h - 4, () => neonSign(a, 'DODGERS', cx, y + h - 18, '#4ff0ff', '79,240,255'));
    });
  } else if (m.id === 'puerto') {
    rect(a.base, x + 2, y + 2, w - 4, h - 4, '#8d8a86');
    building(a, x + 6, y + 12, w - 14, 30, 22, { facadeColor: '#e8e4d8', roof: '#56606a', win: 3 });
    later(a, x + w / 2 - 6, y + 41.5, x + w / 2 + 6, y + 42, 24, () =>
      onSouth(a, y + 42.05, 22, () => {
        fill(a.base, x + w / 2 - 25, 2, 50, 9, '#1d1d24');
        glow(a.neon, x + w / 2, 6.5, 30, '79,240,255', 0.4);
        drawText(a.neon, 'CRUISE PORT', Math.round(x + w / 2 - textWidth('CRUISE PORT') / 2), 4, '#4ff0ff');
      }),
    );
    // crucero atracado en el río
    const sx = RIVER_X + 8, sy = y + 16, sw = RIVER_W - 18, sh = h - 36;
    later(a, sx, sy, sx + sw, sy + sh, 30, () => {
      box(a, sx, sy, sw, sh, 8, { top: '#c8c4b8', south: '#f4efe2', east: '#d8d4c8' }, {
        south: () => fill(a.base, sx, 6, sw, 2, '#c0392b'),
        east: () => {
          fill(a.base, 0, 6, sh, 2, '#a02a20');
          for (let u = 2; u < sh - 2; u += 3) fill(a.base, u, 2.5, 1.5, 1.5, '#26304a');
        },
      });
      box(a, sx + 4, sy + 8, sw - 8, sh - 16, 10, { top: '#e8e4d8', south: '#ffffff', east: '#e0dcd0' }, {
        z: 8,
        east: () => {
          for (let v = 2; v < 9; v += 3.5) for (let u = 2; u < sh - 18; u += 3) {
            fill(a.base, u, v, 2, 1.6, '#26304a');
            if (a.rand() < 0.6) fill(a.lights, u, v, 2, 1.6, '#ffd27a');
          }
        },
      });
      box(a, sx + sw / 2 - 4, sy + sh / 2 - 4, 8, 8, 8, { top: '#1d1d24', south: '#c0392b', east: '#a02a20' }, { z: 18 });
    });
  } else if (m.id === 'aeropuerto') {
    rect(a.base, x + 2, y + 2, w - 4, h - 4, '#5f7a4a');
    patch(a.base, 'cesped', x + 2, y + 2, w - 4, h - 4);
    rect(a.base, x + 8, y + h / 2 - 6, w - 16, 12, '#3c3a40');
    for (let xx = x + 12; xx < x + w - 12; xx += 10) rect(a.base, xx, y + h / 2, 6, 1, '#f4efe2');
    for (let xx = x + 8; xx < x + w - 8; xx += 6) {
      rect(a.lights, xx, y + h / 2 - 6, 1, 1, '#4ff0ff');
      rect(a.lights, xx, y + h / 2 + 5, 1, 1, '#4ff0ff');
    }
    rect(a.snow, x, y, w, h, 'rgba(240,246,255,0.75)');
    building(a, x + 12, y + 10, 70, 22, 18, { facadeColor: '#d8d4c6', roof: '#7a7580', win: 3, glass: true });
    later(a, x + 47 - 8, y + 31.5, x + 47 + 8, y + 32, 20, () =>
      onSouth(a, y + 32.05, 18, () => {
        fill(a.base, x + 47 - 16, 2, 32, 9, '#1d1d24');
        glow(a.neon, x + 47, 6.5, 22, '255,204,51', 0.4);
        drawText(a.neon, 'AIRPORT', Math.round(x + 47 - textWidth('AIRPORT') / 2), 4, '#ffcc33');
      }),
    );
    // torre de control
    const tx = x + w - 32, ty = y + 14;
    later(a, tx, ty, tx + 6, ty + 6, 56, () => {
      groundShadow(a, tx, ty, 6, 6, 40);
      box(a, tx, ty, 6, 6, 40, { top: '#c9c4bc', south: '#d8d4c6', east: '#a8a49a' });
      box(a, tx - 3, ty - 3, 12, 12, 7, { top: '#3a3a46', south: '#6fa7c7', east: '#4f87a7' }, {
        z: 40,
        south: () => fill(a.lights, tx - 3, 1, 12, 5, 'rgba(160,230,255,0.8)'),
        east: () => fill(a.lights, 0, 1, 12, 5, 'rgba(160,230,255,0.8)'),
      });
      sprite(a, tx + 3, ty + 3, () => {
        fine(a.base, tx + 2.8, ty - 5, 0.5, 5, '#333');
        fill(a.lights, tx + 2.5, ty - 6, 1, 1, '#ff3b3b');
      }, 47);
    });
    // avión en la pista
    const px = x + w / 2 - 20, py = y + h / 2 - 2;
    later(a, px, py, px + 30, py + 4, 6, () => {
      box(a, px, py, 30, 4, 4, { top: '#f4efe2', south: '#e8e4d8', east: '#c8c4b8' }, { z: 1, south: () => fine(a.base, px + 2, 1.5, 24, 0.8, '#2f6fb3') });
      onTop(a, 3, () => poly(a.base, [px + 12, py - 12, px + 18, py - 12, px + 20, py + 16, px + 10, py + 16], '#d8d4c6'));
      box(a, px + 26, py + 1, 3, 2, 6, { top: '#c0392b', south: '#c0392b' }, { z: 5 });
    });
  }
}

/** Times Square renovado: pantallas gigantes y plaza peatonal. */
function timesSquareReform(a: Art, p: Place, st: 'obras' | 'listo' | undefined) {
  const { x, y, w, h } = placeRect(p);
  if (st === 'obras') {
    later(a, x + 4, y + h - 3.5, x + w - 4, y + h - 3, 20, () => onSouth(a, y + h - 3, 18, () => scaffoldFace(a, x + 4, w - 8, 18)));
    crane(a, x + w - 12, y + h - 2, 64);
    return;
  }
  if (st !== 'listo') return;
  // plaza peatonal roja (en la acera sur)
  rect(a.base, x + 2, y + h - 3, w - 4, 3, '#a8352c');
  for (let k = x + 4; k < x + w - 4; k += 8) rect(a.base, k, y + h - 3, 2, 3, '#c8452e');
  // pantalla gigante en lo alto del edificio central
  later(a, x + w / 2 - 22, y + 24, x + w / 2 + 22, y + 25, 80, () =>
    standS(a, y + 25, () => {
      const top = y + 25 - 74;
      rect(a.base, x + w / 2 - 22, top, 44, 20, '#101018');
      const cols = ['#ff4f9a', '#4ff0ff', '#ffcc33', '#7dff6a'];
      for (let i = 0; i < 4; i++) rect(a.neon, x + w / 2 - 20 + i * 10, top + 2, 10, 16, cols[i]);
      drawText(a.neon, 'NYC', x + w / 2 - 6, top + 7, '#ffffff');
      glow(a.neon, x + w / 2, top + 10, 44, '255,150,220', 0.35);
    }, 0),
  );
}

/** Charcos para los días de lluvia, con reflejos de neón cerca de los letreros. */
function puddles(ctx: Ctx, rand: () => number) {
  for (let j = 0; j <= ROWS; j++) {
    for (let k = 0; k < 22; k++) {
      const px = rand() * MAP_W;
      if (px > RIVER_X - 4 && px < BROOKLYN_X + 4 && j !== BRIDGE_STREET) continue;
      const py = stY(j) - ST_H / 2 + 2 + rand() * (ST_H - 4);
      const pw = 5 + rand() * 10;
      ctx.fillStyle = 'rgba(20,30,50,0.55)';
      ctx.fillRect(Math.round(px), Math.round(py), Math.round(pw), 2);
      ctx.fillRect(Math.round(px + 1), Math.round(py - 1), Math.round(pw - 2), 1);
      const neon = px > aveX(2) && px < aveX(3) + 40 && j >= 3 && j <= 5;
      ctx.fillStyle = neon ? ['rgba(255,79,154,0.75)', 'rgba(79,240,255,0.75)', 'rgba(255,204,51,0.75)'][Math.floor(rand() * 3)] : 'rgba(200,220,255,0.55)';
      ctx.fillRect(Math.round(px + pw * 0.3), Math.round(py), Math.max(1, Math.round(pw * 0.3)), 1);
    }
  }
  for (let i = 0; i < AVES; i++)
    for (let k = 0; k < 14; k++) {
      const px = aveX(i) - AVE_W / 2 + 2 + rand() * (AVE_W - 6);
      const py = rand() * MAP_H;
      const ph = 4 + rand() * 6;
      ctx.fillStyle = 'rgba(20,30,50,0.55)';
      ctx.fillRect(Math.round(px), Math.round(py), 2, Math.round(ph));
      ctx.fillStyle = 'rgba(200,220,255,0.5)';
      ctx.fillRect(Math.round(px), Math.round(py + ph * 0.3), 1, Math.max(1, Math.round(ph * 0.3)));
    }
}

// --------------------------------------------------------------------------
// Generación
// --------------------------------------------------------------------------

export interface MapLayer {
  key: string;
  /** Posición del lienzo en la pantalla del mundo. */
  x: number;
  y: number;
  w: number;
  h: number;
  depth: number;
  base: HTMLCanvasElement;
  lights: HTMLCanvasElement | null;
  neon: HTMLCanvasElement | null;
  snow: HTMLCanvasElement | null;
  wet?: HTMLCanvasElement;
  /** Píxeles del lienzo base por unidad del mapa. */
  scale: number;
  /** Franjas a dibujar (en unidades, relativas al lienzo); sin ellas, el lienzo entero. */
  bands?: { x: number; y: number; w: number; h: number }[];
}

export interface CityMapArt {
  ground: MapLayer & { wet: HTMLCanvasElement };
  /** Edificios por manzana (cada uno con su profundidad). */
  cells: MapLayer[];
  /** Farolas (en el plano). */
  lamps: { x: number; y: number }[];
  /** Semáforos (en el plano): la escena les pone la luz. */
  signals: { x: number; y: number }[];
  /** Altura máxima de lo dibujado en cada manzana ("c,r"). */
  heights: Record<string, number>;
}

/**
 * Los neones van en la capa de luces (un dibujo menos por manzana): el
 * resplandor se ve de noche y las letras y tubos, también de día, pintados
 * en la base.
 */
function mergeNeon(base: HTMLCanvasElement, lights: HTMLCanvasElement, neon: HTMLCanvasElement) {
  const nctx = neon.getContext('2d')!;
  const img = nctx.getImageData(0, 0, neon.width, neon.height);
  const d = img.data;
  const solid = new ImageData(neon.width, neon.height);
  const sd = solid.data;
  let any = false;
  for (let i = 3; i < d.length; i += 4)
    if (d[i] > 150) {
      sd[i - 3] = d[i - 3] * 0.85;
      sd[i - 2] = d[i - 2] * 0.85;
      sd[i - 1] = d[i - 1] * 0.85;
      sd[i] = 255;
      any = true;
    }
  if (any) {
    const tmp = document.createElement('canvas');
    tmp.width = neon.width;
    tmp.height = neon.height;
    tmp.getContext('2d')!.putImageData(solid, 0, 0);
    const b = base.getContext('2d')!;
    b.save();
    b.setTransform(1, 0, 0, 1, 0, 0);
    b.imageSmoothingEnabled = false;
    b.drawImage(tmp, 0, 0, base.width, base.height);
    b.restore();
  }
  const l = lights.getContext('2d')!;
  l.save();
  l.setTransform(1, 0, 0, 1, 0, 0);
  l.drawImage(neon, 0, 0);
  l.restore();
}

/**
 * Franjas horizontales de una manzana, recortadas a la silueta de lo que
 * hay dibujado (en coordenadas del lienzo): la tarjeta gráfica no pinta las
 * esquinas vacías. La silueta de cada volumen es un hexágono.
 */
function bandsFor(items: Item[], ox: number, oy: number, W: number, H: number, band = 24, m = 6) {
  const geo = items.map((it) => {
    const A = iso(it.x0, it.y1);
    const B = iso(it.x1, it.y0);
    const N = iso(it.x0, it.y0);
    const S = iso(it.x1, it.y1);
    return { A, B, N, S, h: it.h, top: N.y - it.h };
  });
  // borde izquierdo y derecho de la silueta a la altura y
  const left = (g: (typeof geo)[number], y: number) => (y < g.A.y - g.h ? g.N.x - (y - g.top) * 2 : y <= g.A.y ? g.A.x : g.A.x + (y - g.A.y) * 2);
  const right = (g: (typeof geo)[number], y: number) => (y < g.B.y - g.h ? g.N.x + (y - g.top) * 2 : y <= g.B.y ? g.B.x : g.B.x - (y - g.B.y) * 2);
  const out: { x: number; y: number; w: number; h: number }[] = [];
  for (let y0 = 0; y0 < H; y0 += band) {
    const y1 = Math.min(H, y0 + band);
    const sy0 = oy + y0 - m;
    const sy1 = oy + y1 + m;
    let lo = Infinity;
    let hi = -Infinity;
    for (const g of geo) {
      if (g.top > sy1 || g.S.y < sy0) continue;
      const ys = [Math.max(sy0, g.top), Math.min(sy1, g.S.y), g.A.y - g.h, g.A.y, g.B.y - g.h, g.B.y].filter((y) => y >= Math.max(sy0, g.top) && y <= Math.min(sy1, g.S.y));
      for (const y of ys) {
        lo = Math.min(lo, left(g, y) - m);
        hi = Math.max(hi, right(g, y) + m);
      }
    }
    if (lo > hi) continue;
    const x0 = Math.max(0, Math.floor(lo - ox));
    const x1 = Math.min(W, Math.ceil(hi - ox));
    if (x1 > x0) out.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
  }
  return out;
}

/** Huella en pantalla de un elemento. */
function screenBox(it: Item) {
  return { x0: iso(it.x0, it.y1).x, x1: iso(it.x1, it.y0).x, y0: iso(it.x0, it.y0, it.h).y, y1: iso(it.x1, it.y1).y };
}

/** Orden de pintado dentro de una manzana: de atrás hacia delante. */
function paintOrder(items: Item[]): Item[] {
  const n = items.length;
  const boxes = items.map(screenBox);
  const next: number[][] = items.map(() => []);
  const indeg = new Array<number>(n).fill(0);
  const eps = 0.01;
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++) {
      const bi = boxes[i];
      const bj = boxes[j];
      if (bi.x1 <= bj.x0 || bj.x1 <= bi.x0 || bi.y1 <= bj.y0 || bj.y1 <= bi.y0) continue;
      const A = items[i];
      const B = items[j];
      // B delante de A si está al sur o al este (sin solaparse); si no, por orden de dibujo
      let iFirst = true;
      if (A.y1 <= B.y0 + eps) iFirst = true;
      else if (B.y1 <= A.y0 + eps) iFirst = false;
      else if (A.x1 <= B.x0 + eps) iFirst = true;
      else if (B.x1 <= A.x0 + eps) iFirst = false;
      if (iFirst) {
        next[i].push(j);
        indeg[j]++;
      } else {
        next[j].push(i);
        indeg[i]++;
      }
    }
  const out: Item[] = [];
  const done = new Array<boolean>(n).fill(false);
  for (let k = 0; k < n; k++) {
    let pick = -1;
    for (let i = 0; i < n; i++)
      if (!done[i] && indeg[i] === 0) {
        pick = i;
        break;
      }
    if (pick < 0) pick = done.indexOf(false); // ciclo: se rompe por orden de dibujo
    done[pick] = true;
    out.push(items[pick]);
    for (const j of next[pick]) indeg[j]--;
  }
  return out;
}

export function generateCityMap(seed = 1985, look?: CityLook | null): CityMapArt {
  const rand = mulberry32(seed);
  const gx = PAD - 12;
  const gy = OY - 12;
  const gw = MAP_W + MAP_H + 24;
  const gh = (MAP_W + MAP_H) / 2 + 24;
  const g = { base: layer(gx, gy, gw, gh, GROUND_SCALE, true), lights: layer(gx, gy, gw, gh, 1, true), neon: layer(gx, gy, gw, gh, 1, true), snow: layer(gx, gy, gw, gh, 1, true) };
  const a = new Art(rand, seed);
  a.base = g.base.ctx;
  a.ground = g.base.ctx;
  a._lights = g.lights.ctx;
  a._neon = g.neon.ctx;
  a._snow = g.snow.ctx;
  const lamps: { x: number; y: number }[] = [];
  streets(a, lamps);

  const special = new Set<string>();
  for (const p of PLACES_MAP)
    for (let c = p.c; c < p.c + (p.cw ?? 1); c++) for (let r = p.r; r < p.r + (p.rh ?? 1); r++) special.add(`${c},${r}`);
  for (const m of MEGA) {
    if ('place' in m.site) continue;
    for (let c = m.site.c; c < m.site.c + m.site.cw; c++) for (let r = m.site.r; r < m.site.r + m.site.rh; r++) special.add(`${c},${r}`);
  }
  const renovating = new Set(look?.renovating ?? []);
  for (let c = 0; c < COLS; c++)
    for (let r = 0; r < ROWS; r++) {
      const key = `${c},${r}`;
      if (special.has(key)) continue;
      const lot = LOTS.find((l) => l.c === c && l.r === r);
      genericBlock(a, c, r, { half: lot?.side, renov: look?.renovated[key] ?? 0, works: renovating.has(key) });
      if (lot) drawLot(a, lot, look?.lots[lot.id]);
    }

  for (const p of PLACES_MAP) {
    const prev = a.rand;
    a.rand = mulberry32((seed ^ hashPlace(p.id)) >>> 0);
    if (p.id === 'parque') park(a, p);
    else if (p.id === 'alcaldia') cityHall(a, p);
    else if (p.id === 'residencia') residence(a, p);
    else if (p.id === 'diner') diner(a, p);
    else if (p.id === 'casa') tenement(a, p);
    else if (p.id === 'bolsa') exchange(a, p);
    else if (p.id === 'plaza') {
      timesSquare(a, p);
      timesSquareReform(a, p, look?.mega?.timessquare);
    } else if (p.id === 'hotel') signBlock(a, p, 'HOTEL', '#ff5ac8', '255,90,200', true);
    else if (p.id === 'pizza') signBlock(a, p, 'PIZZA', '#ffb13b', '255,177,59');
    else if (p.id === 'bar') signBlock(a, p, 'BAR', '#7dff6a', '125,255,106');
    else if (p.id === 'fabrica') sugarFactory(a, p);
    else if (p.id === 'mercado') fleaMarket(a, p);
    else if (p.id === 'hipodromo') racetrack(a, p);
    else if (p.id === 'coney') coneyIsland(a, p);
    a.rand = prev;
  }
  for (const m of MEGA) {
    if ('place' in m.site) continue;
    const prev = a.rand;
    a.rand = mulberry32((seed ^ hashPlace(m.id)) >>> 0);
    megaSite(a, m, look?.mega?.[m.id]);
    a.rand = prev;
  }
  // charco de luz de cada farola sobre la acera y la calzada
  for (const lp of lamps) glow(g.lights.ctx, lp.x, lp.y - 1, 15, '255,196,110', 0.42);
  const wet = layer(gx, gy, gw, gh, 1, true);
  puddles(wet.ctx, mulberry32(seed ^ 0x77));
  if (a.used.neon) mergeNeon(g.base.c, g.lights.c, g.neon.c);

  // Volúmenes: un lienzo por celda de profundidad, de atrás hacia delante.
  const byCell = new Map<string, { c: number; r: number; items: Item[]; front: boolean }>();
  for (const it of a.queue) {
    const c = cellCol((it.x0 + it.x1) / 2);
    const r = cellRow((it.y0 + it.y1) / 2);
    const k = `${c},${r}${it.front ? 'f' : ''}`;
    let cell = byCell.get(k);
    if (!cell) byCell.set(k, (cell = { c, r, items: [], front: !!it.front }));
    cell.items.push(it);
  }
  const cells: MapLayer[] = [];
  for (const [k, cell] of byCell) {
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const it of cell.items) {
      const b = screenBox(it);
      x0 = Math.min(x0, b.x0);
      x1 = Math.max(x1, b.x1);
      y0 = Math.min(y0, b.y0);
      y1 = Math.max(y1, b.y1);
    }
    // margen para halos, letreros y aleros
    x0 = Math.floor(x0 - 14);
    x1 = Math.ceil(x1 + 14);
    y0 = Math.floor(y0 - 14);
    y1 = Math.ceil(y1 + 6);
    const w = x1 - x0;
    const h = y1 - y0;
    const L = { base: layer(x0, y0, w, h, ART_SCALE), lights: layer(x0, y0, w, h, 1), neon: layer(x0, y0, w, h, 1), snow: layer(x0, y0, w, h, 1) };
    a.base = L.base.ctx;
    a._lights = L.lights.ctx;
    a._neon = L.neon.ctx;
    a._snow = L.snow.ctx;
    a.used = { lights: false, neon: false, snow: false };
    for (const it of paintOrder(cell.items)) it.draw();
    if (a.used.neon) {
      mergeNeon(L.base.c, L.lights.c, L.neon.c);
      a.used.lights = true;
    }
    cells.push({
      key: `cell${k}`,
      x: x0,
      y: y0,
      w,
      h,
      depth: cellDepth(cell.c, cell.r) + (cell.front ? 9.6 : 0),
      scale: ART_SCALE,
      base: L.base.c,
      lights: a.used.lights ? L.lights.c : null,
      neon: null,
      snow: a.used.snow ? L.snow.c : null,
      bands: bandsFor(cell.items, x0, y0, w, h),
    });
  }
  return {
    ground: { key: 'ground', x: gx, y: gy, w: gw, h: gh, depth: -1000, scale: GROUND_SCALE, base: g.base.c, lights: g.lights.c, neon: null, snow: g.snow.c, wet: wet.c },
    cells,
    lamps,
    signals: a.signals,
    heights: a.heights,
  };
}

function hashPlace(id: string) {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return h >>> 0;
}

// --------------------------------------------------------------------------
// Sprites isométricos (coches y barcos) para la escena
// --------------------------------------------------------------------------

/**
 * Dibuja un coche isométrico en un lienzo propio. Devuelve el lienzo y el
 * punto de anclaje (el centro de la huella en el suelo) en píxeles.
 */
export function isoCarTexture(color: string, axis: 'x' | 'y', police = false, scale = 4) {
  const L = 9, W = 5;
  const w = axis === 'x' ? L : W;
  const d = axis === 'x' ? W : L;
  const c = iso(w / 2, d / 2);
  const rx = iso(0, d).x - 2;
  const ry = iso(0, 0, 6).y - 2;
  const cw = w + d + 4;
  const ch = (w + d) / 2 + 9;
  const L1 = layer(rx, ry, cw, ch, scale);
  const scratch = layer(rx, ry, cw, ch, scale);
  const a = new Art(() => 0.5, 1);
  a.base = L1.ctx;
  a.ground = L1.ctx;
  a._lights = scratch.ctx;
  a._neon = scratch.ctx;
  a._snow = scratch.ctx;
  // la sombra va en el mismo lienzo, en el plano del suelo
  L1.ctx.save();
  L1.ctx.transform(1, 0.5, -1, 0.5, OX, OY);
  ellipse(L1.ctx, w / 2 + 0.8, d / 2 - 0.4, w * 0.62, d * 0.62, 'rgba(10,8,20,0.3)');
  L1.ctx.restore();
  const saved = a.ground;
  a.ground = scratch.ctx;
  carBoxes(a, 0, 0, axis, color, police);
  a.ground = saved;
  return { canvas: L1.c, ox: (c.x - rx) * scale, oy: (c.y - ry) * scale };
}

/** Remolcador isométrico (navega a lo largo del río, eje y). */
export function isoBoatTexture(scale = 4) {
  const w = 6, d = 14;
  const c = iso(w / 2, d / 2);
  const rx = iso(0, d).x - 2;
  const ry = iso(0, 0, 10).y - 2;
  const L1 = layer(rx, ry, w + d + 4, (w + d) / 2 + 13, scale);
  const scratch = layer(rx, ry, w + d + 4, (w + d) / 2 + 13, scale);
  const a = new Art(() => 0.5, 1);
  a.base = L1.ctx;
  a.ground = scratch.ctx;
  a._lights = scratch.ctx;
  a._neon = scratch.ctx;
  a._snow = scratch.ctx;
  box(a, 0, 0, w, d, 2.5, { top: '#7a5232', south: '#c0392b', east: '#8e2a20' }, { snow: false, east: () => fill(a.base, 0, 1.6, d, 0.9, '#14101f') });
  box(a, 1, 4, 4, 5, 3, { top: '#f4efe2', south: '#e8e4d8', east: '#c8c4b8' }, { z: 2.5, snow: false, east: () => fill(a.base, 1, 0.8, 3, 1.2, '#26304a') });
  box(a, 2, 5, 2, 2, 3, { top: '#14101f', south: '#2a2a33' }, { z: 5.5, snow: false });
  return { canvas: L1.c, ox: (c.x - rx) * scale, oy: (c.y - ry) * scale };
}

/**
 * Avión visto desde arriba, proyectado en isométrico (el morro hacia +x o
 * +y). Para volar en sentido contrario basta con girar la imagen 180°.
 */
export function isoPlaneTexture(axis: 'x' | 'y', scale = 3) {
  const L = 30;
  const S = 26;
  const w = axis === 'x' ? L : S;
  const d = axis === 'x' ? S : L;
  const c = iso(w / 2, d / 2);
  const rx = iso(0, d).x - 2;
  const ry = iso(0, 0).y - 2;
  const L1 = layer(rx, ry, w + d + 4, (w + d) / 2 + 4, scale);
  const scratch = layer(rx, ry, w + d + 4, (w + d) / 2 + 4, scale);
  const a = new Art(() => 0.5, 1);
  a.base = L1.ctx;
  a.ground = scratch.ctx;
  a._lights = scratch.ctx;
  a._neon = scratch.ctx;
  a._snow = scratch.ctx;
  // dibujo en "coordenadas de avión": u a lo largo del fuselaje, v a lo ancho
  const P = (u: number, v: number) => (axis === 'x' ? [u, v + S / 2] : [S / 2 - v, u]);
  const shape = (pts: [number, number][], col: string) => poly(a.base, pts.flatMap(([u, v]) => P(u, v)), col);
  onTop(a, 0, () => {
    // alas, estabilizadores, fuselaje y cabina
    shape([[11, -1.2], [16, -1.2], [12, -12.5], [9.5, -12.5]], '#c9ced8');
    shape([[11, 1.2], [16, 1.2], [12, 12.5], [9.5, 12.5]], '#aeb4c0');
    shape([[1, -0.8], [4.5, -0.8], [2.5, -5], [0.6, -5]], '#c9ced8');
    shape([[1, 0.8], [4.5, 0.8], [2.5, 5], [0.6, 5]], '#aeb4c0');
    shape([[0, -1.3], [26, -1.3], [29.5, 0], [26, 1.3], [0, 1.3]], '#f1f3f7');
    shape([[0, 0.3], [26, 0.3], [29.5, 0], [26, 1.3], [0, 1.3]], '#d8dce4');
    shape([[24.5, -0.8], [27, -0.6], [27, 0.6], [24.5, 0.8]], '#26304a');
    // franja azul de la compañía y motores
    shape([[3, -0.4], [24, -0.4], [24, 0.4], [3, 0.4]], '#2f6fb3');
    for (const v of [-6, 6]) shape([[12.5, v - 0.7], [15.5, v - 0.7], [15.5, v + 0.7], [12.5, v + 0.7]], '#55595f');
  });
  return { canvas: L1.c, ox: (c.x - rx) * scale, oy: (c.y - ry) * scale };
}
