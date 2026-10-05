import { useEffect, useRef, useState } from 'preact/hooks';
import { BLOCK_H, BLOCK_W, blockX, blockY, COLS, MAP_H, MAP_W, PLACE_BY_ID, PLACES_MAP, placeEntrance, placeRect, RIVER_W, RIVER_X, ROLE_PLACES, ROWS, lotRect, stY, BRIDGE_STREET, iso, unIso } from '../art/cityMap';
import { districtOf, type District } from '../core/city';
import { LOTS, MEGA } from '../core/lots';
import type { GameState } from '../core/types';
import { bridge, type ViewInfo } from '../scene/bridge';
import { PixelIcon } from './PixelIcon';

/**
 * Minimapa con viaje rápido: toca un punto para llevar la cámara allí, o usa
 * los botones para ir a tu casa, tu trabajo, tus solares o Brooklyn.
 * Se dibuja en rombo, con el mismo ángulo que la vista isométrica.
 */
const S = 0.12;
const W = Math.round((MAP_W + MAP_H) * S);
const H = Math.round(((MAP_W + MAP_H) / 2) * S);
/** Esquina del rombo en la pantalla del mundo. */
const O = iso(0, MAP_H);
const OT = iso(0, 0);
/** Del plano al minimapa. */
const mp = (x: number, y: number) => {
  const p = iso(x, y);
  return { x: (p.x - O.x) * S, y: (p.y - OT.y) * S };
};
/** Rectángulo del plano como rombo en el minimapa. */
function quad(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  const pts = [mp(x, y), mp(x + w, y), mp(x + w, y + h), mp(x, y + h)];
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (const p of pts.slice(1)) ctx.lineTo(p.x, p.y);
  ctx.closePath();
  ctx.fill();
}
const DCOL: Record<District, string> = {
  midtown: '#6a6474',
  chinatown: '#8a4a3a',
  lowereast: '#6a4a3a',
  muelles: '#5a6470',
  industrial: '#6a5040',
  heights: '#7a5a44',
  coney: '#b08a9a',
};

function drawBase(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = '#1d3a58';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#2a2830';
  quad(ctx, 0, 0, MAP_W, MAP_H);
  for (let c = 0; c < COLS; c++)
    for (let r = 0; r < ROWS; r++) {
      ctx.fillStyle = DCOL[districtOf(c, r)];
      quad(ctx, blockX(c), blockY(r), BLOCK_W, BLOCK_H);
    }
  const special: Record<string, string> = { parque: '#3f7a3a', residencia: '#4a7a3e', alcaldia: '#d8d0bf', bolsa: '#ece6d8', plaza: '#ff4f9a', hipodromo: '#a8784a', coney: '#e8d29a' };
  for (const p of PLACES_MAP) {
    if (!special[p.id]) continue;
    const r = placeRect(p);
    ctx.fillStyle = special[p.id];
    quad(ctx, r.x, r.y, r.w, r.h);
  }
  ctx.fillStyle = '#1d3a58';
  quad(ctx, RIVER_X, 0, RIVER_W, MAP_H);
  ctx.fillStyle = '#c2b08c';
  quad(ctx, RIVER_X, stY(BRIDGE_STREET) - 5, RIVER_W, 10);
}

export function Minimap({ state }: { state: GameState }) {
  const [open, setOpen] = useState(() => {
    try {
      return localStorage.getItem('laciudad.minimapa') !== '0';
    } catch {
      return true;
    }
  });
  const base = useRef<HTMLCanvasElement | null>(null);
  const ref = useRef<HTMLCanvasElement>(null);
  const view = useRef<ViewInfo | null>(null);
  const lotIdx = useRef(0);

  const toggle = () => {
    setOpen(!open);
    try {
      localStorage.setItem('laciudad.minimapa', open ? '0' : '1');
    } catch {
      /* sin almacenamiento */
    }
  };

  const redraw = () => {
    const c = ref.current;
    if (!c) return;
    if (!base.current) {
      base.current = document.createElement('canvas');
      base.current.width = W;
      base.current.height = H;
      drawBase(base.current.getContext('2d')!);
    }
    const ctx = c.getContext('2d')!;
    ctx.drawImage(base.current, 0, 0);
    // solares: tuyos en dorado, libres en blanco, en obras en naranja
    for (const l of LOTS) {
      const st = state.lots?.[l.id];
      const r = lotRect(l);
      ctx.fillStyle = !st ? 'rgba(255,255,255,0.55)' : st.buildingUntil ? '#ff8a3b' : st.owner === 'jugador' || st.owner === 'ciudad' ? '#ffcc33' : '#9fe8ff';
      const q = mp(r.x + r.w / 2, r.y + r.h / 2);
      ctx.fillRect(q.x - 1.5, q.y - 1.5, 3, 3);
    }
    for (const m of MEGA) {
      if ('place' in m.site) continue;
      const p = state.projects?.[m.id];
      if (!p) continue;
      ctx.fillStyle = p.done ? '#4ff0ff' : '#ff8a3b';
      const r = placeRect({ id: 'plaza', label: '', c: m.site.c, r: m.site.r, cw: m.site.cw, rh: m.site.rh });
      const q = mp(r.x + r.w / 2, r.y + r.h / 2);
      ctx.fillRect(q.x - 2, q.y - 2, 4, 4);
    }
    const mine = ROLE_PLACES[state.character.role];
    for (const [id, col] of [
      [mine.home, '#7dff6a'],
      [mine.work, '#ffe066'],
    ] as const) {
      const e = placeEntrance(PLACE_BY_ID[id]);
      ctx.fillStyle = col;
      const q = mp(e.x, e.y);
      ctx.fillRect(q.x - 2, q.y - 2, 4, 4);
    }
    const v = view.current;
    if (v) {
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = 1;
      // la vista llega en coordenadas de pantalla del mundo
      ctx.strokeRect(Math.round((v.x - O.x) * S) + 0.5, Math.round((v.y - OT.y) * S) + 0.5, Math.round(v.w * S), Math.round(v.h * S));
      if (v.playerVisible) {
        const q = mp(v.px, v.py);
        ctx.fillStyle = '#ff3b5a';
        ctx.fillRect(q.x - 2, q.y - 3, 4, 4);
      }
    }
  };

  useEffect(() => {
    if (!open) return;
    redraw();
    return bridge.onView((v) => {
      view.current = v;
      redraw();
    });
  }, [open, state]);

  const tap = (e: PointerEvent) => {
    const r = (e.currentTarget as HTMLCanvasElement).getBoundingClientRect();
    const sx = ((e.clientX - r.left) / r.width) * W;
    const sy = ((e.clientY - r.top) / r.height) * H;
    const g = unIso(sx / S + O.x, sy / S + OT.y);
    bridge.focus(Math.max(0, Math.min(MAP_W, g.x)), Math.max(0, Math.min(MAP_H, g.y)));
  };
  const go = (where: 'home' | 'work' | 'lots' | 'brooklyn') => {
    const mine = ROLE_PLACES[state.character.role];
    if (where === 'home' || where === 'work') {
      const e = placeEntrance(PLACE_BY_ID[where === 'home' ? mine.home : mine.work]);
      return bridge.focus(e.x - 10, e.y - 10);
    }
    if (where === 'brooklyn') return bridge.focus(RIVER_X + RIVER_W + 160, MAP_H / 2);
    const ids = Object.entries(state.lots ?? {})
      .filter(([, l]) => l.owner !== 'privado')
      .map(([id]) => id);
    const list = ids.length ? ids : LOTS.filter((l) => !state.lots?.[l.id]).map((l) => l.id);
    const l = LOTS.find((x) => x.id === list[lotIdx.current++ % list.length])!;
    const r = lotRect(l);
    bridge.focus(r.x + r.w / 2, r.y + r.h / 2);
  };

  return (
    <div class={`minimap ${open ? 'open' : ''}`}>
      <button class="mm-toggle" onClick={toggle} aria-label="Minimapa">
        <PixelIcon id="mapa" size={2} />
      </button>
      {open && (
        <>
          <canvas ref={ref} width={W} height={H} onPointerDown={tap} />
          <div class="mm-buttons">
            <button onClick={() => go('home')} title="Casa">⌂</button>
            <button onClick={() => go('work')} title="Trabajo">★</button>
            <button onClick={() => go('lots')} title="Solares">▣</button>
            <button onClick={() => go('brooklyn')} title="Brooklyn">⇄</button>
          </div>
        </>
      )}
    </div>
  );
}
