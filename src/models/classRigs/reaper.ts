import type { HeroRigDef } from '../../render/rig/HeroRig';
import type { RigPart } from '../../render/rig/shapes';
import type { PoseMap } from '../../render/rig/animTypes';
import { shade, type FaceId, type Pix } from '../../render/rig/skins';
import { cube, GRIP, humanoid, isSide, MC_POS_SCALE, MC_SCALE, mcProps, outer, pixelItem, tex, type Side } from './mcKit';

/** Idle stance (also the base the reaper action clips are authored against). */
export const REAPER_STANCE: PoseMap = {
  rootPos: [0, -1.0, 0],
  legL: [-26, -6, 7], shinL: [38, 0, 0], footL: [-12, 6, 0],
  legR: [-2, 8, -7], shinR: [30, 0, 0], footR: [-26, -8, 0],
  spine: [10, 0, 0], chest: [13, 6, 0], head: [-20, -4, 0],
  armL: [-22, 0, 24], foreL: [-42, 0, 0], handL: [0, 0, 0],
  armR: [-30, 0, -22], foreR: [-50, 0, 0], handR: [0, 0, 0],
};

/**
 * Reaper, Minecraft Dungeons style: a hooded harvester of souls. A deep charcoal hood over a
 * shadowed face with a white bone mask and glowing violet eye slits, dark wrapped cloth with
 * violet runes, a long tattered cloak, and a small soul-scythe in each hand, held reversed.
 */
export function reaperRig(): HeroRigDef {
  const pr = mcProps();
  const cloak = 0x3a2f52;
  const cloakL = 0x55467a;
  const cloakD = 0x221a32;
  const wrap = 0x4a4560;
  const wrapL = 0x6e6888;
  const shadow = 0x0c0a12;
  const mask = 0xeee8de;
  const maskD = 0xbfb6aa;
  const violet = 0xb86aff;
  const violetD = 0x6a32a8;
  const steel = 0xb8b4cc;
  const steelD = 0x6e6a84;
  const leather = 0x2e2626;

  const head = (f: FaceId, g: Pix) => {
    g.fill(shadow, 0.05);
    if (f !== 'F') return;
    // bone mask with eye slits and a cracked cheek
    g.nrect(1, 2, 6, 5, mask, 0.04).rect(2, 6, 4, 1, maskD).set(1, 6, shadow).set(6, 6, shadow);
    g.rect(1, 4, 2, 1, violetD).rect(5, 4, 2, 1, violetD);
    g.set(3, 5, maskD).set(4, 5, maskD).set(5, 3, maskD).set(6, 2, maskD);
    g.rect(2, 7, 4, 1, shadow);
  };

  /** Deep hood: covers the head, a narrow face opening in shadow. */
  const hood = (f: FaceId, g: Pix) => {
    g.fill(cloak, 0.07);
    if (f === 'D') {
      g.rect(0, 0, 8, 8, -1);
      return;
    }
    if (f === 'T') {
      g.vline(3, cloakD).vline(4, cloakL);
      return;
    }
    if (f === 'F') {
      g.rect(1, 2, 6, 6, -1);
      g.hline(1, cloakL, 1, 7).vline(0, cloakD, 2, 8).vline(7, cloakD, 2, 8);
    } else {
      g.hline(0, cloakL);
      for (let y = 2; y < 8; y += 3) g.set(f === 'B' ? 3 : 2, y, cloakD);
    }
  };

  const body = (f: FaceId, g: Pix) => {
    g.fill(wrap, 0.08);
    if (!isSide(f)) return;
    // wrapped bands, a crossing harness and a violet rune clasp
    for (let y = 1; y < 8; y += 3) g.hline(y, shade(wrap, 0.82));
    if (f === 'F') {
      for (let i = 0; i < 8; i++) g.set(i, i, leather);
      g.rect(3, 3, 2, 2, violetD).set(3, 3, violet);
    }
    g.nrect(0, 8, g.w, 1, leather, 0.05);
    if (f === 'F') g.rect(3, 8, 2, 1, violet);
    g.nrect(0, 9, g.w, 3, cloakD, 0.08);
  };

  const arm = (side: Side) => (f: FaceId, g: Pix) => {
    g.fill(wrap, 0.08);
    if (f === 'T') {
      g.fill(cloak, 0.07);
      return;
    }
    if (f === 'D') {
      g.fill(cloakD);
      return;
    }
    // cloak sleeve to the elbow, criss-cross wraps, dark gloves
    g.nrect(0, 0, g.w, 5, cloak, 0.07).hline(4, cloakD);
    for (let y = 6; y < 10; y++) g.set((y + (side === 'L' ? 0 : 2)) % g.w, y, wrapL);
    g.nrect(0, 10, g.w, 2, shadow, 0.05);
    if (f === outer(side)) g.set(1, 2, violetD);
  };

  const leg = (side: Side) => (f: FaceId, g: Pix) => {
    g.fill(cloakD, 0.08);
    if (f === 'D') {
      g.fill(shadow);
      return;
    }
    if (f === 'T') return;
    for (let y = 6; y < 10; y += 2) g.hline(y, wrap);
    g.set(side === 'L' ? 1 : 2, 7, wrapL);
    g.nrect(0, 10, 4, 2, leather, 0.06);
  };

  const cape = tex('rp.cloak', [10, 15, 1], (f, g) => {
    g.fill(cloak, 0.08);
    if (!isSide(f)) return;
    for (let y = 2; y < 15; y += 4) g.set((y * 3) % 10, y, cloakD);
    if (f === 'B') {
      // violet runes
      g.rect(4, 5, 2, 1, violetD).set(4, 6, violetD).set(5, 7, violetD);
      g.rect(2, 9, 1, 2, violetD).set(7, 10, violetD).set(7, 11, violetD).set(6, 11, violetD);
    }
    // tattered hem
    const cut = [3, 1, 4, 2, 0, 3, 1, 4, 2, 2];
    for (let x = 0; x < 10; x++) for (let k = 0; k < cut[x]; k++) g.set(x, 14 - k, -1);
  });
  const hoodTip = tex('rp.hoodTip', [5, 4, 3], (f, g) => g.fill(cloak, 0.07).hline(g.h - 1, cloakD));
  const eyes = tex('rp.eyes', [2, 1, 1], (f, g) => g.fill(0xe6c4ff, 0.02));

  const parts: RigPart[] = [
    ...humanoid({ name: 'rp', head, hat: hood, body, arm, leg }),
    cube('head', [0, 6.2, -4.6], hoodTip, { r: [-12, 0, 0] }),
    cube('head', [-2, 3.5, 4.05], eyes, { g: true }),
    cube('head', [2, 3.5, 4.05], eyes, { g: true }),
    cube('capeA', [0, -3.5, 0], cape, { y0: 0, y1: 7 }),
    cube('capeB', [0, -4, 0], cape, { y0: 7, y1: 15 }),
    ...scythe('gripL'),
    ...scythe('gripR'),
  ];

  // ---------------------------------------------------------------- soul scythe, reverse grip: shaft toward -z, blade hooks toward +y
  function scythe(b: 'gripL' | 'gripR'): RigPart[] {
    const rows = [
      '..ssss....',
      '.Wmmmmsss.',
      '.W...eemms',
      '.W.....ems',
      '.w......es',
      '.w.......e',
      '.w........',
      '.b........',
      '.b........',
      'PPP.......',
    ];
    return pixelItem(rows, { s: steel, m: steelD, e: violet, W: steelD, w: 0x4a3a30, b: leather, P: violet }, { b, at: GRIP, pivot: [1, 7.5], px: 0.95, th: 0.45, u: '+y', v: '-z', glow: 'eP', thick: { W: 1.6, w: 1.6, b: 1.6, P: 1.8 } });
  }

  return {
    id: 'reaper',
    scale: MC_SCALE,
    posScale: MC_POS_SCALE,
    props: pr,
    parts,
    springs: {
      // 'bob' keeps the long cloak trailing low instead of flying flat at a run
      capeA: { parent: 'chest', at: [0, 7.8, -2.6], kind: 'bob', k: 0.8, rest: -6 },
      capeB: { parent: 'capeA', at: [0, -7, 0], kind: 'bob', k: 0.6, rest: 8 },
    },
    tip: { bone: 'gripR', p: [GRIP[0], GRIP[1] + 8 * 0.95, GRIP[2] - 2.5 * 0.95] },
    grip: { L: { at: GRIP, rot: [-30, 0, 0] }, R: { at: GRIP, rot: [-30, 0, 0] } },
    anim: {
      weapon: 'sword',
      gait: { cadence: 0.5, stride: 32, knee: 42, armSwing: 8, elbow: 26, bounce: 0.2, lean: 10, sway: 1, twist: 5, heavy: 0, headBob: 0.2, armOut: 12, idle: 0.8 },
      stance: REAPER_STANCE,
      stanceRun: 0.75,
      victory: 'raise',
    },
  };
}
