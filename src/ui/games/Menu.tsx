import { Modal } from '../Panels';
import { MINUTES_PER_POINT } from '../../core/game';
import type { Role } from '../../core/types';
import { records } from './kit';

export interface GameDef {
  id: string;
  icon: string;
  title: string;
  text: string;
}

export const GAMES: Record<Role, GameDef[]> = {
  inmigrante: [
    { id: 'dishes', icon: '🍽', title: 'Lavar platos', text: 'Frota y deja cada plato en el escurridor.' },
    { id: 'burgers', icon: '🍔', title: 'Plancha', text: 'Voltea las hamburguesas en su punto.' },
    { id: 'orders', icon: '🧾', title: 'Pedidos', text: 'Monta el plato en el orden de la comanda.' },
    { id: 'coffee', icon: '☕', title: 'Café', text: 'Sirve justo hasta la raya, sin derramar.' },
    { id: 'mop', icon: '🧽', title: 'Fregona', text: 'Limpia las manchas antes de que las pisen.' },
  ],
  alcalde: [
    { id: 'paperwork', icon: '🖋', title: 'Papeleo', text: 'Aprueba lo legal, rechaza los fraudes.' },
    { id: 'traffic', icon: '🚦', title: 'Semáforos', text: 'Que ninguna cola se atasque en el cruce.' },
    { id: 'press', icon: '🎙', title: 'Rueda de prensa', text: 'Responde bien antes de que se acabe el tiempo.' },
    { id: 'budget', icon: '🧮', title: 'Presupuestos', text: '¿Cabe el gasto? Suma rápido y firma.' },
    { id: 'handshake', icon: '🤝', title: 'Mitin', text: 'Saluda a los votantes, esquiva a la prensa.' },
  ],
};

export function MiniGameMenu({ role, onPick, onClose }: { role: Role; onPick: (id: string) => void; onClose: () => void }) {
  const best = records();
  return (
    <Modal title="Minijuegos" kicker={`−${MINUTES_PER_POINT} MIN POR ACIERTO`} onClose={onClose}>
      <div class="game-list">
        {GAMES[role].map((g) => (
          <button key={g.id} class="game-pick" onClick={() => onPick(g.id)}>
            <span class="game-ic">{g.icon}</span>
            <span class="game-info">
              <b>{g.title}</b>
              <small>{g.text}</small>
            </span>
            <span class="game-best">{best[g.id] ? `🏆 ${best[g.id]}` : 'NUEVO'}</span>
          </button>
        ))}
      </div>
    </Modal>
  );
}
