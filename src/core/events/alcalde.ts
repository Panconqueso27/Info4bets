import type { EventDef } from './types';

/** Sucesos del alcalde. Números provisionales (el balanceo fino es de una fase posterior). */

export const TERM_DAYS = 30;

const huelga: EventDef = {
  id: 'huelga',
  icon: 'megafono',
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
  onResolve: (s, { outcome, deltas, previous, unlock }) => {
    if (outcome.result === 'bueno') unlock('alc04');
    const ok = (deltas.control ?? 0) >= -5;
    if (previous === 'huelga' && s.flags.ultimaHuelgaOk && ok) unlock('alc22');
    s.flags.ultimaHuelgaOk = ok;
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
          effects: { moneyPct: -25, bars: { popularidad: 10, control: 8 }, counters: ['huelgas'] },
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
          effects: { bars: { popularidad: -10, control: -9, estres: 8 }, counters: ['huelgas'] },
        },
        {
          id: 'se-desinfla',
          result: 'bueno',
          weight: 1,
          title: 'La huelga se desinfla',
          message:
            'El sindicato se divide antes del anochecer y los piquetes se dispersan. Mantienes las cuentas intactas y la autoridad, aunque algunos no lo olvidarán.',
          effects: { bars: { control: 6, popularidad: -2 }, counters: ['huelgas'] },
        },
      ],
    },
  ],
};

const corrupcion: EventDef = {
  id: 'corrupcion',
  icon: 'periodico',
  role: 'alcalde',
  kind: 'aleatorio',
  title: 'Escándalo de corrupción',
  notification: '📰 Tu nombre está en la portada del Daily Ledger.',
  intro:
    'El Daily Ledger publica que el contrato de {contrato} fue adjudicado a una empresa de tu cuñado. Los teléfonos no paran y el fiscal ya pidió los documentos.',
  weight: 0.7,
  variants: { contrato: ['recogida de basuras', 'reparación de puentes', 'las nuevas patrullas', 'alumbrado público'] },
  onResolve: (s, { unlock }) => {
    if (Number(s.flags.escandalos ?? 0) >= 2 && !s.gameOver) unlock('alc16');
  },
  choices: [
    {
      id: 'cooperar',
      label: 'Cooperar con la investigación',
      hint: 'Más probable salir limpio, pero si sale mal, duele.',
      outcomes: [
        {
          id: 'limpio',
          result: 'bueno',
          weight: 3,
          title: 'Limpio',
          message: 'Entregas cada papel. La investigación concluye que el contrato fue legal y el Ledger publica una rectificación en página 14. Sales reforzado.',
          effects: { bars: { popularidad: 8, control: 6 }, counters: ['escandalos'], unlock: ['alc03'] },
        },
        {
          id: 'manchado',
          result: 'malo',
          weight: 2,
          title: 'Irregularidades',
          message: 'No eras culpable, pero los papeles muestran descuidos. Multa a la ciudad, fondos congelados y una mancha en tu historial.',
          effects: { bars: { popularidad: -12, dinero: -150_000, control: -8 }, counters: ['escandalos'] },
        },
      ],
    },
    {
      id: 'negar',
      label: 'Negarlo todo',
      hint: 'Todo o nada.',
      outcomes: [
        {
          id: 'farol',
          result: 'bueno',
          weight: 2,
          title: 'Funcionó',
          message: 'Tu rueda de prensa es tan firme que el periódico duda de su fuente. En una semana nadie se acuerda.',
          effects: { bars: { popularidad: 6, control: 8 }, counters: ['escandalos'], unlock: ['alc03'] },
        },
        {
          id: 'pillado',
          result: 'malo',
          weight: 3,
          title: 'Te pillaron mintiendo',
          message: 'Aparece una grabación. Mentir fue peor que el contrato. Multas millonarias, concejales que te dan la espalda y manifestantes en la puerta.',
          effects: { bars: { popularidad: -15, dinero: -200_000, control: -10 }, counters: ['escandalos'] },
        },
      ],
    },
  ],
};

const desastre: EventDef = {
  id: 'desastre',
  icon: 'tormenta',
  role: 'alcalde',
  kind: 'aleatorio',
  title: 'Desastre natural',
  notification: '⛈️ Emergencia en la ciudad.',
  intro: 'La ciudad amanece con {tipo}. Los servicios de emergencia esperan tus órdenes y los noticieros ya están en directo.',
  weight: 0.6,
  variants: { tipo: ['una tormenta de nieve histórica', 'el metro inundado', 'un apagón en media ciudad', 'un incendio en un bloque de viviendas del Bronx'] },
  onResolve: (s, { previous, unlock }) => {
    if (previous === 'desastre' && !s.gameOver) unlock('alc21');
  },
  choices: [
    {
      id: 'rapida',
      label: 'Movilizar todo ya ($100K)',
      cost: 100_000,
      outcomes: [
        {
          id: 'heroe',
          result: 'bueno',
          weight: 4,
          title: 'Respuesta ejemplar',
          message: 'Evacuaciones a tiempo, albergues abiertos y tú con botas en el lugar. La foto de portada te muestra cargando mantas.',
          effects: { bars: { popularidad: 10, control: 10 }, counters: ['desastres'], unlock: ['alc05'] },
        },
        {
          id: 'caos',
          result: 'malo',
          weight: 1,
          title: 'Caos operativo',
          message: 'Mandaste todo, pero mal coordinado: camiones atascados y órdenes contradictorias. El gasto se dispara.',
          effects: { bars: { popularidad: -6, control: -8, dinero: -100_000 }, counters: ['desastres'] },
        },
      ],
    },
    {
      id: 'esperar',
      label: 'Esperar los informes',
      outcomes: [
        {
          id: 'prudente',
          result: 'bueno',
          weight: 1,
          title: 'Prudencia',
          message: 'Esperar resultó lo correcto: el daño fue menor de lo que parecía y ahorraste recursos.',
          effects: { bars: { popularidad: 3, control: 4 }, counters: ['desastres'], unlock: ['alc05'] },
        },
        {
          id: 'lento',
          result: 'malo',
          weight: 3,
          title: 'Demasiado lento',
          message: 'Mientras esperabas informes, la situación empeoró. Las imágenes de vecinos abandonados recorren todos los canales.',
          effects: { bars: { control: -12, popularidad: -10, dinero: -150_000 }, counters: ['desastres'] },
        },
      ],
    },
  ],
};

const protesta: EventDef = {
  id: 'protesta',
  icon: 'megafono',
  role: 'alcalde',
  kind: 'aleatorio',
  title: 'Manifestación ciudadana',
  notification: '📣 Miles de personas marchan hacia la alcaldía.',
  intro: 'Miles de vecinos marchan hacia la alcaldía contra {motivo}. Las pancartas llevan tu cara y el jefe de policía pide instrucciones.',
  weight: 0.6,
  variants: { motivo: ['el cierre de dos hospitales', 'la subida del metro', 'los desalojos en el Lower East Side', 'la falta de vivienda'] },
  onResolve: (s, { deltas, unlock }) => {
    if (Number(s.flags.protestas ?? 0) === 1 && (deltas.popularidad ?? 0) >= -5) unlock('alc02');
  },
  choices: [
    {
      id: 'dialogar',
      label: 'Bajar a dialogar',
      outcomes: [
        { id: 'escucha', result: 'bueno', weight: 3, title: 'Te escucharon', message: 'Bajas sin escolta, con un megáfono prestado. Prometes una mesa de trabajo y la marcha se disuelve con aplausos.', effects: { bars: { popularidad: 6, control: 2 }, counters: ['protestas'] } },
        { id: 'abucheo', result: 'malo', weight: 1, title: 'Abucheos', message: 'Te abuchean desde el primer segundo. Vuelves a subir las escaleras con un huevo en el traje.', effects: { bars: { popularidad: -4, estres: 6 }, counters: ['protestas'] } },
      ],
    },
    {
      id: 'policia',
      label: 'Que actúe la policía',
      outcomes: [
        { id: 'orden', result: 'bueno', weight: 2, title: 'Orden restablecido', message: 'La policía despeja la plaza sin incidentes graves. Muestras firmeza, aunque no te gana simpatías.', effects: { bars: { control: 6, popularidad: -3 }, counters: ['protestas'] } },
        { id: 'represion', result: 'malo', weight: 2, title: 'Imágenes de represión', message: 'Las imágenes de los porrazos abren todos los noticieros. La ciudad se indigna contigo.', effects: { bars: { popularidad: -12, control: -5 }, counters: ['protestas'] } },
      ],
    },
  ],
};

const elecciones: EventDef = {
  id: 'elecciones',
  icon: 'urna',
  role: 'alcalde',
  kind: 'diario',
  title: 'Elecciones municipales',
  notification: '🗳️ Hoy la ciudad vota.',
  intro: 'Tu mandato de 30 días terminó y hoy la ciudad decide si sigues. Tu popularidad marca tus opciones: cuanto más alta, más fácil la reelección.',
  weight: 1,
  condition: (s, day) => s.character.role === 'alcalde' && day > 1 && (day - 1) % TERM_DAYS === 0 && Number(s.flags.ultimaEleccion ?? 0) !== day,
  // La probabilidad de ganar es la popularidad.
  adjustWeight: (o, s) => (o.id === 'reelecto' ? Math.max(1, s.bars.popularidad ?? 0) : Math.max(1, 100 - (s.bars.popularidad ?? 0))),
  onResolve: (s, { deltas, unlock }) => {
    const before = (s.bars.popularidad ?? 0) - (deltas.popularidad ?? 0);
    if (before > 80) unlock('alc23');
    if (!s.gameOver) s.term += 1;
  },
  choices: [
    {
      id: 'recuento',
      label: 'Esperar el recuento',
      outcomes: [
        {
          id: 'reelecto',
          result: 'bueno',
          weight: 1,
          title: '¡Reelecto!',
          message: 'A medianoche se confirma: cuatro años más… o al menos otros treinta días. Confeti en la alcaldía y titulares a tu favor.',
          effects: { bars: { control: 10, popularidad: 5 }, counters: ['reelecciones'], unlock: ['alc24'] },
        },
        {
          id: 'derrota',
          result: 'malo',
          weight: 1,
          title: 'Derrota',
          message: 'El recuento es claro. La ciudad eligió a otra persona.',
          effects: { endGame: { title: 'Derrotado en las urnas', text: 'La ciudad votó por un cambio. Tu etapa en la alcaldía termina aquí.' } },
        },
      ],
    },
  ],
};

const crimen: EventDef = {
  id: 'crimen',
  icon: 'placa',
  role: 'alcalde',
  kind: 'accion',
  title: 'Reducir la criminalidad',
  summary: 'Invertir $120K en seguridad. Sube el control y baja el dinero.',
  notification: '',
  intro: 'El jefe de policía presenta un plan: más patrullas a pie, luz en los callejones y programas para jóvenes. Cuesta $120K.',
  weight: 0,
  cooldownDays: 5,
  choices: [
    {
      id: 'invertir',
      label: 'Aprobar el plan ($120K)',
      cost: 120_000,
      requires: { check: (s) => (s.bars.dinero ?? 0) >= 120_000, label: 'Necesitas $120K' },
      outcomes: [
        { id: 'baja', result: 'bueno', weight: 4, title: 'Calles más seguras', message: 'En un mes los robos bajan un 18%. Los comerciantes de la avenida te saludan por tu nombre.', effects: { bars: { control: 12 }, unlock: ['alc13'] } },
        { id: 'abuso', result: 'malo', weight: 1, title: 'Polémica policial', message: 'Las patrullas llegan, pero también las denuncias por abusos. Algo de control, mucho ruido.', effects: { bars: { control: 4, popularidad: -4 } } },
      ],
    },
  ],
};

const prensa: EventDef = {
  id: 'prensa',
  icon: 'micro',
  role: 'alcalde',
  kind: 'accion',
  title: 'Mejorar relación con la prensa',
  summary: 'Ronda de entrevistas. Sube la popularidad y el estrés.',
  notification: '',
  intro: 'Tu jefa de prensa te ha conseguido tres entrevistas seguidas: radio, televisión local y el Ledger. Será un día largo.',
  weight: 0,
  cooldownDays: 3,
  choices: [
    {
      id: 'entrevistas',
      label: 'Dar las entrevistas',
      outcomes: [
        { id: 'brilla', result: 'bueno', weight: 3, title: 'Brillaste', message: 'Cercano, rápido, con datos. Un clip tuyo se repite en todos los noticieros de la noche.', effects: { bars: { popularidad: 10, estres: 8 }, unlock: ['alc14'] } },
        { id: 'patinazo', result: 'malo', weight: 1, title: 'Patinazo', message: 'Una frase fuera de contexto se convierte en el titular del día. Toca pedir disculpas.', effects: { bars: { popularidad: -4, estres: 10 } } },
      ],
    },
  ],
};

const obra: EventDef = {
  id: 'obra',
  icon: 'cinta',
  role: 'alcalde',
  kind: 'accion',
  title: 'Inaugurar una obra pública',
  summary: 'Un parque o una biblioteca: $250K. Sube popularidad y control.',
  notification: '',
  intro: 'La nueva biblioteca del barrio está lista para inaugurarse: cinta roja, banda de música y cámaras. Terminarla cuesta $250K.',
  weight: 0,
  cooldownDays: 7,
  choices: [
    {
      id: 'inaugurar',
      label: 'Inaugurar ($250K)',
      cost: 250_000,
      requires: { check: (s) => (s.bars.dinero ?? 0) >= 250_000, label: 'Necesitas $250K' },
      outcomes: [
        { id: 'fiesta', result: 'bueno', weight: 4, title: 'Fiesta en el barrio', message: 'Los niños entran corriendo antes de que cortes la cinta. Es la foto del año.', effects: { bars: { popularidad: 12, control: 6 }, unlock: ['alc15'] } },
        { id: 'retraso', result: 'malo', weight: 1, title: 'Goteras el primer día', message: 'Llueve durante el acto y el techo nuevo gotea. La oposición se ríe, aunque el barrio agradece la biblioteca.', effects: { bars: { popularidad: 3, control: -2 } } },
      ],
    },
  ],
};

const descanso: EventDef = {
  id: 'descanso',
  icon: 'playa',
  role: 'alcalde',
  kind: 'accion',
  title: 'Tiempo de descanso',
  summary: 'Un día libre. Sube la salud y cuesta algo de control.',
  notification: '',
  intro: 'Tu médico insiste: un día en la casa de la playa, sin teléfono. La ciudad puede sobrevivir sin ti… ¿o no?',
  weight: 0,
  cooldownDays: 2,
  choices: [
    {
      id: 'descansar',
      label: 'Tomarte el día',
      outcomes: [
        { id: 'recarga', result: 'bueno', weight: 5, title: 'Recargado', message: 'Duermes nueve horas y caminas por la arena. Vuelves con otra cara.', effects: { bars: { control: -5, salud: 15, estres: -12 } } },
        { id: 'crisis', result: 'malo', weight: 1, title: 'Crisis en tu ausencia', message: 'Justo hoy un concejal convoca una rueda de prensa contra ti. Descansaste, pero a qué precio.', effects: { bars: { control: -10, salud: 8, estres: -4 } } },
      ],
    },
  ],
};

const concejales: EventDef = {
  id: 'concejales',
  icon: 'manos',
  role: 'alcalde',
  kind: 'accion',
  title: 'Ganarse a los concejales',
  summary: 'Negociar apoyos. Sube el control; si sale mal, baja la popularidad.',
  notification: '',
  intro: 'Los concejales de la bancada indecisa te esperan en el salón con café frío. Quieren algo a cambio de su apoyo.',
  weight: 0,
  cooldownDays: 4,
  choices: [
    {
      id: 'negociar',
      label: 'Negociar',
      outcomes: [
        { id: 'pacto', result: 'bueno', weight: 3, title: 'Pacto sellado', message: 'Cedes en lo pequeño y ganas en lo grande. Ahora tienes mayoría para tus proyectos.', effects: { bars: { control: 12 }, unlock: ['alc20'] } },
        { id: 'trato-malo', result: 'malo', weight: 2, title: 'Negociaste mal', message: 'Te sacan concesiones que la prensa descubre al día siguiente. Más apoyos, peor imagen.', effects: { bars: { control: 4, popularidad: -8 } } },
      ],
    },
  ],
};

export const ALCALDE_EVENTS = [huelga, corrupcion, desastre, protesta, elecciones, crimen, prensa, obra, descanso, concejales];
