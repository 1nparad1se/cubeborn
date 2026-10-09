import type { HeroRigDef } from '../../render/rig/HeroRig';
import type { RigPart } from '../../render/rig/shapes';
import type { PoseMap } from '../../render/rig/animTypes';
import { shade, type FaceId, type Pix } from '../../render/rig/skins';
import { cube, hairHead, humanoid, isSide, MC_POS_SCALE, MC_SCALE, mcProps, outer, paintFace, tex, type Side } from './mcKit';

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
 * Steel Fist, Minecraft Dungeons style: a martial artist with a black topknot and a crimson
 * headband, an open sleeveless cream gi with dark trim, a crimson sash with long tails, dark
 * wide trousers with white shin wraps, and two oversized steel gauntlets with glowing cyan chi
 * cores on the backs of the fists.
 */
export function steelfistRig(): HeroRigDef {
  const pr = mcProps();
  const skin = 0xc68a5e;
  const skinD = shade(skin, 0.85);
  const hair = 0x1e1a22;
  const gi = 0xeee4cc;
  const giD = 0xc9bc9e;
  const trim = 0x2a2c38;
  const pants = 0x343a52;
  const pantsD = 0x242838;
  const crimson = 0xc42a3c;
  const crimsonD = 0x8a1a28;
  const steel = 0xa4b0c2;
  const steelL = 0xdce4ee;
  const steelD = 0x5a6476;
  const gold = 0xe8b844;
  const chi = 0x5ad8ff;

  const head = (f: FaceId, g: Pix) => {
    hairHead(f, g, { skin, hair, fringe: 1, side: 3, back: 6 });
    if (f === 'F') {
      paintFace(g, { skin, eye: 0x3a2414, brow: hair, nose: true, mouth: 0x8a4a3a });
      g.set(1, 3, hair).set(6, 3, hair);
    }
  };
  /** Crimson headband with knot at the back. */
  const band = (f: FaceId, g: Pix) => {
    g.rect(0, 0, 8, 8, -1);
    if (!isSide(f)) return;
    g.nrect(0, 2, 8, 1, crimson, 0.08);
    if (f === 'F') g.set(3, 2, gold).set(4, 2, gold);
    if (f === 'B') g.rect(3, 2, 2, 2, crimsonD);
  };

  const body = (f: FaceId, g: Pix) => {
    g.fill(gi, 0.05);
    if (!isSide(f)) return;
    if (f === 'F') {
      // open vest: bare chest in a V, dark trim
      g.nrect(2, 0, 4, 7, skin, 0.03).rect(3, 7, 2, 1, skin);
      g.rect(2, 2, 2, 1, skinD).rect(4, 2, 2, 1, skinD).set(3, 4, skinD).set(4, 5, skinD);
      g.vline(1, trim, 0, 8).vline(6, trim, 0, 8);
      g.set(2, 7, trim).set(5, 7, trim);
    } else if (f === 'B') {
      // crimson circle emblem
      g.rect(3, 2, 2, 1, crimson).rect(2, 3, 1, 2, crimson).rect(5, 3, 1, 2, crimson).rect(3, 5, 2, 1, crimson);
    } else g.hline(0, trim);
    // sash with a knot
    g.nrect(0, 8, g.w, 2, crimson, 0.08).hline(9, crimsonD);
    if (f === 'F') g.rect(5, 8, 2, 2, crimsonD);
    g.nrect(0, 10, g.w, 2, pants, 0.08);
  };

  const arm = (side: Side) => (f: FaceId, g: Pix) => {
    g.fill(skin, 0.035);
    if (f === 'T') {
      g.fill(gi, 0.05);
      return;
    }
    if (f === 'D') return;
    // gi shoulder, muscle shading, wrapped forearm
    g.nrect(0, 0, g.w, 2, gi, 0.05).hline(2, trim);
    if (f === outer(side)) g.rect(1, 4, 2, 1, skinD);
    g.nrect(0, 6, g.w, 3, 0xeae2d2, 0.06);
    for (let y = 6; y < 9; y++) g.set(y % g.w, y, giD);
  };

  const leg = (side: Side) => (f: FaceId, g: Pix) => {
    g.fill(pants, 0.08);
    if (f === 'D') {
      g.fill(0x2a2422);
      return;
    }
    if (f === 'T') return;
    g.set(side === 'L' ? 1 : 2, 2, pantsD).set(side === 'L' ? 2 : 1, 5, pantsD);
    // white shin wraps and dark slippers
    g.nrect(0, 7, 4, 3, gi, 0.06);
    for (let y = 7; y < 10; y++) g.set((y * 2) % 4, y, giD);
    g.nrect(0, 10, 4, 2, 0x2a2422, 0.06);
  };

  // ---------------------------------------------------------------- gauntlets: a big steel block over the fist and wrist
  const gauntlet = tex('sf.gauntlet', [6, 5, 6], (f, g) => {
    g.fill(steel, 0.06);
    if (f === 'D') {
      // knuckles: four studs on the striking face
      g.fill(steelD);
      for (let x = 1; x < 6; x += 2) g.rect(x, 1, 1, 4, steelL);
      return;
    }
    if (f === 'T') {
      g.border(gold);
      return;
    }
    g.hline(0, gold).hline(1, steelL).hline(4, steelD);
    g.set(0, 2, steelL);
  });
  const cuff = tex('sf.cuff', [5, 2, 5], (f, g) => g.fill(steelD, 0.06).hline(0, steel));
  const core = tex('sf.core', [1, 2, 2], (f, g) => g.fill(chi, 0.04).set(0, 0, 0xd8f8ff));
  const tails = tex('sf.tails', [3, 7, 1], (f, g) => {
    g.fill(crimson, 0.08);
    if (f === 'F' || f === 'B') g.vline(1, crimsonD).set(0, 6, -1).set(2, 5, -1).set(2, 6, -1);
  });
  const bandTail = tex('sf.bandTail', [2, 4, 1], (f, g) => {
    g.fill(crimson, 0.08);
    g.set(1, 3, -1);
  });
  const topknot = tex('sf.topknot', [2, 2, 2], (f, g) => g.fill(hair, 0.1).set(0, 0, crimson));

  const parts: RigPart[] = [
    ...humanoid({ name: 'sf', head, hat: band, body, arm, leg }),
    cube('head', [0, 8.6, -1], topknot),
    cube('accC', [0, -2, 0], bandTail),
    ...(['L', 'R'] as Side[]).flatMap((s) => {
      const k = s === 'L' ? 1 : -1;
      return [
        cube('hand' + s, [0, -0.6, 0.1], gauntlet),
        cube('fore' + s, [0, -2.2, 0], cuff),
        cube('hand' + s, [k * 3.1, -0.6, 0.1], core, { g: true }),
      ];
    }),
    // sash tails hanging at the left hip
    cube('skirtF', [0, -3.5, 0], tails),
  ];

  return {
    id: 'steelfist',
    scale: MC_SCALE,
    posScale: MC_POS_SCALE,
    props: pr,
    parts,
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
