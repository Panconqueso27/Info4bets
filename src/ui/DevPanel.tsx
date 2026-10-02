import { useState } from 'preact/hooks';
import { eventsFor } from '../core/events/catalog';
import { HOUR } from '../core/time';
import type { Role } from '../core/types';
import * as clock from '../platform/clock';

/** Herramientas para probar sin esperar horas reales. Solo con ?dev en la URL o en desarrollo. */
export function DevPanel({
  role,
  onForceEvent,
  onChanged,
  onWipe,
}: {
  role: Role | null;
  onForceEvent: (id: string) => void;
  onChanged: () => void;
  onWipe: () => void;
}) {
  const [open, setOpen] = useState(false);
  const speed = clock.getSpeed();
  const act = (fn: () => void) => () => {
    fn();
    onChanged();
  };
  if (!open)
    return (
      <button class="dev-toggle" onClick={() => setOpen(true)}>
        DEV{speed !== 1 ? ` x${speed}` : clock.isShifted() ? ' ⏩' : ''}
      </button>
    );
  return (
    <div class="modal-wrap" onClick={() => setOpen(false)}>
      <div class="modal dev-panel" onClick={(e) => e.stopPropagation()}>
        <h3>Modo desarrollo</h3>
        <div class="kicker">VELOCIDAD DEL RELOJ</div>
        <div class="grid">
          {[1, 60, 600, 3600].map((s) => (
            <button key={s} class={`btn secondary ${speed === s ? 'on' : ''}`} onClick={act(() => clock.setSpeed(s))}>
              x{s}
            </button>
          ))}
        </div>
        <div class="kicker">ADELANTAR</div>
        <div class="grid">
          <button class="btn secondary" onClick={act(() => clock.skip(HOUR))}>+1h</button>
          <button class="btn secondary" onClick={act(() => clock.skip(4 * HOUR))}>+4h</button>
          <button class="btn secondary" onClick={act(() => clock.skip(8 * HOUR))}>+8h</button>
          <button class="btn secondary" onClick={act(() => clock.skip(24 * HOUR))}>+1 día</button>
        </div>
        {role && (
          <>
            <div class="kicker">FORZAR SUCESO</div>
            <div class="grid">
              {eventsFor(role).map((e) => (
                <button key={e.id} class="btn secondary" onClick={() => { onForceEvent(e.id); setOpen(false); }}>
                  {e.id}
                </button>
              ))}
            </div>
          </>
        )}
        <div class="stack">
          <button class="btn secondary" onClick={act(() => clock.resetClock())}>
            Volver a la hora real
          </button>
          <button class="btn danger" onClick={() => { onWipe(); setOpen(false); }}>
            Borrar partida
          </button>
          <button class="btn" onClick={() => setOpen(false)}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
