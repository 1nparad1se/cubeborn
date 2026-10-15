import type { HeroRigDef } from '../../render/rig/HeroRig';
import type { RigPart } from '../../render/rig/shapes';
import type { PoseMap } from '../../render/rig/animTypes';
import { bk, jr } from './blockKit';
import { MC_POS_SCALE, MC_SCALE, mcProps, type Side } from './mcKit';

/** Idle stance (also the base the steelfist action clips are authored against). */
export const STEELFIST_STANCE: PoseMap = {
  rootPos: [0, -0.7, 0],
  hips: [0, -14, 0],
  legL: [-22, -10, 5], shinL: [20, 0, 0], footL: [2, 10, 0],
  legR: [14, 14, -7], shinR: [22, 0, 0], footR: [-12, -14, 0],
  spine: [4, 4, 0], chest: [6, 18, 0], head: [-6, -14, 0],
  // lead (left) fist forward at chin height, rear fist guarding the jaw
  armL: [-58, -6, 16], foreL: [-64, 0, 0], handL: [18, 0, 0],
  armR: [-38, 8, -26], foreR: [-112, 0, 0], handR: [8, 0, 0],
};

/**
 * Steel Fist, a martial artist built as a detailed block model (many small bevelled blocks, no
 * pixel skins): a black topknot and a crimson headband with trailing tails, an open sleeveless cream
 * gi with dark trim over a bare chest, a crimson sash with long tails, dark wide trousers with white
 * shin wraps and dark slippers, and two oversized steel gauntlets with studded knuckles, gold rims
 * and glowing cyan chi cores on the backs of the fists.
 */

const SKIN = 0xc68a5e;
const SKIN_L = 0xd89e72;
const SKIN_D = 0xa87048;
const HAIR = 0x1e1a22;
const HAIR_L = 0x342e3a;
const GI = 0xeee4cc;
const GI_L = 0xfaf2de;
const GI_D = 0xc9bc9e;
const TRIM = 0x2a2c38;
const PANTS = 0x343a52;
const PANTS_L = 0x444b66;
const PANTS_D = 0x242838;
const CRIMSON = 0xc42a3c;
const CRIMSON_L = 0xdc3c4c;
const CRIMSON_D = 0x8a1a28;
const STEEL = 0xa4b0c2;
const STEEL_L = 0xdce4ee;
const STEEL_D = 0x5a6476;
const STEEL_K = 0x3e4656;
const GOLD = 0xe8b844;
const CHI = 0x5ad8ff;
const CHI_L = 0xd8f8ff;
const SHOE = 0x2a2422;

export function steelfistRig(): HeroRigDef {
  const pr = mcProps();
  const P: RigPart[] = [];
  const add = (...a: RigPart[]) => P.push(...a);

  // ---------------------------------------------------------------- head
  add(bk('head', -3.6, 0.2, -3.4, 3.6, 6.6, 3.6, SKIN));
  add(bk('head', -1.6, -1.2, -1.6, 1.6, 0.6, 1.6, SKIN_D));
  add(bk('head', -3.0, 0.2, 2.9, 3.0, 1.2, 3.75, SKIN_D, { bv: 0.1 })); // jaw
  add(bk('head', -0.6, 2.2, 3.5, 0.6, 3.6, 4.05, SKIN_D, { bv: 0.1 })); // nose
  add(bk('head', -1.1, 1.3, 3.55, 1.1, 1.7, 3.85, 0x8a4a3a, { bv: 0 })); // mouth
  for (const k of [-1, 1]) {
    add(bk('head', k * 0.7, 4.5, 3.45, k * 2.9, 5.1, 3.95, HAIR, { bv: 0.08, r: [0, 0, k * -6] })); // angled brows
    add(bk('head', k * 0.9, 3.7, 3.45, k * 2.6, 4.4, 3.75, 0xf2ece4, { bv: 0 }));
    add(bk('head', k * 0.9, 3.7, 3.6, k * 1.6, 4.4, 3.85, 0x3a2414, { bv: 0 }));
    add(bk('head', k * 3.4, 2.6, -0.4, k * 3.9, 4.0, 0.8, SKIN_D, { bv: 0.1 })); // ears
  }
  // short black hair slicked back
  add(bk('head', -3.9, 5.8, -3.9, 3.9, 8.2, 3.9, HAIR));
  add(bk('head', -3.9, 1.6, -3.9, 3.9, 6.2, -2.4, HAIR));
  for (const k of [-1, 1]) add(bk('head', k * 3.2, 3.6, -3.9, k * 3.95, 6.2, 2.6, HAIR, { bv: 0.12 }));
  for (let i = 0; i < 7; i++) add(bk('head', -3.5 + i, 6.4 + (i % 2) * 0.3, 3.4, -2.5 + i, 7.8, 4.1, i % 2 ? HAIR_L : HAIR, { bv: 0.1 }));
  for (let i = 0; i < 4; i++) add(bk('head', -3.6 + i * 1.8, 8.0, -3.4 + (i % 2), -2.0 + i * 1.8, 8.5, 3.2, HAIR_L, { bv: 0.1 }));
  // topknot with a crimson tie
  add(bk('head', -1.1, 8.2, -2.2, 1.1, 10.2, 0.0, HAIR, { bv: 0.25 }));
  add(bk('head', -0.8, 10.0, -1.9, 0.8, 11.0, -0.3, HAIR_L, { bv: 0.2 }));
  add(bk('head', -1.25, 8.6, -2.35, 1.25, 9.2, 0.15, CRIMSON, { bv: 0.08 }));
  // crimson headband with a gold plate, knot at the back
  add(bk('head', -4.15, 5.6, -4.15, 4.15, 6.5, 4.15, CRIMSON, { bv: 0.12 }));
  add(bk('head', -4.2, 6.2, -4.2, 4.2, 6.5, 4.2, CRIMSON_L, { bv: 0 }));
  add(bk('head', -0.9, 5.7, 4.0, 0.9, 6.4, 4.4, GOLD, { bv: 0.08 }));
  add(bk('head', -1.0, 5.2, -4.8, 1.0, 6.8, -4.0, CRIMSON_D, { bv: 0.15 }));
  // band tails (accC spring at the knot)
  for (const k of [-1, 1]) {
    add(bk('accC', k * 0.1, -4.2, -0.4, k * 1.1, 0.2, 0.4, k > 0 ? CRIMSON : CRIMSON_L, { bv: 0.08 }));
    add(bk('accC', k * 0.15, -4.8, -0.35, k * 0.9, -4.0, 0.35, CRIMSON_D, { bv: 0.06 }));
  }

  // ---------------------------------------------------------------- chest: open gi over a bare chest
  add(bk('chest', -3.9, 0, -2.1, 3.9, 7.8, 2.1, SKIN));
  for (const k of [-1, 1]) {
    add(bk('chest', k * 0.2, 4.0, 1.9, k * 2.6, 6.4, 2.45, SKIN_L, { bv: 0.25 })); // pecs
    add(bk('chest', k * 0.25, 3.6, 2.0, k * 2.5, 4.0, 2.35, SKIN_D, { bv: 0 }));
    add(bk('chest', k * 0.25, 0.4, 2.0, k * 1.6, 1.6, 2.35, SKIN_L, { bv: 0.12 })); // abs
    add(bk('chest', k * 0.25, 1.9, 2.0, k * 1.6, 3.2, 2.35, SKIN_L, { bv: 0.12 }));
    // gi lapels in a V, dark trim
    for (let i = 0; i < 6; i++) {
      const y = 7.8 - i * 1.3;
      const x = k * (1.6 + i * 0.18);
      add(bk('chest', x, y - 1.35, 1.9, k * 4.2, y, 2.7, GI, { bv: 0.1 }));
      add(bk('chest', x - k * 0.45, y - 1.35, 2.3, x + k * 0.15, y, 2.85, TRIM, { bv: 0.05 }));
    }
    add(bk('chest', k * 3.4, 0, -2.4, k * 4.3, 7.8, 2.2, GI, { bv: 0.12 })); // flanks
    add(bk('chest', k * 2.8, 7.2, -2.5, k * 4.4, 8.0, 2.4, GI_L, { bv: 0.15 })); // shoulder seam
  }
  // back of the gi with a crimson ring emblem
  add(bk('chest', -4.2, 0, -2.5, 4.2, 7.9, -1.6, GI));
  add(bk('chest', -2.6, 7.4, -2.6, 2.6, 8.2, -1.4, TRIM, { bv: 0.12 })); // collar
  for (const [x0, y0, x1, y1] of [[-1, 5.2, 1, 5.8], [-1, 2.2, 1, 2.8], [-1.6, 2.8, -1.0, 5.2], [1.0, 2.8, 1.6, 5.2]]) add(bk('chest', x0, y0, -2.75, x1, y1, -2.45, CRIMSON, { bv: 0 }));
  // spine: bare belly in the gi opening
  add(bk('spine', -3.7, 0.9, -2.0, 3.7, 3.9, 2.0, SKIN_D));
  for (const k of [-1, 1]) add(bk('spine', k * 2.2, 0.9, -2.3, k * 4.1, 3.9, 2.5, GI, { bv: 0.12 }));
  add(bk('spine', -4.1, 0.9, -2.4, 4.1, 3.9, -1.6, GI));

  // ---------------------------------------------------------------- hips: crimson sash with a knot, trousers
  add(bk('hips', -4.0, -0.4, -2.2, 4.0, 2.0, 2.2, PANTS));
  add(bk('hips', -4.4, 1.0, -2.6, 4.4, 3.2, 2.6, CRIMSON));
  add(bk('hips', -4.45, 1.0, -2.65, 4.45, 1.5, 2.65, CRIMSON_D, { bv: 0.06 }));
  add(bk('hips', -4.45, 2.7, -2.65, 4.45, 3.2, 2.65, CRIMSON_L, { bv: 0.06 }));
  add(bk('hips', 1.6, 0.8, 2.4, 3.6, 3.4, 3.1, CRIMSON_D, { bv: 0.2 })); // knot
  // sash tails at the left hip (skirtF flap)
  for (let i = 0; i < 3; i++) {
    const x = -1.5 + i;
    const len = 6.0 + jr(i + 3) * 1.4;
    add(bk('skirtF', x, -len, -0.3, x + 1, 0, 0.4, i === 1 ? CRIMSON_D : i ? CRIMSON : CRIMSON_L, { bv: 0.06 }));
  }

  // ---------------------------------------------------------------- limbs, mirrored
  for (const s of ['L', 'R'] as Side[]) {
    const k = s === 'L' ? 1 : -1;
    const arm = 'arm' + s;
    const fore = 'fore' + s;
    const hand = 'hand' + s;
    const leg = 'leg' + s;
    const shin = 'shin' + s;
    const foot = 'foot' + s;
    // bare muscled arm under a short gi cap
    add(bk(arm, -2.0, -5.0, -2.0, 2.0, 2.0, 2.0, SKIN));
    add(bk(arm, -2.2, 0.4, -2.2, 2.2, 2.3, 2.2, GI, { bv: 0.2 }));
    add(bk(arm, -2.25, 0.2, -2.25, 2.25, 0.6, 2.25, TRIM, { bv: 0.06 }));
    add(bk(arm, k * 0.6, -3.6, -1.6, k * 2.2, -0.6, 1.6, SKIN_L, { bv: 0.25 })); // shoulder / bicep
    add(bk(arm, -1.4, -3.4, 1.7, 1.4, -1.0, 2.2, SKIN_L, { bv: 0.2 }));
    // forearm wraps, steel cuff
    add(bk(fore, -1.9, -3.0, -1.9, 1.9, 1.0, 1.9, SKIN));
    for (let i = 0; i < 3; i++) add(bk(fore, -2.05, -1.0 + i * 0.7, -2.05, 2.05, -0.55 + i * 0.7, 2.05, i % 2 ? GI_D : GI, { bv: 0.06, r: [0, 0, 6] }));
    add(bk(fore, -2.5, -3.2, -2.5, 2.5, -1.4, 2.5, STEEL_D, { bv: 0.15 }));
    add(bk(fore, -2.55, -1.6, -2.55, 2.55, -1.2, 2.55, STEEL, { bv: 0.08 }));
    // gauntlet: big steel block, gold rim, studded knuckles toward -y, chi core on the back
    add(bk(hand, -3.0, -3.1, -2.9, 3.0, 1.9, 3.1, STEEL));
    add(bk(hand, -3.15, 1.2, -3.05, 3.15, 2.0, 3.25, GOLD, { bv: 0.12 }));
    add(bk(hand, -2.8, 0.4, -2.8, 2.8, 1.3, 3.2, STEEL_L, { bv: 0.15 }));
    add(bk(hand, -3.1, -3.15, -3.0, 3.1, -2.4, 3.2, STEEL_D, { bv: 0.1 }));
    add(bk(hand, -2.6, -3.5, -2.5, 2.6, -2.9, 2.7, STEEL_K, { bv: 0.1 }));
    for (let i = 0; i < 4; i++) {
      const x = -2.4 + i * 1.35;
      add(bk(hand, x, -3.85, -1.9, x + 1.05, -3.2, 2.2, STEEL_L, { bv: 0.15 })); // knuckle studs
    }
    add(bk(hand, -2.4, -2.2, 3.0, 2.4, 0.2, 3.5, STEEL_L, { bv: 0.2 })); // finger plates
    for (let i = 0; i < 3; i++) add(bk(hand, -2.3, -2.0 + i * 0.75, 3.35, 2.3, -1.75 + i * 0.75, 3.6, STEEL_D, { bv: 0 }));
    add(bk(hand, k * 2.9, -1.6, -1.2, k * 3.5, 0.6, 1.4, STEEL_D, { bv: 0.1 })); // core housing
    add(bk(hand, k * 3.3, -1.3, -0.9, k * 3.75, 0.3, 1.1, CHI, { g: true, bv: 0.08 }));
    add(bk(hand, k * 3.6, -0.9, -0.4, k * 3.85, 0.0, 0.6, CHI_L, { g: true, bv: 0 }));
    // wide dark trousers
    add(bk(leg, -2.2, -6.0, -2.2, 2.2, 0.4, 2.2, PANTS));
    add(bk(leg, k * 0.6, -5.4, -2.3, k * 2.35, -0.8, 2.0, PANTS_L, { bv: 0.2 }));
    add(bk(leg, -1.5, -4.4, 1.9, 0.2, -2.0, 2.4, PANTS_D, { bv: 0.15 })); // folds
    add(bk(shin, -2.2, -2.0, -2.2, 2.2, 1.0, 2.2, PANTS));
    add(bk(shin, -2.3, -0.6, -2.3, 2.3, 0.6, 2.3, PANTS_D, { bv: 0.15 }));
    // white shin wraps, crossed
    add(bk(shin, -1.85, -5.0, -1.85, 1.85, -1.8, 1.85, GI));
    for (let i = 0; i < 4; i++) add(bk(shin, -1.95, -4.8 + i * 0.8, -1.95, 1.95, -4.4 + i * 0.8, 1.95, i % 2 ? GI_D : GI_L, { bv: 0.05, r: [0, 0, (i % 2 ? 7 : -7)] }));
    // dark slipper
    add(bk(foot, -2.0, -1.0, -2.2, 2.0, 0.4, 3.0, SHOE));
    add(bk(foot, -1.8, -0.6, 2.0, 1.8, 0.2, 3.4, 0x3a3230, { bv: 0.2 }));
    add(bk(foot, -2.1, -1.0, -2.3, 2.1, -0.7, 3.2, 0x16121a, { bv: 0.06 }));
  }

  return {
    id: 'steelfist',
    scale: MC_SCALE,
    posScale: MC_POS_SCALE,
    props: pr,
    parts: P,
    springs: {
      accC: { parent: 'head', at: [0, 5.5, -4.6], kind: 'cape', k: 0.75, rest: 12 },
      skirtF: { parent: 'hips', at: [2.6, 2.2, 2.3], kind: 'flap' },
    },
    tip: { bone: 'handR', p: [0, -3.2, 0.1] },
    grip: { R: { at: [0, -1, 0] }, L: { at: [0, -1, 0] } },
    anim: {
      weapon: 'fists',
      gait: { cadence: 0.6, stride: 44, knee: 78, armSwing: 20, elbow: 70, bounce: 1.0, lean: 15, sway: 2, twist: 14, heavy: 0, headBob: 1.2, armOut: 6, idle: 1.25 },
      stance: STEELFIST_STANCE,
      stanceRun: 0.6,
      victory: 'flex',
    },
  };
}
