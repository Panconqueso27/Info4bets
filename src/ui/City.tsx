import { useState } from 'preact/hooks';
import { Modal } from './Panels';
import {
  businessIncome,
  civicIncome,
  dayNumber,
  PET_MONTHLY,
  priceOfLot,
  tourismFor,
  VENDING_INCOME,
  VENDING_PRICES,
} from '../core/game';
import {
  auctionPrice,
  BIZ_BY_ID,
  BUSINESSES,
  CIVIC,
  CIVIC_BY_ID,
  civicMul,
  civicUpgrade,
  districtLevel,
  HOUSE_PHASES,
  LOT_BY_ID,
  lotLevel,
  LOTS,
  MAX_LOTS,
  MEGA,
  MEGA_BY_ID,
  megaDone,
  ownedLots,
  RENOVATION,
} from '../core/lots';
import { CAT_LABEL, lotTitle } from '../core/economy';
import { DISTRICTS, type District } from '../core/city';
import { ROLES } from '../core/roles';
import { formatDuration } from '../core/time';
import type { GameState } from '../core/types';
import { WEATHER_LABEL, weatherFor } from '../core/weather';
import { PixelIcon } from './PixelIcon';

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
        <div style={{ width: `${Math.min(1, Math.max(0, 1 - (until - now) / total)) * 100}%` }} />
      </div>
      <div class="card-text muted">🚧 En obras · listo en {formatDuration(until - now)}</div>
    </>
  );
}

function Stars({ n, max = 3 }: { n: number; max?: number }) {
  return (
    <span class="lvl-stars">
      {'★'.repeat(n)}
      {'☆'.repeat(Math.max(0, max - n))}
    </span>
  );
}

export interface CityActions {
  onBuyLot: (id: string) => void;
  onBuildPhase: (lotId: string) => void;
  onBuildBiz: (lotId: string, biz: string) => void;
  onUpgradeLot: (lotId: string) => void;
  onBuildCivic: (lotId: string, civic: string) => void;
  onUpgradeCivic: (lotId: string) => void;
  onAuction: (lotId: string) => void;
  onStartMega: (id: string) => void;
}

/** Ficha de un solar: comprar y construir (inmigrante) u obra pública (alcalde). */
export function LotCard({ state, lotId, now, ...act }: { state: GameState; lotId: string; now: number } & CityActions) {
  const def = LOT_BY_ID[lotId];
  const lot = state.lots?.[lotId];
  const role = ROLES[state.character.role];
  const money = state.bars.dinero ?? 0;
  const fmt = role.formatMoney;
  const isImm = state.character.role === 'inmigrante';
  const day = dayNumber(state, now);
  const dLvl = districtLevel(state, def.district, day);
  const where = (
    <div class="lot-where">
      📍 {DISTRICTS[def.district].label} · barrio <Stars n={dLvl} />
    </div>
  );

  if (lot?.owner === 'privado') {
    return (
      <div class="card lot-card">
        <b>🏢 Oficinas Hudson · {def.label}</b>
        {where}
        <div class="card-text muted">Subastado a una empresa privada.</div>
      </div>
    );
  }

  if (isImm) {
    if (!lot) {
      const mine = ownedLots(state).length;
      return (
        <div class="card lot-card">
          <b>🪧 {def.label}</b>
          {where}
          <div class="card-text">Tierra, hierbajos y un cartel de FOR SALE.</div>
          {mine >= MAX_LOTS ? <div class="card-text muted">Ya tienes {MAX_LOTS} solares.</div> : <Buy money={money} cost={priceOfLot(state, lotId, now)} fmt={fmt} label="Comprar solar" onClick={() => act.onBuyLot(lotId)} />}
        </div>
      );
    }
    if (lot.building === 'vacio') {
      return (
        <div class="card lot-card owned">
          <b>🪧 {def.label} · tuyo</b>
          {where}
          <div class="card-text">¿Qué levantas aquí?</div>
          <div class="civic-list">
            <div class="civic">
              <div>
                <b>🏠 Casa de alquiler</b>
                <small>Por fases (4 días) y luego dúplex y edificio. Alquiler hasta {fmt(BIZ_BY_ID.casa.levels[2].income)}/día.</small>
              </div>
              <button class="btn small good" disabled={money < HOUSE_PHASES[0].cost} onClick={() => act.onBuildPhase(lotId)}>
                {fmt(HOUSE_PHASES[0].cost)}
              </button>
            </div>
            {BUSINESSES.filter((b) => b.id !== 'casa').map((b) => (
              <div key={b.id} class="civic">
                <div>
                  <b>
                    {b.icon} {b.label}
                  </b>
                  <small>{b.description}</small>
                  <small class="fx">
                    💵 {fmt(b.levels[0].income)}/día → hasta {fmt(b.levels[2].income)}/día · abre en {b.levels[0].days} día{b.levels[0].days > 1 ? 's' : ''}
                  </small>
                </div>
                <button class="btn small good" disabled={money < b.levels[0].cost} onClick={() => act.onBuildBiz(lotId, b.id)}>
                  {fmt(b.levels[0].cost)}
                </button>
              </div>
            ))}
          </div>
        </div>
      );
    }
    const biz = BIZ_BY_ID[lot.building];
    const lvl = lotLevel(lot);
    const inPhases = lot.building === 'casa' && lot.phase < HOUSE_PHASES.length;
    const next = biz.levels[lvl];
    const income = businessIncome(state, day).find((b) => b.id === lotId)?.income ?? 0;
    return (
      <div class="card lot-card owned">
        <b>
          {biz.icon} {lotTitle(state, lotId)} <Stars n={lvl} />
        </b>
        {where}
        {income > 0 && <div class="card-text good-text">💵 Te deja {fmt(income)} cada día</div>}
        {inPhases && (
          <ol class="phases">
            {HOUSE_PHASES.map((p, i) => (
              <li key={p.label} class={i < lot.phase ? 'done' : i === lot.phase && lot.buildingUntil ? 'doing' : ''}>
                <span>{i < lot.phase ? '✔' : i === lot.phase && lot.buildingUntil ? '🚧' : i + 1}</span> {p.label} <small>{fmt(p.cost)}</small>
              </li>
            ))}
          </ol>
        )}
        {lot.buildingUntil ? (
          <Works until={lot.buildingUntil} now={now} total={(inPhases ? HOUSE_PHASES[lot.phase].hours / 24 : next?.days ?? biz.levels[0].days) * 86_400_000} />
        ) : inPhases ? (
          <>
            <div class="card-text">{HOUSE_PHASES[lot.phase].text}</div>
            <Buy money={money} cost={HOUSE_PHASES[lot.phase].cost} fmt={fmt} label={`Construir: ${HOUSE_PHASES[lot.phase].label}`} onClick={() => act.onBuildPhase(lotId)} />
          </>
        ) : next ? (
          <>
            <div class="card-text muted">
              Siguiente: <b>{next.name}</b> · {fmt(next.income)}/día · {next.days} días de obra
            </div>
            <Buy money={money} cost={next.cost} fmt={fmt} label="Ampliar" onClick={() => act.onUpgradeLot(lotId)} />
          </>
        ) : (
          <div class="card-text good-text">¡Al máximo!</div>
        )}
      </div>
    );
  }

  if (!lot) {
    return (
      <div class="card lot-card">
        <b>🪧 {def.label}</b>
        {where}
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
              <button class="btn small good" disabled={money < c.cost} onClick={() => act.onBuildCivic(lotId, c.id)}>
                {fmt(c.cost)}
              </button>
            </div>
          ))}
        </div>
        <button class="btn small secondary" onClick={() => act.onAuction(lotId)}>
          🔨 Subastarlo a una empresa · +{fmt(auctionPrice(def, dLvl))}
        </button>
      </div>
    );
  }
  const c = CIVIC_BY_ID[lot.building];
  const lvl = lotLevel(lot);
  const up = lvl > 0 && lvl < 3 ? civicUpgrade(c, lvl + 1) : null;
  const mul = civicMul(lvl);
  return (
    <div class="card lot-card owned">
      <b>
        {c.icon} {lotTitle(state, lotId)} <Stars n={lvl} />
      </b>
      {where}
      <div class="card-text">{c.description}</div>
      {lot.buildingUntil ? (
        <Works until={lot.buildingUntil} now={now} total={(lot.phase === 0 ? c.days : civicUpgrade(c, lvl + 1).days) * 86_400_000} />
      ) : (
        <>
          <div class="card-text muted">
            Abierto{c.tourism ? ` · 📸 turismo +${Math.round(c.tourism * mul * 100)}%` : ''}
            {c.income ? ` · 💵 ${fmt(Math.round(c.income * mul))}/día` : ''}
          </div>
          {up && (
            <>
              <div class="card-text muted">
                Siguiente: <b>{c.levels[lvl]}</b> · ×{civicMul(lvl + 1)} turismo e ingresos · {up.days} días
              </div>
              <Buy money={money} cost={up.cost} fmt={fmt} label="Ampliar" onClick={() => act.onUpgradeCivic(lotId)} />
            </>
          )}
        </>
      )}
    </div>
  );
}

/** Ficha de un gran proyecto. */
export function MegaCard({ state, id, now, onStart }: { state: GameState; id: string; now: number; onStart: (id: string) => void }) {
  const m = MEGA_BY_ID[id];
  const fmt = ROLES[state.character.role].formatMoney;
  const day = dayNumber(state, now);
  const p = state.projects?.[id];
  const money = state.bars.dinero ?? 0;
  const isMayor = state.character.role === 'alcalde';
  const done = megaDone(state, id, day);
  return (
    <div class={`card lot-card ${done ? 'owned' : ''}`}>
      <b>
        {m.icon} {m.label} {done && '✔'}
      </b>
      <div class="card-text">{m.description}</div>
      <div class="card-text muted">
        📸 turismo +{Math.round(m.tourism * 100)}% · 💵 {fmt(m.income)}/día · {m.days} días de obra
      </div>
      {isMayor ? (
        p && !p.done ? (
          <Works until={p.until} now={now} total={m.days * 86_400_000} />
        ) : !p ? (
          <Buy money={money} cost={m.cost} fmt={fmt} label="Lanzar proyecto" onClick={() => onStart(id)} />
        ) : null
      ) : (
        !done && <div class="card-text muted">El ayuntamiento lo inaugurará hacia el día {m.autoDay}.</div>
      )}
    </div>
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

// ---------------------------------------------------------------------------
// Panel de propiedades: resumen, solares, negocio/turismo, proyectos y cuentas
// ---------------------------------------------------------------------------

type Tab = 'resumen' | 'solares' | 'extra' | 'proyectos' | 'cuentas';

export function PropertiesModal({
  state,
  now,
  onBuyVending,
  onRepairVending,
  onClose,
  ...act
}: { state: GameState; now: number; onBuyVending: () => void; onRepairVending: () => void; onClose: () => void } & CityActions) {
  const isImm = state.character.role === 'inmigrante';
  const [tab, setTab] = useState<Tab>('resumen');
  const tabs: [Tab, string][] = isImm
    ? [
        ['resumen', 'Resumen'],
        ['solares', 'Solares'],
        ['extra', 'Negocio'],
        ['cuentas', 'Cuentas'],
      ]
    : [
        ['resumen', 'Resumen'],
        ['solares', 'Obras'],
        ['proyectos', 'Proyectos'],
        ['extra', 'Turismo'],
        ['cuentas', 'Cuentas'],
      ];
  return (
    <Modal title="Propiedades" kicker={isImm ? 'TU PATRIMONIO' : 'LA CIUDAD'} onClose={onClose}>
      <div class="tabs">
        {tabs.map(([id, label]) => (
          <button key={id} class={`tab ${tab === id ? 'on' : ''}`} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>
      {tab === 'resumen' && <Summary state={state} now={now} onGo={setTab} />}
      {tab === 'solares' && <LotsList state={state} now={now} {...act} />}
      {tab === 'proyectos' && (
        <div class="stack">
          {MEGA.map((m) => (
            <MegaCard key={m.id} state={state} id={m.id} now={now} onStart={act.onStartMega} />
          ))}
        </div>
      )}
      {tab === 'extra' && (isImm ? <Business state={state} onBuy={onBuyVending} onRepair={onRepairVending} /> : <Tourism state={state} />)}
      {tab === 'cuentas' && <LedgerView state={state} />}
    </Modal>
  );
}

function Summary({ state, now, onGo }: { state: GameState; now: number; onGo: (t: Tab) => void }) {
  const fmt = ROLES[state.character.role].formatMoney;
  const isImm = state.character.role === 'inmigrante';
  const day = dayNumber(state, now);
  const rows: { icon: string; label: string; value: number; sub?: string }[] = [];
  if (isImm) {
    const v = state.vending;
    if (v?.count) rows.push({ icon: '🥤', label: `${v.count} máquina${v.count > 1 ? 's' : ''} expendedora${v.count > 1 ? 's' : ''}`, value: (v.count - v.broken) * VENDING_INCOME, sub: v.broken ? `${v.broken} rota${v.broken > 1 ? 's' : ''}` : undefined });
    for (const b of businessIncome(state, day)) rows.push({ icon: BIZ_BY_ID[state.lots![b.id].building].icon, label: lotTitle(state, b.id), value: b.income, sub: LOT_BY_ID[b.id].label });
    if (state.pet) rows.push({ icon: state.pet.kind === 'gato' ? '🐱' : '🐶', label: state.pet.name, value: -Math.round(PET_MONTHLY / 30), sub: `${fmt(PET_MONTHLY)} al mes` });
    const rent = Number(state.flags.alquilerExtra ?? 0);
    if (rent) rows.push({ icon: '🏚', label: 'Subida del alquiler de tu cuarto', value: -rent });
  } else {
    const t = tourismFor(state, state.today.date);
    rows.push({ icon: '📸', label: `Turismo (${t.tourists.toLocaleString('es')} visitantes)`, value: t.income });
    for (const [id, lot] of Object.entries(state.lots ?? {})) if (lot.owner === 'ciudad' && lot.phase > 0) rows.push({ icon: CIVIC_BY_ID[lot.building].icon, label: lotTitle(state, id), value: Math.round(CIVIC_BY_ID[lot.building].income * civicMul(lotLevel(lot))) });
    for (const [id, p] of Object.entries(state.projects ?? {})) if (p.done) rows.push({ icon: MEGA_BY_ID[id].icon, label: MEGA_BY_ID[id].label, value: MEGA_BY_ID[id].income });
    for (const b of state.bonds ?? []) rows.push({ icon: '📜', label: `Bono de ${fmt(b.amount)}`, value: 0, sub: `vence en ${formatDuration(b.until - now)} con ${Math.round(b.rate * 100)}%` });
  }
  const total = rows.reduce((a, r) => a + r.value, 0);
  const districts = Object.keys(DISTRICTS) as District[];
  return (
    <>
      <div class="passive-total">
        <small>Cada noche ganas</small>
        <b>{fmt(total)}</b>
      </div>
      {rows.length ? (
        <ul class="factors props">
          {rows.map((r, i) => (
            <li key={i}>
              <span>
                {r.icon} {r.label}
                {r.sub && <small> · {r.sub}</small>}
              </span>
              <b class={r.value < 0 ? 'neg' : ''}>{r.value ? `${r.value > 0 ? '+' : ''}${fmt(r.value)}` : '—'}</b>
            </li>
          ))}
        </ul>
      ) : (
        <div class="card-text muted">Aún no tienes nada que dé dinero solo. Mira la pestaña {isImm ? 'Solares o Negocio' : 'Obras'}.</div>
      )}
      <div class="card" style={{ marginTop: 10 }}>
        <b>🏙 Nivel de los barrios</b>
        <ul class="factors">
          {districts.map((d) => (
            <li key={d}>
              <span>{DISTRICTS[d].label}</span>
              <b>
                <Stars n={districtLevel(state, d, day)} />
              </b>
            </li>
          ))}
        </ul>
        <div class="card-text muted">Construir sube el nivel del barrio: más vida en la calle, solares más caros y negocios que ganan más.</div>
      </div>
      <button class="btn small secondary" style={{ marginTop: 8 }} onClick={() => onGo('cuentas')}>
        📒 Ver las cuentas de la semana
      </button>
    </>
  );
}

function LotsList({ state, now, ...act }: { state: GameState; now: number } & CityActions) {
  const isImm = state.character.role === 'inmigrante';
  const mine = ownedLots(state);
  const ids = LOTS.map((l) => l.id);
  const list = isImm ? [...mine, ...ids.filter((id) => !mine.includes(id) && !state.lots?.[id])] : [...ids.filter((id) => state.lots?.[id]?.owner === 'ciudad'), ...ids.filter((id) => !state.lots?.[id])];
  const renovated = Object.values(state.renovated ?? {}).reduce((a, b) => a + b, 0);
  return (
    <>
      <div class="card-text muted" style={{ marginBottom: 8 }}>
        {isImm
          ? `Tienes ${mine.length}/${MAX_LOTS} solares. En cada uno, una casa de alquiler o un negocio. También puedes tocarlos en el mapa.`
          : `Construye en los solares vacíos o toca cualquier manzana del mapa para renovarla (renovaciones: ${renovated}).`}
      </div>
      <div class="stack">
        {list.map((id) => (
          <LotCard key={id} state={state} lotId={id} now={now} {...act} />
        ))}
      </div>
    </>
  );
}

function Business({ state, onBuy, onRepair }: { state: GameState; onBuy: () => void; onRepair: () => void }) {
  const fmt = ROLES.inmigrante.formatMoney;
  const v = state.vending ?? { count: 0, broken: 0 };
  const price = VENDING_PRICES[v.count];
  const money = state.bars.dinero ?? 0;
  return (
    <div class="stack">
      <div class="card">
        <b>
          🥤 Máquinas expendedoras · {v.count}/{VENDING_PRICES.length}
        </b>
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
      <div class="card">
        <b>{state.pet ? (state.pet.kind === 'gato' ? '🐱' : '🐶') : '🐾'} Mascota</b>
        <div class="card-text">
          {state.pet
            ? `${state.pet.name} vive contigo desde el día ${state.pet.since}. Te baja el estrés cada noche. Cuesta ${fmt(PET_MONTHLY)} al mes.`
            : 'Aún no tienes mascota. Quién sabe si alguna te encontrará por la calle…'}
        </div>
      </div>
      <div class="card-text muted">Cada mes llegan impuestos por tus propiedades y licencias, y tu casero sube el alquiler.</div>
    </div>
  );
}

function Tourism({ state }: { state: GameState }) {
  const fmt = ROLES.alcalde.formatMoney;
  const t = tourismFor(state, state.today.date);
  const civic = civicIncome(state);
  const w = WEATHER_LABEL[weatherFor(state.seed, state.today.date)];
  return (
    <>
      <div class="passive-total">
        <small>Previsión de hoy</small>
        <b>{t.tourists.toLocaleString('es')} turistas</b>
        <small>dejarán {fmt(t.income)} esta noche</small>
      </div>
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
          <li>
            <span>🏗 Obras y grandes proyectos</span>
            <b>{fmt(civic)}/día</b>
          </li>
        </ul>
      </div>
      <div class="card-text muted">Museos, parques, metro, renovaciones y grandes proyectos atraen turistas. Los mítines de barrio suben la popularidad.</div>
    </>
  );
}

export function LedgerView({ state }: { state: GameState }) {
  const fmt = ROLES[state.character.role].formatMoney;
  const [which, setWhich] = useState<'now' | 'last'>('now');
  const l = which === 'now' ? state.ledger : state.lastLedger;
  const entries = Object.entries(l?.cats ?? {}).filter(([, v]) => Math.round(v) !== 0).sort((a, b) => b[1] - a[1]);
  const net = entries.reduce((a, [, v]) => a + v, 0);
  return (
    <>
      <div class="tabs small">
        <button class={`tab ${which === 'now' ? 'on' : ''}`} onClick={() => setWhich('now')}>
          Esta semana
        </button>
        <button class={`tab ${which === 'last' ? 'on' : ''}`} onClick={() => setWhich('last')} disabled={!state.lastLedger}>
          La anterior
        </button>
      </div>
      <div class="ledger-book">
        <div class="ledger-title">
          <PixelIcon id="libro" size={2} /> Libro de cuentas · semana {(l?.week ?? 0) + 1}
        </div>
        {entries.length ? (
          <ul>
            {entries.map(([k, v]) => (
              <li key={k}>
                <span>{CAT_LABEL[k] ?? k}</span>
                <b class={v < 0 ? 'neg' : 'pos'}>
                  {v > 0 ? '+' : ''}
                  {fmt(Math.round(v))}
                </b>
              </li>
            ))}
          </ul>
        ) : (
          <div class="card-text muted">Aún no hay movimientos.</div>
        )}
        <div class={`ledger-net ${net >= 0 ? 'pos' : 'neg'}`}>
          Balance: {net >= 0 ? '+' : ''}
          {fmt(Math.round(net))}
        </div>
      </div>
      <div class="card-text muted">Cada domingo por la noche cierra la semana y se sortea la lotería.</div>
    </>
  );
}
