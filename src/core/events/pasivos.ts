import type { EventDef } from './types';

/**
 * Mascota, máquinas expendedoras (inmigrante) y turismo (alcalde).
 */

const NOMBRES_GATO = ['Mancha', 'Pelusa', 'Tigre', 'Bodega', 'Luna'];
const NOMBRES_PERRO = ['Canelo', 'Bronx', 'Chispa', 'Rocky', 'Pancho'];

const mascota: EventDef = {
  id: 'mascota',
  role: 'inmigrante',
  kind: 'personal',
  icon: 'mascota',
  title: 'Alguien te sigue',
  notification: '🐾 Algo pequeño y peludo te sigue por la calle.',
  intro: 'Al salir por la puerta de atrás del diner, un {animal} flaco te mira desde los cubos de basura. Te sigue dos manzanas. No tiene collar.',
  variants: { animal: ['gatito atigrado', 'perro callejero'] },
  weight: 0.5,
  cooldownDays: 6,
  condition: (s) => !s.pet,
  choices: [
    {
      id: 'adoptar',
      label: 'Llevártelo a casa',
      hint: 'Mantenerlo cuesta $20 al mes',
      outcomes: [
        { id: 'familia', result: 'bueno', weight: 4, title: 'Ya sois familia', message: 'Lo bañas en el fregadero y se duerme a tus pies. Por fin alguien te espera al volver. Comida y veterinario: $20 al mes.', effects: { bars: { esperanza: 10, estres: -6 }, counters: ['mascotas'] } },
        { id: 'arana', result: 'malo', weight: 1, title: 'Arañazos y pulgas', message: 'Se queda contigo, pero la primera noche destroza la almohada y te llena la cama de pulgas.', effects: { bars: { esperanza: 4, salud: -3, dinero: -8 }, counters: ['mascotas'] } },
      ],
    },
    {
      id: 'comida',
      label: 'Darle algo de comer',
      outcomes: [
        { id: 'agradece', result: 'bueno', weight: 3, title: 'Un amigo de paso', message: 'Le das media hamburguesa. Se la come, te mira y se pierde en la noche.', effects: { bars: { esperanza: 3 } } },
        { id: 'vuelve', result: 'malo', weight: 1, title: 'Te rompe el corazón', message: 'Se va con la comida y no vuelve. Te pasas la noche pensando en él.', effects: { bars: { esperanza: -2 } } },
      ],
    },
  ],
  onResolve: (s, ctx) => {
    if (!['familia', 'arana'].includes(ctx.outcome.id)) return;
    const perro = ctx.vars.animal?.includes('perro') ?? false;
    const kind = perro ? 'perro' : 'gato';
    const pool = perro ? NOMBRES_PERRO : NOMBRES_GATO;
    s.pet = { kind, name: pool[(s.seed + ctx.day) % pool.length], since: ctx.day };
    s.notices.push({ kind: 'aviso', title: 'NUEVA MASCOTA', text: `${perro ? '🐶' : '🐱'} ${s.pet.name} vive contigo. $20 al mes.` });
  },
};

const mascotaEscapa: EventDef = {
  id: 'mascota-escapa',
  role: 'inmigrante',
  kind: 'personal',
  icon: 'mascota',
  title: '¿Dónde está tu mascota?',
  notification: '🐾 La puerta estaba abierta…',
  intro: 'El vecino te llama al diner: la puerta de tu cuarto estaba abierta y {pet} no aparece por ningún lado.',
  weight: 0.35,
  cooldownDays: 8,
  condition: (s) => !!s.pet,
  choices: [
    {
      id: 'buscar',
      label: 'Salir a buscarlo',
      hint: 'Dejas el diner un rato',
      outcomes: [
        { id: 'encuentra', result: 'bueno', weight: 3, title: 'Lo encuentras', message: 'Estaba en la azotea, tan tranquilo. Lo abrazas como si volvieras de la guerra.', effects: { bars: { esperanza: 5, estres: -2 }, npc: { id: 'sal', afinidad: -1 } } },
        { id: 'regaño', result: 'malo', weight: 1, title: 'Sal no lo entiende', message: 'Lo encuentras, pero Sal te descuenta la hora que faltaste.', effects: { bars: { dinero: -20, estres: 4 } } },
      ],
    },
    {
      id: 'esperar',
      label: 'Confiar en que vuelve',
      outcomes: [
        { id: 'vuelve', result: 'bueno', weight: 2, title: 'Vuelve solo', message: 'Al llegar a casa, {pet} te espera en la escalera como si nada.', effects: { bars: { esperanza: 2 } } },
        { id: 'noche', result: 'malo', weight: 1, title: 'Una noche sin dormir', message: 'No aparece hasta el amanecer. No pegas ojo.', effects: { bars: { estres: 8, salud: -3 } } },
      ],
    },
  ],
};

const mascotaEnferma: EventDef = {
  id: 'mascota-enferma',
  role: 'inmigrante',
  kind: 'personal',
  icon: 'cruz',
  title: 'Tu mascota está enferma',
  notification: '🐾 Tu mascota no quiere comer.',
  intro: '{pet} lleva dos días sin comer y apenas se mueve. El veterinario de la avenida B cobra $40 la consulta.',
  weight: 0.3,
  cooldownDays: 10,
  condition: (s) => !!s.pet,
  choices: [
    {
      id: 'vet',
      label: 'Llevarlo al veterinario',
      cost: 40,
      requires: { check: (s) => (s.bars.dinero ?? 0) >= 40, label: 'Necesitas $40' },
      outcomes: [
        { id: 'cura', result: 'bueno', weight: 5, title: 'Se recupera', message: 'Unas pastillas y en tres días {pet} vuelve a perseguir cucarachas.', effects: { bars: { esperanza: 4 } } },
        { id: 'caro', result: 'malo', weight: 1, title: 'Más pruebas', message: 'Se cura, pero el veterinario te cobra $20 más por unos análisis.', effects: { bars: { dinero: -20 } } },
      ],
    },
    {
      id: 'remedio',
      label: 'Remedio casero',
      outcomes: [
        { id: 'funciona', result: 'bueno', weight: 2, title: 'El caldo de la abuela', message: 'Caldo tibio y mantas. {pet} se recupera poco a poco.', effects: { bars: { estres: 2 } } },
        { id: 'empeora', result: 'malo', weight: 2, title: 'Empeora', message: '{pet} pasa una semana malísimo. Tú también: no duermes.', effects: { bars: { esperanza: -6, estres: 8, salud: -3 } } },
      ],
    },
  ],
};

const mascotaRegalo: EventDef = {
  id: 'mascota-regalo',
  role: 'inmigrante',
  kind: 'diario',
  icon: 'mascota',
  title: 'Un regalo en la almohada',
  notification: '🐾 Tu mascota te ha traído algo.',
  intro: 'Al despertar, {pet} ha dejado algo en tu almohada y te mira muy orgulloso.',
  weight: 0.25,
  cooldownDays: 7,
  condition: (s) => !!s.pet,
  choices: [
    {
      id: 'mirar',
      label: 'Ver qué es',
      outcomes: [
        { id: 'billete', result: 'bueno', weight: 2, title: '¡Un billete!', message: 'Un billete de $10 arrugado. Nadie sabe de dónde lo sacó.', effects: { bars: { dinero: 10, esperanza: 3 } } },
        { id: 'raton', result: 'malo', weight: 2, title: 'Un ratón', message: 'Un ratón. Medio ratón, en realidad. Buen día para empezar.', effects: { bars: { estres: 3 } } },
      ],
    },
  ],
};

const maquinaRota: EventDef = {
  id: 'maquina-rota',
  role: 'inmigrante',
  kind: 'diario',
  icon: 'maquina',
  title: 'Una máquina no funciona',
  notification: '🥤 Una de tus máquinas se ha tragado las monedas.',
  intro: 'El encargado de la lavandería te llama: tu máquina expendedora se traga las monedas y la gente le da patadas.',
  weight: 0.35,
  cooldownDays: 5,
  condition: (s) => (s.vending?.count ?? 0) > (s.vending?.broken ?? 0),
  choices: [
    {
      id: 'arreglar',
      label: 'Arreglarla tú',
      outcomes: [
        { id: 'manitas', result: 'bueno', weight: 2, title: 'Eres un manitas', message: 'Un destornillador, una moneda atascada y listo. Funciona otra vez.', effects: { bars: { esperanza: 2 } } },
        { id: 'rota', result: 'malo', weight: 2, title: 'La rompes del todo', message: 'Saltan chispas. Ahora no enciende: habrá que llamar al técnico ($40).', effects: { bars: { estres: 4 }, counters: ['vendingRota'] } },
      ],
    },
    {
      id: 'dejar',
      label: 'Ya la mirarás',
      outcomes: [
        { id: 'sola', result: 'bueno', weight: 1, title: 'Se arregla sola', message: 'Una patada bien dada y vuelve a funcionar. Tecnología de los 80.', effects: {} },
        { id: 'parada', result: 'malo', weight: 2, title: 'Máquina parada', message: 'Sigue rota y no da dinero hasta que la arregles ($40 en Negocios).', effects: { counters: ['vendingRota'] } },
      ],
    },
  ],
  onResolve: (s, ctx) => {
    if (ctx.outcome.id === 'rota' || ctx.outcome.id === 'parada') if (s.vending) s.vending.broken = Math.min(s.vending.count, s.vending.broken + 1);
  },
};

const maquinaRobo: EventDef = {
  id: 'maquina-robo',
  role: 'inmigrante',
  kind: 'personal',
  icon: 'sirena',
  npc: 'kowalski',
  title: 'Han forzado tu máquina',
  notification: '🥤 Alguien ha reventado una de tus máquinas.',
  intro: 'El agente Kowalski te espera junto a tu máquina: el cristal roto y la caja vacía. "¿Quieres poner denuncia, chico?"',
  weight: 0.25,
  cooldownDays: 9,
  condition: (s) => (s.vending?.count ?? 0) >= 2,
  choices: [
    {
      id: 'denunciar',
      label: 'Poner denuncia',
      outcomes: [
        { id: 'pillado', result: 'bueno', weight: 2, title: 'Los pillan', message: 'Kowalski encuentra a los chavales esa misma tarde. Te devuelven las monedas.', effects: { bars: { dinero: 15, reputacion: 3 }, npc: { id: 'kowalski', afinidad: 1, recuerdo: 'Te ayudó con tu máquina.' } } },
        { id: 'papeles', result: 'malo', weight: 1, title: 'Demasiadas preguntas', message: 'Kowalski no encuentra a nadie, pero te pregunta demasiado por tus papeles.', effects: { bars: { estres: 8 } } },
      ],
    },
    {
      id: 'retirar',
      label: 'Retirarla de ahí',
      outcomes: [
        { id: 'vender', result: 'malo', weight: 1, title: 'Una máquina menos', message: 'Vendes lo que queda como chatarra. Una máquina menos en tu negocio.', effects: { bars: { dinero: 30 } } },
      ],
    },
  ],
  onResolve: (s, ctx) => {
    if (ctx.outcome.id !== 'vender' || !s.vending) return;
    s.vending.count = Math.max(0, s.vending.count - 1);
    s.vending.broken = Math.min(s.vending.broken, s.vending.count);
  },
};

const crucero: EventDef = {
  id: 'crucero',
  role: 'alcalde',
  kind: 'personal',
  icon: 'barco',
  title: 'Llega un crucero',
  notification: '🛳 Un crucero con 3.000 turistas atraca en el muelle.',
  intro: 'Un crucero de lujo atraca en el muelle 88 con 3.000 turistas. La naviera pregunta si la ciudad les organiza algo.',
  weight: 0.4,
  cooldownDays: 6,
  choices: [
    {
      id: 'desfile',
      label: 'Bienvenida con banda',
      cost: 30_000,
      outcomes: [
        { id: 'gastan', result: 'bueno', weight: 3, title: 'Turistas encantados', message: 'Banda de música, globos y mapas gratis. Los turistas se gastan una fortuna en la ciudad.', effects: { bars: { dinero: 90_000, popularidad: 4 } } },
        { id: 'lluvia', result: 'malo', weight: 1, title: 'Llueve a mares', message: 'Diluvia. La banda toca para nadie y los turistas no bajan del barco.', effects: { bars: { popularidad: -2, estres: 4 } } },
      ],
    },
    {
      id: 'nada',
      label: 'Que se busquen la vida',
      outcomes: [
        { id: 'igual', result: 'bueno', weight: 2, title: 'Vienen igual', message: 'Nueva York se vende sola: los turistas compran camisetas y perritos calientes.', effects: { bars: { dinero: 25_000 } } },
        { id: 'quejas', result: 'malo', weight: 1, title: 'Una mala reseña', message: 'Un periódico de Chicago titula: "Nueva York trata mal a sus visitantes".', effects: { bars: { popularidad: -4 } } },
      ],
    },
  ],
};

const guiaMala: EventDef = {
  id: 'guia-mala',
  role: 'alcalde',
  kind: 'diario',
  icon: 'libro',
  title: 'La guía de viajes',
  notification: '📕 La guía de viajes más vendida habla de tu ciudad.',
  intro: 'La guía de viajes más vendida de Europa prepara su nueva edición y su autor quiere entrevistarte. Si no, escribirá lo que vea por la calle.',
  weight: 0.3,
  cooldownDays: 10,
  choices: [
    {
      id: 'entrevista',
      label: 'Recibirlo en el despacho',
      outcomes: [
        { id: 'portada', result: 'bueno', weight: 3, title: 'Portada de la guía', message: 'Le enseñas la ciudad en persona. La guía pone a Nueva York en portada.', effects: { bars: { popularidad: 5 }, flags: { guiaBuena: true } } },
        { id: 'aburre', result: 'malo', weight: 1, title: 'Le aburres', message: 'Le hablas de presupuestos durante dos horas. Escribe que la ciudad "carece de alma".', effects: { bars: { popularidad: -3 } } },
      ],
    },
    {
      id: 'calle',
      label: 'Que vea la ciudad real',
      outcomes: [
        { id: 'autentica', result: 'bueno', weight: 1, title: '"Auténtica"', message: 'Le encanta el caos: "Nueva York es la ciudad más viva del mundo".', effects: { bars: { popularidad: 4 } } },
        { id: 'peligrosa', result: 'malo', weight: 2, title: '"Peligrosa"', message: 'Le roban la cartera en el metro. La guía recomienda "evitar la ciudad".', effects: { bars: { popularidad: -6, control: -2 } } },
      ],
    },
  ],
};

export const PASIVOS_EVENTS: EventDef[] = [mascota, mascotaEscapa, mascotaEnferma, mascotaRegalo, maquinaRota, maquinaRobo, crucero, guiaMala];
