import { achievementsFor } from '../core/achievements';
import { actionsFor, actionStatus, todayNews } from '../core/game';
import { COMPANIES } from '../core/market';
import { ROLES } from '../core/roles';
import type { GameState } from '../core/types';
import { UPGRADES } from '../core/upgrades';
import { startOfDay } from '../core/time';

function Modal({ title, onClose, children, kicker }: { title: string; onClose: () => void; children: any; kicker?: string }) {
  return (
    <div class="modal-wrap" onClick={onClose}>
      <div class="modal" onClick={(e) => e.stopPropagation()}>
        {kicker && <div class="kicker">{kicker}</div>}
        <h3>{title}</h3>
        {children}
        <button class="btn secondary" style={{ marginTop: 12 }} onClick={onClose}>
          Cerrar
        </button>
      </div>
    </div>
  );
}

export function AgendaModal({ state, now, onPick, onClose }: { state: GameState; now: number; onPick: (id: string) => void; onClose: () => void }) {
  const actions = actionsFor(state);
  return (
    <Modal title="Agenda" kicker="DECISIONES PERSONALES" onClose={onClose}>
      <div class="stack">
        {actions.map((a) => {
          const st = actionStatus(state, a, now);
          return (
            <div key={a.id} class="card">
              <b>{a.title}</b>
              <div class="card-text">{a.summary}</div>
              <button class="btn small" disabled={!st.ok} onClick={() => onPick(a.id)}>
                {st.ok ? 'Decidir' : st.reason}
              </button>
            </div>
          );
        })}
      </div>
    </Modal>
  );
}

export function UpgradeModal({ state, onBuy, onClose }: { state: GameState; onBuy: () => void; onClose: () => void }) {
  const role = ROLES[state.character.role];
  const up = UPGRADES[state.character.role];
  const money = state.bars.dinero ?? 0;
  const next = up.levels[state.upgradeLevel];
  return (
    <Modal title={`${up.icon} ${up.title}`} kicker="MEJORA PERMANENTE" onClose={onClose}>
      <div class="stack">
        {up.levels.map((l) => {
          const owned = state.upgradeLevel >= l.level;
          const isNext = next && next.level === l.level;
          const progress = Math.max(0, Math.min(1, money / l.cost));
          return (
            <div key={l.level} class={`card ${owned ? 'owned' : ''}`}>
              <b>
                Nivel {l.level} · {l.name} {owned && '✔'}
              </b>
              <div class="card-text">{l.description}</div>
              <div class="card-text muted">Precio: {role.formatMoney(l.cost)}</div>
              {isNext && (
                <>
                  <div class="progress small">
                    <div style={{ width: `${progress * 100}%` }} />
                  </div>
                  <button class="btn small good" disabled={money < l.cost} onClick={onBuy}>
                    {money >= l.cost ? 'Comprar' : `Faltan ${role.formatMoney(l.cost - money)}`}
                  </button>
                </>
              )}
            </div>
          );
        })}
        <div class="card-text muted">
          {state.character.role === 'inmigrante'
            ? 'Cada nivel de la casa sube tu salud al comprarlo y te hace recuperar más salud cada noche.'
            : 'Cada nivel del ayudante sube el control de la ciudad cada día y reduce el estrés de tus jornadas.'}
        </div>
      </div>
    </Modal>
  );
}

export function AchievementsModal({ state, onClose }: { state: GameState; onClose: () => void }) {
  const list = achievementsFor(state.character.role);
  const done = list.filter((a) => state.achievements[a.id]).length;
  return (
    <Modal title={`Objetivos ${done}/${list.length}`} kicker="LOGROS" onClose={onClose}>
      <ul class="ach-list">
        {list.map((a, i) => {
          const ok = !!state.achievements[a.id];
          return (
            <li key={a.id} class={`${ok ? 'ok' : ''} ${a.final ? 'final' : ''}`}>
              <span class="ach-n">{ok ? '🏆' : i + 1}</span>
              <span>
                <b>{a.title}</b>
                {a.description}
              </span>
            </li>
          );
        })}
      </ul>
    </Modal>
  );
}

export function NewsModal({ state, onClose }: { state: GameState; onClose: () => void }) {
  const news = todayNews(state);
  const name = (t: string) => COMPANIES.find((c) => c.ticker === t)?.name ?? t;
  return (
    <div class="modal-wrap">
      <div class="newspaper">
        <div class="paper-head">THE DAILY LEDGER</div>
        <div class="paper-sub">Edición financiera · {new Date(startOfDay(state.today.date)).toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
        {news.map((n) => (
          <div key={n.ticker} class="paper-item">
            <b>{n.headline}</b>
            <span>
              {name(n.ticker)} ({n.ticker}) · los analistas esperan que {n.hint === 'up' ? 'SUBA ▲' : 'BAJE ▼'}
            </span>
          </div>
        ))}
        <div class="paper-foot">Las noticias no siempre aciertan. Puedes apostar en la bolsa durante tu jornada.</div>
        <button class="btn" onClick={onClose}>
          Doblar el periódico
        </button>
      </div>
    </div>
  );
}

export function EndingModal({ state, onClose }: { state: GameState; onClose: () => void }) {
  const e = state.ending!;
  return (
    <div class="modal-wrap">
      <div class="modal ending">
        <div class="kicker">OBJETIVO FINAL CUMPLIDO · DÍA {e.day}</div>
        <h3>{e.title}</h3>
        <p>{e.text}</p>
        <div class="stats">
          <div class="stat">
            <b>{Object.keys(state.achievements).length}</b>logros
          </div>
          <div class="stat">
            <b>{state.bestStreak}</b>mejor racha
          </div>
        </div>
        <button class="btn good" onClick={onClose}>
          Seguir viviendo en la ciudad
        </button>
      </div>
    </div>
  );
}
