import type { HeroRigDef } from '../../render/rig/HeroRig';
import type { RigPart } from '../../render/rig/shapes';
import { shade, type FaceId, type Pix } from '../../render/rig/skins';
import { backCols, cube, GRIP, humanoid, inner, isSide, MC_POS_SCALE, MC_SCALE, mcProps, outer, pixelItem, tex, type Side } from './mcKit';

/**
 * Berserker, after the character sheet «Берсерк — полный 3D дизайн персонажа»: black spiky hair,
 * glowing red eyes, a red scarf over massive layered grey pauldrons, a bare chest crossed by a
 * leather strap with an iron clasp, a wide belt with a square buckle, a narrow red tabard between
 * riveted leather tassets, dark plated arms and legs with grey knee guards and toe caps, and a
 * long torn red cape with a white trident on the back. He holds a dark serrated greatsword with a
 * glowing red fuller and a red gem in the guard and the pommel, in both hands.
 */

// palette (sampled from the sheet)
const SKIN = 0xe0a487;
const SKIN_D = 0xc4826a;
const SKIN_L = 0xeeb89c;
const HAIR = 0x2c2a31;
const HAIR_L = 0x46434d;
const HAIR_D = 0x1b1a1f;
const EYE = 0xff2a22;
const IRON_D = 0x34333a;
const IRON = 0x4e4d56;
const IRON_M = 0x6c6b74;
const IRON_L = 0x9a99a2;
const IRON_H = 0xbab9c2;
const RED = 0xc81c26;
const RED_L = 0xe5323a;
const RED_D = 0x86111a;
const LEATHER = 0x6e3a28;
const LEATHER_L = 0x8a5038;
const LEATHER_D = 0x45231a;
const EMBLEM = 0xd9d2d4;
const EMBLEM_D = 0xaaa2a6;
const RUNE = 0xff2418;

/** Sword texel size: the handle has room for both fists. */
const SPX = 1.0;
/** Where the left fist closes on the handle (gripR space): below the right fist, toward the pommel. */
export const BERSERKER_HILT: [number, number, number] = [0, 0, -3.4 * SPX];

export function berserkerRig(): HeroRigDef {
  const pr = mcProps();

  // ---------------------------------------------------------------- head: skin, hair, glowing eyes
  const head = (f: FaceId, g: Pix) => {
    g.fill(SKIN, 0.035);
    if (f === 'T') {
      g.fill(HAIR, 0.12);
      return;
    }
    if (f === 'D') {
      g.fill(SKIN_D);
      return;
    }
    if (f === 'F') {
      // jagged fringe down to the brows, dark side locks framing the face
      g.nrect(0, 0, 8, 2, HAIR, 0.1);
      g.set(1, 2, HAIR).set(3, 2, HAIR_D).set(6, 2, HAIR).set(0, 2, HAIR).set(7, 2, HAIR);
      g.nrect(0, 3, 1, 3, HAIR, 0.1).nrect(7, 3, 1, 3, HAIR, 0.1);
      // heavy brows, red eyes (glow parts sit on top), cheek shadow, nose, set mouth, chin
      g.rect(1, 3, 2, 1, HAIR_D).rect(5, 3, 2, 1, HAIR_D);
      g.rect(1, 4, 2, 1, 0x7a1010).rect(5, 4, 2, 1, 0x7a1010);
      g.rect(3, 5, 2, 1, SKIN_D).set(1, 5, SKIN_L).set(6, 5, SKIN_L);
      g.rect(3, 6, 2, 1, 0x8a4a3a).set(2, 6, SKIN_D).set(5, 6, SKIN_D);
      g.hline(7, SKIN_D, 1, 7);
    } else if (f === 'B') {
      g.fill(HAIR, 0.12);
      for (let x = 0; x < 8; x += 2) g.set(x, 7, HAIR_D);
    } else {
      // hair over the back two thirds and the top, an ear in front of it
      g.nrect(0, 0, 8, 3, HAIR, 0.12);
      const [a, b] = backCols(f, 8, 5);
      g.nrect(a, 0, b - a, 8, HAIR, 0.12);
      const ear = f === 'L' ? 2 : 5;
      g.set(ear, 4, SKIN_D).set(ear, 5, SKIN_D);
      g.set(f === 'L' ? 0 : 7, 7, SKIN_D);
    }
  };

  /** Hair volume over the head (inflated layer): a ragged mass on top, sides and back. */
  const hair = (f: FaceId, g: Pix) => {
    g.rect(0, 0, 8, 8, -1);
    if (f === 'T') {
      g.fill(HAIR, 0.14);
      return;
    }
    if (f === 'D') return;
    const jag = [2, 1, 2, 3, 1, 2, 1, 2];
    if (f === 'F') {
      for (let x = 0; x < 8; x++) g.nrect(x, 0, 1, jag[x], HAIR, 0.12);
      g.nrect(0, 0, 1, 4, HAIR, 0.1).nrect(7, 0, 1, 4, HAIR, 0.1);
    } else if (f === 'B') {
      for (let x = 0; x < 8; x++) g.nrect(x, 0, 1, 7 + (x % 2), HAIR, 0.12);
    } else {
      const [a, b] = backCols(f, 8, 5);
      for (let x = 0; x < 8; x++) g.nrect(x, 0, 1, x >= a && x < b ? 6 + (x % 2) : jag[x] + 1, HAIR, 0.12);
    }
  };

  // ---------------------------------------------------------------- torso: bare chest, strap, belt
  const torso = (f: FaceId, g: Pix) => {
    g.fill(SKIN, 0.035);
    if (f === 'T' || f === 'D') {
      g.fill(f === 'T' ? RED : LEATHER_D, 0.08);
      return;
    }
    if (f === 'F') {
      // pecs and a hint of abs
      g.hline(3, SKIN_D, 1, 3).hline(3, SKIN_D, 5, 7).set(3, 2, SKIN_D).set(4, 2, SKIN_D);
      g.set(3, 4, SKIN_D).set(4, 5, SKIN_D).set(3, 6, SKIN_D);
      g.set(1, 1, SKIN_L).set(6, 1, SKIN_L);
      // leather strap from the right shoulder (viewer's left) to the left hip
      for (let i = 0; i < 8; i++) {
        const x = Math.round(i * 0.95);
        g.set(x, i, LEATHER).set(x + 1, i, LEATHER_D);
      }
      // rivet on the left pec
      g.set(6, 2, IRON_L);
    } else if (f === 'B') {
      g.fill(SKIN_D, 0.04);
      for (let i = 0; i < 8; i++) g.set(7 - i, i, LEATHER_D);
    } else {
      g.shadeV(1, 0.9);
    }
    // wide belt with a square iron buckle and rivets
    g.nrect(0, 7, g.w, 2, LEATHER, 0.08).hline(7, LEATHER_L).hline(8, LEATHER_D);
    if (f === 'F') {
      g.rect(2, 7, 4, 2, IRON_L).rect(3, 7, 2, 2, LEATHER_D).set(2, 8, IRON_M).set(5, 8, IRON_M);
      g.set(0, 8, IRON_H).set(7, 8, IRON_H);
    } else g.set(1, 8, IRON_L).set(g.w - 2, 8, IRON_L);
    // hips: dark plated leather under the belt
    g.nrect(0, 9, g.w, 3, LEATHER_D, 0.1);
    if (f === 'F') g.rect(3, 9, 2, 3, RED);
  };

  // ---------------------------------------------------------------- arms: red sleeve, bare biceps, plated bracers, skin fists
  const arm = (side: Side) => (f: FaceId, g: Pix) => {
    g.fill(SKIN, 0.035);
    if (f === 'T') {
      g.fill(RED);
      return;
    }
    if (f === 'D') {
      g.fill(IRON_D);
      return;
    }
    // red cloth sleeve under the pauldron
    g.nrect(0, 0, g.w, 3, RED, 0.08).hline(2, RED_D);
    if (f === inner(side)) g.nrect(0, 0, g.w, 3, SKIN_D, 0.04);
    // biceps
    if (f === outer(side) || f === 'F') g.set(1, 4, SKIN_L).set(2, 4, SKIN_L);
    // plated bracer: dark iron rings with light plate edges
    g.nrect(0, 5, g.w, 5, IRON_D, 0.1);
    g.hline(5, IRON_M).hline(7, IRON_L).hline(8, IRON).hline(9, IRON_M);
    if (f === outer(side)) g.set(1, 6, IRON_L).set(2, 8, IRON_H);
    // dark leather glove over the fist
    g.nrect(0, 10, g.w, 2, IRON_D, 0.08).hline(10, LEATHER_D);
    if (f === 'F') g.set(1, 11, IRON).set(2, 11, IRON);
  };

  // ---------------------------------------------------------------- legs: dark plated trousers, boots
  const leg = (side: Side) => (f: FaceId, g: Pix) => {
    g.fill(IRON_D, 0.1);
    if (f === 'D') {
      g.fill(0x222126);
      return;
    }
    if (f === 'T') return;
    // quilted plates on the thigh
    g.hline(1, IRON).hline(4, IRON);
    if (f === 'F' || f === outer(side)) g.set(1, 2, IRON_M).set(2, 3, IRON_M);
    // shin band and boot
    g.hline(7, IRON_M);
    g.nrect(0, 8, 4, 4, IRON, 0.08).hline(8, IRON_L).hline(11, 0x222126);
    if (f === 'F') g.rect(1, 9, 2, 1, IRON_L);
  };

  // ---------------------------------------------------------------- pieces
  const plate = (base: number, hi: number, lo: number) => (f: FaceId, g: Pix) => {
    g.fill(f === 'T' ? hi : f === 'D' ? lo : base, 0.05);
    if (isSide(f)) g.hline(0, hi).hline(g.h - 1, lo);
  };
  const pauldronA = tex('bz2.pauldA', [7, 3, 7], (f, g) => {
    plate(IRON_L, IRON_H, IRON_M)(f, g);
    if (f === 'T') g.border(IRON_M).set(2, 2, IRON_H).set(4, 4, IRON_H);
  });
  const pauldronB = tex('bz2.pauldB', [6, 3, 7], plate(IRON_M, IRON_L, IRON));
  const pauldronC = tex('bz2.pauldC', [5, 2, 6], plate(IRON, IRON_M, IRON_D));
  const ridge = tex('bz2.ridge', [1, 2, 4], plate(IRON_L, IRON_H, IRON_M));
  const scarf = tex('bz2.scarf', [12, 3, 7], (f, g) => {
    g.fill(RED, 0.08);
    if (f === 'T') g.rect(2, 1, 6, 4, RED_D);
    if (isSide(f)) {
      g.hline(0, RED_L);
      // ragged lower edge
      for (let x = 0; x < g.w; x += 3) g.set(x, 2, -1);
    }
  });
  const bracer = tex('bz2.bracer', [4, 1, 4], plate(IRON_M, IRON_L, IRON_D));
  const elbow = tex('bz2.elbow', [2, 2, 2], plate(IRON_L, IRON_H, IRON));
  const knee = tex('bz2.knee', [4, 3, 1], (f, g) => {
    plate(IRON_L, IRON_H, IRON_M)(f, g);
    if (f === 'F') g.set(2, 1, IRON_H).set(1, 2, IRON_M).set(3, 2, IRON_M);
  });
  const toe = tex('bz2.toe', [4, 2, 1], plate(IRON_M, IRON_L, IRON_D));
  const cuff = tex('bz2.cuff', [4, 1, 4], plate(IRON_M, IRON_L, IRON_D));
  const tasset = tex('bz2.tasset', [2, 5, 4], (f, g) => {
    g.fill(LEATHER_D, 0.1);
    if (isSide(f)) {
      g.hline(0, LEATHER).hline(g.h - 1, 0x2e1810);
      g.set(0, 1, IRON_L).set(g.w - 1, 3, IRON_L);
    }
  });
  const clasp = tex('bz2.clasp', [2, 2, 1], (f, g) => {
    g.fill(IRON_L, 0.04);
    if (f === 'F') g.set(0, 0, IRON_H).set(1, 1, IRON_H).set(1, 0, IRON_M).set(0, 1, IRON_M);
  });
  const tabard = tex('bz2.tabard', [5, 9, 1], (f, g) => {
    g.fill(RED, 0.07);
    if (f === 'F' || f === 'B') {
      g.vline(0, RED_D).hline(0, RED_D);
      g.set(0, 8, -1).set(2, 8, -1).set(4, 7, -1).set(4, 8, -1);
    }
  });
  // long red cape, torn at the hem, white trident across the shoulder blades
  const CAPE_W = 10;
  const CAPE_H = 20;
  const cape = tex('bz2.cape', [CAPE_W, CAPE_H, 1], (f, g) => {
    g.fill(RED, 0.07);
    if (!isSide(f)) return;
    for (let x = 0; x < g.w; x++) {
      // vertical folds
      if (x % 3 === 1) g.vline(x, shade(RED, 0.88), 0, g.h);
    }
    g.hline(0, RED_L);
    // torn hem: uneven tongues of cloth
    const hem = [2, 0, 3, 1, 0, 2, 4, 0, 1, 3];
    for (let x = 0; x < g.w; x++) for (let y = g.h - hem[x]; y < g.h; y++) g.set(f === 'B' ? x : g.w - 1 - x, y, -1);
    if (f === 'B') {
      g.pattern(1, 3, [
        '.e.....e',
        '.e..e..e',
        '.ee.e.ee',
        '..eeeee.',
        '....e...',
        '....e...',
        '...eee..',
        '....e...',
        '....e...',
        '....d...',
      ], { e: EMBLEM, d: EMBLEM_D });
    }
  });
  const hairSpike = (n: string, size: [number, number, number], c = HAIR) => tex(n, size, (f, g) => {
    g.fill(f === 'T' ? HAIR_L : c, 0.1);
    if (isSide(f)) g.hline(g.h - 1, HAIR_D);
  });
  const spikeTall = hairSpike('bz2.spikeT', [2, 4, 2]);
  const spikeMid = hairSpike('bz2.spikeM', [2, 3, 2]);
  const spikeSmall = hairSpike('bz2.spikeS', [2, 2, 2], HAIR_L);
  const sideLock = hairSpike('bz2.lock', [1, 4, 3]);

  const parts: RigPart[] = [
    ...humanoid({ name: 'bz2', head, hat: hair, body: torso, arm, leg }),
    // glowing eyes in front of the face
    { b: 'head', p: [-1.9, 3.5, 4.05], d: [1.3, 0.7, 0.2], c: EYE, g: true, flat: true },
    { b: 'head', p: [1.9, 3.5, 4.05], d: [1.3, 0.7, 0.2], c: EYE, g: true, flat: true },
    // spiky crown of hair: tall tuft in the middle, shorter spikes around it
    cube('head', [0, 9.6, 0.4], spikeTall),
    cube('head', [-2.4, 9.0, -0.6], spikeMid, { r: [0, 0, 14] }),
    cube('head', [2.4, 9.0, -0.6], spikeMid, { r: [0, 0, -14] }),
    cube('head', [-3.7, 8.4, 2.2], spikeSmall, { r: [0, 0, 26] }),
    cube('head', [3.7, 8.4, 2.2], spikeSmall, { r: [0, 0, -26] }),
    cube('head', [0, 8.8, -2.8], spikeMid, { r: [-18, 0, 0] }),
    cube('head', [-2.2, 8.4, -3.4], spikeSmall, { r: [-22, 0, 10] }),
    cube('head', [2.2, 8.4, -3.4], spikeSmall, { r: [-22, 0, -10] }),
    cube('head', [-4.6, 5.6, 0.6], sideLock),
    cube('head', [4.6, 5.6, 0.6], sideLock),
    // red scarf around the neck, its ends hanging over the chest
    cube('chest', [0, 8.0, 0], scarf),
    // iron clasp on the strap
    cube('chest', [-2.4, 5.7, 2.15], clasp),
    // pauldrons: three stacked plates and a raised ridge on the outer edge
    ...(['L', 'R'] as Side[]).flatMap((s) => {
      const k = s === 'L' ? 1 : -1;
      return [
        cube('arm' + s, [k * 0.3, 2.0, 0], pauldronA, { r: [0, 0, -k * 8] }),
        cube('arm' + s, [k * 1.2, -0.2, 0], pauldronB, { r: [0, 0, -k * 16] }),
        cube('arm' + s, [k * 1.8, -1.9, 0], pauldronC, { r: [0, 0, -k * 24] }),
        cube('arm' + s, [k * 3.0, 3.8, 0], ridge, { r: [0, 0, -k * 8] }),
        // bracer rings and elbow cop
        cube('fore' + s, [0, 0.0, 0], bracer, { inf: 0.45 }),
        cube('fore' + s, [0, -1.8, 0], bracer, { inf: 0.35 }),
        cube('fore' + s, [0, 1.2, -2.2], elbow),
        // tassets on the hips, knee guards, boot cuffs and toe caps
        cube('leg' + s, [k * 0.5, -1.4, 0], tasset, { r: [0, 0, k * 6] }),
        cube('shin' + s, [0, 0.2, 2.3], knee),
        cube('shin' + s, [0, -2.6, 0], cuff, { inf: 0.3 }),
        cube('shin' + s, [0, -5.0, 2.4], toe),
      ];
    }),
    // narrow red tabard between the tassets, front and back
    cube('skirtF', [0, -4, 0], tabard),
    cube('skirtB', [0, -4, 0], tabard),
    // long cape in two segments
    cube('capeA', [0, -CAPE_H / 4, 0], cape, { y0: 0, y1: CAPE_H / 2 }),
    cube('capeB', [0, -CAPE_H / 4, 0], cape, { y0: CAPE_H / 2, y1: CAPE_H }),
    ...greatsword(),
  ];

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
    parts,
    springs: {
      capeA: { parent: 'chest', at: [0, 7.6, -2.6], kind: 'cape', k: 0.9 },
      capeB: { parent: 'capeA', at: [0, -CAPE_H / 2, 0], kind: 'cape', k: 0.9 },
      skirtF: { parent: 'hips', at: [0, 2.0, 2.3], kind: 'flap' },
      skirtB: { parent: 'hips', at: [0, 2.0, -2.3], kind: 'flap' },
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
