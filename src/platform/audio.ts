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
/** Volumen de la música, por debajo de los efectos. */
const MUSIC_VOL = 0.2;

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
  if (musicBus && ctx) musicBus.gain.setTargetAtTime(prefs.music ? MUSIC_VOL : 0, ctx.currentTime, 0.3);
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
      musicBus.gain.value = prefs.music ? MUSIC_VOL : 0;
      // Filtro paso bajo: sonido cálido, sin agudos chillones.
      const warm = ctx.createBiquadFilter();
      warm.type = 'lowpass';
      warm.frequency.value = 3200;
      musicBus.connect(warm).connect(master);
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

/** Un único búfer de ruido (1 s) reutilizado: no se generan búferes nuevos en cada golpe. */
let noiseBuf: AudioBuffer | null = null;
function noiseBuffer(): AudioBuffer {
  if (noiseBuf) return noiseBuf;
  const len = ctx!.sampleRate;
  noiseBuf = ctx!.createBuffer(1, len, ctx!.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return noiseBuf;
}

function noise(start: number, dur: number, vol: number, freq = 2000, q = 1, out?: AudioNode) {
  if (!ctx || !master) return;
  const buf = noiseBuffer();
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
  src.start(start, Math.random() * Math.max(0, 1 - dur), Math.min(1, dur));
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
// Música: synthwave acústica
// ---------------------------------------------------------------------------
// Misma progresión ochentera, pero tocada con instrumentos "de verdad":
// guitarra punteada (síntesis de cuerda Karplus-Strong), contrabajo suave,
// escobillas y un poco de reverberación de sala. Volumen bajo, de fondo.

type Mood = 'dia' | 'noche';
let mood: Mood = 'dia';
let timer: number | null = null;
let nextTime = 0;
let step = 0;
let room: AudioNode | null = null;
const plucks = new Map<string, AudioBuffer>();

const N = (semi: number) => 440 * Math.pow(2, semi / 12);
// Progresiones (semitonos respecto a La 440): día luminoso, noche más tranquila.
const SONGS: Record<Mood, { bpm: number; chords: number[][]; bass: number[] }> = {
  dia: { bpm: 96, chords: [[0, 3, 7], [-4, 0, 3], [3, 7, 10], [-2, 2, 5]], bass: [-24, -28, -21, -26] },
  noche: { bpm: 76, chords: [[-7, -4, 0], [-11, -7, -4], [-4, 0, 3], [-9, -5, -2]], bass: [-31, -35, -28, -33] },
};

export function setMood(m: Mood) {
  mood = m;
}

/** Cuerda pulsada (Karplus-Strong): ruido que pasa por un retardo con filtro. */
function pluckBuffer(freq: number, dur: number, bright: number): AudioBuffer {
  const key = `${freq.toFixed(1)}-${dur}-${bright}`;
  const cached = plucks.get(key);
  if (cached) return cached;
  const sr = ctx!.sampleRate;
  const len = Math.floor(sr * dur);
  const buf = ctx!.createBuffer(1, len, sr);
  const d = buf.getChannelData(0);
  const period = Math.max(2, Math.round(sr / freq));
  const ring = new Float32Array(period);
  for (let i = 0; i < period; i++) ring[i] = Math.random() * 2 - 1;
  let idx = 0;
  let prev = 0;
  for (let i = 0; i < len; i++) {
    const cur = ring[idx];
    const next = ring[(idx + 1) % period];
    // promedio = amortiguación; "bright" controla cuánto brillo conserva
    ring[idx] = (cur * bright + next * (1 - bright)) * 0.996;
    prev = prev * 0.2 + cur * 0.8;
    d[i] = prev;
    idx = (idx + 1) % period;
  }
  plucks.set(key, buf);
  return buf;
}

function pluck(freq: number, t: number, vol: number, dur = 1.6, bright = 0.5, wet = 0.35) {
  if (!ctx || !musicBus) return;
  const src = ctx.createBufferSource();
  src.buffer = pluckBuffer(freq, dur, bright);
  const g = ctx.createGain();
  g.gain.value = vol;
  src.connect(g).connect(musicBus);
  if (room && wet > 0) {
    const send = ctx.createGain();
    send.gain.value = wet;
    g.connect(send).connect(room);
  }
  src.start(t);
}

/** Reverberación de sala corta (impulso de ruido que decae). */
function makeRoom() {
  if (!ctx || !musicBus || room) return;
  const len = Math.floor(ctx.sampleRate * 1.4);
  const imp = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = imp.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
  }
  const conv = ctx.createConvolver();
  conv.buffer = imp;
  const g = ctx.createGain();
  g.gain.value = 0.5;
  conv.connect(g).connect(musicBus);
  room = conv;
}

function scheduleStep(t: number) {
  if (!ctx || !musicBus) return;
  const song = SONGS[mood];
  const bar = Math.floor(step / 16) % song.chords.length;
  const chord = song.chords[bar];
  const s16 = step % 16;
  const beat = 60 / song.bpm / 4;
  const swing = s16 % 2 === 1 ? beat * 0.12 : 0;
  // Contrabajo: negras suaves y graves
  if (s16 % 4 === 0) pluck(N(song.bass[bar] + (s16 === 12 ? 7 : 0)), t, 0.55, 1.2, 0.25, 0.15);
  // Rasgueo de guitarra al inicio del compás (las notas del acorde, una tras otra)
  if (s16 === 0) chord.forEach((n, i) => pluck(N(n - 12), t + i * 0.025, 0.22, 2.4, 0.55));
  // Arpegio punteado, más espaciado de noche
  if (mood === 'dia' ? s16 % 2 === 0 : s16 % 4 === 2) {
    const n = chord[(s16 >> 1) % chord.length] + (s16 >= 8 ? 12 : 0);
    pluck(N(n), t + swing, 0.16, 1.4, 0.6);
  }
  // Escobillas y bombo suave
  if (s16 % 4 === 2) noise(t + swing, 0.09, 0.035, 5200, 0.5, musicBus);
  if (s16 % 8 === 4) noise(t, 0.16, 0.05, 2600, 0.4, musicBus);
  if (s16 % 8 === 0) tone(58, t, 0.22, 'sine', 0.12, 40, musicBus);
  step++;
  nextTime = t + beat;
}

/** Prepara las cuerdas de las dos canciones poco a poco, en ratos libres, para que no haya tirones. */
let warmed = false;
function warmUp() {
  if (warmed || !ctx) return;
  warmed = true;
  const jobs: [number, number, number][] = [];
  for (const song of Object.values(SONGS)) {
    song.bass.forEach((b) => jobs.push([N(b), 1.2, 0.25], [N(b + 7), 1.2, 0.25]));
    for (const chord of song.chords)
      for (const n of chord) jobs.push([N(n - 12), 2.4, 0.55], [N(n), 1.4, 0.6], [N(n + 12), 1.4, 0.6]);
  }
  const idle: (cb: () => void) => void = (cb) =>
    'requestIdleCallback' in window ? (window as any).requestIdleCallback(cb, { timeout: 500 }) : setTimeout(cb, 30);
  const next = () => {
    const j = jobs.shift();
    if (!j) return;
    pluckBuffer(...j);
    idle(next);
  };
  noiseBuffer();
  idle(next);
}

function startMusic() {
  if (!ctx || timer !== null) return;
  makeRoom();
  warmUp();
  nextTime = ctx.currentTime + 0.1;
  timer = window.setInterval(() => {
    if (!ctx) return;
    while (nextTime < ctx.currentTime + 0.3) scheduleStep(nextTime);
  }, 60);
}
