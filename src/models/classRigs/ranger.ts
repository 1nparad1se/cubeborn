import type { HeroRigDef } from '../../render/rig/HeroRig';
import type { RigPart } from '../../render/rig/shapes';
import { shade, type FaceId, type Pix } from '../../render/rig/skins';
import { cube, GRIP, hairHead, humanoid, isSide, MC_POS_SCALE, MC_SCALE, mcProps, outer, paintFace, pixelItem, tex, type Side } from './mcKit';

/**
 * Ranger, Minecraft Dungeons style: a forest hunter in a peaked green hood with a hawk feather,
 * a short green shoulder cape, a brown leather jerkin over a moss tunic, a rust scarf, a
 * leather bracer on the bow arm, tall boots, a quiver of red-fletched arrows on the back and
 * a pixel-art recurve bow in the left hand (limbs along the hand's z axis, string on +y).
 */
export function rangerRig(): HeroRigDef {
  const pr = mcProps();
  const skin = 0xe2b28c;
  const hair = 0x7a4a24;
  const hood = 0x3f7f4a;
  const hoodL = 0x58a060;
  const hoodD = 0x2a5a34;
  const tunic = 0x5a7a3a;
  const leather = 0x7a5030;
  const leatherL = 0x9a6a40;
  const leatherD = 0x4e3220;
  const scarf = 0xb8582a;
  const scarfD = 0x864020;
  const pants = 0x5e5a3a;
  const boot = 0x4a3020;
  const wood = 0x8a5a2e;
  const woodL = 0xb07a40;
  const woodD = 0x5a3a1c;

  const head = (f: FaceId, g: Pix) => {
    hairHead(f, g, { skin, hair, fringe: 2, side: 4, back: 8, frame: 1 });
    if (f === 'F') {
      paintFace(g, { skin, eye: 0x3a8a3a, brow: shade(hair, 0.8), nose: true, mouth: 0xa0604a });
      g.set(1, 2, hair).set(6, 2, shade(hair, 0.85));
    }
  };

  /** Peaked hood: green shell with a lighter rim around a wide face opening. */
  const hat = (f: FaceId, g: Pix) => {
    g.fill(hood, 0.08);
    if (f === 'T') {
      g.vline(3, hoodD).vline(4, hoodD);
      return;
    }
    if (f === 'D') {
      g.rect(0, 0, 8, 8, -1);
      return;
    }
    if (f === 'F') {
      g.rect(1, 2, 6, 6, -1);
      g.hline(1, hoodL, 1, 7).set(0, 2, hoodL).set(7, 2, hoodL).set(0, 3, hoodL).set(7, 3, hoodL);
    } else if (f === 'L' || f === 'R') {
      // the hood opens toward the front
      const fx = f === 'L' ? 0 : 6;
      g.rect(fx, 6, 1, 2, -1);
      g.vline(f === 'L' ? 2 : 5, hoodD, 2, 8);
    } else {
      for (let x = 1; x < 8; x += 3) g.set(x, 7, hoodD);
    }
  };

  const body = (f: FaceId, g: Pix) => {
    g.fill(tunic, 0.08);
    if (!isSide(f)) return;
    // leather jerkin with lacing, scarf at the neck, quiver strap, belt
    g.nrect(0, 2, g.w, 7, leather, 0.08);
    if (f === 'F') {
      g.vline(3, leatherD, 2, 9).vline(4, leatherD, 2, 9);
      g.set(3, 3, leatherL).set(4, 5, leatherL).set(3, 7, leatherL);
      for (let i = 0; i < 7; i++) g.set(i + 1, 7 - i, leatherD);
      g.nrect(1, 0, 6, 2, scarf, 0.1).set(2, 2, scarf).set(2, 3, scarfD);
    } else if (f === 'B') {
      for (let i = 0; i < 8; i++) g.set(i, i + 1, leatherD);
      g.nrect(1, 0, 6, 1, scarf, 0.1);
    } else g.nrect(0, 0, g.w, 1, scarf, 0.1);
    g.nrect(0, 8, g.w, 1, leatherD, 0.06);
    if (f === 'F') g.set(3, 8, 0xd4a040);
    g.nrect(0, 9, g.w, 3, tunic, 0.08);
    g.hline(11, shade(tunic, 0.8));
  };

  const arm = (side: Side) => (f: FaceId, g: Pix) => {
    g.fill(tunic, 0.08);
    if (f === 'T') return;
    if (f === 'D') {
      g.fill(leatherD);
      return;
    }
    g.hline(5, shade(tunic, 0.8));
    // bracer on the bow arm, glove cuffs
    if (side === 'L') {
      g.nrect(0, 6, g.w, 4, leather, 0.08).hline(6, leatherL).hline(9, leatherD);
      if (f === outer(side)) g.set(1, 7, 0xd4a040).set(2, 8, 0xd4a040);
    } else g.nrect(0, 7, g.w, 3, tunic, 0.08);
    g.nrect(0, 10, g.w, 2, leatherD, 0.06);
  };

  const leg = (side: Side) => (f: FaceId, g: Pix) => {
    g.fill(pants, 0.08);
    if (f === 'D') {
      g.fill(0x2a1c12);
      return;
    }
    if (f === 'T') return;
    g.set(side === 'L' ? 1 : 2, 3, shade(pants, 0.8));
    // tall boots with a folded cuff
    g.nrect(0, 6, 4, 6, boot, 0.08).hline(6, leatherL).hline(7, leather);
    g.hline(11, 0x2a1c12);
  };

  // ---------------------------------------------------------------- accessories
  const cape = tex('rg.cape', [9, 8, 1], (f, g) => {
    g.fill(hood, 0.08);
    if (f === 'B' || f === 'F') {
      g.hline(0, hoodL);
      for (let x = 0; x < 9; x++) if (x % 3 === 1) g.set(x, 7, -1);
      g.vline(4, hoodD, 1, 7);
    }
  });
  const hoodTip = tex('rg.hoodTip', [4, 3, 3], (f, g) => g.fill(hood, 0.08).hline(g.h - 1, hoodD));
  const feather = tex('rg.feather', [1, 5, 2], (f, g) => {
    g.fill(0xe8e0d0, 0.06);
    g.set(0, 0, 0x8a5a3a).set(1, 0, 0x8a5a3a);
    g.hline(2, 0x8a5a3a).hline(4, 0x6a4a2a);
  });
  const quiver = tex('rg.quiver', [3, 9, 3], (f, g) => {
    g.fill(leather, 0.08);
    if (f === 'T') {
      g.fill(leatherD);
      return;
    }
    if (isSide(f)) g.hline(0, leatherL).hline(1, leatherD).hline(6, leatherD).hline(8, leatherD);
  });
  const fletch = tex('rg.fletch', [1, 3, 1], (f, g) => g.fill(0xc83a2a, 0.06).set(0, 0, 0xf0e8dc));

  const parts: RigPart[] = [
    ...humanoid({ name: 'rg', head, hat, body, arm, leg }),
    cube('head', [0, 6.4, -4.8], hoodTip, { r: [-24, 0, 0] }),
    cube('accC', [0, 0, 0], feather, { r: [-20, 0, -20] }),
    cube('capeA', [0, -4, 0], cape),
    // quiver on the back with three fletchings
    cube('accB', [0, -2, 0], quiver),
    ...[-0.9, 0, 0.9].map((x, i) => cube('accB', [x, 3.6 + (i % 2) * 0.5, 0.2 * (i - 1)], fletch)),
    ...bow(),
  ];

  // ---------------------------------------------------------------- recurve bow (riser at the fist, string on +y) and the nocked arrow
  function bow(): RigPart[] {
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
    const pal = { w: wood, B: woodL, L: leatherD, S: 0xece4d4 };
    const parts = pixelItem(rows, pal, { b: 'gripL', at: GRIP, pivot: [0.5, 11], px: 0.9, th: 0.8, u: '+y', v: '+z', thick: { S: 0.25, L: 1.3 } });
    void woodD;
    // arrow across the bow, head toward -y, fletching beyond the string
    const arrow = ['hhaaaaaff'];
    parts.push(...pixelItem(arrow, { h: 0xc8d2dc, a: woodL, f: 0xc83a2a }, { b: 'gripL', at: [GRIP[0] + 0.7, GRIP[1], GRIP[2]], pivot: [2, 0], px: 0.9, th: 0.35, u: '+y', v: '+z', grp: 'arrow' }));
    return parts;
  }

  return {
    id: 'ranger',
    scale: MC_SCALE,
    posScale: MC_POS_SCALE,
    props: pr,
    parts,
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
