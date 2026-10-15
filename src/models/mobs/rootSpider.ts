import { MOB_SCALE, MobBuilder, type MobBone, type MobDef, type V3 } from './mobKit';

/**
 * Root spider (Корневик): a forest spirit grown from an old stump. A shaggy mound of dark bark and
 * hanging moss forms the body, a bark face with a glowing green mask peers out at the front, two
 * great branching antlers of pale wood with leaf buds rise from the head, and eight thick root legs
 * with knotted joints and mossy patches arch out and plant themselves in the ground.
 */

const W = 0x9a5a30;
const WL = 0xb8743e;
const WD = 0x6e3e20;
const WDD = 0x44261a;
const BK = 0x3a2a1e;
const BKL = 0x54402c;
const MO = 0x6e9a26;
const MOL = 0x9cc038;
const MOD = 0x4a6e1c;
const EYE = 0x8cff3a;

export function rootSpider(): MobDef {
  const B = new MobBuilder();
  const bones: MobBone[] = [
    { id: 'root', at: [0, 0, 0] },
    { id: 'body', parent: 'root', at: [0, 13, 0] },
    { id: 'head', parent: 'body', at: [0, 4, 6], r: [-10, 0, 0] },
  ];
  const bark = [W, WL, WD, WD];
  const moss = [MO, MOL, MOD, MO];
  // ---------------------------------------------------------------- body: a shaggy bark and moss mound
  B.b('body', -7, -4, -9, 7, 5, 6, BK);
  B.b('body', -6, 4, -8, 6, 8, 4, BKL);
  B.b('body', -4, 7.5, -6, 4, 11, 2, BK);
  B.speck('body', [-4, 7.5, -6, 4, 11, 2], [BK, BKL, WDD, MO], 30, 6, { size: 1.6, out: 1.0 });
  B.speck('body', [-7, -4, -9, 7, 8, 6], [BK, BKL, WDD, WD], 80, 3, { size: 1.6, out: 0.8 });
  B.speck('body', [-6, 4, -8, 6, 10, 4], [BK, WDD, BKL, MOD], 50, 4, { size: 1.5, out: 0.9, faces: 'tlrb' });
  B.speck('body', [-7, -2, -9, 7, 8, 6], moss, 50, 5, { size: 1.5, out: 1.0, faces: 'tlrb' });
  B.fringe('body', -6.5, 6.5, 1, -9.4, 0.8, 9, [MO, MOD, BK, MOL, WDD], 7, 1.1);
  B.fringe('body', -9.0, 5.0, 1, 7.2, 0.8, 7, [MO, MOD, BK, MOL], 9, 1.2, 'z');
  B.fringe('body', -9.0, 5.0, 1, -7.9, 0.8, 7, [MO, MOD, BK, MOL], 11, 1.2, 'z');
  B.fringe('body', -6, 6, -3, 5.5, 0.8, 6, [BK, MOD, WDD], 13, 1.1); // root beard under the face
  // ---------------------------------------------------------------- head: bark face with a glowing green mask
  B.b('head', -4.2, -4.5, -1, 4.2, 4.2, 4.2, WD);
  B.speck('head', [-4.2, -4.5, -1, 4.2, 4.2, 4.2], [WD, WDD, BKL, MOD], 24, 15, { size: 1.1 });
  B.b('head', -4.6, 2, -1.5, 4.6, 5.2, 4.4, BK); // shaggy brow
  B.speck('head', [-4.6, 2, -1.5, 4.6, 5.2, 4.4], [BK, BKL, MO, MOD], 24, 17, { size: 1.2, out: 0.6 });
  B.b('head', -3.2, -2.6, 4.0, 3.2, 1.4, 4.6, 0x3e8a1c, { bv: 0.05 }); // mask glow base
  for (const k of [-1, 1]) B.b('head', k * 0.6, -0.4, 4.4, k * 2.8, 1.0, 4.9, EYE, { g: true, bv: 0 });
  B.b('head', -1.6, -2.4, 4.4, 1.6, -1.2, 4.9, EYE, { g: true, bv: 0 }); // glowing maw
  B.b('head', -0.6, -0.8, 4.5, 0.6, 1.0, 5.2, WD, { bv: 0.05 }); // nose ridge
  B.fringe('head', -3.6, 3.6, -2.6, 4.2, 0.6, 5, [WD, BK, MOD, WDD], 19, 0.9);
  // antlers
  for (const k of [-1, 1]) {
    const pts: V3[] = [
      [k * 2.5, 4, 1],
      [k * 6, 9, 0],
      [k * 10, 13, -1],
      [k * 13, 18, -2],
      [k * 14, 23, -2],
    ];
    for (let i = 0; i < pts.length - 1; i++) {
      B.seg('head', pts[i], pts[i + 1], 2.2 - i * 0.3, 2.2 - i * 0.3, i % 2 ? W : WL, { bv: 0.12 });
      B.segSpeck('head', pts[i], pts[i + 1], 0.9, bark, 4, 21 + i * 3 + k, 0.8);
    }
    // tines
    const tines: [number, V3][] = [
      [1, [k * 3.5, 15, 0]],
      [2, [k * 7.5, 20, -1]],
      [2, [k * 12, 19.5, 1.5]],
      [3, [k * 17, 22, -2]],
      [3, [k * 11.5, 24, -2]],
      [1, [k * 9, 11, 3]],
    ];
    tines.forEach(([i, tip], j) => {
      B.seg('head', pts[i], tip, 1.3, 1.3, j % 2 ? WL : W, { bv: 0.1 });
      B.b('head', tip[0] - 0.7, tip[1] - 0.2, tip[2] - 0.7, tip[0] + 0.7, tip[1] + 1.2, tip[2] + 0.7, j % 2 ? MOL : MO, { bv: 0.1 }); // bud
    });
    B.b('head', pts[4][0] - 0.8, pts[4][1], -2.8, pts[4][0] + 0.8, pts[4][1] + 1.4, -1.2, MOL, { bv: 0.1 });
    B.speck('head', [k * 6 - 1, 9, -2, k * 6 + 1, 14, 1], moss, 6, 27 + k, { size: 0.8 });
  }
  // ---------------------------------------------------------------- eight root legs: up to a knee, then down to the ground
  const legs: [number, number][] = [[4, -48], [1, -16], [-2.5, 18], [-6, 46]];
  legs.forEach(([z, yaw], i) => {
    for (const k of [1, -1]) {
      const id = `leg${i}${k > 0 ? 'L' : 'R'}`;
      bones.push({ id, parent: 'body', at: [k * 6, 1, z], r: [0, k * yaw, 0] });
      const hip: V3 = [0, 0, 0];
      const knee: V3 = [k * (11 - Math.abs(i - 1.5) * 0.4), 8, 0];
      const foot: V3 = [k * (23 - Math.abs(i - 1.5) * 1.2), -13, 0];
      B.seg(id, hip, knee, 3.4, 3.4, i % 2 ? W : WD, { bv: 0.2 });
      B.seg(id, knee, foot, 3.0, 3.0, i % 2 ? WD : W, { bv: 0.2 });
      B.segSpeck(id, hip, knee, 1.4, bark, 6, 31 + i * 7 + k, 1.0);
      B.segSpeck(id, knee, foot, 1.3, bark, 9, 33 + i * 7 + k, 1.0);
      B.segSpeck(id, knee, foot, 1.5, moss, 4, 35 + i * 7 + k, 0.9);
      B.b(id, knee[0] - 2.2, knee[1] - 2.2, -2.2, knee[0] + 2.2, knee[1] + 2.0, 2.2, WDD, { bv: 0.2 }); // knot
      B.speck(id, [knee[0] - 2.2, knee[1] - 2.2, -2.2, knee[0] + 2.2, knee[1] + 2.0, 2.2], [MO, MOL, WD], 5, 37 + i + k, { size: 0.9, faces: 't' });
      // splayed root toes
      for (const dz of [-1.1, 0, 1.1]) B.seg(id, [foot[0], foot[1] + 1.6, dz * 0.5], [foot[0] + k * 1.2, foot[1] - 0.6, dz * 1.4], 1.1, 1.1, WDD, { bv: 0.08 });
    }
  });
  return {
    id: 'mob_root_spider',
    scale: MOB_SCALE,
    bones,
    parts: B.parts,
    yaw: 0.5,
    idle: [
      { b: 'body', pos: [0, 0.4, 0], period: 3 },
      { b: 'head', rot: [2, 5, 0], period: 5.5 },
      ...[0, 1, 2, 3].flatMap((i) => [
        { b: `leg${i}L`, rot: [0, 0, 2] as V3, period: 3, phase: i * 0.25 },
        { b: `leg${i}R`, rot: [0, 0, -2] as V3, period: 3, phase: i * 0.25 + 0.5 },
      ]),
    ],
  };
}
