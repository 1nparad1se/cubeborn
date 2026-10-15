import { humanBones, humanIdle, MOB_SCALE, MobBuilder, type MobDef, type V3 } from './mobKit';

/**
 * Ice knight (Ледяной рыцарь): a revenant knight in frost-rimed blue plate. A closed great helm
 * with a pale ice crest and glowing blue eye slits, a frozen beard over a pale jaw, massive square
 * pauldrons sprouting glowing ice crystals, brown leather sleeves and belt, a blue tabard with a
 * frayed brown hem, crystal-crusted sabatons, a long ice-blue sword, and a kite shield with a
 * crystal emblem.
 */

const PL = 0x5a6aa0;
const PLL = 0x8a9ac8;
const PLD = 0x3a4678;
const PLDD = 0x262e54;
const FR = 0xd8e2f4;
const FRG = 0xaab6d4;
const ICE = 0x6ab4f0;
const ICEL = 0xa8dcff;
const CR = 0x8ad4ff;
const CRL = 0xc8f0ff;
const LE = 0x7a5034;
const LED = 0x553624;
const TAB = 0x2e3e8a;
const SKIN = 0xd2a878;
const EYE = 0x48d8ff;

export function iceKnight(): MobDef {
  const B = new MobBuilder();
  const plate = [PL, PLL, PLD, PLDD, FRG, ICE];
  const crys = [CR, CRL, ICEL];
  // ---------------------------------------------------------------- hips: belt, tabard
  B.b('hips', -4.8, -1, -3.2, 4.8, 4, 3.2, PLD);
  B.speck('hips', [-4.8, -1, -3.2, 4.8, 4, 3.2], plate, 14, 3, { size: 1 });
  B.b('hips', -5.1, 2.6, -3.5, 5.1, 4.2, 3.5, LE);
  B.b('hips', -1, 2.4, 3.4, 1, 4.4, 3.9, FRG, { bv: 0.06 });
  B.b('hips', -2.2, -4, 3.3, 2.2, 2.6, 3.9, TAB); // front tabard
  B.b('hips', -1.4, -2.6, 3.8, 1.4, 1.6, 4.1, ICE, { bv: 0 });
  B.fringe('hips', -2.2, 2.2, -4, 3.3, 0.6, 3.5, [LE, LED, TAB], 5, 0.9);
  B.b('hips', -3.2, -5, -3.9, 3.2, 2.6, -3.3, TAB); // back tabard
  B.b('hips', -3.4, -5.6, -4.0, 3.4, -4.6, -3.2, FRG, { bv: 0.05 });
  B.fringe('hips', -3.2, 3.2, -5.4, -4.0, 0.6, 3.5, [LE, LED, TAB], 7, 0.9);
  // ---------------------------------------------------------------- chest: blue plate
  B.b('chest', -6, -0.6, -3.8, 6, 8.6, 3.8, PL);
  B.speck('chest', [-6, -0.6, -3.8, 6, 8.6, 3.8], plate, 70, 9, { size: 1.4 });
  B.b('chest', -4, 0.6, 3.6, 4, 7.4, 4.4, PLD); // breastplate
  B.speck('chest', [-4, 0.6, 3.6, 4, 7.4, 4.4], [PLD, PL, ICE, FRG], 20, 11, { size: 1.1, faces: 'f' });
  B.b('chest', -1.4, 1.6, 4.3, 1.4, 5.4, 4.8, ICE, { bv: 0.05 });
  B.b('chest', -2.6, 0.4, -4.4, 2.6, 8, -3.6, TAB); // back panel with a crystal
  B.crystal('chest', [0, 2, -4.6], [0, 7.5, -5.2], 2.4, crys, true);
  B.b('chest', -6.4, -0.8, -4.1, 6.4, 0.6, 4.1, LE, { bv: 0.06 });
  // ---------------------------------------------------------------- head: great helm with an ice crest
  B.b('head', -3.8, -0.6, -3.6, 3.8, 8, 4, PL);
  B.speck('head', [-3.8, -0.6, -3.6, 3.8, 8, 4], plate, 36, 13, { size: 1.1 });
  B.b('head', -1.2, 0.6, -4.2, 1.2, 9.2, 4.4, ICEL, { bv: 0.1 }); // crest stripe front-to-back
  B.speck('head', [-1.2, 8.4, -4.2, 1.2, 9.2, 4.4], [ICE, CRL, FR], 8, 15, { size: 0.8, faces: 't' });
  B.b('head', -4.2, -1, -3.9, 4.2, 0.6, 4.3, FRG, { bv: 0.08 }); // helm rim
  for (const k of [-1, 1]) {
    B.b('head', k * 1.4, 4.6, 3.9, k * 3.2, 5.6, 4.2, PLDD, { bv: 0 });
    B.b('head', k * 1.6, 4.8, 4.1, k * 3.0, 5.4, 4.4, EYE, { g: true, bv: 0 });
  }
  B.b('head', -1.6, 0.4, 3.9, 1.6, 2.6, 4.6, SKIN, { bv: 0.08 }); // pale jaw
  B.b('head', -3.2, -2.6, 2.4, 3.2, 1.0, 4.6, PLD); // frozen beard
  B.speck('head', [-3.2, -2.6, 2.4, 3.2, 1.0, 4.6], [ICE, PLD, ICEL, PL], 16, 17, { size: 0.9, faces: 'fd' });
  B.fringe('head', -2.6, 2.6, -2.4, 3.8, 0.6, 2.4, [ICE, PLD, ICEL], 19, 0.8);
  // ---------------------------------------------------------------- limbs
  for (const s of ['L', 'R']) {
    const k = s === 'L' ? 1 : -1;
    const arm = 'arm' + s;
    const fore = 'fore' + s;
    const leg = 'leg' + s;
    const shin = 'shin' + s;
    B.b(arm, -2.4, -7, -2.4, 2.4, 1, 2.4, LE); // leather sleeve
    B.speck(arm, [-2.4, -7, -2.4, 2.4, 1, 2.4], [LE, LED, 0x9a6a44], 10, 21 + k, { size: 0.9 });
    B.b(arm, -4.4, -2.8, -4.4, 4.4, 3.6, 4.4, PL); // huge square pauldron
    B.b(arm, -4.7, -3.2, -4.7, 4.7, -2.2, 4.7, FRG, { bv: 0.08 });
    B.b(arm, -4.0, 3.2, -4.0, 4.0, 4.2, 4.0, PLL, { bv: 0.1 });
    B.speck(arm, [-4.4, -2.8, -4.4, 4.4, 4.2, 4.4], [...plate, FR], 36, 23 + k, { size: 1.2 });
    for (const [b, t] of [
      [[k * 2, 4, -1], [k * 3.4, 8.5, -2]],
      [[k * 0.4, 4, 1.5], [k * 1, 7, 2.5]],
      [[k * 4.2, 2, -2], [k * 7, 4.5, -3]],
    ] as [V3, V3][])
      B.crystal(arm, b, t, 1.8, crys, true);
    B.b(fore, -2.6, -6.6, -2.6, 2.6, 0.4, 2.6, PL); // vambrace
    B.speck(fore, [-2.6, -6.6, -2.6, 2.6, 0.4, 2.6], plate, 14, 25 + k, { size: 1 });
    B.b(fore, -2.9, -6, -2.9, 2.9, -4.6, 2.9, FRG, { bv: 0.06 });
    B.crystal(fore, [k * 2.6, -3, 0], [k * 5, -1.5, 0], 1.4, crys, true);
    B.b(fore, -2.3, -9.4, -2.3, 2.3, -6.4, 2.3, PLD); // gauntlet
    B.b(leg, -2.6, -6.4, -2.6, 2.6, 0.6, 2.6, PLD);
    B.speck(leg, [-2.6, -6.4, -2.6, 2.6, 0.6, 2.6], plate, 14, 31 + k, { size: 1 });
    B.b(shin, -2.6, -5.6, -2.6, 2.6, 0.4, 2.6, PL);
    B.speck(shin, [-2.6, -5.6, -2.6, 2.6, 0.4, 2.6], plate, 14, 33 + k, { size: 1 });
    B.b(shin, -2.9, -0.8, -2.9, 2.9, 1.0, 3.2, FRG, { bv: 0.08 }); // knee cop
    B.b(shin, -3.2, -8.6, -3.2, 3.2, -5.6, 4.4, FRG); // frosted sabaton
    B.speck(shin, [-3.2, -8.6, -3.2, 3.2, -5.6, 4.4], [FR, FRG, PLL, ICE], 14, 35 + k, { size: 1.1, faces: 'tflr' });
    B.crystal(shin, [k * 2, -6, 2], [k * 2.6, -1.5, 2.6], 2.0, crys, true);
    B.crystal(shin, [k * 3, -7, -1], [k * 4.6, -3.6, -1.4], 1.4, crys, true);
  }
  // ---------------------------------------------------------------- ice sword (fist of foreR, blade along +z)
  B.b('sword', -0.7, -0.7, -3.2, 0.7, 0.7, 1.4, LED);
  B.b('sword', -0.9, -0.9, -4.4, 0.9, 0.9, -3.2, FRG, { bv: 0.1 });
  B.b('sword', -3.6, -0.9, 1.2, 3.6, 0.9, 2.4, FRG, { bv: 0.1 }); // crossguard
  B.crystal('sword', [3.2, 0, 1.8], [5.4, 0, 2.6], 1.2, crys, true);
  B.crystal('sword', [-3.2, 0, 1.8], [-5.4, 0, 2.6], 1.2, crys, true);
  B.b('sword', -1.8, -0.5, 2.4, 1.8, 0.5, 18, ICEL);
  B.b('sword', -0.6, -0.6, 2.8, 0.6, 0.6, 17, ICE, { bv: 0 }); // fuller
  B.b('sword', -1.1, -0.45, 17.8, 1.1, 0.45, 19.6, CRL);
  B.speck('sword', [-1.8, -0.5, 2.4, 1.8, 0.5, 18], [ICE, CRL, FR], 14, 41, { size: 0.7, faces: 'lr' });
  for (let i = 0; i < 4; i++) B.crystal('sword', [1.8, 0, 5 + i * 3.4], [3.0, 0, 6.6 + i * 3.4], 1.0, crys, true);
  // ---------------------------------------------------------------- kite shield with a crystal emblem
  B.b('shield', -5, -2, -0.6, 5, 9, 0.6, PL);
  B.b('shield', -4, -6, -0.6, 4, -1.8, 0.6, PL);
  B.b('shield', -2.4, -9, -0.6, 2.4, -5.8, 0.6, PL);
  B.b('shield', -1, -10.6, -0.6, 1, -8.8, 0.6, PL);
  B.b('shield', -5.4, 8.6, -0.8, 5.4, 9.8, 0.9, FRG);
  for (const k of [-1, 1]) {
    B.b('shield', k * 4.6, -2, -0.8, k * 5.6, 9.8, 0.9, FRG);
    B.b('shield', k * 3.6, -6, -0.8, k * 4.6, -1.8, 0.9, FRG);
    B.b('shield', k * 2.0, -9, -0.8, k * 3.0, -5.8, 0.9, FRG);
    B.b('shield', k * 0.6, -10.8, -0.8, k * 1.6, -8.8, 0.9, FRG);
  }
  B.b('shield', -2.4, -4, 0.5, 2.4, 6, 0.9, ICE, { bv: 0.05 }); // emblem
  B.b('shield', -1.4, -6, 0.5, 1.4, 7.6, 1.0, ICEL, { bv: 0.05 });
  B.b('shield', -0.6, -7, 0.8, 0.6, 8.4, 1.2, CRL, { g: true, bv: 0.05 });
  B.speck('shield', [-5, -6, -0.6, 5, 9, 0.6], [PLD, PLL, FRG], 24, 43, { size: 0.9, faces: 'f' });
  B.b('shield', -1, -1, -1.6, 1, 1, -0.5, LED);

  const pose = {
    hips: [4, 0, 0] as V3,
    chest: [12, 0, 0] as V3,
    head: [-10, 0, 0] as V3,
    armR: [-8, 0, -16] as V3,
    foreR: [-40, 0, 0] as V3,
    armL: [-26, 0, 20] as V3,
    foreL: [-40, 0, 0] as V3,
    legL: [-14, 0, 12] as V3,
    shinL: [14, 0, -10] as V3,
    legR: [-10, 0, -12] as V3,
    shinR: [12, 0, 10] as V3,
  };
  return {
    id: 'mob_ice_knight',
    scale: MOB_SCALE,
    bones: humanBones(
      { hipY: 13.4, hipX: 2.8, thigh: 6.6, torso: 4, shoulderY: 7, shoulderX: 8.4, neck: 8.6, upperArm: 7 },
      pose,
      [
        { id: 'sword', parent: 'foreR', at: [0, -8, 0], r: [50, 0, 0] },
        { id: 'shield', parent: 'foreL', at: [3.4, -4, 1.0], r: [66, 24, 0] },
      ],
    ),
    parts: B.parts,
    idle: humanIdle(1.1, 3.2),
  };
}
