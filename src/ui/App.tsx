import { useEffect, useRef, useState } from 'preact/hooks';
import {
  advance,
  applyMinigame,
  buyCar,
  buyUpgrade,
  startErrand,
  canStartShift,
  forceEvent,
  markNewsSeen,
  newGame,
  placeBet,
  resolveEvent,
  retire,
  startAction,
  startShift,
  takeNotice,
  type ResolvedOutcome,
} from '../core/game';
import { EVENTS } from '../core/events/catalog';
import { ROLES } from '../core/roles';
import { addDays, startOfDay } from '../core/time';
import type { Character, GameState, Role } from '../core/types';
import * as clock from '../platform/clock';
import * as notify from '../platform/notify';
import { deleteGame, loadGame, saveGame } from '../platform/save';
import { bridge, type Spot } from '../scene/bridge';
import { DevPanel } from './DevPanel';
import { MarketTerminal } from './Market';
import { AchievementsModal, AgendaModal, EndingModal, NewsModal, UpgradeModal } from './Panels';
import { Dock, GameOverModal, Hud, LogModal, MenuModal, Toast, eventNotification, type Panel } from './Play';
import { DecisionCard, ResultCard } from './Cards';
import { Dishwasher } from './Dishwasher';
import { Paperwork } from './Paperwork';
import * as audio from '../platform/audio';
import { lightAt } from '../art/daynight';
import { Customizer, IdentityForm, RoleSelect, TitleScreen } from './Setup';

type Screen =
  | { id: 'title' }
  | { id: 'role' }
  | { id: 'identity'; role: Role }
  | { id: 'look'; role: Role; name: string; age: number }
  | { id: 'play' };

function spotFor(s: GameState, now: number): Spot {
  if (s.gameOver) return 'home';
  if (s.detainedUntil > now) return 'away';
  if (s.errand) return 'errand';
  if (s.shift && !s.shift.cancelled) return 'work';
  return 'home';
}

/** Recordatorio para el día siguiente a las 10:00 si aún no se ha trabajado. */
const REMINDER_HOUR = 10;

export function App() {
  const game = useRef<GameState | null>(loadGame());
  const [screen, setScreen] = useState<Screen>({ id: 'title' });
  const [now, setNow] = useState(clock.now());
  const [, setVersion] = useState(0);
  const [outcome, setOutcome] = useState<ResolvedOutcome | null>(null);
  const [showEvent, setShowEvent] = useState(false);
  const [panel, setPanel] = useState<Panel | null>(null);
  const [toast, setToast] = useState<{ title: string; text: string } | null>(null);
  const [devEnabled, setDevEnabled] = useState(() => clock.isDevEnabled());
  const [endingSeen, setEndingSeen] = useState(false);
  const [minigame, setMinigame] = useState(false);
  const seenPending = useRef(new Set<string>());

  const state = game.current;
  const playing = screen.id === 'play' && state;

  const commit = () => {
    if (game.current) saveGame(game.current);
    setVersion((v) => v + 1);
  };

  // Reloj principal: hace avanzar el estado y refresca contadores.
  useEffect(() => {
    bridge.set({ now: clock.now });
    const tick = () => {
      const t = clock.now();
      setNow(t);
      if (game.current && advance(game.current, t)) commit();
    };
    tick();
    const id = setInterval(tick, 1000);
    const onVisible = () => document.visibilityState === 'visible' && tick();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  // Audio: se activa con el primer toque; la música cambia de día a noche y se pausa en segundo plano.
  useEffect(() => {
    const unlock = () => audio.unlock();
    window.addEventListener('pointerdown', unlock);
    const onVis = () => audio.setPaused(document.visibilityState !== 'visible');
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.removeEventListener('pointerdown', unlock);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);
  useEffect(() => audio.setMood(lightAt(now).night > 0.5 ? 'noche' : 'dia'), [Math.floor(now / 60_000)]);

  // La escena refleja dónde está el personaje.
  useEffect(() => {
    if (playing) bridge.set({ role: state.character.role, look: state.character.look, spot: spotFor(state, now) });
    else bridge.set({ role: null, look: null, spot: 'home' });
  });

  // Avisos: sucesos nuevos y logros/bolsa.
  useEffect(() => {
    if (!state || !playing) return;
    for (const p of state.pending) {
      if (seenPending.current.has(p.instanceId)) continue;
      seenPending.current.add(p.instanceId);
      if (EVENTS[p.eventId].kind === 'accion') continue;
      setToast({ title: 'NOTIFICACIÓN', text: eventNotification(p.eventId) });
      if (!panel) setShowEvent(true);
    }
    if (!toast && state.notices.length) {
      const n = takeNotice(state)!;
      setToast({ title: n.title, text: n.text });
      if (n.kind === 'logro' || n.kind === 'final') audio.play.achievement();
      else audio.play.notify();
      commit();
    }
  });

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  // Notificaciones programadas: sucesos, fin de jornada y recordatorio diario.
  useEffect(() => {
    const s = game.current;
    if (!s || s.gameOver) return notify.scheduleAll([], clock.now(), clock.getSpeed());
    const role = ROLES[s.character.role];
    const list = [];
    if (s.shift && !s.shift.cancelled) {
      for (const sl of s.shift.slots)
        if (!sl.fired && sl.at < s.shift.endsAt) list.push({ id: `ev-${sl.at}`, at: sl.at, title: EVENTS[sl.eventId].title, body: EVENTS[sl.eventId].notification });
      list.push({ id: `end-${s.shift.endsAt}`, at: s.shift.endsAt, title: 'Jornada terminada', body: `${s.character.name} ya puede ${role.retire.toLowerCase()} y cobrar.` });
    }
    if (s.errand) list.push({ id: `errand-${s.errand.endsAt}`, at: s.errand.endsAt, title: 'Reparto terminado', body: `${s.character.name} volvió del reparto con el dinero.` });
    const tomorrow = startOfDay(addDays(s.today.date, 1)) + REMINDER_HOUR * 3_600_000;
    list.push({ id: `rem-${tomorrow}`, at: tomorrow, title: `🔥 Racha de ${s.streak} días`, body: `No olvides ir ${role.toWorkplace} hoy o perderás la racha.` });
    notify.scheduleAll(list, clock.now(), clock.getSpeed());
  }, [state?.shift?.startedAt, state?.shift?.endsAt, state?.errand?.endsAt, state?.shift?.cancelled, state?.gameOver, state?.today.date, state?.streak, clock.getSpeed()]);

  const begin = (c: Character) => {
    deleteGame();
    seenPending.current.clear();
    game.current = newGame(c, clock.now());
    setEndingSeen(false);
    commit();
    setScreen({ id: 'play' });
  };

  const quit = () => {
    deleteGame();
    game.current = null;
    notify.clearAll();
    setPanel(null);
    setOutcome(null);
    setShowEvent(false);
    setScreen({ id: 'role' });
    setVersion((v) => v + 1);
  };

  const act = (fn: (s: GameState, t: number) => void) => {
    const s = game.current;
    if (!s) return;
    try {
      fn(s, clock.now());
    } catch (e) {
      setToast({ title: 'AVISO', text: (e as Error).message });
    }
    commit();
  };

  if (!playing) {
    switch (screen.id) {
      case 'role':
        return <RoleSelect onPick={(role) => setScreen({ id: 'identity', role })} onBack={() => setScreen({ id: 'title' })} />;
      case 'identity':
        return (
          <IdentityForm
            role={screen.role}
            onBack={() => setScreen({ id: 'role' })}
            onDone={(name, age) => setScreen({ id: 'look', role: screen.role, name, age })}
          />
        );
      case 'look':
        return (
          <Customizer
            role={screen.role}
            name={screen.name}
            age={screen.age}
            onBack={() => setScreen({ id: 'identity', role: screen.role })}
            onDone={begin}
          />
        );
      default:
        return <TitleScreen hasSave={!!state} onContinue={() => setScreen({ id: 'play' })} onNew={() => setScreen({ id: 'role' })} />;
    }
  }

  const pending = state.pending[0];
  const showNews = !state.gameOver && state.newsSeenDate !== state.today.date;
  const closePanel = () => setPanel(null);

  // Un solo panel a la vez, por orden de prioridad.
  let overlay = null;
  if (state.gameOver && !outcome) overlay = <GameOverModal state={state} onNew={quit} />;
  else if (outcome) overlay = <ResultCard state={state} outcome={outcome} onClose={() => setOutcome(null)} />;
  else if (minigame)
    overlay =
      state.character.role === 'inmigrante' ? (
        <Dishwasher onClose={() => setMinigame(false)} onFinish={(n) => { setMinigame(false); act((s, t) => applyMinigame(s, n, t)); }} />
      ) : (
        <Paperwork onClose={() => setMinigame(false)} onFinish={(n) => { setMinigame(false); act((s, t) => applyMinigame(s, n, t)); }} />
      );
  else if (state.ending && !endingSeen && !state.flags.endingShown)
    overlay = (
      <EndingModal
        state={state}
        onClose={() => {
          setEndingSeen(true);
          act((s) => {
            s.flags.endingShown = true;
          });
        }}
      />
    );
  else if (pending && showEvent)
    overlay = (
      <DecisionCard
        key={pending.instanceId}
        state={state}
        pending={pending}
        onDecide={(choiceId) =>
          act((s, t) => {
            setOutcome(resolveEvent(s, pending.instanceId, choiceId, t));
            if (s.pending.length === 0) setShowEvent(false);
          })
        }
      />
    );
  else if (panel === 'bolsa')
    overlay = <MarketTerminal state={state} now={now} onBet={(tk, dir, stake) => act((s, t) => placeBet(s, tk, dir, stake, t))} onClose={closePanel} />;
  else if (panel === 'agenda')
    overlay = (
      <AgendaModal
        state={state}
        now={now}
        onClose={closePanel}
        onPick={(id) =>
          act((s, t) => {
            startAction(s, id, t);
            setPanel(null);
            setShowEvent(true);
          })
        }
      />
    );
  else if (panel === 'mejora') overlay = <UpgradeModal state={state} onBuy={() => act(buyUpgrade)} onBuyCar={() => act(buyCar)} onClose={closePanel} />;
  else if (panel === 'logros') overlay = <AchievementsModal state={state} onClose={closePanel} />;
  else if (panel === 'diario') overlay = <LogModal state={state} onClose={closePanel} />;
  else if (panel === 'menu')
    overlay = (
      <MenuModal
        role={state.character.role}
        devEnabled={devEnabled}
        onToggleDev={() => {
          clock.setDevEnabled(!devEnabled);
          setDevEnabled(!devEnabled);
          notify.clearAll();
        }}
        onClose={closePanel}
        onQuit={quit}
      />
    );
  else if (showNews) overlay = <NewsModal state={state} onClose={() => act(markNewsSeen)} />;

  return (
    <>
      <Hud state={state} now={now} />
      <Dock
        state={state}
        now={now}
        onStart={() => {
          if (canStartShift(state, clock.now())) return;
          notify.requestPermission();
          act(startShift);
        }}
        onRetire={() => act(retire)}
        onOpenEvent={() => {
          setPanel(null);
          setShowEvent(true);
        }}
        onPanel={setPanel}
        onMinigame={() => {
          audio.play.click();
          setPanel(null);
          setMinigame(true);
        }}
        onErrand={() => act(startErrand)}
      />
      {overlay}
      {toast && <Toast title={toast.title} text={toast.text} />}
      {devEnabled && (
        <DevPanel
          role={state.character.role}
          onForceEvent={(id) => act((s, t) => forceEvent(s, id, t))}
          onChanged={() => {
            notify.clearAll();
            const t = clock.now();
            setNow(t);
            if (game.current) advance(game.current, t);
            commit();
          }}
          onWipe={quit}
        />
      )}
    </>
  );
}
