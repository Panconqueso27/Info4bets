import { useEffect, useRef, useState } from 'preact/hooks';
import { drawPortrait, PORTRAIT_H, PORTRAIT_W, voiceOf, type Mood, type Person } from '../../art/portrait';
import { babble } from '../../platform/audio';
import './stage.css';

/**
 * Kit de escenario de los minijuegos: retratos que hablan (boca, parpadeo,
 * voz de balbuceo y bocadillo con el texto letra a letra), fondos de pixel
 * art animados y textos que saltan (+1, propinas…).
 */

// ---------------------------------------------------------------------------
// Retrato animado
// ---------------------------------------------------------------------------

export function Portrait({ person, talking = false, mood = 'normal', silhouette, scale = 4, look = 0, class: cls = '' }: { person: Person; talking?: boolean; mood?: Mood; silhouette?: string; scale?: number; look?: -1 | 0 | 1; class?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const st = useRef({ talking, mood, silhouette, look });
  st.current = { talking, mood, silhouette, look };
  useEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (!ctx) return;
    let raf = 0;
    let last = '';
    let blinkAt = performance.now() + 1500 + Math.random() * 2500;
    const tick = (t: number) => {
      const s = st.current;
      const blink = t > blinkAt;
      if (t > blinkAt + 130) blinkAt = t + 1800 + Math.random() * 3200;
      const mouth = s.talking ? ([1, 2, 1, 0] as const)[Math.floor(t / 85) % 4] : 0;
      const key = `${blink}${mouth}${s.mood}${s.silhouette}${s.look}`;
      if (key !== last) {
        last = key;
        ctx.clearRect(0, 0, PORTRAIT_W, PORTRAIT_H);
        drawPortrait(ctx, person, { mouth, blink, mood: s.mood, silhouette: s.silhouette, look: s.look });
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [person]);
  return <canvas ref={ref} width={PORTRAIT_W} height={PORTRAIT_H} class={`portrait ${talking ? 'talking' : ''} ${cls}`} style={{ width: PORTRAIT_W * scale, height: PORTRAIT_H * scale }} />;
}

// ---------------------------------------------------------------------------
// Hablar: voz + boca + texto letra a letra
// ---------------------------------------------------------------------------

export interface Talk {
  line: string;
  /** Cambia con cada frase (para reiniciar la animación del bocadillo). */
  key: number;
  talking: boolean;
  mood: Mood;
  say: (text: string, mood?: Mood) => void;
  clear: () => void;
}

/** Estado de lo que dice una persona: al decir algo suena su voz y mueve la boca. */
export function useTalk(person: Person | null): Talk {
  const [line, setLine] = useState('');
  const [key, setKey] = useState(0);
  const [talking, setTalking] = useState(false);
  const [mood, setMood] = useState<Mood>('normal');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // la persona actual (las frases programadas con retraso usan siempre la voz de quien está)
  const who = useRef(person);
  who.current = person;
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);
  return {
    line,
    key,
    talking,
    mood,
    say: (text, m = 'normal') => {
      const person = who.current;
      if (!person) return;
      setLine(text);
      setKey((k) => k + 1);
      setMood(m);
      setTalking(true);
      const dur = Math.max(babble(text, voiceOf(person)), text.length * 0.028);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setTalking(false), dur * 1000 + 120);
    },
    clear: () => {
      setLine('');
      setTalking(false);
    },
  };
}

/** Bocadillo con el texto escribiéndose letra a letra. */
export function Bubble({ text, k, side = 'left', class: cls = '', speed = 34 }: { text: string; k: number; side?: 'left' | 'right' | 'top'; class?: string; speed?: number }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    setN(0);
    if (!text) return;
    const id = setInterval(() => setN((x) => (x >= text.length ? (clearInterval(id), x) : x + 1)), 1000 / speed);
    return () => clearInterval(id);
  }, [k, text]);
  if (!text) return null;
  return (
    <div class={`bubble bubble-${side} ${cls}`} key={k}>
      {text.slice(0, n)}
      <span class="bubble-rest">{text.slice(n)}</span>
    </div>
  );
}

/** Persona que habla: retrato + bocadillo. */
export function Talker({ person, talk, side = 'left', silhouette, scale = 4, class: cls = '' }: { person: Person; talk: Talk; side?: 'left' | 'right' | 'top'; silhouette?: string; scale?: number; class?: string }) {
  return (
    <div class={`talker talker-${side} ${cls}`}>
      <Portrait person={person} talking={talk.talking} mood={talk.mood} silhouette={silhouette} scale={scale} />
      <Bubble text={talk.line} k={talk.key} side={side} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Textos que saltan (+1, propina, ¡fallo!)
// ---------------------------------------------------------------------------

export interface Pop {
  id: number;
  text: string;
  x: number;
  y: number;
  cls: string;
}

export function usePops() {
  const [pops, setPops] = useState<Pop[]>([]);
  const id = useRef(0);
  return {
    pops,
    /** x, y en % del contenedor. */
    pop: (text: string, x = 50, y = 40, cls = 'good') => {
      const p = { id: ++id.current, text, x, y, cls };
      setPops((l) => [...l.slice(-8), p]);
      setTimeout(() => setPops((l) => l.filter((q) => q.id !== p.id)), 1100);
    },
  };
}

export function PopLayer({ pops }: { pops: Pop[] }) {
  return (
    <div class="pop-layer">
      {pops.map((p) => (
        <span key={p.id} class={`float-pop ${p.cls}`} style={{ left: `${p.x}%`, top: `${p.y}%` }}>
          {p.text}
        </span>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Fondo de pixel art animado
// ---------------------------------------------------------------------------

export type SceneDraw = (ctx: CanvasRenderingContext2D, t: number, w: number, h: number) => void;

/**
 * Lienzo de fondo a baja resolución, ampliado sin suavizado. `draw` se llama
 * a `fps` fotogramas por segundo con el tiempo en segundos.
 */
export function Backdrop({ draw, w = 180, h = 320, fps = 12, class: cls = '' }: { draw: SceneDraw; w?: number; h?: number; fps?: number; class?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const fn = useRef(draw);
  fn.current = draw;
  useEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (!ctx) return;
    let raf = 0;
    let last = -1;
    const t0 = performance.now();
    const tick = (now: number) => {
      const f = Math.floor(((now - t0) / 1000) * fps);
      if (f !== last) {
        last = f;
        fn.current(ctx, (now - t0) / 1000, w, h);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [w, h, fps]);
  return <canvas ref={ref} width={w} height={h} class={`backdrop ${cls}`} />;
}

/** Pinta un rectángulo (atajo para los fondos). */
export const R = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, c: string) => {
  ctx.fillStyle = c;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
};

/** Sacudida de pantalla: cambia la clave para relanzar la animación CSS. */
export function useShake() {
  const [n, setN] = useState(0);
  return { cls: n ? `shake-${n % 2}` : '', shake: () => setN((x) => x + 1) };
}
