/**
 * Notificaciones de la jornada.
 *
 * Prototipo (navegador): se programan con temporizadores mientras la página
 * está abierta y usan la Notification API si el usuario dio permiso.
 * Fase 3: esta misma interfaz se implementará con las notificaciones locales
 * de Capacitor, que el sistema dispara aunque la app esté cerrada.
 */
export interface ScheduledNotification {
  id: string;
  at: number;
  title: string;
  body: string;
}

const timers = new Map<string, number>();

/** Cancela todo (p. ej. al cambiar la velocidad del reloj en modo desarrollo). */
export function clearAll() {
  for (const t of timers.values()) clearTimeout(t);
  timers.clear();
}

export async function requestPermission() {
  try {
    if ('Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission();
    }
  } catch {
    /* navegador sin soporte */
  }
}

/** Dentro del juego los avisos se muestran en pantalla; esto es para cuando la app está en segundo plano. */
function show(n: ScheduledNotification) {
  try {
    if ('Notification' in window && Notification.permission === 'granted' && document.hidden) {
      new Notification(n.title, { body: n.body, tag: n.id });
    }
  } catch {
    /* algunos móviles solo permiten notificaciones desde un service worker */
  }
}

/**
 * Sustituye todas las notificaciones programadas. `nowMs` es la hora del
 * juego y `speed` su velocidad, para que en modo desarrollo también suenen.
 */
export function scheduleAll(list: ScheduledNotification[], nowMs: number, speed: number) {
  const wanted = new Set(list.map((n) => n.id));
  for (const [id, t] of timers) {
    if (!wanted.has(id)) {
      clearTimeout(t);
      timers.delete(id);
    }
  }
  for (const n of list) {
    if (timers.has(n.id) || n.at <= nowMs) continue;
    const delay = (n.at - nowMs) / Math.max(1, speed);
    if (delay > 2 ** 31 - 1) continue;
    timers.set(
      n.id,
      window.setTimeout(() => {
        timers.delete(n.id);
        show(n);
      }, delay),
    );
  }
}
