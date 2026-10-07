import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { hashString } from '../core/rng';

/**
 * Notificaciones de la jornada (sucesos, fin de las 8 horas, recordatorio diario).
 *
 * - En la app (Android/iOS): notificaciones locales del sistema, programadas
 *   de antemano. Suenan aunque la app esté cerrada.
 * - En el navegador: temporizadores mientras la página está abierta.
 */
export interface ScheduledNotification {
  id: string;
  at: number;
  title: string;
  body: string;
}

const native = Capacitor.isNativePlatform();
const timers = new Map<string, number>();
let nativeIds: number[] = [];
let lastSignature = '';

const numericId = (id: string) => (hashString(id) % 2_000_000_000) + 1;

export async function requestPermission() {
  try {
    if (native) {
      const p = await LocalNotifications.checkPermissions();
      if (p.display !== 'granted') await LocalNotifications.requestPermissions();
    } else if ('Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission();
    }
  } catch {
    /* sin soporte */
  }
}

/** Cancela todo (p. ej. al cambiar la velocidad del reloj en modo desarrollo). */
export function clearAll() {
  for (const t of timers.values()) clearTimeout(t);
  timers.clear();
  lastSignature = '';
  if (native && nativeIds.length) {
    LocalNotifications.cancel({ notifications: nativeIds.map((id) => ({ id })) }).catch(() => {});
    nativeIds = [];
  }
}

function showWeb(n: ScheduledNotification) {
  try {
    if ('Notification' in window && Notification.permission === 'granted' && document.hidden) {
      new Notification(n.title, { body: n.body, tag: n.id });
    }
  } catch {
    /* algunos navegadores móviles solo permiten notificaciones desde un service worker */
  }
}

/**
 * Sustituye todas las notificaciones programadas. `nowMs` es la hora del
 * juego y `speed` su velocidad (modo desarrollo).
 */
export function scheduleAll(list: ScheduledNotification[], nowMs: number, speed: number) {
  const future = list.filter((n) => n.at > nowMs);
  const signature = future.map((n) => `${n.id}@${n.at}`).join('|') + `x${speed}`;
  if (signature === lastSignature) return;
  lastSignature = signature;

  if (native) {
    const realNow = Date.now();
    const toReal = (at: number) => new Date(realNow + (at - nowMs) / Math.max(1, speed));
    const old = nativeIds;
    nativeIds = future.map((n) => numericId(n.id));
    (async () => {
      try {
        if (old.length) await LocalNotifications.cancel({ notifications: old.map((id) => ({ id })) });
        if (!future.length) return;
        await LocalNotifications.schedule({
          notifications: future.map((n) => ({
            id: numericId(n.id),
            title: n.title,
            body: n.body,
            schedule: { at: toReal(n.at), allowWhileIdle: true },
          })),
        });
      } catch {
        /* permiso denegado */
      }
    })();
    return;
  }

  const wanted = new Set(future.map((n) => n.id));
  for (const [id, t] of timers) {
    if (!wanted.has(id)) {
      clearTimeout(t);
      timers.delete(id);
    }
  }
  for (const n of future) {
    if (timers.has(n.id)) continue;
    const delay = (n.at - nowMs) / Math.max(1, speed);
    if (delay > 2 ** 31 - 1) continue;
    timers.set(
      n.id,
      window.setTimeout(() => {
        timers.delete(n.id);
        showWeb(n);
      }, delay),
    );
  }
}
