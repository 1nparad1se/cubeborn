import type { HeroRigDef } from '../../render/rig/HeroRig';
import type { RigPart, V3 } from '../../render/rig/shapes';
import { Vox } from '../../render/rig/voxSculpt';
import { berserkerRig } from './berserker';

/**
 * Berserker sculpted voxel by voxel after the sheet «Берсерк — полный 3D дизайн персонажа»:
 * a dense voxel figure (0.6-unit voxels, ambient occlusion, per-voxel shading) with rounded
 * stepped forms instead of a few big boxes. Same skeleton, clips, grip and sword as the
 * game Berserker, so it can replace it once approved.
 */

const R = 0.6;
const SKIN = 0xe3a888;
const SKIN_D = 0xc4876c;
const SKIN_L = 0xf1c1a4;
const HAIR = 0x2f2d35;
const HAIR_L = 0x46434e;
const HAIR_D = 0x1d1c22;
const EYE = 0xff2a22;
const IRON_D = 0x3a3840;
const IRON = 0x52505a;
const IRON_M = 0x6c6a74;
const IRON_L = 0x92909a;
const RED = 0xc01a2a;
const RED_L = 0xd92c3a;
const RED_D = 0x7a101a;
const LEATHER = 0x6c3c2b;
const LEATHER_L = 0x86523b;
const LEATHER_D = 0x47271d;
const EMBLEM = 0xcdc4c8;

function h2(a: number, b: number): number {
  const v = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453;
  return v - Math.floor(v);
}

export function berserkerSculptRig(): HeroRigDef {
  const base = berserkerRig();
  const sword = base.parts.filter((p) => p.b === 'gripR');
  const parts: RigPart[] = [...sword];
  const V = (bone: string) => new Vox(bone, R);

  // ---------------------------------------------------------------- head
  const head = V('head');
  // skull and face, cheeks shaded toward the jaw
  head.blob([0, 3.4, 0.2], [4.0, 3.6, 3.8], (x, y) => (y < 1.4 ? SKIN_D : SKIN), { p: 3.2 });
  head.col([0, 0], -1.2, 1.0, 1.9, 1.9, SKIN_D);
  // hair helmet: everything but the face window
  head.fill([-4.8, 0.6, -4.8], [4.8, 9, 4.8], (x, y, z) => {
    const inBlob = Math.abs(x / 4.9) ** 3 + Math.abs((y - 5.4) / 2.6) ** 3 + Math.abs((z + 0.3) / 4.8) ** 3 <= 1;
    const back = z < -1.6 && y > 0.8 && y < 6.5 && Math.abs(x) < 4.3 && z > -4.7;
    const sides = Math.abs(x) > 3.6 && Math.abs(x) < 4.9 && y > 1.8 && y < 6.5 && z > -4.4 && z < 2.6;
    const face = z > 0.6 && y < 5.0 + (Math.abs(x) < 3.0 ? 0 : -2) && Math.abs(x) < 3.8;
    return (inBlob || back || sides) && !face;
  }, (x, y, z) => (h2(Math.round(x / R), Math.round(z / R)) < 0.3 ? HAIR_L : h2(x, y + z) < 0.2 ? HAIR_D : HAIR));
  // jagged fringe over the brows
  for (let i = -6; i < 6; i++) {
    const x = (i + 0.5) * R;
    const len = 0.6 + h2(i, 3) * 1.4;
    head.box([x - 0.3, 5.0 - len, 2.2], [x + 0.3, 5.4, 4.0], i & 1 ? HAIR_L : HAIR);
  }
  // crown of tufts
  const tufts: [number, number, number][] = [[0, 0.6, 1.8], [-2.4, 1.6, 1.2], [2.4, 1.6, 1.2], [-3.8, 2.8, 0.8], [3.8, 2.8, 0.8], [0, -2.4, 1.4], [-2.6, -2.6, 1.0], [2.6, -2.6, 1.0], [-1.2, -0.8, 1.4], [1.2, -0.8, 1.4]];
  for (const [x, z, hh] of tufts) head.box([x - 0.7, 7.8, z - 0.7], [x + 0.7, 8.6 + hh, z + 0.7], (_x, y) => (y > 8.6 + hh - 0.7 ? HAIR_L : HAIR));
  // brows, sockets, glowing eyes, nose, mouth
  for (const k of [-1, 1]) {
    head.box([k * 0.7, 4.5, 3.3], [k * 2.9, 5.0, 4.1], HAIR_D);
    head.box([k * 0.8, 3.4, 3.3], [k * 2.8, 4.4, 3.9], 0x4a1212);
    head.box([k * 1.0, 3.5, 3.6], [k * 2.6, 4.3, 4.2], EYE, { g: 1 });
  }
  head.box([-0.5, 2.2, 3.6], [0.5, 3.4, 4.3], SKIN_D);
  head.box([-1.3, 1.3, 3.6], [1.3, 1.8, 4.0], 0x7a3e30);
  parts.push(head.part());

  // ---------------------------------------------------------------- chest, scarf, strap
  const chest = V('chest');
  chest.col([0, 0], -0.2, 7.2, 5.0, 2.9, (x, y, z) => {
    if (Math.abs(x) > 3.8) return z > 1.6 && y > 3.6 ? RED : RED_D;
    if (z < -1.4) return RED_D;
    if (z > 1.6 && y > 3.2 && y < 6.2) return Math.abs(x) < 0.5 ? SKIN_D : y < 3.8 ? SKIN_D : SKIN_L; // pecs
    if (z > 1.6 && y < 3.0) return Math.abs(x) < 0.4 || Math.abs((y % 1.4) - 0.7) < 0.15 ? SKIN_D : SKIN_L; // abs
    return SKIN;
  }, { taper: 1.12, p: 3 });
  // strap: right shoulder (-x, top) to left hip (+x, bottom), front and back
  chest.fill([-4.6, -0.5, 1.4], [4.6, 7.5, 3.4], (x, y, z) => Math.abs(y - (7.2 - (x + 4.0) * 0.95)) < 0.7 && z > 1.9 && z < 3.0 && Math.abs(x) < 4.4, (x, y) => (h2(x, y) < 0.3 ? LEATHER_D : LEATHER));
  chest.fill([-4.6, -0.5, -3.4], [4.6, 7.5, -1.4], (x, y, z) => Math.abs(y - (7.2 - (-x + 4.0) * 0.95)) < 0.7 && z < -1.9 && z > -3.0 && Math.abs(x) < 4.4, LEATHER_D);
  chest.box([-3.0, 4.4, 2.6], [-1.2, 6.2, 3.4], IRON_L);
  chest.box([-2.5, 4.9, 3.0], [-1.7, 5.7, 3.6], IRON_D);
  // ragged red scarf
  chest.blob([0, 7.4, 0], [5.4, 1.6, 3.6], (x, y) => (y > 8.2 ? RED_L : RED), { p: 3 });
  for (let i = -8; i < 8; i++) {
    const x = (i + 0.5) * R;
    const len = 0.6 + h2(i, 7) * 2.2;
    chest.box([x - 0.3, 6.6 - len, 2.0], [x + 0.3, 6.6, 3.0], h2(i, 2) < 0.3 ? RED_D : RED);
  }
  parts.push(chest.part());

  const spine = V('spine');
  spine.col([0, 0], 0.6, 3.6, 4.6, 2.7, (x, z) => (Math.abs(x) > 3.4 || z < -1.6 ? RED_D : SKIN_D), { p: 3 });
  parts.push(spine.part());

  // ---------------------------------------------------------------- belt and pelvis
  const hips = V('hips');
  hips.col([0, 0], -1.4, 1.4, 4.9, 2.9, IRON_D, { p: 3 });
  hips.col([0, 0], 1.2, 3.0, 5.3, 3.2, (_x, y) => (y > 2.6 ? LEATHER_L : LEATHER), { p: 3.4 });
  hips.box([-1.6, 0.9, 2.6], [1.6, 3.3, 3.5], IRON_L);
  hips.box([-0.7, 1.5, 3.0], [0.7, 2.7, 3.7], LEATHER_D);
  for (const x of [-3.6, -2.4, 2.4, 3.6]) hips.box([x - 0.3, 1.8, 2.6], [x + 0.3, 2.4, 3.3], 0xb0aeb6);
  parts.push(hips.part());

  // red loincloth, ragged hem
  for (const [bone, z0, z1] of [['skirtF', 0, 0.6], ['skirtB', -0.6, 0]] as const) {
    const s = V(bone);
    s.fill([-2.7, -7.2, z0], [2.7, 0.2, z1], (x, y) => {
      const i = Math.floor(x / R);
      return y > -5.4 - h2(i, z0) * 1.6 && Math.abs(x) < 2.6;
    }, (x) => (Math.abs(x) > 2.0 ? RED_D : RED));
    parts.push(s.part());
  }

  // ---------------------------------------------------------------- limbs
  for (const side of ['L', 'R'] as const) {
    const k = side === 'L' ? 1 : -1;
    // pauldron: three stepped rounded plates, light tops, red cloth under them
    const arm = V('arm' + side);
    arm.blob([0, -1.6, 0], [2.7, 1.4, 2.7], RED, { p: 3 });
    const plate = (c: V3, r: V3, base: number) => arm.blob(c, r, (_x, y) => (y > c[1] + r[1] * 0.45 ? IRON_L : base), { p: 3.4 });
    plate([k * 0.8, 2.0, 0], [3.4, 1.5, 3.3], IRON);
    plate([k * 2.0, 0.5, 0], [3.0, 1.3, 3.5], IRON_M);
    plate([k * 2.8, -1.0, 0], [2.4, 1.2, 3.4], IRON);
    plate([k * 0.4, 3.4, -0.2], [2.2, 0.8, 2.4], IRON_M);
    arm.col([0, 0], -5.2, -1.6, 2.4, 2.4, (_x, y, z) => (y > -2.4 ? RED : z > 1.2 && y > -4.4 ? SKIN_L : SKIN));
    parts.push(arm.part());

    const fore = V('fore' + side);
    fore.col([0, 0], -3.3, 0.9, 2.5, 2.5, (x, y) => {
      if (y > 0.1) return IRON_L;
      if (y > -1.3 && y < -0.6) return IRON_M;
      if (y > -2.5 && y < -1.8) return LEATHER;
      return k * x > 1.4 ? IRON_M : IRON_D;
    }, { taper: 1.1, p: 3 });
    fore.box([-0.9, 0.0, -2.8], [0.9, 1.3, -1.8], IRON_L); // elbow cop
    parts.push(fore.part());

    const hand = V('hand' + side);
    hand.blob([0, -0.9, 0], [2.3, 1.8, 2.3], (_x, y) => (y > 0.2 ? LEATHER_D : IRON_D), { p: 3 });
    hand.box([-1.8, -2.6, 1.4], [1.8, -1.0, 2.5], (x) => (Math.abs((x / R) % 1) < 0.15 ? SKIN_D : SKIN)); // fingers
    parts.push(hand.part());

    const leg = V('leg' + side);
    leg.col([0, 0], -7.3, 0.4, 2.6, 2.6, (x, y, z) => {
      if (y > -6.0 && y < -5.3) return LEATHER_D;
      if (y > -0.4) return LEATHER;
      if (z > 1.4 && y < -1.2 && y > -4.2) return IRON_M; // thigh plate
      if (k * x > 1.4 && y > -4.4) return IRON; // tasset
      return IRON_D;
    }, { p: 3, taper: 1.08 });
    parts.push(leg.part());

    const shin = V('shin' + side);
    shin.col([0, 0], -6.2, 0.4, 2.45, 2.45, (_x, y) => (y < -4.6 && y > -5.6 ? LEATHER : y < -2.8 && y > -3.6 ? IRON_M : IRON), { p: 3, taper: 1.06 });
    shin.blob([0, -0.1, 1.9], [1.9, 1.8, 1.2], (_x, y) => (y > 0.6 ? IRON_L : IRON_M), { p: 3 }); // knee plate
    parts.push(shin.part());

    const foot = V('foot' + side);
    foot.blob([0, -0.1, 0.5], [2.8, 1.1, 3.4], (_x, y) => (y < -0.6 ? LEATHER_D : LEATHER), { p: 3.4 });
    foot.blob([0, -0.1, 2.9], [2.1, 0.9, 1.0], IRON_L, { p: 3 });
    foot.col([0, 0], 0.2, 1.0, 2.8, 2.8, LEATHER_L, { p: 3 });
    parts.push(foot.part());
  }

  // ---------------------------------------------------------------- torn cape with the trident
  const TRI = ['.e.....e.', '.e..e..e.', '.ee.e.ee.', '..eeeee..', '....e....', '...eee...', '....e....', '....e....', '....e....'];
  const emblem = (x: number, y: number) => {
    const i = Math.floor((x + 2.7) / R);
    const j = Math.floor((-1.6 - y) / R);
    return j >= 0 && j < TRI.length && i >= 0 && i < 9 && TRI[j][i] === 'e';
  };
  const capeCol = (x: number, y: number, z: number) => (z < -0.6 && emblem(x, y) ? EMBLEM : Math.floor(x / R) % 3 === 0 ? RED_D : h2(x, y) < 0.15 ? RED_L : RED);
  const capeA = V('capeA');
  capeA.box([-5.7, -10, -1.2], [5.7, 0.3, 0], capeCol);
  capeA.box([-6.0, -0.8, -1.5], [6.0, 0.8, 0.4], RED_D);
  parts.push(capeA.part());
  const capeB = V('capeB');
  capeB.fill([-5.7, -10.2, -1.2], [5.7, 0, 0], (x, y) => y > -10 + 1.2 + h2(Math.floor(x / R), 5) * 4.2, (x, y, z) => capeCol(x, y - 10, z));
  parts.push(capeB.part());

  return { ...base, id: 'berserker', props: { ...base.props, shoulderX: 7.2, hipX: 2.7 }, parts };
}
