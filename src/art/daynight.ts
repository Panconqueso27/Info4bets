/**
 * Ciclo día/noche sincronizado con la hora del dispositivo.
 * Interpola entre fotogramas clave del cielo según la hora local.
 */
export interface Light {
  skyTop: number;
  skyBottom: number;
  /** Tinte multiplicativo para edificios y calle. */
  ambient: number;
  /** 0 = pleno día, 1 = noche cerrada: controla ventanas, neones y farolas. */
  night: number;
  /** 0–1: posición del sol en su arco (null de noche). */
  sun: number | null;
  /** 0–1: posición de la luna en su arco (null de día). */
  moon: number | null;
  label: string;
}

interface Key {
  h: number;
  top: number;
  bottom: number;
  ambient: number;
  night: number;
}

const KEYS: Key[] = [
  { h: 0, top: 0x05030f, bottom: 0x1a1240, ambient: 0x5a58a6, night: 1 },
  { h: 4.5, top: 0x07051a, bottom: 0x241a52, ambient: 0x5c5aa8, night: 1 },
  { h: 6, top: 0x2b2a6b, bottom: 0xf08a5d, ambient: 0xb88a90, night: 0.6 },
  { h: 7.5, top: 0x4f8fd6, bottom: 0xf7c58f, ambient: 0xf8d4b0, night: 0.15 },
  { h: 10, top: 0x3d86d9, bottom: 0xa8d4f2, ambient: 0xffffff, night: 0 },
  { h: 16, top: 0x3a7fd0, bottom: 0xb3d6ee, ambient: 0xfff6ea, night: 0 },
  { h: 18.5, top: 0x5d5aa8, bottom: 0xf59a5b, ambient: 0xffb080, night: 0.25 },
  { h: 19.75, top: 0x2c2366, bottom: 0xd2546e, ambient: 0xb87890, night: 0.65 },
  { h: 21, top: 0x0b0824, bottom: 0x2d1f5e, ambient: 0x6a5eaa, night: 0.95 },
  { h: 24, top: 0x05030f, bottom: 0x1a1240, ambient: 0x5a58a6, night: 1 },
];

export function lerpColor(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
  const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  return (
    (Math.round(ar + (br - ar) * t) << 16) |
    (Math.round(ag + (bg - ag) * t) << 8) |
    Math.round(ab + (bb - ab) * t)
  );
}

export function lightAt(ms: number): Light {
  const d = new Date(ms);
  const h = d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600;
  let i = 0;
  while (i < KEYS.length - 2 && KEYS[i + 1].h <= h) i++;
  const a = KEYS[i];
  const b = KEYS[i + 1];
  const t = (h - a.h) / (b.h - a.h);
  const sunUp = 6, sunDown = 19.75;
  const sun = h >= sunUp && h <= sunDown ? (h - sunUp) / (sunDown - sunUp) : null;
  const moonH = h >= sunDown ? h - sunDown : h < sunUp ? h + 24 - sunDown : null;
  const moon = moonH === null ? null : moonH / (24 - sunDown + sunUp);
  let label = 'Noche';
  if (h >= 5.5 && h < 8) label = 'Amanecer';
  else if (h >= 8 && h < 12) label = 'Mañana';
  else if (h >= 12 && h < 18) label = 'Tarde';
  else if (h >= 18 && h < 20.5) label = 'Atardecer';
  return {
    skyTop: lerpColor(a.top, b.top, t),
    skyBottom: lerpColor(a.bottom, b.bottom, t),
    ambient: lerpColor(a.ambient, b.ambient, t),
    night: a.night + (b.night - a.night) * t,
    sun,
    moon,
    label,
  };
}
