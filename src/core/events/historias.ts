import { afinidad } from '../npcs';
import type { EventDef } from './types';

/**
 * Historias que continúan: personajes recurrentes que vuelven según cómo
 * los trataste, encuentros entre el inmigrante y el alcalde, y fechas
 * señaladas del año en Nueva York.
 */

// ------------------------------------------------------------ Personajes que recuerdan

const salAumento: EventDef = {
  id: 'sal-aumento',
  role: 'inmigrante',
  kind: 'personal',
  icon: 'propina',
  npc: 'sal',
  title: 'Sal tiene una propuesta',
  notification: '☕ Sal quiere hablar contigo en la trastienda.',
  intro: 'Sal cierra la puerta de la trastienda: "Llevas semanas salvándome el pellejo. Te subo el sueldo si te quedas con los turnos de la mañana."',
  weight: 0.6,
  cooldownDays: 7,
  condition: (s) => afinidad(s, 'sal') >= 3 && !s.flags.aumento,
  choices: [
    {
      id: 'aceptar',
      label: 'Aceptar el aumento',
      outcomes: [
        { id: 'sube', result: 'bueno', weight: 4, title: 'Aumento de sueldo', message: 'A partir de hoy cobras $20 más por jornada. Sal te da la mano como a un socio.', effects: { bars: { esperanza: 8, estres: 3 }, flags: { aumento: true }, npc: { id: 'sal', afinidad: 1, recuerdo: 'Te subió el sueldo.' } } },
        { id: 'madrugar', result: 'malo', weight: 1, title: 'Madrugones', message: 'El aumento llega, pero a las 5 de la mañana el diner está helado y vacío.', effects: { bars: { estres: 8, salud: -3 }, flags: { aumento: true } } },
      ],
    },
    {
      id: 'rechazar',
      label: 'Prefieres tu horario',
      outcomes: [
        { id: 'entiende', result: 'bueno', weight: 2, title: 'Sal lo respeta', message: '"Como quieras, chico. La oferta sigue en pie."', effects: { bars: { estres: -2 } } },
        { id: 'decepcion', result: 'malo', weight: 1, title: 'Sal se decepciona', message: 'Sal asiente sin decir nada. Esperaba otra respuesta.', effects: { npc: { id: 'sal', afinidad: -1, recuerdo: 'Rechazaste su aumento.' } } },
      ],
    },
  ],
};

const salAviso: EventDef = {
  id: 'sal-aviso',
  role: 'inmigrante',
  kind: 'personal',
  icon: 'reloj',
  npc: 'sal',
  title: 'Último aviso',
  notification: '☕ Sal no parece contento contigo.',
  intro: 'Sal te espera con los brazos cruzados: "Hay cola de gente que quiere tu puesto. Una más y estás fuera."',
  weight: 0.7,
  cooldownDays: 6,
  condition: (s) => afinidad(s, 'sal') <= -2,
  choices: [
    {
      id: 'disculpa',
      label: 'Pedir disculpas',
      outcomes: [
        { id: 'perdona', result: 'bueno', weight: 3, title: 'Borrón y cuenta nueva', message: 'Sal suspira: "Está bien. Pero quiero verte con ganas."', effects: { bars: { estres: 3 }, npc: { id: 'sal', afinidad: 2, recuerdo: 'Le pediste perdón.' } } },
        { id: 'frio', result: 'malo', weight: 1, title: 'Sigue frío', message: 'Acepta las disculpas sin mirarte. Va a costar recuperarlo.', effects: { bars: { esperanza: -4 }, npc: { id: 'sal', afinidad: 1 } } },
      ],
    },
    {
      id: 'orgullo',
      label: 'Defenderte',
      outcomes: [
        { id: 'respeto', result: 'bueno', weight: 1, title: 'Te ganas su respeto', message: 'Le recuerdas todo lo que haces. Sal se queda callado y al final asiente.', effects: { bars: { reputacion: 4 }, npc: { id: 'sal', afinidad: 2 } } },
        { id: 'multa', result: 'malo', weight: 2, title: 'Te descuenta el día', message: 'Sal te descuenta medio día "por insolente".', effects: { bars: { dinero: -60, estres: 8 }, npc: { id: 'sal', afinidad: -1 } } },
      ],
    },
  ],
};

const carmenFavor: EventDef = {
  id: 'carmen-favor',
  role: 'inmigrante',
  kind: 'personal',
  icon: 'plato',
  npc: 'carmen',
  title: 'Doña Carmen no olvida',
  notification: '🍲 Doña Carmen sube con una olla.',
  intro: 'Doña Carmen aparece con una olla de sancocho y un sobre: "Tú me ayudaste cuando nadie lo hizo. Esto es para ti."',
  weight: 0.6,
  cooldownDays: 8,
  condition: (s) => afinidad(s, 'carmen') >= 2,
  choices: [
    {
      id: 'aceptar',
      label: 'Aceptar con cariño',
      outcomes: [
        { id: 'familia', result: 'bueno', weight: 4, title: 'Casi familia', message: 'Cenáis juntos con sus nietos. Dentro del sobre, $60 "para el alquiler".', effects: { bars: { salud: 8, esperanza: 6, dinero: 60 }, npc: { id: 'carmen', afinidad: 1, recuerdo: 'Cenasteis juntos.' } } },
        { id: 'empacho', result: 'malo', weight: 1, title: 'Demasiado sancocho', message: 'Comes tanto por no desairarla que pasas la noche en vela.', effects: { bars: { salud: -2, esperanza: 4 } } },
      ],
    },
    {
      id: 'devolver',
      label: 'Devolverle el dinero',
      outcomes: [
        { id: 'orgullo', result: 'bueno', weight: 2, title: 'Le devuelves el sobre', message: '"Eres terco como mi difunto marido", se ríe. Se queda la olla en tu cocina.', effects: { bars: { reputacion: 4, salud: 4 }, npc: { id: 'carmen', afinidad: 1 } } },
        { id: 'ofendida', result: 'malo', weight: 1, title: 'Se ofende un poco', message: 'Doña Carmen se marcha murmurando que los jóvenes ya no aceptan nada.', effects: { bars: { esperanza: -2 } } },
      ],
    },
  ],
};

const carmenChisme: EventDef = {
  id: 'carmen-chisme',
  role: 'inmigrante',
  kind: 'personal',
  icon: 'puerta',
  npc: 'carmen',
  title: 'Radio Bemba',
  notification: '🚪 En la escalera se habla de ti.',
  intro: 'Doña Carmen sigue dolida contigo y lo cuenta a quien quiera oírla: "Ese no ayuda a nadie".',
  weight: 0.6,
  cooldownDays: 8,
  condition: (s) => afinidad(s, 'carmen') <= -2,
  choices: [
    {
      id: 'flores',
      label: 'Llevarle flores ($15)',
      cost: 15,
      outcomes: [
        { id: 'paz', result: 'bueno', weight: 3, title: 'Hacéis las paces', message: 'Doña Carmen huele las flores y te invita a pasar. El edificio respira.', effects: { bars: { reputacion: 5 }, npc: { id: 'carmen', afinidad: 3, recuerdo: 'Le llevaste flores.' } } },
        { id: 'no-abre', result: 'malo', weight: 1, title: 'No abre la puerta', message: 'Dejas las flores en el felpudo. Mañana verás si las recogió.', effects: { npc: { id: 'carmen', afinidad: 1 } } },
      ],
    },
    {
      id: 'ignorar',
      label: 'Ignorarla',
      outcomes: [
        { id: 'pasa', result: 'bueno', weight: 1, title: 'Se le pasa', message: 'Otro chisme más jugoso ocupa la escalera. Nadie se acuerda de ti.', effects: { bars: { estres: -1 } } },
        { id: 'fama', result: 'malo', weight: 2, title: 'Mala fama', message: 'Los vecinos dejan de saludarte en el ascensor.', effects: { bars: { reputacion: -6 } } },
      ],
    },
  ],
};

const ramiroPista: EventDef = {
  id: 'ramiro-pista',
  role: 'inmigrante',
  kind: 'personal',
  icon: 'manos',
  npc: 'ramiro',
  title: 'Don Ramiro te debe una',
  notification: '🤝 Don Ramiro quiere devolverte el favor.',
  intro: 'Don Ramiro no olvidó la redada: "Mi sobrino vende un piso en el Bronx. Si algún día compras casa, te hace precio."',
  weight: 0.8,
  cooldownDays: 30,
  condition: (s) => !!s.flags.ramiroEscondido && afinidad(s, 'ramiro') >= 0 && !s.flags.descuentoCasa && s.upgradeLevel < 3,
  choices: [
    {
      id: 'aceptar',
      label: 'Aceptar la oferta',
      outcomes: [
        { id: 'descuento', result: 'bueno', weight: 4, title: 'Precio de amigo', message: 'Tu próxima mejora de casa costará un 20% menos. Así se hacen las cosas en el barrio.', effects: { flags: { descuentoCasa: true }, bars: { esperanza: 5 }, npc: { id: 'ramiro', afinidad: 2, recuerdo: 'Te ofreció un descuento en la casa.' } } },
        { id: 'humo', result: 'malo', weight: 1, title: 'El sobrino desaparece', message: 'El sobrino ya no contesta el teléfono. Don Ramiro se disculpa avergonzado.', effects: { bars: { esperanza: -2 } } },
      ],
    },
    {
      id: 'no',
      label: 'No hace falta',
      outcomes: [
        { id: 'humilde', result: 'bueno', weight: 1, title: 'Humildad', message: '"Eres buena gente", te dice, y te da un abrazo de oso.', effects: { bars: { reputacion: 3 }, npc: { id: 'ramiro', afinidad: 1 } } },
        { id: 'insiste', result: 'malo', weight: 1, title: 'Lo ofendes', message: 'Don Ramiro insiste tres veces. A la tercera se va dolido.', effects: { npc: { id: 'ramiro', afinidad: -1 } } },
      ],
    },
  ],
};

const kowalski: EventDef = {
  id: 'kowalski',
  role: 'inmigrante',
  kind: 'personal',
  icon: 'placa',
  npc: 'kowalski',
  title: 'El agente Kowalski',
  notification: '🚓 Un policía del barrio entra al diner.',
  intro: 'El agente Kowalski pide un café y te observa: "Tú eres el del diner, ¿verdad? Últimamente hay mucho movimiento en tu edificio."',
  weight: 0.35,
  cooldownDays: 10,
  choices: [
    {
      id: 'amable',
      label: 'Invitarle al café',
      outcomes: [
        { id: 'aliado', result: 'bueno', weight: 3, title: 'Un aliado de uniforme', message: 'Kowalski sonríe: "Mi abuelo llegó de Polonia con lo puesto". Desde hoy te saluda por tu nombre.', effects: { bars: { estres: -3 }, npc: { id: 'kowalski', afinidad: 2, recuerdo: 'Le invitaste a un café.' } } },
        { id: 'soborno', result: 'malo', weight: 1, title: 'Lo malinterpreta', message: '"¿Me estás intentando sobornar?" Al final se ríe, pero te deja nervioso.', effects: { bars: { estres: 6 } } },
      ],
    },
    {
      id: 'seco',
      label: 'Responder lo justo',
      outcomes: [
        { id: 'nada', result: 'bueno', weight: 2, title: 'Sin problemas', message: 'Paga, deja diez centavos de propina y se va. Respiras hondo.', effects: { bars: { dinero: 3 } } },
        { id: 'sospecha', result: 'malo', weight: 1, title: 'Te tiene fichado', message: 'Apunta algo en su libreta antes de irse. No te gusta nada.', effects: { bars: { estres: 5 }, npc: { id: 'kowalski', afinidad: -1, recuerdo: 'Le respondiste con frialdad.' } } },
      ],
    },
  ],
};

const ruizPacto: EventDef = {
  id: 'ruiz-pacto',
  role: 'alcalde',
  kind: 'personal',
  icon: 'manos',
  npc: 'ruiz',
  title: 'La oposición tiende la mano',
  notification: '🤝 La concejala Ruiz te propone un pacto.',
  intro: 'Ruiz entra sin cita: "Usted y yo no nos parecemos, pero esta ley de vivienda la podemos sacar juntos."',
  weight: 0.6,
  cooldownDays: 8,
  condition: (s) => afinidad(s, 'ruiz') >= 3,
  choices: [
    {
      id: 'pactar',
      label: 'Firmar el pacto',
      outcomes: [
        { id: 'ley', result: 'bueno', weight: 4, title: 'Ley aprobada por unanimidad', message: 'Las fotos de los dos firmando dan la vuelta a la ciudad. Pocas veces se ve algo así.', effects: { bars: { control: 10, popularidad: 6 }, npc: { id: 'ruiz', afinidad: 1, recuerdo: 'Firmasteis juntos la ley de vivienda.' } } },
        { id: 'traicion', result: 'malo', weight: 1, title: 'Te la jugó', message: 'A última hora Ruiz cambia el texto y se lleva todo el mérito.', effects: { bars: { control: -4, popularidad: -3 }, npc: { id: 'ruiz', afinidad: -3, recuerdo: 'Te traicionó con la ley.' } } },
      ],
    },
    {
      id: 'solo',
      label: 'Gobernar solo',
      outcomes: [
        { id: 'firme', result: 'bueno', weight: 1, title: 'Mano firme', message: 'Sacas tu propia ley. Más lenta, pero tuya.', effects: { bars: { control: 4 } } },
        { id: 'ofendida', result: 'malo', weight: 1, title: 'Puente roto', message: 'Ruiz sale dando un portazo. No volverá a ofrecerte nada pronto.', effects: { npc: { id: 'ruiz', afinidad: -2 } } },
      ],
    },
  ],
};

const ruizMocion: EventDef = {
  id: 'ruiz-mocion',
  role: 'alcalde',
  kind: 'personal',
  icon: 'urna',
  npc: 'ruiz',
  title: 'Moción de censura',
  notification: '⚖️ La oposición prepara una moción contra ti.',
  intro: 'Ruiz no perdona tus desplantes. Ha reunido firmas para una moción de censura y la vota esta tarde.',
  weight: 0.7,
  cooldownDays: 10,
  condition: (s) => afinidad(s, 'ruiz') <= -2,
  choices: [
    {
      id: 'negociar',
      label: 'Negociar con ella',
      outcomes: [
        { id: 'retira', result: 'bueno', weight: 2, title: 'Retira la moción', message: 'Cedes en dos puntos de su programa. Ruiz retira la moción en el último minuto.', effects: { bars: { control: -2 }, npc: { id: 'ruiz', afinidad: 3, recuerdo: 'Negociasteis para frenar la moción.' } } },
        { id: 'humilla', result: 'malo', weight: 1, title: 'Te humilla en público', message: 'Acepta reunirse… para filtrarlo después a la prensa.', effects: { bars: { popularidad: -6 } } },
      ],
    },
    {
      id: 'votacion',
      label: 'Ir a la votación',
      outcomes: [
        { id: 'sobrevives', result: 'bueno', weight: 2, title: 'Sobrevives', message: 'La moción cae por tres votos. Sales reforzado.', effects: { bars: { control: 6 } } },
        { id: 'tocado', result: 'malo', weight: 2, title: 'Gobierno tocado', message: 'Sobrevives por un voto, pero la ciudad ha visto lo débil que estás.', effects: { bars: { control: -12, popularidad: -4 } } },
      ],
    },
  ],
};

const brooksExclusiva: EventDef = {
  id: 'brooks-exclusiva',
  role: 'alcalde',
  kind: 'personal',
  icon: 'micro',
  npc: 'brooks',
  title: 'La exclusiva de Diane',
  notification: '🎤 Diane Brooks te ofrece una exclusiva.',
  intro: 'Diane Brooks te llama: "Me trató bien cuando nadie lo hacía. Le ofrezco el especial de las 9 para que cuente su versión."',
  weight: 0.6,
  cooldownDays: 8,
  condition: (s) => afinidad(s, 'brooks') >= 2,
  choices: [
    {
      id: 'aceptar',
      label: 'Hacer el especial',
      outcomes: [
        { id: 'audiencia', result: 'bueno', weight: 4, title: 'Récord de audiencia', message: 'Media ciudad te ve hablar de tu infancia en Queens. Las encuestas suben al día siguiente.', effects: { bars: { popularidad: 9, estres: 4 }, npc: { id: 'brooks', afinidad: 1, recuerdo: 'Hiciste su especial de las 9.' } } },
        { id: 'pregunta', result: 'malo', weight: 1, title: 'La pregunta trampa', message: 'Diane es amiga, pero periodista. Su última pregunta te pilla sin respuesta.', effects: { bars: { popularidad: -3, estres: 6 } } },
      ],
    },
    {
      id: 'declinar',
      label: 'Declinar',
      outcomes: [
        { id: 'descanso', result: 'bueno', weight: 1, title: 'Noche tranquila', message: 'Cenas en casa. La ciudad puede vivir sin verte en la tele.', effects: { bars: { estres: -4 } } },
        { id: 'dolida', result: 'malo', weight: 1, title: 'Diane toma nota', message: '"Usted sabrá." Cuelga más rápido de lo normal.', effects: { npc: { id: 'brooks', afinidad: -1 } } },
      ],
    },
  ],
};

const brooksInvestiga: EventDef = {
  id: 'brooks-investiga',
  role: 'alcalde',
  kind: 'personal',
  icon: 'periodico',
  npc: 'brooks',
  title: 'Diane investiga',
  notification: '📰 El canal 7 prepara un reportaje sobre ti.',
  intro: 'Diane Brooks no olvida tus desplantes. Su equipo lleva días grabando en los barrios que nunca visitas.',
  weight: 0.6,
  cooldownDays: 10,
  condition: (s) => afinidad(s, 'brooks') <= -2,
  choices: [
    {
      id: 'llamar',
      label: 'Llamarla',
      outcomes: [
        { id: 'tregua', result: 'bueno', weight: 2, title: 'Tregua', message: 'Le ofreces acompañarte un día entero. El reportaje cambia de tono.', effects: { bars: { popularidad: 3 }, npc: { id: 'brooks', afinidad: 3, recuerdo: 'Le abriste tu agenda.' } } },
        { id: 'emite', result: 'malo', weight: 1, title: 'Lo emite igual', message: 'El reportaje sale a la luz con tu llamada incluida.', effects: { bars: { popularidad: -8 } } },
      ],
    },
    {
      id: 'ignorar',
      label: 'Que publique lo que quiera',
      outcomes: [
        { id: 'flojo', result: 'bueno', weight: 1, title: 'Reportaje flojo', message: 'Al final no encontró nada jugoso. El reportaje pasa sin pena ni gloria.', effects: { bars: { control: 2 } } },
        { id: 'demoledor', result: 'malo', weight: 2, title: 'Reportaje demoledor', message: 'Calles sin luz, colegios con goteras. La audiencia es enorme.', effects: { bars: { popularidad: -10 } } },
      ],
    },
  ],
};

const russoTregua: EventDef = {
  id: 'russo-tregua',
  role: 'alcalde',
  kind: 'personal',
  icon: 'megafono',
  npc: 'russo',
  title: 'Frank Russo propone una tregua',
  notification: '📢 El sindicato quiere hablar en paz.',
  intro: 'Frank Russo se sienta en tu despacho con el sombrero en las rodillas: "Usted cumplió. Le ofrezco un año sin huelgas si firmamos el convenio."',
  weight: 0.6,
  cooldownDays: 15,
  condition: (s) => afinidad(s, 'russo') >= 2 && !s.flags.treguaSindical,
  choices: [
    {
      id: 'firmar',
      label: 'Firmar el convenio',
      outcomes: [
        { id: 'paz', result: 'bueno', weight: 4, title: 'Paz laboral', message: 'Las huelgas serán mucho menos frecuentes. La ciudad funciona como un reloj.', effects: { flags: { treguaSindical: true }, bars: { control: 6 }, npc: { id: 'russo', afinidad: 1, recuerdo: 'Firmasteis la tregua.' } } },
        { id: 'caro', result: 'malo', weight: 1, title: 'Convenio caro', message: 'La paz tiene precio: el convenio sale caro y las arcas lo notan.', effects: { flags: { treguaSindical: true }, bars: { dinero: -80_000 } } },
      ],
    },
    {
      id: 'no',
      label: 'Sin compromisos',
      outcomes: [
        { id: 'libre', result: 'bueno', weight: 1, title: 'Manos libres', message: 'Prefieres negociar caso a caso. Russo lo entiende.', effects: { bars: { control: 2 } } },
        { id: 'tension', result: 'malo', weight: 1, title: 'Tensión', message: 'Russo se pone el sombrero y se va sin despedirse. Habrá guerra.', effects: { npc: { id: 'russo', afinidad: -2 } } },
      ],
    },
  ],
};

// ------------------------------------------------------------ Encuentros entre protagonistas

const cruceTele: EventDef = {
  id: 'cruce-tele',
  role: 'inmigrante',
  kind: 'personal',
  icon: 'micro',
  cross: true,
  title: 'El alcalde en la tele',
  notification: '📺 El alcalde sale en la tele del diner.',
  intro: 'En la tele del diner sale {otro}, el alcalde, prometiendo "una ciudad para todos los que la levantan cada mañana". La barra entera se calla.',
  weight: 0.35,
  cooldownDays: 9,
  choices: [
    {
      id: 'creer',
      label: 'Creerle',
      outcomes: [
        { id: 'ilusion', result: 'bueno', weight: 2, title: 'Un poco de ilusión', message: 'Quizá esta vez sí. Terminas el turno silbando.', effects: { bars: { esperanza: 5 } } },
        { id: 'humo', result: 'malo', weight: 1, title: 'Promesas', message: 'Un compañero se ríe: "Lo mismo dijo el anterior".', effects: { bars: { esperanza: -2 } } },
      ],
    },
    {
      id: 'apagar',
      label: 'Cambiar de canal',
      outcomes: [
        { id: 'beisbol', result: 'bueno', weight: 2, title: 'Béisbol', message: 'Ganan los Mets. Eso sí que sube el ánimo.', effects: { bars: { estres: -3 } } },
        { id: 'quejas', result: 'malo', weight: 1, title: 'Discusión en la barra', message: 'Dos clientes discuten de política hasta que Sal los echa.', effects: { bars: { estres: 3 } } },
      ],
    },
  ],
};

const cruceVisita: EventDef = {
  id: 'cruce-visita',
  role: 'inmigrante',
  kind: 'personal',
  icon: 'cinta',
  cross: true,
  title: 'El alcalde en el diner',
  notification: '📸 ¡El alcalde ha entrado en el diner!',
  intro: '{otro}, el alcalde, entra al diner rodeado de cámaras para "tomar un café con el pueblo". Te toca servirle.',
  weight: 0.3,
  cooldownDays: 14,
  choices: [
    {
      id: 'hablar',
      label: 'Contarle lo del barrio',
      outcomes: [
        { id: 'escucha', result: 'bueno', weight: 3, title: 'Te escuchó', message: '{otro} apunta tu nombre y lo que le cuentas de las redadas. Sales en el periódico de mañana.', effects: { bars: { reputacion: 8, esperanza: 6 }, flags: { conocioAlAlcalde: true } } },
        { id: 'escoltas', result: 'malo', weight: 1, title: 'Los escoltas', message: 'Antes de terminar la frase, un escolta te aparta. Las cámaras lo graban todo.', effects: { bars: { estres: 6 } } },
      ],
    },
    {
      id: 'servir',
      label: 'Servirle en silencio',
      outcomes: [
        { id: 'propina', result: 'bueno', weight: 2, title: 'Propina de alcalde', message: 'Deja $20 de propina "para la foto". Sal enmarca el billete.', effects: { bars: { dinero: 20 } } },
        { id: 'nada', result: 'malo', weight: 1, title: 'Ni te miró', message: 'Se va sin probar el café. Ni una palabra.', effects: { bars: { esperanza: -2 } } },
      ],
    },
  ],
};

const cruceDiner: EventDef = {
  id: 'cruce-diner',
  role: 'alcalde',
  kind: 'personal',
  icon: 'cafe',
  cross: true,
  title: 'Café en un diner',
  notification: '☕ Tu equipo te ha organizado una visita a un diner.',
  intro: 'Visitas un diner del barrio para la foto. En la cocina, {otro} te mira fijamente: "¿Puedo decirle algo, alcalde? Aquí viven con miedo a las redadas."',
  weight: 0.35,
  cooldownDays: 14,
  choices: [
    {
      id: 'escuchar',
      label: 'Escuchar de verdad',
      outcomes: [
        { id: 'promesa', result: 'bueno', weight: 3, title: 'Una conversación real', message: '{otro} te cuenta veinte minutos de su vida. Prometes una mesa de barrio y lo cumples.', effects: { bars: { popularidad: 7, estres: 3 }, flags: { conocioAlInmigrante: true } } },
        { id: 'polemica', result: 'malo', weight: 1, title: 'Polémica', message: 'La foto con {otro} enfurece a tus socios más duros.', effects: { bars: { control: -5, popularidad: 3 } } },
      ],
    },
    {
      id: 'foto',
      label: 'Sonreír para la foto',
      outcomes: [
        { id: 'portada', result: 'bueno', weight: 2, title: 'Buena foto', message: 'La foto queda perfecta. El café, no tanto.', effects: { bars: { popularidad: 3 } } },
        { id: 'frio', result: 'malo', weight: 1, title: '"Alcalde de plástico"', message: 'Un periodista recoge la mirada de {otro} y titula: "El alcalde que no escucha".', effects: { bars: { popularidad: -5 } } },
      ],
    },
  ],
};

const cruceCarta: EventDef = {
  id: 'cruce-carta',
  role: 'alcalde',
  kind: 'personal',
  icon: 'carta',
  cross: true,
  title: 'Una carta desde la cocina',
  notification: '✉️ Una carta firmada por un trabajador del diner.',
  intro: 'Entre el correo hay una carta de {otro}, que trabaja en un diner del barrio: pide que la policía no colabore con las redadas.',
  weight: 0.3,
  cooldownDays: 12,
  choices: [
    {
      id: 'proteger',
      label: 'Declarar ciudad refugio',
      outcomes: [
        { id: 'refugio', result: 'bueno', weight: 3, title: 'Ciudad refugio', message: 'Tu decreto sale en todos los periódicos. En los barrios, la gente llora de alivio.', effects: { bars: { popularidad: 8, control: -4 } } },
        { id: 'choque', result: 'malo', weight: 2, title: 'Choque con Washington', message: 'El gobierno federal amenaza con recortar fondos.', effects: { bars: { dinero: -120_000, control: -6, popularidad: 4 } } },
      ],
    },
    {
      id: 'archivar',
      label: 'Archivarla',
      outcomes: [
        { id: 'calma', result: 'bueno', weight: 1, title: 'Sin conflictos', message: 'Evitas abrir un frente nuevo con Washington. Por ahora.', effects: { bars: { control: 3 } } },
        { id: 'filtra', result: 'malo', weight: 1, title: 'La carta se filtra', message: 'Alguien filtra la carta y tu silencio a la prensa.', effects: { bars: { popularidad: -6 } } },
      ],
    },
  ],
};

// ------------------------------------------------------------ Fechas señaladas

const m = (s: { today: { date: string } }) => Number(s.today.date.slice(5, 7));
const d = (s: { today: { date: string } }) => Number(s.today.date.slice(8, 10));

function seasonal(id: string, role: 'inmigrante' | 'alcalde', icon: string, title: string, when: (s: any) => boolean, intro: string, choices: EventDef['choices']): EventDef {
  return { id: `${id}-${role}`, role, kind: 'diario', icon, title, notification: `🗓 ${title}`, intro, weight: 1, cooldownDays: 300, condition: when, choices };
}

const halloween = (s: any) => m(s) === 10 && d(s) >= 25;
const thanksgiving = (s: any) => m(s) === 11 && d(s) >= 22 && d(s) <= 28;
const navidad = (s: any) => m(s) === 12 && d(s) >= 20;
const julio = (s: any) => m(s) === 7 && d(s) <= 6;
const patricio = (s: any) => m(s) === 3 && d(s) >= 14 && d(s) <= 18;

const TEMPORADA: EventDef[] = [
  seasonal('halloween', 'inmigrante', 'estrella', 'Halloween en el barrio', halloween, 'Los niños del edificio van disfrazados de Cazafantasmas y llaman a tu puerta: "¡Truco o trato!"', [
    { id: 'dulces', label: 'Repartir dulces ($10)', cost: 10, outcomes: [
      { id: 'fiesta', result: 'bueno', weight: 4, title: 'El más popular del edificio', message: 'Corre la voz de que en tu puerta dan chocolatinas buenas. Hasta Doña Carmen se ríe.', effects: { bars: { reputacion: 6, esperanza: 4 } } },
      { id: 'huevos', result: 'malo', weight: 1, title: 'Se acabaron', message: 'A las ocho ya no te quedan dulces. Tu puerta amanece con huevos.', effects: { bars: { estres: 4 } } } ] },
    { id: 'apagar', label: 'Apagar la luz', outcomes: [
      { id: 'tranquilo', result: 'bueno', weight: 1, title: 'Noche tranquila', message: 'Ves una película de terror a oscuras, con palomitas y sin visitas.', effects: { bars: { estres: -3 } } },
      { id: 'broma', result: 'malo', weight: 2, title: 'Truco', message: 'Los niños te llenan el buzón y la puerta de papel higiénico.', effects: { bars: { reputacion: -2, estres: 2 } } } ] },
  ]),
  seasonal('halloween', 'alcalde', 'estrella', 'Desfile de Halloween', halloween, 'El desfile de Halloween del Village te invita a encabezarlo disfrazado.', [
    { id: 'disfraz', label: 'Ir disfrazado', outcomes: [
      { id: 'viral', result: 'bueno', weight: 3, title: 'Alcalde vampiro', message: 'Tu disfraz de Drácula sale en todas las portadas. La ciudad se ríe contigo.', effects: { bars: { popularidad: 8, estres: -3 } } },
      { id: 'ridiculo', result: 'malo', weight: 1, title: 'Ridículo', message: 'La oposición usa la foto del disfraz en cada pleno durante meses.', effects: { bars: { control: -4 } } } ] },
    { id: 'traje', label: 'Ir de traje', outcomes: [
      { id: 'serio', result: 'bueno', weight: 1, title: 'Institucional', message: 'Saludas desde la tribuna, serio y correcto. Nadie se queja.', effects: { bars: { control: 2 } } },
      { id: 'aburrido', result: 'malo', weight: 1, title: '"Aburrido"', message: 'Los jóvenes del desfile te abuchean por soso y sin gracia.', effects: { bars: { popularidad: -3 } } } ] },
  ]),
  seasonal('thanks', 'inmigrante', 'plato', 'Acción de Gracias', thanksgiving, 'Lupe organiza una cena de Acción de Gracias en la parroquia para los que están lejos de su familia.', [
    { id: 'ir', label: 'Ir y llevar algo ($15)', cost: 15, outcomes: [
      { id: 'mesa', result: 'bueno', weight: 4, title: 'Una mesa larga', message: 'Pavo, tamales, arroz con frijoles y pierogi. Veinte acentos en una sola mesa.', effects: { bars: { esperanza: 10, reputacion: 4 } } },
      { id: 'nostalgia', result: 'malo', weight: 1, title: 'Nostalgia', message: 'Es precioso, pero echas de menos a tu madre más que nunca.', effects: { bars: { esperanza: -2 } } } ] },
    { id: 'quedarse', label: 'Quedarse en casa', outcomes: [
      { id: 'llamada', result: 'bueno', weight: 1, title: 'Llamada a casa', message: 'Hablas una hora con tu familia. Vale cada centavo.', effects: { bars: { esperanza: 3, dinero: -10 } } },
      { id: 'solo', result: 'malo', weight: 2, title: 'Cena solo', message: 'Un sándwich frío frente a la tele. Se te hace un día muy largo.', effects: { bars: { esperanza: -5 } } } ] },
  ]),
  seasonal('thanks', 'alcalde', 'plato', 'Desfile de Acción de Gracias', thanksgiving, 'El gran desfile de globos recorre la avenida. Tu equipo propone servir comida en un comedor social después.', [
    { id: 'servir', label: 'Servir en el comedor', outcomes: [
      { id: 'humano', result: 'bueno', weight: 3, title: 'Con delantal', message: 'Sirves puré durante tres horas. Nadie lo olvida.', effects: { bars: { popularidad: 7, salud: -2 } } },
      { id: 'postureo', result: 'malo', weight: 1, title: '"Postureo"', message: 'Te vas a los 15 minutos, justo después de la foto. Se nota.', effects: { bars: { popularidad: -4 } } } ] },
    { id: 'tribuna', label: 'Solo el desfile', outcomes: [
      { id: 'globos', result: 'bueno', weight: 1, title: 'Día de globos', message: 'Saludas desde la tribuna con tu familia mientras pasan los globos.', effects: { bars: { estres: -4 } } },
      { id: 'viento', result: 'malo', weight: 1, title: 'Viento', message: 'Un globo de Snoopy se suelta. Te culpan de la organización.', effects: { bars: { control: -3 } } } ] },
  ]),
  seasonal('navidad', 'inmigrante', 'estrella', 'Navidad en Nueva York', navidad, 'Las luces del Rockefeller Center se encienden. Mandar un regalo a casa cuesta $80.', [
    { id: 'regalo', label: 'Mandar el regalo ($80)', cost: 80, outcomes: [
      { id: 'feliz', result: 'bueno', weight: 4, title: 'Feliz Navidad', message: 'Tu familia abre el paquete por videollamada... bueno, por teléfono. Lloráis todos.', effects: { bars: { esperanza: 14 } } },
      { id: 'aduana', result: 'malo', weight: 1, title: 'Atascado en aduanas', message: 'El paquete llegará en febrero. La intención es lo que cuenta.', effects: { bars: { esperanza: 4, estres: 4 } } } ] },
    { id: 'pista', label: 'Patinar gratis en el parque', outcomes: [
      { id: 'magia', result: 'bueno', weight: 2, title: 'Magia de invierno', message: 'Te caes once veces en la pista de hielo y te ríes las once.', effects: { bars: { estres: -6, esperanza: 4 } } },
      { id: 'caida', result: 'malo', weight: 1, title: 'Muñeca torcida', message: 'Una mala caída. Mañana trabajarás con la muñeca vendada.', effects: { bars: { salud: -6 } } } ] },
  ]),
  seasonal('navidad', 'alcalde', 'estrella', 'Encendido del árbol', navidad, 'Te toca encender el árbol del Rockefeller Center delante de miles de personas y la tele nacional.', [
    { id: 'discurso', label: 'Discurso emotivo', outcomes: [
      { id: 'aplauso', result: 'bueno', weight: 3, title: 'Noche mágica', message: 'Hablas de la ciudad que nunca duerme y de los que la cuidan. Ovación.', effects: { bars: { popularidad: 9 } } },
      { id: 'apagon', result: 'malo', weight: 1, title: 'Apagón', message: 'Pulsas el botón y el árbol no se enciende. Los segundos más largos de tu vida.', effects: { bars: { popularidad: -5, estres: 8 } } } ] },
    { id: 'breve', label: 'Ser breve', outcomes: [
      { id: 'correcto', result: 'bueno', weight: 1, title: 'Correcto', message: 'Tres frases y a encender. Todos contentos.', effects: { bars: { popularidad: 3 } } },
      { id: 'frio', result: 'malo', weight: 1, title: 'Frío', message: 'Hace un frío terrible y tú, con prisas, ni sonríes.', effects: { bars: { popularidad: -2 } } } ] },
  ]),
  seasonal('julio', 'inmigrante', 'estrella', '4 de Julio', julio, 'Fuegos artificiales sobre el East River. Tus compañeros suben a la azotea con cervezas.', [
    { id: 'azotea', label: 'Subir a la azotea', outcomes: [
      { id: 'fuegos', result: 'bueno', weight: 3, title: 'Cielo de colores', message: 'Brindáis por el país que os acoge, aunque a veces cueste.', effects: { bars: { esperanza: 8, reputacion: 3 } } },
      { id: 'policia', result: 'malo', weight: 1, title: 'La policía sube', message: 'Un vecino se queja del ruido y llega una patrulla.', effects: { bars: { estres: 6 } } } ] },
    { id: 'turno', label: 'Hacer turno extra (+$40)', outcomes: [
      { id: 'pagado', result: 'bueno', weight: 2, title: 'Paga de festivo', message: 'El diner está lleno y las propinas también.', effects: { bars: { dinero: 40, estres: 4 } } },
      { id: 'vacio', result: 'malo', weight: 1, title: 'Diner vacío', message: 'Todo el mundo está viendo los fuegos. Tú friegas.', effects: { bars: { dinero: 20, esperanza: -3 } } } ] },
  ]),
  seasonal('julio', 'alcalde', 'estrella', '4 de Julio', julio, 'Los fuegos artificiales sobre el East River cuestan $60K. Tu equipo sugiere recortarlos.', [
    { id: 'fuegos', label: 'Fuegos completos ($60K)', cost: 60_000, outcomes: [
      { id: 'espectaculo', result: 'bueno', weight: 4, title: 'Espectáculo', message: 'El cielo se llena de color. Dos millones de personas lo ven.', effects: { bars: { popularidad: 8 } } },
      { id: 'lluvia', result: 'malo', weight: 1, title: 'Llueve', message: 'Una tormenta de verano arruina la mitad del espectáculo.', effects: { bars: { popularidad: 1 } } } ] },
    { id: 'recortar', label: 'Recortarlos', outcomes: [
      { id: 'ahorro', result: 'bueno', weight: 1, title: 'Austeridad', message: 'Ahorras el dinero y, para tu sorpresa, nadie protesta demasiado.', effects: { bars: { control: 3 } } },
      { id: 'tacano', result: 'malo', weight: 2, title: '"El alcalde tacaño"', message: 'Los periódicos comparan tus fuegos con los de Nueva Jersey.', effects: { bars: { popularidad: -6 } } } ] },
  ]),
  seasonal('patricio', 'inmigrante', 'estrella', 'San Patricio', patricio, 'El desfile de San Patricio llena la Quinta Avenida de verde. El diner sirve cerveza verde y hay propinas dobles.', [
    { id: 'turno', label: 'Doblar turno (+$50)', outcomes: [
      { id: 'propinas', result: 'bueno', weight: 3, title: 'Propinas verdes', message: 'Los irlandeses del barrio cantan y dejan propina generosa.', effects: { bars: { dinero: 50, estres: 4 } } },
      { id: 'pelea', result: 'malo', weight: 1, title: 'Pelea de bar', message: 'Dos clientes acaban a puñetazos. Tú recoges los cristales.', effects: { bars: { dinero: 25, estres: 8 } } } ] },
    { id: 'desfile', label: 'Ir al desfile', outcomes: [
      { id: 'verde', result: 'bueno', weight: 2, title: 'Todos somos irlandeses', message: 'Gaitas, tréboles y gente que te abraza sin conocerte.', effects: { bars: { esperanza: 6, estres: -3 } } },
      { id: 'resaca', result: 'malo', weight: 1, title: 'Resaca verde', message: 'Demasiada cerveza verde. Mañana será duro.', effects: { bars: { salud: -4 } } } ] },
  ]),
  seasonal('patricio', 'alcalde', 'estrella', 'San Patricio', patricio, 'Encabezas el desfile de San Patricio. Los organizadores no quieren que desfile un colectivo del barrio.', [
    { id: 'incluir', label: 'Exigir que desfilen todos', outcomes: [
      { id: 'valiente', result: 'bueno', weight: 2, title: 'Alcalde de todos', message: 'Desfilas junto al colectivo vetado. Los barrios lo celebran.', effects: { bars: { popularidad: 8, control: -3 } } },
      { id: 'boicot', result: 'malo', weight: 1, title: 'Boicot', message: 'Los organizadores te retiran la invitación.', effects: { bars: { control: -6, popularidad: 2 } } } ] },
    { id: 'tradicion', label: 'Respetar la tradición', outcomes: [
      { id: 'tranquilo', result: 'bueno', weight: 1, title: 'Sin polémica', message: 'Desfilas, saludas a la multitud y te vas a casa sin polémicas.', effects: { bars: { control: 3 } } },
      { id: 'critica', result: 'malo', weight: 1, title: 'Críticas', message: 'Los barrios te reprochan haber mirado hacia otro lado.', effects: { bars: { popularidad: -5 } } } ] },
  ]),
];

export const HISTORIAS_EVENTS: EventDef[] = [
  salAumento, salAviso, carmenFavor, carmenChisme, ramiroPista, kowalski,
  ruizPacto, ruizMocion, brooksExclusiva, brooksInvestiga, russoTregua,
  cruceTele, cruceVisita, cruceDiner, cruceCarta,
  ...TEMPORADA,
];
