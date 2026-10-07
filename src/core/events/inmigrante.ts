import type { EventDef } from './types';

/** Sucesos del inmigrante. Números provisionales (el balanceo fino es de una fase posterior). */

const redada: EventDef = {
  id: 'redada',
  icon: 'sirena',
  role: 'inmigrante',
  kind: 'aleatorio',
  title: 'Redada de inmigración',
  notification: '🚨 Hay una redada de inmigración en el barrio.',
  intro:
    'Sirenas sin luces. Tres camionetas sin placas frenan frente a {place}. Agentes con chaleco piden papeles puerta por puerta, y alguien grita tu nombre desde la esquina.',
  weight: 1,
  // La asesoría legal pagada protege: los resultados graves son menos probables.
  adjustWeight: (o, s) => (s.flags.asesoriaLegal && (o.id === 'detenido' || o.id === 'cerco') ? o.weight * 0.4 : o.weight),
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
            flags: { redadasSinDetencion: 0 },
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
            counters: ['redadasSinDetencion'],
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
            counters: ['redadasSinDetencion'],
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
            counters: ['redadasSinDetencion'],
            unlock: ['inm07'],
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
            counters: ['redadasSinDetencion', 'vecinosAyudados'],
            flags: { ramiroEscondido: true },
            npc: { id: 'ramiro', afinidad: 3, recuerdo: 'Lo escondiste durante la redada.' },
            unlock: ['inm07'],
          },
        },
      ],
    },
  ],
};

const manifestacion: EventDef = {
  id: 'manifestacion',
  icon: 'megafono',
  role: 'inmigrante',
  kind: 'aleatorio',
  title: 'Manifestación',
  notification: '📣 Convocan una marcha por los derechos de los inmigrantes.',
  intro:
    'Frente a la alcaldía se convoca una marcha por los derechos de los trabajadores inmigrantes. Tus compañeros del diner van a ir con pancartas hechas a mano. Nadie sabe cómo va a reaccionar la policía.',
  weight: 0.8,
  choices: [
    {
      id: 'unirse',
      label: 'Unirte a la marcha',
      hint: 'Puede salir bien… o puedes salir herido.',
      outcomes: [
        {
          id: 'exito',
          result: 'bueno',
          weight: 3,
          title: 'Una marcha histórica',
          message:
            'Miles de personas, tambores y banderas de veinte países. Los periódicos de mañana hablarán de ustedes. Volviste afónico pero con el pecho lleno.',
          effects: { bars: { reputacion: 8, esperanza: 6, estres: 5 }, counters: ['protestas'], unlock: ['inm03'] },
        },
        {
          id: 'carga',
          result: 'malo',
          weight: 2,
          title: 'La policía carga',
          message:
            'Alguien lanza una botella y la policía carga sin preguntar. Un porrazo en las costillas te deja sin aire. Vuelves a casa cojeando.',
          effects: { bars: { salud: -15, estres: 8 }, counters: ['protestas'], unlock: ['inm03'] },
        },
      ],
    },
    {
      id: 'organizar',
      label: 'Ayudar a organizarla',
      hint: 'Más riesgo, más reconocimiento.',
      requires: { check: (s) => (s.bars.reputacion ?? 0) >= 35, label: 'Necesitas reputación 35' },
      outcomes: [
        {
          id: 'lider',
          result: 'bueno',
          weight: 3,
          title: 'Una voz del barrio',
          message:
            'Coordinas el recorrido, hablas con la prensa y mantienes la calma cuando hace falta. Esa noche te llaman de tres asociaciones distintas.',
          effects: { bars: { reputacion: 15, esperanza: 8, estres: 10 }, counters: ['protestas'], unlock: ['inm03', 'inm14'] },
        },
        {
          id: 'senalado',
          result: 'malo',
          weight: 2,
          title: 'Te señalaron',
          message:
            'Al estar delante, eres el primero al que derriban cuando todo se tuerce. Los vecinos lo agradecen, pero tu cuerpo lo paga.',
          effects: { bars: { salud: -20, estres: 12, reputacion: 5 }, counters: ['protestas'], unlock: ['inm03', 'inm14'] },
        },
      ],
    },
    {
      id: 'margen',
      label: 'Quedarte al margen',
      outcomes: [
        {
          id: 'tranquilo',
          result: 'bueno',
          weight: 2,
          title: 'Un día tranquilo',
          message: 'Sigues con tu turno. Por la ventana del diner ves pasar la marcha y te alegras de que salga bien.',
          effects: { bars: { estres: -2 } },
        },
        {
          id: 'reproche',
          result: 'malo',
          weight: 1,
          title: 'Miradas de reproche',
          message: 'Al día siguiente algunos vecinos te saludan con frialdad. "Tú no estabas", te dice uno.',
          effects: { bars: { reputacion: -4 } },
        },
      ],
    },
  ],
};

const vecino: EventDef = {
  id: 'vecino',
  icon: 'puerta',
  role: 'inmigrante',
  kind: 'aleatorio',
  title: 'Un vecino en problemas',
  notification: '🚪 Doña Carmen llama a tu puerta.',
  intro: 'Doña Carmen, la del tercero, no llega a pagar la luz este mes. Te lo cuenta bajito, avergonzada, con la factura arrugada en la mano.',
  weight: 0.6,
  choices: [
    {
      id: 'ayudar',
      label: 'Prestarle $40',
      cost: 40,
      outcomes: [
        {
          id: 'gratitud',
          result: 'bueno',
          weight: 4,
          title: 'Gratitud',
          message: 'Doña Carmen te abraza y esa noche te sube una olla de sancocho. Todo el edificio se entera de lo que hiciste.',
          effects: { bars: { reputacion: 8, esperanza: 3 }, counters: ['vecinosAyudados'] },
        },
        {
          id: 'mentira',
          result: 'malo',
          weight: 1,
          title: 'No era para la luz',
          message: 'Días después descubres que el dinero fue a la lotería. Te sientes tonto, aunque algunos vecinos valoran el gesto.',
          effects: { bars: { reputacion: 2, estres: 4 }, counters: ['vecinosAyudados'] },
        },
      ],
    },
    {
      id: 'negar',
      label: 'No puedes ayudar',
      outcomes: [
        {
          id: 'comprende',
          result: 'bueno',
          weight: 1,
          title: 'Lo entiende',
          message: 'Doña Carmen asiente: "Todos estamos igual, mijo". Consigue el dinero con otra vecina.',
          effects: { bars: { estres: -1 } },
        },
        {
          id: 'frio',
          result: 'malo',
          weight: 2,
          title: 'El edificio habla',
          message: 'Esa semana, en la escalera, notas que la conversación se corta cuando pasas.',
          effects: { bars: { reputacion: -3 } },
        },
      ],
    },
  ],
};

const emergencia: EventDef = {
  id: 'emergencia',
  icon: 'cruz',
  role: 'inmigrante',
  kind: 'personal',
  title: 'Emergencia médica',
  notification: '🏥 Algo no va bien con tu salud.',
  intro: 'Un dolor en el pecho te dobla en plena jornada. Te sientas en una caja de tomates sin poder respirar bien. La clínica cobra $250 por atenderte sin seguro.',
  weight: 0.08,
  cooldownDays: 20,
  choices: [
    {
      id: 'clinica',
      label: 'Ir a la clínica ($250)',
      hint: 'Aunque no tengas el dinero: te endeudas.',
      cost: 250,
      outcomes: [
        {
          id: 'atendido',
          result: 'bueno',
          weight: 4,
          title: 'Diagnóstico a tiempo',
          message: 'Estrés y mala alimentación, dice la doctora. Te receta reposo y te da muestras gratis. Sales asustado, pero entero.',
          effects: { bars: { salud: -5, estres: 4 }, counters: ['emergenciasResueltas'] },
        },
        {
          id: 'alta',
          result: 'malo',
          weight: 1,
          title: 'Alta demasiado pronto',
          message: 'Te atienden con prisa y te mandan a casa. El dolor vuelve por la noche y apenas duermes.',
          effects: { bars: { salud: -15, estres: 8 }, counters: ['emergenciasResueltas'] },
        },
      ],
    },
    {
      id: 'aguantar',
      label: 'Aguantar y seguir',
      outcomes: [
        {
          id: 'pasa',
          result: 'bueno',
          weight: 1,
          title: 'Se pasa solo',
          message: 'Respiras hondo, bebes agua y el dolor afloja. Terminas el turno a duras penas.',
          effects: { bars: { salud: -15 }, counters: ['emergenciasResueltas'] },
        },
        {
          id: 'desmayo',
          result: 'malo',
          weight: 3,
          title: 'Te desmayas',
          message: 'Te desplomas en la cocina. Te llevan a urgencias en ambulancia: la factura llega igual, más cara, y pierdes el día.',
          effects: { bars: { salud: -35, estres: 10, dinero: -400 }, cancelShift: 'Llevado a urgencias', counters: ['emergenciasResueltas'] },
        },
      ],
    },
  ],
};

const asesoria: EventDef = {
  id: 'asesoria',
  icon: 'balanza',
  role: 'inmigrante',
  kind: 'personal',
  title: 'Oferta de asesoría legal',
  notification: '⚖️ Una abogada del barrio quiere hablar contigo.',
  intro: 'Una abogada de una organización comunitaria ofrece revisar tu caso migratorio por $300. Dice que con los papeles bien presentados, una redada sería mucho menos peligrosa para ti.',
  weight: 0.3,
  cooldownDays: 6,
  condition: (s) => !s.flags.asesoriaLegal,
  choices: [
    {
      id: 'pagar',
      label: 'Pagar la asesoría ($300)',
      cost: 300,
      requires: { check: (s) => (s.bars.dinero ?? 0) >= 300, label: 'Necesitas $300' },
      outcomes: [
        {
          id: 'protegido',
          result: 'bueno',
          weight: 4,
          title: 'Papeles en regla',
          message: 'La abogada encuentra una vía legal que nadie te había explicado. Sales con una carpeta, un número de caso y la espalda más recta. (Protección ante redadas)',
          effects: { bars: { reputacion: 6, estres: -5 }, flags: { asesoriaLegal: true }, unlock: ['inm17'] },
        },
        {
          id: 'estafa',
          result: 'malo',
          weight: 1,
          title: 'Era un notario falso',
          message: 'La oficina está cerrada al día siguiente. El cartel decía "abogada", pero era una estafa. Muchos vecinos cayeron también.',
          effects: { bars: { estres: 8, esperanza: -4 } },
        },
      ],
    },
    {
      id: 'rechazar',
      label: 'Ahora no',
      outcomes: [
        { id: 'ahorro', result: 'bueno', weight: 1, title: 'Dinero a salvo', message: 'Guardas ese dinero para el alquiler. Quizá en otro momento.', effects: { bars: { estres: -1 } } },
        { id: 'duda', result: 'malo', weight: 2, title: 'La duda', message: 'Esa noche no dejas de pensar en qué pasaría si mañana hay una redada.', effects: { bars: { estres: 4 } } },
      ],
    },
  ],
};

const grupo: EventDef = {
  id: 'grupo',
  icon: 'manos',
  role: 'inmigrante',
  kind: 'personal',
  title: 'Grupo de apoyo comunitario',
  notification: '🤝 Tu vecina Lupe te invita a algo.',
  intro: 'Lupe, tu vecina, te invita al grupo de apoyo que se reúne los jueves en la parroquia: café, papeleo compartido y gente que entiende lo que vives.',
  weight: 0.3,
  cooldownDays: 5,
  condition: (s) => !s.flags.grupoApoyo,
  choices: [
    {
      id: 'unirse',
      label: 'Unirte al grupo',
      hint: 'Reputación que crece cada día.',
      outcomes: [
        {
          id: 'acogida',
          result: 'bueno',
          weight: 4,
          title: 'Una segunda familia',
          message: 'Te reciben con aplausos y pan dulce. Sales con tres teléfonos apuntados y la sensación de pertenecer a algo.',
          effects: { bars: { reputacion: 5, esperanza: 5 }, flags: { grupoApoyo: true } },
        },
        {
          id: 'tension',
          result: 'malo',
          weight: 1,
          title: 'Primera reunión tensa',
          message: 'Dos miembros discuten a gritos y tú no sabes dónde meterte. Decides volver la semana que viene de todas formas.',
          effects: { bars: { estres: 3 }, flags: { grupoApoyo: true } },
        },
      ],
    },
    {
      id: 'no',
      label: 'No tienes tiempo',
      outcomes: [
        { id: 'descanso', result: 'bueno', weight: 1, title: 'Tiempo para ti', message: 'Ese jueves duermes una siesta larga. También hace falta.', effects: { bars: { estres: -2 } } },
        { id: 'solo', result: 'malo', weight: 1, title: 'Soledad', message: 'El jueves por la noche el apartamento se siente más vacío que nunca.', effects: { bars: { esperanza: -3 } } },
      ],
    },
  ],
};

const remesa: EventDef = {
  id: 'remesa',
  icon: 'telefono',
  role: 'inmigrante',
  kind: 'diario',
  title: 'Enviar dinero a la familia',
  notification: '📞 Es día de llamar a casa.',
  intro: 'Domingo de llamadas. Tu madre te cuenta que el techo de la casa gotea otra vez y que tu hermano necesita zapatos para la escuela. No te pide nada, pero no hace falta.',
  weight: 1,
  condition: (_s, day) => day >= 7 && day % 7 === 0,
  choices: [
    {
      id: 'cien',
      label: 'Enviar $100',
      cost: 100,
      outcomes: [
        { id: 'llega', result: 'bueno', weight: 5, title: 'El giro llega', message: 'Tu madre llora al teléfono. Con eso arreglan el techo antes de las lluvias.', effects: { bars: { esperanza: 10 }, counters: ['remesas'] } },
        { id: 'perdido', result: 'malo', weight: 1, title: 'Comisión abusiva', message: 'La agencia se queda con casi la mitad en comisiones y llega tarde. Aun así, ayuda.', effects: { bars: { esperanza: 2, estres: 5 }, counters: ['remesas'] } },
      ],
    },
    {
      id: 'cincuenta',
      label: 'Enviar $50',
      cost: 50,
      outcomes: [
        { id: 'llega', result: 'bueno', weight: 4, title: 'Algo es algo', message: 'Alcanza para los zapatos. Tu hermano te manda una foto con ellos puestos.', effects: { bars: { esperanza: 5 }, counters: ['remesas'] } },
        { id: 'poco', result: 'malo', weight: 1, title: 'Sabe a poco', message: 'Tu madre dice que no te preocupes, pero notas en su voz que no alcanzó.', effects: { bars: { esperanza: 1 }, counters: ['remesas'] } },
      ],
    },
    {
      id: 'nada',
      label: 'Esta semana no puedes',
      outcomes: [
        { id: 'entienden', result: 'bueno', weight: 1, title: 'Lo entienden', message: '"Primero tú, hijo", te dicen. Te quitas un peso de encima.', effects: { bars: { esperanza: -1 } } },
        { id: 'culpa', result: 'malo', weight: 2, title: 'La culpa', message: 'Cuelgas el teléfono y te quedas mirando la pared un buen rato.', effects: { bars: { esperanza: -6, estres: 3 } } },
      ],
    },
  ],
};

const reunificacion: EventDef = {
  id: 'reunificacion',
  icon: 'avion',
  role: 'inmigrante',
  kind: 'diario',
  title: 'Reunificación familiar',
  notification: '✈️ Ya puedes pagar el viaje de tu hermana.',
  intro: 'Tus ahorros por fin alcanzan: con $1.500 puedes pagar los trámites y el pasaje de tu hermana. Sería empezar a tener familia en la ciudad.',
  weight: 1,
  cooldownDays: 10,
  condition: (s) => !s.flags.reunificado && (s.bars.dinero ?? 0) >= 1800,
  choices: [
    {
      id: 'traer',
      label: 'Traerla ($1.500)',
      cost: 1500,
      outcomes: [
        {
          id: 'llega',
          result: 'bueno',
          weight: 4,
          title: '¡Llegó!',
          message: 'La ves aparecer en la puerta de llegadas con la misma maleta azul que tenías tú. La abrazas tan fuerte que se ríe. Ya no estás solo en la ciudad.',
          effects: { bars: { esperanza: 30, reputacion: 5 }, flags: { reunificado: true }, unlock: ['inm06'] },
        },
        {
          id: 'denegada',
          result: 'malo',
          weight: 1,
          title: 'Visa denegada',
          message: 'El consulado rechaza la visa sin explicar por qué. Te devuelven parte del dinero. Habrá que intentarlo otra vez.',
          effects: { bars: { dinero: 700, esperanza: -8 } },
        },
      ],
    },
    {
      id: 'esperar',
      label: 'Esperar un poco más',
      outcomes: [
        { id: 'colchon', result: 'bueno', weight: 1, title: 'Colchón de seguridad', message: 'Prefieres tener un margen antes de dar el paso. Es prudente.', effects: { bars: { estres: -2 } } },
        { id: 'nostalgia', result: 'malo', weight: 1, title: 'Nostalgia', message: 'Tu hermana te manda una carta preguntando "¿cuándo?". No sabes qué responder.', effects: { bars: { esperanza: -4 } } },
      ],
    },
  ],
};

const idioma: EventDef = {
  id: 'idioma',
  icon: 'libro',
  role: 'inmigrante',
  kind: 'accion',
  title: 'Clase de inglés',
  summary: 'Academia nocturna. $60 por clase. 5 clases para adaptarte; tu reputación crece cada día.',
  notification: '',
  intro: 'La academia nocturna de la avenida da clases de inglés y de "cómo funciona esta ciudad". Cada clase cuesta $60.',
  weight: 0,
  cooldownDays: 1,
  condition: (s) => Number(s.flags.idioma ?? 0) < 5,
  choices: [
    {
      id: 'clase',
      label: 'Ir a clase ($60)',
      cost: 60,
      requires: { check: (s) => (s.bars.dinero ?? 0) >= 60, label: 'Necesitas $60' },
      outcomes: [
        { id: 'aprende', result: 'bueno', weight: 4, title: 'Cada vez entiendes más', message: 'Hoy pediste un café sin señalar y entendiste el chiste del cajero. Pequeñas victorias.', effects: { bars: { reputacion: 2, estres: 2 }, counters: ['idioma'] } },
        { id: 'frustra', result: 'malo', weight: 1, title: 'Día difícil', message: 'Phrasal verbs. Nadie debería sufrir así. Sales con dolor de cabeza, pero sales.', effects: { bars: { estres: 5 }, counters: ['idioma'] } },
      ],
    },
  ],
};

export const INMIGRANTE_EVENTS = [redada, manifestacion, vecino, emergencia, asesoria, grupo, remesa, reunificacion, idioma];
