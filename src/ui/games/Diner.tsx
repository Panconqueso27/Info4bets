import { useEffect, useRef, useState } from 'preact/hooks';
import { fx, play } from '../../platform/audio';
import { MiniFrame, pick, useLoop, useMini, type MiniProps } from './kit';
import { CounterView, useCounter, type Counter } from './counter';
import { PopLayer, usePops, useShake } from './stage';
import './diner.css';

// ---------------------------------------------------------------------------
// Lo que dicen los clientes del diner
// ---------------------------------------------------------------------------

const THANKS = ['¡Gracias, guapo! Ahí te dejo algo.', '¡Esto sí que es servicio!', 'Perfecto. Vuelvo mañana seguro.', '¡Qué rapidez! Toma, para ti.', 'Así da gusto. Quédate el cambio.', '¡Delicioso! Eres el mejor.'];
const OK_LINES = ['Gracias.', 'Bien, bien.', 'Está bueno, sí.', 'Cumple.', 'Vale, gracias.'];
const ANGRY = ['¡Llevo media hora esperando!', '¡Me voy a otro sitio!', 'Pésimo servicio. Adiós.', '¡Esto es un desastre!', 'Ni propina ni nada.'];
const WRONG = ['¡Eso no es lo que he pedido!', '¿Me estás escuchando?', '¡Te he dicho otra cosa!', 'Uy, no, no, no…'];
const HURRY = ['¿Falta mucho?', 'Tengo prisa, ¿eh?', 'Vamos, que se me enfría el día.', 'Mi descanso dura diez minutos…'];

/** Entra el siguiente cliente un poco después de que se vaya el anterior. */
function nextCustomer(c: Counter, line: string, ms = 1000) {
  setTimeout(() => c.arrive(line), ms);
}

// ---------------------------------------------------------------------------
// Freír hamburguesas: tócalas en su punto (ni crudas ni quemadas)
// ---------------------------------------------------------------------------

interface Patty {
  id: number;
  /** 0 cruda → 1 quemada; en su punto entre 0.55 y 0.8. */
  cook: number;
  speed: number;
  /** Tiempo hasta que aparece una nueva en el hueco. */
  wait: number;
  flash?: 'ok' | 'bad';
}

const DONE_MIN = 0.55;
const DONE_MAX = 0.8;

function pattyColor(c: number) {
  if (c < 0.25) return '#e98a8a';
  if (c < DONE_MIN) return '#c86a52';
  if (c <= DONE_MAX) return '#7a4220';
  if (c < 0.95) return '#4a2612';
  return '#1c120c';
}

const BURGER_ORDERS = ['Dos hamburguesas al punto, por favor.', 'Una burger bien hecha, sin prisa… bueno, con prisa.', 'Quiero dos de la casa, jugositas.', 'Ponme una hamburguesa. ¡Que no esté cruda!', 'Dos burgers para llevar, rápido.'];

export function Burgers(p: MiniProps) {
  const mini = useMini('burgers');
  const c = useCounter();
  const { pops, pop } = usePops();
  const shaker = useShake();
  const served = useRef(0);
  const clean = useRef(true);
  useEffect(() => {
    if (mini.playing) c.arrive(pick(BURGER_ORDERS));
  }, [mini.playing]);
  const nextId = useRef(1);
  const fresh = (): Patty => ({ id: nextId.current++, cook: 0, speed: 0.12 + Math.random() * 0.08, wait: 0 });
  const [grill, setGrill] = useState<Patty[]>(() => [fresh(), fresh(), fresh(), fresh()]);

  useLoop(mini.playing, (dt) => {
    const hurry = 1 + mini.elapsed() / 60;
    setGrill((g) =>
      g.map((pt) => {
        if (pt.wait > 0) {
          const w = pt.wait - dt;
          return w <= 0 ? fresh() : { ...pt, wait: w };
        }
        const cook = pt.cook + pt.speed * hurry * dt;
        if (cook >= 1.05) {
          mini.miss();
          clean.current = false;
          if (Math.random() < 0.5) c.talk.say('¡Huele a quemado desde aquí!', 'enfado');
          return { ...pt, cook, wait: 0.8, flash: 'bad' };
        }
        return { ...pt, cook };
      }),
    );
  });

  const flip = (i: number) => {
    if (!mini.playing) return;
    const pt = grill[i];
    if (pt.wait > 0) return;
    const ok = pt.cook >= DONE_MIN && pt.cook <= DONE_MAX;
    if (ok) {
      mini.hit();
      pop('+1', 25 + (i % 2) * 50, 52 + Math.floor(i / 2) * 22);
      // cada dos hamburguesas, el cliente se va (con propina si no se quemó nada)
      if (c.at === 'in' && ++served.current >= 2) {
        served.current = 0;
        const tip = clean.current;
        if (tip) {
          mini.hit();
          pop('+1 PROPINA', 50, 18, 'gold');
        }
        c.leave(tip ? pick(THANKS) : pick(OK_LINES), 'feliz', tip);
        clean.current = true;
        nextCustomer(c, pick(BURGER_ORDERS), 1300);
      }
    } else {
      mini.miss();
      clean.current = false;
      shaker.shake();
      pop(pt.cook > DONE_MAX ? '¡QUEMADA!' : '¡CRUDA!', 25 + (i % 2) * 50, 52 + Math.floor(i / 2) * 22, 'bad');
    }
    play.splash();
    fx.sizzle();
    setGrill((g) => g.map((x, k) => (k === i ? { ...x, wait: 0.6, flash: ok ? 'ok' : 'bad' } : x)));
  };

  return (
    <MiniFrame mini={mini} cls="burgers" title="PLANCHA" introTitle="La plancha del diner" unit="hamburguesas en su punto" {...p} intro={<>Las hamburguesas se hacen solas en la plancha. Tócalas cuando estén <b>marrones</b>: ni rosadas ni negras. ¡Cada vez van más rápido!</>}>
      <CounterView c={c} scene="diner" />
      <div class={`grill ${shaker.cls}`}>
        <div class="grill-hood" />
        {grill.map((pt, i) => (
          <button key={pt.id} class={`grill-slot ${pt.wait > 0 ? 'empty' : ''} ${pt.flash ?? ''}`} onPointerDown={() => flip(i)}>
            <span class="flames" />
            {pt.wait > 0 ? (
              <span class="grill-msg">{pt.flash === 'ok' ? '¡En su punto!' : pt.cook > DONE_MAX ? '¡Quemada!' : '¡Cruda!'}</span>
            ) : (
              <>
                <span class={`patty ${pt.cook > DONE_MIN ? 'marked' : ''}`} style={{ background: pattyColor(pt.cook) }}>
                  {pt.cook > 0.3 && <i class="smoke" style={{ opacity: Math.min(1, pt.cook) }} />}
                  {pt.cook > 0.85 && <i class="smoke dark" />}
                  <i class="sizzle" />
                </span>
                <span class="cook-bar">
                  <span style={{ width: `${Math.min(100, pt.cook * 100)}%` }} />
                  <em style={{ left: `${DONE_MIN * 100}%`, width: `${(DONE_MAX - DONE_MIN) * 100}%` }} />
                </span>
              </>
            )}
          </button>
        ))}
      </div>
      <PopLayer pops={pops} />
    </MiniFrame>
  );
}

// ---------------------------------------------------------------------------
// Tomar pedidos: monta el plato en el orden de la comanda
// ---------------------------------------------------------------------------

const INGREDIENTS = [
  { id: 'carne', label: 'Carne', color: '#7a4220' },
  { id: 'queso', label: 'Queso', color: '#ffcc33' },
  { id: 'lechuga', label: 'Lechuga', color: '#5fbf4a' },
  { id: 'tomate', label: 'Tomate', color: '#e8414f' },
  { id: 'cebolla', label: 'Cebolla', color: '#d9c7e8' },
  { id: 'bacon', label: 'Bacon', color: '#c8452e' },
];
const ING = Object.fromEntries(INGREDIENTS.map((i) => [i.id, i]));
const CLIENTS = ['Un taxista con prisa', 'Una enfermera del turno de noche', 'Un poli hambriento', 'Dos estudiantes', 'Un señor con sombrero', 'Una actriz de Broadway'];

function newOrder(level: number) {
  const n = Math.min(5, 2 + Math.floor(level / 3));
  return { who: pick(CLIENTS), items: Array.from({ length: n }, () => pick(INGREDIENTS).id), patience: Math.max(5, 10 - level * 0.4) };
}

/** Cómo pide el cliente su hamburguesa (de abajo arriba). */
function orderLine(items: string[]) {
  const names = items.map((i) => ING[i].label.toLowerCase());
  const list = names.length > 1 ? `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}` : names[0];
  return `${pick(['Ponme una con', 'Quiero una con', 'Para mí, una con', 'Una burger con'])} ${list}. ${pick(['¡En ese orden!', 'Rapidito.', 'Gracias, cielo.', ''])}`.trim();
}

export function Orders(p: MiniProps) {
  const mini = useMini('orders');
  const c = useCounter();
  const { pops, pop } = usePops();
  const [order, setOrder] = useState(() => newOrder(0));
  const [stack, setStack] = useState<string[]>([]);
  const [left, setLeft] = useState(order.patience);
  const [shake, setShake] = useState(0);
  const hurried = useRef(false);

  useEffect(() => {
    if (mini.playing) c.arrive(orderLine(order.items));
  }, [mini.playing]);

  const next = (ok: boolean) => {
    const o = newOrder(mini.score + (ok ? 1 : 0));
    setOrder(o);
    setLeft(o.patience);
    setStack([]);
    hurried.current = false;
    nextCustomer(c, orderLine(o.items), ok ? 1150 : 900);
  };

  // la paciencia solo baja con el cliente delante
  useLoop(mini.playing && c.at === 'in', (dt) => {
    setLeft((l) => {
      if (!hurried.current && l < order.patience * 0.4) {
        hurried.current = true;
        c.talk.say(pick(HURRY), 'enfado');
      }
      if (l - dt <= 0) {
        mini.miss();
        setShake((s) => s + 1);
        pop('¡SE VA!', 30, 30, 'bad');
        c.leave(pick(ANGRY), 'enfado');
        next(false);
        return 0;
      }
      return l - dt;
    });
  });

  const add = (id: string) => {
    if (!mini.playing || c.at !== 'in') return;
    const want = order.items[stack.length];
    if (id !== want) {
      mini.miss();
      setShake((s) => s + 1);
      setStack([]);
      c.talk.say(pick(WRONG), 'enfado');
      return;
    }
    play.click();
    fx.pop();
    const s = [...stack, id];
    if (s.length === order.items.length) {
      mini.hit();
      // propina si le sirves con más de media paciencia
      const tip = left / order.patience > 0.5;
      if (tip) {
        mini.hit();
        pop('+1 PROPINA', 50, 18, 'gold');
      } else pop('+1', 50, 40);
      c.leave(tip ? pick(THANKS) : pick(OK_LINES), 'feliz', tip);
      setStack(s);
      setTimeout(() => next(true), 450);
    } else setStack(s);
  };

  return (
    <MiniFrame mini={mini} cls="orders" title="PEDIDOS" introTitle="¡Marchando!" unit="pedidos servidos" {...p} intro={<>Lee la comanda y monta la hamburguesa <b>en el mismo orden</b>, de abajo arriba. Si te equivocas, a empezar. ¡Que no se enfade el cliente!</>}>
      <CounterView c={c} scene="diner" patience={left / order.patience} />
      <div class={`orders ${shake ? 'shake' : ''}`} key={shake}>
        <div class="ticket">
          <small>
            COMANDA · {c.person.name.split(' ')[0]}
          </small>
          <ol>
            {order.items.map((it, i) => (
              <li key={i} class={i < stack.length ? 'done' : ''}>
                <i style={{ background: ING[it].color }} /> {ING[it].label}
              </li>
            ))}
          </ol>
        </div>
        <div class="plate-stack">
          <span class="bun top" />
          {[...stack].reverse().map((s, i) => (
            <span key={i} class="layer" style={{ background: ING[s].color }} />
          ))}
          <span class="bun" />
          <span class="dish" />
        </div>
      </div>
      <div class="ing-buttons">
        {INGREDIENTS.map((i) => (
          <button key={i.id} class="ing-btn" onPointerDown={() => add(i.id)}>
            <i style={{ background: i.color }} />
            {i.label}
          </button>
        ))}
      </div>
      <PopLayer pops={pops} />
    </MiniFrame>
  );
}

// ---------------------------------------------------------------------------
// Servir café: mantén pulsado y suelta justo en la raya
// ---------------------------------------------------------------------------

const COFFEE_ASK = ['Un café, cariño. Hasta la raya.', 'Café solo, por favor. Ni una gota más.', 'Llénamelo justo hasta la marca.', 'Un café para despertarme. ¡Con cuidado!', 'Café del día. Que no se derrame, ¿eh?'];

export function Coffee(p: MiniProps) {
  const mini = useMini('coffee');
  const c = useCounter();
  const { pops, pop } = usePops();
  const streak = useRef(0);
  useEffect(() => {
    if (mini.playing) c.arrive(pick(COFFEE_ASK));
  }, [mini.playing]);
  const [level, setLevel] = useState(0);
  const [target, setTarget] = useState(0.65);
  const [pouring, setPouring] = useState(false);
  const [result, setResult] = useState<null | 'ok' | 'poco' | 'derrame'>(null);
  const tol = 0.07;

  const reset = () => {
    setLevel(0);
    setTarget(0.45 + Math.random() * 0.4);
    setResult(null);
  };

  useLoop(mini.playing && pouring, (dt) => {
    const speed = 0.38 + mini.score * 0.035;
    setLevel((l) => {
      const n = l + speed * dt;
      if (n >= 1) {
        setPouring(false);
        setResult('derrame');
        mini.miss();
        play.splash();
        streak.current = 0;
        pop('¡DERRAMADO!', 50, 55, 'bad');
        c.leave(pick(['¡Ay! ¡Que me quemo!', '¡Me has puesto perdido!', '¡Mi camisa nueva!']), 'enfado');
        nextCustomer(c, pick(COFFEE_ASK), 1000);
        setTimeout(reset, 700);
        return 1;
      }
      return n;
    });
  });

  const down = () => {
    if (!mini.playing || result || c.at !== 'in') return;
    setPouring(true);
  };
  const up = () => {
    if (!pouring) return;
    setPouring(false);
    const ok = Math.abs(level - target) <= tol;
    setResult(ok ? 'ok' : 'poco');
    if (ok) {
      mini.hit();
      // propina a partir de la tercera taza perfecta seguida
      const tip = ++streak.current >= 3 && Math.abs(level - target) <= tol * 0.6;
      if (tip) {
        mini.hit();
        pop('+1 PROPINA', 50, 18, 'gold');
      } else pop('+1', 50, 55);
      fx.pop();
      c.leave(tip ? pick(THANKS) : pick(['¡Perfecto!', 'Justo como me gusta.', 'Mmm, qué aroma.', 'Gracias, guapo.']), 'feliz', tip);
    } else {
      mini.miss();
      streak.current = 0;
      pop(level < target ? 'CORTO' : 'DE MÁS', 50, 55, 'bad');
      c.leave(level < target ? '¿Esto es todo? Qué rácano.' : 'Está hasta arriba, no lo puedo coger…', 'enfado');
    }
    nextCustomer(c, pick(COFFEE_ASK), 1050);
    setTimeout(reset, 550);
  };

  return (
    <MiniFrame mini={mini} cls="coffee" title="CAFÉ" introTitle="Café para la barra" unit="tazas perfectas" {...p} intro={<>Mantén pulsado para servir y <b>suelta justo en la raya</b>. Si te pasas, se derrama. Cuantas más tazas sirves, más rápido sale el café.</>}>
      <CounterView c={c} scene="diner" />
      <div class="coffee-area" onPointerDown={down} onPointerUp={up} onPointerLeave={up} onPointerCancel={up}>
        <div class={`pot ${pouring ? 'pouring' : ''}`}>
          <span class="pot-body" />
          {pouring && <span class="stream" />}
        </div>
        <div class="cup">
          {level > 0.2 && <span class="cup-steam" />}
          <span class="coffee-fill" style={{ height: `${level * 100}%` }} />
          <span class="cup-line" style={{ bottom: `${target * 100}%` }} />
          <span class="cup-handle" />
        </div>
        <div class={`coffee-msg ${result ?? ''}`}>
          {result === 'ok' ? '¡Perfecto!' : result === 'poco' ? (level < target ? 'Corto de café' : 'Demasiado') : result === 'derrame' ? '¡Derramado!' : pouring ? 'Sirviendo…' : 'Mantén pulsado'}
        </div>
      </div>
      <PopLayer pops={pops} />
    </MiniFrame>
  );
}

// ---------------------------------------------------------------------------
// Fregar el suelo: frota las manchas antes de que alguien las pise
// ---------------------------------------------------------------------------

interface Stain {
  id: number;
  x: number;
  y: number;
  dirt: number;
  life: number;
  color: string;
}

const STAIN_COLORS = ['#6b3d1e', '#a8552a', '#c8452e', '#d9a23a', '#3a4a2a'];

const MOP_SEEN = ['¡Puaj! ¡He pisado algo!', '¡Casi me mato! ¡Qué resbalón!', 'Esto está hecho un asco.', '¡Mis zapatos nuevos!'];
const MOP_HAPPY = ['¡Qué limpio está esto!', 'Se puede comer en el suelo.', 'Huele a limpio, da gusto.', '¡Brilla como un espejo!'];

export function Mop(p: MiniProps) {
  const mini = useMini('mop');
  const c = useCounter();
  const { pops, pop } = usePops();
  const cleanedRun = useRef(0);
  useEffect(() => {
    if (mini.playing) c.arrive('Buenas. Una mesa, por favor.');
  }, [mini.playing]);
  const area = useRef<HTMLDivElement>(null);
  const nextId = useRef(1);
  const [stains, setStains] = useState<Stain[]>([]);
  const spawnIn = useRef(0);
  const lastScrub = useRef(0);

  useLoop(mini.playing, (dt) => {
    spawnIn.current -= dt;
    const hurry = 1 + mini.elapsed() / 40;
    setStains((list) => {
      let out = list.map((s) => ({ ...s, life: s.life - dt * hurry }));
      const expired = out.filter((s) => s.life <= 0);
      if (expired.length) {
        expired.forEach((s) => {
          mini.miss();
          pop('¡PISADA!', s.x, s.y, 'bad');
        });
        cleanedRun.current = 0;
        if (c.at === 'in') {
          c.leave(pick(MOP_SEEN), 'enfado');
          nextCustomer(c, 'Hola. ¿Hay sitio?', 1300);
        }
      }
      out = out.filter((s) => s.life > 0);
      if (spawnIn.current <= 0 && out.length < 6) {
        spawnIn.current = Math.max(0.5, 1.4 - mini.elapsed() / 60);
        out.push({ id: nextId.current++, x: 12 + Math.random() * 76, y: 12 + Math.random() * 70, dirt: 1, life: 5, color: pick(STAIN_COLORS) });
      }
      return out;
    });
  });

  const scrub = (e: PointerEvent) => {
    if (!mini.playing || !area.current || (e.buttons === 0 && e.pointerType === 'mouse')) return;
    const r = area.current.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * 100;
    const y = ((e.clientY - r.top) / r.height) * 100;
    setStains((list) => {
      let cleaned = 0;
      const out = list
        .map((s) => (Math.hypot((s.x - x) * 1, (s.y - y) * 0.6) < 11 ? { ...s, dirt: s.dirt - 0.12 } : s))
        .filter((s) => {
          if (s.dirt > 0) return true;
          cleaned++;
          return false;
        });
      for (let i = 0; i < cleaned; i++) {
        mini.hit();
        pop('✨', x, y);
        if (++cleanedRun.current % 6 === 0 && c.at === 'in') c.talk.say(pick(MOP_HAPPY), 'feliz');
      }
      if (out.some((s, i) => s.dirt !== list[i]?.dirt) && Date.now() - lastScrub.current > 90) {
        lastScrub.current = Date.now();
        play.scrub();
      }
      return out;
    });
  };

  return (
    <MiniFrame mini={mini} cls="mop" title="FREGONA" introTitle="Suelo reluciente" unit="manchas limpias" {...p} intro={<>Van cayendo manchas al suelo del diner. <b>Frótalas con el dedo</b> hasta que desaparezcan antes de que entre un cliente y las pise.</>}>
      <CounterView c={c} scene="diner" class="short" />
      <div class="floor" ref={area} onPointerDown={scrub} onPointerMove={scrub}>
        <div class="floor-shine" />
        {stains.map((s) => (
          <span
            key={s.id}
            class={`stain ${s.life < 1.5 ? 'warn' : ''}`}
            style={{ left: `${s.x}%`, top: `${s.y}%`, opacity: 0.25 + s.dirt * 0.75, background: s.color, transform: `translate(-50%, -50%) scale(${0.6 + s.dirt * 0.4})` }}
          />
        ))}
        <PopLayer pops={pops} />
      </div>
    </MiniFrame>
  );
}
