import { useRef, useState } from 'preact/hooks';
import { randomPerson, type Mood, type Person } from '../../art/portrait';
import { fx } from '../../platform/audio';
import { Backdrop, Bubble, Portrait, R, useTalk, type SceneDraw, type Talk } from './stage';
import './counter.css';

/**
 * Mostrador con clientes: entran (campanilla y pasos), piden con su voz,
 * esperan con su paciencia y se van dando las gracias y, si los atiendes
 * bien y rápido, dejando propina en el bote.
 */
export interface Counter {
  person: Person;
  talk: Talk;
  at: 'in' | 'out' | 'gone';
  /** Monedas que vuelan al bote (clave para relanzar la animación). */
  coin: number;
  tips: number;
  /** Entra un cliente nuevo y dice su frase. */
  arrive: (line: string, mood?: Mood) => void;
  /** El cliente dice algo y se va; con propina, la moneda vuela al bote. */
  leave: (line: string, mood?: Mood, tip?: boolean) => void;
}

export function useCounter(): Counter {
  const [person, setPerson] = useState(() => randomPerson());
  const [at, setAt] = useState<'in' | 'out' | 'gone'>('gone');
  const [coin, setCoin] = useState(0);
  const [tips, setTips] = useState(0);
  const talk = useTalk(person);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const later = (ms: number, fn: () => void) => timers.current.push(setTimeout(fn, ms));
  return {
    person,
    talk,
    at,
    coin,
    tips,
    arrive: (line, mood = 'normal') => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
      setAt('gone');
      setPerson(randomPerson());
      later(60, () => {
        setAt('in');
        fx.door();
        fx.steps();
      });
      later(520, () => talk.say(line, mood));
    },
    leave: (line, mood = 'feliz', tip = false) => {
      talk.say(line, mood);
      if (tip) {
        setCoin((c) => c + 1);
        setTips((t) => t + 1);
        later(380, () => fx.register());
      }
      later(tip ? 1100 : 800, () => setAt('out'));
    },
  };
}

/** Escena de fondo del mostrador. */
export type CounterScene = 'diner' | 'calle';

export function CounterView({ c, scene, patience, class: cls = '' }: { c: Counter; scene: CounterScene; patience?: number | null; class?: string }) {
  return (
    <div class={`counter counter-${scene} ${cls}`}>
      <Backdrop draw={scene === 'diner' ? dinerWall : streetWall} w={180} h={96} fps={12} />
      <div class={`counter-person ${c.at}`}>
        <Portrait person={c.person} talking={c.talk.talking} mood={c.talk.mood} scale={3.6} />
      </div>
      <div class="counter-top">
        <div class="tip-jar">
          <span class="tip-jar-coins" style={{ height: `${Math.min(100, 18 + c.tips * 9)}%` }} />
          <small>TIPS</small>
        </div>
      </div>
      {c.coin > 0 && <span class="tip-coin" key={c.coin} />}
      {c.at === 'in' && <Bubble text={c.talk.line} k={c.talk.key} side="left" class="counter-bubble" />}
      {patience != null && c.at === 'in' && (
        <div class="counter-patience">
          <span style={{ width: `${Math.max(0, Math.min(1, patience)) * 100}%`, background: patience < 0.3 ? '#ff4a5a' : patience < 0.6 ? '#ffb13b' : '#35d07f' }} />
          <i>{patience < 0.3 ? '😠' : patience < 0.6 ? '😐' : '🙂'}</i>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Fondos
// ---------------------------------------------------------------------------

/** Pared del diner: ventanal a la calle con coches, neón, menú y vitrina de tartas. */
export const dinerWall: SceneDraw = (ctx, t, w, h) => {
  // pared de azulejo crema con franja roja
  R(ctx, 0, 0, w, h, '#e8dcc0');
  for (let y = 0; y < h; y += 8) R(ctx, 0, y, w, 1, '#d4c6a6');
  for (let x = 0; x < w; x += 8) R(ctx, x, 0, 1, h, '#d8cab0');
  R(ctx, 0, h - 26, w, 6, '#c0392b');
  R(ctx, 0, h - 20, w, 20, '#2a2a33');
  for (let x = 0; x < w; x += 8) R(ctx, x + ((Math.floor(x / 8) % 2) * 0), h - 20, 4, 4, '#e8e4d8');
  // ventanal con la calle
  const wx = 8;
  const wy = 8;
  const ww = 92;
  const wh = 48;
  R(ctx, wx - 2, wy - 2, ww + 4, wh + 4, '#8a8e94');
  const night = new Date().getHours() >= 20 || new Date().getHours() < 7;
  R(ctx, wx, wy, ww, wh, night ? '#1a1838' : '#8fc4e8');
  // edificios de enfrente
  for (let i = 0; i < 6; i++) {
    const bx = wx + i * 16 - 2;
    const bh = 22 + ((i * 37) % 14);
    R(ctx, bx, wy + wh - bh, 15, bh, ['#8e3b2e', '#6b4a3a', '#5a6a8a', '#a8805a'][i % 4]);
    for (let yy = wy + wh - bh + 3; yy < wy + wh - 8; yy += 5) for (let xx = bx + 2; xx < bx + 13; xx += 4) R(ctx, xx, yy, 2, 2, night && (xx * yy) % 3 ? '#ffd27a' : '#24304c');
  }
  // acera y coches que pasan
  R(ctx, wx, wy + wh - 8, ww, 8, '#5a5752');
  for (let k = 0; k < 2; k++) {
    const cx = wx - 30 + (((t * (34 + k * 14) + k * 70) % (ww + 60)));
    const col = k ? '#f2c230' : '#2f6fb3';
    R(ctx, cx, wy + wh - 13, 24, 6, col);
    R(ctx, cx + 5, wy + wh - 17, 13, 4, col);
    R(ctx, cx + 7, wy + wh - 16, 9, 2, '#9fd3ff');
    R(ctx, cx + 3, wy + wh - 8, 4, 3, '#14101f');
    R(ctx, cx + 17, wy + wh - 8, 4, 3, '#14101f');
    if (k) R(ctx, cx + 10, wy + wh - 18, 4, 1, '#14101f');
  }
  // gente que pasa por la acera
  const px = wx + ((t * 9) % (ww + 10)) - 5;
  R(ctx, px, wy + wh - 20, 3, 9, '#3a3a46');
  R(ctx, px, wy + wh - 23, 3, 3, '#c18a5c');
  // marco y reflejo
  R(ctx, wx + ww / 2 - 1, wy, 2, wh, '#8a8e94');
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.beginPath();
  ctx.moveTo(wx + 10, wy);
  ctx.lineTo(wx + 24, wy);
  ctx.lineTo(wx + 6, wy + wh);
  ctx.lineTo(wx, wy + wh);
  ctx.lineTo(wx, wy + 14);
  ctx.fill();
  // neón DINER que parpadea
  const on = Math.sin(t * 13) > -0.92 && !(t % 7 > 6.6 && t % 7 < 6.75);
  ctx.font = 'bold 13px monospace';
  ctx.fillStyle = on ? '#ff4f9a' : '#6a2a48';
  if (on) {
    ctx.shadowColor = '#ff4f9a';
    ctx.shadowBlur = 8;
  }
  ctx.fillText('DINER', 112, 22);
  ctx.shadowBlur = 0;
  // pizarra del menú
  R(ctx, 110, 28, 62, 34, '#2a3a2a');
  R(ctx, 110, 28, 62, 2, '#6b4a2c');
  ctx.font = '6px monospace';
  ctx.fillStyle = '#f4efe2';
  ['BURGER  2.50', 'COFFEE  0.75', 'PIE     1.25', 'SHAKE   1.50'].forEach((l, i) => ctx.fillText(l, 113, 37 + i * 7));
  // reloj Coca-Cola y luz cálida
  const g = ctx.createRadialGradient(w / 2, 0, 6, w / 2, 0, h);
  g.addColorStop(0, 'rgba(255,236,190,0.25)');
  g.addColorStop(1, 'rgba(0,0,0,0.25)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
};

/** Avenida detrás del puesto de perritos: escaparates, taxis y gente. */
export const streetWall: SceneDraw = (ctx, t, w, h) => {
  R(ctx, 0, 0, w, h, '#8fc4e8');
  // edificios con escaparates
  const cols = ['#8e3b2e', '#a8805a', '#5a6a8a', '#6b4a3a', '#7a3a2c'];
  for (let i = 0; i < 6; i++) {
    const bx = i * 32 - 6;
    const top = 4 + ((i * 13) % 12);
    R(ctx, bx, top, 32, h, cols[i % cols.length]);
    for (let yy = top + 4; yy < h - 44; yy += 9) for (let xx = bx + 4; xx < bx + 28; xx += 8) R(ctx, xx, yy, 4, 5, '#24304c');
    R(ctx, bx + 2, h - 44, 28, 3, ['#c0392b', '#2e8b57', '#2f6fb3', '#e2a23b'][i % 4]);
    R(ctx, bx + 4, h - 41, 24, 12, '#2c3446');
    R(ctx, bx + 4, h - 41, 24, 12, 'rgba(255,219,148,0.35)');
  }
  // acera, bordillo y calzada
  R(ctx, 0, h - 29, w, 9, '#8d8a86');
  R(ctx, 0, h - 20, w, 20, '#38363e');
  for (let x = 0; x < w; x += 16) R(ctx, x + ((t * 40) % 16), h - 10, 8, 1, '#cfcabe');
  // taxis y coches
  for (let k = 0; k < 3; k++) {
    const sp = 40 + k * 18;
    const cx = ((t * sp + k * 90) % (w + 60)) - 40;
    const col = k === 1 ? '#c0392b' : '#f2c230';
    const y = h - 18 + (k % 2) * 3;
    R(ctx, cx, y, 30, 7, col);
    R(ctx, cx + 7, y - 5, 15, 5, col);
    R(ctx, cx + 9, y - 4, 11, 3, '#9fd3ff');
    R(ctx, cx + 4, y + 6, 5, 3, '#14101f');
    R(ctx, cx + 21, y + 6, 5, 3, '#14101f');
    if (col === '#f2c230') R(ctx, cx + 12, y - 7, 5, 2, '#14101f');
  }
  // peatones
  for (let k = 0; k < 4; k++) {
    const px = ((t * (8 + k * 3) + k * 50) % (w + 20)) - 10;
    const step = Math.floor(t * 6 + k) % 2;
    R(ctx, px, h - 40, 4, 10, ['#3a3a46', '#2f6fb3', '#7b4fa0', '#c0392b'][k]);
    R(ctx, px, h - 44, 4, 4, ['#f2d0b0', '#9a6440', '#deac84', '#6c4228'][k]);
    R(ctx, px + step, h - 30, 1, 2, '#14101f');
    R(ctx, px + 3 - step, h - 30, 1, 2, '#14101f');
  }
};
