import type { HeroRigDef } from '../../render/rig/HeroRig';
import type { RigPart } from '../../render/rig/shapes';
import { bk } from './blockKit';
import { GRIP, MC_POS_SCALE, MC_SCALE, mcProps, pixelItem, type Side } from './mcKit';

/**
 * Templar, a holy battle-maiden built as a detailed block model (many small bevelled blocks, no
 * pixel skins): angular ivory plate with gold trim over a dark under-suit, a crimson tabard with a
 * gold cross, swept layered pauldrons, a winged gold circlet with a holy gem over dark hair with a
 * long gold-tied braid, a glowing rune seal turning behind her back, and a sacred pixel-art halberd
 * (crescent blade, top spike, back hook, glowing runes).
 */

const SKIN = 0xe2b694;
const SKIN_D = 0xc69878;
const HAIR = 0x2e2228;
const HAIR_L = 0x44343c;
const HAIR_D = 0x1c141a;
const IVORY = 0xf0e8d4;
const IVORY_L = 0xfffaf0;
const IVORY_D = 0xc8bca0;
const UNDER = 0x34303c;
const UNDER_L = 0x48434f;
const GOLD = 0xeebc48;
const GOLD_L = 0xfff0b0;
const GOLD_D = 0xae7e26;
const CRIMSON = 0xa82434;
const CRIMSON_L = 0xc03444;
const CRIMSON_D = 0x701824;
const HOLY = 0xffe890;
const HAFT = 0x5a3a2a;

export function templarRig(): HeroRigDef {
  const pr = mcProps(true);
  const P: RigPart[] = [];
  const add = (...a: RigPart[]) => P.push(...a);

  // ---------------------------------------------------------------- head: face, dark hair, winged circlet
  add(bk('head', -3.4, 0.2, -3.2, 3.4, 6.4, 3.6, SKIN));
  add(bk('head', -1.3, -1.2, -1.3, 1.3, 0.6, 1.3, UNDER));
  add(bk('head', -0.45, 2.4, 3.5, 0.45, 3.4, 3.9, SKIN_D, { bv: 0.08 }));
  add(bk('head', -0.9, 1.3, 3.55, 0.9, 1.75, 3.8, 0xb05a5a, { bv: 0 }));
  for (const k of [-1, 1]) {
    add(bk('head', k * 0.9, 3.5, 3.45, k * 2.7, 4.6, 3.75, 0xf6f0e6, { bv: 0 }));
    add(bk('head', k * 0.9, 3.5, 3.6, k * 1.8, 4.6, 3.85, 0xc08a2a, { bv: 0 }));
    add(bk('head', k * 0.8, 4.8, 3.45, k * 2.8, 5.2, 3.8, HAIR_D, { bv: 0 }));
  }
  add(bk('head', -4.0, 5.8, -4.0, 4.0, 8.4, 4.0, HAIR));
  add(bk('head', -4.0, 0.6, -4.2, 4.0, 6.4, -2.4, HAIR));
  for (const k of [-1, 1]) {
    add(bk('head', k * 3.2, 2.6, -4.0, k * 4.1, 6.4, 3.2, HAIR, { bv: 0.15 }));
    add(bk('head', k * 0.2, 5.8, 3.3, k * 4.1, 7.0, 4.1, k > 0 ? HAIR_L : HAIR, { bv: 0.12 }));
    add(bk('head', k * 3.0, 3.2, 3.0, k * 3.9, 6.0, 4.0, HAIR_D, { bv: 0.12 }));
  }
  add(bk('head', -1.2, 7.4, -4.8, 1.2, 9.0, -3.2, HAIR_L, { bv: 0.25 })); // bun at the braid root
  // gold circlet with a holy gem and swept wings
  add(bk('head', -4.25, 6.8, -4.25, 4.25, 7.5, 4.25, GOLD, { bv: 0.1 }));
  add(bk('head', -1.0, 6.7, 4.1, 1.0, 8.3, 4.6, GOLD_D, { bv: 0.12 }));
  add(bk('head', -0.55, 7.1, 4.4, 0.55, 8.0, 4.85, HOLY, { g: true, bv: 0.08 }));
  for (const k of [-1, 1]) {
    add(bk('head', k * 4.1, 6.6, -1.0, k * 4.7, 8.0, 1.0, GOLD_D, { bv: 0.12 }));
    for (let i = 0; i < 3; i++) {
      const y = 7.6 - i * 0.9;
      const len = 4.6 - i * 1.1;
      add(bk('head', k * 4.3, y - 0.5, -0.4 - len, k * 4.9, y + 0.5, 0.4, i ? GOLD : GOLD_L, { r: [-28 + i * 10, 0, 0], bv: 0.12 }));
    }
  }
  // long braid with gold ties (accC bob)
  for (let i = 0; i < 5; i++) {
    const y = -i * 2;
    add(bk('accC', -1.0 + (i % 2) * 0.1, y - 2.1, -1.0, 1.0 + (i % 2) * 0.1, y, 1.0, i % 2 ? HAIR_D : HAIR, { bv: 0.25 }));
  }
  add(bk('accC', -1.15, -8.6, -1.15, 1.15, -7.9, 1.15, GOLD, { bv: 0.1 }));
  add(bk('accC', -0.7, -10.4, -0.7, 0.7, -8.6, 0.7, HAIR_L, { bv: 0.2 }));

  // ---------------------------------------------------------------- chest: breastplate, tabard with gold cross
  add(bk('chest', -3.9, 0, -2.0, 3.9, 8.0, 2.0, IVORY));
  add(bk('chest', -3.6, 4.8, 1.6, 3.6, 7.6, 2.4, IVORY_L, { bv: 0.3 })); // upper breastplate
  add(bk('chest', -3.8, 7.2, -2.3, 3.8, 7.8, 2.45, GOLD, { bv: 0.08 }));
  add(bk('chest', -2.4, 7.4, -2.2, 2.4, 9.0, 2.2, UNDER_L, { bv: 0.2 })); // gorget
  add(bk('chest', -2.5, 8.6, -2.3, 2.5, 9.2, 2.3, GOLD_D, { bv: 0.08 }));
  for (const k of [-1, 1]) add(bk('chest', k * 3.4, 0.2, -2.2, k * 4.1, 7.2, 2.2, IVORY_D, { bv: 0.12 }));
  // tabard
  add(bk('chest', -1.9, 0, 2.2, 1.9, 6.6, 2.65, CRIMSON, { bv: 0.1 }));
  for (const k of [-1, 1]) add(bk('chest', k * 1.8, 0, 2.3, k * 2.4, 6.8, 2.8, GOLD, { bv: 0.06 }));
  add(bk('chest', -0.5, 1.6, 2.55, 0.5, 6.0, 2.95, GOLD, { bv: 0.06 })); // cross
  add(bk('chest', -1.6, 4.0, 2.55, 1.6, 4.9, 2.95, GOLD, { bv: 0.06 }));
  add(bk('chest', -0.3, 4.2, 2.85, 0.3, 4.7, 3.05, HOLY, { g: true, bv: 0 }));
  // back plate with a crimson panel
  add(bk('chest', -3.4, 1.0, -2.5, 3.4, 7.2, -1.8, IVORY_L, { bv: 0.25 }));
  add(bk('chest', -0.4, 1.0, -2.75, 0.4, 7.2, -2.35, GOLD_D, { bv: 0.06 }));
  add(bk('spine', -3.6, 0.9, -1.9, 3.6, 3.9, 1.9, UNDER));
  add(bk('spine', -1.9, 0.9, 1.8, 1.9, 3.9, 2.5, CRIMSON, { bv: 0.08 }));
  for (const k of [-1, 1]) add(bk('spine', k * 1.8, 0.9, 1.9, k * 2.4, 3.9, 2.65, GOLD, { bv: 0.05 }));
  add(bk('spine', -3.2, 0.9, -2.3, 3.2, 3.9, -1.7, CRIMSON, { bv: 0.1 }));
  for (let i = 0; i < 3; i++) add(bk('spine', -3.7, 1.0 + i * 1.0, -2.1, 3.7, 1.7 + i * 1.0, 2.0, i % 2 ? IVORY_D : IVORY, { bv: 0.15 })); // faulds

  // ---------------------------------------------------------------- hips: gold belt, under-suit, tabard flaps
  add(bk('hips', -4.0, -0.6, -2.1, 4.0, 3.0, 2.1, UNDER));
  add(bk('hips', -4.2, 1.8, -2.4, 4.2, 2.8, 2.4, GOLD_D, { bv: 0.1 }));
  add(bk('hips', -1.0, 1.6, 2.3, 1.0, 3.0, 2.75, GOLD, { bv: 0.1 }));
  add(bk('hips', -0.4, 2.0, 2.6, 0.4, 2.6, 2.85, HOLY, { g: true, bv: 0 }));
  for (const k of [-1, 1]) add(bk('hips', k * 2.4, -2.2, -2.3, k * 4.2, 2.0, 2.3, IVORY, { bv: 0.2 })); // hip plates (tassets)
  for (const [bone, front] of [['skirtF', true], ['skirtB', false]] as const) {
    const z0 = front ? -0.1 : -0.5;
    const z1 = front ? 0.5 : 0.1;
    add(bk(bone, -2.0, -7.0, z0, 2.0, 0.0, z1, CRIMSON, { bv: 0.08 }));
    for (const k of [-1, 1]) add(bk(bone, k * 1.6, -7.0, z0 - 0.05, k * 2.2, 0.0, z1 + 0.05, GOLD, { bv: 0.05 }));
    add(bk(bone, -2.2, -7.4, z0 - 0.05, 2.2, -6.6, z1 + 0.05, GOLD, { bv: 0.06 }));
    const zf = front ? z1 : z0;
    add(bk(bone, -0.4, -5.6, zf - 0.1, 0.4, -1.0, zf + 0.1, front ? GOLD_D : CRIMSON_L, { bv: 0 }));
    add(bk(bone, -1.2, -2.6, zf - 0.1, 1.2, -1.9, zf + 0.1, front ? GOLD_D : CRIMSON_L, { bv: 0 }));
    add(bk(bone, -1.6, -6.6, zf - 0.08, 1.6, -6.2, zf + 0.08, CRIMSON_D, { bv: 0 }));
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
    // swept pauldron: layered plates rising to a point, gold rims
    add(bk(arm, k * -1.9, 0.0, -2.5, k * 3.1, 3.0, 2.5, IVORY, { r: [0, 0, -k * 12], bv: 0.3 }));
    add(bk(arm, k * -2.0, -0.1, -2.6, k * 3.2, 0.5, 2.6, GOLD, { r: [0, 0, -k * 12], bv: 0.08 }));
    add(bk(arm, k * -1.2, 2.7, -2.0, k * 2.6, 3.5, 2.0, IVORY_L, { r: [0, 0, -k * 12], bv: 0.2 }));
    add(bk(arm, k * 1.1, 1.6, -2.0, k * 4.1, 3.6, 2.0, IVORY_L, { r: [0, 0, -k * 34], bv: 0.25 }));
    add(bk(arm, k * 1.1, 1.5, -2.1, k * 4.2, 1.9, 2.1, GOLD_D, { r: [0, 0, -k * 34], bv: 0.06 }));
    add(bk(arm, k * -0.4, -1.6, -2.2, k * 2.6, 0.2, 2.2, IVORY_D, { r: [0, 0, -k * 12], bv: 0.2 }));
    // under-suit upper arm, plated vambrace with a gold rim, gauntlet
    add(bk(arm, -1.5, -5.0, -1.5, 1.5, 0.5, 1.5, UNDER));
    add(bk(arm, -1.6, -5.0, -1.6, 1.6, -4.4, 1.6, GOLD, { bv: 0.06 }));
    add(bk(fore, -1.5, -3.0, -1.5, 1.5, 1.0, 1.5, IVORY));
    add(bk(fore, -1.7, -2.8, -1.7, 1.7, -0.4, 1.7, IVORY_L, { bv: 0.15 }));
    add(bk(fore, -1.75, -0.6, -1.75, 1.75, -0.2, 1.75, GOLD, { bv: 0.06 }));
    add(bk(fore, k * 1.4, -2.4, -0.4, k * 1.85, -1.0, 0.4, GOLD, { bv: 0.06 }));
    add(bk(fore, -1.0, 0.0, -2.0, 1.0, 1.2, -1.4, IVORY_D, { bv: 0.15 })); // couter
    add(bk(hand, -1.5, -2.0, -1.5, 1.5, 1.0, 1.5, IVORY_D));
    add(bk(hand, -1.3, -2.15, 0.9, 1.3, -0.6, 1.7, IVORY, { bv: 0.1 }));
    add(bk(hand, -1.6, 0.3, -1.6, 1.6, 1.0, 1.6, GOLD_D, { bv: 0.08 }));
    // under-suit thighs, ivory cuisses, knee cops with gold, greaves, sabatons
    add(bk(leg, -1.9, -6.0, -1.9, 1.9, 0.2, 1.9, UNDER));
    add(bk(leg, -2.0, -5.6, 1.4, 2.0, -2.6, 2.2, IVORY, { bv: 0.2 }));
    add(bk(leg, k * 0.4, -5.4, -1.6, k * 2.1, -2.8, 1.6, IVORY_D, { bv: 0.15 }));
    add(bk(shin, -1.95, -5.0, -1.95, 1.95, 1.0, 1.95, IVORY));
    add(bk(shin, -1.8, -0.8, 1.6, 1.8, 1.6, 2.6, IVORY_L, { bv: 0.3 }));
    add(bk(shin, -0.8, -0.1, 2.5, 0.8, 0.7, 2.9, GOLD, { bv: 0.1 }));
    add(bk(shin, -1.5, -4.2, 1.8, 1.5, -1.2, 2.35, IVORY_L, { bv: 0.2 }));
    add(bk(shin, -2.1, -5.0, -2.1, 2.1, -4.5, 2.1, GOLD_D, { bv: 0.06 }));
    add(bk(foot, -2.0, -1.0, -2.2, 2.0, 0.5, 3.0, IVORY_D));
    add(bk(foot, -1.6, -0.6, 2.2, 1.6, 0.4, 3.6, IVORY, { bv: 0.2 }));
    add(bk(foot, -0.9, -0.3, 3.4, 0.9, 0.3, 3.9, GOLD, { bv: 0.1 }));
    add(bk(foot, -2.1, -1.0, -2.3, 2.1, -0.7, 3.2, UNDER, { bv: 0.06 }));
  }

  // ---------------------------------------------------------------- rune seal: a ring of glowing bars around a bright core (accB)
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const x = Math.sin(a) * 5;
    const y = Math.cos(a) * 5;
    add(bk('accB', x - 1.5, y - 0.5, -0.5, x + 1.5, y + 0.5, 0.5, HOLY, { r: [0, 0, (-a * 180) / Math.PI + 90], g: true, bv: 0.1 }));
  }
  add(bk('accB', -1, -1, -0.5, 1, 1, 0.5, 0xfff8d8, { g: true, bv: 0.15 }));
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    add(bk('accB', Math.sin(a) * 2.6 - 0.35, Math.cos(a) * 2.6 - 0.35, -0.3, Math.sin(a) * 2.6 + 0.35, Math.cos(a) * 2.6 + 0.35, 0.3, HOLY, { g: true, bv: 0 }));
  }

  // ---------------------------------------------------------------- halberd (+z along the haft toward the head, +y toward the blade)
  const rows = [
    '...S.....',
    '...S.....',
    '..SyS....',
    '...g..ee.',
    '...gBBBe.',
    'hh.gBrBBe',
    '.h.gBrBBe',
    '.hhgBrBBe',
    '...gBBBe.',
    '...g..ee.',
    '...G.....',
    '...c.....',
    '...c.....',
    '...w.....',
    '...w.....',
    '...w.....',
    '...G.....',
    '...w.....',
    '...w.....',
    '...w.....',
    '...c.....',
    '...c.....',
    '...c.....',
    '...w.....',
    '...w.....',
    '...w.....',
    '...G.....',
    '...w.....',
    '...w.....',
    '...G.....',
    '...g.....',
    '...S.....',
  ];
  add(...pixelItem(rows, { S: IVORY_L, y: HOLY, g: GOLD, G: GOLD_D, B: IVORY, e: IVORY_L, r: HOLY, h: GOLD, w: HAFT, c: CRIMSON }, { b: 'gripR', at: GRIP, pivot: [3, 21], px: 1.1, th: 0.8, u: '+y', v: '+z', glow: 'ry', thick: { w: 1.1, c: 1.3, G: 1.4 } }));

  return {
    id: 'templar',
    scale: MC_SCALE,
    posScale: MC_POS_SCALE,
    props: pr,
    parts: P,
    springs: {
      accB: { parent: 'chest', at: [0, 5, -6.5], kind: 'spin', axis: 'z', speed: 0.7 },
      accC: { parent: 'head', at: [0, 4, -4.6], kind: 'bob', k: 0.9 },
      skirtF: { parent: 'hips', at: [0, 2.2, 2.4], kind: 'flap' },
      skirtB: { parent: 'hips', at: [0, 2.2, -2.4], kind: 'flap' },
    },
    tip: { bone: 'gripR', p: [GRIP[0], GRIP[1], GRIP[2] + 21 * 1.1] },
    grip: { R: { at: GRIP, rot: [-8, -2, -23] }, L: { at: GRIP } },
    anim: {
      weapon: 'staff',
      gait: { cadence: 0.47, stride: 30, knee: 38, armSwing: 5, elbow: -18, bounce: 0.4, lean: 5, sway: 3, twist: 4, heavy: 0.3, headBob: 1, armOut: 3, idle: 0.7 },
      stance: { armR: [-30, 18, 8], foreR: [-20, 0, 0], handR: [-12, 17, -5], armL: [-63, 14, -40], foreL: [-20, 0, 0], handL: [4, 1, -6] },
      stanceRun: 1,
      victory: 'raise',
    },
  };
}
