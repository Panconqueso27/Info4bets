import { useState } from 'preact/hooks';
import { play } from '../../platform/audio';
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

export function Hotdogs(p: MiniProps) {
  const mini = useMini('hotdogs');
  const [order, setOrder] = useState(() => newOrder(0));
  const [on, setOn] = useState<string[]>([]);
  const [left, setLeft] = useState(order.patience);
  const [flash, setFlash] = useState<null | 'ok' | 'bad'>(null);

  const next = (lvl: number) => {
    const o = newOrder(lvl);
    setOrder(o);
    setLeft(o.patience);
    setOn([]);
  };

  useLoop(mini.playing && !flash, (dt) =>
    setLeft((l) => {
      if (l - dt <= 0) {
        mini.miss();
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
    if (!mini.playing || flash) return;
    play.click();
    setOn((o) => (o.includes(id) ? o.filter((x) => x !== id) : [...o, id]));
  };
  const serve = () => {
    if (!mini.playing || flash) return;
    const ok = on.length === order.items.length && order.items.every((i) => on.includes(i));
    if (ok) mini.hit();
    else mini.miss();
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
      <div class={`hotdog-stand ${flash ?? ''}`}>
        <div class="umbrella-top" />
        <div class="ticket">
          <small>{order.who} quiere:</small>
          <ol>
            {order.items.map((it) => (
              <li key={it} class={on.includes(it) ? 'done' : ''}>
                <i style={{ background: TOP[it].color }} /> {TOP[it].label}
              </li>
            ))}
          </ol>
          <div class="patience">
            <span style={{ width: `${(left / order.patience) * 100}%`, background: left / order.patience < 0.3 ? '#ff4a5a' : '#35d07f' }} />
          </div>
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
    </MiniFrame>
  );
}
