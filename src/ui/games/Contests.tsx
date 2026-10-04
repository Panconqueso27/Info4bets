import { useEffect, useRef, useState } from 'preact/hooks';
import { play } from '../../platform/audio';
import { MiniFrame, useLoop, useMini, type MiniProps } from './kit';

export interface ContestInfo {
  target: number;
  fee: string;
  prize: string;
}
type Props = MiniProps & { contest: ContestInfo };

// ---------------------------------------------------------------------------
// Batalla de breakdance: flechas que caen al ritmo; pulsa en la línea
// ---------------------------------------------------------------------------

const LANES = ['◀', '▲', '▼', '▶'];
const LANE_COLORS = ['#ff4f9a', '#4ff0ff', '#7dff6a', '#ffcc33'];
const HIT_Y = 82; // % de la pista donde está la línea
const FALL_S = 1.6; // segundos que tarda una flecha en caer hasta la línea

interface Note {
  id: number;
  lane: number;
  t: number; // instante (s) en que debe pulsarse
  done?: 'perfect' | 'good' | 'miss';
}

export function Breakdance(p: Props) {
  const mini = useMini('breakdance', 45);
  const notes = useRef<Note[]>([]);
  const nextId = useRef(1);
  const [, setFrame] = useState(0);
  const [judge, setJudge] = useState<{ text: string; key: number } | null>(null);
  const beat = useRef(0);

  useEffect(() => {
    if (!mini.playing) return;
    // Patrón: corcheas a 116 bpm que se van llenando con el tiempo
    const out: Note[] = [];
    const spb = 60 / 116;
    let t = 1.5;
    let lane = 0;
    while (t < 44) {
      const dense = t > 20 ? 0.5 : 1;
      out.push({ id: nextId.current++, lane, t });
      if (t > 30 && Math.random() < 0.25) out.push({ id: nextId.current++, lane: (lane + 2) % 4, t });
      lane = (lane + 1 + Math.floor(Math.random() * 3)) % 4;
      t += spb * (Math.random() < 0.3 ? dense * 0.5 : dense);
    }
    notes.current = out;
  }, [mini.playing]);

  useLoop(mini.playing, () => {
    const now = mini.elapsed();
    for (const n of notes.current)
      if (!n.done && now - n.t > 0.18) {
        n.done = 'miss';
        mini.miss();
      }
    if (Math.floor(now / (60 / 116)) !== beat.current) {
      beat.current = Math.floor(now / (60 / 116));
      if (beat.current % 2 === 0) play.click();
    }
    setFrame((f) => f + 1);
  });

  const tap = (lane: number) => {
    if (!mini.playing) return;
    const now = mini.elapsed();
    let best: Note | null = null;
    for (const n of notes.current) if (!n.done && n.lane === lane && Math.abs(n.t - now) < 0.2 && (!best || Math.abs(n.t - now) < Math.abs(best.t - now))) best = n;
    if (!best) {
      mini.miss();
      setJudge({ text: '¡FUERA DE RITMO!', key: Date.now() });
      return;
    }
    const d = Math.abs(best.t - now);
    best.done = d < 0.07 ? 'perfect' : 'good';
    mini.hit(best.done === 'perfect' ? 2 : 1);
    setJudge({ text: best.done === 'perfect' ? '¡PERFECTO!' : 'BIEN', key: Date.now() });
  };

  const now = mini.elapsed();
  return (
    <MiniFrame mini={mini} cls="breakdance" title="BREAKDANCE" introTitle="Batalla en Times Square" unit="puntos" {...p} intro={<>Las flechas caen al ritmo. Pulsa su botón justo cuando crucen la línea: <b>perfecto = 2 puntos</b>, bien = 1. Cuanto más avanza la canción, más rápido.</>}>
      <div class="dance-floor">
        {LANES.map((l, i) => (
          <div key={l} class="dance-lane" style={{ left: `${i * 25}%` }}>
            {notes.current
              .filter((n) => n.lane === i && !n.done && n.t - now < FALL_S && n.t - now > -0.2)
              .map((n) => (
                <span key={n.id} class="dance-note" style={{ top: `${HIT_Y - ((n.t - now) / FALL_S) * HIT_Y}%`, color: LANE_COLORS[i] }}>
                  {l}
                </span>
              ))}
          </div>
        ))}
        <div class="dance-line" style={{ top: `${HIT_Y}%` }} />
        {judge && (
          <div class="dance-judge" key={judge.key}>
            {judge.text}
          </div>
        )}
      </div>
      <div class="dance-pads">
        {LANES.map((l, i) => (
          <button key={l} class="dance-pad" style={{ borderColor: LANE_COLORS[i], color: LANE_COLORS[i] }} onPointerDown={() => tap(i)}>
            {l}
          </button>
        ))}
      </div>
    </MiniFrame>
  );
}

// ---------------------------------------------------------------------------
// Concurso de comer perritos: alterna MORDER y TRAGAR sin atragantarte
// ---------------------------------------------------------------------------

export function Eating(p: Props) {
  const mini = useMini('perritos', 30);
  const [bites, setBites] = useState(0);
  const [choke, setChoke] = useState(0);
  const [stun, setStun] = useState(0);
  const last = useRef<'m' | 't' | null>(null);
  const BITES_PER_DOG = 10;

  useLoop(mini.playing, (dt) => {
    setChoke((c) => Math.max(0, c - dt * 22));
    setStun((x) => Math.max(0, x - dt));
  });

  const press = (k: 'm' | 't') => {
    if (!mini.playing || stun > 0) return;
    if (last.current === k) {
      // repetir el mismo botón: se atraganta un poco
      setChoke((c) => c + 18);
      play.error();
      return;
    }
    last.current = k;
    setChoke((c) => {
      const n = c + 9;
      if (n >= 100) {
        setStun(2.2);
        mini.miss();
        return 40;
      }
      return n;
    });
    if (k === 't') {
      setBites((b) => {
        const nb = b + 1;
        mini.set(Math.round((nb / BITES_PER_DOG) * 10) / 10);
        if (nb % BITES_PER_DOG === 0) play.coin();
        return nb;
      });
    } else play.click();
  };

  const dogs = Math.floor(bites / BITES_PER_DOG);
  const part = (bites % BITES_PER_DOG) / BITES_PER_DOG;
  return (
    <MiniFrame mini={mini} cls="perritos" title="NATHAN'S" introTitle="Concurso de Coney Island" unit="perritos" {...p} intro={<>Alterna <b>MORDER</b> y <b>TRAGAR</b> lo más rápido que puedas. Si repites botón o vas demasiado deprisa, la barra de atragantamiento se llena y pierdes dos segundos.</>}>
      <div class="eat-stage">
        <div class="eat-plate">
          {Array.from({ length: Math.min(12, dogs) }, (_, i) => (
            <span key={i} class="eat-done" />
          ))}
        </div>
        <div class="eat-dog">
          <span class="bun-dog" />
          <span class="sausage" style={{ right: `${part * 100}%` }} />
        </div>
        <div class="choke">
          <small>{stun > 0 ? '¡COF COF! Te atragantaste' : 'Atragantamiento'}</small>
          <div class="choke-bar">
            <span style={{ width: `${Math.min(100, choke)}%`, background: choke > 70 ? '#ff4a5a' : choke > 45 ? '#ffcc33' : '#35d07f' }} />
          </div>
        </div>
      </div>
      <div class="eat-buttons">
        <button class="eat-btn" disabled={stun > 0} onPointerDown={() => press('m')}>
          MORDER
        </button>
        <button class="eat-btn alt" disabled={stun > 0} onPointerDown={() => press('t')}>
          TRAGAR
        </button>
      </div>
    </MiniFrame>
  );
}

// ---------------------------------------------------------------------------
// Torneo de Simon: repite la secuencia de colores
// ---------------------------------------------------------------------------

const PADS = ['#e8414f', '#3fbf6a', '#3b7bdc', '#ffd24a'];
const PAD_TONES = [330, 392, 494, 587];

export function SimonGame(p: Props) {
  const mini = useMini('simon', 0);
  const [seq, setSeq] = useState<number[]>([]);
  const [showing, setShowing] = useState(false);
  const [lit, setLit] = useState<number | null>(null);
  const [pos, setPos] = useState(0);
  const timers = useRef<number[]>([]);

  const playSeq = (s: number[]) => {
    setShowing(true);
    setPos(0);
    const speed = Math.max(220, 560 - s.length * 30);
    s.forEach((pad, i) => {
      timers.current.push(window.setTimeout(() => {
        setLit(pad);
        play.tone(PAD_TONES[pad]);
      }, 500 + i * speed));
      timers.current.push(window.setTimeout(() => setLit(null), 500 + i * speed + speed * 0.6));
    });
    timers.current.push(window.setTimeout(() => setShowing(false), 500 + s.length * speed));
  };

  useEffect(() => {
    if (!mini.playing) return;
    const first = [Math.floor(Math.random() * 4), Math.floor(Math.random() * 4), Math.floor(Math.random() * 4)];
    setSeq(first);
    playSeq(first);
    return () => timers.current.forEach(clearTimeout);
  }, [mini.playing]);

  const press = (pad: number) => {
    if (!mini.playing || showing) return;
    setLit(pad);
    play.tone(PAD_TONES[pad]);
    window.setTimeout(() => setLit(null), 160);
    if (seq[pos] !== pad) {
      mini.miss();
      window.setTimeout(() => mini.end(), 400);
      return;
    }
    if (pos + 1 === seq.length) {
      mini.hit(1);
      const next = [...seq, Math.floor(Math.random() * 4)];
      setSeq(next);
      window.setTimeout(() => playSeq(next), 450);
    } else setPos(pos + 1);
  };

  return (
    <MiniFrame mini={mini} cls="simon" title="SIMON" introTitle="Torneo en la sala recreativa" unit="rondas" {...p} intro={<>Mira la secuencia de luces y repítela. Cada ronda añade un color y va más rápido. <b>Un fallo y se acabó.</b></>}>
      <div class="simon-stage">
        <div class="simon">
          {PADS.map((c, i) => (
            <button key={c} class={`simon-pad p${i} ${lit === i ? 'lit' : ''}`} style={{ background: c }} onPointerDown={() => press(i)} />
          ))}
          <div class="simon-center">{showing ? 'MIRA' : mini.playing ? 'TÚ' : ''}</div>
        </div>
        <div class="simon-info">
          Ronda {seq.length - 2 > 0 ? seq.length - 2 : 1} · {seq.length} colores
        </div>
      </div>
    </MiniFrame>
  );
}

// ---------------------------------------------------------------------------
// Maratón: mantén la velocidad en la zona verde sin quedarte sin aire
// ---------------------------------------------------------------------------

const KM_FACTOR = 7.6;

export function Marathon(p: Props) {
  const mini = useMini('maraton', 40);
  const st = useRef({ v: 0, stamina: 100, dist: 0, tired: 0 });
  const [, setFrame] = useState(0);

  useLoop(mini.playing, (dt) => {
    const s = st.current;
    s.v = Math.max(0, s.v - dt * 3.2);
    if (s.tired > 0) {
      s.tired -= dt;
      s.v = Math.min(s.v, 3);
    }
    if (s.v > 9) s.stamina -= (s.v - 9) * 14 * dt;
    else if (s.v < 7.5) s.stamina = Math.min(100, s.stamina + 9 * dt);
    if (s.stamina <= 0) {
      s.stamina = 30;
      s.tired = 3;
      mini.miss();
    }
    const before = Math.floor(s.dist / KM_FACTOR);
    s.dist += s.v * dt;
    const km = s.dist / KM_FACTOR;
    if (Math.floor(km) > before && Math.floor(km) % 5 === 0) play.coin();
    // la puntuación son los km recorridos
    mini.set(Math.round(km * 10) / 10);
    setFrame((f) => f + 1);
  });

  const tap = () => {
    if (!mini.playing) return;
    const s = st.current;
    if (s.tired > 0) return;
    s.v = Math.min(12, s.v + 0.85);
  };

  const s = st.current;
  return (
    <MiniFrame mini={mini} cls="maraton" title="MARATÓN" introTitle="Maratón de Nueva York" unit="km" {...p} intro={<>Toca para correr. Mantén la aguja en la <b>zona verde</b>: si vas demasiado rápido te quedas sin aire y tendrás que caminar.</>}>
      <div class="run-stage" onPointerDown={tap}>
        <div class="run-road" style={{ backgroundPositionX: `${-s.dist * 6}px` }} />
        <div class={`runner ${s.tired > 0 ? 'tired' : ''}`}>🏃</div>
        <div class="speedo">
          <div class="speed-zone" />
          <span class="speed-needle" style={{ left: `${(s.v / 12) * 100}%` }} />
        </div>
        <div class="stamina">
          <small>{s.tired > 0 ? '¡Sin aire! Caminando…' : 'Aire'}</small>
          <div class="choke-bar">
            <span style={{ width: `${s.stamina}%`, background: s.stamina < 30 ? '#ff4a5a' : '#4ff0ff' }} />
          </div>
        </div>
        <div class="run-km">{(s.dist / KM_FACTOR).toFixed(1)} km</div>
        <div class="run-hint">TOCA PARA CORRER</div>
      </div>
    </MiniFrame>
  );
}
