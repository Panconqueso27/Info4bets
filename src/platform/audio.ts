/**
 * Sonido del juego, sintetizado con Web Audio (sin archivos):
 * efectos chiptune y una banda sonora synthwave de los 80 que cambia
 * de día a noche. Arranca con el primer toque (política de los navegadores).
 */
const KEY = 'laciudad.audio';

interface Prefs {
  sfx: boolean;
  music: boolean;
}

let prefs: Prefs = load();
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let musicBus: GainNode | null = null;

function load(): Prefs {
  try {
    return { sfx: true, music: true, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') };
  } catch {
    return { sfx: true, music: true };
  }
}

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    /* sin almacenamiento */
  }
}

export function getPrefs(): Prefs {
  return { ...prefs };
}

export function setPrefs(p: Partial<Prefs>) {
  prefs = { ...prefs, ...p };
  save();
  if (musicBus && ctx) musicBus.gain.setTargetAtTime(prefs.music ? 0.32 : 0, ctx.currentTime, 0.3);
  if (prefs.music) startMusic();
}

/** Pausa todo el audio cuando la app pasa a segundo plano. */
export function setPaused(paused: boolean) {
  if (!ctx) return;
  if (paused) ctx.suspend().catch(() => {});
  else ctx.resume().catch(() => {});
}

/** Crea el contexto de audio en el primer gesto del usuario. */
export function unlock() {
  if (!ctx) {
    try {
      ctx = new AudioContext();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      musicBus = ctx.createGain();
      musicBus.gain.value = prefs.music ? 0.32 : 0;
      musicBus.connect(master);
    } catch {
      return;
    }
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  if (prefs.music) startMusic();
}

// ---------------------------------------------------------------------------
// Primitivas
// ---------------------------------------------------------------------------

function tone(freq: number, start: number, dur: number, type: OscillatorType, vol: number, slideTo?: number, out?: AudioNode) {
  if (!ctx || !master) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, start);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, start + dur);
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(vol, start + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  o.connect(g).connect(out ?? master);
  o.start(start);
  o.stop(start + dur + 0.05);
}

function noise(start: number, dur: number, vol: number, freq = 2000, q = 1, out?: AudioNode) {
  if (!ctx || !master) return;
  const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = freq;
  f.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, start);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  src.connect(f).connect(g).connect(out ?? master);
  src.start(start);
}

function sfx(fn: (t: number) => void) {
  if (!prefs.sfx) return;
  unlock();
  if (!ctx) return;
  fn(ctx.currentTime + 0.01);
}

// ---------------------------------------------------------------------------
// Efectos
// ---------------------------------------------------------------------------

export const play = {
  click: () => sfx((t) => tone(880, t, 0.05, 'square', 0.08)),
  swipe: () => sfx((t) => noise(t, 0.18, 0.25, 1800, 0.7)),
  /** Resultado bueno: arpegio triunfal con brillo. */
  good: () =>
    sfx((t) => {
      [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, t + i * 0.07, 0.22, 'square', 0.14));
      tone(2093, t + 0.38, 0.5, 'triangle', 0.12);
      for (let i = 0; i < 6; i++) tone(2600 + Math.random() * 1600, t + 0.4 + i * 0.05, 0.08, 'sine', 0.05);
    }),
  /** Resultado malo: golpe grave y descendente. */
  bad: () =>
    sfx((t) => {
      noise(t, 0.35, 0.6, 180, 0.6);
      tone(220, t, 0.6, 'sawtooth', 0.22, 45);
      tone(110, t + 0.05, 0.7, 'square', 0.16, 30);
      [311, 294, 277].forEach((f, i) => tone(f, t + 0.25 + i * 0.16, 0.18, 'square', 0.08));
    }),
  coin: () =>
    sfx((t) => {
      tone(988, t, 0.07, 'square', 0.1);
      tone(1319, t + 0.07, 0.18, 'square', 0.1);
    }),
  clink: () =>
    sfx((t) => {
      tone(2400, t, 0.12, 'triangle', 0.12);
      tone(3150, t + 0.03, 0.18, 'sine', 0.06);
    }),
  scrub: () => sfx((t) => noise(t, 0.06, 0.12, 3500 + Math.random() * 1500, 2)),
  splash: () => sfx((t) => noise(t, 0.3, 0.2, 900, 0.5)),
  stamp: () =>
    sfx((t) => {
      tone(90, t, 0.18, 'sine', 0.4, 50);
      noise(t, 0.08, 0.35, 600, 0.8);
    }),
  error: () => sfx((t) => tone(160, t, 0.25, 'square', 0.12, 120)),
  achievement: () =>
    sfx((t) => {
      [392, 523, 659, 784].forEach((f, i) => tone(f, t + i * 0.1, 0.2, 'square', 0.12));
      [784, 1047].forEach((f) => tone(f, t + 0.45, 0.6, 'triangle', 0.12));
    }),
  notify: () =>
    sfx((t) => {
      tone(1175, t, 0.09, 'square', 0.1);
      tone(1568, t + 0.1, 0.14, 'square', 0.1);
    }),
};

// ---------------------------------------------------------------------------
// Música synthwave
// ---------------------------------------------------------------------------

type Mood = 'dia' | 'noche';
let mood: Mood = 'dia';
let timer: number | null = null;
let nextTime = 0;
let step = 0;

const N = (semi: number) => 440 * Math.pow(2, semi / 12);
// Progresiones (semitonos respecto a La 440): día luminoso, noche más oscura.
const SONGS: Record<Mood, { bpm: number; chords: number[][]; bass: number[] }> = {
  dia: { bpm: 104, chords: [[0, 3, 7], [-4, 0, 3], [3, 7, 10], [-2, 2, 5]], bass: [-24, -28, -21, -26] },
  noche: { bpm: 84, chords: [[-7, -4, 0], [-11, -7, -4], [-4, 0, 3], [-9, -5, -2]], bass: [-31, -35, -28, -33] },
};

export function setMood(m: Mood) {
  mood = m;
}

function scheduleStep(t: number) {
  if (!ctx || !musicBus) return;
  const song = SONGS[mood];
  const bar = Math.floor(step / 16) % song.chords.length;
  const chord = song.chords[bar];
  const s16 = step % 16;
  const beat = 60 / song.bpm / 4;
  // Bajo en corcheas
  if (s16 % 2 === 0) tone(N(song.bass[bar] + (s16 % 8 === 6 ? 12 : 0)), t, beat * 1.8, 'sawtooth', 0.09, undefined, musicBus);
  // Pad al inicio del compás
  if (s16 === 0) for (const n of chord) tone(N(n - 12), t, beat * 15, 'triangle', 0.035, undefined, musicBus);
  // Arpegio
  if (mood === 'dia' || s16 % 2 === 0) {
    const n = chord[s16 % chord.length] + (s16 >= 8 ? 12 : 0);
    tone(N(n), t, beat * 0.9, 'square', 0.018, undefined, musicBus);
  }
  // Caja y bombo suaves
  if (s16 % 8 === 4) noise(t, 0.12, 0.08, 1800, 0.6, musicBus);
  if (s16 % 8 === 0) tone(70, t, 0.15, 'sine', 0.18, 40, musicBus);
  step++;
  nextTime = t + beat;
}

function startMusic() {
  if (!ctx || timer !== null) return;
  nextTime = ctx.currentTime + 0.1;
  timer = window.setInterval(() => {
    if (!ctx) return;
    while (nextTime < ctx.currentTime + 0.25) scheduleStep(nextTime);
  }, 60);
}
