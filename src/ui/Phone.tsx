import { useEffect, useRef, useState } from 'preact/hooks';
import * as audio from '../platform/audio';
import { PixelIcon } from './PixelIcon';
import { DockMain, marketLive, missionsLeft, TOOLS, type DockProps } from './Play';
import type { ExtrasActions } from './Extras7';
import { actionsFor, actionStatus, canRetire, canStartErrand, canStartShift, canTakeRadioJob, dayNumber, ERRAND_PAY, errandHours, todayJobs, todayWeather } from '../core/game';
import { canHotdogs, canTaxi, canTeach, CLASS_PAY, HOTDOG_PER_POINT, TAXI_HOURS, taxiPay } from '../core/economy';
import { WEATHER_LABEL, weatherFor } from '../core/weather';
import { ROLES } from '../core/roles';
import { formatDuration } from '../core/time';
import type { GameState } from '../core/types';

/**
 * El panel inferior es un móvil de tapa: cerrado solo asoma la tapa
 * metálica (con su pantallita); al abrirlo se despliega con una animación
 * de bisagra y enseña el día, las aplicaciones del juego y otras propias del
 * teléfono: notas, contactos que te ofrecen trabajo, calculadora, reloj,
 * el tiempo y la música.
 */
type App = 'home' | 'notas' | 'contactos' | 'calc' | 'reloj' | 'tiempo' | 'musica';

interface PhoneProps extends DockProps {
  extras: ExtrasActions;
}

const OWN_APPS: { id: Exclude<App, 'home'>; icon: string; label: string }[] = [
  { id: 'contactos', icon: 'telefono', label: 'Contactos' },
  { id: 'notas', icon: 'nota', label: 'Notas' },
  { id: 'calc', icon: 'calc', label: 'Calcular' },
  { id: 'reloj', icon: 'reloj', label: 'Reloj' },
  { id: 'tiempo', icon: 'sol', label: 'Tiempo' },
  { id: 'musica', icon: 'musica', label: 'Música' },
];

const TITLES: Record<App, string> = {
  home: 'INICIO',
  notas: 'NOTAS',
  contactos: 'CONTACTOS',
  calc: 'CALCULADORA',
  reloj: 'RELOJ',
  tiempo: 'EL TIEMPO',
  musica: 'MÚSICA',
};

export function Phone(p: PhoneProps) {
  const { state, now } = p;
  const [open, setOpen] = useState(false);
  const [anim, setAnim] = useState<'' | 'opening' | 'closing'>('');
  const [app, setApp] = useState<App>('home');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doOpen = () => {
    audio.play.click();
    setApp('home');
    setOpen(true);
    setAnim('opening');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setAnim(''), 650);
  };
  const doClose = () => {
    if (!open || anim === 'closing') return;
    audio.play.click();
    setAnim('closing');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setOpen(false);
      setAnim('');
    }, 520);
  };
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);
  // Atrás: primero vuelve al inicio del móvil y luego lo pliega.
  useEffect(() => {
    if (!open) return;
    const onBack = (e: Event) => {
      e.preventDefault();
      if (app !== 'home') setApp('home');
      else doClose();
    };
    window.addEventListener('lc-back', onBack);
    return () => window.removeEventListener('lc-back', onBack);
  }, [open, app, anim]);

  // Al abrir un panel del juego, el móvil se pliega solo.
  const wrap = <A extends unknown[]>(fn: (...a: A) => void) => (...a: A) => {
    fn(...a);
    setOpen(false);
    setAnim('');
  };
  const main: DockProps = { ...p, onPanel: wrap(p.onPanel), onMinigame: wrap(p.onMinigame), onOpenEvent: wrap(p.onOpenEvent), onStart: wrap(p.onStart), onRetire: wrap(p.onRetire), onErrand: wrap(p.onErrand) };
  const role = ROLES[state.character.role];
  const time = new Date(now).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
  const missions = missionsLeft(state);

  // la pantallita exterior de la tapa
  let lcd = '';
  let alert = state.pending.length > 0;
  if (state.errand) lcd = `FUERA · ${formatDuration(state.errand.endsAt - now)}`;
  else if (state.shift && !state.shift.cancelled) {
    if (canRetire(state, now)) {
      lcd = '¡JORNADA HECHA! COBRA';
      alert = true;
    } else lcd = `TRABAJO · ${formatDuration(state.shift.endsAt - now)}`;
  } else if (canStartShift(state, now) === 'already-worked') lcd = 'JORNADA CUMPLIDA ✔';
  else if (canStartShift(state, now) === 'detained') lcd = 'DETENIDO';
  else {
    lcd = `VE ${role.toWorkplace.toUpperCase()}`;
    alert = true;
  }

  return (
    <>
      {state.pending.length > 0 && !open && (
        <button class="pending-pill phone-pill" onClick={p.onOpenEvent}>
          ⚠ {state.pending.length === 1 ? '1 suceso' : `${state.pending.length} sucesos`}
        </button>
      )}
      {!open && (
        <button class="phone-lid" onClick={doOpen} aria-label="Abrir el móvil">
          <span class="lid-hinge" />
          <span class={`lid-led ${alert ? 'on' : ''}`} />
          <span class="lid-lcd">
            <b>{time}</b>
            <span>{lcd}</span>
          </span>
          <span class="lid-badges">
            {missions > 0 && <i>🎯{missions}</i>}
            {state.pending.length > 0 && <i class="warn">⚠{state.pending.length}</i>}
          </span>
          <span class="lid-grip">▲</span>
        </button>
      )}
      {open && (
        <div class={`phone-wrap ${anim}`} onClick={doClose}>
          <div class="phone" onClick={(e) => e.stopPropagation()}>
            <div class="phone-top">
              <div class="phone-speaker" />
              <div class="phone-screen">
                <div class="phone-status">
                  <span class="phone-sig">
                    <i />
                    <i />
                    <i />
                    <i />
                    NYC·TEL
                  </span>
                  <b>{time}</b>
                  <span class="bat">
                    <i />
                  </span>
                </div>
                <div class="phone-app-title">
                  {app !== 'home' && (
                    <button class="phone-back" onClick={() => setApp('home')}>
                      ◀
                    </button>
                  )}
                  {TITLES[app]}
                  <span class="phone-day">DÍA {dayNumber(state, now)}</span>
                </div>
                <div class="phone-body">
                  {app === 'home' && (
                    <>
                      {state.pending.length > 0 && (
                        <button class="phone-notif" onClick={main.onOpenEvent}>
                          ⚠ {state.pending.length === 1 ? 'Tienes 1 suceso por decidir' : `Tienes ${state.pending.length} sucesos por decidir`}
                        </button>
                      )}
                      <DockMain {...main} />
                      <div class="phone-grid">
                        {TOOLS.filter((t) => !t.role || t.role === state.character.role).map((t) => (
                          <button key={t.id} class={`phone-app ${t.id === 'bolsa' && marketLive(state, now) ? 'live' : ''}`} onClick={() => main.onPanel(t.id)}>
                            <span class="app-ic">
                              <PixelIcon id={t.icon} size={2} />
                              {t.id === 'extras' && missions > 0 && <i class="tool-badge">{missions}</i>}
                            </span>
                            {t.label}
                          </button>
                        ))}
                        {OWN_APPS.map((a) => (
                          <button key={a.id} class="phone-app own" onClick={() => setApp(a.id)}>
                            <span class="app-ic">
                              <PixelIcon id={a.icon} size={2} />
                            </span>
                            {a.label}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                  {app === 'notas' && <NotesApp state={state} now={now} />}
                  {app === 'contactos' && <ContactsApp state={state} now={now} extras={p.extras} onDone={() => (setOpen(false), setAnim(''))} />}
                  {app === 'calc' && <CalcApp />}
                  {app === 'reloj' && <ClockApp state={state} now={now} />}
                  {app === 'tiempo' && <WeatherApp state={state} />}
                  {app === 'musica' && <MusicApp />}
                </div>
              </div>
            </div>
            <div class="phone-hinge" />
            <div class="phone-keys">
              <button onClick={() => setApp('home')} aria-label="Atrás">
                ◀
              </button>
              <button class="ok" onClick={() => setApp('home')} aria-label="Inicio">
                ●
              </button>
              <button onClick={doClose} aria-label="Cerrar el móvil">
                ▼
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Notas
// ---------------------------------------------------------------------------

interface Note {
  id: number;
  day: number;
  text: string;
}
const NOTES_KEY = 'laciudad.notas';

function loadNotes(): Note[] {
  try {
    return JSON.parse(localStorage.getItem(NOTES_KEY) ?? '[]');
  } catch {
    return [];
  }
}
function saveNotes(n: Note[]) {
  try {
    localStorage.setItem(NOTES_KEY, JSON.stringify(n));
  } catch {
    /* sin almacenamiento */
  }
}

function NotesApp({ state, now }: { state: GameState; now: number }) {
  const [notes, setNotes] = useState(loadNotes);
  const [draft, setDraft] = useState('');
  const add = () => {
    const text = draft.trim();
    if (!text) return;
    const next = [{ id: Date.now(), day: dayNumber(state, now), text }, ...notes].slice(0, 40);
    setNotes(next);
    saveNotes(next);
    setDraft('');
    audio.play.click();
  };
  const del = (id: number) => {
    const next = notes.filter((n) => n.id !== id);
    setNotes(next);
    saveNotes(next);
  };
  return (
    <div class="notes-app">
      <textarea value={draft} placeholder="Apunta algo: precios, planes, a quién llamar…" maxLength={240} onInput={(e) => setDraft((e.target as HTMLTextAreaElement).value)} />
      <button class="btn small good" disabled={!draft.trim()} onClick={add}>
        Guardar nota
      </button>
      {!notes.length && <p class="muted small">Aún no tienes notas.</p>}
      <ul class="note-list">
        {notes.map((n) => (
          <li key={n.id}>
            <small>Día {n.day}</small>
            <span>{n.text}</span>
            <button class="note-del" onClick={() => del(n.id)} aria-label="Borrar nota">
              ✕
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Contactos: gente que te llama con trabajo
// ---------------------------------------------------------------------------

const RADIO_CONTACT: Record<string, { name: string; who: string }> = {
  oficinas: { name: 'Sra. Kowalski', who: 'Limpiezas Empire' },
  puerto: { name: 'Capataz Murphy', who: 'Muelle 42' },
  ninos: { name: 'Familia Whitman', who: 'Upper East Side' },
  pintar: { name: 'Sr. Rossi', who: 'Queens' },
  volantes: { name: 'Club Paradise', who: 'Times Square' },
  mudanza: { name: 'Vinnie', who: 'Mudanzas Brooklyn Bros' },
  cocina: { name: 'Mamma Lucia', who: 'Trattoria de Mulberry St.' },
  obra: { name: 'Big Tony', who: 'Construcciones del Bronx' },
  traduccion: { name: 'Dra. Ortiz', who: 'Clínica del barrio' },
  taxi: { name: 'Sal', who: 'Garaje de la 11ª Avenida' },
};

interface Contact {
  key: string;
  name: string;
  who: string;
  offer: string;
  status: string | null;
  cta: string;
  act: () => void;
}

const COLORS = ['#ff4f9a', '#4ff0ff', '#ffcc33', '#7dff6a', '#ff8a3b', '#9a7bff'];

function ContactsApp({ state, now, extras, onDone }: { state: GameState; now: number; extras: ExtrasActions; onDone: () => void }) {
  const fmt = ROLES[state.character.role].formatMoney;
  const [calling, setCalling] = useState<string | null>(null);
  const list: Contact[] = [];
  if (state.character.role === 'inmigrante') {
    const jobs = todayJobs(state);
    const radioWhy = canTakeRadioJob(state, now);
    for (const j of jobs) {
      const c = RADIO_CONTACT[j.id] ?? { name: 'Desconocido', who: '' };
      list.push({ key: j.id, name: c.name, who: c.who, offer: `${j.label} · ${j.hours} h · ${fmt(j.pay)}`, status: radioWhy, cta: 'Aceptar', act: () => extras.onRadio(j.id) });
    }
    const errand = canStartErrand(state, now);
    list.push({ key: 'reparto', name: 'Paquetería Express', who: 'Reparto por la ciudad', offer: `${errandHours(state)} h repartiendo · ${fmt(ERRAND_PAY)}`, status: errand === 'done-today' ? 'Hecho hoy' : errand ? 'Ahora no' : null, cta: 'Salir a repartir', act: extras.onErrand });
    list.push({ key: 'taxi', name: 'Cooperativa de taxis', who: 'Turno libre', offer: `${TAXI_HOURS} h al volante · ${fmt(taxiPay(state, now).pay)}`, status: canTaxi(state, now), cta: 'Coger el taxi', act: extras.onTaxi });
    list.push({ key: 'clases', name: 'Doña Carmen', who: 'Asociación de vecinos', offer: `1 h de clase de español · ${fmt(CLASS_PAY)}`, status: canTeach(state, now), cta: 'Dar clase', act: extras.onClasses });
    list.push({ key: 'perritos', name: 'Abe', who: 'Puesto de perritos', offer: `Te deja el puesto · ${fmt(HOTDOG_PER_POINT)} por perrito`, status: canHotdogs(state, now), cta: 'Abrir el puesto', act: extras.onHotdogs });
  } else {
    for (const d of actionsFor(state).filter((x) => x.id === 'cena-recaudacion' || x.id === 'mitin-barrio')) {
      const st = actionStatus(state, d, now);
      list.push({
        key: d.id,
        name: d.id === 'cena-recaudacion' ? 'Mr. Vanderbilt' : 'Jefa de campaña',
        who: d.id === 'cena-recaudacion' ? 'Donantes del partido' : 'Equipo del alcalde',
        offer: d.title,
        status: st.ok ? null : st.reason ?? 'No disponible',
        cta: 'Quedar',
        act: () => extras.onAction(d.id),
      });
    }
    list.push({ key: 'bonos', name: 'El tesorero', who: 'Hacienda municipal', offer: 'Invertir en bonos municipales', status: null, cta: 'Ver bonos', act: () => extras.onOpen('bonos') });
    list.push({ key: 'subasta', name: 'Agente inmobiliario', who: 'Hudson Realty', offer: 'Compra solares libres de la ciudad', status: null, cta: 'Subastar', act: extras.onAuction });
  }
  return (
    <div class="contacts-app">
      <p class="muted small">Te llaman con trabajo. Toca un contacto para ver su oferta.</p>
      {list.map((c, i) => (
        <div key={c.key} class={`contact ${calling === c.key ? 'open' : ''} ${c.status ? 'off' : ''}`}>
          <button class="contact-row" onClick={() => setCalling(calling === c.key ? null : c.key)}>
            <span class="avatar" style={{ background: COLORS[i % COLORS.length] }}>
              {c.name
                .replace(/^(Sra?\.|Dra\.|Doña|Mr\.|El|La)\s/, '')
                .slice(0, 1)
                .toUpperCase()}
            </span>
            <span class="contact-info">
              <b>{c.name}</b>
              <small>{c.who}</small>
            </span>
            <span class="contact-call">{c.status ? '—' : '📞'}</span>
          </button>
          {calling === c.key && (
            <div class="contact-offer">
              <span>"{c.offer}"</span>
              {c.status ? (
                <small class="warn">{c.status}</small>
              ) : (
                <button
                  class="btn small good"
                  onClick={() => {
                    c.act();
                    onDone();
                  }}
                >
                  {c.cta}
                </button>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Calculadora, reloj, tiempo y música
// ---------------------------------------------------------------------------

function CalcApp() {
  const [disp, setDisp] = useState('0');
  const [acc, setAcc] = useState<number | null>(null);
  const [op, setOp] = useState<string | null>(null);
  const [fresh, setFresh] = useState(true);
  const calc = (a: number, b: number, o: string) => (o === '+' ? a + b : o === '−' ? a - b : o === '×' ? a * b : b === 0 ? NaN : a / b);
  const show = (n: number) => (Number.isFinite(n) ? String(Math.round(n * 1e6) / 1e6).slice(0, 12) : 'ERROR');
  const press = (k: string) => {
    audio.play.click();
    if (/^[0-9]$/.test(k) || k === '.') {
      if (fresh) {
        setDisp(k === '.' ? '0.' : k);
        setFresh(false);
      } else if (!(k === '.' && disp.includes('.')) && disp.length < 12) setDisp(disp + k);
      return;
    }
    if (k === 'C') {
      setDisp('0');
      setAcc(null);
      setOp(null);
      setFresh(true);
      return;
    }
    const cur = parseFloat(disp);
    const res = acc !== null && op && !fresh ? calc(acc, cur, op) : cur;
    if (k === '=') {
      setDisp(show(res));
      setAcc(null);
      setOp(null);
    } else {
      setDisp(show(res));
      setAcc(res);
      setOp(k);
    }
    setFresh(true);
  };
  const keys = ['7', '8', '9', '÷', '4', '5', '6', '×', '1', '2', '3', '−', 'C', '0', '.', '+'];
  return (
    <div class="calc-app">
      <div class="calc-disp">
        <small>{acc !== null && op ? `${show(acc)} ${op}` : ''}</small>
        {disp}
      </div>
      <div class="calc-keys">
        {keys.map((k) => (
          <button key={k} class={/[÷×−+C]/.test(k) ? 'op' : ''} onClick={() => press(k)}>
            {k}
          </button>
        ))}
        <button class="eq" onClick={() => press('=')}>
          =
        </button>
      </div>
    </div>
  );
}

function ClockApp({ state, now }: { state: GameState; now: number }) {
  const d = new Date(now);
  const time = d.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const date = d.toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' });
  const shift = state.shift && !state.shift.cancelled ? state.shift : null;
  return (
    <div class="clock-app">
      <div class="big-time">{time}</div>
      <div class="muted">{date} · día {dayNumber(state, now)}</div>
      <ul class="clock-list">
        <li>
          <span>⏱ Jornada</span>
          <b>{shift ? (now < shift.endsAt ? `faltan ${formatDuration(shift.endsAt - now)}` : 'terminada: ¡a cobrar!') : 'sin empezar'}</b>
        </li>
        {state.errand && (
          <li>
            <span>📦 Trabajo extra</span>
            <b>vuelves en {formatDuration(state.errand.endsAt - now)}</b>
          </li>
        )}
        <li>
          <span>📈 Bolsa</span>
          <b>{marketLive(state, now) ? 'abierta durante tu jornada' : 'cerrada'}</b>
        </li>
        <li>
          <span>🔥 Racha</span>
          <b>{state.streak} días</b>
        </li>
      </ul>
    </div>
  );
}

function addDays(date: string, n: number) {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function WeatherApp({ state }: { state: GameState }) {
  const today = WEATHER_LABEL[todayWeather(state)];
  const days = [1, 2, 3].map((n) => {
    const date = addDays(state.today.date, n);
    const d = new Date(`${date}T12:00:00`);
    return { date, name: d.toLocaleDateString('es', { weekday: 'short' }), w: WEATHER_LABEL[weatherFor(state.seed, date)] };
  });
  return (
    <div class="weather-app">
      <div class="weather-now">
        <span class="w-ic">{today.icon}</span>
        <b>{today.label}</b>
        <small>Hoy en Nueva York</small>
      </div>
      <div class="weather-days">
        {days.map((d) => (
          <div key={d.date}>
            <small>{d.name}</small>
            <span>{d.w.icon}</span>
            <small>{d.w.label}</small>
          </div>
        ))}
      </div>
      <p class="muted small">Con lluvia el taxi paga más y la gente no sale a la calle.</p>
    </div>
  );
}

function MusicApp() {
  const [prefs, setPrefsState] = useState(audio.getPrefs());
  const toggle = (k: 'sfx' | 'music' | 'ambient') => {
    audio.unlock();
    audio.setPrefs({ [k]: !prefs[k] });
    setPrefsState(audio.getPrefs());
  };
  return (
    <div class="music-app">
      <div class={`cassette ${prefs.music ? 'spin' : ''}`}>
        <span class="reel" />
        <span class="label">SYNTH · NYC 85</span>
        <span class="reel" />
      </div>
      <button class={`btn ${prefs.music ? 'good' : 'secondary'}`} onClick={() => toggle('music')}>
        {prefs.music ? '⏸ Parar la música' : '▶ Poner la música'}
      </button>
      <button class={`btn secondary ${prefs.ambient ? 'on' : ''}`} onClick={() => toggle('ambient')}>
        {prefs.ambient ? '🌧 Sonido de la calle: sí' : '🔇 Sonido de la calle: no'}
      </button>
      <button class={`btn secondary ${prefs.sfx ? 'on' : ''}`} onClick={() => toggle('sfx')}>
        {prefs.sfx ? '🔊 Efectos: sí' : '🔇 Efectos: no'}
      </button>
    </div>
  );
}
