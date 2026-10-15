import { MOB_SCALE, MobBuilder, type MobBone, type MobDef, type V3 } from './mobKit';

/**
 * Sand scorpion (Песчаный скорпион): a giant scorpion with a ridged sandy carapace mottled tan and
 * brown, a low head with glowing red eyes and short fangs, two huge orange pincers striped yellow,
 * eight jointed legs banded orange and brown, and a long segmented tail in deep red and orange that
 * arches high over the back to a yellow-tipped stinger.
 */

const SA = 0xc8a466;
const SAL = 0xe0c486;
const SAD = 0x9a7a48;
const BR = 0x6a4a32;
const BRD = 0x4a3226;
const OR = 0xe0742a;
const ORL = 0xf49a3a;
const ORD = 0xb4501e;
const YE = 0xf0c24a;
const RE = 0xb42a22;
const RED = 0x84201e;
const EYE = 0xff3a1a;

export function sandScorpion(): MobDef {
  const B = new MobBuilder();
  const shell = [SA, SAL, SAD, BR];
  const orange = [OR, ORL, ORD, YE];
  const bones: MobBone[] = [
    { id: 'root', at: [0, 0, 0] },
    { id: 'body', parent: 'root', at: [0, 7, 0] },
    { id: 'head', parent: 'body', at: [0, 0, 7] },
    { id: 'tail', parent: 'body', at: [0, 2, -9] },
  ];
  // ---------------------------------------------------------------- carapace
  B.b('body', -6, -2.6, -9, 6, 3.4, 7, BR);
  for (let i = 0; i < 5; i++) {
    const z = -8.6 + i * 3.2;
    B.b('body', -6.4 + i * 0.1, 2.6, z, 6.4 - i * 0.1, 4.6 - (i % 2) * 0.4, z + 2.9, i % 2 ? SAL : SA, { bv: 0.2 }); // ridged plates
    B.b('body', -1.4, 4.2, z + 0.4, 1.4, 5.2, z + 2.4, SAD, { bv: 0.1 });
  }
  B.speck('body', [-6.4, 2.6, -9, 6.4, 4.8, 7], shell, 50, 3, { size: 1.3, faces: 't' });
  B.speck('body', [-6.4, -2.6, -9, 6.4, 4.6, 7], [BR, BRD, SAD], 30, 5, { size: 1.2, faces: 'lrd' });
  // ---------------------------------------------------------------- head
  B.b('head', -4.4, -2.4, -1, 4.4, 2.8, 4.2, SAD);
  B.b('head', -4.0, 2.2, -0.6, 4.0, 3.4, 3.6, SA, { bv: 0.15 });
  B.speck('head', [-4.4, -2.4, -1, 4.4, 3.4, 4.2], shell, 16, 7, { size: 1 });
  B.b('head', -3.6, -1.6, 4.0, 3.6, 1.6, 4.4, BRD, { bv: 0 });
  for (const k of [-1, 1]) {
    B.b('head', k * 0.8, 0.2, 4.2, k * 2.6, 1.6, 4.7, EYE, { g: true, bv: 0 });
    B.b('head', k * 0.6, -3.2, 3.6, k * 1.6, -1.2, 4.6, BONE(k), { bv: 0.08 }); // fangs
  }
  B.b('head', -2.2, -2.4, 4.0, 2.2, -1.2, 4.6, 0x2a1810, { bv: 0 });
  // ---------------------------------------------------------------- pincers
  for (const k of [1, -1]) {
    const id = k > 0 ? 'clawL' : 'clawR';
    bones.push({ id, parent: 'body', at: [k * 5, 0, 7], r: [0, k * 28, 0] });
    const sh: V3 = [0, 0, 0];
    const el: V3 = [k * 6, 3, 3];
    const wr: V3 = [k * 4, 1, 9];
    B.seg(id, sh, el, 2.6, 2.6, ORD, { bv: 0.15 });
    B.seg(id, el, wr, 3.0, 3.0, OR, { bv: 0.15 });
    B.segSpeck(id, sh, el, 1.1, orange, 5, 11 + k, 0.9);
    B.segSpeck(id, el, wr, 1.3, orange, 6, 13 + k, 1);
    // big claw hand
    B.b(id, wr[0] - 3, wr[1] - 2.4, wr[2], wr[0] + 3, wr[1] + 2.6, wr[2] + 6, OR);
    B.speck(id, [wr[0] - 3, wr[1] - 2.4, wr[2], wr[0] + 3, wr[1] + 2.6, wr[2] + 6], [OR, ORL, YE, ORD], 26, 15 + k, { size: 1.2 });
    B.b(id, wr[0] - 2.6, wr[1] + 2.4, wr[2] + 0.5, wr[0] + 2.6, wr[1] + 3.0, wr[2] + 5.5, YE, { bv: 0.1 });
    // two fingers
    B.crystal(id, [wr[0] + k * 1.4, wr[1] + 0.6, wr[2] + 5.6], [wr[0] + k * 0.4, wr[1] - 0.4, wr[2] + 12], 2.4, [ORL, YE, SAL]);
    B.crystal(id, [wr[0] - k * 1.6, wr[1] - 1.2, wr[2] + 5.6], [wr[0] - k * 0.2, wr[1] - 1.8, wr[2] + 10.5], 2.0, [OR, YE, SAL]);
  }
  // ---------------------------------------------------------------- eight legs
  const legs: [number, number][] = [[4.5, -40], [1.5, -14], [-1.5, 14], [-4.5, 40]];
  legs.forEach(([z, yaw], i) => {
    for (const k of [1, -1]) {
      const id = `leg${i}${k > 0 ? 'L' : 'R'}`;
      bones.push({ id, parent: 'body', at: [k * 5.6, -0.5, z], r: [0, k * yaw, 0] });
      const knee: V3 = [k * 6, 3.5, 0];
      const foot: V3 = [k * 10.5, -6.6, 0];
      B.seg(id, [0, 0, 0], knee, 2.0, 2.0, i % 2 ? ORD : OR, { bv: 0.12 });
      B.seg(id, knee, foot, 1.8, 1.8, i % 2 ? BR : ORD, { bv: 0.12 });
      B.segSpeck(id, knee, foot, 0.8, [OR, YE, BR, ORD], 4, 21 + i * 5 + k, 0.8);
      B.b(id, knee[0] - 1.2, knee[1] - 1.2, -1.2, knee[0] + 1.2, knee[1] + 1.2, 1.2, YE, { bv: 0.1 });
      B.b(id, foot[0] - 0.7, foot[1] - 0.6, -0.7, foot[0] + 0.7, foot[1] + 1.2, 0.7, BRD, { bv: 0.08 });
    }
  });
  // ---------------------------------------------------------------- tail arching over the back
  const n = 10;
  let prev: V3 = [0, 0, 0];
  for (let i = 1; i <= n; i++) {
    const a = (i / n) * Math.PI * 1.22;
    const p: V3 = [0, 9.5 - 9.5 * Math.cos(a), -9.5 * Math.sin(a)];
    const w = 4.2 - i * 0.18;
    B.seg('tail', prev, p, w, w, i % 2 ? RE : i % 3 ? OR : RED, { bv: 0.2 });
    B.b('tail', p[0] - w * 0.55, p[1] - w * 0.55, p[2] - w * 0.55, p[0] + w * 0.55, p[1] + w * 0.55, p[2] + w * 0.55, i % 2 ? ORD : RED, { bv: 0.15 });
    B.speck('tail', [p[0] - w * 0.55, p[1] - w * 0.55, p[2] - w * 0.55, p[0] + w * 0.55, p[1] + w * 0.55, p[2] + w * 0.55], [RE, RED, OR, YE, ORL], 6, 31 + i, { size: 0.9 });
    prev = p;
  }
  B.b('tail', prev[0] - 2, prev[1] - 1.6, prev[2] - 1, prev[0] + 2, prev[1] + 2, prev[2] + 3, OR); // venom bulb
  B.speck('tail', [prev[0] - 2, prev[1] - 1.6, prev[2] - 1, prev[0] + 2, prev[1] + 2, prev[2] + 3], orange, 8, 51, { size: 0.9 });
  B.crystal('tail', [prev[0], prev[1] - 1, prev[2] + 2.4], [prev[0], prev[1] - 5.4, prev[2] + 4.4], 2.0, [YE, SAL, 0xfff0c0]);
  return {
    id: 'mob_sand_scorpion',
    scale: MOB_SCALE,
    bones,
    parts: B.parts,
    yaw: 0.6,
    idle: [
      { b: 'body', pos: [0, 0.25, 0], period: 2 },
      { b: 'tail', rot: [4, 0, 0], period: 2.4 },
      { b: 'clawL', rot: [0, 4, 0], period: 2.8 },
      { b: 'clawR', rot: [0, -4, 0], period: 2.8, phase: 0.4 },
      ...[0, 1, 2, 3].flatMap((i) => [
        { b: `leg${i}L`, rot: [0, 0, 2] as V3, period: 2, phase: i * 0.25 },
        { b: `leg${i}R`, rot: [0, 0, -2] as V3, period: 2, phase: i * 0.25 + 0.5 },
      ]),
    ],
  };
}

function BONE(k: number) {
  return k > 0 ? 0xeee0c4 : 0xe0d0b0;
}
