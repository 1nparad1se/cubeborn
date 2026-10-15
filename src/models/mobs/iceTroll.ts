import { humanBones, humanIdle, MOB_SCALE, MobBuilder, type MobDef, type V3 } from './mobKit';

/**
 * Ice troll (Ледяной тролль): a hulking golem of packed snow and blue ice. A blocky head with a
 * heavy brow, glowing blue eyes and an icicle-fanged scowl sits low between massive shoulders; its
 * mottled white and blue body is studded with clear crystal shards, the long arms end in huge
 * crystal-clad fists, and the squat legs stand in clusters of glowing ice spikes.
 */

const SN = 0xe4ecf6;
const SNL = 0xf4f8fc;
const SNG = 0xb8c4dc;
const IC = 0x5a9ae4;
const ICL = 0x8cc4f4;
const ICD = 0x2e64c0;
const ICDD = 0x1e3e8a;
const CR = 0x9adcff;
const CRL = 0xc8f0ff;
const EYE = 0x48d8ff;

export function iceTroll(): MobDef {
  const B = new MobBuilder();
  const mot = [SN, SNL, SNG, IC, ICL, ICD, SN];
  const crys = [CR, CRL, ICL];
  // ---------------------------------------------------------------- hips
  B.b('hips', -6.4, -1.6, -4.2, 6.4, 5, 4.2, SNG);
  B.speck('hips', [-6.4, -1.6, -4.2, 6.4, 5, 4.2], mot, 30, 3, { size: 1.6 });
  B.b('hips', -1.8, -3, 3.6, 1.8, 3, 4.8, ICD, { bv: 0.1 });
  for (let i = 0; i < 5; i++) B.b('hips', -3 + i * 1.4, -3 - (i % 2) * 1.4, 3.8, -2.2 + i * 1.4, -1, 4.6, ICL, { bv: 0.05 }); // icicles
  // ---------------------------------------------------------------- chest
  B.b('chest', -8.5, -1, -5.5, 8.5, 12, 5.5, SN);
  B.speck('chest', [-8.5, -1, -5.5, 8.5, 12, 5.5], mot, 120, 7, { size: 2.0, out: 0.5 });
  B.b('chest', -6, 2, 5.2, 6, 10, 6.2, IC); // chest plate
  B.speck('chest', [-6, 2, 5.2, 6, 10, 6.2], [IC, ICL, ICD, SN], 30, 9, { size: 1.5, faces: 'f' });
  B.b('chest', -7, 10, -6.5, 7, 15, 4.5, SNL); // hunched back hump
  B.speck('chest', [-7, 10, -6.5, 7, 15, 4.5], mot, 40, 11, { size: 1.8, out: 0.6 });
  for (const [b, t] of [
    [[-4, 14, -3], [-5, 19, -5]],
    [[3, 14, -2], [4, 20, -3]],
    [[0, 14, -5], [0, 18, -8]],
    [[-6, 8, -5.5], [-8, 11, -9]],
    [[6, 6, -5.5], [8, 9, -9]],
  ] as [V3, V3][])
    B.crystal('chest', b, t, 2.4, crys, true);
  for (let i = 0; i < 6; i++) B.b('chest', -4 + i * 1.6, -1 - (i % 3), 5.6, -3.2 + i * 1.6, 1, 6.4, ICL, { bv: 0.05 });
  // ---------------------------------------------------------------- head
  B.b('head', -5, -1, -3, 5, 8.5, 7, SN);
  B.speck('head', [-5, -1, -3, 5, 8.5, 7], mot, 46, 13, { size: 1.5 });
  B.b('head', -5.2, 4.2, 6.8, 5.2, 6, 7.8, SNG, { bv: 0.1 }); // brow
  for (const k of [-1, 1]) {
    B.b('head', k * 1.0, 2.6, 6.9, k * 3.6, 4.2, 7.3, ICDD, { bv: 0 });
    B.b('head', k * 1.4, 2.9, 7.2, k * 3.2, 4.0, 7.5, EYE, { g: true, bv: 0 });
    B.crystal('head', [k * 2, 7.5, 1], [k * 3.5, 12, 0], 2.4, crys, true);
  }
  B.crystal('head', [0, 8, 2], [0, 12.5, 1], 3, crys, true);
  B.b('head', -1, 1.2, 6.9, 1, 3.2, 8.2, SNL, { bv: 0.15 }); // nose
  B.b('head', -3.2, -0.6, 6.9, 3.2, 1.0, 7.3, ICDD, { bv: 0 }); // scowl
  for (const k of [-1, 1]) B.b('head', k * 1.6, -1.4, 7.0, k * 2.4, 0.6, 7.6, CRL, { bv: 0.05 }); // icicle fangs
  B.b('head', -4.6, -2.6, 0, 4.6, -0.4, 7.4, SNG); // jaw
  B.speck('head', [-4.6, -2.6, 0, 4.6, -0.4, 7.4], mot, 10, 15, { size: 1.2 });
  // ---------------------------------------------------------------- limbs
  for (const s of ['L', 'R']) {
    const k = s === 'L' ? 1 : -1;
    const arm = 'arm' + s;
    const fore = 'fore' + s;
    const leg = 'leg' + s;
    const shin = 'shin' + s;
    B.b(arm, -4.2, -11, -4.2, 4.2, 3.4, 4.2, SN);
    B.speck(arm, [-4.2, -9, -4.2, 4.2, 3.4, 4.2], mot, 34, 21 + k, { size: 1.7 });
    B.crystal(arm, [k * 1, 3, -1], [k * 3, 9, -2], 2.6, crys, true);
    B.crystal(arm, [k * 3.6, 1, 1], [k * 7, 5, 1], 1.8, crys, true);
    B.b(fore, -4.8, -11, -4.8, 4.8, 0.4, 4.8, IC);
    B.speck(fore, [-4.8, -10, -4.8, 4.8, 0.4, 4.8], [IC, ICL, ICD, SN, SNG, CR], 50, 23 + k, { size: 1.8, out: 0.5 });
    B.b(fore, -5.2, -16, -5.2, 5.2, -9.4, 5.2, ICL); // giant fist
    B.speck(fore, [-5.2, -16, -5.2, 5.2, -9.4, 5.2], [CR, CRL, IC, ICL, SN], 40, 25 + k, { size: 1.8, out: 0.6, g: false });
    for (let i = 0; i < 4; i++) B.b(fore, -4.2 + i * 2.2, -17, 3.4, -2.6 + i * 2.2, -14.6, 5.4, i % 2 ? ICL : SN, { bv: 0.12 }); // knuckles
    for (const [b, t] of [
      [[k * 4.5, -12, 0], [k * 8, -15, 0]],
      [[k * 4, -7, -3], [k * 7, -6, -5]],
      [[0, -15, -4], [0, -19, -6]],
      [[k * 3, -16, 2], [k * 4, -20, 3]],
    ] as [V3, V3][])
      B.crystal(fore, b, t, 2.2, crys, true);
    B.b(leg, -4, -7, -4, 4, 1, 4, SNG);
    B.speck(leg, [-4, -7, -4, 4, 1, 4], mot, 20, 31 + k, { size: 1.5 });
    B.b(shin, -4.6, -8, -4.6, 4.6, 0.4, 4.8, SN);
    B.speck(shin, [-4.6, -8, -4.6, 4.6, 0.4, 4.8], mot, 30, 33 + k, { size: 1.6 });
    B.b(shin, -5, -10, -5, 5, -7.6, 6, SNG); // stump foot
    B.speck(shin, [-5, -10, -5, 5, -7.6, 6], [SNG, SN, IC], 10, 35 + k, { size: 1.2, faces: 'tflr' });
    // ice spikes clustered round the feet
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + k;
      const x = Math.cos(a) * 5.2;
      const z = Math.sin(a) * 5.2 + 0.5;
      const h = 3 + ((i * 5) % 4) * 1.3;
      B.crystal(shin, [x, -10, z], [x * 1.2, -10 + h, z * 1.2], 1.6 + (i % 2) * 0.6, crys, true);
    }
  }
  const pose = {
    hips: [4, 0, 0] as V3,
    chest: [14, 0, 0] as V3,
    head: [-14, 0, 0] as V3,
    armL: [-6, 0, 16] as V3,
    foreL: [-14, 0, 0] as V3,
    armR: [-4, 0, -16] as V3,
    foreR: [-10, 0, 0] as V3,
    legL: [-6, 0, 6] as V3,
    shinL: [6, 0, -6] as V3,
    legR: [-4, 0, -6] as V3,
    shinR: [4, 0, 6] as V3,
  };
  return {
    id: 'mob_ice_troll',
    scale: MOB_SCALE,
    bones: humanBones({ hipY: 15, hipX: 4.6, thigh: 6.6, torso: 5, shoulderY: 10, shoulderX: 13, neck: 12.5, upperArm: 10.5 }, pose),
    parts: B.parts,
    idle: humanIdle(1.3, 3.8),
  };
}
