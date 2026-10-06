import { HAIR_COLORS, OUTFIT_COLORS, shade, SKINS } from './character';

/**
 * Retratos de busto en pixel art (32 × 40) para los minijuegos y el casino:
 * clientes, solicitantes, crupieres… Con cara, a diferencia de los
 * personajes del mapa: ojos que parpadean, cejas según el humor y boca que
 * se abre al hablar.
 */
export const PORTRAIT_W = 32;
export const PORTRAIT_H = 40;

export type Mood = 'normal' | 'feliz' | 'enfado' | 'nervios' | 'triste';

export interface Person {
  name: string;
  skin: string;
  hair: 'corto' | 'largo' | 'afro' | 'calvo' | 'gorra' | 'sombrero' | 'coleta' | 'tupe' | 'permanente' | 'mono';
  hairColor: string;
  outfit: string;
  /** Prenda: traje con corbata, camisa, jersey, uniforme, chaqueta de cuero. */
  wear: 'traje' | 'camisa' | 'jersey' | 'uniforme' | 'cuero' | 'vestido';
  glasses: boolean;
  mustache: boolean;
  beard: boolean;
  earrings: boolean;
  lipstick: boolean;
  /** Tono de voz (Hz) para su balbuceo. */
  pitch: number;
}

const FIRST_M = ['Frank', 'Tony', 'Sal', 'Eddie', 'Ray', 'Luis', 'Kenji', 'Marcus', 'Joe', 'Vinnie', 'Abe', 'Dmitri', 'Carlos', 'Moe', 'Walt'];
const FIRST_F = ['Rosa', 'Linda', 'Gloria', 'Mei', 'Donna', 'Carmen', 'Peggy', 'Ruth', 'Tina', 'Olga', 'Shirley', 'Lupe', 'Fran', 'Debbie', 'Ana'];
const LAST = ['Russo', 'Kowalski', 'García', 'Chen', "O'Malley", 'Goldberg', 'Washington', 'Rossi', 'Novak', 'Murphy', 'Delgado', 'Brooks', 'Kim', 'Petrov', 'Santos'];

function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => ((s = (Math.imul(s ^ (s >>> 15), 0x2c1b3c6d) + 0x6d2b79f5) >>> 0) / 4294967296);
}

/** Una persona al azar (siempre la misma para la misma semilla). */
export function randomPerson(seed = Math.floor(Math.random() * 1e9)): Person {
  const r = rng(seed);
  const pick = <T,>(a: readonly T[]) => a[Math.floor(r() * a.length)];
  const woman = r() < 0.5;
  const hair = woman ? pick(['largo', 'coleta', 'permanente', 'mono', 'afro', 'corto', 'sombrero'] as const) : pick(['corto', 'calvo', 'gorra', 'sombrero', 'tupe', 'afro', 'corto', 'largo'] as const);
  return {
    name: `${woman ? pick(FIRST_F) : pick(FIRST_M)} ${pick(LAST)}`,
    skin: pick(SKINS),
    hair,
    hairColor: pick(HAIR_COLORS),
    outfit: pick(OUTFIT_COLORS),
    wear: woman ? pick(['vestido', 'camisa', 'jersey', 'cuero', 'traje'] as const) : pick(['traje', 'camisa', 'jersey', 'uniforme', 'cuero'] as const),
    glasses: r() < 0.28,
    mustache: !woman && r() < 0.35,
    beard: !woman && r() < 0.15,
    earrings: woman && r() < 0.5,
    lipstick: woman && r() < 0.6,
    pitch: woman ? 300 + r() * 160 : 140 + r() * 110,
  };
}

export interface PortraitPose {
  /** 0 cerrada, 1 entreabierta, 2 abierta. */
  mouth?: 0 | 1 | 2;
  blink?: boolean;
  mood?: Mood;
  /** Mira hacia un lado (-1 izquierda, 1 derecha). */
  look?: -1 | 0 | 1;
  /** Solo la silueta (detrás de un cristal esmerilado). */
  silhouette?: string;
}

/** Dibuja el retrato en (ox, oy), a 1 píxel por píxel. */
export function drawPortrait(ctx: CanvasRenderingContext2D, p: Person, pose: PortraitPose = {}, ox = 0, oy = 0) {
  const sil = pose.silhouette;
  const px = (x: number, y: number, w: number, h: number, c: string) => {
    ctx.fillStyle = sil ?? c;
    ctx.fillRect(ox + x, oy + y, w, h);
  };
  const skin = p.skin;
  const skinD = shade(skin, -0.2);
  const skinL = shade(skin, 0.12);
  const H = p.hairColor;
  const Hd = shade(H, -0.35);
  const Hl = shade(H, 0.25);
  const O = p.outfit;
  const Od = shade(O, -0.3);
  const Ol = shade(O, 0.2);

  // --- pelo de detrás (largo, coleta, afro, permanente)
  if (p.hair === 'largo') {
    px(8, 9, 16, 22, Hd);
    px(9, 9, 14, 20, H);
  }
  if (p.hair === 'afro') {
    px(6, 2, 20, 16, Hd);
    px(5, 5, 22, 10, Hd);
    px(7, 3, 18, 13, H);
  }
  if (p.hair === 'permanente') {
    for (const [x, y] of [[7, 4], [9, 2], [13, 1], [17, 1], [21, 2], [23, 4], [6, 8], [24, 8], [6, 12], [24, 12], [7, 16], [23, 16], [8, 20], [22, 20]]) {
      px(x - 1, y, 4, 4, Hd);
      px(x, y, 3, 3, H);
    }
  }
  if (p.hair === 'coleta') {
    px(22, 12, 4, 12, Hd);
    px(23, 12, 2, 11, H);
  }

  // --- cuerpo: hombros y ropa
  px(3, 31, 26, 9, Od);
  px(4, 30, 24, 10, O);
  px(4, 30, 24, 1, Ol);
  px(4, 31, 2, 9, Od);
  px(26, 31, 2, 9, Od);
  // cuello
  px(13, 25, 6, 6, skinD);
  px(14, 25, 4, 5, skin);
  if (p.wear === 'traje') {
    px(13, 30, 6, 10, '#f2efe6');
    px(15, 31, 2, 9, shade(O, 0.4) === O ? '#c0392b' : '#a8303a');
    px(15, 31, 2, 1, '#7a1e26');
    px(10, 30, 4, 10, Od);
    px(18, 30, 4, 10, Od);
  } else if (p.wear === 'camisa') {
    px(12, 30, 3, 3, '#f2efe6');
    px(17, 30, 3, 3, '#f2efe6');
    px(15, 32, 2, 8, Od);
    for (let y = 33; y < 40; y += 3) px(15, y, 2, 1, Ol);
  } else if (p.wear === 'jersey') {
    px(12, 29, 8, 2, Od);
    for (let x = 5; x < 27; x += 3) px(x, 36, 2, 1, Ol);
  } else if (p.wear === 'uniforme') {
    px(12, 30, 8, 2, '#2a2a33');
    px(20, 33, 4, 3, '#ffcc33');
    px(21, 34, 2, 1, '#c89a20');
    px(8, 33, 4, 1, Ol);
  } else if (p.wear === 'cuero') {
    px(4, 30, 24, 10, '#2a2228');
    px(4, 30, 24, 1, '#4a3e48');
    px(13, 30, 6, 10, O);
    px(11, 30, 2, 10, '#141016');
    px(19, 30, 2, 10, '#141016');
  } else if (p.wear === 'vestido') {
    px(10, 30, 12, 3, skin);
    px(10, 32, 12, 1, Ol);
  }

  // --- cabeza
  px(10, 8, 12, 17, skinD);
  px(9, 10, 14, 13, skinD);
  px(10, 9, 12, 15, skin);
  px(9, 11, 14, 11, skin);
  px(11, 9, 4, 3, skinL);
  // orejas
  px(8, 15, 2, 4, skinD);
  px(22, 15, 2, 4, skinD);
  if (p.earrings) {
    px(8, 19, 1, 2, '#ffd24a');
    px(23, 19, 1, 2, '#ffd24a');
  }
  // mandíbula en sombra
  px(10, 23, 12, 1, skinD);

  // --- cara
  if (!sil) {
    const lx = pose.look ?? 0;
    const mood = pose.mood ?? 'normal';
    const eyeY = 15;
    if (pose.blink) {
      px(12 + lx, eyeY + 1, 3, 1, '#2a1a14');
      px(18 + lx, eyeY + 1, 3, 1, '#2a1a14');
    } else {
      px(12, eyeY, 3, 2, '#f4efe6');
      px(18, eyeY, 3, 2, '#f4efe6');
      px(13 + lx, eyeY, 2, 2, '#2a1a14');
      px(19 + lx, eyeY, 2, 2, '#2a1a14');
      px(13 + lx, eyeY, 1, 1, '#ffffff');
      px(19 + lx, eyeY, 1, 1, '#ffffff');
    }
    // cejas
    const brow = Hd;
    if (mood === 'enfado') {
      px(12, 13, 2, 1, brow);
      px(14, 14, 1, 1, brow);
      px(19, 13, 2, 1, brow);
      px(18, 14, 1, 1, brow);
    } else if (mood === 'nervios' || mood === 'triste') {
      px(12, 14, 1, 1, brow);
      px(13, 13, 2, 1, brow);
      px(18, 13, 2, 1, brow);
      px(20, 14, 1, 1, brow);
    } else if (mood === 'feliz') {
      px(12, 12, 3, 1, brow);
      px(18, 12, 3, 1, brow);
    } else {
      px(12, 13, 3, 1, brow);
      px(18, 13, 3, 1, brow);
    }
    // nariz
    px(16, 17, 1, 3, skinD);
    px(15, 19, 2, 1, skinD);
    // mejillas
    if (mood === 'feliz' || mood === 'nervios') {
      px(10, 19, 2, 1, mood === 'nervios' ? '#e86a6a' : shade(skin, -0.08));
      px(21, 19, 2, 1, mood === 'nervios' ? '#e86a6a' : shade(skin, -0.08));
    }
    if (mood === 'nervios') px(22, 11, 1, 2, '#9fd3ff');
    // bigote y barba
    if (p.beard) {
      px(10, 20, 12, 5, Hd);
      px(11, 20, 10, 4, H);
    }
    if (p.mustache) px(13, 20, 6, 1, Hd);
    // boca
    const lip = p.lipstick ? '#c0303a' : shade(skin, -0.35);
    const m = pose.mouth ?? 0;
    if (m === 0) {
      if (mood === 'feliz') {
        px(14, 21, 4, 1, lip);
        px(13, 20, 1, 1, lip);
        px(18, 20, 1, 1, lip);
      } else if (mood === 'enfado' || mood === 'triste') {
        px(14, 21, 4, 1, lip);
        px(13, 22, 1, 1, lip);
        px(18, 22, 1, 1, lip);
      } else px(14, 21, 4, 1, lip);
    } else if (m === 1) {
      px(14, 21, 4, 2, '#3a1a1a');
      px(14, 21, 4, 1, lip);
    } else {
      px(13, 21, 6, 3, '#3a1a1a');
      px(13, 21, 6, 1, lip);
      px(14, 23, 4, 1, '#c84a5a');
    }
    if (p.glasses) {
      const g = '#1a1a22';
      px(11, 14, 5, 1, g);
      px(11, 17, 5, 1, g);
      px(11, 14, 1, 4, g);
      px(15, 14, 1, 4, g);
      px(17, 14, 5, 1, g);
      px(17, 17, 5, 1, g);
      px(17, 14, 1, 4, g);
      px(21, 14, 1, 4, g);
      px(16, 15, 1, 1, g);
      px(12, 15, 1, 1, 'rgba(200,230,255,0.7)');
      px(18, 15, 1, 1, 'rgba(200,230,255,0.7)');
    }
  }

  // --- pelo de delante
  switch (p.hair) {
    case 'corto':
      px(9, 7, 14, 4, Hd);
      px(10, 6, 12, 4, H);
      px(9, 9, 2, 5, H);
      px(21, 9, 2, 4, H);
      px(12, 6, 5, 1, Hl);
      break;
    case 'tupe':
      px(9, 6, 14, 5, Hd);
      px(10, 4, 11, 5, H);
      px(14, 3, 8, 3, H);
      px(15, 3, 5, 1, Hl);
      px(9, 9, 2, 5, H);
      break;
    case 'largo':
      px(9, 6, 14, 5, H);
      px(8, 9, 3, 14, H);
      px(21, 9, 3, 14, H);
      px(12, 6, 6, 1, Hl);
      break;
    case 'coleta':
    case 'mono':
      px(9, 6, 14, 5, H);
      px(9, 9, 2, 6, H);
      px(21, 9, 2, 6, H);
      px(11, 6, 5, 1, Hl);
      if (p.hair === 'mono') {
        px(12, 1, 8, 6, Hd);
        px(13, 1, 6, 5, H);
        px(14, 1, 3, 1, Hl);
      }
      break;
    case 'afro':
      px(9, 6, 14, 4, H);
      px(10, 5, 4, 1, Hl);
      break;
    case 'permanente':
      px(9, 6, 14, 4, H);
      px(10, 8, 3, 3, Hl);
      px(19, 8, 3, 3, Hl);
      break;
    case 'calvo':
      px(8, 13, 2, 5, H);
      px(22, 13, 2, 5, H);
      px(12, 8, 4, 1, shade(skin, 0.25));
      break;
    case 'gorra': {
      const c = O === '#3a3a46' ? '#2f6fb3' : shade(O, -0.1);
      px(9, 5, 14, 6, c);
      px(10, 4, 12, 2, c);
      px(9, 10, 18, 2, shade(c, -0.3));
      px(14, 6, 3, 2, '#f4efe6');
      px(9, 11, 2, 3, H);
      break;
    }
    case 'sombrero': {
      const c = '#3a3036';
      px(10, 2, 12, 7, c);
      px(6, 8, 20, 2, c);
      px(10, 7, 12, 1, '#7a2a30');
      px(11, 2, 4, 1, shade(c, 0.3));
      break;
    }
  }
}

/** Voz de una persona para el balbuceo. */
export const voiceOf = (p: Person) => ({ pitch: p.pitch, type: (p.pitch > 280 ? 'triangle' : 'square') as OscillatorType });
