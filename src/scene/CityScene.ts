import Phaser from 'phaser';
import { CHAR_H, CHAR_W, drawCharacter, randomLook } from '../art/character';
import { drawTaxi, generateCity, GROUND_Y, PLACES, WORLD_W } from '../art/city';
import { lightAt, type Light } from '../art/daynight';
import { mulberry32 } from '../core/rng';
import type { Look } from '../core/types';
import { bridge, type SceneModel, type Spot } from './bridge';

/** Ancho lógico de la vista: la ciudad se ve en vertical, como en un móvil. */
export const VIEW_W = 180;
/** Píxeles lógicos que tapa el panel inferior de la interfaz. */
const BOTTOM_UI = 78;
const WALK_SPEED = 28;

function lookKey(look: Look): string {
  return `char-${look.outfit}-${look.hair}-${look.skin}-${look.hairColor}-${look.outfitColor}`;
}

export class CityScene extends Phaser.Scene {
  private sky!: Phaser.GameObjects.Graphics;
  private stars!: Phaser.GameObjects.Graphics;
  private sun!: Phaser.GameObjects.Arc;
  private moon!: Phaser.GameObjects.Arc;
  private farLayer!: Phaser.GameObjects.Container;
  private mainLayer!: Phaser.GameObjects.Container;
  private tinted: Phaser.GameObjects.Image[] = [];
  private nightLayers: Phaser.GameObjects.Image[] = [];
  private neon!: Phaser.GameObjects.Image;
  private player: Phaser.GameObjects.Sprite | null = null;
  private workMarker!: Phaser.GameObjects.Text;
  private markerBounce: Phaser.Tweens.Tween | null = null;
  private spot: Spot = 'home';
  private walking: Phaser.Tweens.Tween | null = null;
  private npcs: Phaser.GameObjects.Sprite[] = [];
  private cars: Phaser.GameObjects.Image[] = [];
  private light: Light = lightAt(Date.now());
  private lastLightAt = 0;
  private drift = 0;
  private unsubscribe: (() => void) | null = null;

  constructor() {
    super('city');
  }

  create() {
    const art = generateCity();
    this.textures.addCanvas('city-base', art.base);
    this.textures.addCanvas('city-lights', art.lights);
    this.textures.addCanvas('city-neon', art.neon);
    this.textures.addCanvas('city-far', art.far);
    this.textures.addCanvas('city-far-lights', art.farLights);
    this.makeTaxiTexture();

    this.sky = this.add.graphics().setScrollFactor(0);
    this.stars = this.add.graphics().setScrollFactor(0);
    const rand = mulberry32(7);
    for (let i = 0; i < 70; i++) {
      this.stars.fillStyle(0xffffff, rand() < 0.2 ? 1 : 0.55);
      this.stars.fillRect(Math.floor(rand() * VIEW_W), Math.floor(rand() * 220), 1, 1);
    }
    this.sun = this.add.circle(0, 0, 9, 0xffe7a0).setScrollFactor(0);
    this.moon = this.add.circle(0, 0, 6, 0xf2f0e6).setScrollFactor(0);

    this.farLayer = this.add.container(0, 0).setScrollFactor(0.4, 1);
    const far = this.add.image(0, 0, 'city-far').setOrigin(0);
    const farLights = this.add.image(0, 0, 'city-far-lights').setOrigin(0);
    this.farLayer.add([far, farLights]);

    this.mainLayer = this.add.container(0, 0);
    const base = this.add.image(0, 0, 'city-base').setOrigin(0);
    const lights = this.add.image(0, 0, 'city-lights').setOrigin(0).setBlendMode(Phaser.BlendModes.ADD);
    this.neon = this.add.image(0, 0, 'city-neon').setOrigin(0);
    this.mainLayer.add([base, lights, this.neon]);
    this.tinted = [base];
    this.nightLayers = [lights];
    this.tinted.push(far);
    this.nightLayers.push(farLights);

    this.workMarker = this.add
      .text(0, 0, '▼', { fontFamily: '"Press Start 2P"', fontSize: '8px', color: '#ffe066', stroke: '#000', strokeThickness: 2 })
      .setOrigin(0.5, 1)
      .setVisible(false);
    this.mainLayer.add(this.workMarker);

    this.spawnTraffic();
    this.spawnPedestrians();

    this.cameras.main.setBounds(0, 0, WORLD_W, this.scale.height);
    this.scale.on('resize', () => this.layout());
    this.layout();

    this.unsubscribe = bridge.subscribe((m) => this.onModel(m));
    this.events.once('shutdown', () => this.unsubscribe?.());
    this.onModel(bridge.get(), true);
    this.updateLight(true);
  }

  /** La ciudad se ancla abajo: la acera queda justo encima del panel inferior. */
  private layout() {
    const h = this.scale.height;
    const offset = h - BOTTOM_UI - GROUND_Y;
    this.farLayer.y = offset;
    this.mainLayer.y = offset;
    this.cameras.main.setBounds(0, 0, WORLD_W, h);
    this.updateLight(true);
  }

  private makeTaxiTexture() {
    const c = document.createElement('canvas');
    c.width = 24;
    c.height = 11;
    drawTaxi(c.getContext('2d')!);
    this.textures.addCanvas('taxi', c);
  }

  private ensureCharTexture(look: Look): string {
    const key = lookKey(look);
    if (this.textures.exists(key)) return key;
    const c = document.createElement('canvas');
    c.width = CHAR_W * 3;
    c.height = CHAR_H;
    const ctx = c.getContext('2d')!;
    for (let f = 0; f < 3; f++) drawCharacter(ctx, look, f, f * CHAR_W, 0);
    const tex = this.textures.addCanvas(key, c)!;
    for (let f = 0; f < 3; f++) tex.add(String(f), 0, f * CHAR_W, 0, CHAR_W, CHAR_H);
    this.anims.create({
      key: `${key}-walk`,
      frames: [1, 0, 2, 0].map((f) => ({ key, frame: String(f) })),
      frameRate: 6,
      repeat: -1,
    });
    return key;
  }

  private spawnTraffic() {
    const roadY = GROUND_Y + 18;
    const colors = [0xffffff, 0xffffff, 0xffffff, 0xb8c0d0];
    for (let i = 0; i < 3; i++) {
      const goingRight = i % 2 === 0;
      const car = this.add.image(-40, roadY + (goingRight ? 10 : 0), 'taxi').setOrigin(0.5, 1).setFlipX(!goingRight);
      car.setTint(colors[i % colors.length]);
      this.mainLayer.add(car);
      this.cars.push(car);
      const run = () => {
        const fromX = goingRight ? -30 : WORLD_W + 30;
        const toX = goingRight ? WORLD_W + 30 : -30;
        car.x = fromX;
        this.tweens.add({
          targets: car,
          x: toX,
          duration: Phaser.Math.Between(9000, 15000),
          delay: Phaser.Math.Between(500, 9000),
          onComplete: run,
        });
      };
      run();
    }
  }

  private spawnPedestrians() {
    const rand = mulberry32(1985);
    for (let i = 0; i < 5; i++) {
      const look = randomLook(rand() < 0.5 ? 'inmigrante' : 'alcalde', rand);
      const key = this.ensureCharTexture(look);
      const npc = this.add.sprite(rand() * WORLD_W, GROUND_Y + 1, key, '0').setOrigin(0.5, 1);
      npc.setScale(0.85);
      this.mainLayer.add(npc);
      this.npcs.push(npc);
      const wander = () => {
        const target = Phaser.Math.Between(10, WORLD_W - 10);
        npc.setFlipX(target < npc.x);
        npc.play(`${key}-walk`);
        this.tweens.add({
          targets: npc,
          x: target,
          duration: (Math.abs(target - npc.x) / (WALK_SPEED * 0.7)) * 1000,
          onComplete: () => {
            npc.stop();
            npc.setFrame('0');
            this.time.delayedCall(Phaser.Math.Between(1500, 7000), wander);
          },
        });
      };
      this.time.delayedCall(Phaser.Math.Between(0, 4000), wander);
    }
  }

  private onModel(m: SceneModel, initial = false) {
    if (!m.role || !m.look) {
      this.player?.destroy();
      this.player = null;
      this.workMarker.setVisible(false);
      return;
    }
    const place = PLACES[m.role];
    const key = this.ensureCharTexture(m.look);
    if (!this.player) {
      this.player = this.add.sprite(place.home, GROUND_Y + 2, key, '0').setOrigin(0.5, 1);
      this.mainLayer.add(this.player);
      this.mainLayer.bringToTop(this.player);
      initial = true;
    } else if (this.player.texture.key !== key) {
      this.player.setTexture(key, '0');
    }

    if (initial || m.spot === 'away') {
      this.walking?.stop();
      this.spot = m.spot;
      this.placePlayer(m);
      return;
    }
    if (m.spot !== this.spot) {
      const from = this.spot;
      this.spot = m.spot;
      if (m.spot === 'work') this.walk(place.home, place.work, () => this.placePlayer(bridge.get()));
      else if (m.spot === 'home') this.walk(from === 'work' ? place.work : place.home, place.home, () => this.placePlayer(bridge.get()));
    }
  }

  private placePlayer(m: SceneModel) {
    if (!this.player || !m.role) return;
    const place = PLACES[m.role];
    this.player.stop();
    this.player.setFrame('0');
    this.player.setAlpha(1);
    this.workMarker.setVisible(false);
    if (m.spot === 'home') {
      this.player.setVisible(true).setX(place.home);
    } else if (m.spot === 'work') {
      this.player.setVisible(false).setX(place.work);
      this.showMarker(place.work);
    } else {
      this.player.setVisible(false);
    }
  }

  /** Indicador que rebota sobre el lugar de trabajo mientras el personaje está dentro. */
  private showMarker(x: number) {
    this.markerBounce?.stop();
    this.workMarker.setPosition(x, GROUND_Y - 44).setVisible(true);
    this.markerBounce = this.tweens.add({ targets: this.workMarker, y: GROUND_Y - 47, duration: 500, yoyo: true, repeat: -1 });
  }

  private walk(fromX: number, toX: number, done: () => void) {
    const p = this.player!;
    this.walking?.stop();
    this.workMarker.setVisible(false);
    p.setVisible(true).setAlpha(1).setX(fromX);
    p.setFlipX(toX < fromX);
    p.play(`${p.texture.key}-walk`);
    this.walking = this.tweens.add({
      targets: p,
      x: toX,
      duration: Math.max(600, (Math.abs(toX - fromX) / WALK_SPEED) * 1000),
      onComplete: () => {
        this.walking = null;
        done();
      },
    });
  }

  private updateLight(force = false) {
    const now = bridge.get().now();
    if (!force && Math.abs(now - this.lastLightAt) < 1000) return;
    this.lastLightAt = now;
    const l = (this.light = lightAt(now));
    const w = VIEW_W;
    const h = this.scale.height;
    this.sky.clear();
    this.sky.fillGradientStyle(l.skyTop, l.skyTop, l.skyBottom, l.skyBottom, 1);
    this.sky.fillRect(0, 0, w, h);
    this.stars.setAlpha(Math.max(0, l.night - 0.3) / 0.7);
    const horizon = this.mainLayer.y + GROUND_Y - 120;
    const arc = (t: number) => ({ x: 14 + t * (w - 28), y: horizon - Math.sin(t * Math.PI) * (horizon - 80) });
    if (l.sun !== null) this.sun.setVisible(true).setPosition(arc(l.sun).x, arc(l.sun).y);
    else this.sun.setVisible(false);
    if (l.moon !== null) this.moon.setVisible(true).setPosition(arc(l.moon).x, arc(l.moon).y);
    else this.moon.setVisible(false);
    for (const img of this.tinted) img.setTint(l.ambient);
    for (const img of this.nightLayers) img.setAlpha(Math.max(0, (l.night - 0.15) / 0.85));
    for (const s of [...this.npcs, ...this.cars]) s.setTint(l.ambient);
    if (this.player) this.player.setTint(Phaser.Display.Color.GetColor(
      Math.min(255, ((l.ambient >> 16) & 255) + 40),
      Math.min(255, ((l.ambient >> 8) & 255) + 40),
      Math.min(255, (l.ambient & 255) + 40),
    ));
  }

  update(_time: number, delta: number) {
    this.updateLight();
    // Parpadeo de neones
    const base = 0.45 + this.light.night * 0.55;
    this.neon.setAlpha(Math.random() < 0.01 ? base * 0.4 : base);

    const cam = this.cameras.main;
    const m = bridge.get();
    if (!m.role) {
      // Sin partida: paseo lento de la cámara por la ciudad.
      this.drift += delta * 0.012;
      const range = WORLD_W - VIEW_W;
      const t = (Math.sin(this.drift / range) + 1) / 2;
      cam.scrollX = t * range;
      return;
    }
    const target = this.player && this.player.visible ? this.player.x : PLACES[m.role][m.spot === 'work' ? 'work' : 'home'];
    const desired = Phaser.Math.Clamp(target - VIEW_W / 2, 0, WORLD_W - VIEW_W);
    cam.scrollX += (desired - cam.scrollX) * Math.min(1, delta * 0.004);
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
  });
  window.addEventListener('resize', () => game.scale.setGameSize(VIEW_W, viewHeight(parent)));
  return game;
}

