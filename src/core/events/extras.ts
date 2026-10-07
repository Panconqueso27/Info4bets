import type { EventDef } from './types';

/**
 * Actividades del alcalde fuera del despacho que se deciden en la agenda:
 * cenas de recaudación (dinero con riesgo de escándalo) y mítines de barrio.
 */

const cena: EventDef = {
  id: 'cena-recaudacion',
  role: 'alcalde',
  kind: 'accion',
  icon: 'estrella',
  title: 'Cena de recaudación',
  summary: 'Cena con donantes en el Waldorf. Mucho dinero… y favores pendientes.',
  notification: '',
  intro: 'Doscientos cubiertos en el Waldorf Astoria. Constructores, banqueros y algún apellido que sale en los periódicos por motivos raros. Todos quieren hacerse una foto contigo.',
  weight: 0,
  cooldownDays: 3,
  choices: [
    {
      id: 'todos',
      label: 'Aceptar todos los cheques',
      hint: 'Mucho dinero, riesgo de escándalo',
      outcomes: [
        { id: 'lluvia', result: 'bueno', weight: 3, title: 'Lluvia de cheques', message: 'Brindis, apretones de manos y cheques con muchos ceros. La ciudad tiene presupuesto extra.', effects: { bars: { dinero: 220_000, estres: 4 } } },
        { id: 'escandalo', result: 'malo', weight: 2, title: 'Escándalo en portada', message: 'Un fotógrafo te pilla brindando con un mafioso conocido. El Ledger lo lleva a portada.', effects: { bars: { dinero: 220_000, popularidad: -12, control: -4, estres: 10 } } },
      ],
    },
    {
      id: 'limpios',
      label: 'Solo donantes limpios',
      hint: 'Menos dinero, sin riesgo',
      outcomes: [
        { id: 'honrado', result: 'bueno', weight: 4, title: 'Dinero limpio', message: 'Revisas la lista con lupa. Recaudas menos, pero duermes tranquilo.', effects: { bars: { dinero: 110_000, popularidad: 2 } } },
        { id: 'tacanos', result: 'malo', weight: 1, title: 'Cena floja', message: 'Sin los grandes nombres, la cena es triste y la recaudación, escasa.', effects: { bars: { dinero: 40_000, estres: 3 } } },
      ],
    },
    {
      id: 'benefica',
      label: 'Que sea benéfica',
      hint: 'Todo para el barrio',
      outcomes: [
        { id: 'aplausos', result: 'bueno', weight: 3, title: 'Gala benéfica', message: 'Lo recaudado va al comedor social del Bronx. Los periódicos te aplauden.', effects: { bars: { popularidad: 8, control: 2 } } },
        { id: 'postureo', result: 'malo', weight: 1, title: '"Puro postureo"', message: 'Un columnista lo llama "caridad para la foto". Te duele más de lo que admites.', effects: { bars: { popularidad: 2, estres: 5 } } },
      ],
    },
  ],
};

const mitin: EventDef = {
  id: 'mitin-barrio',
  role: 'alcalde',
  kind: 'accion',
  icon: 'megafono',
  title: 'Mitin de barrio',
  summary: 'Escenario en una plaza de barrio. Sube la popularidad (y con ella, el turismo).',
  notification: '',
  intro: 'Un escenario de madera, una bandera y un micrófono que pita. ¿Dónde montas el mitin de esta semana?',
  weight: 0,
  cooldownDays: 2,
  choices: [
    {
      id: 'brooklyn',
      label: 'En Brooklyn',
      outcomes: [
        { id: 'llenazo', result: 'bueno', weight: 3, title: 'Llenazo en Brooklyn', message: 'Brooklyn se siente escuchado por fin. Te corean desde los balcones.', effects: { bars: { popularidad: 9, estres: 4 } } },
        { id: 'tomates', result: 'malo', weight: 1, title: 'Tomates', message: 'Alguien no olvida que cerraste su fábrica. Vuelan dos tomates.', effects: { bars: { popularidad: -3, estres: 8 } } },
      ],
    },
    {
      id: 'manhattan',
      label: 'En Midtown',
      outcomes: [
        { id: 'tele', result: 'bueno', weight: 2, title: 'Sales en la tele', message: 'Las cámaras están cerca y tu discurso abre el noticiero de las seis.', effects: { bars: { popularidad: 7, control: 2, estres: 3 } } },
        { id: 'prisa', result: 'malo', weight: 1, title: 'Nadie se para', message: 'En Midtown todos tienen prisa. Hablas para cuatro turistas y un perro.', effects: { bars: { popularidad: 1, estres: 4 } } },
      ],
    },
    {
      id: 'radio',
      label: 'Mejor por la radio',
      outcomes: [
        { id: 'cercano', result: 'bueno', weight: 2, title: 'Cercano', message: 'Contestas llamadas de oyentes durante una hora. Suenas humano.', effects: { bars: { popularidad: 4, estres: -2 } } },
        { id: 'troll', result: 'malo', weight: 1, title: 'Oyente pesado', message: 'Un oyente te tiene media hora hablando de su bache. Pierdes los nervios en directo.', effects: { bars: { popularidad: -2, estres: 5 } } },
      ],
    },
  ],
};

export const EXTRAS_EVENTS: EventDef[] = [cena, mitin];
