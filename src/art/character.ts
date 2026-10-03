import type { Look, Role } from '../core/types';

/**
 * Personajes faceless en pixel art (16x32), dibujados por capas:
 * pelo trasero → piernas → torso/ropa → brazos → cabeza → pelo delantero.
 * La identidad sale solo de la silueta, la ropa y el color.
 */
export const CHAR_W = 16;
export const CHAR_H = 32;

export interface Option {
  id: string;
  label: string;
}

export const SKINS = ['#f2d0b0', '#deac84', '#c18a5c', '#9a6440', '#6c4228', '#47291a'];
export const HAIR_COLORS = ['#1c1818', '#4a2e1c', '#8a5a2b', '#d8b45e', '#b5442c', '#c9c4bc'];
export const OUTFIT_COLORS = ['#c0392b', '#2f6fb3', '#2e8b57', '#e2a23b', '#7b4fa0', '#e8619e', '#3a3a46', '#c8b48a'];

export const OUTFITS: Record<Role, Option[]> = {
  inmigrante: [
    { id: 'obrero', label: 'Mono de obrero' },
    { id: 'camarero', label: 'Uniforme de camarero' },
    { id: 'chaqueta', label: 'Chaqueta vaquera' },
    { id: 'sudadera', label: 'Sudadera' },
  ],
  alcalde: [
    { id: 'traje', label: 'Traje y corbata' },
    { id: 'cruzado', label: 'Traje cruzado' },
    { id: 'gabardina', label: 'Gabardina' },
    { id: 'chaleco', label: 'Chaleco y mangas' },
  ],
};

/** Ropa y peinados desbloqueables (ver core/cosmetics.ts). */
export const EXTRA_OUTFITS: Record<string, Option> = {
  cuero: { id: 'cuero', label: 'Chaqueta de cuero' },
  domingo: { id: 'domingo', label: 'Traje de domingo' },
  esmoquin: { id: 'esmoquin', label: 'Esmoquin' },
  jogging: { id: 'jogging', label: 'Chándal ochentero' },
};
export const EXTRA_HAIRS: Record<string, Option> = {
  permanente: { id: 'permanente', label: 'Permanente' },
  gorra: { id: 'gorra', label: 'Gorra de béisbol' },
  cresta: { id: 'cresta', label: 'Cresta punk' },
};

export const HAIRS: Option[] = [
  { id: 'corto', label: 'Corto' },
  { id: 'mullet', label: 'Mullet' },
  { id: 'afro', label: 'Afro' },
  { id: 'largo', label: 'Largo' },
  { id: 'coleta', label: 'Coleta' },
  { id: 'tupe', label: 'Tupé' },
  { id: 'rapado', label: 'Rapado' },
];

export function defaultLook(role: Role): Look {
  return {
    outfit: OUTFITS[role][0].id,
    hair: role === 'alcalde' ? 'tupe' : 'corto',
    skin: SKINS[2],
    hairColor: HAIR_COLORS[0],
    outfitColor: role === 'alcalde' ? OUTFIT_COLORS[6] : OUTFIT_COLORS[1],
  };
}

export function randomLook(role: Role, rand: () => number = Math.random): Look {
  const pick = <T,>(a: T[]) => a[Math.floor(rand() * a.length)];
  return {
    outfit: pick(OUTFITS[role]).id,
    hair: pick(HAIRS).id,
    skin: pick(SKINS),
    hairColor: pick(HAIR_COLORS),
    outfitColor: pick(OUTFIT_COLORS),
  };
}

export function shade(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(amount < 0 ? c * (1 + amount) : c + (255 - c) * amount)));
  const r = f((n >> 16) & 255);
  const g = f((n >> 8) & 255);
  const b = f(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

type Px = (x: number, y: number, w: number, h: number, c: string) => void;

/**
 * Dibuja el personaje en (ox, oy). frame: 0 = quieto, 1 y 2 = pasos al caminar.
 */
export function drawCharacter(ctx: CanvasRenderingContext2D, look: Look, frame = 0, ox = 0, oy = 0) {
  const bob = frame === 0 ? 0 : 1;
  const px: Px = (x, y, w, h, c) => {
    ctx.fillStyle = c;
    ctx.fillRect(ox + x, oy + y, w, h);
  };
  // La parte superior del cuerpo sube y baja con el paso.
  const up: Px = (x, y, w, h, c) => px(x, y + bob, w, h, c);

  const skin = look.skin;
  const skinD = shade(skin, -0.18);
  const H = look.hairColor;
  const Hd = shade(H, -0.3);
  const P = look.outfitColor;
  const Pd = shade(P, -0.3);
  const Pl = shade(P, 0.18);

  const o = OUTFIT_STYLE[look.outfit] ?? OUTFIT_STYLE.obrero;
  const pants = o.pants === 'P' ? P : o.pants;
  const pantsD = shade(pants, -0.25);
  const shoes = o.shoes;

  // --- pelo trasero
  drawHair(look.hair, 'back', up, H, Hd);

  // --- piernas (el paso acorta una pierna)
  const lLeg = frame === 1 ? 6 : 7;
  const rLeg = frame === 2 ? 6 : 7;
  px(4, 20, 8, 2, pants);
  px(4, 22, 3, lLeg, pants);
  px(9, 22, 3, rLeg, pants);
  px(6, 22, 1, lLeg, pantsD);
  px(11, 22, 1, rLeg, pantsD);
  px(3, 22 + lLeg, 4, 2, shoes);
  px(9, 22 + rLeg, 4, 2, shoes);

  // --- torso
  const body = o.body === 'P' ? P : o.body;
  up(4, 10, 8, 10, body);
  ctx.clearRect(ox + 4, oy + 10 + bob, 1, 1);
  ctx.clearRect(ox + 11, oy + 10 + bob, 1, 1);
  up(11, 11, 1, 9, shade(body, -0.2));

  // --- brazos: manga y antebrazo
  const sleeve = o.sleeve === 'P' ? P : o.sleeve;
  const swing = frame === 1 ? 1 : frame === 2 ? -1 : 0;
  const arm = (x: number, dy: number) => {
    up(x, 11 + dy, 2, o.sleeveLen, sleeve);
    up(x, 11 + dy + o.sleeveLen, 2, 8 - o.sleeveLen, skin);
    up(x, 19 + dy, 2, 1, skinD);
  };
  arm(2, swing);
  arm(12, -swing);

  // --- detalles de cada vestimenta
  o.detail(up, { P, Pd, Pl, skin });

  // --- cuello y cabeza (sin rostro)
  up(7, 9, 2, 1, skinD);
  up(5, 2, 6, 7, skin);
  up(10, 3, 1, 5, skinD);
  up(4, 5, 1, 2, skinD);
  up(11, 5, 1, 2, skinD);
  ctx.clearRect(ox + 5, oy + 2 + bob, 1, 1);
  ctx.clearRect(ox + 10, oy + 2 + bob, 1, 1);
  ctx.clearRect(ox + 5, oy + 8 + bob, 1, 1);
  ctx.clearRect(ox + 10, oy + 8 + bob, 1, 1);

  // --- pelo delantero
  drawHair(look.hair, 'front', up, H, Hd);
}

interface OutfitStyle {
  body: string;
  sleeve: string;
  sleeveLen: number;
  pants: string;
  shoes: string;
  detail: (px: Px, c: { P: string; Pd: string; Pl: string; skin: string }) => void;
}

const WHITE = '#f1ede3';
const DARK = '#22222a';

const OUTFIT_STYLE: Record<string, OutfitStyle> = {
  // --- desbloqueables
  cuero: {
    body: '#1c1a20',
    sleeve: '#1c1a20',
    sleeveLen: 8,
    pants: '#3b5b8c',
    shoes: '#111',
    detail: (px) => {
      px(7, 10, 2, 10, '#efe9dc');
      px(5, 10, 2, 3, '#2e2b33');
      px(9, 10, 2, 3, '#2e2b33');
      px(6, 13, 1, 6, '#9a9aa6');
      px(4, 12, 1, 1, '#4a4652');
      px(11, 12, 1, 1, '#4a4652');
    },
  },
  domingo: {
    body: '#6b4a2b',
    sleeve: '#6b4a2b',
    sleeveLen: 8,
    pants: '#5a3e24',
    shoes: '#2a1a10',
    detail: (px) => {
      px(6, 10, 4, 1, '#efe2c4');
      px(7, 11, 2, 3, '#efe2c4');
      px(7, 11, 2, 6, '#2e5a8a');
      px(6, 11, 1, 4, '#4f3420');
      px(9, 11, 1, 4, '#4f3420');
      px(9, 13, 1, 1, '#e8414f');
    },
  },
  esmoquin: {
    body: '#111116',
    sleeve: '#111116',
    sleeveLen: 8,
    pants: '#111116',
    shoes: '#000',
    detail: (px) => {
      px(6, 10, 4, 1, '#ffffff');
      px(6, 11, 4, 7, '#ffffff');
      px(6, 10, 4, 1, '#000');
      px(7, 10, 2, 1, '#2a2a2a');
      for (const y of [13, 15, 17]) px(7, y, 1, 1, '#222');
      px(5, 11, 1, 5, '#2a2a33');
      px(10, 11, 1, 5, '#2a2a33');
    },
  },
  jogging: {
    body: 'P',
    sleeve: 'P',
    sleeveLen: 8,
    pants: 'P',
    shoes: '#f1ede3',
    detail: (px, { Pd }) => {
      px(2, 11, 1, 8, '#f1ede3');
      px(13, 11, 1, 8, '#f1ede3');
      px(4, 22, 1, 6, '#f1ede3');
      px(11, 22, 1, 6, '#f1ede3');
      px(5, 10, 6, 1, Pd);
      px(7, 11, 2, 1, '#f1ede3');
    },
  },

  obrero: {
    body: '#d6cfbd',
    sleeve: '#d6cfbd',
    sleeveLen: 3,
    pants: 'P',
    shoes: '#5a3a22',
    detail: (px, { P, Pd }) => {
      px(5, 14, 6, 6, P);
      px(5, 10, 1, 4, P);
      px(10, 10, 1, 4, P);
      px(7, 15, 2, 2, Pd);
      px(5, 19, 6, 1, Pd);
    },
  },
  camarero: {
    body: WHITE,
    sleeve: WHITE,
    sleeveLen: 7,
    pants: DARK,
    shoes: '#111',
    detail: (px, { P, Pd }) => {
      px(4, 11, 3, 9, P);
      px(9, 11, 3, 9, P);
      px(7, 14, 2, 6, P);
      px(11, 11, 1, 9, Pd);
      px(6, 10, 4, 1, '#111');
      px(7, 10, 2, 1, '#333');
    },
  },
  chaqueta: {
    body: 'P',
    sleeve: 'P',
    sleeveLen: 8,
    pants: '#3b5b8c',
    shoes: '#ece8e0',
    detail: (px, { Pd, Pl }) => {
      px(7, 10, 2, 10, '#efe9dc');
      px(5, 10, 2, 2, Pd);
      px(9, 10, 2, 2, Pd);
      px(5, 18, 2, 1, Pl);
      px(9, 18, 2, 1, Pl);
    },
  },
  sudadera: {
    body: 'P',
    sleeve: 'P',
    sleeveLen: 8,
    pants: '#4a4a52',
    shoes: '#d33c3c',
    detail: (px, { Pd }) => {
      px(5, 9, 6, 2, Pd);
      px(5, 16, 6, 3, Pd);
      px(7, 11, 1, 2, WHITE);
      px(8, 11, 1, 2, WHITE);
    },
  },
  traje: {
    body: 'P',
    sleeve: 'P',
    sleeveLen: 8,
    pants: 'P',
    shoes: '#111',
    detail: (px, { P, Pd }) => {
      px(6, 10, 4, 1, WHITE);
      px(7, 11, 2, 3, WHITE);
      px(7, 11, 2, 7, tieFor(P));
      px(6, 11, 1, 4, Pd);
      px(9, 11, 1, 4, Pd);
    },
  },
  cruzado: {
    body: 'P',
    sleeve: 'P',
    sleeveLen: 8,
    pants: 'P',
    shoes: '#111',
    detail: (px, { P, Pd }) => {
      px(7, 10, 2, 1, WHITE);
      px(7, 11, 2, 2, tieFor(P));
      px(6, 11, 1, 2, Pd);
      px(9, 11, 1, 2, Pd);
      px(5, 13, 6, 1, Pd);
      for (const [x, y] of [[6, 15], [9, 15], [6, 17], [9, 17]]) px(x, y, 1, 1, '#d4af37');
    },
  },
  gabardina: {
    body: 'P',
    sleeve: 'P',
    sleeveLen: 8,
    pants: '#2a2a33',
    shoes: '#111',
    detail: (px, { P, Pd }) => {
      px(4, 20, 8, 6, P);
      px(7, 21, 2, 5, Pd);
      px(4, 18, 8, 1, Pd);
      px(7, 18, 2, 1, '#d4af37');
      px(5, 10, 2, 3, Pd);
      px(9, 10, 2, 3, Pd);
      px(7, 10, 2, 2, WHITE);
    },
  },
  chaleco: {
    body: WHITE,
    sleeve: WHITE,
    sleeveLen: 4,
    pants: '#3a3a44',
    shoes: '#111',
    detail: (px, { P, Pd }) => {
      px(4, 11, 3, 9, P);
      px(9, 11, 3, 9, P);
      px(7, 15, 2, 5, P);
      px(11, 11, 1, 9, Pd);
      px(7, 11, 2, 5, tieFor(P));
      px(2, 14, 2, 1, shade(WHITE, -0.15));
      px(12, 14, 2, 1, shade(WHITE, -0.15));
    },
  },
};

function tieFor(P: string): string {
  return P === '#c0392b' || P === '#e8619e' ? '#1f2c55' : '#a3242b';
}

function drawHair(style: string, layer: 'back' | 'front', px: Px, H: string, Hd: string) {
  if (layer === 'back') {
    switch (style) {
      case 'mullet':
        px(4, 4, 8, 8, Hd);
        break;
      case 'largo':
        px(4, 3, 8, 13, Hd);
        break;
      case 'coleta':
        px(11, 3, 2, 3, Hd);
        px(12, 5, 1, 6, Hd);
        break;
      case 'afro':
        px(3, 1, 10, 8, Hd);
        break;
      case 'permanente':
        px(3, 2, 10, 10, Hd);
        break;
    }
    return;
  }
  switch (style) {
    case 'permanente':
      px(5, 0, 6, 1, H);
      px(4, 1, 8, 3, H);
      px(3, 3, 2, 7, H);
      px(11, 3, 2, 7, Hd);
      for (const [x, y] of [[4, 1], [7, 0], [10, 1], [3, 5], [12, 6], [3, 8]]) px(x, y, 1, 1, Hd);
      break;
    case 'gorra':
      px(5, 1, 6, 3, '#c0392b');
      px(5, 1, 6, 1, '#e8584a');
      px(3, 3, 4, 1, '#8e1f1f');
      px(7, 1, 1, 1, '#f1ede3');
      px(10, 4, 1, 2, H);
      break;
    case 'cresta':
      px(7, -1 + 1, 2, 1, H);
      px(7, 0, 2, 4, H);
      px(8, 0, 1, 4, Hd);
      px(5, 3, 2, 1, shade(H, -0.5));
      px(9, 3, 2, 1, shade(H, -0.5));
      break;
    case 'corto':
      px(6, 1, 4, 1, H);
      px(5, 2, 6, 2, H);
      px(5, 4, 1, 2, H);
      px(10, 4, 1, 1, Hd);
      break;
    case 'mullet':
      px(6, 1, 4, 1, H);
      px(5, 2, 6, 2, H);
      px(5, 4, 1, 3, H);
      px(10, 4, 1, 3, Hd);
      break;
    case 'afro':
      px(5, 0, 6, 1, H);
      px(4, 1, 8, 3, H);
      px(3, 2, 1, 5, H);
      px(12, 2, 1, 5, Hd);
      px(4, 4, 1, 3, H);
      px(11, 4, 1, 3, Hd);
      break;
    case 'largo':
      px(6, 1, 4, 1, H);
      px(5, 2, 6, 2, H);
      px(4, 3, 2, 8, H);
      px(10, 3, 2, 8, Hd);
      break;
    case 'coleta':
      px(6, 1, 4, 1, H);
      px(5, 2, 6, 2, H);
      px(5, 4, 1, 1, H);
      px(10, 3, 2, 2, Hd);
      break;
    case 'tupe':
      px(6, 0, 5, 1, H);
      px(5, 1, 7, 2, H);
      px(5, 3, 6, 1, H);
      px(5, 4, 1, 2, H);
      px(10, 4, 1, 1, Hd);
      px(10, 1, 2, 1, Hd);
      break;
    case 'rapado':
      px(6, 2, 4, 1, Hd);
      px(5, 3, 6, 1, Hd);
      break;
  }
}
