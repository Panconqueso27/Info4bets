import * as audio from '../platform/audio';
import { lowFx, setLowFx } from '../scene/CityScene';
import { PixelIcon } from './PixelIcon';

const missionsLeft = (s: GameState) => (s.missions?.date === s.today.date ? s.missions.list.filter((m) => !m.done).length : 0);
import { StatsView } from './Extras';
import { Letters, Words } from './AnimText';
import { useEffect, useRef, useState } from 'preact/hooks';
import { EVENTS } from '../core/events/catalog';
import { WEATHER_LABEL } from '../core/weather';
import { shiftPay, todayWeather, canRetire, canStartErrand, canStartShift, dayNumber, ERRAND_PAY, errandHours, marketSession, MINUTES_PER_POINT } from '../core/game';
import { TERM_DAYS } from '../core/events/alcalde';
import { ROLES, type BarDef } from '../core/roles';
import { formatDuration } from '../core/time';
import type { BarId, Bars, GameState, Role } from '../core/types';

/** La fuente de píxeles no tiene mayúsculas con tilde. */
export function caps(s: string): string {
  return s.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function barColor(pct: number, inverted?: boolean): string {
  const v = inverted ? 100 - pct : pct;
  if (v >= 60) return '#35d07f';
  if (v >= 30) return '#ffcc33';
  return '#ff4a5a';
}

function Bar({ def, value, money }: { def: BarDef; value: number; money: (n: number) => string }) {
  const pct = def.moneyScale ? Math.max(0, Math.min(100, (value / def.moneyScale) * 100)) : value;
  const prev = useRef(value);
  const [flash, setFlash] = useState('');
  useEffect(() => {
    if (value === prev.current) return;
    setFlash(value > prev.current ? (def.inverted ? 'flash-down' : 'flash-up') : def.inverted ? 'flash-up' : 'flash-down');
    prev.current = value;
    const t = setTimeout(() => setFlash(''), 1900);
    return () => clearTimeout(t);
  }, [value]);
  return (
    <div class={`bar ${flash}`}>
      <div class="bar-head">
        <span>
          <span class="ic">{def.icon}</span>
          {def.label}
        </span>
        <span>{def.moneyScale ? money(value) : Math.round(value)}</span>
      </div>
      <div class="bar-track">
        <div class="bar-fill" style={{ width: `${pct}%`, background: def.moneyScale ? (value < 0 ? '#ff4a5a' : '#e2b13b') : barColor(pct, def.inverted) }} />
      </div>
    </div>
  );
}

export function Hud({ state, now }: { state: GameState; now: number }) {
  const role = ROLES[state.character.role];
  const time = new Date(now).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
  return (
    <div class="hud">
      <div class="hud-top">
        <div class="hud-name">
          <b>{state.character.name}</b>
          <small>
            {role.title.replace(/^El /, '')} · {state.character.age} años
            {state.character.role === 'alcalde' && ` · mandato ${state.term} (${TERM_DAYS - ((dayNumber(state, now) - 1) % TERM_DAYS)}d)`}
          </small>
        </div>
        <div class="badge day">DÍA {dayNumber(state, now)}</div>
        <div class={`badge streak ${state.streak ? '' : 'off'}`} title="Racha de días yendo a trabajar">
          🔥{state.streak}
        </div>
      </div>
      <div class="bars">
        {role.bars.map((b) => (
          <Bar key={b.id} def={b} value={state.bars[b.id] ?? 0} money={role.formatMoney} />
        ))}
        <div class="clock">
          <span>🕐 {time}</span>
          <span>
            {WEATHER_LABEL[todayWeather(state)].icon} {WEATHER_LABEL[todayWeather(state)].label}
          </span>
        </div>
      </div>
    </div>
  );
}

export function Dock({
  state,
  now,
  onStart,
  onRetire,
  onOpenEvent,
  onPanel,
  onMinigame,
  onErrand,
}: {
  state: GameState;
  now: number;
  onStart: () => void;
  onRetire: () => void;
  onOpenEvent: () => void;
  onPanel: (p: Panel) => void;
  onMinigame: () => void;
  onErrand: () => void;
}) {
  const role = ROLES[state.character.role];
  const shift = state.shift;
  const block = canStartShift(state, now);
  const isImm = state.character.role === 'inmigrante';
  const errandOk = canStartErrand(state, now) === null;
  // Panel compacto: el reparto se ofrece como botón pequeño (lo demás está en 🎯 Extras).
  const errandBtn = errandOk && (
    <button class="btn secondary small-cta" onClick={onErrand}>
      📦 {errandHours(state)}h · +{role.formatMoney(ERRAND_PAY)}
    </button>
  );
  let body;

  if (state.errand) {
    const e = state.errand;
    body = (
      <>
        <div class="status">
          <span>
            {e.kind && e.kind !== 'reparto' ? `${{ radio: '📻', taxi: '🚕', clases: '📚' }[e.kind]} ${e.label}` : '📦 Repartiendo paquetes por la ciudad'} · vuelve en <b>{formatDuration(e.endsAt - now)}</b>
          </span>
        </div>
        <div class="progress errand slim">
          <div style={{ width: `${Math.min(1, (now - e.startedAt) / (e.endsAt - e.startedAt)) * 100}%` }} />
        </div>
      </>
    );
  } else if (shift) {
    const total = shift.endsAt - shift.startedAt;
    const done = Math.min(1, (now - shift.startedAt) / total);
    const ready = canRetire(state, now);
    body = (
      <>
        <div class="status">
          {shift.cancelled ? (
            <span class="warn">⚠ {shift.cancelled}. Hoy no habrá sueldo.</span>
          ) : ready ? (
            <span>✔ Cumpliste las 8 horas. Ya puedes salir y cobrar.</span>
          ) : (
            <span>
              {role.atWork} · faltan <b>{formatDuration(shift.endsAt - now)}</b>
            </span>
          )}
        </div>
        {!shift.cancelled && (
          <div class="progress slim">
            <div style={{ width: `${done * 100}%` }} />
          </div>
        )}
        {ready || shift.cancelled ? (
          <button class={`btn ${ready ? 'good' : ''}`} onClick={onRetire}>
            {shift.cancelled ? 'Volver a casa' : `${role.retire} (+${role.formatMoney(shiftPay(state))})`}
          </button>
        ) : (
          <button class="btn minigame-btn" onClick={onMinigame}>
            {isImm ? '🍽' : '🖋'} Minijuegos <small>−{MINUTES_PER_POINT} min/acierto</small>
          </button>
        )}
      </>
    );
  } else if (block === 'detained') {
    body = (
      <>
        <div class="status">
          <span class="warn">⛓ Detenido. Sales en {formatDuration(state.detainedUntil - now)}.</span>{' '}
          <span class="hint">Tu racha está congelada.</span>
        </div>
        <button class="btn" disabled>
          {role.goToWork}
        </button>
      </>
    );
  } else if (block === 'already-worked') {
    body = (
      <>
        <div class="status">
          <span>✔ Jornada cumplida.</span> <span class="hint">Mira 🎯 Extras para ganar más.</span>
        </div>
        {errandBtn}
      </>
    );
  } else {
    body = (
      <>
        <div class="status">
          <span class="warn">Hoy aún no fuiste {role.toWorkplace}.</span> <span class="hint">Sin ir, pierdes racha y sueldo.</span>
        </div>
        <div class="dock-row">
          <button class="btn" onClick={onStart}>
            {role.goToWork} · 8h
          </button>
          {errandBtn}
        </div>
      </>
    );
  }

  return (
    <div class="dock compact">
      {state.pending.length > 0 && (
        <button class="pending-pill" onClick={onOpenEvent}>
          ⚠ {state.pending.length === 1 ? '1 suceso' : `${state.pending.length} sucesos`}
        </button>
      )}
      {body}
      <div class="dock-tools">
        {TOOLS.filter((t) => !t.role || t.role === state.character.role).map((t) => (
          <button key={t.id + t.label} class={`tool ${t.id === 'bolsa' && marketSession(state, now) ? 'live' : ''}`} onClick={() => onPanel(t.id)}>
            <span class="tool-ic">
              <PixelIcon id={t.icon} size={2} />
              {t.id === 'extras' && missionsLeft(state) > 0 && <i class="tool-badge">{missionsLeft(state)}</i>}
            </span>
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export type Panel = 'bolsa' | 'agenda' | 'mejora' | 'logros' | 'diario' | 'menu' | 'personas' | 'armario' | 'stats' | 'extras' | 'propiedades' | 'copia';

const TOOLS: { id: Panel; icon: string; label: string; role?: Role }[] = [
  { id: 'bolsa', icon: 'grafica', label: 'Bolsa' },
  { id: 'extras', icon: 'diana', label: 'Extras' },
  { id: 'propiedades', icon: 'edificio', label: 'Propiedad' },
  { id: 'agenda', icon: 'agenda', label: 'Agenda' },
  { id: 'mejora', icon: 'flecha', label: 'Mejora' },
  { id: 'logros', icon: 'trofeo', label: 'Logros' },
  { id: 'diario', icon: 'libro', label: 'Diario' },
  { id: 'menu', icon: 'menu', label: 'Menú' },
];

function Deltas({ deltas, state }: { deltas: Bars; state: GameState }) {
  const role = ROLES[state.character.role];
  const entries = Object.entries(deltas) as [BarId, number][];
  if (!entries.length) return null;
  return (
    <div class="deltas">
      {entries.map(([id, d]) => {
        const def = role.bars.find((b) => b.id === id)!;
        const good = def.inverted ? d < 0 : d > 0;
        const val = def.moneyScale ? role.formatMoney(Math.abs(d)) : Math.abs(Math.round(d));
        return (
          <span key={id} class={`delta ${good ? 'up' : 'down'}`}>
            {def.icon} {def.label} {d > 0 ? '+' : '-'}
            {val}
          </span>
        );
      })}
    </div>
  );
}

export function LogModal({ state, onClose }: { state: GameState; onClose: () => void }) {
  return (
    <div class="modal-wrap" onClick={onClose}>
      <div class="modal" onClick={(e) => e.stopPropagation()}>
        <h3><Letters text="Diario" /></h3>
        <ul class="log-list">
          {state.log.map((e, i) => (
            <li key={i} class={e.kind}>
              <span class="meta">
                Día {e.day} · {new Date(e.at).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}
              </span>
              <b>{e.title}</b>
              {e.text}
              {e.deltas && <Deltas deltas={e.deltas} state={state} />}
            </li>
          ))}
        </ul>
        <button class="btn secondary" onClick={onClose}>
          Cerrar
        </button>
      </div>
    </div>
  );
}

export function MenuModal({
  role,
  devEnabled,
  onToggleDev,
  onClose,
  onQuit,
  onOpen,
  onTutorial,
}: {
  role: Role;
  devEnabled: boolean;
  onToggleDev: () => void;
  onClose: () => void;
  onQuit: () => void;
  onOpen: (p: Panel) => void;
  onTutorial: () => void;
}) {
  const [confirm, setConfirm] = useState(false);
  const [sound, setSound] = useState(audio.getPrefs());
  const [low, setLow] = useState(lowFx());
  const toggle = (k: 'sfx' | 'music' | 'ambient') => {
    audio.unlock();
    audio.setPrefs({ [k]: !sound[k] });
    setSound(audio.getPrefs());
  };
  const r = ROLES[role];
  return (
    <div class="modal-wrap" onClick={onClose}>
      <div class="modal" onClick={(e) => e.stopPropagation()}>
        <h3><Letters text="Cómo se juega" /></h3>
        <ul class="help">
          <li>Cada día manda a tu personaje {r.toWorkplace}: son 8 horas reales. Al terminar, sácalo para cobrar.</li>
          <li>Si un día no vas, pierdes la racha 🔥 y el sueldo. Los gastos se cobran igual.</li>
          <li>Durante la jornada llegan sucesos (te avisa una notificación) y puedes apostar en la 📈 Bolsa.</li>
          <li>En la 📋 Agenda tomas decisiones personales; con ⬆ Mejora inviertes tus ahorros.</li>
          <li>☠ {r.loseConditions}</li>
        </ul>
        <div class="menu-grid">
          <button class="btn secondary" onClick={() => onOpen('armario')}>
            👕 Armario
          </button>
          <button class="btn secondary" onClick={() => onOpen('personas')}>
            👥 Personas
          </button>
          <button class="btn secondary" onClick={() => onOpen('stats')}>
            📊 Estadísticas
          </button>
          <button class="btn secondary" onClick={onTutorial}>
            ❓ Ver tutorial
          </button>
          <button class="btn secondary" onClick={() => onOpen('copia')}>
            💾 Copia de seguridad
          </button>
        </div>
        <div class="menu-grid" style={{ marginBottom: 12 }}>
          <button class={`btn secondary ${sound.sfx ? 'on' : ''}`} onClick={() => toggle('sfx')}>
            {sound.sfx ? '🔊 Sonido' : '🔇 Sonido'}
          </button>
          <button class={`btn secondary ${sound.music ? 'on' : ''}`} onClick={() => toggle('music')}>
            {sound.music ? '🎵 Música' : '🔇 Música'}
          </button>
          <button class={`btn secondary ${sound.ambient ? 'on' : ''}`} onClick={() => toggle('ambient')}>
            {sound.ambient ? '🌧 Ambiente' : '🔇 Ambiente'}
          </button>
          <button
            class={`btn secondary ${low ? '' : 'on'}`}
            onClick={() => {
              setLowFx(!low);
              setLow(!low);
            }}
          >
            {low ? '🔋 Ahorro' : '✨ Efectos'}
          </button>
        </div>
        <div class="stack">
          <button class="btn secondary" onClick={onToggleDev}>
            {devEnabled ? '✔ Modo pruebas activado' : 'Activar modo pruebas (acelerar el tiempo)'}
          </button>
          {confirm ? (
            <>
              <p>¿Seguro? Se borrará esta partida para siempre.</p>
              <button class="btn danger" onClick={onQuit}>
                Sí, empezar de cero
              </button>
            </>
          ) : (
            <button class="btn danger" onClick={() => setConfirm(true)}>
              Abandonar partida
            </button>
          )}
          <button class="btn secondary" onClick={onClose}>
            Seguir jugando
          </button>
        </div>
      </div>
    </div>
  );
}

export function GameOverModal({ state, onNew }: { state: GameState; onNew: () => void }) {
  const over = state.gameOver!;
  return (
    <div class="modal-wrap">
      <div class="modal gameover">
        <div class="kicker">FIN DE LA PARTIDA</div>
        <h3><Letters text={over.title} /></h3>
        <p>{over.text}</p>
        <StatsView state={state} now={over.at} />
        <button class="btn" onClick={onNew}>
          Nueva partida
        </button>
      </div>
    </div>
  );
}

export function Toast({ title, text }: { title: string; text: string }) {
  return (
    <div class="toast" key={title + text}>
      <small>{title}</small>
      <Words text={text} delay={80} />
    </div>
  );
}

export function eventNotification(eventId: string) {
  return EVENTS[eventId]?.notification ?? 'Ha ocurrido algo.';
}
