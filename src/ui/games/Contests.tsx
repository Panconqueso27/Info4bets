import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { fx, play } from '../../platform/audio';
import { MiniFrame, pick, useLoop, useMini, type MiniProps } from './kit';
import { Backdrop, Portrait, PopLayer, usePops, useShake, useTalk } from './stage';
import { Host, personOf, sceneFps, shout, useChatter, useCountdownCue } from './scenes-office';
import { danceView, drawArcade, drawConey, drawMarathon, drawTimesSquare, runView, SIMON_COLORS, type ArcadeView, type BodyColors, type ConeyView, type DanceMove } from './scenes-contests';
import './office.css';
import './contests.css';

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
/** Línea de bajo (Hz por tiempo; 0 = silencio) para acompañar el clic. */
const BASS = [110, 0, 110, 131, 98, 0, 98, 82];
const BBOY: BodyColors = { skin: '#9a6440', top: '#c0392b', legs: '#1c1c28', shoes: '#f4efe2', hair: '#1c1818', cap: '#2f6fb3' };

const MC_IDLE = ['¡Times Square, hagan ruido!', '¡Brooklyn en la casa!', '¡Siente el ritmo, siente el beat!', '¡Las manos arriba, Nueva York!', '¡Eso es estilo de la calle!', '¡El DJ está que arde esta noche!'];
const MC_HYPE = ['¡ESE ES MI B-BOY!', '¡Molinos de viento, señoras y señores!', '¡El Bronx está flipando!', '¡Qué estilo! ¡Qué flow!', '¡Fresh! ¡Pero qué fresh!'];
const MC_MISS = ['¡Uyyy! Se le fue el ritmo…', '¡Al suelo! ¡Levántate, chaval!', '¡Más ritmo, que esto es Broadway!'];
const CROWD_HYPE = ['¡OOOH!', '¡FRESH!', '¡GO GO GO!', '¡WOW!', '¡OTRA!'];

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
  const [judge, setJudge] = useState<{ text: string; key: number; cls: string } | null>(null);
  const [padFx, setPadFx] = useState<{ lane: number; cls: string; k: number } | null>(null);
  const beat = useRef(0);
  const view = useRef(danceView());
  const mc = useMemo(() => personOf(808, { wear: 'cuero', hair: 'gorra', glasses: true, outfit: '#7b4fa0', skin: '#6c4228', pitch: 190 }), []);
  const talk = useTalk(mc);
  const speak = useChatter(talk, mini.playing, MC_IDLE, [8, 12]);
  const shake = useShake();
  const { pops, pop } = usePops();
  const perfects = useRef(0);

  useEffect(() => {
    if (mini.phase === 'count') speak('¡Times Square! ¡Un aplauso para el aspirante!', 'feliz', true);
    if (mini.phase === 'play') fx.crowd(1.6);
  }, [mini.phase]);
  useCountdownCue(mini.left, mini.playing, 10, () => speak('¡Diez segundos! ¡Lo mejor para el final!', 'feliz', true));

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

  const fall = () => {
    const v = view.current;
    v.move = 'fall';
    v.moveUntil = v.now + 0.7;
    v.boo = v.now;
  };

  useLoop(mini.playing, () => {
    const now = mini.elapsed();
    for (const n of notes.current)
      if (!n.done && now - n.t > 0.18) {
        n.done = 'miss';
        mini.miss();
        if (view.current.move !== 'fall' || view.current.now > view.current.moveUntil) fall();
      }
    const b = Math.floor(now / (60 / 116));
    view.current.beat = (now / (60 / 116)) % 1;
    if (b !== beat.current) {
      beat.current = b;
      if (b % 2 === 0) play.click();
      const f = BASS[b % BASS.length];
      if (f) play.tone(f);
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
      setJudge({ text: '¡FUERA DE RITMO!', key: Date.now(), cls: 'bad' });
      setPadFx({ lane, cls: 'bad', k: Date.now() });
      shake.shake();
      fall();
      speak(MC_MISS, 'nervios');
      return;
    }
    const d = Math.abs(best.t - now);
    best.done = d < 0.07 ? 'perfect' : 'good';
    mini.hit(best.done === 'perfect' ? 2 : 1);
    setJudge({ text: best.done === 'perfect' ? '¡PERFECTO!' : 'BIEN', key: Date.now(), cls: best.done });
    setPadFx({ lane, cls: best.done, k: Date.now() });
    pop(best.done === 'perfect' ? '+2' : '+1', lane * 25 + 12.5, 70, best.done === 'perfect' ? 'gold' : 'good');
    const v = view.current;
    if (best.done === 'perfect') {
      perfects.current++;
      if (perfects.current % 4 === 0) {
        v.move = pick<DanceMove>(['mill', 'spin', 'freeze']);
        v.moveUntil = v.now + 1.1;
        v.hype = v.now;
        shout(pick(CROWD_HYPE), perfects.current);
        if (perfects.current % 12 === 0) {
          speak(MC_HYPE, 'feliz');
          fx.crowd(1.2);
        }
      }
    } else if (v.now > v.moveUntil) {
      v.move = 'pose';
      v.moveUntil = v.now + 0.25;
    }
  };

  const now = mini.elapsed();
  return (
    <MiniFrame mini={mini} cls="breakdance" title="BREAKDANCE" introTitle="Batalla en Times Square" unit="puntos" {...p} intro={<>Las flechas caen al ritmo. Pulsa su botón justo cuando crucen la línea: <b>perfecto = 2 puntos</b>, bien = 1. Cuanto más avanza la canción, más rápido.</>}>
      <div class={`dance-floor bk-stage ${shake.cls}`}>
        <Backdrop draw={(ctx, t) => drawTimesSquare(ctx, t, view.current, BBOY)} w={180} h={320} fps={sceneFps(30)} />
        <Host person={mc} talk={talk} name="MC Flash" class="bk-host" />
        <div class="bk-track">
          {LANES.map((l, i) => (
            <div key={l} class="dance-lane bk-lane" style={{ left: `${i * 25}%`, '--lc': LANE_COLORS[i] }}>
              <span class={`bk-receptor ${padFx && padFx.lane === i ? padFx.cls : ''}`} key={padFx && padFx.lane === i ? padFx.k : 0} style={{ top: `${HIT_Y}%` }}>
                {l}
              </span>
              {notes.current
                .filter((n) => n.lane === i && !n.done && n.t - now < FALL_S && n.t - now > -0.2)
                .map((n) => (
                  <span key={n.id} class="dance-note bk-note" style={{ top: `${HIT_Y - ((n.t - now) / FALL_S) * HIT_Y}%`, color: LANE_COLORS[i] }}>
                    {l}
                  </span>
                ))}
            </div>
          ))}
          <div class="dance-line bk-line" style={{ top: `${HIT_Y}%` }} />
          {judge && (
            <div class={`dance-judge bk-judge ${judge.cls}`} key={judge.key}>
              {judge.text}
            </div>
          )}
        </div>
        <PopLayer pops={pops} />
      </div>
      <div class="dance-pads bk-pads">
        {LANES.map((l, i) => (
          <button key={l} class="dance-pad bk-pad" style={{ borderColor: LANE_COLORS[i], color: LANE_COLORS[i], '--lc': LANE_COLORS[i] }} onPointerDown={() => tap(i)}>
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

const ANN_IDLE = ['¡Mírenlo engullir! ¡Qué máquina!', '¡Huele a mostaza y a gloria!', '¡El favorito no afloja, amigos!', '¡Coney Island está en pie!', '¡Récord a la vista en el paseo!', '¡Qué mandíbula, señoras y señores!'];
const ANN_CHOKE = ['¡Se atraganta! ¡Agua, agua!', '¡Cof, cof! ¡Respira, chaval!', '¡Despacio, que no se escapan!'];
const ANN_DOG = ['¡Otro perrito al buche!', '¡Y van cayendo!', '¡Pan y salchicha, a la saca!', '¡Increíble ritmo de masticación!'];

export function Eating(p: Props) {
  const mini = useMini('perritos', 30);
  const [bites, setBites] = useState(0);
  const [choke, setChoke] = useState(0);
  const [stun, setStun] = useState(0);
  const last = useRef<'m' | 't' | null>(null);
  const BITES_PER_DOG = 10;
  const view = useRef<ConeyView>({ cheer: -9, now: 0 });
  const announcer = useMemo(() => personOf(1916, { wear: 'traje', hair: 'sombrero', outfit: '#c0392b', mustache: true, pitch: 160 }), []);
  const rivals = useMemo(() => [personOf(4711, { wear: 'camisa', outfit: '#e2a23b', hair: 'gorra', pitch: 150 }), personOf(9090, { wear: 'jersey', outfit: '#2f6fb3', hair: 'coleta', pitch: 330 })], []);
  const rivalCount = useRef([0, 0]);
  const talk = useTalk(announcer);
  const speak = useChatter(talk, mini.playing, ANN_IDLE, [7, 10]);
  const shake = useShake();
  const { pops, pop } = usePops();
  const [chew, setChew] = useState(0);
  const passed = useRef(false);

  useEffect(() => {
    if (mini.phase === 'count') speak('¡Bienvenidos a Coney Island, 4 de julio!', 'feliz', true);
    if (mini.phase === 'play') {
      fx.bugle();
      fx.crowd(1.5);
    }
  }, [mini.phase]);
  useCountdownCue(mini.left, mini.playing, 10, () => speak('¡Últimos diez segundos! ¡A tragar!', 'nervios', true));

  useLoop(mini.playing, (dt) => {
    setChoke((c) => Math.max(0, c - dt * 22));
    setStun((x) => Math.max(0, x - dt));
    // los rivales comen a su ritmo (el favorito acaba cerca de su marca)
    const e = Math.min(30, mini.elapsed());
    const rc = rivalCount.current;
    rc[0] = Math.max(rc[0], p.contest.target * (e / 30) * (1 + 0.05 * Math.sin(e * 1.3)));
    rc[1] = Math.max(rc[1], p.contest.target * 0.78 * Math.pow(e / 30, 1.1) * (1 + 0.06 * Math.sin(e * 2.1)));
  });

  const press = (k: 'm' | 't') => {
    if (!mini.playing || stun > 0) return;
    if (last.current === k) {
      // repetir el mismo botón: se atraganta un poco
      setChoke((c) => c + 18);
      play.error();
      pop('¡GLUP!', 50, 58, 'bad');
      return;
    }
    last.current = k;
    setChew((c) => c + 1);
    setChoke((c) => {
      const n = c + 9;
      if (n >= 100) {
        setStun(2.2);
        mini.miss();
        shake.shake();
        speak(ANN_CHOKE, 'nervios', true);
        return 40;
      }
      return n;
    });
    if (k === 't') {
      setBites((b) => {
        const nb = b + 1;
        mini.set(Math.round((nb / BITES_PER_DOG) * 10) / 10);
        if (nb % BITES_PER_DOG === 0) {
          play.coin();
          fx.crowd(0.9);
          view.current.cheer = view.current.now;
          pop('+1 🌭', 50, 46, 'gold');
          const dogs = nb / BITES_PER_DOG;
          if (dogs % 3 === 0) speak(ANN_DOG, 'feliz');
          if (!passed.current && dogs > rivalCount.current[0] && dogs >= 3) {
            passed.current = true;
            speak('¡Supera al favorito! ¡Qué locura!', 'feliz', true);
          }
        }
        return nb;
      });
    } else {
      play.click();
      pop('ÑAM', 38 + Math.random() * 24, 60, 'good');
    }
  };

  const dogs = Math.floor(bites / BITES_PER_DOG);
  const part = (bites % BITES_PER_DOG) / BITES_PER_DOG;
  const rc = rivalCount.current;
  return (
    <MiniFrame mini={mini} cls="perritos" title="NATHAN'S" introTitle="Concurso de Coney Island" unit="perritos" {...p} intro={<>Alterna <b>MORDER</b> y <b>TRAGAR</b> lo más rápido que puedas. Si repites botón o vas demasiado deprisa, la barra de atragantamiento se llena y pierdes dos segundos.</>}>
      <div class={`eat-stage ny-stage ${shake.cls} ${stun > 0 ? 'stunned' : ''}`}>
        <Backdrop draw={(ctx, t) => drawConey(ctx, t, view.current)} w={180} h={320} fps={sceneFps(15)} />
        <Host person={announcer} talk={talk} name="Sr. Shea · locutor" class="ny-host" />
        <div class="ny-table">
          {[0, 1].map((i) => (
            <div class={`ny-rival r${i}`} key={i}>
              <Portrait person={rivals[i]} talking={mini.playing} mood={mini.playing && rc[i] < dogs ? 'nervios' : 'feliz'} scale={2} />
              <b>{rivals[i].name.split(' ')[0]}</b>
              <span>{rc[i].toFixed(1)}</span>
              {i === 0 && <em>FAVORITO</em>}
            </div>
          ))}
          <div class="ny-you">
            <div class="eat-plate ny-plate">
              {Array.from({ length: Math.min(12, dogs) }, (_, i) => (
                <span key={i} class="eat-done" />
              ))}
            </div>
            <div class="eat-dog ny-dog" key={chew}>
              <span class="bun-dog" style={{ clipPath: `inset(0 ${part * 100}% 0 0 round 0 30px 30px 0)` }} />
              <span class="sausage" style={{ right: `${part * 100}%` }} />
              <span class="ny-mustard" style={{ right: `${part * 100 + 6}%` }} />
            </div>
            <div class="ny-count">
              TÚ <b>{dogs}</b>
            </div>
          </div>
        </div>
        <div class="choke ny-choke">
          <small>{stun > 0 ? '¡COF COF! Te atragantaste' : 'Atragantamiento'}</small>
          <div class="choke-bar">
            <span style={{ width: `${Math.min(100, choke)}%`, background: choke > 70 ? '#ff4a5a' : choke > 45 ? '#ffcc33' : '#35d07f' }} />
          </div>
        </div>
        <PopLayer pops={pops} />
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

const PADS = SIMON_COLORS;
const PAD_TONES = [330, 392, 494, 587];
const OWNER_ROUND: Record<number, string> = {
  3: 'Vaya, vaya… sabes lo que haces.',
  5: '¡Ronda cinco! La chavalería se acerca.',
  7: '¡Eh, dejad de jugar al Pac-Man y mirad esto!',
  9: '¡Esto ya es nivel de campeonato!',
  11: '¡Nadie llegaba tan lejos desde el 83!',
  14: '¡Te voy a poner en la pared de récords!',
};
const OWNER_IDLE = ['Concéntrate. Mira bien las luces.', 'Las fichas no se devuelven, ¿eh?', 'Silencio, que el chaval se concentra.'];

export function SimonGame(p: Props) {
  const mini = useMini('simon', 0);
  const [seq, setSeq] = useState<number[]>([]);
  const [showing, setShowing] = useState(false);
  const [lit, setLit] = useState<number | null>(null);
  const [pos, setPos] = useState(0);
  const timers = useRef<number[]>([]);
  const view = useRef<ArcadeView>({ lit: null, cheer: -9, now: 0 });
  view.current.lit = lit;
  const owner = useMemo(() => personOf(1983, { wear: 'camisa', hair: 'tupe', outfit: '#e8619e', mustache: true, glasses: false, pitch: 200 }), []);
  const talk = useTalk(owner);
  const speak = useChatter(talk, mini.playing && !showing, OWNER_IDLE, [10, 14]);
  const shake = useShake();
  const { pops, pop } = usePops();

  useEffect(() => {
    if (mini.phase === 'count') speak('Tres colores para empezar. Fácil… de momento.', 'normal', true);
    if (mini.phase === 'end' && mini.misses > 0) speak(['¡Game over, chaval!', '¡Ay! Tan cerca…', 'Otra ficha y lo vuelves a intentar.'], 'triste', true);
  }, [mini.phase]);

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
      shake.shake();
      window.setTimeout(() => mini.end(), 400);
      return;
    }
    if (pos + 1 === seq.length) {
      mini.hit(1);
      const round = seq.length - 2;
      pop('+1 RONDA', 50, 44, 'gold');
      if (round >= 4) {
        view.current.cheer = view.current.now;
        fx.crowd(0.8);
      }
      if (OWNER_ROUND[round + 1]) speak(OWNER_ROUND[round + 1], 'feliz', true);
      else if (round > 14 && round % 2 === 0) speak(['¡Increíble! ¡Sigue, sigue!', '¡Que alguien llame al Daily News!'], 'feliz');
      const next = [...seq, Math.floor(Math.random() * 4)];
      setSeq(next);
      window.setTimeout(() => playSeq(next), 450);
    } else setPos(pos + 1);
  };

  return (
    <MiniFrame mini={mini} cls="simon" title="SIMON" introTitle="Torneo en la sala recreativa" unit="rondas" {...p} intro={<>Mira la secuencia de luces y repítela. Cada ronda añade un color y va más rápido. <b>Un fallo y se acabó.</b></>}>
      <div class={`simon-stage sm-stage ${shake.cls}`} style={{ '--lit': lit !== null ? PADS[lit] : 'transparent' }}>
        <Backdrop draw={(ctx, t) => drawArcade(ctx, t, view.current)} w={180} h={320} fps={sceneFps(15)} />
        <Host person={owner} talk={talk} name="Lenny · dueño" class="sm-host" />
        <div class={`simon sm-simon ${lit !== null ? 'glow' : ''}`}>
          {PADS.map((c, i) => (
            <button key={c} class={`simon-pad p${i} ${lit === i ? 'lit' : ''}`} style={{ background: c }} onPointerDown={() => press(i)} />
          ))}
          <div class={`simon-center sm-center ${showing ? 'watch' : ''}`}>
            <small>SIMON</small>
            {showing ? 'MIRA' : mini.playing ? 'TÚ' : ''}
          </div>
        </div>
        <div class="simon-info sm-info">
          Ronda {seq.length - 2 > 0 ? seq.length - 2 : 1} · {seq.length} colores
          <span class="sm-dots">
            {seq.map((_, i) => (
              <i key={i} class={!showing && i < pos ? 'done' : ''} />
            ))}
          </span>
        </div>
        <PopLayer pops={pops} />
      </div>
    </MiniFrame>
  );
}

// ---------------------------------------------------------------------------
// Maratón: mantén la velocidad en la zona verde sin quedarte sin aire
// ---------------------------------------------------------------------------

const KM_FACTOR = 7.6;
const ME: BodyColors = { skin: '#deac84', top: '#2f6fb3', legs: '#14101f', shoes: '#ffcc33', hair: '#4a2e1c' };
const COACH_IDLE = ['¡Bien! Respira por la nariz.', '¡Mira, el puente de Verrazano!', 'Ahí está el Bronx… ¡sigue!', '¡La gente te anima, aprovecha!', 'Central Park te espera.', '¡Zancada larga y hombros sueltos!'];
const COACH_FAST = ['¡Frena, que te ahogas!', '¡Demasiado rápido! ¡Dosifica!', '¡Eh, que esto no es un sprint!'];
const COACH_SLOW = ['¡Venga, que te adelanta una abuela!', '¡Arriba esas piernas!', '¡Más ritmo, campeón!'];
const COACH_TIRED = ['¡Sin aire! Camina y recupera.', '¡Te lo dije! Respira hondo…', 'Tranquilo, camina un poco.'];
const RUN_CHEERS = ['¡Vamos!', '¡Tú puedes!', '¡Go, go!', '¡Ánimo!', '¡Corre!'];

export function Marathon(p: Props) {
  const mini = useMini('maraton', 40);
  const st = useRef({ v: 0, stamina: 100, dist: 0, tired: 0 });
  const [, setFrame] = useState(0);
  const view = useRef(runView());
  const coach = useMemo(() => personOf(1970, { wear: 'uniforme', hair: 'gorra', outfit: '#1f7a3e', pitch: 175, glasses: false }), []);
  const talk = useTalk(coach);
  const speak = useChatter(talk, mini.playing, COACH_IDLE, [8, 12]);
  const { pops, pop } = usePops();
  const shake = useShake();
  const cue = useRef({ fast: 0, slow: 0, cheer: 0 });

  useEffect(() => {
    if (mini.phase === 'count') speak('¡Ritmo constante, campeón! Zona verde.', 'normal', true);
    if (mini.phase === 'play') fx.bugle();
  }, [mini.phase]);
  useCountdownCue(mini.left, mini.playing, 10, () => speak('¡Diez segundos! ¡Lo que te quede, ahora!', 'feliz', true));

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
      shake.shake();
      speak(COACH_TIRED, 'nervios', true);
    }
    const before = Math.floor(s.dist / KM_FACTOR);
    s.dist += s.v * dt;
    const km = s.dist / KM_FACTOR;
    if (Math.floor(km) > before && Math.floor(km) % 5 === 0) {
      play.coin();
      const e = mini.elapsed();
      pop(`KM ${Math.floor(km)} · ${Math.floor(e / 60)}:${String(Math.floor(e % 60)).padStart(2, '0')}`, 50, 34, 'gold');
      if (Math.floor(km) % 10 === 0) speak(`¡${Math.floor(km)} kilómetros! ¡Vas como un tiro!`, 'feliz', true);
    }
    // la puntuación son los km recorridos
    mini.set(Math.round(km * 10) / 10);
    // comentarios del entrenador y del público
    const now = performance.now();
    if (s.tired <= 0 && s.v > 9.6 && now - cue.current.fast > 6000) {
      cue.current.fast = now;
      speak(COACH_FAST, 'nervios');
    }
    if (s.tired <= 0 && s.v < 3 && mini.elapsed() > 4 && now - cue.current.slow > 9000) {
      cue.current.slow = now;
      speak(COACH_SLOW, 'enfado');
    }
    if (now - cue.current.cheer > 4500) {
      cue.current.cheer = now;
      const line = pick(RUN_CHEERS);
      pop(line, 20 + Math.random() * 60, 18 + Math.random() * 8, 'good');
      shout(line, Math.floor(now));
    }
    const v = view.current;
    v.dist = s.dist;
    v.v = s.v;
    v.tired = s.tired > 0;
    setFrame((f) => f + 1);
  });

  const tap = () => {
    if (!mini.playing) return;
    const s = st.current;
    if (s.tired > 0) return;
    s.v = Math.min(12, s.v + 0.85);
  };

  const s = st.current;
  const km = s.dist / KM_FACTOR;
  return (
    <MiniFrame mini={mini} cls="maraton" title="MARATÓN" introTitle="Maratón de Nueva York" unit="km" {...p} intro={<>Toca para correr. Mantén la aguja en la <b>zona verde</b>: si vas demasiado rápido te quedas sin aire y tendrás que caminar.</>}>
      <div class={`run-stage rn-stage ${shake.cls}`} onPointerDown={tap}>
        <Backdrop draw={(ctx, t) => drawMarathon(ctx, t, view.current, KM_FACTOR, ME, 5)} w={180} h={360} fps={sceneFps(60)} />
        <Host person={coach} talk={talk} name="Coach Brooks" class="rn-host" />
        <div class="rn-hud">
          <div class="run-km rn-km">
            {km.toFixed(1)} <small>km</small>
          </div>
          <div class="speedo rn-speedo">
            <div class="speed-zone" />
            <span class="speed-needle" style={{ left: `${(s.v / 12) * 100}%` }} />
          </div>
          <div class="rn-scale">
            <span>lento</span>
            <span>ritmo</span>
            <span>¡ahogo!</span>
          </div>
          <div class="stamina rn-stamina">
            <small>{s.tired > 0 ? '¡Sin aire! Caminando…' : 'Aire'}</small>
            <div class="choke-bar">
              <span style={{ width: `${s.stamina}%`, background: s.stamina < 30 ? '#ff4a5a' : '#4ff0ff' }} />
            </div>
          </div>
          <div class="run-hint rn-hint">TOCA PARA CORRER</div>
        </div>
        <PopLayer pops={pops} />
      </div>
    </MiniFrame>
  );
}
