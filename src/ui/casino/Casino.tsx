import { useEffect, useState } from 'preact/hooks';
import { randomPerson } from '../../art/portrait';
import { fx, play } from '../../platform/audio';
import { Backdrop, Bubble, Portrait, R, useTalk, type SceneDraw } from '../games/stage';
import { Blackjack } from './Blackjack';
import { Poker } from './Poker';
import { Roulette } from './Roulette';
import { HorseRace } from './Horses';
import type { CasinoTableProps } from './types';
import './casino.css';

export type CasinoGameId = 'poker' | 'blackjack' | 'ruleta' | 'caballos';

export interface CasinoProps {
  money: number;
  fmt: (n: number) => string;
  chips: number[];
  maxBet: number;
  /** Cuánto se puede perder aún hoy (límite de la casa). */
  lossLeft: number;
  minAge: number;
  /** Cierra una jugada en la partida; devuelve false si no se pudo. */
  onSettle: (game: CasinoGameId, staked: number, returned: number, detail: string) => boolean;
  onClose: () => void;
}

const TABLES: { id: CasinoGameId; name: string; tag: string; icon: string; rules: string }[] = [
  { id: 'poker', name: 'Póker', tag: "Texas Hold'em", icon: '♠', rules: 'Contra tres jugadores de la casa. Ciegas, cuatro rondas de apuestas y botes paralelos.' },
  { id: 'blackjack', name: 'Blackjack', tag: '6 barajas · paga 3:2', icon: '🂡', rules: 'La banca se planta con 17. Doblar, separar, seguro y rendición.' },
  { id: 'ruleta', name: 'Ruleta', tag: 'Europea · un solo cero', icon: '◎', rules: 'Pleno 35:1, caballo, calle, cuadro, línea, docenas, columnas y suertes sencillas.' },
  { id: 'caballos', name: 'Carreras', tag: 'Seis caballos · en directo', icon: '🏇', rules: 'Ganador o colocado, con las cuotas de la casa.' },
];

const HOST_LINES = ['Bienvenido al Casino Pixelopolis. ¿Le apetece probar suerte?', 'Las mesas están calientes esta noche.', 'Recuerde: juegue con cabeza. La casa siempre tiene ventaja.', '¿Una partidita de blackjack? El crupier está de buen humor.', 'Esta noche la ruleta está generosa… o eso dicen.'];

/**
 * Casino Pixelopolis: vestíbulo con el portero, las normas de la casa y las
 * cuatro mesas. Cada mesa recibe el dinero, las fichas y `settle`.
 */
export function Casino(p: CasinoProps) {
  const [table, setTable] = useState<CasinoGameId | null>(null);
  const [rules, setRules] = useState(false);
  const [host] = useState(() => randomPerson(19850606));
  const talk = useTalk(host);
  useEffect(() => {
    if (table) return;
    const t = setTimeout(() => talk.say(HOST_LINES[Math.floor(Math.random() * HOST_LINES.length)], 'feliz'), 450);
    return () => clearTimeout(t);
  }, [table]);

  const tableProps = (id: CasinoGameId): CasinoTableProps => ({
    money: p.money,
    fmt: p.fmt,
    chips: p.chips,
    maxBet: Math.min(p.maxBet, Math.max(p.chips[0], p.money)),
    settle: (staked, returned, detail) => p.onSettle(id, staked, returned, detail),
    onExit: () => {
      play.click();
      setTable(null);
    },
  });

  if (table) {
    const T = { poker: Poker, blackjack: Blackjack, ruleta: Roulette, caballos: HorseRace }[table];
    return (
      <div class="casino casino-table-wrap">
        <T {...tableProps(table)} />
      </div>
    );
  }

  return (
    <div class="casino">
      <Backdrop draw={casinoHall} w={180} h={320} fps={10} />
      <div class="casino-head">
        <button class="btn small secondary" onClick={p.onClose}>
          ◀ Salir
        </button>
        <span class="casino-money">💰 {p.fmt(p.money)}</span>
      </div>
      <div class="casino-sign">
        <span>CASINO</span>
        <b>PIXELOPOLIS</b>
      </div>
      <div class="casino-host">
        <Portrait person={host} talking={talk.talking} mood={talk.mood} scale={3} />
        <Bubble text={talk.line} k={talk.key} side="left" />
      </div>
      <div class="casino-tables">
        {TABLES.map((t) => (
          <button
            key={t.id}
            class={`casino-tile tile-${t.id}`}
            onClick={() => {
              fx.chip();
              setTable(t.id);
            }}
          >
            <span class="tile-icon">{t.icon}</span>
            <span class="tile-name">{t.name}</span>
            <small>{t.tag}</small>
          </button>
        ))}
      </div>
      <button class="casino-rules-btn" onClick={() => setRules(true)}>
        📜 Normas de la casa
      </button>
      <div class="casino-limits">
        Apuesta máx. {p.fmt(p.maxBet)} · hoy puedes perder aún {p.fmt(Math.max(0, p.lossLeft))}
      </div>
      {rules && (
        <div class="mg-overlay casino-rules" onClick={() => setRules(false)}>
          <h3>Normas de la casa</h3>
          <ol>
            <li>Solo mayores de {p.minAge} años. Se pide identificación en la puerta.</li>
            <li>Fichas de {p.chips.map(p.fmt).join(', ')}. Apuesta máxima por jugada: {p.fmt(p.maxBet)}.</li>
            <li>Juego responsable: al llegar al límite de pérdidas del día, la casa no admite más apuestas.</li>
            {TABLES.map((t) => (
              <li key={t.id}>
                <b>{t.name}:</b> {t.rules}
              </li>
            ))}
            <li>Todo el dinero del juego es ficticio. Aquí no se gana ni se pierde dinero real.</li>
          </ol>
          <button class="btn">Entendido</button>
        </div>
      )}
    </div>
  );
}

/** Sala del casino: moqueta, tragaperras con luces y lámparas de araña. */
const casinoHall: SceneDraw = (ctx, t, w, h) => {
  // pared granate con molduras doradas
  R(ctx, 0, 0, w, h, '#3a0f22');
  for (let x = 0; x < w; x += 30) {
    R(ctx, x + 3, 30, 24, 90, '#4a1430');
    R(ctx, x + 3, 30, 24, 1, '#c8a040');
    R(ctx, x + 3, 119, 24, 1, '#7a5a20');
  }
  // lámparas de araña que brillan
  for (let i = 0; i < 3; i++) {
    const cx = 30 + i * 60;
    const glow = 0.5 + Math.sin(t * 2 + i) * 0.08;
    const g = ctx.createRadialGradient(cx, 18, 1, cx, 18, 40);
    g.addColorStop(0, `rgba(255,220,150,${glow})`);
    g.addColorStop(1, 'rgba(255,220,150,0)');
    ctx.fillStyle = g;
    ctx.fillRect(cx - 40, 0, 80, 60);
    R(ctx, cx - 8, 14, 16, 4, '#ffd27a');
    R(ctx, cx - 1, 0, 2, 14, '#8a6a20');
    for (let k = -2; k <= 2; k++) R(ctx, cx + k * 4, 18, 1, 3 + (k & 1), '#fff2c0');
  }
  // fila de tragaperras con luces que corren
  for (let i = 0; i < 6; i++) {
    const x = 4 + i * 30;
    const y = 128;
    R(ctx, x, y, 24, 44, '#1d1d28');
    R(ctx, x + 2, y + 2, 20, 10, ['#ff4f9a', '#4ff0ff', '#ffcc33'][i % 3]);
    R(ctx, x + 3, y + 15, 18, 12, '#f4efe2');
    for (let r = 0; r < 3; r++) {
      const sym = Math.floor(t * 8 + i * 3 + r * 5) % 4;
      R(ctx, x + 4 + r * 6, y + 18, 4, 6, ['#e8414f', '#ffcc33', '#35d07f', '#2f6fb3'][sym]);
    }
    R(ctx, x + 2, y + 30, 20, 12, '#2a2a38');
    // bombillas del marco
    for (let k = 0; k < 6; k++) {
      const on = (Math.floor(t * 6) + k + i) % 3 === 0;
      R(ctx, x + 1 + k * 4, y - 3, 2, 2, on ? '#fff2a0' : '#6a5a20');
    }
    R(ctx, x + 24, y + 6, 2, 14, '#9aa0a8');
    R(ctx, x + 23, y + 4, 4, 4, '#e8414f');
  }
  // moqueta de casino con dibujo
  for (let y = 174; y < h; y += 10)
    for (let x = 0; x < w; x += 10) {
      R(ctx, x, y, 10, 10, (x + y) % 20 === 4 ? '#5a1430' : '#4a0f28');
      R(ctx, x + 4, y + 4, 2, 2, (x * y) % 3 ? '#c8a040' : '#2a8a7a');
    }
  // oscurecer hacia abajo
  const v = ctx.createLinearGradient(0, h * 0.4, 0, h);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, w, h);
};
