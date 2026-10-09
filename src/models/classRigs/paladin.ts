import type { HeroRigDef } from '../../render/rig/HeroRig';
import type { RigPart } from '../../render/rig/shapes';
import { shade, type FaceId, type Pix } from '../../render/rig/skins';
import { cube, GRIP, humanoid, isSide, MC_POS_SCALE, MC_SCALE, mcProps, outer, paintFace, pixelItem, tex, type Side } from './mcKit';

/**
 * Paladin: a knight of light in the Minecraft Dungeons look. Silver plate with gold trim over a
 * white tabard bearing a gold sun, a blue cape, an open-faced great helm with a gold crest over
 * a bearded face, big layered pauldrons. A pixel-art longsword in the right hand and a tall
 * tower shield with a radiant sun on the left arm.
 */
export function paladinRig(): HeroRigDef {
  const pr = mcProps();
  const silver = 0xa8b2c2;
  const silverL = 0xccd4e0;
  const silverD = 0x76808f;
  const steelD = 0x4a5264;
  const gold = 0xf0c048;
  const goldD = 0xb07c22;
  const white = 0xe8e2d2;
  const whiteD = 0xd6cfbe;
  const blue = 0x2f62c0;
  const blueD = 0x1d3f86;
  const skin = 0xdca07a;
  const beard = 0x7a4a26;
  const leather = 0x6a4428;
  const mail = 0x7c8698;

  /** Polished plate: light top row, darker rims, a soft vertical sheen. */
  const plate = (g: Pix, base = silver) => {
    g.fill(base, 0.05);
    g.hline(0, silverL);
    for (let y = 1; y < g.h; y += 3) g.set(1, y, silverL);
  };

  const head = (f: FaceId, g: Pix) => {
    g.fill(skin, 0.04);
    if (f === 'F') {
      paintFace(g, { skin, eye: 0x3a6ad8, brow: beard, nose: true });
      // beard and moustache
      g.rect(0, 6, 8, 2, beard).rect(2, 5, 4, 1, shade(beard, 1.15)).rect(3, 6, 2, 1, 0x9a4a3a);
      g.nrect(0, 7, 8, 1, shade(beard, 0.85), 0.08);
    } else if (f === 'L' || f === 'R') g.rect(0, 6, 8, 2, beard);
    else if (f === 'B') g.fill(beard, 0.08);
  };

  /** Open great helm: silver shell, gold brow band and crest, T-shaped face opening. */
  const helm = (f: FaceId, g: Pix) => {
    plate(g);
    if (f === 'T') {
      g.fill(silverD, 0.06).vline(3, gold).vline(4, goldD);
      return;
    }
    if (f === 'D') {
      g.rect(0, 0, 8, 8, -1);
      return;
    }
    g.hline(2, gold).hline(1, silverL);
    if (f === 'F') {
      g.rect(1, 3, 6, 3, -1).rect(2, 6, 4, 2, -1);
      g.set(3, 2, 0xfff4b0).set(4, 2, 0xfff4b0);
      g.vline(0, silverD, 3, 8).vline(7, silverD, 3, 8);
    } else if (f === 'L' || f === 'R') {
      g.rect(0, 3, 1, 5, -1);
      g.set(4, 5, steelD).set(5, 5, steelD).set(4, 6, steelD);
    } else {
      g.hline(7, silverD);
    }
  };

  const body = (f: FaceId, g: Pix) => {
    plate(g);
    if (!isSide(f)) return;
    // belt with a gold buckle
    g.nrect(0, 8, g.w, 1, leather, 0.1);
    if (f === 'F') {
      // white tabard with a gold sun
      g.nrect(2, 1, 4, 11, white, 0.04).vline(1, gold, 1, 12).vline(6, gold, 1, 12);
      g.rect(3, 3, 2, 2, gold).set(3, 2, goldD).set(4, 2, goldD).set(2, 3, goldD).set(5, 4, goldD).set(2, 4, goldD).set(5, 3, goldD).set(3, 5, goldD).set(4, 5, goldD);
      g.rect(3, 8, 2, 1, gold);
      g.nrect(2, 9, 4, 3, white, 0.04).hline(11, blue, 2, 6);
      g.hline(0, gold, 0, 8);
    } else if (f === 'B') {
      g.hline(0, gold);
      g.nrect(0, 9, 8, 3, mail, 0.12);
    } else {
      g.hline(0, gold);
      g.nrect(0, 9, g.w, 3, mail, 0.12);
    }
  };

  const arm = (side: Side) => (f: FaceId, g: Pix) => {
    plate(g);
    if (!isSide(f)) {
      if (f === 'D') g.fill(silverD);
      return;
    }
    // mail sleeve at the elbow, gold-cuffed gauntlet
    g.nrect(0, 5, g.w, 3, mail, 0.14);
    for (let x = 0; x < g.w; x += 2) g.set(x, 6, shade(mail, 0.75));
    g.hline(8, gold);
    g.nrect(0, 9, g.w, 3, silverD, 0.06).hline(9, silver);
    if (f === outer(side)) g.set(1, 10, silverL);
  };

  const leg = (side: Side) => (f: FaceId, g: Pix) => {
    plate(g);
    if (!isSide(f)) {
      if (f === 'D') g.fill(steelD);
      return;
    }
    g.nrect(0, 0, g.w, 4, mail, 0.14);
    g.hline(0, shade(mail, 0.8));
    if (f === 'F') g.rect(1, 5, 2, 2, gold).set(1, 5, 0xfff0a0);
    else g.hline(5, goldD);
    g.nrect(0, 10, g.w, 2, steelD, 0.08).hline(10, silverD);
    void side;
  };

  // ---------------------------------------------------------------- pauldrons, cape
  const pauldron = tex('pal.pauldron', [6, 4, 6], (f, g) => {
    plate(g);
    if (f === 'T') g.border(gold);
    else if (isSide(f)) g.hline(3, gold).hline(0, silverL);
  });
  const pauldron2 = tex('pal.pauldron2', [5, 2, 5], (f, g) => {
    g.fill(silver, 0.05);
    if (isSide(f)) g.hline(1, goldD);
  });
  const cape = tex('pal.cape', [8, 16, 1], (f, g) => {
    g.fill(blue, 0.06);
    if (f === 'B') {
      g.hline(g.h - 1, gold).hline(g.h - 2, goldD);
      // gold sun on the back
      g.rect(3, 5, 2, 2, gold).set(3, 4, goldD).set(4, 4, goldD).set(2, 5, goldD).set(5, 6, goldD).set(2, 6, goldD).set(5, 5, goldD).set(3, 7, goldD).set(4, 7, goldD);
      for (let y = 0; y < g.h; y += 4) g.set(0, y, blueD).set(7, y + 2, blueD);
    } else if (f === 'F') g.fill(whiteD, 0.05).hline(g.h - 1, gold);
  });
  const clasp = tex('pal.clasp', [2, 2, 1], (f, g) => g.fill(gold, 0.05).set(0, 0, 0xfff0a0));

  const parts: RigPart[] = [
    ...humanoid({ name: 'pal', head, hat: helm, body, arm, leg }),
    // layered pauldrons
    ...(['L', 'R'] as Side[]).flatMap((s) => {
      const x = s === 'L' ? 0.6 : -0.6;
      return [cube('arm' + s, [x, 1.6, 0], pauldron), cube('arm' + s, [x * 1.4, -0.6, 0], pauldron2)];
    }),
    // helm crest plume (gold fin)
    cube('head', [0, 8.9, -0.5], tex('pal.crest', [1, 2, 6], (f, g) => g.fill(f === 'T' ? 0xfff0a0 : gold, 0.06))),
    // cape with gold clasps
    cube('capeA', [0, -4, 0], cape, { y0: 0, y1: 8 }),
    cube('capeB', [0, -4, 0], cape, { y0: 8, y1: 16 }),
    cube('chest', [3, 7.2, -2.3], clasp),
    cube('chest', [-3, 7.2, -2.3], clasp),
    ...sword(),
    ...shield(),
  ];

  // ---------------------------------------------------------------- longsword: blade along +z, edges along y
  function sword(): RigPart[] {
    return pixelItem(
      [
        '...o...',
        '..owo..',
        '..wso..',
        '.owsmo.',
        '.owsmo.',
        '.owsmo.',
        '.owsmo.',
        '.owsmo.',
        '.owsmo.',
        '.owsmo.',
        '.owsmo.',
        '.owsmo.',
        '.oyyyo.',
        'GgggggG',
        'GGGrGGG',
        '..obo..',
        '..obo..',
        '..obo..',
        '..oBo..',
        '..GgG..',
        '...G...',
      ],
      { o: steelD, w: 0xf8fbff, s: silverL, m: silver, y: 0xfff4b0, g: gold, G: goldD, r: 0x4ad0ff, b: leather, B: shade(leather, 0.7) },
      { b: 'gripR', at: GRIP, pivot: [3, 16], px: 0.85, th: 0.7, u: '+y', v: '+z', glow: 'yr', thick: { g: 1.5, G: 1.5, r: 1.8 } },
    );
  }

  // ---------------------------------------------------------------- tower shield: face toward -y of the hand, top toward +z
  function shield(): RigPart[] {
    return pixelItem(
      [
        '.GGGGGGGGGG.',
        'GggggggggggG',
        'GgbbbbbbbbgG',
        'GgbbbbybbbgG',
        'GgbbbyyybbgG',
        'GgbbyyWyybgG',
        'GgbyyWWWyygG',
        'GgbbyyWyybgG',
        'GgbbbyyybbgG',
        'GgbbbbybbbgG',
        'GgbbbbbbbbgG',
        'GgBbbbbbbBgG',
        'GgBBbbbbBBgG',
        'GggBBbbBBggG',
        '.GggBBBBggG.',
        '..GgggggggG.',
        '...GGGGGG...',
      ],
      { G: goldD, g: gold, b: blue, B: blueD, y: 0xffd860, W: 0xfff8d8 },
      { b: 'gripL', at: [GRIP[0], GRIP[1] - 1.9, GRIP[2]], pivot: [5.5, 8], px: 0.78, th: 0.7, u: '+x', v: '+z', glow: 'W', thick: { G: 1.5 } },
    );
  }

  return {
    id: 'paladin',
    scale: MC_SCALE,
    posScale: MC_POS_SCALE,
    props: pr,
    parts,
    springs: {
      capeA: { parent: 'chest', at: [0, 7.8, -2.65], kind: 'cape', k: 1 },
      capeB: { parent: 'capeA', at: [0, -8, 0], kind: 'cape', k: 1 },
    },
    tip: { bone: 'gripR', p: [GRIP[0], GRIP[1], GRIP[2] + 16 * 0.85] },
    grip: { R: { at: GRIP, rot: [-8, -28, 0] }, L: { at: GRIP } },
    anim: {
      weapon: 'sword',
      gait: { cadence: 0.46, stride: 32, knee: 40, armSwing: 10, elbow: 12, bounce: 0.55, lean: 5, sway: 3, twist: 5, heavy: 0.6, headBob: 1, armOut: 7, idle: 0.7 },
      stance: { armL: [-25, -14, -20], foreL: [-60, 0, 0], handL: [-3, -12, 21], armR: [-10, 0, -6], foreR: [-38, 0, 0], handR: [30, 0, 0], legL: [-4, 0, 3], legR: [4, 0, -3] },
      stanceRun: 0.85,
      victory: 'salute',
    },
  };
}
