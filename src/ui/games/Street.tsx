import { useEffect, useRef, useState } from 'preact/hooks';
import { fx, play } from '../../platform/audio';
import { CounterView, useCounter } from './counter';
import { PopLayer, usePops, useShake } from './stage';
import './street.css';
import { HOTDOG_PER_POINT } from '../../core/economy';
import { ROLES } from '../../core/roles';
import { MiniFrame, pick, useLoop, useMini, type MiniProps } from './kit';

/**
 * Puesto de perritos calientes (inmigrante, fuera de la jornada):
 * el cliente pide sus salsas; tócalas y sirve antes de que se vaya.
 * Cada perrito bien servido es dinero en la caja.
 */
const TOPPINGS = [
  { id: 'mostaza', label: 'Mostaza', color: '#ffcc33' },
  { id: 'ketchup', label: 'Ketchup', color: '#e8414f' },
  { id: 'cebolla', label: 'Cebolla', color: '#e8e0f0' },
  { id: 'chucrut', label: 'Chucrut', color: '#c8d88a' },
  { id: 'pepinillo', label: 'Pepinillo', color: '#5fbf4a' },
];
const TOP = Object.fromEntries(TOPPINGS.map((t) => [t.id, t]));
const CLIENTS = ['Un taxista', 'Un banquero con prisa', 'Dos turistas japoneses', 'Una abuela del barrio', 'Un poli de ronda', 'Un músico callejero', 'Un niño con su padre'];

function newOrder(level: number) {
  const n = Math.min(3, 1 + Math.floor(level / 4) + (Math.random() < 0.3 ? 1 : 0));
  const pool = [...TOPPINGS];
  const items: string[] = [];
  while (items.length < n) items.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0].id);
  return { who: pick(CLIENTS), items, patience: Math.max(4, 8 - level * 0.25) };
}

/** Cómo pide cada cliente su perrito. */
function askLine(items: string[]) {
  const names = items.map((i) => TOP[i].label.toLowerCase());
  const list = names.length > 1 ? `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}` : names[0];
  return `${pick(['¡Uno con', 'Ponme uno con', 'Un perrito con', 'Hey, amigo, uno con', 'Para mí, con'])} ${list}! ${pick(['', 'Rápido, que pierdo el bus.', 'Como el de ayer.', 'El mejor de la Quinta.', '¿Cuánto es?'])}`.replace(' !', '!').trim();
}
const HD_THANKS = ['¡Buenísimo! Quédate el cambio.', '¡El mejor perrito de Nueva York!', 'Toma, amigo, una propina.', '¡Así da gusto! Hasta mañana.', 'Mmm… ¡Vuelvo seguro!'];
const HD_OK = ['Gracias.', 'Está bien.', 'Vale, vale.', 'Bien.'];
const HD_ANGRY = ['¡Eso no es lo que pedí!', 'Pues me voy al de enfrente.', '¡Qué lento eres, chico!', 'Olvídalo, ya no tengo hambre.'];

export function Hotdogs(p: MiniProps) {
  const mini = useMini('hotdogs');
  const c = useCounter();
  const { pops, pop } = usePops();
  const shaker = useShake();
  const hurried = useRef(false);
  const [order, setOrder] = useState(() => newOrder(0));
  const [on, setOn] = useState<string[]>([]);
  const [left, setLeft] = useState(order.patience);
  const [flash, setFlash] = useState<null | 'ok' | 'bad'>(null);

  useEffect(() => {
    if (mini.playing) c.arrive(askLine(order.items));
  }, [mini.playing]);

  const next = (lvl: number) => {
    const o = newOrder(lvl);
    setOrder(o);
    setLeft(o.patience);
    setOn([]);
    hurried.current = false;
    setTimeout(() => c.arrive(askLine(o.items)), 650);
  };

  useLoop(mini.playing && !flash && c.at === 'in', (dt) =>
    setLeft((l) => {
      if (!hurried.current && l < order.patience * 0.35) {
        hurried.current = true;
        c.talk.say(pick(['¿Falta mucho?', 'Vamos, vamos…', '¡Que llego tarde!']), 'enfado');
      }
      if (l - dt <= 0) {
        mini.miss();
        shaker.shake();
        pop('¡SE VA!', 30, 30, 'bad');
        c.leave(pick(HD_ANGRY), 'enfado');
        setFlash('bad');
        setTimeout(() => {
          setFlash(null);
          next(mini.score);
        }, 400);
        return 0;
      }
      return l - dt;
    }),
  );

  const toggle = (id: string) => {
    if (!mini.playing || flash || c.at !== 'in') return;
    play.click();
    fx.pop();
    setOn((o) => (o.includes(id) ? o.filter((x) => x !== id) : [...o, id]));
  };
  const serve = () => {
    if (!mini.playing || flash || c.at !== 'in') return;
    const ok = on.length === order.items.length && order.items.every((i) => on.includes(i));
    if (ok) {
      mini.hit();
      // propina si le atiendes rápido: otro perrito de dinero
      const tip = left / order.patience > 0.5;
      if (tip) {
        mini.hit();
        pop(`+${ROLES.inmigrante.formatMoney(HOTDOG_PER_POINT)} PROPINA`, 50, 18, 'gold');
      } else pop('+1', 50, 40);
      c.leave(tip ? pick(HD_THANKS) : pick(HD_OK), 'feliz', tip);
    } else {
      mini.miss();
      shaker.shake();
      pop('¡MAL!', 50, 40, 'bad');
      c.leave(pick(HD_ANGRY), 'enfado');
    }
    setFlash(ok ? 'ok' : 'bad');
    setTimeout(() => {
      setFlash(null);
      next(mini.score + (ok ? 1 : 0));
    }, ok ? 250 : 500);
  };

  return (
    <MiniFrame
      mini={mini}
      cls="hotdogs"
      title="PERRITOS"
      introTitle="Hot dogs de Nueva York"
      unit="perritos vendidos"
      pays={{ per: HOTDOG_PER_POINT, fmt: ROLES.inmigrante.formatMoney }}
      {...p}
      intro={<>Cada cliente pide sus salsas. Ponle <b>exactamente</b> lo que pide y pulsa SERVIR antes de que se canse de esperar.</>}
    >
      <CounterView c={c} scene="calle" patience={left / order.patience} />
      <div class={`hotdog-stand ${flash ?? ''} ${shaker.cls}`}>
        <div class="umbrella-top" />
        <div class="ticket">
          <small>{c.person.name.split(' ')[0]} quiere:</small>
          <ol>
            {order.items.map((it) => (
              <li key={it} class={on.includes(it) ? 'done' : ''}>
                <i style={{ background: TOP[it].color }} /> {TOP[it].label}
              </li>
            ))}
          </ol>
        </div>
        <div class="hotdog">
          <span class="bun-dog" />
          <span class="sausage" />
          {on.map((t, i) => (
            <span key={t} class="sauce" style={{ background: TOP[t].color, top: `${38 + i * 6}%` }} />
          ))}
        </div>
      </div>
      <div class="ing-buttons">
        {TOPPINGS.map((t) => (
          <button key={t.id} class={`ing-btn ${on.includes(t.id) ? 'on' : ''}`} onPointerDown={() => toggle(t.id)}>
            <i style={{ background: t.color }} />
            {t.label}
          </button>
        ))}
        <button class="ing-btn serve" onPointerDown={serve}>
          SERVIR
        </button>
      </div>
      <PopLayer pops={pops} />
    </MiniFrame>
  );
}
