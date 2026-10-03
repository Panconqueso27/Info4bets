import type { EventDef } from './types';

/**
 * Sucesos de apertura: ligeros, llegan en los primeros 2 minutos de cada
 * jornada para enganchar. Los fuertes llegan después.
 */

const cubrir: EventDef = {
  id: 'ap-cubrir',
  role: 'inmigrante',
  kind: 'apertura',
  icon: 'reloj',
  title: 'Un turno de más',
  notification: '☕ Tu jefe quiere hablar contigo.',
  intro: 'Sal, el dueño del diner, te para en la puerta: "Manny no viene hoy. ¿Me cubres la plancha además de lo tuyo?"',
  weight: 1,
  choices: [
    {
      id: 'si',
      label: 'Claro, jefe',
      outcomes: [
        { id: 'agradece', result: 'bueno', weight: 3, title: 'Sal no lo olvida', message: 'Sal te da una palmada en el hombro y te guarda el mejor pie de manzana del día.', effects: { bars: { reputacion: 5, estres: 4 } } },
        { id: 'quemado', result: 'malo', weight: 1, title: 'Doble trabajo, cero gracias', message: 'La plancha no para y nadie lo nota. Terminas con los brazos quemados de grasa.', effects: { bars: { salud: -4, estres: 8 } } },
      ],
    },
    {
      id: 'no',
      label: 'Hoy no puedo',
      outcomes: [
        { id: 'entiende', result: 'bueno', weight: 2, title: 'Sal lo entiende', message: '"Bueno, lo hago yo", gruñe. Trabajas a tu ritmo.', effects: { bars: { estres: -3 } } },
        { id: 'molesto', result: 'malo', weight: 1, title: 'Sal está molesto', message: 'Sal no te dirige la palabra en toda la mañana.', effects: { bars: { reputacion: -3 } } },
      ],
    },
  ],
};

const propina: EventDef = {
  id: 'ap-propina',
  role: 'inmigrante',
  kind: 'apertura',
  icon: 'propina',
  title: 'Propina generosa',
  notification: '💵 Un cliente te dejó algo en la mesa.',
  intro: 'Un señor de traje deja un billete de $20 bajo la taza: "Para ti, chico. Buen café". Tus compañeros lo han visto.',
  weight: 1,
  choices: [
    {
      id: 'guardar',
      label: 'Guardártela',
      outcomes: [
        { id: 'tuya', result: 'bueno', weight: 3, title: 'Te la ganaste', message: 'Veinte dólares son veinte dólares. Esta noche cenas algo mejor.', effects: { bars: { dinero: 20, esperanza: 2 } } },
        { id: 'celos', result: 'malo', weight: 1, title: 'Miradas', message: 'Te la guardas, pero la camarera murmura algo sobre el bote común.', effects: { bars: { dinero: 20, reputacion: -3 } } },
      ],
    },
    {
      id: 'bote',
      label: 'Al bote común',
      outcomes: [
        { id: 'equipo', result: 'bueno', weight: 3, title: 'Uno más del equipo', message: 'La cocinera te guiña un ojo. En el diner las cosas se comparten.', effects: { bars: { reputacion: 5 } } },
        { id: 'nadie', result: 'malo', weight: 1, title: 'Nadie se entera', message: 'Lo metes en el bote y nadie lo nota. Bueno, tú sí.', effects: { bars: { estres: 1 } } },
      ],
    },
  ],
};

const cafetera: EventDef = {
  id: 'ap-cafetera',
  role: 'inmigrante',
  kind: 'apertura',
  icon: 'cafe',
  title: 'La cafetera explota',
  notification: '☕ Algo huele a quemado en el diner.',
  intro: 'La vieja cafetera industrial suelta vapor por donde no debe. Hay diez clientes esperando su café de la mañana.',
  weight: 1,
  choices: [
    {
      id: 'arreglar',
      label: 'Arreglarla tú',
      outcomes: [
        { id: 'manitas', result: 'bueno', weight: 2, title: 'Manos de oro', message: 'Un golpe seco y una junta nueva. Los clientes aplauden cuando sale el primer café.', effects: { bars: { reputacion: 6, esperanza: 2 } } },
        { id: 'quemadura', result: 'malo', weight: 1, title: 'Quemadura', message: 'El vapor te alcanza la mano. Funciona, pero te arde todo el día.', effects: { bars: { salud: -6, estres: 3 } } },
      ],
    },
    {
      id: 'avisar',
      label: 'Avisar al jefe',
      outcomes: [
        { id: 'tecnico', result: 'bueno', weight: 2, title: 'Que venga el técnico', message: 'Sal llama al técnico. Hoy se sirve té, y nadie se quema.', effects: { bars: { estres: -2 } } },
        { id: 'colas', result: 'malo', weight: 1, title: 'Clientes furiosos', message: 'Sin café, la mañana es un infierno de quejas.', effects: { bars: { estres: 6 } } },
      ],
    },
  ],
};

const cliente: EventDef = {
  id: 'ap-cliente',
  role: 'inmigrante',
  kind: 'apertura',
  icon: 'plato',
  title: 'Cliente difícil',
  notification: '🍳 Un cliente te llama a gritos.',
  intro: '"¡Pedí los huevos POCO hechos!", grita un hombre en la barra mientras golpea el plato con el tenedor.',
  weight: 1,
  choices: [
    {
      id: 'calma',
      label: 'Sonreír y rehacerlos',
      outcomes: [
        { id: 'propina', result: 'bueno', weight: 3, title: 'Se ablanda', message: 'Al segundo intento, perfectos. Se va dejando propina y una disculpa.', effects: { bars: { dinero: 8, reputacion: 2 } } },
        { id: 'insiste', result: 'malo', weight: 1, title: 'Nunca está contento', message: 'Tampoco le gustan. Se va sin pagar y Sal te mira a ti.', effects: { bars: { estres: 6 } } },
      ],
    },
    {
      id: 'firme',
      label: 'Plantarle cara',
      outcomes: [
        { id: 'respeto', result: 'bueno', weight: 1, title: 'Respeto', message: 'Le dices, tranquilo, que así los pidió. La barra entera te da la razón.', effects: { bars: { reputacion: 4, esperanza: 2 } } },
        { id: 'queja', result: 'malo', weight: 2, title: 'Queja al dueño', message: 'Pide hablar con el encargado. Sal te pide paciencia "por el negocio".', effects: { bars: { estres: 5, reputacion: -2 } } },
      ],
    },
  ],
};

const periodista: EventDef = {
  id: 'ap-periodista',
  role: 'alcalde',
  kind: 'apertura',
  icon: 'micro',
  title: 'Emboscada en la escalinata',
  notification: '🎤 Una periodista te espera en la puerta.',
  intro: 'Una reportera del canal 7 te cierra el paso con el micrófono: "Alcalde, ¿es cierto que el metro subirá de precio?"',
  weight: 1,
  choices: [
    {
      id: 'responder',
      label: 'Responder',
      outcomes: [
        { id: 'clip', result: 'bueno', weight: 2, title: 'Buena respuesta', message: 'Respuesta corta, clara y con una sonrisa. Sale en el informativo del mediodía.', effects: { bars: { popularidad: 5, estres: 2 } } },
        { id: 'pifia', result: 'malo', weight: 1, title: 'Frase desafortunada', message: '"No descarto nada". Esa frase va a perseguirte toda la semana.', effects: { bars: { popularidad: -4, estres: 4 } } },
      ],
    },
    {
      id: 'esquivar',
      label: 'Sin comentarios',
      outcomes: [
        { id: 'pasa', result: 'bueno', weight: 2, title: 'Te escabulles', message: 'Entras por la puerta lateral. Hoy no habrá titular.', effects: { bars: { estres: -2 } } },
        { id: 'huye', result: 'malo', weight: 1, title: '"El alcalde huye"', message: 'La imagen de tu espalda abre el noticiero de la tarde.', effects: { bars: { popularidad: -3 } } },
      ],
    },
  ],
};

const carta: EventDef = {
  id: 'ap-carta',
  role: 'alcalde',
  kind: 'apertura',
  icon: 'carta',
  title: 'Carta de una vecina',
  notification: '✉️ Hay una carta escrita a mano en tu mesa.',
  intro: 'Entre los informes hay una carta a mano: una vecina del Bronx cuenta que la farola de su calle lleva tres meses apagada.',
  weight: 1,
  choices: [
    {
      id: 'arreglar',
      label: 'Que la arreglen hoy',
      outcomes: [
        { id: 'gracias', result: 'bueno', weight: 3, title: 'Luz en el Bronx', message: 'Esa noche la farola se enciende. La vecina se lo cuenta a todo el barrio.', effects: { bars: { popularidad: 4, control: 2 } } },
        { id: 'burocracia', result: 'malo', weight: 1, title: 'Burocracia', message: 'Tu orden se pierde entre tres departamentos. La farola sigue apagada.', effects: { bars: { control: -2 } } },
      ],
    },
    {
      id: 'archivar',
      label: 'Archivarla',
      outcomes: [
        { id: 'nada', result: 'bueno', weight: 1, title: 'Hay prioridades', message: 'Tienes una ciudad entera. La carta se queda en el cajón.', effects: { bars: { estres: -1 } } },
        { id: 'prensa', result: 'malo', weight: 1, title: 'La carta llega al Ledger', message: 'La vecina envía copia al periódico: "El alcalde no contesta".', effects: { bars: { popularidad: -4 } } },
      ],
    },
  ],
};

const policia: EventDef = {
  id: 'ap-policia',
  role: 'alcalde',
  kind: 'apertura',
  icon: 'placa',
  title: 'Reunión de urgencia',
  notification: '🚓 El jefe de policía te espera.',
  intro: 'El jefe de policía entra sin llamar: quiere más horas extra para sus agentes este fin de semana, "por si acaso".',
  weight: 1,
  choices: [
    {
      id: 'aprobar',
      label: 'Aprobar las horas',
      outcomes: [
        { id: 'tranquilo', result: 'bueno', weight: 3, title: 'Fin de semana tranquilo', message: 'Más patrullas, menos incidentes. El jefe te debe una.', effects: { bars: { control: 5, dinero: -20_000 } } },
        { id: 'gasto', result: 'malo', weight: 1, title: 'Gasto inútil', message: 'No pasa nada en todo el fin de semana y la factura llega igual.', effects: { bars: { dinero: -30_000 } } },
      ],
    },
    {
      id: 'negar',
      label: 'Negarte',
      outcomes: [
        { id: 'ahorro', result: 'bueno', weight: 2, title: 'Cuentas sanas', message: 'El fin de semana pasa sin incidentes. Tenías razón.', effects: { bars: { dinero: 10_000 } } },
        { id: 'roces', result: 'malo', weight: 1, title: 'Roces con la policía', message: 'El jefe sale dando un portazo. La relación se enfría.', effects: { bars: { control: -4 } } },
      ],
    },
  ],
};

const cafeConcejal: EventDef = {
  id: 'ap-concejal',
  role: 'alcalde',
  kind: 'apertura',
  icon: 'cafe',
  title: 'Café con una concejala',
  notification: '☕ La concejala Ruiz quiere un café contigo.',
  intro: 'La concejala Ruiz, de la oposición, te invita a un café antes de la sesión. Dice que "solo quiere charlar".',
  weight: 1,
  choices: [
    {
      id: 'aceptar',
      label: 'Aceptar el café',
      outcomes: [
        { id: 'aliada', result: 'bueno', weight: 2, title: 'Una aliada inesperada', message: 'Resulta que compartís más de lo que pensabais. Hoy votará contigo.', effects: { bars: { control: 5 } } },
        { id: 'trampa', result: 'malo', weight: 1, title: 'Era una trampa', message: 'Todo lo que dijiste aparece filtrado a la prensa al mediodía.', effects: { bars: { popularidad: -3, estres: 4 } } },
      ],
    },
    {
      id: 'rechazar',
      label: 'Agenda llena',
      outcomes: [
        { id: 'foco', result: 'bueno', weight: 1, title: 'Foco', message: 'Aprovechas para preparar la sesión. Llegas con los deberes hechos.', effects: { bars: { control: 2 } } },
        { id: 'desaire', result: 'malo', weight: 1, title: 'Desaire', message: 'La oposición se lo toma como un desplante. La sesión será larga.', effects: { bars: { control: -3, estres: 3 } } },
      ],
    },
  ],
};

export const APERTURA_EVENTS = [cubrir, propina, cafetera, cliente, periodista, carta, policia, cafeConcejal];
