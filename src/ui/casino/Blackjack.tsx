import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { randomPerson, type Mood, type Person } from '../../art/portrait';
import { fx, play } from '../../platform/audio';
import { Backdrop, Portrait, Bubble, PopLayer, usePops, useTalk } from '../games/stage';
import {
  bjLabel,
  bjTotal,
  bjValue,
  casinoHall,
  Chip,
  ChipStack,
  dealerHits,
  decompose,
  flyChips,
  isBlackjack,
  lowFx,
  makeDeck,
  pickOne,
  PlayingCard,
  short,
  shuffle,
  useFelt,
  wait,
  type Card,
} from './cards';
import type { CasinoTableProps } from './types';
import './blackjack.css';

/**
 * Blackjack con las reglas de casino: sabot de 6 barajas con carta de corte,
 * la banca se planta con 17 blando, el blackjack paga 3 a 2, la banca mira
 * si tiene blackjack con un as o un 10 a la vista, seguro (2 a 1, hasta
 * media apuesta), doblar con dos cartas (también tras dividir), dividir
 * hasta 4 manos (los ases reciben una sola carta), rendición tardía.
 * Un `settle` por ronda con todo lo apostado y todo lo devuelto.
 */

const DECKS = 6;
const SHOE_SIZE = 52 * DECKS;
/** Se baraja cuando queda menos de un 25 % del sabot. */
const CUT = Math.round(SHOE_SIZE * 0.25);

type Res = 'bj' | 'win' | 'push' | 'lose' | 'bust' | 'surr';
interface Hand {
  cards: Card[];
  bet: number;
  doubled: boolean;
  split: boolean;
  splitAces: boolean;
  done: boolean;
  res?: Res;
}
type Phase = 'bet' | 'deal' | 'ins' | 'play' | 'dealer' | 'over';

interface G {
  phase: Phase;
  shoe: Card[];
  bet: number;
  hands: Hand[];
  active: number;
  dealer: Card[];
  hole: boolean;
  peek: boolean;
  ins: number;
  busy: boolean;
  msg: string;
  shuffling: boolean;
}

const RES_TXT: Record<Res, string> = { bj: 'BLACKJACK', win: 'GANAS', push: 'EMPATE', lose: 'PIERDES', bust: 'TE PASAS', surr: 'RENDIDO' };
const ret = (h: Hand) => (h.res === 'bj' ? h.bet * 2.5 : h.res === 'win' ? h.bet * 2 : h.res === 'push' ? h.bet : h.res === 'surr' ? h.bet / 2 : 0);

const GREET = ['¡Bienvenido a la mesa! Hagan sus apuestas.', 'Buenas noches. Apuestas, por favor.', 'Siéntate, el sabot está caliente.'];
const NO_MORE = ['No va más.', 'Cartas…', 'Suerte.', 'Allá vamos.'];
const WIN = ['Bien jugado.', 'Enhorabuena.', 'La suerte está contigo.', 'Te pago.'];
const LOSE = ['La casa gana esta vez.', 'Lo siento.', 'La próxima será.', 'Mala suerte.'];
const BUST = ['Te pasas. Lo siento.', 'Demasiado…', 'Uy, te has pasado.'];

function newShoe(): Card[] {
  return shuffle(makeDeck(DECKS));
}

export function Blackjack(p: CasinoTableProps) {
  const [, setTick] = useState(0);
  const bump = () => setTick((t) => t + 1);
  const pr = useRef(p);
  pr.current = p;
  const alive = useRef(true);
  const root = useRef<HTMLDivElement>(null);
  const felt = useFelt();
  const pops = usePops();

  const dealer = useMemo<Person>(() => {
    const b = randomPerson(Math.floor(Math.random() * 1e9));
    return { ...b, wear: 'traje', outfit: '#7a1f3d', glasses: false };
  }, []);
  const talk = useTalk(dealer);
  const say = (t: string, m: Mood = 'normal') => alive.current && talk.say(t, m);

  const g = useRef<G>({ phase: 'bet', shoe: newShoe(), bet: 0, hands: [], active: 0, dealer: [], hole: true, peek: false, ins: 0, busy: false, msg: '', shuffling: false }).current;

  useEffect(() => {
    const id = setTimeout(() => say(pickOne(GREET), 'feliz'), 450);
    return () => {
      alive.current = false;
      clearTimeout(id);
    };
  }, []);

  const min = p.chips[0];
  const pending = g.phase === 'bet' ? g.bet : g.phase === 'over' ? 0 : g.hands.reduce((a, h) => a + h.bet, 0) + g.ins;
  const avail = p.money - pending;
  const q = (sel: string) => root.current?.querySelector(sel);

  const draw = (): Card => {
    if (!g.shoe.length) g.shoe = newShoe();
    return g.shoe.pop()!;
  };

  // -------------------------------------------------------------- apuestas
  const clearTable = () => {
    if (g.phase !== 'over') return;
    g.hands = [];
    g.dealer = [];
    g.phase = 'bet';
  };

  const addChip = (i: number, e: MouseEvent) => {
    if (g.busy || (g.phase !== 'bet' && g.phase !== 'over')) return;
    clearTable();
    const v = p.chips[i];
    if (g.bet + v > p.maxBet) {
      play.error();
      say(`La mesa no admite más de ${p.fmt(p.maxBet)}.`);
      return bump();
    }
    if (g.bet + v > p.money) {
      play.error();
      say('No te llega para esa ficha.');
      return bump();
    }
    g.bet += v;
    g.msg = '';
    fx.chip();
    flyChips(e.currentTarget as Element, q('.bj-spot.main'), [i]);
    bump();
  };

  const clearBet = () => {
    if (g.busy || (g.phase !== 'bet' && g.phase !== 'over')) return;
    clearTable();
    if (g.bet > 0) {
      flyChips(q('.bj-spot.main'), q('.bj-tray'), decompose(g.bet, p.chips, 6));
      fx.chip();
    }
    g.bet = 0;
    bump();
  };

  // -------------------------------------------------------------- reparto
  const reshuffle = async () => {
    g.shuffling = true;
    bump();
    say('Se acabó el sabot. Barajo, un momento…');
    fx.shuffle();
    await wait(500);
    fx.shuffle();
    await wait(600);
    g.shoe = newShoe();
    g.shuffling = false;
    bump();
    await wait(250);
  };

  const deal = async () => {
    if (g.busy) return;
    const P = pr.current;
    if (g.bet < min) {
      play.error();
      say(`La apuesta mínima es ${P.fmt(min)}.`);
      return;
    }
    if (g.bet > P.money) {
      play.error();
      g.bet = 0;
      say('No te llega para esa apuesta.');
      return bump();
    }
    g.busy = true;
    g.hands = [];
    g.dealer = [];
    g.msg = '';
    g.ins = 0;
    g.hole = true;
    g.phase = 'deal';
    bump();
    if (g.shoe.length < CUT) await reshuffle();
    if (!alive.current) return;
    g.hands = [{ cards: [], bet: g.bet, doubled: false, split: false, splitAces: false, done: false }];
    g.active = 0;
    say(pickOne(NO_MORE));
    bump();
    for (let k = 0; k < 4; k++) {
      await wait(k ? 330 : 200);
      if (!alive.current) return;
      if (k % 2 === 0) g.hands[0].cards.push(draw());
      else g.dealer.push(draw());
      fx.card();
      bump();
    }
    await wait(500);
    const up = g.dealer[0];
    if (up.r === 14 && pr.current.money - g.bet >= g.bet / 2) {
      g.phase = 'ins';
      g.busy = false;
      say(isBlackjack(g.hands[0].cards) ? 'La banca enseña un as. ¿Pago igualado? (seguro)' : 'La banca enseña un as. ¿Seguro?', 'nervios');
      return bump();
    }
    await afterInsurance();
  };

  const takeInsurance = async (yes: boolean) => {
    if (g.phase !== 'ins' || g.busy) return;
    g.busy = true;
    if (yes) {
      g.ins = g.bet / 2;
      fx.chip();
      flyChips(q('.bj-tray'), q('.bj-ins-spot'), decompose(g.ins, p.chips, 4));
    }
    bump();
    await afterInsurance();
  };

  const afterInsurance = async () => {
    const up = g.dealer[0];
    if (up.r === 14 || bjValue(up) === 10) {
      g.phase = 'deal';
      g.peek = true;
      say('Miro mi carta…');
      bump();
      await wait(1000);
      if (!alive.current) return;
      g.peek = false;
      if (isBlackjack(g.dealer)) {
        g.hole = false;
        fx.card();
        bump();
        await wait(550);
        const h = g.hands[0];
        h.res = isBlackjack(h.cards) ? 'push' : 'lose';
        h.done = true;
        say(h.res === 'push' ? 'Blackjack de la banca… y tuyo. Empate.' : g.ins ? 'Blackjack de la banca. El seguro paga 2 a 1.' : 'Blackjack de la banca.', 'feliz');
        return finish(true);
      }
      if (g.ins) say('No tengo blackjack. El seguro se pierde.');
      bump();
      await wait(g.ins ? 700 : 300);
    }
    const h = g.hands[0];
    if (isBlackjack(h.cards)) {
      h.res = 'bj';
      h.done = true;
      g.hole = false;
      fx.card();
      bump();
      fx.jackpot();
      say('¡Blackjack! Paga tres a dos.', 'feliz');
      await wait(700);
      return finish(false);
    }
    g.phase = 'play';
    g.busy = false;
    bump();
  };

  // -------------------------------------------------------------- jugadas
  const cur = () => g.hands[g.active];
  const canDouble = () => {
    const h = cur();
    return g.phase === 'play' && !g.busy && !!h && h.cards.length === 2 && !h.splitAces && avail >= h.bet;
  };
  const canSplit = () => {
    const h = cur();
    return g.phase === 'play' && !g.busy && !!h && h.cards.length === 2 && bjValue(h.cards[0]) === bjValue(h.cards[1]) && g.hands.length < 4 && !h.splitAces && avail >= h.bet;
  };
  const canSurrender = () => g.phase === 'play' && !g.busy && g.hands.length === 1 && g.hands[0].cards.length === 2 && !g.hands[0].split;

  const hit = async () => {
    if (g.phase !== 'play' || g.busy) return;
    const h = cur();
    const before = bjTotal(h.cards);
    if (!before.soft && before.total >= 17) say(`¿Pides con ${before.total}? Con dos narices.`, 'nervios');
    g.busy = true;
    h.cards.push(draw());
    fx.card();
    bump();
    await wait(420);
    await checkHand();
  };

  const checkHand = async () => {
    const h = cur();
    const t = bjTotal(h.cards).total;
    if (t > 21) {
      h.res = 'bust';
      h.done = true;
      play.error();
      say(pickOne(BUST), 'triste');
      bump();
      await wait(600);
      return next();
    }
    if (t === 21 || h.done) {
      h.done = true;
      bump();
      await wait(250);
      return next();
    }
    g.busy = false;
    bump();
  };

  const stand = async () => {
    if (g.phase !== 'play' || g.busy) return;
    const h = cur();
    const t = bjTotal(h.cards).total;
    if (t <= 11) say(`¿Te plantas con ${t}? Interesante…`);
    g.busy = true;
    h.done = true;
    bump();
    await wait(200);
    next();
  };

  const double = async () => {
    if (!canDouble()) return;
    const h = cur();
    const t = bjTotal(h.cards).total;
    say(t === 11 ? 'Doblar con 11, de libro. Una carta.' : 'Doblas. Una sola carta.');
    g.busy = true;
    flyChips(q('.bj-tray'), q(`.bj-spot.h${g.active}`), decompose(h.bet, p.chips, 5));
    fx.chip();
    h.bet *= 2;
    h.doubled = true;
    bump();
    await wait(450);
    h.cards.push(draw());
    h.done = true;
    fx.card();
    bump();
    await wait(450);
    await checkHand();
  };

  const split = async () => {
    if (!canSplit()) return;
    const h = cur();
    const aces = h.cards[0].r === 14;
    say(aces || h.cards[0].r === 8 ? 'Ases y ochos, siempre se separan.' : 'Dividimos.');
    g.busy = true;
    const second: Hand = { cards: [h.cards[1]], bet: h.bet, doubled: false, split: true, splitAces: aces, done: false };
    h.cards = [h.cards[0]];
    h.split = true;
    h.splitAces = aces;
    g.hands.splice(g.active + 1, 0, second);
    fx.chip();
    bump();
    await wait(80);
    flyChips(q('.bj-tray'), q(`.bj-spot.h${g.active + 1}`), decompose(h.bet, p.chips, 5));
    await wait(420);
    h.cards.push(draw());
    fx.card();
    if (aces) h.done = true;
    bump();
    await wait(420);
    if (aces) {
      // los ases divididos reciben una sola carta cada uno
      second.cards.push(draw());
      second.done = true;
      fx.card();
      bump();
      await wait(450);
      return next();
    }
    await checkHand();
  };

  const surrender = async () => {
    if (!canSurrender()) return;
    g.busy = true;
    const h = g.hands[0];
    h.res = 'surr';
    h.done = true;
    say('Te rindes. Recuperas la mitad.');
    bump();
    await wait(500);
    dealerPlay();
  };

  const next = async () => {
    const i = g.hands.findIndex((h) => !h.done);
    if (i < 0) return dealerPlay();
    g.active = i;
    const h = g.hands[i];
    bump();
    if (h.cards.length < 2) {
      await wait(350);
      h.cards.push(draw());
      fx.card();
      bump();
      await wait(420);
    }
    await checkHand();
  };

  const dealerPlay = async () => {
    g.phase = 'dealer';
    g.busy = true;
    g.active = -1;
    await wait(250);
    g.hole = false;
    fx.card();
    bump();
    await wait(650);
    const live = g.hands.some((h) => !h.res);
    if (live) {
      while (dealerHits(g.dealer)) {
        if (!alive.current) return;
        g.dealer.push(draw());
        fx.card();
        bump();
        await wait(620);
      }
    }
    if (!alive.current) return;
    const dt = bjTotal(g.dealer).total;
    for (const h of g.hands) {
      if (h.res) continue;
      const t = bjTotal(h.cards).total;
      h.res = dt > 21 || t > dt ? 'win' : t === dt ? 'push' : 'lose';
      h.done = true;
    }
    if (live && dt > 21) say('¡La banca se pasa!', 'enfado');
    finish(false);
  };

  // -------------------------------------------------------------- cobro
  const finish = (dealerBJ: boolean) => {
    const P = pr.current;
    const staked = g.hands.reduce((a, h) => a + h.bet, 0) + g.ins;
    const insRet = dealerBJ && g.ins ? g.ins * 3 : 0;
    const returned = g.hands.reduce((a, h) => a + ret(h), 0) + insRet;
    const parts = g.hands.map((h) => RES_TXT[h.res ?? 'lose'].toLowerCase());
    const detail = `Blackjack: ${parts.join(', ')}${g.ins ? ` · seguro ${insRet ? 'cobrado' : 'perdido'}` : ''}`;
    const ok = P.settle(staked, returned, detail);
    g.busy = false;
    if (!ok) {
      play.error();
      g.msg = 'La banca no acepta la jugada: mano anulada.';
      say('Lo siento, la jugada queda anulada.', 'nervios');
      g.hands = [];
      g.dealer = [];
      g.ins = 0;
      g.phase = 'bet';
      return bump();
    }
    g.phase = 'over';
    const net = returned - staked;
    // fichas: lo ganado viaja hacia el jugador; lo perdido, a la banca
    g.hands.forEach((h, i) => {
      const spot = q(`.bj-spot.h${i}`);
      const r = ret(h);
      if (r > h.bet) {
        flyChips(q('.bj-rack'), spot, decompose(r - h.bet, P.chips, 5));
        flyChips(spot, q('.bj-tray'), decompose(r, P.chips, 6), 700);
      } else if (r > 0) flyChips(spot, q('.bj-tray'), decompose(r, P.chips, 5), 300);
      if (r < h.bet) flyChips(spot, q('.bj-rack'), decompose(h.bet - r, P.chips, 5), 200);
      const x = g.hands.length === 1 ? 50 : 12 + (76 * (i + 0.5)) / g.hands.length;
      const d = r - h.bet;
      if (d) setTimeout(() => alive.current && pops.pop(`${d > 0 ? '+' : '−'}${P.fmt(Math.abs(d))}`, x, 62, d > 0 ? (h.res === 'bj' ? 'gold' : 'good') : 'bad'), 250 + i * 120);
    });
    if (insRet) setTimeout(() => alive.current && pops.pop(`Seguro +${P.fmt(insRet - g.ins)}`, 50, 40, 'gold'), 200);
    if (net > 0) {
      play.good();
      if (!g.hands.some((h) => h.res === 'bj')) say(pickOne(WIN), 'feliz');
    } else if (net < 0) {
      play.bad();
      if (!dealerBJ && !g.hands.every((h) => h.res === 'bust')) say(pickOne(LOSE));
    } else {
      play.coin();
      if (!dealerBJ) say('Empate. Te quedas tu apuesta.');
    }
    // la apuesta siguiente: la misma si llega
    if (g.bet > P.money + net) g.bet = 0;
    bump();
  };

  // -------------------------------------------------------------- vista
  const nHands = Math.max(1, g.hands.length);
  const cw = nHands === 1 ? 64 : nHands === 2 ? 54 : 44;
  const overlap = nHands >= 3 ? 0.68 : 0.6;
  const showHands: Hand[] = g.hands.length ? g.hands : [{ cards: [], bet: g.bet, doubled: false, split: false, splitAces: false, done: false }];
  const inRound = g.phase !== 'bet';
  const shoeLeft = g.shoe.length / SHOE_SIZE;
  const dealerLabel = g.dealer.length ? bjLabel(g.hole ? [g.dealer[0]] : g.dealer) : '';
  const dealerTotal = bjTotal(g.dealer).total;
  const canBet = !g.busy && (g.phase === 'bet' || g.phase === 'over');

  return (
    <div class="cz bj" ref={root} data-table>
      <Backdrop draw={casinoHall} w={180} h={320} fps={lowFx() ? 4 : 10} />
      <div class="cz-head">
        <button class="btn small secondary" onClick={p.onExit} disabled={g.busy || (inRound && g.phase !== 'over')}>
          ◀ Vestíbulo
        </button>
        <div class="cz-title">
          BLACKJACK
          <small>
            Mesa {p.fmt(min)} – {p.fmt(p.maxBet)}
          </small>
        </div>
        <div class="cz-money">
          {p.fmt(p.money)}
          <small>disponible {p.fmt(Math.max(0, avail))}</small>
        </div>
      </div>

      <div class="bj-dealer-area">
        <div class="bj-dealer">
          <Portrait person={dealer} talking={talk.talking} mood={talk.mood} scale={3} />
          <span class="bj-nameplate">{dealer.name.split(' ')[0]} · crupier</span>
        </div>
        <div class="bj-bubble">
          <Bubble text={talk.line} k={talk.key} side="left" />
        </div>
      </div>

      <div class="cz-rail bj-rail">
        <div class="cz-felt bj-felt" ref={felt}>
          <div class="bj-rack" aria-hidden>
            {[3, 3, 2, 2, 1, 1, 0, 0].map((c, i) => (
              <span class="bj-rack-col" key={i}>
                {[0, 1, 2, 3].map((k) => (
                  <span key={k} class={`chip chip-${c}`} style={{ '--cs': '22px', transform: `translateY(${-k * 3}px)` }} />
                ))}
              </span>
            ))}
          </div>
          <div class={`bj-shoe ${g.shuffling ? 'shuffling' : ''}`} title="Sabot">
            <span class="bj-shoe-cards" style={{ '--left': shoeLeft }} />
            <span class="bj-shoe-cut" style={{ '--cut': CUT / SHOE_SIZE, '--left': shoeLeft }} />
            <span class="bj-shoe-mouth" />
          </div>
          <div class="bj-discard" aria-hidden />

          <div class="bj-dealer-hand">
            {dealerLabel && <span class={`bj-total ${!g.hole && dealerTotal > 21 ? 'bust' : ''}`}>{!g.hole && dealerTotal > 21 ? `${dealerTotal} ✖` : dealerLabel}</span>}
            <div class="bj-cards">
              {g.dealer.map((c, k) => (
                <PlayingCard key={c.id} card={c} up={k !== 1 || !g.hole} from=".bj-shoe-mouth" class={k === 1 && g.peek ? 'peek' : ''} style={{ '--cw': '60px', marginLeft: k ? '-30px' : '0' }} />
              ))}
            </div>
          </div>

          <svg class="bj-print" viewBox="0 0 300 70" aria-hidden>
            <defs>
              <path id="bj-arc" d="M 20 14 Q 150 62 280 14" />
              <path id="bj-arc2" d="M 40 34 Q 150 76 260 34" />
            </defs>
            <text class="bj-print-big">
              <textPath href="#bj-arc" startOffset="50%" text-anchor="middle">
                EL BLACKJACK PAGA 3 A 2
              </textPath>
            </text>
            <text class="bj-print-small">
              <textPath href="#bj-arc2" startOffset="50%" text-anchor="middle">
                LA BANCA SE PLANTA CON 17 · SEGURO PAGA 2 A 1
              </textPath>
            </text>
          </svg>
          <div class="bj-ins-spot">{g.ins > 0 && <ChipStack amount={g.ins} chips={p.chips} fmt={p.fmt} size={22} />}</div>

          <div class={`bj-hands n${nHands}`}>
            {showHands.map((h, i) => {
              const t = bjTotal(h.cards);
              const active = g.phase === 'play' && g.active === i;
              const amount = inRound ? h.bet : g.bet;
              return (
                <div class={`bj-hand ${active ? 'active' : ''} ${h.res ? `res-${h.res}` : ''}`} key={i}>
                  {active && g.hands.length > 1 && <span class="bj-arrow">▼</span>}
                  {h.cards.length > 0 && <span class={`bj-total ${t.total > 21 ? 'bust' : t.total === 21 ? 'gold' : ''}`}>{isBlackjack(h.cards, h.split) ? 'BJ' : bjLabel(h.cards)}</span>}
                  <div class="bj-cards">
                    {h.cards.map((c, k) => (
                      <PlayingCard
                        key={c.id}
                        card={c}
                        from=".bj-shoe-mouth"
                        class={h.doubled && k === 2 ? 'doubled' : ''}
                        style={{ '--cw': `${cw}px`, marginLeft: k ? `${-cw * overlap}px` : '0' }}
                      />
                    ))}
                  </div>
                  {h.res && <span class={`bj-res ${h.res}`}>{RES_TXT[h.res]}</span>}
                  <div class={`bj-spot h${i} ${i === 0 ? 'main' : ''} ${canBet && i === 0 ? 'open' : ''}`}>
                    <ChipStack amount={amount} chips={p.chips} fmt={p.fmt} size={nHands > 2 ? 24 : 30} />
                    {amount <= 0 && <span class="bj-spot-txt">APUESTA</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <div class="cz-light" />

      <div class="bj-ctrl">
        {g.msg && <div class="bj-msg">{g.msg}</div>}
        {g.phase === 'ins' ? (
          <div class="bj-row">
            <span class="bj-ask">
              ¿Seguro por <b>{p.fmt(g.bet / 2)}</b>?
            </span>
            <button class="btn good" onClick={() => takeInsurance(true)}>
              Sí
            </button>
            <button class="btn secondary" onClick={() => takeInsurance(false)}>
              No
            </button>
          </div>
        ) : g.phase === 'play' || g.phase === 'deal' || g.phase === 'dealer' ? (
          <div class="bj-actions">
            <button class="btn good" onClick={hit} disabled={g.phase !== 'play' || g.busy}>
              Pedir
            </button>
            <button class="btn" onClick={stand} disabled={g.phase !== 'play' || g.busy}>
              Plantarse
            </button>
            <button class="btn secondary" onClick={double} disabled={!canDouble()}>
              Doblar
            </button>
            <button class="btn secondary" onClick={split} disabled={!canSplit()}>
              Dividir
            </button>
            <button class="btn secondary" onClick={surrender} disabled={!canSurrender()}>
              Rendirse
            </button>
            <span class="bj-hint">{g.phase === 'dealer' ? 'Juega la banca…' : g.phase === 'deal' ? 'Repartiendo…' : g.hands.length > 1 ? `Mano ${g.active + 1} de ${g.hands.length}` : 'Tu turno'}</span>
          </div>
        ) : (
          <>
            <div class="bj-tray">
              {p.chips.map((v, i) => (
                <Chip key={i} idx={i} label={short(v)} size={50} onClick={(e) => addChip(i, e)} disabled={!canBet || g.bet + v > p.maxBet || g.bet + v > p.money} />
              ))}
              <button class="btn small secondary" onClick={clearBet} disabled={!canBet || g.bet <= 0}>
                Borrar
              </button>
            </div>
            <button class="btn big-cta bj-deal" onClick={deal} disabled={!canBet || g.bet < min || g.bet > p.money}>
              {g.phase === 'over' && g.bet >= min ? `Repetir apuesta · ${p.fmt(g.bet)}` : g.bet >= min ? `Repartir · ${p.fmt(g.bet)}` : `Apuesta mínima ${p.fmt(min)}`}
            </button>
          </>
        )}
      </div>
      <PopLayer pops={pops.pops} />
    </div>
  );
}
