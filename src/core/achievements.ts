import type { Bars, GameState, Role } from './types';

/**
 * Objetivos/logros (25 por personaje). Los que dependen de un suceso concreto
 * se desbloquean desde el propio resultado (effects.unlock); el resto se
 * comprueba aquí sobre el estado.
 */
export interface AchievementDef {
  id: string;
  role: Role;
  title: string;
  description: string;
  check?: (s: GameState, day: number) => boolean;
  reward?: Bars;
  /** El objetivo final: dispara el final positivo. */
  final?: boolean;
}

const f = (s: GameState, k: string) => Number(s.flags[k] ?? 0);
const b = (s: GameState, k: keyof NonNullable<GameState['bars']>) => s.bars[k] ?? 0;
const st = (s: GameState, k: string) => s.streaks[k] ?? 0;
const count = (s: GameState) => Object.keys(s.achievements).length;

export const BIG_BET: Record<Role, number> = { inmigrante: 300, alcalde: 100_000 };
export const MONEY_FLOOR: Record<Role, number> = { inmigrante: 500, alcalde: 200_000 };

export const ACHIEVEMENTS: AchievementDef[] = [
  // ---------------- Inmigrante
  { id: 'inm01', role: 'inmigrante', title: 'Trabajo estable', description: 'Completa tus 3 primeras jornadas.', check: (s) => f(s, 'jornadas') >= 3, reward: { dinero: 50, esperanza: 5 } },
  { id: 'inm02', role: 'inmigrante', title: 'Buen vecino', description: 'Ayuda a un vecino en problemas.', check: (s) => f(s, 'vecinosAyudados') >= 1, reward: { reputacion: 3 } },
  { id: 'inm03', role: 'inmigrante', title: 'A la calle', description: 'Participa en una manifestación.' },
  { id: 'inm04', role: 'inmigrante', title: 'Un techo propio', description: 'Compra el nivel 1 de la casa.', check: (s) => s.upgradeLevel >= 1 },
  { id: 'inm05', role: 'inmigrante', title: 'Primera semana', description: 'Aguanta 7 días sin que la esperanza baje de 40.', check: (s, d) => d >= 8 && !s.flags.esperanzaBajaSemana1 },
  { id: 'inm06', role: 'inmigrante', title: 'Familia reunida', description: 'Ahorra y trae a un familiar.' },
  { id: 'inm07', role: 'inmigrante', title: 'Intacto', description: 'Sobrevive a una redada sin consecuencias graves.' },
  { id: 'inm08', role: 'inmigrante', title: 'Respetado', description: 'Mantén la reputación en 70 o más durante 15 días seguidos.', check: (s) => st(s, 'repAlta') >= 15 },
  { id: 'inm09', role: 'inmigrante', title: 'Ya hablo el idioma', description: 'Completa las 5 clases de inglés.', check: (s) => f(s, 'idioma') >= 5 },
  { id: 'inm10', role: 'inmigrante', title: 'Apartamento', description: 'Llega al nivel 2 de la casa.', check: (s) => s.upgradeLevel >= 2 },
  { id: 'inm11', role: 'inmigrante', title: 'Susto superado', description: 'Resuelve una emergencia médica con 30 o más de salud.', check: (s) => f(s, 'emergenciasResueltas') >= 1 && b(s, 'salud') >= 30 },
  { id: 'inm12', role: 'inmigrante', title: 'Colchón', description: 'Mantén $500 o más durante 10 días seguidos.', check: (s) => st(s, 'dineroMin') >= 10 },
  { id: 'inm13', role: 'inmigrante', title: 'Lobo de Wall Street', description: 'Gana una apuesta de $300 o más en la bolsa.', check: (s) => !!s.flags.apuestaGrande },
  { id: 'inm14', role: 'inmigrante', title: 'Organizador', description: 'Ayuda a organizar una protesta.' },
  { id: 'inm15', role: 'inmigrante', title: 'Escurridizo', description: 'Evita la detención en tres redadas seguidas.', check: (s) => f(s, 'redadasSinDetencion') >= 3 },
  { id: 'inm16', role: 'inmigrante', title: 'Leyenda del barrio', description: 'Alcanza la reputación máxima.', check: (s) => b(s, 'reputacion') >= 95 },
  { id: 'inm17', role: 'inmigrante', title: 'Con abogada', description: 'Consigue asesoría legal pagando por ella.' },
  { id: 'inm18', role: 'inmigrante', title: 'Casa con patio', description: 'Llega al nivel 3 (máximo) de la casa.', check: (s) => s.upgradeLevel >= 3 },
  { id: 'inm19', role: 'inmigrante', title: 'Fe inquebrantable', description: 'Esperanza en 50 o más durante 30 días seguidos.', check: (s) => st(s, 'esperanza50') >= 30 },
  { id: 'inm20', role: 'inmigrante', title: 'Hijo ejemplar', description: 'Envía dinero a tu familia 4 veces.', check: (s) => f(s, 'remesas') >= 4 },
  { id: 'inm21', role: 'inmigrante', title: 'Volver a levantarse', description: 'Recupera la esperanza (70+) tras perder a un familiar en una redada.', check: (s) => !!s.flags.familiarDetenido && b(s, 'esperanza') >= 70 },
  { id: 'inm22', role: 'inmigrante', title: 'Comunidad', description: 'Forma parte del grupo de apoyo durante 10 días.', check: (s) => st(s, 'grupoDias') >= 10 },
  { id: 'inm23', role: 'inmigrante', title: 'Día redondo', description: 'Mejora salud, estrés y dinero el mismo día.', check: (s) => !!s.flags.tresBarras },
  { id: 'inm24', role: 'inmigrante', title: 'Plenitud', description: 'Esperanza y reputación al máximo a la vez.', check: (s) => b(s, 'esperanza') >= 95 && b(s, 'reputacion') >= 95 },
  {
    id: 'inm25',
    role: 'inmigrante',
    title: 'Estabilidad total',
    description: 'Casa nivel 3, esperanza y reputación 80+, estrés 35 o menos, $1.000 ahorrados y 15 logros.',
    final: true,
    check: (s) =>
      s.upgradeLevel >= 3 && b(s, 'esperanza') >= 80 && b(s, 'reputacion') >= 80 && b(s, 'estres') <= 35 && b(s, 'dinero') >= 1000 && count(s) >= 15,
  },

  // ---------------- Alcalde
  { id: 'alc01', role: 'alcalde', title: 'Primeras encuestas', description: 'Gana tu primera encuesta semanal (50%+).', check: (s) => !!s.flags.primeraEncuestaGanada },
  { id: 'alc02', role: 'alcalde', title: 'Templanza', description: 'Maneja tu primera manifestación sin perder más de 5 de popularidad.' },
  { id: 'alc03', role: 'alcalde', title: 'Manos limpias', description: 'Sal limpio de una acusación de corrupción.' },
  { id: 'alc04', role: 'alcalde', title: 'Negociador', description: 'Resuelve una huelga sin perder más del 25% del dinero.' },
  { id: 'alc05', role: 'alcalde', title: 'Al frente', description: 'Responde bien a un desastre natural.' },
  { id: 'alc06', role: 'alcalde', title: 'Mano firme', description: 'Control en 40 o más durante 15 días seguidos.', check: (s) => st(s, 'control40') >= 15 },
  { id: 'alc07', role: 'alcalde', title: 'Primer ayudante', description: 'Contrata al ayudante nivel 1.', check: (s) => s.upgradeLevel >= 1 },
  { id: 'alc08', role: 'alcalde', title: 'Gabinete', description: 'Llega al nivel 2 del ayudante.', check: (s) => s.upgradeLevel >= 2 },
  { id: 'alc09', role: 'alcalde', title: 'Equipo de élite', description: 'Llega al nivel 3 (máximo) del ayudante.', check: (s) => s.upgradeLevel >= 3 },
  { id: 'alc10', role: 'alcalde', title: 'Tiburón', description: 'Gana una apuesta de $100K o más en la bolsa.', check: (s) => !!s.flags.apuestaGrande },
  { id: 'alc11', role: 'alcalde', title: 'Ciudad bajo control', description: 'Control en 50 o más durante 30 días seguidos.', check: (s) => st(s, 'control50') >= 30 },
  { id: 'alc12', role: 'alcalde', title: 'Cuentas sanas', description: 'Mantén $200K o más durante 10 días seguidos.', check: (s) => st(s, 'dineroMin') >= 10 },
  { id: 'alc13', role: 'alcalde', title: 'Calles seguras', description: 'Reduce la criminalidad.' },
  { id: 'alc14', role: 'alcalde', title: 'Amigo de la prensa', description: 'Mejora la relación con la prensa.' },
  { id: 'alc15', role: 'alcalde', title: 'Cortar la cinta', description: 'Inaugura una obra pública.' },
  { id: 'alc16', role: 'alcalde', title: 'Superviviente', description: 'Sobrevive a un segundo escándalo de corrupción.' },
  { id: 'alc17', role: 'alcalde', title: 'Día redondo', description: 'Mejora salud, estrés y dinero el mismo día.', check: (s) => !!s.flags.tresBarras },
  { id: 'alc18', role: 'alcalde', title: 'Ídolo', description: 'Popularidad y control al máximo a la vez.', check: (s) => b(s, 'popularidad') >= 95 && b(s, 'control') >= 95 },
  { id: 'alc19', role: 'alcalde', title: 'Sangre fría', description: 'Estrés en 40 o menos durante 20 días seguidos.', check: (s) => st(s, 'estresBajo') >= 20 },
  { id: 'alc20', role: 'alcalde', title: 'Mayoría', description: 'Gánate el respeto de los concejales.' },
  { id: 'alc21', role: 'alcalde', title: 'Capitán de tormentas', description: 'Sobrevive a dos desastres naturales seguidos.' },
  { id: 'alc22', role: 'alcalde', title: 'Paz laboral', description: 'Sobrevive a dos huelgas seguidas sin perder más de 5 de control en cada una.' },
  { id: 'alc23', role: 'alcalde', title: 'Final de mandato', description: 'Termina un mandato con más del 80% de popularidad.' },
  { id: 'alc24', role: 'alcalde', title: 'Reelección', description: 'Gana las elecciones al final de tu mandato.' },
  {
    id: 'alc25',
    role: 'alcalde',
    title: 'Estabilidad total',
    description: 'Ayudante nivel 3, popularidad y control 80+, reelección y 15 logros.',
    final: true,
    check: (s) =>
      s.upgradeLevel >= 3 && b(s, 'popularidad') >= 80 && b(s, 'control') >= 80 && f(s, 'reelecciones') >= 1 && count(s) >= 15,
  },
];

export const ACHIEVEMENT_BY_ID: Record<string, AchievementDef> = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a]));

export function achievementsFor(role: Role): AchievementDef[] {
  return ACHIEVEMENTS.filter((a) => a.role === role);
}

export const FINAL_TEXT: Record<Role, { title: string; text: string }> = {
  inmigrante: {
    title: 'Estabilidad total',
    text: 'Casa propia, familia cerca, un barrio que te conoce por tu nombre. La ciudad que te recibió con frío ahora es tu hogar. Llegaste con una maleta; hoy tienes raíces.',
  },
  alcalde: {
    title: 'Una ciudad en paz',
    text: 'Calles seguras, cuentas sanas y una ciudad que volvió a votarte. Los libros de historia hablarán de tu mandato como los años en que la ciudad se levantó.',
  },
};
