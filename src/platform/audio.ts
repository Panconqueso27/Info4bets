/**
 * Sonido del juego, sintetizado con Web Audio (sin archivos):
 * efectos chiptune y una banda sonora synthwave de los 80 que cambia
 * de día a noche. Arranca con el primer toque (política de los navegadores).
 */
const KEY = 'laciudad.audio';

interface Prefs {
  sfx: boolean;
  music: boolean;
  ambient: boolean;
}

let prefs: Prefs = load();
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let musicBus: GainNode | null = null;
/** Volumen de la música, por debajo de los efectos. */
const MUSIC_VOL = 0.26;
let ambBus: GainNode | null = null;
/** Volumen del ambiente: siempre por debajo de la música. */
const AMB_VOL = 0.55;

function load(): Prefs {
  try {
    return { sfx: true, music: true, ambient: true, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') };
  } catch {
    return { sfx: true, music: true, ambient: true };
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
  if (ambBus && ctx) ambBus.gain.setTargetAtTime(prefs.ambient ? AMB_VOL : 0, ctx.currentTime, 0.3);
  if (prefs.music) startMusic();
  if (prefs.ambient) startAmbience();
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
      warm.frequency.value = 5200;
      musicBus.connect(warm).connect(master);
      ambBus = ctx.createGain();
      ambBus.gain.value = prefs.ambient ? AMB_VOL : 0;
      ambBus.connect(master);
    } catch {
      return;
    }
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  if (prefs.music) startMusic();
  if (prefs.ambient) startAmbience();
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
// Música: synthwave ochentera (la original), más animada y pegadiza
// ---------------------------------------------------------------------------
// Canción de 16 compases en bucle con secciones: intro (arpegio y bajo),
// estrofa con melodía, estribillo con la melodía una octava arriba y un
// redoble de caja antes de volver. De noche, más lenta y suave.

type Mood = 'dia' | 'noche';
let mood: Mood = 'dia';
let timer: number | null = null;
let nextTime = 0;
let step = 0;
let echo: AudioNode | null = null;

const N = (semi: number) => 440 * Math.pow(2, semi / 12);

interface Song {
  bpm: number;
  chords: number[][];
  bass: number[];
  /** Melodía de 2 compases (32 semicorcheas): nota o null (silencio). */
  hook: (number | null)[];
}

const _ = null;
const SONGS: Record<Mood, Song> = {
  // La menor – Fa – Do – Sol: el clásico de los 80.
  dia: {
    bpm: 116,
    chords: [[0, 3, 7], [-4, 0, 3], [3, 7, 10], [-2, 2, 5]],
    bass: [-24, -28, -21, -26],
    hook: [12, _, 15, _, 19, _, 17, 15, _, _, 12, _, 15, _, 10, _, 12, _, _, 15, _, 17, _, 19, 22, _, 19, _, 17, _, 15, _],
  },
  noche: {
    bpm: 96,
    chords: [[-7, -4, 0], [-11, -7, -4], [-4, 0, 3], [-9, -5, -2]],
    bass: [-31, -35, -28, -33],
    hook: [5, _, _, 8, _, _, 12, _, 10, _, 8, _, _, _, 5, _, 3, _, _, 5, _, _, 8, _, 7, _, 5, _, 3, _, _, _],
  },
};

export function setMood(m: Mood) {
  mood = m;
}

/** Eco en tiempo (corchea con puntillo) para la melodía: muy synthwave. */
function makeEcho() {
  if (!ctx || !musicBus || echo) return;
  const d = ctx.createDelay(1);
  d.delayTime.value = 0.39;
  const fb = ctx.createGain();
  fb.gain.value = 0.32;
  const wet = ctx.createGain();
  wet.gain.value = 0.35;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 2400;
  d.connect(lp).connect(fb).connect(d);
  lp.connect(wet).connect(musicBus);
  echo = d;
}

function lead(freq: number, t: number, dur: number, vol: number) {
  if (!ctx || !musicBus) return;
  // Dos ondas ligeramente desafinadas: sonido gordo de sintetizador
  for (const [type, det] of [['square', -6], ['sawtooth', 6]] as [OscillatorType, number][]) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    o.detune.value = det;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.015);
    g.gain.setTargetAtTime(vol * 0.6, t + 0.05, 0.08);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(musicBus);
    if (echo) g.connect(echo);
    o.start(t);
    o.stop(t + dur + 0.05);
  }
}

function scheduleStep(t: number) {
  if (!ctx || !musicBus) return;
  const song = SONGS[mood];
  const night = mood === 'noche';
  const bar16 = Math.floor(step / 16) % 16; // compás dentro de la canción
  const bar = bar16 % 4;
  const chord = song.chords[bar];
  const s16 = step % 16;
  const beat = 60 / song.bpm / 4;
  const section = bar16 < 4 ? 'intro' : bar16 < 8 ? 'estrofa' : bar16 < 14 ? 'estribillo' : 'puente';
  const full = section === 'estribillo';

  // Bajo en corcheas con octava saltarina
  if (s16 % 2 === 0) tone(N(song.bass[bar] + (s16 % 8 === 6 ? 12 : 0)), t, beat * 1.7, 'sawtooth', night ? 0.07 : 0.09, undefined, musicBus);
  // Pad de acorde
  if (s16 === 0) for (const n of chord) tone(N(n - 12), t, beat * 15, 'triangle', 0.035, undefined, musicBus);
  // Arpegio brillante en semicorcheas
  if (!night || s16 % 2 === 0) {
    const n = chord[s16 % chord.length] + (s16 >= 8 ? 12 : 0) + (full ? 12 : 0);
    tone(N(n), t, beat * 0.8, 'square', full ? 0.016 : 0.02, undefined, musicBus);
  }
  // Melodía pegadiza (en estrofa y estribillo; en el estribillo, una octava arriba)
  if (section === 'estrofa' || full) {
    const note = song.hook[(bar16 % 2) * 16 + s16];
    if (note !== null) lead(N(note - 12 + (full ? 12 : 0)), t, beat * 2.6, night ? 0.026 : 0.034);
  }
  // Batería: bombo en negras, caja en 2 y 4, charles en corcheas
  const kick = section === 'intro' ? s16 % 8 === 0 : s16 % 4 === 0;
  if (kick) tone(120, t, 0.18, 'sine', night ? 0.2 : 0.28, 38, musicBus);
  if (section !== 'intro' && s16 % 8 === 4) {
    noise(t, 0.16, night ? 0.09 : 0.13, 1800, 0.6, musicBus);
    tone(190, t, 0.08, 'triangle', 0.05, 120, musicBus);
  }
  if (s16 % 2 === 0) noise(t, 0.035, s16 % 4 === 2 ? 0.05 : 0.025, 8000, 1.2, musicBus);
  // Redoble antes de volver a empezar
  if (section === 'puente' && bar16 === 15 && s16 >= 8) noise(t, 0.08, 0.05 + (s16 - 8) * 0.012, 2000, 0.6, musicBus);
  // Platillo al empezar el estribillo
  if (bar16 === 8 && s16 === 0) noise(t, 1.2, 0.07, 6000, 0.4, musicBus);
  step++;
  nextTime = t + beat;
}

function startMusic() {
  if (!ctx || timer !== null) return;
  noiseBuffer();
  makeEcho();
  nextTime = ctx.currentTime + 0.1;
  timer = window.setInterval(() => {
    if (!ctx) return;
    while (nextTime < ctx.currentTime + 0.3) scheduleStep(nextTime);
  }, 60);
}

// ---------------------------------------------------------------------------
// Sonido ambiente: sigue al clima, la hora, el lugar y lo que pasa
// ---------------------------------------------------------------------------

export type AmbPlace = 'casa' | 'calle' | 'diner' | 'alcaldia' | 'reparto' | 'fuera';

export interface Ambience {
  weather: 'despejado' | 'nublado' | 'lluvia' | 'tormenta' | 'nieve';
  /** Hora local (0–24, con decimales). */
  hour: number;
  place: AmbPlace;
  /** Hay obras en marcha (solar, obras públicas o renovaciones). */
  works: boolean;
  pet: 'gato' | 'perro' | null;
  /** Mucha gente (crucero, Times Square...). */
  crowd: boolean;
  /** Fecha especial: 'navidad' | 'julio' | null. */
  fiesta: string | null;
}

let amb: Ambience = { weather: 'despejado', hour: 12, place: 'casa', works: false, pet: null, crowd: false, fiesta: null };
let ambTimer: number | null = null;
/** Capas continuas (lluvia, viento, ciudad, murmullo): ruido filtrado en bucle. */
const beds: Record<string, { gain: GainNode; filter?: BiquadFilterNode }> = {};

export function setAmbience(a: Partial<Ambience>) {
  const next = { ...amb, ...a };
  const changed = (Object.keys(a) as (keyof Ambience)[]).some((k) => next[k] !== amb[k]);
  amb = next;
  if (changed) updateBeds();
}

function bed(name: string, type: BiquadFilterType, freq: number, q: number, lfo?: { rate: number; depth: number }) {
  if (!ctx || !ambBus || beds[name]) return;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer();
  src.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  const g = ctx.createGain();
  g.gain.value = 0;
  src.connect(f).connect(g).connect(ambBus);
  if (lfo) {
    // Ráfagas: el filtro sube y baja despacio
    const o = ctx.createOscillator();
    o.frequency.value = lfo.rate;
    const og = ctx.createGain();
    og.gain.value = lfo.depth;
    o.connect(og).connect(f.frequency);
    o.start();
  }
  src.start(0, Math.random());
  beds[name] = { gain: g, filter: f };
}

function startAmbience() {
  if (!ctx || ambTimer !== null) return;
  bed('lluvia', 'lowpass', 1600, 0.3);
  bed('lluviaAlta', 'highpass', 5000, 0.4);
  bed('viento', 'bandpass', 420, 0.9, { rate: 0.13, depth: 260 });
  bed('ciudad', 'lowpass', 260, 0.5);
  bed('murmullo', 'bandpass', 650, 1.4, { rate: 0.4, depth: 120 });
  updateBeds();
  ambTimer = window.setInterval(ambientTick, 250);
}

function updateBeds() {
  if (!ctx || !beds.lluvia) return;
  const w = amb.weather;
  const indoor = amb.place === 'diner' || amb.place === 'alcaldia';
  const muffle = indoor ? 0.35 : 1;
  const day = amb.hour >= 7 && amb.hour < 21;
  const set = (name: string, v: number) => beds[name].gain.gain.setTargetAtTime(v, ctx!.currentTime, 1.2);
  set('lluvia', (w === 'tormenta' ? 0.5 : w === 'lluvia' ? 0.3 : 0) * muffle);
  set('lluviaAlta', (w === 'tormenta' ? 0.07 : w === 'lluvia' ? 0.04 : 0) * muffle);
  set('viento', (w === 'nieve' ? 0.32 : w === 'tormenta' ? 0.18 : w === 'nublado' ? 0.07 : 0.02) * muffle);
  set('ciudad', indoor ? 0.04 : day ? 0.16 : 0.07);
  set('murmullo', indoor ? (amb.place === 'diner' ? 0.11 : 0.05) : amb.crowd ? 0.08 : 0);
}

const chance = (perSecond: number) => Math.random() < perSecond / 4;

/** Cada 250 ms decide si suena algo puntual según lo que está pasando. */
function ambientTick() {
  if (!ctx || !ambBus || !prefs.ambient || ctx.state !== 'running') return;
  const t = ctx.currentTime + 0.05;
  const h = amb.hour;
  const w = amb.weather;
  const wet = w === 'lluvia' || w === 'tormenta';
  const out = ambBus;
  const indoor = amb.place === 'diner' || amb.place === 'alcaldia';
  // Pájaros al amanecer (y algo por la mañana), si no llueve ni nieva
  if (!wet && w !== 'nieve' && !indoor && h >= 5 && h < 10 && chance(h < 8 ? 0.7 : 0.2)) bird(t, out);
  // Grillos de noche en verano, si no llueve
  if (!wet && w !== 'nieve' && (h >= 21 || h < 5) && chance(0.35)) crickets(t, out);
  // Tráfico: bocinas de día en la calle
  if (!indoor && h >= 8 && h < 20 && chance(amb.place === 'reparto' ? 0.12 : 0.05)) horn(t, out);
  // Sirena lejana de noche
  if ((h >= 22 || h < 4) && chance(0.012)) siren(t, out);
  // Lugares
  if (amb.place === 'diner') {
    if (chance(0.35)) tone(2600 + Math.random() * 900, t, 0.12, 'triangle', 0.025, undefined, out); // platos
    if (chance(0.03)) [1568, 2093].forEach((f, i) => tone(f, t + i * 0.09, 0.4, 'sine', 0.03, undefined, out)); // caja registradora
  }
  if (amb.place === 'alcaldia') {
    if (chance(0.12)) for (let i = 0; i < 4 + Math.random() * 6; i++) noise(t + i * 0.09, 0.03, 0.06, 3000, 2, out); // máquina de escribir
    if (chance(0.02)) for (let i = 0; i < 2; i++) for (let k = 0; k < 8; k++) tone(k % 2 ? 1100 : 900, t + i * 0.6 + k * 0.04, 0.04, 'square', 0.012, undefined, out); // teléfono
  }
  // Obras: martillo y hormigonera
  if (amb.works && !indoor && h >= 7 && h < 19 && chance(0.25)) {
    noise(t, 0.05, 0.08, 1500, 1.5, out);
    tone(170, t, 0.06, 'square', 0.02, 110, out);
  }
  // Mascota
  if (amb.pet && (amb.place === 'casa' || amb.place === 'calle') && chance(0.012)) (amb.pet === 'perro' ? bark : meow)(t, out);
  // Fiestas
  if (amb.fiesta === 'navidad' && chance(0.05)) [0, 4, 7, 12].forEach((s, i) => tone(N(s + 12), t + i * 0.3, 1.2, 'sine', 0.025, undefined, out));
  if (amb.fiesta === 'julio' && (h >= 20 || h < 1) && chance(0.15)) firework(t, out);
}

/** El trueno lo pide la escena justo después de cada relámpago. */
export function thunder(delay = 0.4) {
  if (!ctx || !ambBus || !prefs.ambient) return;
  const t = ctx.currentTime + delay;
  noise(t, 2.4, 0.5, 90, 0.5, ambBus);
  noise(t + 0.05, 0.6, 0.25, 260, 0.6, ambBus);
  tone(48, t, 1.8, 'sine', 0.2, 30, ambBus);
}

function bird(t: number, out: AudioNode) {
  const base = 2600 + Math.random() * 1600;
  const n = 2 + Math.floor(Math.random() * 4);
  for (let i = 0; i < n; i++) tone(base * (1 + Math.random() * 0.25), t + i * 0.11, 0.07, 'sine', 0.03, base * 1.35, out);
}

function crickets(t: number, out: AudioNode) {
  for (let i = 0; i < 3; i++) tone(4400 + Math.random() * 200, t + i * 0.05, 0.03, 'sine', 0.012, undefined, out);
}

function horn(t: number, out: AudioNode) {
  const long = Math.random() < 0.4;
  for (const f of [370, 466]) tone(f, t, long ? 0.5 : 0.18, 'square', 0.012, undefined, out);
}

function siren(t: number, out: AudioNode) {
  if (!ctx) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = 'sine';
  for (let i = 0; i < 6; i++) {
    o.frequency.setValueAtTime(620, t + i * 0.7);
    o.frequency.linearRampToValueAtTime(880, t + i * 0.7 + 0.35);
  }
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.012, t + 1);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 4.2);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + 4.3);
}

function bark(t: number, out: AudioNode) {
  for (let i = 0; i < 2; i++) {
    tone(320, t + i * 0.22, 0.12, 'sawtooth', 0.03, 180, out);
    noise(t + i * 0.22, 0.1, 0.04, 900, 1, out);
  }
}

function meow(t: number, out: AudioNode) {
  if (!ctx) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = 'triangle';
  o.frequency.setValueAtTime(600, t);
  o.frequency.linearRampToValueAtTime(900, t + 0.18);
  o.frequency.linearRampToValueAtTime(520, t + 0.55);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.03, t + 0.05);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + 0.65);
}

function firework(t: number, out: AudioNode) {
  tone(400, t, 0.6, 'sine', 0.02, 1600, out);
  noise(t + 0.6, 0.5, 0.12, 400, 0.5, out);
  for (let i = 0; i < 6; i++) noise(t + 0.8 + i * 0.05 + Math.random() * 0.1, 0.03, 0.04, 5000, 2, out);
}
