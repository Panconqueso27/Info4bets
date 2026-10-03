import type { GameState, Look, Role } from './types';

/**
 * Personajes secundarios recurrentes. Cada uno guarda su afinidad contigo
 * (de -5 a +5) y recuerda tus decisiones; más adelante vuelven con sucesos
 * que dependen de cómo los trataste.
 */
export interface NpcDef {
  id: string;
  role: Role;
  name: string;
  title: string;
  look: Look;
}

export interface NpcMemory {
  afinidad: number;
  recuerdos: string[];
}

export const NPCS: Record<string, NpcDef> = {
  sal: { id: 'sal', role: 'inmigrante', name: 'Sal Romano', title: 'Dueño del diner', look: { outfit: 'camarero', hair: 'rapado', skin: '#deac84', hairColor: '#c9c4bc', outfitColor: '#3a3a46' } },
  carmen: { id: 'carmen', role: 'inmigrante', name: 'Doña Carmen', title: 'Vecina del tercero', look: { outfit: 'sudadera', hair: 'coleta', skin: '#c18a5c', hairColor: '#c9c4bc', outfitColor: '#e8619e' } },
  lupe: { id: 'lupe', role: 'inmigrante', name: 'Lupe', title: 'Organiza el barrio', look: { outfit: 'chaqueta', hair: 'largo', skin: '#9a6440', hairColor: '#1c1818', outfitColor: '#7b4fa0' } },
  ramiro: { id: 'ramiro', role: 'inmigrante', name: 'Don Ramiro', title: 'Vecino del bajo', look: { outfit: 'obrero', hair: 'rapado', skin: '#6c4228', hairColor: '#c9c4bc', outfitColor: '#2e8b57' } },
  kowalski: { id: 'kowalski', role: 'inmigrante', name: 'Agente Kowalski', title: 'Policía del barrio', look: { outfit: 'traje', hair: 'corto', skin: '#f2d0b0', hairColor: '#b5442c', outfitColor: '#2f6fb3' } },
  ruiz: { id: 'ruiz', role: 'alcalde', name: 'Concejala Ruiz', title: 'Líder de la oposición', look: { outfit: 'gabardina', hair: 'largo', skin: '#c18a5c', hairColor: '#1c1818', outfitColor: '#c0392b' } },
  omalley: { id: 'omalley', role: 'alcalde', name: "Jefe O'Malley", title: 'Jefe de policía', look: { outfit: 'cruzado', hair: 'corto', skin: '#f2d0b0', hairColor: '#b5442c', outfitColor: '#1f3c7a' } },
  brooks: { id: 'brooks', role: 'alcalde', name: 'Diane Brooks', title: 'Periodista del canal 7', look: { outfit: 'chaqueta', hair: 'mullet', skin: '#deac84', hairColor: '#d8b45e', outfitColor: '#e2a23b' } },
  russo: { id: 'russo', role: 'alcalde', name: 'Frank Russo', title: 'Líder sindical', look: { outfit: 'obrero', hair: 'tupe', skin: '#deac84', hairColor: '#4a2e1c', outfitColor: '#3a3a46' } },
};

/** Cómo afecta cada decisión a la relación: suceso → opción → efecto. */
export const NPC_EFFECTS: Record<string, { npc: string; byChoice: Record<string, { afinidad: number; recuerdo: string }> }> = {
  'ap-cubrir': { npc: 'sal', byChoice: { si: { afinidad: 2, recuerdo: 'Le cubriste el turno de Manny.' }, no: { afinidad: -1, recuerdo: 'No le cubriste el turno.' } } },
  'ap-cliente': { npc: 'sal', byChoice: { calma: { afinidad: 1, recuerdo: 'Calmaste a un cliente difícil.' }, firme: { afinidad: -1, recuerdo: 'Le plantaste cara a un cliente.' } } },
  'ap-cafetera': { npc: 'sal', byChoice: { arreglar: { afinidad: 1, recuerdo: 'Arreglaste la cafetera.' }, avisar: { afinidad: 0, recuerdo: 'Le avisaste de la cafetera rota.' } } },
  vecino: { npc: 'carmen', byChoice: { ayudar: { afinidad: 2, recuerdo: 'Le prestaste $40 para la luz.' }, negar: { afinidad: -2, recuerdo: 'No le prestaste dinero.' } } },
  grupo: { npc: 'lupe', byChoice: { unirse: { afinidad: 2, recuerdo: 'Te uniste a su grupo de apoyo.' }, no: { afinidad: -1, recuerdo: 'Rechazaste su invitación.' } } },
  manifestacion: { npc: 'lupe', byChoice: { unirse: { afinidad: 1, recuerdo: 'Marchaste a su lado.' }, organizar: { afinidad: 3, recuerdo: 'Organizasteis juntas la marcha.' }, margen: { afinidad: -1, recuerdo: 'No fuiste a la marcha.' } } },
  'ap-periodista': { npc: 'brooks', byChoice: { responder: { afinidad: 1, recuerdo: 'Le diste declaraciones en la escalinata.' }, esquivar: { afinidad: -1, recuerdo: 'Huiste de su micrófono.' } } },
  prensa: { npc: 'brooks', byChoice: { entrevistas: { afinidad: 2, recuerdo: 'Le concediste una entrevista.' } } },
  'ap-concejal': { npc: 'ruiz', byChoice: { aceptar: { afinidad: 2, recuerdo: 'Tomasteis un café juntos.' }, rechazar: { afinidad: -1, recuerdo: 'Le diste plantón.' } } },
  concejales: { npc: 'ruiz', byChoice: { negociar: { afinidad: 1, recuerdo: 'Negociaste con su bancada.' } } },
  'ap-policia': { npc: 'omalley', byChoice: { aprobar: { afinidad: 2, recuerdo: 'Le aprobaste las horas extra.' }, negar: { afinidad: -2, recuerdo: 'Le negaste las horas extra.' } } },
  crimen: { npc: 'omalley', byChoice: { invertir: { afinidad: 2, recuerdo: 'Financiaste su plan de seguridad.' } } },
  huelga: { npc: 'russo', byChoice: { ceder: { afinidad: 3, recuerdo: 'Cediste a las demandas del sindicato.' }, resistir: { afinidad: -2, recuerdo: 'Te negaste a negociar la huelga.' } } },
};

export function npcMemory(state: GameState, id: string): NpcMemory {
  return state.npcs?.[id] ?? { afinidad: 0, recuerdos: [] };
}

export function afinidad(state: GameState, id: string): number {
  return npcMemory(state, id).afinidad;
}

export function rememberNpc(state: GameState, id: string, delta: number, recuerdo?: string) {
  state.npcs ??= {};
  const m = (state.npcs[id] ??= { afinidad: 0, recuerdos: [] });
  m.afinidad = Math.max(-5, Math.min(5, m.afinidad + delta));
  if (recuerdo) {
    m.recuerdos.unshift(recuerdo);
    m.recuerdos.length = Math.min(m.recuerdos.length, 4);
  }
}

/** Personajes que ya conoces, para el panel "Personas". */
export function knownNpcs(state: GameState): (NpcDef & NpcMemory)[] {
  return Object.entries(state.npcs ?? {})
    .filter(([id]) => NPCS[id]?.role === state.character.role)
    .map(([id, m]) => ({ ...NPCS[id], ...m }));
}
