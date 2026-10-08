import type { VoxBox, VoxelModel } from '../data/types';
import { flyer, humanoid, model, quad, slime, spider } from './builders';

const S = 0.105;

function skeleton(bone: number, dark: number, eyes: number, extras: VoxBox[] = []): VoxBox[] {
  return humanoid({ skin: bone, shirt: bone, pants: dark, shoes: dark, bodyW: 5, legW: 1.4, armW: 1.4, eyes, extras: [[0, 7, 1.6, 3.6, 0.5, 0.3, dark, 'body'], [0, 9, 1.6, 3.6, 0.5, 0.3, dark, 'body'], ...extras] });
}

function golem(main: number, accent: number, eyes: number, extras: VoxBox[] = []): VoxBox[] {
  return humanoid({ skin: main, shirt: main, pants: accent, shoes: accent, sleeves: main, bodyW: 9, armW: 3.4, legW: 3.4, head: 5, bodyH: 7, eyes, depth: 5, extras });
}

/** Enemy models keyed by enemy id. Each has a distinct silhouette and palette. */
export const ENEMY_MODELS: Record<string, VoxelModel> = {
  // ---------------------------------------------------------------- Blightwood
  rot_zombie: model(humanoid({ skin: 0x7aa05a, shirt: 0x4a5a3a, pants: 0x3a3a52, eyes: 0xff3a3a, hair: 0x2a3a1a, extras: [[2, 13, 3.1, 1.5, 1.5, 0.3, 0x5a7a3a, 'head']] }), S),
  sporeling: model([
    [0, 0, 0, 3, 4, 3, 0xe8dcc0, 'body'],
    [0, 4, 0, 7, 3, 7, 0xb84ad6, 'head'],
    [0, 7, 0, 4, 1.5, 4, 0xb84ad6, 'head'],
    [-1.5, 6, 3.3, 1.2, 1.2, 0.5, 0xf0e0ff, 'head'],
    [2, 5.5, 2, 1.2, 1.2, 1.2, 0xf0e0ff, 'head'],
    [-0.8, 2.4, 1.5, 0.8, 0.8, 0.3, 0x1a1a1a, 'body'],
    [0.8, 2.4, 1.5, 0.8, 0.8, 0.3, 0x1a1a1a, 'body'],
    [-1, 0, 0, 1, 1, 1, 0xc8bca0, 'legL'],
    [1, 0, 0, 1, 1, 1, 0xc8bca0, 'legR'],
  ], 0.12),
  blight_wolf: model(quad({ body: 0x5a5a4a, belly: 0x7a9a4a, head: 0x4a4a3a, eyes: 0xc8ff3a, tail: 0x4a4a3a, extras: [[0, 7, -1, 2, 1, 5, 0x8aff3a, 'body']] }), S),
  thorn_beetle: model([
    [0, 2, 0, 8, 4, 9, 0x3a6a3a, 'body'],
    [0, 6, -0.5, 6, 1.5, 7, 0x4a8a3a, 'body'],
    [-2, 7.5, 0, 1, 2, 1, 0xc8e070, 'body'],
    [2, 7.5, -2, 1, 2.5, 1, 0xc8e070, 'body'],
    [0, 7.5, 2, 1, 2, 1, 0xc8e070, 'body'],
    [0, 2.5, 5.5, 5, 3, 2, 0x2a4a2a, 'head'],
    [-1.5, 3.5, 6.6, 1, 1, 0.3, 0xff5a3a, 'head'],
    [1.5, 3.5, 6.6, 1, 1, 0.3, 0xff5a3a, 'head'],
    [-1.5, 2, 7.5, 0.8, 0.8, 2, 0xd8d070, 'head'],
    [1.5, 2, 7.5, 0.8, 0.8, 2, 0xd8d070, 'head'],
    [-4.5, 0, 2, 2, 2, 1, 0x2a3a2a, 'legL'], [4.5, 0, -2, 2, 2, 1, 0x2a3a2a, 'legL'],
    [4.5, 0, 2, 2, 2, 1, 0x2a3a2a, 'legR'], [-4.5, 0, -2, 2, 2, 1, 0x2a3a2a, 'legR'],
  ], S),
  spore_spitter: model([
    [0, 0, 0, 4, 6, 4, 0x8a7a5a, 'body'],
    [0, 6, 0, 8, 4, 8, 0xd85a3a, 'head'],
    [0, 10, 0, 5, 1.5, 5, 0xd85a3a, 'head'],
    [-2.5, 9, 2.5, 1.5, 1.5, 1.5, 0xf8e8d0, 'head'],
    [2.5, 8, -2, 1.5, 1.5, 1.5, 0xf8e8d0, 'head'],
    [0, 4, 2.2, 2.4, 1.6, 0.5, 0x2a1a1a, 'body'],
    [-1.2, 0, 0, 1.5, 1.5, 1.5, 0x6a5a3a, 'legL'],
    [1.2, 0, 0, 1.5, 1.5, 1.5, 0x6a5a3a, 'legR'],
  ], S),
  dusk_moth: model(flyer(0x8a7a9a, 0xb89ad8, 0xffe04a, 3, 5, [[0, 9, 1.5, 0.4, 2, 0.4, 0x5a4a6a], [-2.5, 7.8, -1, 3, 0.5, 3, 0xe8c0ff, 'wingL'], [2.5, 7.8, -1, 3, 0.5, 3, 0xe8c0ff, 'wingR']]), 0.12),
  bloat_toad: model([
    [0, 0, 0, 8, 6, 8, 0x6a9a3a, 'body'],
    [0, 0, 0.5, 6.5, 3, 7.6, 0xc8d870, 'body'],
    [-2.2, 6, 2, 2.2, 2, 2.2, 0x6a9a3a, 'head'],
    [2.2, 6, 2, 2.2, 2, 2.2, 0x6a9a3a, 'head'],
    [-2.2, 6.6, 3.1, 1.2, 1.2, 0.3, 0x1a1a1a, 'head'],
    [2.2, 6.6, 3.1, 1.2, 1.2, 0.3, 0x1a1a1a, 'head'],
    [-2, 4, -2, 1.5, 1.5, 1.5, 0xa8ff4a, 'body'],
    [2.5, 4.5, -1, 1.2, 1.2, 1.2, 0xa8ff4a, 'body'],
    [-3.5, 0, 3, 2, 1.5, 2.5, 0x5a8a3a, 'legL'],
    [3.5, 0, 3, 2, 1.5, 2.5, 0x5a8a3a, 'legR'],
  ], S),
  sapling_shaman: model(humanoid({ skin: 0x8a6a3a, shirt: 0x6a4a2a, pants: 0x5a3a20, shoes: 0x3a2a14, sleeves: 0x6a4a2a, eyes: 0xb8ff4a, extras: [
    [0, 18, 0, 8, 3, 8, 0x4a9a3a, 'head'], [0, 21, 0, 5, 2, 5, 0x5aaa44, 'head'], [-3, 19, 3, 1.4, 1.4, 1.4, 0xff70b0, 'head'],
    [4.5, 2, 2, 0.8, 13, 0.8, 0x6a4a2a, 'armR'], [4.5, 15, 2, 2, 2, 2, 0xb8ff4a, 'armR'],
  ] }), S),
  // ---------------------------------------------------------------- Gloamhaven
  ghoul: model(humanoid({ skin: 0x9a9ab0, shirt: 0x5a4a5a, pants: 0x3a3040, eyes: 0xffd040, legH: 5, extras: [[0, 9, 2.2, 4, 1, 1, 0x7a7a90, 'body'], [-4, 3, 1.5, 1.5, 1.5, 2, 0x9a9ab0, 'armL'], [4, 3, 1.5, 1.5, 1.5, 2, 0x9a9ab0, 'armR']] }), S),
  plague_rat: model(quad({ body: 0x6a5a52, belly: 0x8a7a72, head: 0x5a4a42, eyes: 0xff3a3a, len: 8, w: 4, h: 3, legH: 1.5, headSize: 3, tail: 0xd89a9a, extras: [[-1.2, 6, 4.5, 1, 1.2, 0.6, 0xd89a9a, 'head'], [1.2, 6, 4.5, 1, 1.2, 0.6, 0xd89a9a, 'head']] }), 0.09),
  crypt_bat: model(flyer(0x3a2a3a, 0x5a3a5a, 0xff4a4a, 3.5, 5, [[-1, 9.5, 0, 0.8, 1.2, 0.6, 0x3a2a3a], [1, 9.5, 0, 0.8, 1.2, 0.6, 0x3a2a3a]]), 0.12),
  iron_husk: model(golem(0x6a6a78, 0x4a4a58, 0xffa040, [[0, 19, 0, 5.4, 1, 5.4, 0x8a8a98, 'head'], [-6.5, 12, 0, 3.6, 2, 5, 0x8a8a98, 'armL'], [6.5, 12, 0, 3.6, 2, 5, 0x8a8a98, 'armR'], [0, 9, 2.8, 2, 4, 0.4, 0xffa040, 'body']]), S),
  cult_archer: model(humanoid({ skin: 0xc0a080, shirt: 0x6a1a2a, pants: 0x3a0a14, shoes: 0x1a0a0a, eyes: 0xff4a4a, extras: [
    [0, 11.8, -0.4, 6.8, 6.8, 6.6, 0x4a0a18, 'head'], [0, 18.6, -1.5, 3, 2.5, 3, 0x4a0a18, 'head'],
    [-5, 2, 2.5, 0.6, 11, 0.6, 0x5a4a3a, 'armL'],
  ] }), S),
  powder_imp: model(humanoid({ skin: 0xd84a3a, shirt: 0xb83a2a, pants: 0x5a2a1a, eyes: 0xffe04a, legH: 4, bodyH: 4, head: 6, extras: [
    [-2.2, 14, 0, 1, 2.5, 1, 0x2a1a1a, 'head'], [2.2, 14, 0, 1, 2.5, 1, 0x2a1a1a, 'head'],
    [0, 3, -3.2, 5, 5, 2.4, 0x3a3a3a, 'body'], [0, 8, -3.2, 0.5, 2, 0.5, 0xffd040, 'body'],
  ] }), S),
  bell_cultist: model(humanoid({ skin: 0xc0a080, shirt: 0x2a2a3a, pants: 0x1a1a2a, eyes: 0xffd040, extras: [
    [0, 1.5, 0, 6.8, 4.5, 3.8, 0x2a2a3a, 'body'], [0, 11.8, -0.5, 7, 7.2, 6.6, 0x1a1a2a, 'head'], [0, 19, -0.5, 2, 3, 2, 0x1a1a2a, 'head'],
    [4.5, 2, 2, 0.8, 12, 0.8, 0x4a3a2a, 'armR'], [4.5, 12, 2, 3, 3, 3, 0xc8a050, 'armR'],
  ] }), S),
  gargoyle: model([
    [0, 3, 0, 6, 6, 5, 0x6a6a72, 'body'],
    [0, 9, 0.5, 5, 4, 5, 0x7a7a82, 'head'],
    [-1.5, 13, 0, 1, 2, 1, 0x4a4a52, 'head'], [1.5, 13, 0, 1, 2, 1, 0x4a4a52, 'head'],
    [-1.2, 11, 3.1, 1, 0.8, 0.3, 0xff6a3a, 'head'], [1.2, 11, 3.1, 1, 0.8, 0.3, 0xff6a3a, 'head'],
    [-6, 7, -1, 6, 1, 5, 0x5a5a62, 'wingL'], [6, 7, -1, 6, 1, 5, 0x5a5a62, 'wingR'],
    [-2, 0, 0.5, 2, 3, 2, 0x5a5a62, 'legL'], [2, 0, 0.5, 2, 3, 2, 0x5a5a62, 'legR'],
    [0, 3, -3.5, 1, 1, 3, 0x5a5a62, 'tail'],
  ], 0.09),
  // ---------------------------------------------------------------- Ossuary
  skeleton: model(skeleton(0xe8e2cc, 0x6a6458, 0xff4a2a, [[3.4, 6.5, 2.5, 0.6, 0.6, 4, 0x9a9488, 'armR']]), S),
  bone_archer: model(skeleton(0xd8d0b8, 0x4a4438, 0x6affc8, [[-4.2, 2, 2.5, 0.6, 11, 0.6, 0x6a5a3a, 'armL'], [0, 18, 0, 6.4, 1.2, 6.4, 0x3a3428, 'head']]), S),
  wraith: model([
    [0, 3, 0, 6, 9, 5, 0x5a7a9a, 'body'],
    [0, 0, 0, 4, 3, 3, 0x4a6a8a, 'body'],
    [0, 12, 0, 6, 6, 6, 0x7a9aba, 'head'],
    [0, 12.5, 3.1, 4.4, 4, 0.3, 0x101820, 'head'],
    [-1.2, 14.5, 3.3, 1, 0.8, 0.3, 0x9affff, 'head'], [1.2, 14.5, 3.3, 1, 0.8, 0.3, 0x9affff, 'head'],
    [-4, 6, 1.5, 2, 6, 2, 0x5a7a9a, 'armL'], [4, 6, 1.5, 2, 6, 2, 0x5a7a9a, 'armR'],
  ], S),
  bone_hound: model(quad({ body: 0xd8d0b8, belly: 0x8a8270, head: 0xe8e0c8, eyes: 0xff4a2a, tail: 0xd8d0b8, extras: [[0, 7, -1, 1, 1.5, 6, 0x8a8270, 'body']] }), S),
  crypt_golem: model(golem(0x5a5662, 0x3a3642, 0x6affc8, [[0, 9, 2.8, 3, 3, 0.5, 0x6affc8, 'body'], [-6.5, 11, 0, 3.6, 3, 5, 0x6a6672, 'armL'], [6.5, 11, 0, 3.6, 3, 5, 0x6a6672, 'armR']]), S),
  necro_acolyte: model(humanoid({ skin: 0xa8b0a8, shirt: 0x1a3a2a, pants: 0x102018, eyes: 0x6affc8, extras: [
    [0, 1.5, 0, 6.8, 4.5, 3.8, 0x1a3a2a, 'body'], [0, 11.8, -0.5, 7, 7.2, 6.6, 0x0a2014, 'head'],
    [4.5, 2, 2, 0.8, 12, 0.8, 0x2a2a2a, 'armR'], [4.5, 14, 2, 2, 2, 2, 0x6affc8, 'armR'],
  ] }), S),
  // ---------------------------------------------------------------- Emberwaste
  magma_slime: model(slime(0xff6a1a, 0x8a2a0a, 0xffe04a, 8, [[0, 6.4, 0, 4, 1.2, 4, 0x3a1a0a, 'body']]), 0.12),
  magma_slimelet: model(slime(0xff8a2a, 0x8a2a0a, 0xffe04a, 6), 0.1),
  fire_imp: model(humanoid({ skin: 0xff5a2a, shirt: 0xd83a1a, pants: 0x5a1a0a, eyes: 0xffff6a, legH: 4, bodyH: 5, extras: [
    [-2.2, 15, 0, 1, 2.5, 1, 0x2a1a1a, 'head'], [2.2, 15, 0, 1, 2.5, 1, 0x2a1a1a, 'head'],
    [0, 4, -3, 1, 1, 4, 0xd83a1a, 'tail'], [-4, 7, -1, 3, 4, 0.6, 0x8a2a1a, 'wingL'], [4, 7, -1, 3, 4, 0.6, 0x8a2a1a, 'wingR'],
    [4, 3.5, 2, 1.6, 1.6, 1.6, 0xffd040, 'armR'],
  ] }), S),
  cinder_hound: model(quad({ body: 0x3a2a26, belly: 0xff6a1a, head: 0x2a1a16, eyes: 0xffd040, tail: 0xff8a2a, extras: [[0, 7, -2, 1.5, 1.5, 4, 0xff6a1a, 'body'], [0, 7.5, 4, 1, 1.5, 1, 0xff8a2a, 'head']] }), S),
  obsidian_brute: model(golem(0x2a2430, 0x1a1420, 0xff6a1a, [[0, 7, 2.8, 4, 6, 0.4, 0xff6a1a, 'body'], [-6.5, 12, 0, 3, 3, 4, 0xff7a2a, 'armL'], [6.5, 12, 0, 3, 3, 4, 0xff7a2a, 'armR'], [0, 18, 0, 3, 2, 3, 0x3a3440, 'head']]), S),
  ember_wisp: model([
    [0, 5, 0, 4, 4, 4, 0xff7a1a, 'body'], [0, 9, -0.5, 2.4, 2.4, 2.4, 0xffb03a, 'body'], [0.5, 11.4, -1, 1.2, 1.2, 1.2, 0xffe04a, 'body'],
    [-0.9, 6.6, 2.1, 0.8, 0.8, 0.3, 0x2a0a0a], [0.9, 6.6, 2.1, 0.8, 0.8, 0.3, 0x2a0a0a],
  ], 0.12),
  lava_salamander: model(quad({ body: 0xd84a1a, belly: 0xffc040, head: 0xc83a14, eyes: 0x1a1a1a, len: 11, w: 4, h: 3, legH: 2, headSize: 4, tail: 0xd84a1a, extras: [[0, 5, -7, 1.5, 1.5, 3, 0xd84a1a, 'tail'], [0, 5.2, 0, 1.4, 0.8, 9, 0xffd040, 'body']] }), S),
  // ---------------------------------------------------------------- Frostveil
  frost_walker: model(humanoid({ skin: 0x9ad0e8, shirt: 0x5a7a9a, pants: 0x3a5a7a, eyes: 0x2affff, hair: 0xe0f8ff, extras: [[-4, 11, 0, 2.5, 2, 3.5, 0xc8f0ff, 'armL'], [4, 11, 0, 2.5, 2, 3.5, 0xc8f0ff, 'armR']] }), S),
  snow_wolf: model(quad({ body: 0xe8eef6, belly: 0xc8d4e0, head: 0xf2f6fa, eyes: 0x3a8aff, tail: 0xe8eef6, extras: [[-1.2, 8.5, 6, 1, 1.5, 0.8, 0xc8d4e0, 'head'], [1.2, 8.5, 6, 1, 1.5, 0.8, 0xc8d4e0, 'head']] }), S),
  ice_golem: model(golem(0x8ad0f0, 0x5aa0d0, 0x1a4aff, [[0, 19, 0, 3, 3, 3, 0xc8f0ff, 'head'], [-7, 12, 0, 2.5, 4, 2.5, 0xc8f0ff, 'armL'], [7, 12, 0, 2.5, 4, 2.5, 0xc8f0ff, 'armR'], [2, 14, -2, 2, 4, 2, 0xc8f0ff, 'body']]), S),
  frost_mage: model(humanoid({ skin: 0xc8e0f0, shirt: 0x3a6aa8, pants: 0x2a4a8a, eyes: 0x2affff, extras: [
    [0, 1.5, 0, 6.8, 4.5, 3.8, 0x3a6aa8, 'body'], [0, 18, 0, 7, 1, 7, 0xe8f8ff, 'head'], [0, 19, 0, 4, 3, 4, 0x3a6aa8, 'head'],
    [4.5, 2, 2, 0.8, 12, 0.8, 0xc8f0ff, 'armR'], [4.5, 14, 2, 2, 3, 2, 0x8af0ff, 'armR'],
  ] }), S),
  tusk_calf: model(quad({ body: 0x7a5a42, belly: 0x5a4232, head: 0x6a4a36, eyes: 0x1a1a1a, len: 10, w: 7, h: 6, legH: 3, headSize: 5, extras: [[-2, 4, 9, 1, 1, 3, 0xf8f0e0, 'head'], [2, 4, 9, 1, 1, 3, 0xf8f0e0, 'head'], [0, 9, 0, 6, 1.5, 9, 0xe8eef6, 'body']] }), S),
  snow_slime: model(slime(0xe8f4ff, 0x9ac8e8, 0x2a4a8a, 8, [[0, 6.4, 0, 3, 2, 3, 0xffffff, 'body']]), 0.12),
  snow_slimelet: model(slime(0xf2f8ff, 0xa8d0e8, 0x2a4a8a, 6), 0.1),
  frost_bat: model(flyer(0x8ab8d8, 0xc8e8ff, 0x2affff, 3.5, 5), 0.1),
  // ---------------------------------------------------------------- Aetherfall
  ruin_guard: model(humanoid({ skin: 0xc8b090, shirt: 0xd8c8a0, pants: 0xa8987a, eyes: 0x8a6aff, sleeves: 0xc8b090, extras: [
    [0, 15.6, 0, 6.6, 3, 6.6, 0xe8c050, 'head'], [0, 18.6, -1, 1, 2, 4, 0x8a6aff, 'head'],
    [4.5, 2, 2.5, 0.8, 14, 0.8, 0xa88a50, 'armR'], [4.5, 16, 2.5, 1.6, 2, 1.6, 0xe8e0d0, 'armR'],
  ] }), S),
  gear_spider: model(spider(0xb08a3a, 0x8a6a2a, 0x6affff, 5, [[0, 6, -1, 3, 1, 3, 0x8a8a8a, 'body']]), 0.12),
  stone_sentinel: model(golem(0xd8d0c0, 0xa89a80, 0x8a6aff, [[0, 7, 2.8, 3, 3, 0.4, 0x8a6aff, 'body'], [0, 18, 0, 6, 1.5, 6, 0xe8c050, 'head'], [-7, 4, 0, 1.6, 9, 4, 0xe8c050, 'armL']]), S),
  void_eye: model([
    [0, 6, 0, 6, 6, 6, 0x2a1a4a, 'body'],
    [0, 7, 3, 4, 4, 0.4, 0xf0f0ff, 'body'],
    [0, 8, 3.2, 2, 2, 0.3, 0xb04aff, 'body'],
    [-4, 7, 0, 2, 1, 1, 0x3a2a5a, 'wingL'], [4, 7, 0, 2, 1, 1, 0x3a2a5a, 'wingR'],
    [0, 12, 0, 1, 2, 1, 0x3a2a5a, 'body'], [0, 3, 0, 1, 3, 1, 0x3a2a5a, 'body'],
  ], 0.12),
  phantom: model([
    [0, 3, 0, 6, 9, 5, 0xb8a8e8, 'body'], [0, 0, 0, 3, 3, 2, 0x9a8ad8, 'body'],
    [0, 12, 0, 6, 6, 6, 0xd8d0ff, 'head'], [0, 12.8, 3.1, 4.4, 1.2, 0.3, 0x3a1a6a, 'head'],
    [0, 18, 0, 6.8, 1, 6.8, 0xe8c050, 'head'],
    [-4, 7, 1.5, 2, 5, 2, 0xb8a8e8, 'armL'], [4, 7, 1.5, 2, 5, 2, 0xb8a8e8, 'armR'],
  ], S),
  rune_drone: model([
    [0, 6, 0, 5, 3, 5, 0xc8a050, 'body'], [0, 9, 0, 3, 1, 3, 0x8a6aff, 'body'], [0, 5, 2.6, 2, 1.4, 0.4, 0x6affff, 'body'],
    [-5, 7, 0, 4, 0.6, 2, 0x9a8a6a, 'wingL'], [5, 7, 0, 4, 0.6, 2, 0x9a8a6a, 'wingR'],
  ], 0.12),
  arcane_bomber: model(humanoid({ skin: 0x8a6aff, shirt: 0x5a3ab8, pants: 0x3a2a7a, eyes: 0xffffff, legH: 5, bodyH: 5, extras: [[0, 4, -3.2, 5, 5, 2.4, 0xb08aff, 'body'], [0, 9, -3.2, 2, 2, 2, 0xf0e0ff, 'body']] }), S),
  // ---------------------------------------------------------------- special
  shield_crystal: model([
    [0, 0, 0, 5, 1.5, 5, 0x4a3a6a],
    [0, 1.5, 0, 3, 9, 3, 0x9a7aff],
    [0, 3, 0, 4, 5, 4, 0xb89aff],
    [0, 10.5, 0, 1.5, 2, 1.5, 0xe0d0ff],
  ], 0.12),
  treasure_sprite: model(humanoid({ skin: 0xffd23d, shirt: 0xc89a2a, pants: 0x8a6a1a, eyes: 0x1a1a1a, legH: 4, bodyH: 4, head: 6, extras: [[0, 3, -3, 6, 6, 3, 0x8a5a2a, 'body'], [0, 9, -3, 4, 1.5, 3, 0xffd23d, 'body'], [0, 14, 0, 7, 1, 7, 0x6a3a1a, 'head']] }), 0.09),
  crate: model([
    [0, 0, 0, 8, 8, 8, 0x9a6a3a],
    [0, 0, 0, 8.4, 1, 8.4, 0x6a4a24],
    [0, 7, 0, 8.4, 1, 8.4, 0x6a4a24],
    [0, 1, 4.1, 1, 6, 0.4, 0x6a4a24],
    [0, 3.5, 4.1, 7, 1, 0.4, 0x6a4a24],
  ], 0.12),
};
