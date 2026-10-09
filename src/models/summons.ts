import type { VoxelModel } from '../data/types';
import { Mob, quadMob, treant } from './builders';
import type { BoxPaint } from '../render/creatureSkins';

/**
 * Pixel-skinned summoned creatures: the Summoner's spirits (wolf, golem, wisp, ancient,
 * serpent, drake) and the Ranger's hawk. Same format as the enemy models (pixel units, one
 * texel per unit, boxes: x, y, z = centre x/z and BOTTOM y, w, h, d, colour, tag; +z is the
 * front). Tags drive the GPU walk cycle: legs/arms swing, wings flap, tails sway, jaws open.
 * Spirits share a teal glow so they read as the hero's allies.
 */

// ---------------------------------------------------------------- Spirit Wolf (summoner)
function wolf(): VoxelModel {
  const m = new Mob();
  const r = quadMob(m, {
    body: [6, 6, 10], legH: 8, head: [6, 6, 5], snout: [3, 3, 3], snoutColor: 0xf2fbf8, fur: 0xcfe8e2, belly: 0xf2fbf8, legColor: 0x8fbab4,
    face: { style: 'beast', eye: 0x9afff0 }, ears: [2, 2, 1], tail: [2, 2, 6], mane: [8, 7, 6], maneColor: 0xf2fbf8,
    bodyPaint: { side: 'stripe', accent: 0x5af0d8 }, tailPaint: { bands: [] },
  });
  m.box(0, r.bodyTop, 1, 2, 2, 8, 0x5af0d8, 'body', { mat: 'glow' });
  m.box(0, r.bodyTop - 2.5, -11, 2, 2, 2, 0x5af0d8, 'tail', { mat: 'glow' });
  return m.build(0.064, { gait: { leg: 0.8, roll: 0.03, bob: 0.06 } });
}

// ---------------------------------------------------------------- Stone Golem (summoner)
function golem(): VoxelModel {
  const m = new Mob();
  const stone = 0x8a8478;
  const st: BoxPaint = { mat: 'stone', accent: 0x5af0c8 };
  m.pair(3.5, 0, 0, 5, 9, 5, 0x5e5a52, 'legR', st);
  m.box(0, 9, 0, 16, 12, 8, stone, 'body', { ...st, front: 'core' });
  m.box(0, 20, -0.5, 17, 2, 9, 0x5a9a48, 'body', { mat: 'leaf' });
  m.box(0, 20, 1.5, 7, 7, 7, 0xaaa494, 'head', { ...st, face: { style: 'golem', eye: 0x5af0c8 } });
  m.box(0, 27, 1.5, 2, 3, 2, 0x8affe0, 'head', { mat: 'crystal', glow: 0.8 });
  m.pair(10.5, 2, 0, 5, 19, 6, stone, 'armL', { ...st, front: 'rune', bands: [[6, 0x5e5a52]] });
  m.pair(10.5, 21, 0, 6, 3, 7, 0x5a9a48, 'armL', { mat: 'leaf' });
  return m.build(0.08, { gait: { leg: 0.4, arm: 0.35, roll: 0.07, bob: 0.04 } });
}

// ---------------------------------------------------------------- Wisp (summoner)
function wisp(): VoxelModel {
  const m = new Mob();
  m.box(0, 3, 0, 3, 2, 3, 0x3ad8c0, 'body', { mat: 'glow' });
  m.box(0, 5, 0, 6, 6, 6, 0x6affe0, 'body', { mat: 'glow', face: { style: 'slime', eye: 0x1a4a44, glow: false } });
  m.box(0, 11, -1, 3, 3, 3, 0x3ad8c0, 'body', { mat: 'glow' });
  m.box(0.5, 14, -1.5, 1, 2, 1, 0xd8fff6, 'body', { mat: 'glow' });
  m.pair(4.5, 7, -0.5, 3, 1, 2, 0x3ad8c0, 'wingL', { mat: 'glow' });
  return m.build(0.062, { gait: { leg: 0, wing: 0.7, bob: 0.08, hop: 0.06 } });
}

// ---------------------------------------------------------------- Hawk (ranger identity)
function hawk(): VoxelModel {
  const m = new Mob();
  const brown = 0x7a4e2c;
  m.box(0, 6, 0, 4, 4, 7, brown, 'body', { mat: 'fur', bands: [[1.5, 0xead8b4]] });
  m.box(0, 7, 4.5, 4, 4, 3, brown, 'head', { mat: 'fur', face: { style: 'beast', eye: 0xffd040 }, bands: [[1.5, 0xead8b4]] });
  m.box(0, 7.5, 7, 2, 2, 2, 0xe8b040, 'head', { mat: 'plain' });
  m.pair(5, 9, 0, 6, 1, 5, brown, 'wingL', { mat: 'fur', front: 'claws', accent: 0xead8b4 });
  m.pair(10.5, 9, -0.5, 5, 1, 4, 0x4e3018, 'wingL', { mat: 'fur' });
  m.box(0, 8, -5.5, 5, 1, 4, 0x4e3018, 'tail', { mat: 'fur', top: 'bands', accent: 0xead8b4 });
  m.pair(1, 4.5, 1, 1, 1.5, 1, 0xe8b040, 'body', { mat: 'plain' });
  return m.build(0.07, { gait: { wing: 0.9, bob: 0.1, tail: 0.2 } });
}

// ---------------------------------------------------------------- Sky Serpent (summoner)
function serpent(): VoxelModel {
  const m = new Mob();
  const blue = 0x3a7ad8;
  const sc: BoxPaint = { mat: 'scale', bands: [[1, 0xe8f0ff]] };
  const n = 8;
  for (let i = 0; i < n; i++) {
    const s = 6 - Math.round(i * 0.45);
    const z = -i * 5;
    const x = Math.round(Math.sin(i * 0.9) * 3);
    const y = 6 + Math.round(Math.sin(i * 0.9 + 1.2) * 2);
    const tag = i >= n - 3 ? 'tail' : 'body';
    m.box(x, y, z, s, s, 5, blue, tag, sc);
    if (i % 2 === 0) m.box(x, y + s, z, 1, 2, 2, 0x9ad8ff, tag, { mat: 'crystal', glow: 0.5 });
  }
  m.pair(4.5, 8, 0, 3, 1, 3, 0x9ad8ff, 'wingL', { mat: 'crystal', glow: 0.4 });
  m.box(0, 7, 6, 7, 5, 7, blue, 'head', { mat: 'scale', face: { style: 'golem', eye: 0x7ae0ff } });
  m.box(0, 8, 11, 5, 3, 4, 0x6aa8f0, 'head', { mat: 'scale' });
  m.pair(2, 12, 4, 1, 4, 1, 0xe8c050, 'head', { mat: 'gold' });
  m.box(0, 5, 10, 5, 2, 6, 0xe8f0ff, 'jaw', { mat: 'plain', front: 'claws' });
  return m.build(0.075, { gait: { leg: 0, wing: 0.5, tail: 0.5, bob: 0.08, roll: 0.05, jaw: 0.3 } });
}

// ---------------------------------------------------------------- Flame Drake (summoner ultimate)
function drake(): VoxelModel {
  const m = new Mob();
  const red = 0xb8322a;
  const redD = 0x7a1e1c;
  const sc: BoxPaint = { mat: 'scale', bands: [[1.5, 0xf0b050]] };
  m.pair(3.5, 0, 4, 3, 6, 3, redD, 'legL', { mat: 'scale', front: 'claws', accent: 0x3a2a24 });
  m.pair(3.5, 0, -4, 4, 7, 4, redD, 'legR', { mat: 'scale', front: 'claws', accent: 0x3a2a24 });
  m.box(0, 5, 0, 8, 7, 13, red, 'body', { ...sc, side: 'bands', accent: 0xffa030 });
  for (const z of [-4, -1, 2, 5]) m.box(0, 12, z, 1, 2, 1, 0x3a2a24, 'body', { mat: 'bone' });
  m.box(0, 9, 8, 4, 6, 4, red, 'body', sc);
  m.box(0, 13, 11, 6, 5, 6, red, 'head', { mat: 'scale', face: { style: 'golem', eye: 0xffe070 } });
  m.box(0, 13, 15.5, 4, 3, 3, 0xd8503a, 'head', { mat: 'scale', face: { style: 'snout', alt: 0xffa030 } });
  m.pair(2, 18, 9, 1, 3, 1, 0x3a2a24, 'head', { mat: 'bone' });
  m.box(0, 11, 14, 4, 2, 5, 0xf0b050, 'jaw', { mat: 'plain', front: 'claws' });
  m.box(0, 7, -9, 4, 4, 5, red, 'tail', sc);
  m.box(0, 7.5, -13.5, 3, 3, 4, redD, 'tail', { mat: 'scale' });
  m.box(0, 8, -16.5, 2, 3, 2, 0xffa030, 'tail', { mat: 'glow' });
  m.pair(9, 13, -1, 14, 1, 9, 0xe85a30, 'wingL', { mat: 'leather', front: 'claws', top: 'bands', accent: 0x7a1e1c });
  return m.build(0.11, { gait: { leg: 0.6, wing: 0.65, tail: 0.4, bob: 0.06, jaw: 0.4 } });
}

/** Summoned creature models keyed by summon id (the clone is drawn from the hero rig instead). */
export const SUMMON_MODELS: Record<string, VoxelModel> = {
  wolf: wolf(),
  golem: golem(),
  wisp: wisp(),
  ancient: treant({ bark: 0x6a4a30, barkDark: 0x4a321e, leaf: 0x4aa04a, leafLight: 0x7ac85a, glow: 0x8affc8, flower: 0xf0a0d0, scale: 0.086 }),
  hawk: hawk(),
  serpent: serpent(),
  drake: drake(),
};
