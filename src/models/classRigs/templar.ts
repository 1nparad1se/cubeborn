import type { HeroRigDef } from '../../render/rig/HeroRig';
import type { RigPart } from '../../render/rig/shapes';
import type { FaceId, Pix } from '../../render/rig/skins';
import { backCols, cube, GRIP, humanoid, isSide, MC_POS_SCALE, MC_SCALE, mcProps, outer, paintFace, pixelItem, tex, type Side } from './mcKit';

/**
 * Templar, Minecraft Dungeons style: a holy battle-maiden in angular ivory plate with gold trim
 * over a dark under-suit, a crimson tabard with a gold cross, swept pauldrons, a winged gold
 * circlet over dark hair with a long braid, a glowing rune seal turning behind her back, and a
 * sacred pixel-art halberd (crescent blade, top spike, back hook, glowing runes).
 */
export function templarRig(): HeroRigDef {
  const pr = mcProps(true);
  const skin = 0xe2b694;
  const hair = 0x2e2228;
  const hairD = 0x1c141a;
  const ivory = 0xf0e8d4;
  const ivoryL = 0xfffaf0;
  const ivoryD = 0xc8bca0;
  const under = 0x34303c;
  const gold = 0xeebc48;
  const goldD = 0xae7e26;
  const crimson = 0xa82434;
  const crimsonD = 0x701824;
  const holy = 0xffe890;
  const haft = 0x5a3a2a;

  const plate = (g: Pix) => {
    g.fill(ivory, 0.04);
    g.hline(0, ivoryL);
  };

  const head = (f: FaceId, g: Pix) => {
    g.fill(skin, 0.03);
    if (f === 'T') {
      g.fill(hair, 0.1);
      return;
    }
    if (f === 'D') return;
    if (f === 'F') {
      paintFace(g, { skin, eye: 0xc08a2a, white: 0xf6f0e6, brow: hairD, nose: false, mouth: 0xb05a5a });
      g.nrect(0, 0, 8, 2, hair, 0.1).set(0, 2, hair).set(7, 2, hair).set(0, 3, hair).set(7, 3, hair).set(1, 2, hairD);
    } else if (f === 'B') g.fill(hair, 0.1);
    else {
      g.fill(hair, 0.1);
      const [a] = backCols(f, 8, 8);
      g.nrect(f === 'L' ? 1 : 3, 3, 4, 3, skin, 0.03);
      void a;
    }
  };

  /** Winged gold circlet: a band at the brow, cut out elsewhere. */
  const circlet = (f: FaceId, g: Pix) => {
    g.rect(0, 0, 8, 8, -1);
    if (!isSide(f)) return;
    g.nrect(0, 1, 8, 1, gold, 0.06);
    if (f === 'F') g.set(3, 1, holy).set(4, 1, holy).set(3, 0, gold).set(4, 0, gold);
  };

  const body = (f: FaceId, g: Pix) => {
    plate(g);
    if (!isSide(f)) return;
    if (f === 'F') {
      // crimson tabard with a gold cross, gold-rimmed breastplate
      g.nrect(2, 2, 4, 10, crimson, 0.08).vline(2, gold, 2, 12).vline(5, gold, 2, 12);
      g.rect(3, 3, 2, 5, gold).rect(2, 4, 4, 1, gold).set(3, 3, holy);
      g.hline(1, gold);
    } else if (f === 'B') {
      g.nrect(2, 0, 4, 2, hair, 0.1);
      g.nrect(1, 8, 6, 4, crimson, 0.08);
    }
    g.nrect(0, 8, 2, 1, goldD, 0.05).nrect(6, 8, 2, 1, goldD, 0.05);
    g.nrect(0, 9, 2, 3, under, 0.06).nrect(6, 9, 2, 3, under, 0.06);
  };

  const arm = (side: Side) => (f: FaceId, g: Pix) => {
    plate(g);
    if (f === 'T') return;
    if (f === 'D') {
      g.fill(ivoryD);
      return;
    }
    g.nrect(0, 4, g.w, 3, under, 0.06);
    g.hline(7, gold);
    g.nrect(0, 8, g.w, 4, ivory, 0.04).hline(11, ivoryD);
    if (f === outer(side)) g.set(1, 9, gold);
  };

  const leg = (side: Side) => (f: FaceId, g: Pix) => {
    plate(g);
    if (f === 'D') {
      g.fill(ivoryD);
      return;
    }
    if (f === 'T') return;
    g.nrect(0, 0, 4, 4, under, 0.06);
    if (f === 'F') g.rect(1, 5, 2, 1, gold);
    else g.hline(5, goldD);
    g.hline(11, goldD);
    void side;
  };

  const pauldron = tex('tp.pauldron', [5, 3, 5], (f, g) => {
    plate(g);
    if (isSide(f)) g.hline(2, gold);
    if (f === 'T') g.border(gold);
  });
  const pauldronTip = tex('tp.pauldronTip', [3, 2, 4], (f, g) => g.fill(ivoryL, 0.04).hline(g.h - 1, goldD));
  const wing = tex('tp.wing', [1, 2, 5], (f, g) => {
    g.fill(gold, 0.06);
    if (f === 'L' || f === 'R') g.hline(0, 0xfff0b0).set(f === 'L' ? 4 : 0, 1, -1);
  });
  const braid = tex('tp.braid', [2, 10, 2], (f, g) => {
    g.fill(hair, 0.1);
    for (let y = 0; y < 10; y += 2) g.set(y % 2, y, hairD).set(1, y + 1, hairD);
    g.hline(8, gold);
  });
  const tabard = (n: string) =>
    tex(n, [4, 7, 1], (f, g) => {
      g.fill(crimson, 0.08);
      if (isSide(f)) g.vline(0, gold).vline(3, gold).hline(6, gold).set(1, 2, crimsonD).set(2, 4, crimsonD);
    });
  const sealSeg = tex('tp.seal', [3, 1, 1], (f, g) => g.fill(holy, 0.02));
  const sealCore = tex('tp.sealCore', [2, 2, 1], (f, g) => g.fill(0xfff8d8, 0).set(0, 0, holy));

  const parts: RigPart[] = [
    ...humanoid({ name: 'tp', head, hat: circlet, body, arm, leg, slim: true }),
    ...(['L', 'R'] as Side[]).flatMap((s) => {
      const k = s === 'L' ? 1 : -1;
      return [
        cube('arm' + s, [k * 0.6, 1.5, 0], pauldron, { r: [0, 0, -k * 12] }),
        cube('arm' + s, [k * 2.6, 2.6, 0], pauldronTip, { r: [0, 0, -k * 34] }),
        cube('head', [k * 4.6, 7.2, -1.6], wing, { r: [-28, 0, 0] }),
        cube('head', [k * 4.6, 6.0, -2.2], wing, { r: [-12, 0, 0] }),
      ];
    }),
    cube('accC', [0, -5, 0], braid),
    cube('skirtF', [0, -3.5, 0], tabard('tp.tabF')),
    cube('skirtB', [0, -3.5, 0], tabard('tp.tabB')),
    // rune seal: a ring of glowing bars around a bright core
    ...Array.from({ length: 10 }, (_, i) => {
      const a = (i / 10) * Math.PI * 2;
      return cube('accB', [Math.sin(a) * 5, Math.cos(a) * 5, 0], sealSeg, { r: [0, 0, (-a * 180) / Math.PI + 90], g: true });
    }),
    cube('accB', [0, 0, 0], sealCore, { g: true }),
    ...halberd(),
  ];

  // ---------------------------------------------------------------- halberd (+z along the haft toward the head, +y toward the blade)
  function halberd(): RigPart[] {
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
    return pixelItem(rows, { S: ivoryL, y: holy, g: gold, G: goldD, B: ivory, e: ivoryL, r: holy, h: gold, w: haft, c: crimson }, { b: 'gripR', at: GRIP, pivot: [3, 21], px: 1.1, th: 0.8, u: '+y', v: '+z', glow: 'ry', thick: { w: 1.1, c: 1.3, G: 1.4 } });
  }

  return {
    id: 'templar',
    scale: MC_SCALE,
    posScale: MC_POS_SCALE,
    props: pr,
    parts,
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


