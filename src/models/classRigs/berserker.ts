import type { HeroRigDef } from '../../render/rig/HeroRig';
import type { RigPart } from '../../render/rig/shapes';
import { bk, jr } from './blockKit';
import { GRIP, MC_POS_SCALE, MC_SCALE, mcProps, pixelItem } from './mcKit';

/**
 * Berserker, sculpted after the sheet «Берсерк — полный 3D дизайн персонажа» as a detailed block
 * model (many small bevelled blocks with relief, no flat pixel skins): a dark spiky hair helmet with
 * a crown of tufts and glowing red eyes, a ragged red scarf, stepped grey-and-dark pauldrons over red
 * sleeves, a bare chest crossed by a leather strap with an iron clasp, a wide belt with a square
 * buckle, a red loincloth between leather tassets, plated forearms and dark gloves, dark trousers with
 * grey knee plates and brown boots, and a long torn red cape with a light trident on the back.
 * Every block is a separate part merged per bone, so the rig, clips and IK drive it unchanged.
 */

// palette (from the sheet's swatches)
const SKIN = 0xe0a487;
const SKIN_D = 0xc08066;
const SKIN_L = 0xf0bc9e;
const HAIR = 0x2e2c33;
const HAIR_L = 0x45424c;
const HAIR_D = 0x1c1b20;
const EYE = 0xff2a22;
const IRON_D = 0x37353d;
const IRON = 0x4d4b54;
const IRON_M = 0x67656e;
const IRON_L = 0x8e8c95;
const IRON_H = 0xadabb3;
const RED = 0xc4182a;
const RED_L = 0xdc2a38;
const RED_D = 0x7e0f1a;
const LEATHER = 0x6a3a2a;
const LEATHER_L = 0x84503a;
const LEATHER_D = 0x45261c;
const EMBLEM = 0xcfc6ca;
const RUNE = 0xff2418;

/** Sword texel size: the handle has room for both fists. */
const SPX = 1.0;
/** Where the left fist closes on the handle (gripR space): below the right fist, toward the pommel. */
export const BERSERKER_HILT: [number, number, number] = [0, 0, -3.4 * SPX];

type Side = 'L' | 'R';

export function berserkerRig(): HeroRigDef {
  const pr = mcProps(false, { shoulderX: 6.4, hipX: 2.2, thigh: 7, shin: 6 });
  const P: RigPart[] = [];
  const add = (...a: RigPart[]) => P.push(...a);

  // ---------------------------------------------------------------- head (y 0..8, face toward +z)
  // face and neck
  add(bk('head', -3.4, 0.2, -3.2, 3.4, 6.2, 3.6, SKIN));
  add(bk('head', -1.6, -1.2, -1.6, 1.6, 0.6, 1.6, SKIN_D)); // neck
  // jaw line and cheeks
  add(bk('head', -3.0, 0.2, 2.8, 3.0, 1.2, 3.75, SKIN_D, { bv: 0.1 }));
  add(bk('head', -0.6, 2.2, 3.5, 0.6, 3.6, 4.05, SKIN_D, { bv: 0.1 })); // nose
  add(bk('head', -1.2, 1.4, 3.55, 1.2, 1.8, 3.85, 0x8a4a3a, { bv: 0 })); // set mouth
  // brows and eye sockets in shadow, glowing eyes
  for (const k of [-1, 1]) {
    add(bk('head', k * 0.7, 4.6, 3.4, k * 2.9, 5.3, 3.95, HAIR_D, { bv: 0.08 }));
    add(bk('head', k * 0.8, 3.6, 3.45, k * 2.8, 4.6, 3.8, 0x5a1414, { bv: 0 }));
    add(bk('head', k * 1.0, 3.75, 3.7, k * 2.6, 4.45, 3.95, EYE, { g: true, bv: 0 }));
  }
  // hair helmet: crown block, sides, back, a jagged fringe over the brows
  add(bk('head', -4.2, 5.6, -4.3, 4.2, 8.4, 4.2, HAIR));
  add(bk('head', -4.4, 1.6, -4.4, -3.2, 7.0, 2.6, HAIR)); // right side
  add(bk('head', 3.2, 1.6, -4.4, 4.4, 7.0, 2.6, HAIR)); // left side
  add(bk('head', -4.2, 0.6, -4.5, 4.2, 6.6, -3.0, HAIR)); // back
  add(bk('head', -4.0, 0.4, -4.7, 4.0, 1.4, -3.6, HAIR_D));
  // layered locks on the back of the head
  for (let i = 0; i < 4; i++) {
    const x = -4 + i * 2;
    add(bk('head', x + 0.1, 1.2 + jr(i) * 1.2, -4.9, x + 1.9, 6.8 - jr(i + 4) * 1.4, -4.3, i & 1 ? HAIR_L : HAIR, { bv: 0.15 }));
  }
  const fringe = [1.4, 0.8, 1.6, 1.0, 1.2, 1.7, 0.9, 1.5];
  for (let i = 0; i < 8; i++) {
    const x = -4 + i;
    add(bk('head', x, 5.6 - fringe[i], 3.3, x + 1, 6.2, 4.4, i & 1 ? HAIR_L : HAIR, { bv: 0.1 }));
  }
  add(bk('head', -4.5, 3.4, 1.6, -3.4, 6.0, 3.9, HAIR, { bv: 0.12 })); // side locks
  add(bk('head', 3.4, 3.4, 1.6, 4.5, 6.0, 3.9, HAIR, { bv: 0.12 }));
  // crown of tufts on top (tall middle, shorter corners), like the sheet's front and top views
  const tufts: [number, number, number, number][] = [
    [0, 0.6, 3.2, HAIR], [-2.6, 1.6, 2.2, HAIR], [2.6, 1.6, 2.2, HAIR], [-3.6, 3.4, 1.6, HAIR_L], [3.6, 3.4, 1.6, HAIR_L],
    [0, -2.4, 2.6, HAIR], [-2.4, -3.0, 1.8, HAIR_L], [2.4, -3.0, 1.8, HAIR_L], [-1.2, 2.8, 1.4, HAIR_L], [1.2, 2.8, 1.4, HAIR_L],
  ];
  for (const [x, z, h, c] of tufts) add(bk('head', x - 0.9, 8.2, z - 0.9, x + 0.9, 8.2 + h, z + 0.9, c, { bv: 0.12 }));

  // ---------------------------------------------------------------- red scarf around the neck (chest bone, y 0..8)
  add(bk('chest', -5.0, 6.6, -2.9, 5.0, 9.2, 3.0, RED));
  add(bk('chest', -4.6, 8.6, -2.6, 4.6, 9.7, 2.6, RED_L, { bv: 0.12 }));
  for (let i = 0; i < 9; i++) {
    const x = -4.5 + i;
    const len = 0.6 + jr(i) * 1.6;
    add(bk('chest', x, 6.6 - len, 2.1, x + 1, 6.8, 3.0, i % 3 ? RED : RED_D, { bv: 0.1 }));
  }

  // ---------------------------------------------------------------- bare chest, strap, clasp
  add(bk('chest', -4.0, 0, -2.2, 4.0, 7.2, 2.3, SKIN));
  for (const k of [-1, 1]) {
    add(bk('chest', k * 0.25, 3.4, 2.1, k * 3.4, 6.2, 2.55, SKIN_L, { bv: 0.25 })); // pecs
    add(bk('chest', k * 0.3, 3.0, 2.15, k * 3.3, 3.4, 2.5, SKIN_D, { bv: 0 }));
    add(bk('chest', k * 0.3, 0.2, 2.1, k * 1.9, 1.5, 2.45, SKIN_L, { bv: 0.15 })); // upper abs
    add(bk('chest', k * 0.3, 1.7, 2.1, k * 1.9, 2.9, 2.45, SKIN_L, { bv: 0.15 }));
    // dark red vest panels on the flanks
    add(bk('chest', k * 3.3, 0, -2.4, k * 4.3, 7.0, 2.2, RED_D));
    add(bk('chest', k * 3.5, 4.0, 1.6, k * 4.4, 7.0, 2.5, RED, { bv: 0.12 }));
  }
  add(bk('chest', -4.2, 0, -2.5, 4.2, 7.0, -1.6, RED_D)); // back of the vest
  // leather strap from the right shoulder down to the left hip, front and back
  for (let i = 0; i < 9; i++) {
    const y = 7.2 - i * 0.95;
    const x = -3.6 + i * 0.9;
    add(bk('chest', x - 0.7, y - 0.55, 2.3, x + 0.7, y + 0.55, 2.85, i & 1 ? LEATHER : LEATHER_D, { bv: 0.1 }));
    add(bk('chest', -x - 0.7, y - 0.55, -2.85, -x + 0.7, y + 0.55, -2.3, LEATHER_D, { bv: 0.1 }));
  }
  // iron clasp on the strap
  add(bk('chest', -2.9, 4.6, 2.75, -1.3, 6.2, 3.15, IRON_L, { bv: 0.1 }));
  add(bk('chest', -2.5, 5.0, 3.0, -1.7, 5.8, 3.25, IRON_D, { bv: 0 }));
  // lower belly (spine bone)
  add(bk('spine', -3.7, 0.9, -2.0, 3.7, 3.4, 2.1, SKIN_D));
  add(bk('spine', -3.9, 0.9, -2.3, -2.8, 3.4, 2.2, RED_D));
  add(bk('spine', 2.8, 0.9, -2.3, 3.9, 3.4, 2.2, RED_D));

  // ---------------------------------------------------------------- belt, buckle, trousers seat (hips bone, y 0..3)
  add(bk('hips', -4.2, -0.6, -2.4, 4.2, 1.4, 2.4, IRON_D));
  add(bk('hips', -4.5, 1.2, -2.7, 4.5, 3.0, 2.7, LEATHER));
  add(bk('hips', -4.5, 2.6, -2.7, 4.5, 3.0, 2.7, LEATHER_L, { bv: 0.08 }));
  add(bk('hips', -1.5, 0.9, 2.5, 1.5, 3.3, 3.1, IRON_L, { bv: 0.12 }));
  add(bk('hips', -0.8, 1.5, 2.9, 0.8, 2.7, 3.2, LEATHER_D, { bv: 0 }));
  for (const x of [-3.6, -2.4, 2.4, 3.6]) add(bk('hips', x - 0.25, 1.85, 2.65, x + 0.25, 2.35, 2.9, IRON_H, { bv: 0 }));

  // red loincloth front and back (flap bones), ragged hem
  for (const [bone, z] of [['skirtF', 1.6], ['skirtB', -1.6]] as const) {
    for (let i = 0; i < 5; i++) {
      const x = -2.5 + i;
      const len = 5.4 + jr(i + (z > 0 ? 0 : 9)) * 1.6;
      add(bk(bone, x, -len, z > 0 ? 0 : -0.5, x + 1, 0, z > 0 ? 0.5 : 0, i === 0 || i === 4 ? RED_D : i === 2 ? RED_L : RED, { bv: 0.06 }));
    }
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
    // pauldron: three stepped plates (dark with light edges), red cloth peeking under it
    add(bk(arm, -3.0, -1.2, -3.0, 3.0, 1.2, 3.0, RED_D, { bv: 0.2 }));
    add(bk(arm, -3.2, 1.0, -3.4, 3.4 * k > 0 ? 3.4 : 3.2, 3.2, 3.4, IRON, { bv: 0.3 }));
    add(bk(arm, k * -1.6, 2.9, -2.9, k * 3.2, 4.0, 2.9, IRON_L, { bv: 0.25 }));
    add(bk(arm, k * 0.2, 3.8, -2.2, k * 2.4, 4.8, 2.2, IRON_H, { bv: 0.25 }));
    add(bk(arm, k * 1.4, -0.6, -3.5, k * 4.2, 1.6, 3.5, IRON_M, { bv: 0.3 }));
    add(bk(arm, k * 2.2, -2.2, -3.2, k * 4.6, 0.0, 3.2, IRON, { bv: 0.3 }));
    add(bk(arm, k * 2.4, -2.4, -3.3, k * 4.7, -1.8, 3.3, IRON_L, { bv: 0.1 }));
    for (const z of [-2.2, 0, 2.2]) add(bk(arm, k * 4.1, 0.2, z - 0.3, k * 4.4, 0.8, z + 0.3, IRON_H, { bv: 0 })); // rivets
    // red sleeve, bare upper arm
    add(bk(arm, -2.1, -2.6, -2.1, 2.1, -0.6, 2.1, RED));
    add(bk(arm, -1.9, -5.0, -1.9, 1.9, -2.4, 1.9, SKIN));
    add(bk(arm, k * 0.2, -4.4, 1.6, k * 1.7, -2.8, 2.05, SKIN_L, { bv: 0.15 }));
    // plated bracer: dark core, grey bands, leather strap
    add(bk(fore, -2.15, -3.2, -2.15, 2.15, 0.8, 2.15, IRON_D));
    add(bk(fore, -2.35, 0.1, -2.35, 2.35, 0.9, 2.35, IRON_L, { bv: 0.12 }));
    add(bk(fore, -2.3, -1.4, -2.3, 2.3, -0.7, 2.3, IRON_M, { bv: 0.12 }));
    add(bk(fore, -2.25, -2.5, -2.25, 2.25, -1.9, 2.25, LEATHER, { bv: 0.1 }));
    add(bk(fore, k * 1.2, -1.2, -1.6, k * 2.5, 0.6, 1.6, IRON_H, { bv: 0.15 })); // outer plate
    add(bk(fore, -1.0, 0.1, -2.6, 1.0, 1.3, -1.9, IRON_L, { bv: 0.15 })); // elbow cop
    // dark glove, bare knuckles
    add(bk(hand, -1.9, -2.2, -1.9, 1.9, 1.0, 1.9, IRON_D));
    add(bk(hand, -1.6, -2.3, 1.3, 1.6, -1.3, 2.05, SKIN_D, { bv: 0.12 })); // fingers
    add(bk(hand, -2.0, 0.2, -2.0, 2.0, 0.9, 2.0, LEATHER_D, { bv: 0.1 }));
    // thigh: dark trousers, grey outer plate, leather strap
    add(bk(leg, -2.2, -7.2, -2.2, 2.2, 0.4, 2.2, IRON_D));
    add(bk(leg, k * 0.6, -3.8, -1.9, k * 2.5, 0.2, 1.9, IRON_M, { bv: 0.2 })); // tasset
    add(bk(leg, k * 0.6, -0.4, -2.0, k * 2.6, 0.4, 2.0, LEATHER, { bv: 0.1 }));
    add(bk(leg, -2.3, -5.4, -2.3, 2.3, -4.7, 2.3, LEATHER_D, { bv: 0.1 }));
    add(bk(leg, -1.6, -3.6, 2.0, 1.6, -1.2, 2.5, IRON, { bv: 0.15 }));
    // shin: grey knee plate, plated greave
    add(bk(shin, -2.1, -6.2, -2.1, 2.1, 0.4, 2.1, IRON));
    add(bk(shin, -1.9, -1.6, 1.8, 1.9, 1.4, 2.9, IRON_L, { bv: 0.3 }));
    add(bk(shin, -1.2, -0.8, 2.7, 1.2, 0.8, 3.1, IRON_H, { bv: 0.15 }));
    add(bk(shin, -2.25, -3.6, -2.25, 2.25, -2.9, 2.25, IRON_M, { bv: 0.1 }));
    add(bk(shin, -2.3, -5.4, -2.3, 2.3, -4.6, 2.3, LEATHER, { bv: 0.1 }));
    // boot (foot bone, ground at y -1): brown leather, grey toe cap, dark sole
    add(bk(foot, -2.4, -1.0, -2.6, 2.4, 0.6, 3.4, LEATHER));
    add(bk(foot, -2.4, -1.0, -2.6, 2.4, -0.6, 3.6, LEATHER_D, { bv: 0.08 }));
    add(bk(foot, -2.1, -0.7, 2.4, 2.1, 0.4, 3.9, IRON_L, { bv: 0.2 }));
    add(bk(foot, -2.5, 0.2, -2.7, 2.5, 0.9, 2.7, LEATHER_L, { bv: 0.12 }));
  }

  // ---------------------------------------------------------------- long torn cape with the trident
  const CAPE_W = 11;
  const CAPE_H = 20;
  const hem = [3.0, 0.8, 2.2, 4.0, 1.2, 0.4, 2.6, 1.0, 3.4, 0.6, 2.0];
  for (let i = 0; i < CAPE_W; i++) {
    const x = -CAPE_W / 2 + i;
    const c = i % 3 === 1 ? RED_D : i % 2 ? RED : RED_L;
    add(bk('capeA', x, -CAPE_H / 2, -0.5, x + 1, 0.4, 0.3, c, { bv: 0.08 }));
    const len = CAPE_H / 2 - hem[i];
    add(bk('capeB', x, -len, -0.5, x + 1, 0, 0.3, c, { bv: 0.08 }));
  }
  add(bk('capeA', -CAPE_W / 2 - 0.3, -0.6, -0.7, CAPE_W / 2 + 0.3, 0.8, 0.6, RED_D, { bv: 0.15 })); // collar fold
  // trident (light cloth patch on the back, facing -z)
  const tri = [
    '.e.....e.',
    '.e..e..e.',
    '.ee.e.ee.',
    '..eeeee..',
    '....e....',
    '...eee...',
    '....e....',
    '....e....',
    '....e....',
  ];
  tri.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) {
      if (row[i] !== 'e') continue;
      const x = -4.5 + i;
      const y = -2.2 - j;
      add(bk('capeA', x, y - 1, -0.75, x + 1, y, -0.45, EMBLEM, { bv: 0 }));
    }
  });

  add(...greatsword());

  // ---------------------------------------------------------------- serrated greatsword (blade along +z)
  function greatsword(): RigPart[] {
    const rows: string[] = [];
    // point
    rows.push('.....o.....', '....oso....', '....osmo...', '...osrmo...', '...osrmmo..');
    // blade: 7 wide with a tooth on each edge every third row, a glowing fuller in the middle
    const L = 20;
    for (let i = 0; i < L; i++) {
      const tooth = i % 3 === 1;
      const fuller = i > 0 && i < L - 1 ? 'r' : 'm';
      rows.push(tooth ? '.oosm' + fuller + 'mmoo.' : '..osm' + fuller + 'mmo..');
    }
    // arrow-head end of the fuller (toward the point) is drawn by the point rows; guard with prongs
    rows.push('.o.......o.', 'oIIIIyIIIIo', '.oIIoyoIIo.');
    // handle: room for two fists, then the pommel with its gem
    for (let i = 0; i < 7; i++) rows.push(i % 2 ? '....obo....' : '....oBo....');
    rows.push('...oIyIo...', '....oIo....');
    const pivotRow = rows.length - 2 - 7 + 1;
    return pixelItem(rows, { o: 0x26252b, s: IRON_L, m: 0x55545c, r: RUNE, I: IRON_D, y: RUNE, b: LEATHER, B: LEATHER_D }, {
      b: 'gripR',
      at: GRIP,
      pivot: [5, pivotRow],
      px: SPX,
      th: 1.0,
      u: '+y',
      v: '+z',
      glow: 'ry',
      thick: { I: 1.5, y: 1.7, b: 1.3, B: 1.4, o: 1.0 },
    });
  }

  return {
    id: 'berserker',
    scale: MC_SCALE,
    posScale: MC_POS_SCALE,
    props: pr,
    parts: P,
    springs: {
      capeA: { parent: 'chest', at: [0, 7.4, -3.0], kind: 'cape', k: 0.9 },
      capeB: { parent: 'capeA', at: [0, -CAPE_H / 2, 0], kind: 'cape', k: 0.9 },
      skirtF: { parent: 'hips', at: [0, 1.0, 2.7], kind: 'flap' },
      skirtB: { parent: 'hips', at: [0, 1.0, -2.7], kind: 'flap' },
    },
    tip: { bone: 'gripR', p: [GRIP[0], GRIP[1], GRIP[2] + 27 * SPX] },
    grip: { R: { at: GRIP, rot: [-8, -15, -33] }, L: { at: GRIP } },
    anim: {
      weapon: 'hammer',
      gait: { cadence: 0.4, stride: 36, knee: 46, armSwing: 6, elbow: -18, bounce: 0.85, lean: 9, sway: 5, twist: 7, heavy: 1, headBob: 2, armOut: 16, idle: 0.9 },
      stance: { chest: [-3, -10, 0], spine: [0, -4, 0], head: [0, 12, 0], armR: [-50, -24, 18], foreR: [-40, 0, 0], handR: [-30, 12, -30], armL: [-38, 24, -10], foreL: [-30, 0, 0], legL: [-4, 0, 6], legR: [4, 0, -6] },
      stanceRun: 1,
      victory: 'raise',
      twoHand: { hilt: BERSERKER_HILT },
    },
  };
}
