import type { VoxelModel } from '../data/types';
import { humanoid, model, quad, spider } from './builders';

/** Boss models. Tagged parts animate (arms raise when casting, wings flap, legs walk). */
export const BOSS_MODELS: Record<string, VoxelModel> = {
  spore_mother: model([
    [0, 0, 0, 7, 9, 7, 0xe8dcc0, 'body'],
    [-2, 0, 2, 2, 2, 2, 0xd8ccb0, 'legL'], [2, 0, -2, 2, 2, 2, 0xd8ccb0, 'legR'],
    [0, 9, 0, 16, 5, 16, 0xc05ad6, 'head'],
    [0, 14, 0, 11, 3, 11, 0xc05ad6, 'head'],
    [0, 17, 0, 6, 2, 6, 0xd070e6, 'head'],
    [-5, 13, 5, 2.5, 2.5, 2.5, 0xf8e8ff, 'head'], [4, 15, -3, 2.5, 2.5, 2.5, 0xf8e8ff, 'head'], [6, 12, 3, 2, 2, 2, 0xf8e8ff, 'head'], [-3, 16, -4, 2, 2, 2, 0xf8e8ff, 'head'],
    [-1.6, 6, 3.6, 1.6, 1.6, 0.4, 0x1a0a2a, 'body'], [1.6, 6, 3.6, 1.6, 1.6, 0.4, 0x1a0a2a, 'body'],
    [0, 3.5, 3.6, 3, 1.2, 0.4, 0x1a0a2a, 'body'],
    [-5, 4, 0, 3, 1.5, 1.5, 0xd8ccb0, 'armL'], [5, 4, 0, 3, 1.5, 1.5, 0xd8ccb0, 'armR'],
  ], 0.16),
  rotroot: model(humanoid({
    skin: 0x6a4a2a, shirt: 0x5a3e22, pants: 0x4a321a, shoes: 0x3a2a14, sleeves: 0x5a3e22, bodyW: 10, bodyH: 9, legH: 7, head: 7, armW: 3.5, legW: 4, depth: 6, eyes: 0xc8ff3a,
    extras: [
      [0, 23, 0, 14, 4, 12, 0x3a7a2a, 'head'], [0, 27, 0, 9, 3, 8, 0x4a8a34, 'head'], [-5, 25, 3, 3, 3, 3, 0x7a3a8a, 'head'],
      [-7.5, -2, 0, 3, 3, 3, 0x5a3e22, 'armL'], [7.5, -2, 0, 3, 3, 3, 0x5a3e22, 'armR'],
      [-8.5, -3, 1, 1, 2, 1, 0x4a321a, 'armL'], [8.5, -3, 1, 1, 2, 1, 0x4a321a, 'armR'],
      [3, 12, 3.2, 2, 3, 0.6, 0x3a7a2a, 'body'], [-3, 10, 3.2, 1.5, 1.5, 0.6, 0x9aff6a, 'body'],
    ],
  }), 0.17),
  rat_tyrant: model(quad({ body: 0x6a5a52, belly: 0x8a7a72, head: 0x5a4a42, eyes: 0xff2a2a, len: 14, w: 9, h: 7, legH: 4, headSize: 7, tail: 0xd89a9a, extras: [
    [0, 15, 7, 6, 2, 3, 0xe8c050, 'head'], [-2, 17, 7, 1, 2, 1, 0xe8c050, 'head'], [2, 17, 7, 1, 2, 1, 0xe8c050, 'head'], [0, 17.5, 7, 1, 2.5, 1, 0xff3a5a, 'head'],
    [-2.5, 15, 10, 1.5, 2, 0.8, 0xd89a9a, 'head'], [2.5, 15, 10, 1.5, 2, 0.8, 0xd89a9a, 'head'],
    [0, 11, 0, 7, 1, 8, 0x8a2a3a, 'body'], [0, 8, -10, 1.2, 1.2, 6, 0xd89a9a, 'tail'],
  ] }), 0.16),
  bellwarden: model([
    [0, 6, 0, 10, 10, 8, 0x6a6f86, 'body'],
    [0, 16, 1, 8, 7, 7, 0x7a7f96, 'head'],
    [-3, 23, 0, 2, 4, 2, 0x4a4f66, 'head'], [3, 23, 0, 2, 4, 2, 0x4a4f66, 'head'],
    [-2, 19, 4.6, 1.6, 1.2, 0.4, 0xffa040, 'head'], [2, 19, 4.6, 1.6, 1.2, 0.4, 0xffa040, 'head'],
    [-12, 13, -2, 13, 1.5, 9, 0x4a4f66, 'wingL'], [12, 13, -2, 13, 1.5, 9, 0x4a4f66, 'wingR'],
    [-6.5, 4, 2, 3, 9, 3, 0x6a6f86, 'armL'], [6.5, 4, 2, 3, 9, 3, 0x6a6f86, 'armR'],
    // the bell it carries
    [0, 0, 6, 6, 6, 5, 0xc8a050, 'armR'], [0, 6, 6, 3, 1.5, 3, 0x8a6a2a, 'armR'],
    [-2.5, 0, 0, 3, 6, 3, 0x5a5f76, 'legL'], [2.5, 0, 0, 3, 6, 3, 0x5a5f76, 'legR'],
  ], 0.15),
  bone_colossus: model(humanoid({
    skin: 0xe6dcc0, shirt: 0xd6ccb0, pants: 0xb6ac90, shoes: 0x9a9070, sleeves: 0xe6dcc0, bodyW: 11, bodyH: 9, legH: 8, head: 7, armW: 3, legW: 3, depth: 5, eyes: 0x6affc8,
    extras: [
      [0, 10, 2.8, 9, 1, 0.5, 0x8a8270, 'body'], [0, 13, 2.8, 9, 1, 0.5, 0x8a8270, 'body'], [0, 16, 2.8, 9, 1, 0.5, 0x8a8270, 'body'],
      [-8, 15, 0, 4, 3, 5, 0xc6bca0, 'armL'], [8, 15, 0, 4, 3, 5, 0xc6bca0, 'armR'],
      [0, 24, 0, 8, 1.5, 8, 0x8a8270, 'head'], [-3, 25.5, 0, 1.5, 3, 1.5, 0xe6dcc0, 'head'], [3, 25.5, 0, 1.5, 3, 1.5, 0xe6dcc0, 'head'],
      [7.5, 4, 3, 2, 2, 8, 0x8a8a9a, 'armR'],
    ],
  }), 0.16),
  lich_vharos: model([
    [0, 0, 0, 9, 4, 7, 0x1a3a2a, 'body'],
    [0, 4, 0, 8, 10, 6, 0x24503a, 'body'],
    [0, 14, 0, 6, 6, 6, 0xd8d0b8, 'head'],
    [0, 14.5, 3.05, 4.5, 2, 0.3, 0x0a1a10, 'head'],
    [-1.3, 16.5, 3.1, 1.2, 1, 0.3, 0x5affc8, 'head'], [1.3, 16.5, 3.1, 1.2, 1, 0.3, 0x5affc8, 'head'],
    [0, 20, 0, 7, 1.5, 7, 0xc8a050, 'head'], [-2.5, 21.5, 0, 1.2, 3, 1.2, 0xc8a050, 'head'], [2.5, 21.5, 0, 1.2, 3, 1.2, 0xc8a050, 'head'], [0, 21.5, 2.5, 1.2, 4, 1.2, 0x5affc8, 'head'],
    [-5.5, 7, 0, 3, 7, 3, 0x24503a, 'armL'], [5.5, 7, 0, 3, 7, 3, 0x24503a, 'armR'],
    [5.5, 0, 2, 1, 18, 1, 0x2a2a2a, 'armR'], [5.5, 18, 2, 3, 3, 3, 0x5affc8, 'armR'],
    [-5.5, 6, 2, 2.4, 2.4, 2.4, 0x5affc8, 'armL'],
  ], 0.15),
  cinder_golem: model(humanoid({
    skin: 0x4a3434, shirt: 0x3a2828, pants: 0x2a1c1c, shoes: 0x1a1010, sleeves: 0x4a3434, bodyW: 11, bodyH: 9, legH: 6, head: 6, armW: 4, legW: 4.5, depth: 7, eyes: 0xffe04a,
    extras: [
      [0, 8, 3.6, 5, 5, 0.6, 0xff6a1a, 'body'], [0, 9.5, 3.9, 3, 2, 0.4, 0xffe04a, 'body'],
      [-8, 2, 0, 5, 5, 5, 0x3a2828, 'armL'], [8, 2, 0, 5, 5, 5, 0x3a2828, 'armR'],
      [-8, 4, 2.6, 3, 1, 0.4, 0xff6a1a, 'armL'], [8, 4, 2.6, 3, 1, 0.4, 0xff6a1a, 'armR'],
      [-3, 21, -1, 2, 4, 2, 0x2a1c1c, 'head'], [3, 21, -1, 2, 4, 2, 0x2a1c1c, 'head'], [-3, 25, -1, 2, 2, 2, 0x8a8a8a, 'head'],
    ],
  }), 0.16),
  magmaw: model([
    [0, 0, -12, 7, 6, 7, 0x8a2a0a, 'tail'], [0, 0, -6, 9, 8, 8, 0xc83a0a, 'body'], [0, 0, 1, 10, 10, 8, 0xd84a1a, 'body'],
    [0, 2, 1, 10.5, 2, 8.5, 0xffc040, 'body'],
    [0, 8, 6, 10, 8, 9, 0xd84a1a, 'head'],
    [0, 6, 10.5, 9, 3, 2, 0xffe04a, 'jaw'],
    [-3, 13, 9.5, 2, 1.5, 0.5, 0xffff6a, 'head'], [3, 13, 9.5, 2, 1.5, 0.5, 0xffff6a, 'head'],
    [-4, 16, 4, 1.5, 4, 1.5, 0x2a1a1a, 'head'], [4, 16, 4, 1.5, 4, 1.5, 0x2a1a1a, 'head'],
    [0, 10, -3, 2, 3, 8, 0x2a1a1a, 'body'], [0, 6, -10, 2, 3, 4, 0x2a1a1a, 'tail'],
  ], 0.17),
  frostfang: model(humanoid({
    skin: 0x9ab8d0, shirt: 0xe6f4ff, pants: 0xd0e4f2, shoes: 0x8aa8c0, sleeves: 0xe6f4ff, bodyW: 11, bodyH: 9, legH: 6, head: 7, armW: 4, legW: 4.5, depth: 7, eyes: 0x1a3aff,
    extras: [
      [0, 15, 0, 13, 3, 9, 0xf2faff, 'body'],
      [-8, 1, 0, 4.5, 4, 4.5, 0xe6f4ff, 'armL'], [8, 1, 0, 4.5, 4, 4.5, 0xe6f4ff, 'armR'],
      [-2, 17, 4, 1.2, 2.5, 1.2, 0xf8f0e0, 'head'], [2, 17, 4, 1.2, 2.5, 1.2, 0xf8f0e0, 'head'],
      [0, 22, 0, 8, 2, 8, 0xf2faff, 'head'],
    ],
  }), 0.16),
  glacial_matriarch: model([
    [0, 0, 0, 10, 6, 8, 0x6ab0e0, 'body'], [0, 6, 0, 8, 8, 6, 0x8ad0f0, 'body'],
    [0, 14, 0, 6, 6, 6, 0xe0f4ff, 'head'],
    [-1.3, 16.5, 3.05, 1.2, 1, 0.3, 0x1a6aff, 'head'], [1.3, 16.5, 3.05, 1.2, 1, 0.3, 0x1a6aff, 'head'],
    [-3, 20, 0, 1.5, 5, 1.5, 0xb0f0ff, 'head'], [0, 20, 0, 1.5, 7, 1.5, 0xd0f8ff, 'head'], [3, 20, 0, 1.5, 5, 1.5, 0xb0f0ff, 'head'],
    [-10, 9, -2, 9, 8, 0.8, 0xb0e8ff, 'wingL'], [10, 9, -2, 9, 8, 0.8, 0xb0e8ff, 'wingR'],
    [-5.5, 7, 0, 3, 7, 3, 0x8ad0f0, 'armL'], [5.5, 7, 0, 3, 7, 3, 0x8ad0f0, 'armR'],
    [5.5, 4, 3, 2, 4, 2, 0xd0f8ff, 'armR'], [-5.5, 4, 3, 2, 4, 2, 0xd0f8ff, 'armL'],
  ], 0.15),
  clockwork_sentinel: model(spider(0xc9a050, 0x8a6a2a, 0x6affff, 12, [
    [0, 11, -1, 8, 4, 8, 0xa88a40, 'body'], [0, 15, -1, 4, 6, 4, 0x8a8a8a, 'body'], [0, 21, -1, 6, 3, 6, 0xc9a050, 'head'],
    [0, 21.5, 2.1, 3, 2, 0.4, 0xff3a3a, 'head'], [-6, 13, -1, 4, 1, 1, 0x8a8a8a, 'armL'], [6, 13, -1, 4, 1, 1, 0x8a8a8a, 'armR'],
  ]), 0.15),
  hollow_sovereign: model([
    [0, 0, 0, 12, 6, 9, 0x2a1050, 'body'], [0, 6, 0, 10, 10, 7, 0x3a1a6a, 'body'],
    [0, 10, 3.6, 4, 4, 0.4, 0x0a0014, 'body'], [0, 11, 3.8, 2, 2, 0.3, 0xffffff, 'body'],
    [0, 16, 0, 7, 7, 7, 0x1a0a30, 'head'],
    [0, 17, 3.55, 5, 3, 0.3, 0x000000, 'head'], [-1.4, 18.5, 3.7, 1.2, 0.8, 0.3, 0xd0a0ff, 'head'], [1.4, 18.5, 3.7, 1.2, 0.8, 0.3, 0xd0a0ff, 'head'],
    [0, 23, 0, 8, 1.5, 8, 0xe8c050, 'head'], [-3, 24.5, 0, 1.2, 3, 1.2, 0xe8c050, 'head'], [3, 24.5, 0, 1.2, 3, 1.2, 0xe8c050, 'head'], [0, 24.5, -3, 1.2, 4, 1.2, 0xe8c050, 'head'], [0, 24.5, 3, 1.2, 4, 1.2, 0x7a3dff, 'head'],
    [-14, 12, -3, 14, 10, 0.8, 0x4a1a8a, 'wingL'], [14, 12, -3, 14, 10, 0.8, 0x4a1a8a, 'wingR'],
    [-7, 8, 0, 3.5, 8, 3.5, 0x3a1a6a, 'armL'], [7, 8, 0, 3.5, 8, 3.5, 0x3a1a6a, 'armR'],
    [-7, 6, 2.5, 3, 3, 3, 0xb070ff, 'armL'], [7, 6, 2.5, 3, 3, 3, 0xb070ff, 'armR'],
  ], 0.16),
};

