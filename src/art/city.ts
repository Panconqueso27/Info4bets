import { mulberry32 } from '../core/rng';
import type { Role } from '../core/types';
import { shade } from './character';
import { drawText, drawTextVertical, textWidth } from './pixelfont';

/**
 * La ciudad (única, compartida por ambos personajes), dibujada en pixel art
 * por código. Estética Nueva York años 80: ladrillo, escaleras de incendio,
 * depósitos de agua, neones y taxis amarillos.
 *
 * Se generan capas separadas para que el ciclo día/noche las trate distinto:
 * - base: edificios y calle (se tiñen con la luz ambiente)
 * - lights: ventanas encendidas y farolas (aparecen de noche)
 * - neon: letreros (brillan siempre, más de noche)
 */
export const WORLD_W = 720;
export const WORLD_H = 320;
/** Altura de la acera, donde pisan los personajes. */
export const GROUND_Y = 256;
const SIDEWALK_Y = 250;
const ROAD_Y = 262;

export const PLACES: Record<Role, { home: number; work: number; homeLabel: string; workLabel: string }> = {
  inmigrante: { home: 34, work: 155, homeLabel: 'Tu edificio', workLabel: 'Diner' },
  alcalde: { home: 606, work: 364, homeLabel: 'Residencia oficial', workLabel: 'Alcaldía' },
};

export const LAMP_XS = [96, 206, 296, 436, 546, 666];

export interface CityArt {
  base: HTMLCanvasElement;
  lights: HTMLCanvasElement;
  neon: HTMLCanvasElement;
  far: HTMLCanvasElement;
  farLights: HTMLCanvasElement;
}

function canvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  return { c, ctx };
}

type Ctx = CanvasRenderingContext2D;

function rect(ctx: Ctx, x: number, y: number, w: number, h: number, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

const WARM = ['#ffd27a', '#ffc85e', '#ffe2a0', '#f9b85a'];
const TV = '#8fc8ff';

/** Rejilla de ventanas. Algunas quedan encendidas de noche en la capa de luces. */
function windows(
  ctx: Ctx, lights: Ctx, rand: () => number,
  x: number, y: number, cols: number, rows: number,
  o: { w?: number; h?: number; gx?: number; gy?: number; frame?: string; glass?: string; lit?: number; sill?: string },
) {
  const w = o.w ?? 4, h = o.h ?? 6, gx = o.gx ?? 4, gy = o.gy ?? 5;
  const glass = o.glass ?? '#2c3446';
  const frame = o.frame;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const wx = x + c * (w + gx);
      const wy = y + r * (h + gy);
      if (frame) rect(ctx, wx - 1, wy - 1, w + 2, h + 2, frame);
      rect(ctx, wx, wy, w, h, glass);
      rect(ctx, wx, wy, w, 1, shade(glass, 0.25));
      if (o.sill) rect(ctx, wx - 1, wy + h + 1, w + 2, 1, o.sill);
      if (rand() < (o.lit ?? 0.45)) {
        const col = rand() < 0.12 ? TV : WARM[Math.floor(rand() * WARM.length)];
        rect(lights, wx, wy, w, h, col);
        if (rand() < 0.4) rect(lights, wx, wy + Math.floor(h / 2), w, 1, shade(col, -0.25));
      }
    }
  }
}

function bricks(ctx: Ctx, rand: () => number, x: number, y: number, w: number, h: number, color: string) {
  rect(ctx, x, y, w, h, color);
  const dark = shade(color, -0.12);
  const light = shade(color, 0.08);
  for (let yy = y + 2; yy < y + h; yy += 3) {
    for (let xx = x + ((yy / 3) % 2 ? 0 : 2); xx < x + w; xx += 4) {
      if (rand() < 0.5) rect(ctx, xx, yy, 1, 1, dark);
      else if (rand() < 0.15) rect(ctx, xx, yy, 2, 1, light);
    }
  }
}

function cornice(ctx: Ctx, x: number, y: number, w: number, color: string) {
  rect(ctx, x - 1, y, w + 2, 2, color);
  rect(ctx, x - 1, y + 2, w + 2, 1, shade(color, -0.35));
  for (let i = x; i < x + w; i += 3) rect(ctx, i, y + 3, 1, 1, shade(color, -0.2));
}

function fireEscape(ctx: Ctx, x: number, top: number, w: number, floors: number, floorH: number) {
  const iron = '#1b1b20';
  for (let f = 0; f < floors; f++) {
    const y = top + f * floorH + floorH - 3;
    rect(ctx, x, y, w, 1, iron);
    for (let i = x; i < x + w; i += 2) rect(ctx, i, y - 3, 1, 3, iron);
    rect(ctx, x, y - 3, w, 1, iron);
    // escalera en diagonal hacia el piso de abajo
    if (f < floors - 1) {
      for (let s = 0; s < floorH; s++) {
        const sx = f % 2 ? x + 2 + Math.floor((s * (w - 6)) / floorH) : x + w - 4 - Math.floor((s * (w - 6)) / floorH);
        rect(ctx, sx, y + s, 2, 1, iron);
      }
    }
  }
}

function waterTower(ctx: Ctx, x: number, baseY: number) {
  const wood = '#7a5232';
  rect(ctx, x + 1, baseY - 6, 1, 6, '#222');
  rect(ctx, x + 10, baseY - 6, 1, 6, '#222');
  rect(ctx, x + 5, baseY - 6, 1, 6, '#222');
  rect(ctx, x, baseY - 7, 12, 1, '#222');
  rect(ctx, x, baseY - 19, 12, 12, wood);
  for (let i = 0; i < 12; i += 2) rect(ctx, x + i, baseY - 19, 1, 12, shade(wood, -0.15));
  rect(ctx, x, baseY - 15, 12, 1, '#222');
  rect(ctx, x, baseY - 10, 12, 1, '#222');
  rect(ctx, x - 1, baseY - 21, 14, 2, '#4a3524');
  rect(ctx, x + 1, baseY - 23, 10, 2, '#4a3524');
  rect(ctx, x + 3, baseY - 25, 6, 2, '#4a3524');
}

function stoop(ctx: Ctx, x: number, w: number, color: string) {
  for (let s = 0; s < 4; s++) rect(ctx, x - s, SIDEWALK_Y - 3 - s * 2 + 2, w + s * 2, 2, shade(color, -0.05 * s));
}

function door(ctx: Ctx, x: number, y: number, w: number, h: number, color: string) {
  rect(ctx, x - 1, y - 1, w + 2, h + 1, shade(color, -0.4));
  rect(ctx, x, y, w, h, color);
  rect(ctx, x + 1, y + 2, w - 2, Math.floor(h / 3), '#2c3446');
  rect(ctx, x + w - 2, y + Math.floor(h / 2), 1, 1, '#d4af37');
}

function lampPost(ctx: Ctx, lights: Ctx, x: number) {
  const pole = '#2e3b33';
  rect(ctx, x, SIDEWALK_Y - 34, 2, 34, pole);
  rect(ctx, x - 1, SIDEWALK_Y - 2, 4, 2, pole);
  rect(ctx, x - 4, SIDEWALK_Y - 35, 10, 2, pole);
  rect(ctx, x - 5, SIDEWALK_Y - 33, 4, 2, '#d9d2b8');
  // halo y cono de luz
  lights.fillStyle = 'rgba(255, 214, 120, 0.9)';
  lights.fillRect(x - 5, SIDEWALK_Y - 33, 4, 2);
  for (let i = 0; i < 30; i++) {
    const spread = Math.floor(i / 3);
    lights.fillStyle = `rgba(255, 210, 120, ${0.18 - i * 0.004})`;
    lights.fillRect(x - 3 - spread, SIDEWALK_Y - 31 + i, 2 + spread * 2, 1);
  }
  lights.fillStyle = 'rgba(255, 210, 120, 0.15)';
  lights.fillRect(x - 14, SIDEWALK_Y, 28, 6);
}

function neonText(neon: Ctx, text: string, x: number, y: number, color: string, vertical = false) {
  const glow = color + '55';
  const draw = vertical ? drawTextVertical : drawText;
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) draw(neon, text, x + dx, y + dy, glow);
  draw(neon, text, x, y, color);
}

export function generateCity(seed = 1984): CityArt {
  const rand = mulberry32(seed);
  const { c: base, ctx } = canvas(WORLD_W, WORLD_H);
  const { c: lightsC, ctx: lights } = canvas(WORLD_W, WORLD_H);
  const { c: neonC, ctx: neon } = canvas(WORLD_W, WORLD_H);

  // ---------- Edificios del fondo (detrás de la fila principal)
  const backRow: Array<[number, number, number, string]> = [
    [100, 20, 170, '#5d5868'], [176, 40, 172, '#545a6e'], [250, 36, 150, '#655853'],
    [404, 36, 190, '#4d5468'], [520, 44, 170, '#5d5359'], [640, 50, 160, '#575d6e'],
  ];
  for (const [x, w, h, col] of backRow) {
    rect(ctx, x, SIDEWALK_Y - h, w, h, col);
    windows(ctx, lights, rand, x + 3, SIDEWALK_Y - h + 5, Math.floor((w - 4) / 6), Math.floor((h - 60) / 8), { w: 3, h: 4, gx: 3, gy: 4, glass: shade(col, -0.35), lit: 0.3 });
  }

  // ---------- 1. Edificio del inmigrante (ladrillo, escalera de incendio)
  bricks(ctx, rand, 0, SIDEWALK_Y - 132, 72, 132, '#8e3b2e');
  cornice(ctx, 0, SIDEWALK_Y - 134, 72, '#b39a7a');
  windows(ctx, lights, rand, 6, SIDEWALK_Y - 124, 5, 6, { w: 6, h: 9, gx: 7, gy: 9, frame: '#d9cdb4', sill: '#c8b896', lit: 0.5 });
  fireEscape(ctx, 18, SIDEWALK_Y - 128, 36, 6, 18);
  rect(ctx, 0, SIDEWALK_Y - 22, 72, 22, '#6e2c22');
  door(ctx, 29, SIDEWALK_Y - 19, 12, 17, '#3a2a20');
  stoop(ctx, 27, 16, '#9b9187');
  rect(lights, 30, SIDEWALK_Y - 23, 10, 2, '#ffd27a');

  // ---------- 2. Edificio de piedra con depósito de agua
  rect(ctx, 72, SIDEWALK_Y - 150, 40, 150, '#b9a68a');
  for (let y = SIDEWALK_Y - 150; y < SIDEWALK_Y; y += 10) rect(ctx, 72, y, 40, 1, '#a8957a');
  cornice(ctx, 72, SIDEWALK_Y - 152, 40, '#8f7d64');
  waterTower(ctx, 86, SIDEWALK_Y - 152);
  windows(ctx, lights, rand, 77, SIDEWALK_Y - 142, 3, 9, { w: 6, h: 8, gx: 6, gy: 6, frame: '#7d6c55', lit: 0.4 });
  rect(ctx, 72, SIDEWALK_Y - 18, 40, 18, '#4a4038');
  rect(ctx, 76, SIDEWALK_Y - 15, 32, 12, '#2c3446');
  rect(lights, 76, SIDEWALK_Y - 15, 32, 12, '#e8c070');
  rect(ctx, 74, SIDEWALK_Y - 20, 36, 3, '#2e6b46');

  // ---------- 3. Diner (trabajo del inmigrante)
  const dx = 116, dw = 86, dy = SIDEWALK_Y - 38;
  rect(ctx, dx, dy, dw, 38, '#c9ccd3');
  for (let x = dx; x < dx + dw; x += 3) rect(ctx, x, dy, 1, 38, '#b8bbc3');
  rect(ctx, dx, dy + 6, dw, 3, '#c0392b');
  rect(ctx, dx, dy + 30, dw, 3, '#c0392b');
  rect(ctx, dx - 2, dy - 2, dw + 4, 3, '#8d9099');
  for (let i = 0; i < 6; i++) {
    const wx = dx + 4 + i * 13;
    if (wx > dx + 32 && wx < dx + 48) continue;
    rect(ctx, wx, dy + 12, 10, 14, '#4f86a8');
    rect(ctx, wx, dy + 12, 10, 1, '#9cc6de');
    rect(lights, wx, dy + 12, 10, 14, '#ffe7a8');
  }
  door(ctx, dx + 34, dy + 11, 12, 25, '#8d1f1f');
  rect(lights, dx + 35, dy + 13, 10, 8, '#ffe7a8');
  // letrero sobre el tejado
  rect(ctx, dx + 16, dy - 16, 54, 13, '#1d1d24');
  rect(ctx, dx + 30, dy - 3, 2, 3, '#1d1d24');
  rect(ctx, dx + 54, dy - 3, 2, 3, '#1d1d24');
  neonText(neon, 'DINER', dx + 43 - Math.floor(textWidth('DINER') / 2), dy - 12, '#ff4f6d');
  neonText(neon, 'OPEN', dx + 4, dy + 1, '#5cf0ff');

  // ---------- 4. Brownstone
  rect(ctx, 206, SIDEWALK_Y - 112, 56, 112, '#6b4a3a');
  for (let y = SIDEWALK_Y - 112; y < SIDEWALK_Y; y += 7) rect(ctx, 206, y, 56, 1, '#5e4032');
  cornice(ctx, 206, SIDEWALK_Y - 114, 56, '#4a3328');
  rect(ctx, 214, SIDEWALK_Y - 100, 16, 70, '#5e4032'); // bay window
  windows(ctx, lights, rand, 217, SIDEWALK_Y - 96, 1, 4, { w: 10, h: 10, gy: 7, frame: '#d4c4a4', lit: 0.5 });
  windows(ctx, lights, rand, 238, SIDEWALK_Y - 96, 2, 4, { w: 6, h: 10, gx: 6, gy: 7, frame: '#d4c4a4', lit: 0.45 });
  door(ctx, 238, SIDEWALK_Y - 24, 10, 16, '#2e1d14');
  stoop(ctx, 236, 14, '#7d5b49');

  // ---------- 5. Pizzería
  rect(ctx, 262, SIDEWALK_Y - 126, 38, 126, '#4f5d6e');
  cornice(ctx, 262, SIDEWALK_Y - 128, 38, '#3a4552');
  windows(ctx, lights, rand, 267, SIDEWALK_Y - 118, 3, 7, { w: 5, h: 7, gx: 5, gy: 7, frame: '#2e3743', lit: 0.4 });
  rect(ctx, 262, SIDEWALK_Y - 22, 38, 22, '#3a3030');
  rect(ctx, 266, SIDEWALK_Y - 17, 30, 14, '#2c3446');
  rect(lights, 266, SIDEWALK_Y - 17, 30, 14, '#ffcf80');
  for (let i = 0; i < 40; i += 4) {
    rect(ctx, 260 + i, SIDEWALK_Y - 26, 2, 5, '#2e8b57');
    rect(ctx, 262 + i, SIDEWALK_Y - 26, 2, 5, '#efeae0');
  }
  neonText(neon, 'PIZZA', 271, SIDEWALK_Y - 34, '#ffb13b');

  // ---------- 6. Alcaldía (trabajo del alcalde)
  const hx = 300, hw = 128;
  for (let s = 0; s < 5; s++) rect(ctx, hx + 4 - s * 2, SIDEWALK_Y - 14 + s * 3, hw - 8 + s * 4, 3, shade('#cfc8b8', -0.04 * s));
  rect(ctx, hx + 8, SIDEWALK_Y - 80, hw - 16, 66, '#ddd6c6');
  rect(ctx, hx + 8, SIDEWALK_Y - 80, hw - 16, 4, '#c8c0ae');
  for (let i = 0; i < 6; i++) {
    const cx = hx + 16 + i * 18;
    rect(ctx, cx, SIDEWALK_Y - 72, 6, 58, '#efe9dc');
    rect(ctx, cx + 4, SIDEWALK_Y - 72, 2, 58, '#cfc7b6');
    rect(ctx, cx - 1, SIDEWALK_Y - 74, 8, 2, '#bdb5a3');
    if (i < 5) {
      rect(ctx, cx + 9, SIDEWALK_Y - 64, 6, 12, '#2c3446');
      rect(ctx, cx + 9, SIDEWALK_Y - 42, 6, 12, '#2c3446');
      rect(lights, cx + 9, SIDEWALK_Y - 64, 6, 12, WARM[i % 4]);
      if (i !== 2) rect(lights, cx + 9, SIDEWALK_Y - 42, 6, 12, WARM[(i + 1) % 4]);
    }
  }
  door(ctx, hx + 58, SIDEWALK_Y - 34, 12, 20, '#4a2e1c');
  // frontón
  for (let r = 0; r < 18; r++) rect(ctx, hx + 6 + r * 3, SIDEWALK_Y - 82 - r, hw - 12 - r * 6, 1, r === 0 ? '#bdb5a3' : '#e6dfd0');
  drawText(ctx, 'ALCALDIA', hx + hw / 2 - Math.floor(textWidth('ALCALDIA') / 2), SIDEWALK_Y - 92, '#6d6656');
  // cúpula y bandera
  rect(ctx, hx + 50, SIDEWALK_Y - 130, 28, 32, '#e6dfd0');
  for (let i = 0; i < 3; i++) rect(ctx, hx + 54 + i * 8, SIDEWALK_Y - 124, 4, 10, '#2c3446');
  for (let i = 0; i < 3; i++) rect(lights, hx + 54 + i * 8, SIDEWALK_Y - 124, 4, 10, '#ffd27a');
  for (let r = 0; r < 10; r++) rect(ctx, hx + 52 + Math.floor(r * 1.2), SIDEWALK_Y - 132 - r, 24 - Math.floor(r * 2.4), 1, r > 6 ? '#b9a26a' : '#c9b47c');
  rect(ctx, hx + 63, SIDEWALK_Y - 160, 1, 20, '#333');
  rect(ctx, hx + 64, SIDEWALK_Y - 160, 10, 6, '#2f6fb3');
  rect(ctx, hx + 64, SIDEWALK_Y - 157, 10, 1, '#efe9dc');
  rect(ctx, hx + 64, SIDEWALK_Y - 155, 10, 1, '#c0392b');

  // ---------- 7. Torre de oficinas
  rect(ctx, 428, SIDEWALK_Y - 200, 52, 200, '#3d5a78');
  for (let x = 428; x < 480; x += 6) rect(ctx, x, SIDEWALK_Y - 200, 1, 200, '#2c4560');
  for (let y = SIDEWALK_Y - 200; y < SIDEWALK_Y - 20; y += 7) {
    rect(ctx, 428, y, 52, 1, '#2c4560');
    for (let x = 429; x < 480; x += 6) if (rand() < 0.35) rect(lights, x, y + 1, 5, 6, rand() < 0.5 ? '#fff0c0' : '#e8f4ff');
  }
  rect(ctx, 446, SIDEWALK_Y - 214, 16, 14, '#2c4560');
  rect(ctx, 453, SIDEWALK_Y - 226, 2, 12, '#222');
  rect(lights, 453, SIDEWALK_Y - 227, 2, 2, '#ff4040');
  rect(ctx, 428, SIDEWALK_Y - 20, 52, 20, '#26384c');
  rect(ctx, 446, SIDEWALK_Y - 16, 16, 16, '#9cc6de');
  rect(lights, 446, SIDEWALK_Y - 16, 16, 16, '#f0f4ff');

  // ---------- 8. Hotel
  bricks(ctx, rand, 480, SIDEWALK_Y - 160, 60, 160, '#7a5a3a');
  cornice(ctx, 480, SIDEWALK_Y - 162, 60, '#5e4430');
  windows(ctx, lights, rand, 486, SIDEWALK_Y - 152, 4, 10, { w: 6, h: 7, gx: 6, gy: 6, frame: '#c8b896', lit: 0.5 });
  rect(ctx, 480, SIDEWALK_Y - 24, 60, 24, '#4a3324');
  rect(ctx, 490, SIDEWALK_Y - 28, 40, 4, '#8d1f1f');
  door(ctx, 504, SIDEWALK_Y - 20, 12, 18, '#d4af37');
  rect(ctx, 532, SIDEWALK_Y - 132, 9, 36, '#1d1d24');
  neonText(neon, 'HOTEL', 535, SIDEWALK_Y - 129, '#ff5ac8', true);

  // ---------- 9. Residencia oficial del alcalde
  const rx = 548, rw = 116;
  // árboles
  for (const tx of [rx + 2, rx + rw - 22]) {
    rect(ctx, tx + 9, SIDEWALK_Y - 24, 3, 24, '#4a3020');
    for (let r = 0; r < 18; r++) {
      const w = 22 - Math.abs(r - 9) * 2;
      rect(ctx, tx + 11 - w / 2, SIDEWALK_Y - 48 + r, w, 1, r % 3 ? '#3f7a3a' : '#356a31');
    }
  }
  rect(ctx, rx + 22, SIDEWALK_Y - 54, rw - 44, 48, '#e8dcc0');
  for (let y = SIDEWALK_Y - 54; y < SIDEWALK_Y - 6; y += 3) rect(ctx, rx + 22, y, rw - 44, 1, '#d6c9aa');
  for (let r = 0; r < 14; r++) rect(ctx, rx + 18 + r * 2, SIDEWALK_Y - 55 - r, rw - 36 - r * 4, 1, '#3c4f3a');
  rect(ctx, rx + 52, SIDEWALK_Y - 74, 4, 10, '#7a3a2a');
  windows(ctx, lights, rand, rx + 28, SIDEWALK_Y - 48, 5, 2, { w: 6, h: 9, gx: 8, gy: 8, frame: '#ffffff', glass: '#2c3446', lit: 0.7 });
  rect(ctx, rx + 46, SIDEWALK_Y - 24, 26, 2, '#ffffff');
  for (let i = 0; i < 4; i++) rect(ctx, rx + 46 + i * 8, SIDEWALK_Y - 22, 2, 16, '#ffffff');
  door(ctx, rx + 53, SIDEWALK_Y - 20, 10, 14, '#2f4f6e');
  // reja
  rect(ctx, rx, SIDEWALK_Y - 12, rw, 1, '#151518');
  for (let x = rx; x < rx + rw; x += 3) {
    if (x > rx + 50 && x < rx + 66) continue;
    rect(ctx, x, SIDEWALK_Y - 14, 1, 14, '#151518');
  }
  rect(ctx, rx, SIDEWALK_Y - 6, rw, 6, '#4a7a3e');

  // ---------- 10. Ladrillo oscuro
  bricks(ctx, rand, 664, SIDEWALK_Y - 140, 56, 140, '#5d3b33');
  cornice(ctx, 664, SIDEWALK_Y - 142, 56, '#8a7560');
  windows(ctx, lights, rand, 670, SIDEWALK_Y - 132, 4, 8, { w: 6, h: 8, gx: 6, gy: 7, frame: '#cbbd9f', lit: 0.45 });
  fireEscape(ctx, 678, SIDEWALK_Y - 136, 30, 7, 15);
  neonText(neon, 'BAR', 678, SIDEWALK_Y - 14, '#7dff6a');

  // ---------- Calle
  rect(ctx, 0, SIDEWALK_Y, WORLD_W, ROAD_Y - SIDEWALK_Y, '#8d8a86');
  rect(ctx, 0, SIDEWALK_Y, WORLD_W, 1, '#a3a09b');
  for (let x = 0; x < WORLD_W; x += 16) rect(ctx, x, SIDEWALK_Y + 1, 1, ROAD_Y - SIDEWALK_Y - 1, '#7c7975');
  rect(ctx, 0, ROAD_Y - 1, WORLD_W, 2, '#5a5856');
  rect(ctx, 0, ROAD_Y + 1, WORLD_W, 30, '#38363a');
  for (let x = 4; x < WORLD_W; x += 20) rect(ctx, x, ROAD_Y + 15, 10, 1, '#d8b23a');
  for (let i = 0; i < 260; i++) rect(ctx, Math.floor(rand() * WORLD_W), ROAD_Y + 2 + Math.floor(rand() * 28), 1, 1, '#2f2d31');
  for (const mx of [140, 410, 600]) {
    rect(ctx, mx, ROAD_Y + 8, 8, 3, '#252427');
    rect(ctx, mx + 1, ROAD_Y + 9, 6, 1, '#3f3d42');
  }
  rect(ctx, 0, ROAD_Y + 31, WORLD_W, 3, '#5a5856');
  rect(ctx, 0, ROAD_Y + 34, WORLD_W, WORLD_H - ROAD_Y - 34, '#7a7773');

  // ---------- Mobiliario urbano
  for (const x of LAMP_XS) lampPost(ctx, lights, x);
  // boca de incendios, cubos, kiosco de prensa
  for (const x of [60, 390, 700]) {
    rect(ctx, x, SIDEWALK_Y - 6, 4, 6, '#c0392b');
    rect(ctx, x - 1, SIDEWALK_Y - 4, 6, 1, '#962d22');
    rect(ctx, x + 1, SIDEWALK_Y - 7, 2, 1, '#962d22');
  }
  for (const x of [112, 258, 540]) {
    rect(ctx, x, SIDEWALK_Y - 8, 6, 8, '#6e7378');
    rect(ctx, x - 1, SIDEWALK_Y - 9, 8, 2, '#868b90');
  }
  rect(ctx, 228, SIDEWALK_Y - 9, 6, 9, '#2f6fb3');
  rect(ctx, 229, SIDEWALK_Y - 7, 4, 3, '#d9d4c5');

  // ---------- Skyline lejano (parallax)
  const { c: far, ctx: f } = canvas(420, WORLD_H);
  const { c: farLights, ctx: fl } = canvas(420, WORLD_H);
  const farCol = '#7d8aaa';
  const skyline: Array<[number, number, number]> = [
    [0, 26, 80], [24, 30, 104], [52, 22, 74], [72, 34, 128], [104, 20, 90], [122, 28, 110],
    [178, 22, 84], [198, 30, 96], [226, 24, 120], [274, 26, 88], [298, 36, 104], [332, 24, 80],
    [354, 30, 116], [382, 38, 96],
  ];
  for (const [x, w, h] of skyline) {
    rect(f, x, SIDEWALK_Y - h, w, h, farCol);
    rect(f, x + w - 2, SIDEWALK_Y - h, 2, h, shade(farCol, -0.1));
    for (let y = SIDEWALK_Y - h + 4; y < SIDEWALK_Y - 10; y += 5)
      for (let xx = x + 2; xx < x + w - 2; xx += 3) if (rand() < 0.22) rect(fl, xx, y, 1, 2, rand() < 0.8 ? '#ffd88a' : '#cfe6ff');
  }
  // Torre con aguja (tipo Empire State)
  rect(f, 140, SIDEWALK_Y - 150, 30, 150, farCol);
  rect(f, 146, SIDEWALK_Y - 168, 18, 18, farCol);
  rect(f, 150, SIDEWALK_Y - 180, 10, 12, farCol);
  rect(f, 154, SIDEWALK_Y - 198, 2, 18, farCol);
  rect(fl, 154, SIDEWALK_Y - 199, 2, 2, '#ff4040');
  for (let y = SIDEWALK_Y - 146; y < SIDEWALK_Y - 10; y += 6)
    for (let xx = 142; xx < 168; xx += 4) if (rand() < 0.3) rect(fl, xx, y, 2, 2, '#ffd88a');
  // Torres gemelas
  for (const tx of [246, 262]) {
    rect(f, tx, SIDEWALK_Y - 176, 13, 176, shade(farCol, 0.04));
    for (let xx = tx + 1; xx < tx + 13; xx += 2) rect(f, xx, SIDEWALK_Y - 176, 1, 176, shade(farCol, -0.05));
    for (let y = SIDEWALK_Y - 170; y < SIDEWALK_Y - 10; y += 4)
      for (let xx = tx + 1; xx < tx + 12; xx += 2) if (rand() < 0.18) rect(fl, xx, y, 1, 2, '#fff0c0');
  }
  rect(f, 252, SIDEWALK_Y - 192, 1, 16, farCol);
  rect(fl, 252, SIDEWALK_Y - 193, 1, 1, '#ff4040');
  // Corona escalonada (tipo Chrysler)
  rect(f, 316, SIDEWALK_Y - 136, 22, 136, farCol);
  for (let r = 0; r < 5; r++) {
    const w = 18 - r * 4;
    rect(f, 327 - w / 2, SIDEWALK_Y - 142 - r * 6, w, 6, shade(farCol, 0.1));
    for (let xx = 327 - w / 2 + 1; xx < 327 + w / 2 - 1; xx += 3) rect(fl, xx, SIDEWALK_Y - 140 - r * 6, 1, 2, '#ffe6a0');
  }
  rect(f, 326, SIDEWALK_Y - 178, 2, 12, farCol);

  return { base, lights: lightsC, neon: neonC, far, farLights };
}

/** Taxi amarillo de los 80 (24x11). */
export function drawTaxi(ctx: Ctx, color = '#f2c230') {
  rect(ctx, 1, 4, 22, 5, color);
  rect(ctx, 5, 0, 13, 5, color);
  rect(ctx, 6, 1, 5, 3, '#2c3446');
  rect(ctx, 12, 1, 5, 3, '#2c3446');
  rect(ctx, 9, -1 + 1, 5, 1, '#f7f2d8');
  for (let x = 2; x < 22; x += 2) rect(ctx, x, 6, 1, 1, '#1d1d24');
  rect(ctx, 0, 7, 24, 1, shade(color, -0.35));
  rect(ctx, 3, 8, 4, 3, '#151518');
  rect(ctx, 17, 8, 4, 3, '#151518');
  rect(ctx, 4, 9, 2, 1, '#888');
  rect(ctx, 18, 9, 2, 1, '#888');
  rect(ctx, 22, 4, 2, 2, '#fff4c0');
  rect(ctx, 0, 4, 1, 2, '#c0392b');
}
