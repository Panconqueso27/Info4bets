import type { GameState, OtherCharacter, Role } from '../core/types';

/**
 * Lo que sobrevive entre partidas en este dispositivo:
 * - el último protagonista de cada rol (aparece en la ciudad del otro rol)
 * - la ropa y los peinados desbloqueados
 */
const KEY = 'laciudad.legacy';

interface Legacy {
  characters: Partial<Record<Role, OtherCharacter & { days: number; ending: string }>>;
  cosmetics: string[];
}

function load(): Legacy {
  try {
    return { characters: {}, cosmetics: [], ...JSON.parse(localStorage.getItem(KEY) ?? '{}') };
  } catch {
    return { characters: {}, cosmetics: [] };
  }
}

function save(l: Legacy) {
  try {
    localStorage.setItem(KEY, JSON.stringify(l));
  } catch {
    /* sin almacenamiento */
  }
}

/** El protagonista de una partida anterior con el otro rol, si existe. */
export function otherFor(role: Role): (OtherCharacter & { days: number; ending: string }) | undefined {
  return load().characters[role === 'inmigrante' ? 'alcalde' : 'inmigrante'];
}

export function rememberCharacter(state: GameState, days: number) {
  const l = load();
  const c = state.character;
  l.characters[c.role] = {
    role: c.role,
    name: c.name,
    look: c.look,
    legacy: true,
    days,
    ending: state.ending?.title ?? state.gameOver?.title ?? 'En la ciudad',
  };
  save(l);
}

export function globalCosmetics(): string[] {
  return load().cosmetics;
}

export function keepCosmetics(ids: string[]) {
  const l = load();
  const set = new Set([...l.cosmetics, ...ids]);
  if (set.size === l.cosmetics.length) return;
  l.cosmetics = [...set];
  save(l);
}
