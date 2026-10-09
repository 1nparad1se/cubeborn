import type { HeroRigDef } from '../../render/rig/HeroRig';
import type { RigPart } from '../../render/rig/shapes';
import type { PoseMap } from '../../render/rig/animTypes';
import type { FaceId, Pix } from '../../render/rig/skins';
import { backCols, cube, GRIP, humanoid, isSide, MC_POS_SCALE, MC_SCALE, mcProps, outer, paintFace, pixelItem, tex, type Side } from './mcKit';

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
 * Deathblade, Minecraft Dungeons style: a slim swordswoman in dark leather with crimson straps
 * and silver buckles, a black half-mask over the nose and mouth, crimson eyes, a high silver
 * ponytail, a layered silver pauldron on the left shoulder, a short tattered tail at the waist
 * and a curved crimson-edged blade in each hand.
 */
export function deathbladeRig(): HeroRigDef {
  const pr = mcProps(true);
  const skin = 0xeac4a6;
  const hair = 0xe2e6ee;
  const hairD = 0xaab2c2;
  const leather = 0x2e2836;
  const leatherL = 0x463e52;
  const leatherD = 0x1c1822;
  const crimson = 0xc8243c;
  const crimsonD = 0x881628;
  const silver = 0xc4ccd8;
  const silverD = 0x8a92a4;
  const eye = 0xd8203c;

  const head = (f: FaceId, g: Pix) => {
    g.fill(skin, 0.035);
    if (f === 'T') {
      g.fill(hair, 0.08);
      return;
    }
    if (f === 'D') return;
    if (f === 'F') {
      paintFace(g, { skin, eye, white: 0xf2eeee, brow: hairD, nose: false });
      // swept fringe over the right eye, black half-mask with a crimson seam
      g.nrect(0, 0, 8, 2, hair, 0.08).rect(0, 2, 3, 1, hair).set(0, 3, hair).set(7, 2, hair).set(7, 3, hairD);
      g.nrect(0, 5, 8, 3, leatherD, 0.06).hline(5, leatherL).set(3, 6, crimson).set(4, 6, crimson);
      g.set(3, 5, silver).set(4, 5, silver);
    } else if (f === 'B') g.fill(hair, 0.08).hline(7, hairD);
    else {
      g.nrect(0, 0, 8, 3, hair, 0.08);
      const [a, b] = backCols(f, 8, 4);
      g.nrect(a, 0, b - a, 8, hair, 0.08);
      g.nrect(0, 5, 8, 3, leatherD, 0.06);
      g.nrect(a, 5, b - a, 3, hair, 0.08);
    }
  };

  const body = (f: FaceId, g: Pix) => {
    g.fill(leather, 0.08);
    if (!isSide(f)) return;
    if (f === 'F') {
      // crossed crimson straps with a silver ring, high collar
      for (let i = 0; i < 8; i++) {
        g.set(i, i, crimson);
        g.set(7 - i, i, crimson);
      }
      g.rect(3, 3, 2, 2, silver).set(3, 3, silverD);
      g.hline(0, leatherL);
    } else if (f === 'B') {
      for (let i = 0; i < 8; i++) g.set(i, i, crimsonD).set(7 - i, i, crimsonD);
    }
    g.nrect(0, 8, g.w, 1, crimsonD, 0.06);
    if (f === 'F') g.set(3, 8, silver).set(4, 8, silver);
    g.nrect(0, 9, g.w, 3, leatherD, 0.08);
  };

  const arm = (side: Side) => (f: FaceId, g: Pix) => {
    g.fill(leather, 0.08);
    if (f === 'T') return;
    if (f === 'D') {
      g.fill(leatherD);
      return;
    }
    // bare upper arm on the right, crimson bands, fingerless gloves
    if (side === 'R') g.nrect(0, 2, g.w, 3, skin, 0.03);
    g.hline(5, crimson);
    g.nrect(0, 7, g.w, 3, leatherL, 0.08).hline(7, silverD);
    g.nrect(0, 10, g.w, 2, leatherD, 0.05);
    if (f === outer(side)) g.set(1, 8, crimson);
  };

  const leg = (side: Side) => (f: FaceId, g: Pix) => {
    g.fill(leather, 0.08);
    if (f === 'D') {
      g.fill(0x120e16);
      return;
    }
    if (f === 'T') return;
    // thigh strap with a sheath buckle, tall black boots with silver toe
    g.hline(2, crimsonD).set(side === 'L' ? 2 : 1, 2, silver);
    g.nrect(0, 6, 4, 6, leatherD, 0.06).hline(6, leatherL);
    if (f === 'F') g.rect(1, 10, 2, 1, silverD);
  };

  const pauldron = tex('db.pauldron', [5, 3, 5], (f, g) => {
    g.fill(silver, 0.06);
    if (isSide(f)) g.hline(0, 0xe8eef6).hline(2, crimson);
  });
  const pauldron2 = tex('db.pauldron2', [4, 2, 5], (f, g) => {
    g.fill(silverD, 0.06);
    if (isSide(f)) g.hline(1, leatherD);
  });
  const pony = tex('db.pony', [2, 9, 2], (f, g) => {
    g.fill(hair, 0.1);
    g.hline(0, crimson).hline(1, silver);
    if (isSide(f)) g.hline(8, hairD).set(0, 5, hairD);
  });
  const tail = tex('db.tail', [6, 5, 1], (f, g) => {
    g.fill(leatherL, 0.08);
    g.hline(0, crimsonD);
    for (let x = 0; x < 6; x++) if (x % 2 === 0) g.set(x, 4, -1);
    g.set(1, 3, -1).set(5, 3, -1);
  });

  const parts: RigPart[] = [
    ...humanoid({ name: 'db', head, body, arm, leg, slim: true }),
    cube('armL', [0.6, 1.4, 0], pauldron, { r: [0, 0, -10] }),
    cube('armL', [0.9, -0.4, 0], pauldron2, { r: [0, 0, -10] }),
    cube('accA', [0, -3.6, -0.6], pony, { r: [16, 0, 0] }),
    cube('capeA', [0, -2.5, 0], tail),
    ...blade('gripL'),
    ...blade('gripR'),
  ];

  // ---------------------------------------------------------------- curved blade: along +z, bending toward +y, glowing edge on -y
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
    return pixelItem(rows, { e: crimson, s: silver, m: silverD, g: silver, G: silverD, o: leatherD, b: crimsonD, r: crimson }, { b, at: GRIP, pivot: [2, 12.5], px: 0.95, th: 0.5, u: '+y', v: '+z', glow: 'er', thick: { G: 1.6, g: 1.6, o: 1.4, b: 1.4 } });
  }

  return {
    id: 'deathblade',
    scale: MC_SCALE,
    posScale: MC_POS_SCALE,
    props: pr,
    parts,
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


