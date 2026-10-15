import type { HeroRigDef } from '../../render/rig/HeroRig';
import type { RigPart } from '../../render/rig/shapes';
import { bk, jr } from './blockKit';
import { GRIP, MC_POS_SCALE, MC_SCALE, mcProps, pixelItem, type Side } from './mcKit';

/**
 * Sorceress, an arcane battle-mage built as a detailed block model (many small bevelled blocks, no
 * pixel skins): a midnight-blue robe with a violet gold-trimmed front panel and a glowing rune gem, a
 * high flared collar, long silver hair under a horned crystal circlet, glowing violet eyes, a crystal
 * pauldron with shards on the right shoulder, violet inner sleeves with flared gold cuffs, a crystal
 * belt, a long split skirt with runes, and a gold-capped crystal staff in the right hand. Her focus
 * orb, ringed by shards, hovers over the left palm on the accB spin bone.
 */

const SKIN = 0xf0ccb4;
const SKIN_D = 0xd4ae96;
const HAIR = 0xc4c2e2;
const HAIR_L = 0xdcdaf2;
const HAIR_D = 0x9694bc;
const NIGHT = 0x26254a;
const NIGHT_L = 0x38376a;
const NIGHT_D = 0x18172e;
const VIOLET = 0x8a4ad8;
const VIOLET_L = 0xc48aff;
const VIOLET_D = 0x5a2a98;
const GOLD = 0xeec050;
const GOLD_D = 0xae8228;
const RUNE = 0xe0a0ff;
const CRYSTAL = 0xc8a8ff;
const EYE = 0xb060ff;

export function sorceressRig(): HeroRigDef {
  const pr = mcProps(true);
  const P: RigPart[] = [];
  const add = (...a: RigPart[]) => P.push(...a);

  // ---------------------------------------------------------------- head: face, glowing eyes
  add(bk('head', -3.4, 0.2, -3.2, 3.4, 6.4, 3.6, SKIN));
  add(bk('head', -1.3, -1.2, -1.3, 1.3, 0.6, 1.3, SKIN_D));
  add(bk('head', -0.45, 2.4, 3.5, 0.45, 3.4, 3.9, SKIN_D, { bv: 0.08 }));
  add(bk('head', -0.9, 1.3, 3.55, 0.9, 1.75, 3.8, 0xb4506a, { bv: 0 }));
  for (const k of [-1, 1]) {
    add(bk('head', k * 0.9, 3.5, 3.45, k * 2.7, 4.6, 3.75, 0x2a2040, { bv: 0 }));
    add(bk('head', k * 1.1, 3.7, 3.6, k * 2.3, 4.4, 3.9, EYE, { g: true, bv: 0 }));
    add(bk('head', k * 0.8, 4.8, 3.45, k * 2.8, 5.2, 3.8, HAIR_D, { bv: 0, r: [0, 0, k * -8] }));
  }
  // long silver hair, side-swept fringe
  add(bk('head', -4.0, 5.8, -4.0, 4.0, 8.4, 4.0, HAIR));
  add(bk('head', -4.0, -0.6, -4.2, 4.0, 6.4, -2.4, HAIR));
  for (const k of [-1, 1]) {
    add(bk('head', k * 3.2, -1.4, -4.0, k * 4.2, 6.4, 3.0, HAIR, { bv: 0.15 }));
    add(bk('head', k * 2.8, -2.8, 2.0, k * 3.9, 5.6, 3.9, k > 0 ? HAIR_L : HAIR, { bv: 0.15 }));
  }
  const fringe = [2.0, 1.6, 1.2, 0.8, 0.5, 0.5, 0.7, 1.0];
  for (let i = 0; i < 8; i++) add(bk('head', -4 + i, 6.6 - fringe[i], 3.3, -3 + i, 7.0, 4.2, i % 2 ? HAIR_L : HAIR, { bv: 0.1 }));
  // long hair down the back (accC bob)
  for (let i = 0; i < 8; i++) {
    const x = -4 + i;
    const len = 9.2 + jr(i + 2) * 1.4;
    add(bk('accC', x, -len, -0.5, x + 1, 0.6, 0.5, i % 3 === 1 ? HAIR_D : i % 2 ? HAIR : HAIR_L, { bv: 0.1 }));
  }
  // horned crystal circlet with a brow gem
  add(bk('head', -4.2, 6.6, -4.2, 4.2, 7.2, 4.2, GOLD, { bv: 0.1 }));
  add(bk('head', -0.6, 6.6, 4.1, 0.6, 8.4, 4.7, RUNE, { g: true, bv: 0.12 }));
  add(bk('head', -1.0, 6.5, 4.0, 1.0, 7.3, 4.5, GOLD_D, { bv: 0.08 }));
  for (const k of [-1, 1]) {
    add(bk('head', k * 2.9, 7.4, 0.9, k * 3.9, 11.0, 2.1, VIOLET_L, { g: true, r: [-10, 0, -k * 22], bv: 0.15 }));
    add(bk('head', k * 3.6, 10.4, 0.9, k * 4.4, 12.0, 1.9, 0xffffff, { g: true, r: [-10, 0, -k * 22], bv: 0.1 }));
    add(bk('head', k * 1.6, 7.2, 2.4, k * 2.6, 10.2, 3.2, CRYSTAL, { g: true, r: [-10, 0, -k * 8], bv: 0.12 }));
    add(bk('head', k * 2.6, 6.8, 0.6, k * 4.4, 7.8, 2.4, GOLD_D, { bv: 0.12 })); // horn sockets
  }

  // ---------------------------------------------------------------- chest: robe, violet panel, rune gem, high collar
  add(bk('chest', -3.9, 0, -2.0, 3.9, 8.0, 2.0, NIGHT));
  add(bk('chest', -1.6, 0, 1.9, 1.6, 7.6, 2.4, VIOLET, { bv: 0.1 }));
  for (const k of [-1, 1]) {
    add(bk('chest', k * 1.5, 0, 2.0, k * 2.1, 7.8, 2.55, GOLD, { bv: 0.06 }));
    add(bk('chest', k * 2.1, 3.2, 1.8, k * 3.6, 6.8, 2.35, NIGHT_L, { bv: 0.2 }));
    add(bk('chest', k * 3.5, 0.2, -2.2, k * 4.1, 7.6, 2.2, NIGHT_D, { bv: 0.1 }));
    add(bk('chest', k * 2.6, 3.0, 1.9, k * 4.0, 8.0, 2.6, HAIR, { bv: 0.12 })); // hair over the shoulders
  }
  add(bk('chest', -2.2, 7.6, 2.0, 2.2, 8.2, 2.6, GOLD, { bv: 0.06 }));
  add(bk('chest', -1.0, 3.8, 2.3, 1.0, 5.8, 2.8, GOLD_D, { bv: 0.12 })); // rune gem setting
  add(bk('chest', -0.65, 4.15, 2.6, 0.65, 5.45, 3.0, RUNE, { g: true, bv: 0.1 }));
  add(bk('chest', -0.25, 4.55, 2.9, 0.25, 5.05, 3.1, 0xffffff, { g: true, bv: 0 }));
  // flared collar, open at the front
  add(bk('chest', -5.0, 7.0, -3.4, 5.0, 10.0, -2.4, NIGHT, { bv: 0.2, r: [-10, 0, 0] }));
  for (const k of [-1, 1]) {
    add(bk('chest', k * 3.6, 7.0, -3.2, k * 5.0, 10.0, 1.8, NIGHT, { bv: 0.2, r: [0, 0, k * -10] }));
    add(bk('chest', k * 3.5, 9.6, -3.3, k * 5.1, 10.2, 1.9, GOLD, { bv: 0.08, r: [0, 0, k * -10] }));
    add(bk('chest', k * 2.0, 7.0, 1.2, k * 3.8, 9.4, 2.4, NIGHT_L, { bv: 0.15, r: [0, k * -20, 0] }));
  }
  add(bk('chest', -5.0, 9.8, -3.6, 5.0, 10.4, -2.4, GOLD, { bv: 0.08, r: [-10, 0, 0] }));
  // crystal belt
  add(bk('chest', -4.2, -0.2, -2.3, 4.2, 0.8, 2.3, GOLD_D, { bv: 0.1 }));
  for (const x of [-0.9, 0.1]) add(bk('chest', x, -0.4, 2.2, x + 0.8, 1.0, 2.7, CRYSTAL, { g: true, bv: 0.1 }));
  add(bk('spine', -3.7, 0.9, -1.9, 3.7, 3.9, 1.9, NIGHT));
  add(bk('spine', -1.6, 0.9, 1.8, 1.6, 3.9, 2.3, VIOLET, { bv: 0.08 }));
  for (const k of [-1, 1]) add(bk('spine', k * 1.5, 0.9, 1.85, k * 2.1, 3.9, 2.45, GOLD, { bv: 0.05 }));

  // ---------------------------------------------------------------- hips and the long split skirt
  add(bk('hips', -4.0, -0.6, -2.1, 4.0, 3.0, 2.1, NIGHT_D));
  for (const k of [-1, 1]) {
    add(bk('hips', k * 4.1, -6.9, -2.5, k * 4.6, 2.1, 2.5, NIGHT, { bv: 0.12 }));
    add(bk('hips', k * 4.15, -6.9, -2.55, k * 4.7, -6.2, 2.55, GOLD, { bv: 0.06 }));
    add(bk('hips', k * 4.15, -6.2, -2.55, k * 4.7, -5.6, 2.55, VIOLET_D, { bv: 0.05 }));
  }
  for (const [bone, front] of [['skirtF', true], ['skirtB', false]] as const) {
    const z0 = front ? 0 : -0.5;
    const z1 = front ? 0.5 : 0;
    add(bk(bone, -4.5, -10.0, z0, 4.5, 0.2, z1, NIGHT, { bv: 0.1 }));
    add(bk(bone, -4.6, -10.0, z0 - 0.05, 4.6, -9.2, z1 + 0.05, GOLD, { bv: 0.06 }));
    add(bk(bone, -4.6, -9.2, z0 - 0.05, 4.6, -8.6, z1 + 0.05, VIOLET_D, { bv: 0.05 }));
    const fz0 = front ? z1 - 0.1 : z0 - 0.15;
    const fz1 = front ? z1 + 0.15 : z0 + 0.1;
    if (front) {
      add(bk(bone, -1.5, -8.6, fz0, 1.5, 0.2, fz1, VIOLET, { bv: 0.06 }));
      for (const k of [-1, 1]) add(bk(bone, k * 1.5, -8.6, fz0, k * 2.1, 0.2, fz1 + 0.1, GOLD, { bv: 0.05 }));
      for (const y of [-2.5, -6.5]) add(bk(bone, -0.45, y - 0.45, fz1 - 0.05, 0.45, y + 0.45, fz1 + 0.12, RUNE, { g: true, bv: 0 }));
    } else {
      for (const [x, y] of [[-2.5, -4.5], [1.5, -6.5], [-0.5, -8.0]]) add(bk(bone, x - 0.45, y - 0.45, fz0, x + 0.45, y + 0.45, fz1, VIOLET_L, { g: true, bv: 0 }));
    }
  }

  // ---------------------------------------------------------------- limbs, mirrored (slim arms: 3 wide)
  for (const s of ['L', 'R'] as Side[]) {
    const k = s === 'L' ? 1 : -1;
    const arm = 'arm' + s;
    const fore = 'fore' + s;
    const hand = 'hand' + s;
    const leg = 'leg' + s;
    const shin = 'shin' + s;
    const foot = 'foot' + s;
    add(bk(arm, -1.6, -5.0, -1.6, 1.6, 2.0, 1.6, NIGHT));
    add(bk(arm, -1.8, 0.4, -1.8, 1.8, 2.3, 1.8, NIGHT_L, { bv: 0.25 }));
    add(bk(arm, k * 1.55, -0.8, -0.4, k * 1.8, 0.2, 0.4, RUNE, { g: true, bv: 0 }));
    add(bk(arm, -1.7, -5.0, -1.7, 1.7, -4.2, 1.7, VIOLET_D, { bv: 0.06 }));
    // violet inner sleeve and a flared gold cuff
    add(bk(fore, -1.6, -3.0, -1.6, 1.6, 1.0, 1.6, VIOLET));
    add(bk(fore, -1.7, 0.4, -1.7, 1.7, 1.0, 1.7, VIOLET_D, { bv: 0.06 }));
    add(bk(fore, -2.2, -2.6, -2.2, 2.2, -1.8, 2.2, GOLD, { bv: 0.1 }));
    add(bk(fore, -2.3, -3.1, -2.3, 2.3, -2.5, 2.3, GOLD_D, { bv: 0.08 }));
    add(bk(fore, -1.75, -1.4, -1.75, 1.75, -0.9, 1.75, VIOLET_L, { bv: 0 }));
    add(bk(hand, -1.4, -2.0, -1.4, 1.4, 1.0, 1.4, SKIN));
    add(bk(hand, -1.2, -2.15, 0.9, 1.2, -1.0, 1.6, SKIN_D, { bv: 0.1 }));
    // legs and slippers (under the skirt)
    add(bk(leg, -1.9, -6.0, -1.9, 1.9, 0.2, 1.9, NIGHT_D));
    add(bk(shin, -1.85, -5.0, -1.85, 1.85, 1.0, 1.85, NIGHT_D));
    add(bk(shin, -2.0, -5.0, -2.0, 2.0, -3.6, 2.0, VIOLET_D, { bv: 0.1 }));
    add(bk(shin, -2.05, -3.8, -2.05, 2.05, -3.3, 2.05, GOLD, { bv: 0.06 }));
    add(bk(foot, -1.9, -1.0, -2.1, 1.9, 0.5, 3.0, VIOLET_D));
    add(bk(foot, -1.4, -0.6, 2.4, 1.4, 0.3, 3.6, GOLD_D, { bv: 0.2 }));
    add(bk(foot, -2.0, -1.0, -2.2, 2.0, -0.7, 3.2, 0x100e1c, { bv: 0.06 }));
  }
  // crystal pauldron with shards on the right shoulder
  add(bk('armR', -3.0, 0.1, -2.5, 2.0, 3.1, 2.5, VIOLET_D, { bv: 0.3 }));
  add(bk('armR', -3.1, 0.0, -2.6, 2.1, 0.6, 2.6, GOLD, { bv: 0.08 }));
  add(bk('armR', -2.4, 2.8, -1.8, 1.2, 3.5, 1.8, VIOLET, { bv: 0.2 }));
  add(bk('armR', -2.0, 2.6, -0.5, -1.2, 5.2, 0.5, CRYSTAL, { g: true, r: [0, 0, 18], bv: 0.1 }));
  add(bk('armR', -0.8, 2.8, 0.5, 0.0, 5.0, 1.5, CRYSTAL, { g: true, r: [10, 0, 8], bv: 0.1 }));
  add(bk('armR', -1.0, 2.8, -1.6, -0.3, 4.4, -0.8, VIOLET_L, { g: true, r: [-10, 0, 10], bv: 0.1 }));

  // ---------------------------------------------------------------- focus orb with orbiting shards (accB over the left palm)
  add(bk('accB', -1.5, -1.5, -1.5, 1.5, 1.5, 1.5, 0xe8c8ff, { g: true, bv: 0.4 }));
  add(bk('accB', -0.7, -0.7, -1.7, 0.7, 0.7, 1.7, 0xffffff, { g: true, bv: 0.2 }));
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const x = Math.sin(a) * 3;
    const y = Math.cos(a) * 3;
    add(bk('accB', x - 0.5, y - 1, -0.5, x + 0.5, y + 1, 0.5, RUNE, { g: true, r: [0, 0, (-a * 180) / Math.PI], bv: 0.1 }));
  }

  // ---------------------------------------------------------------- crystal staff along the hand's z axis (gripped below the middle)
  const rows = [
    '..c..',
    '.cCc.',
    '.cCc.',
    'GcCcG',
    'G.c.G',
    '.GgG.',
    '..s..',
    '..s..',
    '..g..',
    '..s..',
    '..s..',
    '..s..',
    '..s..',
    '..s..',
    '..g..',
    '..s..',
    '..s..',
    '..s..',
    '..s..',
    '..G..',
    '..g..',
  ];
  add(...pixelItem(rows, { c: CRYSTAL, C: 0xfff4ff, G: GOLD_D, g: GOLD, s: NIGHT_L }, { b: 'gripR', at: GRIP, pivot: [2, 14], px: 0.9, th: 0.8, u: '+y', v: '+z', glow: 'cC', thick: { c: 1.5, C: 1.5, G: 1.3 } }));

  return {
    id: 'sorceress',
    scale: MC_SCALE,
    posScale: MC_POS_SCALE,
    props: pr,
    parts: P,
    springs: {
      accB: { parent: 'handL', at: [0, -1.5, 4.5], kind: 'spin', axis: 'z', speed: 2.2 },
      accC: { parent: 'head', at: [0, 3.5, -4.6], kind: 'bob', k: 1.5 },
      skirtF: { parent: 'hips', at: [0, 1.6, 1.6], kind: 'flap' },
      skirtB: { parent: 'hips', at: [0, 1.6, -1.6], kind: 'flap' },
    },
    tip: { bone: 'accB', p: [0, 0, 0] },
    grip: { R: { at: GRIP }, L: { at: GRIP } },
    anim: {
      weapon: 'staff',
      gait: { cadence: 0.5, stride: 26, knee: 32, armSwing: 8, elbow: 12, bounce: 0.25, lean: 4, sway: 4, twist: 6, heavy: 0, headBob: 0.4, armOut: 5, idle: 1.1 },
      stance: { chest: [-3, 8, 0], head: [-2, -6, 0], armL: [-34, -10, 14], foreL: [-60, 0, 0], handL: [0, 0, 0], armR: [-4, 0, -10], foreR: [-18, 0, 0], handR: [30, -25, 0] },
      stanceRun: 0.7,
      victory: 'raise',
    },
  };
}
