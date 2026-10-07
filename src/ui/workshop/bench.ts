import { R, type SceneDraw } from '../games/stage';

/**
 * Mesa del técnico vista desde arriba: madera, alfombrilla de corte verde,
 * flexo con su cono de luz, soldador humeando, destornilladores, lupa,
 * multímetro con la aguja temblando y una radio vieja.
 */
export const benchScene: SceneDraw = (ctx, t, w, h) => {
  // madera de la mesa
  R(ctx, 0, 0, w, h, '#6b4226');
  for (let y = 0; y < h; y += 9) {
    R(ctx, 0, y, w, 1, '#5a361e');
    for (let x = (y * 7) % 23; x < w; x += 23) R(ctx, x, y + 3, 6, 1, '#7a4e2e');
  }
  // alfombrilla de corte verde con cuadrícula
  R(ctx, 14, 64, w - 28, h - 128, '#1f5a3a');
  for (let x = 14; x < w - 14; x += 8) R(ctx, x, 64, 1, h - 128, 'rgba(255,255,255,0.08)');
  for (let y = 64; y < h - 64; y += 8) R(ctx, 14, y, w - 28, 1, 'rgba(255,255,255,0.08)');
  R(ctx, 14, 64, w - 28, 2, '#2a7a4e');
  // destornilladores
  const tool = (x: number, y: number, col: string) => {
    R(ctx, x, y, 3, 14, col);
    R(ctx, x + 1, y + 14, 1, 10, '#c8ccd2');
  };
  tool(6, 18, '#c0392b');
  tool(11, 20, '#e2a23b');
  tool(16, 17, '#2f6fb3');
  // pinzas
  R(ctx, 24, 22, 1, 18, '#9aa0a8');
  R(ctx, 26, 22, 1, 18, '#9aa0a8');
  // soldador con su soporte y humo
  R(ctx, w - 44, 10, 26, 6, '#2a2a33');
  R(ctx, w - 40, 6, 3, 4, '#8a8e94');
  R(ctx, w - 18, 12, 10, 2, '#c8ccd2');
  R(ctx, w - 8, 12, 3, 2, '#ff7a2a');
  for (let i = 0; i < 4; i++) {
    const k = (t * 0.6 + i / 4) % 1;
    ctx.fillStyle = `rgba(220,220,230,${0.4 * (1 - k)})`;
    ctx.fillRect(Math.round(w - 7 + Math.sin(t * 2 + i * 2) * 3 * k), Math.round(10 - k * 16), 2, 2);
  }
  // multímetro con la aguja
  R(ctx, w - 40, 24, 22, 30, '#e2a23b');
  R(ctx, w - 37, 27, 16, 10, '#d8e8c8');
  const a = -0.6 + Math.sin(t * 3) * 0.15 + Math.sin(t * 11) * 0.04;
  ctx.strokeStyle = '#14101f';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(w - 29, 36);
  ctx.lineTo(w - 29 + Math.sin(a) * 7, 36 - Math.cos(a) * 7);
  ctx.stroke();
  R(ctx, w - 32, 41, 6, 6, '#2a2a33');
  R(ctx, w - 37, 50, 2, 6, '#c0392b');
  R(ctx, w - 23, 50, 2, 6, '#14101f');
  // radio de transistores
  R(ctx, 34, 8, 30, 18, '#8a2a2a');
  for (let x = 37; x < 52; x += 3) R(ctx, x, 11, 2, 12, '#5a1a1a');
  R(ctx, 54, 11, 7, 7, '#e8e4d8');
  // tornillos sueltos y chips de repuesto abajo
  for (let i = 0; i < 9; i++) R(ctx, 20 + ((i * 37) % (w - 40)), h - 58 + ((i * 13) % 40), 2, 2, '#c8ccd2');
  R(ctx, w - 52, h - 50, 14, 8, '#14141a');
  for (let k = 0; k < 6; k++) {
    R(ctx, w - 51 + k * 2, h - 52, 1, 2, '#c8ccd2');
    R(ctx, w - 51 + k * 2, h - 42, 1, 2, '#c8ccd2');
  }
  // lupa
  ctx.strokeStyle = '#2a2a33';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(30, h - 40, 9, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = 'rgba(200,230,255,0.25)';
  ctx.fill();
  R(ctx, 37, h - 34, 9, 3, '#2a2a33');
  // luz cálida del flexo en el centro y sombra en los bordes
  const g = ctx.createRadialGradient(w * 0.5, h * 0.42, 10, w * 0.5, h * 0.45, h * 0.62);
  g.addColorStop(0, `rgba(255,236,190,${0.32 + Math.sin(t * 0.7) * 0.01})`);
  g.addColorStop(0.6, 'rgba(255,236,190,0.05)');
  g.addColorStop(1, 'rgba(0,0,0,0.5)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  // brazo del flexo entrando por arriba
  R(ctx, w * 0.62, 0, 4, 22, '#3a3a46');
  R(ctx, w * 0.5, 20, 30, 8, '#c0392b');
  R(ctx, w * 0.52, 27, 26, 2, '#fff2c0');
};
