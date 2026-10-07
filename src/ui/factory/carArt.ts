import { shade } from '../../art/character';
import { drawText } from '../../art/pixelfont';
import { CAR_COLOR_BY_ID, CAR_PART_BY_ID, type CarDesign } from '../../core/carcore';

/**
 * Coche de perfil en pixel art (mira a la derecha). Dos modos:
 *  - "pintura": el coche terminado, con su color, cristales, llantas y extras;
 *  - "plano": el dibujo técnico en blanco sobre azul, con el motor, los
 *    asientos y la transmisión a la vista.
 */
type Ctx = CanvasRenderingContext2D;
const R = (c: Ctx, x: number, y: number, w: number, h: number, col: string) => {
  c.fillStyle = col;
  c.fillRect(Math.round(x), Math.round(y), Math.max(1, Math.round(w)), Math.max(1, Math.round(h)));
};

/** Silueta de cada carrocería: puntos (x, y) de 0 a 1, de techo (0) a bajos (1). */
const SHAPES: Record<string, { len: number; pts: [number, number][]; belt: number; wheels: [number, number]; roof?: number }> = {
  compacto: { len: 54, pts: [[0, 0.62], [0.05, 0.47], [0.27, 0.42], [0.37, 0.12], [0.8, 0.1], [0.96, 0.4], [1, 0.5], [1, 0.84], [0, 0.84]], belt: 0.46, wheels: [0.2, 0.8] },
  berlina: { len: 66, pts: [[0, 0.62], [0.04, 0.48], [0.22, 0.44], [0.32, 0.14], [0.66, 0.12], [0.78, 0.43], [0.97, 0.46], [1, 0.6], [1, 0.84], [0, 0.84]], belt: 0.47, wheels: [0.18, 0.8] },
  familiar: { len: 70, pts: [[0, 0.6], [0.04, 0.46], [0.21, 0.42], [0.3, 0.12], [0.95, 0.11], [0.99, 0.45], [1, 0.84], [0, 0.84]], belt: 0.45, wheels: [0.17, 0.82] },
  pickup: { len: 70, pts: [[0, 0.58], [0.03, 0.43], [0.24, 0.41], [0.3, 0.09], [0.53, 0.09], [0.57, 0.41], [1, 0.43], [1, 0.84], [0, 0.84]], belt: 0.44, wheels: [0.17, 0.82] },
  taxi: { len: 66, pts: [[0, 0.62], [0.04, 0.48], [0.22, 0.44], [0.32, 0.16], [0.66, 0.14], [0.78, 0.43], [0.97, 0.46], [1, 0.6], [1, 0.84], [0, 0.84]], belt: 0.47, wheels: [0.18, 0.8], roof: 1 },
  coupe: { len: 62, pts: [[0, 0.64], [0.05, 0.52], [0.28, 0.46], [0.4, 0.2], [0.62, 0.18], [0.86, 0.46], [1, 0.52], [1, 0.82], [0, 0.82]], belt: 0.5, wheels: [0.19, 0.8] },
  deportivo: { len: 64, pts: [[0, 0.68], [0.08, 0.58], [0.4, 0.52], [0.5, 0.32], [0.68, 0.31], [0.9, 0.52], [1, 0.56], [1, 0.82], [0, 0.82]], belt: 0.55, wheels: [0.2, 0.8] },
  todoterreno: { len: 62, pts: [[0, 0.5], [0.03, 0.32], [0.2, 0.3], [0.26, 0.04], [0.96, 0.04], [1, 0.3], [1, 0.78], [0, 0.78]], belt: 0.33, wheels: [0.2, 0.8] },
  limusina: { len: 92, pts: [[0, 0.62], [0.03, 0.48], [0.15, 0.44], [0.22, 0.14], [0.78, 0.12], [0.86, 0.43], [0.98, 0.46], [1, 0.6], [1, 0.84], [0, 0.84]], belt: 0.47, wheels: [0.13, 0.86] },
  super: { len: 64, pts: [[0, 0.7], [0.12, 0.6], [0.42, 0.5], [0.52, 0.34], [0.66, 0.33], [0.94, 0.56], [1, 0.6], [1, 0.82], [0, 0.82]], belt: 0.57, wheels: [0.22, 0.79] },
};
export const CAR_H = 26;
export const carLen = (d: CarDesign) => SHAPES[CAR_PART_BY_ID[d.carroceria].look]?.len ?? 66;

/** Relleno por filas (bordes nítidos de pixel art). */
function spans(pts: [number, number][], w: number, h: number) {
  const P = pts.map(([x, y]) => [x * (w - 1), y * (h - 1)] as const);
  const rows: [number, number][] = [];
  for (let y = 0; y < h; y++) {
    const yc = y + 0.5;
    const xs: number[] = [];
    for (let i = 0; i < P.length; i++) {
      const [x1, y1] = P[i];
      const [x2, y2] = P[(i + 1) % P.length];
      if ((y1 <= yc && y2 > yc) || (y2 <= yc && y1 > yc)) xs.push(x1 + ((yc - y1) / (y2 - y1)) * (x2 - x1));
    }
    xs.sort((a, b) => a - b);
    rows.push(xs.length >= 2 ? [Math.round(xs[0]), Math.round(xs[xs.length - 1])] : [-1, -2]);
  }
  return rows;
}

export function drawCar(c: Ctx, d: CarDesign, ox: number, oy: number, mode: 'pintura' | 'plano', t: number) {
  const body = CAR_PART_BY_ID[d.carroceria];
  const sh = SHAPES[body.look] ?? SHAPES.berlina;
  const W = sh.len;
  const H = CAR_H;
  const col = CAR_COLOR_BY_ID[d.color]?.hex ?? '#c8302a';
  const rows = spans(sh.pts, W, H);
  const belt = Math.round(sh.belt * H);
  const ex = new Set(d.extras);
  const plan = mode === 'plano';
  const ink = '#e8f4ff';
  const wheelY = Math.round(0.84 * H);
  const wr = body.look === 'todoterreno' ? 5 : body.look === 'deportivo' || body.look === 'super' ? 4 : 4;
  const wheels = sh.wheels.map((f) => Math.round(f * W));

  // --- carrocería
  rows.forEach(([a, b], y) => {
    if (b < a) return;
    if (plan) {
      // contorno: primera y última columna de la fila, y las filas de arriba/abajo
      const prev = rows[y - 1];
      const next = rows[y + 1];
      R(c, ox + a, oy + y, 1, 1, ink);
      R(c, ox + b, oy + y, 1, 1, ink);
      if (!prev || prev[1] < prev[0]) R(c, ox + a, oy + y, b - a + 1, 1, ink);
      else {
        if (prev[0] > a) R(c, ox + a, oy + y, prev[0] - a, 1, ink);
        if (prev[1] < b) R(c, ox + prev[1] + 1, oy + y, b - prev[1], 1, ink);
      }
      if (!next || next[1] < next[0]) R(c, ox + a, oy + y, b - a + 1, 1, ink);
      return;
    }
    const lit = y < belt ? shade(col, 0.12) : y > H * 0.7 ? shade(col, -0.25) : col;
    R(c, ox + a, oy + y, b - a + 1, 1, lit);
    R(c, ox + a, oy + y, 1, 1, shade(col, -0.45));
    R(c, ox + b, oy + y, 1, 1, shade(col, -0.45));
  });
  // cristales: entre el techo y la línea de cintura, con montantes
  const firstRow = rows.findIndex(([a, b]) => b >= a);
  for (let y = firstRow + 2; y < belt - 1; y++) {
    const [a, b] = rows[y];
    if (b < a) continue;
    const x0 = a + 2;
    const x1 = b - 2;
    for (let x = x0; x <= x1; x++) {
      const pillar = Math.abs(x - Math.round((x0 + x1) / 2)) <= 0 || (body.look === 'limusina' && Math.abs(x - Math.round(x0 + (x1 - x0) * 0.33)) <= 0);
      if (pillar) {
        if (!plan) R(c, ox + x, oy + y, 1, 1, shade(col, -0.35));
        else R(c, ox + x, oy + y, 1, 1, ink);
        continue;
      }
      if (body.look === 'pickup' && x > W * 0.56) continue;
      if (!plan) R(c, ox + x, oy + y, 1, 1, y < firstRow + 4 ? '#bfe6ff' : '#5a8ab8');
    }
    if (plan) {
      R(c, ox + x0, oy + y, 1, 1, ink);
      R(c, ox + x1, oy + y, 1, 1, ink);
    }
  }
  if (!plan) {
    // reflejo del cristal
    for (let k = 0; k < 4; k++) R(c, ox + Math.round(W * 0.42) + k, oy + firstRow + 3 + k, 1, 1, '#ffffff');
    // línea de cintura, manillas, faros y piloto
    R(c, ox + 2, oy + belt + 2, W - 4, 1, shade(col, -0.3));
    R(c, ox + Math.round(W * 0.45), oy + belt + 3, 2, 1, '#c8ccd2');
    R(c, ox + W - 3, oy + belt + 3, 3, 2, ex.has('faros') ? shade(col, -0.2) : '#fff6c0');
    R(c, ox, oy + belt + 3, 2, 2, '#e8302a');
    R(c, ox + W - 4, oy + H * 0.72, 4, 2, '#c8ccd2');
    R(c, ox, oy + H * 0.72, 4, 2, '#c8ccd2');
    if (ex.has('cromados')) R(c, ox + 3, oy + belt + 5, W - 6, 1, '#f4efe2');
    if (body.look === 'taxi') {
      R(c, ox + W * 0.42, oy + firstRow - 3, 9, 3, '#14101f');
      drawText(c, 'TAXI', ox + W * 0.42 - 3, oy + firstRow - 8, '#f2c230');
      for (let x = ox + 4; x < ox + W - 4; x += 4) R(c, x, oy + belt + 6, 2, 2, (x / 4) % 2 ? '#14101f' : col);
    }
    if (ex.has('techo')) R(c, ox + W * 0.45, oy + firstRow, 8, 1, '#24304c');
    if (ex.has('aleron')) {
      R(c, ox - 1, oy + belt - 4, 7, 2, shade(col, -0.2));
      R(c, ox + 2, oy + belt - 2, 1, 3, '#14101f');
    }
    if (ex.has('telefono')) R(c, ox + Math.round(W * 0.3), oy + firstRow - 5, 1, 6, '#14101f');
    if (ex.has('turbo')) R(c, ox + W * 0.82, oy + belt - 1, 5, 1, '#14101f');
    if (ex.has('kitt')) {
      // la luz roja que barre el morro
      const k = Math.round((Math.sin(t * 4) * 0.5 + 0.5) * 5);
      R(c, ox + W - 7, oy + H * 0.66, 6, 1, '#3a0808');
      R(c, ox + W - 7 + k, oy + H * 0.66, 1, 1, '#ff3b3b');
    }
    if (body.look === 'todoterreno') {
      R(c, ox - 3, oy + H * 0.36, 3, 8, '#14101f');
      R(c, ox - 2, oy + H * 0.38, 1, 6, '#5a5e64');
    }
    if (body.look === 'pickup') R(c, ox + W * 0.58, oy + H * 0.41, W * 0.4, 1, shade(col, -0.4));
  }

  // --- ruedas (con su llanta)
  const rim: Record<string, string> = { acero: '#9aa0a8', aleacion: '#d8dce2', tt: '#6a6e74', sport: '#2a2a33', cromo: '#f4f6f8', race: '#c8a040', oro: '#ffcc33' };
  const wl = CAR_PART_BY_ID[d.ruedas].look;
  for (const wx of wheels) {
    if (plan) {
      c.strokeStyle = ink;
      c.lineWidth = 1;
      c.beginPath();
      c.arc(ox + wx + 0.5, oy + wheelY + 0.5, wr, 0, Math.PI * 2);
      c.stroke();
      R(c, ox + wx, oy + wheelY, 1, 1, ink);
      continue;
    }
    R(c, ox + wx - wr - 1, oy + wheelY - wr - 1, wr * 2 + 3, 2, '#14101f');
    for (let y = -wr; y <= wr; y++) {
      const half = Math.round(Math.sqrt(wr * wr - y * y));
      R(c, ox + wx - half, oy + wheelY + y, half * 2 + 1, 1, '#14101f');
    }
    const rr = Math.max(1, wr - 2);
    for (let y = -rr; y <= rr; y++) {
      const half = Math.round(Math.sqrt(rr * rr - y * y));
      R(c, ox + wx - half, oy + wheelY + y, half * 2 + 1, 1, rim[wl] ?? '#9aa0a8');
    }
    // radios que giran
    const a = t * 6;
    R(c, ox + wx + Math.round(Math.cos(a) * rr * 0.7), oy + wheelY + Math.round(Math.sin(a) * rr * 0.7), 1, 1, '#14101f');
    R(c, ox + wx - Math.round(Math.cos(a) * rr * 0.7), oy + wheelY - Math.round(Math.sin(a) * rr * 0.7), 1, 1, '#14101f');
    R(c, ox + wx, oy + wheelY, 1, 1, '#3a3a46');
    if (wl === 'tt') for (let k = -wr; k <= wr; k += 2) R(c, ox + wx + k, oy + wheelY + wr, 1, 1, '#3a3a46');
  }

  // --- en el plano: motor, transmisión, asientos y depósito
  if (plan) {
    const motor = CAR_PART_BY_ID[d.motor];
    const ew = motor.look === 'v12' || motor.look === 'v8' ? 14 : motor.look === 'electrico' ? 10 : 11;
    const ex0 = d.motorPos === 'delante' ? W - ew - 3 : d.motorPos === 'centro' ? Math.round(W * 0.32) : 3;
    const ey = Math.round(H * 0.5);
    R(c, ox + ex0, oy + ey, ew, 7, 'rgba(255,204,51,0.85)');
    R(c, ox + ex0 + 1, oy + ey + 1, ew - 2, 5, '#24427a');
    for (let k = 2; k < ew - 2; k += 3) R(c, ox + ex0 + k, oy + ey - 1, 2, 1, 'rgba(255,204,51,0.85)');
    if (motor.look === 'electrico') R(c, ox + ex0 + 3, oy + ey + 2, 3, 3, '#4ff0ff');
    // árbol de transmisión hacia las ruedas que empujan
    const driven = d.traccion === 'delantera' ? [wheels[1]] : d.traccion === 'trasera' ? [wheels[0]] : wheels;
    for (const wx of driven) {
      const from = ox + ex0 + ew / 2;
      const to = ox + wx;
      R(c, Math.min(from, to), oy + ey + 6, Math.abs(to - from), 1, '#ff8a6a');
      R(c, to, oy + ey + 6, 1, wheelY - ey - 6, '#ff8a6a');
    }
    // asientos
    const seats = Math.min(3, Math.ceil((body.seats ?? 4) / 2));
    for (let k = 0; k < seats; k++) {
      const sx = ox + Math.round(W * (0.5 - k * 0.17));
      if (d.motorPos === 'centro' && k > 0) break;
      R(c, sx, oy + belt - 3, 2, 8, '#7dff6a');
      R(c, sx, oy + belt + 4, 5, 2, '#7dff6a');
    }
    // depósito
    R(c, ox + wheels[0] + 4, oy + Math.round(H * 0.7), 8, 3, 'rgba(232,244,255,0.5)');
  }
}

// ---------------------------------------------------------------------------
// La nave de la fábrica (fondo animado)
// ---------------------------------------------------------------------------

const RR = R;

/** Nave industrial: cerchas, lucernarios, cadena de montaje con robots que sueldan e ingenieros que van y vienen. */
export function factoryHall(c: Ctx, t: number, w: number, h: number) {
  const lineY0 = 98;
  // paredes de hormigón y cerchas de acero
  RR(c, 0, 0, w, h, '#3a3e48');
  for (let x = 0; x < w; x += 30) {
    RR(c, x, 0, 3, lineY0, '#2a2e36');
    for (let y = 2; y < 22; y += 8) {
      RR(c, x + 3, y, 27, 1, '#4a4e58');
      for (let k = 0; k < 27; k += 9) RR(c, x + 3 + k + ((y / 8) % 2) * 4, y, 1, 8, '#4a4e58');
    }
  }
  // lucernarios con luz de día que entra en haces
  for (let i = 0; i < 4; i++) {
    RR(c, 12 + i * 44, 2, 24, 5, '#bfe6ff');
    c.fillStyle = 'rgba(255,248,220,0.07)';
    c.beginPath();
    c.moveTo(12 + i * 44, 7);
    c.lineTo(36 + i * 44, 7);
    c.lineTo(56 + i * 44, lineY0);
    c.lineTo(20 + i * 44, lineY0);
    c.fill();
  }
  // letrero de la marca
  RR(c, w / 2 - 40, 24, 80, 11, '#14101f');
  drawText(c, 'PIXELOPOLIS MOTORS', w / 2 - 35, 27, '#ffcc33');
  // grúa puente que va y viene
  const cx = 20 + ((Math.sin(t * 0.25) * 0.5 + 0.5) * (w - 40));
  RR(c, 0, 38, w, 3, '#f2c230');
  for (let x = 0; x < w; x += 6) RR(c, x, 38, 3, 3, '#14101f');
  RR(c, cx - 6, 41, 12, 4, '#5a5e64');
  RR(c, cx, 45, 1, 10, '#14101f');
  RR(c, cx - 4, 55, 9, 4, '#8a8e94');
  // cadena de montaje con carrocerías que avanzan
  const lineY = 76;
  RR(c, 0, lineY, w, 6, '#2a2a33');
  for (let x = Math.floor(-(t * 14) % 6); x < w; x += 6) RR(c, x, lineY + 1, 3, 1, '#5a5e64');
  RR(c, 0, lineY + 6, w, 2, '#14101f');
  const colors = ['#c8302a', '#24427a', '#ece8dc', '#f2c230', '#1e5a3a'];
  for (let k = 0; k < 4; k++) {
    const x = ((t * 14 + k * 52) % (w + 60)) - 50;
    const col = colors[k % colors.length];
    RR(c, x, lineY - 9, 34, 7, col);
    RR(c, x + 8, lineY - 14, 16, 5, col);
    RR(c, x + 10, lineY - 13, 12, 3, '#5a8ab8');
    RR(c, x + 4, lineY - 2, 5, 2, '#14101f');
    RR(c, x + 25, lineY - 2, 5, 2, '#14101f');
  }
  // robots que bajan a soldar y chispas
  for (let k = 0; k < 3; k++) {
    const rx = 30 + k * 60;
    const down = Math.sin(t * 2.4 + k * 2) > 0.3;
    RR(c, rx - 3, lineY + 8, 7, 14, '#e2a23b');
    RR(c, rx - 1, lineY - 24, 3, 32, '#e2a23b');
    const tipY = lineY - (down ? 10 : 22);
    RR(c, rx + 1, tipY, 10, 3, '#e2a23b');
    RR(c, rx + 10, tipY, 2, 6, '#5a5e64');
    if (down)
      for (let s = 0; s < 6; s++) {
        const a = Math.random() * Math.PI;
        const r = Math.random() * 8;
        RR(c, rx + 11 + Math.cos(a) * r, tipY + 6 - Math.sin(a) * r * 0.6, 1, 1, Math.random() < 0.5 ? '#fff2a0' : '#ff8a3b');
      }
  }
  // suelo con rayas amarillas
  RR(c, 0, lineY + 22, w, h - lineY - 22, '#4a4e56');
  for (let y = lineY + 30; y < h; y += 14) RR(c, 0, y, w, 1, 'rgba(0,0,0,0.15)');
  for (let x = 0; x < w; x += 12) RR(c, x + ((t * 0) % 12), lineY + 22, 6, 2, '#f2c230');
  // ingenieros que caminan al fondo (casco, mono y planos)
  for (let k = 0; k < 6; k++) {
    const speed = 7 + (k % 3) * 3;
    const dir = k % 2 ? 1 : -1;
    const span = w + 30;
    let x = ((t * speed + k * 47) % span) - 15;
    if (dir < 0) x = w - x;
    const y = lineY + 28 + (k % 3) * 8;
    const step = Math.floor(t * 6 + k) % 2;
    const suit = ['#2f5fa8', '#e86a2a', '#2f5fa8', '#ece8dc', '#2f5fa8', '#3a7a4a'][k];
    RR(c, x, y, 4, 7, suit);
    RR(c, x, y - 4, 4, 4, ['#f2d0b0', '#9a6440', '#deac84', '#6c4228', '#c18a5c', '#f2d0b0'][k]);
    RR(c, x - 1, y - 5, 6, 2, k === 3 ? '#ffffff' : '#f2c230');
    RR(c, x + step, y + 7, 1, 2, '#14101f');
    RR(c, x + 3 - step, y + 7, 1, 2, '#14101f');
    if (k % 3 === 0) RR(c, x + (dir > 0 ? 4 : -3), y + 1, 3, 2, '#bfe6ff');
  }
  // carretilla elevadora
  const fx = ((t * 18) % (w + 60)) - 40;
  const fy = lineY + 36;
  RR(c, fx, fy + 8, 18, 8, '#f2c230');
  RR(c, fx + 4, fy + 2, 8, 6, '#3a3a46');
  RR(c, fx + 18, fy, 2, 16, '#5a5e64');
  RR(c, fx + 20, fy + 12, 8, 2, '#5a5e64');
  RR(c, fx + 21, fy + 6, 7, 6, '#8a5a32');
  RR(c, fx + 2, fy + 16, 4, 3, '#14101f');
  RR(c, fx + 12, fy + 16, 4, 3, '#14101f');
  if (Math.floor(t * 3) % 2) RR(c, fx + 7, fy, 2, 2, '#ff8a3b');
  // lámparas colgantes y su luz
  for (let i = 0; i < 3; i++) {
    const lx = 30 + i * 60;
    RR(c, lx, 0, 1, 14, '#14101f');
    RR(c, lx - 5, 14, 11, 3, '#2a2a33');
    const g = c.createRadialGradient(lx, 18, 2, lx, 50, 55);
    g.addColorStop(0, 'rgba(255,240,200,0.25)');
    g.addColorStop(1, 'rgba(255,240,200,0)');
    c.fillStyle = g;
    c.fillRect(lx - 55, 14, 110, 100);
  }
}
