import { useState } from 'preact/hooks';
import { MAX_BETS_PER_SHIFT, marketSession, quote, STAKES, todayNews } from '../core/game';
import { betReturn, COMPANIES } from '../core/market';
import { ROLES } from '../core/roles';
import { formatDuration } from '../core/time';
import type { GameState } from '../core/types';

const SAMPLES = 48;

function pct(a: number, b: number) {
  return ((a - b) / b) * 100;
}

function fmtPct(v: number) {
  return `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`;
}

/** Camino del precio desde la apertura hasta ahora. */
function path(state: GameState, ticker: string, now: number, p: number): number[] {
  const n = Math.max(2, Math.round(SAMPLES * p) + 1);
  return Array.from({ length: n }, (_, i) => quote(state, ticker, now, (i / (n - 1)) * p));
}

function Chart({ points, open, w, h, marks = [] }: { points: number[]; open: number; w: number; h: number; marks?: number[] }) {
  const all = [...points, open, ...marks];
  const min = Math.min(...all);
  const max = Math.max(...all);
  const span = max - min || 1;
  const y = (v: number) => h - 2 - ((v - min) / span) * (h - 4);
  const x = (i: number) => (i / Math.max(1, SAMPLES)) * w;
  const up = points[points.length - 1] >= open;
  const d = points.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" class="chart">
      <line x1="0" x2={w} y1={y(open)} y2={y(open)} class="chart-open" />
      {marks.map((m, i) => (
        <line key={i} x1="0" x2={w} y1={y(m)} y2={y(m)} class="chart-mark" />
      ))}
      <path d={d} class={up ? 'chart-up' : 'chart-down'} />
    </svg>
  );
}

export function MarketTerminal({
  state,
  now,
  onBet,
  onClose,
}: {
  state: GameState;
  now: number;
  onBet: (ticker: string, dir: 1 | -1, stake: number) => void;
  onClose: () => void;
}) {
  const role = ROLES[state.character.role];
  const session = marketSession(state, now);
  const open = session && session.p < 1;
  const [selected, setSelected] = useState(COMPANIES[0].ticker);
  const stakes = STAKES[state.character.role];
  const [stake, setStake] = useState(stakes[1]);
  const news = todayNews(state);
  const money = state.bars.dinero ?? 0;
  const bets = state.market.bets;
  const basis = (t: string) => (session ? session.open[t] : state.market.open[t]);
  const rows = COMPANIES.map((c) => {
    const price = open ? quote(state, c.ticker, now) : session ? quote(state, c.ticker, now, 1) : basis(c.ticker);
    return { c, price, chg: pct(price, basis(c.ticker)) };
  });
  const sel = rows.find((r) => r.c.ticker === selected)!;
  const canBet = open && bets.length < MAX_BETS_PER_SHIFT && money >= stake;
  const status = !session
    ? 'MERCADO CERRADO · abre durante tu jornada'
    : !open
      ? 'SESIÓN TERMINADA · sal del trabajo para liquidar'
      : `SESIÓN ABIERTA · cierra en ${formatDuration(state.shift!.endsAt - now)}`;

  return (
    <div class="terminal">
      <div class="term-head">
        <span class="term-brand">WALL ST · 80</span>
        <span class={`term-status ${open ? 'up' : 'down'}`}>● {status}</span>
      </div>
      <div class="tape">
        <div class="tape-inner">
          {[...rows, ...rows].map((r, i) => (
            <span key={i} class={r.chg >= 0 ? 'up' : 'down'}>
              {r.c.ticker} {r.price.toFixed(2)} {r.chg >= 0 ? '▲' : '▼'}
              {Math.abs(r.chg).toFixed(2)}%
            </span>
          ))}
        </div>
      </div>

      <div class="term-body">
        <div class="term-news">
          <div class="term-label">» NOTICIAS DEL DÍA</div>
          {news.map((n) => (
            <div key={n.ticker} class="news-line">
              <span class={n.hint === 'up' ? 'up' : 'down'}>{n.hint === 'up' ? '▲' : '▼'}</span> <b>{n.ticker}</b> {n.headline}
            </div>
          ))}
        </div>

        <table class="quotes">
          <tbody>
            {rows.map((r) => (
              <tr key={r.c.ticker} class={r.c.ticker === selected ? 'sel' : ''} onClick={() => setSelected(r.c.ticker)}>
                <td class="tk">{r.c.ticker}</td>
                <td class="px">{r.price.toFixed(2)}</td>
                <td class={r.chg >= 0 ? 'up' : 'down'}>{fmtPct(r.chg)}</td>
                <td class="spark">
                  {session && <Chart points={path(state, r.c.ticker, now, open ? session.p : 1)} open={basis(r.c.ticker)} w={60} h={16} />}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div class="term-detail">
          <div class="term-label">
            » {sel.c.ticker} · {sel.c.name}
          </div>
          <div class="big-quote">
            <span class="px">{sel.price.toFixed(2)}</span>{' '}
            <span class={sel.chg >= 0 ? 'up' : 'down'}>{fmtPct(sel.chg)}</span>
          </div>
          {session && (
            <Chart
              points={path(state, sel.c.ticker, now, open ? session.p : 1)}
              open={basis(sel.c.ticker)}
              w={300}
              h={90}
              marks={bets.filter((b) => b.ticker === sel.c.ticker).map((b) => b.entryPrice)}
            />
          )}
          <div class="term-label">» APUESTA · saldo {role.formatMoney(money)}</div>
          <div class="stakes">
            {stakes.map((s) => (
              <button key={s} class={`stake ${s === stake ? 'on' : ''}`} onClick={() => setStake(s)}>
                {role.formatMoney(s)}
              </button>
            ))}
          </div>
          <div class="trade">
            <button class="trade-btn buy" disabled={!canBet} onClick={() => onBet(sel.c.ticker, 1, stake)}>
              ▲ SUBE
            </button>
            <button class="trade-btn sell" disabled={!canBet} onClick={() => onBet(sel.c.ticker, -1, stake)}>
              ▼ BAJA
            </button>
          </div>
          <div class="term-hint">
            {open && bets.length >= MAX_BETS_PER_SHIFT
              ? `Máximo ${MAX_BETS_PER_SHIFT} operaciones por jornada.`
              : open && money < stake
                ? 'Saldo insuficiente.'
                : 'Si aciertas la dirección al cierre de tu jornada, ganas; si fallas, pierdes. Las noticias no siempre aciertan.'}
          </div>
        </div>

        <div class="term-label">» POSICIONES ABIERTAS ({bets.length}/{MAX_BETS_PER_SHIFT})</div>
        {bets.length === 0 && <div class="term-hint">Sin posiciones.</div>}
        {bets.map((b) => {
          const cur = session ? quote(state, b.ticker, now, open ? session.p : 1) : b.entryPrice;
          const pl = betReturn(b.stake, b.dir, b.entryPrice, cur);
          return (
            <div key={b.id} class="position">
              <span>
                {b.dir > 0 ? '▲' : '▼'} {b.ticker} {role.formatMoney(b.stake)} @ {b.entryPrice.toFixed(2)}
              </span>
              <span class={pl >= 0 ? 'up' : 'down'}>
                {pl >= 0 ? '+' : ''}
                {role.formatMoney(pl)}
              </span>
            </div>
          );
        })}
      </div>

      <button class="term-close" onClick={onClose}>
        [ CERRAR TERMINAL ]
      </button>
    </div>
  );
}
