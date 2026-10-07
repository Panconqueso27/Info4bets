import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { fx, play } from '../../platform/audio';
import { randomLook } from '../../art/character';
import { CharacterCanvas } from '../CharacterCanvas';
import { useSwipe } from '../useSwipe';
import { MiniFrame, pick, useLoop, useMini, type MiniProps } from './kit';
import { Backdrop, Bubble, Portrait, PopLayer, usePops, useShake, useTalk } from './stage';
import {
  carBox,
  drawOffice,
  drawPress,
  drawRally,
  drawTraffic,
  honk,
  Host,
  lowFx,
  personOf,
  pressView,
  sceneFps,
  shout,
  trafficView,
  useChatter,
  useCountdownCue,
  type RallyView,
  type TrafficView,
} from './scenes-office';
import type { Look } from '../../core/types';
import './office.css';

// ---------------------------------------------------------------------------
// Semáforos: alterna el verde para que ninguna cola se atasque
// ---------------------------------------------------------------------------

const CAR_COLORS = ['#f2c230', '#c0392b', '#2f6fb3', '#e8e4d8', '#3a7a4a', '#7b4fa0'];
const JAM = 7;
/** Coches que hay que dejar pasar por cada acierto. */
const CARS_PER_POINT = 3;

const COP_IDLE = [
  'Toque el cruce y cambio el semáforo.',
  'Ojo: a siete coches en cola, atasco.',
  'Ese taxista lleva diez minutos pitando.',
  'En la Quinta no se para ni el alcalde.',
  '¡Qué calor hace en este asfalto!',
  'Los de Jersey conducen fatal, se lo digo yo.',
  'Si esto sale bien, me invita a un café.',
  'Mire esa gente cruzando… ¡con cuidado!',
  'Hora punta: medio Manhattan vuelve a casa.',
];
const COP_STREAK = ['¡Fluye como el Hudson!', '¡Así se dirige el tráfico!', '¡Es usted un maestro del silbato!', 'Ni en Tokio van tan finos.', '¡Qué ritmo, alcalde!'];
const COP_MISS = ['¡Atasco! Media ciudad pitando…', '¡Esto parece el túnel Lincoln!', 'Uf, y la prensa mirando…', '¡Circulen, circulen!'];
const COP_WARN = { h: ['¡La cola de la 34 se desespera!', '¡Ojo a la calle 34, alcalde!'], v: ['¡La Quinta se está llenando!', '¡Abra la Quinta, que explota!'] };
const DRIVER = ['¡¡MUÉVETE!!', '¡PIII PIII!', '¡Venga ya!', '¡Que llego tarde!', '¡VERDE YA!', '¡Oiga, agente!', '¡Vamos, hombre!'];

interface Shout {
  id: number;
  x: number;
  y: number;
  text: string;
  big?: boolean;
}

export function Traffic(p: MiniProps) {
  const mini = useMini('traffic');
  const [green, setGreen] = useState<'h' | 'v'>('h');
  const greenRef = useRef<'h' | 'v'>('h');
  const view = useRef<TrafficView>(trafficView());
  const logic = useRef({ arrive: { h: 0.5, v: 1 }, pass: 0, passed: 0, shoutAt: { h: 0, v: 0 }, sid: 1 });
  const [qlen, setQlen] = useState({ h: 0, v: 0 });
  const [shouts, setShouts] = useState<Shout[]>([]);
  const { pops, pop } = usePops();
  const shake = useShake();
  const cop = useMemo(() => personOf(1985, { wear: 'uniforme', hair: 'gorra', outfit: '#2f4f8e', skin: '#deac84', pitch: 170 }), []);
  const talk = useTalk(cop);
  const speak = useChatter(talk, mini.playing, COP_IDLE);

  const addShout = (s: Omit<Shout, 'id'>) => {
    const id = logic.current.sid++;
    setShouts((l) => [...l.slice(-4), { ...s, id }]);
    setTimeout(() => setShouts((l) => l.filter((x) => x.id !== id)), s.big ? 1500 : 1250);
  };

  useEffect(() => {
    if (mini.phase === 'count') speak('¡Hora punta en la Quinta! Usted manda, alcalde.', 'normal', true);
  }, [mini.phase]);
  useEffect(() => {
    if (mini.combo > 0 && mini.combo % 5 === 0) speak(COP_STREAK, 'feliz');
  }, [mini.combo]);
  useCountdownCue(mini.left, mini.playing, 10, () => speak('¡Diez segundos! ¡Último empujón!', 'nervios', true));

  useLoop(mini.playing, (dt) => {
    const L = logic.current;
    const V = view.current;
    const rate = 1.05 + mini.elapsed() / 45;
    L.pass -= dt;
    for (const k of ['h', 'v'] as const) {
      L.arrive[k] -= dt * rate * (0.7 + Math.random() * 0.6);
      if (L.arrive[k] <= 0) {
        L.arrive[k] = 1.1 + Math.random() * 0.9;
        const color = pick(CAR_COLORS);
        V.q[k].push({ id: V.id++, color, taxi: color === '#f2c230', s: -16, v: 60 });
      }
      if (V.q[k].length >= JAM) {
        mini.miss();
        shake.shake();
        honk();
        speak(COP_MISS, 'enfado', true);
        const front = carBox(k, V.q[k][0].s);
        addShout({ x: ((front.x + 6) / 180) * 100, y: (front.y / 360) * 100 - 4, text: '¡ATASCO!', big: true });
        pop('¡ATASCO!', 50, 52, 'bad');
        const gone = V.q[k].slice(0, 4);
        V.q[k] = V.q[k].slice(4);
        for (const c of gone) {
          c.jam = true;
          c.v = Math.max(c.v, 40);
          V.movers.push({ lane: k, car: c });
        }
      } else if (V.q[k].length >= 5 && performance.now() - L.shoutAt[k] > 2600) {
        // los conductores se impacientan
        L.shoutAt[k] = performance.now();
        const car = V.q[k][V.q[k].length - 1];
        const b = carBox(k, Math.max(0, car.s));
        const text = pick(DRIVER);
        honk();
        shout(text, car.id);
        addShout({ x: Math.min(86, Math.max(14, ((b.x + 6) / 180) * 100)), y: Math.max(6, (b.y / 360) * 100 - 5), text });
        speak(COP_WARN[k], 'nervios');
      }
    }
    const g = greenRef.current;
    if (L.pass <= 0 && V.q[g].length) {
      L.pass = 0.42;
      const car = V.q[g].shift()!;
      car.v = Math.max(car.v, 30);
      V.movers.push({ lane: g, car });
      L.passed++;
      if (L.passed % CARS_PER_POINT === 0) {
        mini.hit();
        pop('+1', g === 'h' ? 86 : 74, g === 'h' ? 46 : 30, 'good');
      }
    }
    if (V.q.h.length !== qlen.h || V.q.v.length !== qlen.v) setQlen({ h: V.q.h.length, v: V.q.v.length });
  });

  const toggle = () => {
    if (!mini.playing) return;
    play.click();
    setGreen((g) => {
      const n = g === 'h' ? 'v' : 'h';
      greenRef.current = n;
      view.current.green = n;
      return n;
    });
    logic.current.pass = 0.5;
  };

  const meter = (n: number) => (
    <span class="tf-cells">
      {Array.from({ length: JAM }, (_, i) => (
        <i key={i} class={i < n ? (n >= 6 ? 'hot' : n >= 4 ? 'warm' : 'on') : ''} />
      ))}
    </span>
  );

  return (
    <MiniFrame mini={mini} cls="traffic" title="SEMÁFOROS" introTitle="Hora punta en la 5ª" unit="cruces despejados" {...p} intro={<>Toca el cruce para <b>cambiar el semáforo</b>. Si una cola llega a {JAM} coches, se monta un atasco. Cada {CARS_PER_POINT} coches que pasan cuentan un acierto.</>}>
      <div class={`tf-stage ${shake.cls}`} onPointerDown={toggle}>
        <Backdrop draw={(ctx, t) => drawTraffic(ctx, t, view.current)} w={180} h={360} fps={sceneFps(60)} />
        <Host person={cop} talk={talk} name="Agente Murphy" class="tf-host" />
        {shouts.map((s) => (
          <div key={s.id} class={`tf-shout ${s.big ? 'big' : ''}`} style={{ left: `${s.x}%`, top: `${s.y}%` }}>
            {s.text}
          </div>
        ))}
        <div class="tf-hud">
          <div class={`tf-q ${green === 'h' ? 'go' : 'stop'}`}>
            <span class="tf-dot" />
            <b>⇨ Calle 34</b>
            {meter(qlen.h)}
          </div>
          <div class={`tf-q ${green === 'v' ? 'go' : 'stop'}`}>
            <span class="tf-dot" />
            <b>⇧ Quinta Av.</b>
            {meter(qlen.v)}
          </div>
          <div class="tf-hint">TOCA PARA CAMBIAR EL SEMÁFORO</div>
        </div>
        <PopLayer pops={pops} />
      </div>
    </MiniFrame>
  );
}

// ---------------------------------------------------------------------------
// Rueda de prensa: desliza hacia la buena respuesta antes de que se acabe el tiempo
// ---------------------------------------------------------------------------

const QUESTIONS: { q: string; good: string; bad: string }[] = [
  { q: '¿Por qué hay tantos baches en Brooklyn?', good: 'Este mes asfaltamos 40 calles', bad: 'Los baches dan carácter' },
  { q: '¿Es verdad que su cuñado tiene un contrato?', good: 'Todo se licita en público', bad: 'Es de la familia, ¿y qué?' },
  { q: '¿Qué hará con el crimen en el metro?', good: 'Más luz y más patrullas', bad: 'Que la gente vaya en taxi' },
  { q: '¿Subirá los impuestos?', good: 'No a quien menos tiene', bad: 'Sin comentarios' },
  { q: '¿Qué opina de la huelga de basureros?', good: 'Mañana me siento con ellos', bad: 'Que se aguanten' },
  { q: '¿Y los alquileres por las nubes?', good: 'Construimos vivienda social', bad: 'El mercado manda' },
  { q: '¿Durmió en su despacho anoche?', good: 'La ciudad no descansa', bad: '¿Me está espiando?' },
  { q: '¿Cerrará los cines de Times Square?', good: 'Los vamos a renovar', bad: 'Nadie va al cine ya' },
  { q: '¿Qué le dice a los inmigrantes?', good: 'Esta ciudad la hicieron ellos', bad: 'Que aprendan inglés' },
  { q: '¿Llegará el metro al Bronx?', good: 'Las obras empiezan este año', bad: 'El Bronx queda lejos' },
  { q: '¿Le preocupan las encuestas?', good: 'Me preocupan los vecinos', bad: 'Las encuestas mienten' },
  { q: '¿Por qué hay ratas en Central Park?', good: 'Plan de limpieza ya en marcha', bad: 'Son mascotas urbanas' },
  { q: '¿Gastó dinero público en su fiesta?', good: 'La pagué de mi bolsillo', bad: 'Fue una fiesta oficial' },
  { q: '¿Qué hará con el puerto?', good: 'Modernizarlo y crear empleo', bad: 'Venderlo al mejor postor' },
  { q: '¿Volverá a presentarse?', good: 'Primero, cumplir lo prometido', bad: 'Obviamente, gano siempre' },
];
const OUTLETS = ['DAILY NEWS', 'NY POST', 'THE TIMES', 'VILLAGE VOICE', 'NEWSDAY', 'WABC-TV', 'WCBS RADIO', 'EL DIARIO'];

export function Press(p: MiniProps) {
  const mini = useMini('press');
  const order = useRef(QUESTIONS.map((_, i) => i).sort(() => Math.random() - 0.5));
  const [n, setN] = useState(0);
  const q = QUESTIONS[order.current[n % order.current.length]];
  const [goodRight, setGoodRight] = useState(() => Math.random() < 0.5);
  const [time, setTime] = useState(6);
  const [flash, setFlash] = useState<null | 'ok' | 'bad'>(null);
  const limit = () => Math.max(3, 6 - mini.score * 0.15);
  const seed = useRef(Math.floor(Math.random() * 1e6));
  const reporter = useMemo(() => personOf(seed.current + n * 7919), [n]);
  const outlet = OUTLETS[(seed.current + n * 3) % OUTLETS.length];
  const talk = useTalk(reporter);
  const view = useRef(pressView());
  const [approval, setApproval] = useState(50);
  const [said, setSaid] = useState<{ text: string; ok: boolean; k: number } | null>(null);
  const shake = useShake();
  const { pops, pop } = usePops();

  // el periodista hace la pregunta en voz alta
  useEffect(() => {
    if (!mini.playing) return;
    talk.say(q.q, 'normal');
    view.current.burst = 2;
    fx.chip();
  }, [n, mini.playing]);

  const next = () => {
    setN((x) => x + 1);
    setGoodRight(Math.random() < 0.5);
    setTime(limit());
  };
  const answer = (right: boolean | null) => {
    if (!mini.playing || flash) return;
    const ok = right !== null && right === goodRight;
    if (ok) mini.hit();
    else mini.miss();
    setFlash(ok ? 'ok' : 'bad');
    setSaid({ text: right === null ? 'Eh… paso palabra.' : right ? (goodRight ? q.good : q.bad) : goodRight ? q.bad : q.good, ok, k: Date.now() });
    setApproval((a) => Math.max(0, Math.min(100, a + (ok ? 6 : -9))));
    view.current.react = { t: view.current.now, ok };
    if (ok) {
      view.current.burst = lowFx() ? 3 : 7;
      fx.crowd(1.3);
      pop('+1 👏', 50, 46, 'good');
    } else {
      fx.crowd(0.7);
      shake.shake();
      pop('¡BUUU!', 50, 46, 'bad');
    }
    setTimeout(() => {
      setFlash(null);
      next();
    }, 420);
  };

  useLoop(mini.playing && !flash, (dt) =>
    setTime((t) => {
      if (t - dt <= 0) {
        answer(null);
        return 0;
      }
      return t - dt;
    }),
  );

  const { drag, hint, handlers } = useSwipe({ allowUp: false, onRelease: (d) => d && answer(d === 'right') });
  const left = goodRight ? q.bad : q.good;
  const right = goodRight ? q.good : q.bad;
  const frac = time / limit();

  return (
    <MiniFrame mini={mini} cls="press" title="PRENSA" introTitle="Rueda de prensa" unit="respuestas acertadas" {...p} intro={<>Los periodistas disparan preguntas. Desliza la tarjeta hacia la <b>respuesta que te haga quedar bien</b> antes de que se acabe el tiempo.</>}>
      <div class={`pr-stage ${shake.cls}`}>
        <Backdrop draw={(ctx, t) => drawPress(ctx, t, view.current)} w={180} h={360} fps={sceneFps(20)} />
        <div class="pr-top">
          <span class="pr-live">● EN DIRECTO</span>
          <div class="pr-approval">
            <small>APROBACIÓN</small>
            <div class="pr-meter">
              <span style={{ width: `${approval}%`, background: approval < 35 ? '#ff4a5a' : approval < 60 ? '#ffcc33' : '#35d07f' }} />
            </div>
            <b>{approval}%</b>
          </div>
        </div>
        <div
          class={`pr-card ${flash ?? ''}`}
          key={n}
          style={{ transform: `translate(${drag.dx}px, 0) rotate(${drag.dx / 16}deg)`, transition: drag.active ? 'none' : 'transform 0.2s' }}
          {...handlers}
        >
          <div class="pr-who">
            <Portrait person={reporter} talking={talk.talking} mood={flash === 'bad' ? 'enfado' : flash === 'ok' ? 'feliz' : talk.mood} scale={2} look={drag.dx > 30 ? 1 : drag.dx < -30 ? -1 : 0} />
            <div class="pr-id">
              <small>PREGUNTA {n + 1}</small>
              <b>{reporter.name}</b>
              <span class="pr-outlet">{outlet}</span>
            </div>
          </div>
          <Bubble text={talk.line} k={talk.key} side="top" speed={60} class="pr-q" />
          <div class={`pr-time ${frac < 0.35 ? 'hot' : ''}`}>
            <span style={{ width: `${frac * 100}%` }} />
          </div>
          {flash && <div class={`pr-stamp ${flash}`}>{flash === 'ok' ? '👏 ¡Aplausos!' : '😬 Abucheos'}</div>}
        </div>
        <div class="pr-answers">
          <button class={`pr-ans ${hint === 'left' ? 'on' : ''}`} onClick={() => answer(false)}>
            <i>◀</i> {left}
          </button>
          <button class={`pr-ans ${hint === 'right' ? 'on' : ''}`} onClick={() => answer(true)}>
            {right} <i>▶</i>
          </button>
        </div>
        {said && (
          <div class={`pr-said ${said.ok ? 'ok' : 'bad'}`} key={said.k}>
            «{said.text}»
          </div>
        )}
        {flash === 'ok' && <div class="pr-flash" key={`f${n}`} />}
        <PopLayer pops={pops} />
      </div>
    </MiniFrame>
  );
}

// ---------------------------------------------------------------------------
// Firmar presupuestos: ¿cabe este gasto en lo que queda?
// ---------------------------------------------------------------------------

const ITEMS = ['Asfaltado', 'Farolas', 'Patrullas', 'Parque', 'Escuela', 'Puente', 'Metro', 'Limpieza', 'Bomberos', 'Biblioteca'];

function newBudget(level: number) {
  const n = level < 6 ? 2 : 3;
  const items = Array.from({ length: n }, () => ({ name: pick(ITEMS), cost: (2 + Math.floor(Math.random() * 18)) * 10 }));
  const sum = items.reduce((a, b) => a + b.cost, 0);
  // A veces sobra un poco, a veces falta un poco: hay que sumar bien.
  const delta = (Math.floor(Math.random() * 6) + 1) * 10 * (Math.random() < 0.5 ? -1 : 1);
  return { items, budget: Math.max(20, sum + delta), fits: sum <= Math.max(20, sum + delta) };
}

const TREAS_IDLE = [
  'El concejal de Queens quiere más farolas.',
  'Este mes la caja está tiritando.',
  'Sume con calma… pero rápido.',
  '¿Otro café? Llevamos horas con esto.',
  'Wall Street nos mira, alcalde.',
  'Si nos pasamos, el Post nos crucifica.',
  'Mi calculadora echa humo, mire.',
];
const TREAS_OK = ['Cuadra al céntimo. ¡Bravo!', 'Así da gusto, alcalde.', 'Ni un dólar fuera de sitio.', 'Contabilidad de manual.', '¡Usted sí sabe sumar!'];
const TREAS_OVER = ['¿Seguro que cabía, alcalde?', 'Eso no cuadra… ni de lejos.', '¡Revise la suma, por Dios!'];
const TREAS_UNDER = ['¡Pero si cabía! Los vecinos lo esperaban.', 'Rechazado… y sobraba dinero.', 'Hombre, eso sí que cabía.'];

export function Budget(p: MiniProps) {
  const mini = useMini('budget');
  const [b, setB] = useState(() => newBudget(0));
  const [round, setRound] = useState(0);
  const [flash, setFlash] = useState<null | 'ok' | 'bad'>(null);
  const [stamp, setStamp] = useState<null | { yes: boolean; k: number }>(null);
  const treasurer = useMemo(() => personOf(4242, { wear: 'traje', glasses: true, hair: 'calvo', outfit: '#3a3a46', mustache: true, pitch: 150 }), []);
  const talk = useTalk(treasurer);
  const speak = useChatter(talk, mini.playing, TREAS_IDLE, [8, 12]);
  const shake = useShake();
  const { pops, pop } = usePops();

  useEffect(() => {
    if (mini.phase === 'count') speak('Alcalde, firme solo lo que quepa en caja.', 'normal', true);
  }, [mini.phase]);
  useCountdownCue(mini.left, mini.playing, 10, () => speak('¡Diez segundos y cerramos el ejercicio!', 'nervios', true));

  // la sumadora imprime cada línea del ticket
  useEffect(() => {
    if (!mini.playing) return;
    const ids = Array.from({ length: b.items.length + 1 }, (_, i) => setTimeout(() => fx.tick(0.05), 70 + i * 90));
    return () => ids.forEach(clearTimeout);
  }, [round, mini.playing]);

  const answer = (yes: boolean) => {
    if (!mini.playing || flash) return;
    const ok = yes === b.fits;
    play.stamp();
    if (ok) mini.hit();
    else mini.miss();
    setFlash(ok ? 'ok' : 'bad');
    setStamp({ yes, k: Date.now() });
    if (ok) {
      pop('+1', 50, 40, 'good');
      if (mini.combo + 1 >= 3 && (mini.combo + 1) % 4 === 0) speak(TREAS_OK, 'feliz');
    } else {
      shake.shake();
      speak(yes ? TREAS_OVER : TREAS_UNDER, 'enfado', true);
    }
    setTimeout(
      () => {
        setFlash(null);
        setStamp(null);
        setB(newBudget(mini.score + 1));
        setRound((r) => r + 1);
      },
      ok ? 300 : 800,
    );
  };

  const sum = b.items.reduce((a, x) => a + x.cost, 0);
  return (
    <MiniFrame mini={mini} cls="budget" title="PRESUPUESTO" introTitle="Las cuentas de la ciudad" unit="presupuestos bien firmados" {...p} intro={<>Suma los gastos y decide: <b>¿cabe en el dinero que queda?</b> Firma SÍ o NO. Rápido pero sin errores.</>}>
      <div class={`bd-stage ${shake.cls}`}>
        <Backdrop draw={drawOffice} w={180} h={360} fps={sceneFps(10)} />
        <Host person={treasurer} talk={talk} name="Sr. Goldberg · Tesorero" class="bd-host" />
        <div class="bd-machine">
          <div class={`bd-tape ${flash ?? ''}`} key={round}>
            <div class="bd-line head">
              Quedan <b>${b.budget}K</b>
            </div>
            <div class="bd-rule" />
            {b.items.map((it, i) => (
              <div class="bd-line item" key={i} style={{ animationDelay: `${70 + (i + 1) * 90}ms` }}>
                <span>{it.name}</span>
                <b>${it.cost}K</b>
              </div>
            ))}
            {flash === 'bad' && (
              <div class="bd-line total">
                Total: ${sum}K → {b.fits ? 'sí cabía' : 'no cabía'}
              </div>
            )}
            {flash === 'ok' && <div class="bd-line total ok">✔ Firmado</div>}
            {stamp && (
              <div class={`bd-stamp ${stamp.yes ? 'yes' : 'no'}`} key={stamp.k}>
                {stamp.yes ? 'APROBADO' : 'RECHAZADO'}
              </div>
            )}
          </div>
          <div class="bd-adder">
            <div class="bd-display">{flash ? `${sum}` : `${b.budget}`}</div>
            <div class="bd-keys">
              {['7', '8', '9', '+', '4', '5', '6', '−', '1', '2', '3', '='].map((k, i) => (
                <i key={i} class={flash && (k === '=' || k === '+') ? 'press' : ''}>
                  {k}
                </i>
              ))}
            </div>
            <div class="bd-crank" />
          </div>
        </div>
        <div class="bd-buttons">
          <button class="bd-btn no" onClick={() => answer(false)}>
            <span class="bd-handle" />✖ NO CABE
          </button>
          <button class="bd-btn yes" onClick={() => answer(true)}>
            <span class="bd-handle" />SÍ CABE ✔
          </button>
        </div>
        <PopLayer pops={pops} />
      </div>
    </MiniFrame>
  );
}

// ---------------------------------------------------------------------------
// Dar la mano: saluda a los votantes y esquiva a los periodistas incómodos
// ---------------------------------------------------------------------------

interface Walker {
  id: number;
  x: number;
  row: number;
  speed: number;
  press: boolean;
  look: Look;
  done?: 'ok' | 'bad';
  line?: string;
}

const VOTER_LINES = ['¡Cuente con mi voto!', '¡Arregle mi calle!', '¡Ánimo, alcalde!', '¡Mi madre le adora!', '¡Qué mano más firme!', '¡Viva Nueva York!', '¡Le vi en la tele!', '¡Arregle el metro!', '¡Es más alto en persona!', '¡Para mi nieto!'];
const PRESS_LINES = ['¡Exclusiva!', '¡Esta sale en portada!', '¡Sonría, alcalde!', '¡Para el Post!', '¡Pillado!'];
const MANAGER_IDLE = ['Esa señora de ahí vota seguro.', 'Ojo con los de la cámara.', '¡Bese a un bebé si ve alguno!', 'La banda toca nuestra canción.', 'Nada de fotos raras, por favor.', 'Sonrisa de anuncio, alcalde.', 'Brooklyn entero ha venido a verle.'];
const MANAGER_STREAK = ['¡Las encuestas suben!', '¡Esto es un baño de masas!', '¡Ganamos Brooklyn, seguro!', '¡Qué carisma, alcalde!'];
const MANAGER_MISS = ['¡Ese era del Post! Mañana, portada…', '¡No, no, el de la cámara no!', 'Uf. Esa foto nos va a costar votos.', '¡Le dije que ojo con la prensa!'];

export function Handshake(p: MiniProps) {
  const mini = useMini('handshake');
  const nextId = useRef(1);
  const spawn = useRef(0);
  const [people, setPeople] = useState<Walker[]>([]);
  const view = useRef<RallyView>({ cheer: -9, now: 0 });
  const [flashKey, setFlashKey] = useState(0);
  const manager = useMemo(() => personOf(31337, { wear: 'traje', hair: 'permanente', lipstick: true, earrings: true, mustache: false, beard: false, pitch: 360 }), []);
  const talk = useTalk(manager);
  const speak = useChatter(talk, mini.playing, MANAGER_IDLE);
  const shake = useShake();
  const { pops, pop } = usePops();

  useEffect(() => {
    if (mini.phase === 'count') speak('¡Sonrisa, alcalde! Y apriete fuerte.', 'feliz', true);
    if (mini.phase === 'play') fx.crowd(1.5);
  }, [mini.phase]);
  useEffect(() => {
    if (mini.combo > 0 && mini.combo % 6 === 0) {
      speak(MANAGER_STREAK, 'feliz');
      view.current.cheer = view.current.now;
      fx.crowd(1.2);
    }
  }, [mini.combo]);
  useCountdownCue(mini.left, mini.playing, 10, () => speak('¡Diez segundos! ¡Manos, manos!', 'nervios', true));

  useLoop(mini.playing, (dt) => {
    spawn.current -= dt;
    const hurry = 1 + mini.elapsed() / 50;
    setPeople((list) => {
      const out = list.map((w) => ({ ...w, x: w.x + w.speed * hurry * dt })).filter((w) => w.x < 110);
      if (spawn.current <= 0) {
        spawn.current = Math.max(0.45, 1.1 - mini.elapsed() / 80);
        const press = Math.random() < 0.3;
        out.push({ id: nextId.current++, x: -10, row: Math.floor(Math.random() * 3), speed: 18 + Math.random() * 14, press, look: randomLook(press ? 'alcalde' : 'inmigrante') });
      }
      return out;
    });
  });

  const tap = (id: number) => {
    if (!mini.playing) return;
    const w = people.find((x) => x.id === id);
    if (!w || w.done) return;
    const row = [36, 54, 72][w.row];
    let line: string;
    if (w.press) {
      mini.miss();
      line = pick(PRESS_LINES);
      fx.chip();
      setFlashKey((k) => k + 1);
      shake.shake();
      speak(MANAGER_MISS, 'enfado', true);
      pop('📸 −', Math.min(90, Math.max(10, w.x)), row, 'bad');
    } else {
      mini.hit();
      line = pick(VOTER_LINES);
      shout(line, id);
      pop('+1', Math.min(90, Math.max(10, w.x)), row, 'good');
    }
    setPeople((list) => list.map((x) => (x.id === id ? { ...x, done: w.press ? 'bad' : 'ok', speed: x.speed * 1.6, line } : x)));
  };

  return (
    <MiniFrame mini={mini} cls="handshake" title="MITIN" introTitle="Baño de masas" unit="manos estrechadas" {...p} intro={<>Pasan vecinos por la plaza: <b>toca a los votantes</b> para darles la mano. ¡Cuidado con los periodistas 📸! Si los tocas, te sacan una foto comprometida.</>}>
      <div class={`rally hs-stage ${shake.cls}`}>
        <Backdrop draw={(ctx, t) => drawRally(ctx, t, view.current)} w={180} h={360} fps={sceneFps(20)} />
        <Host person={manager} talk={talk} name="Gloria · jefa de campaña" class="hs-host" />
        {people.map((w) => (
          <button key={w.id} class={`voter row${w.row} ${w.done ?? ''} ${w.press ? 'is-press' : ''}`} style={{ left: `${w.x}%` }} onPointerDown={() => tap(w.id)}>
            {w.press && !w.done && <span class="press-tag">📸</span>}
            {w.done === 'ok' && <span class="pop">🤝</span>}
            {w.done === 'bad' && <span class="pop">💥</span>}
            {w.line && <span class={`hs-say ${w.done}`}>{w.line}</span>}
            <CharacterCanvas look={w.look} scale={3} walk />
            <span class="hs-shadow" />
          </button>
        ))}
        {flashKey > 0 && <div class="hs-flash" key={flashKey} />}
        <PopLayer pops={pops} />
      </div>
    </MiniFrame>
  );
}
