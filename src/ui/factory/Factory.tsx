import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { randomPerson } from '../../art/portrait';
import { fx, play } from '../../platform/audio';
import {
  CAR_COLORS,
  CAR_EXTRAS,
  CAR_KIND_LABEL,
  CAR_MARKETING,
  CAR_OUTCOME_LABEL,
  CAR_PART_BY_ID,
  CAR_RUNS,
  carFairPrice,
  carIncome,
  carLaunchCost,
  carMarketLevel,
  carPartsOf,
  carScore,
  emissionLimit,
  hasCarItem,
  MAX_CAR_EXTRAS,
  SEGMENT_LABEL,
  testCar,
  trendOf,
  type CarDesign,
  type CarKind,
  type CarLab,
  type CarMarketingId,
  type CarModel,
  type CarOutcome,
  type CarPart,
  type CarRunId,
  type Cause,
  type Drive,
  type MotorPos,
} from '../../core/carcore';
import { Backdrop, Bubble, Portrait, PopLayer, R, usePops, useTalk } from '../games/stage';
import { CAR_H, carLen, drawCar, factoryHall } from './carArt';
import './factory.css';

export interface FactoryProps {
  lab: CarLab;
  money: number;
  day: number;
  seed: number;
  fmt: (n: number) => string;
  onBuy: (key: string) => boolean;
  onSave: (d: CarDesign) => void;
  onLaunch: (d: CarDesign, price: number, mkt: CarMarketingId, run: CarRunId) => { model: CarModel; headline: { title: string; text: string }; cost: number; result: { outcome: CarOutcome; causes: Cause[] } } | void;
  onClose: () => void;
}

type Tab = CarKind | 'pintura' | 'extras' | 'distribucion';
const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'carroceria', label: 'Carrocería', icon: '🚗' },
  { id: 'motor', label: 'Motor', icon: '⚙' },
  { id: 'caja', label: 'Cambio', icon: '🕹' },
  { id: 'ruedas', label: 'Ruedas', icon: '🛞' },
  { id: 'interior', label: 'Interior', icon: '💺' },
  { id: 'seguridad', label: 'Seguridad', icon: '🛡' },
  { id: 'pintura', label: 'Pintura', icon: '🎨' },
  { id: 'extras', label: 'Extras', icon: '✨' },
  { id: 'distribucion', label: 'Motor y tracción', icon: '📐' },
];

const TIPS = [
  'Mira la tendencia de la semana: manda en lo que compra la gente.',
  'Un motor central solo cabe en coupés y deportivos.',
  'Con la ley de emisiones cada vez más dura, el diésel tiene los días contados.',
  'Mucha potencia con tracción delantera: las ruedas patinan.',
  'La tracción total pesa y gasta, pero en la nieve no tiene rival.',
  'Pasa las pruebas antes de lanzar: un coche de una estrella es un escándalo.',
  'Con el mismo nombre sacamos la versión 2 con mejores piezas.',
  'Si es un éxito, sus coches circularán por nuestras calles.',
];

/** Lienzo con el coche de perfil (plano o pintado). */
function CarCanvas({ d, mode, w = 120, h = 40, scale }: { d: CarDesign; mode: 'plano' | 'pintura'; w?: number; h?: number; scale: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const st = useRef({ d, mode });
  st.current = { d, mode };
  useEffect(() => {
    const c = ref.current?.getContext('2d');
    if (!c) return;
    let raf = 0;
    let last = -1;
    const t0 = performance.now();
    const tick = (now: number) => {
      const f = Math.floor((now - t0) / 110);
      if (f !== last) {
        last = f;
        const { d: dd, mode: m } = st.current;
        c.clearRect(0, 0, w, h);
        if (m === 'plano') {
          R(c, 0, 0, w, h, '#1f4a8a');
          for (let x = 0; x < w; x += 5) R(c, x, 0, 1, h, 'rgba(255,255,255,0.08)');
          for (let y = 0; y < h; y += 5) R(c, 0, y, w, 1, 'rgba(255,255,255,0.08)');
        } else {
          // sala de exposición: suelo brillante y foco
          const g = c.createLinearGradient(0, 0, 0, h);
          g.addColorStop(0, '#2a2438');
          g.addColorStop(0.72, '#4a4060');
          g.addColorStop(0.73, '#8a8094');
          g.addColorStop(1, '#5a5468');
          c.fillStyle = g;
          c.fillRect(0, 0, w, h);
          const s = c.createRadialGradient(w / 2, 0, 2, w / 2, h * 0.6, w * 0.6);
          s.addColorStop(0, 'rgba(255,240,200,0.35)');
          s.addColorStop(1, 'rgba(255,240,200,0)');
          c.fillStyle = s;
          c.fillRect(0, 0, w, h);
        }
        const len = carLen(dd);
        const ox = Math.round((w - len) / 2);
        const oy = Math.round(h - CAR_H - 4);
        if (m === 'pintura') R(c, ox + 2, oy + CAR_H - 1, len - 4, 2, 'rgba(0,0,0,0.35)');
        drawCar(c, dd, ox, oy, m, (now - t0) / 1000);
        if (m === 'plano') {
          // cotas
          R(c, ox, h - 2, len, 1, '#bfe6ff');
          R(c, ox, h - 4, 1, 4, '#bfe6ff');
          R(c, ox + len - 1, h - 4, 1, 4, '#bfe6ff');
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [w, h]);
  return <canvas ref={ref} width={w} height={h} class="fa-canvas" style={{ width: w * scale, height: h * scale }} />;
}

/** Icono de pieza dibujado en pixel art. */
function PartIcon({ part, d }: { part: CarPart; d: CarDesign }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current?.getContext('2d');
    if (!c) return;
    c.clearRect(0, 0, 40, 24);
    const q = part.q;
    switch (part.kind) {
      case 'carroceria': {
        const dd = { ...d, carroceria: part.id, extras: [] };
        const k = Math.min(0.55, 38 / carLen(dd));
        c.save();
        c.scale(k, k);
        drawCar(c, dd, Math.round((40 / k - carLen(dd)) / 2), Math.round((24 / k - CAR_H) / 2), 'pintura', 0);
        c.restore();
        break;
      }
      case 'motor': {
        const col = part.look === 'electrico' ? '#4ff0ff' : q >= 7 ? '#c8302a' : '#8a8e94';
        R(c, 8, 7, 24, 12, '#3a3a46');
        R(c, 9, 8, 22, 10, col);
        const n = part.look === 'v12' ? 6 : part.look === 'v8' ? 4 : part.look.includes('6') ? 3 : 2;
        for (let k = 0; k < n; k++) R(c, 10 + k * (20 / n), 4, 20 / n - 1, 3, '#5a5e64');
        R(c, 32, 10, 4, 3, '#14101f');
        if (part.look === 'turbo') R(c, 3, 9, 5, 5, '#c8ccd2');
        break;
      }
      case 'caja':
        R(c, 18, 6, 3, 13, '#5a5e64');
        R(c, 16, 3, 7, 5, part.look === 'auto' ? '#14101f' : '#c8302a');
        R(c, 12, 19, 15, 3, '#3a3a46');
        if (part.look === 'auto') ['P', 'R', 'D'].forEach((_, k) => R(c, 28, 6 + k * 4, 2, 2, '#f2c230'));
        break;
      case 'ruedas': {
        const rim: Record<string, string> = { acero: '#9aa0a8', aleacion: '#d8dce2', tt: '#6a6e74', sport: '#2a2a33', cromo: '#f4f6f8', race: '#c8a040', oro: '#ffcc33' };
        c.fillStyle = '#14101f';
        c.beginPath();
        c.arc(20, 12, 10, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = rim[part.look] ?? '#9aa0a8';
        c.beginPath();
        c.arc(20, 12, 6, 0, Math.PI * 2);
        c.fill();
        for (let k = 0; k < 5; k++) R(c, 20 + Math.cos(k * 1.25) * 4, 12 + Math.sin(k * 1.25) * 4, 1, 1, '#14101f');
        break;
      }
      case 'interior': {
        const col: Record<string, string> = { tela: '#5a6a8a', skai: '#2a2a33', velour: '#7a2a48', cuero: '#8a5a32', digital: '#2a2a33', madera: '#6a3a1a', lujo: '#e8dcc0' };
        R(c, 12, 3, 8, 15, col[part.look] ?? '#5a6a8a');
        R(c, 12, 16, 16, 5, col[part.look] ?? '#5a6a8a');
        R(c, 13, 4, 2, 13, 'rgba(255,255,255,0.2)');
        if (part.look === 'digital') R(c, 24, 6, 10, 6, '#35d07f');
        break;
      }
      case 'seguridad':
        R(c, 13, 3, 14, 12, q >= 7 ? '#2f6fb3' : '#5a5e64');
        R(c, 15, 15, 10, 3, q >= 7 ? '#2f6fb3' : '#5a5e64');
        R(c, 18, 18, 4, 3, q >= 7 ? '#2f6fb3' : '#5a5e64');
        for (let k = 0; k < Math.ceil(q / 2); k++) R(c, 15 + k * 2.5, 7, 2, 2, '#ffcc33');
        break;
    }
  }, [part.id, d.color]);
  return <canvas ref={ref} width={40} height={24} class="fa-icon" />;
}

/** Fábrica de coches: la nave al fondo, la mesa de planos y el cajón de componentes. */
export function Factory(p: FactoryProps) {
  const [d, setD] = useState<CarDesign>(() => JSON.parse(JSON.stringify(p.lab.draft)));
  const [tab, setTab] = useState<Tab>('carroceria');
  const [mode, setMode] = useState<'plano' | 'pintura'>('plano');
  const [sheet, setSheet] = useState<null | 'launch' | 'models' | 'tests'>(null);
  const [result, setResult] = useState<null | { title: string; text: string; outcome: CarOutcome; causes: Cause[]; cost: number; perDay: number }>(null);
  const [chief] = useState(() => randomPerson(19850455));
  const talk = useTalk(chief);
  const { pops, pop } = usePops();
  const report = useMemo(() => testCar(d, p.day), [d, p.day]);
  const trend = trendOf(p.day, p.seed);
  const level = carMarketLevel(p.day);
  const score = carScore(report, d, trend);
  const body = CAR_PART_BY_ID[d.carroceria];

  useEffect(() => {
    const t = setTimeout(() => p.onSave(d), 400);
    return () => clearTimeout(t);
  }, [d]);
  useEffect(() => {
    const t = setTimeout(() => talk.say(`Alcalde, esta semana manda la «${trend.title.toLowerCase()}». ${trend.text}`, 'normal'), 500);
    const iv = setInterval(() => talk.say(TIPS[Math.floor(Math.random() * TIPS.length)]), 15000);
    return () => {
      clearTimeout(t);
      clearInterval(iv);
    };
  }, []);

  const owned = (key: string) => hasCarItem(p.lab, key);
  const ensure = (key: string, name: string, price: number) => {
    if (owned(key)) return true;
    if (p.money < price) {
      talk.say(`Desarrollar ${name} cuesta ${p.fmt(price)}. No hay presupuesto.`, 'triste');
      play.error();
      return false;
    }
    if (!p.onBuy(key)) return false;
    fx.register();
    pop(`−${p.fmt(price)}`, 50, 60, 'bad');
    talk.say(`¡Listo! Los ingenieros han desarrollado ${name}.`, 'feliz');
    return true;
  };
  const pickPart = (part: CarPart) => {
    if (!ensure(part.id, part.name, part.price)) return;
    fx.chip();
    setD((x) => ({ ...x, [part.kind]: part.id }));
    if (part.kind === 'carroceria' && !part.mid && d.motorPos === 'centro') setD((x) => ({ ...x, carroceria: part.id, motorPos: 'delante' }));
  };
  const toggleExtra = (id: string, name: string, price: number) => {
    const on = d.extras.includes(id);
    if (!on && d.extras.length >= MAX_CAR_EXTRAS) {
      talk.say(`Máximo ${MAX_CAR_EXTRAS} extras: más, y se dispara el precio.`, 'nervios');
      play.error();
      return;
    }
    if (!on && !ensure(`extra:${id}`, name, price)) return;
    fx.pop();
    setD((x) => ({ ...x, extras: on ? x.extras.filter((e) => e !== id) : [...x.extras, id] }));
  };

  const launch = (price: number, mkt: CarMarketingId, run: CarRunId) => {
    const res = p.onLaunch({ ...d }, price, mkt, run);
    if (!res) return;
    setSheet(null);
    const good = res.result.outcome === 'exito' || res.result.outcome === 'bombazo';
    if (good) fx.jackpot();
    else play.bad();
    talk.say(good ? '¡Lo hemos conseguido, alcalde! ¡Toda la ciudad habla de nuestro coche!' : res.result.outcome === 'discreto' ? 'Se vende, pero sin alegría. Hay que mejorarlo.' : 'Un fracaso. Leamos bien por qué y volvamos a los planos.', good ? 'feliz' : 'triste');
    setResult({ ...res.headline, outcome: res.result.outcome, causes: res.result.causes, cost: res.cost, perDay: carIncome(res.model, res.model.launchedDay + 1) });
    setD(JSON.parse(JSON.stringify(res.model.design)));
  };

  const stars = '★'.repeat(report.estrellas) + '☆'.repeat(5 - report.estrellas);
  const active = p.lab.models.filter((m) => !m.retired);
  return (
    <div class="factory">
      <Backdrop draw={factoryHall} w={180} h={320} fps={12} />
      <div class="fa-head">
        <button class="btn small secondary" onClick={p.onClose}>
          ◀ Salir
        </button>
        <div class="fa-title">
          <b>PIXELOPOLIS MOTORS</b>
          <small>
            Día {p.day} · el mercado exige {level}
          </small>
        </div>
        <span class="fa-money">{p.fmt(p.money)}</span>
      </div>
      <div class="fa-trend">
        <b>📈 {trend.title}</b> {trend.text}
      </div>
      <div class="fa-chief">
        <Portrait person={chief} talking={talk.talking} mood={talk.mood} scale={1.7} />
        <Bubble text={talk.line} k={talk.key} side="left" />
      </div>

      <div class="fa-table">
        <div class="fa-paper">
          <div class="fa-paper-head">
            <span>
              PLANO Nº {String(p.lab.models.length + 1).padStart(3, '0')} · {d.name.toUpperCase()} · {body.name.toUpperCase()}
            </span>
            <div class="fa-modes">
              <button class={mode === 'plano' ? 'on' : ''} onClick={() => (setMode('plano'), fx.whoosh())}>
                Plano
              </button>
              <button class={mode === 'pintura' ? 'on' : ''} onClick={() => (setMode('pintura'), fx.whoosh())}>
                Pintura
              </button>
            </div>
          </div>
          <CarCanvas d={d} mode={mode} scale={2.7} />
          <div class="fa-spec">
            <span>⚙ {report.cv} CV</span>
            <span>⏱ 0-100: {report.aceleracion.toFixed(1).replace('.', ',')} s</span>
            <span>🏁 {report.velMax} km/h</span>
            <span>⛽ {report.consumo.toFixed(1).replace('.', ',')} L</span>
            <span class="fa-stars">{stars}</span>
            <span class={report.emisionesOk ? 'ok' : 'bad'}>
              💨 {report.emisiones}/{emissionLimit(p.day)} {report.emisionesOk ? '✔' : '✖'}
            </span>
          </div>
        </div>
        <div class="fa-stats">
          <div class="fa-total">
            Nota como coche {SEGMENT_LABEL[body.segment!]} <b class={score >= level ? 'up' : 'down'}>{score}</b> / mercado {level}
            <div class="fa-meter">
              <i style={{ width: `${score}%` }} class={score >= level ? 'up' : 'down'} />
              <em style={{ left: `${level}%` }} />
            </div>
          </div>
          <div class="fa-bars">
            {(
              [
                ['Potencia', report.potencia, 'potencia'],
                ['Consumo', report.eficiencia, 'eficiencia'],
                ['Seguridad', report.seguridad, 'seguridad'],
                ['Confort', report.confort, 'confort'],
                ['Fiabilidad', report.fiabilidad, 'fiabilidad'],
                ['Diseño', report.diseno, 'diseno'],
                ['Extras', report.extras, 'extras'],
              ] as const
            ).map(([label, v, key]) => (
              <div key={label} class={`fa-bar ${key in trend.boost ? 'hot' : ''}`}>
                <i>
                  <b style={{ height: `${v}%` }} />
                </i>
                <small>{label}</small>
              </div>
            ))}
          </div>
          {report.warnings.slice(0, 2).map((w) => (
            <div key={w} class={`fa-warn ${w.startsWith('+') ? 'good' : ''}`}>
              {w.startsWith('+') ? `✔ ${w.slice(2)}` : `⚠ ${w}`}
            </div>
          ))}
        </div>
      </div>

      <div class="fa-drawer">
        <div class="fa-tabs">
          {TABS.map((tb) => (
            <button key={tb.id} class={tab === tb.id ? 'on' : ''} onClick={() => (setTab(tb.id), fx.pop())}>
              <span>{tb.icon}</span>
              {tb.label}
            </button>
          ))}
        </div>
        <div class="fa-cards">
          {tab === 'pintura' &&
            CAR_COLORS.map((c) => {
              const has = owned(`color:${c.id}`);
              return (
                <button key={c.id} class={`fa-card ${has ? '' : 'locked'} ${d.color === c.id ? 'using' : ''}`} onClick={() => ensure(`color:${c.id}`, `la pintura ${c.name}`, c.price) && (fx.pop(), setD((x) => ({ ...x, color: c.id })))}>
                  <span class="fa-swatch" style={{ background: c.hex }} />
                  <b>{c.name}</b>
                  {!has && <em>{p.fmt(c.price)}</em>}
                </button>
              );
            })}
          {tab === 'extras' &&
            CAR_EXTRAS.map((e) => {
              const has = owned(`extra:${e.id}`);
              return (
                <button key={e.id} class={`fa-card ${has ? '' : 'locked'} ${d.extras.includes(e.id) ? 'using' : ''}`} onClick={() => toggleExtra(e.id, e.name, e.price)}>
                  <span class="fa-emoji">{e.icon}</span>
                  <b>{e.name}</b>
                  <small>+{e.pts} pts</small>
                  {!has && <em>{p.fmt(e.price)}</em>}
                </button>
              );
            })}
          {tab === 'distribucion' && (
            <div class="fa-layout">
              <div>
                <small>Motor</small>
                {(['delante', 'centro', 'detras'] as MotorPos[]).map((m) => (
                  <button key={m} class={d.motorPos === m ? 'on' : ''} onClick={() => (fx.chip(), setD((x) => ({ ...x, motorPos: m })), setMode('plano'))}>
                    {m === 'delante' ? 'Delante' : m === 'centro' ? 'Central' : 'Detrás'}
                  </button>
                ))}
              </div>
              <div>
                <small>Tracción</small>
                {(['delantera', 'trasera', 'total'] as Drive[]).map((m) => (
                  <button key={m} class={d.traccion === m ? 'on' : ''} onClick={() => (fx.chip(), setD((x) => ({ ...x, traccion: m })), setMode('plano'))}>
                    {m === 'delantera' ? 'Delantera' : m === 'trasera' ? 'Trasera' : 'Total 4×4'}
                  </button>
                ))}
              </div>
            </div>
          )}
          {tab !== 'pintura' &&
            tab !== 'extras' &&
            tab !== 'distribucion' &&
            carPartsOf(tab).map((part) => {
              const has = owned(part.id);
              return (
                <button key={part.id} class={`fa-card ${has ? '' : 'locked'} ${d[part.kind] === part.id ? 'using' : ''}`} onClick={() => pickPart(part)}>
                  <PartIcon part={part} d={d} />
                  <b>{part.name}</b>
                  <span class="fa-q">{'★'.repeat(Math.ceil(part.q / 2))}</span>
                  <small>{part.cv ? `${part.cv} CV` : part.segment ? `${SEGMENT_LABEL[part.segment]} · ${part.seats} plazas` : CAR_KIND_LABEL[part.kind]}</small>
                  {!has && <em>{p.fmt(part.price)}</em>}
                </button>
              );
            })}
        </div>
        <div class="fa-actions">
          <button class="btn secondary" onClick={() => (setSheet('tests'), fx.whoosh())}>
            🧪 Pruebas
          </button>
          <button class="btn secondary" onClick={() => setSheet('models')}>
            📦 Modelos {active.length ? `(${active.length})` : ''}
          </button>
          <button class="btn big-cta" onClick={() => setSheet('launch')}>
            🚀 Lanzar
          </button>
        </div>
      </div>

      {sheet === 'tests' && <TestRun d={d} report={report} limit={emissionLimit(p.day)} onClose={() => setSheet(null)} />}
      {sheet === 'launch' && <LaunchSheet d={d} setName={(name) => setD((x) => ({ ...x, name }))} p={p} score={score} level={level} trendTitle={trend.title} onLaunch={launch} onClose={() => setSheet(null)} />}
      {sheet === 'models' && (
        <div class="fa-overlay" onClick={() => setSheet(null)}>
          <div class="fa-sheet" onClick={(e) => e.stopPropagation()}>
            <h3>Modelos de la marca</h3>
            {!p.lab.models.length && <p>Aún no has lanzado ningún coche.</p>}
            {[...p.lab.models].reverse().map((m) => (
              <div key={m.id} class={`fa-model ${m.retired ? 'retired' : ''}`}>
                <div>
                  <b>{m.name}</b>
                  <small>
                    Día {m.launchedDay} · nota {m.score} · {CAR_OUTCOME_LABEL[m.outcome]}
                  </small>
                  <small>
                    {m.retired ? 'Ya no se fabrica' : `Hoy: ${p.fmt(carIncome(m, p.day + 1))}/día`} · total {p.fmt(m.earned)}
                  </small>
                </div>
                <button
                  class="btn small good"
                  onClick={() => {
                    setD(JSON.parse(JSON.stringify(m.design)));
                    setSheet(null);
                    talk.say(`Preparamos el ${m.name.replace(/ \d+$/, '')} ${m.version + 1}. Cambie lo que falló.`, 'feliz');
                  }}
                >
                  Mejorar
                </button>
              </div>
            ))}
            <button class="btn secondary" onClick={() => setSheet(null)}>
              Cerrar
            </button>
          </div>
        </div>
      )}
      {result && (
        <div class="fa-overlay" onClick={() => setResult(null)}>
          <div class="fa-news">
            <div class="paper-head">THE DAILY LEDGER</div>
            <div class="fa-news-sec">MOTOR</div>
            <h3>{result.title}</h3>
            <p>{result.text}</p>
            <div class={`fa-verdict out-${result.outcome}`}>{CAR_OUTCOME_LABEL[result.outcome]}</div>
            <ul class="fa-causes">
              {result.causes.map((c) => (
                <li key={c.text} class={c.good ? 'good' : 'bad'}>
                  {c.good ? '▲' : '▼'} {c.text}
                </li>
              ))}
            </ul>
            <p class="fa-news-foot">
              Lanzarlo costó {p.fmt(result.cost)} · el primer día deja unos <b>{p.fmt(result.perDay)}</b>, y bajando.
            </p>
            <button class="btn">Volver a la fábrica</button>
          </div>
        </div>
      )}
      <PopLayer pops={pops} />
    </div>
  );
}

/** Pruebas: circuito, choque contra el muro y medidor de emisiones. */
function TestRun({ d, report, limit, onClose }: { d: CarDesign; report: ReturnType<typeof testCar>; limit: number; onClose: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [stage, setStage] = useState(0);
  useEffect(() => {
    const c = ref.current?.getContext('2d');
    if (!c) return;
    const W = 160;
    const H = 70;
    const len = carLen(d);
    let raf = 0;
    const t0 = performance.now();
    const dur = [3200, 2600, 2400][stage];
    if (stage === 0) fx.bugle();
    const tick = (now: number) => {
      const k = Math.min(1, (now - t0) / dur);
      const t = (now - t0) / 1000;
      c.clearRect(0, 0, W, H);
      if (stage === 0) {
        // circuito: cielo, gradas y la recta
        R(c, 0, 0, W, H, '#8fc4e8');
        for (let x = 0; x < W; x += 4) R(c, x, 18, 3, 8, ['#c0392b', '#ece8dc', '#2f6fb3'][(x / 4) % 3]);
        R(c, 0, 26, W, 6, '#3a7a3a');
        R(c, 0, 32, W, 30, '#3a3a42');
        for (let x = -((t * 120) % 20); x < W; x += 20) R(c, x, 46, 10, 2, '#ece8dc');
        R(c, 0, 62, W, 8, '#3a7a3a');
        const x = -len + k * (W + len) * 0.6 + 20;
        for (let s = 0; s < 6; s++) R(c, x - 6 - s * 5, 38 + s * 3, 4, 1, 'rgba(255,255,255,0.6)');
        drawCar(c, d, x, 33, 'pintura', t * 3);
        const time = Math.min(report.aceleracion, (k / 0.8) * report.aceleracion);
        R(c, W - 52, 2, 50, 12, '#14101f');
        c.fillStyle = '#7dff6a';
        c.font = '9px monospace';
        c.fillText(`0-100 ${time.toFixed(1)}s`, W - 50, 11);
        if (k > 0.85) {
          R(c, 2, 2, 50, 12, '#14101f');
          c.fillStyle = '#ffcc33';
          c.fillText(`${report.velMax} km/h`, 4, 11);
        }
      } else if (stage === 1) {
        // choque contra el muro con el muñeco de pruebas
        R(c, 0, 0, W, H, '#5a5e68');
        R(c, 0, 50, W, 20, '#3a3a42');
        for (let y = 6; y < 50; y += 6) for (let x = W - 20 + ((y / 6) % 2) * 3; x < W; x += 6) R(c, x, y, 5, 5, '#8a8e94');
        const hit = 0.55;
        const pos = Math.min(k, hit) / hit;
        const x = 6 + pos * (W - 26 - len - 6);
        if (k < hit) drawCar(c, d, x, 26, 'pintura', t * 3);
        else {
          // el morro se arruga según la seguridad
          c.save();
          const crush = 1 - (1 - report.seguridad / 100) * 0.25 - 0.06;
          c.translate(x, 0);
          c.scale(crush, 1);
          drawCar(c, d, 0, 26, 'pintura', 0);
          c.restore();
          if (Math.floor(t * 20) % 2) R(c, W - 22, 30, 4, 18, '#fff2a0');
          const fly = (k - hit) / (1 - hit);
          const dummyX = x + len * 0.55 + fly * (report.seguridad < 50 ? 30 : 6);
          R(c, dummyX, 30 - fly * (report.seguridad < 50 ? 14 : 2), 3, 5, '#f2c230');
          R(c, dummyX, 27 - fly * (report.seguridad < 50 ? 14 : 2), 3, 3, '#f2c230');
          if (fly > 0.3) {
            R(c, 2, 2, 60, 12, '#14101f');
            c.fillStyle = '#ffcc33';
            c.font = '10px monospace';
            c.fillText('★'.repeat(report.estrellas) + '☆'.repeat(5 - report.estrellas), 4, 11);
          }
        }
      } else {
        // emisiones: el coche en el banco y su humo; el medidor
        R(c, 0, 0, W, H, '#2a2e36');
        R(c, 0, 52, W, 18, '#3a3a42');
        drawCar(c, d, 60, 28, 'pintura', t * 8);
        const bad = report.emisiones > limit;
        for (let s = 0; s < 8; s++) {
          const kk = (t * 0.8 + s / 8) % 1;
          const sz = 2 + kk * 6;
          c.fillStyle = bad ? `rgba(30,30,34,${0.7 * (1 - kk)})` : `rgba(220,220,230,${0.4 * (1 - kk)})`;
          c.fillRect(56 - kk * 40, 44 - kk * 20, sz, sz);
        }
        const gx = 30;
        const gy = 26;
        c.strokeStyle = '#ece8dc';
        c.beginPath();
        c.arc(gx, gy, 16, Math.PI, 0);
        c.stroke();
        const a = Math.PI + (Math.min(k * 1.4, 1) * report.emisiones / 10) * Math.PI;
        c.strokeStyle = bad ? '#ff4a5a' : '#7dff6a';
        c.beginPath();
        c.moveTo(gx, gy);
        c.lineTo(gx + Math.cos(a) * 14, gy + Math.sin(a) * 14);
        c.stroke();
        const la = Math.PI + (limit / 10) * Math.PI;
        R(c, gx + Math.cos(la) * 16, gy + Math.sin(la) * 16, 2, 2, '#ffcc33');
      }
      if (k < 1) raf = requestAnimationFrame(tick);
      else if (stage === 1) fx.crowd(0.5);
    };
    raf = requestAnimationFrame(tick);
    if (stage === 1) setTimeout(() => play.bad(), dur * 0.55);
    return () => cancelAnimationFrame(raf);
  }, [stage]);
  const names = ['Circuito', 'Prueba de choque', 'Emisiones'];
  const verdict = [`0 a 100 en ${report.aceleracion.toFixed(1).replace('.', ',')} s · velocidad máxima ${report.velMax} km/h · ${report.consumo.toFixed(1).replace('.', ',')} L/100 km.`, `${report.estrellas} de 5 estrellas de seguridad.`, report.emisionesOk ? `Pasa la ley: ${report.emisiones} de ${limit} permitido.` : `¡Suspende! ${report.emisiones} de ${limit} permitido: multa y mala prensa si lo lanzas así.`];
  return (
    <div class="fa-overlay" onClick={onClose}>
      <div class="fa-sheet" onClick={(e) => e.stopPropagation()}>
        <h3>
          Prueba {stage + 1}/3 · {names[stage]}
        </h3>
        <canvas ref={ref} width={160} height={70} class="fa-test" />
        <p>{verdict[stage]}</p>
        {stage < 2 ? (
          <button class="btn big-cta" onClick={() => setStage(stage + 1)}>
            Siguiente prueba ▶
          </button>
        ) : (
          <button class="btn big-cta" onClick={onClose}>
            Volver a los planos
          </button>
        )}
      </div>
    </div>
  );
}

function LaunchSheet({ d, setName, p, score, level, trendTitle, onLaunch, onClose }: { d: CarDesign; setName: (s: string) => void; p: FactoryProps; score: number; level: number; trendTitle: string; onLaunch: (price: number, mkt: CarMarketingId, run: CarRunId) => void; onClose: () => void }) {
  const r = testCar(d, p.day);
  const fair = carFairPrice(r, score);
  const [price, setPrice] = useState(fair);
  const [mkt, setMkt] = useState<CarMarketingId>('nada');
  const [run, setRun] = useState<CarRunId>('media');
  const cost = carLaunchCost(r, run, mkt);
  const diff = score - level;
  return (
    <div class="fa-overlay" onClick={onClose}>
      <div class="fa-sheet" onClick={(e) => e.stopPropagation()}>
        <h3>Lanzar al mercado</h3>
        <label class="fa-field">
          Nombre del modelo
          <input value={d.name} maxLength={18} onInput={(e) => setName((e.target as HTMLInputElement).value)} />
          <small>Con el nombre de un modelo anterior sale la versión siguiente.</small>
        </label>
        <div class="fa-field">
          Precio: <b>{p.fmt(price)}</b> <small>(justo {p.fmt(fair)} · fabricar uno {p.fmt(r.unitCost)})</small>
          <input type="range" min={r.unitCost + 100} max={fair * 2} step={100} value={price} onInput={(e) => setPrice(Number((e.target as HTMLInputElement).value))} />
        </div>
        <div class="fa-field">
          Campaña
          <div class="fa-opts">
            {CAR_MARKETING.map((m) => (
              <button key={m.id} class={mkt === m.id ? 'on' : ''} onClick={() => (setMkt(m.id), fx.pop())}>
                <b>{m.name}</b>
                <small>{m.cost ? p.fmt(m.cost) : 'Gratis'} · ×{m.mul}</small>
              </button>
            ))}
          </div>
        </div>
        <div class="fa-field">
          Primera tirada
          <div class="fa-opts three">
            {CAR_RUNS.map((x) => (
              <button key={x.id} class={run === x.id ? 'on' : ''} onClick={() => (setRun(x.id), fx.pop())}>
                <b>{x.name}</b>
                <small>{x.units.toLocaleString('es')} coches</small>
              </button>
            ))}
          </div>
        </div>
        <p class="fa-forecast">
          Nota <b>{score}</b> frente a <b>{level}</b> · tendencia: {trendTitle.toLowerCase()}. {diff >= 10 ? 'Los concesionarios lo esperan con ganas.' : diff >= 0 ? 'Puede funcionar.' : diff >= -8 ? 'Va justo.' : 'Llega tarde: la competencia es mejor.'}
          {!r.emisionesOk && ' ⚠ Suspende las emisiones.'}
        </p>
        <p class="fa-forecast">
          Coste: <b>{p.fmt(cost)}</b> · presupuesto {p.fmt(p.money)}
        </p>
        <button class="btn big-cta" disabled={p.money < cost} onClick={() => onLaunch(price, mkt, run)}>
          {p.money < cost ? 'No hay presupuesto' : `Fabricar y lanzar · ${p.fmt(cost)}`}
        </button>
        <button class="btn secondary" onClick={onClose}>
          Seguir con los planos
        </button>
      </div>
    </div>
  );
}
