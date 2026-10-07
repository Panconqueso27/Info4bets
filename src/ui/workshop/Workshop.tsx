import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { randomPerson } from '../../art/portrait';
import { fx, play } from '../../platform/audio';
import {
  COLORS,
  EXTRAS,
  fairPrice,
  hasPart,
  MARKETING,
  MAX_EXTRAS,
  RUNS,
  type MarketingId,
  type RunId,
  launchCost,
  marketLevel,
  modelIncome,
  OUTCOME_LABEL,
  PART_BY_ID,
  partsOf,
  rateDesign,
  sizeOf,
  type Outcome,
  type Part,
  type PartKind,
  type PhoneDesign,
  type PhoneLab,
  type PhoneModel,
  type Placed,
} from '../../core/phonecore';
import { Backdrop, Bubble, Portrait, PopLayer, usePops, useTalk } from '../games/stage';
import { benchScene } from './bench';
import { canvasSize, drawPart, drawPhone, M, PX } from './phoneArt';
import './workshop.css';

export interface WorkshopProps {
  lab: PhoneLab;
  money: number;
  day: number;
  fmt: (n: number) => string;
  onBuy: (id: string) => boolean;
  onSave: (d: PhoneDesign) => void;
  onLaunch: (d: PhoneDesign, price: number, marketing: MarketingId, run: RunId) => { model: PhoneModel; headline: { title: string; text: string }; cost: number; result: { outcome: Outcome; level: number } } | void;
  onClose: () => void;
}

type Layer = 'front' | 'inside';
type Slot = Exclude<PartKind, 'forma'>;
const LAYER_OF: Record<Slot, Layer> = { pantalla: 'front', camara: 'front', procesador: 'inside', memoria: 'inside', bateria: 'inside' };
type Tab = PartKind | 'color' | 'extras';
const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'forma', label: 'Forma', icon: '📱' },
  { id: 'color', label: 'Color', icon: '🎨' },
  { id: 'pantalla', label: 'Pantalla', icon: '🖥' },
  { id: 'camara', label: 'Cámara', icon: '📷' },
  { id: 'procesador', label: 'Chip', icon: '🧠' },
  { id: 'memoria', label: 'Memoria', icon: '💾' },
  { id: 'bateria', label: 'Batería', icon: '🔋' },
  { id: 'extras', label: 'Extras', icon: '✨' },
];

/** Dibujo en miniatura de una pieza para el cajón. */
function PartArt({ part }: { part: Part }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const w = part.kind === 'forma' ? 22 : part.w * PX;
  const h = part.kind === 'forma' ? 36 : part.h * PX;
  useEffect(() => {
    const c = ref.current?.getContext('2d');
    if (!c) return;
    c.clearRect(0, 0, w, h);
    drawPart(c, part, 0, 0, w, h, 1.3);
  }, [part.id]);
  const k = Math.min(40 / w, 40 / h, 3);
  return <canvas ref={ref} width={w} height={h} class="ws-art" style={{ width: w * k, height: h * k }} />;
}

/** El móvil dibujado en pixel art, con la pantalla encendida. */
function PhoneCanvas({ d, layer, scale }: { d: PhoneDesign; layer: Layer; scale: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const st = useRef({ d, layer });
  st.current = { d, layer };
  const size = canvasSize(PART_BY_ID[d.shape]);
  useEffect(() => {
    const c = ref.current?.getContext('2d');
    if (!c) return;
    let raf = 0;
    let last = -1;
    const t0 = performance.now();
    const tick = (now: number) => {
      const f = Math.floor((now - t0) / 125);
      if (f !== last) {
        last = f;
        drawPhone(c, st.current.d, st.current.layer, (now - t0) / 1000);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [size.w, size.h]);
  return <canvas ref={ref} width={size.w} height={size.h} class="ws-canvas" style={{ width: size.w * scale, height: size.h * scale }} />;
}

const TIPS = [
  'La cámara, arriba del todo. Si no, sale el dedo en las fotos.',
  'Nunca pegues el procesador a la batería: se cuece.',
  'Pon el peso en el centro, que no se caiga de la mano.',
  'Una pantalla grande vende, pero se come la batería.',
  'El mercado mejora cada semana. Lo de hoy, mañana es viejo.',
  'Con el mismo nombre sacas la versión 2. Mejora las piezas.',
  'Un precio justo vende más que un precio alto.',
  'Toca una pieza para girarla. Arrástrala para moverla.',
];

/** Taller de móviles: mesa de técnico con la carcasa abierta y el cajón de piezas. */
export function Workshop(p: WorkshopProps) {
  const [d, setD] = useState<PhoneDesign>(() => JSON.parse(JSON.stringify(p.lab.draft)));
  const [layer, setLayer] = useState<Layer>('front');
  const [tab, setTab] = useState<Tab>('forma');
  const [sheet, setSheet] = useState<null | 'launch' | 'models'>(null);
  const [result, setResult] = useState<null | { title: string; text: string; outcome: Outcome; name: string; cost: number; perDay: number }>(null);
  const [mentor] = useState(() => randomPerson(77001985));
  const talk = useTalk(mentor);
  const { pops, pop } = usePops();
  const rating = useMemo(() => rateDesign(d), [d]);
  const level = marketLevel(p.day);
  const shape = PART_BY_ID[d.shape];

  // se guarda solo el diseño en la mesa
  useEffect(() => {
    const t = setTimeout(() => p.onSave(d), 400);
    return () => clearTimeout(t);
  }, [d]);
  useEffect(() => {
    const t = setTimeout(() => talk.say(p.lab.models.length ? '¿Otra vez por aquí? A ver qué inventamos hoy.' : 'Bienvenido al taller. Elige una carcasa y monta tu primer móvil.', 'feliz'), 500);
    const iv = setInterval(() => talk.say(TIPS[Math.floor(Math.random() * TIPS.length)]), 16000);
    return () => {
      clearTimeout(t);
      clearInterval(iv);
    };
  }, []);

  // ---------------------------------------------------------------- cuadrícula y arrastre
  const benchRef = useRef<HTMLDivElement>(null);
  const [cell, setCell] = useState(30);
  useEffect(() => {
    const fit = () => {
      const r = benchRef.current?.getBoundingClientRect();
      if (!r) return;
      const size = canvasSize(shape);
      const k = Math.min((r.width - 60) / size.w, (r.height - 16) / size.h);
      setCell(Math.max(16, Math.floor(k * PX)));
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [shape.w, shape.h]);

  const drag = useRef<{ slot: Slot; sx: number; sy: number; ox: number; oy: number; moved: boolean } | null>(null);
  const setPlaced = (slot: Slot, pl: Placed | null) => setD((x) => ({ ...x, [slot]: pl }));
  const onDown = (slot: Slot, e: PointerEvent) => {
    const pl = d[slot];
    if (!pl || LAYER_OF[slot] !== layer) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { slot, sx: e.clientX, sy: e.clientY, ox: pl.x, oy: pl.y, moved: false };
  };
  const onMove = (e: PointerEvent) => {
    const g = drag.current;
    if (!g) return;
    const dx = Math.round((e.clientX - g.sx) / cell);
    const dy = Math.round((e.clientY - g.sy) / cell);
    if (Math.abs(e.clientX - g.sx) + Math.abs(e.clientY - g.sy) > 6) g.moved = true;
    const pl = d[g.slot]!;
    const nx = Math.max(-2, Math.min(shape.w + 1, g.ox + dx));
    const ny = Math.max(-2, Math.min(shape.h + 1, g.oy + dy));
    if (nx !== pl.x || ny !== pl.y) {
      setPlaced(g.slot, { ...pl, x: nx, y: ny });
      fx.tick(0.04);
    }
  };
  const onUp = () => {
    const g = drag.current;
    drag.current = null;
    if (!g) return;
    const pl = d[g.slot];
    if (!pl) return;
    if (!g.moved) {
      // tocar sin mover: girar
      const part = PART_BY_ID[pl.id];
      if (part.w !== part.h) {
        setPlaced(g.slot, { ...pl, rot: !pl.rot });
        fx.whoosh();
      }
    } else fx.chip();
  };

  // ---------------------------------------------------------------- cajón de piezas
  const owned = (key: string) => hasPart(p.lab, key);
  /** Compra lo que haga falta antes de usarlo; devuelve false si no se pudo. */
  const ensure = (key: string, name: string, price: number) => {
    if (owned(key)) return true;
    if (p.money < price) {
      talk.say(`${name} cuesta ${p.fmt(price)}. Aún no llega el dinero.`, 'triste');
      play.error();
      return false;
    }
    if (!p.onBuy(key)) return false;
    fx.register();
    pop(`−${p.fmt(price)}`, 50, 70, 'bad');
    talk.say(`¡${name}! Buena compra.`, 'feliz');
    return true;
  };
  const pickColor = (id: string, name: string, price: number) => {
    if (!ensure(`color:${id}`, name, price)) return;
    fx.pop();
    setD((x) => ({ ...x, color: id }));
  };
  const toggleExtra = (id: string, name: string, price: number) => {
    const on = (d.extras ?? []).includes(id);
    if (!on && (d.extras ?? []).length >= MAX_EXTRAS) {
      talk.say(`Máximo ${MAX_EXTRAS} extras: si no, no cabe en el bolsillo.`, 'nervios');
      play.error();
      return;
    }
    if (!on && !ensure(`extra:${id}`, name, price)) return;
    fx.pop();
    setD((x) => ({ ...x, extras: on ? (x.extras ?? []).filter((e) => e !== id) : [...(x.extras ?? []), id] }));
  };
  const pick = (part: Part) => {
    if (!ensure(part.id, part.name, part.price)) return;
    fx.pop();
    if (part.kind === 'forma') {
      setD((x) => ({ ...x, shape: part.id }));
      return;
    }
    const slot = part.kind as Slot;
    setLayer(LAYER_OF[slot]);
    setD((x) => {
      const prev = x[slot];
      // donde estaba la anterior o en el primer hueco libre
      const pl: Placed = prev ? { ...prev, id: part.id } : { id: part.id, ...freeSpot(x, slot, part) };
      return { ...x, [slot]: pl };
    });
  };

  const launch = (price: number, mkt: MarketingId, run: RunId) => {
    const res = p.onLaunch({ ...d }, price, mkt, run);
    if (!res) return;
    setSheet(null);
    const good = res.result.outcome === 'exito' || res.result.outcome === 'bombazo';
    if (good) fx.jackpot();
    else play.bad();
    talk.say(good ? '¡Lo sabía! ¡Sales en el periódico!' : res.result.outcome === 'discreto' ? 'Se vende algo… Hay que apretar más.' : 'Un tropiezo. Volvamos a la mesa.', good ? 'feliz' : 'triste');
    setResult({ ...res.headline, outcome: res.result.outcome, name: res.model.name, cost: res.cost, perDay: modelIncome(res.model, res.model.launchedDay + 1) });
    setD(JSON.parse(JSON.stringify(res.model.design)));
  };

  const active = p.lab.models.filter((m) => !m.retired);
  return (
    <div class="workshop">
      <Backdrop draw={benchScene} w={180} h={320} fps={10} />
      <div class="ws-head">
        <button class="btn small secondary" onClick={p.onClose}>
          ◀ Salir
        </button>
        <div class="ws-title">
          <b>TALLER DE MÓVILES</b>
          <small>Día {p.day} · el mercado exige {level}</small>
        </div>
        <span class="ws-money">{p.fmt(p.money)}</span>
      </div>

      <div class="ws-mentor">
        <Portrait person={mentor} talking={talk.talking} mood={talk.mood} scale={1.6} />
        <Bubble text={talk.line} k={talk.key} side="left" />
      </div>

      <div class="ws-bench" ref={benchRef}>
        <div class="ws-layers">
          <button class={layer === 'front' ? 'on' : ''} onClick={() => (setLayer('front'), fx.whoosh())}>
            Frontal
          </button>
          <button class={layer === 'inside' ? 'on' : ''} onClick={() => (setLayer('inside'), fx.whoosh())}>
            Interior
          </button>
        </div>
        <div class={`ws-phone layer-${layer}`} style={{ width: canvasSize(shape).w * (cell / PX), height: canvasSize(shape).h * (cell / PX) }} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
          <PhoneCanvas d={d} layer={layer} scale={cell / PX} />
          {(['procesador', 'memoria', 'bateria', 'pantalla', 'camara'] as Slot[]).map((slot) => {
            const pl = d[slot];
            if (!pl || LAYER_OF[slot] !== layer) return null;
            const s = sizeOf(pl);
            const part = PART_BY_ID[pl.id];
            const out = pl.x < 0 || pl.y < 0 || pl.x + s.w > shape.w || pl.y + s.h > shape.h;
            const k = cell / PX;
            return (
              <div
                key={slot}
                class={`ws-hit ${out ? 'out' : ''}`}
                style={{ left: (M.x + pl.x * PX) * k, top: (M.top + pl.y * PX) * k, width: s.w * cell, height: s.h * cell }}
                onPointerDown={(e) => onDown(slot, e)}
              >
                <span class="ws-part-label">{part.name}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div class="ws-stats">
        <div class="ws-total">
          <span>
            Nota <b class={rating.total >= level ? 'up' : 'down'}>{rating.ok ? rating.total : '—'}</b> / mercado {level}
          </span>
          <div class="ws-meter">
            <i style={{ width: `${rating.total}%` }} class={rating.total >= level ? 'up' : 'down'} />
            <em style={{ left: `${level}%` }} />
          </div>
        </div>
        <div class="ws-bars">
          {(
            [
              ['⚡', 'Potencia', rating.rendimiento],
              ['🖥', 'Pantalla', rating.pantalla],
              ['📷', 'Cámara', rating.camara],
              ['🔋', 'Batería', rating.autonomia],
              ['✨', 'Diseño', rating.diseno],
              ['★', 'Extras', rating.extras],
            ] as const
          ).map(([ic, label, v]) => (
            <div key={label} class="ws-bar" title={label}>
              <span>{ic}</span>
              <i>
                <b style={{ height: `${v}%` }} />
              </i>
              <small>{v}</small>
            </div>
          ))}
        </div>
        <div class="ws-issues">
          {rating.issues
            .filter((i) => i.level !== 'bien')
            .slice(0, 2)
            .map((i) => (
              <span key={i.text} class={i.level}>
                {i.level === 'grave' ? '⛔' : '⚠'} {i.text}
              </span>
            ))}
          {!rating.issues.some((i) => i.level !== 'bien') && rating.ok && <span class="bien">✔ Montaje limpio. ¡Listo para fabricar!</span>}
        </div>
      </div>

      <div class="ws-drawer">
        <div class="ws-tabs">
          {TABS.map((tb) => (
            <button key={tb.id} class={tab === tb.id ? 'on' : ''} onClick={() => (setTab(tb.id), fx.pop())}>
              <span>{tb.icon}</span>
              {tb.label}
            </button>
          ))}
        </div>
        <div class="ws-parts">
          {tab === 'color' &&
            COLORS.map((c) => {
              const has = owned(`color:${c.id}`);
              return (
                <button key={c.id} class={`ws-card ${has ? '' : 'locked'} ${(d.color ?? 'negro') === c.id ? 'using' : ''}`} onClick={() => pickColor(c.id, c.name, c.price)}>
                  <span class="ws-swatch" style={{ background: c.hex }} />
                  <b>{c.name}</b>
                  <span class="ws-q">{'★'.repeat(Math.max(1, Math.round(c.style / 2)))}</span>
                  {!has && <em>{p.fmt(c.price)}</em>}
                </button>
              );
            })}
          {tab === 'extras' &&
            EXTRAS.map((e) => {
              const has = owned(`extra:${e.id}`);
              const on = (d.extras ?? []).includes(e.id);
              return (
                <button key={e.id} class={`ws-card ${has ? '' : 'locked'} ${on ? 'using' : ''}`} onClick={() => toggleExtra(e.id, e.name, e.price)}>
                  <span class="ws-extra-ic">{e.icon}</span>
                  <b>{e.name}</b>
                  <small>+{e.pts} pts · {p.fmt(e.unit)}/ud.</small>
                  {!has && <em>{p.fmt(e.price)}</em>}
                </button>
              );
            })}
          {tab !== 'color' &&
            tab !== 'extras' &&
            partsOf(tab).map((part) => {
              const has = owned(part.id);
              const using = part.kind === 'forma' ? d.shape === part.id : d[part.kind as Slot]?.id === part.id;
              return (
                <button key={part.id} class={`ws-card ${has ? '' : 'locked'} ${using ? 'using' : ''}`} onClick={() => pick(part)}>
                  <span class="ws-card-art">
                    <PartArt part={part} />
                  </span>
                  <b>{part.name}</b>
                  <span class="ws-q">{'★'.repeat(Math.ceil(part.q / 2))}</span>
                  <small>
                    {part.w}×{part.h}
                    {part.drain ? ` · gasta ${part.drain}` : ''}
                    {part.cap ? ` · carga ${part.cap}` : ''}
                    {part.heat && part.heat >= 4 ? ' · 🔥' : ''}
                  </small>
                  {!has && <em>{p.fmt(part.price)}</em>}
                </button>
              );
            })}
        </div>
        <div class="ws-actions">
          <button class="btn secondary" onClick={() => setSheet('models')}>
            📦 Mis modelos {active.length ? `(${active.length})` : ''}
          </button>
          <button class="btn big-cta" disabled={!rating.ok} onClick={() => setSheet('launch')}>
            🚀 Lanzar al mercado
          </button>
        </div>
      </div>

      {sheet === 'launch' && <LaunchSheet d={d} setName={(name) => setD((x) => ({ ...x, name }))} p={p} level={level} onLaunch={launch} onClose={() => setSheet(null)} />}
      {sheet === 'models' && (
        <ModelsSheet
          models={p.lab.models}
          day={p.day}
          fmt={p.fmt}
          onImprove={(m) => {
            setD(JSON.parse(JSON.stringify(m.design)));
            setSheet(null);
            talk.say(`Vamos a por el ${m.name.replace(/ \d+$/, '')} ${m.version + 1}. Cambia piezas y mejóralo.`, 'feliz');
          }}
          onClose={() => setSheet(null)}
        />
      )}
      {result && (
        <div class="ws-overlay" onClick={() => setResult(null)}>
          <div class={`ws-paper out-${result.outcome}`}>
            <div class="paper-head">THE DAILY LEDGER</div>
            <div class="ws-paper-sec">TECNOLOGÍA</div>
            <h3>{result.title}</h3>
            <p>{result.text}</p>
            <div class={`ws-verdict out-${result.outcome}`}>{OUTCOME_LABEL[result.outcome]}</div>
            <p class="ws-paper-foot">
              Lanzarlo costó {p.fmt(result.cost)} · ventas el primer día: unos <b>{p.fmt(result.perDay)}</b> para ti, y bajando con el tiempo.
            </p>
            <button class="btn">Volver al taller</button>
          </div>
        </div>
      )}
      <PopLayer pops={pops} />
    </div>
  );
}

/** Primer hueco donde cabe la pieza en su capa. */
function freeSpot(d: PhoneDesign, slot: Slot, part: Part): { x: number; y: number; rot: boolean } {
  const shape = PART_BY_ID[d.shape];
  const others = (Object.keys(LAYER_OF) as Slot[]).filter((s) => s !== slot && LAYER_OF[s] === LAYER_OF[slot] && d[s]).map((s) => d[s]!);
  const fits = (x: number, y: number) =>
    x + part.w <= shape.w &&
    y + part.h <= shape.h &&
    others.every((o) => {
      const s = sizeOf(o);
      return x >= o.x + s.w || o.x >= x + part.w || y >= o.y + s.h || o.y >= y + part.h;
    });
  for (let y = 0; y < shape.h; y++) for (let x = 0; x < shape.w; x++) if (fits(x, y)) return { x, y, rot: false };
  return { x: 0, y: 0, rot: false };
}

function LaunchSheet({ d, setName, p, level, onLaunch, onClose }: { d: PhoneDesign; setName: (s: string) => void; p: WorkshopProps; level: number; onLaunch: (price: number, mkt: MarketingId, run: RunId) => void; onClose: () => void }) {
  const r = rateDesign(d);
  const fair = fairPrice(r);
  const [price, setPrice] = useState(fair);
  const [mkt, setMkt] = useState<MarketingId>('boca');
  const [run, setRun] = useState<RunId>('media');
  const cost = launchCost(r, run, mkt);
  const diff = r.total - level;
  const vibe = diff >= 10 ? 'Los expertos lo ven ganador.' : diff >= 0 ? 'Puede funcionar si aciertas con el precio.' : diff >= -8 ? 'Va justo: la competencia es mejor.' : 'Se ha quedado viejo antes de salir.';
  return (
    <div class="ws-overlay" onClick={onClose}>
      <div class="ws-sheet" onClick={(e) => e.stopPropagation()}>
        <h3>Lanzar al mercado</h3>
        <label class="ws-field">
          Nombre del modelo
          <input value={d.name} maxLength={18} onInput={(e) => setName((e.target as HTMLInputElement).value)} />
          <small>Con el nombre de un modelo anterior sale como versión nueva y lo sustituye.</small>
        </label>
        <div class="ws-field">
          Precio de venta: <b>{p.fmt(price)}</b> <small>(justo: {p.fmt(fair)} · fabricarlo: {p.fmt(r.unitCost)})</small>
          <input type="range" min={r.unitCost + 1} max={fair * 2} value={price} onInput={(e) => setPrice(Number((e.target as HTMLInputElement).value))} />
        </div>
        <p class="ws-forecast">
          Nota <b>{r.total}</b> · el mercado exige <b>{level}</b>. {vibe}
          {price > fair * 1.2 && ' Muy caro: venderá poco.'}
          {price < fair * 0.8 && ' Barato: venderá, pero ganas poco por unidad.'}
        </p>
        <div class="ws-field">
          Publicidad
          <div class="ws-opts">
            {MARKETING.map((m) => (
              <button key={m.id} class={mkt === m.id ? 'on' : ''} onClick={() => (setMkt(m.id), fx.pop())}>
                <b>{m.name}</b>
                <small>{m.cost ? p.fmt(m.cost) : 'Gratis'} · ventas ×{m.mul}</small>
              </button>
            ))}
          </div>
        </div>
        <div class="ws-field">
          Primera tirada
          <div class="ws-opts three">
            {RUNS.map((x) => (
              <button key={x.id} class={run === x.id ? 'on' : ''} onClick={() => (setRun(x.id), fx.pop())}>
                <b>{x.name.split(' (')[0]}</b>
                <small>{x.name.match(/\((.*)\)/)?.[1]}</small>
              </button>
            ))}
          </div>
          <small>Corta: barata, pero si triunfa se agota. Grande: cara, y si fracasa te comes el almacén.</small>
        </div>
        <p class="ws-forecast">
          Lanzarlo cuesta <b>{p.fmt(cost)}</b> (moldes, tirada y publicidad). Tienes {p.fmt(p.money)}.
        </p>
        <button class="btn big-cta" disabled={p.money < cost} onClick={() => onLaunch(price, mkt, run)}>
          {p.money < cost ? 'No te llega el dinero' : `Fabricar y lanzar · ${p.fmt(cost)}`}
        </button>
        <button class="btn secondary" onClick={onClose}>
          Seguir montando
        </button>
      </div>
    </div>
  );
}

function ModelsSheet({ models, day, fmt, onImprove, onClose }: { models: PhoneModel[]; day: number; fmt: (n: number) => string; onImprove: (m: PhoneModel) => void; onClose: () => void }) {
  return (
    <div class="ws-overlay" onClick={onClose}>
      <div class="ws-sheet" onClick={(e) => e.stopPropagation()}>
        <h3>Mis modelos</h3>
        {!models.length && <p class="ws-forecast">Aún no has lanzado ningún móvil. ¡Al lío!</p>}
        <div class="ws-models">
          {[...models].reverse().map((m) => (
            <div key={m.id} class={`ws-model ${m.retired ? 'retired' : ''}`}>
              <div>
                <b>{m.name}</b>
                <small>
                  Día {m.launchedDay} · nota {m.total} · {OUTCOME_LABEL[m.outcome]}
                </small>
                <small>{m.retired ? 'Ya no se vende' : `Hoy: ${fmt(modelIncome(m, day + 1))}/día`} · total ganado {fmt(m.earned)}</small>
              </div>
              <button class="btn small good" onClick={() => onImprove(m)}>
                Mejorar
              </button>
            </div>
          ))}
        </div>
        <button class="btn secondary" onClick={onClose}>
          Cerrar
        </button>
      </div>
    </div>
  );
}

