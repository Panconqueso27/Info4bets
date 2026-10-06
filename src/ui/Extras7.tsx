import { useEffect, useState } from 'preact/hooks';
import { Modal } from './Panels';
import { PixelIcon } from './PixelIcon';
import {
  baseballGame,
  betStakes,
  BOND_TERMS,
  canBaseball,
  canHotdogs,
  canRace,
  canRastro,
  canTaxi,
  canTeach,
  CLASS_PAY,
  HORSES,
  HOTDOG_PER_POINT,
  lotteryDraw,
  MAX_BONDS,
  MAX_TICKETS,
  racesOpen,
  rastroBought,
  rastroItems,
  rastroOpen,
  TAXI_HOURS,
  taxiPay,
  ticketPrice,
  canCasino,
  CASINO_MIN_AGE,
} from '../core/economy';
import { actionsFor, actionStatus, canStartErrand, canTakeRadioJob, dayNumber, ERRAND_PAY, errandHours, todayJobs, weekOf } from '../core/game';
import { ROLES } from '../core/roles';
import { formatDuration } from '../core/time';
import type { GameState } from '../core/types';
import { play } from '../platform/audio';
import { exportCode, importCode } from '../platform/save';
import { canEnterContest, CONTEST_BY_ID, CONTESTS, contestDays, contestFee, contestOpen, contestPrizes, contestRivals, type ContestResult } from '../core/contests';

export type ExtraPanel = 'rastro' | 'carreras' | 'beisbol' | 'loteria' | 'bonos' | 'concursos' | 'casino';

export interface ExtrasActions {
  onRadio: (id: string) => void;
  onErrand: () => void;
  onTaxi: () => void;
  onClasses: () => void;
  onHotdogs: () => void;
  onOpen: (p: ExtraPanel) => void;
  onAction: (id: string) => void;
  onAuction: () => void;
}

function Activity({ icon, title, text, status, cta, onClick }: { icon: string; title: string; text: string; status: string | null; cta: string; onClick: () => void }) {
  return (
    <div class={`activity ${status ? 'off' : ''}`}>
      <PixelIcon id={icon} size={3} />
      <div class="activity-info">
        <b>{title}</b>
        <small>{text}</small>
      </div>
      <button class="btn small good" disabled={!!status} onClick={onClick}>
        {status ?? cta}
      </button>
    </div>
  );
}

/** 🎯 Extras: misiones del día y todo lo que se puede hacer fuera del trabajo. */
export function ExtrasModal({ state, now, onClose, ...a }: { state: GameState; now: number; onClose: () => void } & ExtrasActions) {
  const fmt = ROLES[state.character.role].formatMoney;
  const isImm = state.character.role === 'inmigrante';
  const ms = state.missions?.date === state.today.date ? state.missions.list : [];
  const [showJobs, setShowJobs] = useState(false);
  const weekend = racesOpen(state);
  const actions = actionsFor(state).filter((d) => d.id === 'cena-recaudacion' || d.id === 'mitin-barrio');
  const errand = canStartErrand(state, now);
  return (
    <Modal title="Extras" kicker="DINERO FUERA DEL TRABAJO" onClose={onClose}>
      <div class="missions">
        <div class="missions-head">
          <PixelIcon id="diana" size={2} /> MISIONES DE HOY
        </div>
        {ms.map((m) => (
          <div key={m.id} class={`mission ${m.done ? 'done' : ''}`}>
            <span class="mission-check">{m.done ? '✔' : '○'}</span>
            <div class="mission-info">
              <span>{m.label}</span>
              <div class="progress tiny">
                <div style={{ width: `${(m.progress / m.target) * 100}%` }} />
              </div>
            </div>
            <b>+{fmt(m.reward)}</b>
          </div>
        ))}
        <small class="muted">Cumple las 3 y te llevas un bonus.</small>
      </div>
      {state.errand && (
        <div class="card-text warn-box">
          ⏳ {state.errand.label ?? 'Repartiendo paquetes'} · vuelve en {formatDuration(state.errand.endsAt - now)}
        </div>
      )}
      <div class="activities">
        {isImm ? (
          <>
            <Activity icon="radio" title="Radio WNYC" text="3 trabajos extra al día: puerto, mudanzas, niñera…" status={canTakeRadioJob(state, now)} cta={showJobs ? 'Ocultar' : 'Ver ofertas'} onClick={() => setShowJobs(!showJobs)} />
            {showJobs && (
              <div class="radio-jobs">
                {todayJobs(state).map((j) => (
                  <div key={j.id} class="card radio-job">
                    <b>{j.label}</b>
                    <div class="card-text ad">{j.ad}</div>
                    <div class="card-text muted">
                      ⏱ {j.hours} h · 💵 {fmt(j.pay)}
                    </div>
                    <button class="btn small good" onClick={() => a.onRadio(j.id)}>
                      Aceptar
                    </button>
                  </div>
                ))}
              </div>
            )}
            <Activity icon="carta" title="Reparto de paquetes" text={`${errandHours(state)} h por la ciudad · ${fmt(ERRAND_PAY)}`} status={errand === 'done-today' ? 'Hecho hoy' : errand ? 'Ahora no' : null} cta="Salir" onClick={a.onErrand} />
            <Activity icon="taxi" title="Taxi" text={`${TAXI_HOURS} h de carreras · ${fmt(taxiPay(state, now).pay)} (más de noche y con lluvia)`} status={canTaxi(state, now)} cta="Ponerse al volante" onClick={a.onTaxi} />
            <Activity icon="libro" title="Clases de español" text={`1 h con los vecinos · ${fmt(CLASS_PAY)} y reputación`} status={canTeach(state, now)} cta="Dar clase" onClick={a.onClasses} />
            <Activity icon="perrito" title="Puesto de perritos calientes" text={`Minijuego de 1 min · ${fmt(HOTDOG_PER_POINT)} por perrito bien servido`} status={canHotdogs(state, now)} cta="Abrir el puesto" onClick={a.onHotdogs} />
            <Activity icon="cartel" title="Rastro de Brooklyn" text="Compra barato, revende caro (domingos)" status={rastroOpen(state) ? canRastro(state, now) : 'Solo los domingos'} cta="Ir al rastro" onClick={() => a.onOpen('rastro')} />
          </>
        ) : (
          <>
            {actions.map((d) => {
              const st = actionStatus(state, d, now);
              return <Activity key={d.id} icon={d.id === 'cena-recaudacion' ? 'estrella' : 'megafono'} title={d.title} text={d.summary ?? ''} status={st.ok ? null : st.reason ?? 'No disponible'} cta="Decidir" onClick={() => a.onAction(d.id)} />;
            })}
            <Activity icon="carta" title="Bonos municipales" text={`Invierte a 3 o 7 días con interés (máx. ${MAX_BONDS})`} status={(state.bonds ?? []).length >= MAX_BONDS ? 'Máximo de bonos' : null} cta="Invertir" onClick={() => a.onOpen('bonos')} />
            <Activity icon="cartel" title="Subasta de solares" text="Vende un solar libre a una empresa: dinero rápido" status={null} cta="Ver solares" onClick={a.onAuction} />
          </>
        )}
        <Activity icon="trofeo" title="Concursos" text={`Breakdance, perritos, Simon y maratón: ${CONTESTS.filter((c) => contestOpen(state, c)).length ? 'hay concurso hoy' : 'mira el calendario'}`} status={null} cta="Ver concursos" onClick={() => a.onOpen('concursos')} />
        <Activity icon="moneda" title="Casino Pixelopolis" text={`Póker, blackjack, ruleta y carreras · mayores de ${CASINO_MIN_AGE}`} status={canCasino(state, now)} cta="Entrar" onClick={() => a.onOpen('casino')} />
        <Activity icon="caballo" title="Hipódromo" text="Apuesta por un caballo (fines de semana)" status={weekend ? canRace(state, now) : 'Sábados y domingos'} cta="Ir a las carreras" onClick={() => a.onOpen('carreras')} />
        <Activity icon="estrella" title="Béisbol: Yankees vs Mets" text="Apuesta por el ganador (fines de semana)" status={weekend ? canBaseball(state, now) : 'Sábados y domingos'} cta="Apostar" onClick={() => a.onOpen('beisbol')} />
        <Activity icon="boleto" title="Lotería semanal" text={`Boleto de ${fmt(ticketPrice(state))} · sorteo el domingo por la noche`} status={null} cta="Comprar boleto" onClick={() => a.onOpen('loteria')} />
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Subpaneles
// ---------------------------------------------------------------------------

export function RastroModal({ state, now, onBuy, onClose }: { state: GameState; now: number; onBuy: (id: string) => { sale: number; net: number } | void; onClose: () => void }) {
  const fmt = ROLES[state.character.role].formatMoney;
  const items = rastroItems(state);
  const [last, setLast] = useState<{ label: string; net: number } | null>(null);
  const why = canRastro(state, now);
  return (
    <Modal title="Rastro de Brooklyn" kicker="DOMINGO DE GANGAS" onClose={onClose}>
      <div class="card-text muted">Puedes comprar 2 cosas. Algunas valen mucho más… y otras son un chasco.</div>
      {last && <div class={`result-pop ${last.net >= 0 ? 'good' : 'bad'}`}>{last.net >= 0 ? `¡Ganga! +${fmt(last.net)} con ${last.label}` : `Chasco: ${fmt(last.net)} con ${last.label}`}</div>}
      <div class="stack">
        {items.map((it, i) => {
          const bought = rastroBought(state, now, i);
          return (
            <div key={it.id} class={`card rastro-item ${bought ? 'owned' : ''}`}>
              <b>{it.label}</b>
              <button
                class="btn small good"
                disabled={!!why || bought || (state.bars.dinero ?? 0) < it.price}
                onClick={() => {
                  const r = onBuy(it.id);
                  if (r) {
                    setLast({ label: it.label, net: r.net });
                    if (r.net >= 0) play.good();
                    else play.bad();
                  }
                }}
              >
                {bought ? 'Comprado' : `Comprar · ${fmt(it.price)}`}
              </button>
            </div>
          );
        })}
      </div>
    </Modal>
  );
}

export function RaceModal({ state, now, onBet, onClose }: { state: GameState; now: number; onBet: (horse: number, stake: number) => { order: number[]; won: number } | void; onClose: () => void }) {
  const fmt = ROLES[state.character.role].formatMoney;
  const stakes = betStakes(state);
  const [horse, setHorse] = useState(0);
  const [stake, setStake] = useState(stakes[0]);
  const [race, setRace] = useState<{ order: number[]; won: number; t: number } | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!race) return;
    const id = setInterval(() => setTick((t) => t + 1), 50);
    return () => clearInterval(id);
  }, [race?.t]);
  const RACE_MS = 5000;
  const p = race ? Math.min(1, (Date.now() - race.t) / RACE_MS) : 0;
  void tick;
  const why = canRace(state, now);
  return (
    <Modal title="Hipódromo" kicker={`CARRERA ${Number(state.flags.carrerasDia === dayNumber(state, now) ? state.flags.carreras ?? 0 : 0) + (race && p < 1 ? 0 : 1)}`} onClose={onClose}>
      <div class="track">
        {HORSES.map((h, i) => {
          const place = race ? race.order.indexOf(i) : 4;
          // el ganador acelera al final; cada uno con su ritmo
          const prog = race ? Math.min(1, p * (1.05 - place * 0.06) + Math.sin(p * 9 + i) * 0.02 * (1 - p)) : 0;
          return (
            <div key={h.name} class={`lane ${horse === i ? 'mine' : ''}`}>
              <span class="horse" style={{ left: `${prog * 84}%`, background: h.color }}>
                <PixelIcon id="caballo" size={2} />
              </span>
              <span class="lane-name">
                {i + 1}. {h.name} <em>×{h.odds}</em>
              </span>
            </div>
          );
        })}
        <div class="finish" />
      </div>
      {race && p >= 1 && <div class={`result-pop ${race.won ? 'good' : 'bad'}`}>{race.won ? `¡Gana ${HORSES[race.order[0]].name}! Cobras ${fmt(race.won)}` : `Gana ${HORSES[race.order[0]].name}. Otra vez será.`}</div>}
      {(!race || p >= 1) && (
        <>
          <div class="pick-row">
            {HORSES.map((h, i) => (
              <button key={h.name} class={`chip-btn ${horse === i ? 'on' : ''}`} style={{ borderColor: h.color }} onClick={() => setHorse(i)}>
                {i + 1} ×{h.odds}
              </button>
            ))}
          </div>
          <div class="pick-row">
            {stakes.map((s) => (
              <button key={s} class={`chip-btn ${stake === s ? 'on' : ''}`} onClick={() => setStake(s)}>
                {fmt(s)}
              </button>
            ))}
          </div>
          <button
            class="btn good"
            disabled={!!why || (state.bars.dinero ?? 0) < stake}
            onClick={() => {
              const r = onBet(horse, stake);
              if (r) {
                play.swipe();
                setRace({ ...r, t: Date.now() });
                setTimeout(() => (r.won ? play.good() : play.bad()), RACE_MS);
              }
            }}
          >
            {why ?? `Apostar ${fmt(stake)} por ${HORSES[horse].name}`}
          </button>
        </>
      )}
    </Modal>
  );
}

export function BaseballModal({ state, now, onBet, onClose }: { state: GameState; now: number; onBet: (team: 'yankees' | 'mets', stake: number) => { yankees: number; mets: number; won: number } | void; onClose: () => void }) {
  const fmt = ROLES[state.character.role].formatMoney;
  const stakes = betStakes(state);
  const [stake, setStake] = useState(stakes[0]);
  const [res, setRes] = useState<{ yankees: number; mets: number; won: number } | null>(null);
  const why = canBaseball(state, now);
  const done = !!why && racesOpen(state) ? baseballGame(state) : null;
  return (
    <Modal title="Yankees vs Mets" kicker="BÉISBOL · CUOTA ×1.9" onClose={onClose}>
      <div class="scoreboard">
        <div>
          <small>YANKEES</small>
          <b>{res ? res.yankees : done ? done.yankees : '–'}</b>
        </div>
        <span>VS</span>
        <div>
          <small>METS</small>
          <b>{res ? res.mets : done ? done.mets : '–'}</b>
        </div>
      </div>
      {res && <div class={`result-pop ${res.won ? 'good' : 'bad'}`}>{res.won ? `¡Acertaste! Cobras ${fmt(res.won)}` : 'Perdiste la apuesta.'}</div>}
      {!why && (
        <>
          <div class="pick-row">
            {stakes.map((s) => (
              <button key={s} class={`chip-btn ${stake === s ? 'on' : ''}`} onClick={() => setStake(s)}>
                {fmt(s)}
              </button>
            ))}
          </div>
          <div class="row">
            {(['yankees', 'mets'] as const).map((t) => (
              <button
                key={t}
                class="btn good"
                disabled={(state.bars.dinero ?? 0) < stake}
                onClick={() => {
                  const r = onBet(t, stake);
                  if (r) {
                    setRes(r);
                    if (r.won) play.good();
                    else play.bad();
                  }
                }}
              >
                {t === 'yankees' ? 'Yankees' : 'Mets'}
              </button>
            ))}
          </div>
        </>
      )}
      {why && !res && <div class="card-text muted">{why}</div>}
    </Modal>
  );
}

export function LotteryModal({ state, onBuy, onClose }: { state: GameState; onBuy: (n: [number, number, number]) => void; onClose: () => void }) {
  const fmt = ROLES[state.character.role].formatMoney;
  const [nums, setNums] = useState<[number, number, number]>([7, 7, 7]);
  const week = weekOf(state);
  const mine = (state.lottery ?? []).filter((t) => t.week === week);
  const lastDraw = week > 0 ? lotteryDraw(state, week - 1) : null;
  const bump = (i: number, d: number) => setNums((n) => n.map((v, k) => (k === i ? (v + d + 10) % 10 : v)) as [number, number, number]);
  return (
    <Modal title="Lotería" kicker={`SORTEO DE LA SEMANA ${week + 1}`} onClose={onClose}>
      <div class="card-text muted">Elige 3 números. Aciertos en su sitio: 3 → ×500, 2 → ×10.</div>
      <div class="lotto">
        {nums.map((n, i) => (
          <div key={i} class="lotto-ball">
            <button onClick={() => bump(i, 1)}>▲</button>
            <b>{n}</b>
            <button onClick={() => bump(i, -1)}>▼</button>
          </div>
        ))}
      </div>
      <div class="row">
        <button class="btn secondary" onClick={() => setNums([0, 0, 0].map(() => Math.floor(Math.random() * 10)) as [number, number, number])}>
          🎲 Al azar
        </button>
        <button class="btn good" disabled={mine.length >= MAX_TICKETS || (state.bars.dinero ?? 0) < ticketPrice(state)} onClick={() => onBuy(nums)}>
          Comprar · {fmt(ticketPrice(state))}
        </button>
      </div>
      <div class="card" style={{ marginTop: 10 }}>
        <b>
          🎟 Tus boletos ({mine.length}/{MAX_TICKETS})
        </b>
        <div class="tickets">
          {mine.length ? mine.map((t, i) => <span key={i}>{t.numbers.join(' · ')}</span>) : <small class="muted">Ninguno esta semana.</small>}
        </div>
        {lastDraw && <div class="card-text muted">Números ganadores de la semana pasada: {lastDraw.join(' · ')}</div>}
      </div>
    </Modal>
  );
}

export function BondsModal({ state, now, onBuy, onClose }: { state: GameState; now: number; onBuy: (amount: number, days: number) => void; onClose: () => void }) {
  const fmt = ROLES.alcalde.formatMoney;
  const amounts = [50_000, 100_000, 250_000, 500_000];
  const [amount, setAmount] = useState(amounts[1]);
  const bonds = state.bonds ?? [];
  return (
    <Modal title="Bonos municipales" kicker="INVERSIÓN A PLAZO" onClose={onClose}>
      <div class="pick-row">
        {amounts.map((x) => (
          <button key={x} class={`chip-btn ${amount === x ? 'on' : ''}`} onClick={() => setAmount(x)}>
            {fmt(x)}
          </button>
        ))}
      </div>
      <div class="stack">
        {BOND_TERMS.map((t) => (
          <button key={t.days} class="btn good" disabled={bonds.length >= MAX_BONDS || (state.bars.dinero ?? 0) < amount} onClick={() => onBuy(amount, t.days)}>
            {t.days} días al {Math.round(t.rate * 100)}% → {fmt(Math.round(amount * (1 + t.rate)))}
          </button>
        ))}
      </div>
      <div class="card" style={{ marginTop: 10 }}>
        <b>
          📜 Tus bonos ({bonds.length}/{MAX_BONDS})
        </b>
        {bonds.length ? (
          <ul class="factors">
            {bonds.map((b, i) => (
              <li key={i}>
                <span>
                  {fmt(b.amount)} al {Math.round(b.rate * 100)}%
                </span>
                <b>{formatDuration(b.until - now)}</b>
              </li>
            ))}
          </ul>
        ) : (
          <small class="muted">No tienes bonos.</small>
        )}
      </div>
    </Modal>
  );
}

/** Copia de seguridad: exportar la partida a un código y restaurarla en otro móvil. */
export function BackupModal({ onClose }: { onClose: () => void }) {
  const [code] = useState(() => exportCode() ?? '');
  const [input, setInput] = useState('');
  const [msg, setMsg] = useState('');
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setMsg('Copiado. Guárdalo en tus notas o mándatelo por mensaje.');
    } catch {
      setMsg('No se pudo copiar solo: mantén pulsado el código y cópialo.');
    }
  };
  const share = async () => {
    try {
      await navigator.share({ title: 'Pixelopolis · copia de seguridad', text: code });
    } catch {
      /* cancelado */
    }
  };
  const restore = () => {
    const err = importCode(input);
    if (err) return setMsg(err);
    setMsg('¡Partida restaurada! Recargando…');
    setTimeout(() => location.reload(), 700);
  };
  return (
    <Modal title="Copia de seguridad" kicker="TU PARTIDA A SALVO" onClose={onClose}>
      <div class="card">
        <b>💾 Exportar</b>
        <div class="card-text muted">Este código guarda tu partida, tu legado y tus récords. Guárdalo fuera del móvil.</div>
        <textarea class="code-box" readOnly value={code} rows={3} onFocus={(e) => (e.currentTarget as HTMLTextAreaElement).select()} />
        <div class="row">
          <button class="btn small secondary" onClick={copy} disabled={!code}>
            Copiar
          </button>
          {'share' in navigator && (
            <button class="btn small secondary" onClick={share} disabled={!code}>
              Compartir
            </button>
          )}
        </div>
      </div>
      <div class="card" style={{ marginTop: 10 }}>
        <b>📥 Restaurar</b>
        <div class="card-text muted">Pega aquí un código. Sustituye la partida actual.</div>
        <textarea class="code-box" rows={3} value={input} placeholder="LC1:..." onInput={(e) => setInput((e.currentTarget as HTMLTextAreaElement).value)} />
        <button class="btn small danger" disabled={!input.trim()} onClick={restore}>
          Restaurar partida
        </button>
      </div>
      {msg && <div class="card-text warn-box">{msg}</div>}
    </Modal>
  );
}

/** 🥇 Concursos de la semana. */
export function ContestsModal({ state, now, onEnter, onClose }: { state: GameState; now: number; onEnter: (id: string) => void; onClose: () => void }) {
  const fmt = ROLES[state.character.role].formatMoney;
  return (
    <Modal title="Concursos" kicker="COMPITE Y GANA" onClose={onClose}>
      <div class="card-text muted" style={{ marginBottom: 8 }}>
        Cada concurso se celebra unos días a la semana. Pagas la inscripción y compites contra los mejores del barrio: solo los 3 primeros cobran.
      </div>
      <div class="stack">
        {CONTESTS.map((c) => {
          const why = canEnterContest(state, c.id, now);
          const open = contestOpen(state, c);
          const rivals = open ? contestRivals(state, c.id) : [];
          const prizes = contestPrizes(state, c);
          return (
            <div key={c.id} class={`card contest ${open ? 'open' : ''}`}>
              <div class="contest-head">
                <PixelIcon id={c.icon} size={3} />
                <div>
                  <b>{c.label}</b>
                  <small>
                    📍 {c.where} · {open ? '¡HOY!' : contestDays(c)}
                  </small>
                </div>
              </div>
              <div class="card-text">{c.description}</div>
              <div class="contest-prizes">
                <span>🥇 {fmt(prizes[0])}</span>
                <span>🥈 {fmt(prizes[1])}</span>
                <span>🥉 {fmt(prizes[2])}</span>
                <span class="muted">Inscripción {fmt(contestFee(state, c))}</span>
              </div>
              {open && (
                <div class="card-text muted">
                  Favorito: <b>{rivals[0].name}</b> ({rivals[0].score} {c.unit})
                </div>
              )}
              <button class="btn small good" disabled={!!why} onClick={() => onEnter(c.id)}>
                {why ?? 'Inscribirse y competir'}
              </button>
            </div>
          );
        })}
      </div>
    </Modal>
  );
}

export function ContestResultModal({ state, id, result, onClose }: { state: GameState; id: string; result: ContestResult; onClose: () => void }) {
  const c = CONTEST_BY_ID[id];
  const fmt = ROLES[state.character.role].formatMoney;
  useEffect(() => {
    if (result.place === 1) play.achievement();
    else if (result.place <= 3) play.good();
    else play.bad();
  }, []);
  return (
    <Modal title={result.place === 1 ? '¡Campeón!' : result.place <= 3 ? '¡En el podio!' : 'Fuera del podio'} kicker={c.label.toUpperCase()} onClose={onClose}>
      <div class={`passive-total ${result.place <= 3 ? '' : 'lost'}`}>
        <small>Quedas</small>
        <b>{result.place}º</b>
        <small>{result.prize ? `Premio: ${fmt(result.prize)}` : 'Sin premio esta vez'}</small>
      </div>
      <ol class="podium">
        {result.table.map((r, i) => (
          <li key={r.name + i} class={r.you ? 'you' : ''}>
            <span>{i < 3 ? ['🥇', '🥈', '🥉'][i] : `${i + 1}º`}</span>
            <span>{r.name}</span>
            <b>
              {r.score} {c.unit}
            </b>
          </li>
        ))}
      </ol>
    </Modal>
  );
}
