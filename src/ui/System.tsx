import { Component } from 'preact';
import { useState } from 'preact/hooks';
import { version } from '../../package.json';
import * as audio from '../platform/audio';
import { getSettings, setSettings } from '../platform/settings';
import { exportCode, listSlots, MAX_SLOTS, type SlotInfo } from '../platform/save';
import { lowFx, setLowFx } from '../scene/CityScene';
import { dayNumber } from '../core/game';
import { ROLES } from '../core/roles';
import { Letters } from './AnimText';
import { Modal } from './Panels';

/** Número de versión que se ve en la portada y en los créditos. */
export const GAME_VERSION = version;

function ago(t: number | null) {
  if (!t) return 'sin fecha';
  const m = Math.round((Date.now() - t) / 60000);
  if (m < 1) return 'ahora mismo';
  if (m < 60) return `hace ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  return d === 1 ? 'ayer' : `hace ${d} días`;
}

/** Partidas guardadas: jugar, empezar una nueva en una ranura o borrarla. */
export function SavesScreen({ active, now, onPlay, onNew, onDelete, onBack }: { active: number; now: number; onPlay: (slot: number) => void; onNew: (slot: number) => void; onDelete: (slot: number) => void; onBack: () => void }) {
  const [slots, setSlots] = useState<SlotInfo[]>(listSlots);
  const [confirm, setConfirm] = useState<{ slot: number; kind: 'delete' | 'overwrite' } | null>(null);
  return (
    <div class="screen saves-screen">
      <h2>
        <Letters text="Partidas guardadas" />
      </h2>
      <p class="muted">Hasta {MAX_SLOTS} partidas. Se guardan solas en este dispositivo.</p>
      <div class="stack">
        {slots.map(({ slot, state, savedAt, recovered }) => {
          const role = state ? ROLES[state.character.role] : null;
          return (
            <div key={slot} class={`save-slot ${state ? '' : 'empty'} ${slot === active && state ? 'active' : ''}`}>
              <div class="slot-num">{slot}</div>
              {state && role ? (
                <div class="slot-info">
                  <b>{state.character.name}</b>
                  <span>
                    {role.title.replace(/^El /, '')} · día {dayNumber(state, now)} · {role.formatMoney(state.bars.dinero ?? 0)}
                  </span>
                  <small>
                    {state.gameOver ? '☠ Terminada · ' : `🔥${state.streak} · `}
                    {ago(savedAt)}
                    {recovered && ' · recuperada de la copia'}
                  </small>
                </div>
              ) : (
                <div class="slot-info">
                  <b>Ranura libre</b>
                  <small>Empieza aquí una partida nueva.</small>
                </div>
              )}
              <div class="slot-actions">
                {state ? (
                  <>
                    <button class="btn small good" onClick={() => onPlay(slot)}>
                      Jugar
                    </button>
                    <button class="btn small secondary" onClick={() => setConfirm({ slot, kind: 'overwrite' })}>
                      Nueva
                    </button>
                    <button class="btn small danger" onClick={() => setConfirm({ slot, kind: 'delete' })} aria-label="Borrar partida">
                      🗑
                    </button>
                  </>
                ) : (
                  <button class="btn small good" onClick={() => onNew(slot)}>
                    Nueva
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <button class="btn secondary" onClick={onBack}>
        Volver
      </button>
      {confirm && (
        <div class="modal-wrap" onClick={() => setConfirm(null)}>
          <div class="modal" onClick={(e) => e.stopPropagation()}>
            <h3>{confirm.kind === 'delete' ? '¿Borrar la partida?' : '¿Empezar de cero aquí?'}</h3>
            <p>La partida de la ranura {confirm.slot} se perderá para siempre. Si quieres conservarla, guarda antes su código de copia de seguridad (en ⚙ Ajustes durante la partida).</p>
            <div class="stack">
              <button
                class="btn danger"
                onClick={() => {
                  const c = confirm;
                  setConfirm(null);
                  if (c.kind === 'delete') {
                    onDelete(c.slot);
                    setSlots(listSlots());
                  } else onNew(c.slot);
                }}
              >
                {confirm.kind === 'delete' ? 'Sí, borrarla' : 'Sí, empezar de cero'}
              </button>
              <button class="btn secondary" onClick={() => setConfirm(null)}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Ajustes: sonido, vibración, avisos, gráficos y texto. Sirve en la portada y en la partida. */
export function SettingsModal({ onClose, onOpen }: { onClose: () => void; onOpen: (p: 'privacidad' | 'creditos') => void }) {
  const [sound, setSound] = useState(audio.getPrefs());
  const [st, setSt] = useState(getSettings());
  const [low, setLow] = useState(lowFx());
  const toggleSound = (k: 'sfx' | 'music' | 'ambient') => {
    audio.unlock();
    audio.setPrefs({ [k]: !sound[k] });
    setSound(audio.getPrefs());
  };
  const toggle = (k: 'vibrate' | 'notifications' | 'bigText') => {
    setSettings({ [k]: !st[k] });
    setSt(getSettings());
    audio.play.click();
  };
  const Row = ({ label, on, onClick, hint }: { label: string; on: boolean; onClick: () => void; hint?: string }) => (
    <button class={`setting-row ${on ? 'on' : ''}`} onClick={onClick}>
      <span>
        {label}
        {hint && <small>{hint}</small>}
      </span>
      <i class="switch">
        <i />
      </i>
    </button>
  );
  return (
    <Modal title="Ajustes" kicker="PIXELOPOLIS" onClose={onClose}>
      <div class="settings">
        <div class="settings-group">SONIDO</div>
        <Row label="Música" on={sound.music} onClick={() => toggleSound('music')} />
        <Row label="Efectos" on={sound.sfx} onClick={() => toggleSound('sfx')} />
        <Row label="Sonido de la calle" on={sound.ambient} onClick={() => toggleSound('ambient')} />
        <div class="settings-group">JUEGO</div>
        <Row label="Vibración" on={st.vibrate} onClick={() => toggle('vibrate')} />
        <Row label="Notificaciones" on={st.notifications} onClick={() => toggle('notifications')} hint="Fin de jornada, sucesos y recordatorio de la racha." />
        <Row
          label="Gráficos en alta calidad"
          on={!low}
          onClick={() => {
            setLowFx(!low);
            setLow(!low);
          }}
          hint={low ? 'Modo ahorro: más fluido en móviles sencillos.' : 'Se aplica del todo al volver a abrir el juego.'}
        />
        <Row label="Letra grande" on={st.bigText} onClick={() => toggle('bigText')} />
        <div class="settings-group">INFORMACIÓN</div>
        <div class="menu-grid">
          <button class="btn secondary" onClick={() => onOpen('privacidad')}>
            🔒 Privacidad
          </button>
          <button class="btn secondary" onClick={() => onOpen('creditos')}>
            ★ Créditos
          </button>
        </div>
        <p class="muted small center">Versión {GAME_VERSION}</p>
      </div>
    </Modal>
  );
}

/** Política de privacidad (la misma que se publica en la ficha de la tienda). */
export function PrivacyModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="Privacidad" kicker="TUS DATOS" onClose={onClose}>
      <div class="legal">
        <p>
          <b>Pixelopolis no recoge, envía ni vende ningún dato personal.</b>
        </p>
        <ul>
          <li>Tus partidas, ajustes, notas y récords se guardan solo en este dispositivo.</li>
          <li>El juego no tiene cuentas, anuncios, analíticas ni servicios de terceros, y funciona sin conexión.</li>
          <li>Las notificaciones son locales: las programa el propio móvil y puedes desactivarlas en Ajustes.</li>
          <li>El código de copia de seguridad solo sale del móvil si tú lo copias o lo compartes.</li>
          <li>Al desinstalar el juego se borra todo lo guardado.</li>
        </ul>
        <p class="muted small">El dinero, la bolsa, las apuestas y la lotería del juego son ficticios: no se puede comprar ni ganar dinero real.</p>
      </div>
    </Modal>
  );
}

export function CreditsModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="Créditos" kicker={`VERSIÓN ${GAME_VERSION}`} onClose={onClose}>
      <div class="legal center">
        <p>
          <b>PIXELOPOLIS</b>
          <br />
          Pixel Town Builder
        </p>
        <p>Una ciudad de los 80 vivida por un inmigrante y un alcalde.</p>
        <p class="muted small">
          Tipografías: Pixelify Sans y Silkscreen (SIL Open Font License).
          <br />
          Motor: Phaser · Interfaz: Preact · App: Capacitor.
          <br />
          Música y sonidos generados por el propio juego.
        </p>
        <p class="muted small">Todos los personajes, empresas y sucesos son ficticios.</p>
      </div>
    </Modal>
  );
}

/**
 * Si algo falla al dibujar la interfaz, en vez de una pantalla en blanco se
 * ofrece reintentar o sacar el código de copia de la partida.
 */
export class ErrorBoundary extends Component<{ children: any }, { error: Error | null; code: string | null }> {
  state = { error: null as Error | null, code: null as string | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error) {
    console.error(error);
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div class="screen crash-screen">
        <h2>Algo ha fallado</h2>
        <p>Tu partida está guardada. Prueba a volver a intentarlo; si sigue fallando, copia el código de tu partida para no perderla.</p>
        <button class="btn" onClick={() => this.setState({ error: null })}>
          Reintentar
        </button>
        <button class="btn secondary" onClick={() => location.reload()}>
          Reiniciar el juego
        </button>
        <button class="btn secondary" onClick={() => this.setState({ code: exportCode() ?? 'No hay partida.' })}>
          Ver el código de mi partida
        </button>
        {this.state.code && <textarea class="backup-code" readOnly value={this.state.code} />}
        <small class="muted">{String(this.state.error?.message ?? '').slice(0, 160)}</small>
      </div>
    );
  }
}
