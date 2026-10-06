/**
 * Contrato de las mesas del casino. Cada mesa es un componente a pantalla
 * completa (dentro del vestíbulo del casino) que recibe esto:
 */
export interface CasinoTableProps {
  /** Dinero actual del jugador (se actualiza tras cada `settle`). */
  money: number;
  /** Formato de dinero del personaje ($ o $K). */
  fmt: (n: number) => string;
  /** Valores de las fichas disponibles (4, de menor a mayor). */
  chips: number[];
  /** Apuesta máxima por jugada. */
  maxBet: number;
  /**
   * Cierra una jugada: todo lo apostado y lo que devuelve la mesa (apuesta
   * incluida). Devuelve false si no se pudo (sin dinero, límite…): entonces
   * la mesa debe deshacer la jugada. Llamar UNA vez por mano/tirada/carrera.
   */
  settle: (staked: number, returned: number, detail: string) => boolean;
  /** Volver al vestíbulo. */
  onExit: () => void;
}
