import type { HeroRigDef } from '../../render/rig/HeroRig';
import type { RigPart } from '../../render/rig/shapes';
import { shade, type FaceId, type Pix } from '../../render/rig/skins';
import { backCols, cube, GRIP, humanoid, isSide, MC_POS_SCALE, MC_SCALE, mcProps, outer, paintFace, pixelItem, tex, type Side } from './mcKit';

/**
 * Summoner, Minecraft Dungeons style: a druid who calls nature spirits. Long chestnut hair under
 * an antler crown with leaves and glowing tips, a white robe with teal panels and gold trim, a
 * leaf sash, a long split skirt over soft boots, and a living-wood staff whose forked head
 * cradles a glowing spirit crystal. Spirit wisps orbit her on the accB spin bone.
 */
export function summonerRig(): HeroRigDef {
  const pr = mcProps(true);
  const skin = 0xeec2a0;
  const hair = 0x8a4a26;
  const hairD = 0x6a3418;
  const robe = 0xf0ece0;
  const robeD = 0xcfc8b6;
  const teal = 0x2a9a8a;
  const tealD = 0x1c6e64;
  const tealL = 0x5ad0b8;
  const gold = 0xe8bc4a;
  const leaf = 0x5aa83a;
  const leafD = 0x3a7a2a;
  const wood = 0x7a5030;
  const woodL = 0xa0703e;
  const woodD = 0x4e321c;
  const spirit = 0x7affd8;
  const antler = 0xd8c8a4;

  const head = (f: FaceId, g: Pix) => {
    g.fill(skin, 0.03);
    if (f === 'T') {
      g.fill(hair, 0.1);
      return;
    }
    if (f === 'D') return;
    if (f === 'F') {
      paintFace(g, { skin, eye: 0x2a9a6a, white: 0xf6f4ee, brow: hairD, nose: false, mouth: 0xc06a62 });
      // centre-parted hair framing the face, green leaf paint on the cheeks
      g.nrect(0, 0, 8, 2, hair, 0.1).set(3, 1, skin).set(4, 1, skin);
      g.nrect(0, 2, 1, 6, hair, 0.1).nrect(7, 2, 1, 6, hair, 0.1).set(1, 2, hair).set(6, 2, hair);
      g.set(1, 5, leaf).set(6, 5, leaf);
    } else if (f === 'B') g.fill(hair, 0.1);
    else {
      g.fill(hair, 0.1);
      const [a] = backCols(f, 8, 8);
      g.nrect(f === 'L' ? 1 : 3, 3, 4, 3, skin, 0.03);
      void a;
    }
  };

  const body = (f: FaceId, g: Pix) => {
    g.fill(robe, 0.05);
    if (!isSide(f)) return;
    if (f === 'F') {
      // teal panel with gold trim, a leaf brooch, and long hair falling on the shoulders
      g.nrect(2, 2, 4, 10, teal, 0.08).vline(2, gold, 2, 12).vline(5, gold, 2, 12);
      g.rect(3, 0, 2, 2, skin).set(3, 1, shade(skin, 0.9));
      g.rect(3, 3, 2, 2, leaf).set(4, 3, leafD);
      g.nrect(0, 0, 1, 4, hair, 0.1).nrect(7, 0, 1, 4, hair, 0.1);
    } else if (f === 'B') {
      g.nrect(1, 0, 6, 5, hair, 0.1).set(1, 5, hair).set(3, 5, hairD).set(5, 5, hair);
    }
    // leaf sash
    g.nrect(0, 7, g.w, 1, leafD, 0.08);
    for (let x = 0; x < g.w; x += 2) g.set(x, 7, leaf);
    if (f === 'F') g.set(3, 7, gold).set(4, 7, gold);
  };

  const arm = (side: Side) => (f: FaceId, g: Pix) => {
    g.fill(robe, 0.05);
    if (f === 'T') return;
    if (f === 'D') {
      g.fill(skin);
      return;
    }
    // wide sleeve with a teal and gold cuff, bare hands
    g.hline(5, robeD);
    g.nrect(0, 7, g.w, 2, teal, 0.08).hline(9, gold);
    g.nrect(0, 10, g.w, 2, skin, 0.03);
    if (f === outer(side)) g.set(1, 3, tealL);
  };

  const leg = (side: Side) => (f: FaceId, g: Pix) => {
    g.fill(robeD, 0.06);
    if (f === 'D') {
      g.fill(woodD);
      return;
    }
    if (f === 'T') return;
    g.nrect(0, 8, 4, 4, 0x8a6a46, 0.08).hline(8, leafD);
    void side;
  };

  // ---------------------------------------------------------------- skirt panels, crown, hair
  const skirt = (n: string, front: boolean) =>
    tex(n, [9, 9, 1], (f, g) => {
      g.fill(robe, 0.05);
      if (!isSide(f)) return;
      if (front && f === 'F') {
        g.nrect(2, 0, 5, 9, teal, 0.08).vline(2, gold).vline(6, gold);
        g.set(4, 3, leaf).set(4, 6, leaf).set(3, 5, leafD).set(5, 2, leafD);
      }
      g.hline(8, gold).hline(7, tealD);
    });
  const skirtSide = tex('sm.skirtSide', [1, 8, 5], (f, g) => {
    g.fill(robe, 0.05);
    if (isSide(f)) g.hline(7, gold).hline(6, tealD);
  });
  const hairBack = tex('sm.hair', [8, 9, 1], (f, g) => {
    g.fill(hair, 0.12);
    for (let x = 1; x < 8; x += 2) g.set(x, 2 + (x % 3), hairD);
    g.set(0, 8, -1).set(3, 8, -1).set(7, 8, -1).set(7, 7, -1);
  });
  const ant = (n: string, s: [number, number, number]) => tex(n, s, (f, g) => g.fill(antler, 0.08).hline(g.h - 1, shade(antler, 0.82)));
  const antA = ant('sm.antA', [1, 3, 1]);
  const antB = ant('sm.antB', [1, 1, 3]);
  const leafBox = tex('sm.leaf', [2, 1, 2], (f, g) => g.fill(leaf, 0.12));
  const tipGlow = tex('sm.tip', [1, 1, 1], (f, g) => g.fill(spirit, 0));
  const wisp = tex('sm.wisp', [2, 2, 2], (f, g) => g.fill(spirit, 0.06).set(0, 0, 0xe8fff8));
  const wisp2 = tex('sm.wisp2', [1, 1, 1], (f, g) => g.fill(tealL, 0));

  const parts: RigPart[] = [
    ...humanoid({ name: 'sm', head, body, arm, leg, slim: true }),
    cube('skirtF', [0, -4.5, 0], skirt('sm.skirtF', true)),
    cube('skirtB', [0, -4.5, 0], skirt('sm.skirtB', false)),
    cube('hips', [4.6, -2, 0], skirtSide),
    cube('hips', [-4.6, -2, 0], skirtSide),
    cube('accC', [0, -4.5, 0], hairBack),
    // antler crown: a leafy band with branching tines and glowing tips
    ...(['L', 'R'] as Side[]).flatMap((s) => {
      const k = s === 'L' ? 1 : -1;
      return [
        cube('head', [k * 3, 9.5, 0], antA, { r: [0, 0, -k * 18] }),
        cube('head', [k * 3.6, 10.6, -1.5], antB, { r: [30, 0, -k * 18] }),
        cube('head', [k * 4.1, 11.4, 0.4], antA, { r: [0, 0, -k * 40] }),
        cube('head', [k * 5.2, 12.6, 0.4], tipGlow, { g: true }),
        cube('head', [k * 3.6, 11.2, -2.9], tipGlow, { g: true }),
        cube('head', [k * 2.2, 8.4, 2.6], leafBox, { r: [0, k * 30, 0] }),
      ];
    }),
    cube('head', [0, 8.4, 3.4], leafBox),
    // spirit wisps on the spin bone
    cube('accB', [7.5, 2, 1], wisp, { g: true }),
    cube('accB', [-6, -1, -4], wisp, { g: true }),
    cube('accB', [-2, 5, 7], wisp2, { g: true }),
    cube('accB', [3, -3, -7], wisp2, { g: true }),
    ...staff(),
  ];

  // ---------------------------------------------------------------- living-wood staff along the hand's y axis
  function staff(): RigPart[] {
    const rows = [
      '.l.....',
      'lw..s..',
      '.w.sCs.',
      '.ww.s.w',
      '..w.s.w',
      '..wwwww',
      '...ww..',
      '...wL..',
      '...ww..',
      '...Gw..',
      '...wG..',
      '...ww..',
      '...ww..',
      '...wL..',
      '...ww..',
      '...ww..',
      '...bb..',
      '...bb..',
      '...bb..',
      '...ww..',
      '...ww..',
      '...wL..',
      '...ww..',
      '...ww..',
      '...ww..',
      '...ww..',
      '...wL..',
      '...ww..',
      '...ww..',
      '...GG..',
      '....G..',
    ];
    return pixelItem(rows, { w: wood, L: woodL, b: woodD, G: gold, l: leaf, s: spirit, C: 0xffffff }, { b: 'gripR', at: GRIP, pivot: [3.5, 17], px: 0.95, th: 0.95, u: '+z', v: '+y', glow: 'sC', thick: { s: 1.6, C: 2 } });
  }

  return {
    id: 'summoner',
    scale: MC_SCALE,
    posScale: MC_POS_SCALE,
    props: pr,
    parts,
    springs: {
      accB: { parent: 'chest', at: [0, 1, 0], kind: 'spin', axis: 'y', speed: 1.1 },
      accC: { parent: 'head', at: [0, 3.5, -4.6], kind: 'bob', k: 0.8 },
      skirtF: { parent: 'hips', at: [0, 1.6, 1.6], kind: 'flap' },
      skirtB: { parent: 'hips', at: [0, 1.6, -1.6], kind: 'flap' },
    },
    tip: { bone: 'gripR', p: [GRIP[0], GRIP[1] + 15 * 0.95, GRIP[2] + 0.5 * 0.95] },
    grip: { R: { at: GRIP, rot: [8, 0, 18] }, L: { at: GRIP } },
    anim: {
      weapon: 'summon',
      gait: { cadence: 0.48, stride: 24, knee: 28, armSwing: 6, elbow: 10, bounce: 0.2, lean: 5, sway: 3, twist: 4, heavy: 0, headBob: 0.3, armOut: 8, idle: 1.0 },
      stance: { chest: [-2, 0, 0], head: [2, 0, 0], armR: [-8, 0, -14], foreR: [-30, 0, 0], handR: [38, 0, 0], armL: [-16, 0, 14], foreL: [-42, 0, 0], handL: [-6, -20, -14] },
      stanceRun: 0.85,
      victory: 'raise',
    },
  };
}
