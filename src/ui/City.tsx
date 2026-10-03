import { Modal } from './Panels';
import {
  canTakeRadioJob,
  civicIncome,
  PET_MONTHLY,
  todayJobs,
  tourismFor,
  VENDING_INCOME,
  VENDING_PRICES,
} from '../core/game';
import { CIVIC, CIVIC_BY_ID, HOUSE_PHASES, HOUSE_RENT, LOT_BY_ID, LOT_PRICE, LOTS, ownedLot, RENOVATION } from '../core/lots';
import { ROLES } from '../core/roles';
import { formatDuration } from '../core/time';
import type { GameState } from '../core/types';
import { WEATHER_LABEL, weatherFor } from '../core/weather';

const BAR_LABEL: Record<string, string> = { popularidad: '⭐ Popularidad', control: '🏛 Control', estres: '😰 Estrés', salud: '❤ Salud', esperanza: '🌱 Esperanza', reputacion: '🤝 Reputación' };

function effects(bars: Record<string, number | undefined>) {
  return Object.entries(bars)
    .filter(([k]) => k !== 'dinero')
    .map(([k, v]) => `${BAR_LABEL[k] ?? k} ${v! > 0 ? '+' : ''}${v}`)
    .join(' · ');
}

function Buy({ money, cost, fmt, label = 'Comprar', onClick }: { money: number; cost: number; fmt: (n: number) => string; label?: string; onClick: () => void }) {
  return (
    <>
      <div class="progress small">
        <div style={{ width: `${Math.min(1, Math.max(0, money / cost)) * 100}%` }} />
      </div>
      <button class="btn small good" disabled={money < cost} onClick={onClick}>
        {money >= cost ? `${label} · ${fmt(cost)}` : `Faltan ${fmt(cost - money)}`}
      </button>
    </>
  );
}

function Works({ until, now, total }: { until: number; now: number; total: number }) {
  return (
    <>
      <div class="progress small works">
        <div style={{ width: `${Math.min(1, 1 - (until - now) / total) * 100}%` }} />
      </div>
      <div class="card-text muted">🚧 En obras · listo en {formatDuration(until - now)}</div>
    </>
  );
}

/** Ficha de un solar: comprar y construir (inmigrante) u obra pública (alcalde). */
export function LotCard({ state, lotId, now, onBuyLot, onBuildPhase, onBuildCivic }: {
  state: GameState;
  lotId: string;
  now: number;
  onBuyLot: (id: string) => void;
  onBuildPhase: () => void;
  onBuildCivic: (id: string, civic: string) => void;
}) {
  const def = LOT_BY_ID[lotId];
  const lot = state.lots?.[lotId];
  const role = ROLES[state.character.role];
  const money = state.bars.dinero ?? 0;
  const fmt = role.formatMoney;
  const isImm = state.character.role === 'inmigrante';

  if (isImm) {
    if (!lot) {
      const mine = ownedLot(state);
      return (
        <div class="card lot-card">
          <b>🪧 {def.label}</b>
          <div class="card-text">Tierra, hierbajos y un cartel de FOR SALE. Aquí podría levantarse tu casa.</div>
          {mine ? <div class="card-text muted">Ya tienes un solar: {LOT_BY_ID[mine].label}.</div> : <Buy money={money} cost={LOT_PRICE} fmt={fmt} label="Comprar solar" onClick={() => onBuyLot(lotId)} />}
        </div>
      );
    }
    const next = HOUSE_PHASES[lot.phase];
    return (
      <div class="card lot-card owned">
        <b>🏠 Tu casa · {def.label}</b>
        <ol class="phases">
          {HOUSE_PHASES.map((p, i) => (
            <li key={p.label} class={i < lot.phase ? 'done' : i === lot.phase && lot.buildingUntil ? 'doing' : ''}>
              <span>{i < lot.phase ? '✔' : i === lot.phase && lot.buildingUntil ? '🚧' : i + 1}</span> {p.label} <small>{fmt(p.cost)}</small>
            </li>
          ))}
        </ol>
        {lot.buildingUntil ? (
          <Works until={lot.buildingUntil} now={now} total={(HOUSE_PHASES[lot.phase]?.hours ?? 24) * 3_600_000} />
        ) : next ? (
          <>
            <div class="card-text">{next.text}</div>
            <Buy money={money} cost={next.cost} fmt={fmt} label={`Construir: ${next.label}`} onClick={onBuildPhase} />
          </>
        ) : (
          <div class="card-text good-text">¡Casa terminada! La alquilas por {fmt(HOUSE_RENT)} al día.</div>
        )}
      </div>
    );
  }

  if (!lot) {
    return (
      <div class="card lot-card">
        <b>🪧 {def.label}</b>
        <div class="card-text">Un solar municipal vacío. ¿Qué levantará la ciudad aquí?</div>
        <div class="civic-list">
          {CIVIC.map((c) => (
            <div key={c.id} class="civic">
              <div>
                <b>
                  {c.icon} {c.label}
                </b>
                <small>{c.description}</small>
                <small class="fx">
                  {effects(c.instant)}
                  {c.tourism ? ` · 📸 turismo +${Math.round(c.tourism * 100)}%` : ''}
                  {c.income ? ` · 💵 ${fmt(c.income)}/día` : ''} · {c.days} días
                </small>
              </div>
              <button class="btn small good" disabled={money < c.cost} onClick={() => onBuildCivic(lotId, c.id)}>
                {fmt(c.cost)}
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  }
  const c = CIVIC_BY_ID[lot.building];
  return (
    <div class="card lot-card owned">
      <b>
        {c.icon} {c.label} · {def.label}
      </b>
      <div class="card-text">{c.description}</div>
      {lot.buildingUntil ? (
        <Works until={lot.buildingUntil} now={now} total={c.days * 86_400_000} />
      ) : (
        <div class="card-text muted">
          Abierto{c.tourism ? ` · 📸 turismo +${Math.round(c.tourism * 100)}%` : ''}
          {c.income ? ` · 💵 ${fmt(c.income)}/día` : ''}
        </div>
      )}
    </div>
  );
}

/** Lista de solares (botón 🏗 del panel). */
export function ObrasModal(props: {
  state: GameState;
  now: number;
  onBuyLot: (id: string) => void;
  onBuildPhase: () => void;
  onBuildCivic: (id: string, civic: string) => void;
  onClose: () => void;
}) {
  const { state } = props;
  const isImm = state.character.role === 'inmigrante';
  const mine = ownedLot(state);
  const list = isImm && mine ? [mine, ...LOTS.map((l) => l.id).filter((id) => id !== mine)] : LOTS.map((l) => l.id);
  const renovated = Object.values(state.renovated ?? {}).reduce((a, b) => a + b, 0);
  return (
    <Modal title={isImm ? 'Tu solar' : 'Obras públicas'} kicker={isImm ? 'TERRENOS EN VENTA' : 'URBANISMO'} onClose={props.onClose}>
      <div class="card-text muted" style={{ marginBottom: 8 }}>
        {isImm
          ? 'Compra un solar y levanta tu casa fase a fase (un día cada una). Terminada, la alquilas. También puedes tocar los solares en el mapa.'
          : `Construye en los solares vacíos o toca cualquier manzana del mapa para renovarla. Manzanas renovadas: ${renovated} niveles.`}
      </div>
      <div class="stack">
        {list.map((id) => (
          <LotCard key={id} lotId={id} {...props} />
        ))}
      </div>
    </Modal>
  );
}

/** Renovar una manzana (alcalde), al tocarla en el mapa. */
export function BlockModal({ state, blockKey, now, onRenovate, onClose }: { state: GameState; blockKey: string; now: number; onRenovate: () => void; onClose: () => void }) {
  const fmt = ROLES.alcalde.formatMoney;
  const level = state.renovated?.[blockKey] ?? 0;
  const until = state.renovating?.[blockKey];
  const next = RENOVATION[level];
  const money = state.bars.dinero ?? 0;
  return (
    <Modal title={`Manzana ${blockKey}`} kicker="RENOVACIÓN URBANA" onClose={onClose}>
      <div class="stack">
        {RENOVATION.map((r) => (
          <div key={r.level} class={`card ${level >= r.level ? 'owned' : ''}`}>
            <b>
              Nivel {r.level} · {r.label} {level >= r.level && '✔'}
            </b>
            <div class="card-text muted">
              {effects(r.instant)} · 📸 turismo +{Math.round(r.tourism * 100)}% · {r.hours} h
            </div>
            {next?.level === r.level &&
              (until ? <Works until={until} now={now} total={r.hours * 3_600_000} /> : <Buy money={money} cost={r.cost} fmt={fmt} label="Renovar" onClick={onRenovate} />)}
          </div>
        ))}
      </div>
    </Modal>
  );
}

/** Radio: tres trabajos extra al día para el inmigrante. */
export function RadioModal({ state, now, onTake, onClose }: { state: GameState; now: number; onTake: (id: string) => void; onClose: () => void }) {
  const jobs = todayJobs(state);
  const why = canTakeRadioJob(state, now);
  const fmt = ROLES.inmigrante.formatMoney;
  return (
    <Modal title="Radio WNYC" kicker="📻 OFERTAS DE TRABAJO" onClose={onClose}>
      <div class="radio">
        <div class="radio-dial">
          <span>88</span>
          <span>92</span>
          <span class="on">96.4</span>
          <span>100</span>
          <span>104</span>
          <i />
        </div>
        <div class="card-text muted">Cada mañana el locutor lee los trabajos del día. Solo te da tiempo a uno, fuera de tu jornada.</div>
        <div class="stack">
          {jobs.map((j) => (
            <div key={j.id} class="card radio-job">
              <b>{j.label}</b>
              <div class="card-text ad">{j.ad}</div>
              <div class="card-text muted">
                ⏱ {j.hours} h · 💵 {fmt(j.pay)} · {effects(j.wear)}
              </div>
              <button class="btn small good" disabled={!!why} onClick={() => onTake(j.id)}>
                {why ?? 'Aceptar trabajo'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}

/** Negocio del inmigrante: máquinas expendedoras, alquiler y mascota. */
export function NegocioModal({ state, onBuy, onRepair, onClose }: { state: GameState; onBuy: () => void; onRepair: () => void; onClose: () => void }) {
  const fmt = ROLES.inmigrante.formatMoney;
  const v = state.vending ?? { count: 0, broken: 0 };
  const price = VENDING_PRICES[v.count];
  const money = state.bars.dinero ?? 0;
  const lot = ownedLot(state);
  const rent = lot && state.lots![lot].phase >= HOUSE_PHASES.length;
  const daily = (v.count - v.broken) * VENDING_INCOME + (rent ? HOUSE_RENT : 0);
  return (
    <Modal title="Tu negocio" kicker="INGRESOS PASIVOS" onClose={onClose}>
      <div class="passive-total">
        <small>Cada noche ganas</small>
        <b>{fmt(daily)}</b>
      </div>
      <div class="stack">
        <div class="card">
          <b>🥤 Máquinas expendedoras · {v.count}/{VENDING_PRICES.length}</b>
          <div class="vending-row">
            {VENDING_PRICES.map((_, i) => (
              <span key={i} class={`vm ${i < v.count ? (i < v.broken ? 'broken' : 'on') : ''}`} />
            ))}
          </div>
          <div class="card-text">Refrescos y chocolatinas en la lavandería, el bar, la pizzería… Cada máquina deja {fmt(VENDING_INCOME)} al día.</div>
          {v.broken > 0 && (
            <button class="btn small danger" disabled={money < 40 * v.broken} onClick={onRepair}>
              🔧 Reparar {v.broken} rota{v.broken > 1 ? 's' : ''} · {fmt(40 * v.broken)}
            </button>
          )}
          {price !== undefined ? <Buy money={money} cost={price} fmt={fmt} label="Instalar otra" onClick={onBuy} /> : <div class="card-text muted">Tienes todas las máquinas.</div>}
        </div>
        <div class={`card ${rent ? 'owned' : ''}`}>
          <b>🏠 Alquiler de tu casa</b>
          <div class="card-text">{rent ? `Tu casa está alquilada: ${fmt(HOUSE_RENT)} cada día.` : lot ? 'Termina tu casa para alquilarla.' : 'Compra un solar (🏗) y construye una casa para alquilarla.'}</div>
        </div>
        <div class="card">
          <b>{state.pet ? (state.pet.kind === 'gato' ? '🐱' : '🐶') : '🐾'} Mascota</b>
          <div class="card-text">
            {state.pet
              ? `${state.pet.name} vive contigo desde el día ${state.pet.since}. Te baja el estrés cada noche. Cuesta ${fmt(PET_MONTHLY)} al mes.`
              : 'Aún no tienes mascota. Quién sabe si alguna te encontrará por la calle…'}
          </div>
        </div>
      </div>
    </Modal>
  );
}

/** Turismo del alcalde: previsión del día e ingresos. */
export function TurismoModal({ state, onClose }: { state: GameState; onClose: () => void }) {
  const fmt = ROLES.alcalde.formatMoney;
  const t = tourismFor(state, state.today.date);
  const civic = civicIncome(state);
  const w = WEATHER_LABEL[weatherFor(state.seed, state.today.date)];
  const built = Object.values(state.lots ?? {}).filter((l) => l.owner === 'ciudad' && l.phase > 0);
  return (
    <Modal title="Turismo" kicker="📸 VISITANTES" onClose={onClose}>
      <div class="passive-total">
        <small>Previsión de hoy</small>
        <b>{t.tourists.toLocaleString('es')} turistas</b>
        <small>dejarán {fmt(t.income)} esta noche</small>
      </div>
      <div class="stack">
        <div class="card">
          <b>¿De qué depende?</b>
          <ul class="factors">
            <li>
              <span>⭐ Popularidad</span>
              <b>{Math.round(state.bars.popularidad ?? 0)}%</b>
            </li>
            <li>
              <span>🏛 Atractivos de la ciudad</span>
              <b>×{t.attractions.toFixed(2)}</b>
            </li>
            <li>
              <span>
                {w.icon} Clima: {w.label}
              </span>
              <b>×{t.weather.toFixed(2)}</b>
            </li>
            {state.flags.turistasAyer !== undefined && (
              <li>
                <span>Ayer vinieron</span>
                <b>{Number(state.flags.turistasAyer).toLocaleString('es')}</b>
              </li>
            )}
          </ul>
        </div>
        <div class="card">
          <b>🏗 Obras públicas abiertas · {fmt(civic)}/día</b>
          {built.length ? (
            <ul class="factors">
              {built.map((l) => {
                const c = CIVIC_BY_ID[l.building];
                return (
                  <li key={l.building + c.label}>
                    <span>
                      {c.icon} {c.label}
                    </span>
                    <b>{c.tourism ? `+${Math.round(c.tourism * 100)}%` : c.income ? fmt(c.income) : '—'}</b>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div class="card-text muted">Aún no has inaugurado nada. El museo, el parque y el metro atraen turistas.</div>
          )}
        </div>
        <div class="card-text muted">Renovar manzanas (tócalas en el mapa) también hace la ciudad más atractiva.</div>
      </div>
    </Modal>
  );
}
