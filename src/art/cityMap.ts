import { mulberry32 } from '../core/rng';
import type { Role } from '../core/types';
import { LOTS, MEGA, type CityLook, type LotDef } from '../core/lots';
import { BRIDGE_STREET, COLS, DISTRICTS, districtOf, MANHATTAN_COLS, ROWS, type District } from '../core/city';

export { COLS, ROWS, BRIDGE_STREET, MANHATTAN_COLS };
import { shade } from './character';
import { drawText, textWidth } from './pixelfont';

/**
 * La ciudad vista desde arriba con una ligera inclinación (perspectiva 3/4):
 * se ven las azoteas y la fachada frontal de cada edificio, dibujados de
 * atrás hacia delante para dar volumen. Manhattan años 80: avenidas,
 * calles, depósitos de agua, escaleras de incendio, toldos y neones.
 *
 * Manhattan a la izquierda, el East River en medio (con el puente de
 * Brooklyn) y Brooklyn a la derecha, con sus barrios: muelles, fábricas,
 * casas de ladrillo y Coney Island.
 *
 * Capas (para el ciclo día/noche y el clima):
 * - base: suelo, calles y azoteas (se tiñe con la luz ambiente)
 * - lights: farolas, claraboyas y ventanas encendidas (de noche)
 * - neon: letreros de neón de las azoteas
 * - snow: nieve sobre azoteas y aceras (días de nieve)
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
/** Altura de la acera por la que se cruza el puente a pie. */
export const BRIDGE_WALK_Y = blockY(BRIDGE_STREET - 1) + BLOCK_H - 1.5;
/**
 * Líneas de acera por las que caminan los personajes: la acera oeste y la
 * acera sur de cada manzana, que quedan a la vista con la cámara inclinada.
 */
export const walkX = (c: number) => blockX(c) + 1.5;
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

/** Centro visual del lugar (donde va la etiqueta) y su puerta (esquina de la acera). */
export function placeCenter(p: Place) {
  const r = placeRect(p);
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
}
/** Esquina suroeste de la acera del lugar: donde empiezan las rutas. */
export function placeDoor(p: Place) {
  return { x: walkX(p.c), y: walkY(p.r + (p.rh ?? 1) - 1) };
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

export interface LayerSet {
  base: HTMLCanvasElement;
  lights: HTMLCanvasElement;
  neon: HTMLCanvasElement;
  snow: HTMLCanvasElement;
}

/** Edificios de una fila de manzanas: se dibujan con su propia profundidad. */
export interface RowLayer extends LayerSet {
  /** Posición horizontal del trozo en el mapa. */
  x: number;
  /** Posición vertical del lienzo en el mapa. */
  y: number;
  /** Profundidad: lo que esté más al sur que esto se dibuja delante. */
  depth: number;
}

export interface CityMapArt {
  /** Primer trozo del suelo (compatibilidad). */
  ground: LayerSet & { wet: HTMLCanvasElement; x: number };
  /** Suelo por trozos, con los charcos de lluvia aparte. */
  grounds: (LayerSet & { wet: HTMLCanvasElement; x: number })[];
  rows: RowLayer[];
  lamps: { x: number; y: number }[];
  /** Parte más alta dibujada en cada manzana ("c,r"), para tocar y etiquetar. */
  tops: Record<string, number>;
}

const ROW_ABOVE = 46;
const ROW_BELOW = 14;
export const rowOf = (y: number) => Math.max(0, Math.min(ROWS - 1, Math.floor((y - ST_H) / (BLOCK_H + ST_H))));
export const colOf = (x: number) => {
  if (x < RIVER_X + RIVER_W / 2) return Math.max(0, Math.min(MC - 1, Math.floor((x - AVE_W) / (BLOCK_W + AVE_W))));
  return MC + Math.max(0, Math.min(COLS - MC - 1, Math.floor((x - BROOKLYN_X - AVE_W) / (BLOCK_W + AVE_W))));
};
/** Profundidad de una fila: justo detrás de la acera sur, donde caminan los personajes. */
export const rowDepth = (r: number) => blockY(r) + BLOCK_H - 2.5;

/** Zona tocable de un lugar, incluida la altura de sus edificios. */
export function placeBounds(p: Place, tops: Record<string, number>) {
  const r = placeRect(p);
  let top = r.y;
  for (let c = p.c; c < p.c + (p.cw ?? 1); c++) for (let rr = p.r; rr < p.r + (p.rh ?? 1); rr++) top = Math.min(top, tops[`${c},${rr}`] ?? r.y);
  return { x: r.x, y: top, w: r.w, h: r.y + r.h - top };
}

type Ctx = CanvasRenderingContext2D;

function canvas(h = MAP_H, offsetY = 0) {
  const c = document.createElement('canvas');
  c.width = MAP_W;
  c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.translate(0, -offsetY);
  return { c, ctx };
}

function rect(ctx: Ctx, x: number, y: number, w: number, h: number, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

function disc(ctx: Ctx, cx: number, cy: number, r: number, color: string) {
  ctx.fillStyle = color;
  for (let y = -r; y <= r; y++) {
    const w = Math.floor(Math.sqrt(r * r - y * y + r * 0.6));
    ctx.fillRect(Math.round(cx - w), Math.round(cy + y), w * 2 + 1, 1);
  }
}

function glow(ctx: Ctx, x: number, y: number, r: number, rgb: string, a = 0.5) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(${rgb},${a})`);
  g.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

const ROOFS = ['#4a4850', '#5b5960', '#3f3e46', '#6b6470', '#7a6a5a', '#56606a'];
/** Fachadas: ladrillo, piedra, brownstone, estuco… */
const FACADES = ['#8e3b2e', '#7a3a2c', '#9a4a34', '#6b4a3a', '#b9a68a', '#a89478', '#5a4a48', '#7d6a5c', '#4f5d6e', '#8a7560'];
const AWNINGS = ['#c0392b', '#2e8b57', '#2f6fb3', '#e2a23b', '#7b4fa0'];
const WARM = ['#ffd27a', '#ffc85e', '#ffe2a0', '#f9b85a'];

interface Art {
  base: Ctx;
  lights: Ctx;
  neon: Ctx;
  snow: Ctx;
  rand: () => number;
  seed: number;
  /** Elementos con volumen: se dibujan de atrás (norte) hacia delante (sur). */
  queue: { key: number; draw: () => void }[];
  tops: Record<string, number>;
}

function markTop(a: Art, x: number, footY: number, top: number) {
  const k = `${colOf(x)},${rowOf(footY - 1)}`;
  a.tops[k] = Math.min(a.tops[k] ?? Infinity, top);
}

const later = (a: Art, key: number, draw: () => void) => a.queue.push({ key, draw });

function waterTower(a: Art, x: number, y: number) {
  // patas, cuba de madera y tejado cónico, vistos en 3/4
  rect(a.base, x - 3, y + 2, 1, 4, '#2a1c10');
  rect(a.base, x + 3, y + 2, 1, 4, '#2a1c10');
  rect(a.base, x - 4, y - 5, 9, 8, '#7a5232');
  for (let i = x - 4; i < x + 5; i += 2) rect(a.base, i, y - 5, 1, 8, '#6a4628');
  rect(a.base, x - 4, y - 3, 9, 1, '#2a1c10');
  rect(a.base, x - 4, y, 9, 1, '#2a1c10');
  rect(a.base, x - 5, y - 7, 11, 2, '#4a3524');
  rect(a.base, x - 3, y - 9, 7, 2, '#4a3524');
  rect(a.base, x - 1, y - 10, 3, 1, '#4a3524');
  rect(a.snow, x - 4, y - 10, 9, 4, 'rgba(245,250,255,0.95)');
}

/** Azotea: grava, parapeto y detalles (aires, escotilla, claraboya, ropa tendida, depósito). */
function roof(a: Art, x: number, y: number, w: number, h: number, color: string, opts: { tower?: boolean; laundry?: boolean } = {}) {
  const { base, lights, snow, rand } = a;
  rect(base, x, y, w, h, color);
  for (let i = 0; i < (w * h) / 9; i++) rect(base, x + 1 + rand() * (w - 2), y + 1 + rand() * (h - 2), 1, 1, shade(color, rand() < 0.5 ? -0.1 : 0.08));
  rect(base, x, y, w, 1, shade(color, 0.3));
  rect(base, x, y, 1, h, shade(color, 0.2));
  rect(base, x + w - 1, y, 1, h, shade(color, -0.3));
  rect(snow, x + 1, y + 1, w - 2, h - 1, 'rgba(240,246,255,0.92)');
  const spot = (sw: number, sh: number) => ({ x: x + 2 + rand() * Math.max(1, w - sw - 4), y: y + 2 + rand() * Math.max(1, h - sh - 4) });
  const acs = Math.floor(rand() * 3);
  for (let i = 0; i < acs && w > 10 && h > 8; i++) {
    const s = spot(4, 3);
    rect(base, s.x, s.y + 1, 4, 3, '#55595f');
    rect(base, s.x, s.y, 4, 2, '#a9adb3');
    rect(base, s.x + 1, s.y, 2, 1, '#6d7177');
  }
  if (w > 12 && h > 8 && rand() < 0.6) {
    const s = spot(4, 4);
    rect(base, s.x, s.y, 4, 4, '#5a5560');
    rect(base, s.x, s.y, 4, 2, '#7a7580');
  }
  if (w > 14 && h > 8 && rand() < 0.45) {
    const s = spot(6, 3);
    rect(base, s.x, s.y, 6, 3, '#6fa7c7');
    rect(base, s.x, s.y, 6, 1, '#a9d4ea');
    rect(lights, s.x, s.y, 6, 3, 'rgba(255,214,140,0.8)');
  }
  if (opts.laundry && w > 16 && h > 6) {
    const ly = y + 2 + Math.floor(rand() * (h - 4));
    rect(base, x + 3, ly, w - 6, 1, '#d8d4c6');
    for (let i = x + 4; i < x + w - 4; i += 3) rect(base, i, ly + 1, 2, 2, ['#e8414f', '#3b7bdc', '#ffd24a', '#f4efe2', '#3fbf6a'][Math.floor(rand() * 5)]);
  }
  if ((opts.tower ?? rand() < 0.4) && w > 12 && h > 8) {
    const s = spot(10, 6);
    waterTower(a, s.x + 5, s.y + 4);
  }
}

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
}

/** Fachada frontal: cornisa, ventanas (algunas encendidas), escalera de incendios y planta baja. */
function facade(a: Art, x: number, y: number, w: number, h: number, color: string, opts: FacadeOpts = {}) {
  const { base, lights, snow, rand } = a;
  rect(base, x, y, w, h, color);
  // textura de ladrillo
  for (let yy = y + 2; yy < y + h; yy += 2) for (let xx = x + ((yy - y) % 4 ? 0 : 2); xx < x + w; xx += 4) if (rand() < 0.4) rect(base, xx, yy, 1, 1, shade(color, -0.12));
  rect(base, x, y, w, 1, shade(color, 0.3));
  rect(base, x, y + 1, w, 1, shade(color, -0.25));
  rect(snow, x, y, w, 1, 'rgba(245,250,255,0.95)');
  rect(base, x, y, 1, h, shade(color, 0.12));
  rect(base, x + w - 1, y, 1, h, shade(color, -0.35));
  const shopH = opts.shop ? 4 : 0;
  const ww = opts.win ?? 2;
  // ventanas
  for (let yy = y + 3; yy <= y + h - shopH - 3; yy += 3) {
    for (let xx = x + 2; xx <= x + w - ww - 1; xx += ww + 2) {
      rect(base, xx, yy, ww, 2, '#26304a');
      rect(base, xx, yy + 2, ww, 1, shade(color, 0.2));
      if (rand() < 0.42) rect(lights, xx, yy, ww, 2, rand() < 0.12 ? '#9fd3ff' : WARM[Math.floor(rand() * WARM.length)]);
    }
  }
  // escalera de incendios en zigzag
  if (opts.fireEscape && w > 12 && h > 9) {
    const fx = x + Math.floor(w / 2) - 4;
    for (let yy = y + 3; yy < y + h - shopH - 2; yy += 3) {
      rect(base, fx, yy + 2, 8, 1, '#14101f');
      rect(base, (Math.floor((yy - y) / 3) % 2 ? fx : fx + 7), yy, 1, 3, '#14101f');
    }
  }
  // planta baja
  if (opts.shop) {
    const sy = y + h - shopH;
    const aw = AWNINGS[Math.floor(rand() * AWNINGS.length)];
    for (let xx = x + 1; xx < x + w - 1; xx += 2) rect(base, xx, sy, 1, 1, aw);
    for (let xx = x + 2; xx < x + w - 1; xx += 2) rect(base, xx, sy, 1, 1, '#f1ede3');
    rect(base, x + 1, sy + 1, w - 2, 3, '#2c3446');
    rect(lights, x + 1, sy + 1, w - 2, 3, '#ffdb94');
    if (opts.trim) rect(a.neon, x + 1, sy - 1, w - 2, 1, opts.trim);
    if (opts.sign && h >= 10) {
      const tw = textWidth(opts.sign);
      const tx = x + Math.floor((w - tw) / 2);
      rect(base, tx - 1, sy - 7, tw + 2, 6, '#1d1d24');
      drawText(base, opts.sign, tx, sy - 6, '#f4efe2');
      drawText(lights, opts.sign, tx, sy - 6, rand() < 0.5 ? '#ffd27a' : '#9fe8ff');
    }
    const door = x + Math.floor(rand() * (w - 4)) + 1;
    rect(base, door, sy + 1, 3, 3, '#3a2a20');
    rect(snow, x, sy, w, 1, 'rgba(245,250,255,0.9)');
  }
  if (opts.stoop) {
    const sx = x + Math.floor(w / 2) - 2;
    for (let k = 0; k < 3; k++) rect(base, sx - k, y + h - 3 + k, 5 + k * 2, 1, '#9a8a78');
  }
  rect(base, x, y + h, w, 1, 'rgba(10,8,20,0.5)');
}

/** Edificio completo: huella (x, y, w, d) en el suelo y altura H. */
function building(a: Art, x: number, y: number, w: number, d: number, H: number, opts: FacadeOpts & { roof?: string; facadeColor?: string; tower?: boolean; laundry?: boolean; scaffold?: boolean; corrugated?: boolean; sawtooth?: boolean } = {}) {
  const roofColor = opts.roof ?? ROOFS[Math.floor(a.rand() * ROOFS.length)];
  const fc = opts.facadeColor ?? FACADES[Math.floor(a.rand() * FACADES.length)];
  // Cada edificio con su propio azar: cambiar un solar no altera el resto del mapa.
  const own = mulberry32(Math.floor(a.rand() * 0x7fffffff));
  markTop(a, x, y + d, y - H - (opts.tower ? 12 : 4));
  later(a, y + d, () => {
    const prev = a.rand;
    a.rand = own;
    // sombra hacia el este sobre el suelo
    a.base.fillStyle = 'rgba(10, 8, 20, 0.35)';
    a.base.fillRect(x + w, y + d - Math.min(H, d), Math.min(4, Math.ceil(H / 3)), Math.min(H, d));
    roof(a, x, y - H, w, d, roofColor, { tower: opts.tower, laundry: opts.laundry });
    if (opts.corrugated) for (let xx = x + 1; xx < x + w - 1; xx += 2) rect(a.base, xx, y - H + 1, 1, d - 2, shade(roofColor, -0.12));
    if (opts.sawtooth)
      for (let yy = y - H + 2; yy < y - H + d - 2; yy += 5) {
        rect(a.base, x + 1, yy, w - 2, 2, shade(roofColor, 0.25));
        rect(a.base, x + 1, yy + 2, w - 2, 1, '#6fa7c7');
        rect(a.lights, x + 1, yy + 2, w - 2, 1, 'rgba(255,214,140,0.8)');
      }
    facade(a, x, y + d - H, w, H, fc, opts);
    if (opts.scaffold) scaffold(a, x, y + d - H - 2, w, H + 2);
    a.rand = prev;
  });
}

/** Andamio con red verde delante de una fachada en obras. */
function scaffold(a: Art, x: number, y: number, w: number, h: number) {
  rect(a.base, x, y, w, h, 'rgba(40,110,60,0.35)');
  for (let xx = x; xx <= x + w - 1; xx += 5) rect(a.base, xx, y, 1, h, '#c8a040');
  for (let yy = y + 2; yy < y + h; yy += 3) rect(a.base, x, yy, w, 1, '#a8862e');
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
  /** Letreros de tienda en inglés. */
  signs?: string[];
}

const STYLES: Record<District, DistrictStyle> = {
  midtown: { facades: FACADES, h: [8, 17], w: [12, 30], laundry: 0.15, fire: 0.35, tower: 0.4, signs: ['DELI', 'SHOES', 'BOOKS', 'DRUGS', 'BANK', 'CAFE', 'RADIO', 'HATS'] },
  lowereast: { facades: ['#8e3b2e', '#7a3a2c', '#9a4a34', '#6b4a3a', '#5a4a48'], h: [6, 11], w: [12, 22], laundry: 0.6, fire: 0.65, tower: 0.5, signs: ['PAWN', 'DELI', 'BAR', 'LAUNDRY'] },
  chinatown: { facades: ['#a8352c', '#2f6b4a', '#c8a040', '#7a3a2c', '#8a2a2a', '#3a5a4a'], h: [6, 12], w: [12, 20], laundry: 0.3, fire: 0.4, signs: ['TEA', 'NOODLE', 'DIM SUM', 'HERBS', 'JADE'] },
  muelles: { facades: ['#5a6470', '#6a5040', '#4a5a6a', '#7a4a32', '#5c5c5c'], roofs: ['#5d6268', '#6d5a48', '#4a525a'], h: [5, 8], w: [28, 40], laundry: 0, fire: 0.1, tower: 0 },
  industrial: { facades: ['#7a3a2c', '#6a4a3a', '#5a4a48', '#8a5a40'], roofs: ['#4a4850', '#56606a'], h: [7, 11], w: [24, 36], laundry: 0, fire: 0.2, tower: 0.3 },
  heights: { facades: ['#6b4a3a', '#7a5040', '#5a3a2c', '#8a5a44', '#6a4030'], h: [9, 11], w: [12, 14], laundry: 0.05, fire: 0.1, tower: 0.15 },
  coney: { facades: ['#e8a0b0', '#a0d0e0', '#f0d080', '#b0e0a0', '#e0b0e0', '#f4efe2'], h: [4, 7], w: [14, 24], laundry: 0.1, fire: 0, tower: 0, signs: ['HOT DOGS', 'ICE', 'GAMES', 'CANDY', 'BEACH'] },
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
      const H = between(a, st.h);
      const fe = a.rand() < st.fire;
      const win = a.rand() < 0.3 ? 3 : 2;
      const laundry = a.rand() < st.laundry;
      const pick = a.rand();
      const sign = front && st.signs && a.rand() < 0.45 ? st.signs[Math.floor(a.rand() * st.signs.length)] : undefined;
      building(a, x, ry, finalW, rd, H, {
        shop: front,
        fireEscape: fe,
        win,
        laundry: laundry && !renov,
        tower: (st.tower ?? 0.4) > a.rand(),
        roof: st.roofs ? st.roofs[Math.floor(pick * st.roofs.length)] : undefined,
        facadeColor: renov ? RESTORED[Math.floor(pick * RESTORED.length)] : st.facades[Math.floor(pick * st.facades.length)],
        trim: renov >= 2 && front ? TRIMS[Math.floor(pick * TRIMS.length)] : undefined,
        scaffold: o.works && front,
        sign: sign && textWidth(sign) + 4 <= finalW ? sign : undefined,
        stoop: district === 'heights' && front,
        corrugated: district === 'muelles',
        sawtooth: district === 'industrial' && !front,
      });
      x += finalW;
    }
  }
  if (yard) yardExtras(a, district, x0, y0 + backD, w0, h0 - backD);
  if (district === 'industrial') chimney(a, x0 + 8 + Math.floor(a.rand() * (w0 - 16)), y0 + 4, 16 + Math.floor(a.rand() * 8));
  if (district === 'chinatown') lanterns(a, x0, y0 + h0, w0);
  // Árboles en la acera: renovación nivel 2 y las calles de Brooklyn Heights.
  if (renov >= 2 || district === 'heights') for (let tx = x0 + 6; tx < x0 + w0 - 3; tx += 14) tree(a, tx, blockY(r) + BLOCK_H - 1, 2);
  a.rand = prevRand;
}

/** Patio de almacén o fábrica: contenedores, palés y un camión. */
function yardExtras(a: Art, d: District, x: number, y: number, w: number, h: number) {
  rect(a.base, x, y, w, h, d === 'muelles' ? '#6d6a66' : '#5f5c58');
  for (let i = 0; i < (w * h) / 10; i++) rect(a.base, x + a.rand() * w, y + a.rand() * h, 1, 1, '#57544f');
  rect(a.snow, x, y, w, h, 'rgba(240,246,255,0.8)');
  const colors = ['#c0392b', '#2f6fb3', '#3a7a4a', '#e2a23b', '#7a5232'];
  for (let i = 0; i < 4; i++) {
    const cx = x + 3 + Math.floor(a.rand() * Math.max(1, w - 18));
    const cy = y + 3 + Math.floor(a.rand() * Math.max(1, h - 10));
    const col = colors[Math.floor(a.rand() * colors.length)];
    later(a, cy + 6, () => {
      rect(a.base, cx, cy - 3, 14, 3, shade(col, 0.2));
      rect(a.base, cx, cy, 14, 6, col);
      for (let k = cx + 1; k < cx + 14; k += 2) rect(a.base, k, cy, 1, 6, shade(col, -0.2));
      rect(a.snow, cx, cy - 3, 14, 3, 'rgba(245,250,255,0.9)');
    });
  }
  // farola de patio
  glow(a.lights, x + w / 2, y + h / 2, 14, '255,214,140', 0.35);
}

function chimney(a: Art, x: number, y: number, H: number) {
  later(a, y + 4, () => {
    rect(a.base, x - 2, y - H, 5, H + 4, '#8e3b2e');
    rect(a.base, x - 2, y - H, 1, H + 4, '#a8584a');
    for (let yy = y - H + 2; yy < y; yy += 3) rect(a.base, x - 2, yy, 5, 1, '#6a2a20');
    rect(a.base, x - 3, y - H - 1, 7, 2, '#3a2a20');
    rect(a.lights, x, y - H + 1, 1, 1, '#ff3b3b');
    rect(a.snow, x - 3, y - H - 2, 7, 1, 'rgba(245,250,255,0.9)');
  });
  markTop(a, x, y + 4, y - H - 6);
}

/** Guirnalda de farolillos rojos (Chinatown). */
function lanterns(a: Art, x: number, y: number, w: number) {
  later(a, y + 0.4, () => {
    for (let xx = x + 2; xx < x + w - 2; xx += 5) {
      const sag = Math.round(Math.sin(((xx - x) / w) * Math.PI) * 2);
      rect(a.base, xx, y - 12 + sag, 5, 1, '#3a2a20');
      rect(a.base, xx + 2, y - 11 + sag, 2, 2, '#e8414f');
      rect(a.neon, xx + 2, y - 11 + sag, 2, 2, '#ff5a4a');
    }
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

/** Letrero vertical (de hotel) colgado de una fachada. */
function neonVertical(a: Art, text: string, x: number, y: number, color: string, rgb: string) {
  rect(a.base, x, y, 6, text.length * 6 + 2, '#1d1d24');
  glow(a.neon, x + 3, y + text.length * 3, text.length * 5, rgb, 0.35);
  for (let i = 0; i < text.length; i++) drawText(a.neon, text[i], x + 1, y + 2 + i * 6, color);
}

function tree(a: Art, x: number, y: number, r: number) {
  later(a, y, () => {
    a.base.fillStyle = 'rgba(10,30,10,0.35)';
    a.base.fillRect(x - r + 2, y - 1, r * 2, 3);
    rect(a.base, x, y - 3, 1, 3, '#4a3020');
    disc(a.base, x, y - 3 - r, r, '#2f6b2b');
    disc(a.base, x - 1, y - 4 - r, r - 1, '#3d7f36');
    rect(a.base, x - 1, y - 3 - r * 2 + 1, 2, 1, '#6aaa52');
    disc(a.snow, x, y - 4 - r, r - 1, 'rgba(245,250,255,0.92)');
  });
}

// --------------------------------------------------------------------------
// Lugares especiales
// --------------------------------------------------------------------------

function park(a: Art, p: Place) {
  const { x, y, w, h } = placeRect(p);
  rect(a.base, x, y, w, h, '#3f7a3a');
  for (let i = 0; i < (w * h) / 6; i++) rect(a.base, x + a.rand() * w, y + a.rand() * h, 1, 1, a.rand() < 0.5 ? '#4a8a42' : '#356a31');
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
  for (let yy = -9; yy <= 9; yy++) {
    const ww = Math.floor(Math.sqrt(1 - (yy / 9) ** 2) * 22);
    rect(a.base, cx + 20 - ww, cy - 22 + yy, ww * 2, 1, yy < -6 ? '#3f86c8' : '#2f6fb3');
    rect(a.snow, cx + 20 - ww, cy - 22 + yy, ww * 2, 1, 'rgba(200,225,255,0.9)');
  }
  // glorieta en el centro
  later(a, cy + 4, () => {
    rect(a.base, cx - 5, cy - 2, 10, 6, '#e8dcc0');
    rect(a.base, cx - 6, cy - 6, 12, 4, '#7a3a2a');
    rect(a.base, cx - 4, cy - 8, 8, 2, '#8a4a3a');
    rect(a.snow, cx - 6, cy - 8, 12, 3, 'rgba(245,250,255,0.95)');
    glow(a.lights, cx, cy, 12, '255,214,130', 0.5);
  });
  for (let i = 0; i < 64; i++) {
    const tx = x + 6 + a.rand() * (w - 12);
    const ty = y + 10 + a.rand() * (h - 14);
    if (Math.abs(ty - cy) < 5 || Math.abs(tx - cx) < 5) continue;
    if (Math.hypot(tx - (cx + 20), (ty - (cy - 22)) * 2.4) < 28) continue;
    tree(a, Math.round(tx), Math.round(ty), 2 + Math.floor(a.rand() * 3));
  }
  for (const [lx, ly] of [[cx - w * 0.36, cy], [cx + w * 0.36, cy], [cx, cy - h * 0.34], [cx, cy + h * 0.34]]) glow(a.lights, lx, ly, 8, '255,214,130', 0.45);
}

function cityHall(a: Art, p: Place) {
  const { x, y, w, h } = placeRect(p);
  rect(a.base, x, y, w, h, '#b9b3a6');
  for (let yy = y; yy < y + h; yy += 4) for (let xx = x + ((yy / 4) % 2 ? 2 : 0); xx < x + w; xx += 4) rect(a.base, xx, yy, 2, 2, '#c6c0b3');
  rect(a.snow, x, y, w, h, 'rgba(240,246,255,0.8)');
  const bx = x + 8, by = y + 14, bw = w - 16, bd = 18, H = 16;
  later(a, by + bd, () => {
    rect(a.base, bx + bw, by + bd - H, 4, H, 'rgba(10,8,20,0.35)');
    // tejado
    rect(a.base, bx, by - H, bw, bd, '#d8d0bf');
    rect(a.base, bx, by - H, bw, 1, '#fffaf0');
    rect(a.snow, bx + 1, by - H + 1, bw - 2, bd - 1, 'rgba(245,250,255,0.92)');
    // frontón triangular
    for (let r = 0; r < 6; r++) rect(a.base, bx + 14 + r * 4, by + bd - H - 6 + r, bw - 28 - r * 8, 1, r === 0 ? '#fffaf0' : '#e6dfd0');
    // fachada con columnas
    const fy = by + bd - H;
    rect(a.base, bx, fy, bw, H, '#e6dfd0');
    rect(a.base, bx, fy, bw, 2, '#f6f1e6');
    for (let i = bx + 4; i < bx + bw - 4; i += 6) {
      rect(a.base, i, fy + 3, 3, H - 5, '#f8f4ea');
      rect(a.base, i + 2, fy + 3, 1, H - 5, '#c9c1b0');
    }
    for (let i = bx + 7; i < bx + bw - 6; i += 6) {
      rect(a.base, i + 1, fy + 5, 2, 4, '#2c3446');
      rect(a.lights, i + 1, fy + 5, 2, 4, '#ffd27a');
    }
    rect(a.base, bx + bw / 2 - 3, fy + H - 7, 6, 7, '#4a2e1c');
    rect(a.lights, bx + bw / 2 - 3, fy + H - 7, 6, 2, '#ffe2a0');
    for (let s = 0; s < 3; s++) rect(a.base, bx - 2 + s * 2, fy + H + s, bw + 4 - s * 4, 1, '#cfc8b8');
    drawText(a.base, 'ALCALDIA', Math.round(bx + bw / 2 - textWidth('ALCALDIA') / 2), fy - 5, '#6d6656');
    // cúpula
    const dx = bx + bw / 2, dy = by - H + 4;
    for (let r = 0; r < 9; r++) {
      const ww = Math.round(Math.sqrt(1 - (r / 9) ** 2) * 11);
      rect(a.base, dx - ww, dy - r, ww * 2, 1, r > 5 ? '#e3d29c' : '#c9b47c');
    }
    rect(a.base, dx - 6, dy - 4, 3, 2, '#fff1c4');
    rect(a.base, dx - 1, dy - 12, 2, 3, '#e3d29c');
    rect(a.base, dx, dy - 20, 1, 8, '#333');
    rect(a.base, dx + 1, dy - 20, 6, 4, '#2f6fb3');
    rect(a.base, dx + 1, dy - 18, 6, 1, '#f1ede3');
    rect(a.snow, dx - 9, dy - 9, 18, 3, 'rgba(245,250,255,0.92)');
    glow(a.lights, dx, dy - 4, 18, '255,220,140', 0.35);
  });
  // fuente
  const fx = x + w / 2, fy2 = y + h - 10;
  later(a, fy2 + 4, () => {
    disc(a.base, fx, fy2, 6, '#8a8478');
    disc(a.base, fx, fy2, 4, '#4f8fb8');
    rect(a.base, fx - 1, fy2 - 5, 2, 5, '#bfe6ff');
    glow(a.lights, fx, fy2, 10, '150,210,255', 0.45);
  });
  for (let i = x + 6; i < x + w - 4; i += 14) tree(a, i, y + h - 3, 3);
}

function residence(a: Art, p: Place) {
  const { x, y, w, h } = placeRect(p);
  rect(a.base, x, y, w, h, '#4a7a3e');
  for (let i = 0; i < 300; i++) rect(a.base, x + a.rand() * w, y + a.rand() * h, 1, 1, '#568a48');
  rect(a.snow, x, y, w, h, 'rgba(240,246,255,0.88)');
  for (let t = 0; t <= 1; t += 0.02) rect(a.base, x + w / 2 - 2 + Math.sin(t * Math.PI * 2) * 6, y + 30 + t * (h - 32), 4, 2, '#cfc6ad');
  const mx = x + 18, my = y + 14, mw = 42, md = 14, H = 11;
  later(a, my + md, () => {
    rect(a.base, mx + mw, my + md - H, 3, H, 'rgba(10,8,20,0.35)');
    // tejado a dos aguas
    rect(a.base, mx - 1, my - H, mw + 2, md / 2, '#4f6b4a');
    rect(a.base, mx - 1, my - H + md / 2, mw + 2, md / 2, '#3c4f3a');
    rect(a.base, mx - 1, my - H + md / 2, mw + 2, 1, '#6a8a62');
    rect(a.base, mx + 6, my - H - 2, 3, 4, '#7a3a2a');
    rect(a.base, mx + mw - 9, my - H - 2, 3, 4, '#7a3a2a');
    rect(a.snow, mx, my - H, mw, md - 1, 'rgba(245,250,255,0.92)');
    // fachada blanca con contraventanas verdes
    const fy = my + md - H;
    rect(a.base, mx, fy, mw, H, '#ede4cc');
    rect(a.base, mx, fy, mw, 1, '#fffaf0');
    for (let i = mx + 3; i < mx + mw - 3; i += 6) {
      if (Math.abs(i - (mx + mw / 2)) < 5) continue;
      rect(a.base, i - 1, fy + 2, 1, 3, '#2f5a3a');
      rect(a.base, i, fy + 2, 2, 3, '#26304a');
      rect(a.base, i + 2, fy + 2, 1, 3, '#2f5a3a');
      rect(a.lights, i, fy + 2, 2, 3, '#ffd27a');
    }
    rect(a.base, mx + mw / 2 - 7, fy + 6, 14, 1, '#ffffff');
    for (let i = 0; i < 4; i++) rect(a.base, mx + mw / 2 - 6 + i * 4, fy + 7, 1, H - 7, '#ffffff');
    rect(a.base, mx + mw / 2 - 1, fy + 7, 3, H - 7, '#2f4f6e');
    glow(a.lights, mx + mw / 2, fy + H + 2, 14, '255,214,130', 0.5);
  });
  // reja delantera
  later(a, y + h, () => {
    rect(a.base, x, y + h - 4, w, 1, '#151518');
    for (let i = x; i < x + w; i += 2) if (Math.abs(i - (x + w / 2)) > 5) rect(a.base, i, y + h - 6, 1, 5, '#151518');
  });
  tree(a, x + 8, y + 22, 5);
  tree(a, x + 70, y + 20, 5);
  tree(a, x + 68, y + 46, 4);
  tree(a, x + 10, y + 48, 4);
}

function diner(a: Art, p: Place) {
  const { x, y, w, h } = placeRect(p);
  // edificios de atrás
  let bx = x + SIDEWALK;
  while (bx < x + w - SIDEWALK - 4) {
    const lw = Math.min(x + w - SIDEWALK - bx, 18 + Math.floor(a.rand() * 12));
    building(a, bx, y + SIDEWALK, lw, 18, 8 + Math.floor(a.rand() * 6), { fireEscape: a.rand() < 0.5, laundry: true });
    bx += lw;
  }
  // aparcamiento
  rect(a.base, x + SIDEWALK, y + 22, 22, h - 22 - SIDEWALK, '#45434a');
  for (let i = y + 26; i < y + h - 6; i += 8) rect(a.base, x + 4, i, 18, 1, '#d8d4c6');
  for (const [cy, col] of [[y + 28, '#c0392b'], [y + 44, '#2f6fb3']] as [number, string][]) {
    later(a, cy + 6, () => {
      rect(a.base, x + 7, cy + 1, 11, 6, 'rgba(0,0,0,0.4)');
      rect(a.base, x + 6, cy, 11, 5, col);
      rect(a.base, x + 9, cy, 5, 2, '#2c3446');
      rect(a.snow, x + 7, cy, 9, 2, 'rgba(245,250,255,0.9)');
    });
  }
  // el diner: vagón de acero con franja roja y ventanales
  const dx = x + 28, dy = y + 30, dw = w - 32, dd = 16, H = 9;
  later(a, dy + dd, () => {
    rect(a.base, dx + dw, dy + dd - H, 3, H, 'rgba(10,8,20,0.35)');
    rect(a.base, dx, dy - H, dw, dd, '#aeb2ba');
    for (let i = dx; i < dx + dw; i += 2) rect(a.base, i, dy - H, 1, dd, '#c4c8cf');
    rect(a.snow, dx + 1, dy - H + 1, dw - 2, dd - 2, 'rgba(245,250,255,0.92)');
    const fy = dy + dd - H;
    rect(a.base, dx, fy, dw, H, '#d6d9e0');
    rect(a.base, dx, fy, dw, 1, '#f4f6fa');
    rect(a.base, dx, fy + H - 2, dw, 2, '#c0392b');
    for (let i = dx + 2; i < dx + dw - 4; i += 6) {
      rect(a.base, i, fy + 2, 5, 4, '#4f86a8');
      rect(a.lights, i, fy + 2, 5, 4, '#ffe7a8');
    }
    rect(a.base, dx + 4, fy + 2, 4, H - 2, '#8d1f1f');
    glow(a.lights, dx + dw / 2, fy + H + 3, 24, '255,231,168', 0.4);
    // letrero sobre el tejado, en sus postes
    rect(a.base, dx + dw / 2 - 8, dy - H - 4, 1, 4, '#14101f');
    rect(a.base, dx + dw / 2 + 8, dy - H - 4, 1, 4, '#14101f');
    neonSign(a, 'DINER', dx + dw / 2, dy - H - 13, '#ff4f6d', '255,79,109');
    drawText(a.neon, 'OPEN', dx + dw - 17, fy - 6, '#5cf0ff');
  });
}

function tenement(a: Art, p: Place) {
  const { x, y, w, h } = placeRect(p);
  const x0 = x + SIDEWALK, y0 = y + SIDEWALK, w0 = w - SIDEWALK * 2, h0 = h - SIDEWALK * 2;
  building(a, x0 + 30, y0, w0 - 30, 22, 9, { laundry: true });
  building(a, x0, y0, 30, 22, 11, { fireEscape: true });
  // tu edificio, delante: ladrillo rojo, depósito de agua y escalera de incendios
  building(a, x0, y0 + 22, 36, h0 - 22, 15, { facadeColor: '#8e3b2e', roof: '#5b5960', fireEscape: true, shop: true, tower: true, laundry: true });
  building(a, x0 + 36, y0 + 22, w0 - 36, h0 - 22, 10, { shop: true });
}

function exchange(a: Art, p: Place) {
  const { x, y, w, h } = placeRect(p);
  rect(a.base, x + SIDEWALK, y + SIDEWALK, w - SIDEWALK * 2, h - SIDEWALK * 2, '#a9a397');
  const bx = x + 6, by = y + 16, bw = w - 12, bd = 26, H = 16;
  later(a, by + bd, () => {
    rect(a.base, bx + bw, by + bd - H, 4, H, 'rgba(10,8,20,0.35)');
    rect(a.base, bx, by - H, bw, bd, '#ddd6c6');
    rect(a.base, bx + 10, by - H + 4, bw - 20, bd - 8, '#6fa7c7');
    for (let i = bx + 12; i < bx + bw - 10; i += 4) rect(a.base, i, by - H + 4, 1, bd - 8, '#a9d4ea');
    rect(a.lights, bx + 10, by - H + 4, bw - 20, bd - 8, 'rgba(220,255,235,0.7)');
    rect(a.snow, bx + 1, by - H + 1, bw - 2, 3, 'rgba(245,250,255,0.92)');
    const fy = by + bd - H;
    // frontón y columnas corintias
    for (let r = 0; r < 5; r++) rect(a.base, bx + 4 + r * 5, fy - 5 + r, bw - 8 - r * 10, 1, '#f4efe2');
    rect(a.base, bx, fy, bw, H, '#ece6d8');
    rect(a.base, bx, fy, bw, 2, '#fffaf0');
    for (let i = bx + 3; i < bx + bw - 3; i += 6) {
      rect(a.base, i, fy + 3, 3, H - 4, '#fbf8f0');
      rect(a.base, i + 2, fy + 3, 1, H - 4, '#c9c1b0');
      rect(a.base, i + 3, fy + 4, 3, H - 6, '#26304a');
      rect(a.lights, i + 3, fy + 4, 3, H - 6, 'rgba(200,255,220,0.8)');
    }
    for (let s = 0; s < 3; s++) rect(a.base, bx - 2 + s * 2, fy + H + s, bw + 4 - s * 4, 1, '#cfc8b8');
    // banderas
    for (let i = 0; i < 3; i++) {
      rect(a.base, bx + 12 + i * 20, fy - 10, 1, 6, '#333');
      rect(a.base, bx + 13 + i * 20, fy - 10, 5, 3, ['#2f6fb3', '#f1ede3', '#c0392b'][i]);
    }
    // ticker de neón verde
    rect(a.base, bx + bw / 2 - 15, fy + 1, 30, 7, '#001a0b');
    glow(a.neon, bx + bw / 2, fy + 4, 26, '0,255,127', 0.4);
    drawText(a.neon, 'BOLSA', Math.round(bx + bw / 2 - textWidth('BOLSA') / 2), fy + 2, '#00ff7f');
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
    [x0, y0, 26, 22, 18],
    [x0 + 26, y0, 24, 22, 22],
    [x0 + 50, y0, w - SIDEWALK * 2 - 50, 22, 16],
    [x0, y0 + 22, 24, h - SIDEWALK * 2 - 22, 13],
    [x0 + 24, y0 + 22, 26, h - SIDEWALK * 2 - 22, 15],
    [x0 + 50, y0 + 22, w - SIDEWALK * 2 - 50, h - SIDEWALK * 2 - 22, 12],
  ];
  lots.forEach(([lx, ly, lw, ld, H], i) => {
    building(a, lx, ly, lw, ld, H, { facadeColor: '#3a3448', roof: '#2e2a38', shop: i >= 3 });
    const [t, col, rgb] = boards[i];
    later(a, ly + ld + 0.1, () => neonSign(a, t, lx + lw / 2, ly + ld - H + 2, col, rgb, '#101018'));
  });
  glow(a.neon, x + w / 2, y + h / 2, 56, '255,120,200', 0.14);
}

function signBlock(a: Art, p: Place, text: string, color: string, rgb: string, vertical = false) {
  genericBlock(a, p.c, p.r);
  const { x, y, w, h } = placeRect(p);
  later(a, y + h, () => {
    if (vertical) neonVertical(a, text, x + w - 14, y + h - 40, color, rgb);
    else neonSign(a, text, x + w / 2, y + h - 18, color, rgb);
  });
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
  later(a, y + 0.3, () => {
    if (hoarding) {
      rect(a.base, x, y - 5, w, 5, '#2b2f36');
      for (let xx = x; xx < x + w; xx += 4) rect(a.base, xx, y - 5, 2, 1, '#f2c230');
      rect(a.base, x, y - 1, w, 1, '#14101f');
    } else {
      for (let xx = x; xx < x + w; xx += 2) rect(a.base, xx, y - 4 + ((xx / 2) % 2), 1, 1, '#9aa0a6');
      for (let xx = x; xx < x + w; xx += 2) rect(a.base, xx + 1, y - 3 - ((xx / 2) % 2), 1, 1, '#7d838a');
      rect(a.base, x, y - 5, w, 1, '#9aa0a6');
      for (let xx = x; xx < x + w; xx += 8) rect(a.base, xx, y - 5, 1, 5, '#5d6268');
    }
  });
}

function boardSign(a: Art, text: string, cx: number, y: number, board: string, ink: string) {
  later(a, y + 10, () => {
    const w = textWidth(text) + 4;
    const x = Math.round(cx - w / 2);
    rect(a.base, x + 2, y + 8, 1, 4, '#4a3020');
    rect(a.base, x + w - 3, y + 8, 1, 4, '#4a3020');
    rect(a.base, x, y, w, 8, board);
    rect(a.base, x, y + 7, w, 1, shade(board, -0.3));
    drawText(a.base, text, x + 2, y + 1, ink);
  });
}

function crane(a: Art, x: number, y: number, h: number) {
  later(a, y + 0.2, () => {
    for (let yy = y - h; yy < y; yy += 2) {
      rect(a.base, x, yy, 1, 2, '#f2c230');
      rect(a.base, x + 2, yy, 1, 2, '#f2c230');
      rect(a.base, x + ((yy / 2) % 2 ? 1 : 0), yy, 2, 1, '#c99a1e');
    }
    rect(a.base, x - 10, y - h, 26, 2, '#f2c230');
    for (let xx = x - 10; xx < x + 16; xx += 3) rect(a.base, xx, y - h + 1, 1, 1, '#c99a1e');
    rect(a.base, x - 9, y - h + 2, 4, 3, '#55595f');
    rect(a.base, x + 13, y - h + 2, 1, 9, '#14101f');
    rect(a.base, x + 12, y - h + 11, 3, 2, '#7a5232');
    rect(a.lights, x + 1, y - h - 1, 1, 1, '#ff3b3b');
    rect(a.snow, x - 10, y - h - 1, 26, 1, 'rgba(245,250,255,0.9)');
  });
  markTop(a, x, y, y - h - 2);
}

function emptyLot(a: Art, l: LotDef, sold: boolean) {
  const { x, y, w, h } = lotInner(l);
  dirt(a, x, y, w, h);
  for (let i = 0; i < 18; i++) rect(a.base, x + 2 + a.rand() * (w - 4), y + 2 + a.rand() * (h - 6), 1, 2, a.rand() < 0.6 ? '#5f8a3a' : '#7aa04a');
  for (let i = 0; i < 4; i++) rect(a.base, x + 3 + a.rand() * (w - 8), y + 4 + a.rand() * (h - 12), 3, 2, '#8a8478');
  fence(a, x, y + h, w, false);
  boardSign(a, sold ? 'SOLD' : 'FOR SALE', x + w / 2, y + h - 22, sold ? '#c0392b' : '#f4efe2', sold ? '#ffffff' : '#c0392b');
  a.tops[`${l.c},${l.r}`] = Math.min(a.tops[`${l.c},${l.r}`] ?? Infinity, y + h - 26);
}

/** Casa del inmigrante, según las fases terminadas. */
function houseLot(a: Art, l: LotDef, phase: number, works: boolean) {
  const { x, y, w, h } = lotInner(l);
  if (phase < 4) dirt(a, x, y, w, h);
  else {
    rect(a.base, x, y, w, h, '#4f8a3e');
    for (let i = 0; i < 120; i++) rect(a.base, x + a.rand() * w, y + a.rand() * h, 1, 1, '#5c9a48');
    rect(a.snow, x, y, w, h, 'rgba(240,246,255,0.88)');
  }
  const hx = x + 4, hw = w - 8, hy = y + 8, hd = 18;
  const H = 10;
  if (phase >= 1) {
    // cimientos: losa de hormigón con varillas
    rect(a.base, hx - 1, hy - 1, hw + 2, hd + 2, '#9c9890');
    rect(a.base, hx, hy, hw, hd, '#b9b5ac');
    if (phase === 1) for (let xx = hx + 2; xx < hx + hw - 1; xx += 4) for (let yy = hy + 2; yy < hy + hd - 1; yy += 4) rect(a.base, xx, yy, 1, 1, '#7a4a2a');
  }
  if (phase === 2) {
    later(a, hy + hd, () => {
      const top = hy + hd - H;
      for (let xx = hx; xx <= hx + hw - 1; xx += 5) rect(a.base, xx, top, 1, H, '#c99a5a');
      rect(a.base, hx, top, hw, 1, '#a8783a');
      rect(a.base, hx, top + 5, hw, 1, '#a8783a');
      for (let xx = hx; xx <= hx + hw - 1; xx += 5) rect(a.base, xx, hy - H, 1, hd - 1, '#b0844a');
      rect(a.base, hx, hy - H, hw, 1, '#a8783a');
    });
    markTop(a, hx, hy + hd, hy - H - 2);
  }
  if (phase >= 3) {
    const finished = phase >= 4;
    const wall = finished ? '#e8dcc0' : '#c9a46a';
    later(a, hy + hd, () => {
      rect(a.base, hx + hw, hy + hd - H, 3, H, 'rgba(10,8,20,0.35)');
      // tejado a dos aguas
      rect(a.base, hx - 1, hy - H, hw + 2, hd / 2, '#b8442e');
      rect(a.base, hx - 1, hy - H + hd / 2, hw + 2, hd / 2 - 1, '#9a3424');
      rect(a.base, hx - 1, hy - H + hd / 2, hw + 2, 1, '#d8664a');
      rect(a.snow, hx, hy - H, hw, hd - 2, 'rgba(245,250,255,0.92)');
      const fy = hy + hd - H;
      rect(a.base, hx, fy, hw, H, wall);
      rect(a.base, hx, fy, hw, 1, shade(wall, 0.2));
      if (finished) {
        for (const wx of [hx + 3, hx + hw - 7]) {
          rect(a.base, wx, fy + 2, 4, 3, '#26304a');
          rect(a.base, wx - 1, fy + 2, 1, 3, '#2f6fb3');
          rect(a.base, wx + 4, fy + 2, 1, 3, '#2f6fb3');
          rect(a.lights, wx, fy + 2, 4, 3, '#ffd27a');
        }
        rect(a.base, hx + hw / 2 - 2, fy + 3, 4, H - 3, '#7a3a2a');
        rect(a.base, hx + hw / 2 + 1, fy + 6, 1, 1, '#ffd24a');
        rect(a.base, hx + hw - 6, hy - H - 3, 3, 4, '#7a3a2a');
        glow(a.lights, hx + hw / 2, fy + H + 2, 10, '255,214,130', 0.5);
      } else {
        for (let xx = hx + 1; xx < hx + hw; xx += 3) rect(a.base, xx, fy + 1, 1, H - 1, shade(wall, -0.08));
        rect(a.base, hx + 3, fy + 2, 4, 3, '#3a2a20');
        rect(a.base, hx + hw - 7, fy + 2, 4, 3, '#3a2a20');
        rect(a.base, hx + hw / 2 - 2, fy + 3, 4, H - 3, '#3a2a20');
      }
    });
    markTop(a, hx, hy + hd, hy - H - 4);
  }
  if (phase >= 4) {
    // jardín, valla blanca y buzón
    later(a, y + h - 0.5, () => {
      for (let xx = x; xx < x + w; xx += 2) if (Math.abs(xx - (x + w / 2)) > 3) rect(a.base, xx, y + h - 4, 1, 3, '#ffffff');
      rect(a.base, x, y + h - 3, w, 1, '#e8e4d8');
      rect(a.base, x + w / 2 + 6, y + h - 7, 1, 5, '#4a3020');
      rect(a.base, x + w / 2 + 5, y + h - 9, 4, 2, '#2f6fb3');
      rect(a.base, x + w / 2 - 1, y + hd + 8, 2, h - hd - 12, '#cfc6ad');
    });
    tree(a, x + 5, y + h - 5, 3);
  }
  if (works) {
    later(a, hy + hd + 0.1, () => scaffold(a, hx - 1, hy + hd - H - 3, hw + 2, H + 3));
    // hormigonera
    later(a, y + h - 6, () => {
      rect(a.base, x + w - 9, y + h - 12, 6, 5, '#e2a23b');
      rect(a.base, x + w - 8, y + h - 13, 4, 1, '#c07a1a');
      rect(a.base, x + w - 9, y + h - 7, 1, 2, '#14101f');
      rect(a.base, x + w - 4, y + h - 7, 1, 2, '#14101f');
    });
    markTop(a, hx, hy + hd, hy - H - 5);
  }
  if (phase < 4) fence(a, x, y + h, w, works);
  if (phase === 0 && !works) boardSign(a, 'SOLD', x + w / 2, y + h - 22, '#c0392b', '#ffffff');
}

function civicBox(a: Art, x: number, y: number, w: number, d: number, H: number, wall: string, roofC: string, win: string) {
  const own = mulberry32(Math.floor(a.rand() * 0x7fffffff));
  later(a, y + d, () => {
    rect(a.base, x + w, y + d - H, 3, H, 'rgba(10,8,20,0.35)');
    rect(a.base, x, y - H, w, d, roofC);
    rect(a.base, x, y - H, w, 1, shade(roofC, 0.3));
    rect(a.snow, x + 1, y - H + 1, w - 2, d - 2, 'rgba(245,250,255,0.92)');
    const fy = y + d - H;
    rect(a.base, x, fy, w, H, wall);
    rect(a.base, x, fy, w, 1, shade(wall, 0.25));
    for (let yy = fy + 3; yy <= fy + H - 4; yy += 3)
      for (let xx = x + 2; xx <= x + w - 3; xx += 4) {
        rect(a.base, xx, yy, 2, 2, '#26304a');
        if (own() < 0.6) rect(a.lights, xx, yy, 2, 2, win);
      }
    rect(a.base, x + w / 2 - 2, fy + H - 4, 4, 4, '#3a2a20');
    rect(a.lights, x + w / 2 - 2, fy + H - 4, 4, 1, '#ffe2a0');
  });
  markTop(a, x, y + d, y - H - 10);
}

function civicLot(a: Art, l: LotDef, id: string) {
  const { x, y, w, h } = lotInner(l);
  const pave = (c: string) => {
    rect(a.base, x, y, w, h, c);
    rect(a.snow, x, y, w, h, 'rgba(240,246,255,0.8)');
  };
  if (id === 'parque') {
    rect(a.base, x, y, w, h, '#3f7a3a');
    for (let i = 0; i < 150; i++) rect(a.base, x + a.rand() * w, y + a.rand() * h, 1, 1, a.rand() < 0.5 ? '#4a8a42' : '#356a31');
    rect(a.snow, x, y, w, h, 'rgba(240,246,255,0.85)');
    rect(a.base, x + w / 2 - 1, y, 3, h, '#c9b98e');
    rect(a.base, x, y + h / 2, w, 3, '#c9b98e');
    disc(a.base, x + w / 2, y + h / 2 + 1, 4, '#8a8478');
    disc(a.base, x + w / 2, y + h / 2 + 1, 2, '#4f8fb8');
    glow(a.lights, x + w / 2, y + h / 2, 10, '150,210,255', 0.4);
    for (const [tx, ty] of [[x + 7, y + 12], [x + w - 7, y + 14], [x + 8, y + h - 8], [x + w - 8, y + h - 6], [x + w / 2 + 9, y + 6]]) tree(a, Math.round(tx), Math.round(ty), 3);
    later(a, y + h / 2 + 8, () => {
      rect(a.base, x + 4, y + h / 2 + 5, 6, 1, '#7a5232');
      rect(a.base, x + 4, y + h / 2 + 6, 1, 1, '#4a3020');
      rect(a.base, x + 9, y + h / 2 + 6, 1, 1, '#4a3020');
    });
    a.tops[`${l.c},${l.r}`] = Math.min(a.tops[`${l.c},${l.r}`] ?? Infinity, y - 6);
    return;
  }
  if (id === 'escuela') {
    pave('#a9a397');
    civicBox(a, x + 2, y + 6, w - 4, 20, 13, '#9a4a34', '#4a4850', '#ffd27a');
    later(a, y + 27, () => {
      rect(a.base, x + w / 2 - 12, y + 26 - 13 + 1, 24, 6, '#f4efe2');
      drawText(a.base, 'SCHOOL', Math.round(x + w / 2 - textWidth('SCHOOL') / 2), y + 26 - 13 + 2, '#2f6fb3');
      rect(a.base, x + w - 5, y - 16, 1, 9, '#333');
      rect(a.base, x + w - 4, y - 16, 5, 3, '#2f6fb3');
      rect(a.base, x + w - 4, y - 15, 5, 1, '#c0392b');
    });
    later(a, y + h - 4, () => {
      rect(a.base, x + 4, y + h - 13, 18, 7, '#f2c230');
      rect(a.base, x + 4, y + h - 13, 18, 1, '#ffe066');
      for (let xx = x + 6; xx < x + 21; xx += 3) rect(a.base, xx, y + h - 11, 2, 2, '#26304a');
      rect(a.base, x + 4, y + h - 8, 18, 1, '#14101f');
      rect(a.base, x + 6, y + h - 6, 2, 1, '#14101f');
      rect(a.base, x + 18, y + h - 6, 2, 1, '#14101f');
    });
    return;
  }
  if (id === 'hospital') {
    pave('#b9b3a6');
    civicBox(a, x + 2, y + 4, w - 4, 22, 16, '#ece6d8', '#c9c3b6', '#cfe6ff');
    later(a, y + 26.1, () => {
      const cx = x + w / 2, cy = y + 4 - 16 + 9;
      rect(a.base, cx - 1, cy - 4, 3, 9, '#e8414f');
      rect(a.base, cx - 4, cy - 1, 9, 3, '#e8414f');
      neonSign(a, 'HOSPITAL', cx, y + 26 - 16 + 2, '#ff4f6d', '255,79,109', '#1d1d24');
    });
    later(a, y + h - 4, () => {
      rect(a.base, x + w - 16, y + h - 12, 12, 6, '#f4efe2');
      rect(a.base, x + w - 16, y + h - 9, 12, 1, '#e8414f');
      rect(a.base, x + w - 6, y + h - 12, 2, 3, '#2c3446');
      rect(a.lights, x + w - 13, y + h - 13, 2, 1, '#ff3b3b');
    });
    return;
  }
  if (id === 'metro') {
    pave('#8d8a86');
    for (let yy = y; yy < y + h; yy += 4) for (let xx = x + ((yy / 4) % 2 ? 2 : 0); xx < x + w; xx += 4) rect(a.base, xx, yy, 2, 2, '#9a9792');
    // boca de metro con barandilla y escaleras
    const ex = x + w / 2 - 8, ey = y + 18;
    rect(a.base, ex, ey, 16, 14, '#26242a');
    for (let s = 0; s < 6; s++) rect(a.base, ex + 2, ey + 2 + s * 2, 12, 1, '#55505c');
    later(a, ey + 14, () => {
      rect(a.base, ex - 1, ey - 3, 18, 1, '#2e5a3a');
      rect(a.base, ex - 1, ey - 3, 1, 17, '#2e5a3a');
      rect(a.base, ex + 16, ey - 3, 1, 17, '#2e5a3a');
      for (const gx of [ex - 1, ex + 16]) {
        rect(a.base, gx, ey - 9, 1, 6, '#2e5a3a');
        disc(a.base, gx, ey - 11, 2, '#3fbf6a');
        glow(a.lights, gx, ey - 11, 8, '120,255,150', 0.6);
      }
      rect(a.base, ex + 1, ey - 11, 14, 7, '#14101f');
      drawText(a.neon, 'SUB', ex + 3, ey - 10, '#7dff6a');
      glow(a.neon, ex + 8, ey - 8, 12, '125,255,106', 0.35);
    });
    tree(a, x + 6, y + h - 6, 3);
    tree(a, x + w - 6, y + h - 6, 3);
    a.tops[`${l.c},${l.r}`] = Math.min(a.tops[`${l.c},${l.r}`] ?? Infinity, ey - 14);
    return;
  }
  if (id === 'museo') {
    pave('#c6c0b3');
    const bx = x + 2, by = y + 8, bw = w - 4, bd = 20, H = 14;
    later(a, by + bd, () => {
      rect(a.base, bx + bw, by + bd - H, 3, H, 'rgba(10,8,20,0.35)');
      rect(a.base, bx, by - H, bw, bd, '#d8d0bf');
      rect(a.snow, bx + 1, by - H + 1, bw - 2, bd - 2, 'rgba(245,250,255,0.92)');
      const fy = by + bd - H;
      for (let r = 0; r < 5; r++) rect(a.base, bx + 2 + r * 3, fy - 5 + r, bw - 4 - r * 6, 1, '#f4efe2');
      rect(a.base, bx, fy, bw, H, '#ece6d8');
      for (let i = bx + 2; i < bx + bw - 2; i += 5) {
        rect(a.base, i, fy + 2, 2, H - 3, '#fbf8f0');
        rect(a.base, i + 2, fy + 3, 3, H - 5, '#26304a');
        rect(a.lights, i + 2, fy + 3, 3, H - 5, 'rgba(255,220,160,0.7)');
      }
      rect(a.base, bx + bw / 2 - 12, fy - 1, 24, 1, '#c9c1b0');
      drawText(a.base, 'MUSEUM', Math.round(bx + bw / 2 - textWidth('MUSEUM') / 2), fy - 7, '#6d6656');
      for (let s = 0; s < 3; s++) rect(a.base, bx - 1 + s, fy + H + s, bw + 2 - s * 2, 1, '#cfc8b8');
      // pancarta
      rect(a.base, bx + 2, fy + 2, 3, 8, '#c0392b');
      rect(a.base, bx + bw - 5, fy + 2, 3, 8, '#2f6fb3');
    });
    markTop(a, bx, by + bd, by - H - 8);
    return;
  }
  // viviendas sociales: dos bloques altos de ladrillo
  pave('#8d8a86');
  building(a, x + 1, y + 2, Math.floor((w - 2) / 2), 22, 20, { facadeColor: '#9a5a44', roof: '#4a4850', fireEscape: true });
  building(a, x + 1 + Math.floor((w - 2) / 2), y + 2, Math.ceil((w - 2) / 2), 22, 18, { facadeColor: '#8e4a3a', roof: '#56606a', fireEscape: true, tower: true });
  tree(a, x + 6, y + h - 6, 3);
  tree(a, x + w - 8, y + h - 6, 3);
  later(a, y + h - 3, () => {
    rect(a.base, x + 12, y + h - 10, 10, 1, '#7a5232');
    rect(a.base, x + 12, y + h - 9, 1, 2, '#4a3020');
    rect(a.base, x + 21, y + h - 9, 1, 2, '#4a3020');
  });
}

function civicWorks(a: Art, l: LotDef) {
  const { x, y, w, h } = lotInner(l);
  dirt(a, x, y, w, h);
  // estructura a medias con andamio y grúa
  later(a, y + 26, () => {
    rect(a.base, x + 4, y + 6, w - 8, 20, '#8f8b84');
    for (let xx = x + 4; xx < x + w - 4; xx += 6) rect(a.base, xx, y + 26 - 12, 1, 12, '#6d6a64');
    rect(a.base, x + 4, y + 26 - 12, w - 8, 1, '#6d6a64');
    scaffold(a, x + 3, y + 26 - 13, w - 6, 13);
  });
  markTop(a, x + 4, y + 26, y - 10);
  crane(a, x + w - 8, y + 28, 40);
  later(a, y + h - 6, () => {
    rect(a.base, x + 5, y + h - 12, 8, 4, '#e2a23b');
    rect(a.base, x + 5, y + h - 14, 4, 2, '#c07a1a');
    rect(a.base, x + 12, y + h - 15, 1, 4, '#14101f');
    for (let i = 0; i < 3; i++) rect(a.base, x + 16 + i * 4, y + h - 10, 3, 3, '#c9a46a');
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
    building(a, x + 2, y + 6, w - 4, 22, 15, { facadeColor: '#c98a5a', roof: '#9a3424', shop: false, win: 3, fireEscape: false });
    later(a, y + 28.1, () => {
      rect(a.base, x + w / 2 - 1, y + 28 - 5, 3, 5, '#7a3a2a');
      rect(a.base, x + 4, y + 28 - 9, w - 8, 1, '#ffffff');
    });
    tree(a, x + 5, y + h - 4, 3);
    tree(a, x + w - 6, y + h - 4, 3);
  } else {
    building(a, x + 2, y + 4, w - 4, 26, 24, { facadeColor: '#b5523e', roof: '#5b5960', shop: true, fireEscape: true, tower: true, sign: textWidth('ROOMS') + 4 <= w - 4 ? 'ROOMS' : undefined });
  }
  if (works) later(a, y + 30.2, () => scaffold(a, x + 2, y + 2, w - 4, 26));
  later(a, y + h - 0.5, () => {
    rect(a.base, x + 4, y + h - 8, 6, 5, '#f4efe2');
    drawText(a.base, 'R', x + 5, y + h - 8, '#c0392b');
  });
}

/** Negocios del inmigrante: lavandería, puesto de comida o taller (3 niveles). */
function bizLot(a: Art, l: LotDef, id: string, level: number, works: boolean) {
  const { x, y, w, h } = lotInner(l);
  if (level === 0) {
    // en obras para abrir
    dirt(a, x, y, w, h);
    later(a, y + 30, () => {
      rect(a.base, x + 4, y + 10, w - 8, 20, '#8f8b84');
      scaffold(a, x + 3, y + 8, w - 6, 16);
    });
    fence(a, x, y + h, w, true);
    markTop(a, x + 4, y + 30, y);
    return;
  }
  rect(a.base, x, y, w, h, '#8d8a86');
  for (let xx = x; xx < x + w; xx += 6) rect(a.base, xx, y + h - 3, 1, 3, '#7c7975');
  rect(a.snow, x, y, w, h, 'rgba(240,246,255,0.8)');
  const H = 8 + level * 4;
  const conf = {
    lavanderia: { color: '#4f7fc8', sign: level >= 3 ? 'WASH 24' : 'WASH', neon: ['#4ff0ff', '79,240,255'] },
    comida: { color: '#e2a23b', sign: level >= 3 ? 'DINING' : level === 2 ? 'CAFE' : 'TACOS', neon: ['#ffcc33', '255,204,51'] },
    taller: { color: '#5a5c60', sign: level >= 3 ? 'CARS' : 'GARAGE', neon: ['#ff8a3b', '255,138,59'] },
  }[id] ?? { color: '#7a6a5a', sign: 'SHOP', neon: ['#ffffff', '255,255,255'] };
  const bd = 16 + level * 3;
  const by = y + h - bd - 10;
  building(a, x + 2, by, w - 4, bd, H, { facadeColor: conf.color, roof: '#4a4850', shop: true, win: 3 });
  later(a, by + bd + 0.1, () => {
    const [col, rgb] = conf.neon;
    if (textWidth(conf.sign) + 4 <= w + 6) neonSign(a, conf.sign, x + w / 2, by + bd - H - 12, col, rgb);
    if (id === 'lavanderia') for (let k = 0; k < Math.min(5, level * 2); k++) {
      const mx = x + 5 + k * 6;
      rect(a.base, mx, by + bd - 4, 4, 3, '#e8e4d8');
      rect(a.base, mx + 1, by + bd - 3, 2, 2, '#4f86a8');
    }
  });
  // delante: mesas (comida), coches (taller), sillas de espera (lavandería)
  later(a, y + h - 1, () => {
    if (id === 'comida') for (let k = 0; k < level + 1; k++) {
      const tx = x + 4 + k * 9;
      rect(a.base, tx, y + h - 8, 6, 3, '#f4efe2');
      rect(a.base, tx + 1, y + h - 11, 4, 3, ['#c0392b', '#3a7a4a', '#2f6fb3'][k % 3]);
    }
    if (id === 'taller') for (let k = 0; k < level; k++) {
      const cx = x + 4 + k * 12;
      rect(a.base, cx, y + h - 9, 10, 5, ['#f2c230', '#c0392b', '#2f6fb3'][k % 3]);
      rect(a.base, cx + 3, y + h - 9, 4, 2, '#2c3446');
      rect(a.base, cx + 1, y + h - 4, 2, 1, '#14101f');
      rect(a.base, cx + 7, y + h - 4, 2, 1, '#14101f');
    }
  });
  if (works) later(a, by + bd + 0.2, () => scaffold(a, x + 2, by + bd - H - 4, w - 4, H + 4));
}

/** Solar subastado: torre de oficinas acristalada. */
function officeLot(a: Art, l: LotDef) {
  const { x, y, w, h } = lotInner(l);
  rect(a.base, x, y, w, h, '#9a9792');
  rect(a.snow, x, y, w, h, 'rgba(240,246,255,0.8)');
  building(a, x + 3, y + 6, w - 6, 26, 32, { facadeColor: '#4f6a86', roof: '#56606a', win: 2 });
  later(a, y + 32.1, () => {
    rect(a.base, x + 3, y + 32 - 32, w - 6, 2, '#a9d4ea');
    neonSign(a, 'HUDSON', x + w / 2, y + 32 - 32 - 12, '#9fe8ff', '159,232,255');
  });
  markTop(a, x + 3, y + 32, y - 18);
}

/** Obras públicas ampliadas: adornos de nivel 2 y 3 y andamios si se amplían. */
function civicExtras(a: Art, l: LotDef, id: string, level: number, works: boolean) {
  const { x, y, w, h } = lotInner(l);
  if (works) {
    later(a, y + 30.3, () => scaffold(a, x + 2, y + 4, w - 4, 24));
    crane(a, x + w - 6, y + 30, 36);
  }
  if (level < 2) return;
  later(a, y + h - 0.3, () => {
    // banderas y farolas de gala
    for (let k = 0; k < level; k++) {
      const fx = x + 3 + k * 10;
      rect(a.base, fx, y + h - 14, 1, 10, '#333');
      rect(a.base, fx + 1, y + h - 14, 4, 3, ['#2f6fb3', '#c0392b', '#ffcc33'][k % 3]);
    }
    if (level >= 3) {
      rect(a.base, x + w - 12, y + 2, 10, 5, '#ffcc33');
      drawText(a.base, '***', x + w - 12, y + 2, '#7a4a12');
      glow(a.lights, x + w / 2, y + h / 2, 24, '255,214,140', 0.4);
    }
  });
  if (id === 'parque' && level >= 2) {
    for (let yy = -4; yy <= 4; yy++) {
      const ww = Math.round(Math.sqrt(1 - (yy / 5) ** 2) * 9);
      rect(a.base, x + w / 2 + 6 - ww, y + 14 + yy, ww * 2, 1, '#3f86c8');
    }
  }
}

// --------------------------------------------------------------------------
// Calles
// --------------------------------------------------------------------------

function streets(a: Art, lamps: { x: number; y: number }[]) {
  const { base, snow } = a;
  rect(base, 0, 0, MAP_W, MAP_H, '#38363c');
  for (let i = 0; i < 5200; i++) rect(base, a.rand() * MAP_W, a.rand() * MAP_H, 1, 1, a.rand() < 0.5 ? '#302e34' : '#413f46');
  for (let i = 0; i < AVES; i++) {
    const cx = aveX(i);
    rect(base, cx - 1, 0, 1, MAP_H, '#d8b23a');
    rect(base, cx + 1, 0, 1, MAP_H, '#d8b23a');
    for (let yy = 0; yy < MAP_H; yy += 8) {
      rect(base, cx - 5, yy, 1, 4, '#bdb8ac');
      rect(base, cx + 5, yy, 1, 4, '#bdb8ac');
    }
  }
  for (let j = 0; j <= ROWS; j++) for (let xx = 0; xx < MAP_W; xx += 8) rect(base, xx, stY(j), 4, 1, '#bdb8ac');
  for (let c = 0; c < COLS; c++)
    for (let r = 0; r < ROWS; r++) {
      const x = blockX(c), y = blockY(r);
      const d = districtOf(c, r);
      rect(base, x, y, BLOCK_W, BLOCK_H, '#8d8a86');
      for (let xx = x; xx < x + BLOCK_W; xx += 6) rect(base, xx, y + BLOCK_H - SIDEWALK, 1, SIDEWALK, '#7c7975');
      rect(base, x, y + BLOCK_H - 1, BLOCK_W, 1, '#6a6763');
      rect(snow, x, y, BLOCK_W, BLOCK_H, 'rgba(235,242,252,0.7)');
      // farolas en la acera sur (la visible)
      for (const lx of [x + 6, x + BLOCK_W - 6]) {
        const ly = y + BLOCK_H - 2;
        lamps.push({ x: lx, y: ly });
        later(a, ly + 0.5, () => {
          rect(base, lx, ly - 8, 1, 8, '#2e3b33');
          rect(base, lx - 1, ly - 9, 3, 1, '#2e3b33');
          rect(a.lights, lx - 1, ly - 8, 3, 1, '#ffe2a0');
        });
      }
      sidewalkProps(a, x, y, d);
    }
  // Cruces: asfalto, pasos de cebra y alcantarillas
  for (let i = 0; i < AVES; i++)
    for (let j = 0; j <= ROWS; j++) {
      const cx = aveX(i), cy = stY(j);
      rect(base, cx - AVE_W / 2, cy - ST_H / 2, AVE_W, ST_H, '#3c3a40');
      for (let k = -AVE_W / 2 + 1; k < AVE_W / 2 - 1; k += 3) {
        rect(base, cx + k, cy - ST_H / 2 - 3, 2, 3, '#e8e4d8');
        rect(base, cx + k, cy + ST_H / 2, 2, 3, '#e8e4d8');
      }
      for (let k = -ST_H / 2 + 1; k < ST_H / 2 - 1; k += 3) {
        rect(base, cx - AVE_W / 2 - 3, cy + k, 3, 2, '#e8e4d8');
        rect(base, cx + AVE_W / 2, cy + k, 3, 2, '#e8e4d8');
      }
      if (a.rand() < 0.45) {
        const mx = Math.round(cx - 3 + a.rand() * 6);
        const my = Math.round(cy - 2 + a.rand() * 4);
        rect(base, mx, my, 4, 2, '#252427');
        rect(base, mx + 1, my, 2, 1, '#4a484e');
      }
    }
  for (let i = 0; i < AVES; i++) {
    rect(snow, aveX(i) - AVE_W / 2, 0, 2, MAP_H, 'rgba(235,242,252,0.8)');
    rect(snow, aveX(i) + AVE_W / 2 - 2, 0, 2, MAP_H, 'rgba(235,242,252,0.8)');
  }
  river(a);
}

/** Cabinas, buzones, quioscos, bocas de incendio y basura en la acera sur. */
function sidewalkProps(a: Art, x: number, y: number, d: District) {
  const sy = y + BLOCK_H - 1;
  const spots = [x + 14, x + 30, x + 46, x + 62];
  const poor = DISTRICTS[d].poor;
  for (const px of spots) {
    const roll = a.rand();
    if (roll < 0.12) {
      // cabina telefónica
      later(a, sy, () => {
        rect(a.base, px, sy - 9, 4, 8, '#9a9ea6');
        rect(a.base, px + 1, sy - 8, 2, 4, '#6fa7c7');
        rect(a.base, px, sy - 10, 4, 1, '#2f6fb3');
        rect(a.lights, px + 1, sy - 8, 2, 4, 'rgba(220,240,255,0.8)');
      });
    } else if (roll < 0.22) {
      // buzón azul
      later(a, sy, () => {
        rect(a.base, px, sy - 5, 3, 4, '#2f5fa8');
        rect(a.base, px, sy - 5, 3, 1, '#4f7fc8');
        rect(a.base, px, sy - 1, 1, 1, '#1a1a1f');
        rect(a.base, px + 2, sy - 1, 1, 1, '#1a1a1f');
      });
    } else if (roll < 0.3 && (d === 'midtown' || d === 'chinatown')) {
      // quiosco de prensa
      later(a, sy, () => {
        rect(a.base, px - 2, sy - 8, 8, 7, '#3a7a4a');
        rect(a.base, px - 3, sy - 9, 10, 2, '#2a5a3a');
        rect(a.base, px - 1, sy - 6, 6, 3, '#f4efe2');
        rect(a.base, px, sy - 5, 1, 1, '#e8414f');
        rect(a.base, px + 2, sy - 5, 2, 1, '#2f6fb3');
        rect(a.lights, px - 1, sy - 6, 6, 3, 'rgba(255,230,170,0.6)');
      });
    } else if (roll < 0.4) {
      later(a, sy, () => rect(a.base, px, sy - 3, 2, 3, '#c0392b')); // boca de incendios
    } else if (poor && roll < 0.72) {
      // bolsas de basura y cubos
      later(a, sy, () => {
        rect(a.base, px, sy - 3, 3, 3, '#1f1f24');
        rect(a.base, px + 3, sy - 2, 3, 2, '#2a2a30');
        rect(a.base, px + 1, sy - 4, 1, 1, '#3a3a40');
        if (a.rand() < 0.5) rect(a.base, px + 6, sy - 4, 3, 4, '#6a6e74');
      });
    }
  }
}

/** East River: agua, olas, muelles de madera y el puente de Brooklyn. */
function river(a: Art) {
  const { base, snow } = a;
  const x = RIVER_X;
  rect(base, x, 0, RIVER_W, MAP_H, '#1d3a58');
  for (let i = 0; i < 700; i++) rect(base, x + a.rand() * RIVER_W, a.rand() * MAP_H, 3 + a.rand() * 4, 1, a.rand() < 0.5 ? '#2a4e72' : '#17304a');
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
  // puente: tablero con calzada, pasarela y dos torres de piedra con cables
  const by = stY(BRIDGE_STREET);
  const top = by - ST_H / 2 - 3;
  rect(base, x - 2, top, RIVER_W + 4, ST_H + 6, '#4a4044');
  rect(base, x - 2, top, RIVER_W + 4, 2, '#7a6a5a');
  rect(base, x - 2, top + ST_H + 4, RIVER_W + 4, 2, '#7a6a5a');
  rect(base, x - 2, by - 1, RIVER_W + 4, 1, '#d8b23a');
  for (let xx = x; xx < x + RIVER_W; xx += 8) rect(base, xx, by + 3, 4, 1, '#bdb8ac');
  rect(base, x - 2, top + ST_H + 6, RIVER_W + 4, 3, 'rgba(0,0,0,0.35)');
  rect(snow, x - 2, top, RIVER_W + 4, ST_H + 6, 'rgba(240,246,255,0.8)');
  for (const tx of [x + 14, x + RIVER_W - 18]) {
    later(a, by + ST_H / 2 + 3, () => {
      const H = 34;
      rect(a.base, tx, top - H, 8, H + ST_H + 6, '#a89478');
      rect(a.base, tx, top - H, 1, H + ST_H + 6, '#c2b08c');
      rect(a.base, tx + 7, top - H, 1, H + ST_H + 6, '#7d6a5c');
      // arcos góticos
      rect(a.base, tx + 1, top - H + 8, 2, 12, '#3a3040');
      rect(a.base, tx + 5, top - H + 8, 2, 12, '#3a3040');
      rect(a.base, tx - 1, top - H - 2, 10, 2, '#8a7560');
      rect(a.snow, tx - 1, top - H - 3, 10, 2, 'rgba(245,250,255,0.9)');
      rect(a.lights, tx + 3, top - H - 4, 2, 2, '#ff3b3b');
    });
  }
  later(a, by + ST_H / 2 + 3.1, () => {
    // cables colgantes entre torres y hacia las orillas
    const t1 = x + 18;
    const t2 = x + RIVER_W - 14;
    const ty = top - 34;
    for (let xx = x - 6; xx <= x + RIVER_W + 6; xx++) {
      let cy: number;
      if (xx < t1) cy = ty + ((t1 - xx) / (t1 - x + 6)) * 30;
      else if (xx > t2) cy = ty + ((xx - t2) / (x + RIVER_W + 6 - t2)) * 30;
      else {
        const u = (xx - t1) / (t2 - t1);
        cy = ty + Math.sin(u * Math.PI) * 24;
      }
      rect(a.base, xx, Math.round(cy), 1, 1, '#d8d4c6');
      if (xx % 3 === 0 && cy < top) rect(a.base, xx, Math.round(cy) + 1, 1, Math.max(0, top - Math.round(cy) - 1), 'rgba(216,212,198,0.35)');
      if (xx % 6 === 0) rect(a.lights, xx, Math.round(cy), 1, 1, '#fff2c0');
    }
  });
  a.tops.bridge = top - 40;
}

// --------------------------------------------------------------------------
// Brooklyn: lugares
// --------------------------------------------------------------------------

function sugarFactory(a: Art, p: Place) {
  const { x, y, w, h } = placeRect(p);
  rect(a.base, x + SIDEWALK, y + SIDEWALK, w - 6, h - 6, '#5f5c58');
  building(a, x + 4, y + 6, w - 8, 26, 18, { facadeColor: '#8e3b2e', roof: '#4a4850', fireEscape: true, win: 3 });
  chimney(a, x + 14, y + 8, 30);
  chimney(a, x + w - 16, y + 8, 26);
  later(a, y + 32.1, () => neonSign(a, 'SUGAR', x + w / 2, y + 32 - 18 - 4, '#ffcc33', '255,204,51'));
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
      const ty = y + 10 + ry * 14;
      const col = tents[(ry * 4 + cx) % tents.length];
      later(a, ty + 8, () => {
        rect(a.base, tx, ty, 14, 6, col);
        for (let k = tx; k < tx + 14; k += 4) rect(a.base, k, ty, 2, 6, '#f4efe2');
        rect(a.base, tx + 1, ty + 6, 12, 3, '#6a4628');
        rect(a.base, tx + 2, ty + 6, 3, 2, ['#9fd3ff', '#ffd24a', '#e8414f'][cx % 3]);
        rect(a.snow, tx, ty, 14, 3, 'rgba(245,250,255,0.9)');
      });
    }
  later(a, y + h - 0.5, () => boardSignNow(a, 'FLEA MARKET', x + w / 2, y + h - 12, '#f4efe2', '#c0392b'));
  a.tops[`${p.c},${p.r}`] = Math.min(a.tops[`${p.c},${p.r}`] ?? Infinity, y + 4);
}

function racetrack(a: Art, p: Place) {
  const { x, y, w, h } = placeRect(p);
  rect(a.base, x + 2, y + 2, w - 4, h - 4, '#3f7a3a');
  const cx = x + w / 2, cy = y + h / 2 + 2;
  for (let t = 0; t < 360; t += 1) {
    const an = (t * Math.PI) / 180;
    rect(a.base, cx + Math.cos(an) * (w / 2 - 12) - 2, cy + Math.sin(an) * (h / 2 - 9) - 2, 5, 5, '#a8784a');
  }
  for (let t = 0; t < 360; t += 6) {
    const an = (t * Math.PI) / 180;
    rect(a.base, cx + Math.cos(an) * (w / 2 - 8), cy + Math.sin(an) * (h / 2 - 5), 1, 1, '#f4efe2');
  }
  rect(a.snow, x, y, w, h, 'rgba(240,246,255,0.8)');
  // tribuna
  later(a, y + 14, () => {
    rect(a.base, x + 20, y + 2, w - 40, 12, '#e8e4d8');
    for (let i = 0; i < 4; i++) rect(a.base, x + 22, y + 4 + i * 2, w - 44, 1, i % 2 ? '#c0392b' : '#2f6fb3');
    rect(a.base, x + 18, y, w - 36, 3, '#3a3a46');
    rect(a.lights, x + 22, y + 4, w - 44, 8, 'rgba(255,230,170,0.35)');
  });
  // caballos en la pista
  for (let i = 0; i < 4; i++) {
    const an = (i * 0.5 + 0.3) * Math.PI;
    rect(a.base, cx + Math.cos(an) * (w / 2 - 12), cy + Math.sin(an) * (h / 2 - 9), 3, 2, ['#4a2e1c', '#8a5a33', '#1c1818', '#f4efe2'][i]);
  }
  later(a, y + h, () => neonSign(a, 'RACES', cx, y + h - 14, '#7dff6a', '125,255,106'));
}

function coneyIsland(a: Art, p: Place) {
  const { x, y, w, h } = placeRect(p);
  // paseo de madera y playa
  rect(a.base, x + 2, y + 2, w - 4, h - 4, '#e8d29a');
  for (let i = 0; i < 300; i++) rect(a.base, x + 2 + a.rand() * (w - 4), y + 2 + a.rand() * (h - 4), 1, 1, '#d8c08a');
  rect(a.base, x + 2, y + h - 16, w - 4, 6, '#9a6a3a');
  for (let k = x + 2; k < x + w - 2; k += 3) rect(a.base, k, y + h - 16, 1, 6, '#7a4a2a');
  rect(a.base, x + 2, y + h - 10, w - 4, 8, '#3f86c8');
  for (let k = x + 4; k < x + w - 4; k += 7) rect(a.base, k, y + h - 8, 4, 1, '#cfe6ff');
  rect(a.snow, x, y, w, h - 10, 'rgba(240,246,255,0.8)');
  // noria
  const cx = x + 36, cy = y + 18, R = 16;
  later(a, y + 40, () => {
    rect(a.base, cx - 6, cy, 1, 22, '#c9c4bc');
    rect(a.base, cx + 6, cy, 1, 22, '#c9c4bc');
    for (let t = 0; t < 360; t += 4) {
      const an = (t * Math.PI) / 180;
      rect(a.base, cx + Math.cos(an) * R, cy + Math.sin(an) * R, 1, 1, '#e8e4d8');
    }
    for (let k = 0; k < 8; k++) {
      const an = (k / 8) * Math.PI * 2;
      for (let rr = 2; rr < R; rr += 2) rect(a.base, cx + Math.cos(an) * rr, cy + Math.sin(an) * rr, 1, 1, '#a9adb3');
      const gx = cx + Math.cos(an) * R, gy = cy + Math.sin(an) * R;
      rect(a.base, gx - 1, gy, 3, 3, ['#e8414f', '#ffcc33', '#2f6fb3', '#3fbf6a'][k % 4]);
      rect(a.neon, gx, gy - 1, 1, 1, ['#ff4f9a', '#ffcc33', '#4ff0ff', '#7dff6a'][k % 4]);
    }
    glow(a.neon, cx, cy, R + 8, '255,120,200', 0.25);
  });
  markTop(a, cx, y + 40, cy - R - 4);
  // montaña rusa
  later(a, y + 36, () => {
    for (let xx = x + 70; xx < x + w - 8; xx++) {
      const yy = y + 22 - Math.abs(Math.sin((xx - x) / 9)) * 14;
      rect(a.base, xx, Math.round(yy), 1, 1, '#f4efe2');
      if (xx % 4 === 0) rect(a.base, xx, Math.round(yy) + 1, 1, y + 34 - Math.round(yy), '#9a6a3a');
    }
  });
  markTop(a, x + 90, y + 36, y + 6);
  later(a, y + h - 16, () => neonSign(a, 'CONEY ISLAND', x + w - 50, y + h - 30, '#ff4f9a', '255,79,154'));
}

function boardSignNow(a: Art, text: string, cx: number, y: number, board: string, ink: string) {
  const w = textWidth(text) + 4;
  const x = Math.round(cx - w / 2);
  rect(a.base, x + 2, y + 8, 1, 4, '#4a3020');
  rect(a.base, x + w - 3, y + 8, 1, 4, '#4a3020');
  rect(a.base, x, y, w, 8, board);
  rect(a.base, x, y + 7, w, 1, shade(board, -0.3));
  drawText(a.base, text, x + 2, y + 1, ink);
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
      later(a, y + h / 2 + 8, () => {
        rect(a.base, x + 10, y + h / 2 - 8, w - 20, 16, '#8f8b84');
        scaffold(a, x + 9, y + h / 2 - 14, w - 18, 14);
      });
      crane(a, x + 12, y + h / 2 + 10, 44);
      if (w > 100) crane(a, x + w - 20, y + h / 2 + 6, 40);
    } else {
      later(a, y + h - 0.5, () => boardSignNow(a, 'FUTURE SITE', x + w / 2, y + h - 22, '#f4efe2', '#2f6fb3'));
    }
    a.tops[`${colOf(x + 4)},${rowOf(y + 4)}`] = Math.min(a.tops[`${colOf(x + 4)},${rowOf(y + 4)}`] ?? Infinity, y - 6);
    return;
  }
  if (m.id === 'estadio') {
    rect(a.base, x + 2, y + 2, w - 4, h - 4, '#8d8a86');
    const cx = x + w / 2, cy = y + h / 2;
    later(a, y + h - 2, () => {
      for (let yy = -21; yy <= 21; yy++) {
        const ww = Math.round(Math.sqrt(1 - (yy / 22) ** 2) * (w / 2 - 6));
        rect(a.base, cx - ww, cy + yy, ww * 2, 1, '#c9c4bc');
        if (yy % 3 === 0) rect(a.base, cx - ww, cy + yy, ww * 2, 1, '#b0aaa0');
        if (Math.abs(yy) < 15) {
          const gw = Math.round(Math.sqrt(1 - (yy / 15) ** 2) * (w / 2 - 22));
          rect(a.base, cx - gw, cy + yy, gw * 2, 1, Math.abs(yy) % 4 < 2 ? '#3f8a3a' : '#4a9a42');
        }
      }
      // diamante
      for (let k = 0; k < 10; k++) {
        rect(a.base, cx - k, cy + 4 - k, 1, 1, '#c99a5a');
        rect(a.base, cx + k, cy + 4 - k, 1, 1, '#c99a5a');
      }
      rect(a.base, cx - 1, cy + 3, 3, 2, '#f4efe2');
      for (const lx of [x + 12, x + w - 14]) {
        rect(a.base, lx, y - 14, 2, 20, '#55595f');
        rect(a.base, lx - 3, y - 18, 8, 4, '#d8d4c6');
        rect(a.lights, lx - 3, y - 18, 8, 4, '#ffffff');
        glow(a.lights, lx, y - 16, 22, '255,255,230', 0.45);
      }
      neonSign(a, 'DODGERS', cx, y + h - 14, '#4ff0ff', '79,240,255');
    });
    markTop(a, x + 12, y + h - 2, y - 20);
  } else if (m.id === 'puerto') {
    rect(a.base, x + 2, y + 2, w - 4, h - 4, '#8d8a86');
    building(a, x + 6, y + 12, w - 14, 30, 14, { facadeColor: '#e8e4d8', roof: '#56606a', win: 3 });
    later(a, y + 42.1, () => neonSign(a, 'CRUISE PORT', x + w / 2, y + 42 - 14 - 10, '#4ff0ff', '79,240,255'));
    // crucero atracado en el río
    const sx = RIVER_X + 6, sy = y + 20, sw = RIVER_W - 14, sh = h - 40;
    later(a, sy + sh, () => {
      rect(a.base, sx, sy, sw, sh, '#f4efe2');
      rect(a.base, sx, sy, sw, 2, '#c0392b');
      rect(a.base, sx + 4, sy + 6, sw - 8, sh - 16, '#e8e4d8');
      for (let yy = sy + 8; yy < sy + sh - 10; yy += 4) for (let xx = sx + 6; xx < sx + sw - 6; xx += 4) {
        rect(a.base, xx, yy, 2, 2, '#26304a');
        if (a.rand() < 0.6) rect(a.lights, xx, yy, 2, 2, '#ffd27a');
      }
      rect(a.base, sx + sw / 2 - 4, sy + 10, 8, 10, '#c0392b');
      rect(a.base, sx + sw / 2 - 4, sy + 8, 8, 2, '#1d1d24');
    });
    markTop(a, x + 6, y + 42, y - 4);
  } else if (m.id === 'aeropuerto') {
    rect(a.base, x + 2, y + 2, w - 4, h - 4, '#5f7a4a');
    rect(a.base, x + 8, y + h / 2 - 6, w - 16, 12, '#3c3a40');
    for (let xx = x + 12; xx < x + w - 12; xx += 10) rect(a.base, xx, y + h / 2, 6, 1, '#f4efe2');
    for (let xx = x + 8; xx < x + w - 8; xx += 6) {
      rect(a.lights, xx, y + h / 2 - 6, 1, 1, '#4ff0ff');
      rect(a.lights, xx, y + h / 2 + 5, 1, 1, '#4ff0ff');
    }
    rect(a.snow, x, y, w, h, 'rgba(240,246,255,0.75)');
    building(a, x + 12, y + 10, 70, 22, 12, { facadeColor: '#d8d4c6', roof: '#7a7580', win: 3 });
    later(a, y + 30, () => {
      // torre de control
      const tx = x + w - 30;
      rect(a.base, tx, y - 10, 6, 40, '#c9c4bc');
      rect(a.base, tx - 3, y - 18, 12, 8, '#3a3a46');
      rect(a.base, tx - 2, y - 17, 10, 5, '#6fa7c7');
      rect(a.lights, tx - 2, y - 17, 10, 5, 'rgba(160,230,255,0.8)');
      rect(a.lights, tx + 2, y - 21, 2, 2, '#ff3b3b');
      neonSign(a, 'AIRPORT', x + 47, y + 32 - 12 - 10, '#ffcc33', '255,204,51');
    });
    markTop(a, x + w - 30, y + 30, y - 24);
    later(a, y + h - 14, () => {
      // avión en la pista
      const px = x + w / 2 - 20, py = y + h / 2 + 12;
      rect(a.base, px, py, 30, 4, '#f4efe2');
      rect(a.base, px + 10, py - 6, 6, 16, '#d8d4c6');
      rect(a.base, px + 26, py - 3, 3, 10, '#c0392b');
      rect(a.base, px + 2, py + 1, 20, 1, '#2f6fb3');
    });
  }
}

/** Times Square renovado: pantallas gigantes y plaza peatonal. */
function timesSquareReform(a: Art, p: Place, st: 'obras' | 'listo' | undefined) {
  const { x, y, w, h } = placeRect(p);
  if (st === 'obras') {
    later(a, y + h - 0.2, () => scaffold(a, x + 4, y + h - 22, w - 8, 18));
    crane(a, x + w - 12, y + h - 2, 48);
    return;
  }
  if (st !== 'listo') return;
  later(a, y + h + 0.3, () => {
    // pantalla gigante en lo alto
    rect(a.base, x + w / 2 - 20, y - 26, 40, 18, '#101018');
    const cols = ['#ff4f9a', '#4ff0ff', '#ffcc33', '#7dff6a'];
    for (let i = 0; i < 4; i++) rect(a.neon, x + w / 2 - 18 + i * 9, y - 24, 9, 14, cols[i]);
    drawText(a.neon, 'NYC', x + w / 2 - 6, y - 20, '#ffffff');
    glow(a.neon, x + w / 2, y - 17, 40, '255,150,220', 0.35);
    // plaza peatonal roja
    rect(a.base, x + 2, y + h - 6, w - 4, 4, '#a8352c');
    for (let k = x + 4; k < x + w - 4; k += 8) rect(a.base, k, y + h - 6, 2, 4, '#c8452e');
  });
  a.tops[`${p.c},${p.r}`] = Math.min(a.tops[`${p.c},${p.r}`] ?? Infinity, y - 30);
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

/** Trozos del mapa: Manhattan y Brooklyn se dibujan por separado para no pintar lo que no se ve. */
export const CHUNKS: [number, number][] = [
  [0, RIVER_X + RIVER_W / 2],
  [RIVER_X + RIVER_W / 2, MAP_W],
];

export function generateCityMap(seed = 1985, look?: CityLook | null): CityMapArt {
  const rand = mulberry32(seed);
  const g = { base: canvas(), lights: canvas(), neon: canvas(), snow: canvas() };
  const a: Art = { base: g.base.ctx, lights: g.lights.ctx, neon: g.neon.ctx, snow: g.snow.ctx, rand, seed, queue: [], tops: {} };
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
  // Lugares sin edificios altos: su parte de arriba es la propia manzana (o la cúpula).
  a.tops['1,4'] = Math.min(a.tops['1,4'] ?? Infinity, blockY(4) - 20);
  a.tops['2,7'] = Math.min(a.tops['2,7'] ?? Infinity, blockY(7) - 6);
  a.tops['3,1'] = Math.min(a.tops['3,1'] ?? Infinity, blockY(1) - 2);

  // Cada fila de manzanas va en su propio lienzo, de atrás hacia delante.
  const full: { y: number; depth: number; set: Record<'base' | 'lights' | 'neon' | 'snow', { c: HTMLCanvasElement; ctx: Ctx }> }[] = [];
  for (let r = 0; r < ROWS; r++) {
    const y = blockY(r) - ROW_ABOVE;
    const h = BLOCK_H + ROW_ABOVE + ROW_BELOW;
    full.push({ y, depth: rowDepth(r), set: { base: canvas(h, y), lights: canvas(h, y), neon: canvas(h, y), snow: canvas(h, y) } });
  }
  a.queue.sort((p, q) => p.key - q.key).forEach((d) => {
    const set = full[rowOf(d.key)].set;
    a.base = set.base.ctx;
    a.lights = set.lights.ctx;
    a.neon = set.neon.ctx;
    a.snow = set.snow.ctx;
    d.draw();
  });
  for (const lp of lamps) glow(g.lights.ctx, lp.x, lp.y - 4, 10, '255,206,120', 0.4);
  const wet = canvas();
  puddles(wet.ctx, mulberry32(seed ^ 0x77));

  // Partimos cada capa en trozos (Manhattan y Brooklyn).
  const slice = (src: HTMLCanvasElement, [x0, x1]: [number, number]) => {
    const c = document.createElement('canvas');
    c.width = Math.ceil(x1 - x0);
    c.height = src.height;
    c.getContext('2d')!.drawImage(src, -Math.floor(x0), 0);
    return c;
  };
  const rows: RowLayer[] = [];
  const grounds: CityMapArt['grounds'] = [];
  for (const ch of CHUNKS) {
    for (const f of full)
      rows.push({ x: Math.floor(ch[0]), y: f.y, depth: f.depth, base: slice(f.set.base.c, ch), lights: slice(f.set.lights.c, ch), neon: slice(f.set.neon.c, ch), snow: slice(f.set.snow.c, ch) });
    grounds.push({ x: Math.floor(ch[0]), base: slice(g.base.c, ch), lights: slice(g.lights.c, ch), neon: slice(g.neon.c, ch), snow: slice(g.snow.c, ch), wet: slice(wet.c, ch) });
  }
  return { ground: grounds[0], grounds, rows, lamps, tops: a.tops };
}

function hashPlace(id: string) {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return h >>> 0;
}
