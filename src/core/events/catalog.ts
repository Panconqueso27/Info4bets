import type { EventDef } from './types';

/**
 * Catálogo de sucesos. Cada suceso describe solo la situación; las
 * consecuencias viven en sus resultados (bueno/malo), cada uno con su mensaje.
 * Los números son provisionales: el balanceo fino es de una fase posterior.
 */

const redada: EventDef = {
  id: 'redada',
  role: 'inmigrante',
  kind: 'aleatorio',
  title: 'Redada de inmigración',
  notification: '🚨 Hay una redada de inmigración en el barrio.',
  intro:
    'Sirenas sin luces. Tres camionetas sin placas frenan frente a {place}. Agentes con chaleco piden papeles puerta por puerta, y alguien grita tu nombre desde la esquina.',
  weight: 1,
  choices: [
    {
      id: 'aguantar',
      label: 'Contener la respiración',
      hint: 'El destino decide: 2 resultados buenos, 3 malos.',
      outcomes: [
        {
          id: 'detenido',
          result: 'malo',
          weight: 1,
          title: 'Te detuvieron',
          message:
            'Un agente te sujeta del brazo antes de que puedas explicar nada. Pasas las próximas 24 horas en un centro de detención. Pierdes la paga de hoy, pagas la fianza y en el barrio ya se habla de ti.',
          effects: {
            bars: { dinero: -150, esperanza: -20, reputacion: -10 },
            cancelShift: 'Detenido en una redada',
            detainHours: 24,
            counters: ['redadasDetenido'],
          },
        },
        {
          id: 'familiar',
          result: 'malo',
          weight: 1,
          title: 'Se llevaron a tu primo',
          message:
            'Tú te salvas por estar en la cocina, pero a tu primo lo suben a una camioneta. Esa noche nadie en el edificio puede dormir.',
          effects: {
            bars: { esperanza: -12, reputacion: -5 },
            flags: { familiarDetenido: true },
            counters: ['redadasSuperadas'],
          },
        },
        {
          id: 'cerco',
          result: 'malo',
          weight: 1,
          title: 'Cerco en el barrio',
          message:
            'Corres a casa a avisar a los tuyos y ya no puedes volver: patrullas cierran todas las salidas del barrio. Pierdes la jornada de hoy y los nervios.',
          effects: {
            bars: { estres: 15 },
            cancelShift: 'Cerco policial en el barrio',
            counters: ['redadasSuperadas'],
          },
        },
        {
          id: 'comunidad',
          result: 'bueno',
          weight: 1,
          title: 'La comunidad responde',
          message:
            'En minutos la calle se llena: vecinos, el cura, la dueña de la bodega. Graban, cantan y no se mueven. Los agentes se van sin nadie. Hoy sientes que no estás solo.',
          effects: {
            bars: { esperanza: 12, reputacion: 10 },
            counters: ['redadasSuperadas'],
          },
        },
        {
          id: 'esconder',
          result: 'bueno',
          weight: 1,
          title: 'Escondes a un vecino',
          message:
            'Don Ramiro llega temblando a la puerta trasera. Lo escondes en el cuarto frío hasta que pasa todo. Mañana todo el barrio sabrá lo que hiciste.',
          effects: {
            bars: { reputacion: 12 },
            counters: ['redadasSuperadas', 'vecinosAyudados'],
          },
        },
      ],
    },
  ],
};

const huelga: EventDef = {
  id: 'huelga',
  role: 'alcalde',
  kind: 'aleatorio',
  title: 'Huelga municipal',
  notification: '📢 Los trabajadores municipales se declaran en huelga.',
  intro:
    'El sindicato de {servicio} se planta frente a la alcaldía. Piden un aumento del 12% y mejores condiciones. {consecuencia} La prensa espera tu respuesta en la escalinata.',
  weight: 1,
  variants: {
    servicio: ['recolectores de basura', 'transporte público', 'la policía municipal'],
    consecuencia: [
      'Si no se resuelve hoy, la ciudad se paraliza.',
      'Las cámaras ya están grabando.',
      'Tus concejales no contestan el teléfono.',
    ],
  },
  choices: [
    {
      id: 'ceder',
      label: 'Ceder a las demandas',
      hint: 'Cuesta el 25% del dinero de la ciudad.',
      outcomes: [
        {
          id: 'cede',
          result: 'bueno',
          weight: 1,
          title: 'Acuerdo firmado',
          message:
            'Firmas el aumento frente a las cámaras. Los trabajadores aplauden y la ciudad vuelve a moverse esa misma tarde. Las arcas quedan tocadas, pero la calle está contigo.',
          effects: {
            moneyPct: -25,
            bars: { popularidad: 10, control: 8 },
            counters: ['huelgasResueltas', 'huelgasCedidas'],
          },
        },
      ],
    },
    {
      id: 'resistir',
      label: 'No ceder',
      hint: 'Ahorras dinero… si la huelga no te pasa por encima.',
      outcomes: [
        {
          id: 'no-cede',
          result: 'malo',
          weight: 3,
          title: 'La ciudad se paraliza',
          message:
            'Te niegas a negociar. La huelga se alarga, la basura se acumula en las esquinas y los titulares te llaman "el alcalde de piedra".',
          effects: {
            bars: { popularidad: -12, control: -10, estres: 8 },
            counters: ['huelgasResueltas'],
          },
        },
        {
          id: 'se-desinfla',
          result: 'bueno',
          weight: 1,
          title: 'La huelga se desinfla',
          message:
            'El sindicato se divide antes del anochecer y los piquetes se dispersan. Mantienes las cuentas intactas y la autoridad, aunque algunos no lo olvidarán.',
          effects: {
            bars: { control: 6, popularidad: -2 },
            counters: ['huelgasResueltas'],
          },
        },
      ],
    },
  ],
};

export const EVENTS: Record<string, EventDef> = {
  [redada.id]: redada,
  [huelga.id]: huelga,
};

export function eventsFor(role: EventDef['role'], kind?: EventDef['kind']): EventDef[] {
  return Object.values(EVENTS).filter((e) => e.role === role && (!kind || e.kind === kind));
}
