import { useRef, useState } from 'preact/hooks';
import { play } from '../../platform/audio';
import { randomLook } from '../../art/character';
import { CharacterCanvas } from '../CharacterCanvas';
import { useSwipe } from '../useSwipe';
import { MiniFrame, pick, useLoop, useMini, type MiniProps } from './kit';
import type { Look } from '../../core/types';

// ---------------------------------------------------------------------------
// Semáforos: alterna el verde para que ninguna cola se atasque
// ---------------------------------------------------------------------------

const CAR_COLORS = ['#f2c230', '#c0392b', '#2f6fb3', '#e8e4d8', '#3a7a4a', '#7b4fa0'];
const JAM = 7;
/** Coches que hay que dejar pasar por cada acierto. */
const CARS_PER_POINT = 3;

interface Lane {
  cars: string[];
  arrive: number;
}

export function Traffic(p: MiniProps) {
  const mini = useMini('traffic');
  const [green, setGreen] = useState<'h' | 'v'>('h');
  const [lanes, setLanes] = useState<Record<'h' | 'v', Lane>>({ h: { cars: [], arrive: 0.5 }, v: { cars: [], arrive: 1 } });
  const passed = useRef(0);
  const pass = useRef(0);
  const [honk, setHonk] = useState<'h' | 'v' | null>(null);

  useLoop(mini.playing, (dt) => {
    const rate = 1.05 + mini.elapsed() / 45;
    pass.current -= dt;
    setLanes((l) => {
      const out = { h: { ...l.h, cars: [...l.h.cars] }, v: { ...l.v, cars: [...l.v.cars] } };
      for (const k of ['h', 'v'] as const) {
        out[k].arrive -= dt * rate * (0.7 + Math.random() * 0.6);
        if (out[k].arrive <= 0) {
          out[k].arrive = 1.1 + Math.random() * 0.9;
          out[k].cars.push(pick(CAR_COLORS));
        }
        if (out[k].cars.length >= JAM) {
          mini.miss();
          setHonk(k);
          setTimeout(() => setHonk(null), 600);
          out[k].cars = out[k].cars.slice(4);
        }
      }
      if (pass.current <= 0 && out[green].cars.length) {
        pass.current = 0.42;
        out[green].cars.shift();
        passed.current++;
        if (passed.current % CARS_PER_POINT === 0) mini.hit();
      }
      return out;
    });
  });

  const toggle = () => {
    if (!mini.playing) return;
    play.click();
    setGreen((g) => (g === 'h' ? 'v' : 'h'));
    pass.current = 0.5;
  };

  return (
    <MiniFrame mini={mini} cls="traffic" title="SEMÁFOROS" introTitle="Hora punta en la 5ª" unit="cruces despejados" {...p} intro={<>Toca el cruce para <b>cambiar el semáforo</b>. Si una cola llega a {JAM} coches, se monta un atasco. Cada {CARS_PER_POINT} coches que pasan cuentan un acierto.</>}>
      <div class="crossing" onPointerDown={toggle}>
        <div class="road h" />
        <div class="road v" />
        <div class={`queue h ${honk === 'h' ? 'honk' : ''}`}>
          {lanes.h.cars.map((c, i) => (
            <i key={i} style={{ background: c }} />
          ))}
        </div>
        <div class={`queue v ${honk === 'v' ? 'honk' : ''}`}>
          {lanes.v.cars.map((c, i) => (
            <i key={i} style={{ background: c }} />
          ))}
        </div>
        <div class="light h">
          <span class={green === 'h' ? 'g' : 'r'} />
        </div>
        <div class="light v">
          <span class={green === 'v' ? 'g' : 'r'} />
        </div>
        <div class="crossing-hint">Toca para cambiar el semáforo</div>
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

export function Press(p: MiniProps) {
  const mini = useMini('press');
  const order = useRef(QUESTIONS.map((_, i) => i).sort(() => Math.random() - 0.5));
  const [n, setN] = useState(0);
  const q = QUESTIONS[order.current[n % order.current.length]];
  const [goodRight, setGoodRight] = useState(() => Math.random() < 0.5);
  const [time, setTime] = useState(6);
  const [flash, setFlash] = useState<null | 'ok' | 'bad'>(null);
  const limit = () => Math.max(3, 6 - mini.score * 0.15);

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

  return (
    <MiniFrame mini={mini} cls="press" title="PRENSA" introTitle="Rueda de prensa" unit="respuestas acertadas" {...p} intro={<>Los periodistas disparan preguntas. Desliza la tarjeta hacia la <b>respuesta que te haga quedar bien</b> antes de que se acabe el tiempo.</>}>
      <div class="press-room">
        <div class="mics">🎙 🎙 🎙</div>
        <div class="press-time">
          <span style={{ width: `${(time / limit()) * 100}%` }} />
        </div>
        <div
          class={`press-card ${flash ?? ''}`}
          key={n}
          style={{ transform: `translate(${drag.dx}px, 0) rotate(${drag.dx / 16}deg)`, transition: drag.active ? 'none' : 'transform 0.2s' }}
          {...handlers}
        >
          <small>PREGUNTA {n + 1}</small>
          <b>"{q.q}"</b>
          {flash && <div class="press-stamp">{flash === 'ok' ? '👏 ¡Aplausos!' : '😬 Abucheos'}</div>}
        </div>
        <div class="press-answers">
          <button class={`press-ans ${hint === 'left' ? 'on' : ''}`} onClick={() => answer(false)}>
            ◀ {left}
          </button>
          <button class={`press-ans ${hint === 'right' ? 'on' : ''}`} onClick={() => answer(true)}>
            {right} ▶
          </button>
        </div>
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

export function Budget(p: MiniProps) {
  const mini = useMini('budget');
  const [b, setB] = useState(() => newBudget(0));
  const [flash, setFlash] = useState<null | 'ok' | 'bad'>(null);

  const answer = (yes: boolean) => {
    if (!mini.playing || flash) return;
    const ok = yes === b.fits;
    play.stamp();
    if (ok) mini.hit();
    else mini.miss();
    setFlash(ok ? 'ok' : 'bad');
    setTimeout(
      () => {
        setFlash(null);
        setB(newBudget(mini.score + 1));
      },
      ok ? 300 : 800,
    );
  };

  const sum = b.items.reduce((a, x) => a + x.cost, 0);
  return (
    <MiniFrame mini={mini} cls="budget" title="PRESUPUESTO" introTitle="Las cuentas de la ciudad" unit="presupuestos bien firmados" {...p} intro={<>Suma los gastos y decide: <b>¿cabe en el dinero que queda?</b> Firma SÍ o NO. Rápido pero sin errores.</>}>
      <div class={`ledger ${flash ?? ''}`}>
        <div class="ledger-left">
          Quedan <b>${b.budget}K</b>
        </div>
        <ul>
          {b.items.map((it, i) => (
            <li key={i}>
              <span>{it.name}</span>
              <b>${it.cost}K</b>
            </li>
          ))}
        </ul>
        {flash === 'bad' && <div class="ledger-sum">Total: ${sum}K → {b.fits ? 'sí cabía' : 'no cabía'}</div>}
        {flash === 'ok' && <div class="ledger-sum ok">✔ Firmado</div>}
      </div>
      <div class="desk-buttons">
        <button class="trade-btn sell" onClick={() => answer(false)}>
          ✖ NO CABE
        </button>
        <button class="trade-btn buy" onClick={() => answer(true)}>
          SÍ CABE ✔
        </button>
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
}

export function Handshake(p: MiniProps) {
  const mini = useMini('handshake');
  const nextId = useRef(1);
  const spawn = useRef(0);
  const [people, setPeople] = useState<Walker[]>([]);

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
    if (w.press) mini.miss();
    else mini.hit();
    setPeople((list) => list.map((x) => (x.id === id ? { ...x, done: w.press ? 'bad' : 'ok', speed: x.speed * 1.6 } : x)));
  };

  return (
    <MiniFrame mini={mini} cls="handshake" title="MITIN" introTitle="Baño de masas" unit="manos estrechadas" {...p} intro={<>Pasan vecinos por la plaza: <b>toca a los votantes</b> para darles la mano. ¡Cuidado con los periodistas 📸! Si los tocas, te sacan una foto comprometida.</>}>
      <div class="rally">
        <div class="rally-banner">VOTE · 1985</div>
        {people.map((w) => (
          <button key={w.id} class={`voter row${w.row} ${w.done ?? ''}`} style={{ left: `${w.x}%` }} onPointerDown={() => tap(w.id)}>
            {w.press && <span class="press-tag">📸</span>}
            {w.done === 'ok' && <span class="pop">🤝</span>}
            {w.done === 'bad' && <span class="pop">💥</span>}
            <CharacterCanvas look={w.look} scale={3} />
          </button>
        ))}
      </div>
    </MiniFrame>
  );
}
