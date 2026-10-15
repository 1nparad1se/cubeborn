import type { HeroRigDef } from '../../render/rig/HeroRig';
import type { RigPart } from '../../render/rig/shapes';
import { shade } from '../../render/rig/skins';
import { bk } from './blockKit';
import { GRIP, MC_POS_SCALE, MC_SCALE, mcProps, pixelItem, type Side } from './mcKit';

/**
 * Paladin, a knight of light built as a detailed block model (many small bevelled blocks, no pixel
 * skins): silver plate with gold trim over a white tabard bearing a gold sun, a blue cape with a
 * gold hem and sun, an open-faced great helm with a gold crest over a bearded face, big layered
 * pauldrons, mail at the joints. A pixel-art longsword in the right hand and a tall tower shield
 * with a radiant sun on the left arm.
 */

const SKIN = 0xdca07a;
const SKIN_D = 0xbc8060;
const SKIN_L = 0xecb694;
const BEARD = 0x7a4a26;
const BEARD_L = 0x8e5a30;
const BEARD_D = 0x5a3418;
const EYE = 0x3a6ad8;
const SILVER = 0xa8b2c2;
const SILVER_L = 0xccd4e0;
const SILVER_H = 0xe6ecf4;
const SILVER_D = 0x76808f;
const STEEL_D = 0x4a5264;
const GOLD = 0xf0c048;
const GOLD_L = 0xfff0a0;
const GOLD_D = 0xb07c22;
const WHITE = 0xe8e2d2;
const WHITE_D = 0xd0c9b6;
const BLUE = 0x2f62c0;
const BLUE_L = 0x4278d4;
const BLUE_D = 0x1d3f86;
const LEATHER = 0x6a4428;
const MAIL = 0x7c8698;
const MAIL_D = 0x5e6878;

/** Gold sun: a core with eight short rays, on a plane at depth z0..z1 (facing +z or -z). */
function sun(P: RigPart[], b: string, cx: number, cy: number, z0: number, z1: number, s = 1) {
  P.push(bk(b, cx - 0.9 * s, cy - 0.9 * s, z0, cx + 0.9 * s, cy + 0.9 * s, z1, GOLD, { bv: 0.08 }));
  P.push(bk(b, cx - 0.45 * s, cy - 0.45 * s, z0 + (z1 > 0 ? 0.1 : -0.1), cx + 0.45 * s, cy + 0.45 * s, z1 + (z1 > 0 ? 0.1 : -0.1), GOLD_L, { bv: 0, g: true }));
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const x = cx + Math.sin(a) * 1.55 * s;
    const y = cy + Math.cos(a) * 1.55 * s;
    const r = i % 2 ? 0.28 : 0.38;
    P.push(bk(b, x - r * s, y - r * s, z0, x + r * s, y + r * s, z1, GOLD_D, { bv: 0 }));
  }
}

export function paladinRig(): HeroRigDef {
  const pr = mcProps();
  const P: RigPart[] = [];
  const add = (...a: RigPart[]) => P.push(...a);

  // ---------------------------------------------------------------- head: bearded face
  add(bk('head', -3.4, 0.2, -3.2, 3.4, 6.4, 3.6, SKIN));
  add(bk('head', -1.6, -1.2, -1.6, 1.6, 0.6, 1.6, SKIN_D));
  add(bk('head', -0.6, 2.4, 3.5, 0.6, 3.8, 4.05, SKIN_D, { bv: 0.1 })); // nose
  for (const k of [-1, 1]) {
    add(bk('head', k * 0.7, 4.6, 3.45, k * 2.8, 5.1, 3.9, BEARD_D, { bv: 0.08 })); // brows
    add(bk('head', k * 0.9, 3.7, 3.45, k * 2.6, 4.5, 3.75, 0xf4f0ea, { bv: 0 }));
    add(bk('head', k * 0.9, 3.7, 3.6, k * 1.7, 4.5, 3.85, EYE, { bv: 0 }));
    add(bk('head', k * 1.6, 3.2, 3.55, k * 3.0, 3.6, 3.8, SKIN_L, { bv: 0 })); // cheekbones
  }
  // beard: full jaw, side burns, moustache, mouth
  add(bk('head', -3.6, -0.6, 1.0, 3.6, 2.2, 4.1, BEARD));
  add(bk('head', -2.6, -1.4, 2.0, 2.6, 0.0, 4.0, BEARD_D, { bv: 0.15 }));
  add(bk('head', -1.6, -2.0, 2.6, 1.6, -1.0, 3.8, BEARD, { bv: 0.15 }));
  add(bk('head', -2.0, 2.0, 3.7, 2.0, 2.6, 4.3, BEARD_L, { bv: 0.1 })); // moustache
  add(bk('head', -1.0, 1.4, 3.9, 1.0, 1.9, 4.2, 0x9a4a3a, { bv: 0 })); // mouth
  for (let i = 0; i < 6; i++) add(bk('head', -3 + i, -0.3 - (i % 2) * 0.5, 4.0, -2 + i, 1.4, 4.25, i % 2 ? BEARD_D : BEARD_L, { bv: 0 }));
  for (const k of [-1, 1]) add(bk('head', k * 3.2, 0.6, -0.6, k * 3.7, 4.0, 3.0, BEARD, { bv: 0.1 }));

  // open great helm: shell, cheek guards, gold brow band, gold crest
  add(bk('head', -4.4, 6.0, -4.4, 4.4, 8.6, 4.4, SILVER));
  add(bk('head', -4.0, 8.4, -4.0, 4.0, 9.0, 4.0, SILVER_L, { bv: 0.2 }));
  add(bk('head', -4.4, 0.6, -4.4, 4.4, 6.2, -1.0, SILVER)); // back
  for (const k of [-1, 1]) {
    add(bk('head', k * 3.5, 0.6, -4.4, k * 4.5, 6.4, 2.4, SILVER)); // side
    add(bk('head', k * 2.5, 0.4, 2.4, k * 4.5, 5.6, 4.5, SILVER_L, { bv: 0.2 })); // cheek guard
    add(bk('head', k * 2.4, 0.3, 4.2, k * 2.8, 5.6, 4.6, SILVER_D, { bv: 0 })); // inner rim
    add(bk('head', k * 4.4, 2.6, -1.6, k * 4.65, 3.4, 0.6, STEEL_D, { bv: 0 })); // breaths
    add(bk('head', k * 4.4, 1.6, -1.6, k * 4.65, 2.2, 0.0, STEEL_D, { bv: 0 }));
  }
  add(bk('head', -4.6, 5.6, -4.6, 4.6, 6.4, 4.6, GOLD, { bv: 0.12 })); // brow band
  add(bk('head', -1.0, 5.4, 4.4, 1.0, 6.6, 4.85, GOLD_L, { g: true, bv: 0.1 })); // brow jewel
  add(bk('head', -4.5, 0.4, -4.6, 4.5, 1.0, -1.0, SILVER_D, { bv: 0.1 })); // lower rim
  add(bk('head', -0.6, 8.6, -3.8, 0.6, 10.2, 3.2, GOLD)); // crest fin
  add(bk('head', -0.45, 10.0, -3.0, 0.45, 10.8, 2.0, GOLD_L, { bv: 0.12 }));
  add(bk('head', -0.65, 8.6, -4.6, 0.65, 9.8, -3.6, GOLD_D, { bv: 0.12 }));
  add(bk('head', -0.65, 8.6, 3.0, 0.65, 9.4, 4.0, GOLD_D, { bv: 0.12 }));

  // ---------------------------------------------------------------- chest: plate, tabard, sun, gorget
  add(bk('chest', -4.0, 0, -2.2, 4.0, 8.0, 2.2, SILVER));
  add(bk('chest', -3.4, 5.2, 1.8, 3.4, 7.4, 2.5, SILVER_L, { bv: 0.25 })); // upper breastplate
  add(bk('chest', -3.2, 7.2, -2.4, 3.2, 8.6, 2.4, SILVER_D, { bv: 0.2 })); // gorget
  add(bk('chest', -3.4, 8.2, -2.6, 3.4, 8.8, 2.6, GOLD, { bv: 0.12 }));
  for (const k of [-1, 1]) {
    add(bk('chest', k * 3.6, 0.2, -2.3, k * 4.3, 7.6, 2.3, SILVER_D, { bv: 0.12 })); // side plates
    add(bk('chest', k * 3.7, 7.2, -2.4, k * 4.35, 7.8, 2.4, GOLD_D, { bv: 0 }));
  }
  // white tabard with gold edges and the sun
  add(bk('chest', -2.4, 0, 2.2, 2.4, 7.2, 2.7, WHITE, { bv: 0.1 }));
  add(bk('chest', -2.6, 0, 2.3, -2.1, 7.4, 2.85, GOLD, { bv: 0.06 }));
  add(bk('chest', 2.1, 0, 2.3, 2.6, 7.4, 2.85, GOLD, { bv: 0.06 }));
  add(bk('chest', -2.6, 7.0, 2.3, 2.6, 7.5, 2.85, GOLD, { bv: 0.06 }));
  sun(P, 'chest', 0, 4.4, 2.6, 2.95, 0.95);
  // back plate with a spine ridge, cape clasps
  add(bk('chest', -3.4, 1.0, -2.6, 3.4, 7.2, -2.0, SILVER_L, { bv: 0.25 }));
  add(bk('chest', -0.5, 1.0, -2.85, 0.5, 7.2, -2.5, SILVER_D, { bv: 0.1 }));
  for (const k of [-1, 1]) {
    add(bk('chest', k * 2.2, 6.4, -3.1, k * 3.8, 8.0, -2.4, GOLD, { bv: 0.15 }));
    add(bk('chest', k * 2.7, 6.9, -3.3, k * 3.3, 7.5, -3.0, GOLD_L, { bv: 0 }));
  }
  // spine: plate, tabard, mail on the flanks
  add(bk('spine', -3.8, 0.9, -2.1, 3.8, 3.9, 2.1, MAIL));
  add(bk('spine', -2.4, 0.9, 2.0, 2.4, 3.9, 2.6, WHITE, { bv: 0.1 }));
  add(bk('spine', -2.6, 0.9, 2.1, -2.1, 3.9, 2.75, GOLD, { bv: 0.06 }));
  add(bk('spine', 2.1, 0.9, 2.1, 2.6, 3.9, 2.75, GOLD, { bv: 0.06 }));
  add(bk('spine', -3.6, 1.2, -2.4, 3.6, 3.9, -1.8, SILVER, { bv: 0.2 }));
  for (let i = 0; i < 4; i++) add(bk('spine', -3.9, 1.0 + i * 0.75, -2.2, 3.9, 1.3 + i * 0.75, 2.2, MAIL_D, { bv: 0 }));

  // ---------------------------------------------------------------- hips: belt with gold buckle, tabard hem, mail skirt
  add(bk('hips', -4.1, -0.4, -2.2, 4.1, 3.0, 2.2, MAIL));
  add(bk('hips', -4.4, 2.0, -2.5, 4.4, 3.2, 2.5, LEATHER));
  add(bk('hips', -1.1, 1.8, 2.4, 1.1, 3.4, 2.9, GOLD, { bv: 0.1 }));
  add(bk('hips', -0.5, 2.3, 2.75, 0.5, 2.9, 3.0, GOLD_L, { bv: 0 }));
  add(bk('hips', -2.4, -2.2, 2.2, 2.4, 2.0, 2.6, WHITE, { bv: 0.1 })); // tabard hem
  add(bk('hips', -2.4, -2.4, 2.25, 2.4, -1.7, 2.75, BLUE, { bv: 0.06 }));
  for (const k of [-1, 1]) add(bk('hips', k * 2.1, -2.4, 2.25, k * 2.6, 2.0, 2.75, GOLD, { bv: 0.06 }));
  for (let i = 0; i < 8; i++) {
    const x = -4 + i;
    add(bk('hips', x, -1.4 - (i % 2) * 0.4, -2.45, x + 1, 1.0, -1.8, i % 2 ? MAIL_D : MAIL, { bv: 0.08 })); // back mail
  }
  for (const k of [-1, 1]) add(bk('hips', k * 3.6, -1.2, -2.3, k * 4.3, 1.4, 2.0, MAIL_D, { bv: 0.08 }));

  // ---------------------------------------------------------------- limbs, mirrored
  for (const s of ['L', 'R'] as Side[]) {
    const k = s === 'L' ? 1 : -1;
    const arm = 'arm' + s;
    const fore = 'fore' + s;
    const hand = 'hand' + s;
    const leg = 'leg' + s;
    const shin = 'shin' + s;
    const foot = 'foot' + s;
    // layered pauldron: big dome, gold rim, two lames below
    add(bk(arm, k * -2.6, -0.4, -3.0, k * 3.8, 3.4, 3.0, SILVER, { bv: 0.35 }));
    add(bk(arm, k * -1.8, 3.2, -2.4, k * 3.0, 4.0, 2.4, SILVER_L, { bv: 0.25 }));
    add(bk(arm, k * -0.6, 3.8, -1.4, k * 2.0, 4.4, 1.4, SILVER_H, { bv: 0.15 }));
    add(bk(arm, k * -2.7, 2.6, -3.15, k * 3.9, 3.0, 3.15, GOLD, { bv: 0.08 }));
    add(bk(arm, k * 3.6, -0.4, -3.15, k * 4.0, 3.0, 3.15, GOLD_D, { bv: 0.08 }));
    add(bk(arm, k * 0.6, -2.0, -2.7, k * 4.2, -0.2, 2.7, SILVER_L, { bv: 0.3 }));
    add(bk(arm, k * 0.9, -2.15, -2.75, k * 4.3, -1.7, 2.75, GOLD_D, { bv: 0.06 }));
    add(bk(arm, k * 1.2, -3.2, -2.4, k * 4.1, -1.9, 2.4, SILVER, { bv: 0.25 }));
    // upper arm plate (rerebrace)
    add(bk(arm, -2.0, -5.0, -2.0, 2.0, 0.0, 2.0, SILVER_D));
    add(bk(arm, k * 0.6, -4.6, -2.15, k * 2.15, -2.4, 2.15, SILVER, { bv: 0.15 }));
    // mail at the elbow, vambrace, gold cuff
    add(bk(fore, -2.0, -1.4, -2.0, 2.0, 1.0, 2.0, MAIL));
    for (const y of [-0.9, 0.1]) add(bk(fore, -2.05, y, -2.05, 2.05, y + 0.3, 2.05, MAIL_D, { bv: 0 }));
    add(bk(fore, -1.2, -0.4, -2.5, 1.2, 1.2, -1.8, SILVER_L, { bv: 0.2 })); // couter
    add(bk(fore, -2.1, -3.0, -2.1, 2.1, -1.2, 2.1, SILVER));
    add(bk(fore, k * 1.0, -2.8, -1.6, k * 2.4, -1.3, 1.6, SILVER_L, { bv: 0.15 }));
    add(bk(fore, -2.3, -3.2, -2.3, 2.3, -2.5, 2.3, GOLD, { bv: 0.1 }));
    // gauntlet
    add(bk(hand, -1.9, -2.1, -1.9, 1.9, 0.9, 1.9, SILVER_D));
    add(bk(hand, -1.6, -2.2, 1.2, 1.6, -0.6, 2.1, STEEL_D, { bv: 0.12 })); // fingers
    add(bk(hand, k * 0.8, -1.2, -1.6, k * 2.05, 0.6, 1.6, SILVER, { bv: 0.15 }));
    add(bk(hand, -1.4, -0.4, 1.7, 1.4, 0.6, 2.15, SILVER_L, { bv: 0.1 })); // knuckle plate
    // thigh: mail top, cuisse plate, gold knee stud
    add(bk(leg, -2.0, -6.0, -2.0, 2.0, 0.2, 2.0, SILVER_D));
    add(bk(leg, -2.1, -2.0, -2.1, 2.1, 0.3, 2.1, MAIL, { bv: 0.1 }));
    add(bk(leg, -2.15, -1.2, -2.15, 2.15, -0.9, 2.15, MAIL_D, { bv: 0 }));
    add(bk(leg, -1.8, -5.6, 1.6, 1.8, -2.0, 2.4, SILVER, { bv: 0.2 })); // cuisse
    add(bk(leg, k * 0.4, -5.4, -1.8, k * 2.3, -2.2, 1.8, SILVER_L, { bv: 0.15 }));
    add(bk(leg, -1.9, -2.3, 1.8, 1.9, -1.9, 2.5, GOLD_D, { bv: 0 }));
    // shin: poleyn with gold stud, greave, gold rim
    add(bk(shin, -2.0, -5.0, -2.0, 2.0, 1.0, 2.0, SILVER));
    add(bk(shin, -1.9, -1.0, 1.7, 1.9, 1.6, 2.7, SILVER_L, { bv: 0.3 }));
    add(bk(shin, -0.8, -0.2, 2.6, 0.8, 1.0, 3.0, GOLD, { bv: 0.12 }));
    add(bk(shin, -0.4, 0.2, 2.9, 0.4, 0.7, 3.1, GOLD_L, { bv: 0, g: true }));
    add(bk(shin, -1.6, -4.4, 1.8, 1.6, -1.2, 2.4, SILVER_L, { bv: 0.2 }));
    add(bk(shin, -0.3, -4.2, 2.3, 0.3, -1.4, 2.55, SILVER_H, { bv: 0 }));
    add(bk(shin, -2.2, -5.0, -2.2, 2.2, -4.4, 2.2, GOLD_D, { bv: 0.08 }));
    // sabaton
    add(bk(foot, -2.2, -1.0, -2.4, 2.2, 0.6, 3.2, STEEL_D));
    add(bk(foot, -2.0, -0.6, 1.4, 2.0, 0.5, 3.6, SILVER_D, { bv: 0.2 }));
    add(bk(foot, -1.6, -0.3, 3.0, 1.6, 0.3, 3.9, SILVER, { bv: 0.15 }));
    add(bk(foot, -2.3, -1.0, -2.5, 2.3, -0.6, 3.5, 0x2e3440, { bv: 0.08 }));
  }

  // ---------------------------------------------------------------- blue cape: gold hem, white lining, gold sun on the back
  const CAPE_W = 9;
  for (let i = 0; i < CAPE_W; i++) {
    const x = -CAPE_W / 2 + i;
    const c = i % 3 === 1 ? BLUE_D : i % 2 ? BLUE : BLUE_L;
    add(bk('capeA', x, -8.2, -0.5, x + 1, 0.4, 0.2, c, { bv: 0.08 }));
    add(bk('capeB', x, -8.0, -0.5, x + 1, 0.2, 0.2, c, { bv: 0.08 }));
  }
  add(bk('capeA', -4.4, -8.0, 0.1, 4.4, 0.2, 0.35, WHITE_D, { bv: 0 }));
  add(bk('capeB', -4.4, -7.4, 0.1, 4.4, 0.0, 0.35, WHITE_D, { bv: 0 }));
  add(bk('capeB', -4.6, -8.4, -0.7, 4.6, -7.4, 0.4, GOLD, { bv: 0.12 }));
  add(bk('capeB', -4.6, -7.6, -0.75, 4.6, -7.2, -0.45, GOLD_D, { bv: 0 }));
  for (const k of [-1, 1]) add(bk('capeB', k * 4.2, -7.4, -0.65, k * 4.65, 0.0, 0.25, GOLD_D, { bv: 0 }));
  add(bk('capeA', -4.8, -0.6, -0.7, 4.8, 0.8, 0.6, BLUE_D, { bv: 0.15 })); // collar fold
  sun(P, 'capeA', 0, -4.2, -0.5, -0.8, 1.1);

  // ---------------------------------------------------------------- longsword: blade along +z, edges along y
  add(
    ...pixelItem(
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
      { o: STEEL_D, w: 0xf8fbff, s: SILVER_L, m: SILVER, y: 0xfff4b0, g: GOLD, G: GOLD_D, r: 0x4ad0ff, b: LEATHER, B: shade(LEATHER, 0.7) },
      { b: 'gripR', at: GRIP, pivot: [3, 16], px: 0.85, th: 0.7, u: '+y', v: '+z', glow: 'yr', thick: { g: 1.5, G: 1.5, r: 1.8 } },
    ),
  );

  // ---------------------------------------------------------------- tower shield: face toward -y of the hand, top toward +z
  add(
    ...pixelItem(
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
      { G: GOLD_D, g: GOLD, b: BLUE, B: BLUE_D, y: 0xffd860, W: 0xfff8d8 },
      { b: 'gripL', at: [GRIP[0], GRIP[1] - 1.9, GRIP[2]], pivot: [5.5, 8], px: 0.78, th: 0.7, u: '+x', v: '+z', glow: 'W', thick: { G: 1.5 } },
    ),
  );

  return {
    id: 'paladin',
    scale: MC_SCALE,
    posScale: MC_POS_SCALE,
    props: pr,
    parts: P,
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
