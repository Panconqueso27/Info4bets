import { shade } from '../../art/character';
import { bands, bust, crowdie, disc, glow, hash, layer, lowFx, neon, R, txt, txtC } from './scenes-office';

/**
 * Escenarios de los concursos: batalla de breakdance en Times Square,
 * perritos de Nathan's en Coney Island, torneo de Simon en la sala
 * recreativa y el maratón por las calles de Nueva York.
 */

// ===========================================================================
// Cuerpo articulado de píxeles (bailarín y corredores)
// ===========================================================================

export interface BodyColors {
  skin: string;
  top: string;
  legs: string;
  shoes: string;
  hair: string;
  cap?: string;
}
/** Ángulos en radianes; 0 = hacia abajo, positivo = hacia delante (derecha). */
export interface Pose {
  rot: number;
  torso: number;
  arms: [[number, number], [number, number]];
  legs: [[number, number], [number, number]];
}

function thick(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, w: number, c: string) {
  ctx.fillStyle = c;
  const n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
  for (let i = 0; i <= n; i++) {
    const x = x0 + ((x1 - x0) * i) / n;
    const y = y0 + ((y1 - y0) * i) / n;
    ctx.fillRect(Math.round(x - w / 2), Math.round(y - w / 2), w, w);
  }
}

/** Dibuja una figura articulada con la cadera en (x, y) y escala s. */
export function drawBody(ctx: CanvasRenderingContext2D, x: number, y: number, p: Pose, c: BodyColors, s = 1) {
  const d = (a: number) => [Math.sin(a + p.rot), Math.cos(a + p.rot)] as const;
  const at = (ox: number, oy: number, a: number, len: number) => {
    const [dx, dy] = d(a);
    return [ox + dx * len * s, oy + dy * len * s] as const;
  };
  const W = Math.max(2, Math.round(2 * s));
  const neck = at(x, y, Math.PI + p.torso, 9);
  const limb = (ox: number, oy: number, [a1, a2]: [number, number], l1: number, l2: number, c1: string, c2: string, end: string) => {
    const k = at(ox, oy, a1, l1);
    const e = at(k[0], k[1], a2, l2);
    thick(ctx, ox, oy, k[0], k[1], W, c1);
    thick(ctx, k[0], k[1], e[0], e[1], W, c2);
    ctx.fillStyle = end;
    ctx.fillRect(Math.round(e[0] - W / 2), Math.round(e[1] - W / 2), W + 1, W);
  };
  // miembros de detrás, más oscuros
  limb(x, y, p.legs[1], 6, 6, shade(c.legs, -0.3), shade(c.legs, -0.3), shade(c.shoes, -0.3));
  limb(neck[0], neck[1], p.arms[1], 4.5, 4.5, shade(c.top, -0.3), shade(c.skin, -0.25), shade(c.skin, -0.25));
  // tronco y cabeza
  thick(ctx, x, y, neck[0], neck[1], W + 1, c.top);
  const head = at(neck[0], neck[1], Math.PI + p.torso, 3);
  disc(ctx, head[0], head[1], Math.round(2.6 * s), c.skin);
  const hairAt = at(head[0], head[1], Math.PI + p.torso, 1.6);
  disc(ctx, hairAt[0], hairAt[1], Math.max(1, Math.round(1.6 * s)), c.cap ?? c.hair);
  if (c.cap) {
    const brim = at(hairAt[0], hairAt[1], Math.PI / 2 + p.torso, 2.5);
    thick(ctx, hairAt[0], hairAt[1], brim[0], brim[1], Math.max(1, Math.round(s)), c.cap);
  }
  // miembros de delante
  limb(x, y, p.legs[0], 6, 6, c.legs, c.legs, c.shoes);
  limb(neck[0], neck[1], p.arms[0], 4.5, 4.5, c.top, c.skin, c.skin);
}

export const runPose = (ph: number, amp = 1, lean = 0.18): Pose => {
  const a = Math.sin(ph) * 0.9 * amp;
  return {
    rot: 0,
    torso: lean,
    legs: [
      [a, a - Math.max(0, Math.cos(ph)) * 1.3 * amp - 0.2],
      [-a, -a - Math.max(0, -Math.cos(ph)) * 1.3 * amp - 0.2],
    ],
    arms: [
      [-a * 0.9, -a * 0.9 + 1.6],
      [a * 0.9, a * 0.9 + 1.6],
    ],
  };
};

export type DanceMove = 'top' | 'mill' | 'freeze' | 'spin' | 'fall' | 'pose';

/** Pose del b-boy según el paso, el tiempo y la fase del compás (0..1). */
export function dancePose(move: DanceMove, t: number, beat: number): Pose {
  const b = Math.sin(beat * Math.PI * 2);
  switch (move) {
    case 'mill': {
      const r = t * 10;
      return { rot: r, torso: 0, legs: [[1.1, 1.1], [-1.1, -1.1]], arms: [[1.6, 1.6], [-1.6, -1.6]] };
    }
    case 'spin': {
      const k = Math.sin(t * 16);
      return { rot: Math.PI, torso: 0, legs: [[0.6 + k * 0.5, 0.6 + k * 0.5], [-0.6 + k * 0.5, -0.6 + k * 0.5]], arms: [[2.4, 2.9], [-2.4, -2.9]] };
    }
    case 'freeze':
      return { rot: Math.PI * 0.85, torso: 0, legs: [[1.4, 2.2], [-0.3, 0.6]], arms: [[2.8, 3.1], [1.2, 0.4]] };
    case 'fall':
      return { rot: Math.PI / 2, torso: 0, legs: [[0.2, 0.5 + Math.sin(t * 20) * 0.1], [-0.2, 0.1]], arms: [[2.2, 2.6], [-2.6, -2.2]] };
    case 'pose':
      return { rot: 0, torso: -0.1, legs: [[0.4, 0.2], [-0.35, -0.2]], arms: [[2.6, 3.2], [-1.2, -2.6]] };
    default:
      return {
        rot: 0,
        torso: 0.08 * b,
        legs: [
          [0.35 * b + 0.1, 0.35 * b + 0.1 - Math.max(0, b) * 0.9],
          [-0.35 * b - 0.1, -0.35 * b - 0.1 - Math.max(0, -b) * 0.9],
        ],
        arms: [
          [0.9 + 0.5 * b, 2.4 + 0.4 * b],
          [-0.9 + 0.5 * b, -2.4 + 0.4 * b],
        ],
      };
  }
}

// ===========================================================================
// Breakdance: Times Square de noche
// ===========================================================================

export interface DanceView {
  beat: number;
  move: DanceMove;
  moveUntil: number;
  hype: number;
  boo: number;
  now: number;
}
export const danceView = (): DanceView => ({ beat: 0, move: 'top', moveUntil: 0, hype: -9, boo: -9, now: 0 });

let tsBase: HTMLCanvasElement | null = null;
function paintTimesSquare(ctx: CanvasRenderingContext2D) {
  const W = 180;
  bands(ctx, 0, 120, W, ['#0b0618', '#120a26', '#1a0e34', '#241240', '#2e164a', '#3a1a50']);
  // edificios
  const bld = (x: number, w: number, top: number, c: string) => {
    R(ctx, x, top, w, 240 - top, c);
    R(ctx, x, top, w, 2, shade(c, 0.2));
    for (let y = top + 6; y < 200; y += 6) for (let wx = x + 2; wx < x + w - 2; wx += 4) if (hash(wx * 31 + y) < 0.45) R(ctx, wx, y, 2, 3, hash(wx + y) < 0.7 ? '#ffd27a' : '#7fb0ff');
  };
  bld(0, 46, 10, '#1d1530');
  bld(134, 46, 18, '#1a1430');
  bld(46, 22, 40, '#221a38');
  bld(112, 22, 46, '#221a38');
  // One Times Square
  R(ctx, 68, 14, 44, 226, '#2a2240');
  R(ctx, 74, 6, 32, 10, '#2a2240');
  R(ctx, 88, 0, 4, 8, '#3a3250');
  // acera y asfalto
  R(ctx, 0, 196, W, 8, '#3a3446');
  R(ctx, 0, 204, W, 22, '#1e1a26');
  for (let x = 0; x < W; x += 16) R(ctx, x, 214, 8, 1, '#c9a24a');
  R(ctx, 0, 226, W, 94, '#2a2434');
  for (let y = 228; y < 320; y += 7) R(ctx, 0, y, W, 1, '#241f2e');
}

const TS_TICKER = '  PIXELOPOLIS 1985 * GRAN BATALLA DE BREAKDANCE * NYC NUNCA DUERME *';

/** Times Square: neones que parpadean, pantallas, taxis, público y el b-boy. */
export function drawTimesSquare(ctx: CanvasRenderingContext2D, t: number, view: DanceView, colors: BodyColors) {
  view.now = t;
  if (!tsBase) tsBase = layer(180, 320, paintTimesSquare);
  ctx.drawImage(tsBase, 0, 0);
  const pulse = Math.max(0, Math.cos(view.beat * Math.PI * 2));
  const hype = Math.max(0, 1 - (t - view.hype) / 1.2);
  // pantallas de One Times Square
  const hue = (t * 40) % 360;
  R(ctx, 70, 18, 40, 24, '#0a0a12');
  ctx.fillStyle = `hsl(${hue},80%,45%)`;
  ctx.fillRect(72, 20, 36, 20);
  for (let i = 0; i < 6; i++) R(ctx, 72 + ((i * 7 + t * 20) % 36), 20 + ((i * 5) % 20), 3, 3, `hsl(${(hue + 120 + i * 30) % 360},90%,70%)`);
  txtC(ctx, 'PIXEL TV', 90, 27, '#ffffff');
  // teletipo de noticias
  R(ctx, 68, 46, 44, 9, '#0a0a12');
  ctx.save();
  ctx.beginPath();
  ctx.rect(69, 47, 42, 7);
  ctx.clip();
  const off = (t * 22) % (TS_TICKER.length * 4);
  txt(ctx, TS_TICKER + TS_TICKER, 69 - off, 48, '#ffcc33');
  ctx.restore();
  // anuncio de refresco
  R(ctx, 70, 60, 40, 22, '#b01e28');
  disc(ctx, 80, 71, 6, '#e8e4d8');
  disc(ctx, 80, 71, 4, '#b01e28');
  neon(ctx, 'SODA', 90, 68, '#ffffff', Math.sin(t * 3) > -0.8);
  // neones de los lados
  const flick = (k: number) => hash(Math.floor(t * 8) + k * 97) > 0.06;
  ['B', 'R', 'O', 'A', 'D', 'W', 'A', 'Y'].forEach((ch, i) => neon(ctx, ch, 6, 24 + i * 8, '#4ff0ff', flick(1) && (Math.floor(t * 4) % 9 !== i)));
  R(ctx, 16, 30, 26, 18, '#14101f');
  neon(ctx, 'DISCO', 18, 36, '#ff4f9a', flick(2));
  R(ctx, 138, 30, 38, 16, '#14101f');
  neon(ctx, 'HOTEL', 147, 36, '#ffcc33', flick(3));
  R(ctx, 140, 56, 36, 26, '#1f4a6b');
  R(ctx, 142, 58, 32, 22, '#2f6fb3');
  R(ctx, 152, 60, 12, 18, '#14101f');
  R(ctx, 154, 62, 3, 16, '#3a6ab0');
  R(ctx, 159, 62, 3, 16, '#3a6ab0');
  txtC(ctx, 'JEANS', 158, 74, '#ffffff');
  // marquesina de teatro con bombillas que corren
  R(ctx, 2, 150, 42, 16, '#5a1424');
  txtC(ctx, 'SHOW', 23, 156, '#ffe9a8');
  for (let i = 0; i < 14; i++) {
    const on = (i + Math.floor(t * 8)) % 3 === 0;
    R(ctx, 3 + i * 3, 150, 1, 1, on ? '#fff2a8' : '#6a4a20');
    R(ctx, 3 + i * 3, 165, 1, 1, on ? '#fff2a8' : '#6a4a20');
  }
  // taxis que cruzan
  for (let i = 0; i < 3; i++) {
    const dir = i % 2 ? -1 : 1;
    const x = dir > 0 ? ((t * 38 + i * 90) % 260) - 40 : 220 - ((t * 30 + i * 70) % 260);
    const y = dir > 0 ? 208 : 200;
    R(ctx, x, y + 2, 22, 6, '#f2c230');
    R(ctx, x + 4, y - 2, 13, 5, '#f2c230');
    R(ctx, x + 6, y - 1, 9, 3, '#3a4a6a');
    R(ctx, x + 9, y - 4, 4, 2, '#fff7c2');
    R(ctx, x + 3, y + 8, 4, 2, '#0a0a0a');
    R(ctx, x + 15, y + 8, 4, 2, '#0a0a0a');
    R(ctx, dir > 0 ? x + 21 : x, y + 3, 1, 2, '#fff6c0');
    glow(ctx, dir > 0 ? x + 26 : x - 4, y + 4, 8, '#fff6c0', 0.3);
  }
  // vapor de la alcantarilla
  for (let i = 0; i < 5; i++) {
    const k = (t * 0.4 + i / 5) % 1;
    ctx.globalAlpha = 0.35 * (1 - k);
    disc(ctx, 150 + Math.sin(t + i) * 4, 214 - k * 50, 3 + Math.floor(k * 5), '#c8b8e8');
  }
  ctx.globalAlpha = 1;
  // público en corro (de noche, iluminado por los neones)
  for (let i = 0; i < 13; i++) {
    const x = 6 + i * 14;
    const jump = Math.round(pulse * (i % 3 === 0 ? 2 : 1) + hype * Math.abs(Math.sin(t * 14 + i)) * 4);
    bust(ctx, x, 186 - jump - (i % 2) * 3, 7, crowdie(i + 300));
    if (hype > 0.2 || (i + Math.floor(t * 2)) % 6 === 0) {
      const c = crowdie(i + 300);
      R(ctx, x + 5, 176 - jump, 2, 10, c.coat);
      R(ctx, x + 4, 173 - jump - Math.round(Math.sin(t * 9 + i) * 2), 4, 3, c.skin);
    }
  }
  ctx.globalAlpha = 0.35;
  R(ctx, 0, 172, 180, 40, '#1a0a30');
  ctx.globalAlpha = 1;
  // cartón en el suelo
  R(ctx, 42, 232, 96, 26, '#8a6a3a');
  R(ctx, 42, 232, 96, 2, '#a4844a');
  R(ctx, 89, 232, 2, 26, '#6e5228');
  R(ctx, 42, 244, 96, 1, '#6e5228');
  R(ctx, 60, 238, 10, 3, '#c9c4bc');
  R(ctx, 116, 250, 12, 3, '#c9c4bc');
  // foco sobre el bailarín
  glow(ctx, 90, 222, 60, view.boo > t - 1 ? '#ff4a5a' : '#ffd6ec', 0.25 + pulse * 0.15 + hype * 0.3);
  // radiocasete
  const bx = 8;
  const by = 238;
  R(ctx, bx + 6, by - 4, 18, 2, '#9aa0a6');
  R(ctx, bx, by, 32, 18, '#3a3a44');
  R(ctx, bx + 1, by + 1, 30, 1, '#6a6a78');
  const sp = 5 + Math.round(pulse);
  disc(ctx, bx + 7, by + 10, sp, '#14141a');
  disc(ctx, bx + 25, by + 10, sp, '#14141a');
  disc(ctx, bx + 7, by + 10, 2, '#5a5a68');
  disc(ctx, bx + 25, by + 10, 2, '#5a5a68');
  R(ctx, bx + 13, by + 4, 6, 4, '#c8ced2');
  R(ctx, bx + 14, by + 5, 1, 1, Math.floor(t * 4) % 2 ? '#ff3a3a' : '#5a1010');
  if (pulse > 0.6) {
    ctx.globalAlpha = 0.5;
    txt(ctx, '*', bx + 34, by - 2, '#ffcc33');
    ctx.globalAlpha = 1;
  }
  // el b-boy
  const move = t < view.moveUntil ? view.move : 'top';
  const pose = dancePose(move, t, view.beat);
  const lift = move === 'mill' || move === 'spin' ? 6 : move === 'freeze' ? 2 : 0;
  ctx.globalAlpha = 0.35;
  R(ctx, 78, 247, 24, 3, '#000');
  ctx.globalAlpha = 1;
  drawBody(ctx, 90, 233 - lift, pose, colors, 1.5);
  // brillo en los aciertos
  if (hype > 0.5) for (let i = 0; i < 6; i++) R(ctx, 90 + Math.cos(i + t * 6) * 22 * hype, 225 + Math.sin(i * 2 + t * 6) * 14, 2, 2, '#ffe066');
}

// ===========================================================================
// Perritos: escenario de Nathan's en Coney Island
// ===========================================================================

export interface ConeyView {
  cheer: number;
  now: number;
}

let coneyBase: HTMLCanvasElement | null = null;
function paintConey(ctx: CanvasRenderingContext2D) {
  const W = 180;
  bands(ctx, 0, 118, W, ['#4a9ae0', '#5aa6e6', '#6ab2ea', '#7cbeee', '#8ecaf0', '#a6d6f2']);
  disc(ctx, 150, 22, 10, '#fff6c8');
  disc(ctx, 150, 22, 8, '#fffbe6');
  // mar
  R(ctx, 0, 112, W, 8, '#2f7fc4');
  // Parachute Jump al fondo
  R(ctx, 100, 30, 2, 84, '#c0392b');
  for (let y = 36; y < 112; y += 6) R(ctx, 98, y, 6, 1, '#c0392b');
  R(ctx, 92, 26, 18, 4, '#c0392b');
  // Cyclone (estructura de madera)
  for (let x = 112; x < 180; x += 6) R(ctx, x, 60 + Math.abs(x - 146) * 0.6, 1, 60, '#e8e4d8');
  for (let y = 70; y < 120; y += 8) R(ctx, 112, y, 68, 1, '#d8d0c0');
  for (let x = 110; x < 180; x++) R(ctx, x, 56 + Math.abs(x - 146) * 0.6, 1, 3, '#c0392b');
  // paseo marítimo (boardwalk)
  R(ctx, 0, 118, W, 10, '#a4724a');
  for (let x = 0; x < W; x += 5) R(ctx, x, 118, 1, 10, '#8a5a33');
  // fachada de Nathan's
  R(ctx, 0, 128, W, 64, '#f4efe2');
  R(ctx, 0, 128, W, 22, '#1f7a3e');
  R(ctx, 0, 148, W, 2, '#ffcc33');
  txtC(ctx, "NATHAN'S FAMOUS", 90, 132, '#ffcc33', 2);
  for (let x = 0; x < W; x += 10) {
    R(ctx, x, 150, 5, 8, '#1f7a3e');
    R(ctx, x + 5, 150, 5, 8, '#f4efe2');
    R(ctx, x, 158, 10, 1, '#14101f');
  }
  // mostrador y carteles
  R(ctx, 6, 162, 52, 18, '#2a2420');
  txtC(ctx, 'HOT DOGS', 32, 165, '#ffcc33');
  txtC(ctx, '5 CENTS', 32, 172, '#ffffff');
  R(ctx, 122, 162, 52, 18, '#2a2420');
  txtC(ctx, 'SINCE 1916', 148, 165, '#ffcc33');
  txtC(ctx, 'FRIES', 148, 172, '#ffffff');
  // valla del público
  R(ctx, 0, 192, W, 4, '#c8ced2');
  // escenario del concurso
  R(ctx, 0, 222, W, 98, '#3a6ab0');
  R(ctx, 0, 222, W, 3, '#5a8ad0');
  for (let x = 0; x < W; x += 12) R(ctx, x, 226, 1, 94, '#2f5a9a');
}

/** Coney Island: noria que gira, montaña rusa, gaviotas, público y banderines. */
export function drawConey(ctx: CanvasRenderingContext2D, t: number, view: ConeyView) {
  view.now = t;
  if (!coneyBase) coneyBase = layer(180, 320, paintConey);
  ctx.drawImage(coneyBase, 0, 0);
  // brillos del mar
  for (let i = 0; i < 8; i++) if (Math.sin(t * 3 + i * 2) > 0.5) R(ctx, (i * 23 + t * 4) % 180, 113 + (i % 3) * 2, 3, 1, '#d8f0ff');
  // Wonder Wheel girando
  const cx = 42;
  const cy = 66;
  const r = 36;
  for (let a = 0; a < 16; a++) {
    const ang = (a / 16) * Math.PI * 2 + t * 0.25;
    for (let k = 4; k < r; k += 2) R(ctx, cx + Math.cos(ang) * k, cy + Math.sin(ang) * k, 1, 1, '#e8e4d8');
  }
  for (let a = 0; a < 90; a++) {
    const ang = (a / 90) * Math.PI * 2;
    R(ctx, cx + Math.cos(ang) * r, cy + Math.sin(ang) * r, 1, 1, '#c0392b');
  }
  disc(ctx, cx, cy, 3, '#ffcc33');
  R(ctx, cx - 1, cy, 2, 52, '#e8e4d8');
  R(ctx, cx - 12, cy + 50, 24, 2, '#e8e4d8');
  for (let a = 0; a < 8; a++) {
    const ang = (a / 8) * Math.PI * 2 + t * 0.25;
    const gx = cx + Math.cos(ang) * r;
    const gy = cy + Math.sin(ang) * r;
    R(ctx, gx - 3, gy + 1, 6, 5, ['#ff4f9a', '#4ff0ff', '#ffcc33', '#7dff6a'][a % 4]);
    R(ctx, gx - 1, gy - 1, 2, 2, '#e8e4d8');
  }
  // vagón del Cyclone
  const k = (t * 0.35) % 1;
  const vx = 110 + k * 70;
  const vy = 54 + Math.abs(vx - 146) * 0.6;
  R(ctx, vx, vy - 3, 8, 4, '#c0392b');
  R(ctx, vx + 1, vy - 5, 2, 2, '#f2d0b0');
  R(ctx, vx + 5, vy - 5, 2, 2, '#6c4228');
  // gaviotas
  for (let i = 0; i < 3; i++) {
    const gx = ((t * (10 + i * 4) + i * 70) % 220) - 20;
    const gy = 20 + i * 14 + Math.sin(t * 2 + i) * 4;
    const f = Math.floor(t * 6 + i) % 2;
    R(ctx, gx, gy, 2, 1, '#ffffff');
    R(ctx, gx + 2, gy + f, 1, 1, '#ffffff');
    R(ctx, gx - 1, gy - 1 + f, 1, 1, '#ffffff');
    R(ctx, gx + 3, gy - 1 + f, 1, 1, '#ffffff');
  }
  // público tras la valla, con banderas
  const cheer = Math.max(0, 1 - (t - view.cheer) / 1.4);
  for (let i = 0; i < 14; i++) {
    const x = 4 + i * 13;
    const jump = Math.round(Math.abs(Math.sin(t * (3 + cheer * 8) + i * 1.3)) * (0.6 + cheer * 4));
    bust(ctx, x, 182 - jump, 7, crowdie(i + 400));
    if (i % 4 === 1 || cheer > 0.3) {
      const fy = 168 - jump;
      const wave = Math.round(Math.sin(t * 8 + i) * 1);
      R(ctx, x + 6, fy, 1, 12, '#6b3f22');
      for (let s = 0; s < 4; s++) R(ctx, x + 7, fy + s * 1.5 + wave * (s % 2), 8, 1, s % 2 ? '#e8e4d8' : '#b22234');
      R(ctx, x + 7, fy, 3, 3, '#3c3b6e');
    }
  }
  R(ctx, 0, 192, 180, 2, '#e8eef2');
  for (let x = 4; x < 180; x += 12) R(ctx, x, 192, 2, 12, '#9aa0a6');
  // banderines de barras y estrellas
  for (let x = 0; x < 180; x += 6) {
    const y = 206 + Math.round(Math.abs(((x % 48) - 24) / 5));
    const c = ['#b22234', '#e8e4d8', '#3c3b6e'][(x / 6) % 3];
    R(ctx, x, y, 5, 3, c);
    R(ctx, x + 1, y + 3, 3, 1, c);
  }
}

// ===========================================================================
// Simon: sala recreativa
// ===========================================================================

export interface ArcadeView {
  lit: number | null;
  cheer: number;
  now: number;
}
export const SIMON_COLORS = ['#e8414f', '#3fbf6a', '#3b7bdc', '#ffd24a'];

let arcadeBase: HTMLCanvasElement | null = null;
function paintArcade(ctx: CanvasRenderingContext2D) {
  const W = 180;
  R(ctx, 0, 0, W, 320, '#0c0a1c');
  bands(ctx, 0, 190, W, ['#0a0818', '#0e0b22', '#120e2a', '#161232', '#1a1538']);
  // moqueta cósmica
  R(ctx, 0, 190, W, 130, '#141038');
  for (let i = 0; i < 70; i++) {
    const x = hash(i * 3) * W;
    const y = 192 + hash(i * 7) * 128;
    const c = ['#ff4f9a', '#4ff0ff', '#ffcc33', '#7dff6a', '#b05aff'][i % 5];
    if (i % 3 === 0) {
      R(ctx, x, y, 4, 1, c);
      R(ctx, x + 1, y - 1, 2, 3, c);
    } else if (i % 3 === 1) disc(ctx, x, y, 2, c);
    else {
      R(ctx, x, y, 3, 1, c);
      R(ctx, x + 3, y + 1, 3, 1, c);
    }
  }
  R(ctx, 0, 188, W, 3, '#2a2050');
}

function cabinet(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, hh: number, c: string, t: number, k: number) {
  R(ctx, x, y, w, hh, '#14101f');
  R(ctx, x + 1, y + 1, w - 2, hh - 2, shade(c, -0.55));
  // marquesina
  R(ctx, x + 2, y + 2, w - 4, Math.round(hh * 0.12), c);
  R(ctx, x + 2, y + 2, w - 4, 1, shade(c, 0.5));
  // pantalla con un juego que se mueve
  const sx = x + 4;
  const sy = y + Math.round(hh * 0.18);
  const sw = w - 8;
  const sh = Math.round(hh * 0.32);
  R(ctx, sx - 1, sy - 1, sw + 2, sh + 2, '#000');
  R(ctx, sx, sy, sw, sh, '#05060c');
  if (k % 3 === 0) {
    for (let i = 0; i < 3; i++) for (let j = 0; j < 4; j++) R(ctx, sx + 2 + j * 4 + Math.round(Math.sin(t * 2) * 2), sy + 2 + i * 3, 2, 2, ['#7dff6a', '#4ff0ff', '#ff4f9a'][i]);
    R(ctx, sx + ((t * 12) % sw), sy + sh - 3, 3, 2, '#ffffff');
  } else if (k % 3 === 1) {
    for (let i = 0; i < sw; i += 3) R(ctx, sx + i, sy + sh / 2, 1, 1, '#ffcc33');
    R(ctx, sx + ((t * 14) % sw), sy + sh / 2 - 2, 4, 4, '#ffe066');
    R(ctx, sx + ((t * 14 + 10) % sw), sy + sh / 2 - 2, 4, 4, '#ff4a5a');
  } else {
    for (let i = 0; i < 8; i++) R(ctx, sx + hash(i * 9) * sw, sy + ((hash(i) * sh + t * 20 * (1 + (i % 3))) % sh), 1, 1, '#ffffff');
    R(ctx, sx + sw / 2 - 2, sy + sh - 4, 4, 3, '#4ff0ff');
  }
  ctx.globalAlpha = 0.18;
  for (let i = sy; i < sy + sh; i += 2) R(ctx, sx, i, sw, 1, '#000');
  ctx.globalAlpha = 1;
  glow(ctx, sx + sw / 2, sy + sh / 2, sw, c, 0.22);
  // mandos
  const py = sy + sh + 4;
  R(ctx, x, py, w, 6, shade(c, -0.4));
  R(ctx, x + 4, py - 2, 2, 3, '#14101f');
  disc(ctx, x + 5, py - 3, 1, '#ff4a5a');
  R(ctx, x + w - 9, py + 1, 2, 2, '#ffcc33');
  R(ctx, x + w - 5, py + 1, 2, 2, '#4ff0ff');
}

/** Sala recreativa: máquinas con pantallas vivas, neones, chavales mirando. */
export function drawArcade(ctx: CanvasRenderingContext2D, t: number, view: ArcadeView) {
  view.now = t;
  if (!arcadeBase) arcadeBase = layer(180, 320, paintArcade);
  ctx.drawImage(arcadeBase, 0, 0);
  // rótulo de neón
  R(ctx, 40, 8, 100, 20, '#14101f');
  neon(ctx, 'GAME ROOM', 54, 12, '#ff4f9a', hash(Math.floor(t * 6)) > 0.05, 2);
  for (let i = 0; i < 24; i++) R(ctx, 42 + i * 4, 26, 2, 1, (i + Math.floor(t * 6)) % 4 === 0 ? '#4ff0ff' : '#1a3a4a');
  // máquinas del fondo
  for (let i = 0; i < 5; i++) cabinet(ctx, 22 + i * 28, 70, 24, 116, ['#3b7bdc', '#e8414f', '#7dff6a', '#ffd24a', '#b05aff'][i], t + i, i);
  // máquinas a los lados (más cerca)
  cabinet(ctx, -14, 120, 40, 200, '#ff4f9a', t, 1);
  cabinet(ctx, 154, 120, 40, 200, '#4ff0ff', t + 2, 0);
  // luz del color encendido del Simon
  if (view.lit !== null) glow(ctx, 90, 170, 120, SIMON_COLORS[view.lit], 0.55);
  // chavales mirando, de espaldas
  const cheer = Math.max(0, 1 - (t - view.cheer) / 1.4);
  for (let i = 0; i < 7; i++) {
    const x = 14 + i * 26;
    const jump = Math.round(Math.abs(Math.sin(t * (2 + cheer * 9) + i * 1.9)) * (0.5 + cheer * 4));
    bust(ctx, x, 290 - jump - (i % 2) * 5, 11, crowdie(i + 500), true);
    if (cheer > 0.25) {
      const c = crowdie(i + 500);
      R(ctx, x + 9, 270 - jump - Math.round(Math.sin(t * 12 + i) * 2), 3, 14, c.coat);
      R(ctx, x + 8, 266 - jump - Math.round(Math.sin(t * 12 + i) * 2), 5, 4, c.skin);
    }
  }
}

// ===========================================================================
// Maratón: por las calles de Nueva York con paralaje
// ===========================================================================

export interface Npc {
  x: number;
  v: number;
  ph: number;
  lane: number;
  c: BodyColors;
  bib: number;
}
export interface RunView {
  dist: number;
  v: number;
  tired: boolean;
  ph: number;
  npcs: Npc[];
  last: number;
  now: number;
}
const RUN_SCALE = 6;
const RUN_X = 62;

export function runView(): RunView {
  const tops = ['#c0392b', '#2f6fb3', '#2e8b57', '#e2a23b', '#7b4fa0', '#e8619e'];
  const npcs: Npc[] = Array.from({ length: 5 }, (_, i) => ({
    x: 20 + i * 40,
    v: 6 + hash(i * 3) * 3.5,
    ph: hash(i) * 6,
    lane: i % 2,
    bib: 100 + Math.floor(hash(i * 7) * 899),
    c: { skin: ['#f2d0b0', '#deac84', '#c18a5c', '#9a6440', '#6c4228'][i % 5], top: tops[i % tops.length], legs: '#1c1c28', shoes: '#e8e4d8', hair: ['#1c1818', '#8a5a2b', '#d8b45e'][i % 3] },
  }));
  return { dist: 0, v: 0, tired: false, ph: 0, npcs, last: -1, now: 0 };
}

const SIGNS = ['GO!', 'NYC', 'RUN!', 'VAMOS', '85', 'TU PUEDES', 'GO MOM', 'ANIMO'];

/** Recorrido del maratón: skyline, puente, fachadas, público con carteles. */
export function drawMarathon(ctx: CanvasRenderingContext2D, t: number, view: RunView, kmFactor: number, me: BodyColors, kmEvery: number) {
  const km = view.dist / kmFactor;
  const dt = view.last < 0 ? 0 : Math.min(0.1, t - view.last);
  view.last = t;
  view.now = t;
  const W = 180;
  const off = view.dist * RUN_SCALE;
  // cielo de mañana de noviembre
  bands(ctx, 0, 150, W, ['#5a8ad8', '#6a98dc', '#7aa6e0', '#8ab4e4', '#a2c2e6', '#bcd0e6', '#e0d4c8', '#f0d8b8']);
  for (let i = 0; i < 3; i++) {
    const x = ((i * 80 - off * 0.03 - t * 2) % 260 + 260) % 260 - 40;
    R(ctx, x, 14 + i * 12, 30, 5, '#eef4ff');
    R(ctx, x + 6, 11 + i * 12, 16, 4, '#eef4ff');
  }
  // skyline lejano (Torres Gemelas y Empire State)
  const so = off * 0.08;
  for (let i = -1; i < 8; i++) {
    const bx = i * 40 - (so % 40);
    const seg = Math.floor(so / 40) + i;
    const hgt = 30 + hash(seg) * 30;
    R(ctx, bx, 130 - hgt, 18, hgt, '#8a9ab8');
    R(ctx, bx + 20, 130 - hgt * 0.7, 14, hgt * 0.7, '#7d8daa');
    if (seg % 5 === 0) {
      R(ctx, bx + 4, 50, 8, 80, '#7a88a6');
      R(ctx, bx + 14, 50, 8, 80, '#8492ae');
      R(ctx, bx + 9, 44, 1, 6, '#7a88a6');
    }
    if (seg % 5 === 3) {
      R(ctx, bx + 6, 62, 12, 68, '#7d8daa');
      R(ctx, bx + 9, 52, 6, 10, '#7d8daa');
      R(ctx, bx + 11, 42, 2, 10, '#7d8daa');
    }
  }
  // puente colgante (Verrazano)
  const bo = off * 0.2;
  const span = 260;
  for (let i = -1; i < 2; i++) {
    const tx = i * span - (bo % span);
    for (const px of [tx, tx + span]) {
      R(ctx, px, 70, 4, 76, '#5a6a8a');
      R(ctx, px - 1, 70, 6, 2, '#5a6a8a');
      R(ctx, px, 96, 4, 2, '#4a5a7a');
    }
    for (let x = 0; x < span; x += 2) {
      const u = x / span;
      R(ctx, tx + 2 + x, 72 + 52 * 4 * u * (1 - u), 2, 1, '#5a6a8a');
      if (x % 8 === 0) R(ctx, tx + 2 + x, 72 + 52 * 4 * u * (1 - u), 1, 126 - (72 + 52 * 4 * u * (1 - u)), 'rgba(90,106,138,0.55)');
    }
    R(ctx, tx, 126, span + 4, 4, '#4a5a7a');
  }
  // fachadas: brownstones y tiendas
  const mo = off * 0.55;
  for (let i = -1; i < 8; i++) {
    const seg = Math.floor(mo / 30) + i;
    const bx = i * 30 - (mo % 30);
    const hgt = 60 + hash(seg * 3) * 30;
    const col = ['#8a4a3a', '#a4683e', '#6e5a4e', '#9a8a7a', '#7d4a3e', '#b07a50'][Math.floor(hash(seg * 5) * 6)];
    const top = 190 - hgt;
    R(ctx, bx, top, 30, hgt, col);
    R(ctx, bx, top, 30, 3, shade(col, 0.25));
    R(ctx, bx + 29, top, 1, hgt, shade(col, -0.3));
    for (let y = top + 8; y < 168; y += 11)
      for (let wx = bx + 4; wx < bx + 26; wx += 8) {
        R(ctx, wx, y, 5, 7, '#2a3a5a');
        R(ctx, wx, y, 5, 1, shade(col, 0.3));
        R(ctx, wx + 1, y + 1, 1, 2, '#6a8aba');
      }
    // escalera de incendios
    if (seg % 3 === 1) for (let y = top + 16; y < 160; y += 11) R(ctx, bx + 3, y, 24, 1, '#2a2a30');
    // tienda con toldo
    const aw = ['#c0392b', '#1f7a3e', '#2f6fb3', '#e2a23b'][Math.floor(hash(seg * 7) * 4)];
    for (let x = 0; x < 30; x += 4) R(ctx, bx + x, 168, 4, 5, x % 8 ? '#f4efe2' : aw);
    R(ctx, bx + 2, 173, 26, 17, '#3a3040');
    R(ctx, bx + 4, 175, 22, 10, '#ffe9a8');
    if (seg % 2 === 0) txt(ctx, ['DELI', 'PIZZA', 'BAR', 'SHOES', 'DINER'][Math.floor(hash(seg) * 5)], bx + 4, 162, '#ffffff');
  }
  // público tras las vallas, con carteles
  const co = off;
  for (let i = -1; i < 25; i++) {
    const seg = Math.floor(co / 8) + i;
    const x = i * 8 - (co % 8);
    const jump = Math.round(Math.abs(Math.sin(t * 6 + seg)) * 1.5);
    bust(ctx, x + 4, 182 - jump - (seg % 2) * 3, 5, crowdie(seg + 600));
    if (seg % 9 === 0) {
      const s = SIGNS[Math.floor(hash(seg) * SIGNS.length)];
      const sw = s.length * 4 + 3;
      R(ctx, x + 4, 176 - jump, 1, 10, '#6b3f22');
      R(ctx, x + 4 - sw / 2, 166 - jump, sw, 9, '#f4efe2');
      txt(ctx, s, x + 6 - sw / 2, 168 - jump, ['#c0392b', '#2f6fb3', '#1f7a3e'][seg % 3]);
    }
  }
  R(ctx, 0, 195, W, 2, '#3a7ac4');
  for (let i = -1; i < 20; i++) {
    const x = i * 12 - (co % 12);
    R(ctx, x, 193, 10, 6, '#3a7ac4');
    R(ctx, x + 1, 194, 8, 1, '#ffffff');
  }
  // asfalto con la línea azul del maratón
  R(ctx, 0, 199, W, 62, '#4a4650');
  for (let i = 0; i < 40; i++) R(ctx, ((hash(i) * 400 - off) % 180 + 180) % 180, 200 + hash(i * 3) * 60, 2, 1, '#55515c');
  R(ctx, 0, 229, W, 2, '#3a8ad8');
  for (let i = -1; i < 10; i++) R(ctx, i * 24 - (off % 24), 214, 12, 1, '#c8c4bc');
  // pancarta de kilómetro (cada kmEvery)
  const nextKm = (Math.floor(km / kmEvery) + 1) * kmEvery;
  for (const k of [nextKm - kmEvery, nextKm]) {
    if (k <= 0) continue;
    const gx = RUN_X + (k * kmFactor - view.dist) * RUN_SCALE;
    if (gx < -60 || gx > 220) continue;
    R(ctx, gx - 30, 130, 3, 100, '#c8ced2');
    R(ctx, gx + 30, 130, 3, 100, '#c8ced2');
    R(ctx, gx - 30, 128, 63, 14, '#c0392b');
    R(ctx, gx - 30, 128, 63, 1, '#ff6a5a');
    txtC(ctx, `KM ${k}`, gx + 1, 133, '#ffffff');
  }
  // corredores rivales (detrás) y el jugador
  const draw = (n: Npc) => {
    const y = n.lane ? 214 : 222;
    ctx.globalAlpha = 0.3;
    R(ctx, n.x - 5, y + 11, 12, 2, '#000');
    ctx.globalAlpha = 1;
    drawBody(ctx, n.x, y, runPose(n.ph), n.c, 1);
    R(ctx, n.x - 2, y - 7, 4, 3, '#ffffff');
  };
  for (const n of view.npcs) {
    n.ph += n.v * dt * 1.25;
    n.x += (n.v - view.v) * RUN_SCALE * dt;
    if (n.x < -30) {
      n.x = 210;
      n.v = 6 + Math.random() * 3.5;
    }
    if (n.x > 230) {
      n.x = -25;
      n.v = 6 + Math.random() * 3.5;
    }
  }
  for (const n of view.npcs) if (n.lane === 1) draw(n);
  view.ph += (view.tired ? 3.5 : Math.max(0.6, view.v)) * dt * 1.25;
  const amp = view.tired ? 0.45 : Math.min(1.2, 0.35 + view.v / 9);
  const py = 226 + (view.tired ? 1 : -Math.abs(Math.sin(view.ph)) * 1.5);
  ctx.globalAlpha = 0.35;
  R(ctx, RUN_X - 7, 245, 16, 3, '#000');
  ctx.globalAlpha = 1;
  drawBody(ctx, RUN_X, py, runPose(view.ph, amp, view.tired ? 0.45 : 0.15 + view.v / 60), me, 1.4);
  R(ctx, RUN_X - 3, py - 9, 6, 4, '#ffffff');
  R(ctx, RUN_X - 2, py - 8, 4, 1, '#c0392b');
  if (view.tired && Math.floor(t * 3) % 2) txt(ctx, '*', RUN_X + 8, py - 22, '#7fd0ff');
  if (!view.tired && view.v > 9.5) for (let i = 0; i < 3; i++) R(ctx, RUN_X - 14 - i * 6, py - 8 + i * 5, 4, 1, '#ffffff');
  for (const n of view.npcs) if (n.lane === 0) draw(n);
  // bordillo y público de primer plano (bajo el marcador)
  R(ctx, 0, 261, W, 4, '#9a9792');
  R(ctx, 0, 265, W, 95, '#7a7773');
  const fo = off * 1.4;
  for (let i = -1; i < 9; i++) {
    const seg = Math.floor(fo / 22) + i;
    bust(ctx, i * 22 - (fo % 22) + 11, 276 + (seg % 2) * 4, 13, crowdie(seg + 900), true);
  }
  if (!lowFx()) {
    ctx.globalAlpha = 0.12;
    R(ctx, 0, 0, W, 360, '#ffd8a8');
    ctx.globalAlpha = 1;
  }
}
