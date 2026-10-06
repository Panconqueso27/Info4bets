import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { randomPerson, type Mood, type Person } from '../../art/portrait';
import { fx, play } from '../../platform/audio';
import { Backdrop, Bubble, Portrait, PopLayer, usePops, useTalk, type Talk } from '../games/stage';
import {
  act,
  aiDecide,
  casinoHall,
  ChipStack,
  decompose,
  finish,
  flyChips,
  legal,
  liveCount,
  lowFx,
  nextButton,
  nextStreet,
  pickOne,
  PlayingCard,
  potTotal,
  startHand,
  useFelt,
  wait,
  type AiStyle,
  type Card,
  type PAction,
  type PState,
  type Showdown,
} from './cards';
import type { CasinoTableProps } from './types';
import './poker.css';

/**
 * Texas Hold'em contra tres rivales de la máquina. Ciegas = chips[0] y
 * 2 × chips[0]; el botón rota; rondas preflop, flop, turn y river con
 * subida mínima, all-in y botes laterales; enseñanza con la mano ganadora.
 *
 * EXCEPCIÓN AL CONTRATO "un settle por mano": en el póker el jugador compra
 * fichas (buy-in) al sentarse y NO se cobra nada mano a mano. Se llama a
 * `settle(buyIn, fichasAlLevantarse, detalle)` UNA vez por sesión: al
 * levantarse (botón Vestíbulo), al quedarse sin fichas (fichas 0) o si la
 * mesa se desmonta con la sesión abierta. Si `settle` devuelve false al
 * levantarse, se sale igualmente.
 */

interface Opp {
  person: Person;
  style: AiStyle;
}

type Phase = 'buyin' | 'table' | 'busted';

interface PG {
  phase: Phase;
  st: PState | null;
  stacks: number[];
  button: number;
  opps: Opp[];
  buyIn: number;
  open: boolean;
  vis: number[];
  boardVis: number;
  thinking: number;
  status: string[];
  sd: Showdown | null;
  reveal: boolean;
  banner: string;
  resolve: ((a: PAction) => void) | null;
  next: (() => void) | null;
  between: boolean;
  confirmLeave: boolean;
  /** Fichas recogidas en el centro (lo de rondas anteriores). */
  collected: number;
}

const FOLD = ['Paso de esto.', 'Me retiro.', 'No voy.', 'Para ti.', 'Demasiado para mí.'];
const CHECK = ['Paso.', 'Toco mesa.', 'Paso, paso.'];
const CALL = ['Lo veo.', 'Voy.', 'Igualo.', 'A ver qué tienes.'];
const RAISE = ['Subo.', 'Que suba la cosa.', 'Esto vale más.', 'Vamos a animarlo.'];
const BLUFF = ['Eh… subo.', 'Subo. Sí. Subo.', 'Ni lo pienses.', 'Tengo… algo.'];
const ALLIN = ['¡Voy con todo!', '¡All-in!', '¡Todo dentro!'];
const WINL = ['¡Para mí!', 'Gracias, gracias.', 'Ven aquí, bote.', 'Así se juega.'];
const LOSEL = ['¡No puede ser!', 'Maldita sea…', '¿En serio?', 'Me la has jugado.'];
const HELLO = ['Hola. ¿Jugamos?', 'Buenas. Que corran las cartas.', 'Vengo a ganar.', 'A ver qué se cuece aquí.'];

const newOpp = (): Opp => {
  const person = randomPerson(Math.floor(Math.random() * 1e9));
  const r = Math.random;
  return { person, style: { tight: 0.2 + r() * 0.6, aggr: 0.2 + r() * 0.6, bluff: 0.03 + r() * 0.12 } };
};
const first = (p: Person) => p.name.split(' ')[0];

export function Poker(p: CasinoTableProps) {
  const [, setTick] = useState(0);
  const bump = () => setTick((t) => t + 1);
  const pr = useRef(p);
  pr.current = p;
  const alive = useRef(true);
  const root = useRef<HTMLDivElement>(null);
  const felt = useFelt();
  const pops = usePops();
  const sb = p.chips[0];
  const bb = sb * 2;
  const maxBuy = Math.floor(Math.min(p.money, bb * 100) / sb) * sb;
  const minBuy = Math.min(bb * 20, maxBuy);
  const [buy, setBuy] = useState(() => Math.max(minBuy, Math.min(maxBuy, bb * 50)));
  const [raiseTo, setRaiseTo] = useState(0);

  const croupier = useMemo<Person>(() => ({ ...randomPerson(Math.floor(Math.random() * 1e9)), wear: 'traje', outfit: '#1f2a5a' }), []);
  const g = useRef<PG>({
    phase: 'buyin',
    st: null,
    stacks: [0, 0, 0, 0],
    button: Math.floor(Math.random() * 4),
    opps: [newOpp(), newOpp(), newOpp(), newOpp()],
    buyIn: 0,
    open: false,
    vis: [0, 0, 0, 0],
    boardVis: 0,
    thinking: -1,
    status: ['', '', '', ''],
    sd: null,
    reveal: false,
    banner: '',
    resolve: null,
    next: null,
    between: false,
    confirmLeave: false,
    collected: 0,
  }).current;

  const ct = useTalk(croupier);
  const t1 = useTalk(g.opps[1].person);
  const t2 = useTalk(g.opps[2].person);
  const t3 = useTalk(g.opps[3].person);
  const talks: (Talk | null)[] = [null, t1, t2, t3];
  const talksRef = useRef(talks);
  talksRef.current = talks;
  const say = (i: number, text: string, m: Mood = 'normal') => {
    if (!alive.current) return;
    const t = i < 0 ? ct : talksRef.current[i];
    t?.say(text, m);
  };
  const q = (sel: string) => root.current?.querySelector(sel);

  // ---------------------------------------------------------------- sesión
  const closeSession = (stack: number, why: string) => {
    if (!g.open) return true;
    g.open = false;
    const net = stack - g.buyIn;
    return pr.current.settle(g.buyIn, stack, `Póker (${why}): ${net >= 0 ? '+' : '−'}${pr.current.fmt(Math.abs(net))}`);
  };

  useEffect(() => {
    const id = setTimeout(() => say(-1, 'Bienvenido a la mesa de Hold’em. ¿Cuántas fichas quieres?'), 400);
    return () => {
      clearTimeout(id);
      alive.current = false;
      g.resolve = null;
      // sesión abierta al desmontar: se cobra con lo que haya en la mesa
      if (g.open) closeSession(g.st ? g.st.seats[0].stack : g.stacks[0], 'abandono');
    };
  }, []);

  const sitDown = () => {
    if (buy < minBuy || buy > p.money || buy <= 0) return play.error();
    g.buyIn = buy;
    g.open = true;
    g.stacks = [buy, ...[1, 2, 3].map(() => Math.round((60 + Math.random() * 80) * bb / sb) * sb)];
    g.phase = 'table';
    fx.chip();
    play.coin();
    say(-1, `Aquí tienes ${p.fmt(buy)} en fichas. ¡Suerte!`, 'feliz');
    bump();
    setTimeout(() => say(1 + Math.floor(Math.random() * 3), pickOne(HELLO), 'feliz'), 1400);
    runHands();
  };

  const leave = () => {
    const st = g.st;
    const inHandNow = !!st && st.street < 4 && !st.seats[0].folded && st.seats[0].contrib > 0 && g.phase === 'table';
    if (inHandNow && !g.confirmLeave) {
      g.confirmLeave = true;
      play.error();
      bump();
      setTimeout(() => {
        g.confirmLeave = false;
        alive.current && bump();
      }, 2600);
      return;
    }
    const stack = st && g.phase === 'table' ? st.seats[0].stack : g.stacks[0];
    if (g.open) closeSession(stack, 'te levantas');
    alive.current = false;
    g.resolve = null;
    p.onExit();
  };

  // ---------------------------------------------------------------- partida
  const runHands = async () => {
    while (alive.current && g.phase === 'table') {
      await playHand();
      if (!alive.current) return;
      if (g.stacks[0] <= 0) {
        closeSession(0, 'sin fichas');
        g.phase = 'busted';
        play.bad();
        say(-1, 'Te has quedado sin fichas. Otra vez será.');
        bump();
        return;
      }
      // rivales arruinados: se levantan y se sienta otro
      for (let i = 1; i <= 3; i++) {
        if (g.stacks[i] > 0) continue;
        say(i, 'Me he quedado seco. Me voy.', 'triste');
        await wait(900);
        if (!alive.current) return;
        g.opps[i] = newOpp();
        g.stacks[i] = Math.round((60 + Math.random() * 80) * bb / sb) * sb;
        fx.door();
        bump();
        await wait(300);
        say(-1, `Se sienta ${first(g.opps[i].person)}.`);
        await wait(700);
        say(i, pickOne(HELLO), 'feliz');
      }
      g.between = true;
      bump();
      await new Promise<void>((res) => {
        const id = setTimeout(res, 4200);
        g.next = () => {
          clearTimeout(id);
          res();
        };
      });
      g.next = null;
      g.between = false;
    }
  };

  const waitPlayer = () =>
    new Promise<PAction>((res) => {
      g.resolve = res;
      const st = g.st!;
      const L = legal(st);
      setRaiseTo(L.minTo);
      play.notify();
      bump();
    });

  const label = (i: number, a: PAction, wasBet: number, st: PState) => {
    const s = st.seats[i];
    const f = pr.current.fmt;
    if (a.type === 'fold') return 'No va';
    if (s.allIn) return 'ALL-IN';
    if (a.type === 'check') return 'Pasa';
    if (a.type === 'call') return `Iguala ${f(s.bet)}`;
    return wasBet === 0 ? `Apuesta ${f(s.bet)}` : `Sube a ${f(s.bet)}`;
  };

  const doAction = (i: number, a: PAction, bluff = false, strength = 0.5) => {
    const st = g.st!;
    const wasBet = st.currentBet;
    const before = st.seats[i].bet;
    const done = act(st, a);
    const put = st.seats[i].bet - before;
    g.status[i] = label(i, done, wasBet, st);
    if (put > 0) {
      fx.chip();
      flyChips(q(`.pk-seat.s${i} .pk-plate`), q(`.pk-bet.b${i}`), decompose(put, pr.current.chips, 4));
    } else if (done.type === 'fold') fx.whoosh();
    else play.click();
    if (i > 0) {
      const s = st.seats[i];
      if (s.allIn && put > 0) say(i, pickOne(ALLIN), bluff ? 'nervios' : 'feliz');
      else if (done.type === 'raise') say(i, pickOne(bluff ? BLUFF : RAISE), bluff ? 'nervios' : strength > 0.8 ? 'feliz' : 'normal');
      else if (Math.random() < 0.45) {
        if (done.type === 'fold') say(i, pickOne(FOLD), Math.random() < 0.4 ? 'triste' : 'normal');
        else if (done.type === 'check') say(i, pickOne(CHECK));
        else say(i, pickOne(CALL), strength < 0.35 ? 'nervios' : 'normal');
      }
    }
    bump();
  };

  const playHand = async () => {
    g.button = nextButton(g.stacks, g.button);
    const st = startHand(g.stacks, g.button, sb, bb);
    g.st = st;
    g.vis = [0, 0, 0, 0];
    g.boardVis = 0;
    g.status = ['', '', '', ''];
    g.sd = null;
    g.reveal = false;
    g.banner = '';
    g.collected = 0;
    g.thinking = -1;
    g.status[st.sbSeat] = 'Ciega peq.';
    g.status[st.bbSeat] = 'Ciega gr.';
    if (Math.random() < 0.5) say(-1, pickOne(['Nueva mano. Ciegas, por favor.', 'Barajo y reparto.', 'Hagan juego, señores.']));
    fx.shuffle();
    bump();
    await wait(450);
    fx.chip();
    flyChips(q(`.pk-seat.s${st.sbSeat} .pk-plate`), q(`.pk-bet.b${st.sbSeat}`), [0]);
    flyChips(q(`.pk-seat.s${st.bbSeat} .pk-plate`), q(`.pk-bet.b${st.bbSeat}`), [0, 0]);
    // reparto: una carta a cada uno, dos vueltas, desde la izquierda del botón
    for (let r = 0; r < 2; r++)
      for (let k = 1; k <= 4; k++) {
        const i = (g.button + k) % 4;
        if (st.seats[i].out) continue;
        await wait(150);
        if (!alive.current) return;
        g.vis[i]++;
        fx.card();
        bump();
      }
    await wait(450);

    for (;;) {
      if (!alive.current) return;
      if (st.toAct >= 0) {
        const i = st.toAct;
        if (i === 0) {
          const a = await waitPlayer();
          g.resolve = null;
          if (!alive.current) return;
          doAction(0, a);
        } else {
          g.thinking = i;
          bump();
          await wait(400 + Math.random() * 500);
          if (!alive.current) return;
          const d = aiDecide(st, g.opps[i].style);
          g.thinking = -1;
          doAction(i, d.action, d.bluff, d.strength);
        }
        await wait(250);
        continue;
      }
      // ronda cerrada
      if (liveCount(st) <= 1 || st.street >= 3) break;
      await wait(400);
      collectBets(st);
      await wait(450);
      if (!alive.current) return;
      nextStreet(st);
      // nadie más puede apostar: se enseñan las cartas (all-in)
      if (st.toAct < 0 && liveCount(st) > 1) g.reveal = true;
      g.status = g.status.map((s, i) => (st.seats[i].folded ? 'No va' : st.seats[i].allIn ? 'ALL-IN' : ''));
      const street = st.street;
      say(-1, street === 1 ? 'El flop.' : street === 2 ? 'El turn.' : 'Y el river.');
      while (g.boardVis < st.board.length) {
        await wait(street === 1 ? 220 : 380);
        if (!alive.current) return;
        g.boardVis++;
        fx.card();
        bump();
      }
      await wait(g.reveal ? 1100 : 500);
    }

    // fin de la mano
    await wait(400);
    collectBets(st);
    await wait(400);
    if (!alive.current) return;
    const before = st.seats.map((s) => s.stack + s.contrib);
    const live = liveCount(st);
    const sd = finish(st);
    g.sd = sd;
    if (live > 1) {
      g.reveal = true;
      say(-1, 'Cartas arriba.');
      fx.card();
      bump();
      await wait(900);
    }
    const winners = [...new Set(sd.winners.flat())];
    const main = sd.winners[0]?.[0] ?? winners[0];
    const who = (i: number) => (i === 0 ? 'Tú' : first(g.opps[i].person));
    const hand = sd.ranks[main];
    g.banner = winners.length > 1 && sd.winners[0].length > 1 ? `Bote repartido${hand ? ` · ${hand.desc}` : ''}` : `${who(main)} ${main === 0 ? 'ganas' : 'gana'}${hand ? ` con ${hand.desc}` : ''}`;
    if (!lowFx()) winners.forEach((w, k) => flyChips(q('.pk-pot'), q(`.pk-seat.s${w} .pk-plate`), decompose(sd.win[w], pr.current.chips, 6), k * 150));
    fx.chip();
    winners.forEach((w) => {
      const net = sd.win[w] - st.seats[w].contrib;
      if (net > 0) setTimeout(() => alive.current && pops.pop(`+${pr.current.fmt(net)}`, ...seatXY(w), 'gold'), 350);
    });
    if (winners.includes(0)) {
      const net = sd.win[0] - st.seats[0].contrib;
      if (net >= bb * 30) fx.jackpot();
      else play.good();
      say(-1, pickOne(['El bote es tuyo.', 'Enhorabuena.', 'Bien jugado.']), 'feliz');
    } else {
      if (st.seats[0].contrib > 0 && !st.seats[0].folded) play.bad();
      say(-1, `El bote es para ${who(main)}.`);
    }
    for (let i = 1; i <= 3; i++) {
      const delta = st.seats[i].stack - before[i];
      if (winners.includes(i) && delta > bb * 2) setTimeout(() => say(i, pickOne(WINL), 'feliz'), 700);
      else if (delta < -bb * 15 && live > 1) setTimeout(() => say(i, pickOne(LOSEL), 'enfado'), 1100);
    }
    g.stacks = st.seats.map((s) => s.stack);
    g.collected = 0;
    bump();
    await wait(1500);
  };

  const collectBets = (st: PState) => {
    let any = false;
    st.seats.forEach((s, i) => {
      if (s.bet > 0) {
        any = true;
        flyChips(q(`.pk-bet.b${i}`), q('.pk-pot'), decompose(s.bet, pr.current.chips, 4));
      }
    });
    if (any) fx.chip();
    g.collected = potTotal(st);
    st.seats.forEach((s) => (s.bet = 0));
    bump();
  };

  const seatXY = (i: number): [number, number] => (i === 0 ? [50, 70] : i === 1 ? [16, 44] : i === 2 ? [26, 16] : [74, 16]);

  // ---------------------------------------------------------------- vista
  const st = g.st;
  const myTurn = !!st && st.toAct === 0 && !!g.resolve;
  const L = myTurn ? legal(st!) : null;
  const pot = st ? (st.street >= 4 ? 0 : g.collected) : 0;
  const potNow = st && st.street < 4 ? potTotal(st) : 0;
  const myStack = st && g.phase === 'table' ? st.seats[0].stack : g.stacks[0];
  const winCards = new Set<number>();
  if (g.sd) for (const w of new Set(g.sd.winners.flat())) g.sd.ranks[w]?.best.forEach((c) => winCards.add(c.id));
  const showdown = !!g.sd && g.reveal;
  const cardCls = (c: Card) => (showdown && winCards.size ? (winCards.has(c.id) ? 'win' : 'dim') : '');

  const presets: [string, number][] = L
    ? [
        ['Mín', L.minTo],
        ['½ bote', st!.currentBet + Math.round((potNow + L.toCall) / 2 / sb) * sb],
        ['Bote', st!.currentBet + potNow + L.toCall],
        ['All-in', L.maxTo],
      ]
    : [];
  const clampR = (v: number) => (L ? Math.max(L.minTo, Math.min(L.maxTo, v)) : v);
  const rTo = clampR(raiseTo);
  const send = (a: PAction) => {
    const r = g.resolve;
    if (!r) return;
    g.resolve = null;
    r(a);
  };

  const seat = (i: number) => {
    const s = st?.seats[i];
    const opp = g.opps[i];
    const stack = s && g.phase === 'table' ? s.stack : g.stacks[i];
    const folded = !!s?.folded;
    const talk = talks[i]!;
    const won = !!g.sd && g.sd.winners.flat().includes(i);
    return (
      <div class={`pk-seat s${i} ${folded ? 'folded' : ''} ${st?.toAct === i ? 'turn' : ''} ${won ? 'won' : ''}`} key={`${i}-${opp.person.name}`}>
        <div class="pk-ava">
          {<Portrait person={opp.person} talking={talk.talking} mood={talk.mood} scale={2} look={i === 1 ? 1 : i === 2 ? 1 : -1} />}
          {g.thinking === i && <span class="pk-think">pensando<i>.</i><i>.</i><i>.</i></span>}
          {g.button === i && g.phase === 'table' && <span class="cz-dbtn">D</span>}
        </div>
        <div class="pk-plate">
          <b>{first(opp.person)}</b>
          <span>{g.phase === 'buyin' ? p.fmt(g.stacks[i] || bb * 100) : p.fmt(stack)}</span>
        </div>
        <div class="pk-hole">
          {s &&
            s.hole.slice(0, g.vis[i]).map((c) => (
              <PlayingCard key={c.id} card={c} up={g.reveal && !folded} from=".pk-deck" class={cardCls(c)} style={{ '--cw': '30px' }} />
            ))}
        </div>
        {g.status[i] && <span class={`pk-status ${g.status[i] === 'ALL-IN' ? 'allin' : ''}`}>{g.status[i]}</span>}
        {g.sd && g.reveal && !folded && g.sd.ranks[i] && <span class="pk-handname">{g.sd.ranks[i]!.name}</span>}
        <div class={`pk-bubble pk-bubble-${i}`}>
          <Bubble text={talk.line} k={talk.key} side={i === 3 ? 'right' : 'left'} />
        </div>
      </div>
    );
  };

  return (
    <div class="cz pk" ref={root} data-table>
      <Backdrop draw={casinoHall} w={180} h={320} fps={lowFx() ? 4 : 10} />
      <div class="cz-head">
        <button class={`btn small ${g.confirmLeave ? 'danger' : 'secondary'}`} onClick={leave}>
          {g.confirmLeave ? '¿Abandonar?' : '◀ Vestíbulo'}
        </button>
        <div class="cz-title">
          TEXAS HOLD'EM
          <small>
            Ciegas {p.fmt(sb)} / {p.fmt(bb)}
          </small>
        </div>
        <div class="cz-money">
          {g.open ? p.fmt(myStack) : p.fmt(p.money)}
          <small>{g.open ? `en mesa · cartera ${p.fmt(p.money - g.buyIn)}` : 'cartera'}</small>
        </div>
      </div>

      <div class="pk-area">
        <div class="cz-rail pk-rail">
          <div class="cz-felt pk-felt" ref={felt}>
            <div class="pk-logo cz-print">PIXELOPOLIS</div>
            <div class="pk-deck" />
          </div>
        </div>

        <div class="pk-croupier">
          <Portrait person={croupier} talking={ct.talking} mood={ct.mood} scale={2} look={-1} />
          <span class="pk-cr-name">crupier</span>
          <div class="pk-bubble pk-bubble-c">
            <Bubble text={ct.line} k={ct.key} side="right" />
          </div>
        </div>

        {[1, 2, 3].map(seat)}

        <div class="pk-center">
          <div class="pk-pot">
            {pot > 0 && <ChipStack amount={pot} chips={p.chips} size={22} label={false} />}
            {potNow > 0 && <span class="pk-pot-lab">Bote {p.fmt(potNow)}</span>}
          </div>
          <div class="pk-board">
            {[0, 1, 2, 3, 4].map((k) => {
              const c = st?.board[k];
              return (
                <div class="pk-slot" key={k}>
                  {c && k < g.boardVis && <PlayingCard key={c.id} card={c} from=".pk-deck" class={cardCls(c)} style={{ '--cw': '46px' }} />}
                </div>
              );
            })}
          </div>
          {g.banner && (
            <div class="pk-banner" key={g.banner}>
              {g.banner}
            </div>
          )}
        </div>

        {[0, 1, 2, 3].map((i) => (
          <div class={`pk-bet b${i}`} key={i}>
            {st && st.seats[i].bet > 0 && <ChipStack amount={st.seats[i].bet} chips={p.chips} fmt={p.fmt} size={20} />}
          </div>
        ))}

        <div class={`pk-seat s0 me ${st?.seats[0].folded ? 'folded' : ''} ${myTurn ? 'turn' : ''} ${g.sd?.winners.flat().includes(0) ? 'won' : ''}`}>
          <div class="pk-hole">
            {st?.seats[0].hole.slice(0, g.vis[0]).map((c, k) => (
              <PlayingCard key={c.id} card={c} from=".pk-deck" class={cardCls(c)} style={{ '--cw': '62px', rotate: `${k ? 6 : -6}deg` }} />
            ))}
          </div>
          <div class="pk-plate">
            {g.button === 0 && g.phase === 'table' && <span class="cz-dbtn">D</span>}
            <b>Tú</b>
            <span>{p.fmt(myStack)}</span>
            {g.status[0] && <em>{g.status[0]}</em>}
          </div>
          {g.sd && g.reveal && !st?.seats[0].folded && g.sd.ranks[0] && <span class="pk-handname me">{g.sd.ranks[0]!.desc}</span>}
        </div>
      </div>
      <div class="cz-light" />

      <div class="pk-ctrl">
        {g.phase === 'table' && myTurn && L ? (
          <>
            {L.canRaise && (
              <div class="pk-raise">
                <div class="pk-presets">
                  {presets.map(([t, v]) => (
                    <button key={t} class={`btn small secondary ${clampR(v) === rTo ? 'on' : ''}`} onClick={() => setRaiseTo(clampR(v))}>
                      {t}
                    </button>
                  ))}
                </div>
                <input
                  type="range"
                  class="pk-slider"
                  min={L.minTo}
                  max={L.maxTo}
                  step={sb}
                  value={rTo}
                  onInput={(e) => setRaiseTo(clampR(Number((e.currentTarget as HTMLInputElement).value)))}
                />
              </div>
            )}
            <div class="pk-actions">
              <button class="btn danger" onClick={() => send({ type: 'fold' })} disabled={L.canCheck}>
                Retirarse
              </button>
              <button class="btn good" onClick={() => send(L.canCheck ? { type: 'check' } : { type: 'call' })}>
                {L.canCheck ? 'Pasar' : L.toCall >= st!.seats[0].stack ? `All-in ${p.fmt(L.toCall)}` : `Igualar ${p.fmt(L.toCall)}`}
              </button>
              <button class="btn" onClick={() => send({ type: 'raise', to: rTo })} disabled={!L.canRaise}>
                {rTo >= L.maxTo ? `All-in ${p.fmt(L.maxTo)}` : st!.currentBet === 0 ? `Apostar ${p.fmt(rTo)}` : `Subir a ${p.fmt(rTo)}`}
              </button>
            </div>
          </>
        ) : g.phase === 'table' ? (
          <div class="pk-wait">
            {g.between ? (
              <button class="btn big-cta" onClick={() => g.next?.()}>
                Siguiente mano ▶
              </button>
            ) : (
              <span>
                {st?.seats[0].folded
                  ? 'Te has retirado de esta mano.'
                  : g.thinking > 0
                    ? `Esperando a ${first(g.opps[g.thinking].person)}…`
                    : st?.seats[0].allIn
                      ? 'Estás all-in. ¡Que salgan buenas cartas!'
                      : 'Repartiendo…'}
              </span>
            )}
          </div>
        ) : null}
      </div>

      {g.phase === 'buyin' && (
        <div class="pk-overlay">
          <div class="pk-panel">
            <h3>Mesa de Texas Hold’em</h3>
            <p>
              Ciegas <b>{p.fmt(sb)}</b> / <b>{p.fmt(bb)}</b> · 3 rivales.
              <br />
              Compras fichas al sentarte; se liquida todo al levantarte.
            </p>
            {maxBuy >= bb * 10 ? (
              <>
                <div class="pk-buy">
                  <ChipStack amount={buy} chips={p.chips} size={30} label={false} />
                  <span class="pk-buy-amt">{p.fmt(buy)}</span>
                </div>
                <input type="range" class="pk-slider" min={minBuy} max={maxBuy} step={sb} value={buy} onInput={(e) => setBuy(Number((e.currentTarget as HTMLInputElement).value))} />
                <div class="pk-buy-range">
                  <span>{p.fmt(minBuy)}</span>
                  <span>máx. {p.fmt(maxBuy)}</span>
                </div>
                <button class="btn big-cta" onClick={sitDown}>
                  Sentarse con {p.fmt(buy)}
                </button>
              </>
            ) : (
              <p class="pk-warn">Necesitas al menos {p.fmt(bb * 10)} para sentarte.</p>
            )}
            <button class="btn secondary" onClick={p.onExit}>
              Volver al vestíbulo
            </button>
          </div>
        </div>
      )}
      {g.phase === 'busted' && (
        <div class="pk-overlay">
          <div class="pk-panel">
            <h3>Sin fichas</h3>
            <p>Te has dejado {p.fmt(g.buyIn)} en la mesa.</p>
            <button
              class="btn big-cta"
              onClick={() => {
                g.phase = 'buyin';
                g.st = null;
                g.sd = null;
                g.banner = '';
                g.stacks[0] = 0;
                setBuy(Math.max(minBuy, Math.min(maxBuy, bb * 50)));
                bump();
              }}
            >
              Volver a comprar
            </button>
            <button class="btn secondary" onClick={p.onExit}>
              Volver al vestíbulo
            </button>
          </div>
        </div>
      )}
      <PopLayer pops={pops.pops} />
    </div>
  );
}
