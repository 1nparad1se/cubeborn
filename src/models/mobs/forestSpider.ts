import { MOB_SCALE, MobBuilder, type MobBone, type MobDef } from './mobKit';

/**
 * Forest spider (Лесной паук): a squat dark purple-brown body with a big mottled abdomen streaked
 * orange on top, a boxy head with a glowing red face of eyes and a grin, two short fangs, and eight
 * long two-segment legs with moss and rust wrapped around the joints.
 */

const D = 0x2e2428;
const M = 0x4a3a3e;
const L = 0x63504e;
const H = 0x7a6460;
const OR = 0xc4602a;
const OR_L = 0xe07a34;
const OR_D = 0x8e4224;
const MOSS = 0x7c7a2c;
const MOSS_L = 0xa0963a;
const MOSS_D = 0x5a5a24;
const EYE = 0xff2414;

export function forestSpider(): MobDef {
  const B = new MobBuilder();
  const bones: MobBone[] = [
    { id: 'root', at: [0, 0, 0] },
    { id: 'body', parent: 'root', at: [0, 11, 0] },
    { id: 'abd', parent: 'body', at: [0, 1, -4] },
    { id: 'head', parent: 'body', at: [0, -1, 4] },
  ];

  // ---------------------------------------------------------------- thorax (body bone)
  B.b('body', -5.5, -3, -5, 5.5, 4, 5, M);
  B.b('body', -5, 3.6, -4.5, 5, 4.6, 4.5, L, { bv: 0.15 });
  B.b('body', -6, -1.5, -4, 6, 2.5, 4, D);
  B.speck('body', [-5.5, -3, -5, 5.5, 4.6, 5], [L, D, H, OR_D], 22, 3, { size: 1.2 });
  B.b('body', -2, 4.4, -2, 2, 5.2, 2, OR_D, { bv: 0.1 });

  // ---------------------------------------------------------------- abdomen (big, mottled, orange streaks on top)
  B.b('abd', -7.5, -3, -16, 7.5, 9, 0, M);
  B.b('abd', -6.5, 8.6, -15, 6.5, 10.2, -1, L);
  B.b('abd', -8.2, -1, -14.5, 8.2, 7, -1.5, M);
  B.b('abd', -6.5, -2, -17, 6.5, 7.5, -15.5, M);
  B.b('abd', -4.5, -4, -13, 4.5, -2.5, -3, D);
  // stepped rim like the reference
  B.b('abd', -8.8, 1, -13, 8.8, 5.5, -3, L, { bv: 0.2 });
  B.speck('abd', [-7.5, -3, -16, 7.5, 10.2, 0], [L, H, D, D], 46, 7, { size: 1.4 });
  B.speck('abd', [-6.5, 8.6, -15, 6.5, 10.2, -1], [OR, OR_L, OR_D, OR], 30, 11, { size: 1.4, faces: 't', out: 0.35 });
  B.speck('abd', [-8.8, 1, -13, 8.8, 7, -3], [OR, OR_D], 12, 19, { size: 1.2, faces: 'lr' });
  B.speck('abd', [-6.5, -2, -17.2, 6.5, 7.5, -15.5], [OR, OR_D, L], 10, 23, { size: 1.3, faces: 'b' });
  B.speck('abd', [-7.5, 2, -16, 7.5, 9, 0], [MOSS, MOSS_D], 7, 29, { size: 1.0, faces: 'lrt' });
  // spinnerets
  B.b('abd', -1.6, -1, -18, 1.6, 2, -16.5, D, { bv: 0.15 });
  for (const x of [-3.5, 3.5]) B.b('abd', x - 0.8, -4, -6, x + 0.8, -2.5, -4, OR_D, { bv: 0.1 });

  // ---------------------------------------------------------------- head with the glowing face
  B.b('head', -4.5, -3.5, 0, 4.5, 4, 7, M);
  B.b('head', -4, 3.6, 0.5, 4, 4.6, 6.5, L, { bv: 0.15 });
  B.speck('head', [-4.5, -3.5, 0, 4.5, 4.6, 7], [L, D, OR_D, H], 18, 31, { size: 1.0, faces: 'tlr' });
  B.speck('head', [-4, 3.6, 0.5, 4, 4.6, 6.5], [OR, OR_D], 6, 37, { size: 1.0, faces: 't' });
  B.b('head', -4, -3, 6.8, 4, 3.6, 7.3, D, { bv: 0 }); // dark face plate
  const G = { g: true, bv: 0 };
  for (const k of [-1, 1]) {
    B.b('head', k * 1.7, 1.4, 7.1, k * 3.4, 2.9, 7.6, EYE, G); // big eyes
    B.b('head', k * 0.4, 0.2, 7.1, k * 1.5, 1.3, 7.6, EYE, G); // small inner eyes
    B.b('head', k * 2.0, -1.6, 7.1, k * 3.0, -0.4, 7.6, EYE, G); // grin corners
  }
  B.b('head', -2.0, -2.6, 7.1, 2.0, -1.5, 7.6, EYE, G); // grin
  // fangs
  for (const k of [-1, 1]) {
    B.b('head', k * 0.8, -6, 5.2, k * 2.0, -3.2, 6.6, D, { bv: 0.15 });
    B.b('head', k * 0.9, -6.8, 5.6, k * 1.8, -5.8, 6.4, OR_D, { bv: 0.1 });
  }

  // ---------------------------------------------------------------- eight legs: hip on the thorax, knee high, foot out on the ground
  const legs: [number, number][] = [[3.5, -50], [1.2, -18], [-1.2, 16], [-3.5, 48]];
  legs.forEach(([z, yaw], i) => {
    for (const k of [1, -1]) {
      const id = `leg${i}${k > 0 ? 'L' : 'R'}`;
      bones.push({ id, parent: 'body', at: [k * 5, 0.5, z], r: [0, k * yaw, 0] });
      const knee = [10.5 - i * 0.3, 6.8];
      const foot = [19 - Math.abs(i - 1.5) * 0.8, -10.6];
      const a1 = (Math.atan2(knee[1], knee[0]) * 180) / Math.PI;
      const l1 = Math.hypot(knee[0], knee[1]);
      const dx = foot[0] - knee[0];
      const dy = foot[1] - knee[1];
      const a2 = (Math.atan2(dy, dx) * 180) / Math.PI;
      const l2 = Math.hypot(dx, dy);
      const sx = k;
      // upper segment
      B.add(...partsAlong(id, 0, 0, knee[0], knee[1], l1, a1, 3.0, sx, [M, L], i));
      // lower segment, tip darker
      B.add(...partsAlong(id, knee[0], knee[1], foot[0], foot[1], l2, a2, 2.6, sx, [M, D], i + 4));
      // moss and rust bands around the knee and the shin
      for (let j = 0; j < 7; j++) {
        const tt = j < 3 ? 0.92 + j * 0.03 : 0.25 + (j - 3) * 0.05;
        const seg = j < 3 ? [0, 0, knee[0], knee[1]] : [knee[0], knee[1], foot[0], foot[1]];
        const x = seg[0] + (seg[2] - seg[0]) * tt;
        const y = seg[1] + (seg[3] - seg[1]) * tt;
        const zz = (((j * 37 + i * 11) % 5) - 2) * 0.6;
        const c = [MOSS, MOSS_L, MOSS_D, OR_D][(j + i) % 4];
        B.b(id, sx * x - 0.9, y - 0.9, zz - 0.9 + (j % 2 ? 1.5 : -1.5) * 0.6, sx * x + 0.9, y + 0.9, zz + 0.9 + (j % 2 ? 1.5 : -1.5) * 0.6, c, { bv: 0.08 });
      }
    }
  });

  return {
    id: 'mob_spider',
    scale: MOB_SCALE,
    bones,
    parts: B.parts,
    yaw: 0.5,
    idle: [
      { b: 'body', pos: [0, 0.35, 0], period: 2.2 },
      { b: 'abd', rot: [2.5, 0, 0], period: 2.2, phase: 0.2 },
      { b: 'head', rot: [0, 6, 0], period: 5.3 },
      ...[0, 1, 2, 3].flatMap((i) => [
        { b: `leg${i}L`, rot: [0, 0, 2] as [number, number, number], period: 2.2, phase: i * 0.25 },
        { b: `leg${i}R`, rot: [0, 0, -2] as [number, number, number], period: 2.2, phase: i * 0.25 + 0.5 },
      ]),
    ],
  };
}

/** A square-section limb segment from (x0, y0) to (x1, y1) in the leg's xy plane, split into two shaded halves. */
function partsAlong(b: string, x0: number, y0: number, x1: number, y1: number, len: number, ang: number, th: number, sx: number, cols: [number, number], seed: number) {
  const out = [];
  const n = 2;
  for (let j = 0; j < n; j++) {
    const t = (j + 0.5) / n;
    const cx = x0 + (x1 - x0) * t;
    const cy = y0 + (y1 - y0) * t;
    const w = th - j * 0.25;
    out.push({ b, s: 'rbox' as const, bv: [0.25, 0.25, 0.25] as [number, number, number], p: [sx * cx, cy, 0] as [number, number, number], d: [len / n + 0.6, w, w] as [number, number, number], c: cols[(j + seed) % 2], r: [0, 0, sx * ang] as [number, number, number] });
  }
  // mottled top stripe
  const cx = x0 + (x1 - x0) * 0.5;
  const cy = y0 + (y1 - y0) * 0.5;
  out.push({ b, s: 'rbox' as const, bv: [0.15, 0.15, 0.15] as [number, number, number], p: [sx * cx, cy, th / 2 - 0.2] as [number, number, number], d: [len * 0.5, th * 0.5, 0.6] as [number, number, number], c: 0x5a4846, r: [0, 0, sx * ang] as [number, number, number] });
  return out;
}
