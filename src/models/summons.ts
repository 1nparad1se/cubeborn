import type { VoxBox, VoxelModel } from '../data/types';
import { mirror } from './builders';

/**
 * Voxel models of summoned creatures: the Summoner's spirits (wolf, golem, wisp, ancient,
 * serpent, drake) and the Ranger's hawk. Same format as the enemy models (boxes: x, y, z =
 * centre x/z and BOTTOM y, w, h, d, colour, tag; +z is the front). Tags drive animation:
 * legL/legR/armL/armR swing for the two walk frames, wingL/wingR flap, tail sways, and 'jaw'
 * opens in frame 1 / while attacking. Colours that are saturated and bright glow.
 */

type B = VoxBox;
const T = (x: number, y: number, z: number, w: number, h: number, d: number, c: number, tag?: string): B => (tag ? [x, y, z, w, h, d, c, tag] : [x, y, z, w, h, d, c]);
/** Mirror only across x for untagged/body parts (mirror() also swaps limb tags). */
const sym = (bs: B[]): B[] => mirror(bs);

// ---------------------------------------------------------------- Spirit Wolf (summoner)
function wolf(): VoxelModel {
  const fur = 0xcfe8e2;
  const furD = 0x8fbab4;
  const furL = 0xf2fbf8;
  const spirit = 0x5af0d8;
  const eye = 0x9afff0;
  const dark = 0x2a3a40;
  const legs: B[] = [
    // front legs (paw + leg), back legs with a hock
    T(1.4, 0, 3.4, 1.6, 3.6, 1.6, furD, 'legL'), T(1.4, 0, 3.8, 1.8, 0.7, 2.2, furL, 'legL'),
    T(1.5, 0, -3.4, 1.7, 2.6, 1.7, furD, 'legR'), T(1.5, 2.2, -3.6, 2.0, 2.0, 2.4, fur, 'legR'), T(1.5, 0, -3.0, 1.9, 0.7, 2.2, furL, 'legR'),
  ];
  const boxes: B[] = [
    ...sym(legs),
    // body: deep chest, lean belly, raised shoulders
    T(0, 3.2, 0.2, 4.4, 3.6, 8.6, fur, 'body'),
    T(0, 3.0, 2.6, 4.8, 4.4, 3.6, furL, 'body'),
    T(0, 2.9, -0.8, 3.4, 1.0, 5.6, furD, 'body'),
    T(0, 6.4, 1.8, 3.6, 1.4, 4.0, fur, 'body'),
    // spirit mane: glowing crest down the spine
    T(0, 7.4, 2.8, 1.0, 1.4, 1.2, spirit, 'body'), T(0, 7.0, 1.2, 0.9, 1.2, 1.2, spirit, 'body'), T(0, 6.7, -0.4, 0.8, 1.0, 1.2, spirit, 'body'), T(0, 6.4, -2.0, 0.7, 0.8, 1.2, spirit, 'body'),
    ...sym([T(2.3, 4.4, 2.6, 0.5, 2.2, 2.6, furL, 'body'), T(2.25, 4.6, -1.8, 0.2, 0.6, 2.6, spirit, 'body')]),
    // head: skull, snout, ears, eyes, nose; the jaw opens
    T(0, 5.6, 5.2, 3.4, 3.0, 3.0, fur, 'head'),
    T(0, 5.7, 7.3, 2.0, 1.4, 2.0, furL, 'head'),
    T(0, 6.4, 8.3, 0.9, 0.7, 0.6, dark, 'head'),
    ...sym([T(1.0, 8.4, 4.6, 1.0, 1.8, 1.0, fur, 'head'), T(1.0, 8.6, 4.95, 0.5, 1.2, 0.3, spirit, 'head'), T(1.0, 6.8, 6.65, 0.7, 0.6, 0.3, eye, 'head')]),
    T(0, 7.4, 6.6, 2.2, 0.4, 0.3, furD, 'head'),
    T(0, 4.8, 6.9, 1.8, 0.9, 2.2, furD, 'jaw'),
    ...sym([T(0.6, 5.6, 7.9, 0.3, 0.5, 0.3, 0xffffff, 'jaw')]),
    // brush tail with a glowing tip
    T(0, 5.2, -5.4, 1.8, 1.8, 3.0, fur, 'tail'),
    T(0, 5.6, -7.4, 1.6, 1.6, 1.6, spirit, 'tail'),
  ];
  return { boxes, scale: 0.1 };
}

// ---------------------------------------------------------------- Stone Golem (summoner)
function golem(): VoxelModel {
  const stone = 0x8a8478;
  const stoneD = 0x5e5a52;
  const stoneL = 0xaaa494;
  const moss = 0x5a9a48;
  const core = 0x5af0c8;
  const rune = 0x8affe0;
  const boxes: B[] = [
    // stumpy legs and big feet
    ...sym([T(2.6, 0, 0.4, 3.6, 1.6, 4.6, stoneD, 'legL'), T(2.6, 1.4, 0, 3.2, 4.0, 3.4, stone, 'legL'), T(2.6, 3.4, 1.75, 1.6, 1.0, 0.3, rune, 'legL')]),
    // pelvis, hulking torso, shoulder boulders
    T(0, 5.0, 0, 7.4, 2.4, 5.0, stoneD, 'body'),
    T(0, 7.0, 0.2, 10.0, 6.4, 6.4, stone, 'body'),
    T(0, 13.0, -0.4, 8.0, 1.6, 5.4, stoneL, 'body'),
    T(0, 8.6, 3.4, 3.0, 3.0, 0.8, core, 'body'),
    T(0, 9.1, 3.75, 1.6, 2.0, 0.4, 0xd8fff4, 'body'),
    ...sym([T(2.6, 8.0, 3.45, 1.4, 0.6, 0.3, rune, 'body'), T(2.8, 10.4, 3.45, 0.6, 1.6, 0.3, rune, 'body')]),
    T(0, 14.4, -1.6, 8.6, 1.0, 3.4, moss, 'body'),
    T(-2.6, 14.4, 1.0, 2.6, 0.8, 2.4, moss, 'body'),
    T(2.0, 7.0, -3.3, 4.0, 3.0, 0.6, moss, 'body'),
    // head sunk between the shoulders, glowing eyes and a crystal shard
    T(0, 13.4, 1.6, 4.0, 3.4, 3.8, stoneL, 'head'),
    T(0, 15.6, 1.4, 3.2, 1.0, 3.2, stone, 'head'),
    ...sym([T(0.9, 14.6, 3.55, 1.0, 0.6, 0.3, core, 'head')]),
    T(0, 16.4, 0.6, 1.2, 2.4, 1.2, rune, 'head'),
    // arms: boulder shoulders, thick forearms, huge fists
    ...sym([
      T(6.4, 11.4, 0, 4.0, 3.6, 4.4, stoneL, 'armL'),
      T(6.6, 6.4, 0.2, 3.0, 5.2, 3.2, stone, 'armL'),
      T(6.8, 1.8, 0.4, 4.2, 4.8, 4.4, stoneD, 'armL'),
      T(6.8, 6.6, 1.85, 1.2, 1.2, 0.3, rune, 'armL'),
      T(6.4, 15.0, -0.6, 2.6, 1.0, 3.0, moss, 'armL'),
      T(7.2, 14.6, 1.2, 1.0, 1.8, 1.0, rune, 'armL'),
    ]),
  ];
  return { boxes, scale: 0.12 };
}

// ---------------------------------------------------------------- Wisp (summoner)
function wisp(): VoxelModel {
  const glow = 0x6affe0;
  const glowL = 0xd8fff6;
  const flame = 0x3ad8c0;
  const boxes: B[] = [
    // floating core with an inner light, a flame tail rising behind, two flickering wing-flames
    T(0, 4.0, 0, 3.6, 3.6, 3.6, glow, 'body'),
    T(0, 4.6, 0.3, 2.2, 2.2, 2.4, glowL, 'body'),
    T(0, 7.2, -0.6, 2.2, 1.8, 2.2, flame, 'body'),
    T(0, 8.8, -1.2, 1.2, 1.4, 1.2, glow, 'body'),
    T(0, 10.0, -1.6, 0.6, 0.8, 0.6, glowL, 'body'),
    T(0, 2.8, 0, 2.0, 1.2, 2.0, flame, 'body'),
    T(0, 1.8, 0, 0.8, 1.0, 0.8, glow, 'body'),
    ...sym([T(0.75, 5.2, 1.85, 0.6, 0.8, 0.3, 0x1a4a44, 'body')]),
    T(-3.0, 4.6, -0.4, 2.6, 0.6, 1.8, flame, 'wingL'), T(-4.6, 5.0, -0.8, 1.2, 0.5, 1.0, glowL, 'wingL'),
    T(3.0, 4.6, -0.4, 2.6, 0.6, 1.8, flame, 'wingR'), T(4.6, 5.0, -0.8, 1.2, 0.5, 1.0, glowL, 'wingR'),
  ];
  return { boxes, scale: 0.09 };
}

// ---------------------------------------------------------------- Ancient (summoner identity: treant guardian)
function ancient(): VoxelModel {
  const bark = 0x6a4a30;
  const barkD = 0x4a321e;
  const barkL = 0x8a6644;
  const leaf = 0x4aa04a;
  const leafL = 0x7ac85a;
  const leafD = 0x2e7a3a;
  const glow = 0x8affc8;
  const flower = 0xf0a0d0;
  const boxes: B[] = [
    // root legs
    ...sym([
      T(2.8, 0, 0.6, 4.4, 1.4, 5.4, barkD, 'legL'),
      T(2.8, 1.2, 0.2, 3.4, 5.6, 3.6, bark, 'legL'),
      T(4.6, 0, 2.6, 1.4, 1.0, 2.0, barkD, 'legL'),
      T(1.2, 0, 3.0, 1.2, 0.9, 1.8, barkD, 'legL'),
    ]),
    // trunk body: layered bark, hollow with a glowing heart, moss and flowers
    T(0, 6.4, 0, 8.4, 3.0, 6.4, barkD, 'body'),
    T(0, 9.2, 0, 9.0, 8.0, 7.0, bark, 'body'),
    T(0, 9.6, 3.55, 3.0, 4.0, 0.3, 0x1a120c, 'body'),
    T(0, 10.6, 3.7, 1.6, 1.8, 0.3, glow, 'body'),
    ...sym([T(3.2, 9.6, 3.55, 0.8, 6.6, 0.3, barkL, 'body'), T(1.6, 14.4, 3.55, 0.6, 2.4, 0.3, barkL, 'body')]),
    T(0, 16.8, -0.2, 9.6, 1.6, 7.4, leafD, 'body'),
    T(-3.0, 17.6, 3.0, 1.2, 1.0, 1.2, flower, 'body'),
    T(3.6, 16.6, -3.4, 1.0, 1.0, 1.0, flower, 'body'),
    // head: craggy face with glowing eyes and a beard of moss, crown of branches and a canopy
    T(0, 17.2, 1.6, 5.4, 5.0, 4.6, barkL, 'head'),
    T(0, 21.0, 1.6, 6.0, 1.0, 4.8, bark, 'head'),
    ...sym([T(1.3, 19.2, 3.95, 1.2, 0.8, 0.3, glow, 'head'), T(1.3, 20.1, 3.95, 1.6, 0.4, 0.3, barkD, 'head')]),
    T(0, 15.8, 3.5, 3.6, 2.4, 1.0, leafD, 'head'),
    T(0, 15.0, 3.6, 2.0, 1.0, 0.8, leafD, 'head'),
    T(0, 22.0, 0.4, 12.0, 3.4, 9.6, leaf, 'head'),
    T(0, 25.2, 0.0, 8.4, 2.6, 7.0, leafL, 'head'),
    T(0, 27.6, -0.2, 4.4, 1.6, 4.0, leaf, 'head'),
    ...sym([T(5.6, 23.4, 2.6, 2.4, 2.2, 2.4, leafL, 'head'), T(4.8, 21.4, -4.6, 2.4, 2.4, 2.0, leafD, 'head')]),
    T(-2.6, 26.4, 2.8, 1.0, 1.0, 1.0, flower, 'head'),
    T(3.4, 25.0, 3.6, 0.8, 0.8, 0.8, glow, 'head'),
    T(-4.2, 23.8, -3.6, 0.8, 0.8, 0.8, glow, 'head'),
    ...sym([T(4.6, 25.6, 0.4, 1.0, 3.6, 1.0, barkL, 'head'), T(5.8, 28.2, 0.4, 2.4, 0.8, 0.8, barkL, 'head'), T(6.8, 28.8, 0.4, 0.6, 1.4, 0.6, barkL, 'head')]),
    // branch arms ending in gnarled claws, with leaves
    ...sym([
      T(6.2, 13.6, 0, 3.4, 3.4, 3.6, barkL, 'armL'),
      T(6.8, 7.6, 0.2, 2.4, 6.4, 2.6, bark, 'armL'),
      T(7.0, 3.4, 0.6, 3.2, 4.4, 3.4, barkD, 'armL'),
      T(6.0, 2.2, 2.6, 0.8, 2.4, 0.8, barkD, 'armL'),
      T(8.0, 2.2, 2.4, 0.8, 2.6, 0.8, barkD, 'armL'),
      T(6.4, 17.0, 0, 3.6, 1.4, 3.8, leaf, 'armL'),
      T(8.4, 10.8, 0.2, 1.4, 1.4, 1.4, leafL, 'armL'),
    ]),
  ];
  return { boxes, scale: 0.14 };
}

// ---------------------------------------------------------------- Hawk (ranger identity)
function hawk(): VoxelModel {
  const brown = 0x7a4e2c;
  const brownD = 0x4e3018;
  const cream = 0xead8b4;
  const rust = 0xb4582a;
  const beak = 0xe8b040;
  const boxes: B[] = [
    // body flying at y ≈ 6: chest, back, head with hooked beak, banded tail fan, talons
    T(0, 5.4, 0, 2.6, 2.4, 4.6, brown, 'body'),
    T(0, 5.2, 0.8, 2.2, 1.6, 3.4, cream, 'body'),
    ...[0.2, 1.0, 1.8].map((z) => T(0, 5.15, z, 2.25, 0.25, 0.3, rust, 'body')),
    T(0, 6.4, 3.0, 2.2, 2.2, 2.2, brown, 'head'),
    T(0, 6.4, 3.4, 2.3, 0.9, 1.8, cream, 'head'),
    T(0, 6.6, 4.4, 0.8, 0.9, 0.9, beak, 'head'),
    T(0, 6.2, 4.85, 0.5, 0.6, 0.4, 0x3a2a1a, 'head'),
    ...sym([T(0.8, 7.4, 3.95, 0.5, 0.5, 0.3, 0xffd040, 'head'), T(0.8, 7.9, 3.7, 0.9, 0.3, 0.6, brownD, 'head')]),
    T(0, 5.8, -3.6, 3.0, 0.5, 3.0, brownD, 'tail'),
    T(0, 5.85, -4.6, 3.4, 0.4, 1.0, cream, 'tail'),
    T(0, 5.9, -5.0, 3.4, 0.4, 0.4, brownD, 'tail'),
    ...sym([T(0.6, 4.4, 0.6, 0.5, 1.0, 0.5, beak, 'body'), T(0.6, 4.2, 1.0, 0.6, 0.3, 0.8, 0x3a2a1a, 'body')]),
    // wings: three feather tiers each, with dark primaries
    T(-3.0, 6.0, 0.2, 3.6, 0.6, 3.6, brown, 'wingL'),
    T(-6.0, 6.1, -0.2, 3.0, 0.5, 3.0, brown, 'wingL'),
    T(-8.4, 6.2, -0.6, 2.2, 0.4, 2.4, brownD, 'wingL'),
    T(-5.4, 6.0, 1.7, 5.0, 0.6, 0.6, cream, 'wingL'),
    T(3.0, 6.0, 0.2, 3.6, 0.6, 3.6, brown, 'wingR'),
    T(6.0, 6.1, -0.2, 3.0, 0.5, 3.0, brown, 'wingR'),
    T(8.4, 6.2, -0.6, 2.2, 0.4, 2.4, brownD, 'wingR'),
    T(5.4, 6.0, 1.7, 5.0, 0.6, 0.6, cream, 'wingR'),
  ];
  return { boxes, scale: 0.08 };
}

// ---------------------------------------------------------------- Sky Serpent (summoner)
function serpent(): VoxelModel {
  const scale = 0x3a7ad8;
  const scaleL = 0x6aa8f0;
  const belly = 0xe8f0ff;
  const fin = 0x9ad8ff;
  const spark = 0x7ae0ff;
  const gold = 0xe8c050;
  const boxes: B[] = [];
  // body: a sinuous chain of shrinking segments flowing back from the head (static wave)
  const n = 9;
  for (let i = 0; i < n; i++) {
    const z = 2 - i * 2.9;
    const x = Math.sin(i * 0.9) * 2.2;
    const y = 6 + Math.sin(i * 0.9 + 1.2) * 1.2;
    const s = 3.4 - i * 0.22;
    const tag = i >= n - 3 ? 'tail' : 'body';
    boxes.push(T(x, y, z, s, s, 3.2, scale, tag));
    boxes.push(T(x, y - 0.1, z, s - 1.0, 0.6, 3.0, belly, tag));
    if (i % 2 === 0) boxes.push(T(x, y + s - 0.2, z, 0.6, 1.2, 1.4, fin, tag));
    else boxes.push(T(x, y + s - 0.4, z, s * 0.6, 0.5, 2.0, scaleL, tag));
  }
  const tx = Math.sin((n - 1) * 0.9) * 2.2;
  const ty = 6 + Math.sin((n - 1) * 0.9 + 1.2) * 1.2;
  boxes.push(T(tx, ty + 0.4, 2 - n * 2.9, 0.6, 2.4, 2.4, fin, 'tail'), T(tx, ty + 0.6, 2 - n * 2.9 - 1.0, 0.4, 1.4, 1.0, spark, 'tail'));
  // side fins near the front
  boxes.push(T(-2.8, 6.8, 0.4, 2.4, 0.4, 2.2, fin, 'wingL'), T(2.8, 6.8, 0.4, 2.4, 0.4, 2.2, fin, 'wingR'));
  // dragon head: muzzle, brow ridges, horns, whiskers, glowing eyes, pearl; jaw opens
  boxes.push(
    T(0, 6.4, 5.2, 4.0, 3.0, 4.0, scale, 'head'),
    T(0, 6.6, 7.8, 2.8, 1.8, 2.4, scaleL, 'head'),
    T(0, 8.3, 7.2, 3.0, 0.5, 1.2, scale, 'head'),
    ...sym([
      T(1.1, 8.0, 6.4, 0.8, 0.6, 0.3, spark, 'head'),
      T(1.0, 9.2, 4.2, 0.6, 2.0, 0.6, gold, 'head'),
      T(1.0, 10.6, 3.4, 0.5, 1.2, 0.5, gold, 'head'),
      T(2.4, 6.6, 8.4, 2.4, 0.3, 0.3, gold, 'head'),
      T(2.4, 8.6, 4.4, 0.4, 1.2, 1.6, fin, 'head'),
    ]),
    T(0, 5.4, 7.4, 2.6, 1.0, 2.8, belly, 'jaw'),
    ...sym([T(0.8, 6.2, 8.6, 0.3, 0.5, 0.3, 0xffffff, 'jaw')]),
    T(0, 4.0, 9.6, 1.4, 1.4, 1.4, spark, 'jaw'),
  );
  return { boxes, scale: 0.1 };
}

// ---------------------------------------------------------------- Flame Drake (summoner ultimate)
function drake(): VoxelModel {
  const red = 0xb8322a;
  const redD = 0x7a1e1c;
  const redL = 0xd8503a;
  const belly = 0xf0b050;
  const horn = 0x3a2a24;
  const fire = 0xffa030;
  const fireL = 0xffe070;
  const membrane = 0xe85a30;
  const boxes: B[] = [
    // legs: muscular haunches and clawed feet
    ...sym([
      T(2.6, 0, 3.4, 2.6, 4.2, 2.6, redD, 'legL'), T(2.6, 0, 4.2, 3.0, 1.0, 3.2, redD, 'legL'), T(2.6, 0.2, 5.7, 2.4, 0.6, 0.6, horn, 'legL'),
      T(2.8, 0, -3.4, 2.8, 3.2, 2.8, redD, 'legR'), T(2.8, 2.6, -3.6, 3.4, 3.4, 4.0, red, 'legR'), T(2.8, 0, -2.6, 3.0, 1.0, 3.4, redD, 'legR'), T(2.8, 0.2, -0.8, 2.4, 0.6, 0.6, horn, 'legR'),
    ]),
    // body: barrel torso with glowing belly plates and spine ridges
    T(0, 4.0, 0, 6.4, 5.0, 10.0, red, 'body'),
    T(0, 3.8, 0.4, 5.0, 1.0, 8.4, belly, 'body'),
    ...[-2.6, -0.6, 1.4, 3.4].map((z) => T(0, 4.85, z, 5.2, 0.8, 1.2, fire, 'body')),
    ...[-3.4, -1.4, 0.6, 2.6].map((z, i) => T(0, 9.0, z, 0.8, 1.6 - i * 0.1, 1.2, horn, 'body')),
    // neck rising forward
    T(0, 7.0, 5.6, 3.4, 3.6, 3.4, red, 'body'),
    T(0, 9.4, 7.2, 3.0, 3.2, 3.0, red, 'body'),
    T(0, 8.8, 8.6, 2.2, 2.2, 0.6, belly, 'body'),
    T(0, 12.4, 7.0, 0.7, 1.2, 1.0, horn, 'body'),
    // head: long snout, horns swept back, glowing eyes and nostril flames; jaw opens
    T(0, 11.4, 8.6, 3.8, 3.0, 3.6, red, 'head'),
    T(0, 11.6, 11.2, 2.8, 1.8, 2.8, redL, 'head'),
    T(0, 13.0, 9.6, 3.2, 0.6, 2.2, redD, 'head'),
    ...sym([
      T(1.2, 12.8, 10.25, 0.9, 0.6, 0.3, fireL, 'head'),
      T(1.4, 13.4, 7.6, 0.7, 0.8, 2.4, horn, 'head'),
      T(1.6, 13.8, 5.8, 0.6, 0.6, 1.6, horn, 'head'),
      T(1.8, 14.0, 4.8, 0.5, 1.2, 0.5, horn, 'head'),
      T(0.7, 12.6, 12.65, 0.5, 0.4, 0.3, fire, 'head'),
      T(2.0, 11.0, 8.6, 0.6, 1.4, 1.4, redD, 'head'),
    ]),
    T(0, 10.2, 10.6, 2.6, 1.0, 3.2, belly, 'jaw'),
    ...sym([T(0.8, 11.0, 11.8, 0.3, 0.5, 0.3, 0xffffff, 'jaw')]),
    T(0, 10.8, 12.6, 1.4, 1.0, 1.0, fireL, 'jaw'),
    // tail tapering to a flame tip
    T(0, 6.0, -6.4, 3.4, 2.8, 3.4, red, 'tail'),
    T(0, 6.4, -9.0, 2.4, 2.0, 2.8, red, 'tail'),
    T(0, 6.8, -11.2, 1.6, 1.4, 2.4, redD, 'tail'),
    T(0, 7.8, -6.4, 0.6, 1.0, 1.0, horn, 'tail'),
    T(0, 6.6, -13.0, 1.8, 2.2, 1.6, fire, 'tail'),
    T(0, 7.0, -13.6, 0.9, 1.4, 0.8, fireL, 'tail'),
    // wings: arm bone, finger bones and glowing membranes
    T(-5.4, 9.6, 0.6, 6.0, 0.8, 1.0, redD, 'wingL'),
    T(-6.6, 9.2, -1.6, 8.0, 0.4, 3.8, membrane, 'wingL'),
    T(-9.6, 9.0, -2.6, 3.4, 0.35, 3.0, membrane, 'wingL'),
    T(-8.6, 9.7, -0.6, 0.6, 0.6, 3.6, redD, 'wingL'),
    T(-11.4, 9.3, -2.4, 0.6, 0.5, 3.0, redD, 'wingL'),
    T(-12.0, 9.8, 0.4, 1.0, 1.0, 1.0, horn, 'wingL'),
    T(5.4, 9.6, 0.6, 6.0, 0.8, 1.0, redD, 'wingR'),
    T(6.6, 9.2, -1.6, 8.0, 0.4, 3.8, membrane, 'wingR'),
    T(9.6, 9.0, -2.6, 3.4, 0.35, 3.0, membrane, 'wingR'),
    T(8.6, 9.7, -0.6, 0.6, 0.6, 3.6, redD, 'wingR'),
    T(11.4, 9.3, -2.4, 0.6, 0.5, 3.0, redD, 'wingR'),
    T(12.0, 9.8, 0.4, 1.0, 1.0, 1.0, horn, 'wingR'),
  ];
  return { boxes, scale: 0.13 };
}

/** Summoned creature models keyed by summon id (the clone is drawn from the hero rig instead). */
export const SUMMON_MODELS: Record<string, VoxelModel> = {
  wolf: wolf(),
  golem: golem(),
  wisp: wisp(),
  ancient: ancient(),
  hawk: hawk(),
  serpent: serpent(),
  drake: drake(),
};
