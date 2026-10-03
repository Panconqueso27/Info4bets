/**
 * Ilustraciones de las tarjetas de decisión: iconos 12x12 en pixel art.
 * Cada carácter es un color de la paleta; '.' es transparente.
 */
const PAL: Record<string, string> = {
  k: '#14101f', w: '#f4efe2', a: '#9a96a8', A: '#55506a',
  r: '#e8414f', R: '#8e1f2c', b: '#3b7bdc', B: '#1f3c7a',
  y: '#ffd24a', Y: '#e08a1e', g: '#3fbf6a', G: '#1f6b3c',
  s: '#e3a97c', n: '#8a5a33', N: '#4a2e1c', p: '#ff6fae', c: '#5ce8ff',
};

const ICONS: Record<string, string[]> = {
  sirena: [
    '..r......b..', '.r..rrbb..b.', 'r..rRrbBb..b', '...rrrbbb...', '..wrrrbbbw..', '...rrrbbb...',
    '..AAAAAAAA..', '..aaaaaaaa..', '..AAAAAAAA..', '............', '............', '............',
  ],
  megafono: [
    '............', '.........y..', '.......yyy..', '.....yyyyy.y', '..kyyyyyyy..', 'kkkyyyyyyy.y',
    'kkkyyyyyyy..', '..kyyyyyyy.y', '.....yyyyy..', '...nn..yyy..', '...nn....y..', '............',
  ],
  puerta: [
    '..NNNNNNNN..', '..NnnnnnnN..', '..NnnnnnnN..', '..NnNNNNnN..', '..NnN..NnN..', '..NnNNNNnN..',
    '..Nnnnnn yN.'.replace(' ', 'n'), '..NnNNNNnN..', '..NnN..NnN..', '..NnNNNNnN..', '..NnnnnnnN..', '.aaaaaaaaaa.',
  ],
  cruz: [
    '............', '....rrrr....', '....rwwr....', '....rwwr....', '.rrrrwwrrrr.', '.rwwwwwwwwr.',
    '.rwwwwwwwwr.', '.rrrrwwrrrr.', '....rwwr....', '....rwwr....', '....rrrr....', '............',
  ],
  balanza: [
    '.....yy.....', '.yyyyyyyyyy.', '.y...yy...y.', 'yyy..yy..yyy', 'Y.Y..yy..Y.Y', 'YYY..yy..YYY',
    '.....yy.....', '.....yy.....', '.....yy.....', '...yyyyyy...', '..YYYYYYYY..', '............',
  ],
  manos: [
    '............', '..ss....nn..', '.ssss..nnnn.', '.sssssnnnnn.', 'sssssnnnnnnn', 'ssssnnnnnnn.',
    '.sssnnnnnn..', '..ssnnnnn...', '...sssnn....', '....sss.....', '............', '............',
  ],
  telefono: [
    '............', '..rrrrrrrr..', '.rrRRRRRRrr.', 'rrR......Rrr', 'rr..rrrr..rr', '...rrwwrr...',
    '..rrwkkwrr..', '..rrwkkwrr..', '..rrrwwrrr..', '..rrrrrrrr..', '..RRRRRRRR..', '............',
  ],
  avion: [
    '.....ww.....', '.....ww.....', '....wwww....', '...wwbbww...', 'wwwwwbbwwwww', 'awwwwwwwwwwa',
    '....wwww....', '.....ww.....', '.....ww.....', '...wwwwww...', '....a..a....', '............',
  ],
  libro: [
    '............', '.bbbbb.ggggg', '.bwwwbkgwwwg', '.bwkkbkgkkwg', '.bwwwbkgwwwg', '.bwkkbkgkkwg',
    '.bwwwbkgwwwg', '.bwkkbkgkkwg', '.bwwwbkgwwwg', '.bbbbbkggggg', '......k.....', '............',
  ],
  periodico: [
    '............', '.wwwwwwwwww.', '.wkkkkkkkkw.', '.wwwwwwwwww.', '.waaa.kkkkw.', '.waaa.wwwww.',
    '.waaa.kkkkw.', '.wwwwwwwwww.', '.wkkkk.kkkw.', '.wkkkk.kkkw.', '.wwwwwwwwww.', '............',
  ],
  tormenta: [
    '...aaaa.....', '..aaaaaaa...', '.aAAaaaaaaa.', 'aAAAAaaaAAaa', '.AAAAAAAAAA.', '.....yy.....',
    '....yy......', '...yyyyy....', '.....yy..c..', '....yy..c...', '...y...c..c.', '.........c..',
  ],
  urna: [
    '............', '....wwww....', '....wkkw....', '....wwww....', '.BBBkkkkBBB.', '.BbbbbbbbbB.',
    '.BbwwwwwwbB.', '.BbwBBBBwbB.', '.BbwwwwwwbB.', '.BbbbbbbbbB.', '.BBBBBBBBBB.', '............',
  ],
  placa: [
    '.....yy.....', '....yyyy....', '..yyyyyyyy..', '.yyyYYYYyyy.', '.yyYYbbYYyy.', '.yyYbbbbYyy.',
    '.yyYYbbYYyy.', '..yyYYYYyy..', '...yyyyyy...', '....yyyy....', '.....yy.....', '............',
  ],
  micro: [
    '....aaaa....', '...aAaAaa...', '...aaAaAa...', '...aAaAaa...', '...aaaaaa...', '....aaaa....',
    '.....kk.....', '.....kk.....', '..r..kk.....', '...rrkk.....', '.....kk.....', '...kkkkkk...',
  ],
  cinta: [
    '............', '..n......n..', '..n......n..', 'rrrrrrrrrrrr', 'RRRRRyyRRRRR', '.....yy.....',
    '....rrrr....', '...rr..rr...', '..rr....rr..', '..n......n..', '..n......n..', '.nnn....nnn.',
  ],
  playa: [
    '........yy..', '.......yyyy.', '....g...yy..', '...ggg......', '..gg.gg.....', '....n.......',
    '....n.......', '....n.......', 'bbbbnbbbbbbb', 'BbbbnbbBbbbb', 'yyyyyyyyyyyy', 'YYyyyyYYyyyy',
  ],
  reloj: [
    '....kkkk....', '..kkwwwwkk..', '.kwwwwkwwwk.', '.kwwwwkwwwk.', 'kwwwwwkwwwwk', 'kwwwwwkkkwwk',
    'kwwwwwwwwwwk', 'kwwwwwwwwwwk', '.kwwwwwwwwk.', '.kwwwwwwwwk.', '..kkwwwwkk..', '....kkkk....',
  ],
  propina: [
    '............', '.GGGGGGGGGG.', '.GggggggggG.', '.GgGGgygGgG.', '.GgGgyyygGG.', '.GggGyGygGG.',
    '.GgGGyyygGG.', '.GgGGgygGgG.', '.GggggggggG.', '.GGGGGGGGGG.', '............', '............',
  ],
  cafe: [
    '...a..a.....', '....a..a....', '...a..a.....', '............', '.wwwwwwww...', '.wNNNNNNwww.',
    '.wnnnnnnw.w.', '.wnnnnnnw.w.', '.wnnnnnnwww.', '..wwwwww....', '.aaaaaaaaa..', '............',
  ],
  plato: [
    '............', '...wwwwww...', '..wwaaaaww..', '.wwayyyyaww.', '.wayYyyyyaw.', '.wayyYyyyaw.',
    '.wayyyyyyaw.', '.wwayyyyaww.', '..wwaaaaww..', '...wwwwww...', '............', '............',
  ],
  carta: [
    '............', '............', '.wwwwwwwwww.', '.wkwwwwwwkw.', '.wwkwwwwkww.', '.wwwkwwkwww.',
    '.wwwwkkwwww.', '.wwwwwwwwww.', '.wwwwwwwwrw.', '.wwwwwwwwww.', '............', '............',
  ],
  mascota: [
    '............', '.n.......n..', '.nn.....nn..', '.nnnnnnnnn..', '.nkknnnkkn..', '.nnnnwnnnn..',
    '..nnkkknn...', '...nnnnn....', '..nnnnnnn..n', '..nnnnnnn.n.', '..nn.n.nnn..', '............',
  ],
  maquina: [
    '..rrrrrrrr..', '..rwwwwwwr..', '..rwbywgwr..', '..rwwwwwwr..', '..rwrygbwr..', '..rwwwwwwr..',
    '..rwgbrywr..', '..rwwwwwwr..', '..rrrrrrkr..', '..rkkkkrrr..', '..rrrrrrrr..', '..AA....AA..',
  ],
  barco: [
    '............', '.....r......', '.....r......', '....www.....', '...wwwww....', '..wwwwwwwww.',
    '..wbwbwbwbw.', 'AAAAAAAAAAAA', '.AAAAAAAAAA.', '..AAAAAAAA..', 'bbbbbbbbbbbb', 'BBBBBBBBBBBB',
  ],
  radio: [
    '.........a..', '........a...', '.......a....', '.nnnnnnnnnn.', '.nkkkkknyyn.', '.nkakaknyyn.',
    '.nkkkkkn..n.', '.nkakaknwwn.', '.nkkkkknwwn.', '.nnnnnnnnnn.', '..N......N..', '............',
  ],
  casa: [
    '.....rr.....', '....rrrr....', '...rrrrrr...', '..rrrrrrrr..', '.rrrrrrrrrr.', '..wwwwwwww..',
    '..wbbwwbbw..', '..wbbwwbbw..', '..wwwnnwww..', '..wwwnnwww..', '..wwwnnwww..', '.gggggggggg.',
  ],
  estrella: [
    '.....yy.....', '.....yy.....', '....yyyy....', 'yyyyyyyyyyyy', '.yyyyyyyyyy.', '..yyyyyyyy..',
    '...yyyyyy...', '..yyyyyyyy..', '..yyy..yyy..', '.yyy....yyy.', '.yy......yy.', '............',
  ],
};

/** Dibuja un icono escalado en un canvas (sin suavizado). */
export function drawIcon(canvas: HTMLCanvasElement, id: string | undefined, scale = 8) {
  const rows = ICONS[id ?? ''] ?? ICONS.estrella;
  canvas.width = 12 * scale;
  canvas.height = 12 * scale;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  rows.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      const c = PAL[ch];
      if (!c) return;
      ctx.fillStyle = c;
      ctx.fillRect(x * scale, y * scale, scale, scale);
    }),
  );
}
