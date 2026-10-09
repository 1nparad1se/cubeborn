import type { HeroRigDef } from '../../render/rig/HeroRig';
import type { RigPart } from '../../render/rig/shapes';
import type { FaceId, Pix } from '../../render/rig/skins';
import { cube, GRIP, humanoid, isSide, MC_POS_SCALE, MC_SCALE, mcProps, outer, paintFace, pixelItem, tex, type Side } from './mcKit';

/**
 * Sorceress, Minecraft Dungeons style: an arcane battle-mage in a midnight-blue robe with violet
 * panels, gold trim and glowing runes, a high collar, long silver hair under a horned crystal
 * circlet, glowing violet eyes, a crystal pauldron on the right shoulder and a gold-capped
 * crystal staff in the right hand. Her focus orb, ringed by shards, hovers over the left palm on
 * the accB spin bone.
 */
export function sorceressRig(): HeroRigDef {
  const pr = mcProps(true);
  const skin = 0xf0ccb4;
  const hair = 0xc4c2e2;
  const hairD = 0x9694bc;
  const night = 0x26254a;
  const nightL = 0x38376a;
  const nightD = 0x18172e;
  const violet = 0x8a4ad8;
  const violetL = 0xc48aff;
  const violetD = 0x5a2a98;
  const gold = 0xeec050;
  const goldD = 0xae8228;
  const rune = 0xe0a0ff;
  const crystal = 0xc8a8ff;

  const head = (f: FaceId, g: Pix) => {
    g.fill(skin, 0.03);
    if (f === 'T') {
      g.fill(hair, 0.08);
      return;
    }
    if (f === 'D') return;
    if (f === 'F') {
      paintFace(g, { skin, eye: 0xb060ff, white: 0xe8d8ff, brow: hairD, nose: false, mouth: 0xb4506a });
      g.nrect(0, 0, 8, 2, hair, 0.08).set(1, 2, hair).set(0, 2, hair).set(7, 2, hair).set(6, 2, hairD);
      g.nrect(0, 3, 1, 5, hair, 0.08).nrect(7, 3, 1, 5, hair, 0.08);
      g.set(1, 3, 0x2a2040).set(6, 3, 0x2a2040);
    } else g.fill(hair, 0.08);
    if (f === 'L' || f === 'R') g.nrect(f === 'L' ? 1 : 3, 4, 4, 2, skin, 0.03);
  };

  const body = (f: FaceId, g: Pix) => {
    g.fill(night, 0.07);
    if (!isSide(f)) return;
    if (f === 'F') {
      // violet front panel, gold trim, glowing rune gem
      g.nrect(2, 1, 4, 11, violet, 0.08).vline(2, gold, 1, 12).vline(5, gold, 1, 12);
      g.rect(3, 3, 2, 2, rune).set(3, 3, 0xffffff);
      g.hline(0, gold);
    } else if (f === 'B') {
      g.nrect(1, 0, 6, 6, hair, 0.08).set(2, 6, hair).set(4, 6, hair).set(3, 6, hairD).set(5, 6, hairD);
    }
    // crystal belt
    g.nrect(0, 7, g.w, 1, goldD, 0.06);
    if (f === 'F') g.set(3, 7, crystal).set(4, 7, crystal);
  };

  const arm = (side: Side) => (f: FaceId, g: Pix) => {
    g.fill(night, 0.07);
    if (f === 'T') return;
    if (f === 'D') {
      g.fill(skin);
      return;
    }
    // violet inner sleeve, flared gold cuff, bare hands
    g.nrect(0, 4, g.w, 4, violet, 0.08).hline(4, violetD);
    g.hline(8, gold).hline(9, goldD);
    g.nrect(0, 10, g.w, 2, skin, 0.03);
    if (f === outer(side)) g.set(1, 2, rune);
  };

  const leg = (side: Side) => (f: FaceId, g: Pix) => {
    g.fill(nightD, 0.07);
    if (f === 'D') {
      g.fill(0x100e1c);
      return;
    }
    if (f === 'T') return;
    g.nrect(0, 9, 4, 3, violetD, 0.06).hline(9, gold);
    void side;
  };

  const skirt = (n: string, front: boolean) =>
    tex(n, [9, 10, 1], (f, g) => {
      g.fill(night, 0.07);
      if (!isSide(f)) return;
      if (front && f === 'F') {
        g.nrect(3, 0, 3, 10, violet, 0.08).vline(2, gold).vline(6, gold);
        g.set(4, 3, rune).set(4, 7, rune);
      } else if (!front && f === 'B') {
        g.set(2, 4, violetL).set(6, 6, violetL).set(4, 8, violetL);
      }
      g.hline(9, gold).hline(8, violetD);
    });
  const skirtSide = tex('so.skirtSide', [1, 9, 5], (f, g) => {
    g.fill(night, 0.07);
    if (isSide(f)) g.hline(8, gold).hline(7, violetD);
  });
  const collar = tex('so.collar', [10, 3, 6], (f, g) => {
    g.fill(night, 0.07);
    if (isSide(f)) g.hline(0, gold).hline(2, violetD);
    if (f === 'T') g.rect(2, 1, 6, 4, -1);
    if (f === 'F') g.rect(3, 0, 4, 3, -1);
  });
  const shoulder = tex('so.pauldron', [5, 3, 5], (f, g) => {
    g.fill(violetD, 0.08);
    if (isSide(f)) g.hline(2, gold).set(2, 0, crystal);
  });
  const shard = tex('so.shard', [1, 3, 1], (f, g) => g.fill(crystal, 0.05).set(0, 0, 0xffffff));
  const hornC = tex('so.horn', [1, 3, 1], (f, g) => g.fill(violetL, 0.05).set(0, 0, 0xffffff));
  const hairBack = tex('so.hair', [8, 10, 1], (f, g) => {
    g.fill(hair, 0.08);
    for (let x = 0; x < 8; x += 2) g.set(x, 3 + (x % 3), hairD);
    g.set(0, 9, -1).set(4, 9, -1).set(7, 9, -1).set(7, 8, -1);
  });
  const orb = tex('so.orb', [3, 3, 3], (f, g) => g.fill(0xe8c8ff, 0.05).set(1, 1, 0xffffff));
  const orbShard = tex('so.orbShard', [1, 2, 1], (f, g) => g.fill(rune, 0.04));

  const parts: RigPart[] = [
    ...humanoid({ name: 'so', head, body, arm, leg, slim: true }),
    cube('skirtF', [0, -5, 0], skirt('so.skirtF', true)),
    cube('skirtB', [0, -5, 0], skirt('so.skirtB', false)),
    cube('hips', [4.6, -2.4, 0], skirtSide),
    cube('hips', [-4.6, -2.4, 0], skirtSide),
    cube('chest', [0, 8.4, -0.4], collar),
    cube('armR', [-0.5, 1.6, 0], shoulder),
    cube('armR', [-1.6, 3.8, 0], shard, { r: [0, 0, 18], g: true }),
    cube('armR', [-0.4, 3.9, 1], shard, { r: [10, 0, 8], g: true }),
    cube('accC', [0, -5, 0], hairBack),
    // horned crystal circlet
    ...(['L', 'R'] as Side[]).flatMap((s) => {
      const k = s === 'L' ? 1 : -1;
      return [cube('head', [k * 3.4, 9.2, 1.5], hornC, { r: [-10, 0, -k * 22] }), cube('head', [k * 2.1, 8.7, 2.8], shard, { r: [-10, 0, -k * 8], c: 0xd8c0ff })];
    }),
    cube('head', [0, 8.9, 3.6], tex('so.gem', [1, 2, 1], (f, g) => g.fill(rune, 0.02)), { g: true }),
    // focus orb with orbiting shards
    cube('accB', [0, 0, 0], orb, { g: true }),
    ...[0, 1, 2, 3].map((i) => {
      const a = (i / 4) * Math.PI * 2;
      return cube('accB', [Math.sin(a) * 3, Math.cos(a) * 3, 0], orbShard, { r: [0, 0, (-a * 180) / Math.PI], g: true });
    }),
    ...staff(),
  ];

  // ---------------------------------------------------------------- crystal staff along the hand's z axis (gripped below the middle)
  function staff(): RigPart[] {
    const rows = [
      '..c..',
      '.cCc.',
      '.cCc.',
      'GcCcG',
      'G.c.G',
      '.GgG.',
      '..s..',
      '..s..',
      '..g..',
      '..s..',
      '..s..',
      '..s..',
      '..s..',
      '..s..',
      '..g..',
      '..s..',
      '..s..',
      '..s..',
      '..s..',
      '..G..',
      '..g..',
    ];
    return pixelItem(rows, { c: crystal, C: 0xfff4ff, G: goldD, g: gold, s: nightL }, { b: 'gripR', at: GRIP, pivot: [2, 14], px: 0.9, th: 0.8, u: '+y', v: '+z', glow: 'cC', thick: { c: 1.5, C: 1.5, G: 1.3 } });
  }

  return {
    id: 'sorceress',
    scale: MC_SCALE,
    posScale: MC_POS_SCALE,
    props: pr,
    parts,
    springs: {
      accB: { parent: 'handL', at: [0, -1.5, 4.5], kind: 'spin', axis: 'z', speed: 2.2 },
      accC: { parent: 'head', at: [0, 3.5, -4.6], kind: 'bob', k: 1.5 },
      skirtF: { parent: 'hips', at: [0, 1.6, 1.6], kind: 'flap' },
      skirtB: { parent: 'hips', at: [0, 1.6, -1.6], kind: 'flap' },
    },
    tip: { bone: 'accB', p: [0, 0, 0] },
    grip: { R: { at: GRIP }, L: { at: GRIP } },
    anim: {
      weapon: 'staff',
      gait: { cadence: 0.5, stride: 26, knee: 32, armSwing: 8, elbow: 12, bounce: 0.25, lean: 4, sway: 4, twist: 6, heavy: 0, headBob: 0.4, armOut: 5, idle: 1.1 },
      stance: { chest: [-3, 8, 0], head: [-2, -6, 0], armL: [-34, -10, 14], foreL: [-60, 0, 0], handL: [0, 0, 0], armR: [-4, 0, -10], foreR: [-18, 0, 0], handR: [30, -25, 0] },
      stanceRun: 0.7,
      victory: 'raise',
    },
  };
}


