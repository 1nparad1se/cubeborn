import type { VoxBox } from '../data/types';
import { humanoid, model } from './builders';

const H = 0.095;

/** Hero models: each has a unique silhouette (hats, weapons, capes). Head spans y 12..18. */
export const HERO_MODELS = {
  // Bram: stone warden in plate armor with a tower shield and rune blade.
  bram: model(
    humanoid({
      skin: 0xd8a47a, shirt: 0x5c7fa8, pants: 0x3e4f66, shoes: 0x2a2a30, sleeves: 0x7a8ea8, bodyW: 7, eyes: 0x1a2a4a,
      extras: [
        [0, 15.6, 0, 6.6, 3, 6.6, 0x9aa8b8, 'head'],
        [0, 18.6, 0, 1.2, 2.2, 5, 0xd84a3a, 'head'],
        [-4.5, 11, 0, 3, 1.6, 4, 0x9aa8b8, 'armL'],
        [4.5, 11, 0, 3, 1.6, 4, 0x9aa8b8, 'armR'],
        [-6, 5, 0.5, 1, 7, 5, 0x6a5038, 'armL'],
        [-6.4, 6.5, 0.5, 0.4, 4, 3, 0xd8c060, 'armL'],
        [4.5, 6.4, 2.5, 0.8, 0.8, 3, 0x5a3a20, 'armR'],
        [4.5, 6.5, 6.5, 0.8, 0.6, 5.5, 0xbfe0ff, 'armR'],
        [0, 6, 0, 7.2, 1, 3.6, 0x4a3020, 'body'],
      ],
    }), H),
  // Lyra: ash sorceress with a stepped wide hat and flame staff.
  lyra: model(
    humanoid({
      skin: 0xf0c8a0, shirt: 0xb83a2a, pants: 0x8a2a20, shoes: 0x3a1a14, hair: 0xff7a2a, eyes: 0x2a1a0a,
      extras: [
        [0, 1.5, 0, 6.8, 4.5, 3.8, 0xb83a2a, 'body'],
        [0, 18.2, 0, 9, 1, 9, 0x3a2a4a, 'head'],
        [0, 19.2, 0, 5, 2, 5, 0x3a2a4a, 'head'],
        [0, 21.2, -0.5, 3, 2, 3, 0x3a2a4a, 'head'],
        [0.5, 23.2, -1, 1.5, 1.5, 1.5, 0x3a2a4a, 'head'],
        [0, 19.2, 0, 5.2, 0.7, 5.2, 0xffa03a, 'head'],
        [4.5, 2, 2, 0.8, 12, 0.8, 0x6a4a2a, 'armR'],
        [4.5, 14, 2, 1.8, 1.8, 1.8, 0xffb03a, 'armR'],
      ],
    }), H),
  // Kestrel: huntress with hood, cape and longbow.
  kestrel: model(
    humanoid({
      skin: 0xd8b088, shirt: 0x3a7a3a, pants: 0x5a4a32, shoes: 0x3a2a1a, eyes: 0x1a3a1a,
      extras: [
        [0, 11.8, -0.4, 6.8, 6.8, 6.6, 0x2e5e2e, 'head'],
        [0, 18.6, -1.5, 3, 1.5, 3, 0x2e5e2e, 'head'],
        [0, 2.5, -2, 6.4, 9, 0.8, 0x2e5e2e, 'body'],
        [2, 7, -2.6, 1.6, 6, 1.6, 0x7a5a32, 'body'],
        [2, 13, -2.6, 1.2, 1.2, 1.2, 0xe8e0d0, 'body'],
        [-5, 2, 2.5, 0.6, 11, 0.6, 0x8a6a3a, 'armL'],
        [-5, 2, 3, 0.2, 11, 0.2, 0xe8e8e8, 'armL'],
      ],
    }), H),
  // Morwen: bonekeeper in a dark hooded robe with glowing eyes and skull staff.
  morwen: model(
    humanoid({
      skin: 0xc8d0c8, shirt: 0x4a2a6a, pants: 0x3a1a52, shoes: 0x1a1020, eyes: 0x6affc8,
      extras: [
        [0, 1.5, 0, 6.8, 4.5, 3.8, 0x4a2a6a, 'body'],
        [0, 11.8, -0.5, 7, 7.2, 6.6, 0x2a1a3a, 'head'],
        [0, 18.8, -1.5, 3.5, 1.5, 3.5, 0x2a1a3a, 'head'],
        [4.6, 2, 2, 0.8, 13, 0.8, 0x2a2a2a, 'armR'],
        [4.6, 15, 2, 2.4, 2.4, 2.4, 0xe8e2cc, 'armR'],
        [4.0, 15.9, 3.2, 0.6, 0.6, 0.3, 0x6affc8, 'armR'],
        [5.2, 15.9, 3.2, 0.6, 0.6, 0.3, 0x6affc8, 'armR'],
      ],
    }), H),
  // Fizzwick: short alchemist with goggles, apron and flask backpack.
  fizz: model(
    humanoid({
      skin: 0xe8c098, shirt: 0x6a8a3a, pants: 0x4a3a2a, shoes: 0x2a1a10, hair: 0xe8e8e8, legH: 5, bodyH: 5, head: 6, eyes: 0x1a1a1a,
      extras: [
        [0, 5, 1.8, 5, 4.5, 0.4, 0xd8d0b8, 'body'],
        [0, 12, 3.1, 5.4, 1.4, 0.6, 0x5a4a3a, 'head'],
        [-1.3, 12, 3.4, 1.6, 1.4, 0.4, 0x8affd0, 'head'],
        [1.3, 12, 3.4, 1.6, 1.4, 0.4, 0x8affd0, 'head'],
        [0, 5.5, -2.8, 5, 5, 2.2, 0x7a5a3a, 'body'],
        [-1.5, 10.5, -2.8, 1.2, 2, 1.2, 0x9cff4f, 'body'],
        [1.5, 10.5, -2.8, 1.2, 2.4, 1.2, 0xff5aa0, 'body'],
        [4, 4, 2, 1.6, 2, 1.6, 0x9cff4f, 'armR'],
      ],
    }), H),
  // Shen: wind monk, bald with a topknot, orange gi and blue sash.
  shen: model(
    humanoid({
      skin: 0xe0a878, shirt: 0xf0a63a, pants: 0xd88a2a, shoes: 0x5a3a20, sleeves: 0xe0a878, eyes: 0x2a1a0a,
      extras: [
        [0, 18, -1, 2, 2, 2, 0x1a1a1a, 'head'],
        [0, 6, 0, 6.4, 1.2, 3.6, 0x3a5aa8, 'body'],
        [2, 4.5, 1.8, 1, 2.5, 0.4, 0x3a5aa8, 'body'],
        [-4, 6, 0, 2.6, 2.4, 2.6, 0xc8a050, 'armL'],
        [4, 6, 0, 2.6, 2.4, 2.6, 0xc8a050, 'armR'],
        [0, 15.8, 3.05, 4, 0.5, 0.3, 0x5a3a20, 'head'],
      ],
    }), H),
  // Vex: stormcaller with spiky hair, long coat and a lightning rod.
  vex: model(
    humanoid({
      skin: 0xe8c8a8, shirt: 0x2a3a6a, pants: 0x1a2440, shoes: 0x101420, eyes: 0x4ad0ff,
      extras: [
        [0, 18, 0, 6, 1.5, 6, 0x4ad0ff, 'head'],
        [-2, 19.5, 0, 1.5, 2, 1.5, 0x4ad0ff, 'head'],
        [1.5, 19.5, -1, 1.5, 2.5, 1.5, 0x4ad0ff, 'head'],
        [0, 19.5, 1.5, 1.2, 1.5, 1.2, 0x4ad0ff, 'head'],
        [0, 1, -1.8, 6.4, 10, 1, 0x1a2a52, 'body'],
        [4.6, 2, 2, 0.6, 12, 0.6, 0xc0c8d8, 'armR'],
        [4.6, 14, 2, 1.4, 1.4, 1.4, 0xfff27a, 'armR'],
      ],
    }), H),
  // Tink: gearwright with welding goggles and a cog backpack.
  tink: model(
    humanoid({
      skin: 0xd09870, shirt: 0x8a5a2a, pants: 0x4a4a52, shoes: 0x2a2a2a, hair: 0x5a3a1a, legH: 5, bodyH: 5, eyes: 0x1a1a1a,
      extras: [
        [0, 12, 3.1, 5.6, 1.6, 0.6, 0x3a3a3a, 'head'],
        [-1.3, 12, 3.4, 1.8, 1.6, 0.4, 0xffb03a, 'head'],
        [1.3, 12, 3.4, 1.8, 1.6, 0.4, 0xffb03a, 'head'],
        [0, 4, -2.8, 6, 6, 1.6, 0xb08a3a, 'body'],
        [0, 7, -3.7, 3, 3, 0.6, 0x8a8a8a, 'body'],
        [0, 5, 0, 6.4, 1, 3.6, 0x3a2a1a, 'body'],
        [4, 3, 2, 1.2, 3.5, 1.2, 0x9a9aa8, 'armR'],
      ],
    }), H),
  // Aurelia: dawn paladin in gilded armor with a halo and white cape.
  aurelia: model(
    humanoid({
      skin: 0xf0d0b0, shirt: 0xe8c860, pants: 0xc8a840, shoes: 0x8a6a2a, hair: 0xfff0a0, sleeves: 0xf0e0a0, eyes: 0x2a4a8a,
      extras: [
        [0, 2, -2, 6.6, 9.5, 0.8, 0xf8f8ff, 'body'],
        [0, 19.8, 2.5, 6, 0.6, 1, 0xfff4b0, 'head'],
        [-3, 19.8, 0, 1, 0.6, 5, 0xfff4b0, 'head'],
        [3, 19.8, 0, 1, 0.6, 5, 0xfff4b0, 'head'],
        [0, 19.8, -2.5, 6, 0.6, 1, 0xfff4b0, 'head'],
        [-4.5, 11, 0, 3, 1.5, 4, 0xf0d870, 'armL'],
        [4.5, 11, 0, 3, 1.5, 4, 0xf0d870, 'armR'],
        [4.6, 6.6, 3, 0.8, 0.8, 5, 0xc8a050, 'armR'],
        [4.6, 6, 6.5, 2.4, 2.4, 2.4, 0xfff4b0, 'armR'],
      ],
    }), H),
};

const skeletonAlly: VoxBox[] = humanoid({
  skin: 0xe8e2cc, shirt: 0xd8d2bc, pants: 0xc8c2ac, shoes: 0xb8b29c, bodyW: 5, legW: 1.4, armW: 1.4, eyes: 0x6affc8,
  extras: [[0, 7, 1.6, 3.5, 0.5, 0.3, 0x8a8470, 'body'], [3.4, 6.5, 3, 0.6, 0.6, 4, 0x9ab0c8, 'armR']],
});

/** Ally minion models. */
export const ALLY_MODELS = {
  ally_skeleton: model(skeletonAlly, 0.08),
  ally_risen: model(humanoid({ skin: 0x9ac8b0, shirt: 0x5a7a6a, pants: 0x3a5a4a, eyes: 0x6affc8, bodyW: 6 }), 0.08),
  ally_knight: model(
    humanoid({
      skin: 0xe8e2cc, shirt: 0x6a6a7a, pants: 0x4a4a5a, eyes: 0x6affc8, bodyW: 6,
      extras: [[0, 15.6, 0, 6.6, 3, 6.6, 0x7a7a8a, 'head'], [-4.5, 6, 0.5, 1, 6, 4, 0x5a5a6a, 'armL'], [4.5, 6.6, 3.5, 0.8, 0.8, 7, 0xbfe0ff, 'armR']],
    }), 0.09),
};
