/**
 * Fábrica de coches del alcalde (Pixelopolis Motors): catálogo de piezas,
 * pruebas (circuito, choque y emisiones), mercado con tendencias que
 * cambian cada semana y resultado de cada lanzamiento con sus causas.
 * Funciones puras; las acciones están en cars.ts.
 */

export type CarKind = 'carroceria' | 'motor' | 'caja' | 'ruedas' | 'interior' | 'seguridad';
export const CAR_KINDS: CarKind[] = ['carroceria', 'motor', 'caja', 'ruedas', 'interior', 'seguridad'];
export const CAR_KIND_LABEL: Record<CarKind, string> = { carroceria: 'Carrocería', motor: 'Motor', caja: 'Cambio', ruedas: 'Ruedas', interior: 'Interior', seguridad: 'Seguridad' };

export type Segment = 'popular' | 'familia' | 'trabajo' | 'lujo' | 'deportivo';
export const SEGMENT_LABEL: Record<Segment, string> = { popular: 'popular', familia: 'familiar', trabajo: 'de trabajo', lujo: 'de lujo', deportivo: 'deportivo' };

/** Valores de 0 a 10 que aporta cada pieza (los que no tiene, no cuentan). */
export interface CarStats {
  pot?: number;
  efi?: number;
  emis?: number;
  seg?: number;
  conf?: number;
  fiab?: number;
  estilo?: number;
  /** Peso en kg (se suma). */
  peso?: number;
}

export interface CarPart extends CarStats {
  id: string;
  kind: CarKind;
  name: string;
  q: number;
  /** Precio de desbloqueo ($, 0 = de serie). */
  price: number;
  /** Coste por coche fabricado ($). */
  unit: number;
  look: string;
  note: string;
  /** Carrocería: segmento, plazas y si admite motor central. */
  segment?: Segment;
  seats?: number;
  mid?: boolean;
  /** Motor: caballos. */
  cv?: number;
}

const C = (p: CarPart) => p;
const K = 1000;

export const CAR_PARTS: CarPart[] = [
  // --- carrocerías
  C({ id: 'k-compacto', kind: 'carroceria', name: 'Compacto', q: 3, price: 0, unit: 1800, look: 'compacto', segment: 'popular', seats: 4, estilo: 3, conf: 3, peso: 820, note: 'Pequeño y barato. Aparca en cualquier hueco de Manhattan.' }),
  C({ id: 'k-berlina', kind: 'carroceria', name: 'Berlina', q: 4, price: 0, unit: 2600, look: 'berlina', segment: 'familia', seats: 5, estilo: 4, conf: 5, peso: 1150, note: 'El coche de toda la vida, con su maletero.' }),
  C({ id: 'k-familiar', kind: 'carroceria', name: 'Familiar', q: 4, price: 0, unit: 2900, look: 'familiar', segment: 'familia', seats: 7, estilo: 3, conf: 6, peso: 1350, note: 'Siete plazas y sitio para el perro.' }),
  C({ id: 'k-pickup', kind: 'carroceria', name: 'Pickup', q: 4, price: 0, unit: 2700, look: 'pickup', segment: 'trabajo', seats: 3, estilo: 4, conf: 3, peso: 1500, note: 'Para obras, mudanzas y el campo.' }),
  C({ id: 'k-taxi', kind: 'carroceria', name: 'Taxi', q: 5, price: 0, unit: 2800, look: 'taxi', segment: 'trabajo', seats: 5, estilo: 3, conf: 5, fiab: 2, peso: 1250, note: 'Resistente: aguanta doce horas al día.' }),
  C({ id: 'k-coupe', kind: 'carroceria', name: 'Coupé', q: 6, price: 120 * K, unit: 3400, look: 'coupe', segment: 'deportivo', seats: 2, estilo: 7, conf: 4, peso: 1050, mid: true, note: 'Dos puertas y mucha pose.' }),
  C({ id: 'k-deportivo', kind: 'carroceria', name: 'Deportivo', q: 7, price: 220 * K, unit: 4200, look: 'deportivo', segment: 'deportivo', seats: 2, estilo: 8, conf: 3, peso: 980, mid: true, note: 'Bajo, ancho y ruidoso.' }),
  C({ id: 'k-todoterreno', kind: 'carroceria', name: 'Todoterreno', q: 7, price: 260 * K, unit: 4000, look: 'todoterreno', segment: 'trabajo', seats: 5, estilo: 6, conf: 5, fiab: 2, peso: 1700, note: 'Sube aceras y montañas.' }),
  C({ id: 'k-limusina', kind: 'carroceria', name: 'Limusina', q: 8, price: 400 * K, unit: 7500, look: 'limusina', segment: 'lujo', seats: 6, estilo: 8, conf: 9, peso: 2200, note: 'Para estrellas de Broadway.' }),
  C({ id: 'k-super', kind: 'carroceria', name: 'Superdeportivo', q: 10, price: 650 * K, unit: 9000, look: 'super', segment: 'deportivo', seats: 2, estilo: 10, conf: 3, peso: 1150, mid: true, note: 'Puertas de ala de gaviota.' }),
  // --- motores
  C({ id: 'e-12', kind: 'motor', name: '4 cil. 1.2', q: 2, price: 0, unit: 700, look: 'i4', cv: 55, pot: 2, efi: 9, emis: 3, fiab: 7, peso: 90, note: 'Gasta poquísimo. No corre nada.' }),
  C({ id: 'e-16', kind: 'motor', name: '4 cil. 1.6', q: 3, price: 0, unit: 900, look: 'i4', cv: 85, pot: 3, efi: 7, emis: 4, fiab: 7, peso: 105, note: 'El equilibrio de siempre.' }),
  C({ id: 'e-diesel', kind: 'motor', name: 'Diésel 2.0', q: 4, price: 0, unit: 1100, look: 'diesel', cv: 70, pot: 3, efi: 8, emis: 8, fiab: 9, peso: 150, note: 'Eterno, pero echa humo negro.' }),
  C({ id: 'e-6', kind: 'motor', name: '6 cil. 2.8', q: 5, price: 0, unit: 1500, look: 'i6', cv: 140, pot: 5, efi: 4, emis: 6, fiab: 6, peso: 170, note: 'Suave y con fuerza.' }),
  C({ id: 'e-v6', kind: 'motor', name: 'V6 3.0', q: 5, price: 0, unit: 1700, look: 'v6', cv: 165, pot: 6, efi: 4, emis: 6, fiab: 6, peso: 175, note: 'Ruge bien.' }),
  C({ id: 'e-turbo', kind: 'motor', name: '4 cil. turbo', q: 6, price: 150 * K, unit: 1900, look: 'turbo', cv: 190, pot: 7, efi: 6, emis: 5, fiab: 5, peso: 125, note: '¡Pfffsss! Patada a partir de 3.000 vueltas.' }),
  C({ id: 'e-v8', kind: 'motor', name: 'V8 5.0', q: 7, price: 260 * K, unit: 2600, look: 'v8', cv: 260, pot: 8, efi: 2, emis: 8, fiab: 6, peso: 230, note: 'El sonido americano.' }),
  C({ id: 'e-rotativo', kind: 'motor', name: 'Rotativo', q: 7, price: 330 * K, unit: 2400, look: 'rotativo', cv: 210, pot: 7, efi: 3, emis: 6, fiab: 3, peso: 110, note: 'Gira hasta el infinito. Delicado.' }),
  C({ id: 'e-v12', kind: 'motor', name: 'V12 6.0', q: 9, price: 520 * K, unit: 4800, look: 'v12', cv: 420, pot: 10, efi: 1, emis: 9, fiab: 6, peso: 290, note: 'Una bestia italiana.' }),
  C({ id: 'e-electrico', kind: 'motor', name: 'Eléctrico (prototipo)', q: 10, price: 700 * K, unit: 5200, look: 'electrico', cv: 180, pot: 7, efi: 10, emis: 0, fiab: 4, peso: 320, note: 'Silencioso y limpio. Un adelanto de 30 años.' }),
  // --- cajas de cambios
  C({ id: 'g-m3', kind: 'caja', name: 'Manual 3', q: 1, price: 0, unit: 200, look: 'manual', pot: 3, efi: 4, conf: 2, fiab: 8, note: 'Tres marchas y a correr… poco.' }),
  C({ id: 'g-m4', kind: 'caja', name: 'Manual 4', q: 3, price: 0, unit: 260, look: 'manual', pot: 5, efi: 6, conf: 3, fiab: 8, note: 'Lo normal.' }),
  C({ id: 'g-m5', kind: 'caja', name: 'Manual 5', q: 4, price: 0, unit: 320, look: 'manual', pot: 6, efi: 7, conf: 4, fiab: 7, note: 'La quinta para la autopista.' }),
  C({ id: 'g-a3', kind: 'caja', name: 'Automática 3', q: 3, price: 0, unit: 380, look: 'auto', pot: 3, efi: 3, conf: 7, fiab: 7, note: 'Cómoda, pero bebe gasolina.' }),
  C({ id: 'g-a4', kind: 'caja', name: 'Automática 4', q: 5, price: 0, unit: 450, look: 'auto', pot: 4, efi: 5, conf: 8, fiab: 7, note: 'Para el atasco de la Quinta.' }),
  C({ id: 'g-a5', kind: 'caja', name: 'Automática 5', q: 6, price: 110 * K, unit: 560, look: 'auto', pot: 6, efi: 6, conf: 8, fiab: 6, note: 'Suave en todas las marchas.' }),
  C({ id: 'g-sec', kind: 'caja', name: 'Secuencial', q: 7, price: 200 * K, unit: 700, look: 'manual', pot: 9, efi: 6, conf: 4, fiab: 6, note: 'Como en las carreras.' }),
  C({ id: 'g-cvt', kind: 'caja', name: 'Variador continuo', q: 7, price: 240 * K, unit: 650, look: 'auto', pot: 5, efi: 9, conf: 8, fiab: 5, note: 'Sin tirones, gasta poco.' }),
  C({ id: 'g-dsg', kind: 'caja', name: 'Doble embrague', q: 9, price: 380 * K, unit: 900, look: 'auto', pot: 9, efi: 8, conf: 8, fiab: 6, note: 'Rápida y cómoda a la vez.' }),
  C({ id: 'g-elec', kind: 'caja', name: 'Electrónica', q: 10, price: 520 * K, unit: 1100, look: 'auto', pot: 9, efi: 9, conf: 9, fiab: 7, note: 'Un ordenador decide la marcha.' }),
  // --- ruedas y suspensión
  C({ id: 'w-13', kind: 'ruedas', name: 'Acero 13"', q: 1, price: 0, unit: 160, look: 'acero', pot: 3, conf: 4, estilo: 1, fiab: 8, note: 'Con tapacubos de plástico.' }),
  C({ id: 'w-14', kind: 'ruedas', name: 'Acero 14"', q: 2, price: 0, unit: 200, look: 'acero', pot: 4, conf: 5, estilo: 2, fiab: 8, note: 'Un poco más de agarre.' }),
  C({ id: 'w-al14', kind: 'ruedas', name: 'Aleación 14"', q: 4, price: 0, unit: 320, look: 'aleacion', pot: 5, conf: 5, estilo: 5, fiab: 7, note: 'Brillan en el semáforo.' }),
  C({ id: 'w-tt', kind: 'ruedas', name: 'Todoterreno', q: 4, price: 0, unit: 360, look: 'tt', pot: 4, conf: 4, estilo: 4, fiab: 9, note: 'Tacos para el barro.' }),
  C({ id: 'w-sport', kind: 'ruedas', name: 'Deportivas 15"', q: 5, price: 0, unit: 420, look: 'sport', pot: 7, conf: 3, estilo: 6, fiab: 6, note: 'Pegadas al asfalto. Botan.' }),
  C({ id: 'w-al16', kind: 'ruedas', name: 'Aleación 16"', q: 6, price: 90 * K, unit: 520, look: 'aleacion', pot: 7, conf: 6, estilo: 7, fiab: 7, note: 'Grandes y bonitas.' }),
  C({ id: 'w-neum', kind: 'ruedas', name: 'Susp. neumática', q: 7, price: 180 * K, unit: 800, look: 'cromo', pot: 5, conf: 10, estilo: 7, fiab: 5, note: 'Flota sobre los baches.' }),
  C({ id: 'w-race', kind: 'ruedas', name: 'Llantas de carreras', q: 8, price: 260 * K, unit: 900, look: 'race', pot: 9, conf: 3, estilo: 8, fiab: 6, note: 'De la Fórmula 1.' }),
  C({ id: 'w-adapt', kind: 'ruedas', name: 'Susp. adaptativa', q: 9, price: 380 * K, unit: 1200, look: 'cromo', pot: 8, conf: 9, estilo: 8, fiab: 6, note: 'Se endurece en las curvas sola.' }),
  C({ id: 'w-oro', kind: 'ruedas', name: 'Llantas de oro', q: 10, price: 500 * K, unit: 2500, look: 'oro', pot: 6, conf: 7, estilo: 10, fiab: 7, note: 'Para quien no sabe en qué gastar.' }),
  // --- interiores
  C({ id: 'i-tela', kind: 'interior', name: 'Tela básica', q: 1, price: 0, unit: 150, look: 'tela', conf: 2, estilo: 1, peso: 20, note: 'Pica un poco en verano.' }),
  C({ id: 'i-skai', kind: 'interior', name: 'Skai', q: 2, price: 0, unit: 200, look: 'skai', conf: 3, estilo: 3, peso: 25, note: 'Imitación de cuero. Se pega a las piernas.' }),
  C({ id: 'i-velour', kind: 'interior', name: 'Terciopelo', q: 3, price: 0, unit: 280, look: 'velour', conf: 5, estilo: 4, peso: 30, note: 'Muy ochentero.' }),
  C({ id: 'i-radio', kind: 'interior', name: 'Tela + radio AM', q: 3, price: 0, unit: 320, look: 'tela', conf: 5, estilo: 3, peso: 30, note: 'Con las noticias de la mañana.' }),
  C({ id: 'i-cuero', kind: 'interior', name: 'Cuero sencillo', q: 4, price: 0, unit: 520, look: 'cuero', conf: 6, estilo: 6, peso: 40, note: 'Huele a nuevo.' }),
  C({ id: 'i-aire', kind: 'interior', name: 'Cuero + aire acond.', q: 6, price: 100 * K, unit: 800, look: 'cuero', conf: 8, estilo: 6, peso: 55, note: 'El verano de Nueva York, sin sudar.' }),
  C({ id: 'i-hifi', kind: 'interior', name: 'Radiocasete Hi-Fi', q: 6, price: 140 * K, unit: 700, look: 'velour', conf: 7, estilo: 7, peso: 40, note: 'Cuatro altavoces. Synthwave a tope.' }),
  C({ id: 'i-pc', kind: 'interior', name: 'Ordenador de a bordo', q: 8, price: 260 * K, unit: 1200, look: 'digital', conf: 8, estilo: 8, peso: 50, note: 'Salpicadero digital con luces verdes.' }),
  C({ id: 'i-madera', kind: 'interior', name: 'Madera noble', q: 8, price: 320 * K, unit: 1600, look: 'madera', conf: 9, estilo: 9, peso: 70, note: 'Nogal y cuero de Italia.' }),
  C({ id: 'i-lujo', kind: 'interior', name: 'Lujo total', q: 10, price: 520 * K, unit: 2800, look: 'lujo', conf: 10, estilo: 10, peso: 90, note: 'Nevera, tele y teléfono.' }),
  // --- seguridad
  C({ id: 's-nada', kind: 'seguridad', name: 'Cinturones delanteros', q: 1, price: 0, unit: 40, look: 's1', seg: 1, peso: 5, note: 'Lo mínimo que exige la ley.' }),
  C({ id: 's-3p', kind: 'seguridad', name: 'Cinturones de 3 puntos', q: 2, price: 0, unit: 80, look: 's1', seg: 3, peso: 8, note: 'Para todos los asientos.' }),
  C({ id: 's-barras', kind: 'seguridad', name: 'Barras laterales', q: 3, price: 0, unit: 160, look: 's2', seg: 4, peso: 30, note: 'Protegen en los golpes de lado.' }),
  C({ id: 's-disco', kind: 'seguridad', name: 'Frenos de disco', q: 4, price: 0, unit: 220, look: 's2', seg: 5, pot: 1, peso: 15, note: 'Frena antes.' }),
  C({ id: 's-deform', kind: 'seguridad', name: 'Deformación programada', q: 5, price: 0, unit: 260, look: 's3', seg: 6, peso: 25, note: 'La carrocería se aplasta y tú no.' }),
  C({ id: 's-abs', kind: 'seguridad', name: 'Frenos ABS', q: 6, price: 120 * K, unit: 450, look: 's3', seg: 7, peso: 20, note: 'No se bloquean las ruedas.' }),
  C({ id: 's-airbag', kind: 'seguridad', name: 'Airbag conductor', q: 7, price: 220 * K, unit: 600, look: 's4', seg: 8, peso: 15, note: 'Un cojín que salta en el choque.' }),
  C({ id: 's-airbags', kind: 'seguridad', name: 'Airbags + ABS', q: 8, price: 340 * K, unit: 950, look: 's4', seg: 9, peso: 35, note: 'Protección por todos lados.' }),
  C({ id: 's-esp', kind: 'seguridad', name: 'Control de estabilidad', q: 9, price: 450 * K, unit: 1100, look: 's5', seg: 9, pot: 1, peso: 20, note: 'Corrige el derrape solo.' }),
  C({ id: 's-total', kind: 'seguridad', name: 'Seguridad total', q: 10, price: 600 * K, unit: 1500, look: 's5', seg: 10, peso: 60, note: 'Cinco estrellas aseguradas.' }),
];
export const CAR_PART_BY_ID: Record<string, CarPart> = Object.fromEntries(CAR_PARTS.map((p) => [p.id, p]));
export const carPartsOf = (k: CarKind) => CAR_PARTS.filter((p) => p.kind === k);

export const CAR_COLORS = [
  { id: 'blanco', name: 'Blanco', hex: '#ece8dc', style: 3, price: 0 },
  { id: 'negro', name: 'Negro', hex: '#24242c', style: 5, price: 0 },
  { id: 'rojo', name: 'Rojo', hex: '#c8302a', style: 6, price: 0 },
  { id: 'azul', name: 'Azul marino', hex: '#24427a', style: 4, price: 0 },
  { id: 'amarillo', name: 'Amarillo taxi', hex: '#f2c230', style: 3, price: 0 },
  { id: 'verde', name: 'Verde inglés', hex: '#1e5a3a', style: 4, price: 0 },
  { id: 'plata', name: 'Plata metalizado', hex: '#b8bcc4', style: 7, price: 80 * K },
  { id: 'oro', name: 'Oro metalizado', hex: '#c89a30', style: 7, price: 140 * K },
  { id: 'bitono', name: 'Bitono crema', hex: '#d8c8a0', style: 8, price: 200 * K },
  { id: 'neon', name: 'Rosa neón', hex: '#ff4f9a', style: 9, price: 300 * K },
];
export const CAR_COLOR_BY_ID = Object.fromEntries(CAR_COLORS.map((c) => [c.id, c]));

export const CAR_EXTRAS = [
  { id: 'techo', name: 'Techo solar', icon: '☀', pts: 18, unit: 300, price: 0, note: 'Para Central Park en primavera.' },
  { id: 'cierre', name: 'Cierre centralizado', icon: '🔒', pts: 14, unit: 150, price: 0, note: 'Todas las puertas a la vez.' },
  { id: 'telefono', name: 'Teléfono de coche', icon: '📞', pts: 26, unit: 900, price: 0, note: 'Como los yuppies de Wall Street.' },
  { id: 'aleron', name: 'Alerón trasero', icon: '🏁', pts: 20, unit: 250, price: 0, note: 'Pega el coche al suelo… o eso dicen.' },
  { id: 'faros', name: 'Faros escamoteables', icon: '👀', pts: 24, unit: 400, price: 60 * K, note: 'Se abren como unos ojos.' },
  { id: 'calefactables', name: 'Asientos calefactables', icon: '🔥', pts: 18, unit: 300, price: 50 * K, note: 'Para el invierno de Nueva York.' },
  { id: 'cromados', name: 'Cromados y pegatinas', icon: '✨', pts: 16, unit: 200, price: 0, note: 'Brillo y rayas laterales.' },
  { id: 'kitt', name: 'Coche que habla', icon: '🗣', pts: 34, unit: 1500, price: 220 * K, note: '«Buenas noches, alcalde».' },
  { id: 'turbo', name: 'Botón turbo', icon: '🚀', pts: 30, unit: 800, price: 180 * K, note: 'Un empujón de película.' },
  { id: 'gps', name: 'Navegador por satélite', icon: '🛰', pts: 40, unit: 2000, price: 400 * K, note: 'Un mapa que habla. Ciencia ficción.' },
];
export const CAR_EXTRA_BY_ID = Object.fromEntries(CAR_EXTRAS.map((e) => [e.id, e]));
export const MAX_CAR_EXTRAS = 3;

export type MotorPos = 'delante' | 'centro' | 'detras';
export type Drive = 'delantera' | 'trasera' | 'total';

export interface CarDesign {
  name: string;
  carroceria: string;
  motor: string;
  caja: string;
  ruedas: string;
  interior: string;
  seguridad: string;
  color: string;
  extras: string[];
  motorPos: MotorPos;
  traccion: Drive;
}

export function defaultCar(): CarDesign {
  return { name: 'Pixel Uno', carroceria: 'k-berlina', motor: 'e-16', caja: 'g-m4', ruedas: 'w-14', interior: 'i-tela', seguridad: 's-3p', color: 'rojo', extras: [], motorPos: 'delante', traccion: 'trasera' };
}

export interface CarReport {
  /** Puntuaciones 0–100. */
  potencia: number;
  eficiencia: number;
  seguridad: number;
  confort: number;
  fiabilidad: number;
  diseno: number;
  extras: number;
  /** Datos de ficha técnica. */
  cv: number;
  peso: number;
  aceleracion: number;
  velMax: number;
  consumo: number;
  estrellas: number;
  /** Emisiones (0–10) y si pasan la ley del día. */
  emisiones: number;
  emisionesOk: boolean;
  unitCost: number;
  warnings: string[];
}

/** Ley de emisiones: cada vez más estricta (máximo de 0 a 10 permitido). */
export const emissionLimit = (day: number) => Math.max(4, 9 - Math.floor(day / 12));

const sum = (parts: CarPart[], k: keyof CarStats) => parts.reduce((a, p) => a + (p[k] ?? 0), 0);
const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

/** Ficha técnica y notas del coche. */
export function testCar(d: CarDesign, day = 1): CarReport {
  const body = CAR_PART_BY_ID[d.carroceria];
  const motor = CAR_PART_BY_ID[d.motor];
  const caja = CAR_PART_BY_ID[d.caja];
  const ruedas = CAR_PART_BY_ID[d.ruedas];
  const interior = CAR_PART_BY_ID[d.interior];
  const segur = CAR_PART_BY_ID[d.seguridad];
  const parts = [body, motor, caja, ruedas, interior, segur];
  const color = CAR_COLOR_BY_ID[d.color] ?? CAR_COLORS[0];
  const extras = d.extras.map((e) => CAR_EXTRA_BY_ID[e]).filter(Boolean);
  const warnings: string[] = [];

  let peso = sum(parts, 'peso') + (d.traccion === 'total' ? 120 : 0) + extras.length * 15;
  // la tracción y la posición del motor
  let potBonus = 0;
  let confBonus = 0;
  let segBonus = 0;
  let efiBonus = 0;
  if (d.motorPos === 'centro' && !body.mid) {
    confBonus -= 30;
    warnings.push('Motor central en un coche con asientos detrás: no cabe la familia.');
  }
  if (d.motorPos === 'centro' && body.mid) {
    potBonus += 10;
    warnings.push('+ Motor central: equilibrio de coche de carreras.');
  }
  if (d.motorPos === 'detras') {
    segBonus -= 8;
    potBonus += 3;
    warnings.push('Motor detrás: tracciona bien, pero la parte delantera es ligera y peligrosa.');
  }
  if (d.motorPos === 'delante' && d.traccion === 'delantera') {
    efiBonus += 8;
    confBonus += 5;
    warnings.push('+ Todo delante: más espacio dentro y menos consumo.');
  }
  if (d.traccion === 'trasera' && body.segment === 'deportivo') potBonus += 6;
  if (d.traccion === 'total') {
    segBonus += 6;
    efiBonus -= 8;
    if (body.segment === 'trabajo') potBonus += 6;
  }
  if (d.traccion === 'delantera' && motor.cv! >= 250) {
    potBonus -= 12;
    warnings.push('Demasiados caballos para tracción delantera: las ruedas patinan.');
  }
  if (body.segment === 'lujo' && motor.cv! < 120) warnings.push('Una limusina con motor pequeño no se mueve.');

  const cv = Math.round(motor.cv! * (0.85 + (caja.pot ?? 5) * 0.025) * (d.extras.includes('turbo') ? 1.12 : 1));
  const ratio = cv / peso;
  const aceleracion = Math.max(3.5, Math.round((22 - ratio * 75 - (ruedas.pot ?? 0) * 0.3) * 10) / 10);
  const velMax = Math.round(110 + cv * 0.55 - (body.segment === 'trabajo' ? 15 : 0) + (body.segment === 'deportivo' ? 15 : 0));
  const consumo = Math.round((4 + (10 - (motor.efi ?? 5)) * 1.1 + peso / 450 - (caja.efi ?? 5) * 0.2 + (d.traccion === 'total' ? 1.2 : 0)) * 10) / 10;

  const potencia = clamp(ratio * 520 + (ruedas.pot ?? 0) * 3 + (caja.pot ?? 0) * 2 + potBonus);
  const eficiencia = clamp(100 - (consumo - 4) * 7.5 + efiBonus);
  const seguridad = clamp((segur.seg ?? 0) * 8.5 + (ruedas.fiab ?? 0) + (body.peso! > 1300 ? 6 : 0) + segBonus);
  const confort = clamp((body.conf ?? 0) * 3 + (interior.conf ?? 0) * 4.5 + (caja.conf ?? 0) * 2 + (ruedas.conf ?? 0) * 1.5 + confBonus + (d.extras.includes('calefactables') ? 5 : 0));
  const fiabilidad = clamp(((motor.fiab ?? 5) * 5 + (caja.fiab ?? 5) * 2.5 + (ruedas.fiab ?? 5) * 1.5 + (body.fiab ?? 0) * 4) - extras.length * 3 + 10);
  const diseno = clamp((body.estilo ?? 0) * 5 + (ruedas.estilo ?? 0) * 2 + (interior.estilo ?? 0) * 1.5 + color.style * 2.5 + (d.extras.includes('cromados') ? 4 : 0));
  const extrasPts = clamp(extras.reduce((a, e) => a + e.pts, 0));
  const estrellas = Math.max(1, Math.min(5, Math.round(seguridad / 20 + 0.4)));
  const emisiones = Math.max(0, (motor.emis ?? 5) - ((caja.efi ?? 5) >= 8 ? 1 : 0));
  const emisionesOk = emisiones <= emissionLimit(day);
  if (!emisionesOk) warnings.push(`Supera la ley de emisiones (${emisiones} de ${emissionLimit(day)} permitido).`);
  if (fiabilidad < 45) warnings.push('Poco fiable: habrá averías.');
  if (extras.length > 2) warnings.push('Muchos extras: más averías y más caro.');
  const unitCost = parts.reduce((a, p) => a + p.unit, 0) + extras.reduce((a, e) => a + e.unit, 0) + (d.traccion === 'total' ? 600 : 0) + color.price / 400;
  return { potencia, eficiencia, seguridad, confort, fiabilidad, diseno, extras: extrasPts, cv, peso, aceleracion, velMax, consumo, estrellas, emisiones, emisionesOk, unitCost: Math.round(unitCost), warnings };
}

// ---------------------------------------------------------------------------
// Mercado: lo que pide cada segmento y la tendencia de la semana
// ---------------------------------------------------------------------------

type Weights = Record<'potencia' | 'eficiencia' | 'seguridad' | 'confort' | 'fiabilidad' | 'diseno' | 'extras', number>;
const PROFILE: Record<Segment, Weights> = {
  popular: { potencia: 0.1, eficiencia: 0.3, seguridad: 0.15, confort: 0.1, fiabilidad: 0.2, diseno: 0.1, extras: 0.05 },
  familia: { potencia: 0.1, eficiencia: 0.15, seguridad: 0.25, confort: 0.25, fiabilidad: 0.15, diseno: 0.05, extras: 0.05 },
  trabajo: { potencia: 0.2, eficiencia: 0.15, seguridad: 0.1, confort: 0.05, fiabilidad: 0.4, diseno: 0.05, extras: 0.05 },
  lujo: { potencia: 0.1, eficiencia: 0.03, seguridad: 0.15, confort: 0.3, fiabilidad: 0.07, diseno: 0.2, extras: 0.15 },
  deportivo: { potencia: 0.4, eficiencia: 0.03, seguridad: 0.07, confort: 0.05, fiabilidad: 0.1, diseno: 0.25, extras: 0.1 },
};

export interface Trend {
  id: string;
  title: string;
  text: string;
  /** Multiplica el peso de estas notas. */
  boost: Partial<Weights>;
  /** Segmento de moda. */
  hot?: Segment;
}
export const TRENDS: Trend[] = [
  { id: 'petroleo', title: 'Crisis del petróleo', text: 'La gasolina por las nubes: todos buscan coches que gasten poco.', boost: { eficiencia: 2.2 }, hot: 'popular' },
  { id: 'yuppies', title: 'Fiebre yuppie', text: 'Wall Street gana millones: se llevan el lujo y la imagen.', boost: { diseno: 1.8, extras: 1.6 }, hot: 'lujo' },
  { id: 'velocidad', title: 'Fiebre de la velocidad', text: 'Las películas de persecuciones arrasan: la gente quiere caballos.', boost: { potencia: 2 }, hot: 'deportivo' },
  { id: 'familias', title: 'Baby boom', text: 'Nacen muchos niños: se buscan coches grandes y seguros.', boost: { seguridad: 1.8, confort: 1.4 }, hot: 'familia' },
  { id: 'obras', title: 'Obras por toda la ciudad', text: 'Constructoras y comercios renuevan flota: fiabilidad ante todo.', boost: { fiabilidad: 2 }, hot: 'trabajo' },
  { id: 'accidentes', title: 'Ola de accidentes', text: 'Los periódicos hablan de seguridad vial cada día.', boost: { seguridad: 2.2 } },
];
/** Tendencia de la semana (cambia cada 7 días). */
export const trendOf = (day: number, seed: number) => TRENDS[Math.abs(Math.floor((day - 1) / 7) * 7919 + seed) % TRENDS.length];

/** Lo que exige el mercado de coches el día `day`. */
export const carMarketLevel = (day: number) => Math.round(Math.min(92, 42 + day * 0.7 + Math.sqrt(day) * 2));

export const CAR_MARKETING = [
  { id: 'nada', name: 'Sin campaña', cost: 0, mul: 1, bonus: 0 },
  { id: 'prensa', name: 'Anuncios en prensa', cost: 60 * K, mul: 1.25, bonus: 2 },
  { id: 'tv', name: 'Anuncio en TV', cost: 200 * K, mul: 1.6, bonus: 5 },
  { id: 'salon', name: 'Salón del Automóvil', cost: 450 * K, mul: 2.1, bonus: 8 },
] as const;
export const CAR_RUNS = [
  { id: 'corta', name: 'Corta', units: 300, mul: 0.6, cap: 3 },
  { id: 'media', name: 'Media', units: 1500, mul: 1, cap: 7 },
  { id: 'larga', name: 'Larga', units: 6000, mul: 1.8, cap: 99 },
] as const;
export type CarMarketingId = (typeof CAR_MARKETING)[number]['id'];
export type CarRunId = (typeof CAR_RUNS)[number]['id'];

/** Nota del coche para su segmento con la tendencia de la semana. */
export function carScore(r: CarReport, d: CarDesign, trend: Trend): number {
  const seg = CAR_PART_BY_ID[d.carroceria].segment!;
  const w = { ...PROFILE[seg] };
  for (const [k, v] of Object.entries(trend.boost)) w[k as keyof Weights] *= v as number;
  const total = Object.values(w).reduce((a, b) => a + b, 0);
  let s = 0;
  for (const k of Object.keys(w) as (keyof Weights)[]) s += (r[k] as number) * (w[k] / total);
  return Math.round(s);
}

export const carFairPrice = (r: CarReport, score: number) => Math.round((r.unitCost * 1.5 + score * 120) / 100) * 100;
export const carLaunchCost = (r: CarReport, run: CarRunId, mkt: CarMarketingId) => {
  const R = CAR_RUNS.find((x) => x.id === run)!;
  const M = CAR_MARKETING.find((x) => x.id === mkt)!;
  return Math.round((150 * K + r.unitCost * R.units * 0.12 + M.cost) / 1000) * 1000;
};

export type CarOutcome = 'fracaso' | 'discreto' | 'exito' | 'bombazo';
export const CAR_OUTCOME_LABEL: Record<CarOutcome, string> = { fracaso: 'Fracaso', discreto: 'Ventas discretas', exito: '¡Éxito!', bombazo: '¡BOMBAZO!' };

export interface Cause {
  good: boolean;
  text: string;
}

/**
 * Resultado del lanzamiento y sus causas (lo bueno y lo malo que dijeron
 * la prensa y los compradores).
 */
export function carMarket(d: CarDesign, r: CarReport, price: number, day: number, seed: number, luck: number, mkt: CarMarketingId, run: CarRunId) {
  const trend = trendOf(day, seed);
  const seg = CAR_PART_BY_ID[d.carroceria].segment!;
  const score = carScore(r, d, trend);
  const level = carMarketLevel(day);
  const fair = carFairPrice(r, score);
  const M = CAR_MARKETING.find((x) => x.id === mkt)!;
  const R = CAR_RUNS.find((x) => x.id === run)!;
  const causes: Cause[] = [];
  let s = score - level + luck * 6 + M.bonus;
  // precio
  const pr = (fair - price) / fair;
  s += Math.max(-25, Math.min(8, pr * 20));
  if (pr > 0.15) causes.push({ good: true, text: 'Un precio imbatible para lo que ofrece.' });
  else if (pr < -0.2) causes.push({ good: false, text: `Demasiado caro para un coche ${SEGMENT_LABEL[seg]}.` });
  // tendencia
  if (trend.hot === seg) {
    s += 5;
    causes.push({ good: true, text: `Llega en plena «${trend.title.toLowerCase()}»: justo lo que se busca.` });
  }
  for (const [k] of Object.entries(trend.boost)) {
    const v = r[k as keyof CarReport] as number;
    if (v >= 70) causes.push({ good: true, text: `${LABEL[k]} de primera, justo lo que pide el momento.` });
    else if (v < 40) causes.push({ good: false, text: `Con la ${trend.title.toLowerCase()}, su ${LABEL[k].toLowerCase()} decepciona.` });
  }
  // lo mejor y lo peor del coche para su segmento
  const keys = Object.keys(PROFILE[seg]) as (keyof Weights)[];
  const important = keys.sort((a, b) => PROFILE[seg][b] - PROFILE[seg][a]).slice(0, 3);
  for (const k of important) {
    const v = r[k] as number;
    if (v >= 75) causes.push({ good: true, text: GOOD_TEXT[k] });
    else if (v < 45) causes.push({ good: false, text: BAD_TEXT[k] });
  }
  // emisiones, seguridad y fiabilidad: los escándalos
  if (!r.emisionesOk) {
    s -= 12;
    causes.push({ good: false, text: 'Suspende la ley de emisiones: multa y titulares de «el coche del alcalde contamina».' });
  }
  if (r.estrellas <= 1) {
    s -= 6;
    causes.push({ good: false, text: 'Una estrella en la prueba de choque: las madres no lo quieren.' });
  } else if (r.estrellas >= 5) causes.push({ good: true, text: 'Cinco estrellas en la prueba de choque.' });
  if (r.fiabilidad < 40) {
    s -= 5;
    causes.push({ good: false, text: 'Se habla de averías en los primeros coches.' });
  }
  if (M.bonus >= 5) causes.push({ good: true, text: `La campaña (${M.name.toLowerCase()}) llega a todo el país.` });
  const outcome: CarOutcome = s < -6 ? 'fracaso' : s < 4 ? 'discreto' : s < 16 ? 'exito' : 'bombazo';
  const demand = { fracaso: 0.5, discreto: 2, exito: 4.5, bombazo: 8 }[outcome] * (1 + Math.max(0, s) / 30) * M.mul;
  const units = Math.min(demand, R.cap);
  if (demand > R.cap) causes.push({ good: false, text: 'La tirada se agotó en dos días: faltaron coches en los concesionarios.' });
  if (R.id === 'larga' && outcome === 'fracaso') causes.push({ good: false, text: 'Miles de coches sin vender en las campas de la fábrica.' });
  return { outcome, score, level, fair, trend, causes: causes.slice(0, 6), units: Math.round(units * 10) / 10, margin: Math.max(0, price - r.unitCost), soldOut: demand > R.cap };
}

const LABEL: Record<string, string> = { potencia: 'Potencia', eficiencia: 'Consumo', seguridad: 'Seguridad', confort: 'Confort', fiabilidad: 'Fiabilidad', diseno: 'Diseño', extras: 'Equipamiento' };
const GOOD_TEXT: Record<keyof Weights, string> = {
  potencia: 'Acelera como un cohete: las revistas lo adoran.',
  eficiencia: 'Gasta poquísimo: los taxistas lo recomiendan.',
  seguridad: 'Es de los coches más seguros del mercado.',
  confort: 'Un salón con ruedas: comodísimo.',
  fiabilidad: 'Indestructible: no se rompe nunca.',
  diseno: 'Precioso: la gente se gira al verlo pasar.',
  extras: 'Viene con todos los caprichos.',
};
const BAD_TEXT: Record<keyof Weights, string> = {
  potencia: 'Le falta fuerza: no sube ni la rampa del garaje.',
  eficiencia: 'Bebe gasolina como un camión.',
  seguridad: 'Las pruebas de seguridad lo dejan mal.',
  confort: 'Incómodo: se nota cada bache de Brooklyn.',
  fiabilidad: 'Se rompe a la mínima.',
  diseno: 'Feo. Muy feo.',
  extras: 'Viene pelado: ni radio.',
};

export interface CarModel {
  id: string;
  name: string;
  version: number;
  design: CarDesign;
  score: number;
  price: number;
  margin: number;
  units: number;
  launchedDay: number;
  outcome: CarOutcome;
  causes: Cause[];
  earned: number;
  retired?: boolean;
}

/** Ingreso del día: margen de los coches vendidos, que bajan con el tiempo. */
export function carIncome(m: CarModel, day: number): number {
  if (m.retired || day <= m.launchedDay) return 0;
  const age = day - m.launchedDay;
  const behind = Math.max(0, carMarketLevel(day) - m.score);
  const units = m.units * Math.pow(0.95, age) * Math.max(0, 1 - behind / 30);
  // unidades = decenas de coches al día
  return Math.round(units * 10 * m.margin * 0.25);
}

export interface CarLab {
  owned: string[];
  draft: CarDesign;
  models: CarModel[];
  press: { date: string; title: string; text: string }[];
}
export const emptyCarLab = (): CarLab => ({ owned: [], draft: defaultCar(), models: [], press: [] });

export function carItemPrice(key: string): number {
  if (key.startsWith('color:')) return CAR_COLOR_BY_ID[key.slice(6)]?.price ?? 0;
  if (key.startsWith('extra:')) return CAR_EXTRA_BY_ID[key.slice(6)]?.price ?? 0;
  return CAR_PART_BY_ID[key]?.price ?? 0;
}
export function carItemName(key: string): string {
  if (key.startsWith('color:')) return `pintura ${CAR_COLOR_BY_ID[key.slice(6)]?.name ?? ''}`;
  if (key.startsWith('extra:')) return CAR_EXTRA_BY_ID[key.slice(6)]?.name ?? '';
  return CAR_PART_BY_ID[key]?.name ?? '';
}
export const hasCarItem = (lab: CarLab | undefined, key: string) => carItemPrice(key) === 0 || !!lab?.owned.includes(key);
