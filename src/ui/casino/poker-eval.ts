/**
 * Lógica pura de las cartas del casino: baraja, evaluador de manos de póker
 * (5 a 7 cartas), botes laterales, motor de Texas Hold'em (ciegas, rondas,
 * subida mínima, all-in) y la decisión de los rivales de la máquina.
 * Sin DOM ni Preact: se prueba con vitest (tests/casino-cards.test.ts).
 */

// ---------------------------------------------------------------------------
// Cartas y baraja
// ---------------------------------------------------------------------------

export type Suit = 's' | 'h' | 'd' | 'c';
/** r: 2..14 (11 J, 12 Q, 13 K, 14 A). id: único, para animar cada carta. */
export interface Card {
  r: number;
  s: Suit;
  id: number;
}
export type Rng = () => number;

export const SUITS: Suit[] = ['s', 'h', 'd', 'c'];
export const SUIT_CHAR: Record<Suit, string> = { s: '♠', h: '♥', d: '♦', c: '♣' };
export const isRed = (s: Suit) => s === 'h' || s === 'd';
export const rankLabel = (r: number) => (r <= 10 ? String(r) : ['J', 'Q', 'K', 'A'][r - 11]);

let nextId = 1;
/** Una carta suelta (para pruebas): `C('As')`, `C('Td')`, `C('9h')`. */
export function C(code: string): Card {
  const ch = code[0].toUpperCase();
  const r = ch === 'A' ? 14 : ch === 'K' ? 13 : ch === 'Q' ? 12 : ch === 'J' ? 11 : ch === 'T' ? 10 : Number(code.slice(0, -1));
  return { r, s: code[code.length - 1].toLowerCase() as Suit, id: nextId++ };
}

export function makeDeck(decks = 1): Card[] {
  const out: Card[] = [];
  for (let d = 0; d < decks; d++) for (const s of SUITS) for (let r = 2; r <= 14; r++) out.push({ r, s, id: nextId++ });
  return out;
}

/** Fisher-Yates en el sitio. */
export function shuffle<T>(a: T[], rng: Rng = Math.random): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Generador con semilla (mulberry32) para pruebas reproducibles. */
export function seeded(seed: number): Rng {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// Blackjack: valor de la mano
// ---------------------------------------------------------------------------

export const bjValue = (c: Card) => (c.r === 14 ? 1 : Math.min(10, c.r));

/** Total de una mano de blackjack; soft = hay un As contando 11. */
export function bjTotal(cards: Card[]): { total: number; soft: boolean } {
  let t = 0;
  let aces = 0;
  for (const c of cards) {
    t += bjValue(c);
    if (c.r === 14) aces++;
  }
  const soft = aces > 0 && t + 10 <= 21;
  return { total: soft ? t + 10 : t, soft };
}

/** Blackjack natural: As + figura/10 en las dos primeras (no tras dividir). */
export const isBlackjack = (cards: Card[], fromSplit = false) => !fromSplit && cards.length === 2 && bjTotal(cards).total === 21;

/** "7/17" si es blanda, "17" si no. */
export function bjLabel(cards: Card[]): string {
  const { total, soft } = bjTotal(cards);
  return soft && total < 21 ? `${total - 10}/${total}` : String(total);
}

/** La banca se planta con 17 blando (S17): pide solo por debajo de 17. */
export const dealerHits = (cards: Card[]) => bjTotal(cards).total < 17;

// ---------------------------------------------------------------------------
// Evaluador de póker
// ---------------------------------------------------------------------------

export const HAND_NAMES = ['Carta alta', 'Pareja', 'Doble pareja', 'Trío', 'Escalera', 'Color', 'Full', 'Póker', 'Escalera de color'];
const PLURAL: Record<number, string> = { 2: 'doses', 3: 'treses', 4: 'cuatros', 5: 'cincos', 6: 'seises', 7: 'sietes', 8: 'ochos', 9: 'nueves', 10: 'dieces', 11: 'jotas', 12: 'damas', 13: 'reyes', 14: 'ases' };
const TO: Record<number, string> = { 11: 'a la jota', 12: 'a la dama', 13: 'al rey', 14: 'al as' };
const to = (r: number) => TO[r] ?? `al ${r}`;

export interface HandRank {
  /** 0 carta alta … 8 escalera de color. */
  cat: number;
  /** Comparable: mayor gana; igual empata. */
  score: number;
  /** Nombre de la categoría ("Full"). */
  name: string;
  /** Descripción ("Full de reyes y treses"). */
  desc: string;
  /** Las 5 cartas que forman la mano. */
  best: Card[];
}

const B = 15;
function scoreOf(cat: number, ranks: number[]) {
  let s = cat;
  for (let i = 0; i < 5; i++) s = s * B + (ranks[i] ?? 0);
  return s;
}

/** Evalúa exactamente 5 cartas. */
export function eval5(c: Card[]): { cat: number; score: number; ranks: number[] } {
  const rs = c.map((x) => x.r).sort((a, b) => b - a);
  const flush = c.every((x) => x.s === c[0].s);
  const uniq = [...new Set(rs)];
  let straightHigh = 0;
  if (uniq.length === 5) {
    if (rs[0] - rs[4] === 4) straightHigh = rs[0];
    else if (rs[0] === 14 && rs[1] === 5) straightHigh = 5; // A-2-3-4-5
  }
  if (straightHigh) {
    const cat = flush ? 8 : 4;
    return { cat, score: scoreOf(cat, [straightHigh]), ranks: [straightHigh] };
  }
  // grupos por (cantidad desc, rango desc)
  const cnt = new Map<number, number>();
  for (const r of rs) cnt.set(r, (cnt.get(r) ?? 0) + 1);
  const groups = [...cnt.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  const ranks = groups.map((g) => g[0]);
  const shape = groups.map((g) => g[1]).join('');
  const cat = flush ? 5 : shape === '41' ? 7 : shape === '32' ? 6 : shape === '311' ? 3 : shape === '221' ? 2 : shape === '2111' ? 1 : 0;
  // color y full/póker no coinciden con 5 cartas de una baraja: ok
  return { cat: flush && cat < 6 ? 5 : cat, score: scoreOf(flush && cat < 6 ? 5 : cat, flush ? rs : ranks), ranks: flush ? rs : ranks };
}

function describe(cat: number, ranks: number[]): string {
  const P = (r: number) => PLURAL[r];
  switch (cat) {
    case 8:
      return ranks[0] === 14 ? 'Escalera real' : `Escalera de color ${to(ranks[0])}`;
    case 7:
      return `Póker de ${P(ranks[0])}`;
    case 6:
      return `Full de ${P(ranks[0])} y ${P(ranks[1])}`;
    case 5:
      return `Color ${to(ranks[0])}`;
    case 4:
      return `Escalera ${to(ranks[0])}`;
    case 3:
      return `Trío de ${P(ranks[0])}`;
    case 2:
      return `Doble pareja: ${P(ranks[0])} y ${P(ranks[1])}`;
    case 1:
      return `Pareja de ${P(ranks[0])}`;
    default:
      return `Carta alta: ${to(ranks[0]).replace(/^al? (la )?/, '')}`;
  }
}

/** Mejor mano de 5 entre 5, 6 o 7 cartas. */
export function evaluate(cards: Card[]): HandRank {
  const n = cards.length;
  let best: { cat: number; score: number; ranks: number[] } | null = null;
  let bestCards: Card[] = [];
  const idx = [0, 1, 2, 3, 4];
  const combo: Card[] = new Array(5);
  // todas las combinaciones de 5
  const rec = (start: number, k: number) => {
    if (k === 5) {
      for (let i = 0; i < 5; i++) combo[i] = cards[idx[i]];
      const e = eval5(combo);
      if (!best || e.score > best.score) {
        best = e;
        bestCards = combo.slice();
      }
      return;
    }
    for (let i = start; i <= n - (5 - k); i++) {
      idx[k] = i;
      rec(i + 1, k + 1);
    }
  };
  rec(0, 0);
  const b = best as unknown as { cat: number; score: number; ranks: number[] };
  return { cat: b.cat, score: b.score, name: b.cat === 8 && b.ranks[0] === 14 ? 'Escalera real' : HAND_NAMES[b.cat], desc: describe(b.cat, b.ranks), best: bestCards };
}

/** Puntuación rápida (sin cartas ni textos) para el Monte Carlo. */
function quickScore(cards: Card[]): number {
  const n = cards.length;
  let best = -1;
  const combo: Card[] = new Array(5);
  for (let a = 0; a < n - 4; a++)
    for (let b = a + 1; b < n - 3; b++)
      for (let c = b + 1; c < n - 2; c++)
        for (let d = c + 1; d < n - 1; d++)
          for (let e = d + 1; e < n; e++) {
            combo[0] = cards[a];
            combo[1] = cards[b];
            combo[2] = cards[c];
            combo[3] = cards[d];
            combo[4] = cards[e];
            const s = eval5(combo).score;
            if (s > best) best = s;
          }
  return best;
}

// ---------------------------------------------------------------------------
// Botes (principal y laterales)
// ---------------------------------------------------------------------------

export interface Pot {
  amount: number;
  /** Asientos que pueden ganarlo (no retirados). */
  eligible: number[];
}

/** Reparte lo aportado en bote principal y botes laterales. */
export function buildPots(contrib: number[], folded: boolean[]): Pot[] {
  const rem = contrib.slice();
  const pots: Pot[] = [];
  for (;;) {
    const live = rem.map((_, i) => i).filter((i) => rem[i] > 0 && !folded[i]);
    const left = rem.reduce((a, b) => a + b, 0);
    if (left <= 0) break;
    if (!live.length) {
      // solo queda dinero de retirados: va al último bote
      if (pots.length) pots[pots.length - 1].amount += left;
      break;
    }
    const lvl = Math.min(...live.map((i) => rem[i]));
    let amount = 0;
    for (let i = 0; i < rem.length; i++) {
      const t = Math.min(rem[i], lvl);
      amount += t;
      rem[i] -= t;
    }
    const prev = pots[pots.length - 1];
    if (prev && prev.eligible.join() === live.join()) prev.amount += amount;
    else pots.push({ amount, eligible: live });
  }
  return pots;
}

/**
 * Reparte los botes según las puntuaciones (score null = retirado). Empates:
 * se divide; las fichas sueltas van al primero a la izquierda del botón.
 */
export function awardPots(pots: Pot[], scores: (number | null)[], button: number): { win: number[]; winners: number[][] } {
  const n = scores.length;
  const win = new Array(n).fill(0);
  const winners: number[][] = [];
  for (const p of pots) {
    let top = -Infinity;
    for (const i of p.eligible) if ((scores[i] ?? -Infinity) > top) top = scores[i] as number;
    const ws = p.eligible.filter((i) => scores[i] === top);
    // ordenados desde la izquierda del botón
    ws.sort((a, b) => ((a - button - 1 + n) % n) - ((b - button - 1 + n) % n));
    const share = Math.floor(p.amount / ws.length);
    let odd = p.amount - share * ws.length;
    for (const w of ws) {
      win[w] += share + (odd > 0 ? 1 : 0);
      odd--;
    }
    winners.push(ws);
  }
  return { win, winners };
}

// ---------------------------------------------------------------------------
// Motor de Texas Hold'em
// ---------------------------------------------------------------------------

export interface PSeat {
  stack: number;
  /** Apostado en esta ronda. */
  bet: number;
  /** Aportado en toda la mano. */
  contrib: number;
  folded: boolean;
  allIn: boolean;
  /** Ha actuado desde la última subida completa. */
  acted: boolean;
  hole: Card[];
  /** Sin fichas al empezar la mano: no juega. */
  out: boolean;
}

export const STREETS = ['Preflop', 'Flop', 'Turn', 'River', 'Showdown'];

export interface PState {
  seats: PSeat[];
  board: Card[];
  deck: Card[];
  button: number;
  sbSeat: number;
  bbSeat: number;
  sb: number;
  bb: number;
  /** 0 preflop, 1 flop, 2 turn, 3 river, 4 terminada. */
  street: number;
  /** Asiento que debe actuar, -1 si la ronda de apuestas está cerrada. */
  toAct: number;
  currentBet: number;
  /** Tamaño de la última subida completa (mínimo para resubir). */
  minRaise: number;
}

export type PAction = { type: 'fold' } | { type: 'check' } | { type: 'call' } | { type: 'raise'; to: number };

const inHand = (s: PSeat) => !s.out && !s.folded;
const canAct = (s: PSeat) => inHand(s) && !s.allIn;

/** Siguiente asiento (en el sentido de las agujas) que cumple `f`. */
export function nextSeat(st: { seats: PSeat[] }, from: number, f: (s: PSeat) => boolean): number {
  const n = st.seats.length;
  for (let k = 1; k <= n; k++) {
    const i = (from + k) % n;
    if (f(st.seats[i])) return i;
  }
  return -1;
}

/** Siguiente botón: primer asiento con fichas a la izquierda del actual. */
export const nextButton = (stacks: number[], button: number) => {
  for (let k = 1; k <= stacks.length; k++) {
    const i = (button + k) % stacks.length;
    if (stacks[i] > 0) return i;
  }
  return button;
};

function put(s: PSeat, amt: number) {
  const a = Math.min(amt, s.stack);
  s.stack -= a;
  s.bet += a;
  s.contrib += a;
  if (s.stack === 0) s.allIn = true;
}

/** Empieza una mano: ciegas y dos cartas a cada uno. `button` debe tener fichas. */
export function startHand(stacks: number[], button: number, sb: number, bb: number, rng: Rng = Math.random): PState {
  const seats: PSeat[] = stacks.map((stack) => ({ stack, bet: 0, contrib: 0, folded: false, allIn: false, acted: false, hole: [], out: stack <= 0 }));
  const st: PState = { seats, board: [], deck: shuffle(makeDeck(), rng), button, sbSeat: -1, bbSeat: -1, sb, bb, street: 0, toAct: -1, currentBet: bb, minRaise: bb };
  const active = seats.filter((s) => !s.out).length;
  const live = (s: PSeat) => !s.out;
  // mano a mano: el botón pone la ciega pequeña y habla primero antes del flop
  st.sbSeat = active === 2 ? button : nextSeat(st, button, live);
  st.bbSeat = nextSeat(st, st.sbSeat, live);
  put(seats[st.sbSeat], sb);
  put(seats[st.bbSeat], bb);
  for (let round = 0; round < 2; round++) {
    let i = button;
    for (let k = 0; k < active; k++) {
      i = nextSeat(st, i, live);
      seats[i].hole.push(st.deck.pop()!);
    }
  }
  st.toAct = findToAct(st, st.bbSeat);
  return st;
}

/** ¿Necesita actuar este asiento? */
function needs(st: PState, i: number): boolean {
  const s = st.seats[i];
  if (!canAct(s)) return false;
  if (s.acted && s.bet >= st.currentBet) return false;
  // si es el único que puede actuar y ya cubre la apuesta, no hay contra quién
  const others = st.seats.filter((o, j) => j !== i && canAct(o)).length;
  if (others === 0 && s.bet >= st.currentBet) return false;
  return true;
}

function findToAct(st: PState, after: number): number {
  const n = st.seats.length;
  for (let k = 1; k <= n; k++) {
    const i = (after + k) % n;
    if (needs(st, i)) return i;
  }
  return -1;
}

export const liveCount = (st: PState) => st.seats.filter(inHand).length;
export const potTotal = (st: PState) => st.seats.reduce((a, s) => a + s.contrib, 0);

export interface Legal {
  canCheck: boolean;
  toCall: number;
  canRaise: boolean;
  minTo: number;
  maxTo: number;
}

/** Acciones legales del que tiene la palabra. */
export function legal(st: PState, i = st.toAct): Legal {
  const s = st.seats[i];
  const owe = Math.max(0, st.currentBet - s.bet);
  const toCall = Math.min(owe, s.stack);
  const maxTo = s.bet + s.stack;
  const othersCanAct = st.seats.some((o, j) => j !== i && canAct(o));
  const canRaise = !s.acted && s.stack > owe && othersCanAct;
  const minTo = Math.min(maxTo, st.currentBet + st.minRaise);
  return { canCheck: owe === 0, toCall, canRaise, minTo, maxTo };
}

/** Aplica la acción del que tiene la palabra (las ilegales se corrigen). */
export function act(st: PState, a: PAction): PAction {
  const i = st.toAct;
  if (i < 0) return a;
  const s = st.seats[i];
  const L = legal(st, i);
  let done: PAction = a;
  if (a.type === 'fold' && L.canCheck) done = { type: 'check' };
  if (a.type === 'check' && !L.canCheck) done = { type: 'call' };
  if (a.type === 'raise' && !L.canRaise) done = L.canCheck ? { type: 'check' } : { type: 'call' };
  if (done.type === 'fold') s.folded = true;
  else if (done.type === 'call') put(s, L.toCall);
  else if (done.type === 'raise') {
    const target = Math.max(L.minTo, Math.min(L.maxTo, Math.round(done.to)));
    done = { type: 'raise', to: target };
    const inc = target - st.currentBet;
    put(s, target - s.bet);
    if (inc >= st.minRaise) {
      // subida completa: reabre la acción para todos
      st.minRaise = inc;
      st.seats.forEach((o, j) => j !== i && (o.acted = false));
    }
    st.currentBet = Math.max(st.currentBet, target);
  }
  s.acted = true;
  st.toAct = liveCount(st) <= 1 ? -1 : findToAct(st, i);
  return done;
}

/** Recoge las apuestas y reparte la siguiente calle (quema una carta). */
export function nextStreet(st: PState): void {
  for (const s of st.seats) {
    s.bet = 0;
    s.acted = false;
  }
  st.currentBet = 0;
  st.minRaise = st.bb;
  st.street++;
  if (st.street <= 3) {
    st.deck.pop();
    const n = st.street === 1 ? 3 : 1;
    for (let k = 0; k < n; k++) st.board.push(st.deck.pop()!);
  }
  st.toAct = st.street >= 4 || liveCount(st) <= 1 ? -1 : findToAct(st, st.button);
}

export interface Showdown {
  pots: Pot[];
  winners: number[][];
  win: number[];
  ranks: (HandRank | null)[];
}

/** Cierra la mano: reparte el bote (sin enseñar si solo queda uno). */
export function finish(st: PState): Showdown {
  const folded = st.seats.map((s) => !inHand(s));
  const pots = buildPots(
    st.seats.map((s) => s.contrib),
    folded,
  );
  const alone = liveCount(st) <= 1;
  const ranks = st.seats.map((s) => (inHand(s) && !alone && st.board.length === 5 ? evaluate([...s.hole, ...st.board]) : null));
  const scores = st.seats.map((s, i) => (inHand(s) ? (ranks[i]?.score ?? 0) : null));
  const { win, winners } = awardPots(pots, scores, st.button);
  st.seats.forEach((s, i) => {
    s.stack += win[i];
    s.bet = 0;
  });
  st.street = 4;
  st.toAct = -1;
  return { pots, winners, win, ranks };
}

// ---------------------------------------------------------------------------
// Fuerza de la mano y rivales de la máquina
// ---------------------------------------------------------------------------

/** Fórmula de Chen (fuerza preflop): -1 … 20. */
export function chen(hole: Card[]): number {
  const [a, b] = hole[0].r >= hole[1].r ? hole : [hole[1], hole[0]];
  const pts = (r: number) => (r === 14 ? 10 : r === 13 ? 8 : r === 12 ? 7 : r === 11 ? 6 : r / 2);
  let s = pts(a.r);
  if (a.r === b.r) return Math.ceil(Math.max(5, s * 2));
  if (a.s === b.s) s += 2;
  const gap = a.r - b.r - 1;
  s -= gap === 0 ? 0 : gap === 1 ? 1 : gap === 2 ? 2 : gap === 3 ? 4 : 5;
  if (gap <= 1 && a.r < 12) s += 1;
  return Math.ceil(s);
}

/** Equidad (0..1) contra `opp` manos al azar, por Monte Carlo. */
export function equity(hole: Card[], board: Card[], opp: number, runs = 200, rng: Rng = Math.random): number {
  const known = new Set([...hole, ...board].map((c) => c.r * 4 + SUITS.indexOf(c.s)));
  const rest = makeDeck().filter((c) => !known.has(c.r * 4 + SUITS.indexOf(c.s)));
  let score = 0;
  const need = 5 - board.length;
  for (let k = 0; k < runs; k++) {
    // baraja parcial: solo lo que hace falta
    const take = need + opp * 2;
    for (let i = 0; i < take; i++) {
      const j = i + Math.floor(rng() * (rest.length - i));
      [rest[i], rest[j]] = [rest[j], rest[i]];
    }
    const full = board.concat(rest.slice(0, need));
    const me = quickScore([...hole, ...full]);
    let best = 0;
    let ties = 0;
    let lost = false;
    for (let o = 0; o < opp; o++) {
      const s = quickScore([rest[need + o * 2], rest[need + o * 2 + 1], ...full]);
      if (s > me) {
        lost = true;
        break;
      }
      if (s === me) ties++;
      best = Math.max(best, s);
    }
    if (!lost) score += ties ? 1 / (ties + 1) : 1;
  }
  return score / runs;
}

export interface AiStyle {
  /** 0 suelto … 1 tieso (juega pocas manos). */
  tight: number;
  /** 0 pasivo … 1 agresivo (sube en vez de igualar). */
  aggr: number;
  /** Probabilidad base de farolear. */
  bluff: number;
}

export interface AiDecision {
  action: PAction;
  bluff: boolean;
  /** Fuerza estimada (0..1), para el humor del personaje. */
  strength: number;
}

/** Decide la jugada del asiento que tiene la palabra. */
export function aiDecide(st: PState, style: AiStyle, rng: Rng = Math.random, runs = 200): AiDecision {
  const i = st.toAct;
  const me = st.seats[i];
  const L = legal(st, i);
  const pot = potTotal(st);
  const opp = Math.max(1, liveCount(st) - 1);
  const bb = st.bb;
  // posición: 0 el primero en hablar, 1 el botón
  const n = st.seats.length;
  const pos = ((i - st.button - 1 + n) % n) / Math.max(1, n - 1);
  const raiseTo = (x: number) => ({ type: 'raise', to: Math.max(L.minTo, Math.min(L.maxTo, Math.round(x / bb) * bb || L.minTo)) }) as PAction;
  const passive: PAction = L.canCheck ? { type: 'check' } : { type: 'fold' };
  const call: PAction = L.canCheck ? { type: 'check' } : { type: 'call' };
  const potOdds = L.toCall / (pot + L.toCall || 1);

  if (st.street === 0) {
    const c = chen(me.hole) + pos * 2 - style.tight * 3 + (opp <= 1 ? 2 : 0);
    const facing = L.toCall / bb; // ciegas grandes que me piden
    const strength = Math.max(0, Math.min(1, (c + 1) / 18));
    if (c >= 11 && L.canRaise) {
      const to = st.currentBet <= bb ? bb * (3 + Math.floor(rng() * 2)) : st.currentBet * 3;
      return { action: c >= 13 && rng() < 0.3 ? raiseTo(L.maxTo) : raiseTo(to), bluff: false, strength };
    }
    if (c >= 8) {
      if (facing <= 1 && L.canRaise && rng() < 0.4 + style.aggr * 0.4) return { action: raiseTo(bb * 3), bluff: false, strength };
      if (facing <= 8 || me.stack <= L.toCall * 3) return { action: call, bluff: false, strength };
      return { action: passive, bluff: false, strength };
    }
    if (c >= 5.5 && facing <= 2) return { action: call, bluff: false, strength };
    if (facing <= 0.5 && c >= 3) return { action: call, bluff: false, strength };
    // robo de ciegas desde posición tardía
    if (facing <= 1 && pos > 0.6 && L.canRaise && rng() < style.bluff * 1.5) return { action: raiseTo(bb * 3), bluff: true, strength };
    return { action: passive, bluff: false, strength };
  }

  const eq = equity(me.hole, st.board, opp, runs, rng);
  const spr = me.stack / Math.max(1, pot);
  const late = st.street >= 2;
  if (L.canCheck) {
    if (eq > 0.68 - style.aggr * 0.08 && L.canRaise) {
      const size = pot * (eq > 0.85 ? 0.75 + rng() * 0.35 : 0.45 + rng() * 0.3);
      return { action: raiseTo(spr < 0.6 ? L.maxTo : Math.max(bb, size)), bluff: false, strength: eq };
    }
    if (L.canRaise && rng() < style.bluff * (opp === 1 ? 1.2 : 0.5) * (late ? 1.2 : 0.8) && eq < 0.4) {
      return { action: raiseTo(Math.max(bb, pot * (0.5 + rng() * 0.25))), bluff: true, strength: eq };
    }
    return { action: { type: 'check' }, bluff: false, strength: eq };
  }
  // hay apuesta delante
  if (eq > 0.78 - style.aggr * 0.1 && L.canRaise && rng() < 0.45 + style.aggr * 0.45) {
    const to = st.currentBet + (pot + L.toCall) * (0.6 + rng() * 0.4);
    return { action: raiseTo(spr < 1 ? L.maxTo : to), bluff: false, strength: eq };
  }
  const margin = 0.02 + style.tight * 0.06;
  if (eq >= potOdds + margin) return { action: { type: 'call' }, bluff: false, strength: eq };
  if (L.canRaise && rng() < style.bluff * 0.35 && opp === 1 && late) {
    return { action: raiseTo(st.currentBet * 2.5 + pot * 0.3), bluff: true, strength: eq };
  }
  // proyecto barato: a veces se paga
  if (L.toCall <= bb && eq > potOdds * 0.7) return { action: { type: 'call' }, bluff: false, strength: eq };
  return { action: { type: 'fold' }, bluff: false, strength: eq };
}
