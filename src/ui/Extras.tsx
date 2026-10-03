import { useState } from 'preact/hooks';
import { EXTRA_HAIRS, EXTRA_OUTFITS, HAIR_COLORS, HAIRS, OUTFIT_COLORS, OUTFITS, SKINS, type Option } from '../art/character';
import { COSMETICS } from '../core/cosmetics';
import { gameStats } from '../core/game';
import { knownNpcs } from '../core/npcs';
import { ROLES } from '../core/roles';
import type { GameState, Look, Role } from '../core/types';
import { Letters } from './AnimText';
import { CharacterCanvas } from './CharacterCanvas';

function Hearts({ n }: { n: number }) {
  const full = Math.max(0, n);
  const broken = Math.max(0, -n);
  return (
    <span class="hearts" title={`Afinidad ${n}`}>
      {broken > 0 ? '💔'.repeat(Math.min(3, broken)) : ''}
      {'♥'.repeat(Math.min(5, full))}
      <span class="hearts-off">{'♥'.repeat(Math.max(0, 5 - full - (broken ? 5 : 0)))}</span>
    </span>
  );
}

export function PeopleModal({ state, onClose }: { state: GameState; onClose: () => void }) {
  const people = knownNpcs(state);
  return (
    <div class="modal-wrap" onClick={onClose}>
      <div class="modal" onClick={(e) => e.stopPropagation()}>
        <div class="kicker">TU GENTE EN LA CIUDAD</div>
        <h3>
          <Letters text="Personas" />
        </h3>
        {people.length === 0 && <p>Aún no conoces a nadie de verdad. Cada decisión deja huella en quienes te rodean.</p>}
        <div class="stack">
          {people.map((p) => (
            <div key={p.id} class="person">
              <div class="person-portrait">
                <CharacterCanvas look={p.look} scale={2} />
              </div>
              <div class="person-info">
                <b>{p.name}</b>
                <small>{p.title}</small>
                <Hearts n={p.afinidad} />
                {p.recuerdos.length > 0 && <div class="person-memory">“{p.recuerdos[0]}”</div>}
              </div>
            </div>
          ))}
        </div>
        {state.other && (
          <div class="card other-card">
            <b>{state.other.role === 'alcalde' ? 'El alcalde' : 'En el diner'}: {state.other.name}</b>
            <div class="card-text">
              {state.other.legacy ? 'Tu protagonista de otra partida vive en esta misma ciudad.' : 'Vive en la misma ciudad que tú. Quizá os crucéis.'}
            </div>
          </div>
        )}
        <button class="btn secondary" style={{ marginTop: 12 }} onClick={onClose}>
          Cerrar
        </button>
      </div>
    </div>
  );
}

/** Opciones de ropa y peinado: las básicas y las desbloqueadas (con candado las demás). */
export function lookOptions(role: Role, unlocked: string[]) {
  const outfits: (Option & { locked?: string })[] = [...OUTFITS[role]];
  const hairs: (Option & { locked?: string })[] = [...HAIRS];
  for (const c of COSMETICS) {
    if (c.role && c.role !== role) continue;
    const opt = c.kind === 'outfit' ? EXTRA_OUTFITS[c.id] : EXTRA_HAIRS[c.id];
    const entry = { ...opt, locked: unlocked.includes(c.id) ? undefined : c.requirement };
    (c.kind === 'outfit' ? outfits : hairs).push(entry);
  }
  return { outfits, hairs };
}

function Picker({ label, options, value, onChange }: { label: string; options: (Option & { locked?: string })[]; value: string; onChange: (v: string) => void }) {
  return (
    <div class="picker">
      <div class="label">{label}</div>
      <div class="picker-row">
        {options.map((o) => (
          <button key={o.id} class={`pick ${o.id === value ? 'on' : ''} ${o.locked ? 'locked' : ''}`} disabled={!!o.locked} onClick={() => onChange(o.id)} title={o.locked}>
            {o.locked ? '🔒 ' : ''}
            {o.label}
            {o.locked && <small>{o.locked}</small>}
          </button>
        ))}
      </div>
    </div>
  );
}

function Swatches({ label, colors, value, onChange }: { label: string; colors: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div class="selector">
      <div class="label">{label}</div>
      <div class="swatches">
        {colors.map((c) => (
          <button type="button" key={c} class={`swatch ${c === value ? 'on' : ''}`} style={{ background: c }} onClick={() => onChange(c)} aria-label={`${label} ${c}`} />
        ))}
      </div>
    </div>
  );
}

export function WardrobeModal({ state, onSave, onClose }: { state: GameState; onSave: (look: Look) => void; onClose: () => void }) {
  const [look, setLook] = useState<Look>({ ...state.character.look });
  const { outfits, hairs } = lookOptions(state.character.role, state.cosmetics ?? []);
  const set = (patch: Partial<Look>) => setLook({ ...look, ...patch });
  return (
    <div class="modal-wrap" onClick={onClose}>
      <div class="modal" onClick={(e) => e.stopPropagation()}>
        <div class="kicker">ARMARIO</div>
        <h3>
          <Letters text="Cambiar de look" />
        </h3>
        <div class="preview small">
          <CharacterCanvas look={look} scale={4} walk />
        </div>
        <Picker label="ROPA" options={outfits} value={look.outfit} onChange={(outfit) => set({ outfit })} />
        <Picker label="PEINADO" options={hairs} value={look.hair} onChange={(hair) => set({ hair })} />
        <Swatches label="COLOR ROPA" colors={OUTFIT_COLORS} value={look.outfitColor} onChange={(outfitColor) => set({ outfitColor })} />
        <Swatches label="PELO" colors={HAIR_COLORS} value={look.hairColor} onChange={(hairColor) => set({ hairColor })} />
        <Swatches label="PIEL" colors={SKINS} value={look.skin} onChange={(skin) => set({ skin })} />
        <div class="row" style={{ marginTop: 12 }}>
          <button class="btn secondary" onClick={onClose}>
            Cancelar
          </button>
          <button class="btn" onClick={() => onSave(look)}>
            Ponérmelo
          </button>
        </div>
      </div>
    </div>
  );
}

export function StatsView({ state, now }: { state: GameState; now: number }) {
  const st = gameStats(state, now);
  const role = ROLES[state.character.role];
  const isImm = state.character.role === 'inmigrante';
  const items: [string | number, string][] = [
    [st.dias, 'días en la ciudad'],
    [st.mejorRacha, 'mejor racha'],
    [st.jornadas, 'jornadas completas'],
    [isImm ? st.platos : st.documentos, isImm ? 'platos lavados' : 'documentos despachados'],
    ...(isImm ? ([[st.repartos, 'repartos']] as [number, string][]) : []),
    [role.formatMoney(st.ingresos), 'ganado trabajando'],
    [`${st.bolsaNeta >= 0 ? '+' : ''}${role.formatMoney(st.bolsaNeta)}`, 'balance en bolsa'],
    [`${st.buenos}/${st.buenos + st.malos}`, 'sucesos salieron bien'],
    [st.logros, 'logros'],
    [st.personas, 'personas conocidas'],
  ];
  return (
    <>
      <div class="stats">
        {items.map(([v, l]) => (
          <div class="stat" key={l}>
            <b>{v}</b>
            {l}
          </div>
        ))}
      </div>
      {st.destacadas.length > 0 && (
        <>
          <div class="kicker">MOMENTOS QUE MARCARON TU HISTORIA</div>
          <ul class="log-list">
            {st.destacadas.map((h, i) => (
              <li key={i} class={h.kind}>
                <span class="meta">Día {h.day}</span>
                <b>{h.title}</b>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}

export function StatsModal({ state, now, onClose }: { state: GameState; now: number; onClose: () => void }) {
  return (
    <div class="modal-wrap" onClick={onClose}>
      <div class="modal" onClick={(e) => e.stopPropagation()}>
        <div class="kicker">TU PARTIDA</div>
        <h3>
          <Letters text="Estadísticas" />
        </h3>
        <StatsView state={state} now={now} />
        <button class="btn secondary" onClick={onClose}>
          Cerrar
        </button>
      </div>
    </div>
  );
}

export function RewardModal({ title, text, onClose }: { title: string; text: string; onClose: () => void }) {
  return (
    <div class="deck deck-result is-good reward">
      <div class="card-stage">
        <div class="dcard result-card reward-card">
          <div class="reward-fire">🔥</div>
          <div class="stamp good">{title}</div>
          <h3 class="dcard-title">
            <Letters text={text} delay={200} />
          </h3>
          <p class="dcard-text">Sigue entrando cada día para no perderla.</p>
        </div>
      </div>
      <button class="btn big-cta" onClick={onClose}>
        ¡Vamos!
      </button>
    </div>
  );
}

// ---------------------------------------------------------------- tutorial

const TUT_KEY = 'laciudad.tutorial';

export interface TutStep {
  id: string;
  text: string;
  /** Dónde se coloca el globo. */
  at: 'top' | 'middle' | 'bottom';
}

export const TUTORIAL: TutStep[] = [
  { id: 'barras', at: 'top', text: 'Estas son tus 5 barras. Si una barra clave se vacía (o el estrés se llena), se acaba la partida.' },
  { id: 'mapa', at: 'middle', text: 'Esta es tu ciudad. Arrastra para moverte y pellizca para acercarte. Toca los edificios: la Bolsa abre la terminal.' },
  { id: 'trabajo', at: 'bottom', text: 'Cada día manda a tu personaje a trabajar: son 8 horas reales. Si un día no vas, pierdes la racha 🔥.' },
  { id: 'minijuego', at: 'bottom', text: '¿No quieres esperar? Juega al minijuego: cada acierto descuenta 10 minutos de la jornada.' },
  { id: 'tarjeta', at: 'top', text: 'Los sucesos llegan como tarjetas. Deslízala a la derecha, a la izquierda o hacia arriba para decidir.' },
  { id: 'herramientas', at: 'bottom', text: 'Abajo tienes la Bolsa, tu Agenda de decisiones, las Mejoras, los Logros y el Diario. En ☰ están el Armario y tu gente.' },
  { id: 'v06', at: 'bottom', text: 'Novedad: durante la jornada, el botón de Minijuegos abre 5 juegos distintos con récords. En ☰ puedes activar o quitar el sonido ambiente.' },
  { id: 'v05', at: 'bottom', text: 'Novedad: desliza la fila de botones. 🏗 Solares y obras (también tocando el mapa), 📻 Radio con trabajos extra, 🥤 tu Negocio o 📸 el Turismo de la ciudad.' },
];

export function tutorialSeen(): string[] {
  try {
    return JSON.parse(localStorage.getItem(TUT_KEY) ?? '[]');
  } catch {
    return [];
  }
}

export function markTutorial(id: string | 'todo') {
  try {
    const seen = id === 'todo' ? TUTORIAL.map((t) => t.id) : [...new Set([...tutorialSeen(), id])];
    localStorage.setItem(TUT_KEY, JSON.stringify(seen));
  } catch {
    /* sin almacenamiento */
  }
}

export function TutorialBubble({ step, onNext, onSkip }: { step: TutStep; onNext: () => void; onSkip: () => void }) {
  return (
    <div class={`tut tut-${step.at}`}>
      <div class="tut-bubble" key={step.id}>
        <div class="kicker">CÓMO SE JUEGA</div>
        <p>{step.text}</p>
        <div class="row">
          <button class="btn secondary small" onClick={onSkip}>
            Saltar tutorial
          </button>
          <button class="btn small" onClick={onNext}>
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
}
