import type { HeroRigDef } from '../../render/rig/HeroRig';
import type { RigPart } from '../../render/rig/shapes';
import type { PoseMap } from '../../render/rig/animTypes';
import { bk, jr } from './blockKit';
import { GRIP, MC_POS_SCALE, MC_SCALE, mcProps, pixelItem, type Side } from './mcKit';

/** Idle stance (also the base the deathblade action clips are authored against). */
export const DEATHBLADE_STANCE: PoseMap = {
  rootPos: [0, -1.3, 0],
  hips: [0, -8, 0],
  legL: [-34, -10, 12], shinL: [50, 0, 0], footL: [-14, 10, 0],
  legR: [2, 12, -12], shinR: [38, 0, 0], footR: [-28, -12, 0],
  spine: [8, 0, 0], chest: [14, 12, 0], head: [-16, -8, 0],
  armL: [-38, 0, 34], foreL: [-48, 0, 0], handL: [10, 16, 0],
  armR: [-16, 0, -42], foreR: [-36, 0, 0], handR: [16, -38, 0],
};

/**
 * Deathblade, a slim swordswoman built as a detailed block model (many small bevelled blocks, no
 * pixel skins): dark leather with crossed crimson straps and a silver ring, a black half-mask with a
 * crimson seam over the nose and mouth, glowing crimson eyes under a swept silver fringe, a high
 * silver ponytail, a layered silver pauldron on the left shoulder, a bare right upper arm, fingerless
 * gloves, thigh straps with buckles, tall black boots with silver toes, a short tattered tail at the
 * waist and a curved crimson-edged blade in each hand.
 */

const SKIN = 0xeac4a6;
const SKIN_D = 0xcca486;
const SKIN_L = 0xf6d6bc;
const HAIR = 0xe2e6ee;
const HAIR_L = 0xf4f6fa;
const HAIR_D = 0xaab2c2;
const LEATHER = 0x2e2836;
const LEATHER_L = 0x463e52;
const LEATHER_D = 0x1c1822;
const CRIMSON = 0xc8243c;
const CRIMSON_D = 0x881628;
const SILVER = 0xc4ccd8;
const SILVER_L = 0xe8eef6;
const SILVER_D = 0x8a92a4;
const EYE = 0xff2a44;
const SOLE = 0x120e16;

export function deathbladeRig(): HeroRigDef {
  const pr = mcProps(true);
  const P: RigPart[] = [];
  const add = (...a: RigPart[]) => P.push(...a);

  // ---------------------------------------------------------------- head: face, half-mask, glowing eyes
  add(bk('head', -3.4, 0.2, -3.2, 3.4, 6.6, 3.6, SKIN));
  add(bk('head', -1.4, -1.2, -1.4, 1.4, 0.6, 1.4, LEATHER_D));
  for (const k of [-1, 1]) {
    add(bk('head', k * 0.8, 3.7, 3.45, k * 2.7, 4.5, 3.8, 0x3a1018, { bv: 0 }));
    add(bk('head', k * 1.0, 3.85, 3.7, k * 2.4, 4.35, 3.95, EYE, { g: true, bv: 0 }));
    add(bk('head', k * 0.8, 4.7, 3.45, k * 2.8, 5.1, 3.85, HAIR_D, { bv: 0.06, r: [0, 0, k * -8] }));
  }
  // half-mask: nose to chin, wrapping the cheeks, crimson seam, silver studs
  add(bk('head', -3.6, 0.0, 1.0, 3.6, 3.4, 4.1, LEATHER_D));
  add(bk('head', -3.0, 2.9, 3.8, 3.0, 3.5, 4.2, LEATHER_L, { bv: 0.08 }));
  add(bk('head', -0.25, 0.3, 4.0, 0.25, 3.0, 4.3, CRIMSON, { bv: 0 }));
  for (const k of [-1, 1]) add(bk('head', k * 0.9, 2.7, 4.0, k * 1.5, 3.3, 4.3, SILVER, { bv: 0 }));
  // silver hair: crown, back, a swept fringe falling over the right eye
  add(bk('head', -4.0, 6.0, -4.0, 4.0, 8.4, 4.0, HAIR));
  add(bk('head', -4.0, 0.8, -4.2, 4.0, 6.4, -2.6, HAIR));
  for (const k of [-1, 1]) add(bk('head', k * 3.3, 3.0, -4.0, k * 4.1, 6.4, 2.4, HAIR, { bv: 0.12 }));
  const fringe = [2.6, 2.2, 1.8, 1.0, 0.6, 0.6, 0.8, 1.4];
  for (let i = 0; i < 8; i++) add(bk('head', 4 - i - 1, 6.2 - fringe[i], 3.2, 4 - i, 6.6, 4.3, i % 2 ? HAIR_L : HAIR, { bv: 0.1 }));
  add(bk('head', -4.2, 2.6, 2.2, -3.2, 6.0, 4.0, HAIR_D, { bv: 0.12 }));
  for (let i = 0; i < 4; i++) add(bk('head', -3.6 + i * 1.9, 8.2, -3.0 + jr(i) * 2, -2.0 + i * 1.9, 8.8, 2.6, HAIR_L, { bv: 0.12 }));
  // high ponytail on accA with crimson and silver ties
  add(bk('head', -1.2, 7.6, -4.8, 1.2, 9.4, -3.4, HAIR, { bv: 0.2 }));
  add(bk('accA', -1.1, -8.6, -1.4, 1.1, 0.4, 0.6, HAIR, { r: [16, 0, 0], bv: 0.2 }));
  add(bk('accA', -0.8, -9.6, -1.1, 0.8, -7.6, 0.3, HAIR_D, { r: [16, 0, 0], bv: 0.2 }));
  add(bk('accA', -1.25, -0.6, -1.55, 1.25, 0.4, 0.75, CRIMSON, { r: [16, 0, 0], bv: 0.1 }));
  add(bk('accA', -1.2, -1.4, -1.5, 1.2, -0.6, 0.7, SILVER, { r: [16, 0, 0], bv: 0.1 }));
  add(bk('accA', -0.3, -6.0, -1.45, 0.3, -2.0, 0.65, HAIR_L, { r: [16, 0, 0], bv: 0 }));

  // ---------------------------------------------------------------- chest: leather, high collar, crossed straps, silver ring
  add(bk('chest', -3.9, 0, -2.0, 3.9, 8.0, 2.0, LEATHER));
  add(bk('chest', -2.8, 7.0, -2.4, 2.8, 9.4, 2.4, LEATHER_L, { bv: 0.2 })); // collar
  add(bk('chest', -2.9, 9.0, -2.5, 2.9, 9.5, 2.5, LEATHER_D, { bv: 0.08 }));
  add(bk('chest', -3.0, 3.0, 1.8, 3.0, 6.6, 2.3, LEATHER_L, { bv: 0.25 })); // bust plate
  for (const k of [-1, 1]) add(bk('chest', k * 3.4, 0, -2.2, k * 4.2, 7.6, 2.2, LEATHER_D, { bv: 0.12 }));
  for (let i = 0; i < 8; i++) {
    const y = 7.4 - i * 0.95;
    const x = -3.4 + i * 0.95;
    for (const [sx, z0, z1, c] of [[1, 2.25, 2.7, CRIMSON], [-1, 2.25, 2.7, CRIMSON], [1, -2.7, -2.25, CRIMSON_D], [-1, -2.7, -2.25, CRIMSON_D]] as const) {
      add(bk('chest', sx * x - 0.55, y - 0.5, z0, sx * x + 0.55, y + 0.5, z1, c, { bv: 0.06 }));
    }
  }
  add(bk('chest', -1.0, 3.2, 2.6, 1.0, 5.2, 3.0, SILVER, { bv: 0.15 })); // ring
  add(bk('chest', -0.45, 3.75, 2.85, 0.45, 4.65, 3.1, LEATHER_D, { bv: 0 }));
  add(bk('spine', -3.6, 0.9, -1.9, 3.6, 3.9, 1.9, LEATHER));
  add(bk('spine', -3.7, 0.9, 1.6, 3.7, 3.4, 2.2, LEATHER_L, { bv: 0.12 }));
  for (const k of [-1, 1]) add(bk('spine', k * 3.2, 0.9, -2.1, k * 3.9, 3.9, 2.1, LEATHER_D, { bv: 0.1 }));

  // ---------------------------------------------------------------- hips: crimson belt with silver buckles
  add(bk('hips', -4.0, -0.6, -2.1, 4.0, 3.0, 2.1, LEATHER_D));
  add(bk('hips', -4.2, 1.8, -2.4, 4.2, 2.8, 2.4, CRIMSON_D));
  add(bk('hips', -1.0, 1.6, 2.3, 1.0, 3.0, 2.75, SILVER, { bv: 0.1 }));
  add(bk('hips', -0.5, 2.0, 2.6, 0.5, 2.6, 2.85, LEATHER_D, { bv: 0 }));
  add(bk('hips', 2.2, -1.6, 2.0, 3.8, 2.0, 2.6, LEATHER_L, { bv: 0.12, r: [0, 0, -8] })); // hip flap
  // short tattered tail (capeA spring at the back of the hips)
  for (let i = 0; i < 6; i++) {
    const x = -3 + i;
    const len = 3.6 + jr(i + 2) * 2.0;
    add(bk('capeA', x, -len, -0.5, x + 1, 0.2, 0.2, i % 2 ? LEATHER_L : LEATHER, { bv: 0.06 }));
  }
  add(bk('capeA', -3.2, -0.6, -0.65, 3.2, 0.4, 0.4, CRIMSON_D, { bv: 0.1 }));

  // ---------------------------------------------------------------- limbs, mirrored (slim arms: 3 wide)
  for (const s of ['L', 'R'] as Side[]) {
    const k = s === 'L' ? 1 : -1;
    const arm = 'arm' + s;
    const fore = 'fore' + s;
    const hand = 'hand' + s;
    const leg = 'leg' + s;
    const shin = 'shin' + s;
    const foot = 'foot' + s;
    if (s === 'R') {
      // bare upper arm with a leather shoulder cap
      add(bk(arm, -1.5, -5.0, -1.5, 1.5, 2.0, 1.5, SKIN));
      add(bk(arm, -1.7, 0.4, -1.7, 1.7, 2.2, 1.7, LEATHER, { bv: 0.2 }));
      add(bk(arm, -1.4, -3.6, 1.3, -0.2, -1.2, 1.65, SKIN_L, { bv: 0.12 }));
    } else {
      add(bk(arm, -1.5, -5.0, -1.5, 1.5, 2.0, 1.5, LEATHER));
      // layered silver pauldron with a crimson edge
      add(bk(arm, -2.0, 0.0, -2.6, 3.2, 3.0, 2.6, SILVER, { bv: 0.3, r: [0, 0, -10] }));
      add(bk(arm, -1.4, 2.6, -2.0, 2.4, 3.5, 2.0, SILVER_L, { bv: 0.2, r: [0, 0, -10] }));
      add(bk(arm, -2.1, -0.2, -2.7, 3.3, 0.4, 2.7, CRIMSON, { bv: 0.08, r: [0, 0, -10] }));
      add(bk(arm, -0.9, -1.6, -2.4, 3.2, 0.0, 2.4, SILVER_D, { bv: 0.2, r: [0, 0, -10] }));
      add(bk(arm, -0.8, -1.75, -2.45, 3.3, -1.4, 2.45, LEATHER_D, { bv: 0 , r: [0, 0, -10] }));
    }
    add(bk(arm, -1.6, -1.4, -1.6, 1.6, -0.9, 1.6, CRIMSON, { bv: 0.06 })); // arm band
    add(bk(arm, -1.6, -5.0, -1.6, 1.6, -4.4, 1.6, CRIMSON, { bv: 0.06 }));
    // fingerless glove reaching up the forearm, silver rim, crimson stitch
    add(bk(fore, -1.5, -3.0, -1.5, 1.5, 1.0, 1.5, LEATHER));
    add(bk(fore, -1.7, -3.0, -1.7, 1.7, -0.2, 1.7, LEATHER_L));
    add(bk(fore, -1.75, -0.4, -1.75, 1.75, 0.1, 1.75, SILVER_D, { bv: 0.06 }));
    add(bk(fore, k * 1.6, -2.2, -0.4, k * 1.85, -1.4, 0.4, CRIMSON, { bv: 0 }));
    add(bk(hand, -1.5, -2.0, -1.5, 1.5, 1.0, 1.5, LEATHER_D));
    add(bk(hand, -1.3, -2.15, 1.0, 1.3, -1.2, 1.7, SKIN_D, { bv: 0.1 })); // bare fingers
    // leggings, thigh strap with a buckle
    add(bk(leg, -2.0, -6.0, -2.0, 2.0, 0.2, 2.0, LEATHER));
    add(bk(leg, -2.1, -2.6, -2.1, 2.1, -1.9, 2.1, CRIMSON_D, { bv: 0.06 }));
    add(bk(leg, k * 0.5, -2.75, 1.9, k * 1.5, -1.75, 2.35, SILVER, { bv: 0.06 }));
    add(bk(leg, k * 0.6, -5.4, -1.6, k * 2.1, -0.8, 1.6, LEATHER_L, { bv: 0.15 }));
    // tall black boots with a folded top and silver toe
    add(bk(shin, -1.95, -1.0, -1.95, 1.95, 1.0, 1.95, LEATHER));
    add(bk(shin, -2.1, -5.0, -2.1, 2.1, -0.4, 2.1, LEATHER_D));
    add(bk(shin, -2.3, -1.0, -2.3, 2.3, 0.0, 2.3, LEATHER_L, { bv: 0.15 }));
    add(bk(shin, -1.4, -0.6, 2.1, 1.4, 1.3, 2.6, LEATHER_L, { bv: 0.2 })); // knee guard
    add(bk(shin, -0.25, -4.2, 2.0, 0.25, -1.4, 2.25, CRIMSON_D, { bv: 0 }));
    add(bk(foot, -2.0, -1.0, -2.2, 2.0, 0.6, 3.0, LEATHER_D));
    add(bk(foot, -1.6, -0.6, 2.6, 1.6, 0.4, 3.6, SILVER_D, { bv: 0.2 }));
    add(bk(foot, -1.0, -0.3, 3.4, 1.0, 0.3, 3.8, SILVER, { bv: 0.1 }));
    add(bk(foot, -2.1, -1.0, -2.3, 2.1, -0.65, 3.4, SOLE, { bv: 0.06 }));
    add(bk(foot, -1.0, -1.0, -2.4, 1.0, -0.2, -1.6, SOLE, { bv: 0.06 })); // heel
  }

  // ---------------------------------------------------------------- curved blades: along +z, bending toward +y, glowing edge on -y
  function blade(b: 'gripL' | 'gripR'): RigPart[] {
    const rows = [
      '.....e',
      '....es',
      '....es',
      '...esm',
      '...esm',
      '..esm.',
      '..esm.',
      '.esmm.',
      '.esm..',
      '.esm..',
      '.esm..',
      'GgrgG.',
      '.obo..',
      '.obo..',
      '..G...',
    ];
    return pixelItem(rows, { e: CRIMSON, s: SILVER, m: SILVER_D, g: SILVER, G: SILVER_D, o: LEATHER_D, b: CRIMSON_D, r: CRIMSON }, { b, at: GRIP, pivot: [2, 12.5], px: 0.95, th: 0.5, u: '+y', v: '+z', glow: 'er', thick: { G: 1.6, g: 1.6, o: 1.4, b: 1.4 } });
  }
  add(...blade('gripL'), ...blade('gripR'));

  return {
    id: 'deathblade',
    scale: MC_SCALE,
    posScale: MC_POS_SCALE,
    props: pr,
    parts: P,
    springs: {
      accA: { parent: 'head', at: [0, 8.2, -4.6], kind: 'bob', k: 0.85, rest: -14 },
      capeA: { parent: 'hips', at: [0, 2.4, -2.5], kind: 'cape', k: 1.0 },
    },
    tip: { bone: 'gripR', p: [GRIP[0], GRIP[1] + 3 * 0.95, GRIP[2] + 12 * 0.95] },
    grip: { L: { at: GRIP, rot: [-20, 0, 0] }, R: { at: GRIP, rot: [-20, 0, 0] } },
    anim: {
      weapon: 'sword',
      gait: { cadence: 0.62, stride: 42, knee: 72, armSwing: 16, elbow: 40, bounce: 0.5, lean: 20, sway: 2, twist: 10, heavy: 0, headBob: 0.6, armOut: 14, idle: 1.0 },
      stance: DEATHBLADE_STANCE,
      stanceRun: 0.45,
      victory: 'cheer',
    },
  };
}
