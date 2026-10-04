import Phaser from 'phaser';
import {
  aveX,
  AVES,
  BRIDGE_STREET,
  MANHATTAN_COLS,
  RIVER_X,
  RIVER_W,
  streetSpan,
  COLS,
  generateCityMap,
  BLOCK_H,
  BLOCK_W,
  blockX,
  blockY,
  lotRect,
  placeBounds,
  AVE_W,
  ST_H,
  MAP_H,
  MAP_W,
  PLACE_BY_ID,
  placeEntrance,
  placeRect,
  PLACES_MAP,
  ROLE_PLACES,
  route,
  ROWS,
  stY,
  walkX,
  walkY,
  type PlaceId,
} from '../art/cityMap';
import { lightAt, type Light } from '../art/daynight';
import { CAR_COLORS, drawCarFront, drawCarSide, drawMini, MINI_H, MINI_W } from '../art/sprites';
import { mulberry32 } from '../core/rng';
import { LOTS } from '../core/lots';
import { districtOf } from '../core/city';
import type { Look } from '../core/types';
import { randomLook } from '../art/character';
import { bridge, type SceneModel, type Spot } from './bridge';
import { drawPet, drawVending } from '../art/sprites';
import { thunder } from '../platform/audio';
import { drawIcon } from '../art/icons';
import { MEGA } from '../core/lots';

/** Cambia la profundidad solo si varía: cada cambio obliga a reordenar la capa. */
function depthOf(o: Phaser.GameObjects.Components.Depth & { depth: number }, d: number) {
  const v = Math.round(d * 2) / 2;
  if (o.depth !== v) o.setDepth(v);
}

/** Ancho lógico de la vista: la ciudad se ve en vertical, como en un móvil. */
export const VIEW_W = 180;
const WALK_SPEED = 20;
const MIN_ZOOM = 1;
const MAX_ZOOM = 3;

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
  /** Tramo por el que circula (las calles no cruzan el río salvo la del puente). */
  min: number;
  max: number;
  /** Cruces de su recorrido (para los semáforos). */
  cross: number[];
}

/** Ciclo de semáforos: avenidas y calles se alternan. */
const SIGNAL_MS = 7000;

interface Walker {
  sprite: Phaser.GameObjects.Sprite;
  c: number;
  r: number;
  /** Solo pasea por esta zona (gente de Times Square de noche). */
  zone?: [number, number, number, number];
  /** Solo sale de noche. */
  night?: boolean;
}

export class CityScene extends Phaser.Scene {
  private world!: Phaser.GameObjects.Layer;
  /** Imágenes del mapa por tipo: se tiñen o se encienden según la hora. */
  private bases: Phaser.GameObjects.Image[] = [];
  private lightImgs: Phaser.GameObjects.Image[] = [];
  private neons: Phaser.GameObjects.Image[] = [];
  private tops: Record<string, number> = {};
  private signals!: Phaser.GameObjects.Graphics;
  private signalPhase = -1;
  private clouds: Phaser.GameObjects.Image[] = [];
  // Gotas y copos: un único Blitter (un solo lote de dibujo y solo los píxeles de cada gota).
  // Nada de capas a pantalla completa: en móviles modestos el coste es el relleno de píxeles.
  private precip!: Phaser.GameObjects.Blitter;
  private drops: { bob: Phaser.GameObjects.Bob; s: number }[] = [];
  private weatherShown = '';
  private mapSig = '\u0000';
  private mapImgs: Phaser.GameObjects.Image[] = [];
  /** Lienzos de cada capa del mapa, para hornear la nieve en la base. */
  private mapSets: { key: string; base: HTMLCanvasElement; snow: HTMLCanvasElement; wet?: HTMLCanvasElement; img: Phaser.GameObjects.Image }[] = [];
  private bakedMode = '';
  /** Trozos del mapa (Manhattan y Brooklyn): solo se dibujan los que ve la cámara. */
  private chunks: { x0: number; x1: number; imgs: Phaser.GameObjects.Image[]; row: number }[] = [];
  private cullX = -1;
  private umbrella!: Phaser.GameObjects.Image;
  private boats: { img: Phaser.GameObjects.Image; dir: number; speed: number }[] = [];
  private steams: Phaser.GameObjects.Image[] = [];
  private markerIcons: Phaser.GameObjects.Image[] = [];
  private markerKey = '';
  private cheerSeen = 0;
  private viewAt = 0;
  private pet: Phaser.GameObjects.Sprite | null = null;
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
  private otherLabel: Phaser.GameObjects.Text | null = null;
  private otherKey = '';
  private player: Phaser.GameObjects.Sprite | null = null;
  private ring!: Phaser.GameObjects.Ellipse;
  private marker!: Phaser.GameObjects.Text;
  private labels: Phaser.GameObjects.Text[] = [];
  private spot: Spot = 'home';
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

    // El mapa: suelo abajo y una capa por fila de manzanas, ordenadas por profundidad
    // para que los edificios tapen a lo que pasa por detrás.
    this.world = this.add.layer();
    this.buildMap(bridge.get());
    this.signals = this.add.graphics().setDepth(-50);
    this.world.add(this.signals);

    this.spawnTraffic();
    this.spawnPedestrians();
    this.spawnLife();

    this.ring = this.add.ellipse(0, 0, 12, 5).setDepth(0).setStrokeStyle(1, 0xffe066).setFillStyle(0xffe066, 0.18).setVisible(false);
    this.world.add(this.ring);
    this.tweens.add({ targets: this.ring, scaleX: 1.35, scaleY: 1.35, alpha: 0.4, duration: 700, yoyo: true, repeat: -1 });
    this.marker = this.add
      .text(0, 0, '▼', { fontFamily: 'LC Display, sans-serif', fontSize: '10px', color: '#ffe066', stroke: '#000', strokeThickness: 3, resolution: 3 })
      .setOrigin(0.5, 1)
      .setVisible(false);
    this.world.add(this.marker);
    this.makeLabels();

    // Nubes (sombras que pasan de día) y clima, en una cámara aparte sin zoom.
    // Todo son imágenes precalculadas que solo se desplazan: nada se redibuja por fotograma.
    for (let i = 0; i < 4; i++) {
      const c = this.add.image(0, 0, 'cloud').setDepth(200000).setVisible(false);
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
    cam.setZoom(1);
    this.applyBounds();
    cam.centerOn(MAP_W / 2, MAP_H / 2);
    this.scale.on('resize', () => this.applyBounds());
    this.setupInput();
    bridge.onFocus((x, y) => {
      this.userPannedAt = this.time.now;
      this.cameras.main.pan(x, y, 450, 'Sine.easeInOut');
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
    const top = 150 / 2.2 / zoom;
    const bottom = 230 / 2.2 / zoom;
    cam.setBounds(-8, -top, MAP_W + 16, MAP_H + top + bottom);
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
        const side = document.createElement('canvas');
        side.width = 10;
        side.height = 7;
        drawCarSide(side.getContext('2d')!, color, 0, 1, police);
        this.textures.addCanvas(`car-side-${police ? 'p' : i}`, side);
        const front = document.createElement('canvas');
        front.width = 6;
        front.height = 8;
        drawCarFront(front.getContext('2d')!, color, 0, 0, police);
        this.textures.addCanvas(`car-front-${police ? 'p' : i}`, front);
      }
    });
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
    tex('tugboat', 8, 14, (ctx) => {
      ctx.fillStyle = 'rgba(220,235,255,0.5)';
      ctx.fillRect(2, 13, 4, 1);
      ctx.fillStyle = '#c0392b';
      ctx.fillRect(1, 2, 6, 11);
      ctx.fillRect(2, 1, 4, 1);
      ctx.fillStyle = '#f4efe2';
      ctx.fillRect(2, 5, 4, 4);
      ctx.fillStyle = '#14101f';
      ctx.fillRect(3, 3, 2, 2);
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
    this.mapImgs = [];
    this.mapSets = [];
    this.bakedMode = '-';
    this.bases = [];
    this.lightImgs = [];
    this.neons = [];
    const art = generateCityMap(1985, m.city);
    this.tops = art.tops;
    this.chunks = [];
    const addSet = (key: string, set: { base: HTMLCanvasElement; lights: HTMLCanvasElement; neon: HTMLCanvasElement; snow: HTMLCanvasElement; wet?: HTMLCanvasElement }, x: number, y: number, depth: number) => {
      for (const kind of ['base', 'lights', 'neon'] as const) {
        if (this.textures.exists(`${key}-${kind}`)) this.textures.remove(`${key}-${kind}`);
        this.textures.addCanvas(`${key}-${kind}`, set[kind]);
      }
      for (const v of ['s', 'w', 'sw']) if (this.textures.exists(`${key}-v${v}`)) this.textures.remove(`${key}-v${v}`);
      const base = this.add.image(x, y, `${key}-base`).setOrigin(0).setDepth(depth);
      this.mapSets.push({ key, base: set.base, snow: set.snow, wet: set.wet, img: base });
      const lights = this.add.image(x, y, `${key}-lights`).setOrigin(0).setDepth(depth + 0.02).setBlendMode(Phaser.BlendModes.ADD);
      const neon = this.add.image(x, y, `${key}-neon`).setOrigin(0).setDepth(depth + 0.03).setBlendMode(Phaser.BlendModes.ADD);
      const imgs = [base, lights, neon];
      this.bases.push(base);
      this.lightImgs.push(lights);
      this.neons.push(neon);
      this.mapImgs.push(...imgs);
      this.world.add(imgs);
      this.chunks.push({ x0: x, x1: x + set.base.width, imgs, row: depth });
    };
    art.grounds.forEach((g, i) => addSet(`map-ground${i}`, g, g.x, 0, -100));
    art.rows.forEach((r, i) => addSet(`map-row${i}`, r, r.x, r.y, r.depth));
    this.cullX = -1;
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
      const variant = `${snow ? 's' : ''}${useWet ? 'w' : ''}`;
      if (!variant) {
        m.img.setTexture(`${m.key}-base`);
        continue;
      }
      const key = `${m.key}-v${variant}`;
      if (!this.textures.exists(key)) {
        const c = document.createElement('canvas');
        c.width = m.base.width;
        c.height = m.base.height;
        const ctx = c.getContext('2d')!;
        ctx.drawImage(m.base, 0, 0);
        if (useWet) ctx.drawImage(m.wet!, 0, 0);
        if (snow) {
          ctx.globalAlpha = 0.85;
          ctx.drawImage(m.snow, 0, 0);
        }
        this.textures.addCanvas(key, c);
      }
      m.img.setTexture(key);
    }
  }

  private repositionLabels() {
    for (const t of this.labels) {
      const r = placeBounds(PLACE_BY_ID[t.getData('place') as PlaceId], this.tops);
      t.setPosition(r.x + r.w / 2, r.y - 1);
    }
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
      }
    }
    const n = m.role === 'inmigrante' ? Math.min(5, m.vending) : 0;
    if (n !== this.machines.length) {
      for (const mm of this.machines) mm.destroy();
      this.machines = [];
      const spots: PlaceId[] = ['diner', 'casa', 'bar', 'pizza', 'hotel'];
      for (let i = 0; i < n; i++) {
        const e = placeEntrance(PLACE_BY_ID[spots[i]]);
        const img = this.add.image(e.x + 9, e.y - 1, 'vending').setOrigin(0.5, 1).setDepth(e.y - 0.6);
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
      const px = park.x + 20 + rand() * (park.w - 40);
      const py = park.y + 20 + rand() * (park.h - 40);
      const pg = this.add.image(px, py, 'pigeon').setOrigin(0.5, 1).setDepth(py);
      this.world.add(pg);
      const hop = () => {
        if (!pg.active) return;
        const nx = Phaser.Math.Clamp(pg.x + (Math.random() - 0.5) * 16, park.x + 8, park.x + park.w - 8);
        const ny = Phaser.Math.Clamp(pg.y + (Math.random() - 0.5) * 10, park.y + 8, park.y + park.h - 8);
        pg.setFlipX(nx < pg.x);
        this.tweens.add({ targets: pg, x: nx, y: ny, duration: 300, ease: 'Quad.easeOut', onComplete: () => { pg.setDepth(pg.y); this.time.delayedCall(800 + Math.random() * 3000, hop); } });
      };
      this.time.delayedCall(rand() * 2000, hop);
    }
    // vapor de alcantarilla
    for (let i = 0; i < (this.low ? 4 : 9); i++) {
      const sx = aveX(Math.floor(rand() * AVES)) - 4 + rand() * 8;
      const sy = stY(Math.floor(rand() * (ROWS + 1)));
      const st = this.add.image(sx, sy, 'steam').setOrigin(0.5, 1).setAlpha(0).setDepth(sy + 1);
      this.world.add(st);
      this.steams.push(st);
      this.tweens.add({ targets: st, y: sy - 10, alpha: { from: 0.55, to: 0 }, scale: { from: 0.6, to: 1.4 }, duration: 2200, delay: rand() * 2000, repeat: -1 });
    }
    // remolcadores en el East River
    for (let i = 0; i < 2; i++) {
      const dir = i ? -1 : 1;
      const bx = RIVER_X + (i ? RIVER_W - 18 : 18);
      const img = this.add.image(bx, rand() * MAP_H, 'tugboat').setOrigin(0.5, 0.5).setDepth(-60).setFlipY(dir < 0);
      this.world.add(img);
      this.boats.push({ img, dir, speed: 5 + rand() * 3 });
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
      let x = 0;
      let top = 0;
      if (mk.kind === 'lot') {
        const lot = LOTS.find((l) => l.id === mk.id);
        if (!lot) continue;
        const r = lotRect(lot);
        x = r.x + r.w / 2;
        top = Math.min(r.y, this.tops[`${lot.c},${lot.r}`] ?? r.y);
      } else if (mk.kind === 'place') {
        const p = PLACE_BY_ID[mk.id as PlaceId];
        if (!p) continue;
        const b = placeBounds(p, this.tops);
        x = b.x + b.w / 2;
        top = b.y - 8;
      } else {
        const mg = MEGA.find((q) => q.id === mk.id);
        if (!mg || 'place' in mg.site) continue;
        const b = placeRect({ id: 'plaza', label: '', c: mg.site.c, r: mg.site.r, cw: mg.site.cw, rh: mg.site.rh });
        x = b.x + b.w / 2;
        top = b.y;
      }
      const tex = `mk-${mk.icon}`;
      if (!this.textures.exists(tex)) continue;
      const ic = this.add.image(x, top - 6, tex).setOrigin(0.5, 1).setDepth(100002);
      this.world.add(ic);
      this.tweens.add({ targets: ic, y: top - 10, duration: 700 + Math.random() * 300, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      this.markerIcons.push(ic);
    }
  }

  /** Solo se dibujan los trozos del mapa que caen dentro de la cámara. */
  private cull() {
    const v = this.cameras.main.worldView;
    const key = Math.round(v.x / 8) * 10000 + Math.round(v.width / 8);
    if (key === this.cullX) return;
    this.cullX = key;
    for (const ch of this.chunks) {
      const vis = ch.x1 > v.x - 24 && ch.x0 < v.right + 24;
      for (const img of ch.imgs) img.setVisible(vis);
    }
  }

  private ensureMini(look: Look): string {
    const key = lookKey(look);
    if (this.textures.exists(key)) return key;
    const c = document.createElement('canvas');
    c.width = MINI_W * 6;
    c.height = MINI_H;
    const ctx = c.getContext('2d')!;
    for (let f = 0; f < 3; f++) {
      drawMini(ctx, look, f, f * MINI_W, 0);
      drawMini(ctx, look, f, (f + 3) * MINI_W, 0, true);
    }
    const tex = this.textures.addCanvas(key, c)!;
    for (let f = 0; f < 6; f++) tex.add(String(f), 0, f * MINI_W, 0, MINI_W, MINI_H);
    return key;
  }

  private makeLabels() {
    for (const p of PLACES_MAP) {
      const r = placeBounds(p, this.tops);
      const t = this.add
        .text(r.x + r.w / 2, r.y - 1, p.label.toUpperCase(), {
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
    const n = this.low ? 28 : 52;
    const aveCross = Array.from({ length: AVES }, (_, i) => aveX(i));
    const stCross = Array.from({ length: ROWS + 1 }, (_, j) => stY(j));
    for (let k = 0; k < n; k++) {
      const police = rand() < 0.07;
      // Nueva York: la mitad de los coches son taxis amarillos
      const ci = rand() < 0.5 ? 0 : Math.floor(rand() * CAR_COLORS.length);
      const axis: 'v' | 'h' = k % 2 === 0 ? 'v' : 'h';
      const dir: 1 | -1 = rand() < 0.5 ? 1 : -1;
      const speed = 16 + rand() * 14;
      let img: Phaser.GameObjects.Image;
      let lane: string;
      let min = -12;
      let max = MAP_H + 12;
      let cross = stCross;
      if (axis === 'v') {
        // Se conduce por la derecha: hacia el sur por el carril oeste, hacia el norte por el este.
        const i = Math.floor(rand() * AVES);
        img = this.add.image(aveX(i) + (dir > 0 ? -4 : 4), rand() * MAP_H, `car-front-${police ? 'p' : ci}`).setOrigin(0.5, 1);
        lane = `v${i}${dir}`;
      } else {
        const j = Math.floor(rand() * (ROWS + 1));
        const side = rand() < 0.5 ? 'manhattan' : 'brooklyn';
        const [x0, x1] = streetSpan(j, side);
        min = x0 - 12;
        max = x1 + 12;
        cross = aveCross.filter((x) => x > x0 && x < x1);
        img = this.add.image(x0 + rand() * (x1 - x0), stY(j) + (dir > 0 ? 5 : -1), `car-side-${police ? 'p' : ci}`).setOrigin(0.5, 1);
        img.setFlipX(dir < 0);
        lane = `h${j}${dir}${j === BRIDGE_STREET ? 'p' : side[0]}`;
      }
      const light = this.add.image(img.x, img.y, 'headlight').setBlendMode(Phaser.BlendModes.ADD).setAlpha(0).setDepth(99990);
      this.world.add([img, light]);
      this.cars.push({ img, light, axis, dir, lane, speed, len: axis === 'v' ? 8 : 10, min, max, cross });
    }
    // separar coches que hayan nacido encima de otros
    for (const c of this.cars)
      for (const o of this.cars)
        if (o !== c && o.lane === c.lane && Math.abs(this.along(o) - this.along(c)) < 14) this.setAlong(o, this.along(o) + 18 * o.dir);
  }

  private along(c: Car) {
    return c.axis === 'v' ? c.img.y : c.img.x;
  }

  private setAlong(c: Car, v: number) {
    if (c.axis === 'v') c.img.y = v;
    else c.img.x = v;
  }

  /** Mueve el tráfico: respeta semáforos y la distancia con el coche de delante. */
  private moveTraffic(dt: number, time: number) {
    const phase = Math.floor(time / SIGNAL_MS) % 2; // 0: avenidas en verde, 1: calles en verde
    const amber = time % SIGNAL_MS > SIGNAL_MS - 1200;
    if (phase !== this.signalPhase) this.drawSignals(phase);
    this.signalPhase = phase;
    const lanes = new Map<string, Car[]>();
    for (const c of this.cars) {
      const l = lanes.get(c.lane);
      if (l) l.push(c);
      else lanes.set(c.lane, [c]);
    }
    for (const c of this.cars) {
      const pos = this.along(c);
      // la parte delantera del coche
      const front = c.axis === 'v' ? (c.dir > 0 ? pos : pos - c.len) : pos + (c.dir * c.len) / 2;
      let next = pos + c.dir * c.speed * dt;
      const red = (c.axis === 'v' ? phase !== 0 : phase !== 1) || amber;
      if (red) {
        const half = (c.axis === 'v' ? ST_H : AVE_W) / 2 + 2;
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
        const gap = (this.along(o) - pos) * c.dir;
        if (gap > 0 && gap < c.len + 5) next = pos + c.dir * Math.max(0, gap - c.len - 5) * 0.5;
      }
      this.setAlong(c, next);
      if (next > c.max) this.setAlong(c, c.min);
      if (next < c.min) this.setAlong(c, c.max);
      depthOf(c.img, c.img.y);
      c.light.setPosition(c.img.x + (c.axis === 'h' ? c.dir * 9 : 0), c.img.y + (c.axis === 'v' ? (c.dir > 0 ? 6 : -14) : -3));
    }
  }

  /** Semáforos en las esquinas visibles de cada cruce (acera sur de la manzana de arriba). */
  private drawSignals(phase: number) {
    const g = this.signals;
    g.clear();
    for (let i = 0; i < AVES; i++)
      for (let j = 1; j <= ROWS; j++) {
        const x = aveX(i) + AVE_W / 2 + 1;
        const y = blockY(j - 1) + BLOCK_H - 2;
        if (x > MAP_W - 2 || (x > RIVER_X - 2 && x < RIVER_X + RIVER_W + 2)) continue;
        g.fillStyle(0x1a1a1f).fillRect(x, y - 7, 1, 7);
        g.fillStyle(0x1a1a1f).fillRect(x - 1, y - 9, 3, 3);
        g.fillStyle(phase === 0 ? 0x3dff7a : 0xff3b3b).fillRect(x, y - 8, 1, 1);
      }
  }

  private spawnPedestrians() {
    const rand = mulberry32(1985);
    const add = (c: number, r: number, extra: Partial<Walker> = {}) => {
      const look = randomLook(rand() < 0.5 ? 'inmigrante' : 'alcalde', rand);
      const key = this.ensureMini(look);
      const sprite = this.add.sprite(walkX(c), walkY(r), key, '0').setOrigin(0.5, 1);
      this.world.add(sprite);
      const w: Walker = { sprite, c, r, ...extra };
      this.walkers.push(w);
      this.time.delayedCall(rand() * 3000, () => this.wander(w));
    };
    for (let i = 0; i < (this.low ? 14 : 32); i++) add(Math.floor(rand() * COLS), Math.floor(rand() * ROWS));
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
    const tx = walkX(c);
    const ty = walkY(r);
    const dist = Math.abs(tx - w.sprite.x) + Math.abs(ty - w.sprite.y);
    const back = ty < w.sprite.y;
    let t = 0;
    const anim = this.time.addEvent({
      delay: 180,
      loop: true,
      callback: () => w.sprite.setFrame(String((back ? 3 : 0) + 1 + (t++ % 2))),
    });
    this.tweens.add({
      targets: w.sprite,
      x: tx,
      y: ty,
      duration: (dist / (WALK_SPEED * 0.6)) * 1000,
      onComplete: () => {
        anim.remove();
        if (!w.sprite.active) return;
        w.sprite.setFrame('0');
        w.c = c;
        w.r = r;
        this.time.delayedCall(500 + Math.random() * 4000, () => this.wander(w));
      },
    });
  }

  // ---------------------------------------------------------------- personaje

  private onModel(m: SceneModel, initial = false) {
    this.buildMap(m);
    this.syncExtras(m);
    this.syncMarkers(m);
    if (m.cheer !== this.cheerSeen) {
      if (this.cheerSeen && this.player?.visible && !this.walkTween) this.tweens.add({ targets: this.player, y: this.player.y - 4, duration: 120, yoyo: true, repeat: 1, ease: 'Quad.easeOut' });
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
      this.player = this.add.sprite(home.x, home.y, key, '0').setOrigin(0.5, 1);
      this.world.add(this.player);
      initial = true;
    } else if (this.player.texture.key !== key && m.spot !== 'errand') {
      this.player.setTexture(key, '0');
    }
    this.world.bringToTop(this.ring);
    this.world.bringToTop(this.player);
    this.world.bringToTop(this.marker);

    if (initial || m.spot === 'away') {
      this.walkTween?.stop();
      this.spot = m.spot;
      this.place(m);
      if (m.spot === 'errand') this.errandLoop(m);
      return;
    }
    if (m.spot === this.spot) return;
    const from = this.spot;
    this.spot = m.spot;
    const places = ROLE_PLACES[m.role];
    if (m.spot === 'work') this.walk(route(PLACE_BY_ID[places.home], PLACE_BY_ID[places.work]), () => this.place(bridge.get()));
    else if (m.spot === 'home' && from === 'work') this.walk(route(PLACE_BY_ID[places.work], PLACE_BY_ID[places.home]), () => this.place(bridge.get()));
    else if (m.spot === 'errand') this.errandLoop(m);
    else this.place(m);
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
    const sprite = this.add.sprite(start.x, start.y, tex, '0').setOrigin(0.5, 1);
    const label = this.add
      .text(start.x, start.y - 12, o.name, { fontFamily: 'LC Body, sans-serif', fontSize: '5px', color: '#ffe066', stroke: '#14101f', strokeThickness: 2, resolution: 4 })
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
        const dist = Math.abs(pts[i].x - pts[i - 1].x) + Math.abs(pts[i].y - pts[i - 1].y);
        if (dist > 0.5) tweens.push({ x: pts[i].x, y: pts[i].y, duration: (dist / (WALK_SPEED * 0.7)) * 1000 });
      }
      let t = 0;
      const anim = this.time.addEvent({ delay: 180, loop: true, callback: () => sprite.setFrame(String(1 + (t++ % 2))) });
      this.tweens.chain({
        targets: sprite,
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
      p.setVisible(true).setPosition(e.x, e.y);
    } else if (m.spot === 'work') {
      const e = placeEntrance(PLACE_BY_ID[places.work]);
      p.setVisible(false).setPosition(e.x, e.y);
      const r = placeBounds(PLACE_BY_ID[places.work], this.tops);
      this.marker.setPosition(r.x + r.w / 2, r.y - 9).setVisible(true).setDepth(100001);
      this.tweens.killTweensOf(this.marker);
      this.tweens.add({ targets: this.marker, y: r.y - 13, duration: 450, yoyo: true, repeat: -1 });
    } else if (m.spot === 'away') {
      p.setVisible(false);
    }
  }

  private walk(points: { x: number; y: number }[], done: () => void, speed = WALK_SPEED) {
    const p = this.player!;
    this.walkTween?.stop();
    this.marker.setVisible(false);
    p.setVisible(true).setPosition(points[0].x, points[0].y);
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
          this.facingBack = b.y < a.y - 0.5;
          if (Math.abs(b.x - a.x) > 0.5) p.setFlipX(b.x < a.x);
        },
      });
    }
    if (!tweens.length) return done();
    this.walkTween = this.tweens.chain({ targets: p, tweens, onComplete: () => {
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
    this.cameras.main.setZoom(Phaser.Math.Clamp(z, MIN_ZOOM, MAX_ZOOM));
    this.applyBounds();
    this.userPannedAt = this.time.now;
  }

  private tapAt(x: number, y: number) {
    // Los de más al sur van delante: se comprueban primero.
    const hits = PLACES_MAP.map((p) => ({ p, b: placeBounds(p, this.tops) }))
      .filter(({ b }) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h)
      .sort((a, b) => b.b.y + b.b.h - (a.b.y + a.b.h));
    if (hits.length) return bridge.tap(hits[0].p.id);
    // Grandes proyectos
    for (const mg of MEGA) {
      if ('place' in mg.site) continue;
      const b = placeRect({ id: 'plaza', label: '', c: mg.site.c, r: mg.site.r, cw: mg.site.cw, rh: mg.site.rh });
      if (x >= b.x && x <= b.x + b.w && y >= b.y - 30 && y <= b.y + b.h) return bridge.tap(`mega:${mg.id}`);
    }
    // Manzanas y solares: el de más al sur cuya altura cubra el toque.
    const special = new Set<string>();
    for (const p of PLACES_MAP)
      for (let c = p.c; c < p.c + (p.cw ?? 1); c++) for (let r = p.r; r < p.r + (p.rh ?? 1); r++) special.add(`${c},${r}`);
    for (let r = ROWS - 1; r >= 0; r--)
      for (let c = 0; c < COLS; c++) {
        const bx = blockX(c);
        const by = blockY(r);
        const top = Math.min(by, this.tops[`${c},${r}`] ?? by);
        if (x < bx || x > bx + BLOCK_W || y < top || y > by + BLOCK_H || special.has(`${c},${r}`)) continue;
        const lot = LOTS.find((l) => l.c === c && l.r === r);
        if (lot) {
          const lr = lotRect(lot);
          if (x >= lr.x && x <= lr.x + lr.w) return bridge.tap(`lot:${lot.id}`);
        }
        return bridge.tap(`block:${c},${r}`);
      }
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
    const nightA = Math.max(0, (l.night - 0.1) / 0.9);
    // Las ventanas se encienden escalonadas al anochecer: primero el norte, luego el sur.
    for (const li of this.lightImgs) {
      const frac = li.y / MAP_H;
      const stag = Phaser.Math.Clamp((l.night - 0.08 - frac * 0.18) / 0.74, 0, 1);
      li.setAlpha(Math.max(stag, w === 'tormenta' ? 0.35 : 0));
    }
    for (const c of this.cars) {
      c.img.setTint(ambient);
      c.light.setAlpha(nightA * 0.9);
    }
    for (const wk of this.walkers) {
      wk.sprite.setTint(ambient);
      if (wk.night) wk.sprite.setVisible(l.night > 0.5);
    }
    for (const b of this.boats) b.img.setTint(ambient);
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
      const snow = w === 'nieve';
      const n = w === 'tormenta' ? 140 : snow ? 90 : w === 'lluvia' ? 95 : 0;
      for (let i = 0; i < (this.low ? n / 2 : n); i++) {
        const s = 0.6 + Math.random() * 0.8;
        const frame = snow ? (s > 1.1 ? 'snow' : 'snow-s') : s > 1 ? 'rain' : 'rain-far';
        this.drops.push({ bob: this.precip.create(Math.random() * W, Math.random() * H, frame), s });
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
        if (b.y > H) {
          b.y = -8;
          b.x = Math.random() * (W + 30);
        }
        if (b.x < -4) b.x = W;
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
      c.setPosition(((t * 3 + i * 140) % (MAP_W + 160)) - 80, (i * 197) % MAP_H);
    });
  }

  /** La mascota va detrás del personaje, con un poco de retraso. */
  private followPet(delta: number) {
    const p = this.player!;
    const pet = this.pet!;
    pet.setVisible(p.visible);
    if (!p.visible) return;
    if (!pet.x && !pet.y) pet.setPosition(p.x - 6, p.y);
    const last = this.petTrail[this.petTrail.length - 1];
    if (!last || Math.abs(last.x - p.x) + Math.abs(last.y - p.y) > 0.5) this.petTrail.push({ x: p.x, y: p.y });
    const target = this.petTrail.length > 14 ? this.petTrail.shift()! : this.petTrail[0] ?? { x: p.x, y: p.y };
    const tx = this.walkTween ? target.x : p.x - 6;
    const ty = this.walkTween ? target.y : p.y;
    const k = Math.min(1, delta * 0.01);
    const moving = Math.abs(tx - pet.x) + Math.abs(ty - pet.y) > 0.3;
    if (Math.abs(tx - pet.x) > 0.2) pet.setFlipX(tx < pet.x);
    pet.setPosition(pet.x + (tx - pet.x) * k, pet.y + (ty - pet.y) * k);
    if (moving && Math.floor(this.time.now / 140) % 2) pet.setFrame('1');
    else pet.setFrame('0');
    depthOf(pet, pet.y + 0.25);
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
    for (const c of this.clouds) c.setVisible(false);
    for (const w of this.walkers.splice(this.walkers.length / 2)) {
      this.tweens.killTweensOf(w.sprite);
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
      b.img.y += b.dir * b.speed * (delta / 1000);
      if (b.img.y > MAP_H + 10) b.img.y = -10;
      if (b.img.y < -10) b.img.y = MAP_H + 10;
    }
    // el minimapa sabe qué ve la cámara (4 veces por segundo)
    if (time - this.viewAt > 250) {
      this.viewAt = time;
      const v = this.cameras.main.worldView;
      bridge.publishView({ px: this.player?.x ?? 0, py: this.player?.y ?? 0, playerVisible: !!this.player?.visible, x: v.x, y: v.y, w: v.width, h: v.height });
    }
    const neonA = (0.55 + this.light.night * 0.45) * (Math.random() < 0.012 ? 0.5 : 1);
    if (neonA !== this.neons[0]?.alpha) for (const n of this.neons) n.setAlpha(neonA);
    this.drawWeather(delta);

    // tráfico y profundidad de peatones
    this.moveTraffic(delta / 1000, time);
    for (const wk of this.walkers) depthOf(wk.sprite, wk.sprite.y);
    if (this.otherSprite && this.otherLabel) {
      depthOf(this.otherSprite, this.otherSprite.y);
      this.otherLabel.setPosition(this.otherSprite.x, this.otherSprite.y - 12);
    }

    // animación de pasos del personaje
    if (this.player) {
      const moving = !!this.walkTween;
      this.stepTimer += delta;
      if (moving && this.stepTimer > 160) {
        this.stepTimer = 0;
        this.stepFrame = this.stepFrame === 1 ? 2 : 1;
        this.player.setFrame(String((this.facingBack ? 3 : 0) + this.stepFrame));
      }
      if (!moving && this.player.frame.name !== '0' && this.player.frame.name !== '3') this.player.setFrame('0');
      depthOf(this.player, this.player.y + 0.5);
      this.ring.setVisible(this.player.visible).setPosition(this.player.x, this.player.y - 1);
      depthOf(this.ring, this.player.y);
      if (this.pet) this.followPet(delta);
      const wx = bridge.get().weather;
      const rainy = (wx === 'lluvia' || wx === 'tormenta') && this.player.visible;
      this.umbrella.setVisible(rainy);
      if (rainy) {
        this.umbrella.setPosition(this.player.x, this.player.y - 9);
        depthOf(this.umbrella, this.player.y + 0.6);
      }
    }

    // cámara: sigue al personaje salvo que el jugador haya movido el mapa
    const cam = this.cameras.main;
    const m = bridge.get();
    if (!m.role) {
      this.drift += delta * 0.00008;
      cam.centerOn(MAP_W / 2 + Math.sin(this.drift) * (MAP_W / 2 - 40), MAP_H / 2 + Math.cos(this.drift * 0.7) * (MAP_H / 2 - 60));
      return;
    }
    if (time - this.userPannedAt < 5000 || this.drag) return;
    let tx: number;
    let ty: number;
    if (this.player && this.player.visible) {
      tx = this.player.x;
      ty = this.player.y;
    } else {
      const r = placeRect(PLACE_BY_ID[ROLE_PLACES[m.role].work]);
      tx = r.x + r.w / 2;
      ty = r.y + r.h / 2;
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
  return Math.round(Math.max(260, Math.min(420, VIEW_W * ratio)));
}

export function createGame(parent: HTMLElement): Phaser.Game {
  if (lowFx()) document.documentElement.classList.add('lowfx');
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: VIEW_W,
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
  window.addEventListener('resize', () => game.scale.setGameSize(VIEW_W, viewHeight(parent)));
  return game;
}
