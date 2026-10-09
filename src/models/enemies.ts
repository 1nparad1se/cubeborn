import type { VoxelModel } from '../data/types';
import { biped, Mob, PX, quadMob } from './builders';
import type { BoxPaint, FaceSpec, SkinnedModel } from '../render/creatureSkins';

/**
 * Enemy models keyed by enemy id: blocky pixel-skinned mobs in the style of dungeon-crawler
 * block games. Authored in pixel units (16 per world unit), one texel per unit; every box has a
 * painted material and the heads carry pixel faces. Tags (legL/legR/armL/armR/wingL/wingR/
 * tail/jaw/head) drive the GPU walk cycle; sizes match the previous models' world sizes.
 */

const wood = (c = 0x6a4a2a): BoxPaint => ({ mat: 'wood', seed: c & 15 });

// ================================================================ Blightwood

function rotZombie(): VoxelModel {
  const m = new Mob();
  const r = biped(m, {
    skin: 0x6f9a52, shirt: 0x4f6a5a, pants: 0x34384e, shoes: 0x2a2420,
    face: { style: 'zombie', eye: 0x1c2a14 }, hair: { color: 0x2f4a22, rows: 1.5 },
    armsForward: true, bodyPaint: { mat: 'cloth', front: 'rag', back: 'rag', side: 'rag' },
  });
  // a toadstool sprouting from the scalp
  m.box(-2, r.headTop, 1, 3, 2, 3, 0xc8402a, 'head', { mat: 'mush', accent: 0xf0e8d8 });
  return m.build(PX, { gait: { arm: 0.22, roll: 0.09 } });
}

function sporeling(): VoxelModel {
  const m = new Mob();
  m.pair(1.6, 0, 0, 2, 2, 2, 0xc8bca0, 'legR', { mat: 'skin' });
  m.box(0, 2, 0, 6, 7, 6, 0xe8dcc0, 'body', { mat: 'skin', face: { style: 'cute', eye: 0x1a1414, alt: 0xe89ab0 } });
  m.box(0, 9, 0, 12, 4, 12, 0xb84ad6, 'head', { mat: 'mush', accent: 0xf4e4ff });
  m.box(0, 13, 0, 8, 2, 8, 0xc45ae2, 'head', { mat: 'mush', accent: 0xf4e4ff });
  return m.build(0.067, { gait: { leg: 0.9, roll: 0.14, bob: 0.07, head: 0.12 } });
}

function blightWolf(): VoxelModel {
  const m = new Mob();
  const r = quadMob(m, {
    body: [6, 6, 10], legH: 8, head: [6, 6, 5], snout: [3, 3, 3], fur: 0x5a5a4a, belly: 0x6a7a4a,
    face: { style: 'beast', eye: 0xc8ff3a }, ears: [2, 2, 1], tail: [2, 2, 7], mane: [8, 7, 6], maneColor: 0x4a4a3c,
    bodyPaint: { side: 'spots', accent: 0x9adf3a },
  });
  m.box(0, r.bodyTop, -1, 2, 1, 7, 0x8aff3a, 'body', { mat: 'glow' });
  return m.build(PX, { gait: { leg: 0.75, roll: 0.03, bob: 0.06 } });
}

function thornBeetle(): VoxelModel {
  const m = new Mob();
  const shell = 0x3a6a3a;
  m.box(0, 2, 0, 12, 3, 14, 0x2a3a2a, 'body', { mat: 'chitin' });
  m.box(0, 4, -0.5, 14, 8, 15, shell, 'body', { mat: 'chitin', top: 'shell', side: 'spots', accent: 0x5a9a3a });
  for (const [x, z, h] of [[-3, -3, 3], [3, 1, 4], [0, 4, 3], [-4, 3, 2], [4, -5, 3]] as const) m.box(x, 12, z, 1, h, 1, 0xd8d070, 'body', { mat: 'bone' });
  m.box(0, 3, 9, 9, 6, 4, 0x2a4a2a, 'head', { mat: 'chitin', face: { style: 'insect', eye: 0xff5a3a } });
  m.pair(2.5, 3, 12, 1, 1, 3, 0xd8d070, 'head', { mat: 'bone' });
  for (let i = 0; i < 3; i++) m.pair(8, 0, -5 + i * 5, 3, 4, 2, 0x22321f, i % 2 ? 'legL' : 'legR', { mat: 'chitin' });
  return m.build(PX, { gait: { leg: 0.5, roll: 0.04, bob: 0.03 } });
}

function sporeSpitter(): VoxelModel {
  const m = new Mob();
  m.pair(2, 0, 0, 3, 2, 3, 0xb8a888, 'legR', { mat: 'skin' });
  m.box(0, 2, 0, 7, 8, 7, 0xd8c8a0, 'body', { mat: 'skin', front: 'mouth', accent: 0x9cff4f, face: { style: 'cute', eye: 0x1a1414, dy: -2 } });
  m.box(0, 10, 0, 14, 5, 14, 0xd85a3a, 'head', { mat: 'mush', accent: 0xf8eedc });
  m.box(0, 15, 0, 9, 2, 9, 0xe0683f, 'head', { mat: 'mush', accent: 0xf8eedc });
  return m.build(0.071, { gait: { leg: 0.7, roll: 0.1, head: 0.1 } });
}

function duskMoth(): VoxelModel {
  const m = new Mob();
  m.box(0, 11, -1, 4, 4, 7, 0x8a7a9a, 'body', { mat: 'fur', bands: [[1, 0x6a5a7a]] });
  m.box(0, 11, 4, 4, 4, 3, 0x7a6a8a, 'head', { mat: 'fur', face: { style: 'insect', eye: 0xffe04a } });
  m.pair(1.2, 15, 5, 1, 3, 1, 0x5a4a6a, 'head', { mat: 'plain' });
  m.pair(6.5, 13.5, 0, 9, 1, 8, 0xb89ad8, 'wingL', { mat: 'cloth', top: 'eyespot', accent: 0xffd060 });
  m.pair(5, 13, -5, 6, 1, 4, 0x9a7ac0, 'wingL', { mat: 'cloth' });
  return m.build(0.068, { gait: { wing: 0.55, bob: 0.12, roll: 0.05 } });
}

function bloatToad(): VoxelModel {
  const m = new Mob();
  m.box(0, 1, 0, 13, 9, 12, 0x6a9a3a, 'body', { mat: 'skin', face: { style: 'snout' }, top: 'spots', side: 'spots', accent: 0xb8ff4a });
  m.box(0, 1, 0.5, 11, 3, 12, 0xc8d870, 'body', { mat: 'skin' });
  m.pair(4, 10, 3, 3, 3, 3, 0x6a9a3a, 'head', { mat: 'skin', face: { style: 'cyclops', eye: 0x1a1a1a } });
  m.pair(6, 0, -3, 3, 3, 5, 0x5a8a34, 'legR', { mat: 'skin' });
  m.pair(4.5, 0, 4.5, 2, 2, 2, 0x5a8a34, 'legL', { mat: 'skin' });
  return m.build(0.062, { gait: { leg: 0.4, hop: 0.12, roll: 0.05, bob: 0.03 } });
}

function saplingShaman(): VoxelModel {
  const m = new Mob();
  const r = biped(m, {
    skin: 0x7a5a34, shirt: 0x6a4a2a, pants: 0x5a3a20, shoes: 0x3a2a14, leg: [4, 10, 4],
    face: { style: 'treant', eye: 0xb8ff4a },
    headPaint: { mat: 'bark' }, bodyPaint: { mat: 'bark', front: 'rune', accent: 0xb8ff4a }, armPaint: { mat: 'bark', bands: [] }, legPaint: { mat: 'bark', bands: [] },
  });
  m.box(0, r.headTop - 2, 0, 12, 5, 12, 0x4a9a3a, 'head', { mat: 'leaf' });
  m.box(0, r.headTop + 3, 0, 8, 3, 8, 0x5aaa44, 'head', { mat: 'leaf' });
  m.box(-4, r.headTop + 1, 5, 2, 2, 2, 0xff70b0, 'head', { mat: 'plain' });
  m.box(-r.armX, -4, 2.5, 1, 18, 1, 0x6a4a2a, 'armR', wood());
  m.box(-r.armX, 14, 2.5, 3, 3, 3, 0xb8ff4a, 'armR', { mat: 'glow' });
  return m.build(PX, { gait: { leg: 0.45, arm: 0.3, roll: 0.07 } });
}

// ================================================================ Gloamhaven

function ghoul(): VoxelModel {
  const m = new Mob();
  biped(m, {
    skin: 0x9a9ab0, shirt: 0x5a4a5a, pants: 0x3a3040, shoes: 0x2a2030,
    face: { style: 'zombie', eye: 0xffd040 }, hair: { color: 0x2a2430, rows: 1, back: true },
    armsForward: true, hunch: 2, neck: 1, armPaint: { mat: 'cloth', side: 'rag' }, bodyPaint: { mat: 'cloth', front: 'rag', back: 'rag', side: 'rag' },
  });
  return m.build(PX * 0.93, { gait: { arm: 0.3, roll: 0.12, bob: 0.06 } });
}

function plagueRat(): VoxelModel {
  const m = new Mob();
  quadMob(m, {
    body: [6, 5, 11], legH: 3, head: [5, 5, 5], snout: [3, 2, 2], snoutColor: 0x8a6a62, fur: 0x6a5a52, belly: 0x8a7a72,
    face: { style: 'beast', eye: 0xff3a3a }, ears: [2, 2, 1], earColor: 0xd89a9a, tail: [1, 1, 9], tailColor: 0xd89a9a,
    bodyPaint: { side: 'spots', accent: 0x8a9a5a },
  });
  return m.build(PX, { gait: { leg: 0.8, roll: 0.03, tail: 0.6 } });
}

function bat(fur: number, wing: number, eye: number, scale: number): VoxelModel {
  const m = new Mob();
  m.box(0, 12, 0, 4, 5, 3, fur, 'body', { mat: 'fur' });
  m.box(0, 17, 0, 6, 5, 5, fur, 'head', { mat: 'fur', face: { style: 'bat', eye } });
  m.pair(2, 22, -1, 1, 3, 1, fur, 'head', { mat: 'fur' });
  m.pair(5.5, 15, -0.5, 7, 1, 5, wing, 'wingL', { mat: 'leather' });
  m.pair(11.5, 15.5, -1, 5, 1, 4, wing, 'wingL', { mat: 'leather', front: 'claws' });
  return m.build(scale, { gait: { wing: 0.6, bob: 0.14, roll: 0.06 } });
}

function ironHusk(): VoxelModel {
  const m = new Mob();
  const iron = 0x6a6a78;
  m.pair(3.5, 0, 0, 5, 11, 5, 0x55556a, 'legR', { mat: 'metal', bands: [[2, 0x3a3a48, 'metal']] });
  m.box(0, 11, 0, 16, 12, 8, iron, 'body', { mat: 'metal', front: 'core', accent: 0xffa040 });
  m.box(0, 21, 0.5, 8, 9, 8, 0x7a7a88, 'head', { mat: 'metal', face: { style: 'visor', eye: 0xffa040 } });
  m.box(0, 30, 0.5, 2, 2, 8, 0x8a5a3a, 'head', { mat: 'copper' });
  m.pair(10.5, 3, 0, 5, 20, 6, iron, 'armL', { mat: 'metal', bands: [[5, 0x4a4a58, 'metal'], [1, 0x8a5a3a, 'copper']] });
  m.pair(10.5, 21, 0, 7, 3, 7, 0x8a8a98, 'armL', { mat: 'metal' });
  return m.build(PX, { gait: { leg: 0.4, arm: 0.35, roll: 0.07, bob: 0.04 } });
}

function cultArcher(): VoxelModel {
  const m = new Mob();
  const red = 0x6a1a2a;
  const r = biped(m, {
    skin: 0xc0a080, headColor: red, shirt: red, pants: 0x3a0a14, shoes: 0x1a0a0a,
    face: { style: 'hood', eye: 0xff4a4a, alt: 0x1e1014 }, headPaint: { mat: 'cloth' },
    bodyPaint: { mat: 'cloth', bands: [[3, red], [1, 0x3a2414, 'leather']], front: 'vest', accent: 0x4a0a18 },
    armsForward: true,
  });
  m.box(0, r.headTop - 1, -2.5, 4, 3, 3, red, 'head', { mat: 'cloth' });
  // crossbow held level in front of the chest
  m.box(0, r.bodyTop - 5, 6, 2, 2, 8, 0x5a3a20, 'body', wood());
  m.box(0, r.bodyTop - 4.5, 9.5, 11, 1, 1, 0x4a3018, 'body', wood());
  m.box(0, r.bodyTop - 4, 9, 9, 1, 1, 0xd8d0c0, 'body');
  return m.build(PX * 1.05, { gait: { arm: 0.12, roll: 0.06 } });
}

function powderImp(): VoxelModel {
  const m = new Mob();
  const r = biped(m, {
    head: [8, 7, 7], body: [7, 7, 4], arm: [3, 7, 3], leg: [3, 6, 3], hand: 2, shoe: 1,
    skin: 0xd84a3a, shirt: 0xb83a2a, pants: 0x5a2a1a, face: { style: 'imp', eye: 0xffe04a },
  });
  m.pair(2.5, r.headTop, 0, 1, 3, 1, 0x2a1a1a, 'head', { mat: 'bone' });
  m.box(0, 5, -5.5, 7, 8, 6, 0x8a5a2a, 'body', { mat: 'wood', front: 'bands', back: 'bands', side: 'bands', accent: 0x3a3a3a });
  m.box(0, 13, -5.5, 1, 3, 1, 0xffd040, 'body', { mat: 'glow' });
  return m.build(0.075, { gait: { leg: 0.8, arm: 0.6, roll: 0.12, bob: 0.07 } });
}

function bellCultist(): VoxelModel {
  const m = new Mob();
  const robe = 0x2a2a3a;
  const r = biped(m, {
    skin: 0xc0a080, headColor: 0x1a1a2a, shirt: robe, pants: 0x1a1a2a, robe: 2,
    face: { style: 'hood', eye: 0xffd040, alt: 0x0e0c14 }, headPaint: { mat: 'cloth' },
    robePaint: { accent: 0xc8a050 }, bodyPaint: { mat: 'cloth', front: 'cross', accent: 0xc8a050 },
  });
  m.box(0, r.headTop - 1, -2, 4, 4, 4, 0x1a1a2a, 'head', { mat: 'cloth' });
  m.box(-r.armX, -2, 2.5, 1, 18, 1, 0x4a3a2a, 'armR', wood());
  m.box(-r.armX, 16, 2.5, 3, 1, 3, 0x8a6a2a, 'armR', { mat: 'gold' });
  m.box(-r.armX, 12, 2.5, 5, 4, 5, 0xc8a050, 'armR', { mat: 'gold', front: 'bands', accent: 0x8a6a2a });
  return m.build(PX, { gait: { leg: 0.35, arm: 0.3, roll: 0.05 } });
}

function gargoyle(): VoxelModel {
  const m = new Mob();
  const st = 0x6a6a72;
  m.pair(2.5, 0, 0.5, 3, 4, 4, 0x5a5a62, 'legR', { mat: 'stone' });
  m.box(0, 4, 0, 9, 8, 7, st, 'body', { mat: 'stone' });
  m.box(0, 11, 2, 7, 6, 6, 0x7a7a82, 'head', { mat: 'stone', face: { style: 'golem', eye: 0xff6a3a } });
  m.pair(2.5, 17, 1, 1, 3, 1, 0x4a4a52, 'head', { mat: 'stone' });
  m.pair(9.5, 10, -1, 10, 1, 8, 0x5a5a62, 'wingL', { mat: 'stone', front: 'claws', accent: 0x4a4a52 });
  m.pair(5.5, 5, 3, 2, 6, 2, st, 'armL', { mat: 'stone' });
  m.box(0, 5, -5, 2, 2, 6, 0x5a5a62, 'tail', { mat: 'stone' });
  return m.build(PX, { gait: { wing: 0.6, leg: 0.4, bob: 0.1 } });
}

// ================================================================ Ossuary

function skeletonMob(bone: number, eyes: number, weapon: 'sword' | 'bow'): VoxelModel {
  const m = new Mob();
  const r = biped(m, {
    skin: bone, shirt: bone, pants: bone, shoes: bone,
    arm: [2, 12, 2], leg: [2, 12, 2], legGap: 2, hand: 0, shoe: 0,
    face: { style: 'skull', eye: eyes }, hair: weapon === 'bow' ? { color: 0x3a3428, rows: 2, mat: 'cloth' } : undefined,
    headPaint: { mat: 'bone' }, bodyPaint: { mat: 'bone', front: 'ribs', back: 'ribs', side: 'ribs' },
    armPaint: { mat: 'bone' }, legPaint: { mat: 'bone' },
  });
  if (weapon === 'sword') {
    m.box(-r.armX, 0.5, 4.5, 1, 1, 7, 0x9a9488, 'armR', { mat: 'metal' });
    m.box(-r.armX, 0, 1.5, 1, 2, 1, 0x5a3a20, 'armR', wood());
  } else {
    m.box(r.armX, -2, 1.5, 1, 16, 1, 0x6a4a2a, 'armL', wood());
    m.box(0, 14, -3, 3, 8, 2, 0x5a3a24, 'body', { mat: 'leather' });
    m.box(0.5, 22, -3, 1, 2, 1, 0xd8d0c0, 'body');
  }
  return m.build(PX, { gait: { leg: 0.7, arm: 0.55, roll: 0.07 } });
}

function ghost(o: { robe: number; head: number; face: FaceSpec; crown?: number; flame?: number }): VoxelModel {
  const m = new Mob();
  const gp: BoxPaint = { mat: 'ghost' };
  m.box(0, 0, -0.5, 5, 4, 4, o.robe, 'body', gp);
  m.box(0, 4, 0, 8, 8, 6, o.robe, 'body', { ...gp, side: 'rag', back: 'rag' });
  m.box(0, 12, 0, 9, 8, 6, o.robe, 'body', gp);
  m.box(0, 20, 0, 8, 8, 8, o.head, 'head', { mat: 'ghost', face: o.face });
  m.pair(6, 11, 1, 3, 9, 3, o.robe, 'armL', { ...gp, front: 'rag' });
  if (o.crown !== undefined) {
    m.box(0, 28, 0, 9, 2, 9, o.crown, 'head', { mat: 'gold', front: 'gem', accent: 0x7a3dff });
    m.pair(3, 30, 0, 1, 2, 1, o.crown, 'head', { mat: 'gold' });
  }
  if (o.flame !== undefined) {
    m.box(0, 28, -1, 4, 3, 4, o.flame, 'head', { mat: 'glow' });
    m.box(0.5, 31, -1.5, 2, 2, 2, o.flame, 'head', { mat: 'glow' });
  }
  return m.build(PX * 1.06, { gait: { leg: 0, arm: 0.25, bob: 0.1, roll: 0.04, head: 0.08 } });
}

function boneHound(): VoxelModel {
  const m = new Mob();
  const r = quadMob(m, {
    body: [6, 6, 10], legH: 8, head: [6, 6, 5], snout: [3, 3, 3], fur: 0xd8d0b8, mat: 'bone',
    face: { style: 'skull', eye: 0xff4a2a, dy: -1 }, ears: [2, 2, 1], tail: [1, 1, 7],
    bodyPaint: { side: 'ribs', front: 'ribs', back: 'ribs' },
  });
  m.box(0, r.bodyTop, 0, 1, 2, 9, 0x8a8270, 'body', { mat: 'bone' });
  return m.build(PX, { gait: { leg: 0.8, roll: 0.03, bob: 0.06 } });
}

function stoneGolem(o: {
  stone: number; dark: number; eye: number; accent: number; mat?: BoxPaint['mat']; face?: FaceSpec['style']; decal?: BoxPaint['front'];
  topper?: number; topperMat?: BoxPaint['mat']; scale: number; spikes?: number; shield?: number;
}): VoxelModel {
  const m = new Mob();
  const mat = o.mat ?? 'stone';
  m.pair(3.5, 0, 0, 5, 10, 5, o.dark, 'legR', { mat, accent: o.accent, bands: [[2, o.dark]] });
  m.box(0, 10, 0, 16, 12, 8, o.stone, 'body', { mat, front: o.decal ?? 'rune', accent: o.accent });
  if (o.topper !== undefined) m.box(0, 21, -0.5, 17, 2, 9, o.topper, 'body', { mat: o.topperMat ?? 'leaf' });
  m.box(0, 21, 1, 7, 7, 7, o.stone, 'head', { mat, accent: o.accent, face: { style: o.face ?? 'golem', eye: o.eye } });
  m.pair(10.5, 3, 0, 5, 19, 6, o.stone, 'armL', { mat, accent: o.accent, bands: [[6, o.dark]], front: mat === 'magma' ? undefined : 'rune' });
  if (o.spikes !== undefined) m.pair(10.5, 22, 0, 3, 4, 3, o.spikes, 'armL', { mat: 'crystal' });
  if (o.shield !== undefined) m.box(13.5, 2, 1, 2, 14, 10, o.shield, 'armL', { mat: 'gold', side: 'rune', accent: o.accent });
  return m.build(o.scale, { gait: { leg: 0.38, arm: 0.32, roll: 0.07, bob: 0.035 } });
}

function robedCaster(o: {
  skin: number; hood: number; robe: number; trim: number; face: FaceSpec; orb: number; staff: number; hoodAsHair?: boolean; scale?: number;
}): VoxelModel {
  const m = new Mob();
  const r = biped(m, {
    skin: o.skin, headColor: o.hoodAsHair ? o.skin : o.hood, shirt: o.robe, pants: shadeOf(o.robe), robe: 1,
    face: o.face, hair: o.hoodAsHair ? { color: o.hood, rows: 2, mat: 'cloth' } : undefined,
    headPaint: o.hoodAsHair ? { mat: 'bone' } : { mat: 'cloth' }, robePaint: { accent: o.trim }, bodyPaint: { mat: 'cloth', front: 'trim', accent: o.trim },
  });
  if (o.hoodAsHair) m.box(0, r.headTop, -0.5, 9, 1, 9, o.hood, 'head', { mat: 'cloth' });
  m.box(-r.armX, -3, 2.5, 1, 18, 1, o.staff, 'armR', wood());
  m.box(-r.armX, 15, 2.5, 3, 3, 3, o.orb, 'armR', { mat: 'glow' });
  return m.build(o.scale ?? PX, { gait: { leg: 0.35, arm: 0.3, roll: 0.05 } });
}

function shadeOf(c: number): number {
  return (Math.round(((c >> 16) & 255) * 0.6) << 16) | (Math.round(((c >> 8) & 255) * 0.6) << 8) | Math.round((c & 255) * 0.6);
}

// ================================================================ Emberwaste

function slimeCube(o: { color: number; mat: BoxPaint['mat']; accent?: number; eye: number; size: number; scale: number; cap?: number }): VoxelModel {
  const m = new Mob();
  const s = o.size;
  m.box(0, 0, 0, s, Math.round(s * 0.85), s, o.color, 'body', { mat: o.mat, accent: o.accent, face: { style: 'slime', eye: o.eye } });
  if (o.cap !== undefined) m.box(0, Math.round(s * 0.85), 0, Math.round(s * 0.45), 2, Math.round(s * 0.45), o.cap, 'body', { mat: 'snow' });
  return m.build(o.scale, { gait: { leg: 0, roll: 0, bob: 0.02, hop: 0.22, head: 0 } });
}

function imp(o: { skin: number; shirt: number; pants: number; eye: number; wings?: number; orb?: number; scale: number }): SkinnedModel {
  const m = new Mob();
  const r = biped(m, {
    head: [8, 7, 7], body: [7, 7, 4], arm: [3, 7, 3], leg: [3, 7, 3], hand: 2, shoe: 1,
    skin: o.skin, shirt: o.shirt, pants: o.pants, face: { style: 'imp', eye: o.eye, glow: true },
  });
  m.pair(2.5, r.headTop, 0, 1, 3, 1, 0x2a1a1a, 'head', { mat: 'bone' });
  if (o.wings !== undefined) m.pair(4.5, r.legH + 2, -3, 6, 6, 1, o.wings, 'wingL', { mat: 'leather', front: 'claws' });
  if (o.orb !== undefined) m.box(-r.armX, -2, 1, 3, 3, 3, o.orb, 'armR', { mat: 'glow' });
  m.box(0, r.legH + 1, -4.5, 1, 1, 5, o.shirt, 'tail', { mat: 'skin' });
  return m.build(o.scale, { gait: { leg: 0.8, arm: 0.6, roll: 0.11, bob: 0.07, wing: 0.5 } });
}

function emberWisp(): VoxelModel {
  const m = new Mob();
  m.box(0, 7, 0, 3, 3, 3, 0xff5a1a, 'body', { mat: 'glow' });
  m.box(0, 10, 0, 7, 7, 7, 0xff7a1a, 'body', { mat: 'glow', face: { style: 'slime', eye: 0x2a0a0a, glow: false } });
  m.box(0, 17, -1, 4, 4, 4, 0xffb03a, 'body', { mat: 'glow' });
  m.box(0.5, 21, -1.5, 2, 2, 2, 0xffe04a, 'body', { mat: 'glow' });
  return m.build(0.066, { gait: { leg: 0, bob: 0.1, hop: 0.08, roll: 0.05 } });
}

function salamander(): VoxelModel {
  const m = new Mob();
  const r = quadMob(m, {
    body: [6, 4, 14], legH: 3, head: [6, 4, 6], snout: [4, 3, 3], fur: 0xd84a1a, belly: 0xffc040, mat: 'scale',
    face: { style: 'beast', eye: 0x1a1a1a }, tail: [3, 3, 8],
  });
  m.box(0, 4.5, -14, 2, 2, 6, 0xc83a14, 'tail', { mat: 'scale' });
  m.box(0, r.bodyTop, 0, 2, 1, 12, 0xffd040, 'body', { mat: 'glow' });
  return m.build(0.072, { gait: { leg: 0.7, tail: 0.5, roll: 0.02, bob: 0.02 } });
}

// ================================================================ Frostveil

function frostWalker(): VoxelModel {
  const m = new Mob();
  const r = biped(m, {
    skin: 0x9ad0e8, shirt: 0x5a7a9a, pants: 0x3a5a7a, shoes: 0x2a3a52,
    face: { style: 'zombie', eye: 0x2affff }, hair: { color: 0xe0f8ff, rows: 2, mat: 'snow' },
    bodyPaint: { mat: 'cloth', front: 'rag', back: 'rag' },
  });
  m.pair(r.armX, r.bodyTop, 0, 4, 3, 4, 0xc8f0ff, 'armL', { mat: 'crystal' });
  return m.build(PX, { gait: { leg: 0.55, arm: 0.45, roll: 0.08 } });
}

function wolf(fur: number, belly: number, eye: number, mane: number, snout: number): VoxelModel {
  const m = new Mob();
  quadMob(m, {
    body: [6, 6, 10], legH: 8, head: [6, 6, 5], snout: [3, 3, 3], snoutColor: snout, fur, belly,
    face: { style: 'beast', eye }, ears: [2, 2, 1], tail: [2, 2, 7], mane: [8, 7, 6], maneColor: mane,
  });
  return m.build(PX * 1.05, { gait: { leg: 0.75, roll: 0.03, bob: 0.06 } });
}

function frostMage(): VoxelModel {
  const m = new Mob();
  const robe = 0x3a6aa8;
  const r = biped(m, {
    skin: 0x9aa4a8, shirt: robe, pants: 0x2a4a8a, robe: 1,
    face: { style: 'illager', eye: 0x2affff, alt: 0x2a3040 },
    robePaint: { accent: 0xe8f8ff }, bodyPaint: { mat: 'cloth', front: 'trim', accent: 0xe8f8ff },
  });
  m.box(0, r.headY + 1, 5, 2, 4, 2, 0x8a949a, 'head', { mat: 'skin' });
  m.box(0, r.bodyTop - 2, 0, 10, 2, 6, 0xe8f8ff, 'body', { mat: 'fur' });
  m.box(0, r.headTop, 0, 10, 2, 10, 0xe8f8ff, 'head', { mat: 'fur' });
  m.box(0, r.headTop + 2, -0.5, 6, 3, 6, robe, 'head', { mat: 'cloth' });
  m.box(0, r.headTop + 5, -1, 3, 2, 3, robe, 'head', { mat: 'cloth' });
  m.box(-r.armX, -3, 2.5, 1, 16, 1, 0xc8f0ff, 'armR', { mat: 'ice' });
  m.box(-r.armX, 13, 2.5, 2, 4, 2, 0x8af0ff, 'armR', { mat: 'crystal', glow: 0.8 });
  return m.build(PX, { gait: { leg: 0.35, arm: 0.3, roll: 0.05 } });
}

function tuskCalf(): VoxelModel {
  const m = new Mob();
  const r = quadMob(m, {
    body: [12, 10, 14], legH: 6, legW: 4, head: [9, 8, 6], fur: 0x7a5a42, legColor: 0x6a4a36,
    face: { style: 'beast', eye: 0x1a1a1a }, ears: [3, 5, 1], earColor: 0x6a4a36, tail: [2, 4, 2],
    bodyPaint: { hair: { color: 0xe8eef6, rows: 2, mat: 'snow', back: false } },
  });
  const fz = r.headZ + 3;
  m.box(0, r.headY - 5, fz + 1.5, 3, 7, 3, 0x6a4a36, 'head', { mat: 'fur' });
  m.pair(3, r.headY - 1, fz + 3, 1, 1, 6, 0xf8f0e0, 'head', { mat: 'bone' });
  return m.build(PX, { gait: { leg: 0.5, roll: 0.05, bob: 0.04 } });
}

// ================================================================ Aetherfall

function ruinGuard(): VoxelModel {
  const m = new Mob();
  const r = biped(m, {
    skin: 0xc8b090, shirt: 0xd8c8a0, pants: 0xa8987a, shoes: 0x7a6a50, sleeve: 0xc8b090,
    face: { style: 'golem', eye: 0x8a6aff }, hair: { color: 0xe8c050, rows: 3, mat: 'gold' },
    headPaint: { mat: 'stone' }, bodyPaint: { mat: 'cloth', front: 'plate', accent: 0xe8c050 }, armPaint: { mat: 'stone', bands: [[2, 0xe8c050, 'gold']] },
  });
  m.box(0, r.headTop, -0.5, 1, 3, 7, 0x8a6aff, 'head', { mat: 'cloth' });
  m.box(-r.armX, -4, 2.5, 1, 20, 1, 0xa88a50, 'armR', wood());
  m.box(-r.armX, 16, 2.5, 1, 3, 1, 0xe8e0d0, 'armR', { mat: 'metal' });
  m.box(r.armX + 2.5, 1, 1, 1, 9, 7, 0xe8c050, 'armL', { mat: 'gold', side: 'rune', accent: 0x8a6aff });
  return m.build(PX, { gait: { leg: 0.55, arm: 0.35, roll: 0.05 } });
}

function gearSpider(): VoxelModel {
  const m = new Mob();
  m.box(0, 3, -1, 9, 6, 10, 0xb08a3a, 'body', { mat: 'gold', top: 'gear', accent: 0x8a8a8a });
  m.box(0, 3, 6.5, 7, 5, 5, 0x8a6a2a, 'head', { mat: 'metal', face: { style: 'spider', eye: 0x6affff } });
  for (let i = 0; i < 4; i++) {
    const z = -4 + i * 2.6;
    const tag = i % 2 ? 'legL' : 'legR';
    m.pair(8, 6, z, 7, 1.5, 1.5, 0x5a4a2a, tag, { mat: 'metal' });
    m.pair(11, 0, z, 1.5, 6, 1.5, 0x4a3a20, tag, { mat: 'metal' });
  }
  return m.build(PX, { gait: { leg: 0.5, roll: 0.03, bob: 0.03 } });
}

function voidEye(): VoxelModel {
  const m = new Mob();
  m.box(0, 8, 0, 10, 10, 10, 0x2a1a4a, 'body', { mat: 'void', accent: 0xd0a0ff, face: { style: 'cyclops', eye: 0xb04aff } });
  m.pair(3.5, 18, -1, 2, 3, 2, 0x3a2a5a, 'body', { mat: 'void', accent: 0xd0a0ff });
  m.pair(3, 2, 3, 2, 6, 2, 0x3a2a5a, 'legL', { mat: 'void', accent: 0xb04aff });
  m.pair(3, 3, -3, 2, 5, 2, 0x3a2a5a, 'legR', { mat: 'void', accent: 0xb04aff });
  m.pair(6.5, 12, 0, 3, 1, 5, 0x4a2a6a, 'wingL', { mat: 'leather' });
  return m.build(0.078, { gait: { leg: 0.4, wing: 0.5, bob: 0.12, roll: 0.04 } });
}

function runeDrone(): VoxelModel {
  const m = new Mob();
  m.box(0, 8, 0, 3, 2, 3, 0x6affff, 'body', { mat: 'glow' });
  m.box(0, 10, 0, 8, 6, 8, 0xc8a050, 'body', { mat: 'gold', side: 'rune', back: 'rune', accent: 0x8a6aff, face: { style: 'visor', eye: 0x6affff } });
  m.box(0, 16, 0, 4, 2, 4, 0x8a6aff, 'body', { mat: 'crystal' });
  m.pair(7.5, 13, 0, 7, 1, 4, 0x9a8a6a, 'wingL', { mat: 'metal' });
  return m.build(0.067, { gait: { wing: 0.35, bob: 0.1, roll: 0.06 } });
}

function arcaneBomber(): VoxelModel {
  const mdl = imp({ skin: 0x8a6aff, shirt: 0x5a3ab8, pants: 0x3a2a7a, eye: 0xf0e0ff, scale: 0.08 });
  mdl.boxes.push([0, 8, -3.5, 6, 6, 3, 0x5a3a24, 'body'], [0, 13, -4, 6, 6, 6, 0xb08aff, 'body']);
  mdl.skin.paints.push({ mat: 'leather' }, { mat: 'glow' });
  return mdl;
}

function treasureSprite(): VoxelModel {
  const m = new Mob();
  const r = biped(m, {
    head: [8, 7, 7], body: [6, 6, 4], arm: [3, 6, 3], leg: [3, 5, 3], hand: 2, shoe: 1,
    skin: 0xffd23d, shirt: 0xc89a2a, pants: 0x8a6a1a, face: { style: 'cute', eye: 0x1a1a1a, alt: 0xffa040 },
    hair: { color: 0x6a3a1a, rows: 2, mat: 'cloth' }, headPaint: { mat: 'gold' },
  });
  m.box(0, r.legH, -5, 7, 7, 5, 0x8a5a2a, 'body', { mat: 'leather', back: 'spots', side: 'spots', accent: 0xffd23d });
  m.box(0, r.legH + 7, -5, 3, 2, 3, 0xffd23d, 'body', { mat: 'gold' });
  return m.build(0.071, { gait: { leg: 0.9, arm: 0.7, roll: 0.13, bob: 0.08 } });
}

function wardCrystal(): VoxelModel {
  const m = new Mob();
  m.box(0, 0, 0, 9, 3, 9, 0x4a3a6a, 'body', { mat: 'stone' });
  m.box(0, 3, 0, 5, 16, 5, 0x9a7aff, 'body', { mat: 'crystal', front: 'rune', accent: 0xe0d0ff });
  m.pair(3.5, 3, 0.5, 3, 9, 3, 0xb89aff, 'body', { mat: 'crystal' });
  m.box(0, 19, 0, 3, 4, 3, 0xe0d0ff, 'body', { mat: 'glow' });
  return m.build(0.065);
}

function crate(): VoxelModel {
  const m = new Mob();
  m.box(0, 0, 0, 15, 15, 15, 0x9a6a3a, 'body', { mat: 'wood', front: 'planks', back: 'planks', side: 'planks', top: 'planks', accent: 0x6a4a24 });
  return m.build(0.064);
}

function cinderHound(): VoxelModel {
  const m = new Mob();
  const r = quadMob(m, {
    body: [6, 6, 10], legH: 8, head: [6, 6, 5], snout: [3, 3, 3], fur: 0x3a2a26, legColor: 0x2a1e1a, mat: 'magma',
    face: { style: 'beast', eye: 0xffd040 }, ears: [2, 2, 1], tail: [2, 2, 6], tailColor: 0xff8a2a,
    bodyPaint: { accent: 0xff6a1a }, headPaint: { accent: 0xff6a1a }, tailPaint: { mat: 'glow' },
  });
  m.box(0, r.bodyTop, -1, 2, 2, 6, 0xff8a2a, 'body', { mat: 'glow' });
  return m.build(PX, { gait: { leg: 0.8, roll: 0.03, bob: 0.06 } });
}

export const ENEMY_MODELS: Record<string, VoxelModel> = {
  // ---------------------------------------------------------------- Blightwood
  rot_zombie: rotZombie(),
  sporeling: sporeling(),
  blight_wolf: blightWolf(),
  thorn_beetle: thornBeetle(),
  spore_spitter: sporeSpitter(),
  dusk_moth: duskMoth(),
  bloat_toad: bloatToad(),
  sapling_shaman: saplingShaman(),
  // ---------------------------------------------------------------- Gloamhaven
  ghoul: ghoul(),
  plague_rat: plagueRat(),
  crypt_bat: bat(0x3a2a3a, 0x5a3a5a, 0xff4a4a, PX),
  iron_husk: ironHusk(),
  cult_archer: cultArcher(),
  powder_imp: powderImp(),
  bell_cultist: bellCultist(),
  gargoyle: gargoyle(),
  // ---------------------------------------------------------------- Ossuary
  skeleton: skeletonMob(0xe2dccb, 0xff4a2a, 'sword'),
  bone_archer: skeletonMob(0xd2cab2, 0x6affc8, 'bow'),
  wraith: ghost({ robe: 0x4a6a8a, head: 0x5a7a9a, face: { style: 'hood', eye: 0x9affff, alt: 0x0c141c }, flame: 0x6ae8ff }),
  bone_hound: boneHound(),
  crypt_golem: stoneGolem({ stone: 0x5a5662, dark: 0x3a3642, eye: 0x6affc8, accent: 0x6affc8, topper: 0x4a7a3a, scale: PX }),
  necro_acolyte: robedCaster({ skin: 0xc8c8b8, hood: 0x0a2014, robe: 0x1a3a2a, trim: 0x6affc8, face: { style: 'skull', eye: 0x6affc8 }, orb: 0x6affc8, staff: 0x2a2a2a, hoodAsHair: true }),
  // ---------------------------------------------------------------- Emberwaste
  magma_slime: slimeCube({ color: 0x4a2a1e, mat: 'magma', accent: 0xff7a1a, eye: 0xffe04a, size: 14, scale: 0.075 }),
  magma_slimelet: slimeCube({ color: 0x5a3020, mat: 'magma', accent: 0xff8a2a, eye: 0xffe04a, size: 8, scale: 0.068 }),
  fire_imp: imp({ skin: 0xff5a2a, shirt: 0xd83a1a, pants: 0x5a1a0a, eye: 0xffff6a, wings: 0x8a2a1a, orb: 0xffb040, scale: 0.077 }),
  cinder_hound: cinderHound(),
  obsidian_brute: stoneGolem({ stone: 0x2a2430, dark: 0x1a1420, eye: 0xff8a1a, accent: 0xff6a1a, mat: 'magma', scale: PX * 1.15, spikes: 0x3a3440, decal: 'core' }),
  ember_wisp: emberWisp(),
  lava_salamander: salamander(),
  // ---------------------------------------------------------------- Frostveil
  frost_walker: frostWalker(),
  snow_wolf: wolf(0xe8eef6, 0xc8d4e0, 0x3a8aff, 0xf2f6fa, 0xd8e0ea),
  ice_golem: stoneGolem({ stone: 0x8ad0f0, dark: 0x5aa0d0, eye: 0x1a4aff, accent: 0x2a8aff, mat: 'ice', topper: 0xf0f8ff, topperMat: 'snow', spikes: 0xc8f0ff, decal: 'core', scale: PX * 1.15 }),
  frost_mage: frostMage(),
  tusk_calf: tuskCalf(),
  snow_slime: slimeCube({ color: 0xe8f4ff, mat: 'snow', eye: 0x2a4a8a, size: 14, scale: 0.075, cap: 0xffffff }),
  snow_slimelet: slimeCube({ color: 0xf2f8ff, mat: 'snow', eye: 0x2a4a8a, size: 8, scale: 0.068 }),
  frost_bat: bat(0x8ab8d8, 0xc8e8ff, 0x2affff, PX * 0.8),
  // ---------------------------------------------------------------- Aetherfall
  ruin_guard: ruinGuard(),
  gear_spider: gearSpider(),
  stone_sentinel: stoneGolem({ stone: 0xd8d0c0, dark: 0xa89a80, eye: 0x8a6aff, accent: 0x8a6aff, face: 'visor', topper: 0xe8c050, topperMat: 'gold', shield: 0xe8c050, scale: PX * 1.05 }),
  void_eye: voidEye(),
  phantom: ghost({ robe: 0xb8a8e8, head: 0xd8d0ff, face: { style: 'ghost', eye: 0x7a3dff }, crown: 0xe8c050 }),
  rune_drone: runeDrone(),
  arcane_bomber: arcaneBomber(),
  // ---------------------------------------------------------------- special
  shield_crystal: wardCrystal(),
  treasure_sprite: treasureSprite(),
  crate: crate(),
};
