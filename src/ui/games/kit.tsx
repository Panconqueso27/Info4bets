import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { Letters } from '../AnimText';
import { MINUTES_PER_POINT } from '../../core/game';
import { play } from '../../platform/audio';

/**
 * Piezas comunes de los minijuegos: fases (intro → juego → fin), cronómetro,
 * puntos con combo y récord guardado en el móvil.
 */
export const GAME_SECONDS = 60;
const RECORDS_KEY = 'laciudad.records';

export function records(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(RECORDS_KEY) ?? '{}');
  } catch {
    return {};
  }
}

/** Guarda la puntuación; devuelve true si es un récord nuevo. */
export function saveRecord(id: string, score: number): boolean {
  const r = records();
  if (score <= (r[id] ?? 0)) return false;
  r[id] = score;
  try {
    localStorage.setItem(RECORDS_KEY, JSON.stringify(r));
  } catch {
    /* sin almacenamiento */
  }
  return true;
}

export type Phase = 'intro' | 'play' | 'end';

export interface MiniProps {
  onFinish: (points: number) => void;
  onClose: () => void;
}

/** Estado de una partida de minijuego. */
export function useMini(id: string, seconds = GAME_SECONDS) {
  const [phase, setPhase] = useState<Phase>('intro');
  const [left, setLeft] = useState(seconds);
  const [score, setScore] = useState(0);
  const [misses, setMisses] = useState(0);
  const [combo, setCombo] = useState(0);
  const [record, setRecord] = useState(false);
  const scoreRef = useRef(0);
  const startedAt = useRef(0);

  useEffect(() => {
    if (phase !== 'play') return;
    startedAt.current = Date.now();
    const iv = setInterval(() => {
      const l = Math.max(0, seconds - Math.floor((Date.now() - startedAt.current) / 1000));
      setLeft(l);
      if (l <= 0) {
        clearInterval(iv);
        setRecord(saveRecord(id, scoreRef.current));
        setPhase('end');
        play.achievement();
      }
    }, 200);
    return () => clearInterval(iv);
  }, [phase]);

  return {
    phase,
    left,
    score,
    misses,
    combo,
    record,
    playing: phase === 'play',
    /** Segundos jugados (para subir la dificultad). */
    elapsed: () => (phase === 'play' ? (Date.now() - startedAt.current) / 1000 : 0),
    start: () => setPhase('play'),
    hit: (n = 1) => {
      scoreRef.current += n;
      setScore(scoreRef.current);
      setCombo((c) => c + 1);
      play.coin();
    },
    miss: () => {
      setMisses((m) => m + 1);
      setCombo(0);
      play.error();
    },
  };
}

export function MiniFrame({
  mini,
  title,
  cls,
  introTitle,
  intro,
  unit,
  onFinish,
  onClose,
  children,
  pays,
}: {
  mini: ReturnType<typeof useMini>;
  title: string;
  cls: string;
  introTitle: string;
  intro: ComponentChildren;
  unit: string;
  children: ComponentChildren;
  /** Si el minijuego paga dinero en vez de acortar la jornada. */
  pays?: { per: number; fmt: (n: number) => string };
} & MiniProps) {
  const best = records();
  return (
    <div class={`minigame mg-${cls}`}>
      <div class="mg-head">
        <span class="mg-title">{title}</span>
        <span class={`mg-timer ${mini.left <= 10 ? 'hot' : ''}`}>⏱ {mini.left}s</span>
        <span class="mg-score">
          ✔ {mini.score} · {pays ? `+${pays.fmt(mini.score * pays.per)}` : `−${mini.score * MINUTES_PER_POINT} min`}
        </span>
      </div>
      {mini.combo >= 3 && mini.playing && (
        <div class="mg-combo" key={mini.combo}>
          COMBO ×{mini.combo}
        </div>
      )}
      {children}
      {mini.phase === 'intro' && (
        <div class="mg-overlay">
          <h3>
            <Letters text={introTitle} />
          </h3>
          <p>
            {intro}
            <br />
            {pays ? (
              <>
                Cada acierto te deja <b>{pays.fmt(pays.per)}</b> en la caja.
              </>
            ) : (
              <>
                Cada acierto descuenta <b>{MINUTES_PER_POINT} minutos</b> de tu jornada.
              </>
            )}
          </p>
          {best[cls] ? <div class="mg-best">🏆 Récord: {best[cls]}</div> : null}
          <button class="btn big-cta" onClick={mini.start}>
            Empezar
          </button>
          <button class="btn secondary" onClick={onClose}>
            Ahora no
          </button>
        </div>
      )}
      {mini.phase === 'end' && (
        <div class="mg-overlay">
          <h3>
            <Letters text="¡Tiempo!" />
          </h3>
          {mini.record && <div class="mg-record">¡NUEVO RÉCORD!</div>}
          <div class="mg-big">{mini.score}</div>
          <p>
            {unit} ({mini.misses} fallos) · {pays ? <>ganas <b>{pays.fmt(mini.score * pays.per)}</b></> : <>tu jornada se acorta <b>{mini.score * MINUTES_PER_POINT} minutos</b></>}
          </p>
          <button class="btn big-cta" onClick={() => onFinish(mini.score)}>
            {pays ? 'Cerrar el puesto' : 'Volver al trabajo'}
          </button>
        </div>
      )}
    </div>
  );
}

/** Bucle de animación mientras se juega (para cosas que avanzan solas). */
export function useLoop(active: boolean, fn: (dt: number) => void) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    if (!active) return;
    let last = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      ref.current(Math.min(0.1, (t - last) / 1000));
      last = t;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active]);
}

export const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
