/**
 * Taller de móviles del inmigrante: catálogo de piezas, montaje en la mesa,
 * nota del diseño y mercado. Funciones puras (sin tocar el estado), para
 * que las use tanto la lógica de la partida como la mesa del taller.
 *
 * El móvil se diseña en una cuadrícula con dos capas:
 *  - frontal: pantalla y cámara (la cámara no puede ir bajo la pantalla);
 *  - interior: procesador y batería (no pueden solaparse).
 * La carcasa (forma) fija el tamaño de la cuadrícula.
 */

export type PartKind = 'forma' | 'pantalla' | 'camara' | 'procesador' | 'memoria' | 'bateria';
export const PART_KINDS: PartKind[] = ['forma', 'pantalla', 'camara', 'procesador', 'memoria', 'bateria'];
export const KIND_LABEL: Record<PartKind, string> = { forma: 'Forma', pantalla: 'Pantalla', camara: 'Cámara', procesador: 'Procesador', memoria: 'Memoria', bateria: 'Batería' };
export const KIND_ICON: Record<PartKind, string> = { forma: '📱', pantalla: '🖥', camara: '📷', procesador: '🧠', memoria: '💾', bateria: '🔋' };

export interface Part {
  id: string;
  kind: PartKind;
  name: string;
  /** Calidad de 1 a 10. */
  q: number;
  /** Precio para desbloquearla (0 = de serie). */
  price: number;
  /** Tamaño en celdas (para la forma, el de la carcasa). */
  w: number;
  h: number;
  /** Consumo (pantalla, procesador), capacidad (batería), calor (procesador). */
  drain?: number;
  cap?: number;
  heat?: number;
  /** Forma: estilo (atractivo) y peso. */
  style?: number;
  /** Coste de fabricación por unidad. */
  unit: number;
  /** Aspecto de la pieza en la mesa. */
  look: string;
  note: string;
}

const P = (p: Part) => p;

/** 5 piezas de serie (gratis) y 5 de pago por tipo, de peor a mejor. */
export const PARTS: Part[] = [
  // --- formas (carcasas): el tamaño es la cuadrícula del móvil
  P({ id: 'f-ladrillo', kind: 'forma', name: 'Ladrillo', q: 2, price: 0, w: 6, h: 12, style: 1, unit: 12, look: 'ladrillo', note: 'Enorme y robusto. Cabe de todo, pero nadie lo quiere en el bolsillo.' }),
  P({ id: 'f-clasico', kind: 'forma', name: 'Clásico', q: 4, price: 0, w: 5, h: 10, style: 3, unit: 15, look: 'clasico', note: 'La barra de toda la vida.' }),
  P({ id: 'f-compacto', kind: 'forma', name: 'Compacto', q: 5, price: 0, w: 4, h: 9, style: 4, unit: 16, look: 'compacto', note: 'Pequeño: cuesta meterlo todo.' }),
  P({ id: 'f-concha', kind: 'forma', name: 'Concha', q: 6, price: 0, w: 5, h: 9, style: 6, unit: 20, look: 'concha', note: 'Se abre y se cierra. Muy de película.' }),
  P({ id: 'f-deslizante', kind: 'forma', name: 'Deslizante', q: 6, price: 0, w: 5, h: 10, style: 5, unit: 22, look: 'deslizante', note: 'El teclado sale de debajo. ¡Clic!' }),
  P({ id: 'f-cromo', kind: 'forma', name: 'Cromado', q: 7, price: 220, w: 5, h: 10, style: 7, unit: 26, look: 'cromo', note: 'Brilla como un Cadillac.' }),
  P({ id: 'f-curvo', kind: 'forma', name: 'Curvo', q: 8, price: 420, w: 5, h: 10, style: 8, unit: 30, look: 'curvo', note: 'Se adapta a la mano. Elegante.' }),
  P({ id: 'f-titanio', kind: 'forma', name: 'Titanio', q: 8, price: 650, w: 4, h: 10, style: 8, unit: 36, look: 'titanio', note: 'Ligero y fino. Hay que afinar el montaje.' }),
  P({ id: 'f-cristal', kind: 'forma', name: 'Cristal', q: 9, price: 900, w: 5, h: 11, style: 9, unit: 42, look: 'cristal', note: 'Transparente: se ve todo por dentro.' }),
  P({ id: 'f-futuro', kind: 'forma', name: 'Futuro 2000', q: 10, price: 1400, w: 5, h: 11, style: 10, unit: 50, look: 'futuro', note: 'Parece sacado de una película de ciencia ficción.' }),
  // --- pantallas
  P({ id: 'p-led', kind: 'pantalla', name: 'Dígitos LED', q: 1, price: 0, w: 3, h: 1, drain: 1, unit: 4, look: 'led', note: 'Solo números rojos.' }),
  P({ id: 'p-mono', kind: 'pantalla', name: 'LCD verde', q: 2, price: 0, w: 3, h: 3, drain: 1, unit: 6, look: 'mono', note: 'Monocromo, como una calculadora.' }),
  P({ id: 'p-ambar', kind: 'pantalla', name: 'LCD ámbar', q: 3, price: 0, w: 4, h: 3, drain: 2, unit: 8, look: 'ambar', note: 'Más grande y cálida.' }),
  P({ id: 'p-gris', kind: 'pantalla', name: 'LCD grises', q: 4, price: 0, w: 4, h: 4, drain: 2, unit: 10, look: 'gris', note: 'Cuatro tonos de gris. ¡Hasta dibujos!' }),
  P({ id: 'p-mini-color', kind: 'pantalla', name: 'Color mini', q: 5, price: 0, w: 3, h: 3, drain: 3, unit: 14, look: 'color', note: 'Pequeña pero en color.' }),
  P({ id: 'p-color', kind: 'pantalla', name: 'Color 256', q: 6, price: 180, w: 4, h: 4, drain: 3, unit: 18, look: 'color', note: '256 colores. Un espectáculo.' }),
  P({ id: 'p-tft', kind: 'pantalla', name: 'TFT brillante', q: 7, price: 380, w: 4, h: 5, drain: 4, unit: 24, look: 'tft', note: 'Se ve bien hasta al sol.' }),
  P({ id: 'p-panor', kind: 'pantalla', name: 'Panorámica', q: 8, price: 600, w: 4, h: 6, drain: 5, unit: 30, look: 'tft', note: 'Ocupa casi todo el frontal.' }),
  P({ id: 'p-tactil', kind: 'pantalla', name: 'Táctil', q: 9, price: 950, w: 4, h: 6, drain: 5, unit: 40, look: 'tactil', note: 'Se toca con el dedo. ¡Magia!' }),
  P({ id: 'p-holo', kind: 'pantalla', name: 'Retina 3D', q: 10, price: 1500, w: 5, h: 7, drain: 6, unit: 55, look: 'holo', note: 'Imágenes con profundidad. Gasta mucho.' }),
  // --- cámaras (en el frontal, fuera de la pantalla)
  P({ id: 'c-agujero', kind: 'camara', name: 'Estenopeica', q: 1, price: 0, w: 1, h: 1, unit: 2, look: 'c1', note: 'Un agujerito. Fotos borrosas.' }),
  P({ id: 'c-01', kind: 'camara', name: '0,1 MP', q: 2, price: 0, w: 1, h: 1, unit: 4, look: 'c2', note: 'Se adivinan las caras.' }),
  P({ id: 'c-03', kind: 'camara', name: '0,3 MP', q: 3, price: 0, w: 1, h: 1, unit: 6, look: 'c2', note: 'Ya se ven los ojos.' }),
  P({ id: 'c-flash', kind: 'camara', name: '0,3 MP + flash', q: 4, price: 0, w: 2, h: 1, unit: 8, look: 'c3', note: 'Con flash para las fiestas.' }),
  P({ id: 'c-1mp', kind: 'camara', name: '1 MP', q: 5, price: 0, w: 2, h: 2, unit: 11, look: 'c3', note: 'Grande, pero buena.' }),
  P({ id: 'c-2mp', kind: 'camara', name: '2 MP autofoco', q: 6, price: 160, w: 1, h: 1, unit: 15, look: 'c4', note: 'Enfoca sola.' }),
  P({ id: 'c-5mp', kind: 'camara', name: '5 MP', q: 7, price: 340, w: 1, h: 1, unit: 20, look: 'c4', note: 'Fotos de revista.' }),
  P({ id: 'c-zoom', kind: 'camara', name: 'Zoom óptico', q: 8, price: 560, w: 2, h: 1, unit: 26, look: 'c5', note: 'Acerca sin perder calidad.' }),
  P({ id: 'c-doble', kind: 'camara', name: 'Doble lente', q: 9, price: 880, w: 2, h: 1, unit: 34, look: 'c5', note: 'Dos ojos ven mejor que uno.' }),
  P({ id: 'c-pro', kind: 'camara', name: 'Pro 12 MP', q: 10, price: 1300, w: 2, h: 2, unit: 45, look: 'c6', note: 'Mejor que muchas cámaras de verdad.' }),
  // --- procesadores (interior)
  P({ id: 'u-4bit', kind: 'procesador', name: '4 bits', q: 1, price: 0, w: 1, h: 1, drain: 1, heat: 1, unit: 3, look: 'u1', note: 'Suma y poco más.' }),
  P({ id: 'u-8bit', kind: 'procesador', name: '8 bits', q: 2, price: 0, w: 2, h: 1, drain: 1, heat: 1, unit: 5, look: 'u1', note: 'Como un ordenador de casa.' }),
  P({ id: 'u-16bit', kind: 'procesador', name: '16 bits', q: 3, price: 0, w: 2, h: 2, drain: 2, heat: 2, unit: 8, look: 'u2', note: 'Ya mueve algún juego.' }),
  P({ id: 'u-turbo', kind: 'procesador', name: '16 bits turbo', q: 4, price: 0, w: 2, h: 2, drain: 3, heat: 4, unit: 10, look: 'u2', note: 'Rápido, pero se calienta.' }),
  P({ id: 'u-32bit', kind: 'procesador', name: '32 bits', q: 5, price: 0, w: 2, h: 2, drain: 3, heat: 3, unit: 13, look: 'u3', note: 'Potente para su tamaño.' }),
  P({ id: 'u-risc', kind: 'procesador', name: 'RISC', q: 6, price: 200, w: 2, h: 2, drain: 2, heat: 2, unit: 17, look: 'u3', note: 'Eficiente: rinde y gasta poco.' }),
  P({ id: 'u-doble', kind: 'procesador', name: 'Doble núcleo', q: 7, price: 420, w: 2, h: 2, drain: 4, heat: 4, unit: 23, look: 'u4', note: 'Hace dos cosas a la vez.' }),
  P({ id: 'u-cuadruple', kind: 'procesador', name: 'Cuatro núcleos', q: 8, price: 700, w: 3, h: 2, drain: 4, heat: 5, unit: 30, look: 'u4', note: 'Vuela. Necesita aire.' }),
  P({ id: 'u-chip', kind: 'procesador', name: 'Chip neural', q: 9, price: 1000, w: 2, h: 2, drain: 3, heat: 3, unit: 38, look: 'u5', note: 'Aprende lo que te gusta.' }),
  P({ id: 'u-quantum', kind: 'procesador', name: 'Cuántico', q: 10, price: 1600, w: 2, h: 2, drain: 5, heat: 6, unit: 52, look: 'u5', note: 'Nadie sabe cómo funciona.' }),
  // --- memoria (interior): mejor cuanto más cerca del procesador
  P({ id: 'm-16k', kind: 'memoria', name: '16 KB', q: 1, price: 0, w: 1, h: 1, unit: 2, look: 'm1', note: 'Caben diez números de teléfono.' }),
  P({ id: 'm-64k', kind: 'memoria', name: '64 KB', q: 2, price: 0, w: 2, h: 1, unit: 3, look: 'm1', note: 'Agenda y alguna nota.' }),
  P({ id: 'm-256k', kind: 'memoria', name: '256 KB', q: 3, price: 0, w: 2, h: 1, unit: 5, look: 'm2', note: 'Para mensajes cortos.' }),
  P({ id: 'm-1m', kind: 'memoria', name: '1 MB', q: 4, price: 0, w: 1, h: 2, unit: 7, look: 'm2', note: 'Cabe un juego.' }),
  P({ id: 'm-4m', kind: 'memoria', name: '4 MB', q: 5, price: 0, w: 2, h: 2, unit: 9, look: 'm3', note: 'Fotos y melodías.' }),
  P({ id: 'm-16m', kind: 'memoria', name: '16 MB', q: 6, price: 150, w: 2, h: 1, unit: 12, look: 'm3', note: 'Cientos de fotos.' }),
  P({ id: 'm-64m', kind: 'memoria', name: '64 MB', q: 7, price: 320, w: 2, h: 1, unit: 16, look: 'm4', note: 'Música en el bolsillo.' }),
  P({ id: 'm-256m', kind: 'memoria', name: '256 MB', q: 8, price: 540, w: 2, h: 1, unit: 22, look: 'm4', note: 'Hasta vídeos.' }),
  P({ id: 'm-1g', kind: 'memoria', name: '1 GB', q: 9, price: 820, w: 1, h: 2, unit: 30, look: 'm5', note: 'Un giga. ¡Un giga!' }),
  P({ id: 'm-flash', kind: 'memoria', name: '8 GB flash', q: 10, price: 1200, w: 2, h: 1, unit: 40, look: 'm5', note: 'Toda una biblioteca.' }),
  // --- baterías (interior)
  P({ id: 'b-pilas', kind: 'bateria', name: 'Pilas AA', q: 1, price: 0, w: 2, h: 3, cap: 3, unit: 2, look: 'b1', note: 'Cuatro pilas del quiosco.' }),
  P({ id: 'b-nicd', kind: 'bateria', name: 'Ni-Cd', q: 2, price: 0, w: 3, h: 3, cap: 5, unit: 4, look: 'b2', note: 'Pesada y con efecto memoria.' }),
  P({ id: 'b-nicd-l', kind: 'bateria', name: 'Ni-Cd grande', q: 3, price: 0, w: 4, h: 4, cap: 8, unit: 6, look: 'b2', note: 'Dura, pero ocupa medio móvil.' }),
  P({ id: 'b-nimh', kind: 'bateria', name: 'Ni-MH', q: 4, price: 0, w: 3, h: 3, cap: 7, unit: 8, look: 'b3', note: 'Más carga en menos sitio.' }),
  P({ id: 'b-nimh-s', kind: 'bateria', name: 'Ni-MH fina', q: 5, price: 0, w: 3, h: 2, cap: 6, unit: 10, look: 'b3', note: 'Plana y ligera.' }),
  P({ id: 'b-litio', kind: 'bateria', name: 'Litio', q: 6, price: 190, w: 3, h: 3, cap: 10, unit: 14, look: 'b4', note: 'La revolución de la batería.' }),
  P({ id: 'b-litio-f', kind: 'bateria', name: 'Litio fina', q: 7, price: 360, w: 3, h: 2, cap: 9, unit: 18, look: 'b4', note: 'Cabe en cualquier sitio.' }),
  P({ id: 'b-polimero', kind: 'bateria', name: 'Polímero', q: 8, price: 580, w: 3, h: 3, cap: 13, unit: 24, look: 'b5', note: 'Dura todo el día.' }),
  P({ id: 'b-solar', kind: 'bateria', name: 'Solar + litio', q: 9, price: 900, w: 3, h: 3, cap: 15, unit: 32, look: 'b5', note: 'Se carga al sol del parque.' }),
  P({ id: 'b-atomica', kind: 'bateria', name: 'Grafeno', q: 10, price: 1400, w: 3, h: 2, cap: 18, unit: 44, look: 'b6', note: 'Una semana sin cargar.' }),
];
export const PART_BY_ID: Record<string, Part> = Object.fromEntries(PARTS.map((p) => [p.id, p]));
export const partsOf = (k: PartKind) => PARTS.filter((p) => p.kind === k);

/** Una pieza colocada en la mesa (en celdas de la carcasa). */
export interface Placed {
  id: string;
  x: number;
  y: number;
  /** Girada 90°. */
  rot: boolean;
}

export interface PhoneDesign {
  name: string;
  /** Carcasa elegida. */
  shape: string;
  /** Color de la carcasa (id de COLORS). */
  color?: string;
  pantalla: Placed | null;
  camara: Placed | null;
  procesador: Placed | null;
  memoria?: Placed | null;
  bateria: Placed | null;
  /** Funciones extra (ids de EXTRAS), hasta MAX_EXTRAS. */
  extras?: string[];
}

export const FRONT: PartKind[] = ['pantalla', 'camara'];
export const INSIDE: PartKind[] = ['procesador', 'memoria', 'bateria'];

export function emptyDesign(name = 'Mi móvil'): PhoneDesign {
  return { name, shape: 'f-clasico', color: 'negro', pantalla: null, camara: null, procesador: null, memoria: null, bateria: null, extras: [] };
}

/** Colores de carcasa: algunos de moda suben el diseño; los especiales son de pago. */
export interface PhoneColor {
  id: string;
  name: string;
  hex: string;
  /** Lo que gusta al público (0–8). */
  style: number;
  price: number;
}
export const COLORS: PhoneColor[] = [
  { id: 'negro', name: 'Negro', hex: '#2a2a33', style: 3, price: 0 },
  { id: 'gris', name: 'Gris oficina', hex: '#8a8e94', style: 1, price: 0 },
  { id: 'blanco', name: 'Blanco', hex: '#e8e4d8', style: 3, price: 0 },
  { id: 'rojo', name: 'Rojo', hex: '#c0392b', style: 4, price: 0 },
  { id: 'azul', name: 'Azul', hex: '#2f5fa8', style: 3, price: 0 },
  { id: 'rosa', name: 'Rosa chicle', hex: '#e8619e', style: 5, price: 0 },
  { id: 'verde', name: 'Verde menta', hex: '#5fbf8a', style: 4, price: 0 },
  { id: 'oro', name: 'Oro', hex: '#d8a830', style: 7, price: 300 },
  { id: 'neon', name: 'Neón', hex: '#ff4f9a', style: 7, price: 450 },
  { id: 'pixel', name: 'Edición Pixelopolis', hex: '#7b4fa0', style: 8, price: 700 },
];
export const COLOR_BY_ID: Record<string, PhoneColor> = Object.fromEntries(COLORS.map((c) => [c.id, c]));

/** Funciones extra: suben la nota de "extras" pero encarecen cada unidad. */
export interface PhoneExtra {
  id: string;
  name: string;
  icon: string;
  /** Puntos de extras (0–100 en total). */
  pts: number;
  unit: number;
  price: number;
  note: string;
}
export const MAX_EXTRAS = 3;
export const EXTRAS: PhoneExtra[] = [
  { id: 'antena', name: 'Antena extensible', icon: '📡', pts: 14, unit: 2, price: 0, note: 'Más cobertura en el metro.' },
  { id: 'linterna', name: 'Linterna', icon: '🔦', pts: 16, unit: 3, price: 0, note: 'Para los apagones de Nueva York.' },
  { id: 'radio', name: 'Radio FM', icon: '📻', pts: 18, unit: 4, price: 0, note: 'Los Yankees en directo.' },
  { id: 'serpiente', name: 'Juego de la serpiente', icon: '🐍', pts: 22, unit: 2, price: 0, note: 'Adictivo. Nadie podrá soltarlo.' },
  { id: 'qwerty', name: 'Teclado QWERTY', icon: '⌨', pts: 22, unit: 6, price: 0, note: 'Escribir mensajes sin sufrir.' },
  { id: 'agua', name: 'Resistente al agua', icon: '💧', pts: 28, unit: 8, price: 260, note: 'Sobrevive a un charco de la Quinta.' },
  { id: 'altavoz', name: 'Altavoz estéreo', icon: '🔊', pts: 26, unit: 6, price: 320, note: 'Música para todo el vagón.' },
  { id: 'tv', name: 'Sintonizador de TV', icon: '📺', pts: 34, unit: 10, price: 600, note: 'El telediario en la mano.' },
  { id: 'solar', name: 'Carga solar', icon: '☀', pts: 34, unit: 12, price: 800, note: 'Se carga en Central Park.' },
  { id: 'huella', name: 'Lector de huella', icon: '☝', pts: 42, unit: 14, price: 1100, note: 'Seguridad de película de espías.' },
];
export const EXTRA_BY_ID: Record<string, PhoneExtra> = Object.fromEntries(EXTRAS.map((e) => [e.id, e]));

/** Campaña de publicidad al lanzar. */
export const MARKETING = [
  { id: 'boca', name: 'Boca a boca', cost: 0, mul: 1, bonus: 0, note: 'Gratis. Que corra la voz.' },
  { id: 'radio', name: 'Cuñas de radio', cost: 150, mul: 1.3, bonus: 2, note: 'Suena en las emisoras de la ciudad.' },
  { id: 'tv', name: 'Anuncio en TV', cost: 450, mul: 1.7, bonus: 5, note: 'En el descanso de los Knicks.' },
  { id: 'times', name: 'Pantalla en Times Square', cost: 1000, mul: 2.2, bonus: 8, note: 'Todo Nueva York lo verá.' },
] as const;
/** Tamaño de la primera tirada: más barata y corta o más cara y sin límite de ventas. */
export const RUNS = [
  { id: 'pequena', name: 'Pequeña (500 uds.)', mul: 0.6, cap: 2 },
  { id: 'media', name: 'Media (2.000 uds.)', mul: 1, cap: 5 },
  { id: 'grande', name: 'Grande (10.000 uds.)', mul: 1.8, cap: 99 },
] as const;
export type MarketingId = (typeof MARKETING)[number]['id'];
export type RunId = (typeof RUNS)[number]['id'];

/** Tamaño de una pieza colocada (con el giro). */
export function sizeOf(pl: Placed) {
  const p = PART_BY_ID[pl.id];
  return pl.rot ? { w: p.h, h: p.w } : { w: p.w, h: p.h };
}

const overlap = (a: Placed, b: Placed) => {
  const A = sizeOf(a);
  const B = sizeOf(b);
  return a.x < b.x + B.w && b.x < a.x + A.w && a.y < b.y + B.h && b.y < a.y + A.h;
};

/** Huecos entre dos piezas (0 = se tocan o se solapan). */
function gap(a: Placed, b: Placed) {
  const A = sizeOf(a);
  const B = sizeOf(b);
  const dx = Math.max(0, Math.max(a.x, b.x) - Math.min(a.x + A.w, b.x + B.w));
  const dy = Math.max(0, Math.max(a.y, b.y) - Math.min(a.y + A.h, b.y + B.h));
  return Math.max(dx, dy);
}

export interface Issue {
  /** grave = no se puede fabricar. */
  level: 'grave' | 'aviso' | 'bien';
  text: string;
}

export interface Rating {
  /** Puntuaciones 0–100. */
  rendimiento: number;
  camara: number;
  pantalla: number;
  autonomia: number;
  diseno: number;
  extras: number;
  /** Nota global (0–100) y si se puede fabricar. */
  total: number;
  ok: boolean;
  issues: Issue[];
  /** Coste de fabricar cada unidad. */
  unitCost: number;
}

/** Nota del diseño: calidad de las piezas y cómo están colocadas. */
export function rateDesign(d: PhoneDesign): Rating {
  const shape = PART_BY_ID[d.shape];
  const issues: Issue[] = [];
  const out = (pl: Placed) => {
    const s = sizeOf(pl);
    return pl.x < 0 || pl.y < 0 || pl.x + s.w > shape.w || pl.y + s.h > shape.h;
  };
  for (const k of ['pantalla', 'camara', 'procesador', 'memoria', 'bateria'] as const) {
    const pl = d[k];
    if (!pl) issues.push({ level: 'grave', text: `Falta ${KIND_LABEL[k].toLowerCase()}.` });
    else if (out(pl)) issues.push({ level: 'grave', text: `${KIND_LABEL[k]} se sale de la carcasa.` });
  }
  const { pantalla: scr, camara: cam, procesador: cpu, bateria: bat } = d;
  const mem = d.memoria ?? null;
  if (cpu && bat && overlap(cpu, bat)) issues.push({ level: 'grave', text: 'El procesador y la batería están uno encima del otro.' });
  if (mem && cpu && overlap(mem, cpu)) issues.push({ level: 'grave', text: 'La memoria está encima del procesador.' });
  if (mem && bat && overlap(mem, bat)) issues.push({ level: 'grave', text: 'La memoria está encima de la batería.' });
  if (scr && cam && overlap(scr, cam)) issues.push({ level: 'grave', text: 'La cámara queda tapada por la pantalla.' });

  const q = (pl: Placed | null) => (pl ? PART_BY_ID[pl.id].q : 0);
  let rendimiento = q(cpu) * 7.5 + q(mem) * 2.5;
  if (mem && cpu && !overlap(mem, cpu)) {
    const g = gap(mem, cpu);
    if (g === 0) {
      rendimiento += 6;
      issues.push({ level: 'bien', text: 'Memoria junto al procesador: va rapidísimo.' });
    } else if (g >= 3) {
      rendimiento -= 6;
      issues.push({ level: 'aviso', text: 'La memoria está lejos del procesador: va lento.' });
    }
  }
  let camara = q(cam) * 10;
  let pantalla = q(scr) * 10;
  const color = COLOR_BY_ID[d.color ?? 'negro'] ?? COLORS[0];
  let diseno = shape.style! * 9 + color.style * 1.5;
  // --- colocación
  if (cam && !out(cam)) {
    if (cam.y === 0) issues.push({ level: 'bien', text: 'Cámara arriba, donde debe estar.' });
    else if (cam.y + sizeOf(cam).h >= shape.h) {
      camara -= 25;
      issues.push({ level: 'aviso', text: 'Cámara abajo: saldrá el dedo en todas las fotos.' });
    } else {
      camara -= 12;
      issues.push({ level: 'aviso', text: 'Cámara en medio: las fotos salen torcidas.' });
    }
  }
  if (scr && !out(scr)) {
    const s = sizeOf(scr);
    const cover = (s.w * s.h) / (shape.w * shape.h);
    if (cover >= 0.5) {
      pantalla += 12;
      issues.push({ level: 'bien', text: '¡Casi todo pantalla! Impresiona.' });
    } else if (cover < 0.2) {
      pantalla -= 10;
      issues.push({ level: 'aviso', text: 'La pantalla se ve diminuta en esa carcasa.' });
    }
    // la pantalla girada se lee de lado
    const sp = PART_BY_ID[scr.id];
    if (scr.rot && sp.w !== sp.h) {
      pantalla -= 6;
      issues.push({ level: 'aviso', text: 'Pantalla girada: se lee de lado.' });
    }
    if (scr.y >= shape.h / 2) {
      pantalla -= 8;
      diseno -= 6;
      issues.push({ level: 'aviso', text: 'Pantalla muy abajo: hay que bajar la vista.' });
    }
  }
  if (cpu && bat && !overlap(cpu, bat)) {
    const g = gap(cpu, bat);
    const heat = PART_BY_ID[cpu.id].heat ?? 1;
    if (g === 0) {
      rendimiento -= heat * 4;
      issues.push({ level: 'aviso', text: '🔥 El procesador toca la batería: se calienta y va lento.' });
    } else if (g >= 2) {
      rendimiento += 4;
      issues.push({ level: 'bien', text: 'Buena ventilación entre procesador y batería.' });
    }
    if (heat >= 5 && g < 2) {
      rendimiento -= 8;
      issues.push({ level: 'aviso', text: 'Ese procesador necesita más aire alrededor.' });
    }
  }
  // equilibrio: el peso de batería y procesador cerca del centro
  const inside = [cpu, bat, mem].filter(Boolean) as Placed[];
  if (inside.length >= 2 && !inside.some(out)) {
    let mx = 0;
    let my = 0;
    let m = 0;
    for (const pl of inside) {
      const s = sizeOf(pl);
      const w = s.w * s.h * (pl === bat ? 2 : 1);
      mx += (pl.x + s.w / 2) * w;
      my += (pl.y + s.h / 2) * w;
      m += w;
    }
    const off = Math.hypot(mx / m - shape.w / 2, (my / m - shape.h / 2) * 0.6) / Math.hypot(shape.w / 2, shape.h / 2);
    if (off > 0.32) {
      diseno -= Math.round(off * 30);
      issues.push({ level: 'aviso', text: 'Está desequilibrado: pesa de un lado y se cae de la mano.' });
    } else if (off < 0.15) {
      diseno += 5;
      issues.push({ level: 'bien', text: 'Bien equilibrado en la mano.' });
    }
    // espacio desaprovechado: carcasa enorme para lo que lleva
    const used = inside.reduce((a, pl) => a + sizeOf(pl).w * sizeOf(pl).h, 0) / (shape.w * shape.h);
    if (used < 0.22) {
      diseno -= 10;
      issues.push({ level: 'aviso', text: 'Sobra mucho hueco: es un ladrillo vacío.' });
    }
  }
  // autonomía: lo que aguanta la batería con lo que gastan pantalla y procesador
  const drain = (scr ? PART_BY_ID[scr.id].drain ?? 0 : 0) + (cpu ? PART_BY_ID[cpu.id].drain ?? 0 : 0);
  const cap = bat ? PART_BY_ID[bat.id].cap ?? 0 : 0;
  const ratio = drain ? cap / drain : 0;
  let autonomiaBonus = 0;
  let autonomia = Math.round(Math.min(100, ratio * 40));
  if (bat && ratio < 0.9) issues.push({ level: 'aviso', text: '🔋 La batería no aguanta ni una tarde.' });
  else if (ratio >= 2.2) issues.push({ level: 'bien', text: 'Batería para varios días.' });

  // extras: suman, pero más de dos hacen el móvil más gordo
  const ex = (d.extras ?? []).map((id) => EXTRA_BY_ID[id]).filter(Boolean);
  let extras = ex.reduce((a, e) => a + e.pts, 0);
  if (ex.length > 2) {
    diseno -= 6;
    issues.push({ level: 'aviso', text: 'Con tantas funciones queda gordito.' });
  }
  if (ex.some((e) => e.id === 'solar' || e.id === 'linterna') && cap) autonomiaBonus += ex.some((e) => e.id === 'solar') ? 15 : 0;

  const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
  rendimiento = clamp(rendimiento);
  camara = clamp(camara);
  pantalla = clamp(pantalla);
  autonomia = clamp(autonomia + autonomiaBonus);
  diseno = clamp(diseno);
  extras = clamp(extras);
  const total = clamp(rendimiento * 0.22 + pantalla * 0.22 + camara * 0.16 + autonomia * 0.14 + diseno * 0.14 + extras * 0.12);
  const unitCost = [d.shape, scr?.id, cam?.id, cpu?.id, mem?.id, bat?.id].reduce((a, id) => a + (id ? PART_BY_ID[id].unit : 0), 0) + ex.reduce((a, e) => a + e.unit, 0);
  return { rendimiento, camara, pantalla, autonomia, diseno, extras, total, ok: !issues.some((i) => i.level === 'grave'), issues, unitCost };
}

// ---------------------------------------------------------------------------
// Mercado
// ---------------------------------------------------------------------------

/** Lo que exige el mercado el día `day`: cada semana la competencia saca algo mejor. */
export function marketLevel(day: number): number {
  return Math.round(Math.min(95, 40 + day * 0.8 + Math.sqrt(day) * 2));
}

/** Coste de lanzar un modelo: moldes, publicidad y la primera tirada. */
export function launchCost(r: Rating, run: RunId = 'media', marketing: MarketingId = 'boca'): number {
  const R = RUNS.find((x) => x.id === run)!;
  const M = MARKETING.find((x) => x.id === marketing)!;
  return Math.round(150 + r.unitCost * 6 * R.mul + M.cost);
}

/** Precio que el público ve razonable para esa nota. */
export function fairPrice(r: Rating): number {
  return Math.round(r.unitCost * 1.6 + r.total * 2.2);
}

export type Outcome = 'fracaso' | 'discreto' | 'exito' | 'bombazo';
export const OUTCOME_LABEL: Record<Outcome, string> = { fracaso: 'Fracaso', discreto: 'Ventas discretas', exito: '¡Éxito!', bombazo: '¡BOMBAZO!' };

/**
 * Cómo le va al móvil: la nota contra lo que exige el mercado, el precio
 * contra el justo y un poco de suerte (`luck` de -1 a 1).
 */
export function marketResult(r: Rating, price: number, day: number, luck: number, marketing: MarketingId = 'boca', run: RunId = 'media') {
  const M = MARKETING.find((x) => x.id === marketing)!;
  const R = RUNS.find((x) => x.id === run)!;
  const level = marketLevel(day);
  const fair = fairPrice(r);
  // caro resta mucho; barato suma algo pero se gana menos por unidad
  const priceFx = ((fair - price) / Math.max(1, fair)) * 22;
  const score = r.total - level + Math.max(-30, Math.min(10, priceFx)) + luck * 7 + M.bonus;
  const outcome: Outcome = score < -6 ? 'fracaso' : score < 4 ? 'discreto' : score < 16 ? 'exito' : 'bombazo';
  const margin = Math.max(0, price - r.unitCost);
  // unidades al día al principio, según el resultado
  const demand = { fracaso: 0.4, discreto: 1.4, exito: 3.2, bombazo: 6 }[outcome] * (1 + Math.max(0, score) / 30) * M.mul;
  // con una tirada corta se agota: se venden menos de los que se pedían
  const units = Math.min(demand, R.cap);
  const soldOut = demand > R.cap;
  return { level, fair, score: Math.round(score), outcome, margin, units: Math.round(units * 10) / 10, soldOut };
}

/** Un modelo a la venta. */
export interface PhoneModel {
  id: string;
  name: string;
  version: number;
  design: PhoneDesign;
  total: number;
  price: number;
  margin: number;
  /** Unidades al día cuando salió. */
  units: number;
  launchedDay: number;
  outcome: Outcome;
  /** Total ganado con este modelo. */
  earned: number;
  /** Se dejó de vender (sustituido o pasado de moda). */
  retired?: boolean;
}

/**
 * Ingreso del día de un modelo: las ventas bajan con el tiempo y cuanto
 * más se aleja de lo que pide el mercado, antes se olvida.
 */
export function modelIncome(m: PhoneModel, day: number): number {
  if (m.retired || day <= m.launchedDay) return 0;
  const age = day - m.launchedDay;
  const behind = Math.max(0, marketLevel(day) - m.total);
  const units = m.units * Math.pow(0.95, age) * Math.max(0, 1 - behind / 30);
  // las unidades son cientos de móviles; a ti te llega una décima parte del margen (royalties)
  return Math.round(units * m.margin * 0.1);
}

export interface PhoneLab {
  /** Piezas de pago desbloqueadas. */
  owned: string[];
  draft: PhoneDesign;
  models: PhoneModel[];
  /** Titulares en la sección de tecnología del periódico. */
  press: { date: string; title: string; text: string }[];
}

export function emptyLab(): PhoneLab {
  return { owned: [], draft: emptyDesign(), models: [], press: [] };
}

/** Precio de algo que se desbloquea: pieza ("id"), color ("color:id") o extra ("extra:id"). */
export function itemPrice(key: string): number {
  if (key.startsWith('color:')) return COLOR_BY_ID[key.slice(6)]?.price ?? 0;
  if (key.startsWith('extra:')) return EXTRA_BY_ID[key.slice(6)]?.price ?? 0;
  return PART_BY_ID[key]?.price ?? 0;
}
export function itemName(key: string): string {
  if (key.startsWith('color:')) return `color ${COLOR_BY_ID[key.slice(6)]?.name ?? ''}`;
  if (key.startsWith('extra:')) return EXTRA_BY_ID[key.slice(6)]?.name ?? '';
  return PART_BY_ID[key]?.name ?? '';
}
export const hasPart = (lab: PhoneLab | undefined, key: string) => itemPrice(key) === 0 || !!lab?.owned.includes(key);
