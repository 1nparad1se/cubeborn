import { humanBones, humanIdle, MOB_SCALE, MobBuilder, type MobDef } from './mobKit';

/**
 * Forest troll (Лесной тролль): a hunched stone giant overgrown with bright moss, a shaggy mane of
 * moss and roots over the head and back with twigs sticking out, a grey face with glowing green eyes,
 * a jutting jaw, huge stone arms and fists, a bark loincloth, and a thick log club.
 */

const S = 0x8a898c;
const SL = 0xa4a3a6;
const SD = 0x66656b;
const SDD = 0x46454c;
const MOSS = 0x8cc43a;
const MOSS_L = 0xb2dc44;
const MOSS_D = 0x5e8e28;
const MOSS_DD = 0x46701e;
const BARK = 0x7a4a22;
const BARK_D = 0x553216;
const WOOD = 0x8a5022;
const WOOD_L = 0xa86a30;
const WOOD_D = 0x6a3e18;
const EYE = 0x3cff3c;

export function forestTroll(): MobDef {
  const B = new MobBuilder();
  const mossC = [MOSS, MOSS_L, MOSS_D, MOSS_DD, MOSS_L];
  const stoneC = [SL, SD, S, SDD];
  // ---------------------------------------------------------------- hips, bark belt, loincloth
  B.b('hips', -6.2, -1.5, -4.2, 6.2, 5, 4.2, SD);
  B.b('hips', -6.6, 3.6, -4.6, 6.6, 6, 4.6, BARK);
  B.speck('hips', [-6.6, 3.6, -4.6, 6.6, 6, 4.6], [BARK_D, MOSS, WOOD_D], 12, 3, { size: 1 });
  B.fringe('hips', -3.6, 3.6, 4.4, 4.3, 0.7, 10, [BARK, BARK_D, WOOD_D, MOSS_D], 5, 1.2);
  B.fringe('hips', -5, 5, 4.4, -4.9, 0.7, 7, [BARK, BARK_D], 7, 1.4);
  // ---------------------------------------------------------------- chest: stone torso under the moss mane
  B.b('chest', -8, -1, -5.5, 8, 12, 5.5, S);
  B.b('chest', -7, 1, 5, 7, 9, 6.2, SD); // belly plate
  B.speck('chest', [-8, -1, -5.5, 8, 12, 5.5], stoneC, 26, 9, { size: 1.6 });
  B.b('chest', -9, 8, -7.5, 9, 15.5, 5.5, MOSS); // mane
  B.b('chest', -7.5, 14, -6.5, 7.5, 17.5, 4, MOSS_L);
  B.b('chest', -8.5, 2, -7.6, 8.5, 9, -5, MOSS_D); // moss down the back
  B.speck('chest', [-9, 8, -7.5, 9, 17.5, 5.5], mossC, 140, 11, { size: 1.8, out: 1.0 });
  B.b('chest', -7.5, 3, 5.4, 7.5, 9.5, 6.6, MOSS_D); // moss draped over the chest
  B.speck('chest', [-7.5, 3, 5.4, 7.5, 9.5, 6.6], mossC, 40, 12, { size: 1.6, out: 0.8, faces: 'f' });
  B.fringe('chest', -7.5, 7.5, 3.5, 6.0, 0.8, 5, [MOSS, MOSS_L, MOSS_D, BARK], 14, 1.1);
  B.speck('chest', [-8.5, 2, -7.6, 8.5, 9, -5], mossC, 30, 13, { size: 1.5, out: 0.6, faces: 'blr' });
  B.fringe('chest', -9, 9, 9, 5.4, 0.8, 6, [MOSS, MOSS_D, BARK, MOSS_L], 15, 1.2);
  B.fringe('chest', -9, 9, 3, -7.9, 0.8, 5, [MOSS_D, MOSS, BARK_D], 17, 1.2);
  B.fringe('chest', -5.5, 5.5, 8.5, -5.5, 0.8, 7, [MOSS, MOSS_D], 18, 1.4, 'z');
  B.fringe('chest', -5.5, 5.5, 8.5, 8.9, 0.8, 7, [MOSS, MOSS_D], 19, 1.4, 'z');
  B.speck('chest', [-7, -1, 5, 7, 9, 6.2], [MOSS, MOSS_D, BARK], 14, 21, { size: 1.3, faces: 'f' });
  // twigs
  for (const [x, z, h] of [[-5, -2, 4], [4.5, -3, 5], [1, 1, 3.5], [-2, -5, 3]] as [number, number, number][]) {
    B.b('chest', x - 0.4, 17, z - 0.4, x + 0.4, 17 + h, z + 0.4, BARK, { bv: 0 });
    B.b('chest', x - 0.3, 16 + h, z - 0.3, x + 1.6, 16.7 + h, z + 0.3, BARK_D, { bv: 0 });
  }
  // ---------------------------------------------------------------- head: low, forward, half buried in moss
  B.b('head', -4.8, -3, -2, 4.8, 6, 8, S);
  B.b('head', -4.2, 2.6, 7.8, 4.2, 4.0, 8.6, SDD, { bv: 0.1 }); // heavy brow
  for (const k of [-1, 1]) {
    B.b('head', k * 1.0, 1.0, 7.8, k * 3.4, 2.6, 8.3, 0x1a3a1a, { bv: 0 });
    B.b('head', k * 1.4, 1.3, 8.1, k * 3.0, 2.3, 8.45, EYE, { g: true, bv: 0 });
  }
  B.b('head', -1.0, -0.4, 7.8, 1.0, 2.0, 9.2, SL, { bv: 0.2 }); // nose
  B.b('head', -4.4, -4.6, 1, 4.4, -1, 9.4, SL); // jutting jaw
  B.b('head', -3.4, -2.4, 9.2, 3.4, -1.4, 9.6, SDD, { bv: 0 }); // mouth line
  for (const k of [-1, 1]) B.b('head', k * 2.2, -1.8, 9.0, k * 3.4, 0.2, 9.8, 0xe8e2cf, { bv: 0.1 }); // tusks
  B.speck('head', [-4.8, -4.6, -2, 4.8, 6, 9.4], [S, SD, SL, MOSS_D], 18, 23, { size: 1, faces: 'lrf' });
  B.b('head', -5.6, 4.4, -3, 5.6, 8, 7.4, MOSS); // moss cap
  B.speck('head', [-5.6, 4.4, -3, 5.6, 8, 7.4], mossC, 30, 25, { size: 1.4, out: 0.7 });
  B.fringe('head', -5.6, 5.6, 5, 7.0, 0.7, 3, [MOSS, MOSS_L, MOSS_D], 27, 1);
  B.fringe('head', -4, 4, -4.4, 8.6, 0.8, 5, [BARK, MOSS_D, BARK_D, MOSS], 29, 1); // beard
  // ---------------------------------------------------------------- limbs
  for (const s of ['L', 'R']) {
    const k = s === 'L' ? 1 : -1;
    const arm = 'arm' + s;
    const fore = 'fore' + s;
    const leg = 'leg' + s;
    const shin = 'shin' + s;
    B.b(arm, -3.8, -9.6, -3.8, 3.8, 2.4, 3.8, S);
    B.b(arm, -4.4, -2, -4.4, 4.4, 3.2, 4.4, SL); // shoulder boulder
    B.speck(arm, [-4.4, -9.6, -4.4, 4.4, 3.2, 4.4], stoneC, 14, 31 + k, { size: 1.4 });
    B.b(arm, -4.8, -1, -4.8, 4.8, 3.8, 4.8, MOSS);
    B.speck(arm, [-4.8, -4, -4.8, 4.8, 3.8, 4.8], mossC, 46, 33 + k, { size: 1.6, out: 0.8, faces: 'tlrbf' });
    B.fringe(arm, -4.8, 4.8, -0.8, 4.4, 0.6, 4, [MOSS, MOSS_D, MOSS_L], 34 + k, 1);
    B.fringe(arm, -4.8, 4.8, -0.8, k * 4.4 - (k < 0 ? 0.6 : 0), 0.6, 4, [MOSS, MOSS_D], 36 + k, 1, 'z');
    B.b(fore, -4.4, -9.5, -4.4, 4.4, 0.6, 4.4, S);
    B.b(fore, -4.6, -4.2, -4.6, 4.6, -2.6, 4.6, SD); // crack band
    B.speck(fore, [-4.4, -9.5, -4.4, 4.4, 0.6, 4.4], [MOSS, MOSS_L, MOSS_D, SL, SD, MOSS], 40, 35 + k, { size: 1.5, out: 0.6 });
    B.b(fore, -4.2, -14, -4.2, 4.2, -9.2, 4.2, SDD); // fist
    B.b(fore, -3.8, -14.4, 2.6, 3.8, -11.4, 4.6, SD, { bv: 0.2 }); // knuckles
    B.speck(fore, [-4.2, -14, -4.2, 4.2, -9.2, 4.2], [SD, S], 6, 37 + k, { size: 1 });
    B.b(leg, -3.4, -7, -3.4, 3.4, 0.8, 3.4, SD);
    B.speck(leg, [-3.4, -7, -3.4, 3.4, 0.8, 3.4], [S, SDD, MOSS_D], 10, 41 + k, { size: 1.3 });
    B.b(shin, -3.6, -5.5, -3.6, 3.6, 0.6, 3.6, S);
    B.speck(shin, [-3.6, -5.5, -3.6, 3.6, 0.6, 3.6], [MOSS, MOSS_L, SL, SD], 14, 43 + k, { size: 1.3, out: 0.5 });
    B.b(shin, -4.2, -8.6, -4.6, 4.2, -5.2, 5.4, SD); // stone foot
    B.b(shin, -4.0, -8.8, -4.8, 4.0, -7.8, 5.6, SDD, { bv: 0.1 });
    B.speck(shin, [-4.2, -8.6, -4.6, 4.2, -5.2, 5.4], [MOSS, MOSS_L, MOSS_D], 12, 45 + k, { size: 1.3, faces: 'tf', out: 0.6 });
  }
  // ---------------------------------------------------------------- log club in the left fist (along +z out of the fist)
  B.b('club', -2.6, -2.6, -3, 2.6, 2.6, 9, WOOD_D);
  B.b('club', -3.8, -3.8, 8, 3.8, 3.8, 24, WOOD);
  B.b('club', -3.4, -3.4, 23.8, 3.4, 3.4, 24.8, WOOD_L); // cut end
  B.b('club', -1.6, -1.6, 24.6, 1.6, 1.6, 25, WOOD_D, { bv: 0 });
  B.speck('club', [-3.8, -3.8, 8, 3.8, 3.8, 24], [WOOD_D, WOOD_L, BARK, WOOD], 70, 51, { size: 1.2, faces: 'tdlr' });
  B.speck('club', [-2.6, -2.6, -3, 2.6, 2.6, 9], [BARK, BARK_D], 10, 53, { size: 1, faces: 'tdlr' });

  const pose = {
    hips: [8, 0, 0] as [number, number, number],
    chest: [20, 0, 0] as [number, number, number],
    head: [-26, 0, 0] as [number, number, number],
    armL: [-30, 0, 16] as [number, number, number],
    foreL: [-38, 0, 0] as [number, number, number],
    armR: [-8, 0, -18] as [number, number, number],
    foreR: [-18, 0, 0] as [number, number, number],
    legL: [-16, 0, 12] as [number, number, number],
    shinL: [20, 0, -10] as [number, number, number],
    legR: [-12, 0, -12] as [number, number, number],
    shinR: [16, 0, 10] as [number, number, number],
  };
  return {
    id: 'mob_forest_troll',
    scale: MOB_SCALE,
    bones: humanBones(
      { hipY: 14.5, hipX: 4.6, thigh: 6.8, torso: 5.5, shoulderY: 10.5, shoulderX: 11, neck: 12.5, upperArm: 9.4 },
      pose,
      [{ id: 'club', parent: 'foreL', at: [0, -11.5, 0], r: [10, -14, 0] }],
    ),
    parts: B.parts,
    idle: humanIdle(1.3, 3.6),
  };
}
