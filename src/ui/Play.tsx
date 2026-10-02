import { useEffect, useRef, useState } from 'preact/hooks';
import { EVENTS } from '../core/events/catalog';
import { canRetire, canStartShift, dayNumber, viewEvent, type ResolvedOutcome } from '../core/game';
import { ROLES, type BarDef } from '../core/roles';
import { formatDuration } from '../core/time';
import type { BarId, Bars, GameState, PendingEvent } from '../core/types';
import { lightAt } from '../art/daynight';

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
          </small>
        </div>
        <div class="badge day">DIA {dayNumber(state, now)}</div>
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
          <span>{lightAt(now).label}</span>
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
  onLog,
  onMenu,
}: {
  state: GameState;
  now: number;
  onStart: () => void;
  onRetire: () => void;
  onOpenEvent: () => void;
  onLog: () => void;
  onMenu: () => void;
}) {
  const role = ROLES[state.character.role];
  const shift = state.shift;
  const block = canStartShift(state, now);
  let body;

  if (shift) {
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
          <div class="progress">
            <div style={{ width: `${done * 100}%` }} />
          </div>
        )}
        <button class={`btn ${ready ? 'good' : ''}`} disabled={!ready} onClick={onRetire}>
          {shift.cancelled ? 'Volver a casa' : ready ? `${role.retire} (+${role.formatMoney(role.shiftPay)})` : role.retire}
        </button>
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
          <span>Jornada de hoy cumplida.</span> <span class="hint">Vuelve mañana para mantener la racha 🔥</span>
        </div>
        <button class="btn" disabled>
          Hasta mañana
        </button>
      </>
    );
  } else {
    body = (
      <>
        <div class="status">
          <span class="warn">Hoy aún no fuiste {role.toWorkplace}.</span>{' '}
          <span class="hint">Si no vas, pierdes la racha y el sueldo.</span>
        </div>
        <button class="btn" onClick={onStart}>
          {role.goToWork} · 8h
        </button>
      </>
    );
  }

  return (
    <div class="dock">
      {body}
      <div class="dock-tools">
        {state.pending.length > 0 && (
          <button class="btn pending-alert" onClick={onOpenEvent}>
            ⚠ Suceso ({state.pending.length})
          </button>
        )}
        <button class="btn secondary" onClick={onLog}>
          Diario
        </button>
        <button class="btn secondary" disabled title="Llega en la fase 2">
          Bolsa · pronto
        </button>
        <button class="btn secondary" onClick={onMenu} aria-label="Menú">
          ☰
        </button>
      </div>
    </div>
  );
}

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

export function EventModal({
  state,
  pending,
  onChoose,
}: {
  state: GameState;
  pending: PendingEvent;
  onChoose: (choiceId: string) => void;
}) {
  const view = viewEvent(state, pending);
  const time = new Date(pending.firedAt).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
  return (
    <div class="modal-wrap">
      <div class="modal">
        <div class="kicker">SUCESO · {time}</div>
        <h3>{view.def.title}</h3>
        <p>{view.intro}</p>
        <div class="stack">
          {view.def.choices.map((c) => (
            <div key={c.id}>
              <button class="btn" onClick={() => onChoose(c.id)}>
                {c.label}
              </button>
              {c.hint && <div class="choice-hint">{c.hint}</div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function OutcomeModal({ state, outcome, onClose }: { state: GameState; outcome: ResolvedOutcome; onClose: () => void }) {
  const kind = outcome.outcome.result;
  return (
    <div class="modal-wrap">
      <div class="modal">
        <div class="kicker">{caps(outcome.event.title)}</div>
        <div class={`result ${kind}`}>{kind === 'bueno' ? '✔ SALIO BIEN' : '✖ SALIO MAL'}</div>
        <h3>{outcome.outcome.title}</h3>
        <p>{outcome.message}</p>
        <Deltas deltas={outcome.deltas} state={state} />
        <button class="btn" onClick={onClose}>
          Continuar
        </button>
      </div>
    </div>
  );
}

export function LogModal({ state, onClose }: { state: GameState; onClose: () => void }) {
  return (
    <div class="modal-wrap" onClick={onClose}>
      <div class="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Diario</h3>
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

export function MenuModal({ onClose, onQuit }: { onClose: () => void; onQuit: () => void }) {
  const [confirm, setConfirm] = useState(false);
  return (
    <div class="modal-wrap" onClick={onClose}>
      <div class="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Menú</h3>
        <div class="stack">
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
        <h3>{over.title}</h3>
        <p>{over.text}</p>
        <div class="stats">
          <div class="stat">
            <b>{over.day}</b>días aguantados
          </div>
          <div class="stat">
            <b>{state.bestStreak}</b>mejor racha
          </div>
          <div class="stat">
            <b>{state.daysWorked}</b>jornadas
          </div>
          <div class="stat">
            <b>{state.log.filter((l) => l.kind === 'bueno').length}</b>buenos momentos
          </div>
        </div>
        <button class="btn" onClick={onNew}>
          Nueva partida
        </button>
      </div>
    </div>
  );
}

export function Toast({ title, text }: { title: string; text: string }) {
  return (
    <div class="toast">
      <small>{title}</small>
      {text}
    </div>
  );
}

export function eventNotification(eventId: string) {
  return EVENTS[eventId]?.notification ?? 'Ha ocurrido algo.';
}
