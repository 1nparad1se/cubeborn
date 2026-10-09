import type { HeroRigDef } from '../../render/rig/HeroRig';
import type { RigPart } from '../../render/rig/shapes';
import { shade, type FaceId, type Pix } from '../../render/rig/skins';
import { backCols, cube, GRIP, humanoid, isSide, MC_POS_SCALE, MC_SCALE, mcProps, outer, paintFace, pixelItem, tex, type Side } from './mcKit';

/**
 * Berserker, Minecraft Dungeons style: a red-bearded northman in a horned iron half-helm, a
 * shaggy fur mantle, leather harness over a bare scarred chest, studded bracers, fur trousers,
 * a torn red war-cloth at the belt and a notched iron greatsword with a glowing red rune
 * channel, longer than he is tall.
 */
export function berserkerRig(): HeroRigDef {
  const pr = mcProps();
  const skin = 0xdca681;
  const skinD = shade(skin, 0.86);
  const beard = 0xb8461f;
  const beardD = 0x8e3418;
  const iron = 0x6e7480;
  const ironL = 0x9aa2ae;
  const ironD = 0x3e434e;
  const leather = 0x6a4126;
  const leatherD = 0x47291a;
  const fur = 0x8a6440;
  const furL = 0xb08a5c;
  const furD = 0x5e4028;
  const red = 0xb52a2a;
  const redD = 0x7a1818;
  const bone = 0xeadfc4;
  const rune = 0xff4a2a;

  const head = (f: FaceId, g: Pix) => {
    g.fill(skin, 0.04);
    if (f === 'F') {
      paintFace(g, { skin, eye: 0x4a2a1a, white: 0xf4ece0, brow: beardD, nose: true });
      // war paint across the eyes, wild beard with a dark mouth
      g.set(0, 4, red).set(7, 4, red).set(0, 3, redD).set(7, 3, redD);
      g.nrect(0, 5, 1, 3, beard, 0.1).nrect(7, 5, 1, 3, beard, 0.1);
      g.nrect(1, 7, 6, 1, beard, 0.1).rect(2, 6, 4, 1, beard).set(1, 6, beardD).set(6, 6, beardD);
      g.rect(3, 6, 2, 1, 0x5a1a10).set(2, 5, beard).set(5, 5, beard);
      g.set(3, 7, beardD).set(4, 7, 0xe0c060);
    } else if (f === 'B' || f === 'T') g.fill(beard, 0.12);
    else if (isSide(f)) {
      g.nrect(0, 0, 8, 8, beard, 0.12);
      const [a] = backCols(f, 8, 8);
      // ear and cheek showing in front of the mane
      g.nrect(f === 'L' ? 1 : 3, 3, 4, 2, skin, 0.03).set(f === 'L' ? 3 : 4, 4, skinD);
      void a;
    }
  };

  /** Iron half-helm: dark band with rivets, nose guard; everything below is cut out. */
  const helm = (f: FaceId, g: Pix) => {
    g.rect(0, 0, 8, 8, -1);
    if (f === 'T') {
      g.fill(iron, 0.08).vline(3, ironL).vline(4, ironD);
      return;
    }
    if (f === 'D') return;
    g.nrect(0, 0, 8, 3, iron, 0.08).hline(0, ironL).hline(2, ironD);
    for (let x = 1; x < 8; x += 3) g.set(x, 1, ironL);
    if (f === 'F') g.rect(3, 3, 2, 2, iron).set(3, 4, ironD).set(4, 4, ironD);
    if (f === 'B') g.nrect(1, 3, 6, 2, beard, 0.1).set(3, 5, beard).set(4, 5, beardD);
  };

  const body = (f: FaceId, g: Pix) => {
    g.fill(skin, 0.04);
    if (!isSide(f)) return;
    if (f === 'F') {
      // chest shading, scars, harness strap from the left shoulder
      g.rect(1, 3, 2, 1, skinD).rect(5, 3, 2, 1, skinD).set(3, 5, skinD).set(4, 6, skinD);
      g.set(5, 4, 0xe0a888).set(6, 5, 0xe0a888);
      for (let i = 0; i < 8; i++) g.set(7 - i, i, leather).set(6 - i, i, leatherD);
      g.set(3, 4, ironL);
    } else if (f === 'B') {
      for (let i = 0; i < 8; i++) g.set(i, i, leather).set(i + 1, i, leatherD);
    }
    // belt, buckle and the kilt
    g.nrect(0, 7, g.w, 2, leatherD, 0.08).hline(7, leather);
    if (f === 'F') g.rect(3, 7, 2, 2, ironL).set(3, 8, iron);
    g.nrect(0, 9, g.w, 3, fur, 0.14);
    for (let x = 0; x < g.w; x += 2) g.set(x, 11, furD);
  };

  const arm = (side: Side) => (f: FaceId, g: Pix) => {
    g.fill(skin, 0.04);
    if (f === 'T') return;
    if (f === 'D') {
      g.fill(skinD);
      return;
    }
    if (f === outer(side)) g.set(1, 3, 0xe8b494).set(2, 4, 0xe8b494).set(3, 5, 0xe8b494);
    // studded leather bracers and wraps
    g.nrect(0, 6, g.w, 4, leather, 0.1).hline(6, leatherD).hline(9, leatherD);
    g.set(1, 7, ironL).set(g.w - 2, 8, ironL);
    g.nrect(0, 10, g.w, 2, skin, 0.04).hline(11, skinD);
  };

  const leg = (side: Side) => (f: FaceId, g: Pix) => {
    g.fill(fur, 0.14);
    if (f === 'D') {
      g.fill(leatherD);
      return;
    }
    if (f === 'T') return;
    for (let y = 1; y < 7; y += 2) g.set((y + (side === 'L' ? 1 : 0)) % 4, y, furD);
    // leather cross-wraps, fur cuff and boots
    g.set(0, 4, leather).set(1, 5, leather).set(2, 4, leather).set(3, 5, leather);
    g.nrect(0, 7, 4, 1, furL, 0.1);
    g.nrect(0, 8, 4, 4, leatherD, 0.08).hline(11, 0x2a1810);
    if (f === 'F') g.set(1, 9, iron).set(2, 9, iron);
  };

  const mantle = tex('bz.mantle', [10, 3, 6], (f, g) => {
    g.fill(fur, 0.16);
    if (f === 'T') {
      for (let i = 0; i < 10; i += 3) g.set(i, 1, furL).set(i + 1, 4, furL);
      return;
    }
    if (f === 'D') {
      g.fill(furD);
      return;
    }
    g.hline(0, furL);
    for (let x = 0; x < g.w; x++) if ((x * 7) % 3 === 0) g.set(x, 2, -1);
  });
  const horn = (n: string, size: [number, number, number], c: number) => tex(n, size, (f, g) => g.fill(c, 0.06).hline(g.h - 1, shade(c, 0.85)));
  const hornA = horn('bz.hornA', [2, 2, 2], 0xcfc2a2);
  const hornB = horn('bz.hornB', [2, 2, 2], bone);
  const hornC = horn('bz.hornC', [1, 2, 1], 0xfff6e2);
  const cloth = tex('bz.cloth', [4, 6, 1], (f, g) => {
    g.fill(red, 0.08);
    if (f === 'F' || f === 'B') {
      g.vline(0, redD).vline(3, redD);
      g.set(1, 1, bone).set(2, 2, bone).set(2, 1, bone).set(1, 2, bone);
      g.set(1, 5, -1).set(3, 4, -1).set(3, 5, -1);
    }
  });
  const pauldron = tex('bz.pauldron', [5, 3, 5], (f, g) => {
    g.fill(iron, 0.08);
    if (isSide(f)) g.hline(0, ironL).hline(2, ironD).set(1, 1, ironL).set(3, 1, ironL);
  });
  const spike = tex('bz.spike', [1, 2, 1], (f, g) => g.fill(ironL, 0.05));

  const parts: RigPart[] = [
    ...humanoid({ name: 'bz', head, hat: helm, body, arm, leg }),
    cube('chest', [0, 7.6, 0], mantle),
    // horns: three blocks curving up and out
    ...(['L', 'R'] as Side[]).flatMap((s) => {
      const k = s === 'L' ? 1 : -1;
      return [
        cube('head', [k * 5.0, 6.6, 0.5], hornA),
        cube('head', [k * 6.4, 7.6, 0.5], hornB, { r: [0, 0, k * 20] }),
        cube('head', [k * 7.0, 9.4, 0.5], hornC, { r: [0, 0, k * 10] }),
      ];
    }),
    // iron pauldron with a spike on the shoulders
    ...(['L', 'R'] as Side[]).flatMap((s) => [cube('arm' + s, [s === 'L' ? 0.5 : -0.5, 2.3, 0], pauldron), cube('arm' + s, [s === 'L' ? 1.2 : -1.2, 4.6, 0], spike)]),
    // war-cloth front and back
    cube('skirtF', [0, -3, 0], cloth),
    cube('skirtB', [0, -3, 0], cloth),
    ...greatsword(),
  ];

  // ---------------------------------------------------------------- greatsword (blade along +z)
  function greatsword(): RigPart[] {
    const rows: string[] = ['....o....', '...oso...', '..osrmo..'];
    for (let i = 0; i < 22; i++) rows.push(i === 5 || i === 13 ? '..osrm...' : i === 9 ? '...srmo..' : '..osrmo..');
    rows.push('.oIIIIIo.', 'oIiiyiiIo', '.oIIIIIo.', '...obo...', '...obo...', '...oBo...', '...obo...', '...oIo...', '....o....');
    return pixelItem(rows, { o: ironD, s: ironL, m: iron, r: rune, I: ironD, i: iron, y: rune, b: leather, B: leatherD }, { b: 'gripR', at: GRIP, pivot: [4, rows.length - 5], px: 1.05, th: 0.9, u: '+y', v: '+z', glow: 'ry', thick: { I: 1.4, i: 1.4, y: 1.5 } });
  }

  return {
    id: 'berserker',
    scale: MC_SCALE,
    posScale: MC_POS_SCALE,
    props: pr,
    parts,
    springs: {
      skirtF: { parent: 'hips', at: [0, 2.2, 2.4], kind: 'flap' },
      skirtB: { parent: 'hips', at: [0, 2.2, -2.4], kind: 'flap' },
    },
    tip: { bone: 'gripR', p: [GRIP[0], GRIP[1], GRIP[2] + 29 * 1.05] },
    grip: { R: { at: GRIP, rot: [-8, -15, -33] }, L: { at: GRIP } },
    anim: {
      weapon: 'hammer',
      gait: { cadence: 0.42, stride: 34, knee: 42, armSwing: 8, elbow: -22, bounce: 0.75, lean: 7, sway: 5, twist: 6, heavy: 1, headBob: 2, armOut: 14, idle: 0.9 },
      stance: { chest: [-3, -6, 0], armR: [-57, -21, 15], foreR: [-37, 0, 0], handR: [-35, 9, -35], armL: [4, 0, 9], foreL: [-22, 0, 0], legL: [-3, 0, 5], legR: [3, 0, -5] },
      stanceRun: 1,
      victory: 'raise',
    },
  };
}
