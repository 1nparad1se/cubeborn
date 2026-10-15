import type { HeroRigDef, Proportions } from '../../render/rig/HeroRig';
import type { RigPart } from '../../render/rig/shapes';
import { Vox } from '../../render/rig/voxSculpt';
import { berserkerRig } from './berserker';

/**
 * Berserker reconstructed from the sheet «Берсерк — полный 3D дизайн персонажа» (front, three-quarter,
 * left, back and right views plus the detail crops). Proportions are measured from the front view
 * (height H = 36 units): a big helmeted head, pauldrons as wide as 0.58 H, a V-shaped torso, thick
 * plated forearms, heavy boots. Every armour piece is its own volume of small voxels (0.45 units)
 * layered over the body, with ambient occlusion in the seams.
 */

const R = (globalThis as { __VOX_R?: number }).__VOX_R ?? 0.45;

// palette (sheet swatches, sampled from the renders)
const SKIN = 0xe0a487;
const SKIN_L = 0xedb798;
const SKIN_D = 0xbf8268;
const HAIR = 0x3b3942;
const HAIR_L = 0x55525d;
const HAIR_D = 0x26252b;
const EYE = 0xff2a22;
const IRON_D = 0x34333a;
const IRON = 0x48474f;
const IRON_M = 0x5f5e67;
const IRON_L = 0x85848d;
const IRON_H = 0xa5a4ac;
const RED = 0xbf1a28;
const RED_L = 0xd42a36;
const RED_D = 0x7c101a;
const LEA = 0x6a3a29;
const LEA_D = 0x47271c;
const BOOT = 0x6e4030;
const BOOT_D = 0x4a2a1f;
const EMBLEM = 0xcdc5c9;

function h2(a: number, b: number): number {
  const v = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453;
  return v - Math.floor(v);
}
const vi = (x: number) => Math.floor(x / R);

/**
 * Proportions measured from the sheet's front view, height H = 40 units: ankle 0.08 H, knee 0.23 H,
 * crotch 0.37 H, belt 0.51 H, shoulder joint 0.72 H, chin 0.76 H; arms 0.23 H off the centre line.
 */
const PROPS: Proportions = {
  thigh: 5.6,
  shin: 6.0,
  foot: 3.2,
  hipX: 2.8,
  spine: 5.1,
  shoulderY: 7.8,
  shoulderX: 7.1,
  upperArm: 8.1,
  foreArm: 4.7,
  neck: 9.0,
  depth: 6.0,
};

export function berserkerSculptRig(): HeroRigDef {
  const base = berserkerRig();
  const sword = base.parts.filter((p) => p.b === 'gripR');
  const parts: RigPart[] = [...sword];
  const V = (bone: string) => new Vox(bone, R);
  const push = (v: Vox) => parts.push(v.part({ jitter: 0.04 }));
  const plate = (v: Vox, c: [number, number, number], r: [number, number, number], body: number, _rim = IRON_L, top = IRON_H) =>
    v.fill([c[0] - r[0], c[1] - r[1], c[2] - r[2]], [c[0] + r[0], c[1] + r[1], c[2] + r[2]], (x, y, z) => Math.abs((x - c[0]) / r[0]) ** 5 + Math.abs((y - c[1]) / r[1]) ** 5 + Math.abs((z - c[2]) / r[2]) ** 5 <= 1, (_x, y) => (y > c[1] + r[1] - R * 1.1 ? top : body));
  void IRON_L;

  // ================================================================ HEAD (origin at the chin; the hair is a helmet down to the brows)
  const head = V('head');
  head.fill([-4.3, -0.6, -3.8], [4.3, 6.4, 4.2], (x, y, z) => Math.abs(x) <= 4.4 - (y < 0.6 ? (0.6 - y) * 0.9 : 0) && z <= 4.0 && z >= -3.6 && y >= -0.5, (_x, y) => (y < 0.4 ? SKIN_D : SKIN));
  for (const k of [-1, 1]) {
    head.box([k * 0.6, 1.2, 3.6], [k * 3.0, 2.4, 4.1], 0x3e0e0e); // sockets in the fringe's shadow
    head.box([k * 0.9, 1.35, 3.8], [k * 2.7, 2.15, 4.25], EYE, { g: 1 });
    head.box([k * 2.9, 0.2, 3.6], [k * 3.9, 1.3, 4.2], SKIN_L); // cheekbones
  }
  head.box([-0.55, 0.5, 3.9], [0.55, 1.7, 4.6], SKIN_D); // nose
  head.box([-1.5, -0.25, 3.8], [1.5, 0.15, 4.2], 0x6e3426); // mouth
  // hair helmet: flat-topped block with rounded edges, covering the head from the brows up and the sides and back
  head.fill([-5.6, -0.6, -5.6], [5.6, 9.6, 5.6], (x, y, z) => {
    const cap = Math.abs(x / 5.3) ** 5 + Math.abs((y - 5.8) / 3.5) ** 5 + Math.abs((z + 0.1) / 5.2) ** 5 <= 1 && y > 2.3;
    const sides = Math.abs(x) > 4.2 && Math.abs(x) < 5.3 && y > 0.2 && z > -4.6 && z < 3.0;
    const back = z < -3.0 && z > -5.2 && Math.abs(x) < 5.2 && y > -0.4;
    return (cap || sides || back) && y < 9.3;
  }, (x, y, z) => {
    return y > 8.4 ? HAIR_L : h2(Math.floor(vi(x) / 2), Math.floor(vi(y) / 2) + Math.floor(vi(z) / 2) * 5) < 0.25 ? HAIR_D : HAIR;
  });
  // chunky locks: blocks standing out of the helmet's surface (sides, back and top edges)
  for (let i = 0; i < 46; i++) {
    const a = h2(i, 1) * Math.PI * 2;
    const y = 2.6 + h2(i, 2) * 6.0;
    const rr = 5.1;
    const x = Math.cos(a) * rr;
    const z = Math.sin(a) * rr - 0.1;
    if (z > 2.6 && y < 7.0) continue; // keep the face clear
    const w = 0.45 + h2(i, 3) * 0.5;
    head.box([x - w, y - w * 1.4, z - w], [x + w, y + w * 1.4, z + w], h2(i, 4) < 0.4 ? HAIR_L : HAIR);
  }
  // fringe ledge over the eyes, a few locks hanging lower
  head.fill([-5.0, 1.8, 3.4], [5.0, 3.8, 5.2], (x, y, z) => Math.abs(x) < 4.8 && z < 5.0 && y > 2.4 - (h2(vi(x), 4) < 0.3 ? R : 0), (x) => (vi(x) % 3 === 0 ? HAIR_L : HAIR));
  // crown of square teeth on the flat top (front three, back three, a taller middle)
  const teeth: [number, number, number, number][] = [
    [0, 3.0, 2.0, 1.0], [-3.2, 3.0, 1.4, 0.9], [3.2, 3.0, 1.4, 0.9], [0, 0, 2.6, 1.2], [-3.2, -0.2, 1.6, 0.9], [3.2, -0.2, 1.6, 0.9],
    [0, -3.2, 1.8, 1.0], [-3.0, -3.2, 1.2, 0.9], [3.0, -3.2, 1.2, 0.9],
  ];
  for (const [x, z, hh, w] of teeth) head.box([x - w, 9.0, z - w], [x + w, 9.0 + hh, z + w], (_x, y) => (y > 9.0 + hh - R ? HAIR_L : HAIR));
  push(head);

  // ================================================================ TORSO (chest origin at the belt line)
  const chest = V('chest');
  chest.col([0, 0], -0.4, 8.2, 5.2, 3.2, (x, _y, z) => (Math.abs(x) > 4.2 || z < -2.2 ? RED_D : SKIN), { taper: 1.2, p: 3.2 });
  for (const k of [-1, 1]) {
    chest.fill([k * 0.3, 4.4, 2.4], [k * 4.6, 7.4, 3.8], (x, y, z) => z < 3.3 + (y > 5.0 && y < 7.0 ? 0.4 : 0) && Math.abs(x) > 0.4, (x, y) => (y < 4.9 ? SKIN_D : Math.abs(x) > 3.8 ? SKIN : SKIN_L));
    for (let r = 0; r < 3; r++) chest.box([k * 0.5, 0.4 + r * 1.3, 2.4], [k * 2.2, 1.4 + r * 1.3, 3.3], SKIN_L);
    chest.box([k * 2.4, 0, 2.2], [k * 3.4, 4.0, 3.1], SKIN_D);
  }
  // leather strap with its clasp, front and back
  const strap = (x: number, y: number) => Math.abs(y - (8.0 - (x + 5.6) * 0.86));
  chest.fill([-6.4, -0.6, 1.4], [6.4, 8.6, 4.2], (x, y, z) => strap(x, y) < 0.75 && z > 2.3 && z < 3.8 && x > -5.8 && x < 5.2, (x, y) => (strap(x, y) > 0.45 ? LEA_D : LEA));
  chest.fill([-6.4, -0.6, -4.2], [6.4, 8.6, -1.4], (x, y, z) => strap(-x, y) < 0.75 && z < -2.3 && z > -3.8 && x < 5.8 && x > -5.2, LEA_D);
  chest.box([-4.0, 4.6, 3.4], [-2.0, 6.6, 4.3], IRON_L);
  chest.box([-3.5, 5.1, 3.8], [-2.5, 6.1, 4.4], IRON_D, { carve: true });
  chest.box([-3.5, 5.1, 3.4], [-2.5, 6.1, 3.8], LEA_D);
  // red scarf: a collar around the neck, spreading over the shoulders, a ragged V down the chest
  chest.fill([-8.0, 4.4, -4.4], [8.0, 10.4, 4.6], (x, y, z) => {
    const collar = Math.abs(x / 6.2) ** 3 + Math.abs((y - 7.8) / 1.2) ** 3 + Math.abs(z / 4.0) ** 3 <= 1;
    const v = z > 2.2 && z < 4.3 && y < 7.6 && y > 7.6 - (3.0 - Math.abs(x) * 0.62) - h2(vi(x), 9) * 0.9 && Math.abs(x) < 5.4;
    return collar || v;
  }, (x, y) => (y > 8.6 ? RED_L : h2(vi(x), vi(y)) < 0.25 ? RED_D : RED));
  push(chest);

  const spine = V('spine');
  spine.col([0, 0], 0, 5.1, 4.6, 2.8, (x, _y, z) => (Math.abs(x) > 3.9 || z < -1.8 ? RED_D : SKIN_D), { p: 3.2 });
  push(spine);

  // ================================================================ PELVIS, BELT, LOINCLOTH (hips origin at the hip joints)
  const hips = V('hips');
  hips.col([0, 0], -1.2, 4.8, 4.7, 3.0, IRON_D, { p: 3.2 });
  hips.col([0, 0], 3.8, 6.6, 5.4, 3.5, (_x, y) => (y > 6.2 || y < 4.2 ? LEA_D : LEA), { p: 3.6 });
  hips.box([-2.0, 3.6, 3.2], [2.0, 7.0, 4.2], IRON_L);
  hips.box([-1.0, 4.5, 3.8], [1.0, 6.1, 4.3], IRON_D, { carve: true });
  hips.box([-1.0, 4.5, 3.3], [1.0, 6.1, 3.8], LEA_D);
  for (const x of [-4.2, -2.9, 2.9, 4.2]) hips.box([x - 0.25, 5.1, 3.1], [x + 0.25, 5.6, 3.7], IRON_H);
  // belt pouches / leather drops at the sides
  for (const k of [-1, 1]) hips.box([k * 3.6, 2.2, 1.0], [k * 5.0, 4.6, 3.2], LEA_D);
  push(hips);
  for (const [bone, z0, z1] of [['skirtF', 0, 0.9], ['skirtB', -0.9, 0]] as const) {
    const s = V(bone);
    s.fill([-3.4, -8.0, z0], [3.4, 0.2, z1], (x, y) => Math.abs(x) < 3.2 && y > -7.2 + Math.abs(x) * 0.6 + h2(vi(x), z0 * 7 + 2) * 0.9, (x, y) => (Math.abs(x) > 2.7 ? RED_D : h2(vi(x), vi(y)) < 0.2 ? RED_L : RED));
    push(s);
  }

  // ================================================================ LIMBS
  for (const side of ['L', 'R'] as const) {
    const k = side === 'L' ? 1 : -1;

    // pauldron: three stacked tiers sitting on the shoulder, light top, red cloth under them
    const arm = V('arm' + side);
    arm.col([0, 0], -5.6, -2.0, 2.3, 2.3, (x, y) => (y < -4.8 && h2(vi(x), 4) < 0.4 ? RED_D : RED), { p: 3 });
    plate(arm, [k * -0.2, 1.0, 0], [2.6, 1.1, 3.0], IRON_M);
    plate(arm, [k * 0.2, -0.6, 0], [2.7, 1.05, 3.2], IRON);
    plate(arm, [k * 0.5, -2.1, 0], [2.5, 0.95, 3.0], IRON_M);
    arm.box([k * 2.6, -1.0, -0.3], [k * 3.1, -0.4, 0.3], IRON_H); // rivet
    // upper arm: bare, muscular
    arm.col([0, 0], -8.3, -5.2, 2.05, 2.0, (_x, y, z) => (z > 1.0 && y > -6.6 ? SKIN_L : z < -1.3 ? SKIN_D : SKIN), { p: 2.8, taper: 1.1 });
    arm.blob([k * 0.3, -6.6, 1.2], [1.3, 1.1, 0.9], SKIN_L, { p: 2.5 });
    push(arm);

    // forearm: blocky bracer of three overlapping plates, raised outer plate, leather strap
    const fore = V('fore' + side);
    for (let i = 0; i < 3; i++) {
      const y1 = 1.4 - i * 1.8;
      const y0 = y1 - 1.7;
      const r = 2.8 + i * 0.12;
      fore.col([0, 0], y0, y1, r, r, (x, y) => (y > y1 - R && k * x > 0 ? IRON : IRON_D), { p: 4 });
    }
    fore.col([0, 0], -4.6, -4.0, 3.1, 3.1, LEA, { p: 4 });
    fore.box([k * 2.6, -3.6, -1.4], [k * 3.5, 0.0, 1.4], IRON_M);
    fore.box([k * 3.1, -2.8, -0.7], [k * 3.8, -0.8, 0.7], IRON_L);
    fore.blob([0, 0.5, -2.1], [1.3, 0.9, 0.8], IRON_L, { p: 3 });
    push(fore);

    // hand: glove cuff, fist with four fingers and a thumb
    const hand = V('hand' + side);
    hand.col([0, 0], -0.6, 0.2, 2.2, 2.2, LEA_D, { p: 4 });
    hand.box([-1.8, -2.6, -1.6], [1.8, -0.4, 1.4], IRON_D);
    for (let f = 0; f < 4; f++) {
      const x0 = -1.8 + f * 0.9;
      hand.box([x0, -3.1, 0.6], [x0 + 0.78, -1.2, 2.2], SKIN);
      hand.box([x0, -3.1, -0.6], [x0 + 0.78, -2.4, 0.6], SKIN_D);
    }
    hand.box([-k * 1.8, -2.0, 0.4], [-k * 2.6, -0.6, 2.0], SKIN);
    push(hand);

    // thigh: dark trousers, square grey front plate, leather tasset with plates on the outer side, strap
    const leg = V('leg' + side);
    leg.col([0, 0], -6.0, 0.6, 2.7, 2.7, (_x, y) => (y < -4.6 && y > -5.4 ? LEA_D : IRON_D), { p: 3.2 });
    leg.box([-1.9, -4.2, 2.4], [1.9, -1.4, 3.3], IRON);
    leg.box([-1.9, -1.8, 2.4], [1.9, -1.4, 3.4], IRON_M);
    leg.fill([Math.min(k * 1.4, k * 3.2), -3.2, -2.4], [Math.max(k * 1.4, k * 3.2), 1.4, 2.6], (x, y, z) => k * x > 1.5 && k * x < 3.1 && Math.abs(z) < 2.5 && y < 1.3 && y > -3.0, (_x, y) => (y > 0.5 ? LEA : y > -1.0 && y < -0.5 ? IRON_L : y < -2.5 ? IRON_L : LEA_D));
    push(leg);

    // shin: big grey knee plate, dark greave with a grey band, wide brown boot cuff
    const shin = V('shin' + side);
    shin.col([0, 0], -6.0, 0.6, 2.55, 2.55, (_x, y) => (y < -2.6 && y > -3.4 ? IRON_M : IRON_D), { p: 3.2 });
    plate(shin, [0, 0.1, 2.1], [2.4, 1.7, 1.2], IRON_M, IRON, IRON_L);
    shin.col([0, 0], -6.0, -4.2, 2.85, 2.95, (_x, y) => (y > -4.6 ? BOOT : BOOT_D), { p: 3.6 });
    push(shin);

    // boot: wide brown boot, grey toe cap, strap with a buckle, dark sole
    const foot = V('foot' + side);
    foot.fill([-3.1, -3.2, -2.8], [3.1, 0.4, 4.4], (x, y, z) => Math.abs(x) < 3.0 && z > -2.7 && y > -3.15 && (z < 2.3 || (z < 4.3 && y < -1.0 + (4.3 - z) * 0.3)), (_x, y, z) => (y < -2.7 ? BOOT_D : z > 3.2 && y > -2.4 ? IRON_L : BOOT));
    foot.box([-3.15, -1.5, -2.85], [3.15, -0.9, 2.4], LEA_D);
    foot.box([-0.6, -1.5, 2.3], [0.6, -0.9, 2.65], IRON_H);
    push(foot);
  }

  // ================================================================ CAPE: hangs from the shoulders to the ankles, widening, torn hem
  const TRI = [
    '.e.........e.',
    'ee...e.e...ee',
    '.e...e.e...e.',
    '.ee..eee..ee.',
    '..eeeeeeeee..',
    '.....eee.....',
    '......e......',
    '....eeeee....',
    '......e......',
    '......e......',
    '.....eee.....',
    '......e......',
  ];
  const emblem = (x: number, y: number) => {
    const i = Math.floor((x + 13 * R) / (2 * R) + 0.0001);
    const j = Math.floor((-1.4 - y) / (1.6 * R));
    return j >= 0 && j < TRI.length && i >= 0 && i < 13 && TRI[j][i] === 'e';
  };
  const fold = (x: number) => (vi(x + 20) % 6 < 3 ? 0 : -0.45);
  const capeCol = (x: number, y: number, back: boolean) => (back && emblem(x, y) ? EMBLEM : fold(x) < 0 ? 0xa8141f : h2(vi(x), vi(y)) < 0.12 ? RED_L : RED);
  const capeA = V('capeA');
  capeA.fill([-7.2, -12.6, -1.8], [7.2, 0.6, 0.4], (x, y, z) => Math.abs(x) < 5.0 + (-y / 12.6) * 2.0 && z > -1.35 + fold(x) && z < fold(x) && y < 0.4, (x, y, z) => capeCol(x, y, z < -0.45 + fold(x)));
  capeA.box([-5.4, -0.6, -1.5], [5.4, 1.0, 0.6], RED_D);
  push(capeA);
  const capeB = V('capeB');
  capeB.fill([-9.4, -12.8, -1.8], [9.4, 0.2, 0.4], (x, y, z) => {
    const w = 7.0 + (-y / 12) * 2.2;
    const tear = 12.2 - h2(vi(x), 11) * 2.2 - (vi(x) % 3 === 0 ? 1.0 : 0);
    return Math.abs(x) < w && z > -1.35 + fold(x) && z < fold(x) && y > -tear;
  }, (x, y, z) => capeCol(x, y - 12.6, z < -0.45 + fold(x)));
  push(capeB);

  return {
    ...base,
    id: 'berserker',
    props: PROPS,
    parts,
    springs: {
      ...base.springs,
      capeA: { parent: 'chest', at: [0, 7.6, -3.3], kind: 'cape', k: 0.9 },
      capeB: { parent: 'capeA', at: [0, -12.6, 0], kind: 'cape', k: 0.9 },
      skirtF: { parent: 'hips', at: [0, 3.8, 3.4], kind: 'flap' },
      skirtB: { parent: 'hips', at: [0, 4.4, -3.3], kind: 'flap' },
    },
  };
}
