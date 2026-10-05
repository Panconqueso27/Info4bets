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
import { thunder } from '../platform/audio';
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
    this.precip = this.add.blitter(0, 0, 'fx-drops').setVisible(false);
    this.flash = this.add.rectangle(0, 0, 10, 10, 0xffffff, 0).setOrigin(0).setVisible(false);
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

    if (import.meta.env.DEV) (window as any).__city = this;
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
    const dc = document.createElement('canvas');
    dc.width = 16;
    dc.height = 8;
    const d = dc.getContext('2d')!;
    d.fillStyle = 'rgba(207,230,255,0.75)';
    d.fillRect(0, 0, 1, 7);
    d.fillStyle = 'rgba(207,230,255,0.35)';
    d.fillRect(1, 5, 1, 3);
    d.fillStyle = 'rgba(207,230,255,0.45)';
    d.fillRect(4, 0, 1, 5);
    d.fillStyle = 'rgba(255,255,255,0.95)';
    d.fillRect(8, 0, 3, 3);
    d.fillStyle = 'rgba(191,216,255,0.6)';
    d.fillRect(11, 1, 1, 1);
    d.fillStyle = 'rgba(255,255,255,0.95)';
    d.fillRect(13, 0, 2, 2);
    const dt = this.textures.addCanvas('fx-drops', dc)!;
    dt.add('rain', 0, 0, 0, 2, 8);
    dt.add('rain-far', 0, 4, 0, 1, 5);
    dt.add('snow', 0, 8, 0, 4, 3);
    dt.add('snow-s', 0, 13, 0, 2, 2);
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
      c.pos = next;
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
      }
      if (!vis) continue;
      c.img.setPosition(s.x, s.y);
      depthOf(c.img, depthAt(wx, wy));
      depthOf(c.light, c.img.depth + 0.05);
      const hx = c.axis === 'h' ? wx + c.dir * 9 : wx;
      const hy = c.axis === 'v' ? wy + c.dir * 9 : wy;
      const hs = iso(hx, hy, 1);
      c.light.setPosition(hs.x, hs.y);
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

  private drawWeather(delta: number) {
    const w = bridge.get().weather;
    const W = this.scale.width;
    const H = this.scale.height;
    if (w !== this.weatherShown) {
      this.weatherShown = w;
      this.precip.clear();
      this.drops = [];
      // las gotas se dibujan a escala 2 (la vista tiene el doble de resolución)
      this.precip.setScale(RES);
      const snow = w === 'nieve';
      const n = w === 'tormenta' ? 140 : snow ? 90 : w === 'lluvia' ? 95 : 0;
      for (let i = 0; i < (this.low ? n / 2 : n); i++) {
        const s = 0.6 + Math.random() * 0.8;
        const frame = snow ? (s > 1.1 ? 'snow' : 'snow-s') : s > 1 ? 'rain' : 'rain-far';
        this.drops.push({ bob: this.precip.create((Math.random() * W) / RES, (Math.random() * H) / RES, frame), s });
      }
      this.precip.setVisible(n > 0);
      // La cámara del clima solo trabaja si hay algo que dibujar.
      this.uiCam.setVisible(n > 0 || w === 'tormenta');
      this.lastLightAt = 0;
    }
    if (this.drops.length) {
      const snow = w === 'nieve';
      for (const d of this.drops) {
        const b = d.bob;
        if (snow) {
          b.y += delta * 0.012 * d.s;
          b.x += Math.sin((b.y + d.s * 100) / 18) * 0.2;
        } else {
          b.y += delta * 0.22 * d.s;
          b.x -= delta * 0.05 * d.s;
        }
        if (b.y > H / RES) {
          b.y = -8;
          b.x = Math.random() * (W / RES + 30);
        }
        if (b.x < -4) b.x = W / RES;
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

    // tráfico y peatones
    this.moveTraffic(delta / 1000, time);
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
