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
