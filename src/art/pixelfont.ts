/** Tipografía de píxeles 3x5 para letreros y neones. */
const GLYPHS: Record<string, string> = {
  A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110',
  E: '111100110100111', F: '111100110100100', G: '011100101101011', H: '101101111101101',
  I: '111010010010111', J: '001001001101010', K: '101101110101101', L: '100100100100111',
  M: '101111111101101', N: '110101101101101', O: '010101101101010', P: '110101110100100',
  Q: '010101101110011', R: '110101110101101', S: '011100010001110', T: '111010010010010',
  U: '101101101101111', V: '101101101101010', W: '101101111111101', X: '101101010101101',
  Y: '101101010010010', Z: '111001010100111', '0': '111101101101111', '1': '010110010010111',
  '2': '110001010100111', '3': '110001010001110', '4': '101101111001001', '5': '111100110001110',
  '6': '011100111101111', '7': '111001010010010', '8': '111101111101111', '9': '111101111001110',
  '-': '000000111000000', ':': '000010000010000', '+': '000010111010000', '%': '101001010100101', '/': '001001010100100', '.': '000000000000010', "'": '010010000000000', ' ': '000000000000000',
};

export function textWidth(text: string): number {
  return text.length * 4 - 1;
}

export function drawText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color: string) {
  ctx.fillStyle = color;
  x = Math.round(x);
  y = Math.round(y);
  const t = text.toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  for (let i = 0; i < t.length; i++) {
    const g = GLYPHS[t[i]] ?? GLYPHS[' '];
    for (let p = 0; p < 15; p++) {
      if (g[p] === '1') ctx.fillRect(x + i * 4 + (p % 3), y + Math.floor(p / 3), 1, 1);
    }
  }
}

/** Texto vertical (una letra debajo de otra), típico de los letreros de hotel. */
export function drawTextVertical(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color: string) {
  for (let i = 0; i < text.length; i++) drawText(ctx, text[i], x, y + i * 6, color);
}
