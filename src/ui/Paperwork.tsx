import { useEffect, useRef, useState } from 'preact/hooks';
import { Letters } from './AnimText';
import { MINUTES_PER_POINT } from '../core/game';
import { fx, play } from '../platform/audio';
import { randomPerson, type Mood } from '../art/portrait';
import { Backdrop, Bubble, Portrait, PopLayer, R, usePops, useShake, useTalk } from './games/stage';
import './paperwork.css';

/**
 * Minijuego "Papeleo" (alcalde), al estilo de un puesto de control:
 * cada expediente trae un documento y la ficha del registro municipal. Con
 * el escáner de huellas, la lámpara ultravioleta y el reglamento hay que
 * decidir si se APRUEBA o se RECHAZA (y por qué). Cada pocos expedientes
 * entra en vigor una norma nueva. Los errores traen citaciones.
 */
const GAME_SECONDS = 90;
/** Citaciones que se perdonan antes de restar puntos. */
const FREE_CITATIONS = 2;

type Flaw = 'empresa' | 'huella' | 'fecha' | 'agua' | 'caducada' | 'firmas';

const REASONS: { id: Flaw; label: string }[] = [
  { id: 'empresa', label: 'Empresa / licencia' },
  { id: 'huella', label: 'Huella' },
  { id: 'agua', label: 'Marca de agua' },
  { id: 'caducada', label: 'Licencia caducada' },
  { id: 'firmas', label: 'Faltan firmas' },
  { id: 'fecha', label: 'Fecha imposible' },
];

const FLAW_TEXT: Record<Flaw, string> = {
  empresa: 'La empresa o el nº de licencia no coinciden con el registro.',
  huella: 'La huella del documento no era la del registro.',
  fecha: 'La fecha del documento no existe.',
  agua: 'No tenía la marca de agua del Ayuntamiento.',
  caducada: 'La licencia de la empresa estaba caducada.',
  firmas: 'Más de $500.000 con una sola firma.',
};

// ---------------------------------------------------------------------------
// El solicitante, al otro lado del cristal: habla mientras revisas
// ---------------------------------------------------------------------------

const GREET = [
  'Buenos días, alcalde. Vengo por lo del {kind}.',
  'Traigo todos los papeles en regla, se lo juro.',
  'Uf, qué cola. Llevo dos horas esperando.',
  'Hola, hola. Esto será un momento, ¿verdad?',
  'Me manda {company}. Es por el {kind}.',
  'Buenas. Mi jefe dice que esto es puro trámite.',
];
/** Charla para distraer (dé igual si el expediente está bien o no). */
const CHAT = [
  '¿Hace calor aquí o soy yo?',
  'Mi empresa lleva veinte años en Nueva York.',
  'Tengo una reunión en diez minutos, ¿sabe?',
  '¿Ese cuadro de la pared es un Warhol?',
  'Mi madre le votó. Dos veces, creo.',
  'Bonita corbata, alcalde. Muy elegante.',
  '¿Ha visto el partido de los Yankees?',
  'La ciudad está preciosa este año, de verdad.',
  'Si quiere le traigo un café, invito yo.',
  '¿Le queda mucho? Tengo el coche en doble fila.',
  'Mi hijo quiere ser alcalde como usted.',
  'Esto antes se hacía con un apretón de manos.',
];
/** Mentiras y presiones: salen más cuando el expediente tiene trampa. */
const LIES: Record<Flaw | 'any', string[]> = {
  empresa: ['La empresa cambió de nombre, es la misma.', 'Esa licencia es la nueva, la del registro está vieja.', 'Una letra arriba o abajo, ¿qué más da?'],
  huella: ['La huella es mía. Ayer me corté el dedo.', 'Esa máquina siempre falla, todo el mundo lo dice.', 'Firmó mi hermano, pero somos gemelos.'],
  fecha: ['La fecha está bien, mi calendario es diferente.', '¿Febrero no tiene treinta y uno este año?', 'Es una errata de la mecanógrafa, nada más.'],
  agua: ['La marca de agua se borró con la lluvia.', 'Es una copia, el original lo tiene mi abogado.', 'Esos papeles son los modernos, no llevan marca.'],
  caducada: ['La licencia la renovamos la semana pasada.', 'Caducada, caducada… solo un poquito.', 'El papel nuevo está en el correo, palabra.'],
  firmas: ['El tesorero firma mañana sin falta.', 'Con una firma basta, siempre se ha hecho así.', 'El tesorero está de vacaciones, pero está de acuerdo.'],
  any: ['Mi primo es concejal, ¿sabe usted?', 'Si lo aprueba hay un jamón para usted. Del bueno.', 'Le conviene firmarlo, se lo digo por su bien.', 'Mi abogado está esperando fuera…', 'Yo no he venido nunca aquí, ¿eh?'],
};
const THANKS = ['¡Gracias, alcalde! Le debo una.', '¡Perfecto! Se lo diré a todo el barrio.', 'Sabía que era usted un hombre de ley.', '¡Estupendo! Que tenga buen día.'];
const ANGRY = ['¡Esto es un escándalo! ¡Llamaré a la prensa!', '¡Volveré con mi abogado!', 'Usted no sabe con quién está hablando.', '¡Pues no le voto más!'];
const CAUGHT = ['Vaya… me ha pillado.', 'Ejem… ya me iba.', 'Era una broma, alcalde. Una broma.', '¡Maldita sea!'];
const GLOAT = ['Je, je… gracias, alcalde.', 'Ha sido un placer hacer negocios.', 'Nadie tiene por qué enterarse.'];

const fill = (t: string, c: { kind: string; company: string }) => t.replace('{kind}', c.kind.toLowerCase()).replace('{company}', c.company);
const one = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

/** El pasillo de la ventanilla, al otro lado del cristal: luces, cola y reloj. */
function corridor(ctx: CanvasRenderingContext2D, t: number, w: number, h: number) {
  // pared del pasillo con zócalo de madera y una lámpara que parpadea un poco
  const flick = 0.93 + Math.sin(t * 7) * 0.02 + (Math.sin(t * 31) > 0.97 ? -0.15 : 0);
  R(ctx, 0, 0, w, h, '#4a5a52');
  for (let x = 0; x < w; x += 6) R(ctx, x, 0, 1, h * 0.62, 'rgba(0,0,0,0.06)');
  R(ctx, 0, h * 0.62, w, h * 0.38, '#5a3a24');
  for (let x = 0; x < w; x += 14) R(ctx, x, h * 0.62, 1, h * 0.38, '#3a2414');
  R(ctx, 0, h * 0.62, w, 2, '#7a5232');
  // cola de gente esperando (siluetas lejanas)
  for (let i = 0; i < 5; i++) {
    const x = 12 + i * 34 + Math.sin(t * 0.7 + i) * 1.5;
    R(ctx, x, h * 0.36, 10, h * 0.5, 'rgba(25,30,30,0.55)');
    R(ctx, x + 2, h * 0.27, 6, 7, 'rgba(25,30,30,0.55)');
  }
  // reloj de pared
  const cx = w - 26;
  const cy = 16;
  ctx.fillStyle = '#e8e4d8';
  ctx.beginPath();
  ctx.arc(cx, cy, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#2a2a33';
  ctx.lineWidth = 1;
  ctx.stroke();
  const a = t * 0.8;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.sin(a) * 7, cy - Math.cos(a) * 7);
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.sin(a / 12) * 5, cy - Math.cos(a / 12) * 5);
  ctx.stroke();
  // cartel "TURNO" con número
  R(ctx, 8, 6, 40, 14, '#14101f');
  ctx.fillStyle = '#ff5a4a';
  ctx.font = '9px monospace';
  ctx.fillText(`TURNO ${String(40 + Math.floor(t / 9)).padStart(3, '0')}`, 11, 16);
  // luz cálida del techo
  const g = ctx.createRadialGradient(w / 2, 0, 4, w / 2, 0, h * 1.1);
  g.addColorStop(0, `rgba(255,236,190,${0.35 * flick})`);
  g.addColorStop(1, 'rgba(0,0,0,0.35)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

/** Normas del reglamento: entran en vigor según los expedientes despachados. */
const RULES: { from: number; flaw: Flaw; text: string }[] = [
  { from: 0, flaw: 'empresa', text: 'La empresa y el nº de licencia deben coincidir con la ficha del registro.' },
  { from: 0, flaw: 'huella', text: 'La huella del solicitante debe coincidir con la del registro. Usa el escáner.' },
  { from: 0, flaw: 'fecha', text: 'Rechaza documentos con fechas que no existen.' },
  { from: 3, flaw: 'agua', text: 'Los documentos auténticos llevan la marca de agua del Ayuntamiento (lámpara UV).' },
  { from: 6, flaw: 'caducada', text: 'Rechaza si la licencia de la empresa caducó antes de hoy.' },
  { from: 9, flaw: 'firmas', text: 'Más de $500.000 necesita DOS firmas: interventor y tesorero.' },
];

const KINDS = ['Permiso de obra', 'Contrato de limpieza', 'Compra de patrullas', 'Licencia de bar', 'Reparación de puente', 'Subvención cultural', 'Alumbrado público', 'Contrato del metro', 'Recogida de basuras', 'Asfaltado de avenida'];
const COMPANIES = ['Hudson Builders', 'Bronx Clean Co.', 'Liberty Supplies', 'Empire Lights', 'Queens Motors', 'Brooklyn Bridge & Sons', 'Manhattan Paving', 'Harlem Glass', 'Staten Freight', 'Atlas Concrete'];
const PEOPLE = ['F. Delgado', 'M. O’Brien', 'S. Goldberg', 'L. Moretti', 'J. Washington', 'R. Kowalski', 'A. Chen', 'T. Murphy', 'E. Rossi', 'D. Novak'];
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const DAYS_IN = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

const rnd = (n: number) => Math.floor(Math.random() * n);
const pick = <T,>(a: T[]) => a[rnd(a.length)];
const fmtDate = (d: number, m: number, y = 1985) => `${d} de ${MONTHS[m]} de ${y}`;
const money = (n: number) => `$${n.toLocaleString('es').replace(/,/g, '.')}`;

/** Erratas sutiles: una letra cambiada o dos intercambiadas. */
function misspell(s: string): string {
  const letters = [...s];
  const idx = letters.map((c, i) => (/[a-z]/.test(c) ? i : -1)).filter((i) => i > 0);
  const i = pick(idx);
  if (Math.random() < 0.5 && i + 1 < letters.length && /[a-z]/.test(letters[i + 1])) [letters[i], letters[i + 1]] = [letters[i + 1], letters[i]];
  else letters[i] = letters[i] === 'e' ? 'a' : letters[i] === 'o' ? 'u' : letters[i] === 'n' ? 'm' : 'e';
  const out = letters.join('');
  return out === s ? s.replace(/s\b/, 'z') : out;
}

interface Case {
  id: number;
  kind: string;
  person: string;
  company: string;
  license: string;
  amount: number;
  date: string;
  signatures: number;
  watermark: boolean;
  print: number;
  reg: { company: string; license: string; print: number; expiry: string; expired: boolean; person: string };
  flaw: Flaw | null;
}

function newCase(id: number, today: { d: number; m: number }, done: number): Case {
  const company = pick(COMPANIES);
  const license = `NY-${1000 + rnd(9000)}`;
  const print = 1 + rnd(1e6);
  const person = pick(PEOPLE);
  const big = Math.random() < 0.35;
  const amount = big ? (510 + rnd(450)) * 1000 : (10 + rnd(480)) * 1000;
  const m = rnd(today.m + 1);
  const d = 1 + rnd(m === today.m ? today.d : DAYS_IN[m]);
  const ey = 1985 + 1 + rnd(2);
  const c: Case = {
    id,
    kind: pick(KINDS),
    person,
    company,
    license,
    amount,
    date: fmtDate(d, m),
    signatures: amount > 500_000 ? 2 : 1 + rnd(2),
    watermark: true,
    print,
    reg: { company, license, print, expiry: fmtDate(1 + rnd(28), rnd(12), ey), expired: false, person },
    flaw: null,
  };
  if (Math.random() < 0.5) {
    const active = RULES.filter((r) => r.from <= done).map((r) => r.flaw);
    const flaw = pick(active);
    c.flaw = flaw;
    if (flaw === 'empresa') {
      if (Math.random() < 0.5) c.company = misspell(company);
      else c.license = `NY-${(Number(license.slice(3)) + 1 + rnd(8)) % 9000 + 1000}`;
    }
    if (flaw === 'huella') c.print = print + 7 + rnd(1000);
    if (flaw === 'fecha') c.date = pick(['31 de febrero de 1985', '30 de febrero de 1985', '31 de abril de 1985', '31 de junio de 1985', '31 de septiembre de 1985']);
    if (flaw === 'agua') c.watermark = false;
    if (flaw === 'caducada') {
      const em = rnd(today.m + 1);
      c.reg.expiry = fmtDate(1 + rnd(em === today.m ? Math.max(1, today.d - 1) : 28), em);
      c.reg.expired = true;
    }
    if (flaw === 'firmas') {
      c.amount = (510 + rnd(450)) * 1000;
      c.signatures = 1;
    }
  }
  return c;
}

/** Huella dactilar dibujada a partir de una semilla (las falsas se parecen, pero no son iguales). */
function Fingerprint({ seed, size = 54, scan = false }: { seed: number; size?: number; scan?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const k = 2;
    c.width = size * k;
    c.height = size * k;
    const ctx = c.getContext('2d')!;
    ctx.scale(k, k);
    let s = seed;
    const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    ctx.clearRect(0, 0, size, size);
    ctx.strokeStyle = scan ? '#7dff9a' : '#2a2050';
    ctx.lineWidth = 1.2;
    const cx = size / 2 + (r() - 0.5) * 6;
    const cy = size / 2 + (r() - 0.5) * 6;
    const tilt = (r() - 0.5) * 0.8;
    const whorl = r() < 0.5;
    for (let i = 1; i < 11; i++) {
      const rx = i * (size / 26) * (1 + r() * 0.08);
      const ry = rx * (whorl ? 1.25 : 1.6);
      const gap = r() * Math.PI * 2;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, tilt, gap, gap + Math.PI * (1.55 + r() * 0.35));
      ctx.stroke();
    }
    // rasgos únicos: islas y bifurcaciones
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      ctx.arc(size * (0.2 + r() * 0.6), size * (0.2 + r() * 0.6), 1 + r() * 2, 0, Math.PI * (1 + r()));
      ctx.stroke();
    }
  }, [seed, size, scan]);
  return <canvas ref={ref} class="fingerprint" style={{ width: size, height: size }} />;
}

type Phase = 'intro' | 'play' | 'end';

export function Paperwork({ onFinish, onClose }: { onFinish: (points: number) => void; onClose: () => void }) {
  const [phase, setPhase] = useState<Phase>('intro');
  const [today] = useState(() => ({ d: 5 + rnd(20), m: 3 + rnd(7) }));
  const [done, setDone] = useState(0);
  const [cs, setCs] = useState(() => newCase(1, today, 0));
  const [score, setScore] = useState(0);
  const [citations, setCitations] = useState(0);
  const [left, setLeft] = useState(GAME_SECONDS);
  const [uv, setUv] = useState(false);
  const [scan, setScan] = useState<null | 'running' | 'match' | 'nomatch'>(null);
  const [rules, setRules] = useState(false);
  const [newRule, setNewRule] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [stamp, setStamp] = useState<null | { approve: boolean; ok: boolean; bonus: boolean; why?: string }>(null);
  const scanTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // el solicitante: entra, habla, reacciona al sello y se va
  const [person, setPerson] = useState(() => randomPerson());
  const csRef = useRef(cs);
  const stampRef = useRef(false);
  const [at, setAt] = useState<'in' | 'out' | 'gone'>('gone');
  const talk = useTalk(person);
  const nextLine = useRef(0);
  const { pops, pop } = usePops();
  const shaker = useShake();

  useEffect(() => {
    if (phase !== 'play') return;
    const started = Date.now();
    const id = setInterval(() => {
      const l = Math.max(0, GAME_SECONDS - Math.floor((Date.now() - started) / 1000));
      setLeft(l);
      if (l === 0) {
        clearInterval(id);
        setPhase('end');
        play.achievement();
      }
    }, 200);
    return () => clearInterval(id);
  }, [phase]);
  useEffect(() => () => void (scanTimer.current && clearTimeout(scanTimer.current)), []);

  // Cada expediente trae a alguien nuevo a la ventanilla.
  useEffect(() => {
    if (phase !== 'play') return;
    setAt('gone');
    const p = randomPerson();
    setPerson(p);
    const t1 = setTimeout(() => {
      setAt('in');
      fx.bell();
    }, 120);
    const t2 = setTimeout(() => {
      const mood: Mood = cs.flaw && Math.random() < 0.5 ? 'nervios' : 'normal';
      talk.say(fill(one(GREET), cs), mood);
      nextLine.current = Date.now() + 3500 + Math.random() * 2500;
    }, 650);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [cs.id, phase]);

  // Mientras revisas, habla: charla, excusas y alguna presión.
  useEffect(() => {
    if (phase !== 'play') return;
    const id = setInterval(() => {
      if (stampRef.current || Date.now() < nextLine.current) return;
      nextLine.current = Date.now() + 4500 + Math.random() * 3500;
      const c = csRef.current;
      const lie = c.flaw && Math.random() < 0.55;
      if (lie) talk.say(one(Math.random() < 0.7 ? LIES[c.flaw!] : LIES.any), 'nervios');
      else if (Math.random() < 0.18) talk.say(one(LIES.any), 'normal');
      else talk.say(one(CHAT), Math.random() < 0.3 ? 'feliz' : 'normal');
    }, 400);
    return () => clearInterval(id);
  }, [phase]);

  const runScan = () => {
    if (scan === 'running' || stamp) return;
    play.click();
    setScan('running');
    scanTimer.current = setTimeout(() => {
      const match = cs.print === cs.reg.print;
      setScan(match ? 'match' : 'nomatch');
      if (match) play.good();
      else play.error();
    }, 900);
  };

  const next = () => {
    const n = done + 1;
    setDone(n);
    const unlocked = RULES.find((r) => r.from === n);
    if (unlocked) {
      setNewRule(unlocked.text);
      play.achievement();
    }
    setCs(newCase(cs.id + 1, today, n));
    setUv(false);
    setScan(null);
    setStamp(null);
    setRejecting(false);
  };

  const decide = (approve: boolean, reason?: Flaw) => {
    if (phase !== 'play' || stamp) return;
    const ok = approve === !cs.flaw;
    const bonus = !approve && ok && reason === cs.flaw;
    play.stamp();
    if (ok) {
      setScore((s) => s + 1 + (bonus ? 1 : 0));
      setTimeout(() => play.coin(), 120);
    } else {
      const c = citations + 1;
      setCitations(c);
      if (c > FREE_CITATIONS) setScore((s) => Math.max(0, s - 1));
      setTimeout(() => play.error(), 120);
    }
    setRejecting(false);
    // la reacción del solicitante
    if (approve && !cs.flaw) talk.say(one(THANKS), 'feliz');
    else if (approve && cs.flaw) talk.say(one(GLOAT), 'feliz');
    else if (!approve && cs.flaw) talk.say(one(CAUGHT), 'triste');
    else talk.say(one(ANGRY), 'enfado');
    if (ok) pop(bonus ? '+2' : '+1', 50, 40, bonus ? 'gold' : 'good');
    else {
      pop('CITACIÓN', 50, 40, 'bad');
      shaker.shake();
    }
    setTimeout(() => setAt('out'), ok ? 300 : 1100);
    setStamp({ approve, ok, bonus, why: !ok ? (cs.flaw ? FLAW_TEXT[cs.flaw] : 'El expediente estaba en regla.') : undefined });
    setTimeout(next, ok ? (bonus ? 700 : 450) : 1600);
  };

  const active = RULES.filter((r) => r.from <= done);
  csRef.current = cs;
  stampRef.current = !!stamp;

  return (
    <div class={`minigame desk papers ${shaker.cls}`}>
      <div class="mg-head">
        <span class="mg-title">PAPELEO</span>
        <span class={`mg-timer ${left <= 10 ? 'hot' : ''}`}>⏱ {left}s</span>
        <span class="mg-score">
          ✔ {score} · −{score * MINUTES_PER_POINT} min
        </span>
      </div>
      <div class="papers-bar">
        <span>📅 Hoy: {fmtDate(today.d, today.m)}</span>
        <span class={`cites ${citations > FREE_CITATIONS ? 'hot' : ''}`}>📄 Citaciones {citations}/{FREE_CITATIONS}</span>
      </div>
      <div class="booth">
        <Backdrop draw={corridor} w={180} h={90} fps={10} class="booth-bg" />
        <div class={`booth-person ${at}`}>
          <Portrait person={person} talking={talk.talking} mood={talk.mood} silhouette="#16121f" scale={4.2} />
        </div>
        <div class="booth-glass" />
        <div class="booth-frame">
          <span class="booth-sign">VENTANILLA 3 · ALCALDÍA</span>
          <span class="booth-grille" />
        </div>
        {at !== 'gone' && <Bubble text={talk.line} k={talk.key} side="left" class="booth-bubble" />}
        <div class="booth-slot" />
      </div>
      <div class="papers-desk">
        <div class={`paper doc ${uv ? 'uv' : ''}`} key={cs.id}>
          <div class="paper-top">
            <span>CITY OF NEW YORK</span>
            <span>Nº {String(1000 + cs.id * 37).slice(-4)}</span>
          </div>
          <div class="paper-kind">{cs.kind}</div>
          <dl>
            <dt>Solicitante</dt>
            <dd>{cs.person}</dd>
            <dt>Empresa</dt>
            <dd>{cs.company}</dd>
            <dt>Licencia</dt>
            <dd>{cs.license}</dd>
            <dt>Importe</dt>
            <dd class={cs.amount > 500_000 ? 'big' : ''}>{money(cs.amount)}</dd>
            <dt>Fecha</dt>
            <dd>{cs.date}</dd>
          </dl>
          <div class="doc-foot">
            <div class="sigs">
              <span>
                Interventor: <i class="sig">J. Morrison</i>
              </span>
              <span>
                Tesorero: <i class="sig">{cs.signatures > 1 ? 'R. Banks' : '________'}</i>
              </span>
            </div>
            <div class={`print-box ${scan === 'running' ? 'scanning' : ''}`}>
              <Fingerprint seed={cs.print} size={50} scan={scan === 'running'} />
              <small>huella</small>
            </div>
          </div>
          {uv && <div class={`uv-mark ${cs.watermark ? '' : 'none'}`}>{cs.watermark ? 'NYC ★ CITY HALL ★ NYC ★ CITY HALL ★ NYC ★ CITY HALL ★' : 'SIN MARCA'}</div>}
          {stamp && <div class={`paper-stamp ${stamp.approve ? 'ok' : 'no'}`}>{stamp.approve ? 'APROBADO' : 'RECHAZADO'}</div>}
          {stamp?.bonus && <div class="paper-bonus">¡Bien visto! +1</div>}
        </div>
        <div class="registry">
          <div class="reg-head">REGISTRO MUNICIPAL</div>
          <div class="reg-body">
            <div>
              <b>{cs.reg.company}</b>
              <small>Licencia {cs.reg.license}</small>
              <small>Rep.: {cs.reg.person}</small>
              <small>Válida hasta {cs.reg.expiry}</small>
            </div>
            <div class="print-box">
              <Fingerprint seed={cs.reg.print} size={42} />
            </div>
          </div>
        </div>
      </div>
      {scan && scan !== 'running' && <div class={`scan-result ${scan}`}>{scan === 'match' ? '✔ HUELLAS COINCIDEN · 97%' : '✖ HUELLAS NO COINCIDEN · 41%'}</div>}
      <div class="papers-tools">
        <button class={`tool-btn ${scan ? 'used' : ''}`} onClick={runScan}>
          🔍 Escáner
        </button>
        <button
          class={`tool-btn ${uv ? 'on' : ''}`}
          onClick={() => {
            play.click();
            setUv(!uv);
          }}
        >
          🟣 Lámpara UV
        </button>
        <button class="tool-btn" onClick={() => setRules(true)}>
          📕 Normas <small>{active.length}</small>
        </button>
      </div>
      {rejecting ? (
        <div class="reject-reasons">
          <small>¿Por qué lo rechazas? (acertar el motivo da +1)</small>
          <div>
            {REASONS.filter((r) => active.some((a) => a.flaw === r.id)).map((r) => (
              <button key={r.id} onClick={() => decide(false, r.id)}>
                {r.label}
              </button>
            ))}
            <button class="cancel" onClick={() => setRejecting(false)}>
              Volver
            </button>
          </div>
        </div>
      ) : (
        <div class="desk-buttons">
          <button class="trade-btn sell" onClick={() => !stamp && setRejecting(true)}>
            ✖ RECHAZAR
          </button>
          <button class="trade-btn buy" onClick={() => decide(true)}>
            APROBAR ✔
          </button>
        </div>
      )}
      {stamp && !stamp.ok && (
        <div class="citation">
          <b>CITACIÓN</b>
          <span>{stamp.why}</span>
          {citations > FREE_CITATIONS && <small>−1 punto</small>}
        </div>
      )}
      <PopLayer pops={pops} />
      {rules && (
        <div class="mg-overlay rulebook" onClick={() => setRules(false)}>
          <h3>Reglamento</h3>
          <ol>
            {active.map((r) => (
              <li key={r.flaw}>{r.text}</li>
            ))}
          </ol>
          <button class="btn">Cerrar</button>
        </div>
      )}
      {newRule && phase === 'play' && (
        <div class="mg-overlay rulebook" onClick={() => setNewRule(null)}>
          <div class="kicker">NUEVA NORMA EN VIGOR</div>
          <p>{newRule}</p>
          <button class="btn">Entendido</button>
        </div>
      )}
      {phase === 'intro' && (
        <div class="mg-overlay">
          <h3>
            <Letters text="Despacho del alcalde" />
          </h3>
          <p>
            Revisa cada expediente con la ficha del <b>registro</b>: empresa, licencia y huella (usa el <b>escáner</b>). Más adelante entran normas nuevas:
            marca de agua (<b>lámpara UV</b>), licencias caducadas y dobles firmas.
            <br />
            Al rechazar, di el motivo: si aciertas, <b>+1</b>. Cada error es una <b>citación</b>; a partir de la tercera, restan.
            <br />
            Cada punto descuenta <b>{MINUTES_PER_POINT} minutos</b> de tu jornada.
          </p>
          <button class="btn big-cta" onClick={() => setPhase('play')}>
            Abrir el despacho
          </button>
          <button class="btn secondary" onClick={onClose}>
            Ahora no
          </button>
        </div>
      )}
      {phase === 'end' && (
        <div class="mg-overlay">
          <h3>
            <Letters text="¡Fin de la ventanilla!" />
          </h3>
          <div class="mg-big">{score}</div>
          <p>
            puntos · {done} expedientes · {citations} citaciones · tu jornada se acorta <b>{score * MINUTES_PER_POINT} minutos</b>
          </p>
          <button class="btn big-cta" onClick={() => onFinish(score)}>
            Volver al despacho
          </button>
        </div>
      )}
    </div>
  );
}
