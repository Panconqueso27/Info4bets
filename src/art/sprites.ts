import type { Look } from '../core/types';
import { shade } from './character';

/**
 * Sprites a escala del mapa (vista inclinada 3/4).
 * Personaje faceless de 7x11: pelo, cara sin rasgos, ropa y piernas.
 */
export const MINI_W = 7;
export const MINI_H = 11;

type Px = (x: number, y: number, w: number, h: number, c: string) => void;

const PANTS: Record<string, string> = {
  obrero: 'P', camarero: '#22222a', chaqueta: '#3b5b8c', sudadera: '#4a4a52',
  traje: 'P', cruzado: 'P', gabardina: '#2a2a33', chaleco: '#3a3a44',
  cuero: '#3b5b8c', domingo: '#5a3e24', esmoquin: '#111116', jogging: 'P',
};
/** Color del cuerpo de la ropa desbloqueable (fijo, no depende del color elegido). */
const BODY: Record<string, string> = { cuero: '#1c1a20', domingo: '#6b4a2b', esmoquin: '#111116' };

/** frame 0 = quieto, 1 y 2 = pasos. back = de espaldas (camina hacia el norte). */
export function drawMini(ctx: CanvasRenderingContext2D, look: Look, frame: number, ox: number, oy: number, back = false) {
  const px: Px = (x, y, w, h, c) => {
    ctx.fillStyle = c;
    ctx.fillRect(ox + x, oy + y, w, h);
  };
  const P = BODY[look.outfit] ?? look.outfitColor;
  const pants = PANTS[look.outfit] === 'P' ? P : PANTS[look.outfit] ?? '#2a2a33';
  const H = look.hairColor;
  const bob = frame === 0 ? 0 : 1;
  // sombra
  px(1, 10, 5, 1, 'rgba(0,0,0,0.35)');
  // piernas
  px(2, 8, 1, frame === 1 ? 1 : 2, pants);
  px(4, 8, 1, frame === 2 ? 1 : 2, pants);
  // cuerpo
  px(1, 4 + bob, 5, 4, P);
  px(5, 4 + bob, 1, 4, shade(P, -0.3));
  if (look.outfit === 'esmoquin' || look.outfit === 'cuero') px(3, 4 + bob, 1, 3, look.outfit === 'esmoquin' ? '#ffffff' : '#efe9dc');
  if (look.outfit === 'jogging') {
    px(1, 5 + bob, 5, 1, '#f1ede3');
  }
  if (look.outfit === 'traje' || look.outfit === 'cruzado' || look.outfit === 'domingo') {
    px(3, 4 + bob, 1, 2, '#f1ede3');
    if (!back) px(3, 5 + bob, 1, 2, '#a3242b');
  }
  if (look.outfit === 'gabardina') px(1, 7 + bob, 5, 2, P);
  // brazos
  px(0, 5 + bob + (frame === 1 ? 1 : 0), 1, 2, look.skin);
  px(6, 5 + bob + (frame === 2 ? 1 : 0), 1, 2, look.skin);
  // cabeza sin rostro
  px(2, 1 + bob, 3, 3, look.skin);
  px(4, 1 + bob, 1, 3, shade(look.skin, -0.18));
  // pelo
  switch (look.hair) {
    case 'afro':
      px(1, 0 + bob, 5, 2, H);
      px(1, 2 + bob, 1, 2, H);
      px(5, 2 + bob, 1, 2, H);
      break;
    case 'largo':
      px(2, 0 + bob, 3, 1, H);
      px(1, 1 + bob, 1, 4, H);
      px(5, 1 + bob, 1, 4, H);
      break;
    case 'rapado':
      px(2, 1 + bob, 3, 1, shade(H, -0.2));
      break;
    case 'tupe':
      px(2, 0 + bob, 4, 2, H);
      break;
    case 'permanente':
      px(1, 0 + bob, 5, 2, H);
      px(1, 2 + bob, 1, 3, H);
      px(5, 2 + bob, 1, 3, H);
      break;
    case 'gorra':
      px(2, 0 + bob, 3, 2, '#c0392b');
      px(back ? 2 : 4, 1 + bob, 2, 1, '#8e1f1f');
      break;
    case 'cresta':
      px(3, -1 + bob, 1, 3, H);
      break;
    default:
      px(2, 0 + bob, 3, 2, H);
  }
  if (back && look.hair !== 'gorra') px(2, 1 + bob, 3, 3, look.hair === 'rapado' || look.hair === 'cresta' ? shade(look.skin, -0.1) : H);
  if (back && look.hair === 'cresta') px(3, -1 + bob, 1, 4, H);
  if (look.hair === 'coleta' || look.hair === 'mullet') px(back ? 3 : 5, 2 + bob, 1, 2, H);
}

export const CAR_COLORS = ['#f2c230', '#f2c230', '#f2c230', '#c0392b', '#2f6fb3', '#e8e4d8', '#3a7a4a', '#7b4fa0'];

/** Coche visto de lado (10x6), para las calles horizontales. */
export function drawCarSide(ctx: CanvasRenderingContext2D, color: string, ox: number, oy: number, police = false) {
  const px: Px = (x, y, w, h, c) => {
    ctx.fillStyle = c;
    ctx.fillRect(ox + x, oy + y, w, h);
  };
  px(0, 5, 10, 1, 'rgba(0,0,0,0.35)');
  px(0, 2, 10, 3, color);
  px(2, 0, 6, 2, color);
  px(3, 0, 2, 2, '#2c3446');
  px(6, 0, 1, 2, '#2c3446');
  px(0, 4, 10, 1, shade(color, -0.35));
  px(1, 4, 2, 2, '#151518');
  px(7, 4, 2, 2, '#151518');
  px(9, 2, 1, 1, '#fff4c0');
  px(0, 2, 1, 1, '#c0392b');
  if (color === '#f2c230') px(4, 2, 2, 1, '#1d1d24');
  if (police) {
    px(4, -1, 1, 1, '#ff3b3b');
    px(5, -1, 1, 1, '#3b7bff');
  }
}

/** Coche visto de frente/detrás (6x8), para las avenidas. */
export function drawCarFront(ctx: CanvasRenderingContext2D, color: string, ox: number, oy: number, police = false) {
  const px: Px = (x, y, w, h, c) => {
    ctx.fillStyle = c;
    ctx.fillRect(ox + x, oy + y, w, h);
  };
  px(0, 7, 6, 1, 'rgba(0,0,0,0.35)');
  px(0, 0, 6, 7, color);
  px(1, 1, 4, 2, '#2c3446');
  px(1, 3, 4, 2, shade(color, 0.15));
  px(0, 6, 6, 1, shade(color, -0.35));
  px(0, 5, 1, 1, '#fff4c0');
  px(5, 5, 1, 1, '#fff4c0');
  if (color === '#f2c230') px(2, 3, 2, 1, '#1d1d24');
  if (police) {
    px(1, 0, 2, 1, '#ff3b3b');
    px(3, 0, 2, 1, '#3b7bff');
  }
}

/** Mascota (6x5): gato atigrado o perro canelo, dos fotogramas de paso. */
export function drawPet(ctx: CanvasRenderingContext2D, kind: 'gato' | 'perro', ox: number, frame: number) {
  const body = kind === 'gato' ? '#e08a3a' : '#a8743c';
  const dark = kind === 'gato' ? '#9a5a1e' : '#6a4422';
  const px = (x: number, y: number, c: string) => {
    ctx.fillStyle = c;
    ctx.fillRect(ox + x, y, 1, 1);
  };
  // cabeza a la derecha
  for (let x = 1; x <= 4; x++) px(x, 2, body);
  for (let x = 1; x <= 4; x++) px(x, 3, body);
  px(4, 1, body);
  px(5, 1, body);
  px(5, 2, body);
  if (kind === 'gato') {
    px(4, 0, dark);
    px(5, 0, dark);
    px(0, 1, body);
    px(0, 0, body);
    px(2, 2, dark);
  } else {
    px(4, 0, dark);
    px(5, 2, '#14101f');
    px(0, 2, body);
    px(0, 1, body);
  }
  // patas
  px(frame ? 2 : 1, 4, dark);
  px(frame ? 3 : 4, 4, dark);
}

/** Máquina expendedora (4x7) para la acera. */
export function drawVending(ctx: CanvasRenderingContext2D, ox: number, oy: number) {
  ctx.fillStyle = '#c0392b';
  ctx.fillRect(ox, oy, 4, 7);
  ctx.fillStyle = '#9fd3ff';
  ctx.fillRect(ox + 1, oy + 1, 2, 3);
  ctx.fillStyle = '#ffd24a';
  ctx.fillRect(ox + 1, oy + 2, 1, 1);
  ctx.fillStyle = '#14101f';
  ctx.fillRect(ox + 1, oy + 5, 2, 1);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(ox, oy, 4, 1);
}

/**
 * Amplía un sprite ×2 y le pone un contorno fino (medio píxel del mapa) y un
 * brillo arriba a la izquierda: más definido, al nivel del arte nuevo.
 * Devuelve un lienzo con 1 px de margen por cada lado.
 */
export function upscaleOutline(src: HTMLCanvasElement, outline = 'rgba(14,10,24,0.85)'): HTMLCanvasElement {
  const w = src.width * 2 + 2;
  const h = src.height * 2 + 2;
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const ctx = out.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(src, 1, 1, src.width * 2, src.height * 2);
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const solid = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && d[(y * w + x) * 4 + 3] > 140;
  const edge: number[] = [];
  const shine: number[] = [];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (solid(x, y)) {
        if (!solid(x - 1, y) && !solid(x, y - 1)) shine.push(x, y);
        continue;
      }
      if (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1)) edge.push(x, y);
    }
  ctx.fillStyle = outline;
  for (let i = 0; i < edge.length; i += 2) ctx.fillRect(edge[i], edge[i + 1], 1, 1);
  ctx.fillStyle = 'rgba(255,255,255,0.28)';
  for (let i = 0; i < shine.length; i += 2) ctx.fillRect(shine[i], shine[i + 1], 1, 1);
  return out;
}
