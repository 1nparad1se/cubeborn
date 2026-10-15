import type { HeroRigDef } from '../../render/rig/HeroRig';
import type { RigPart } from '../../render/rig/shapes';
import { bk, jr } from './blockKit';
import { GRIP, MC_POS_SCALE, MC_SCALE, mcProps, pixelItem, type Side } from './mcKit';

/**
 * Ranger, a forest hunter built as a detailed block model (many small bevelled blocks, no pixel
 * skins): a peaked green hood with a light rim and a hawk feather, a short ragged green shoulder
 * cape, a laced brown leather jerkin over a moss tunic, a rust scarf, a diagonal quiver strap and a
 * belt with a brass buckle, a leather bracer on the bow arm, gloves, tall boots with folded cuffs,
 * a quiver of red-fletched arrows on the back and a pixel-art recurve bow in the left hand.
 */

const SKIN = 0xe2b28c;
const SKIN_D = 0xc4926e;
const HAIR = 0x7a4a24;
const HAIR_D = 0x5a3418;
const HOOD = 0x3f7f4a;
const HOOD_L = 0x58a060;
const HOOD_D = 0x2a5a34;
const TUNIC = 0x5a7a3a;
const TUNIC_D = 0x46602c;
const LEATHER = 0x7a5030;
const LEATHER_L = 0x9a6a40;
const LEATHER_D = 0x4e3220;
const SCARF = 0xb8582a;
const SCARF_D = 0x864020;
const PANTS = 0x5e5a3a;
const PANTS_D = 0x48452c;
const BOOT = 0x4a3020;
const SOLE = 0x2a1c12;
const BRASS = 0xd4a040;
const WOOD = 0x8a5a2e;
const WOOD_L = 0xb07a40;
const FLETCH = 0xc83a2a;

export function rangerRig(): HeroRigDef {
  const pr = mcProps();
  const P: RigPart[] = [];
  const add = (...a: RigPart[]) => P.push(...a);

  // ---------------------------------------------------------------- head: face, hair in the hood opening
  add(bk('head', -3.4, 0.2, -3.2, 3.4, 6.4, 3.6, SKIN));
  add(bk('head', -1.6, -1.2, -1.6, 1.6, 0.6, 1.6, SKIN_D));
  add(bk('head', -0.6, 2.2, 3.5, 0.6, 3.6, 4.05, SKIN_D, { bv: 0.1 }));
  add(bk('head', -1.0, 1.3, 3.55, 1.0, 1.7, 3.85, 0xa0604a, { bv: 0 }));
  add(bk('head', -2.8, 0.2, 2.9, 2.8, 1.0, 3.75, SKIN_D, { bv: 0.1 }));
  for (const k of [-1, 1]) {
    add(bk('head', k * 0.8, 4.5, 3.45, k * 2.8, 5.0, 3.9, HAIR_D, { bv: 0.08 }));
    add(bk('head', k * 0.9, 3.6, 3.45, k * 2.6, 4.4, 3.75, 0xf2ece4, { bv: 0 }));
    add(bk('head', k * 0.9, 3.6, 3.6, k * 1.6, 4.4, 3.85, 0x3a8a3a, { bv: 0 }));
  }
  // swept fringe and side locks
  for (let i = 0; i < 6; i++) add(bk('head', -3 + i, 5.0 + jr(i) * 0.6, 3.3, -2 + i, 6.4, 4.0, i % 2 ? HAIR : HAIR_D, { bv: 0.1 }));
  for (const k of [-1, 1]) add(bk('head', k * 2.6, 1.4, 2.4, k * 3.5, 5.4, 3.9, HAIR, { bv: 0.12 }));

  // peaked hood: shell, light rim around the face opening, peak trailing back
  add(bk('head', -4.4, 6.2, -4.4, 4.4, 8.8, 4.2, HOOD));
  add(bk('head', -4.4, 0.0, -4.4, 4.4, 6.4, -1.8, HOOD));
  for (const k of [-1, 1]) {
    add(bk('head', k * 3.5, 0.0, -4.4, k * 4.45, 6.4, 3.6, HOOD));
    add(bk('head', k * 3.4, 0.0, 3.4, k * 4.6, 7.0, 4.6, HOOD_L, { bv: 0.15 })); // rim sides
    add(bk('head', k * 4.4, 1.0, -3.6, k * 4.6, 6.0, 1.0, HOOD_D, { bv: 0 })); // fold
  }
  add(bk('head', -4.6, 6.4, 3.6, 4.6, 7.6, 4.7, HOOD_L, { bv: 0.15 })); // rim top
  add(bk('head', -3.6, 8.6, -3.6, 3.6, 9.4, 3.2, HOOD_L, { bv: 0.2 }));
  add(bk('head', -0.5, 8.8, -4.0, 0.5, 9.6, 3.0, HOOD_D, { bv: 0.1 })); // seam
  add(bk('head', -3.0, 5.0, -6.2, 3.0, 8.6, -4.0, HOOD, { r: [-24, 0, 0] })); // peak
  add(bk('head', -2.0, 4.0, -7.6, 2.0, 7.0, -5.8, HOOD_D, { r: [-24, 0, 0], bv: 0.25 }));
  // hawk feather on the hood (accC bob)
  add(bk('accC', -0.25, -0.6, -0.5, 0.25, 4.6, 0.5, 0xe8e0d0, { r: [-20, 0, -20], bv: 0.08 }));
  add(bk('accC', -0.3, 1.0, -0.55, 0.3, 1.5, 0.55, 0x8a5a3a, { r: [-20, 0, -20], bv: 0 }));
  add(bk('accC', -0.3, 2.8, -0.55, 0.3, 3.3, 0.55, 0x6a4a2a, { r: [-20, 0, -20], bv: 0 }));
  add(bk('accC', -0.3, 4.2, -0.55, 0.3, 4.9, 0.55, 0x8a5a3a, { r: [-20, 0, -20], bv: 0 }));

  // ---------------------------------------------------------------- chest: tunic, jerkin, lacing, scarf, strap
  add(bk('chest', -4.0, 0, -2.0, 4.0, 8.0, 2.0, TUNIC));
  add(bk('chest', -4.2, 0, -2.3, 4.2, 6.4, 2.3, LEATHER));
  for (const k of [-1, 1]) {
    add(bk('chest', k * 0.4, 0.2, 2.2, k * 3.8, 6.2, 2.6, LEATHER_L, { bv: 0.15 })); // jerkin panels
    add(bk('chest', k * 3.6, 0.2, -2.4, k * 4.35, 6.2, 2.4, LEATHER_D, { bv: 0.1 }));
  }
  add(bk('chest', -0.4, 0.2, 2.25, 0.4, 6.2, 2.5, LEATHER_D, { bv: 0 }));
  for (let i = 0; i < 4; i++) add(bk('chest', -0.9, 1.0 + i * 1.3, 2.5, 0.9, 1.3 + i * 1.3, 2.75, BRASS, { bv: 0 })); // lacing
  // rust scarf wrapped at the neck, a hanging end
  add(bk('chest', -3.6, 6.2, -2.6, 3.6, 8.6, 2.8, SCARF));
  add(bk('chest', -3.3, 8.2, -2.4, 3.3, 9.0, 2.5, SCARF_D, { bv: 0.15 }));
  add(bk('chest', -2.6, 3.2, 2.6, -1.0, 6.6, 3.1, SCARF, { bv: 0.12 }));
  add(bk('chest', -2.6, 2.6, 2.65, -1.6, 3.4, 3.05, SCARF_D, { bv: 0.08 }));
  // quiver strap: right shoulder (x<0 is right) to left hip, front and back
  for (let i = 0; i < 8; i++) {
    const y = 6.6 - i * 0.9;
    const x = 3.4 - i * 0.95;
    add(bk('chest', x - 0.6, y - 0.5, 2.55, x + 0.6, y + 0.5, 3.0, i & 1 ? LEATHER_D : 0x3e2818, { bv: 0.08 }));
    add(bk('chest', x - 0.6, y - 0.5, -3.0, x + 0.6, y + 0.5, -2.5, LEATHER_D, { bv: 0.08 }));
  }
  add(bk('chest', 2.0, 4.6, 2.9, 3.0, 5.6, 3.2, BRASS, { bv: 0.06 }));
  // spine: jerkin skirt and tunic
  add(bk('spine', -3.8, 0.9, -2.0, 3.8, 3.9, 2.0, TUNIC));
  add(bk('spine', -4.1, 2.0, -2.3, 4.1, 3.9, 2.3, LEATHER));
  add(bk('spine', -0.4, 2.0, 2.25, 0.4, 3.9, 2.45, LEATHER_D, { bv: 0 }));

  // ---------------------------------------------------------------- hips: belt with a brass buckle, tunic skirt, pouch
  add(bk('hips', -4.1, -0.6, -2.2, 4.1, 2.0, 2.2, TUNIC));
  add(bk('hips', -4.4, 1.6, -2.5, 4.4, 2.8, 2.5, LEATHER_D));
  add(bk('hips', -0.9, 1.4, 2.4, 0.9, 3.0, 2.85, BRASS, { bv: 0.1 }));
  add(bk('hips', -0.4, 1.8, 2.7, 0.4, 2.6, 2.95, LEATHER_D, { bv: 0 }));
  for (let i = 0; i < 8; i++) {
    const x = -4.2 + i * 1.05;
    add(bk('hips', x, -1.6 - jr(i) * 0.8, -2.35, x + 1.05, 1.7, 2.35, i % 2 ? TUNIC_D : TUNIC, { bv: 0.08 }));
  }
  add(bk('hips', -4.3, -0.6, 0.6, -3.0, 1.8, 2.8, LEATHER, { bv: 0.2 })); // pouch on the right hip
  add(bk('hips', -4.35, 1.0, 0.5, -2.95, 1.9, 2.9, LEATHER_L, { bv: 0.12 }));

  // ---------------------------------------------------------------- limbs, mirrored
  for (const s of ['L', 'R'] as Side[]) {
    const k = s === 'L' ? 1 : -1;
    const arm = 'arm' + s;
    const fore = 'fore' + s;
    const hand = 'hand' + s;
    const leg = 'leg' + s;
    const shin = 'shin' + s;
    const foot = 'foot' + s;
    // tunic sleeve, leather shoulder guard
    add(bk(arm, -2.0, -5.0, -2.0, 2.0, 2.0, 2.0, TUNIC));
    add(bk(arm, -2.2, 0.0, -2.3, k * 2.6 > 0 ? 2.6 : 2.2, 2.4, 2.3, LEATHER, { bv: 0.25 }));
    add(bk(arm, k * 0.4, 1.8, -1.9, k * 2.4, 2.7, 1.9, LEATHER_L, { bv: 0.2 }));
    add(bk(arm, -2.1, -0.6, -2.1, 2.1, -0.1, 2.1, LEATHER_D, { bv: 0.06 }));
    add(bk(arm, -2.05, -5.0, -2.05, 2.05, -4.4, 2.05, TUNIC_D, { bv: 0.06 }));
    // forearm: bracer with brass studs on the bow arm, a rolled cuff on the draw arm
    add(bk(fore, -1.9, -3.0, -1.9, 1.9, 1.0, 1.9, TUNIC));
    if (s === 'L') {
      add(bk(fore, -2.2, -3.0, -2.2, 2.2, 0.4, 2.2, LEATHER));
      add(bk(fore, -2.25, 0.0, -2.25, 2.25, 0.5, 2.25, LEATHER_L, { bv: 0.06 }));
      add(bk(fore, -2.25, -3.1, -2.25, 2.25, -2.6, 2.25, LEATHER_D, { bv: 0.06 }));
      for (const y of [-2.0, -0.8]) add(bk(fore, k * 2.1, y, -0.9, k * 2.45, y + 0.5, -0.3, BRASS, { bv: 0 }), bk(fore, k * 2.1, y, 0.3, k * 2.45, y + 0.5, 0.9, BRASS, { bv: 0 }));
      add(bk(fore, -1.8, -2.4, -2.5, 1.8, -0.4, -2.1, LEATHER_L, { bv: 0.1 })); // inner arm guard
    } else {
      add(bk(fore, -2.1, -0.4, -2.1, 2.1, 0.7, 2.1, TUNIC_D, { bv: 0.15 }));
      add(bk(fore, -2.1, -3.0, -2.1, 2.1, -2.2, 2.1, LEATHER_D, { bv: 0.08 }));
    }
    // glove
    add(bk(hand, -1.9, -2.1, -1.9, 1.9, 1.0, 1.9, LEATHER_D));
    add(bk(hand, -1.6, -2.2, 1.3, 1.6, -1.2, 2.05, 0x3e2818, { bv: 0.12 }));
    add(bk(hand, -2.0, 0.3, -2.0, 2.0, 1.0, 2.0, LEATHER, { bv: 0.1 }));
    // trousers, knee patch
    add(bk(leg, -2.0, -6.0, -2.0, 2.0, 0.2, 2.0, PANTS));
    add(bk(leg, k * 0.5, -5.0, -2.1, k * 2.15, -1.0, 2.1, PANTS_D, { bv: 0.15 }));
    add(bk(leg, -2.1, -0.4, -2.1, 2.1, 0.3, 2.1, TUNIC_D, { bv: 0.06 }));
    add(bk(shin, -1.95, -1.0, -1.95, 1.95, 1.0, 1.95, PANTS));
    add(bk(shin, -1.4, -0.2, 1.8, 1.4, 1.2, 2.3, PANTS_D, { bv: 0.15 }));
    // tall boots with a folded cuff, laces, sole
    add(bk(shin, -2.1, -5.0, -2.1, 2.1, -0.9, 2.1, BOOT));
    add(bk(shin, -2.35, -1.6, -2.35, 2.35, -0.4, 2.35, LEATHER_L, { bv: 0.15 }));
    add(bk(shin, -2.3, -1.9, -2.3, 2.3, -1.5, 2.3, LEATHER, { bv: 0.06 }));
    for (let i = 0; i < 3; i++) add(bk(shin, -0.8, -4.2 + i * 0.9, 2.05, 0.8, -3.9 + i * 0.9, 2.3, LEATHER_L, { bv: 0 }));
    add(bk(foot, -2.1, -1.0, -2.3, 2.1, 0.6, 3.2, BOOT));
    add(bk(foot, -1.9, -0.6, 2.0, 1.9, 0.4, 3.6, LEATHER, { bv: 0.2 }));
    add(bk(foot, -2.2, -1.0, -2.4, 2.2, -0.6, 3.6, SOLE, { bv: 0.08 }));
  }

  // ---------------------------------------------------------------- short ragged shoulder cape
  for (let i = 0; i < 9; i++) {
    const x = -4.5 + i;
    const len = 7.4 - (i % 3 === 1 ? 1.2 : 0) - jr(i + 7) * 0.8;
    add(bk('capeA', x, -len, -0.5, x + 1, 0.4, 0.3, i % 3 === 1 ? HOOD_D : i % 2 ? HOOD : HOOD_L, { bv: 0.08 }));
  }
  add(bk('capeA', -4.8, -0.8, -0.7, 4.8, 0.8, 0.6, HOOD_L, { bv: 0.15 }));
  add(bk('capeA', -0.4, -6.4, -0.75, 0.4, -0.6, -0.45, HOOD_D, { bv: 0 }));

  // ---------------------------------------------------------------- quiver with red-fletched arrows (accB)
  add(bk('accB', -1.5, -6.5, -1.5, 1.5, 2.5, 1.5, LEATHER));
  add(bk('accB', -1.7, 1.6, -1.7, 1.7, 2.6, 1.7, LEATHER_L, { bv: 0.12 }));
  add(bk('accB', -1.65, -6.6, -1.65, 1.65, -5.8, 1.65, LEATHER_D, { bv: 0.1 }));
  add(bk('accB', -1.6, -2.2, -1.6, 1.6, -1.6, 1.6, LEATHER_D, { bv: 0.06 }));
  add(bk('accB', -1.2, 2.4, -1.2, 1.2, 2.7, 1.2, LEATHER_D, { bv: 0 }));
  [-0.8, 0, 0.8].forEach((x, i) => {
    const y = 3.6 + (i % 2) * 0.5;
    const z = 0.4 * (i - 1);
    add(bk('accB', x - 0.15, 2.4, z - 0.15, x + 0.15, y, z + 0.15, WOOD_L, { bv: 0 }));
    add(bk('accB', x - 0.4, y - 0.4, z - 0.15, x + 0.4, y + 1.6, z + 0.15, FLETCH, { bv: 0 }));
    add(bk('accB', x - 0.15, y - 0.4, z - 0.4, x + 0.15, y + 1.6, z + 0.4, 0xf0e8dc, { bv: 0 }));
  });

  // ---------------------------------------------------------------- recurve bow (riser at the fist, string on +y) and the nocked arrow
  const rows = [
    '...ww.',
    '...wwS',
    '...w.S',
    '..ww.S',
    '..w..S',
    '..w..S',
    '.ww..S',
    '.w...S',
    'ww...S',
    'wB...S',
    'LL...S',
    'LL...S',
    'LL...S',
    'wB...S',
    'ww...S',
    '.w...S',
    '.ww..S',
    '..w..S',
    '..w..S',
    '..ww.S',
    '...w.S',
    '...wwS',
    '...ww.',
  ];
  add(...pixelItem(rows, { w: WOOD, B: WOOD_L, L: LEATHER_D, S: 0xece4d4 }, { b: 'gripL', at: GRIP, pivot: [0.5, 11], px: 0.9, th: 0.8, u: '+y', v: '+z', thick: { S: 0.25, L: 1.3 } }));
  add(...pixelItem(['hhaaaaaff'], { h: 0xc8d2dc, a: WOOD_L, f: FLETCH }, { b: 'gripL', at: [GRIP[0] + 0.7, GRIP[1], GRIP[2]], pivot: [2, 0], px: 0.9, th: 0.35, u: '+y', v: '+z', grp: 'arrow' }));

  return {
    id: 'ranger',
    scale: MC_SCALE,
    posScale: MC_POS_SCALE,
    props: pr,
    parts: P,
    springs: {
      capeA: { parent: 'chest', at: [0, 7.8, -2.55], kind: 'cape', k: 1.1 },
      capeB: { parent: 'capeA', at: [0, -8, 0], kind: 'cape', k: 1.0 },
      accB: { parent: 'chest', at: [-1.2, 4.0, -3.6], kind: 'bob', k: 1.8, rest: -6 },
      accC: { parent: 'head', at: [3.6, 7.8, -2.5], kind: 'bob', k: 0.9 },
    },
    tip: { bone: 'gripL', p: [GRIP[0] + 0.7, GRIP[1] - 2 * 0.9, GRIP[2]] },
    grip: { L: { at: GRIP }, R: { at: GRIP } },
    hidden: ['arrow'],
    anim: {
      weapon: 'bow',
      gait: { cadence: 0.56, stride: 40, knee: 62, armSwing: 24, elbow: 30, bounce: 0.55, lean: 14, sway: 2, twist: 9, heavy: 0, headBob: 0.8, armOut: 3, idle: 0.9 },
      stance: { chest: [5, -6, 0], head: [-3, 6, 0], armL: [-12, 0, 7], foreL: [-22, 0, 0], handL: [-62, 0, 0], armR: [-6, 0, -4], foreR: [-28, 0, 0], handR: [0, 0, -6] },
      stanceRun: 0.85,
      victory: 'salute',
    },
  };
}
