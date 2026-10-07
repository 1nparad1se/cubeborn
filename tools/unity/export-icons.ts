import { writeFileSync } from 'node:fs';
import { GLYPHS } from './glyphs';
// Records each glyph as an ordered list of pixel fills. Colour roles: c/lt/dk; others literal.
const out: Record<string, (number | string)[]> = {};
for (const id of Object.keys(GLYPHS)) {
  const ops: (number | string)[] = [];
  const N = 16;
  const fill = (x: number, y: number, c: string) => {
    if (x < 0 || y < 0 || x >= N || y >= N) return;
    ops.push(x, y, c);
  };
  const pen: any = {
    c: 'c', lt: 'lt', dk: 'dk', wh: '#f4f4ff', gold: '#ffd23d', wood: '#8a5a32', steel: '#b8c0cc',
    p: (x: number, y: number, c?: string) => fill(x, y, c ?? pen.c),
    r: (x: number, y: number, w: number, h: number, c?: string) => { for (let i = 0; i < w; i++) for (let j = 0; j < h; j++) fill(x + i, y + j, c ?? pen.c); },
    l: (x0: number, y0: number, x1: number, y1: number, c?: string) => {
      const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
      for (let i = 0; i <= n; i++) fill(Math.round(x0 + ((x1 - x0) * i) / n), Math.round(y0 + ((y1 - y0) * i) / n), c ?? pen.c);
    },
    o: (cx: number, cy: number, r: number, c?: string, f = true) => {
      for (let y = -r - 1; y <= r + 1; y++) for (let x = -r - 1; x <= r + 1; x++) {
        const d = Math.hypot(x, y);
        if (f ? d <= r + 0.3 : Math.abs(d - r) < 0.6) fill(cx + x, cy + y, c ?? pen.c);
      }
    },
  };
  (GLYPHS as any)[id](pen);
  out[id] = ops;
}
writeFileSync(process.argv[2] + '/icons.json', JSON.stringify(out));
console.log(Object.keys(out).length, 'icons');
