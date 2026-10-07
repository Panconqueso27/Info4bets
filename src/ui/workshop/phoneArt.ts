import { drawText } from '../../art/pixelfont';
import { COLOR_BY_ID, EXTRA_BY_ID, PART_BY_ID, sizeOf, type Part, type PhoneDesign, type Placed } from '../../core/phonecore';
import { shade } from '../../art/character';

/**
 * Dibujo en pixel art del móvil del taller: carcasa, placa base,
 * componentes con sus patas y etiquetas, y una pantalla que funciona
 * (reloj, menús, la serpiente, iconos…) según su gama.
 *
 * Todo se dibuja a 8 píxeles por celda y se amplía sin suavizado.
 */
export const PX = 8;
/** Márgenes de la carcasa alrededor de la cuadrícula (arriba hay sitio para la antena). */
export const M = { x: 5, top: 11, bottom: 7 };

type Ctx = CanvasRenderingContext2D;
const R = (c: Ctx, x: number, y: number, w: number, h: number, col: string) => {
  c.fillStyle = col;
  c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
};

/** Rectángulo con esquinas redondeadas en píxeles. */
function round(c: Ctx, x: number, y: number, w: number, h: number, r: number, col: string) {
  for (let i = 0; i < h; i++) {
    const d = i < r ? r - Math.round(Math.sqrt(r * r - (r - i - 0.5) ** 2)) : i >= h - r ? r - Math.round(Math.sqrt(r * r - (i - (h - r) + 0.5) ** 2)) : 0;
    R(c, x + d, y + i, w - d * 2, 1, col);
  }
}

export function canvasSize(shape: Part) {
  return { w: shape.w * PX + M.x * 2, h: shape.h * PX + M.top + M.bottom };
}

const RADIUS: Record<string, number> = { ladrillo: 3, clasico: 6, compacto: 7, concha: 6, deslizante: 5, cromo: 7, curvo: 12, titanio: 6, cristal: 8, futuro: 10 };

/** Dibuja el móvil completo en su capa. */
export function drawPhone(c: Ctx, d: PhoneDesign, layer: 'front' | 'inside', t: number) {
  const shape = PART_BY_ID[d.shape];
  const { w, h } = canvasSize(shape);
  c.clearRect(0, 0, w, h);
  const col = COLOR_BY_ID[d.color ?? 'negro']?.hex ?? '#2a2a33';
  const r = RADIUS[shape.look] ?? 6;
  const ox = M.x;
  const oy = M.top;
  const extras = new Set(d.extras ?? []);
  // antena extensible: sale por arriba a la derecha
  if (extras.has('antena')) {
    R(c, w - M.x - 8, 0, 2, M.top + 2, '#2a2a33');
    R(c, w - M.x - 9, 0, 4, 2, '#14101f');
    R(c, w - M.x - 8, 1, 1, M.top, '#8a8e94');
  }
  // sombra y carcasa
  round(c, 1, 3 + 2, w - 2, h - 5, r, 'rgba(0,0,0,0.35)');
  round(c, 0, 3, w - 1, h - 4, r, '#14101f');
  const body = shape.look === 'cromo' ? '#c8ccd2' : shape.look === 'titanio' ? '#9aa0a8' : shape.look === 'cristal' ? 'rgba(170,220,240,0.55)' : col;
  round(c, 1, 4, w - 3, h - 6, r - 1, body);
  // brillo arriba a la izquierda y sombra abajo a la derecha
  round(c, 2, 5, w - 8, 2, Math.max(1, r - 2), shade(body.startsWith('#') ? body : '#a8d8ea', 0.25));
  R(c, w - 4, 8 + r, 1, h - 16 - r * 2, shade(body.startsWith('#') ? body : '#6a9aaa', -0.3));
  if (shape.look === 'cromo' || shape.look === 'titanio')
    for (let x = 4; x < w - 4; x += 5) R(c, x, 6, 1, h - 12, 'rgba(255,255,255,0.14)');
  if (shape.look === 'futuro') {
    R(c, 1, h / 2, 1, 10, '#ff4f9a');
    R(c, w - 3, h / 2 - 12, 1, 10, '#4ff0ff');
  }
  // botones laterales
  R(c, -0, oy + 10, 1, 8, shade(col, -0.4));
  R(c, w - 2, oy + 16, 1, 5, shade(col, -0.4));

  if (layer === 'inside') drawInside(c, d, ox, oy, shape, t);
  else drawFront(c, d, ox, oy, shape, t, col);
}

// ---------------------------------------------------------------------------
// Interior: placa base, pistas y componentes
// ---------------------------------------------------------------------------

function drawInside(c: Ctx, d: PhoneDesign, ox: number, oy: number, shape: Part, t: number) {
  const W = shape.w * PX;
  const H = shape.h * PX;
  // placa verde con agujeros de tornillo, rejilla de pistas y conector dorado
  R(c, ox - 1, oy - 1, W + 2, H + 2, '#0e3a20');
  R(c, ox, oy, W, H, '#1f6a3a');
  for (let y = oy + 3; y < oy + H; y += 6) for (let x = ox + 2; x < ox + W; x += 9) R(c, x, y, 3, 1, 'rgba(160,220,120,0.18)');
  for (let x = ox + 4; x < ox + W; x += 7) R(c, x, oy + 1, 1, H - 2, 'rgba(160,220,120,0.08)');
  for (const [x, y] of [
    [ox + 2, oy + 2],
    [ox + W - 5, oy + 2],
    [ox + 2, oy + H - 5],
    [ox + W - 5, oy + H - 5],
  ]) {
    R(c, x, y, 3, 3, '#c8a040');
    R(c, x + 1, y + 1, 1, 1, '#0a1a10');
  }
  for (let x = ox + W / 2 - 8; x < ox + W / 2 + 8; x += 2) R(c, x, oy + H - 2, 1, 2, '#e8c050');
  // pistas doradas entre el procesador y lo demás
  const cpu = d.procesador;
  const center = (pl: Placed) => {
    const s = sizeOf(pl);
    return { x: ox + (pl.x + s.w / 2) * PX, y: oy + (pl.y + s.h / 2) * PX };
  };
  if (cpu)
    for (const other of [d.memoria, d.bateria]) {
      if (!other) continue;
      const a = center(cpu);
      const b = center(other);
      for (let k = -2; k <= 2; k += 2) {
        c.fillStyle = 'rgba(232,192,80,0.75)';
        const mx = a.x + k;
        c.fillRect(Math.min(mx, mx), Math.min(a.y, b.y) + k, 1, Math.abs(b.y - a.y));
        c.fillRect(Math.min(mx, b.x), b.y + k, Math.abs(b.x - mx), 1);
      }
    }
  // condensadores y resistencias sueltos (decoración fija)
  for (let i = 0; i < 9; i++) {
    const x = ox + 3 + ((i * 29) % (W - 8));
    const y = oy + 4 + ((i * 47) % (H - 8));
    R(c, x, y, 2, 1, i % 2 ? '#c8a040' : '#d8d4c6');
    R(c, x, y + 1, 2, 1, '#14101f');
  }
  for (const k of ['bateria', 'memoria', 'procesador'] as const) {
    const pl = d[k];
    if (pl) drawPart(c, PART_BY_ID[pl.id], ox + pl.x * PX, oy + pl.y * PX, sizeOf(pl).w * PX, sizeOf(pl).h * PX, t, pl.rot);
  }
}

// ---------------------------------------------------------------------------
// Frontal: altavoz, teclado, pantalla y cámara
// ---------------------------------------------------------------------------

function drawFront(c: Ctx, d: PhoneDesign, ox: number, oy: number, shape: Part, t: number, col: string) {
  const W = shape.w * PX;
  const H = shape.h * PX;
  // en las de cristal se ve el interior
  if (shape.look === 'cristal') {
    c.globalAlpha = 0.25;
    drawInside(c, d, ox, oy, shape, t);
    c.globalAlpha = 1;
  }
  // auricular y marca
  R(c, ox + W / 2 - 6, oy - 6, 12, 2, '#14101f');
  for (let x = ox + W / 2 - 5; x < ox + W / 2 + 5; x += 2) R(c, x, oy - 6, 1, 1, '#3a3a46');
  drawText(c, 'PXL', ox + W / 2 - 5, oy + H + 1, shade(col, -0.45));
  // teclado de verdad bajo la pantalla: llamar/colgar, cruceta y 3 × 4 teclas
  const scr = d.pantalla;
  const cam = d.camara;
  const touch = scr && ['tactil', 'holo'].includes(PART_BY_ID[scr.id].look);
  const qwerty = (d.extras ?? []).includes('qwerty');
  let top = Math.floor(shape.h * 0.45);
  for (const pl of [scr, cam]) if (pl && pl.y < shape.h) top = Math.max(top, pl.y + sizeOf(pl).h);
  const ky = oy + top * PX + 2;
  const kh = oy + H - 2 - ky;
  if (!touch && kh >= 14) {
    const light = shade(col, 0.4);
    const dark = shade(col, -0.45);
    const key = (x: number, y: number, w: number, h: number, face: string, label?: string, ink = dark) => {
      R(c, x, y + 1, w, h, shade(face, -0.4));
      R(c, x, y, w, h, face);
      R(c, x, y, w, 1, shade(face, 0.3));
      if (label && h >= 6 && w >= 4) drawText(c, label, x + Math.floor((w - 3) / 2), y + Math.floor((h - 5) / 2), ink);
    };
    // fila de navegación
    const navH = Math.min(9, Math.floor(kh * 0.28));
    if (navH >= 5) {
      key(ox + 2, ky, 8, navH - 2, '#35d07f');
      key(ox + W - 10, ky, 8, navH - 2, '#e8414f');
      const cx = ox + W / 2;
      round(c, cx - 7, ky - 1, 14, navH, 4, shade(col, -0.25));
      round(c, cx - 5, ky, 10, navH - 2, 3, light);
      R(c, cx - 1, ky + 1, 2, navH - 4, dark);
    }
    const ry = ky + (navH >= 5 ? navH + 1 : 0);
    const rh = oy + H - 2 - ry;
    if (qwerty) {
      const cols = 10;
      const rows = Math.min(4, Math.max(1, Math.floor(rh / 4)));
      const kw = Math.max(2, Math.floor((W - 4) / cols) - 1);
      const kkh = Math.max(2, Math.floor(rh / rows) - 1);
      for (let r2 = 0; r2 < rows; r2++) for (let k = 0; k < cols - (r2 === rows - 1 ? 2 : 0); k++) key(ox + 2 + k * (kw + 1) + (r2 === rows - 1 ? kw : 0), ry + r2 * (kkh + 1), kw, kkh, light);
    } else {
      const labels = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '+', '0', '-'];
      const kw = Math.floor((W - 6) / 3) - 2;
      const kkh = Math.max(3, Math.floor(rh / 4) - 2);
      labels.forEach((l, i) => key(ox + 3 + (i % 3) * (kw + 2), ry + Math.floor(i / 3) * (kkh + 2), kw, kkh, light, l));
    }
  }
  if (shape.look === 'concha') {
    R(c, ox - 4, oy + H / 2 - 2, W + 8, 4, '#8a8e94');
    R(c, ox - 4, oy + H / 2 - 2, W + 8, 1, '#d8dce2');
  }
  if (shape.look === 'deslizante') R(c, ox, oy + Math.floor(H * 0.55) - 2, W, 1, shade(col, -0.5));
  // extras visibles en el frontal
  const ex = new Set(d.extras ?? []);
  if (ex.has('linterna')) {
    R(c, ox + W - 6, oy - 7, 4, 3, '#fff8d0');
    if (Math.floor(t * 2) % 4 === 0) R(c, ox + W - 7, oy - 8, 6, 5, 'rgba(255,248,200,0.35)');
  }
  if (ex.has('altavoz')) {
    for (let x = ox + 2; x < ox + 10; x += 2) R(c, x, oy + H + 2, 1, 2, '#14101f');
    for (let x = ox + W - 10; x < ox + W - 2; x += 2) R(c, x, oy + H + 2, 1, 2, '#14101f');
  }
  if (ex.has('huella')) {
    R(c, ox + W / 2 - 3, oy + H + 1, 6, 4, '#14101f');
    R(c, ox + W / 2 - 2, oy + H + 2, 4, 2, '#4ff0ff');
  }
  if (ex.has('solar')) for (let x = ox + 2; x < ox + W - 2; x += 3) R(c, x, oy - 9, 2, 2, '#2f4f9a');
  for (const k of ['pantalla', 'camara'] as const) {
    const pl = d[k];
    if (pl) drawPart(c, PART_BY_ID[pl.id], ox + pl.x * PX, oy + pl.y * PX, sizeOf(pl).w * PX, sizeOf(pl).h * PX, t, pl.rot);
  }
}

// ---------------------------------------------------------------------------
// Componentes
// ---------------------------------------------------------------------------

/** Dibuja una pieza en su rectángulo (en píxeles). */
export function drawPart(c: Ctx, p: Part, x: number, y: number, w: number, h: number, t: number, rot = false) {
  if (p.kind === 'pantalla') return drawScreen(c, p, x, y, w, h, t, rot);
  if (p.kind === 'camara') return drawCamera(c, p, x, y, w, h);
  if (p.kind === 'procesador') return drawChip(c, p, x, y, w, h, t);
  if (p.kind === 'memoria') return drawRam(c, p, x, y, w, h);
  if (p.kind === 'bateria') return drawBattery(c, p, x, y, w, h);
  if (p.kind === 'forma') return drawShapeIcon(c, p, x, y, w, h);
}

function drawChip(c: Ctx, p: Part, x: number, y: number, w: number, h: number, t: number) {
  // patas plateadas por los cuatro lados
  for (let i = x + 2; i < x + w - 2; i += 2) {
    R(c, i, y, 1, 2, '#c8ccd2');
    R(c, i, y + h - 2, 1, 2, '#c8ccd2');
  }
  for (let j = y + 2; j < y + h - 2; j += 2) {
    R(c, x, j, 2, 1, '#c8ccd2');
    R(c, x + w - 2, j, 2, 1, '#c8ccd2');
  }
  R(c, x + 2, y + 2, w - 4, h - 4, '#1a1a22');
  R(c, x + 2, y + 2, w - 4, 1, '#3a3a46');
  R(c, x + 3, y + 3, 1, 1, '#8a8e94');
  const tier = p.q;
  // tapa metálica o núcleo brillante en los buenos
  if (tier >= 5) {
    R(c, x + w / 2 - 3, y + h / 2 - 3, 6, 6, tier >= 9 ? '#4ff0ff' : '#c8a040');
    R(c, x + w / 2 - 2, y + h / 2 - 2, 4, 4, tier >= 9 ? '#14101f' : '#e8c860');
    if (tier >= 9 && Math.floor(t * 3) % 2) R(c, x + w / 2 - 1, y + h / 2 - 1, 2, 2, '#ff4f9a');
  }
  if (w >= 12) drawText(c, `${Math.min(99, tier * 8)}`, x + 3, y + h - 8, '#8a8e94');
}

function drawRam(c: Ctx, p: Part, x: number, y: number, w: number, h: number) {
  const vertical = h > w;
  R(c, x + 1, y + 1, w - 2, h - 2, '#14101f');
  // patas a lo largo de los lados largos
  if (vertical)
    for (let j = y + 2; j < y + h - 2; j += 2) {
      R(c, x, j, 1, 1, '#c8ccd2');
      R(c, x + w - 1, j, 1, 1, '#c8ccd2');
    }
  else
    for (let i = x + 2; i < x + w - 2; i += 2) {
      R(c, i, y, 1, 1, '#c8ccd2');
      R(c, i, y + h - 1, 1, 1, '#c8ccd2');
    }
  R(c, x + 2, y + 2, w - 4, 2, p.q >= 6 ? '#2f6fb3' : '#5a5e64');
  R(c, x + 2, y + 2, 1, 1, '#ffffff');
}

function drawBattery(c: Ctx, p: Part, x: number, y: number, w: number, h: number) {
  const cols = ['#c0392b', '#7a7a5a', '#7a7a5a', '#3a7a4a', '#3a7a4a', '#2f6fb3', '#2f6fb3', '#7b4fa0', '#e2a23b', '#14101f'];
  const col = cols[p.q - 1];
  if (p.look === 'b1') {
    // pilas AA en fila
    const n = Math.max(1, Math.floor(w / 6));
    for (let i = 0; i < n; i++) {
      const px = x + 1 + i * (w / n);
      R(c, px, y + 2, w / n - 2, h - 3, '#c0392b');
      R(c, px, y + 2, w / n - 2, (h - 3) * 0.3, '#e8c050');
      R(c, px + (w / n - 2) / 2 - 1, y + 1, 2, 1, '#c8ccd2');
    }
    return;
  }
  R(c, x + 1, y + 1, w - 2, h - 2, '#14101f');
  R(c, x + 2, y + 2, w - 4, h - 4, col);
  R(c, x + 2, y + 2, w - 4, 1, shade(col, 0.35));
  // etiqueta con la carga
  R(c, x + 3, y + h / 2 - 3, w - 6, 7, '#f4efe2');
  drawText(c, p.look === 'b6' ? 'GRF' : p.cap && p.cap >= 9 ? 'LI' : 'NI', x + 4, y + h / 2 - 2, '#14101f');
  // carga en barras
  const bars = Math.min(4, Math.ceil((p.cap ?? 0) / 4));
  for (let i = 0; i < bars; i++) R(c, x + w - 7 + i, y + h / 2 + 1 - i, 1, i + 1, '#35d07f');
  // bornes
  R(c, x + 3, y, 3, 2, '#c8a040');
  R(c, x + w - 6, y, 3, 2, '#8a8e94');
}

function drawCamera(c: Ctx, p: Part, x: number, y: number, w: number, h: number) {
  R(c, x, y, w, h, '#14101f');
  R(c, x + 1, y + 1, w - 2, h - 2, '#2a2a33');
  const lens = (cx: number, cy: number, r: number, gold = false) => {
    c.fillStyle = gold ? '#c8a040' : '#8a8e94';
    c.beginPath();
    c.arc(cx, cy, r, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#0a0a14';
    c.beginPath();
    c.arc(cx, cy, r - 1, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#2a4a8a';
    c.beginPath();
    c.arc(cx, cy, Math.max(1, r - 2.2), 0, Math.PI * 2);
    c.fill();
    R(c, cx - r / 2, cy - r / 2, 1, 1, '#ffffff');
  };
  const small = p.look === 'c1';
  const two = p.id === 'c-doble';
  const flash = p.look === 'c3' || p.look === 'c5';
  if (two) {
    lens(x + PX / 2, y + h / 2, 3);
    lens(x + PX * 1.5, y + h / 2, 3);
  } else if (flash && w > h) {
    lens(x + PX / 2, y + h / 2, small ? 1.5 : 3);
    R(c, x + PX + 2, y + h / 2 - 1, 3, 3, '#fff8d0');
    R(c, x + PX + 3, y + h / 2, 1, 1, '#ffcc33');
  } else lens(x + w / 2, y + h / 2, small ? 1.5 : Math.min(w, h) / 2 - 1, p.look === 'c6');
}

/** Icono de carcasa para el cajón. */
function drawShapeIcon(c: Ctx, p: Part, x: number, y: number, w: number, h: number) {
  round(c, x, y, w, h, Math.min(4, RADIUS[p.look] ?? 4), '#14101f');
  round(c, x + 1, y + 1, w - 2, h - 2, Math.min(3, RADIUS[p.look] ?? 3), p.look === 'cromo' ? '#c8ccd2' : p.look === 'titanio' ? '#9aa0a8' : p.look === 'cristal' ? '#a8d8ea' : p.look === 'futuro' ? '#ff4f9a' : '#3a3a46');
  R(c, x + 3, y + 3, w - 6, h * 0.35, '#7a9a50');
  if (p.look === 'concha') R(c, x, y + h / 2, w, 1, '#c8ccd2');
}

// ---------------------------------------------------------------------------
// La pantalla encendida
// ---------------------------------------------------------------------------

const ICON_COLS = ['#ff4f9a', '#ffcc33', '#35d07f', '#4ff0ff', '#e8414f', '#7b4fa0', '#2f6fb3', '#ff8a3b'];

function clock(t: number) {
  const d = new Date();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}${Math.floor(t * 2) % 2 ? ':' : ' '}${mm}`;
}

function drawScreen(c: Ctx, p: Part, x: number, y: number, w: number, h: number, t: number, rot: boolean) {
  // marco negro y cristal
  R(c, x, y, w, h, '#0a0a10');
  const sx = x + 1;
  const sy = y + 1;
  const sw = w - 2;
  const sh = h - 2;
  c.save();
  c.beginPath();
  c.rect(sx, sy, sw, sh);
  c.clip();
  if (rot) {
    // girada: el contenido sale de lado
    c.translate(sx + sw, sy);
    c.rotate(Math.PI / 2);
    screenContent(c, p, 0, 0, sh, sw, t);
  } else screenContent(c, p, sx, sy, sw, sh, t);
  c.restore();
  // reflejo del cristal
  c.fillStyle = 'rgba(255,255,255,0.10)';
  c.beginPath();
  c.moveTo(sx, sy);
  c.lineTo(sx + sw * 0.45, sy);
  c.lineTo(sx, sy + sh * 0.6);
  c.fill();
}

function screenContent(c: Ctx, p: Part, x: number, y: number, w: number, h: number, t: number) {
  switch (p.look) {
    case 'led': {
      R(c, x, y, w, h, '#1a0404');
      drawText(c, clock(t), x + Math.max(1, (w - 19) / 2), y + Math.max(1, (h - 5) / 2), '#ff3b3b');
      break;
    }
    case 'mono':
    case 'ambar': {
      const bg = p.look === 'mono' ? '#9ab868' : '#e8a840';
      const ink = p.look === 'mono' ? '#1e2a14' : '#3a2010';
      R(c, x, y, w, h, bg);
      for (let i = 0; i < 4; i++) R(c, x + 2 + i * 2, y + 6 - i, 1, i + 1, ink);
      R(c, x + w - 8, y + 2, 5, 3, ink);
      R(c, x + w - 3, y + 3, 1, 1, ink);
      drawText(c, clock(t), x + (w - 19) / 2, y + 9, ink);
      if (h > 20) {
        const items = ['AGENDA', 'SMS', 'JUEGOS'];
        const sel = Math.floor(t / 1.5) % items.length;
        items.forEach((it, i) => {
          const iy = y + 17 + i * 7;
          if (iy + 6 > y + h) return;
          if (i === sel) R(c, x + 1, iy - 1, w - 2, 7, ink);
          drawText(c, it, x + 3, iy, i === sel ? bg : ink);
        });
      } else drawText(c, 'MENU', x + (w - 15) / 2, y + h - 7, ink);
      break;
    }
    case 'gris': {
      // la serpiente
      R(c, x, y, w, h, '#b8bcb0');
      R(c, x + 1, y + 1, w - 2, h - 2, '#a8aca0');
      const cells = Math.floor((w - 4) / 2);
      const rows = Math.floor((h - 10) / 2);
      const step = Math.floor(t * 6);
      const path = (k: number) => {
        const n = (step - k + 1000) % (cells * 2 + rows * 2);
        if (n < cells) return { cx: n, cy: 0 };
        if (n < cells + rows) return { cx: cells - 1, cy: n - cells };
        if (n < cells * 2 + rows) return { cx: cells - 1 - (n - cells - rows), cy: rows - 1 };
        return { cx: 0, cy: rows - 1 - (n - cells * 2 - rows) };
      };
      for (let k = 0; k < 6; k++) {
        const s = path(k);
        R(c, x + 2 + s.cx * 2, y + 8 + s.cy * 2, 2, 2, k === 0 ? '#1a1c18' : '#3a3c34');
      }
      R(c, x + 2 + ((step * 7) % cells) * 2, y + 8 + Math.floor(rows / 2) * 2, 2, 2, '#5a5c54');
      drawText(c, String(step % 100).padStart(2, '0'), x + 2, y + 2, '#3a3c34');
      break;
    }
    case 'color':
    case 'tft': {
      // fondo de atardecer con rascacielos y el reloj
      const bands = p.look === 'color' ? ['#2a1a5a', '#7b4fa0', '#e8619e', '#ff8a3b', '#ffcc33'] : ['#0a2a5a', '#2f6fb3', '#4ff0ff', '#b8f0ff', '#ffffff'];
      bands.forEach((b, i) => R(c, x, y + (h * i) / bands.length, w, h / bands.length + 1, b));
      for (let i = 0; i < w; i += 3) {
        const bh = 4 + ((i * 7) % 9);
        R(c, x + i, y + h - bh - 6, 3, bh, '#14101f');
        if ((i + Math.floor(t)) % 4 === 0) R(c, x + i + 1, y + h - bh - 4, 1, 1, '#ffcc33');
      }
      R(c, x, y, w, 4, 'rgba(0,0,0,0.35)');
      drawText(c, clock(t), x + w - 20, y, '#ffffff');
      for (let i = 0; i < 4 && i * 6 + 2 < w; i++) {
        R(c, x + 2 + i * 6, y + h - 6, 5, 5, ICON_COLS[i]);
        R(c, x + 4 + i * 6, y + h - 4, 1, 1, '#ffffff');
      }
      break;
    }
    case 'tactil':
    case 'holo':
    default: {
      // pantalla de iconos (la holo cambia de color y tiene profundidad)
      if (p.look === 'holo') {
        for (let i = 0; i < h; i += 2) R(c, x, y + i, w, 2, `hsl(${(i * 6 + t * 80) % 360},70%,${30 + (i % 6) * 3}%)`);
      } else {
        const g = c.createLinearGradient(x, y, x, y + h);
        g.addColorStop(0, '#2a1a5a');
        g.addColorStop(1, '#e8619e');
        c.fillStyle = g;
        c.fillRect(x, y, w, h);
      }
      R(c, x, y, w, 4, 'rgba(0,0,0,0.45)');
      drawText(c, clock(t), x + 1, y, '#ffffff');
      R(c, x + w - 5, y + 1, 4, 2, '#35d07f');
      const cols = Math.max(1, Math.floor((w - 2) / 7));
      let n = 0;
      for (let ry = y + 7; ry + 6 < y + h - 8; ry += 8)
        for (let k = 0; k < cols; k++) {
          const ix = x + 2 + k * 7;
          R(c, ix, ry, 5, 5, ICON_COLS[n++ % ICON_COLS.length]);
          R(c, ix + 1, ry + 1, 3, 1, 'rgba(255,255,255,0.5)');
        }
      // barra inferior
      R(c, x + 1, y + h - 7, w - 2, 6, 'rgba(255,255,255,0.25)');
      for (let k = 0; k < Math.min(4, cols); k++) R(c, x + 3 + k * 7, y + h - 6, 4, 4, ICON_COLS[(k + 3) % ICON_COLS.length]);
      if (p.look === 'tactil') {
        // un dedo que toca: onda
        const k = (t * 0.8) % 1;
        const fx = x + 5 + ((Math.floor(t * 0.8) * 13) % Math.max(1, w - 10));
        const fy = y + 10 + ((Math.floor(t * 0.8) * 7) % Math.max(1, h - 20));
        c.strokeStyle = `rgba(255,255,255,${1 - k})`;
        c.beginPath();
        c.arc(fx, fy, 1 + k * 5, 0, Math.PI * 2);
        c.stroke();
      }
      break;
    }
  }
  // líneas de barrido muy suaves
  for (let i = y; i < y + h; i += 2) R(c, x, i, w, 1, 'rgba(0,0,0,0.06)');
}

/** Icono de una función extra (para el cajón): usa su emoji. */
export const extraIcon = (id: string) => EXTRA_BY_ID[id]?.icon ?? '★';
