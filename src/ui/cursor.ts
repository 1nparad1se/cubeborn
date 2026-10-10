/**
 * Custom pixel-art mouse cursors (original art in the game's blocky style), drawn once on a canvas:
 * a gold-trimmed arrow for menus and walking, a red sword when an enemy is under the pointer, and a
 * hand for clickable things. Applied as CSS cursors so they cost nothing per frame.
 */
type Kind = 'default' | 'attack' | 'pointer';

const S = 2; // each art pixel is 2×2 screen pixels (32×32 cursor)

// '.' transparent, k outline, w light, g gold, d dark gold, r red, R dark red, s steel, b brown
const ARROW = [
  'k...............',
  'kk..............',
  'kwk.............',
  'kwgk............',
  'kwggk...........',
  'kwgggk..........',
  'kwggggk.........',
  'kwgggggk........',
  'kwggggggk.......',
  'kwgggggddk......',
  'kwggdkkkkkk.....',
  'kwgdk...........',
  'kwdk............',
  'kdk.............',
  'kk..............',
  'k...............',
];
const SWORD = [
  'kkk.............',
  'kwsk............',
  'kswsk...........',
  '.kswsk..........',
  '..kswsk.........',
  '...kswsk........',
  '....kswsk.......',
  '.....kswsk.kk...',
  '......kswskRk...',
  '.......ksskRk...',
  '........kkRk....',
  '.......kRRrbk...',
  '......kRk.kbbk..',
  '.......k...kbbk.',
  '............kbk.',
  '.............k..',
];
const HAND = [
  '.....kk.........',
  '....kwwk........',
  '....kwgk........',
  '....kwgk........',
  '....kwgkkk......',
  '....kwgkwwkk....',
  '.kk.kwgkwgkwk...',
  'kwwkkwgkwgkwgk..',
  'kwggkwggggggwk..',
  '.kwgggggggggwk..',
  '..kwggggggggdk..',
  '..kwgggggggdk...',
  '...kwgggggdk....',
  '....kdddddk.....',
  '....kkkkkkk.....',
  '................',
];
const PAL: Record<string, string> = { k: '#120c06', w: '#fff4d0', g: '#e8b23a', d: '#9a6a18', r: '#ff4a3a', R: '#8a1a14', s: '#c8d4e0', b: '#6a4422' };

function draw(rows: string[]): string {
  const c = document.createElement('canvas');
  c.width = c.height = 16 * S;
  const ctx = c.getContext('2d');
  if (!ctx) return '';
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const col = PAL[row[x]];
      if (!col) continue;
      ctx.fillStyle = col;
      ctx.fillRect(x * S, y * S, S, S);
    }
  });
  return c.toDataURL('image/png');
}

const css: Partial<Record<Kind, string>> = {};
let current: Kind | null = null;
let host: HTMLElement | null = null;

/** Installs the cursors: a style rule for the page and clickable elements. */
export function installCursors() {
  const a = draw(ARROW);
  const s = draw(SWORD);
  const p = draw(HAND);
  if (!a) return;
  css.default = `url(${a}) 1 1, auto`;
  css.attack = `url(${s}) 2 2, crosshair`;
  css.pointer = `url(${p}) 10 1, pointer`;
  const st = document.createElement('style');
  st.textContent = `html, body { cursor: ${css.default}; }
button, a, [role=button], .btn, select, input[type=range], .clickable, [onclick] { cursor: ${css.pointer} !important; }`;
  document.head.append(st);
  host = document.body;
}

/** Switches the in-game cursor (e.g. a sword over enemies). */
export function setCursor(kind: Kind, el?: HTMLElement) {
  if (kind === current) return;
  current = kind;
  const target = el ?? host;
  if (target && css[kind]) target.style.cursor = kind === 'default' ? '' : css[kind]!;
}
