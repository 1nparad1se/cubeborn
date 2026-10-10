import type { VoxelModel } from '../data/types';
import { Mob, shadeHex } from './builders';
import type { BoxPaint } from '../render/creatureSkins';

/**
 * Boss models: huge original voxel creatures, one per map theme (blight forest, haunted city,
 * catacombs, volcano, tundra, aether ruins). Authored in pixel units (one texel per unit) with
 * pixel-skinned materials; the renderer scales each model to its boss's standing height
 * (BossDef.height, about 4–5 hero heights). Tagged parts animate: legs walk, arms wind up and
 * strike, heads roar, jaws open, wings beat, tails lash (render/BossModel.ts).
 */

const glow = (c: number): BoxPaint => ({ mat: 'glow', accent: c });

// ================================================================ Blightwood
/** A towering mushroom matriarch: root feet, a pale stalk with a gaping maw, a spotted violet cap. */
function sporeMother(): VoxelModel {
  const m = new Mob();
  const stalk = 0xe8dcc0;
  const root = 0x8a7458;
  const cap = 0xb04ac8;
  const lime = 0xb8ff4a;
  // root feet (diagonal pairs trot)
  m.box(6, 0, 5, 7, 6, 7, root, 'legL', { mat: 'bark', bands: [[2, 0x6a5440, 'bark']] });
  m.box(-6, 0, -5, 7, 6, 7, root, 'legL', { mat: 'bark', bands: [[2, 0x6a5440, 'bark']] });
  m.box(-6, 0, 5, 7, 6, 7, root, 'legR', { mat: 'bark', bands: [[2, 0x6a5440, 'bark']] });
  m.box(6, 0, -5, 7, 6, 7, root, 'legR', { mat: 'bark', bands: [[2, 0x6a5440, 'bark']] });
  for (const [x, z] of [[10, 8], [-10, 8], [10, -8], [-10, -8]] as const) m.box(x, 0, z, 3, 2, 3, 0x5a4430, undefined, { mat: 'bark' });
  // stalk: a skirt of rot, the trunk with the maw, a gill collar
  m.box(0, 5, 0, 20, 5, 18, 0xc8b898, undefined, { mat: 'mush', side: 'spots', accent: 0x9a7aa0 });
  m.box(0, 10, 0, 17, 14, 15, stalk, undefined, { mat: 'mush', front: 'mouth', accent: 0x2a1020, face: { style: 'golem', eye: lime, dy: -3 } });
  m.box(0, 9, 7.5, 11, 4, 2, 0x3a1424, 'jaw', { mat: 'skin', front: 'claws', accent: 0xf0e8d0 });
  m.box(0, 24, 0, 22, 3, 20, 0xe0b8d8, 'head', { mat: 'mush', side: 'bands', accent: 0xc890c0 });
  // the cap: three layers, spots, a glowing crown
  m.box(0, 27, 0, 38, 8, 36, cap, 'head', { mat: 'mush', side: 'spots', top: 'spots', accent: 0xf6e8ff });
  m.box(0, 35, 0, 30, 6, 28, 0xc058dc, 'head', { mat: 'mush', side: 'spots', top: 'spots', accent: 0xf6e8ff });
  m.box(0, 41, 0, 19, 5, 18, 0xcc66e6, 'head', { mat: 'mush', top: 'spots', accent: 0xf6e8ff });
  m.box(0, 46, 0, 9, 3, 9, 0xd878ee, 'head', { mat: 'mush' });
  for (const [x, y, z, s] of [[-14, 29, 12, 3], [13, 30, -13, 3], [-10, 37, -11, 3], [12, 36, 9, 3], [0, 42, 7, 3], [-17, 28, -4, 2], [17, 28, 4, 2], [5, 47, -2, 2]] as const)
    m.box(x, y, z, s, s, s, lime, 'head', glow(lime));
  // gill fringe hanging under the cap
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    m.box(Math.cos(a) * 15, 24.5, Math.sin(a) * 14, 3, 3, 3, 0xd8a0d0, 'head', { mat: 'mush' });
  }
  // tendril arms with spore-pod fists
  m.pair(12, 12, 1, 5, 12, 5, 0xd8c8a8, 'armL', { mat: 'mush', bands: [[3, 0xb8a888, 'mush']] });
  m.pair(12, 4, 1, 8, 8, 8, 0x9a3ab0, 'armL', { mat: 'mush', side: 'spots', accent: lime, glow: 0.15 });
  m.pair(12, 8, 5.5, 3, 3, 1, lime, 'armL', glow(lime));
  // little mushrooms growing from the shoulders
  m.pair(8, 24, 8, 2, 3, 2, stalk, 'head', { mat: 'mush' });
  m.pair(8, 27, 8, 5, 2, 5, 0x9a4ab0, 'head', { mat: 'mush' });
  return m.build(0.1, { gait: { leg: 0.3, roll: 0.05 } });
}

/** The thicket elder: root legs, a hollow trunk with a rotting heart, branch arms and a dead crown. */
function rotroot(): VoxelModel {
  const m = new Mob();
  const bark = 0x5a3e22;
  const dark = 0x3e2a16;
  const moss = 0x4a6a24;
  const rot = 0xb8ff3a;
  const bp: BoxPaint = { mat: 'bark' };
  m.pair(6, 0, 0, 9, 15, 9, dark, 'legR', { mat: 'bark', bands: [[3, 0x2e1e10, 'bark'], [2, moss, 'leaf']] });
  m.pair(9, 0, 6, 4, 3, 6, dark, 'legR', bp);
  m.pair(3, 0, 6, 3, 2, 5, dark, 'legR', bp);
  m.box(0, 14, 0, 18, 4, 13, dark, undefined, bp);
  m.box(0, 17, 0, 26, 22, 15, bark, undefined, { mat: 'bark', front: 'core', accent: rot });
  m.box(0, 26, 7.6, 6, 6, 1, rot, undefined, glow(rot));
  m.box(0, 38, 0, 28, 3, 16, moss, undefined, { mat: 'leaf' });
  m.box(-9, 20, 7.8, 3, 9, 1, 0x2a1a0a, undefined, { mat: 'bark' });
  m.box(9, 30, 7.8, 2, 6, 1, 0x2a1a0a, undefined, { mat: 'bark' });
  // shoulders of bark knots
  m.pair(15, 33, 0, 9, 8, 13, 0x4e341c, 'armL', { mat: 'bark', top: 'spots', accent: moss });
  // branch arms ending in twig claws
  m.pair(16, 8, 0, 7, 26, 8, bark, 'armL', { mat: 'bark', bands: [[7, dark, 'bark'], [3, moss, 'leaf']] });
  m.pair(18, 2, 3, 2, 7, 2, dark, 'armL', bp);
  m.pair(15, 2, 4, 2, 7, 2, dark, 'armL', bp);
  m.pair(17, 3, -2, 2, 6, 2, dark, 'armL', bp);
  // head: a craggy face in the trunk top
  m.box(0, 41, 1, 15, 13, 13, shadeHex(bark, 1.15), 'head', { mat: 'bark', face: { style: 'treant', eye: rot } });
  m.pair(3.5, 47, 7.6, 3, 2, 1, rot, 'head', glow(rot));
  m.box(0, 41, 7.4, 8, 3, 2, 0x1a0e04, 'jaw', { mat: 'bark', front: 'claws', accent: 0xd8c890 });
  // a sickly, half-dead crown with bare branches and fungus
  m.box(0, 53, -1, 32, 9, 24, 0x5a7a2a, 'head', { mat: 'leaf' });
  m.box(0, 62, -1, 20, 6, 16, 0x6a8a30, 'head', { mat: 'leaf' });
  for (const [x, z, h] of [[-13, 4, 10], [12, -6, 12], [3, -9, 9], [-6, 8, 7]] as const) m.box(x, 62, z, 2, h, 2, dark, 'head', bp);
  m.box(-13, 71, 4, 6, 2, 2, dark, 'head', bp);
  m.box(12, 73, -6, 2, 2, 7, dark, 'head', bp);
  for (const [x, y, z] of [[-15, 55, 12], [14, 57, 10], [0, 66, 7], [-9, 64, -8]] as const) m.box(x, y, z, 3, 3, 3, rot, 'head', glow(rot));
  m.box(10, 52, 12.5, 4, 2, 4, 0xa04ab8, 'head', { mat: 'mush' });
  return m.build(0.1, { gait: { leg: 0.32, arm: 0.28 } });
}

// ================================================================ Gloamhaven
/** The rat king: a hulking crowned rat in a tattered royal cape with a whip-like tail. */
function ratTyrant(): VoxelModel {
  const m = new Mob();
  const fur = 0x5e5048;
  const furD = 0x4a3e38;
  const pink = 0xd89a9a;
  const fp: BoxPaint = { mat: 'fur' };
  // legs: big haunches behind, clawed forelegs in front
  m.box(9, 0, 11, 7, 11, 7, furD, 'legL', { mat: 'fur', bands: [[2, pink, 'skin']] });
  m.box(-9, 0, -10, 9, 12, 10, furD, 'legL', { mat: 'fur', bands: [[2, pink, 'skin']] });
  m.box(-9, 0, 11, 7, 11, 7, furD, 'legR', { mat: 'fur', bands: [[2, pink, 'skin']] });
  m.box(9, 0, -10, 9, 12, 10, furD, 'legR', { mat: 'fur', bands: [[2, pink, 'skin']] });
  m.pair(9, 0, 15, 2, 1, 2, 0xe8e0d0, undefined, { mat: 'bone' });
  // body hunched up at the shoulders
  m.box(0, 10, -3, 22, 15, 26, fur, undefined, { mat: 'fur', side: 'spots', accent: 0x4a3a30 });
  m.box(0, 13, 9, 24, 17, 12, 0x6a5a50, undefined, fp);
  m.box(0, 24, -6, 18, 3, 18, 0x4a3a32, undefined, { mat: 'fur' });
  // a spine of rusty spikes
  for (const z of [-12, -6, 0, 6]) m.box(0, z > 0 ? 30 : 25 + (z + 12) / 3, z, 2, 4, 2, 0x8a5a3a, undefined, { mat: 'metal' });
  // the royal cape
  m.box(0, 22, 4, 26, 9, 18, 0x8a1a2a, undefined, { mat: 'cloth', side: 'rag', back: 'rag', front: 'trim', top: 'trim', accent: 0xe8c050 });
  m.box(0, 13, -14, 20, 10, 2, 0x7a1424, undefined, { mat: 'cloth', back: 'rag', accent: 0xe8c050 });
  // head with snout, buck teeth, ears and a crooked crown
  m.box(0, 20, 18, 14, 12, 11, 0x6e6058, 'head', { mat: 'fur', face: { style: 'beast', eye: 0xff2a2a } });
  m.box(0, 20, 25.5, 8, 7, 5, 0x8a6a62, 'head', { mat: 'skin', face: { style: 'snout' } });
  m.box(0, 26.5, 28, 3, 2, 1, 0x2a1414, 'head', { mat: 'skin' });
  m.pair(1.2, 17, 27, 2, 4, 1, 0xf2e8c8, 'head', { mat: 'bone' });
  m.box(0, 17, 25, 7, 3, 5, 0x7a5a52, 'jaw', { mat: 'skin' });
  m.pair(5.5, 32, 15, 5, 6, 2, pink, 'head', { mat: 'skin' });
  m.pair(5.5, 33, 15.6, 3, 4, 1, 0xb87a7a, 'head', { mat: 'skin' });
  m.box(0, 32, 19, 10, 4, 8, 0xe8c050, 'head', { mat: 'gold', front: 'gem', accent: 0xff3a5a });
  for (const [x, z] of [[-4, 15.5], [4, 15.5], [-4, 22.5], [4, 22.5], [0, 22.5]] as const) m.box(x, 36, z, 1.6, 3, 1.6, 0xe8c050, 'head', { mat: 'gold' });
  // a scar
  m.box(-4, 26, 23.6, 1, 5, 1, 0x3a2a24, 'head', { mat: 'skin' });
  // tail: three segments sweeping behind
  m.box(0, 12, -19, 4, 4, 8, pink, 'tail', { mat: 'skin', bands: [[1, 0xb87a7a, 'skin']] });
  m.box(0, 10, -26, 3, 3, 8, pink, 'tail', { mat: 'skin' });
  m.box(0, 9, -33, 2, 2, 8, 0xc88a8a, 'tail', { mat: 'skin' });
  m.box(0, 8.5, -38, 4, 3, 3, 0x6a6a72, 'tail', { mat: 'metal' });
  return m.build(0.1, { gait: { leg: 0.5, roll: 0.05 } });
}

/** A stone gargoyle warden: bat wings, horned hood, and a huge cracked bronze bell in one claw. */
function bellwarden(): VoxelModel {
  const m = new Mob();
  const st = 0x6a6f86;
  const stD = 0x4a4f66;
  const bronze = 0xc8903a;
  const ember = 0xffa040;
  m.pair(5, 0, 1, 7, 13, 7, stD, 'legR', { mat: 'stone', bands: [[3, 0x3a3e50, 'stone']] });
  m.pair(5, 0, 5, 7, 2, 4, 0x3a3e50, 'legR', { mat: 'stone', front: 'claws', accent: 0x2a2e3a });
  m.box(0, 12, 0, 20, 9, 13, stD, undefined, { mat: 'stone', side: 'rune', accent: ember });
  m.box(0, 21, 0, 24, 14, 14, st, undefined, { mat: 'stone', front: 'plate', accent: stD });
  m.box(0, 26, 7.4, 6, 6, 1, ember, undefined, glow(ember));
  // chains across the chest
  m.box(0, 30, 7.3, 22, 2, 1, 0x3a3a40, undefined, { mat: 'metal', front: 'bands', accent: 0x6a6a70 });
  // head: hooded, horned, ember eyes
  m.box(0, 35, 2, 14, 12, 12, 0x7a7f96, 'head', { mat: 'stone', face: { style: 'golem', eye: ember } });
  m.pair(3.5, 40, 8.2, 3, 2, 1, ember, 'head', glow(ember));
  m.box(0, 35, 8, 8, 3, 2, 0x2a2e3a, 'jaw', { mat: 'stone', front: 'claws', accent: 0xd8d0c0 });
  m.box(0, 44, 0, 16, 5, 14, 0x3e4256, 'head', { mat: 'cloth', side: 'rag', back: 'rag' });
  m.pair(8, 46, -1, 3, 3, 3, 0x2e3244, 'head', { mat: 'stone' });
  m.pair(10, 49, -2, 2, 6, 2, 0x2e3244, 'head', { mat: 'stone' });
  // great stone wings
  m.pair(23, 24, -6, 26, 3, 16, stD, 'wingL', { mat: 'stone', side: 'claws', front: 'claws', accent: 0x3a3e50 });
  m.pair(30, 18, -6, 10, 6, 3, 0x3a3e50, 'wingL', { mat: 'stone' });
  m.pair(14, 34, -6, 6, 6, 6, st, 'wingL', { mat: 'stone' });
  // claw arm (left) and the bell arm (right)
  m.box(14.5, 14, 1, 6, 20, 6, st, 'armL', { mat: 'stone', bands: [[4, stD, 'stone']] });
  m.box(14.5, 8, 3, 7, 6, 7, stD, 'armL', { mat: 'stone', front: 'claws', accent: 0x2a2e3a });
  m.box(-14.5, 14, 1, 6, 20, 6, st, 'armR', { mat: 'stone', bands: [[4, stD, 'stone']] });
  m.box(-14.5, 10, 4, 4, 6, 4, 0x3a3a40, 'armR', { mat: 'metal', side: 'bands', accent: 0x6a6a70 });
  m.box(-14.5, -6, 6, 16, 16, 14, bronze, 'armR', { mat: 'gold', side: 'bands', front: 'rune', accent: ember });
  m.box(-14.5, -8, 6, 18, 3, 16, 0xa8702a, 'armR', { mat: 'gold' });
  m.box(-14.5, 0, 13.2, 3, 7, 1, 0x3a2410, 'armR', { mat: 'metal' });
  return m.build(0.1, { gait: { leg: 0.25, wing: 0.5 } });
}

// ================================================================ Ossuary Depths
/** A colossus of a thousand bones: horned skull, open rib cage with a soul flame, a femur club. */
function boneColossus(): VoxelModel {
  const m = new Mob();
  const bone = 0xe6dcc0;
  const boneD = 0xc6bca0;
  const soul = 0x6affc8;
  const bp: BoxPaint = { mat: 'bone' };
  m.pair(5, 0, 0, 6, 20, 6, bone, 'legR', { mat: 'bone', bands: [[3, boneD, 'bone'], [1, 0xa89c80, 'bone']] });
  m.pair(5, 0, 3, 8, 3, 9, boneD, 'legR', bp);
  m.pair(5, 9, 3.5, 4, 4, 1, 0xd8ccb0, 'legR', bp);
  m.box(0, 19, 0, 16, 6, 9, boneD, undefined, { mat: 'bone', front: 'ribs', accent: 0x8a7a60 });
  m.box(0, 25, 0, 4, 6, 4, bone, undefined, bp);
  // rib cage: hollow look with the soul flame inside
  m.box(0, 30, 0, 22, 16, 12, bone, undefined, { mat: 'bone', front: 'ribs', back: 'ribs', side: 'ribs', accent: 0x2a2620 });
  m.box(0, 34, 3, 7, 7, 7, soul, undefined, glow(soul));
  m.box(0, 46, -1, 26, 3, 12, boneD, undefined, bp);
  // back spikes
  for (const [x, h] of [[-6, 8], [0, 11], [6, 8]] as const) m.box(x, 44, -7, 3, h, 3, 0xd8ceb4, undefined, bp);
  // shoulders: skull pauldrons
  const sp: BoxPaint = { mat: 'bone', face: { style: 'skull', eye: soul } };
  m.pair(16, 41, 0, 10, 9, 10, 0xd6ccb0, 'armL', sp);
  // left arm: raking claw
  m.box(16, 19, 0, 5, 22, 5, bone, 'armL', { mat: 'bone', bands: [[4, boneD, 'bone']] });
  m.box(16, 13, 1, 7, 6, 7, boneD, 'armL', { mat: 'bone', front: 'claws', accent: 0x8a7a60 });
  // right arm: a giant femur club
  m.box(-16, 19, 0, 5, 22, 5, bone, 'armR', { mat: 'bone', bands: [[4, boneD, 'bone']] });
  m.box(-16, -3, 2, 6, 22, 6, 0xd8ceb4, 'armR', { mat: 'bone', bands: [[3, boneD, 'bone']] });
  m.box(-16, -8, 2, 10, 7, 10, 0xe8dec4, 'armR', { mat: 'bone', side: 'spots', accent: 0xb8ac90 });
  // skull head with horns
  m.box(0, 49, 1, 14, 13, 13, bone, 'head', { mat: 'bone', face: { style: 'skull', eye: soul } });
  m.pair(3.5, 55, 7.6, 3, 3, 1, soul, 'head', glow(soul));
  m.box(0, 47, 4, 12, 4, 9, boneD, 'jaw', { mat: 'bone', front: 'claws', accent: 0xf8f0e0 });
  m.pair(8, 58, 0, 4, 4, 4, 0xd8ceb4, 'head', bp);
  m.pair(10, 62, -1, 3, 6, 3, 0xc8bea4, 'head', bp);
  m.pair(10.5, 67, -2, 2, 4, 2, 0xb8ae94, 'head', bp);
  return m.build(0.1, { gait: { leg: 0.3, arm: 0.3 } });
}

/** The crypt master: a floating lich in layered robes, bone crown and a staff of soul fire. */
function lich(): VoxelModel {
  const m = new Mob();
  const robe = 0x1a3a2a;
  const robeL = 0x24503a;
  const soul = 0x5affc8;
  const gold = 0xc8a050;
  // tattered robe tapering into mist (no legs: it floats)
  m.box(0, 0, 0, 8, 4, 7, 0x12281e, undefined, { mat: 'ghost', side: 'rag', accent: soul });
  m.box(0, 4, 0, 14, 8, 11, robe, undefined, { mat: 'cloth', side: 'rag', back: 'rag', front: 'trim', accent: gold });
  m.box(0, 12, 0, 18, 12, 13, robe, undefined, { mat: 'cloth', side: 'rag', back: 'rag', front: 'cross', accent: soul });
  m.box(0, 24, 0, 18, 14, 11, robeL, undefined, { mat: 'cloth', front: 'ribs', accent: 0xd8d0b8 });
  m.box(0, 29, 5.7, 4, 4, 1, soul, undefined, glow(soul));
  // high collar and bone pauldrons
  m.box(0, 37, -1, 22, 4, 12, 0x0e2016, undefined, { mat: 'cloth', side: 'trim', accent: gold });
  m.pair(11, 35, 0, 8, 6, 9, 0xd8d0b8, 'armL', { mat: 'bone', side: 'ribs', accent: 0x8a8270 });
  // arms: left raised hand of green fire, right holds the staff
  m.box(11, 21, 1, 5, 15, 5, robeL, 'armL', { mat: 'cloth', bands: [[4, 0xd8d0b8, 'bone']] });
  m.box(11, 17, 2, 5, 4, 5, soul, 'armL', { ...glow(soul), mat: 'crystal', glow: 0.9 });
  m.box(-11, 21, 1, 5, 15, 5, robeL, 'armR', { mat: 'cloth', bands: [[4, 0xd8d0b8, 'bone']] });
  m.box(-11, 2, 5, 3, 38, 3, 0x2a2420, 'armR', { mat: 'wood' });
  m.box(-11, 40, 5, 7, 3, 7, gold, 'armR', { mat: 'gold' });
  m.box(-11, 43, 5, 6, 6, 6, soul, 'armR', { ...glow(soul), mat: 'crystal', glow: 1 });
  m.pair(2.5, 43, 7.5, 1.5, 6, 1.5, gold, 'armR', { mat: 'gold' });
  // skull with a bone crown
  m.box(0, 39, 0, 12, 12, 12, 0xd8d0b8, 'head', { mat: 'bone', face: { style: 'skull', eye: soul }, hair: { color: robe, rows: 3, mat: 'cloth' } });
  m.pair(3, 44, 6.2, 2, 2, 1, soul, 'head', glow(soul));
  m.box(0, 51, 0, 14, 3, 14, gold, 'head', { mat: 'gold', front: 'gem', accent: soul });
  for (const x of [-5, 0, 5]) m.box(x, 54, 5, 2, x === 0 ? 6 : 4, 2, x === 0 ? soul : gold, 'head', x === 0 ? glow(soul) : { mat: 'gold' });
  m.box(0, 37, 3.5, 8, 3, 6, 0xb8b098, 'jaw', { mat: 'bone', front: 'claws', accent: 0xe8e0c8 });
  return m.build(0.1, { gait: { arm: 0.2 } });
}

// ================================================================ Emberwaste
/** The walking forge: a hulk of basalt plates over a molten core, fists like anvils. */
function cinderGolem(): VoxelModel {
  const m = new Mob();
  const rock = 0x3a2828;
  const rockD = 0x261a1a;
  const vein = 0xff5a1a;
  const mg: BoxPaint = { mat: 'magma', accent: vein };
  m.pair(7, 0, 0, 10, 15, 11, rockD, 'legR', { ...mg, bands: [[3, 0x1a1212, 'stone']] });
  m.pair(7, 0, 4, 11, 4, 6, 0x1e1414, 'legR', { mat: 'stone' });
  m.box(0, 14, 0, 22, 8, 14, rockD, undefined, mg);
  m.box(0, 22, 0, 30, 20, 17, rock, undefined, { ...mg, front: 'core', accent: 0xffd040 });
  m.box(0, 28, 8.6, 8, 8, 1, 0xffd040, undefined, glow(0xffd040));
  // shoulder boulders and smoking vents on the back
  m.box(0, 40, -3, 34, 8, 13, 0x302222, undefined, mg);
  for (const [x, z] of [[-8, -7], [7, -8], [0, -9]] as const) {
    m.box(x, 46, z, 5, 5, 5, 0x1e1418, undefined, { mat: 'stone' });
    m.box(x, 51, z, 3, 2, 3, 0xff7a1a, undefined, glow(0xff7a1a));
  }
  // small head sunk between the shoulders
  m.box(0, 40, 7, 12, 10, 10, 0x4a3434, 'head', { ...mg, face: { style: 'golem', eye: 0xffe04a } });
  m.pair(3, 45, 12.2, 3, 2, 1, 0xffe04a, 'head', glow(0xffe04a));
  m.box(0, 39, 11, 8, 3, 3, 0x2a1414, 'jaw', { mat: 'magma', accent: 0xffc040, front: 'claws' });
  m.box(0, 50, 5, 14, 3, 8, 0x2a1c1c, 'head', { mat: 'stone' });
  // huge arms ending in molten fists
  m.pair(19, 14, 0, 9, 26, 11, rock, 'armL', { ...mg, bands: [[5, rockD, 'stone']] });
  m.pair(19, 36, 0, 12, 8, 13, 0x302222, 'armL', mg);
  m.pair(19, 2, 1, 13, 13, 13, rockD, 'armL', { mat: 'magma', accent: 0xffa040, front: 'claws', side: 'bands' });
  m.pair(19, 6, 7.7, 6, 4, 1, 0xffa040, 'armL', glow(0xffa040));
  return m.build(0.1, { gait: { leg: 0.28, arm: 0.25 } });
}

/** A lava wyrm rearing out of the ground: coils of plated body, spined neck, a molten maw. */
function magmaw(): VoxelModel {
  const m = new Mob();
  const mg: BoxPaint = { mat: 'magma', accent: 0xffc040 };
  const sc: BoxPaint = { mat: 'scale', accent: 0x3a1a0a };
  const spine = 0x2a1a1a;
  // ground coils (the tail end whips)
  m.box(0, 0, -8, 18, 9, 14, 0x6a2a12, undefined, mg);
  m.box(10, 0, 4, 12, 8, 12, 0x5a2210, undefined, mg);
  m.box(-6, 0, -20, 12, 7, 12, 0x5a2210, 'tail', mg);
  m.box(-12, 0, -29, 9, 6, 9, 0x4a1a0a, 'tail', mg);
  m.box(-16, 0, -36, 6, 5, 6, 0x3a1408, 'tail', { mat: 'stone' });
  // the rising body
  m.box(0, 9, -3, 16, 12, 14, 0x7a3014, undefined, { ...mg, side: 'bands' });
  m.box(0, 21, 0, 14, 12, 13, 0x8a3618, undefined, { ...sc, front: 'belly', accent: 0xffa040 });
  m.box(0, 33, 3, 12, 10, 11, 0x8a3618, undefined, { ...sc, front: 'belly', accent: 0xffa040 });
  for (const [y, z] of [[17, -10], [27, -6], [37, -3], [8, -15]] as const) m.box(0, y, z, 3, 5, 3, spine, undefined, { mat: 'stone' });
  // small clawed forelimbs
  m.pair(9, 22, 4, 4, 9, 4, 0x6a2a12, 'armL', { ...sc, bands: [[2, spine, 'stone']] });
  // head with horns and the jaw
  m.box(0, 41, 7, 17, 13, 16, 0x9a3c1a, 'head', { ...mg, face: { style: 'golem', eye: 0xffff6a } });
  m.pair(4.5, 48, 15.2, 4, 2, 1, 0xffff6a, 'head', glow(0xffff6a));
  m.pair(7, 52, 2, 3, 4, 3, spine, 'head', { mat: 'stone' });
  m.pair(8, 55, -1, 2, 6, 2, spine, 'head', { mat: 'stone' });
  m.box(0, 54, 4, 3, 4, 8, spine, 'head', { mat: 'stone' });
  m.box(0, 36, 11, 15, 6, 14, 0xffa040, 'jaw', { mat: 'magma', accent: 0xffe04a, front: 'claws' });
  m.box(0, 41, 15.5, 13, 2, 1, 0xffe04a, 'head', glow(0xffe04a));
  return m.build(0.1, { gait: { tail: 0.5 } });
}

// ================================================================ Frostveil
/** The blizzard yeti: shaggy white giant, curled horns, icy face, ice crusted shoulders. */
function frostfang(): VoxelModel {
  const m = new Mob();
  const fur = 0xe6f4ff;
  const furS = 0xc8dcea;
  const skin = 0x7a9ab8;
  const ice = 0xa8e8ff;
  const fp: BoxPaint = { mat: 'fur' };
  m.pair(6, 0, 0, 10, 14, 10, furS, 'legR', { mat: 'fur', bands: [[3, skin, 'skin']] });
  m.pair(6, 0, 5, 9, 2, 4, 0x5a7a98, 'legR', { mat: 'skin', front: 'claws', accent: 0xe8f0f8 });
  m.box(0, 13, 0, 24, 10, 16, furS, undefined, fp);
  m.box(0, 22, 0, 30, 18, 18, fur, undefined, { mat: 'fur', front: 'belly', accent: 0xd0e0ee });
  m.box(0, 40, -2, 32, 6, 18, 0xf2faff, undefined, fp);
  // ice crust on the shoulders and back
  for (const [x, z, h] of [[-12, -6, 6], [-7, -8, 9], [8, -7, 7], [13, -4, 5], [0, -9, 8]] as const) m.box(x, 45, z, 3, h, 3, ice, undefined, { mat: 'ice' });
  // long arms reaching to the knees, with dark leathery hands
  m.pair(19, 12, 0, 9, 30, 10, fur, 'armL', { mat: 'fur', bands: [[6, skin, 'skin']] });
  m.pair(19, 8, 2, 10, 5, 11, 0x5a7a98, 'armL', { mat: 'skin', front: 'claws', accent: 0xe8f0f8 });
  m.pair(19, 38, 0, 11, 6, 12, 0xf2faff, 'armL', fp);
  // head: blue face plate, horns, fangs
  m.box(0, 44, 3, 15, 13, 13, fur, 'head', { mat: 'fur' });
  m.box(0, 45, 9.8, 11, 9, 1, skin, 'head', { mat: 'skin', face: { style: 'imp', eye: 0x2a6aff } });
  m.pair(2.8, 50, 10.4, 2, 2, 1, 0x6ad8ff, 'head', glow(0x6ad8ff));
  m.box(0, 43, 9, 10, 3, 4, 0x4a6a88, 'jaw', { mat: 'skin', front: 'claws', accent: 0xf8f8f0 });
  m.pair(8.5, 52, 2, 3, 4, 4, 0xe8e0c8, 'head', { mat: 'bone' });
  m.pair(10, 55, 0, 3, 3, 6, 0xd8d0b8, 'head', { mat: 'bone' });
  m.pair(10, 52, -3, 2, 4, 3, 0xc8c0a8, 'head', { mat: 'bone' });
  return m.build(0.1, { gait: { leg: 0.4, arm: 0.4 } });
}

/** The ice queen: a floating gown of glacier layers, crystal wings, a crown of icicles. */
function glacialMatriarch(): VoxelModel {
  const m = new Mob();
  const ice = 0x6ab0e0;
  const pale = 0xe0f4ff;
  const crys = 0xb0f0ff;
  // a gown of ice shelves tapering down (she floats)
  m.box(0, 0, 0, 8, 5, 8, 0x8ad0f0, undefined, { mat: 'crystal' });
  m.box(0, 5, 0, 16, 8, 14, ice, undefined, { mat: 'ice', side: 'rag', back: 'rag', accent: pale });
  m.box(0, 13, 0, 20, 10, 16, 0x7ac0e8, undefined, { mat: 'ice', front: 'trim', side: 'rag', accent: pale });
  m.box(0, 23, 0, 16, 14, 11, 0x8ad0f0, undefined, { mat: 'cloth', front: 'gem', accent: 0x8af0ff });
  m.box(0, 28, 5.7, 4, 4, 1, 0x8af0ff, undefined, glow(0x8af0ff));
  m.box(0, 36, -1, 22, 4, 13, pale, undefined, { mat: 'snow' });
  // crystal wings
  m.pair(16, 20, -6, 20, 20, 2, crys, 'wingL', { mat: 'crystal', front: 'bands', accent: 0xe8faff, glow: 0.35 });
  m.pair(24, 30, -6, 8, 10, 2, 0xd0f8ff, 'wingL', { mat: 'crystal', glow: 0.5 });
  // arms: staff of ice (right), a frozen orb (left)
  m.pair(11, 22, 0, 4, 15, 4, 0x8ad0f0, 'armL', { mat: 'cloth', bands: [[4, pale, 'skin']] });
  m.box(11, 17, 2, 6, 6, 6, 0xd0f8ff, 'armL', { mat: 'crystal', glow: 0.9 });
  m.box(-11, 2, 4, 2, 40, 2, 0x9ae0ff, 'armR', { mat: 'ice' });
  m.box(-11, 42, 4, 6, 6, 6, crys, 'armR', { mat: 'crystal', glow: 1 });
  m.box(-11, 48, 4, 2, 5, 2, 0xe8faff, 'armR', { mat: 'crystal', glow: 0.8 });
  // head: pale face, long frosted hair, a crown of icicles
  m.box(0, 40, 0, 11, 11, 11, pale, 'head', { mat: 'skin', face: { style: 'zombie', eye: 0x1a6aff, glow: true }, hair: { color: 0xc8f0ff, rows: 4, mat: 'ice' } });
  m.box(0, 32, -6, 12, 9, 2, 0xc8f0ff, 'head', { mat: 'ice' });
  for (const [x, h] of [[-5, 6], [-2.5, 9], [0, 12], [2.5, 9], [5, 6]] as const) m.box(x, 51, 1, 2, h, 2, crys, 'head', { mat: 'crystal', glow: 0.6 });
  return m.build(0.1, { gait: { wing: 0.4, arm: 0.2 } });
}

// ================================================================ Aetherfall Ruins
/** The last mechanism: a brass war-golem with a gear heart, a visor head, a cannon and a piston fist. */
function clockworkSentinel(): VoxelModel {
  const m = new Mob();
  const copper = 0xc87a4a;
  const brass = 0xc9a050;
  const steel = 0x8a8a8a;
  const core = 0xff3a3a;
  m.pair(7, 0, 0, 9, 16, 9, steel, 'legR', { mat: 'metal', bands: [[3, 0x5a5a5a, 'metal'], [2, brass, 'gold']] });
  m.pair(7, 0, 4, 11, 3, 8, 0x5a5a5a, 'legR', { mat: 'metal', front: 'plate', accent: 0x3a3a3a });
  m.pair(7, 14, 1, 7, 6, 7, brass, 'legR', { mat: 'gold', side: 'gear', accent: 0x8a6a2a });
  m.box(0, 16, 0, 20, 8, 14, 0x6a6a6a, undefined, { mat: 'metal', side: 'bands', accent: 0x4a4a4a });
  m.box(0, 24, 0, 28, 18, 18, copper, undefined, { mat: 'copper', side: 'gear', front: 'plate', accent: steel });
  m.box(0, 28, 9.2, 10, 10, 1, brass, undefined, { mat: 'gold', front: 'gear', accent: 0x8a6a2a });
  m.box(0, 31, 9.8, 4, 4, 1, core, undefined, glow(core));
  // exhaust stacks on the back
  m.pair(6, 38, -8, 4, 12, 4, 0x5a5a5a, undefined, { mat: 'metal', bands: [[2, brass, 'gold']] });
  m.pair(6, 50, -8, 3, 2, 3, 0x7ad8ff, undefined, glow(0x7ad8ff));
  // shoulder gears
  m.pair(17, 36, 0, 10, 10, 12, brass, 'armL', { mat: 'gold', side: 'gear', front: 'gear', accent: 0x8a6a2a });
  // left: piston arm with a hammer fist
  m.box(17, 18, 0, 6, 18, 6, steel, 'armL', { mat: 'metal', bands: [[4, 0x5a5a5a, 'metal']] });
  m.box(17, 6, 1, 12, 12, 12, copper, 'armL', { mat: 'copper', front: 'plate', side: 'bands', accent: 0x6a4a2a });
  // right: rune cannon
  m.box(-17, 18, 0, 6, 18, 6, steel, 'armR', { mat: 'metal', bands: [[4, 0x5a5a5a, 'metal']] });
  m.box(-17, 8, 3, 9, 10, 16, 0x5a5a5a, 'armR', { mat: 'metal', side: 'bands', accent: brass });
  m.box(-17, 11, 11.5, 5, 5, 1, 0x7ad8ff, 'armR', glow(0x7ad8ff));
  // visor head with antennae
  m.box(0, 42, 2, 14, 10, 12, copper, 'head', { mat: 'copper', face: { style: 'visor', eye: core } });
  m.box(0, 46, 8.2, 10, 2, 1, core, 'head', glow(core));
  m.box(0, 52, 2, 10, 3, 10, brass, 'head', { mat: 'gold', side: 'gear', accent: 0x8a6a2a });
  m.pair(4, 55, 0, 1, 7, 1, steel, 'head', { mat: 'metal' });
  m.pair(4, 62, 0, 2, 2, 2, 0x7ad8ff, 'head', glow(0x7ad8ff));
  return m.build(0.1, { gait: { leg: 0.3, arm: 0.25 } });
}

/** The void king: a hooded giant of torn night, a great eye in its chest, wings of nothing and a broken crown. */
function hollowSovereign(): VoxelModel {
  const m = new Mob();
  const v: BoxPaint = { mat: 'void', accent: 0xd0a0ff };
  const voidC = 0x2a1050;
  const eye = 0xd0a0ff;
  const gold = 0xe8c050;
  m.box(0, 0, 0, 10, 6, 9, 0x1a0a30, undefined, { mat: 'ghost', side: 'rag', accent: eye });
  m.box(0, 6, 0, 18, 10, 14, voidC, undefined, { ...v, side: 'rag', back: 'rag', front: 'trim', accent: gold });
  m.box(0, 16, 0, 22, 12, 15, 0x34146a, undefined, { ...v, side: 'rag', back: 'rag' });
  m.box(0, 28, 0, 20, 14, 12, 0x3a1a6a, undefined, { ...v, face: { style: 'cyclops', eye } });
  m.box(0, 33, 6.2, 6, 5, 1, eye, undefined, glow(eye));
  m.box(0, 42, -1, 26, 4, 14, 0x1a0a30, undefined, { mat: 'cloth', side: 'trim', accent: gold });
  // wings of torn night
  m.pair(22, 22, -6, 30, 22, 2, 0x4a1a8a, 'wingL', { ...v, front: 'claws', side: 'rag', accent: 0xb070ff });
  m.pair(34, 36, -6, 8, 10, 2, 0x3a1070, 'wingL', { ...v, accent: 0xb070ff });
  // long spectral arms with glowing claws
  m.pair(13, 22, 0, 6, 20, 6, 0x3a1a6a, 'armL', { ...v, bands: [[3, 0x2a0a4a, 'void']] });
  m.pair(13, 16, 1, 7, 7, 7, 0x6a3ab0, 'armL', { mat: 'ghost', front: 'claws', accent: eye, glow: 0.5 });
  m.pair(13, 40, 0, 9, 6, 9, 0x2a0a4a, 'armL', { mat: 'metal', side: 'bands', accent: gold });
  // hood with a void face and a broken crown
  m.box(0, 46, 0, 13, 13, 13, 0x1a0a30, 'head', { ...v, face: { style: 'hood', eye, alt: 0x050008 } });
  m.pair(3, 51, 6.8, 2, 2, 1, eye, 'head', glow(eye));
  m.box(0, 59, 0, 15, 3, 15, gold, 'head', { mat: 'gold', front: 'gem', accent: 0x7a3dff });
  for (const [x, z, h] of [[-6, -6, 5], [6, -6, 3], [-6, 6, 4], [6, 6, 6], [0, 6, 7]] as const) m.box(x, 62, z, 2, h, 2, gold, 'head', { mat: 'gold' });
  m.box(0, 66, 6, 2, 3, 2, 0x9a5aff, 'head', glow(0x9a5aff));
  return m.build(0.1, { gait: { wing: 0.4, arm: 0.2 } });
}

/** Boss models. Tagged parts animate (arms wind up and strike, wings beat, legs walk, jaws roar). */
export const BOSS_MODELS: Record<string, VoxelModel> = {
  spore_mother: sporeMother(),
  rotroot: rotroot(),
  rat_tyrant: ratTyrant(),
  bellwarden: bellwarden(),
  bone_colossus: boneColossus(),
  lich_vharos: lich(),
  cinder_golem: cinderGolem(),
  magmaw: magmaw(),
  frostfang: frostfang(),
  glacial_matriarch: glacialMatriarch(),
  clockwork_sentinel: clockworkSentinel(),
  hollow_sovereign: hollowSovereign(),
};
