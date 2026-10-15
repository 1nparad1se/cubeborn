import { humanBones, humanIdle, MOB_SCALE, MobBuilder, type MobDef } from './mobKit';

/**
 * Forest goblin (Лесной гоблин): a crouching green goblin with a huge square head, long pointed
 * ears, glowing yellow eyes and a tusk, a ragged brown tunic and loincloth on a belt with an iron
 * buckle, leg wraps and dark boots, a serrated bone-white sword and a plank shield with an iron rim.
 */

export const GOB = {
  G: 0x6c9a2c,
  GL: 0x8cb83c,
  GD: 0x4e7424,
  GDD: 0x3a5a1c,
  BR: 0x7a4a24,
  BRL: 0x9a6230,
  BRD: 0x553218,
  BOOT: 0x3e2a1c,
  IRON: 0x55525c,
  IRON_D: 0x38353e,
  EYE: 0xffd21a,
  TUSK: 0xebe2c8,
  EAR: 0xc8742c,
  MOUTH: 0x3a2014,
};

/** Shared goblin body (head, torso, limbs) for the swordsman and the archer. */
export function goblinBody(B: MobBuilder, o: { hood?: boolean } = {}) {
  const { G, GL, GD, GDD, BR, BRL, BRD, BOOT, IRON, IRON_D, EYE, TUSK, EAR, MOUTH } = GOB;
  const skin = [G, GL, GD, GDD];
  // ---------------------------------------------------------------- hips: pelvis, belt, loincloth
  B.b('hips', -3.4, -0.6, -2, 3.4, 3, 2, GD);
  B.b('hips', -3.7, 2, -2.3, 3.7, 3.2, 2.3, BR);
  B.b('hips', -1.1, 1.8, 2.1, 1.1, 3.4, 2.6, BRD, { bv: 0.1 });
  B.b('hips', -0.6, 2.2, 2.4, 0.6, 3.0, 2.75, IRON, { bv: 0 });
  B.fringe('hips', -2.6, 2.6, 2.4, 2.05, 0.45, 5.2, [BR, BRL, BRD], 3);
  B.fringe('hips', -2.6, 2.6, 2.4, -2.5, 0.45, 5.2, [BR, BRD], 5);
  // ---------------------------------------------------------------- chest: green torso under a ragged tunic
  B.b('chest', -3.5, -0.2, -2.2, 3.5, 5.6, 2.2, G);
  B.speck('chest', [-3.5, -0.2, -2.2, 3.5, 5.6, 2.2], skin, 10, 2, { size: 1 });
  B.b('chest', -3.8, 2.6, -2.5, 3.8, 6.0, 2.5, BR); // tunic yoke
  B.b('chest', -1.2, 0.8, 2.2, 1.2, 4, 2.6, BRD, { bv: 0.1 }); // laced front
  B.fringe('chest', -3.8, 3.8, 2.8, 2.35, 0.45, 2.6, [BR, BRD, BRL], 7);
  B.fringe('chest', -3.8, 3.8, 3.4, -2.8, 0.45, 3.6, [BR, BRD, BRL], 9);
  B.speck('chest', [-3.8, 2.6, -2.5, 3.8, 6.0, 2.5], [BRD, BRL, G], 10, 4, { size: 0.9 });
  // shoulder rags
  for (const k of [-1, 1]) {
    B.b('chest', k * 2.6, 4.6, -2.7, k * 5.6, 6.3, 2.7, BR, { bv: 0.15 });
    B.fringe('chest', -2.7, 2.7, 4.8, k > 0 ? 5.2 : -5.6, 0.4, 2.4, [BR, BRD], 11 + k, 0.9, 'z');
  }
  // ---------------------------------------------------------------- head
  B.b('head', -4.5, 0, -4, 4.5, 9, 4.8, G);
  B.speck('head', [-4.5, 0, -4, 4.5, 9, 4.8], skin, 34, 13, { size: 1.1 });
  B.b('head', -4.0, 5.2, 4.7, 4.0, 6.0, 5.2, GDD, { bv: 0.08 }); // brow
  for (const k of [-1, 1]) {
    B.b('head', k * 1.2, 3.8, 4.6, k * 3.4, 5.2, 5.05, 0x7a5a10, { bv: 0 });
    B.b('head', k * 1.5, 4.0, 4.9, k * 3.1, 5.0, 5.2, EYE, { g: true, bv: 0 });
  }
  B.b('head', -0.8, 2.6, 4.7, 0.8, 4.2, 5.6, GD, { bv: 0.15 }); // nose
  B.b('head', -2.6, 1.0, 4.7, 2.6, 2.4, 5.1, MOUTH, { bv: 0 });
  B.b('head', 1.0, 0.6, 4.9, 2.0, 2.4, 5.4, TUSK, { bv: 0.08 });
  B.b('head', -2.2, 1.6, 4.9, -1.4, 2.4, 5.3, TUSK, { bv: 0.05 });
  B.b('head', -4.2, -0.6, -3, 4.2, 0.6, 4.4, GD); // jaw / chin
  // pointed ears out to the sides
  for (const k of [-1, 1]) {
    const steps: [number, number, number, number][] = [
      [4.3, 6.6, 4.4, 8.6],
      [6.4, 8.4, 4.9, 8.4],
      [8.2, 9.8, 5.4, 8.2],
      [9.6, 11.0, 6.0, 8.0],
    ];
    steps.forEach(([x0, x1, y0, y1], i) => {
      const yb = y0 + i * 0.25;
      B.b('head', k * x0, yb, -0.4, k * x1, y1 + i * 0.25, 1.6 - i * 0.2, G, { bv: 0.12 });
      if (i < 3) B.b('head', k * x0, yb + 0.5, 1.4 - i * 0.2, k * x1, y1 - 0.5 + i * 0.25, 1.9 - i * 0.2, EAR, { bv: 0.05 });
    });
  }
  if (o.hood) {
    const HD = BRD;
    B.b('head', -5.2, 4.4, -4.7, 5.2, 10.0, 4.2, BR);
    B.b('head', -5.2, -0.6, -4.7, -4.2, 6, 4.2, BR);
    B.b('head', 4.2, -0.6, -4.7, 5.2, 6, 4.2, BR);
    B.b('head', -5.2, -0.6, -4.9, 5.2, 9.6, -3.8, BR);
    B.b('head', -5.6, 8.8, 3.4, 5.6, 10.4, 5.9, BRD, { bv: 0.15 }); // hood brim over the eyes
    B.speck('head', [-5.2, -0.6, -4.9, 5.2, 10.0, 4.2], [HD, BRL, BR], 30, 17, { size: 1.1, faces: 'tblr' });
    // ears poke out through the hood: reuse ear steps (already outside x 5.2)
  }
  // ---------------------------------------------------------------- limbs
  for (const s of ['L', 'R']) {
    const k = s === 'L' ? 1 : -1;
    const arm = 'arm' + s;
    const fore = 'fore' + s;
    const leg = 'leg' + s;
    const shin = 'shin' + s;
    B.b(arm, -1.4, -4.8, -1.4, 1.4, 1.2, 1.4, G);
    B.speck(arm, [-1.4, -4.8, -1.4, 1.4, 1.2, 1.4], skin, 5, 21 + k, { size: 0.8 });
    B.b(fore, -1.35, -4.4, -1.35, 1.35, 0.4, 1.35, G);
    B.b(fore, -1.5, -3.4, -1.5, 1.5, -2.0, 1.5, BR, { bv: 0.08 }); // wrist wrap
    B.b(fore, -1.6, -6.6, -1.6, 1.6, -4.2, 1.6, GD); // fist
    B.b(fore, -1.3, -6.8, 1.0, 1.3, -5.0, 1.75, G, { bv: 0.1 });
    B.b(leg, -1.7, -5.0, -1.7, 1.7, 0.6, 1.7, G);
    B.speck(leg, [-1.7, -5.0, -1.7, 1.7, 0.6, 1.7], skin, 5, 31 + k, { size: 0.8 });
    B.b(shin, -1.6, -4.0, -1.6, 1.6, 0.4, 1.6, G);
    B.b(shin, -1.85, -2.6, -1.85, 1.85, -0.2, 1.85, BR, { bv: 0.1 });
    B.b(shin, -1.8, -1.3, -1.8, 1.8, -0.6, 1.8, BRD, { bv: 0.06 });
    B.b(shin, -1.9, -5.0, -2.0, 1.9, -3.2, 2.2, BOOT);
    B.b(shin, -1.7, -5.0, 2.0, 1.7, -3.9, 3.4, G, { bv: 0.12 }); // bare toes
    for (const x of [-1.1, 0, 1.1]) B.b(shin, x - 0.35, -5.0, 3.0, x + 0.35, -4.1, 3.55, GD, { bv: 0 });
    void IRON_D;
  }
}

export const GOBLIN_DIMS = { hipY: 8.6, hipX: 1.9, thigh: 5, torso: 3, shoulderY: 4.6, shoulderX: 4.9, neck: 5.6, upperArm: 4.8 };

export function forestGoblin(): MobDef {
  const B = new MobBuilder();
  goblinBody(B);
  const { IRON, IRON_D, BR, BRD, BRL } = GOB;
  // ---------------------------------------------------------------- serrated bone-white sword (fist of foreR, blade along +z)
  const BONE = 0xd2c7b2;
  const BONE_D = 0xa89c88;
  const BONE_L = 0xe4dccb;
  B.b('foreR', -0.9, -6.3, -2.6, 0.9, -4.5, 1.6, BRD, { bv: 0.1 }); // grip through the fist
  B.b('foreR', -2.6, -6.2, 1.5, 2.6, -4.6, 2.6, BR, { bv: 0.15 }); // guard
  B.b('foreR', -1.4, -5.85, 2.6, 1.4, -4.95, 14.5, BONE);
  B.b('foreR', -0.4, -5.95, 3.0, 0.4, -4.85, 13.5, BONE_D, { bv: 0 }); // fuller
  B.b('foreR', -0.9, -5.85, 14.4, 0.9, -4.95, 16, BONE_L);
  for (let i = 0; i < 6; i++) {
    const z = 3.6 + i * 1.8;
    B.b('foreR', 1.3, -5.8, z, 2.0, -5.0, z + 0.9, i % 2 ? BONE_D : BONE, { bv: 0 });
    B.b('foreR', -2.0, -5.8, z + 0.9, -1.3, -5.0, z + 1.8, i % 2 ? BONE : BONE_D, { bv: 0 });
  }
  // ---------------------------------------------------------------- plank shield with an iron rim (its own bone on the left forearm)
  B.b('shield', -4.5, -7, -0.5, 4.5, 7, 0.5, BR);
  for (let i = 0; i < 4; i++) B.b('shield', -3.6 + i * 1.9, -6.4, 0.3, -2.0 + i * 1.9, 6.4, 0.75, i % 2 ? BRL : BR, { bv: 0.05 });
  B.b('shield', -4.9, 6.2, -0.7, 4.9, 7.6, 1.0, IRON);
  B.b('shield', -4.9, -7.6, -0.7, 4.9, -6.2, 1.0, IRON);
  B.b('shield', 3.9, -7.6, -0.7, 5.0, 7.6, 1.0, IRON_D);
  B.b('shield', -5.0, -7.6, -0.7, -3.9, 7.6, 1.0, IRON_D);
  B.b('shield', -0.4, -0.8, 0.6, 1.6, 1.4, 1.4, 0x8a8892, { bv: 0.15 }); // boss plate
  B.speck('shield', [-5, -7.6, -0.7, 5, 7.6, 1.0], [IRON_D, 0x6a6672], 10, 41, { size: 0.6, faces: 'f' });
  B.b('shield', -1, -1, -1.6, 1, 1, -0.4, BRD); // handle
  void BRD;

  const pose = {
    hips: [6, 0, 0] as [number, number, number],
    chest: [8, -6, 0] as [number, number, number],
    head: [-6, 8, 0] as [number, number, number],
    armR: [-35, 0, -28] as [number, number, number],
    foreR: [-62, 0, 0] as [number, number, number],
    armL: [-24, 0, 22] as [number, number, number],
    foreL: [-58, 0, 0] as [number, number, number],
    legL: [-22, 0, 16] as [number, number, number],
    shinL: [26, 0, -10] as [number, number, number],
    legR: [-18, 0, -16] as [number, number, number],
    shinR: [22, 0, 10] as [number, number, number],
  };
  return {
    id: 'mob_forest_goblin',
    scale: MOB_SCALE,
    bones: humanBones(GOBLIN_DIMS, pose, [{ id: 'shield', parent: 'foreL', at: [2.2, -6.0, 2.6], r: [78, 0, 0] }]),
    parts: B.parts,
    idle: humanIdle(1, 2.6),
  };
}
