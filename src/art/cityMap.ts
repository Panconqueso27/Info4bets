import { mulberry32 } from '../core/rng';
import type { Role } from '../core/types';
import { shade } from './character';
import { drawText, textWidth } from './pixelfont';

/**
 * La ciudad vista desde arriba con una ligera inclinación (perspectiva 3/4):
 * se ven las azoteas y la fachada frontal de cada edificio, dibujados de
 * atrás hacia delante para dar volumen. Manhattan años 80: avenidas,
 * calles, depósitos de agua, escaleras de incendio, toldos y neones.
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
export const COLS = 4;
export const ROWS = 9;
export const MAP_W = AVE_W * (COLS + 1) + BLOCK_W * COLS;
export const MAP_H = ST_H * (ROWS + 1) + BLOCK_H * ROWS;
const SIDEWALK = 3;

export const blockX = (c: number) => AVE_W + c * (BLOCK_W + AVE_W);
export const blockY = (r: number) => ST_H + r * (BLOCK_H + ST_H);
/** Centro de la avenida i (0..COLS) y de la calle j (0..ROWS). */
export const aveX = (i: number) => i * (BLOCK_W + AVE_W) + AVE_W / 2;
export const stY = (j: number) => j * (BLOCK_H + ST_H) + ST_H / 2;
/**
 * Líneas de acera por las que caminan los personajes: la acera oeste y la
 * acera sur de cada manzana, que quedan a la vista con la cámara inclinada.
 */
export const walkX = (c: number) => blockX(c) + 1.5;
export const walkY = (r: number) => blockY(r) + BLOCK_H - 1.5;

export type PlaceId = 'casa' | 'diner' | 'alcaldia' | 'residencia' | 'bolsa' | 'parque' | 'plaza' | 'hotel' | 'pizza' | 'bar';

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

/** Ruta por las aceras: horizontal por la calle de origen, luego vertical por la avenida de destino. */
export function route(from: Place, to: Place): { x: number; y: number }[] {
  const a = placeDoor(from);
  const b = placeDoor(to);
  const ea = placeEntrance(from);
  const eb = placeEntrance(to);
  return [
    { x: ea.x, y: ea.y },
    { x: a.x, y: a.y },
    { x: b.x, y: a.y },
    { x: b.x, y: b.y },
    { x: eb.x, y: eb.y },
  ];
}

export interface CityMapArt {
  base: HTMLCanvasElement;
  lights: HTMLCanvasElement;
  neon: HTMLCanvasElement;
  snow: HTMLCanvasElement;
  lamps: { x: number; y: number }[];
}

type Ctx = CanvasRenderingContext2D;

function canvas() {
  const c = document.createElement('canvas');
  c.width = MAP_W;
  c.height = MAP_H;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
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
  /** Elementos con volumen: se dibujan de atrás (norte) hacia delante (sur). */
  queue: { key: number; draw: () => void }[];
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
    const door = x + Math.floor(rand() * (w - 4)) + 1;
    rect(base, door, sy + 1, 3, 3, '#3a2a20');
    rect(snow, x, sy, w, 1, 'rgba(245,250,255,0.9)');
  }
  rect(base, x, y + h, w, 1, 'rgba(10,8,20,0.5)');
}

/** Edificio completo: huella (x, y, w, d) en el suelo y altura H. */
function building(a: Art, x: number, y: number, w: number, d: number, H: number, opts: FacadeOpts & { roof?: string; facadeColor?: string; tower?: boolean; laundry?: boolean } = {}) {
  const roofColor = opts.roof ?? ROOFS[Math.floor(a.rand() * ROOFS.length)];
  const fc = opts.facadeColor ?? FACADES[Math.floor(a.rand() * FACADES.length)];
  later(a, y + d, () => {
    // sombra hacia el este sobre el suelo
    a.base.fillStyle = 'rgba(10, 8, 20, 0.35)';
    a.base.fillRect(x + w, y + d - Math.min(H, d), Math.min(4, Math.ceil(H / 3)), Math.min(H, d));
    roof(a, x, y - H, w, d, roofColor, { tower: opts.tower, laundry: opts.laundry });
    facade(a, x, y + d - H, w, H, fc, opts);
  });
}

/** Divide una manzana en edificios de alturas variadas. */
function genericBlock(a: Art, c: number, r: number) {
  const x0 = blockX(c) + SIDEWALK;
  const y0 = blockY(r) + SIDEWALK;
  const w0 = BLOCK_W - SIDEWALK * 2;
  const h0 = BLOCK_H - SIDEWALK * 2;
  // dos filas de parcelas: la de atrás (norte) y la de delante (sur, con tiendas)
  const backD = Math.round(h0 * (0.4 + a.rand() * 0.15));
  const rows: [number, number, boolean][] = [
    [y0, backD, false],
    [y0 + backD, h0 - backD, true],
  ];
  for (const [ry, rd, front] of rows) {
    let x = x0;
    while (x < x0 + w0 - 4) {
      const lw = Math.min(x0 + w0 - x, 12 + Math.floor(a.rand() * 18));
      const finalW = x0 + w0 - (x + lw) < 10 ? x0 + w0 - x : lw;
      const H = 6 + Math.floor(a.rand() * 9);
      building(a, x, ry, finalW, rd, H, { shop: front, fireEscape: a.rand() < 0.35, win: a.rand() < 0.3 ? 3 : 2, laundry: a.rand() < 0.25 });
      x += finalW;
    }
  }
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
// Calles
// --------------------------------------------------------------------------

function streets(a: Art, lamps: { x: number; y: number }[]) {
  const { base, snow } = a;
  rect(base, 0, 0, MAP_W, MAP_H, '#38363c');
  for (let i = 0; i < 2600; i++) rect(base, a.rand() * MAP_W, a.rand() * MAP_H, 1, 1, a.rand() < 0.5 ? '#302e34' : '#413f46');
  for (let i = 0; i <= COLS; i++) {
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
      // boca de incendios y cubo de basura
      if (a.rand() < 0.5) later(a, y + BLOCK_H - 1, () => rect(base, x + 20 + a.rand() * 40, y + BLOCK_H - 4, 2, 3, '#c0392b'));
    }
  for (let i = 0; i <= COLS; i++)
    for (let j = 0; j <= ROWS; j++) {
      const cx = aveX(i), cy = stY(j);
      rect(base, cx - AVE_W / 2, cy - ST_H / 2, AVE_W, ST_H, '#3c3a40');
      for (let k = -AVE_W / 2 + 2; k < AVE_W / 2 - 1; k += 3) {
        rect(base, cx + k, cy - ST_H / 2, 2, 2, '#e8e4d8');
        rect(base, cx + k, cy + ST_H / 2 - 2, 2, 2, '#e8e4d8');
      }
      if (a.rand() < 0.4) rect(base, cx - 3 + a.rand() * 6, cy - 2 + a.rand() * 4, 3, 2, '#252427');
    }
  for (let i = 0; i <= COLS; i++) {
    rect(snow, aveX(i) - AVE_W / 2, 0, 2, MAP_H, 'rgba(235,242,252,0.8)');
    rect(snow, aveX(i) + AVE_W / 2 - 2, 0, 2, MAP_H, 'rgba(235,242,252,0.8)');
  }
}

export function generateCityMap(seed = 1985): CityMapArt {
  const rand = mulberry32(seed);
  const b = canvas(), l = canvas(), n = canvas(), s = canvas();
  const a: Art = { base: b.ctx, lights: l.ctx, neon: n.ctx, snow: s.ctx, rand, queue: [] };
  const lamps: { x: number; y: number }[] = [];
  streets(a, lamps);

  const special = new Set<string>();
  for (const p of PLACES_MAP)
    for (let c = p.c; c < p.c + (p.cw ?? 1); c++) for (let r = p.r; r < p.r + (p.rh ?? 1); r++) special.add(`${c},${r}`);
  for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) if (!special.has(`${c},${r}`)) genericBlock(a, c, r);

  for (const p of PLACES_MAP) {
    if (p.id === 'parque') park(a, p);
    else if (p.id === 'alcaldia') cityHall(a, p);
    else if (p.id === 'residencia') residence(a, p);
    else if (p.id === 'diner') diner(a, p);
    else if (p.id === 'casa') tenement(a, p);
    else if (p.id === 'bolsa') exchange(a, p);
    else if (p.id === 'plaza') timesSquare(a, p);
    else if (p.id === 'hotel') signBlock(a, p, 'HOTEL', '#ff5ac8', '255,90,200', true);
    else if (p.id === 'pizza') signBlock(a, p, 'PIZZA', '#ffb13b', '255,177,59');
    else if (p.id === 'bar') signBlock(a, p, 'BAR', '#7dff6a', '125,255,106');
  }
  // De atrás hacia delante: lo que está más al sur tapa lo de detrás.
  a.queue.sort((p, q) => p.key - q.key).forEach((d) => d.draw());
  for (const lp of lamps) glow(a.lights, lp.x, lp.y - 4, 10, '255,206,120', 0.4);
  return { base: b.c, lights: l.c, neon: n.c, snow: s.c, lamps };
}
