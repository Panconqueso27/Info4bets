import Phaser from 'phaser';
import {
  aveX,
  COLS,
  generateCityMap,
  BLOCK_H,
  blockY,
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
import type { Look } from '../core/types';
import { randomLook } from '../art/character';
import { bridge, type SceneModel, type Spot } from './bridge';

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
}

/** Ciclo de semáforos: avenidas y calles se alternan. */
const SIGNAL_MS = 7000;

interface Walker {
  sprite: Phaser.GameObjects.Sprite;
  c: number;
  r: number;
}

export class CityScene extends Phaser.Scene {
  private world!: Phaser.GameObjects.Layer;
  /** Imágenes del mapa por tipo: se tiñen o se encienden según la hora. */
  private bases: Phaser.GameObjects.Image[] = [];
  private snows: Phaser.GameObjects.Image[] = [];
  private lightImgs: Phaser.GameObjects.Image[] = [];
  private neons: Phaser.GameObjects.Image[] = [];
  private tops: Record<string, number> = {};
  private signals!: Phaser.GameObjects.Graphics;
  private signalPhase = -1;
  private clouds!: Phaser.GameObjects.Graphics;
  private weatherFx!: Phaser.GameObjects.Graphics;
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
  private drops: { x: number; y: number; s: number }[] = [];
  private nextLightning = 0;
  private drag: { x: number; y: number; sx: number; sy: number; moved: boolean } | null = null;
  private pinch: { d: number; zoom: number } | null = null;

  constructor() {
    super('city');
  }

  create() {
    const art = generateCityMap();
    this.tops = art.tops;
    this.makeCarTextures();
    this.makeHeadlight();

    // El mapa: suelo abajo y una capa por fila de manzanas, ordenadas por profundidad
    // para que los edificios tapen a lo que pasa por detrás.
    this.world = this.add.layer();
    const addSet = (key: string, set: { base: HTMLCanvasElement; lights: HTMLCanvasElement; neon: HTMLCanvasElement; snow: HTMLCanvasElement }, y: number, depth: number) => {
      for (const kind of ['base', 'snow', 'lights', 'neon'] as const) this.textures.addCanvas(`${key}-${kind}`, set[kind]);
      const base = this.add.image(0, y, `${key}-base`).setOrigin(0).setDepth(depth);
      const snow = this.add.image(0, y, `${key}-snow`).setOrigin(0).setDepth(depth + 0.01).setAlpha(0);
      const lights = this.add.image(0, y, `${key}-lights`).setOrigin(0).setDepth(depth + 0.02).setBlendMode(Phaser.BlendModes.ADD);
      const neon = this.add.image(0, y, `${key}-neon`).setOrigin(0).setDepth(depth + 0.03).setBlendMode(Phaser.BlendModes.ADD);
      this.bases.push(base);
      this.snows.push(snow);
      this.lightImgs.push(lights);
      this.neons.push(neon);
      this.world.add([base, snow, lights, neon]);
    };
    addSet('map-ground', art.ground, 0, -100);
    art.rows.forEach((r, i) => addSet(`map-row${i}`, r, r.y, r.depth));
    this.signals = this.add.graphics().setDepth(-50);
    this.world.add(this.signals);

    this.spawnTraffic();
    this.spawnPedestrians();

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
    this.clouds = this.add.graphics();
    this.world.add(this.clouds);
    this.weatherFx = this.add.graphics();
    this.flash = this.add.rectangle(0, 0, 10, 10, 0xffffff, 0).setOrigin(0);
    this.uiCam = this.cameras.add(0, 0, this.scale.width, this.scale.height);
    // La cámara del clima no dibuja el mapa.
    this.world.cameraFilter |= this.uiCam.id;
    this.cameras.main.ignore([this.weatherFx, this.flash]);

    const cam = this.cameras.main;
    cam.setBackgroundColor('#120c24');
    cam.setZoom(1);
    this.applyBounds();
    cam.centerOn(MAP_W / 2, MAP_H / 2);
    this.scale.on('resize', () => this.applyBounds());
    this.setupInput();

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
    this.uiCam?.setSize(this.scale.width, this.scale.height);
    this.flash?.setSize(this.scale.width, this.scale.height);
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
    for (let k = 0; k < 30; k++) {
      const police = rand() < 0.08;
      const ci = Math.floor(rand() * CAR_COLORS.length);
      const axis: 'v' | 'h' = k % 2 === 0 ? 'v' : 'h';
      const dir: 1 | -1 = rand() < 0.5 ? 1 : -1;
      const speed = 16 + rand() * 14;
      let img: Phaser.GameObjects.Image;
      let lane: string;
      if (axis === 'v') {
        // Se conduce por la derecha: hacia el sur por el carril oeste, hacia el norte por el este.
        const i = Math.floor(rand() * (COLS + 1));
        img = this.add.image(aveX(i) + (dir > 0 ? -4 : 4), rand() * MAP_H, `car-front-${police ? 'p' : ci}`).setOrigin(0.5, 1);
        lane = `v${i}${dir}`;
      } else {
        const j = Math.floor(rand() * (ROWS + 1));
        img = this.add.image(rand() * MAP_W, stY(j) + (dir > 0 ? 5 : -1), `car-side-${police ? 'p' : ci}`).setOrigin(0.5, 1);
        img.setFlipX(dir < 0);
        lane = `h${j}${dir}`;
      }
      const light = this.add.image(img.x, img.y, 'headlight').setBlendMode(Phaser.BlendModes.ADD).setAlpha(0).setDepth(99990);
      this.world.add([img, light]);
      this.cars.push({ img, light, axis, dir, lane, speed, len: axis === 'v' ? 8 : 10 });
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

  /** Coordenadas de los cruces a lo largo del eje de un coche. */
  private crossings(c: Car): number[] {
    return c.axis === 'v'
      ? Array.from({ length: ROWS + 1 }, (_, j) => stY(j))
      : Array.from({ length: COLS + 1 }, (_, i) => aveX(i));
  }

  /** Mueve el tráfico: respeta semáforos y la distancia con el coche de delante. */
  private moveTraffic(dt: number, time: number) {
    const phase = Math.floor(time / SIGNAL_MS) % 2; // 0: avenidas en verde, 1: calles en verde
    const amber = time % SIGNAL_MS > SIGNAL_MS - 1200;
    if (phase !== this.signalPhase) this.drawSignals(phase);
    this.signalPhase = phase;
    const limit = (c: Car) => (c.axis === 'v' ? MAP_H : MAP_W);
    for (const c of this.cars) {
      const pos = this.along(c);
      // la parte delantera del coche
      const front = c.axis === 'v' ? (c.dir > 0 ? pos : pos - c.len) : pos + (c.dir * c.len) / 2;
      let next = pos + c.dir * c.speed * dt;
      const red = (c.axis === 'v' ? phase !== 0 : phase !== 1) || amber;
      if (red) {
        const half = (c.axis === 'v' ? ST_H : AVE_W) / 2 + 2;
        for (const x of this.crossings(c)) {
          const stopLine = x - c.dir * half;
          const dist = (stopLine - front) * c.dir;
          if (dist >= -0.5 && dist < 10) {
            next = c.dir > 0 ? Math.min(next, pos + dist) : Math.max(next, pos - dist);
            break;
          }
        }
      }
      // no chocar con el de delante en el mismo carril
      for (const o of this.cars) {
        if (o === c || o.lane !== c.lane) continue;
        const gap = (this.along(o) - pos) * c.dir;
        if (gap > 0 && gap < c.len + 5) next = pos + c.dir * Math.max(0, gap - c.len - 5) * 0.5;
      }
      this.setAlong(c, next);
      if (next > limit(c) + 12) this.setAlong(c, -12);
      if (next < -12) this.setAlong(c, limit(c) + 12);
      c.img.setDepth(c.img.y);
      c.light.setPosition(c.img.x + (c.axis === 'h' ? c.dir * 9 : 0), c.img.y + (c.axis === 'v' ? (c.dir > 0 ? 6 : -14) : -3));
    }
  }

  /** Semáforos en las esquinas visibles de cada cruce (acera sur de la manzana de arriba). */
  private drawSignals(phase: number) {
    const g = this.signals;
    g.clear();
    for (let i = 0; i <= COLS; i++)
      for (let j = 1; j <= ROWS; j++) {
        const x = aveX(i) + AVE_W / 2 + 1;
        const y = blockY(j - 1) + BLOCK_H - 2;
        if (x > MAP_W - 2) continue;
        g.fillStyle(0x1a1a1f).fillRect(x, y - 7, 1, 7);
        g.fillStyle(0x1a1a1f).fillRect(x - 1, y - 9, 3, 3);
        g.fillStyle(phase === 0 ? 0x3dff7a : 0xff3b3b).fillRect(x, y - 8, 1, 1);
      }
  }

  private spawnPedestrians() {
    const rand = mulberry32(1985);
    for (let i = 0; i < 18; i++) {
      const look = randomLook(rand() < 0.5 ? 'inmigrante' : 'alcalde', rand);
      const key = this.ensureMini(look);
      const c = Math.floor(rand() * COLS);
      const r = Math.floor(rand() * ROWS);
      const sprite = this.add.sprite(walkX(c), walkY(r), key, '0').setOrigin(0.5, 1);
      this.world.add(sprite);
      const w: Walker = { sprite, c, r };
      this.walkers.push(w);
      this.time.delayedCall(rand() * 3000, () => this.wander(w));
    }
  }

  private wander(w: Walker) {
    const opts: [number, number][] = [];
    if (w.c > 0) opts.push([w.c - 1, w.r]);
    if (w.c < COLS - 1) opts.push([w.c + 1, w.r]);
    if (w.r > 0) opts.push([w.c, w.r - 1]);
    if (w.r < ROWS - 1) opts.push([w.c, w.r + 1]);
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
        w.sprite.setFrame('0');
        w.c = c;
        w.r = r;
        this.time.delayedCall(500 + Math.random() * 4000, () => this.wander(w));
      },
    });
  }

  // ---------------------------------------------------------------- personaje

  private onModel(m: SceneModel, initial = false) {
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
    if (hits.length) bridge.tap(hits[0].p.id);
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
      ambient = Phaser.Display.Color.GetColor(
        ((ambient >> 16) & 255) * 0.82,
        ((ambient >> 8) & 255) * 0.85,
        (ambient & 255) * 0.95,
      );
    }
    for (const b of this.bases) b.setTint(ambient);
    for (const sn of this.snows) sn.setTint(ambient).setAlpha(w === 'nieve' ? 0.85 : 0);
    const nightA = Math.max(0, (l.night - 0.1) / 0.9);
    for (const li of this.lightImgs) li.setAlpha(Math.max(nightA, w === 'tormenta' ? 0.35 : 0));
    for (const c of this.cars) {
      c.img.setTint(ambient);
      c.light.setAlpha(nightA * 0.9);
    }
    for (const wk of this.walkers) wk.sprite.setTint(ambient);
    if (this.player) {
      const lift = (v: number) => Math.min(255, v + 50);
      this.player.setTint(Phaser.Display.Color.GetColor(lift((ambient >> 16) & 255), lift((ambient >> 8) & 255), lift(ambient & 255)));
    }
  }

  private drawWeather(delta: number) {
    const g = this.weatherFx;
    const w = bridge.get().weather;
    const W = this.scale.width;
    const H = this.scale.height;
    g.clear();
    if (w === 'lluvia' || w === 'tormenta' || w === 'nieve') {
      const n = w === 'nieve' ? 110 : w === 'tormenta' ? 170 : 110;
      while (this.drops.length < n) this.drops.push({ x: Math.random() * W, y: Math.random() * H, s: 0.6 + Math.random() * 0.8 });
      this.drops.length = n;
      for (const d of this.drops) {
        if (w === 'nieve') {
          d.y += delta * 0.012 * d.s;
          d.x += Math.sin((d.y + d.s * 100) / 18) * 0.2;
          const sz = d.s > 1.1 ? 3 : 2;
          g.fillStyle(0xffffff, 0.95).fillRect(Math.round(d.x), Math.round(d.y), sz, sz);
          g.fillStyle(0xbfd8ff, 0.6).fillRect(Math.round(d.x) + sz, Math.round(d.y) + 1, 1, 1);
        } else {
          d.y += delta * 0.22 * d.s;
          d.x -= delta * 0.05 * d.s;
          g.fillStyle(0xcfe6ff, 0.75).fillRect(Math.round(d.x), Math.round(d.y), 1, 7);
          g.fillStyle(0xcfe6ff, 0.35).fillRect(Math.round(d.x) + 1, Math.round(d.y) + 5, 1, 3);
        }
        if (d.y > H) {
          d.y = -4;
          d.x = Math.random() * (W + 30);
        }
        if (d.x < -4) d.x = W;
      }
      if (w !== 'nieve') g.fillStyle(0x1a2a44, 0.16).fillRect(0, 0, W, H);
    } else if (w === 'nublado') {
      g.fillStyle(0x2a2a3a, 0.1).fillRect(0, 0, W, H);
    }
    // relámpagos
    if (w === 'tormenta') {
      if (this.time.now > this.nextLightning) {
        this.nextLightning = this.time.now + 5000 + Math.random() * 9000;
        this.flash.setFillStyle(0xffffff, 0.75);
        this.tweens.add({ targets: this.flash, fillAlpha: 0, duration: 450, ease: 'Expo.Out' });
      }
    }
    // sombras de nubes que cruzan la ciudad de día
    this.clouds.clear();
    if (this.light.night < 0.5) {
      const t = this.time.now / 1000;
      this.clouds.fillStyle(0x0a0818, w === 'despejado' ? 0.08 : 0.14);
      for (let i = 0; i < 4; i++) {
        const cx = ((t * 3 + i * 140) % (MAP_W + 160)) - 80;
        const cy = (i * 197) % MAP_H;
        this.clouds.fillEllipse(cx, cy, 90, 50);
      }
    }
  }

  update(time: number, delta: number) {
    this.updateLight();
    const neonA = (0.55 + this.light.night * 0.45) * (Math.random() < 0.012 ? 0.5 : 1);
    for (const n of this.neons) n.setAlpha(neonA);
    this.drawWeather(delta);

    // tráfico y profundidad de peatones
    this.moveTraffic(delta / 1000, time);
    for (const wk of this.walkers) wk.sprite.setDepth(wk.sprite.y);
    if (this.otherSprite && this.otherLabel) {
      this.otherSprite.setDepth(this.otherSprite.y);
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
      this.player.setDepth(this.player.y + 0.1);
      this.ring.setVisible(this.player.visible).setPosition(this.player.x, this.player.y - 1).setDepth(this.player.y);
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

/** Alto lógico según la proporción del contenedor (pantalla del móvil). */
export function viewHeight(parent: HTMLElement): number {
  const ratio = parent.clientHeight / Math.max(1, parent.clientWidth);
  return Math.round(Math.max(260, Math.min(420, VIEW_W * ratio)));
}

export function createGame(parent: HTMLElement): Phaser.Game {
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: VIEW_W,
    height: viewHeight(parent),
    pixelArt: true,
    backgroundColor: '#120c24',
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: [CityScene],
    banner: false,
    audio: { noAudio: true },
    input: { activePointers: 3 },
  });
  window.addEventListener('resize', () => game.scale.setGameSize(VIEW_W, viewHeight(parent)));
  return game;
}
