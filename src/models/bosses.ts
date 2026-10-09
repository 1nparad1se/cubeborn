import type { VoxelModel } from '../data/types';
import { biped, Mob, quadMob, treant } from './builders';
import type { BoxPaint } from '../render/creatureSkins';

/**
 * Boss models: big pixel-skinned block creatures with glowing parts (eyes, veins, cores, runes).
 * Authored in pixel units like the enemies (one texel per unit); tagged parts animate
 * (arms raise when casting, wings flap, legs walk, jaws open).
 */

function sporeMother(): VoxelModel {
  const m = new Mob();
  m.pair(4.5, 0, 0, 5, 4, 5, 0xb8a888, 'legR', { mat: 'bark' });
  m.box(0, 3, 0, 13, 17, 13, 0xe8dcc0, 'body', { mat: 'skin', front: 'mouth', accent: 0x9cff4f, face: { style: 'golem', eye: 0xd070ff, dy: -2 } });
  m.pair(8.5, 5, 0, 4, 12, 4, 0xc8b898, 'armL', { mat: 'bark', bands: [[3, 0xa89878, 'bark']] });
  m.box(0, 19, 0, 30, 7, 30, 0xc05ad6, 'head', { mat: 'mush', accent: 0xf8e8ff, side: 'spots' });
  m.box(0, 26, 0, 21, 5, 21, 0xcc66e0, 'head', { mat: 'mush', accent: 0xf8e8ff });
  m.box(0, 31, 0, 11, 3, 11, 0xd878ec, 'head', { mat: 'mush', accent: 0xf8e8ff });
  for (const [x, z] of [[-12, 9], [11, -10], [-9, -12], [12, 8], [0, 13]] as const) m.box(x, 16, z, 3, 3, 3, 0xd8ff6a, 'head', { mat: 'glow' });
  return m.build(0.085);
}

function ratTyrant(): VoxelModel {
  const m = new Mob();
  const r = quadMob(m, {
    body: [16, 12, 20], legH: 9, legW: 5, head: [12, 10, 10], snout: [6, 5, 4], snoutColor: 0x8a6a62, fur: 0x6a5a52, belly: 0x8a7a72,
    face: { style: 'beast', eye: 0xff2a2a }, ears: [4, 4, 1], earColor: 0xd89a9a, tail: [2, 2, 8], tailColor: 0xd89a9a,
    bodyPaint: { side: 'spots', accent: 0x7a6a4a },
  });
  m.box(0, r.bodyTop - 1, 3, 18, 3, 12, 0x8a2a3a, 'body', { mat: 'cloth', side: 'trim', front: 'trim', back: 'trim', accent: 0xe8c050 });
  m.box(0, 15, -18, 1, 1, 8, 0xc88a8a, 'tail', { mat: 'skin' });
  m.box(0, r.headTop, r.headZ, 9, 3, 8, 0xe8c050, 'head', { mat: 'gold', front: 'gem', accent: 0xff3a5a });
  for (const [x, z] of [[-3.5, -3], [3.5, -3], [-3.5, 3], [3.5, 3]] as const) m.box(x, r.headTop + 3, r.headZ + z, 1, 2, 1, 0xe8c050, 'head', { mat: 'gold' });
  return m.build(0.1);
}

function bellwarden(): VoxelModel {
  const m = new Mob();
  const st = 0x6a6f86;
  m.pair(4, 0, 0, 6, 10, 6, 0x5a5f76, 'legR', { mat: 'stone', bands: [[2, 0x44485a, 'stone']] });
  m.box(0, 10, 0, 16, 16, 10, st, 'body', { mat: 'stone', front: 'plate', accent: 0x4a4f66 });
  m.box(0, 25, 1, 12, 10, 10, 0x7a7f96, 'head', { mat: 'stone', face: { style: 'golem', eye: 0xffa040 } });
  m.pair(4.5, 35, 0, 2, 6, 2, 0x4a4f66, 'head', { mat: 'stone' });
  m.pair(19, 20, -3, 22, 2, 14, 0x4a4f66, 'wingL', { mat: 'stone', front: 'claws', accent: 0x3a3e50 });
  m.pair(10.5, 10, 0, 5, 16, 5, st, 'armL', { mat: 'stone', bands: [[4, 0x5a5f76]] });
  m.box(-10.5, 0, 3, 10, 10, 9, 0xc8a050, 'armR', { mat: 'gold', front: 'bands', side: 'bands', accent: 0x8a6a2a });
  m.box(-10.5, 10, 3, 4, 2, 4, 0x8a6a2a, 'armR', { mat: 'gold' });
  return m.build(0.096);
}

function boneColossus(): VoxelModel {
  const m = new Mob();
  const bone = 0xe6dcc0;
  const r = biped(m, {
    head: [12, 12, 12], body: [16, 18, 8], arm: [4, 22, 4], leg: [4, 18, 4], legGap: 4, hand: 0, shoe: 0,
    skin: bone, shirt: 0xd6ccb0, pants: bone, shoes: bone,
    face: { style: 'skull', eye: 0x6affc8 },
    headPaint: { mat: 'bone' }, bodyPaint: { mat: 'bone', front: 'ribs', back: 'ribs', side: 'ribs' }, armPaint: { mat: 'bone' }, legPaint: { mat: 'bone' },
  });
  m.box(0, r.legH - 2, 0, 12, 4, 6, 0xc6bca0, 'body', { mat: 'bone' });
  const sp: BoxPaint = { mat: 'bone', face: { style: 'skull', eye: 0x6affc8 } };
  m.pair(r.armX, r.bodyTop - 1, 0, 7, 6, 7, 0xd6ccb0, 'armL', sp);
  m.box(-r.armX, -2, 7, 4, 4, 16, 0xd8ceb4, 'armR', { mat: 'bone' });
  m.box(-r.armX, -3, 14, 6, 6, 5, 0xc6bca0, 'armR', { mat: 'bone' });
  m.pair(3, r.headTop, 0, 2, 3, 2, bone, 'head', { mat: 'bone' });
  return m.build(0.095);
}

function lich(): VoxelModel {
  const m = new Mob();
  const robe = 0x1a3a2a;
  m.box(0, 0, 0, 12, 10, 10, robe, 'body', { mat: 'cloth', front: 'trim', side: 'rag', back: 'rag', accent: 0xc8a050 });
  m.box(0, 10, 0, 12, 12, 8, 0x24503a, 'body', { mat: 'cloth', front: 'cross', accent: 0x5affc8 });
  m.box(0, 21, 0, 9, 9, 9, 0xd8d0b8, 'head', { mat: 'bone', face: { style: 'skull', eye: 0x5affc8 }, hair: { color: robe, rows: 2, mat: 'cloth' } });
  m.box(0, 30, 0, 10, 2, 10, 0xc8a050, 'head', { mat: 'gold', front: 'gem', accent: 0x5affc8 });
  for (const x of [-3.5, 0, 3.5]) m.box(x, 32, 0, 1, x === 0 ? 4 : 3, 1, x === 0 ? 0x5affc8 : 0xc8a050, 'head', { mat: x === 0 ? 'glow' : 'gold' });
  m.pair(8, 10, 0, 4, 12, 4, 0x24503a, 'armL', { mat: 'cloth', bands: [[3, 0xd8d0b8, 'bone']] });
  m.box(-8, -6, 3, 2, 30, 2, 0x2a2a2a, 'armR', { mat: 'wood' });
  m.box(-8, 24, 3, 5, 5, 5, 0x5affc8, 'armR', { mat: 'glow' });
  m.box(8, 4, 3, 4, 4, 4, 0x5affc8, 'armL', { mat: 'crystal', glow: 0.9 });
  return m.build(0.104);
}

function cinderGolem(): VoxelModel {
  const m = new Mob();
  const rock = 0x3a2828;
  const vein = 0xff4a1a;
  const mg: BoxPaint = { mat: 'magma', accent: vein };
  m.pair(5.5, 0, 0, 8, 12, 8, 0x2e2020, 'legR', mg);
  m.box(0, 12, 0, 20, 17, 13, rock, 'body', { ...mg, front: 'core', accent: 0xffd040 });
  m.box(0, 21, -4, 22, 9, 8, 0x302222, 'body', mg);
  for (const [x, z] of [[-6, -5], [5, -6], [0, -2]] as const) m.box(x, 30, z, 4, 4, 4, 0x1e1418, 'body', { mat: 'stone' });
  m.box(0, 23, 6, 10, 9, 9, 0x4a3434, 'head', { ...mg, face: { style: 'golem', eye: 0xffe04a } });
  m.pair(13.5, 6, 0, 7, 22, 9, rock, 'armL', mg);
  m.pair(13.5, 0, 1, 9, 7, 11, 0x241818, 'armL', { mat: 'stone', front: 'claws', accent: 0xff7a2a });
  m.pair(13.5, 27, 0, 10, 5, 11, 0x302222, 'armL', mg);
  return m.build(0.11);
}

function magmaw(): VoxelModel {
  const m = new Mob();
  const mg: BoxPaint = { mat: 'magma', accent: 0xffc040 };
  m.box(0, 0, -19, 9, 8, 8, 0x5a2210, 'tail', mg);
  m.box(0, 0, -13, 11, 10, 8, 0x6a2a12, 'tail', mg);
  m.box(0, 0, -5, 14, 13, 10, 0x7a3014, 'body', mg);
  m.box(0, 0, 4, 15, 15, 9, 0x8a3618, 'body', { ...mg, side: 'bands' });
  for (const z of [-17, -10, -3, 5]) m.box(0, z < -12 ? 8 : z < -6 ? 10 : 13 + (z > 0 ? 2 : 0), z, 3, 4, 3, 0x2a1a1a, z < -6 ? 'tail' : 'body', { mat: 'stone' });
  m.box(0, 8, 13, 15, 13, 12, 0x9a3c1a, 'head', { ...mg, face: { style: 'golem', eye: 0xffff6a } });
  m.pair(5.5, 21, 10, 2, 6, 2, 0x2a1a1a, 'head', { mat: 'stone' });
  m.box(0, 3, 15, 13, 5, 10, 0xffa040, 'jaw', { mat: 'magma', accent: 0xffe04a, front: 'claws' });
  return m.build(0.1);
}

function frostfang(): VoxelModel {
  const m = new Mob();
  const fur = 0xe6f4ff;
  const r = biped(m, {
    head: [12, 11, 10], body: [20, 18, 12], arm: [7, 22, 8], leg: [8, 10, 8], hand: 6, shoe: 2,
    skin: 0x9ab8d0, headColor: fur, shirt: fur, pants: 0xd0e4f2, shoes: 0x8aa8c0, sleeve: fur,
    face: { style: 'none' }, headPaint: { mat: 'fur' }, bodyPaint: { mat: 'fur', front: 'belly', accent: 0xd0e0ee }, armPaint: { mat: 'fur' }, legPaint: { mat: 'fur' },
    neck: 2,
  });
  m.box(0, r.headY + 1, r.headZ + 5.5, 8, 7, 1, 0x9ab8d0, 'head', { mat: 'skin', face: { style: 'imp', eye: 0x1a3aff } });
  m.box(0, r.bodyTop - 4, -0.5, 22, 5, 14, 0xf2faff, 'body', { mat: 'fur' });
  m.pair(3, r.headTop, 0, 2, 3, 2, 0xf8f0e0, 'head', { mat: 'bone' });
  return m.build(0.098);
}

function glacialMatriarch(): VoxelModel {
  const m = new Mob();
  m.box(0, 0, 0, 14, 12, 10, 0x6ab0e0, 'body', { mat: 'ice', front: 'trim', side: 'rag', back: 'rag', accent: 0xe8f8ff });
  m.box(0, 12, 0, 10, 12, 7, 0x8ad0f0, 'body', { mat: 'cloth', front: 'gem', accent: 0x8af0ff });
  m.box(0, 24, 0, 9, 9, 9, 0xe0f4ff, 'head', { mat: 'skin', face: { style: 'zombie', eye: 0x1a6aff, glow: true }, hair: { color: 0xc8f0ff, rows: 3, mat: 'ice' } });
  for (const [x, h] of [[-3, 5], [0, 7], [3, 5]] as const) m.box(x, 33, 0, 2, h, 2, 0xb0f0ff, 'head', { mat: 'crystal' });
  m.pair(12, 14, -4, 16, 14, 1, 0xb0e8ff, 'wingL', { mat: 'crystal', front: 'bands', accent: 0xe8faff });
  m.pair(6.5, 12, 0, 3, 12, 3, 0x8ad0f0, 'armL', { mat: 'cloth', bands: [[3, 0xe0f4ff, 'skin']] });
  m.box(6.5, 8, 2, 4, 4, 4, 0xd0f8ff, 'armL', { mat: 'crystal', glow: 0.9 });
  return m.build(0.1);
}

function clockworkSentinel(): VoxelModel {
  const m = new Mob();
  const copper = 0xc87a4a;
  m.box(0, 12, 0, 20, 12, 20, copper, 'body', { mat: 'copper', side: 'gear', front: 'plate', accent: 0x8a8a8a });
  m.box(0, 24, 0, 10, 10, 10, 0x8a8a8a, 'body', { mat: 'metal', front: 'core', accent: 0xff3a3a });
  m.box(0, 34, 1, 12, 7, 10, copper, 'head', { mat: 'copper', face: { style: 'visor', eye: 0xff3a3a } });
  m.pair(4, 41, 0, 1, 4, 1, 0x8a8a8a, 'head', { mat: 'metal' });
  m.box(4, 45, 0, 2, 2, 2, 0xff3a3a, 'head', { mat: 'glow' });
  for (let i = 0; i < 4; i++) {
    const z = -7 + i * 4.6;
    const tag = i % 2 ? 'legL' : 'legR';
    m.pair(15, 18, z, 10, 3, 3, 0x8a6a3a, tag, { mat: 'copper' });
    m.pair(19, 0, z, 3, 18, 3, 0x6a5030, tag, { mat: 'copper', bands: [[3, 0x4a4a4a, 'metal']] });
  }
  m.pair(8, 26, 0, 6, 3, 3, 0x8a8a8a, 'armL', { mat: 'metal' });
  return m.build(0.088);
}

function hollowSovereign(): VoxelModel {
  const m = new Mob();
  const v: BoxPaint = { mat: 'void', accent: 0xd0a0ff };
  m.box(0, 0, 0, 18, 10, 12, 0x2a1050, 'body', { ...v, front: 'trim', side: 'rag', back: 'rag', accent: 0xe8c050 });
  m.box(0, 10, 0, 14, 14, 9, 0x3a1a6a, 'body', { ...v, face: { style: 'cyclops', eye: 0xd0a0ff } });
  m.box(0, 24, 0, 10, 10, 10, 0x1a0a30, 'head', { ...v, face: { style: 'hood', eye: 0xd0a0ff, alt: 0x050008 } });
  m.box(0, 34, 0, 12, 2, 12, 0xe8c050, 'head', { mat: 'gold', front: 'gem', accent: 0x7a3dff });
  for (const [x, z] of [[-4.5, -4.5], [4.5, -4.5], [-4.5, 4.5], [4.5, 4.5]] as const) m.box(x, 36, z, 1.5, 3, 1.5, 0xe8c050, 'head', { mat: 'gold' });
  m.box(0, 36, 4.5, 2, 4, 2, 0x7a3dff, 'head', { mat: 'glow' });
  m.pair(20, 14, -4, 26, 18, 1, 0x4a1a8a, 'wingL', { ...v, front: 'claws', accent: 0xb070ff });
  m.pair(9.5, 10, 0, 5, 14, 5, 0x3a1a6a, 'armL', v);
  m.pair(9.5, 6, 1, 5, 4, 5, 0xb070ff, 'armL', { mat: 'glow' });
  return m.build(0.114);
}

/** Boss models. Tagged parts animate (arms raise when casting, wings flap, legs walk). */
export const BOSS_MODELS: Record<string, VoxelModel> = {
  spore_mother: sporeMother(),
  rotroot: treant({ bark: 0x5a3e22, barkDark: 0x4a321a, leaf: 0x3a7a2a, leafLight: 0x4a8a34, glow: 0xc8ff3a, flower: 0x9a4ab0, scale: 0.104 }),
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
