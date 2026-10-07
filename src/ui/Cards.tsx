import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { Letters, Words } from './AnimText';
import { drawIcon } from '../art/icons';
import type { ChoiceDef } from '../core/events/types';
import { viewEvent, type ResolvedOutcome } from '../core/game';
import { ROLES } from '../core/roles';
import type { BarId, Bars, GameState, PendingEvent } from '../core/types';
import { play } from '../platform/audio';
import { afinidad, NPCS } from '../core/npcs';
import { CharacterCanvas } from './CharacterCanvas';
import { useSwipe, type Dir } from './useSwipe';

const KIND_LABEL = { aleatorio: 'SUCESO', personal: 'SUCESO PERSONAL', diario: 'HOY', accion: 'DECISIÓN', apertura: 'AL LLEGAR' } as const;

function Icon({ id, scale = 8 }: { id?: string; scale?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (ref.current) drawIcon(ref.current, id, scale);
  }, [id, scale]);
  return <canvas ref={ref} class="card-icon" />;
}

/** Barras que una opción puede mover (sin revelar si suben o bajan, como en Reigns). */
function affected(choice: ChoiceDef | undefined): Partial<Record<BarId, number>> {
  const out: Partial<Record<BarId, number>> = {};
  if (!choice) return out;
  const bump = (k: BarId, v: number) => (out[k] = Math.max(out[k] ?? 0, Math.abs(v)));
  if (choice.cost) bump('dinero', 10);
  for (const o of choice.outcomes) {
    for (const [k, v] of Object.entries(o.effects.bars ?? {}) as [BarId, number][]) bump(k, k === 'dinero' ? 10 : v);
    if (o.effects.moneyPct) bump('dinero', 10);
  }
  return out;
}

function BarStrip({ state, hint, deltas }: { state: GameState; hint?: Partial<Record<BarId, number>>; deltas?: Bars }) {
  const role = ROLES[state.character.role];
  return (
    <div class="bar-strip">
      {role.bars.map((b) => {
        const v = state.bars[b.id] ?? 0;
        const pct = b.moneyScale ? Math.max(0, Math.min(100, (v / b.moneyScale) * 100)) : v;
        const mag = hint?.[b.id];
        const d = deltas?.[b.id];
        const good = d !== undefined && (b.inverted ? d < 0 : d > 0);
        return (
          <div key={b.id} class={`strip-bar ${d !== undefined ? (good ? 'up' : 'down') : ''}`}>
            <div class="strip-ic">{b.icon}</div>
            <div class="strip-track">
              <div style={{ height: `${pct}%` }} class={b.inverted ? 'inv' : ''} />
            </div>
            <div class={`strip-dot ${mag ? (mag >= 8 ? 'big' : 'small') : ''}`} />
          </div>
        );
      })}
    </div>
  );
}

/** Quién protagoniza la tarjeta: un personaje recurrente o el otro protagonista. */
function NpcStrip({ state, npc, cross }: { state: GameState; npc?: string; cross?: boolean }) {
  const def = npc ? NPCS[npc] : undefined;
  const look = def?.look ?? (cross ? state.other?.look : undefined);
  if (!look) return null;
  const name = def?.name ?? state.other?.name ?? '';
  const title = def?.title ?? (state.other?.role === 'alcalde' ? 'El alcalde' : 'Trabaja en el diner');
  const af = npc ? afinidad(state, npc) : null;
  return (
    <div class="npc-strip">
      <CharacterCanvas look={look} scale={2} />
      <div>
        <b>{name}</b>
        <small>
          {title}
          {cross && state.other?.legacy ? ' · de tu otra partida' : ''}
        </small>
        {af !== null && <span class="hearts">{af >= 0 ? '♥'.repeat(af) + '♡'.repeat(5 - af) : '💔'.repeat(Math.min(3, -af))}</span>}
      </div>
    </div>
  );
}

export function DecisionCard({ state, pending, onDecide }: { state: GameState; pending: PendingEvent; onDecide: (choiceId: string) => void }) {
  const view = useMemo(() => viewEvent(state, pending), [pending.instanceId]);
  const choices = view.def.choices;
  // Derecha = primera opción, izquierda = segunda, arriba = tercera.
  const byDir: Record<Dir, ChoiceDef | undefined> = {
    right: choices[0],
    left: choices[1] ?? choices[0],
    up: choices[2],
  };
  const [flying, setFlying] = useState<Dir | null>(null);
  const [denied, setDenied] = useState(false);
  const blocked = (c?: ChoiceDef) => !!c?.requires && !c.requires.check(state);

  const choose = (dir: Dir | null) => {
    const c = dir ? byDir[dir] : undefined;
    if (!dir || !c) return;
    if (blocked(c)) {
      play.error();
      setDenied(true);
      setTimeout(() => setDenied(false), 450);
      return;
    }
    play.swipe();
    setFlying(dir);
    setTimeout(() => onDecide(c.id), 280);
  };

  const { drag, hint, handlers } = useSwipe({ allowUp: !!byDir.up, onRelease: choose });
  const active = flying ?? hint;
  const activeChoice = active ? byDir[active] : undefined;

  useEffect(() => play.notify(), [pending.instanceId]);

  const style = flying
    ? {
        transform: `translate(${flying === 'right' ? 520 : flying === 'left' ? -520 : 0}px, ${flying === 'up' ? -700 : 40}px) rotate(${flying === 'right' ? 28 : flying === 'left' ? -28 : 0}deg)`,
        transition: 'transform 0.28s ease-in',
      }
    : { transform: `translate(${drag.dx}px, ${drag.dy}px) rotate(${drag.dx / 14}deg)`, transition: drag.active ? 'none' : 'transform 0.25s' };

  const time = new Date(pending.firedAt).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
  const label = (c?: ChoiceDef) => (c ? `${blocked(c) ? '🔒 ' : ''}${c.label}` : '');

  return (
    <div class="deck">
      <BarStrip state={state} hint={affected(activeChoice)} />
      <div class="deck-kicker">
        {KIND_LABEL[view.def.kind]} · {time}
      </div>
      <div class="card-stage">
        <div class="card-shadow" />
        <div class={`dcard ${denied ? 'denied' : ''}`} style={style} {...handlers}>
          <div class={`dcard-choice ${active ?? ''} ${blocked(activeChoice) ? 'locked' : ''}`} style={{ opacity: active ? 1 : 0 }}>
            {label(activeChoice)}
            {activeChoice?.cost ? ` · ${ROLES[state.character.role].formatMoney(activeChoice.cost)}` : ''}
          </div>
          <div class="dcard-art">
            <Icon id={view.def.icon} />
          </div>
          <NpcStrip state={state} npc={view.def.npc} cross={view.def.cross} />
          <h3 class="dcard-title"><Letters text={view.def.title} /></h3>
          <p class="dcard-text"><Words text={view.intro} delay={250} /></p>
        </div>
      </div>
      <div class="deck-hints">
        {choices.length > 1 ? (
          <>
            <button class={`hint-btn left ${blocked(byDir.left) ? 'locked' : ''}`} onClick={() => choose('left')}>
              ◀ {label(byDir.left)}
            </button>
            <button class={`hint-btn right ${blocked(byDir.right) ? 'locked' : ''}`} onClick={() => choose('right')}>
              {label(byDir.right)} ▶
            </button>
          </>
        ) : (
          <button class="hint-btn single" onClick={() => choose('right')}>
            ◀ {label(byDir.right)} ▶
          </button>
        )}
        {byDir.up && (
          <button class={`hint-btn up ${blocked(byDir.up) ? 'locked' : ''}`} onClick={() => choose('up')}>
            ▲ {label(byDir.up)}
          </button>
        )}
      </div>
      {activeChoice?.hint || (blocked(activeChoice) && activeChoice?.requires) ? (
        <div class="deck-sub">{blocked(activeChoice) ? activeChoice!.requires!.label : activeChoice!.hint}</div>
      ) : (
        <div class="deck-sub muted">Desliza la tarjeta para decidir</div>
      )}
    </div>
  );
}

const CONFETTI = Array.from({ length: 28 }, (_, i) => ({
  a: (i / 28) * 360 + Math.random() * 10,
  d: 90 + Math.random() * 120,
  c: ['#ffd24a', '#5ce8ff', '#ff6fae', '#3fbf6a', '#ffffff'][i % 5],
  s: 4 + Math.floor(Math.random() * 3) * 2,
}));

export function ResultCard({ state, outcome, onClose }: { state: GameState; outcome: ResolvedOutcome; onClose: () => void }) {
  const good = outcome.outcome.result === 'bueno';
  const role = ROLES[state.character.role];
  useEffect(() => {
    if (good) play.good();
    else play.bad();
    try {
      navigator.vibrate?.(good ? [30, 40, 30] : [180]);
    } catch {
      /* sin vibración */
    }
  }, []);
  const entries = Object.entries(outcome.deltas) as [BarId, number][];
  return (
    <div class={`deck deck-result ${good ? 'is-good' : 'is-bad'}`}>
      {!good && <div class="flash" />}
      <BarStrip state={state} deltas={outcome.deltas} />
      <div class="deck-kicker">{outcome.event.title.toUpperCase()}</div>
      <div class="card-stage">
        {good && (
          <div class="confetti">
            {CONFETTI.map((p, i) => (
              <i
                key={i}
                style={{
                  background: p.c,
                  width: p.s,
                  height: p.s,
                  '--tx': `${Math.cos((p.a * Math.PI) / 180) * p.d}px`,
                  '--ty': `${Math.sin((p.a * Math.PI) / 180) * p.d}px`,
                } as any}
              />
            ))}
          </div>
        )}
        <div class="dcard result-card">
          <div class={`stamp ${good ? 'good' : 'bad'}`}>{good ? '✔ SALIÓ BIEN' : '✖ SALIÓ MAL'}</div>
          <h3 class="dcard-title"><Letters text={outcome.outcome.title} delay={350} /></h3>
          <p class="dcard-text"><Words text={outcome.message} delay={600} /></p>
          <div class="deltas">
            {entries.map(([id, d]) => {
              const def = role.bars.find((b) => b.id === id)!;
              const up = def.inverted ? d < 0 : d > 0;
              return (
                <span key={id} class={`delta ${up ? 'up' : 'down'}`}>
                  {def.icon} {def.label} {d > 0 ? '+' : '-'}
                  {def.moneyScale ? role.formatMoney(Math.abs(d)) : Math.abs(Math.round(d))}
                </span>
              );
            })}
          </div>
        </div>
      </div>
      <button class="btn big-cta" onClick={onClose}>
        Continuar
      </button>
    </div>
  );
}
