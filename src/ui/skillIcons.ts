/**
 * Hand-made 24×24 pixel-art ability icons for every class skill and Ultimate (plus dodge).
 * Each icon is a framed tile: a dark vignette tinted with the skill's colour, a chunky
 * foreground glyph with an automatic dark outline, and a bevelled border. Cached as data URLs.
 */

const N = 24;

type C = string;
interface P {
  /** pixel */
  p(x: number, y: number, c: C): void;
  r(x: number, y: number, w: number, h: number, c: C): void;
  l(x0: number, y0: number, x1: number, y1: number, c: C, w?: number): void;
  o(cx: number, cy: number, r: number, c: C): void;
  ring(cx: number, cy: number, r: number, c: C, w?: number): void;
  /** polygon fill */
  poly(pts: number[], c: C): void;
  c: C;
  lt: C;
  dk: C;
  wh: C;
}

function mix(hex: number, k: number): C {
  let r = (hex >> 16) & 255;
  let g = (hex >> 8) & 255;
  let b = hex & 255;
  if (k > 0) {
    r += (255 - r) * k;
    g += (255 - g) * k;
    b += (255 - b) * k;
  } else {
    r *= 1 + k;
    g *= 1 + k;
    b *= 1 + k;
  }
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}

const FIRE = ['#fff3b0', '#ffc23a', '#ff7a1a', '#d8361a'];
const ICE = ['#ffffff', '#c8f0ff', '#6cc8ff', '#2a74c8'];
const BOLT = ['#ffffff', '#c8f4ff', '#4ad0ff'];
const HOLY = ['#fffbe0', '#ffe48a', '#ffbe3a'];
const BONE = ['#f4efe0', '#cfc6ae', '#8a8270'];
const STEEL = ['#f0f4f8', '#b8c0cc', '#6a7484'];
const WOOD = ['#c08a52', '#8a5a32', '#5a3a1e'];
const POISON = ['#e8ffb0', '#9cff4f', '#3aa02a'];
const DARK = ['#d8b0ff', '#a070ff', '#5a2aa0', '#2a1050'];

const ICONS: Record<string, (d: P) => void> = {
  // ---------------------------------------------------------------- Bram (tank)
  bram_slam: (d) => {
    // shield striking the ground with shock cracks
    d.l(2, 19, 21, 19, '#7a5a3a', 2);
    d.l(5, 20, 3, 23, '#ffd060');
    d.l(18, 20, 20, 23, '#ffd060');
    d.l(11, 20, 11, 23, '#ffd060');
    d.l(3, 16, 0, 14, '#ffe8a0');
    d.l(20, 16, 23, 14, '#ffe8a0');
    d.poly([6, 3, 17, 3, 17, 11, 11.5, 17, 6, 11], STEEL[1]);
    d.poly([7, 4, 16, 4, 16, 10.5, 11.5, 15.5, 7, 10.5], d.c);
    d.r(11, 4, 1, 11, STEEL[0]);
    d.r(7, 8, 9, 1, STEEL[0]);
    d.p(8, 5, d.lt);
  },
  bram_charge: (d) => {
    // horned helm rushing right with speed lines
    d.l(1, 8, 7, 8, d.lt);
    d.l(0, 12, 6, 12, d.lt);
    d.l(1, 16, 7, 16, d.lt);
    d.o(14, 12, 6, STEEL[1]);
    d.r(8, 12, 13, 6, STEEL[2]);
    d.r(14, 11, 7, 2, '#20242c');
    d.r(15, 13, 1, 4, '#20242c');
    d.l(9, 7, 6, 2, BONE[0], 2);
    d.l(19, 7, 22, 2, BONE[0], 2);
    d.p(11, 8, STEEL[0]);
    d.p(12, 7, STEEL[0]);
  },
  bram_bulwark: (d) => {
    // stone fist / stoneskin: rocky armoured torso with glow
    d.ring(12, 12, 10, d.dk, 1);
    d.poly([5, 6, 19, 6, 20, 14, 16, 20, 8, 20, 4, 14], '#8a8478');
    d.r(7, 8, 4, 4, '#a8a294');
    d.r(13, 8, 4, 4, '#a8a294');
    d.r(9, 14, 6, 4, '#a8a294');
    d.l(11, 6, 11, 20, '#5a564e');
    d.l(5, 13, 19, 13, '#5a564e');
    d.p(8, 9, '#d0cabc');
    d.p(14, 9, '#d0cabc');
    d.ring(12, 12, 11, d.lt, 1);
  },
  bram_ult: (d) => {
    // giant leap: falling fortress tower onto a crater
    d.poly([1, 22, 23, 22, 19, 18, 5, 18], '#5a3a22');
    d.l(2, 18, 0, 14, '#ffd060');
    d.l(22, 18, 23, 14, '#ffd060');
    d.r(7, 4, 10, 12, STEEL[1]);
    d.r(6, 2, 2, 3, STEEL[1]);
    d.r(10, 2, 2, 3, STEEL[1]);
    d.r(14, 2, 2, 3, STEEL[1]);
    d.r(16, 2, 2, 3, STEEL[1]);
    d.r(10, 10, 4, 6, '#2a2018');
    d.r(8, 6, 2, 2, '#2a2018');
    d.r(14, 6, 2, 2, '#2a2018');
    d.r(7, 4, 1, 12, STEEL[0]);
    d.l(4, 16, 4, 12, d.lt);
    d.l(20, 16, 20, 12, d.lt);
  },
  // ---------------------------------------------------------------- Shen (fast melee)
  shen_dash: (d) => {
    // afterimage dash with blood drops
    d.l(2, 18, 9, 11, d.dk, 2);
    d.l(5, 19, 13, 11, d.c, 2);
    d.l(8, 20, 19, 9, d.lt, 2);
    d.l(15, 5, 21, 3, STEEL[0], 2);
    d.l(11, 13, 20, 4, STEEL[1], 2);
    d.p(19, 17, '#e0303a');
    d.r(17, 19, 2, 2, '#c0202a');
    d.p(21, 14, '#e0303a');
  },
  shen_palms: (d) => {
    // many palms
    const palm = (x: number, y: number, c: C) => {
      d.r(x, y + 2, 5, 5, c);
      d.r(x, y, 1, 3, c);
      d.r(x + 2, y - 1, 1, 3, c);
      d.r(x + 4, y, 1, 3, c);
      d.r(x - 1, y + 4, 1, 2, c);
    };
    palm(3, 13, d.dk);
    palm(15, 13, d.dk);
    palm(6, 6, d.c);
    palm(13, 5, d.c);
    palm(9, 10, '#ffe0b8');
    d.l(2, 3, 4, 5, d.lt);
    d.l(21, 3, 19, 5, d.lt);
  },
  shen_cyclone: (d) => {
    // tornado funnel
    d.l(3, 4, 21, 4, d.lt, 2);
    d.l(5, 8, 19, 8, d.c, 2);
    d.l(7, 12, 17, 12, d.lt, 2);
    d.l(9, 16, 15, 16, d.c, 2);
    d.l(11, 20, 13, 20, d.lt, 2);
    d.p(2, 7, d.wh);
    d.p(20, 11, d.wh);
    d.p(5, 15, d.wh);
    d.p(18, 18, d.wh);
  },
  shen_ult: (d) => {
    // star of dashes crossing
    d.l(2, 12, 22, 12, d.lt, 2);
    d.l(12, 2, 12, 22, d.lt, 2);
    d.l(4, 4, 20, 20, d.c, 2);
    d.l(20, 4, 4, 20, d.c, 2);
    d.o(12, 12, 3, d.wh);
    d.ring(12, 12, 8, d.wh, 1);
  },
  // ---------------------------------------------------------------- Lyra (mage)
  lyra_meteor: (d) => {
    d.l(2, 2, 12, 12, FIRE[3], 4);
    d.l(3, 2, 12, 11, FIRE[2], 3);
    d.l(5, 4, 12, 11, FIRE[1], 2);
    d.o(15, 15, 5, '#6a3a22');
    d.o(14, 14, 3, '#9a5a32');
    d.p(13, 13, FIRE[0]);
    d.r(16, 17, 2, 1, FIRE[1]);
    d.l(8, 22, 22, 22, FIRE[2]);
  },
  lyra_frost: (d) => {
    d.ring(12, 12, 9, ICE[2], 2);
    d.ring(12, 12, 6, ICE[1], 1);
    // snowflake
    d.l(12, 6, 12, 18, ICE[0]);
    d.l(6, 12, 18, 12, ICE[0]);
    d.l(8, 8, 16, 16, ICE[1]);
    d.l(16, 8, 8, 16, ICE[1]);
    d.r(11, 11, 3, 3, ICE[0]);
    d.p(12, 2, ICE[0]);
    d.p(12, 21, ICE[0]);
    d.p(2, 12, ICE[0]);
    d.p(21, 12, ICE[0]);
  },
  lyra_blink: (d) => {
    // ashen silhouette left, burst right
    d.r(3, 9, 4, 9, '#5a4a48');
    d.o(5, 7, 2, '#5a4a48');
    d.p(2, 5, '#8a7a78');
    d.p(7, 4, '#8a7a78');
    d.l(8, 12, 13, 12, d.lt);
    d.p(12, 11, d.lt);
    d.p(12, 13, d.lt);
    d.ring(17, 12, 5, FIRE[2], 1);
    d.o(17, 12, 3, FIRE[1]);
    d.o(17, 12, 1, FIRE[0]);
    d.p(17, 5, FIRE[1]);
    d.p(22, 9, FIRE[1]);
    d.p(21, 18, FIRE[2]);
  },
  lyra_ult: (d) => {
    // several meteors raining
    for (const [x, y] of [[4, 2], [12, 0], [19, 4], [8, 9], [16, 11]] as const) {
      d.l(x - 3, y, x, y + 4, FIRE[2], 2);
      d.o(x + 1, y + 5, 2, FIRE[1]);
      d.p(x + 1, y + 5, FIRE[0]);
    }
    d.poly([0, 23, 24, 23, 24, 20, 0, 20], '#5a2a1a');
    d.l(0, 20, 23, 20, FIRE[2]);
    d.p(5, 19, FIRE[1]);
    d.p(13, 19, FIRE[1]);
    d.p(19, 19, FIRE[1]);
  },
  // ---------------------------------------------------------------- Kestrel (archer)
  kes_volley: (d) => {
    for (const a of [-0.7, -0.35, 0, 0.35, 0.7]) {
      const x = 3 + Math.cos(a) * 17;
      const y = 20 - 0 + Math.sin(a) * 17 - 8;
      d.l(3, 13, x, y, WOOD[0]);
      d.p(Math.round(x), Math.round(y), STEEL[0]);
    }
    d.r(2, 11, 3, 5, d.c);
  },
  kes_net: (d) => {
    d.ring(12, 12, 9, '#c8b088', 1);
    for (let i = 4; i <= 20; i += 4) {
      d.l(i, 4, i, 20, '#a89068');
      d.l(4, i, 20, i, '#a89068');
    }
    d.r(3, 3, 2, 2, STEEL[1]);
    d.r(19, 3, 2, 2, STEEL[1]);
    d.r(3, 19, 2, 2, STEEL[1]);
    d.r(19, 19, 2, 2, STEEL[1]);
  },
  kes_frost: (d) => {
    d.l(2, 21, 19, 4, ICE[2], 3);
    d.l(2, 21, 19, 4, ICE[1], 1);
    d.poly([22, 1, 15, 4, 20, 9], ICE[0]);
    d.l(2, 21, 5, 18, WOOD[0], 2);
    d.p(3, 16, ICE[1]);
    d.p(8, 20, ICE[1]);
    d.p(9, 11, ICE[0]);
    d.p(13, 14, ICE[0]);
  },
  kes_ult: (d) => {
    for (const x of [3, 8, 13, 18]) {
      const y = x % 2 ? 2 : 5;
      d.l(x, y, x + 2, y + 12, WOOD[0]);
      d.p(x + 2, y + 13, STEEL[0]);
      d.p(x + 2, y + 14, STEEL[0]);
      d.p(x, y, d.lt);
    }
    d.poly([0, 23, 24, 23, 24, 20, 0, 20], '#3a4a2a');
    d.ring(12, 21, 9, d.lt, 1);
  },
  // ---------------------------------------------------------------- Morwen (summoner)
  mor_raise: (d) => {
    // skull rising from grave with hands
    d.poly([1, 23, 23, 23, 23, 19, 1, 19], '#3a2a3a');
    d.o(12, 10, 6, BONE[0]);
    d.r(8, 14, 8, 4, BONE[1]);
    d.r(9, 9, 2, 3, '#1a1020');
    d.r(13, 9, 2, 3, '#1a1020');
    d.p(12, 13, '#1a1020');
    d.r(10, 16, 1, 2, '#1a1020');
    d.r(13, 16, 1, 2, '#1a1020');
    d.r(3, 15, 2, 5, BONE[1]);
    d.r(19, 15, 2, 5, BONE[1]);
    d.p(9, 9, DARK[1]);
    d.p(13, 9, DARK[1]);
  },
  mor_curse: (d) => {
    // purple eye with rune circle
    d.ring(12, 12, 10, DARK[1], 1);
    d.poly([3, 12, 12, 6, 21, 12, 12, 18], DARK[2]);
    d.o(12, 12, 3, DARK[0]);
    d.r(11, 10, 2, 4, '#140820');
    d.p(2, 4, DARK[0]);
    d.p(21, 4, DARK[0]);
    d.p(2, 19, DARK[0]);
    d.p(21, 19, DARK[0]);
  },
  mor_drain: (d) => {
    d.l(2, 21, 21, 3, DARK[2], 3);
    d.l(2, 21, 21, 3, DARK[1], 1);
    // heart at the end
    d.o(5, 18, 2, '#e0303a');
    d.o(8, 18, 2, '#e0303a');
    d.poly([3, 19, 10, 19, 6.5, 23], '#e0303a');
    d.p(4, 17, '#ff9aa0');
    d.o(20, 4, 2, DARK[0]);
  },
  mor_ult: (d) => {
    for (const [x, y, s] of [[5, 12, 3], [19, 12, 3], [12, 7, 4]] as const) {
      d.o(x, y, s, BONE[0]);
      d.r(x - s + 1, y + s - 1, s * 2 - 1, 3, BONE[1]);
      d.p(x - 1, y, '#1a1020');
      d.p(x + 1, y, '#1a1020');
      d.p(x - 1, y, DARK[1]);
    }
    d.poly([0, 23, 24, 23, 24, 19, 0, 19], DARK[3]);
    d.l(0, 19, 23, 19, DARK[1]);
  },
  // ---------------------------------------------------------------- Fizzwick (alchemist)
  fizz_bomb: (d) => {
    d.o(11, 14, 7, '#3a3a40');
    d.o(9, 12, 3, '#5a5a64');
    d.p(8, 11, '#8a8a94');
    d.r(10, 5, 3, 3, '#6a5a3a');
    d.l(12, 5, 16, 1, WOOD[0]);
    d.p(17, 0, FIRE[1]);
    d.p(16, 1, FIRE[0]);
    d.poly([3, 23, 21, 23, 18, 20, 6, 20], POISON[2]);
    d.p(9, 21, POISON[0]);
  },
  fizz_flame: (d) => {
    d.r(1, 15, 6, 6, '#6a5a3a');
    d.r(2, 13, 4, 2, STEEL[1]);
    d.poly([7, 14, 22, 6, 23, 14, 22, 22], FIRE[3]);
    d.poly([7, 15, 19, 9, 20, 15, 19, 20], FIRE[2]);
    d.poly([7, 16, 15, 13, 16, 16, 15, 18], FIRE[1]);
    d.p(9, 16, FIRE[0]);
  },
  fizz_vent: (d) => {
    // flask venting a blast
    d.ring(12, 13, 10, POISON[1], 1);
    d.ring(12, 13, 7, POISON[2], 1);
    d.poly([9, 8, 15, 8, 18, 18, 6, 18], '#c8e8f0');
    d.poly([8, 13, 16, 13, 18, 18, 6, 18], POISON[1]);
    d.r(10, 5, 4, 3, '#c8e8f0');
    d.p(10, 15, POISON[0]);
    d.p(13, 2, POISON[0]);
    d.p(9, 0, POISON[1]);
    d.p(16, 1, POISON[1]);
  },
  fizz_ult: (d) => {
    for (const [x, y] of [[5, 6], [18, 6], [12, 12], [5, 18], [18, 18]] as const) {
      d.poly([x - 2, y - 2, x + 2, y - 2, x + 3, y + 3, x - 3, y + 3], '#c8e8f0');
      d.poly([x - 3, y, x + 3, y, x + 3, y + 3, x - 3, y + 3], POISON[1]);
      d.r(x - 1, y - 4, 2, 2, '#c8e8f0');
    }
    d.l(5, 6, 12, 12, POISON[0]);
    d.l(18, 6, 12, 12, POISON[0]);
    d.l(5, 18, 12, 12, POISON[0]);
    d.l(18, 18, 12, 12, POISON[0]);
  },
  // ---------------------------------------------------------------- Vex (lightning)
  vex_ball: (d) => {
    d.o(12, 12, 7, BOLT[2]);
    d.o(12, 12, 5, BOLT[1]);
    d.o(11, 11, 2, BOLT[0]);
    d.l(19, 12, 23, 9, BOLT[1]);
    d.l(5, 12, 1, 15, BOLT[1]);
    d.l(12, 5, 14, 1, BOLT[1]);
    d.l(12, 19, 9, 23, BOLT[1]);
  },
  vex_nova: (d) => {
    d.ring(12, 12, 10, BOLT[2], 1);
    d.ring(12, 12, 7, BOLT[1], 1);
    d.poly([13, 3, 7, 13, 11, 13, 9, 21, 17, 10, 13, 10], '#fff4a0');
    d.l(13, 4, 9, 12, '#ffffff');
  },
  vex_storm: (d) => {
    d.o(7, 6, 4, '#5a6478');
    d.o(13, 5, 5, '#6a7488');
    d.o(18, 7, 4, '#5a6478');
    d.r(4, 7, 17, 4, '#4a5468');
    d.poly([12, 11, 8, 17, 11, 17, 9, 23, 15, 15, 12, 15, 14, 11], '#fff4a0');
    d.l(5, 12, 4, 16, BOLT[1]);
    d.l(19, 12, 20, 17, BOLT[1]);
  },
  vex_ult: (d) => {
    d.r(0, 0, 24, 3, '#4a5468');
    for (const x of [3, 11, 19]) {
      d.l(x, 3, x - 2, 9, '#fff4a0', 2);
      d.l(x - 2, 9, x + 1, 13, '#fff4a0', 2);
      d.l(x + 1, 13, x - 1, 20, '#fff4a0', 2);
      d.l(x, 3, x - 2, 9, '#ffffff');
    }
    d.ring(12, 22, 10, BOLT[2], 1);
  },
  // ---------------------------------------------------------------- Tink (engineer)
  tink_turret: (d) => {
    d.poly([4, 22, 20, 22, 17, 16, 7, 16], '#6a5a3a');
    d.r(7, 9, 10, 7, '#c89048');
    d.r(8, 10, 8, 2, '#e8b868');
    d.r(16, 11, 7, 3, STEEL[1]);
    d.r(22, 10, 1, 5, STEEL[0]);
    d.o(11, 13, 1, '#ff5a3a');
    d.r(11, 5, 2, 4, STEEL[2]);
    d.p(11, 4, '#ff5a3a');
  },
  tink_mines: (d) => {
    for (const [x, y] of [[6, 16], [17, 16], [12, 8]] as const) {
      d.o(x, y, 3, '#4a4a52');
      d.r(x - 4, y, 9, 2, '#3a3a42');
      d.p(x, y - 1, '#ff3a3a');
      d.p(x - 1, y - 2, '#8a8a94');
    }
    d.p(12, 3, FIRE[1]);
    d.p(3, 12, FIRE[1]);
    d.p(21, 11, FIRE[1]);
  },
  tink_rocket: (d) => {
    d.poly([12, 1, 17, 7, 17, 15, 7, 15, 7, 7], STEEL[1]);
    d.poly([12, 1, 17, 7, 7, 7], '#e0402a');
    d.o(12, 10, 2, '#4ad0ff');
    d.poly([7, 12, 3, 17, 7, 16], '#e0402a');
    d.poly([17, 12, 21, 17, 17, 16], '#e0402a');
    d.poly([8, 16, 16, 16, 12, 23], FIRE[2]);
    d.poly([10, 16, 14, 16, 12, 21], FIRE[1]);
  },
  tink_ult: (d) => {
    for (const [x, y] of [[5, 12], [19, 12], [12, 4]] as const) {
      d.r(x - 3, y, 6, 4, '#c89048');
      d.r(x - 2, y - 2, 4, 2, STEEL[1]);
      d.r(x + 1, y - 1, 4, 1, STEEL[0]);
      d.r(x - 4, y + 4, 8, 2, '#6a5a3a');
    }
    d.l(4, 21, 20, 21, '#ff5a3a');
    d.p(12, 15, '#ff5a3a');
    d.ring(12, 16, 5, '#ff5a3a', 1);
  },
  // ---------------------------------------------------------------- Aurelia (paladin)
  aur_smite: (d) => {
    d.r(9, 0, 6, 20, HOLY[2]);
    d.r(10, 0, 4, 20, HOLY[1]);
    d.r(11, 0, 2, 20, HOLY[0]);
    d.poly([2, 23, 22, 23, 18, 19, 6, 19], '#5a4a2a');
    d.l(4, 18, 1, 14, HOLY[1]);
    d.l(20, 18, 23, 14, HOLY[1]);
    d.p(6, 12, HOLY[0]);
    d.p(18, 9, HOLY[0]);
  },
  aur_shield: (d) => {
    d.ring(12, 12, 10, HOLY[1], 1);
    d.poly([5, 4, 19, 4, 19, 12, 12, 21, 5, 12], HOLY[2]);
    d.poly([6, 5, 18, 5, 18, 11.5, 12, 19.5, 6, 11.5], '#f4f0e8');
    d.r(11, 6, 2, 11, HOLY[2]);
    d.r(8, 9, 8, 2, HOLY[2]);
    d.p(7, 6, '#ffffff');
  },
  aur_consecrate: (d) => {
    d.poly([0, 18, 24, 18, 24, 23, 0, 23], '#6a5a2a');
    d.ring(12, 20, 10, HOLY[1], 1);
    d.r(10, 3, 4, 14, HOLY[1]);
    d.r(6, 7, 12, 3, HOLY[1]);
    d.r(11, 4, 2, 12, HOLY[0]);
    d.r(7, 8, 10, 1, HOLY[0]);
    d.p(3, 14, HOLY[0]);
    d.p(20, 12, HOLY[0]);
  },
  aur_ult: (d) => {
    d.poly([0, 16, 24, 16, 24, 23, 0, 23], '#4a3a2a');
    d.o(12, 16, 6, HOLY[1]);
    d.o(12, 16, 4, HOLY[0]);
    for (const a of [-2.6, -2.1, -1.57, -1.05, -0.5]) d.l(12 + Math.cos(a) * 8, 16 + Math.sin(a) * 8, 12 + Math.cos(a) * 12, 16 + Math.sin(a) * 12, HOLY[1], 2);
    d.r(0, 16, 24, 1, HOLY[2]);
  },
  // ---------------------------------------------------------------- dodge
  dodge: (d) => {
    d.poly([8, 6, 13, 6, 13, 15, 18, 15, 18, 19, 8, 19], '#8a6a4a');
    d.r(8, 17, 10, 2, '#5a3a22');
    d.r(8, 6, 5, 2, '#a88a6a');
    d.poly([13, 8, 6, 10, 13, 12], '#f4f4ff');
    d.l(1, 10, 6, 10, '#d8f0ff');
    d.l(0, 14, 6, 14, '#d8f0ff');
    d.l(2, 18, 6, 18, '#d8f0ff');
  },
};

const cache = new Map<string, string>();

export function hasSkillIcon(id: string): boolean {
  return id.startsWith('sk_') && !!ICONS[id.slice(3)];
}

/** Data URL for an ability icon (`sk_<skillId>`), tinted by the skill colour. */
export function skillIconUrl(id: string, color: number): string {
  const key = id + ':' + color;
  const hit = cache.get(key);
  if (hit) return hit;
  const cv = document.createElement('canvas');
  cv.width = cv.height = N;
  const g = cv.getContext('2d')!;
  // background: tinted vignette
  const grad = g.createRadialGradient(N / 2, N / 2 - 3, 2, N / 2, N / 2, N * 0.75);
  grad.addColorStop(0, mix(color, -0.35));
  grad.addColorStop(1, mix(color, -0.88));
  g.fillStyle = grad;
  g.fillRect(0, 0, N, N);
  // foreground on its own layer (for the outline pass)
  const fg = document.createElement('canvas');
  fg.width = fg.height = N;
  const f = fg.getContext('2d')!;
  const px = (x: number, y: number, c: C) => {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= N || y >= N) return;
    f.fillStyle = c;
    f.fillRect(x, y, 1, 1);
  };
  const d: P = {
    c: mix(color, 0),
    lt: mix(color, 0.45),
    dk: mix(color, -0.4),
    wh: '#f4f4ff',
    p: px,
    r: (x, y, w, h, c) => {
      for (let i = 0; i < w; i++) for (let j = 0; j < h; j++) px(x + i, y + j, c);
    },
    l: (x0, y0, x1, y1, c, w = 1) => {
      const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
      for (let i = 0; i <= n; i++) {
        const x = x0 + ((x1 - x0) * i) / n;
        const y = y0 + ((y1 - y0) * i) / n;
        for (let a = 0; a < w; a++) for (let b = 0; b < w; b++) px(x + a - ((w - 1) >> 1), y + b - ((w - 1) >> 1), c);
      }
    },
    o: (cx, cy, r, c) => {
      for (let y = -r - 1; y <= r + 1; y++) for (let x = -r - 1; x <= r + 1; x++) if (Math.hypot(x, y) <= r + 0.3) px(cx + x, cy + y, c);
    },
    ring: (cx, cy, r, c, w = 1) => {
      for (let y = -r - 2; y <= r + 2; y++) for (let x = -r - 2; x <= r + 2; x++) if (Math.abs(Math.hypot(x, y) - r) < 0.5 * w + 0.15) px(cx + x, cy + y, c);
    },
    poly: (pts, c) => {
      for (let y = 0; y < N; y++)
        for (let x = 0; x < N; x++) {
          const tx = x + 0.5;
          const ty = y + 0.5;
          let inside = false;
          for (let i = 0, j = pts.length - 2; i < pts.length; j = i, i += 2) {
            const xi = pts[i];
            const yi = pts[i + 1];
            const xj = pts[j];
            const yj = pts[j + 1];
            if (yi > ty !== yj > ty && tx < ((xj - xi) * (ty - yi)) / (yj - yi) + xi) inside = !inside;
          }
          if (inside) px(x, y, c);
        }
    },
  };
  ICONS[id.slice(3)]?.(d);
  // dark outline around the glyph
  const img = f.getImageData(0, 0, N, N);
  const a = img.data;
  const solid = (x: number, y: number) => x >= 0 && y >= 0 && x < N && y < N && a[(y * N + x) * 4 + 3] > 0;
  g.fillStyle = 'rgba(8,6,14,0.9)';
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (!solid(x, y) && (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1))) g.fillRect(x, y, 1, 1);
  g.drawImage(fg, 0, 0);
  // bevelled frame
  g.fillStyle = 'rgba(255,255,255,0.18)';
  g.fillRect(0, 0, N, 1);
  g.fillRect(0, 0, 1, N);
  g.fillStyle = 'rgba(0,0,0,0.55)';
  g.fillRect(0, N - 1, N, 1);
  g.fillRect(N - 1, 0, 1, N);
  const url = cv.toDataURL();
  cache.set(key, url);
  return url;
}
