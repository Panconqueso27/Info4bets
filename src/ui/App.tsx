import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { advance, canStartShift, forceEvent, newGame, resolveEvent, retire, startShift, type ResolvedOutcome } from '../core/game';
import { EVENTS } from '../core/events/catalog';
import { ROLES } from '../core/roles';
import type { Character, GameState, Role } from '../core/types';
import * as clock from '../platform/clock';
import * as notify from '../platform/notify';
import { deleteGame, loadGame, saveGame } from '../platform/save';
import { bridge, type Spot } from '../scene/bridge';
import { DevPanel } from './DevPanel';
import { Dock, EventModal, GameOverModal, Hud, LogModal, MenuModal, OutcomeModal, Toast, eventNotification } from './Play';
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
  if (s.shift && !s.shift.cancelled) return 'work';
  return 'home';
}

export function App() {
  const game = useRef<GameState | null>(loadGame());
  const [screen, setScreen] = useState<Screen>({ id: 'title' });
  const [now, setNow] = useState(clock.now());
  const [, setVersion] = useState(0);
  const [outcome, setOutcome] = useState<ResolvedOutcome | null>(null);
  const [showEvent, setShowEvent] = useState(false);
  const [modal, setModal] = useState<'log' | 'menu' | null>(null);
  const [toast, setToast] = useState<{ title: string; text: string } | null>(null);
  const devEnabled = useMemo(() => clock.isDevEnabled(), []);
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

  // La escena refleja dónde está el personaje.
  useEffect(() => {
    if (playing) bridge.set({ role: state.character.role, look: state.character.look, spot: spotFor(state, now) });
    else bridge.set({ role: null, look: null, spot: 'home' });
  });

  // Aviso en pantalla cuando aparece un suceso nuevo.
  useEffect(() => {
    if (!state || !playing) return;
    for (const p of state.pending) {
      if (seenPending.current.has(p.instanceId)) continue;
      seenPending.current.add(p.instanceId);
      setToast({ title: 'NOTIFICACION', text: eventNotification(p.eventId) });
      setShowEvent(true);
    }
  });

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(t);
  }, [toast]);

  // Notificaciones programadas de la jornada (sucesos y fin de las 8 horas).
  useEffect(() => {
    const s = game.current;
    if (!s?.shift || s.gameOver || s.shift.cancelled) return notify.scheduleAll([], clock.now(), clock.getSpeed());
    const role = ROLES[s.character.role];
    notify.scheduleAll(
      [
        ...s.shift.slots
          .filter((sl) => !sl.fired)
          .map((sl) => ({ id: `ev-${sl.at}`, at: sl.at, title: EVENTS[sl.eventId].title, body: EVENTS[sl.eventId].notification })),
        { id: `end-${s.shift.endsAt}`, at: s.shift.endsAt, title: 'Jornada terminada', body: `${s.character.name} ya puede ${role.retire.toLowerCase()}.` },
      ],
      clock.now(),
      clock.getSpeed(),
    );
  }, [state?.shift?.startedAt, state?.shift?.cancelled, state?.gameOver, clock.getSpeed()]);

  const begin = (c: Character) => {
    deleteGame();
    seenPending.current.clear();
    game.current = newGame(c, clock.now());
    commit();
    setScreen({ id: 'play' });
  };

  const quit = () => {
    deleteGame();
    game.current = null;
    notify.clearAll();
    setModal(null);
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
      case 'title':
        return (
          <TitleScreen
            hasSave={!!state}
            onContinue={() => setScreen({ id: 'play' })}
            onNew={() => setScreen({ id: 'role' })}
          />
        );
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
        return <TitleScreen hasSave={false} onContinue={() => {}} onNew={() => setScreen({ id: 'role' })} />;
    }
  }

  const pending = state.pending[0];
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
        onOpenEvent={() => setShowEvent(true)}
        onLog={() => setModal('log')}
        onMenu={() => setModal('menu')}
      />
      {toast && <Toast title={toast.title} text={toast.text} />}
      {outcome ? (
        <OutcomeModal state={state} outcome={outcome} onClose={() => setOutcome(null)} />
      ) : pending && showEvent ? (
        <EventModal
          state={state}
          pending={pending}
          onChoose={(choiceId) =>
            act((s, t) => {
              setOutcome(resolveEvent(s, pending.instanceId, choiceId, t));
              if (s.pending.length === 0) setShowEvent(false);
            })
          }
        />
      ) : null}
      {modal === 'log' && <LogModal state={state} onClose={() => setModal(null)} />}
      {modal === 'menu' && <MenuModal onClose={() => setModal(null)} onQuit={quit} />}
      {state.gameOver && !outcome && <GameOverModal state={state} onNew={quit} />}
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
