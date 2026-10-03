import { useEffect, useState } from 'preact/hooks';
import { Letters } from './AnimText';
import { MINUTES_PER_POINT } from '../core/game';
import { play } from '../platform/audio';
import { useSwipe } from './useSwipe';

/**
 * Minijuego "Papeleo" (alcalde): 1 minuto despachando documentos.
 * Derecha = APROBAR, izquierda = RECHAZAR. Los documentos fraudulentos
 * esconden una señal (cuñados, efectivo, fechas imposibles, sin firma...).
 * Cada acierto descuenta 10 minutos de la jornada.
 */
const GAME_SECONDS = 60;

interface Doc {
  id: number;
  kind: string;
  company: string;
  amount: string;
  date: string;
  signed: boolean;
  note: string;
  fraud: boolean;
  /** Campo con la señal sospechosa (para resaltarlo tras decidir). */
  flag?: 'company' | 'amount' | 'date' | 'signed' | 'note';
}

const KINDS = ['Permiso de obra', 'Contrato de limpieza', 'Compra de patrullas', 'Licencia de bar', 'Reparación de puente', 'Subvención cultural', 'Alumbrado público', 'Contrato del metro'];
const COMPANIES = ['Hudson Builders', 'Bronx Clean Co.', 'Liberty Supplies', 'Empire Lights', 'Queens Motors', 'Brooklyn Bridge & Sons', 'Manhattan Paving'];
const FRAUD_COMPANIES = ['Hermanos del Alcalde S.A.', 'Tu Cuñado & Asociados', 'Empresa Fantasma Ltd.'];
const NOTES = ['Licitación pública Nº 4471', 'Revisado por intervención', 'Presupuesto aprobado en pleno', 'Tres ofertas comparadas'];
const FRAUD_NOTES = ['Pago en efectivo, sin factura', 'Adjudicado sin licitación', 'Comisión del 30% "por gestión"'];

const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
const money = () => `$${(Math.floor(Math.random() * 90) + 10) * 1000}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.');

function newDoc(id: number): Doc {
  const doc: Doc = {
    id,
    kind: pick(KINDS),
    company: pick(COMPANIES),
    amount: money(),
    date: `${1 + Math.floor(Math.random() * 28)} de ${pick(['marzo', 'abril', 'mayo', 'junio', 'octubre'])} de 1985`,
    signed: true,
    note: pick(NOTES),
    fraud: Math.random() < 0.45,
  };
  if (doc.fraud) {
    const flag = pick(['company', 'amount', 'date', 'signed', 'note'] as const);
    doc.flag = flag;
    if (flag === 'company') doc.company = pick(FRAUD_COMPANIES);
    if (flag === 'amount') doc.amount = pick(['$9.999.999', '$12.000.000', '$7.777.777']);
    if (flag === 'date') doc.date = pick(['31 de febrero de 1985', '30 de febrero de 1985', '32 de enero de 1985']);
    if (flag === 'signed') doc.signed = false;
    if (flag === 'note') doc.note = pick(FRAUD_NOTES);
  }
  return doc;
}

type Phase = 'intro' | 'play' | 'end';

export function Paperwork({ onFinish, onClose }: { onFinish: (points: number) => void; onClose: () => void }) {
  const [phase, setPhase] = useState<Phase>('intro');
  const [doc, setDoc] = useState(() => newDoc(1));
  const [score, setScore] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [left, setLeft] = useState(GAME_SECONDS);
  const [stamp, setStamp] = useState<null | { approve: boolean; ok: boolean }>(null);

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

  const decide = (approve: boolean) => {
    if (phase !== 'play' || stamp) return;
    const ok = approve !== doc.fraud;
    play.stamp();
    if (ok) {
      setScore((s) => s + 1);
      setTimeout(() => play.coin(), 120);
    } else {
      setMistakes((m) => m + 1);
      setTimeout(() => play.error(), 120);
    }
    setStamp({ approve, ok });
    setTimeout(
      () => {
        setStamp(null);
        setDoc(newDoc(doc.id + 1));
      },
      ok ? 380 : 900,
    );
  };

  const { drag, hint, handlers } = useSwipe({ allowUp: false, onRelease: (d) => d && decide(d === 'right') });
  const flagged = (f: Doc['flag']) => (stamp && !stamp.ok && doc.flag === f ? 'flagged' : '');

  return (
    <div class="minigame desk">
      <div class="mg-head">
        <span class="mg-title">PAPELEO</span>
        <span class={`mg-timer ${left <= 10 ? 'hot' : ''}`}>⏱ {left}s</span>
        <span class="mg-score">
          ✔ {score} · −{score * MINUTES_PER_POINT} min
        </span>
      </div>
      <div class="desk-area">
        <div class="desk-hint left" style={{ opacity: hint === 'left' ? 1 : 0.35 }}>
          ✖ RECHAZAR
        </div>
        <div class="desk-hint right" style={{ opacity: hint === 'right' ? 1 : 0.35 }}>
          APROBAR ✔
        </div>
        <div
          class="paper"
          key={doc.id}
          style={{ transform: `translate(${drag.dx}px, 0) rotate(${drag.dx / 18}deg)`, transition: drag.active ? 'none' : 'transform 0.2s' }}
          {...handlers}
        >
          <div class="paper-top">
            <span>CITY OF NEW YORK</span>
            <span>Nº {String(1000 + doc.id * 37).slice(-4)}</span>
          </div>
          <div class="paper-kind">{doc.kind}</div>
          <dl>
            <dt>Empresa</dt>
            <dd class={flagged('company')}>{doc.company}</dd>
            <dt>Importe</dt>
            <dd class={flagged('amount')}>{doc.amount}</dd>
            <dt>Fecha</dt>
            <dd class={flagged('date')}>{doc.date}</dd>
            <dt>Nota</dt>
            <dd class={flagged('note')}>{doc.note}</dd>
          </dl>
          <div class={`sign ${flagged('signed')}`}>
            Firma del interventor: <span class="sig">{doc.signed ? 'J. Morrison' : '________'}</span>
          </div>
          {stamp && <div class={`paper-stamp ${stamp.approve ? 'ok' : 'no'}`}>{stamp.approve ? 'APROBADO' : 'RECHAZADO'}</div>}
          {stamp && !stamp.ok && <div class="paper-wrong">{doc.fraud ? '¡Era un fraude!' : 'Era legítimo'}</div>}
        </div>
      </div>
      <div class="desk-buttons">
        <button class="trade-btn sell" onClick={() => decide(false)}>
          ✖ RECHAZAR
        </button>
        <button class="trade-btn buy" onClick={() => decide(true)}>
          APROBAR ✔
        </button>
      </div>
      {phase === 'intro' && (
        <div class="mg-overlay">
          <h3><Letters text="Despacho del alcalde" /></h3>
          <p>
            Aprueba los documentos legítimos (desliza a la <b>derecha</b>) y rechaza los fraudulentos (a la <b>izquierda</b>). Busca cuñados,
            pagos en efectivo, fechas imposibles o firmas que faltan.
            <br />
            Cada acierto descuenta <b>{MINUTES_PER_POINT} minutos</b> de tu jornada.
          </p>
          <button class="btn big-cta" onClick={() => setPhase('play')}>
            Empezar
          </button>
          <button class="btn secondary" onClick={onClose}>
            Ahora no
          </button>
        </div>
      )}
      {phase === 'end' && (
        <div class="mg-overlay">
          <h3><Letters text="¡Tiempo!" /></h3>
          <div class="mg-big">{score}</div>
          <p>
            documentos bien despachados ({mistakes} errores) · tu jornada se acorta <b>{score * MINUTES_PER_POINT} minutos</b>
          </p>
          <button class="btn big-cta" onClick={() => onFinish(score)}>
            Volver al despacho
          </button>
        </div>
      )}
    </div>
  );
}
