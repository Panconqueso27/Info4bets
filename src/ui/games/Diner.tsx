import { useRef, useState } from 'preact/hooks';
import { play } from '../../platform/audio';
import { MiniFrame, pick, useLoop, useMini, type MiniProps } from './kit';

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

export function Burgers(p: MiniProps) {
  const mini = useMini('burgers');
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
    if (ok) mini.hit();
    else mini.miss();
    play.splash();
    setGrill((g) => g.map((x, k) => (k === i ? { ...x, wait: 0.6, flash: ok ? 'ok' : 'bad' } : x)));
  };

  return (
    <MiniFrame mini={mini} cls="burgers" title="PLANCHA" introTitle="La plancha del diner" unit="hamburguesas en su punto" {...p} intro={<>Las hamburguesas se hacen solas en la plancha. Tócalas cuando estén <b>marrones</b>: ni rosadas ni negras. ¡Cada vez van más rápido!</>}>
      <div class="grill">
        {grill.map((pt, i) => (
          <button key={pt.id} class={`grill-slot ${pt.wait > 0 ? 'empty' : ''} ${pt.flash ?? ''}`} onPointerDown={() => flip(i)}>
            {pt.wait > 0 ? (
              <span class="grill-msg">{pt.flash === 'ok' ? '¡En su punto!' : pt.cook > DONE_MAX ? '¡Quemada!' : '¡Cruda!'}</span>
            ) : (
              <>
                <span class="patty" style={{ background: pattyColor(pt.cook) }}>
                  {pt.cook > 0.3 && <i class="smoke" style={{ opacity: Math.min(1, pt.cook) }} />}
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

export function Orders(p: MiniProps) {
  const mini = useMini('orders');
  const [order, setOrder] = useState(() => newOrder(0));
  const [stack, setStack] = useState<string[]>([]);
  const [left, setLeft] = useState(order.patience);
  const [shake, setShake] = useState(0);

  const next = (ok: boolean) => {
    const o = newOrder(mini.score + (ok ? 1 : 0));
    setOrder(o);
    setLeft(o.patience);
    setStack([]);
  };

  useLoop(mini.playing, (dt) => {
    setLeft((l) => {
      if (l - dt <= 0) {
        mini.miss();
        setShake((s) => s + 1);
        next(false);
        return 0;
      }
      return l - dt;
    });
  });

  const add = (id: string) => {
    if (!mini.playing) return;
    const want = order.items[stack.length];
    if (id !== want) {
      mini.miss();
      setShake((s) => s + 1);
      setStack([]);
      return;
    }
    play.click();
    const s = [...stack, id];
    if (s.length === order.items.length) {
      mini.hit();
      next(true);
    } else setStack(s);
  };

  return (
    <MiniFrame mini={mini} cls="orders" title="PEDIDOS" introTitle="¡Marchando!" unit="pedidos servidos" {...p} intro={<>Lee la comanda y monta la hamburguesa <b>en el mismo orden</b>, de abajo arriba. Si te equivocas, a empezar. ¡Que no se enfade el cliente!</>}>
      <div class={`orders ${shake ? 'shake' : ''}`} key={shake}>
        <div class="ticket">
          <small>{order.who} pide:</small>
          <ol>
            {order.items.map((it, i) => (
              <li key={i} class={i < stack.length ? 'done' : ''}>
                <i style={{ background: ING[it].color }} /> {ING[it].label}
              </li>
            ))}
          </ol>
          <div class="patience">
            <span style={{ width: `${(left / order.patience) * 100}%`, background: left / order.patience < 0.3 ? '#ff4a5a' : '#35d07f' }} />
          </div>
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
    </MiniFrame>
  );
}

// ---------------------------------------------------------------------------
// Servir café: mantén pulsado y suelta justo en la raya
// ---------------------------------------------------------------------------

export function Coffee(p: MiniProps) {
  const mini = useMini('coffee');
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
        setTimeout(reset, 700);
        return 1;
      }
      return n;
    });
  });

  const down = () => {
    if (!mini.playing || result) return;
    setPouring(true);
  };
  const up = () => {
    if (!pouring) return;
    setPouring(false);
    const ok = Math.abs(level - target) <= tol;
    setResult(ok ? 'ok' : 'poco');
    if (ok) mini.hit();
    else mini.miss();
    setTimeout(reset, 550);
  };

  return (
    <MiniFrame mini={mini} cls="coffee" title="CAFÉ" introTitle="Café para la barra" unit="tazas perfectas" {...p} intro={<>Mantén pulsado para servir y <b>suelta justo en la raya</b>. Si te pasas, se derrama. Cuantas más tazas sirves, más rápido sale el café.</>}>
      <div class="coffee-area" onPointerDown={down} onPointerUp={up} onPointerLeave={up} onPointerCancel={up}>
        <div class={`pot ${pouring ? 'pouring' : ''}`}>
          <span class="pot-body" />
          {pouring && <span class="stream" />}
        </div>
        <div class="cup">
          <span class="coffee-fill" style={{ height: `${level * 100}%` }} />
          <span class="cup-line" style={{ bottom: `${target * 100}%` }} />
          <span class="cup-handle" />
        </div>
        <div class={`coffee-msg ${result ?? ''}`}>
          {result === 'ok' ? '¡Perfecto!' : result === 'poco' ? (level < target ? 'Corto de café' : 'Demasiado') : result === 'derrame' ? '¡Derramado!' : pouring ? 'Sirviendo…' : 'Mantén pulsado'}
        </div>
      </div>
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

export function Mop(p: MiniProps) {
  const mini = useMini('mop');
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
      if (expired.length) expired.forEach(() => mini.miss());
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
      for (let i = 0; i < cleaned; i++) mini.hit();
      if (out.some((s, i) => s.dirt !== list[i]?.dirt) && Date.now() - lastScrub.current > 90) {
        lastScrub.current = Date.now();
        play.scrub();
      }
      return out;
    });
  };

  return (
    <MiniFrame mini={mini} cls="mop" title="FREGONA" introTitle="Suelo reluciente" unit="manchas limpias" {...p} intro={<>Van cayendo manchas al suelo del diner. <b>Frótalas con el dedo</b> hasta que desaparezcan antes de que entre un cliente y las pise.</>}>
      <div class="floor" ref={area} onPointerDown={scrub} onPointerMove={scrub}>
        {stains.map((s) => (
          <span
            key={s.id}
            class={`stain ${s.life < 1.5 ? 'warn' : ''}`}
            style={{ left: `${s.x}%`, top: `${s.y}%`, opacity: 0.25 + s.dirt * 0.75, background: s.color, transform: `translate(-50%, -50%) scale(${0.6 + s.dirt * 0.4})` }}
          />
        ))}
      </div>
    </MiniFrame>
  );
}
