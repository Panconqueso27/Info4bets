import Phaser from 'phaser';
import {
  aveX,
  AVES,
  BRIDGE_STREET,
  MANHATTAN_COLS,
  RIVER_X,
  streetSpan,
  aveDir,
  stDir,
  COLS,
  generateCityMap,
  BLOCK_H,
  BLOCK_W,
  blockX,
  blockY,
  lotRect,
  AVE_W,
  ST_H,
  MAP_H,
  MAP_W,
  PLACE_BY_ID,
  placeEntrance,
  placeRect,
  placeCenter,
  placeHeight,
  PLACES_MAP,
  ROLE_PLACES,
  route,
  ROWS,
  stY,
  walkX,
  walkY,
  setArtScale,
  iso,
  depthAt,
  prismHit,
  isoCarTexture,
  isoBoatTexture,
  isoPlaneTexture,
  ISO_W,
  ISO_H,
  PAD,
  type MapLayer,
  type Place,
  type PlaceId,
} from '../art/cityMap';
import { lightAt, type Light } from '../art/daynight';
import { CAR_COLORS, drawMini, MINI_H, MINI_W } from '../art/sprites';
import { mulberry32 } from '../core/rng';
import { LOTS } from '../core/lots';
import { districtOf } from '../core/city';
import type { Look } from '../core/types';
import { randomLook } from '../art/character';
import { bridge, type SceneModel, type Spot } from './bridge';
import { drawPet, drawVending, upscaleOutline } from '../art/sprites';
import { aircraftSound, crashSound, sirenSound, thunder } from '../platform/audio';
import { drawIcon } from '../art/icons';
import { MEGA } from '../core/lots';

/** Destino de un trabajo extra: un lugar del mapa o una manzana. */
function destPlace(dest: string): Place {
  if (dest.startsWith('place:')) return PLACE_BY_ID[dest.slice(6) as PlaceId];
  const [c, r] = dest.slice(6).split(',').map(Number);
  return { id: 'plaza', label: '', c, r };
}

/** Cambia la profundidad solo si varía: cada cambio obliga a reordenar la capa. */
function depthOf(o: Phaser.GameObjects.Components.Depth & { depth: number }, d: number) {
  const v = Math.round(d * 20) / 20;
  if (o.depth !== v) o.setDepth(v);
}

/** Punto del plano (con altura) en la pantalla. */
interface WP {
  x: number;
  y: number;
  z?: number;
}

/**
 * Resolución: 2 = alta (doble de detalle), 1 = ahorro (móviles lentos).
 * La vista isométrica abarca más ciudad: 300 unidades de ancho.
 */
let RES = 2;
const viewW = () => 300 * RES;
const WALK_SPEED = 20;
const minZoom = () => 0.42 * RES;
const maxZoom = () => 3 * RES;
/** Escala de las personas (sprites ×2 con contorno). */
const PEOPLE = 0.5;

function lookKey(look: Look): string {
  return `mini-${look.outfit}-${look.hair}-${look.skin}-${look.hairColor}-${look.outfitColor}`;
}

interface Car {
  img: Phaser.GameObjects.Image;
  light: Phaser.GameObjects.Image;
  /** 'v' avenidas (norte-sur), 'h' calles (este-oeste) */
  axis: 'v' | 'h';
  dir: 1 | -1;
  /** Carril: avenida o calle por la que circula. */
  lane: string;
  speed: number;
  len: number;
  /** Posición a lo largo del carril y coordenada fija del carril (en el plano). */
  pos: number;
  off: number;
  /** Tramo por el que circula (las calles no cruzan el río salvo la del puente). */
  min: number;
  max: number;
  /** Cruces de su recorrido (para los semáforos). */
  cross: number[];
  /** Parado por un accidente hasta este momento. */
  crashUntil?: number;
  /** Coche de policía que acude: se para aquí hasta leaveAt y luego se va. */
  stopAt?: number;
  leaveAt?: number;
  /** Coche temporal (la policía): desaparece al salir del mapa. */
  temp?: boolean;
  /** Luces que van con el coche (sirenas). */
  extras?: Phaser.GameObjects.Image[];
}

/** Avión o helicóptero: vuela a una altura z y proyecta su sombra en el suelo. */
interface Aircraft {
  kind: 'avion' | 'helicoptero';
  img: Phaser.GameObjects.Image | Phaser.GameObjects.Sprite;
  shadow: Phaser.GameObjects.Image;
  /** Foco del helicóptero de noche. */
  beam?: Phaser.GameObjects.Image;
  lights: Phaser.GameObjects.Image[];
  p: WP;
  /** Avanza un paso; devuelve false cuando ha terminado su vuelo. */
  step: (dt: number) => boolean;
  /** Dirección en pantalla (para girar el sprite y poner las luces). */
  hx: number;
  hy: number;
  soundAt: number;
}

/** Accidente en curso: los coches implicados, sus efectos y cuándo se despeja. */
interface Accident {
  cars: Car[];
  at: { x: number; y: number };
  until: number;
  fx: Phaser.GameObjects.GameObject[];
}

/** Los remolcadores no bajan hasta el puerto de cruceros. */
const BOAT_MAX = blockY(7);

/** Ciclo de semáforos: avenidas y calles se alternan. */
const SIGNAL_MS = 7000;

interface Walker {
  sprite: Phaser.GameObjects.Sprite;
  p: WP;
  c: number;
  r: number;
  /** Solo pasea por esta zona (gente de Times Square de noche). */
  zone?: [number, number, number, number];
  /** Solo sale de noche. */
  night?: boolean;
}

/** Cara del sprite según hacia dónde se mueve en pantalla. */
function facing(dx: number, dy: number) {
  return { back: dx + dy < -0.01, flip: dx - dy < -0.01 };
}

interface MapImg {
  imgs: Phaser.GameObjects.Image[];
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export class CityScene extends Phaser.Scene {
  private world!: Phaser.GameObjects.Layer;
  /** Imágenes del mapa por tipo: se tiñen o se encienden según la hora. */
  private bases: Phaser.GameObjects.Image[] = [];
  private lightImgs: Phaser.GameObjects.Image[] = [];
  private heights: Record<string, number> = {};
  private signalDots: Phaser.GameObjects.Image[] = [];
  private signalPhase = -1;
  private clouds: Phaser.GameObjects.Image[] = [];
  // Gotas y copos: un único Blitter (un solo lote de dibujo y solo los píxeles de cada gota).
  private precip!: Phaser.GameObjects.Blitter;
  private drops: { bob: Phaser.GameObjects.Bob; s: number }[] = [];
  private weatherShown = '';
  private mapSig = '\u0000';
  private mapImgs: Phaser.GameObjects.Image[] = [];
  /** Lienzos de cada capa del mapa, para hornear la nieve en la base. */
  private mapSets: { key: string; base: HTMLCanvasElement; snow: HTMLCanvasElement | null; wet?: HTMLCanvasElement; imgs: Phaser.GameObjects.Image[]; bands: { x: number; y: number; w: number; h: number }[]; scale: number }[] = [];
  private bakedMode = '';
  /** Trozos del mapa: solo se dibujan los que ve la cámara. */
  private chunks: MapImg[] = [];
  private cullKey = '';
  private umbrella!: Phaser.GameObjects.Image;
  private boats: { img: Phaser.GameObjects.Image; p: WP; dir: number; speed: number }[] = [];
  private pigeons: { img: Phaser.GameObjects.Image; p: WP }[] = [];
  private markerIcons: Phaser.GameObjects.Image[] = [];
  private markerKey = '';
  private cheerSeen = 0;
  private viewAt = 0;
  private pet: Phaser.GameObjects.Sprite | null = null;
  private petP: WP = { x: 0, y: 0 };
  private petKind = '';
  private petTrail: { x: number; y: number }[] = [];
  private machines: Phaser.GameObjects.Image[] = [];
  /** Medición de fluidez para bajar la calidad sola en móviles lentos. */
  private perf = { t: 0, frames: 0, slow: 0, warm: 0 };
  private low = lowFx();
  private flash!: Phaser.GameObjects.Rectangle;
  private uiCam!: Phaser.Cameras.Scene2D.Camera;
  private cars: Car[] = [];
  private walkers: Walker[] = [];
  private otherSprite: Phaser.GameObjects.Sprite | null = null;
  private otherP: WP = { x: 0, y: 0 };
  private otherLabel: Phaser.GameObjects.Text | null = null;
  private otherKey = '';
  private player: Phaser.GameObjects.Sprite | null = null;
  /** Posición del personaje en el plano (z: sube un poco al entrar por la puerta). */
  private pw: WP = { x: 0, y: 0, z: 0 };
  private ring!: Phaser.GameObjects.Ellipse;
  private marker!: Phaser.GameObjects.Text;
  private labels: Phaser.GameObjects.Text[] = [];
  private spot: Spot = 'home';
  /** Sitio del trabajo extra en curso (para salir de él al volver). */
  private errandDest: string | null = null;
  private walkTween: Phaser.Tweens.TweenChain | null = null;
  private stepTimer = 0;
  private stepFrame = 0;
  private facingBack = false;
  private light: Light = lightAt(Date.now());
  private lastLightAt = 0;
  private drift = 0;
  private userPannedAt = -99999;
  private nextLightning = 0;
  /** Zoom con el que se generó la lluvia (si cambia mucho, se rehace). */
  private weatherZoom = 0;
  private weatherSize = '';
  private ripples: Phaser.GameObjects.Bob[] = [];
  private accident: Accident | null = null;
  private nextAccident = 0;
  private aircraft: Aircraft[] = [];
  private nextPlane = 0;
  private nextHeli = 0;
  private drag: { x: number; y: number; sx: number; sy: number; moved: boolean } | null = null;
  private pinch: { d: number; zoom: number } | null = null;

  constructor() {
    super('city');
  }

  create() {
    this.makeCarTextures();
    this.makeHeadlight();
    this.makeFxTextures();

    // El mapa: el mar alrededor, el suelo y una capa por manzana, ordenadas por profundidad.
    this.world = this.add.layer();
    this.buildMap(bridge.get());

    this.spawnTraffic();
    // el primer accidente y los primeros vuelos, no nada más empezar
    this.nextAccident = 45_000 + Math.random() * 60_000;
    this.nextPlane = 12_000 + Math.random() * 20_000;
    this.nextHeli = 50_000 + Math.random() * 60_000;
    this.spawnPedestrians();
    this.spawnLife();

    this.ring = this.add.ellipse(0, 0, 12, 6).setDepth(0).setStrokeStyle(1, 0xffe066).setFillStyle(0xffe066, 0.18).setVisible(false);
    this.world.add(this.ring);
    this.tweens.add({ targets: this.ring, scaleX: 1.35, scaleY: 1.35, alpha: 0.4, duration: 700, yoyo: true, repeat: -1 });
    this.marker = this.add
      .text(0, 0, '▼', { fontFamily: 'LC Display, sans-serif', fontSize: '10px', color: '#ffe066', stroke: '#000', strokeThickness: 3, resolution: 3 })
      .setOrigin(0.5, 1)
      .setVisible(false);
    this.world.add(this.marker);
    this.makeLabels();

    // Nubes (sombras que pasan de día) y clima, en una cámara aparte sin zoom.
    for (let i = 0; i < 4; i++) {
      const c = this.add.image(0, 0, 'cloud').setDepth(200000).setVisible(false).setScale(2.2, 1.6);
      this.clouds.push(c);
      this.world.add(c);
    }
    this.precip = this.add.blitter(0, 0, 'fx-drops-2').setVisible(false).setDepth(10);
    this.flash = this.add.rectangle(0, 0, 10, 10, 0xffffff, 0).setOrigin(0).setVisible(false).setDepth(20);
    this.uiCam = this.cameras.add(0, 0, this.scale.width, this.scale.height);
    // La cámara del clima no dibuja el mapa.
    this.world.cameraFilter |= this.uiCam.id;
    this.cameras.main.ignore([this.precip, this.flash]);

    const cam = this.cameras.main;
    cam.setBackgroundColor('#120c24');
    cam.setZoom(RES);
    this.applyBounds();
    const mid = iso(MAP_W / 2, MAP_H / 2);
    cam.centerOn(mid.x, mid.y);
    this.scale.on('resize', () => this.applyBounds());
    this.setupInput();
    bridge.onFocus((x, y) => {
      this.userPannedAt = this.time.now;
      const p = iso(x, y);
      this.cameras.main.pan(p.x, p.y, 450, 'Sine.easeInOut');
    });

    if (import.meta.env.DEV) Object.assign(window as any, { __city: this, __iso: iso });
    const unsub = bridge.subscribe((m) => this.onModel(m));
    this.events.once('shutdown', () => unsub());
    this.onModel(bridge.get(), true);
    this.updateLight(true);
  }

  /** Margen extra arriba y abajo para que el HUD y el panel no tapen los bordes. */
  private applyBounds() {
    const cam = this.cameras.main;
    const zoom = cam.zoom;
    // píxeles de pantalla por píxel del juego (para que el HUD y el panel no tapen los bordes)
    const k = Math.max(0.5, this.scale.displaySize.width / Math.max(1, this.scale.gameSize.width));
    const top = 110 / k / zoom;
    const bottom = 70 / k / zoom;
    cam.setBounds(PAD * 0.4, -top, ISO_W - PAD * 0.8, ISO_H + top + bottom);
    const W = this.scale.width;
    const H = this.scale.height;
    this.uiCam?.setSize(W, H);
    this.flash?.setSize(W, H);
  }

  // ---------------------------------------------------------------- texturas

  private makeCarTextures() {
    CAR_COLORS.forEach((col, i) => {
      for (const police of [false, true]) {
        if (police && i > 0) continue;
        const color = police ? '#e8e4d8' : col;
        for (const axis of ['x', 'y'] as const) {
          const t = isoCarTexture(color, axis, police);
          const key = `car-${axis}-${police ? 'p' : i}`;
          this.textures.addCanvas(key, t.canvas);
          this.textures.get(key).setFilter(Phaser.Textures.FilterMode.LINEAR);
          this.textures.get(key).customData = { anchor: { x: t.ox / t.canvas.width, y: t.oy / t.canvas.height } };
        }
      }
    });
    for (const axis of ['x', 'y'] as const) {
      const t = isoPlaneTexture(axis);
      const key = `plane-${axis}`;
      this.textures.addCanvas(key, t.canvas);
      this.textures.get(key).setFilter(Phaser.Textures.FilterMode.LINEAR);
      this.textures.get(key).customData = { anchor: { x: t.ox / t.canvas.width, y: t.oy / t.canvas.height } };
    }
    const b = isoBoatTexture();
    this.textures.addCanvas('tugboat', b.canvas);
    this.textures.get('tugboat').setFilter(Phaser.Textures.FilterMode.LINEAR);
    this.textures.get('tugboat').customData = { anchor: { x: b.ox / b.canvas.width, y: b.oy / b.canvas.height } };
  }

  /** Imagen con su punto de anclaje en el suelo. */
  private anchored(x: number, y: number, key: string) {
    const an = (this.textures.get(key).customData as { anchor: { x: number; y: number } }).anchor as { x: number; y: number };
    return this.add.image(x, y, key).setOrigin(an.x, an.y).setScale(0.25);
  }

  private makeHeadlight() {
    const c = document.createElement('canvas');
    c.width = c.height = 24;
    const ctx = c.getContext('2d')!;
    const g = ctx.createRadialGradient(12, 12, 0, 12, 12, 12);
    g.addColorStop(0, 'rgba(255,240,190,0.75)');
    g.addColorStop(1, 'rgba(255,240,190,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 24, 24);
    this.textures.addCanvas('headlight', c);
  }

  /** Lluvia, nieve y nubes: texturas que se repiten y solo se desplazan. */
  private makeFxTextures() {
    const tex = (key: string, w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void) => {
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      draw(c.getContext('2d')!);
      this.textures.addCanvas(key, c);
    };
    // Atlas de gotas: lluvia cercana y lejana, copos grande y pequeño.
    // Atlas de gotas a 4 tamaños ya dibujados: en WebGL el Blitter no aplica su
    // escala, así que cada tamaño es una textura propia y se dibuja a escala 1.
    for (let k = 1; k <= 4; k++) {
      const dc = document.createElement('canvas');
      dc.width = 20 * k;
      dc.height = 8 * k;
      const d = dc.getContext('2d')!;
      const px = (x: number, y: number, w: number, h: number, col: string) => {
        d.fillStyle = col;
        d.fillRect(x * k, y * k, w * k, h * k);
      };
      px(0, 0, 1, 7, 'rgba(207,230,255,0.75)');
      px(1, 5, 1, 3, 'rgba(207,230,255,0.35)');
      px(4, 0, 1, 5, 'rgba(207,230,255,0.45)');
      px(8, 0, 3, 3, 'rgba(255,255,255,0.95)');
      px(11, 1, 1, 1, 'rgba(191,216,255,0.6)');
      px(13, 0, 2, 2, 'rgba(255,255,255,0.95)');
      // salpicadura de una gota en el suelo
      px(16, 1, 1, 1, 'rgba(220,235,255,0.7)');
      px(18, 1, 1, 1, 'rgba(220,235,255,0.7)');
      px(17, 0, 1, 1, 'rgba(220,235,255,0.7)');
      px(16, 2, 3, 1, 'rgba(220,235,255,0.35)');
      const dt = this.textures.addCanvas(`fx-drops-${k}`, dc)!;
      dt.add('rain', 0, 0, 0, 2 * k, 8 * k);
      dt.add('rain-far', 0, 4 * k, 0, k, 5 * k);
      dt.add('snow', 0, 8 * k, 0, 4 * k, 3 * k);
      dt.add('snow-s', 0, 13 * k, 0, 2 * k, 2 * k);
      dt.add('ripple', 0, 16 * k, 0, 3 * k, 3 * k);
    }
    tex('cloud', 90, 50, (ctx) => {
      ctx.fillStyle = '#0a0818';
      ctx.beginPath();
      ctx.ellipse(45, 25, 45, 25, 0, 0, Math.PI * 2);
      ctx.fill();
    });
    for (const kind of ['gato', 'perro'] as const) {
      const c = document.createElement('canvas');
      c.width = 6 * 2;
      c.height = 5;
      drawPet(c.getContext('2d')!, kind, 0, 0);
      drawPet(c.getContext('2d')!, kind, 6, 1);
      const t = this.textures.addCanvas(`pet-${kind}`, c)!;
      t.add('0', 0, 0, 0, 6, 5);
      t.add('1', 0, 6, 0, 6, 5);
    }
    tex('vending', 4, 7, (ctx) => drawVending(ctx, 0, 0));
    tex('door-light', 10, 12, (ctx) => {
      const g = ctx.createLinearGradient(0, 0, 0, 12);
      g.addColorStop(0, 'rgba(255,214,140,0)');
      g.addColorStop(1, 'rgba(255,214,140,0.9)');
      ctx.fillStyle = g;
      ctx.fillRect(2, 0, 6, 12);
      ctx.fillStyle = 'rgba(255,240,200,0.9)';
      ctx.fillRect(3, 6, 4, 6);
    });
    tex('umbrella', 9, 6, (ctx) => {
      const c = ['#e8414f', '#f4efe2'];
      for (let x = 0; x < 9; x++) {
        ctx.fillStyle = c[Math.floor(x / 2) % 2];
        const h = x === 0 || x === 8 ? 1 : x === 1 || x === 7 ? 2 : 3;
        ctx.fillRect(x, 3 - h, 1, h);
      }
      ctx.fillStyle = '#14101f';
      ctx.fillRect(4, 3, 1, 3);
    });
    tex('pigeon', 4, 3, (ctx) => {
      ctx.fillStyle = '#8a8e98';
      ctx.fillRect(0, 1, 3, 2);
      ctx.fillStyle = '#5a6070';
      ctx.fillRect(2, 0, 2, 1);
      ctx.fillStyle = '#e2a23b';
      ctx.fillRect(3, 1, 1, 1);
    });
    tex('steam', 8, 8, (ctx) => {
      const g = ctx.createRadialGradient(4, 4, 0, 4, 4, 4);
      g.addColorStop(0, 'rgba(235,235,245,0.9)');
      g.addColorStop(1, 'rgba(235,235,245,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 8, 8);
    });
    tex('air-shadow', 32, 16, (ctx) => {
      const g = ctx.createRadialGradient(16, 8, 0, 16, 8, 16);
      g.addColorStop(0, 'rgba(10,8,20,0.9)');
      g.addColorStop(0.6, 'rgba(10,8,20,0.6)');
      g.addColorStop(1, 'rgba(10,8,20,0)');
      ctx.fillStyle = g;
      ctx.save();
      ctx.scale(1, 0.5);
      ctx.beginPath();
      ctx.arc(16, 16, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
    // Helicóptero (dos fotogramas del rotor), morro a la derecha
    {
      const c = document.createElement('canvas');
      c.width = 36;
      c.height = 16;
      const h = c.getContext('2d')!;
      for (let f = 0; f < 2; f++) {
        const o = f * 18;
        const px = (x: number, y: number, w: number, hh: number, col: string) => {
          h.fillStyle = col;
          h.fillRect(o + x, y, w, hh);
        };
        px(1, 6, 7, 1, '#2a2a33'); // cola
        px(0, 4, 2, 3, '#c0392b');
        px(7, 5, 7, 5, '#c0392b'); // cuerpo
        px(8, 5, 6, 2, '#e8564a');
        px(11, 6, 3, 2, '#6fa7c7'); // cabina
        px(12, 6, 1, 1, '#cfe6ff');
        px(7, 11, 8, 1, '#2a2a33'); // patines
        px(8, 10, 1, 1, '#2a2a33');
        px(13, 10, 1, 1, '#2a2a33');
        px(10, 3, 1, 2, '#2a2a33'); // eje
        if (f === 0) px(1, 2, 17, 1, 'rgba(40,40,50,0.85)');
        else {
          px(5, 2, 9, 1, 'rgba(40,40,50,0.85)');
          px(9, 1, 1, 3, 'rgba(40,40,50,0.6)');
        }
      }
      const t = this.textures.addCanvas('heli', c)!;
      t.add('0', 0, 0, 0, 18, 16);
      t.add('1', 0, 18, 0, 18, 16);
    }
    tex('sig', 2, 2, (ctx) => {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 2, 2);
    });
    // iconos de los marcadores (pixel art de 12×12 a escala 1)
    for (const id of ['moneda', 'cono', 'cartel', 'caballo', 'boleto', 'estrella', 'casa']) {
      const c = document.createElement('canvas');
      drawIcon(c, id, 1);
      const d = document.createElement('canvas');
      d.width = 14;
      d.height = 14;
      const dc = d.getContext('2d')!;
      dc.fillStyle = 'rgba(20,16,31,0.85)';
      dc.fillRect(1, 0, 12, 14);
      dc.fillRect(0, 1, 14, 12);
      dc.drawImage(c, 1, 1);
      this.textures.addCanvas(`mk-${id}`, d);
    }
  }

  /** (Re)dibuja el mapa con los solares y obras de la partida. */
  private buildMap(m: SceneModel) {
    if (m.citySig === this.mapSig) return;
    this.mapSig = m.citySig;
    for (const img of this.mapImgs) img.destroy();
    for (const s of this.mapSets) for (const k of this.textures.getTextureKeys()) if (k.startsWith(`${s.key}-`)) this.textures.remove(k);
    this.mapImgs = [];
    this.mapSets = [];
    this.bakedMode = '-';
    this.bases = [];
    this.lightImgs = [];
    this.chunks = [];
    setArtScale(RES >= 2 ? 3 : 2);
    const art = generateCityMap(1985, m.city);
    this.heights = art.heights;
    const addSet = (set: MapLayer) => {
      const key = `map-${set.key}`;
      for (const k of this.textures.getTextureKeys()) if (k.startsWith(`${key}-`)) this.textures.remove(k);
      const bands = set.bands ?? [{ x: 0, y: 0, w: set.w, h: set.h }];
      // Cada franja es un fotograma del mismo lienzo (no se copia nada).
      const frames = (tex: string, k: number) => {
        const t = this.textures.get(tex);
        t.setFilter(Phaser.Textures.FilterMode.LINEAR);
        bands.forEach((b, i) => t.add(`b${i}`, 0, b.x * k, b.y * k, Math.min(b.w * k, t.source[0].width - b.x * k), Math.min(b.h * k, t.source[0].height - b.y * k)));
      };
      this.textures.addCanvas(`${key}-base`, set.base);
      frames(`${key}-base`, set.scale);
      if (set.lights) {
        this.textures.addCanvas(`${key}-lights`, set.lights);
        frames(`${key}-lights`, 1);
      }
      const baseImgs: Phaser.GameObjects.Image[] = [];
      bands.forEach((b, i) => {
        const base = this.add.image(set.x + b.x, set.y + b.y, `${key}-base`, `b${i}`).setOrigin(0).setDepth(set.depth).setScale(1 / set.scale);
        const imgs = [base];
        baseImgs.push(base);
        this.bases.push(base);
        // Las luces (y los neones) se amplían suavizadas: brillo cálido, no bloques.
        if (set.lights) {
          const img = this.add.image(set.x + b.x, set.y + b.y, `${key}-lights`, `b${i}`).setOrigin(0).setDepth(set.depth + 0.02).setBlendMode(Phaser.BlendModes.ADD);
          imgs.push(img);
          this.lightImgs.push(img);
        }
        this.mapImgs.push(...imgs);
        this.world.add(imgs);
        this.chunks.push({ imgs, x0: set.x + b.x, y0: set.y + b.y, x1: set.x + b.x + b.w, y1: set.y + b.y + b.h });
      });
      this.mapSets.push({ key, base: set.base, snow: set.snow, wet: set.wet, imgs: baseImgs, bands, scale: set.scale });
    };
    addSet(art.ground);
    for (const c of art.cells) addSet(c);
    // semáforos: la luz de cada poste
    if (!this.signalDots.length)
      for (const s of art.signals) {
        const p = iso(s.x, s.y);
        const dot = this.add.image(p.x, p.y - 11, 'sig').setScale(0.5).setDepth(depthAt(s.x, s.y) + 0.1);
        this.signalDots.push(dot);
        this.world.add(dot);
      }
    this.signalPhase = -1;
    this.cullKey = '';
    if (this.labels.length) this.repositionLabels();
    this.lastLightAt = 0;
  }

  /**
   * Nieve y charcos se pintan dentro de la textura base (una capa menos que dibujar):
   * en móviles modestos lo caro es rellenar píxeles, no cambiar de textura.
   */
  private bakeWeather(snow: boolean, wet: boolean) {
    const mode = `${snow ? 's' : ''}${wet ? 'w' : ''}`;
    if (mode === this.bakedMode) return;
    this.bakedMode = mode;
    for (const m of this.mapSets) {
      const useWet = wet && !!m.wet;
      const useSnow = snow && !!m.snow;
      const variant = `${useSnow ? 's' : ''}${useWet ? 'w' : ''}`;
      if (!variant) {
        m.imgs.forEach((img, i) => img.setTexture(`${m.key}-base`, `b${i}`));
        continue;
      }
      const key = `${m.key}-v${variant}`;
      if (!this.textures.exists(key)) {
        const c = document.createElement('canvas');
        c.width = m.base.width;
        c.height = m.base.height;
        const ctx = c.getContext('2d')!;
        ctx.drawImage(m.base, 0, 0);
        ctx.imageSmoothingEnabled = false;
        if (useWet) ctx.drawImage(m.wet!, 0, 0, c.width, c.height);
        if (useSnow) {
          ctx.globalAlpha = 0.85;
          ctx.drawImage(m.snow!, 0, 0, c.width, c.height);
        }
        const t = this.textures.addCanvas(key, c)!;
        t.setFilter(Phaser.Textures.FilterMode.LINEAR);
        const k = m.scale;
        m.bands.forEach((b, i) => t.add(`b${i}`, 0, b.x * k, b.y * k, Math.min(b.w * k, c.width - b.x * k), Math.min(b.h * k, c.height - b.y * k)));
      }
      m.imgs.forEach((img, i) => img.setTexture(key, `b${i}`));
    }
  }

  /** Punto en pantalla encima de un lugar (para etiquetas y marcadores). */
  private above(p: Place, extra = 0) {
    const c = placeCenter(p);
    return iso(c.x, c.y, placeHeight(p, this.heights) + extra);
  }

  private repositionLabels() {
    for (const t of this.labels) {
      const pt = this.above(PLACE_BY_ID[t.getData('place') as PlaceId], 3);
      t.setPosition(pt.x, pt.y);
    }
  }

  /** Coloca un sprite en su punto del plano, con su profundidad. */
  private put(o: Phaser.GameObjects.Components.Transform & Phaser.GameObjects.Components.Depth & { depth: number }, p: WP, dz = 0) {
    const s = iso(p.x, p.y, p.z ?? 0);
    o.setPosition(s.x, s.y);
    depthOf(o, depthAt(p.x, p.y) + dz);
  }

  /** La mascota sigue al personaje; las máquinas expendedoras, en las aceras. */
  private syncExtras(m: SceneModel) {
    const kind = m.role === 'inmigrante' ? m.pet ?? '' : '';
    if (kind !== this.petKind) {
      this.petKind = kind;
      this.pet?.destroy();
      this.pet = null;
      if (kind) {
        this.pet = this.add.sprite(0, 0, `pet-${kind}`, '0').setOrigin(0.5, 1);
        this.world.add(this.pet);
        this.petTrail = [];
        this.petP = { x: 0, y: 0 };
      }
    }
    const n = m.role === 'inmigrante' ? Math.min(5, m.vending) : 0;
    if (n !== this.machines.length) {
      for (const mm of this.machines) mm.destroy();
      this.machines = [];
      const spots: PlaceId[] = ['diner', 'casa', 'bar', 'pizza', 'hotel'];
      for (let i = 0; i < n; i++) {
        const e = placeEntrance(PLACE_BY_ID[spots[i]]);
        const img = this.add.image(0, 0, 'vending').setOrigin(0.5, 1);
        this.put(img, { x: e.x + 9, y: e.y - 0.6 });
        this.machines.push(img);
        this.world.add(img);
      }
    }
  }

  /** Vida de la ciudad: palomas en el parque, vapor de las alcantarillas, remolcadores en el río. */
  private spawnLife() {
    const rand = mulberry32(77);
    this.umbrella = this.add.image(0, 0, 'umbrella').setOrigin(0.5, 1).setVisible(false);
    this.world.add(this.umbrella);
    // palomas
    const park = placeRect(PLACE_BY_ID.parque);
    for (let i = 0; i < (this.low ? 4 : 10); i++) {
      const p = { x: park.x + 20 + rand() * (park.w - 40), y: park.y + 20 + rand() * (park.h - 40) };
      const pg = this.add.image(0, 0, 'pigeon').setOrigin(0.5, 1);
      this.put(pg, p);
      this.world.add(pg);
      this.pigeons.push({ img: pg, p });
      const hop = () => {
        if (!pg.active) return;
        const nx = Phaser.Math.Clamp(p.x + (Math.random() - 0.5) * 16, park.x + 8, park.x + park.w - 8);
        const ny = Phaser.Math.Clamp(p.y + (Math.random() - 0.5) * 10, park.y + 8, park.y + park.h - 8);
        pg.setFlipX(nx - ny < p.x - p.y);
        this.tweens.add({ targets: p, x: nx, y: ny, duration: 300, ease: 'Quad.easeOut', onUpdate: () => this.put(pg, p), onComplete: () => this.time.delayedCall(800 + Math.random() * 3000, hop) });
      };
      this.time.delayedCall(rand() * 2000, hop);
    }
    // vapor de alcantarilla
    for (let i = 0; i < (this.low ? 4 : 9); i++) {
      const wx = aveX(Math.floor(rand() * AVES)) - 4 + rand() * 8;
      const wy = stY(Math.floor(rand() * (ROWS + 1)));
      const s = iso(wx, wy);
      const st = this.add.image(s.x, s.y, 'steam').setOrigin(0.5, 1).setAlpha(0).setDepth(depthAt(wx, wy) + 1);
      this.world.add(st);
      this.tweens.add({ targets: st, y: s.y - 12, alpha: { from: 0.55, to: 0 }, scale: { from: 0.6, to: 1.6 }, duration: 2200, delay: rand() * 2000, repeat: -1 });
    }
    // remolcadores en el East River
    for (let i = 0; i < 2; i++) {
      const dir = i ? -1 : 1;
      const p = { x: RIVER_X + (i ? 42 : 31), y: rand() * BOAT_MAX };
      const img = this.anchored(0, 0, 'tugboat');
      this.put(img, p);
      this.world.add(img);
      this.boats.push({ img, p, dir, speed: 5 + rand() * 3 });
    }
  }

  /** Iconos flotantes sobre tus negocios, las obras y las actividades. */
  private syncMarkers(m: SceneModel) {
    const key = JSON.stringify(m.markers) + this.mapSig.length;
    if (key === this.markerKey) return;
    this.markerKey = key;
    for (const ic of this.markerIcons) ic.destroy();
    this.markerIcons = [];
    for (const mk of m.markers) {
      let pt: { x: number; y: number };
      if (mk.kind === 'lot') {
        const lot = LOTS.find((l) => l.id === mk.id);
        if (!lot) continue;
        const r = lotRect(lot);
        pt = iso(r.x + r.w / 2, r.y + r.h / 2, (this.heights[`${lot.c},${lot.r}`] ?? 10) + 4);
      } else if (mk.kind === 'place') {
        const p = PLACE_BY_ID[mk.id as PlaceId];
        if (!p) continue;
        pt = this.above(p, 12);
      } else {
        const mg = MEGA.find((q) => q.id === mk.id);
        if (!mg || 'place' in mg.site) continue;
        pt = this.above({ id: 'plaza', label: '', c: mg.site.c, r: mg.site.r, cw: mg.site.cw, rh: mg.site.rh }, 6);
      }
      const tex = `mk-${mk.icon}`;
      if (!this.textures.exists(tex)) continue;
      const ic = this.add.image(pt.x, pt.y - 6, tex).setOrigin(0.5, 1).setDepth(100002);
      this.world.add(ic);
      this.tweens.add({ targets: ic, y: pt.y - 10, duration: 700 + Math.random() * 300, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      this.markerIcons.push(ic);
    }
  }

  /** Solo se dibujan las manzanas que caen dentro de la cámara. */
  private cull() {
    const v = this.cameras.main.worldView;
    const key = `${Math.round(v.x / 8)},${Math.round(v.y / 8)},${Math.round(v.width / 8)}`;
    if (key === this.cullKey) return;
    this.cullKey = key;
    for (const ch of this.chunks) {
      const vis = ch.x1 > v.x - 16 && ch.x0 < v.right + 16 && ch.y1 > v.y - 16 && ch.y0 < v.bottom + 16;
      for (const img of ch.imgs) if (img.visible !== vis) img.setVisible(vis);
    }
  }

  private ensureMini(look: Look): string {
    const key = lookKey(look);
    if (this.textures.exists(key)) return key;
    // Cada fotograma se dibuja a 1×, se amplía ×2 con contorno y se coloca en una tira.
    const FW = MINI_W * 2 + 2;
    const FH = MINI_H * 2 + 2;
    const c = document.createElement('canvas');
    c.width = FW * 6;
    c.height = FH;
    const ctx = c.getContext('2d')!;
    for (let f = 0; f < 6; f++) {
      const one = document.createElement('canvas');
      one.width = MINI_W;
      one.height = MINI_H;
      drawMini(one.getContext('2d')!, look, f % 3, 0, 0, f >= 3);
      ctx.drawImage(upscaleOutline(one), f * FW, 0);
    }
    const tex = this.textures.addCanvas(key, c)!;
    for (let f = 0; f < 6; f++) tex.add(String(f), 0, f * FW, 0, FW, FH);
    return key;
  }

  private makeLabels() {
    for (const p of PLACES_MAP) {
      const pt = this.above(p, 3);
      const t = this.add
        .text(pt.x, pt.y, p.label.toUpperCase(), {
          fontFamily: 'LC Display, sans-serif',
          fontSize: '6px',
          color: '#ffffff',
          stroke: '#14101f',
          strokeThickness: 3,
          resolution: 4,
        })
        .setOrigin(0.5, 1)
        .setAlpha(0.92)
        .setDepth(100000);
      t.setData('place', p.id);
      this.labels.push(t);
      this.world.add(t);
    }
  }

  // ---------------------------------------------------------------- tráfico y peatones

  private spawnTraffic() {
    const rand = mulberry32(42);
    const n = this.low ? 30 : 60;
    const aveCross = Array.from({ length: AVES }, (_, i) => aveX(i));
    const stCross = Array.from({ length: ROWS + 1 }, (_, j) => stY(j));
    for (let k = 0; k < n; k++) {
      const police = rand() < 0.07;
      // Nueva York: la mitad de los coches son taxis amarillos
      const ci = rand() < 0.5 ? 0 : Math.floor(rand() * CAR_COLORS.length);
      const axis: 'v' | 'h' = k % 2 === 0 ? 'v' : 'h';
      let dir: 1 | -1 = rand() < 0.5 ? 1 : -1;
      // Dos carriles del mismo sentido (calles y avenidas de sentido único).
      const laneSide = rand() < 0.5 ? 0 : 1;
      const speed = 16 + rand() * 14;
      let lane: string;
      let min = -12;
      let max = MAP_H + 12;
      let cross = stCross;
      let pos: number;
      let off: number;
      if (axis === 'v') {
        const i = Math.floor(rand() * AVES);
        dir = aveDir(i);
        off = aveX(i) + (laneSide ? 4 : -4);
        pos = rand() * MAP_H;
        lane = `v${i}${laneSide}`;
      } else {
        const j = Math.floor(rand() * (ROWS + 1));
        const side = rand() < 0.5 ? 'manhattan' : 'brooklyn';
        const [x0, x1] = streetSpan(j, side);
        min = x0 - 12;
        max = x1 + 12;
        cross = aveCross.filter((x) => x > x0 && x < x1);
        const sd = stDir(j);
        // En la calle del puente se circula por la derecha en cada sentido.
        if (sd === 0) off = stY(j) + (dir > 0 ? 3.5 : -3.5);
        else {
          dir = sd;
          off = stY(j) + (laneSide ? 3.5 : -3.5);
        }
        pos = x0 + rand() * (x1 - x0);
        lane = `h${j}${sd === 0 ? dir : laneSide}${j === BRIDGE_STREET ? 'p' : side[0]}`;
      }
      const img = this.anchored(0, 0, `car-${axis === 'v' ? 'y' : 'x'}-${police ? 'p' : ci}`);
      const light = this.add.image(0, 0, 'headlight').setBlendMode(Phaser.BlendModes.ADD).setAlpha(0).setScale(0.55, 0.4);
      this.world.add([img, light]);
      this.cars.push({ img, light, axis, dir, lane, speed, len: 10, pos, off, min, max, cross });
    }
    // separar coches que hayan nacido encima de otros
    for (const c of this.cars)
      for (const o of this.cars)
        if (o !== c && o.lane === c.lane && Math.abs(o.pos - c.pos) < 14) o.pos += 18 * o.dir;
  }

  /** Mueve el tráfico: respeta semáforos y la distancia con el coche de delante. */
  private moveTraffic(dt: number, time: number) {
    const phase = Math.floor(time / SIGNAL_MS) % 2; // 0: avenidas en verde, 1: calles en verde
    const amber = time % SIGNAL_MS > SIGNAL_MS - 1200;
    if (phase !== this.signalPhase) for (const d of this.signalDots) d.setTint(phase === 0 ? 0x3dff7a : 0xff3b3b);
    this.signalPhase = phase;
    const lanes = new Map<string, Car[]>();
    for (const c of this.cars) {
      const l = lanes.get(c.lane);
      if (l) l.push(c);
      else lanes.set(c.lane, [c]);
    }
    const v = this.cameras.main.worldView;
    const gone: Car[] = [];
    for (const c of this.cars) {
      const pos = c.pos;
      const front = pos + (c.dir * c.len) / 2;
      let next = pos + c.dir * c.speed * dt;
      const red = (c.axis === 'v' ? phase !== 0 : phase !== 1) || amber;
      if (red) {
        const half = (c.axis === 'v' ? ST_H : AVE_W) / 2 + 3;
        for (const x of c.cross) {
          const stopLine = x - c.dir * half;
          const dist = (stopLine - front) * c.dir;
          if (dist >= -0.5 && dist < 10) {
            next = c.dir > 0 ? Math.min(next, pos + dist) : Math.max(next, pos - dist);
            break;
          }
        }
      }
      // no chocar con el de delante en el mismo carril
      for (const o of lanes.get(c.lane)!) {
        if (o === c) continue;
        const gap = (o.pos - pos) * c.dir;
        if (gap > 0 && gap < c.len + 5) next = pos + c.dir * Math.max(0, gap - c.len - 5) * 0.5;
      }
      // accidente: los coches implicados no se mueven (los de detrás esperan en la cola)
      if (c.crashUntil && time < c.crashUntil) next = pos;
      // la policía avanza hasta el accidente, se queda allí y luego se va
      if (c.stopAt !== undefined && time < (c.leaveAt ?? 0)) {
        const rem = (c.stopAt - pos) * c.dir;
        next = rem <= 0.3 ? pos : pos + c.dir * Math.min(rem, Math.abs(next - pos));
      }
      c.pos = next;
      if (c.temp && (next > c.max || next < c.min)) {
        gone.push(c);
        continue;
      }
      if (next > c.max) c.pos = c.min;
      if (next < c.min) c.pos = c.max;
      const wx = c.axis === 'v' ? c.off : c.pos;
      const wy = c.axis === 'v' ? c.pos : c.off;
      const s = iso(wx, wy);
      // fuera de cámara no hace falta recolocar ni reordenar
      const vis = s.x > v.x - 30 && s.x < v.right + 30 && s.y > v.y - 30 && s.y < v.bottom + 30;
      if (c.img.visible !== vis) {
        c.img.setVisible(vis);
        c.light.setVisible(vis);
        for (const e of c.extras ?? []) e.setVisible(vis);
      }
      if (!vis) continue;
      if (c.extras) {
        // sirenas: roja y azul alternando encima del coche
        const top = iso(wx, wy, 4.6);
        const on = Math.floor(time / 260) % 2;
        c.extras.forEach((e, i) => {
          e.setPosition(top.x + (i ? 1.6 : -1.6), top.y).setAlpha(on === i ? 1 : 0.15);
          depthOf(e, depthAt(wx, wy) + 0.06);
        });
      }
      c.img.setPosition(s.x, s.y);
      depthOf(c.img, depthAt(wx, wy));
      depthOf(c.light, c.img.depth + 0.05);
      const hx = c.axis === 'h' ? wx + c.dir * 9 : wx;
      const hy = c.axis === 'v' ? wy + c.dir * 9 : wy;
      const hs = iso(hx, hy, 1);
      c.light.setPosition(hs.x, hs.y);
    }
    for (const c of gone) {
      c.img.destroy();
      c.light.destroy();
      for (const e of c.extras ?? []) e.destroy();
      this.cars.splice(this.cars.indexOf(c), 1);
    }
  }

  /** Posición en el plano de un coche. */
  private carAt(c: Car) {
    return { x: c.axis === 'v' ? c.off : c.pos, y: c.axis === 'v' ? c.pos : c.off };
  }

  /**
   * ¿Algún edificio de delante tapa este punto de la calle desde la cámara?
   * Se mira el píxel real de las manzanas que se dibujan por delante.
   */
  private occluded(x: number, y: number) {
    const mine = depthAt(x, y);
    for (const z of [1, 4]) {
      const s = iso(x, y, z);
      for (const ch of this.chunks) {
        const img = ch.imgs[0];
        if (img.depth <= mine || s.x < ch.x0 || s.x >= ch.x1 || s.y < ch.y0 || s.y >= ch.y1) continue;
        const k = 1 / img.scaleX;
        const fx = Math.floor((s.x - img.x) * k);
        const fy = Math.floor((s.y - img.y) * k);
        if ((this.textures.getPixelAlpha(fx, fy, img.texture.key, img.frame.name) ?? 0) > 40) return true;
      }
    }
    return false;
  }

  /** Volumen de un sonido según lo lejos que pase de la cámara. */
  private nearVol(x: number, y: number, z = 0) {
    const s = iso(x, y, z);
    const c = this.cameras.main.midPoint;
    const d = Math.hypot(s.x - c.x, s.y - c.y) * (this.cameras.main.zoom / RES);
    return Phaser.Math.Clamp(1 - d / 420, 0, 1);
  }

  /**
   * Accidentes: de vez en cuando un coche se come al de delante (más con
   * lluvia, nieve o de noche). Quedan parados con humo, cristales y las
   * luces de emergencia; los de detrás hacen cola; llega la policía y, al
   * rato, todo se despeja.
   */
  private maybeAccident(time: number) {
    if (time < this.nextAccident || this.accident) return;
    const w = bridge.get().weather;
    const risk = (w === 'tormenta' ? 0.4 : w === 'nieve' ? 0.5 : w === 'lluvia' ? 0.6 : 1) * (this.light.night > 0.5 ? 0.75 : 1);
    this.nextAccident = time + (70_000 + Math.random() * 110_000) * risk * (this.low ? 1.6 : 1);
    if (!bridge.get().role) return;
    const v = this.cameras.main.worldView;
    // preferimos un choque que se vea: coches dentro de la cámara, en marcha, con otro justo detrás
    const pairs: [Car, Car][] = [];
    for (const c of this.cars) {
      if (c.temp || c.crashUntil || !c.img.visible) continue;
      const s = iso(this.carAt(c).x, this.carAt(c).y);
      if (s.x < v.x + 20 || s.x > v.right - 20 || s.y < v.y + 60 || s.y > v.bottom - 60) continue;
      for (const o of this.cars) {
        if (o === c || o.lane !== c.lane || o.temp || o.crashUntil) continue;
        const gap = (c.pos - o.pos) * c.dir;
        if (gap > c.len && gap < c.len + 22) {
          // los dos coches (ya juntos tras el golpe) tienen que verse desde la cámara
          const q = this.carAt(c);
          const bp = c.pos - c.dir * (c.len + 0.4);
          const qb = c.axis === 'v' ? { x: c.off, y: bp } : { x: bp, y: c.off };
          if (!this.occluded(q.x, q.y) && !this.occluded(qb.x, qb.y) && !this.occluded((q.x + qb.x) / 2, (q.y + qb.y) / 2)) pairs.push([c, o]);
        }
      }
    }
    if (!pairs.length) {
      this.nextAccident = time + 12_000;
      return;
    }
    const [front, back] = pairs[Math.floor(Math.random() * pairs.length)];
    back.pos = front.pos - front.dir * (front.len + 0.4);
    const until = time + 34_000;
    front.crashUntil = until;
    back.crashUntil = until;
    const a = this.carAt(front);
    const b = this.carAt(back);
    const at = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const fx: Phaser.GameObjects.GameObject[] = [];
    // cristales y piezas por el suelo
    for (let i = 0; i < 6; i++) {
      const p = iso(at.x + (Math.random() - 0.5) * 6, at.y + (Math.random() - 0.5) * 6);
      const d = this.add.image(p.x, p.y, 'sig').setScale(0.35 + Math.random() * 0.3).setTint(i % 2 ? 0xcfe6ff : 0x2a2a33).setDepth(depthAt(at.x, at.y) - 0.4);
      fx.push(d);
    }
    // humo del capó
    for (let i = 0; i < 2; i++) {
      const p = iso(a.x, a.y, 3);
      const sm = this.add.image(p.x, p.y, 'steam').setOrigin(0.5, 1).setTint(0x8a8a90).setAlpha(0).setDepth(depthAt(a.x, a.y) + 0.3);
      this.tweens.add({ targets: sm, y: p.y - 16, alpha: { from: 0.7, to: 0 }, scale: { from: 0.6, to: 2 }, duration: 2400, delay: i * 1200, repeat: -1 });
      fx.push(sm);
    }
    // luces de emergencia (parpadean)
    for (const c of [front, back]) {
      const q = this.carAt(c);
      for (const side of [-1, 1]) {
        const p = iso(q.x + (c.axis === 'h' ? side * 4 : 2.5), q.y + (c.axis === 'v' ? side * 4 : 2.5), 1.5);
        const h = this.add.image(p.x, p.y, 'sig').setScale(0.7).setTint(0xffa020).setBlendMode(Phaser.BlendModes.ADD).setDepth(depthAt(q.x, q.y) + 0.07);
        this.tweens.add({ targets: h, alpha: { from: 1, to: 0.1 }, duration: 380, yoyo: true, repeat: -1 });
        fx.push(h);
      }
    }
    // aviso flotante: en isométrico los edificios de delante pueden tapar la calle
    const mk = iso(at.x, at.y, 20);
    const cone = this.add.image(mk.x, mk.y, 'mk-cono').setOrigin(0.5, 1).setDepth(100003);
    this.tweens.add({ targets: cone, y: mk.y - 4, duration: 450, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    fx.push(cone);
    this.world.add(fx);
    crashSound(this.nearVol(at.x, at.y));
    this.accident = { cars: [front, back], at, until, fx };
    // la policía llega por el carril de al lado y se para junto al accidente
    this.time.delayedCall(5000, () => this.sendPolice(front, until));
    // y si es de día y no hay tormenta, un helicóptero de la tele se acerca a mirar
    if (this.light.night < 0.6 && bridge.get().weather !== 'tormenta' && Math.random() < 0.6) this.time.delayedCall(9000, () => this.spawnHeli(at));
    this.time.delayedCall(until - time, () => {
      for (const o of fx) o.destroy();
      this.accident = null;
    });
  }

  private sendPolice(crashed: Car, until: number) {
    if (!crashed.img.active) return;
    // el carril vecino: simétrico respecto al centro de la calzada
    const center =
      crashed.axis === 'v'
        ? aveX(Array.from({ length: AVES }, (_, i) => i).sort((p, q) => Math.abs(aveX(p) - crashed.off) - Math.abs(aveX(q) - crashed.off))[0])
        : stY(Array.from({ length: ROWS + 1 }, (_, j) => j).sort((p, q) => Math.abs(stY(p) - crashed.off) - Math.abs(stY(q) - crashed.off))[0]);
    const off = center * 2 - crashed.off;
    const twin = this.cars.find((o) => o.axis === crashed.axis && Math.abs(o.off - off) < 0.5 && o.dir === crashed.dir);
    const img = this.anchored(0, 0, `car-${crashed.axis === 'v' ? 'y' : 'x'}-p`);
    const light = this.add.image(0, 0, 'headlight').setBlendMode(Phaser.BlendModes.ADD).setAlpha(0).setScale(0.55, 0.4);
    const extras = [0xff3b3b, 0x3b7bff].map((t) => this.add.image(0, 0, 'sig').setTint(t).setScale(0.8).setBlendMode(Phaser.BlendModes.ADD));
    this.world.add([img, light, ...extras]);
    img.setTint(this.cars[0]?.img.tintTopLeft ?? 0xffffff);
    const stopAt = crashed.pos + crashed.dir * 2;
    this.cars.push({
      img,
      light,
      extras,
      axis: crashed.axis,
      dir: crashed.dir,
      lane: twin?.lane ?? `police-${off}`,
      speed: 30,
      len: 10,
      pos: stopAt - crashed.dir * 90,
      off,
      min: crashed.min,
      max: crashed.max,
      cross: [],
      stopAt,
      leaveAt: until + 1500,
      temp: true,
    });
    const at = this.carAt(crashed);
    sirenSound(this.nearVol(at.x, at.y), 4);
  }

  // ---------------------------------------------------------------- aviones y helicópteros

  /** Pista del aeropuerto de Brooklyn (si está construido). */
  private runway() {
    if (bridge.get().city?.mega?.aeropuerto !== 'listo') return null;
    const r = placeRect({ id: 'plaza', label: '', c: 6, r: 0, cw: 2, rh: 2 });
    return { x0: r.x + 8, x1: r.x + r.w - 8, y: r.y + r.h / 2 };
  }

  private addAircraft(kind: Aircraft['kind'], p: WP, step: Aircraft['step']) {
    const img =
      kind === 'avion' ? this.anchored(0, 0, 'plane-x').setScale(1 / 3) : this.add.sprite(0, 0, 'heli', '0').setOrigin(0.5, 0.7);
    img.setDepth(150000);
    const shadow = this.add.image(0, 0, 'air-shadow').setDepth(-500).setScale(kind === 'avion' ? 1.1 : 0.45, kind === 'avion' ? 1.1 : 0.45);
    const lights = [0xff3b3b, 0x3dff7a, 0xffffff].map((t) => this.add.image(0, 0, 'sig').setTint(t).setScale(0.8).setBlendMode(Phaser.BlendModes.ADD).setDepth(150001));
    const beam = kind === 'helicoptero' ? this.add.image(0, 0, 'headlight').setBlendMode(Phaser.BlendModes.ADD).setScale(1.6, 0.9).setDepth(-490).setAlpha(0) : undefined;
    this.world.add([img, shadow, ...lights, ...(beam ? [beam] : [])]);
    const a: Aircraft = { kind, img, shadow, beam, lights, p, step, hx: 1, hy: 0, soundAt: 0 };
    this.aircraft.push(a);
    return a;
  }

  /** Un avión cruza el cielo de punta a punta (o aterriza / despega si hay aeropuerto). */
  private spawnPlane() {
    const rw = this.runway();
    const roll = Math.random();
    if (rw && roll < 0.35) {
      // aproximación: entra por el oeste y baja hasta la pista
      const p: WP = { x: rw.x0 - 560, y: rw.y, z: 150 };
      let rolling = 0;
      const a = this.addAircraft('avion', p, (dt) => {
        if (p.x < rw.x0 + 20) {
          p.x += 52 * dt;
          p.z = Math.max(0, 150 * ((rw.x0 + 20 - p.x) / 580));
        } else {
          rolling += dt;
          p.x += Math.max(4, 40 - rolling * 9) * dt;
          p.z = 0;
          if (rolling > 6) a.img.setAlpha(Math.max(0, a.img.alpha - dt));
        }
        return rolling < 7.2;
      });
      return;
    }
    if (rw && roll < 0.6) {
      // despegue: rueda por la pista y sube hacia el este
      const p: WP = { x: rw.x0 + 10, y: rw.y, z: 0 };
      let t = 0;
      this.addAircraft('avion', p, (dt) => {
        t += dt;
        const v = Math.min(55, 8 + t * 9);
        p.x += v * dt;
        if (p.x > rw.x0 + 70) p.z = (p.z ?? 0) + v * 0.32 * dt;
        return p.x < MAP_W + 420;
      });
      return;
    }
    // vuelo de crucero: alto, recto, a lo largo de uno de los ejes de la ciudad
    const alongX = Math.random() < 0.5;
    const dir = Math.random() < 0.5 ? 1 : -1;
    const far = 300;
    const p: WP = alongX ? { x: dir > 0 ? -far : MAP_W + far, y: 40 + Math.random() * (MAP_H - 80), z: 170 } : { x: 40 + Math.random() * (MAP_W - 80), y: dir > 0 ? -far : MAP_H + far, z: 170 };
    const a = this.addAircraft('avion', p, (dt) => {
      if (alongX) p.x += dir * 60 * dt;
      else p.y += dir * 60 * dt;
      return alongX ? p.x > -far - 1 && p.x < MAP_W + far + 1 : p.y > -far - 1 && p.y < MAP_H + far + 1;
    });
    a.img.setTexture(alongX ? 'plane-x' : 'plane-y');
    const an = (this.textures.get(alongX ? 'plane-x' : 'plane-y').customData as { anchor: { x: number; y: number } }).anchor;
    a.img.setOrigin(an.x, an.y).setRotation(dir < 0 ? Math.PI : 0);
  }

  /** Helicóptero: llega a un sitio, da vueltas encima un rato y se va. */
  private spawnHeli(target?: { x: number; y: number }) {
    if (this.aircraft.some((x) => x.kind === 'helicoptero')) return;
    const spots = (['plaza', 'parque', 'bolsa', 'alcaldia', 'coney', 'hipodromo'] as PlaceId[]).map((id) => placeCenter(PLACE_BY_ID[id]));
    const t = target ?? spots[Math.floor(Math.random() * spots.length)];
    const ang0 = Math.random() * Math.PI * 2;
    const start = { x: t.x + Math.cos(ang0) * 700, y: t.y + Math.sin(ang0) * 700 };
    const exitAng = ang0 + Math.PI * (0.6 + Math.random() * 0.8);
    const p: WP = { x: start.x, y: start.y, z: 60 };
    const R = 46;
    let phase: 'in' | 'orbit' | 'out' = 'in';
    let orbit = 0;
    let ang = 0;
    this.addAircraft('helicoptero', p, (dt) => {
      if (phase === 'in' || phase === 'out') {
        const goal = phase === 'in' ? { x: t.x + Math.cos(ang0) * R, y: t.y + Math.sin(ang0) * R } : { x: t.x + Math.cos(exitAng) * 760, y: t.y + Math.sin(exitAng) * 760 };
        const dx = goal.x - p.x;
        const dy = goal.y - p.y;
        const d = Math.hypot(dx, dy);
        const v = 42 * dt;
        if (d <= v) {
          if (phase === 'out') return false;
          phase = 'orbit';
          ang = ang0;
        } else {
          p.x += (dx / d) * v;
          p.y += (dy / d) * v;
        }
      } else {
        orbit += dt;
        ang += dt * 0.55;
        p.x = t.x + Math.cos(ang) * R;
        p.y = t.y + Math.sin(ang) * R;
        if (orbit > 22) phase = 'out';
      }
      return true;
    });
  }

  private moveAircraft(time: number, dt: number) {
    const w = bridge.get().weather;
    if (time > this.nextPlane) {
      this.nextPlane = time + 55_000 + Math.random() * 90_000;
      if (this.aircraft.filter((a) => a.kind === 'avion').length < 2) this.spawnPlane();
    }
    if (time > this.nextHeli) {
      this.nextHeli = time + 110_000 + Math.random() * 140_000;
      if (w !== 'tormenta' && w !== 'nieve') this.spawnHeli();
    }
    const night = this.light.night;
    const day = night < 0.55;
    const v = this.cameras.main.worldView;
    for (const a of [...this.aircraft]) {
      const before = { x: a.p.x, y: a.p.y, z: a.p.z ?? 0 };
      if (!a.step(dt)) {
        for (const o of [a.img, a.shadow, a.beam, ...a.lights]) o?.destroy();
        this.aircraft.splice(this.aircraft.indexOf(a), 1);
        continue;
      }
      const z = a.p.z ?? 0;
      const s = iso(a.p.x, a.p.y, z);
      const sb = iso(before.x, before.y, before.z);
      if (Math.abs(s.x - sb.x) + Math.abs(s.y - sb.y) > 0.01) {
        a.hx = s.x - sb.x;
        a.hy = s.y - sb.y;
      }
      a.img.setPosition(s.x, s.y);
      // en tierra (aterrizando o despegando) va con la profundidad de su sitio
      a.img.setDepth(z < 6 ? depthAt(a.p.x, a.p.y) + 0.2 : 150000);
      a.img.setTint(this.cars[0]?.img.tintTopLeft ?? 0xffffff);
      if (a.kind === 'helicoptero') {
        const hs = a.img as Phaser.GameObjects.Sprite;
        hs.setFrame(String(Math.floor(time / 45) % 2));
        hs.setFlipX(a.hx < 0);
      }
      // sombra en el suelo, hacia el noreste (el sol viene del suroeste); de noche no hay
      const sh = iso(a.p.x + z * 0.45, a.p.y - z * 0.22, 0);
      a.shadow.setPosition(sh.x, sh.y).setVisible(day && w !== 'tormenta').setAlpha(Math.max(0.16, 0.34 - z / 900));
      if (a.beam) {
        a.beam.setVisible(!day);
        const g = iso(a.p.x, a.p.y, 0);
        a.beam.setPosition(g.x, g.y).setAlpha(!day ? 0.55 : 0);
      }
      // luces de navegación: roja a babor, verde a estribor y destello blanco
      const len = Math.hypot(a.hx, a.hy) || 1;
      const nx = -a.hy / len;
      const ny = a.hx / len;
      const span = a.kind === 'avion' ? 10 : 4;
      a.lights[0].setPosition(s.x - nx * span, s.y - ny * span * 0.5);
      a.lights[1].setPosition(s.x + nx * span, s.y + ny * span * 0.5);
      a.lights[2].setPosition(s.x, s.y - 2).setAlpha(Math.floor(time / 120) % 9 === 0 ? 1 : 0);
      a.lights[0].setAlpha(night > 0.3 ? 1 : 0.35);
      a.lights[1].setAlpha(night > 0.3 ? 1 : 0.35);
      // se oye al pasar cerca de la cámara
      const inView = s.x > v.x - 60 && s.x < v.right + 60 && s.y > v.y - 60 && s.y < v.bottom + 60;
      if (inView && time > a.soundAt) {
        a.soundAt = time + (a.kind === 'avion' ? 9000 : 3000);
        aircraftSound(a.kind, a.kind === 'avion' ? 0.7 : Math.max(0.3, this.nearVol(a.p.x, a.p.y, z)), a.kind === 'avion' ? 7 : 3);
      }
    }
  }

  private spawnPedestrians() {
    const rand = mulberry32(1985);
    const add = (c: number, r: number, extra: Partial<Walker> = {}) => {
      const look = randomLook(rand() < 0.5 ? 'inmigrante' : 'alcalde', rand);
      const key = this.ensureMini(look);
      const sprite = this.add.sprite(0, 0, key, '0').setOrigin(0.5, 1).setScale(PEOPLE);
      this.world.add(sprite);
      const w: Walker = { sprite, p: { x: walkX(c), y: walkY(r) }, c, r, ...extra };
      this.put(sprite, w.p);
      this.walkers.push(w);
      this.time.delayedCall(rand() * 3000, () => this.wander(w));
    };
    for (let i = 0; i < (this.low ? 16 : 40); i++) add(Math.floor(rand() * COLS), Math.floor(rand() * ROWS));
    // Times Square se llena de noche
    if (!this.low) for (let i = 0; i < 8; i++) add(1 + Math.floor(rand() * 3), 2 + Math.floor(rand() * 3), { zone: [1, 3, 2, 4], night: true });
    // Cuanto más nivel tiene un barrio, más gente por sus calles
    for (const [d, lvl] of Object.entries(bridge.get().city?.districts ?? {}))
      for (let i = 0; i < (lvl ?? 0) * 2 && !this.low; i++) {
        const blocks: [number, number][] = [];
        for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) if (districtOf(c, r) === d) blocks.push([c, r]);
        const [c, r] = blocks[Math.floor(rand() * blocks.length)];
        add(c, r);
      }
  }

  private wander(w: Walker) {
    if (!w.sprite.active) return;
    const [c0, c1, r0, r1] = w.zone ?? [0, COLS - 1, 0, ROWS - 1];
    // El río solo se cruza por la acera del puente.
    const crossOk = (c: number) => (c < MANHATTAN_COLS) === (w.c < MANHATTAN_COLS) || w.r === BRIDGE_STREET - 1;
    const opts: [number, number][] = [];
    if (w.c > c0 && crossOk(w.c - 1)) opts.push([w.c - 1, w.r]);
    if (w.c < c1 && crossOk(w.c + 1)) opts.push([w.c + 1, w.r]);
    if (w.r > r0) opts.push([w.c, w.r - 1]);
    if (w.r < r1) opts.push([w.c, w.r + 1]);
    const [c, r] = opts[Math.floor(Math.random() * opts.length)];
    // Tramos: andar por la acera hasta la esquina, esperar al semáforo y cruzar por el paso de cebra.
    const x0 = w.p.x;
    const y0 = w.p.y;
    const segs: { x: number; y: number; cross?: 0 | 1 }[] = [];
    if (c > w.c) {
      // cruza la avenida de al lado y sigue por la acera sur hasta la esquina
      segs.push({ x: blockX(c) + 1.5, y: y0, cross: 1 }, { x: walkX(c), y: y0 });
    } else if (c < w.c) {
      segs.push({ x: blockX(w.c) + 1.5, y: y0 }, { x: walkX(c), y: y0, cross: 1 });
    } else if (r > w.r) {
      segs.push({ x: x0, y: blockY(r) + 1.5, cross: 0 }, { x: x0, y: walkY(r) });
    } else {
      segs.push({ x: x0, y: blockY(w.r) + 1.5 }, { x: x0, y: walkY(r), cross: 0 });
    }
    let t = 0;
    let back = false;
    const anim = this.time.addEvent({
      delay: 180,
      loop: true,
      callback: () => w.sprite.setFrame(String((back ? 3 : 0) + 1 + (t++ % 2))),
    });
    const step = (k: number) => {
      if (!w.sprite.active) return anim.remove();
      if (k >= segs.length) {
        anim.remove();
        w.sprite.setFrame(back ? '3' : '0');
        w.c = c;
        w.r = r;
        this.time.delayedCall(500 + Math.random() * 4000, () => this.wander(w));
        return;
      }
      const sg = segs[k];
      const go = () => {
        const dx = sg.x - w.p.x;
        const dy = sg.y - w.p.y;
        const dist = Math.abs(dx) + Math.abs(dy);
        const f = facing(dx, dy);
        back = f.back;
        if (dist > 0.1) w.sprite.setFlipX(f.flip);
        this.tweens.add({ targets: w.p, x: sg.x, y: sg.y, duration: (dist / (WALK_SPEED * 0.6)) * 1000, onComplete: () => step(k + 1) });
      };
      if (sg.cross === undefined) return go();
      // cruza la avenida (1) cuando las calles tienen verde; la calle (0) cuando lo tienen las avenidas
      const now = this.time.now;
      const phase = Math.floor(now / SIGNAL_MS) % 2;
      const intoPhase = now % SIGNAL_MS;
      const ok = phase === sg.cross && intoPhase < SIGNAL_MS - 2200;
      if (ok) return go();
      w.sprite.setFrame(back ? '3' : '0');
      const wait = phase === sg.cross ? SIGNAL_MS - intoPhase + SIGNAL_MS : SIGNAL_MS - intoPhase;
      this.time.delayedCall(wait + 200 + Math.random() * 600, go);
    };
    step(0);
  }

  // ---------------------------------------------------------------- personaje

  private onModel(m: SceneModel, initial = false) {
    this.buildMap(m);
    this.syncExtras(m);
    this.syncMarkers(m);
    if (m.cheer !== this.cheerSeen) {
      if (this.cheerSeen && this.player?.visible && !this.walkTween) this.tweens.add({ targets: this.pw, z: 4, duration: 120, yoyo: true, repeat: 1, ease: 'Quad.easeOut' });
      this.cheerSeen = m.cheer;
    }
    this.syncOther(m);
    if (!m.role || !m.look) {
      this.walkTween?.stop();
      this.player?.destroy();
      this.player = null;
      this.ring.setVisible(false);
      this.marker.setVisible(false);
      this.highlightLabels(null);
      return;
    }
    this.highlightLabels(m.role);
    const key = this.ensureMini(m.look);
    if (!this.player) {
      const home = placeEntrance(PLACE_BY_ID[ROLE_PLACES[m.role].home]);
      this.pw = { x: home.x, y: home.y, z: 0 };
      this.player = this.add.sprite(0, 0, key, '0').setOrigin(0.5, 1).setScale(PEOPLE);
      this.world.add(this.player);
      initial = true;
    } else if (this.player.texture.key !== key && m.spot !== 'errand') {
      this.player.setTexture(key, '0');
    }

    if (initial || m.spot === 'away') {
      this.walkTween?.stop();
      this.spot = m.spot;
      this.errandDest = m.spot === 'errand' ? m.dest : null;
      this.place(m);
      if (m.spot === 'errand' && !m.dest) this.errandLoop(m);
      return;
    }
    if (m.spot === this.spot) return;
    const from = this.spot;
    this.spot = m.spot;
    const places = ROLE_PLACES[m.role];
    const home = PLACE_BY_ID[places.home];
    const work = PLACE_BY_ID[places.work];
    if (m.spot === 'work') {
      // Camina hasta su trabajo y entra por la puerta.
      this.walk(route(home, work), () => this.enterAt(work, () => this.place(bridge.get())));
    } else if (m.spot === 'home' && from === 'work') {
      this.exitAt(work, () => this.walk(route(work, home), () => this.place(bridge.get())));
    } else if (m.spot === 'errand' && m.dest) {
      const dest = destPlace(m.dest);
      this.errandDest = m.dest;
      this.walk(route(home, dest), () => this.enterAt(dest, () => this.place(bridge.get())), m.vehicle === 'auto' ? WALK_SPEED * 2 : WALK_SPEED);
    } else if (m.spot === 'errand') {
      this.errandDest = null;
      this.errandLoop(m);
    } else if (m.spot === 'home' && from === 'errand' && this.errandDest) {
      const dest = destPlace(this.errandDest);
      this.errandDest = null;
      this.exitAt(dest, () => this.walk(route(dest, home), () => this.place(bridge.get())));
    } else this.place(m);
  }

  /** Entra por la puerta: la puerta se ilumina y el personaje desaparece dentro. */
  private enterAt(p: Place, done: () => void) {
    const pl = this.player;
    if (!pl) return done();
    const e = placeEntrance(p);
    this.pw = { x: e.x, y: e.y - 0.5, z: 0 };
    pl.setFrame('3');
    this.doorFlash(e.x, e.y - 1.5);
    this.tweens.add({ targets: this.pw, y: e.y - 2.5, duration: 380, ease: 'Quad.easeIn' });
    this.tweens.add({ targets: pl, alpha: 0, duration: 380, ease: 'Quad.easeIn', onComplete: () => {
      pl.setVisible(false).setAlpha(1);
      done();
    } });
  }

  /** Sale por la puerta del sitio. */
  private exitAt(p: Place, done: () => void) {
    const pl = this.player;
    if (!pl) return done();
    this.marker.setVisible(false);
    const e = placeEntrance(p);
    this.doorFlash(e.x, e.y - 1.5);
    this.pw = { x: e.x, y: e.y - 2.5, z: 0 };
    pl.setVisible(true).setFrame('0').setAlpha(0);
    this.tweens.add({ targets: this.pw, y: e.y, duration: 380, ease: 'Quad.easeOut' });
    this.tweens.add({ targets: pl, alpha: 1, duration: 380, ease: 'Quad.easeOut', onComplete: done });
  }

  private doorFlash(x: number, y: number) {
    const s = iso(x, y);
    const d = this.add.image(s.x, s.y, 'door-light').setOrigin(0.5, 1).setBlendMode(Phaser.BlendModes.ADD).setDepth(depthAt(x, y) + 0.05).setAlpha(0);
    this.world.add(d);
    this.tweens.add({ targets: d, alpha: 1, duration: 160, yoyo: true, hold: 260, onComplete: () => d.destroy() });
  }

  /** Marca ▼ sobre el sitio donde está dentro el personaje. */
  private markAbove(p: Place) {
    const pt = this.above(p, 6);
    this.marker.setPosition(pt.x, pt.y).setVisible(true).setDepth(100001);
    this.tweens.killTweensOf(this.marker);
    this.tweens.add({ targets: this.marker, y: pt.y - 4, duration: 450, yoyo: true, repeat: -1 });
  }

  /** El otro protagonista pasea entre su casa y su trabajo, con su nombre encima. */
  private syncOther(m: SceneModel) {
    const o = m.other;
    const key = o ? `${o.name}-${lookKey(o.look)}` : '';
    if (key === this.otherKey) return;
    this.otherKey = key;
    this.otherSprite?.destroy();
    this.otherLabel?.destroy();
    this.otherSprite = null;
    this.otherLabel = null;
    if (!o || !m.role) return;
    const tex = this.ensureMini(o.look);
    const places = ROLE_PLACES[o.role];
    const start = placeEntrance(PLACE_BY_ID[places.work]);
    const pos: WP = { x: start.x, y: start.y };
    this.otherP = pos;
    const sprite = this.add.sprite(0, 0, tex, '0').setOrigin(0.5, 1).setScale(PEOPLE);
    const label = this.add
      .text(0, 0, o.name, { fontFamily: 'LC Body, sans-serif', fontSize: '5px', color: '#ffe066', stroke: '#14101f', strokeThickness: 2, resolution: 4 })
      .setOrigin(0.5, 1)
      .setDepth(99999);
    this.world.add([sprite, label]);
    this.otherSprite = sprite;
    this.otherLabel = label;
    let at: PlaceId = places.work;
    const loop = () => {
      if (this.otherSprite !== sprite) return;
      const to = at === places.work ? places.home : places.work;
      const pts = route(PLACE_BY_ID[at], PLACE_BY_ID[to]);
      at = to;
      const tweens = [];
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1];
        const b = pts[i];
        const dist = Math.abs(b.x - a.x) + Math.abs(b.y - a.y);
        if (dist > 0.5)
          tweens.push({
            x: b.x,
            y: b.y,
            duration: (dist / (WALK_SPEED * 0.7)) * 1000,
            onStart: () => {
              const f = facing(b.x - a.x, b.y - a.y);
              sprite.setFlipX(f.flip);
              sprite.setData('back', f.back);
            },
          });
      }
      let t = 0;
      const anim = this.time.addEvent({ delay: 180, loop: true, callback: () => sprite.setFrame(String((sprite.getData('back') ? 3 : 0) + 1 + (t++ % 2))) });
      this.tweens.chain({
        targets: pos,
        tweens,
        onComplete: () => {
          anim.remove();
          sprite.setFrame('0');
          this.time.delayedCall(8000 + Math.random() * 12000, loop);
        },
      });
    };
    this.time.delayedCall(2000, loop);
  }

  private highlightLabels(role: SceneModel['role']) {
    const mine = role ? ROLE_PLACES[role] : null;
    for (const t of this.labels) {
      const id = t.getData('place') as PlaceId;
      const p = PLACE_BY_ID[id];
      const prefix = mine?.home === id ? '⌂ ' : mine?.work === id ? '★ ' : '';
      t.setText(prefix + p.label.toUpperCase());
      t.setColor(prefix ? '#ffe066' : id === 'bolsa' ? '#7dffb0' : '#ffffff');
      t.setFontSize(prefix || id === 'bolsa' ? 7 : 6);
    }
  }

  private place(m: SceneModel) {
    const p = this.player;
    if (!p || !m.role) return;
    this.walkTween?.stop();
    p.setFrame('0').setAlpha(1);
    const places = ROLE_PLACES[m.role];
    this.marker.setVisible(false);
    if (m.spot === 'home') {
      const e = placeEntrance(PLACE_BY_ID[places.home]);
      this.pw = { x: e.x, y: e.y, z: 0 };
      p.setVisible(true);
    } else if (m.spot === 'work') {
      const e = placeEntrance(PLACE_BY_ID[places.work]);
      this.pw = { x: e.x, y: e.y, z: 0 };
      p.setVisible(false);
      this.markAbove(PLACE_BY_ID[places.work]);
    } else if (m.spot === 'errand' && m.dest) {
      const dest = destPlace(m.dest);
      const e = placeEntrance(dest);
      this.pw = { x: e.x, y: e.y, z: 0 };
      p.setVisible(false);
      this.markAbove(dest);
    } else if (m.spot === 'away') {
      p.setVisible(false);
    }
  }

  private walk(points: { x: number; y: number }[], done: () => void, speed = WALK_SPEED) {
    const p = this.player!;
    this.walkTween?.stop();
    this.marker.setVisible(false);
    p.setVisible(true);
    this.pw = { x: points[0].x, y: points[0].y, z: 0 };
    const tweens = [];
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1];
      const b = points[i];
      const dist = Math.abs(b.x - a.x) + Math.abs(b.y - a.y);
      if (dist < 0.5) continue;
      tweens.push({
        x: b.x,
        y: b.y,
        duration: (dist / speed) * 1000,
        onStart: () => {
          const f = facing(b.x - a.x, b.y - a.y);
          this.facingBack = f.back;
          p.setFlipX(f.flip);
        },
      });
    }
    if (!tweens.length) return done();
    this.walkTween = this.tweens.chain({ targets: this.pw, tweens, onComplete: () => {
      this.walkTween = null;
      done();
    } });
  }

  /** Reparto: el personaje recorre la ciudad de un lugar a otro hasta volver. */
  private errandLoop(m: SceneModel) {
    if (!this.player || !m.role) return;
    const ids = PLACES_MAP.map((p) => p.id);
    const go = (from: PlaceId) => {
      if (bridge.get().spot !== 'errand') return;
      let to = ids[Math.floor(Math.random() * ids.length)];
      if (to === from) to = ids[(ids.indexOf(to) + 1) % ids.length];
      const speed = bridge.get().vehicle === 'auto' ? WALK_SPEED * 2.4 : WALK_SPEED * 1.3;
      this.walk(route(PLACE_BY_ID[from], PLACE_BY_ID[to]), () => go(to), speed);
    };
    go(ROLE_PLACES[m.role].home);
  }

  // ---------------------------------------------------------------- entrada: arrastrar, pellizcar, tocar

  private setupInput() {
    this.input.addPointer(1);
    const cam = this.cameras.main;
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      const pts = this.input.manager.pointers.filter((q) => q.isDown);
      if (pts.length >= 2) {
        this.pinch = { d: Phaser.Math.Distance.Between(pts[0].x, pts[0].y, pts[1].x, pts[1].y), zoom: cam.zoom };
        this.drag = null;
        return;
      }
      this.drag = { x: p.x, y: p.y, sx: cam.scrollX, sy: cam.scrollY, moved: false };
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      const pts = this.input.manager.pointers.filter((q) => q.isDown);
      if (this.pinch && pts.length >= 2) {
        const d = Phaser.Math.Distance.Between(pts[0].x, pts[0].y, pts[1].x, pts[1].y);
        this.setZoom((this.pinch.zoom * d) / Math.max(1, this.pinch.d));
        return;
      }
      if (!this.drag || !p.isDown) return;
      const dx = p.x - this.drag.x;
      const dy = p.y - this.drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 4) this.drag.moved = true;
      if (this.drag.moved) {
        cam.setScroll(this.drag.sx - dx / cam.zoom, this.drag.sy - dy / cam.zoom);
        this.userPannedAt = this.time.now;
      }
    });
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (this.pinch) {
        if (!this.input.manager.pointers.some((q) => q.isDown)) this.pinch = null;
        return;
      }
      if (this.drag && !this.drag.moved) this.tapAt(p.worldX, p.worldY);
      this.drag = null;
    });
    this.input.on('wheel', (_p: unknown, _o: unknown, _dx: number, dy: number) => this.setZoom(cam.zoom * (dy > 0 ? 0.85 : 1.18)));
  }

  private setZoom(z: number) {
    this.cameras.main.setZoom(Phaser.Math.Clamp(z, minZoom(), maxZoom()));
    this.applyBounds();
    this.userPannedAt = this.time.now;
  }

  /**
   * Toque: se busca qué volumen (huella × altura) hay bajo el dedo; si hay
   * varios, gana el que está más cerca de la cámara (más al sur y al este).
   */
  private tapAt(sx: number, sy: number) {
    type Hit = { id: Parameters<typeof bridge.tap>[0]; front: number; prio: number };
    const hits: Hit[] = [];
    const test = (r: { x: number; y: number; w: number; h: number }, H: number, id: Hit['id'], prio = 0) => {
      if (prismHit(sx, sy, r, H)) hits.push({ id, front: r.x + r.w + r.y + r.h, prio });
    };
    const special = new Set<string>();
    for (const p of PLACES_MAP) {
      test(placeRect(p), placeHeight(p, this.heights), p.id, 1);
      for (let c = p.c; c < p.c + (p.cw ?? 1); c++) for (let r = p.r; r < p.r + (p.rh ?? 1); r++) special.add(`${c},${r}`);
    }
    for (const mg of MEGA) {
      if ('place' in mg.site) continue;
      const pl = { id: 'plaza' as const, label: '', c: mg.site.c, r: mg.site.r, cw: mg.site.cw, rh: mg.site.rh };
      test(placeRect(pl), placeHeight(pl, this.heights), `mega:${mg.id}`, 1);
      for (let c = mg.site.c; c < mg.site.c + mg.site.cw; c++) for (let r = mg.site.r; r < mg.site.r + mg.site.rh; r++) special.add(`${c},${r}`);
    }
    for (let c = 0; c < COLS; c++)
      for (let r = 0; r < ROWS; r++) {
        if (special.has(`${c},${r}`)) continue;
        const H = this.heights[`${c},${r}`] ?? 8;
        const lot = LOTS.find((l) => l.c === c && l.r === r);
        if (lot) test(lotRect(lot), H, `lot:${lot.id}`, 1);
        test({ x: blockX(c), y: blockY(r), w: BLOCK_W, h: BLOCK_H }, H, `block:${c},${r}`);
      }
    if (!hits.length) return;
    // el más cercano; a igualdad, el solar antes que la manzana
    hits.sort((a, b) => b.front - a.front || b.prio - a.prio);
    const best = hits[0];
    const same = hits.find((h) => Math.abs(h.front - best.front) < 60 && h.prio > best.prio && String(h.id).startsWith('lot:') && String(best.id).startsWith('block:'));
    bridge.tap((same ?? best).id);
  }

  // ---------------------------------------------------------------- luz y clima

  private updateLight(force = false) {
    const now = bridge.get().now();
    if (!force && Math.abs(now - this.lastLightAt) < 1000) return;
    this.lastLightAt = now;
    const l = (this.light = lightAt(now));
    const w = bridge.get().weather;
    let ambient = l.ambient;
    if (w === 'lluvia' || w === 'tormenta' || w === 'nublado') {
      // Cielo cubierto: más oscuro y azulado (sustituye al velo a pantalla completa).
      const k = w === 'nublado' ? [0.86, 0.87, 0.92] : w === 'tormenta' ? [0.68, 0.73, 0.86] : [0.74, 0.79, 0.92];
      ambient = Phaser.Display.Color.GetColor(((ambient >> 16) & 255) * k[0], ((ambient >> 8) & 255) * k[1], (ambient & 255) * k[2]);
    }
    for (const b of this.bases) b.setTint(ambient);
    this.bakeWeather(w === 'nieve', w === 'lluvia' || w === 'tormenta');
    // cielo de fondo: azul de día, malva al atardecer y noche cerrada
    const d = new Date(now);
    const h = d.getHours() + d.getMinutes() / 60;
    const dusk = Math.max(0, 1 - Math.abs(h - 6.6) / 1.6, 1 - Math.abs(h - 19.2) / 1.8);
    const mix = (c1: number, c2: number, t: number) => {
      const a = Phaser.Display.Color.IntegerToColor(c1);
      const b = Phaser.Display.Color.IntegerToColor(c2);
      return Phaser.Display.Color.GetColor(a.red + (b.red - a.red) * t, a.green + (b.green - a.green) * t, a.blue + (b.blue - a.blue) * t);
    };
    // el mar que rodea las islas es el fondo de la cámara (sin capa extra que pintar)
    let sea = mix(w === 'despejado' ? 0x2f6a9a : 0x3a5a76, 0x0a1428, Phaser.Math.Clamp(l.night, 0, 1));
    sea = mix(sea, 0x5a4a7a, dusk * 0.45);
    this.cameras.main.setBackgroundColor(sea);
    const nightA = Math.max(0, (l.night - 0.1) / 0.9);
    // Las ventanas se encienden escalonadas al anochecer: primero el norte, luego el sur.
    for (const li of this.lightImgs) {
      const frac = li.y / ISO_H;
      const stag = Phaser.Math.Clamp((l.night - 0.08 - frac * 0.18) / 0.74, 0, 1);
      li.setAlpha(Math.max(stag, w === 'tormenta' ? 0.35 : 0));
    }
    for (const c of this.cars) {
      c.img.setTint(ambient);
      c.light.setAlpha(nightA * 0.7);
    }
    for (const wk of this.walkers) {
      wk.sprite.setTint(ambient);
      if (wk.night) wk.sprite.setVisible(l.night > 0.5);
    }
    for (const b of this.boats) b.img.setTint(ambient);
    for (const pg of this.pigeons) pg.img.setTint(ambient);
    this.pet?.setTint(ambient);
    for (const mm of this.machines) mm.setTint(ambient);
    if (this.player) {
      const lift = (v: number) => Math.min(255, v + 50);
      this.player.setTint(Phaser.Display.Color.GetColor(lift((ambient >> 16) & 255), lift((ambient >> 8) & 255), lift(ambient & 255)));
    }
  }

  /**
   * Lluvia y nieve en una cámara aparte, a tamaño de pantalla. Se adaptan
   * al zoom: de cerca, gotas y copos grandes y pocos; de lejos, pequeños,
   * más numerosos y más lentos (están más lejos). Con lluvia, salpicaduras
   * en el suelo; con tormenta, más viento.
   */
  private drawWeather(delta: number) {
    const w = bridge.get().weather;
    const W = this.scale.width;
    const H = this.scale.height;
    const k = Phaser.Math.Clamp(this.cameras.main.zoom / RES, 0.55, 2.2);
    const rain = w === 'lluvia' || w === 'tormenta';
    const snow = w === 'nieve';
    const size = `${W}x${H}`;
    if (w !== this.weatherShown || Math.abs(k - this.weatherZoom) > 0.18 || size !== this.weatherSize) {
      this.weatherShown = w;
      this.weatherZoom = k;
      this.weatherSize = size;
      this.drops = [];
      this.ripples = [];
      // tamaño de cada gota en pantalla: resolución × zoom, redondeado a un atlas ya dibujado
      const sc = Phaser.Math.Clamp(Math.round(RES * Math.max(0.75, Math.sqrt(k))), 1, 4);
      const key = `fx-drops-${sc}`;
      if (this.precip.texture.key !== key) {
        // el Blitter no cambia de textura: se crea otro con la del tamaño nuevo
        this.precip.destroy();
        this.precip = this.add.blitter(0, 0, key).setDepth(10);
        this.cameras.main.ignore(this.precip);
      } else this.precip.clear();
      const base = w === 'tormenta' ? 150 : snow ? 100 : w === 'lluvia' ? 100 : 0;
      const n = Math.round(base * Phaser.Math.Clamp(1.25 / k, 0.9, 1.7) * (this.low ? 0.6 : 1));
      for (let i = 0; i < n; i++) {
        const sp = 0.6 + Math.random() * 0.8;
        const frame = snow ? (sp > 1.1 ? 'snow' : 'snow-s') : sp > 1 ? 'rain' : 'rain-far';
        this.drops.push({ bob: this.precip.create(Math.random() * W, Math.random() * H, frame), s: sp });
      }
      if (rain && !this.low) for (let i = 0; i < Math.round(26 / Math.sqrt(k)); i++) this.ripples.push(this.precip.create(-10, -10, 'ripple'));
      this.precip.setVisible(n > 0);
      // La cámara del clima solo trabaja si hay algo que dibujar.
      this.uiCam.setVisible(n > 0 || w === 'tormenta');
      this.lastLightAt = 0;
    }
    if (this.drops.length) {
      // todo en píxeles de la pantalla del juego (el Blitter va a escala 1)
      const sc = Number(this.precip.texture.key.slice(-1));
      const vw = W;
      const vh = H;
      // de lejos todo cae más despacio en pantalla; la tormenta trae viento
      const fall = Math.sqrt(k);
      const wind = w === 'tormenta' ? 0.11 : 0.05;
      const gust = snow ? Math.sin(this.time.now / 2300) * 0.012 : 0;
      for (const d of this.drops) {
        const b = d.bob;
        if (snow) {
          b.y += delta * 0.014 * d.s * fall * sc;
          b.x += (Math.sin((b.y / sc + d.s * 100) / 18) * 0.2 + delta * gust) * sc;
        } else {
          b.y += delta * 0.24 * d.s * fall * sc;
          b.x -= delta * wind * d.s * fall * sc;
        }
        if (b.y > vh) {
          b.y = -8 * sc;
          b.x = Math.random() * (vw + 40 * sc);
        }
        if (b.x < -6 * sc) b.x = vw + 4 * sc;
        if (b.x > vw + 6 * sc) b.x = -4 * sc;
      }
      // salpicaduras: aparecen un instante en sitios al azar (solo en la mitad de abajo de la vista)
      for (const r of this.ripples) {
        if (Math.random() < 0.08) {
          r.x = Math.random() * vw;
          r.y = vh * (0.25 + Math.random() * 0.7);
          r.setAlpha(1);
        } else r.setAlpha(Math.max(0, r.alpha - delta * 0.004));
      }
    }
    // relámpagos
    if (w === 'tormenta' && this.time.now > this.nextLightning) {
      this.nextLightning = this.time.now + 5000 + Math.random() * 9000;
      this.flash.setFillStyle(0xffffff, 0.75).setVisible(true);
      thunder(0.3 + Math.random() * 0.8);
      this.tweens.add({ targets: this.flash, fillAlpha: 0, duration: 450, ease: 'Expo.Out', onComplete: () => this.flash.setVisible(false) });
    }
    // sombras de nubes que cruzan la ciudad de día
    const day = this.light.night < 0.5 && !this.low;
    const t = this.time.now / 1000;
    this.clouds.forEach((c, i) => {
      c.setVisible(day);
      if (!day) return;
      c.setAlpha(w === 'despejado' ? 0.08 : 0.14);
      c.setPosition(((t * 4 + i * 420) % (ISO_W + 300)) - 150, PAD + 200 + ((i * 233) % (ISO_H - 300)));
    });
  }

  /** La mascota va detrás del personaje, con un poco de retraso. */
  private followPet(delta: number) {
    const p = this.player!;
    const pet = this.pet!;
    const pp = this.petP;
    pet.setVisible(p.visible);
    if (!p.visible) return;
    if (!pp.x && !pp.y) {
      pp.x = this.pw.x - 6;
      pp.y = this.pw.y;
    }
    const last = this.petTrail[this.petTrail.length - 1];
    if (!last || Math.abs(last.x - this.pw.x) + Math.abs(last.y - this.pw.y) > 0.5) this.petTrail.push({ x: this.pw.x, y: this.pw.y });
    const target = this.petTrail.length > 14 ? this.petTrail.shift()! : this.petTrail[0] ?? { x: this.pw.x, y: this.pw.y };
    const tx = this.walkTween ? target.x : this.pw.x - 6;
    const ty = this.walkTween ? target.y : this.pw.y;
    const k = Math.min(1, delta * 0.01);
    const moving = Math.abs(tx - pp.x) + Math.abs(ty - pp.y) > 0.3;
    if (moving) pet.setFlipX(facing(tx - pp.x, ty - pp.y).flip);
    pp.x += (tx - pp.x) * k;
    pp.y += (ty - pp.y) * k;
    this.put(pet, pp, 0.25);
    if (moving && Math.floor(this.time.now / 140) % 2) pet.setFrame('1');
    else pet.setFrame('0');
  }

  /** Si el móvil no llega a ~40 fps, quita adornos: nubes, la mitad de peatones y coches, y efectos de la interfaz. */
  private checkPerf(delta: number) {
    if (this.low) return;
    const p = this.perf;
    p.warm += delta;
    if (p.warm < 6000 || document.visibilityState !== 'visible') return;
    p.t += delta;
    p.frames++;
    if (p.t < 4000) return;
    const fps = (p.frames * 1000) / p.t;
    p.slow = fps < 40 ? p.slow + 1 : 0;
    p.t = 0;
    p.frames = 0;
    if (p.slow >= 2) this.lowQuality();
  }

  private lowQuality() {
    this.low = true;
    setLowFx(true);
    // Baja a resolución normal (cuatro veces menos píxeles que pintar).
    if (RES > 1) {
      const z = this.cameras.main.zoom / RES;
      RES = 1;
      this.scale.setGameSize(viewW(), viewHeight(this.game.canvas.parentElement ?? document.body));
      this.cameras.main.setZoom(Math.max(minZoom(), z));
      this.weatherShown = '';
      this.applyBounds();
    }
    for (const c of this.clouds) c.setVisible(false);
    for (const w of this.walkers.splice(this.walkers.length / 2)) {
      this.tweens.killTweensOf(w.p);
      w.sprite.destroy();
    }
    for (const c of this.cars.splice(this.cars.length * 0.6)) {
      c.img.destroy();
      c.light.destroy();
    }
  }

  update(time: number, delta: number) {
    this.checkPerf(delta);
    this.updateLight();
    this.cull();
    // remolcadores
    for (const b of this.boats) {
      b.p.y += b.dir * b.speed * (delta / 1000);
      if (b.p.y > BOAT_MAX) b.p.y = -10;
      if (b.p.y < -10) b.p.y = BOAT_MAX;
      this.put(b.img, b.p);
      // pasa por debajo del puente (se esconde) y se desvanece en los extremos
      const deck = stY(BRIDGE_STREET);
      const under = Phaser.Math.Clamp((Math.abs(b.p.y - deck) - 12) / 8, 0, 1);
      const ends = Phaser.Math.Clamp(Math.min(b.p.y + 10, BOAT_MAX - b.p.y) / 12, 0, 1);
      b.img.setAlpha(Math.min(under, ends));
    }
    // el minimapa sabe qué ve la cámara (4 veces por segundo)
    if (time - this.viewAt > 250) {
      this.viewAt = time;
      const v = this.cameras.main.worldView;
      bridge.publishView({ px: this.pw.x, py: this.pw.y, playerVisible: !!this.player?.visible, x: v.x, y: v.y, w: v.width, h: v.height });
    }
    this.drawWeather(delta);

    // tráfico, accidentes, aviones y peatones
    this.moveTraffic(delta / 1000, time);
    this.maybeAccident(time);
    this.moveAircraft(time, Math.min(0.1, delta / 1000));
    for (const wk of this.walkers) this.put(wk.sprite, wk.p);
    if (this.otherSprite && this.otherLabel) {
      this.put(this.otherSprite, this.otherP);
      this.otherLabel.setPosition(this.otherSprite.x, this.otherSprite.y - 12);
    }

    // el personaje: pasos, anillo, paraguas y mascota
    if (this.player) {
      const moving = !!this.walkTween;
      this.stepTimer += delta;
      if (moving && this.stepTimer > 160) {
        this.stepTimer = 0;
        this.stepFrame = this.stepFrame === 1 ? 2 : 1;
        this.player.setFrame(String((this.facingBack ? 3 : 0) + this.stepFrame));
      }
      if (!moving && this.player.frame.name !== '0' && this.player.frame.name !== '3') this.player.setFrame('0');
      this.put(this.player, this.pw, 0.5);
      const g = iso(this.pw.x, this.pw.y);
      this.ring.setVisible(this.player.visible).setPosition(g.x, g.y - 0.5);
      depthOf(this.ring, depthAt(this.pw.x, this.pw.y));
      if (this.pet) this.followPet(delta);
      const wx = bridge.get().weather;
      const rainy = (wx === 'lluvia' || wx === 'tormenta') && this.player.visible;
      this.umbrella.setVisible(rainy);
      if (rainy) {
        this.umbrella.setPosition(this.player.x, this.player.y - 10);
        depthOf(this.umbrella, depthAt(this.pw.x, this.pw.y) + 0.6);
      }
    }

    // cámara: sigue al personaje salvo que el jugador haya movido el mapa
    const cam = this.cameras.main;
    const m = bridge.get();
    if (!m.role) {
      this.drift += delta * 0.00008;
      // En la portada, la cámara pasea por la ciudad.
      const p = iso(MAP_W / 2 + Math.sin(this.drift) * (MAP_W / 2 - 170), MAP_H / 2 + Math.cos(this.drift * 0.7) * (MAP_H / 2 - 190), 40);
      cam.centerOn(p.x, p.y);
      return;
    }
    if (time - this.userPannedAt < 5000 || this.drag) return;
    let tx: number;
    let ty: number;
    if (this.player && this.player.visible) {
      tx = this.player.x;
      ty = this.player.y - 10;
    } else {
      const pt = this.above(PLACE_BY_ID[ROLE_PLACES[m.role].work], -10);
      tx = pt.x;
      ty = pt.y;
    }
    const cx = cam.midPoint.x + (tx - cam.midPoint.x) * Math.min(1, delta * 0.004);
    const cy = cam.midPoint.y + (ty - cam.midPoint.y) * Math.min(1, delta * 0.004);
    cam.centerOn(cx, cy);
  }
}

const LOWFX_KEY = 'laciudad.lowfx';
export function lowFx(): boolean {
  try {
    return localStorage.getItem(LOWFX_KEY) === '1';
  } catch {
    return false;
  }
}
export function setLowFx(on: boolean) {
  document.documentElement.classList.toggle('lowfx', on);
  try {
    if (on) localStorage.setItem(LOWFX_KEY, '1');
    else localStorage.removeItem(LOWFX_KEY);
  } catch {
    /* sin almacenamiento */
  }
}

/** Alto lógico según la proporción del contenedor (pantalla del móvil). */
export function viewHeight(parent: HTMLElement): number {
  const ratio = parent.clientHeight / Math.max(1, parent.clientWidth);
  return Math.round(Math.max(260 * RES, Math.min(700 * RES, viewW() * ratio)));
}

export function createGame(parent: HTMLElement): Phaser.Game {
  if (lowFx()) document.documentElement.classList.add('lowfx');
  RES = lowFx() ? 1 : 2;
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: viewW(),
    height: viewHeight(parent),
    pixelArt: true,
    backgroundColor: '#120c24',
    render: { antialias: false, roundPixels: true, powerPreference: 'high-performance', batchSize: 4096 },
    fps: { target: 60, smoothStep: true },
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: [CityScene],
    banner: false,
    audio: { noAudio: true },
    input: { activePointers: 3 },
  });
  window.addEventListener('resize', () => game.scale.setGameSize(viewW(), viewHeight(parent)));
  return game;
}
