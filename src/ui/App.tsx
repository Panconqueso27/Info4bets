import { useEffect, useRef, useState } from 'preact/hooks';
import {
  advance,
  applyMinigame,
  changeLook,
  buyCar,
  buyUpgrade,
  buildBusiness,
  buildCivic,
  buildHousePhase,
  buyLot,
  buyVending,
  dayNumber,
  renovateBlock,
  repairVending,
  startMega,
  takeRadioJob,
  upgradeCivic,
  upgradeLot,
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
  todayWeather,
  type ResolvedOutcome,
} from '../core/game';
import { EVENTS } from '../core/events/catalog';
import { ROLES } from '../core/roles';
import { addDays, startOfDay } from '../core/time';
import type { Character, GameState, Role } from '../core/types';
import * as clock from '../platform/clock';
import * as notify from '../platform/notify';
import { activeSlot, deleteGame, deleteSlot, firstFreeSlot, listSlots, loadGame, saveGame, setActiveSlot } from '../platform/save';
import { getSettings } from '../platform/settings';
import { App as NativeApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { CreditsModal, PrivacyModal, SavesScreen, SettingsModal } from './System';
import { bridge, type Spot } from '../scene/bridge';
import { PLACE_BY_ID, ROLE_PLACES } from '../art/cityMap';
import { DevPanel, devWeather } from './DevPanel';
import type { Weather } from '../core/weather';
import { MarketTerminal } from './Market';
import { AchievementsModal, AgendaModal, EndingModal, NewsModal, UpgradeModal } from './Panels';
import { GameOverModal, Hud, LogModal, MenuModal, Toast, eventNotification, type Panel } from './Play';
import { Phone } from './Phone';
import { DecisionCard, ResultCard } from './Cards';
import { markTutorial, PeopleModal, RewardModal, StatsModal, TUTORIAL, TutorialBubble, tutorialSeen, WardrobeModal } from './Extras';
import { globalCosmetics, keepCosmetics, otherFor, rememberCharacter } from '../platform/legacy';
import { Dishwasher } from './Dishwasher';
import { Paperwork } from './Paperwork';
import { Burgers, Coffee, Mop, Orders } from './games/Diner';
import { Budget, Handshake, Press, Traffic } from './games/Office';
import { MiniGameMenu } from './games/Menu';
import { saveRecord, type MiniProps } from './games/kit';

const MINIGAMES: Record<string, (p: MiniProps) => any> = {
  dishes: Dishwasher,
  paperwork: Paperwork,
  burgers: Burgers,
  orders: Orders,
  coffee: Coffee,
  mop: Mop,
  traffic: Traffic,
  press: Press,
  budget: Budget,
  handshake: Handshake,
  hotdogs: Hotdogs,
};
import * as audio from '../platform/audio';
import { lightAt } from '../art/daynight';
import { Customizer, IdentityForm, RoleSelect, TitleScreen } from './Setup';
import { BlockModal, LotCard, MegaCard, PropertiesModal, type CityActions } from './City';
import { Modal } from './Panels';
import { cityLook, citySignature, LOT_BY_ID, MEGA_BY_ID } from '../core/lots';
import { applyHotdogs, auctionLot, betBaseball, betRace, buyBond, buyRastro, buyTicket, racesOpen, rastroOpen, startClasses, startTaxi } from '../core/economy';
import { BackupModal, BaseballModal, BondsModal, ContestResultModal, ContestsModal, ExtrasModal, LotteryModal, RaceModal, RastroModal, type ExtraPanel, type ExtrasActions } from './Extras7';
import { Hotdogs } from './games/Street';
import { RADIO_PLACE } from '../core/radio';
import { Breakdance, Eating, Marathon, SimonGame, type ContestInfo } from './games/Contests';
import { CONTEST_BY_ID, contestPrizes, contestRivals, enterContest, finishContest, withdrawContest, contestFee, type ContestResult } from '../core/contests';

const CONTEST_GAMES: Record<string, (p: MiniProps & { contest: ContestInfo }) => any> = { breakdance: Breakdance, perritos: Eating, simon: SimonGame, maraton: Marathon };
import { Minimap } from './Minimap';
import type { Marker } from '../scene/bridge';

type Screen =
  | { id: 'title' }
  | { id: 'role' }
  | { id: 'identity'; role: Role }
  | { id: 'look'; role: Role; name: string; age: number }
  | { id: 'saves' }
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
  /** 'menu' = elegir minijuego; si no, el id del que se está jugando. */
  const [minigame, setMinigame] = useState<string | null>(null);
  const [reward, setReward] = useState<{ title: string; text: string } | null>(null);
  const [tutTick, setTutTick] = useState(0);
  const [target, setTarget] = useState<string | null>(null);
  const [extra, setExtra] = useState<ExtraPanel | null>(null);
  const [contestResult, setContestResult] = useState<{ id: string; result: ContestResult } | null>(null);
  /** Ajustes, privacidad y créditos desde la portada. */
  const [sysModal, setSysModal] = useState<'ajustes' | 'privacidad' | 'creditos' | null>(null);
  const moneyRef = useRef<number | null>(null);
  const cheer = useRef(0);
  const cityRef = useRef({ sig: '\u0000', look: cityLook(null) });
  const seenPending = useRef(new Set<string>());

  const state = game.current;
  const playing = screen.id === 'play' && state;

  // Botón Atrás de Android (y Escape en el ordenador): cierra lo que haya abierto,
  // vuelve a la portada y, desde la portada, sale de la app.
  const backRef = useRef<() => void>(() => {});
  backRef.current = () => {
    const ev = new CustomEvent('lc-back', { cancelable: true });
    if (!window.dispatchEvent(ev)) return;
    if (sysModal) return setSysModal(sysModal === 'ajustes' ? null : 'ajustes');
    if (screen.id === 'role' || screen.id === 'saves') return setScreen({ id: 'title' });
    if (screen.id === 'identity') return setScreen({ id: 'role' });
    if (screen.id === 'look') return setScreen({ id: 'identity', role: screen.role });
    if (screen.id === 'title') {
      if (Capacitor.isNativePlatform()) NativeApp.exitApp();
      return;
    }
    if (minigame === 'menu') return setMinigame(null);
    if (minigame) return setToast({ title: 'MINIJUEGO', text: 'Termínalo o usa su botón para salir.' });
    if (reward) return setReward(null);
    if (outcome) return setOutcome(null);
    if (contestResult) return setContestResult(null);
    if (extra) return setExtra(null);
    if (target) return setTarget(null);
    if (panel === 'privacidad' || panel === 'creditos') return setPanel('ajustes');
    if (panel === 'ajustes') return setPanel('menu');
    if (panel) return setPanel(null);
    if (showEvent) return setShowEvent(false);
    toTitle();
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && backRef.current();
    window.addEventListener('keydown', onKey);
    let off: (() => void) | null = null;
    if (Capacitor.isNativePlatform())
      NativeApp.addListener('backButton', () => backRef.current())
        .then((h) => (off = () => h.remove()))
        .catch(() => {});
    return () => {
      window.removeEventListener('keydown', onKey);
      off?.();
    };
  }, []);

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
    const onVisible = () => {
      if (document.visibilityState === 'visible') tick();
      // Al salir de la app (o bloquear el móvil) se guarda en el momento.
      else if (game.current) saveGame(game.current);
    };
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

  // Sonido ambiente: clima, hora, lugar y lo que está pasando.
  useEffect(() => {
    const s = game.current;
    const d = new Date(now);
    const spot = s && screen.id === 'play' ? spotFor(s, now) : 'home';
    const place: audio.AmbPlace =
      spot === 'work' ? (s!.character.role === 'inmigrante' ? 'diner' : 'alcaldia') : spot === 'errand' ? 'reparto' : spot === 'away' ? 'fuera' : 'casa';
    const md = `${d.getMonth() + 1}-${d.getDate()}`;
    audio.setAmbience({
      weather: s && screen.id === 'play' ? (((devEnabled && devWeather()) || todayWeather(s)) as Weather) : 'despejado',
      hour: d.getHours() + d.getMinutes() / 60,
      place,
      works: !!s && (Object.values(s.lots ?? {}).some((l) => l.buildingUntil) || Object.keys(s.renovating ?? {}).length > 0),
      pet: s?.pet?.kind ?? null,
      crowd: !!s && s.character.role === 'alcalde' && Number(s.flags.turistasAyer ?? 0) > 900,
      fiesta: md === '12-24' || md === '12-25' ? 'navidad' : md === '7-4' ? 'julio' : null,
    });
  });

  // Tocar un lugar del mapa: la Bolsa abre la terminal, tu trabajo te lleva a trabajar.
  useEffect(() => {
    bridge.onTap((id) => {
      const s = game.current;
      if (!s || screen.id !== 'play') return;
      audio.play.click();
      const mine = ROLE_PLACES[s.character.role];
      if (id.startsWith('lot:') || id.startsWith('mega:')) {
        setPanel(null);
        return setTarget(id);
      }
      if (id === 'mercado') return rastroOpen(s) ? setExtra('rastro') : setToast({ title: 'RASTRO DE BROOKLYN', text: 'Puestos cerrados. El rastro abre los domingos.' });
      if (id === 'hipodromo') return racesOpen(s) ? setExtra('carreras') : setToast({ title: 'HIPÓDROMO', text: 'Hoy no hay carreras. Vuelve el fin de semana.' });
      if (id.startsWith('block:')) {
        if (s.character.role !== 'alcalde') return setToast({ title: 'MANZANA', text: 'Edificios de vecinos. Solo el alcalde puede renovarlos.' });
        setPanel(null);
        return setTarget(id);
      }
      if (id === 'bolsa') return setPanel('bolsa');
      if (id === mine.work && !canStartShift(s, clock.now())) {
        notify.requestPermission();
        return act(startShift);
      }
      const label = PLACE_BY_ID[id as keyof typeof PLACE_BY_ID].label;
      const flavor: Record<string, string> = {
        casa: 'Tu cuarto, tu ropa tendida y el depósito de agua que gotea.',
        residencia: 'La residencia oficial. Jardín, reja y silencio.',
        diner: s.character.role === 'inmigrante' ? 'Tu trabajo. Huele a café y a plancha.' : 'Un diner de los de siempre.',
        alcaldia: s.character.role === 'alcalde' ? 'Tu despacho te espera.' : 'La alcaldía. Allí se decide todo.',
        parque: 'El pulmón de la ciudad.',
        plaza: 'Neones, taxis y ruido las 24 horas.',
        hotel: 'Hotel con letrero rosa. Nadie pregunta.',
        pizza: 'Porción a 75 centavos.',
        bar: 'Cerveza fría y béisbol en la tele.',
        fabrica: 'La vieja fábrica de azúcar. Huele a caramelo hasta en el puente.',
        coney: 'La noria, la montaña rusa y perritos de Nathan’s.',
      };
      setToast({ title: label.toUpperCase(), text: flavor[id] ?? '' });
    });
    return () => bridge.onTap(null);
  });

  // Al terminar (o alcanzar el final), el protagonista queda en la ciudad para futuras partidas.
  useEffect(() => {
    const s = game.current;
    if (!s || s.flags.legacySaved || !(s.gameOver || s.ending)) return;
    rememberCharacter(s, s.gameOver?.day ?? s.ending?.day ?? 1);
    s.flags.legacySaved = true;
    commit();
  });

  // La escena refleja dónde está el personaje.
  useEffect(() => {
    let markers: Marker[] = [];
    if (playing) {
      const day = dayNumber(state, now);
      const sig = citySignature(state, day);
      if (sig !== cityRef.current.sig) cityRef.current = { sig, look: cityLook(state, day) };
      // iconos sobre el mapa
      const mk: Marker[] = [];
      for (const [id, l] of Object.entries(state.lots ?? {})) {
        if (l.buildingUntil) mk.push({ kind: 'lot', id, icon: 'cono' });
        else if (l.owner === 'jugador') mk.push({ kind: 'lot', id, icon: 'moneda' });
      }
      for (const [id, p] of Object.entries(state.projects ?? {})) if (!p.done) mk.push({ kind: 'mega', id, icon: 'cono' });
      if (state.character.role === 'inmigrante' && rastroOpen(state)) mk.push({ kind: 'place', id: 'mercado', icon: 'cartel' });
      if (racesOpen(state)) mk.push({ kind: 'place', id: 'hipodromo', icon: 'caballo' });
      const key = JSON.stringify(mk);
      markers = key === JSON.stringify(bridge.get().markers) ? bridge.get().markers : mk;
      // el personaje salta de alegría al ganar dinero
      const money = state.bars.dinero ?? 0;
      if (moneyRef.current !== null && money > moneyRef.current) cheer.current++;
      moneyRef.current = money;
    }
    // Cada trabajo extra tiene su sitio: el personaje va allí y entra.
    const e = playing ? state.errand : null;
    const dest = !e ? null : e.kind === 'radio' ? RADIO_PLACE[e.job ?? ''] ?? null : e.kind === 'clases' ? `place:${ROLE_PLACES[state!.character.role].home}` : null;
    if (playing)
      bridge.set({
        dest,
        markers,
        cheer: cheer.current,
        city: cityRef.current.look,
        citySig: cityRef.current.sig,
        pet: state.pet?.kind ?? null,
        vending: state.vending?.count ?? 0,
        role: state.character.role,
        look: state.character.look,
        spot: spotFor(state, now),
        vehicle: state.flags.auto ? 'auto' : 'pie',
        other: state.other ?? null,
        weather: ((devEnabled && devWeather()) || todayWeather(state)) as Weather,
      });
    else bridge.set({ role: null, look: null, spot: 'home', weather: 'despejado', other: null, pet: null, vending: 0, markers: [] });
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
      if (n.kind === 'racha') {
        setReward({ title: n.title, text: n.text });
        audio.play.achievement();
        vibrate([60, 40, 120]);
      } else if (n.kind === 'logro' || n.kind === 'final') audio.play.achievement();
      else audio.play.notify();
      if (n.kind === 'armario') keepCosmetics(state.cosmetics ?? []);
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
    if (!s || s.gameOver || !getSettings().notifications) return notify.scheduleAll([], clock.now(), clock.getSpeed());
    const role = ROLES[s.character.role];
    const list = [];
    if (s.shift && !s.shift.cancelled) {
      for (const sl of s.shift.slots)
        if (!sl.fired && sl.at < s.shift.endsAt) list.push({ id: `ev-${sl.at}`, at: sl.at, title: EVENTS[sl.eventId].title, body: EVENTS[sl.eventId].notification });
      list.push({ id: `end-${s.shift.endsAt}`, at: s.shift.endsAt, title: 'Jornada terminada', body: `${s.character.name} ya puede ${role.retire.toLowerCase()} y cobrar.` });
    }
    if (s.errand)
      list.push({
        id: `errand-${s.errand.endsAt}`,
        at: s.errand.endsAt,
        title: s.errand.kind && s.errand.kind !== 'reparto' ? 'Trabajo terminado' : 'Reparto terminado',
        body: s.errand.kind && s.errand.kind !== 'reparto' ? `${s.character.name} terminó: ${s.errand.label}. ¡A cobrar!` : `${s.character.name} volvió del reparto con el dinero.`,
      });
    for (const l of Object.values(s.lots ?? {}))
      if (l.buildingUntil) list.push({ id: `obra-${l.buildingUntil}`, at: l.buildingUntil, title: '🏗 Obras terminadas', body: 'Ve a ver cómo ha quedado.' });
    for (const p of Object.values(s.projects ?? {}))
      if (!p.done) list.push({ id: `mega-${p.until}`, at: p.until, title: '🎉 Gran inauguración', body: 'Tu gran proyecto está listo. ¡La ciudad lo celebra!' });
    for (const b of s.bonds ?? []) list.push({ id: `bono-${b.until}`, at: b.until, title: '📜 Bonos vencidos', body: 'Tus bonos municipales devuelven el dinero con intereses.' });
    const tomorrow = startOfDay(addDays(s.today.date, 1)) + REMINDER_HOUR * 3_600_000;
    list.push({ id: `rem-${tomorrow}`, at: tomorrow, title: `🔥 Racha de ${s.streak} días`, body: `No olvides ir ${role.toWorkplace} hoy o perderás la racha.` });
    notify.scheduleAll(list, clock.now(), clock.getSpeed());
  }, [state?.shift?.startedAt, state?.shift?.endsAt, state?.errand?.endsAt, state?.shift?.cancelled, state?.gameOver, state?.today.date, state?.streak, clock.getSpeed(), citySignature(state) + JSON.stringify(state?.bonds ?? []), getSettings().notifications]);

  const begin = (c: Character) => {
    deleteGame();
    seenPending.current.clear();
    game.current = newGame(c, clock.now(), undefined, otherFor(c.role), globalCosmetics());
    setEndingSeen(false);
    commit();
    setScreen({ id: 'play' });
  };

  /** Cambia de partida: limpia lo de la anterior y carga la de la ranura. */
  const resetSession = () => {
    notify.clearAll();
    seenPending.current.clear();
    setPanel(null);
    setOutcome(null);
    setShowEvent(false);
    setMinigame(null);
    setExtra(null);
    setTarget(null);
    setReward(null);
    setEndingSeen(false);
  };
  const openSlot = (slot: number) => {
    if (game.current && screen.id === 'play') saveGame(game.current);
    setActiveSlot(slot);
    resetSession();
    game.current = loadGame();
    setScreen({ id: game.current ? 'play' : 'role' });
    setVersion((v) => v + 1);
  };
  const newInSlot = (slot: number) => {
    setActiveSlot(slot);
    resetSession();
    game.current = null;
    setScreen({ id: 'role' });
  };
  /** Continuar: la última partida que se jugó. */
  const continueLast = () => {
    const last = listSlots()
      .filter((x) => x.state)
      .sort((a, b) => (b.savedAt ?? 0) - (a.savedAt ?? 0))[0];
    if (last) openSlot(last.slot);
  };
  const toTitle = () => {
    if (game.current) saveGame(game.current);
    resetSession();
    setScreen({ id: 'title' });
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
      case 'saves':
        return (
          <SavesScreen
            active={activeSlot()}
            now={now}
            onPlay={openSlot}
            onNew={newInSlot}
            onDelete={(slot) => {
              deleteSlot(slot);
              if (slot === activeSlot()) game.current = null;
              setVersion((v) => v + 1);
            }}
            onBack={() => setScreen({ id: 'title' })}
          />
        );
      default:
        return (
          <>
            <TitleScreen
              hasSave={listSlots().some((x) => x.state)}
              onContinue={continueLast}
              onNew={() => {
                const free = firstFreeSlot();
                if (free) newInSlot(free);
                else setScreen({ id: 'saves' });
              }}
              onSaves={() => setScreen({ id: 'saves' })}
              onSettings={() => setSysModal('ajustes')}
            />
            {sysModal === 'ajustes' && <SettingsModal onClose={() => setSysModal(null)} onOpen={setSysModal} />}
            {sysModal === 'privacidad' && <PrivacyModal onClose={() => setSysModal('ajustes')} />}
            {sysModal === 'creditos' && <CreditsModal onClose={() => setSysModal('ajustes')} />}
          </>
        );
    }
  }

  const pending = state.pending[0];
  const showNews = !state.gameOver && state.newsSeenDate !== state.today.date;
  const closePanel = () => setPanel(null);
  const cityActions: CityActions = {
    onBuyLot: (id) => act((s, t) => buyLot(s, id, t)),
    onBuildPhase: (lotId) => act((s, t) => buildHousePhase(s, t, lotId)),
    onBuildBiz: (lotId, biz) => act((s, t) => buildBusiness(s, lotId, biz, t)),
    onUpgradeLot: (lotId) => act((s, t) => upgradeLot(s, lotId, t)),
    onBuildCivic: (id, civic) => act((s, t) => buildCivic(s, id, civic, t)),
    onUpgradeCivic: (lotId) => act((s, t) => upgradeCivic(s, lotId, t)),
    onAuction: (lotId) => act((s, t) => auctionLot(s, lotId, t)),
    onStartMega: (id) => act((s, t) => startMega(s, id, t)),
  };
  /** Ejecuta una acción y devuelve su resultado (o nada si falló, con aviso). */
  const ask = <T,>(fn: (s: GameState, t: number) => T): T | void => {
    const s = game.current;
    if (!s) return;
    try {
      const r = fn(s, clock.now());
      commit();
      return r;
    } catch (e) {
      setToast({ title: 'AVISO', text: (e as Error).message });
    }
  };

  // Acciones de Extras: las usan el panel de Extras y la agenda de contactos del móvil.
  const extrasActions: ExtrasActions = {
    onRadio: (id) => {
          act((s, t) => takeRadioJob(s, id, t));
          setPanel(null);
    },
    onErrand: () => {
          act(startErrand);
          setPanel(null);
    },
    onTaxi: () => {
          act(startTaxi);
          setPanel(null);
    },
    onClasses: () => {
          act(startClasses);
          setPanel(null);
    },
    onHotdogs: () => {
          setPanel(null);
          setMinigame('hotdogs');
    },
    onOpen: (p) => {
          setPanel(null);
          setExtra(p);
    },
    onAction: (id) =>
          act((s, t) => {
            startAction(s, id, t);
            setPanel(null);
            setShowEvent(true);
          }),
    onAuction: () => {
          const free = Object.keys(LOT_BY_ID).find((id) => !state.lots?.[id]);
          setPanel(free ? 'propiedades' : null);
          if (!free) setToast({ title: 'SUBASTA', text: 'No quedan solares libres.' });
          else setToast({ title: 'SUBASTA', text: 'Elige un solar libre en la pestaña Obras y pulsa "Subastarlo".' });
    },
  };
  // Un solo panel a la vez, por orden de prioridad.
  let overlay = null;
  if (state.gameOver && !outcome) overlay = <GameOverModal state={state} onNew={quit} />;
  else if (outcome) overlay = <ResultCard state={state} outcome={outcome} onClose={() => setOutcome(null)} />;
  else if (reward) overlay = <RewardModal title={reward.title} text={reward.text} onClose={() => setReward(null)} />;
  else if (minigame === 'menu')
    overlay = <MiniGameMenu role={state.character.role} onPick={(id) => { audio.play.click(); setMinigame(id); }} onClose={() => setMinigame(null)} />;
  else if (contestResult) overlay = <ContestResultModal state={state} id={contestResult.id} result={contestResult.result} onClose={() => setContestResult(null)} />;
  else if (minigame?.startsWith('contest:')) {
    const id = minigame.slice(8);
    const c = CONTEST_BY_ID[id];
    const Game = CONTEST_GAMES[id];
    const fmt = ROLES[state.character.role].formatMoney;
    overlay = (
      <Game
        contest={{ target: contestRivals(state, id)[0].score, fee: fmt(contestFee(state, c)), prize: fmt(contestPrizes(state, c)[0]) }}
        onClose={() => {
          setMinigame(null);
          act((s) => withdrawContest(s, id));
        }}
        onFinish={(score) => {
          setMinigame(null);
          const r = ask((s, t) => finishContest(s, id, score, t));
          if (r) setContestResult({ id, result: r });
        }}
      />
    );
  } else if (minigame) {
    const Game = MINIGAMES[minigame];
    const id = minigame;
    overlay = (
      <Game
        onClose={() => setMinigame(null)}
        onFinish={(n) => {
          setMinigame(null);
          if (id === 'dishes' || id === 'paperwork') saveRecord(id, n);
          if (id === 'hotdogs') act((s, t) => applyHotdogs(s, n, t));
          else act((s, t) => applyMinigame(s, n, t, id));
        }}
      />
    );
  }
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
  else if (target?.startsWith('lot:'))
    overlay = (
      <Modal title={LOT_BY_ID[target.slice(4)].label} kicker="SOLAR" onClose={() => setTarget(null)}>
        <LotCard state={state} lotId={target.slice(4)} now={now} {...cityActions} />
      </Modal>
    );
  else if (target?.startsWith('mega:'))
    overlay = (
      <Modal title={MEGA_BY_ID[target.slice(5)].label} kicker="GRAN PROYECTO" onClose={() => setTarget(null)}>
        <MegaCard state={state} id={target.slice(5)} now={now} onStart={cityActions.onStartMega} />
      </Modal>
    );
  else if (extra === 'rastro') overlay = <RastroModal state={state} now={now} onBuy={(id) => ask((s, t) => buyRastro(s, id, t))} onClose={() => setExtra(null)} />;
  else if (extra === 'carreras') overlay = <RaceModal state={state} now={now} onBet={(h, st) => ask((s, t) => betRace(s, h, st, t))} onClose={() => setExtra(null)} />;
  else if (extra === 'beisbol') overlay = <BaseballModal state={state} now={now} onBet={(team, st) => ask((s, t) => betBaseball(s, team, st, t))} onClose={() => setExtra(null)} />;
  else if (extra === 'loteria') overlay = <LotteryModal state={state} onBuy={(n) => act((s, t) => buyTicket(s, n, t))} onClose={() => setExtra(null)} />;
  else if (extra === 'concursos')
    overlay = (
      <ContestsModal
        state={state}
        now={now}
        onEnter={(id) => {
          if (ask((s, t) => (enterContest(s, id, t), true))) {
            setExtra(null);
            setMinigame(`contest:${id}`);
          }
        }}
        onClose={() => setExtra(null)}
      />
    );
  else if (extra === 'bonos') overlay = <BondsModal state={state} now={now} onBuy={(amount, days) => act((s, t) => buyBond(s, amount, days, t))} onClose={() => setExtra(null)} />;
  else if (target?.startsWith('block:'))
    overlay = <BlockModal state={state} blockKey={target.slice(6)} now={now} onRenovate={() => act((s, t) => renovateBlock(s, target.slice(6), t))} onClose={() => setTarget(null)} />;
  else if (panel === 'copia') overlay = <BackupModal onClose={closePanel} />;
  else if (panel === 'propiedades')
    overlay = <PropertiesModal state={state} now={now} {...cityActions} onBuyVending={() => act(buyVending)} onRepairVending={() => act(repairVending)} onClose={closePanel} />;
  else if (panel === 'extras')
    overlay = (
      <ExtrasModal state={state} now={now} onClose={closePanel} {...extrasActions}       />
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
  else if (panel === 'personas') overlay = <PeopleModal state={state} onClose={closePanel} />;
  else if (panel === 'stats') overlay = <StatsModal state={state} now={now} onClose={closePanel} />;
  else if (panel === 'armario')
    overlay = (
      <WardrobeModal
        state={state}
        onClose={closePanel}
        onSave={(look) => {
          act((s) => changeLook(s, look));
          setPanel(null);
        }}
      />
    );
  else if (panel === 'ajustes') overlay = <SettingsModal onClose={() => setPanel('menu')} onOpen={setPanel} />;
  else if (panel === 'privacidad') overlay = <PrivacyModal onClose={() => setPanel('ajustes')} />;
  else if (panel === 'creditos') overlay = <CreditsModal onClose={() => setPanel('ajustes')} />;
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
        onTitle={toTitle}
        onOpen={setPanel}
        onTutorial={() => {
          resetTutorial();
          setPanel(null);
          setTutTick((t) => t + 1);
        }}
      />
    );
  else if (showNews) overlay = <NewsModal state={state} onClose={() => act(markNewsSeen)} />;

  // Tutorial: un globo cada vez, según lo que esté pasando en pantalla.
  void tutTick;
  const seen = tutorialSeen();
  const cardVisible = !!(pending && showEvent && !outcome && !minigame && !reward);
  const tutStep =
    state.gameOver || outcome || reward || minigame || (panel && !cardVisible)
      ? null
      : TUTORIAL.find((t) => {
          if (seen.includes(t.id)) return false;
          if (t.id === 'tarjeta') return cardVisible;
          if (cardVisible || showNews) return false;
          if (t.id === 'minijuego') return !!state.shift && !state.shift.cancelled && clock.now() < state.shift.endsAt;
          return true;
        }) ?? null;

  return (
    <>
      <Hud state={state} now={now} />
      {!overlay && !minigame && <Minimap state={state} />}
      <Phone
        extras={extrasActions}
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
          setMinigame('menu');
        }}
        onErrand={() => act(startErrand)}
      />
      {overlay}
      {tutStep && (
        <TutorialBubble
          step={tutStep}
          onNext={() => {
            markTutorial(tutStep.id);
            setTutTick((t) => t + 1);
          }}
          onSkip={() => {
            markTutorial('todo');
            setTutTick((t) => t + 1);
          }}
        />
      )}
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

function vibrate(pattern: number | number[]) {
  if (!getSettings().vibrate) return;
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* sin vibración */
  }
}

function resetTutorial() {
  try {
    localStorage.removeItem('laciudad.tutorial');
  } catch {
    /* sin almacenamiento */
  }
}
