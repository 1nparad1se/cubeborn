import { hash2 } from '../../core/Rng';
import { defineTex, shade, type Painter } from './atlas';

/**
 * Textures of sheets 8/9 (wooden and stone bridges), palettes taken from the sheets' swatches.
 * Self-registering: imported by props/bridges.ts.
 */

export const BR_PAL = {
  woodDark: [0x2a1c12, 0x3e2a1a, 0x5b3a24, 0x7a5a3a, 0x8c6b4a],
  woodLight: [0x4a3420, 0x6b4f32, 0x8c6a3f, 0xb88a53, 0xd4b07a],
  woodOld: [0x201810, 0x2e241a, 0x4a3a2a, 0x6b5440, 0x8c7a62],
  woodStone: [0x3a2414, 0x4e331f, 0x6d4a2e, 0x8b5e3b, 0xa67950],
  metal: [0x2a2e32, 0x3a3f44, 0x555b61, 0x7a8087, 0xa0a7b0],
  pier: [0x3e4a54, 0x5b6b77, 0x7a8a96, 0x9ba7b2, 0xc4ccd4],
  stone: [0x3a3a3c, 0x4f4f4f, 0x7a7a7a, 0x9a9a9a, 0xc3c3c3],
  chip: [0x2e2e30, 0x3f3f3f, 0x6b6b6b, 0x8a8a8a, 0xb5b5b5],
  moss: [0x2a382a, 0x3a4a3a, 0x5a6b5a, 0x7b8f7b, 0x9fb89f],
  road: [0x4a3e2a, 0x5e4f36, 0x8b7b5b, 0xa9926b, 0xcbb88a],
  fire: [0xffb347, 0xffa000, 0xff7a00, 0xb34700, 0x8c2f00],
  banner: [0x5a0e0e, 0x8b1a1a, 0xbb1e1e, 0xd03a2a],
};

/** Deck planks running along x: 4 px boards, dark gaps, end joints and nail heads. */
function deck(c: readonly number[], old = false): Painter {
  return (x, y, h) => {
    const row = y >> 2;
    const ry = y & 3;
    const joint = Math.floor(hash2(row, 5, 811) * 16);
    if (ry === 3) return shade(c[0], 0.9);
    if (x === joint) return shade(c[1], 0.8);
    if ((x === (joint + 2) % 16 || x === (joint + 14) % 16) && ry === 1) return c[0] === BR_PAL.woodOld[0] ? 0x3a3a3a : 0x2a2a2e; // nails
    const base = c[1 + Math.floor(hash2(row, x > joint ? 1 : 0, 812) * 3)];
    let k = 0.93 + h(1) * 0.1;
    if (ry === 0) k *= 1.12;
    if (hash2(x >> 2, row * 5 + ry, 813) > 0.8) k *= 0.88;
    if (old && hash2(x, y >> 1, 814) > 0.9) k *= 0.7;
    return shade(base, k);
  };
}
defineTex('br_deck', deck(BR_PAL.woodDark));
defineTex('br_deck_light', deck(BR_PAL.woodLight));
defineTex('br_deck_old', deck(BR_PAL.woodOld, true));
defineTex('br_deck_red', deck(BR_PAL.woodStone));

/** Heavy beam: lengthwise grain, lit top, dark underside. */
function beam(c: readonly number[]): Painter {
  return (x, y, h) => {
    if (y === 0) return shade(c[4], 0.95);
    if (y === 15) return c[0];
    const g = hash2(x >> 2, y, 815);
    const col = g > 0.75 ? c[3] : g > 0.3 ? c[2] : c[1];
    return shade(col, 0.95 + h(1) * 0.08);
  };
}
defineTex('br_beam', beam(BR_PAL.woodDark));
defineTex('br_beam_light', beam(BR_PAL.woodLight));
defineTex('br_beam_old', beam(BR_PAL.woodOld));
/** Post sides: vertical grain with a centre split. */
defineTex('br_post', (x, y, h) => beam(BR_PAL.woodDark)(y, x === 7 ? 15 : x, h, 0));
defineTex('br_post_old', (x, y, h) => beam(BR_PAL.woodOld)(y, x === 7 ? 15 : x, h, 0));
/** End grain with rings. */
defineTex('br_end', (x, y, h) => {
  const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5));
  if (d > 6.5) return BR_PAL.woodDark[1];
  return shade(Math.floor(d) & 1 ? BR_PAL.woodDark[3] : BR_PAL.woodDark[4], 0.95 + h(1) * 0.08);
});
/** Iron strap with rivets. */
defineTex('br_iron', (x, y, h) => {
  if ((x === 3 || x === 12) && (y & 7) === 4) return BR_PAL.metal[4];
  if (y === 0) return BR_PAL.metal[3];
  if (y === 15) return BR_PAL.metal[0];
  return shade(BR_PAL.metal[1 + Math.floor(h(2) * 2)], 0.92 + h(1) * 0.12);
});

/** Big stone blocks: 2x2 bricks per tile with chiselled rims, optional moss / cracks. */
function blocks(c: readonly number[], moss = 0, cracks = 0, cut = 8): Painter {
  return (x, y, h) => {
    const row = Math.floor(y / cut);
    const off = row & 1 ? cut >> 1 : 0;
    const bx = Math.floor((x + off) / cut);
    const lx = (x + off) % cut;
    const ly = y % cut;
    if (lx === cut - 1 || ly === cut - 1) return shade(c[0], 1);
    const id = hash2(bx + row * 5, row, 821);
    let col = c[2 + Math.min(2, Math.floor(id * 3))];
    let k = 0.94 + h(1) * 0.1;
    if (lx === 0 || ly === 0) k *= 1.16;
    if (lx === cut - 2 || ly === cut - 2) k *= 0.84;
    if (cracks && lx > 0 && ly > 0) {
      const cx = (hash2(bx, row, 822) * (cut - 2)) | 0;
      if (Math.abs(lx - cx - (ly >> 1)) === 0 && hash2(bx, row, 823) < cracks) return shade(c[0], 0.9);
    }
    if (moss && hash2(x >> 1, y >> 1, 824 + bx) < moss * (1.2 - y / 18)) col = BR_PAL.moss[2 + Math.floor(h(4) * 3)];
    return shade(col, k);
  };
}
defineTex('br_pier', blocks(BR_PAL.pier));
defineTex('br_pier_moss', blocks(BR_PAL.pier, 0.5));
defineTex('br_stone', blocks(BR_PAL.stone));
defineTex('br_stone_moss', blocks(BR_PAL.stone, 0.55));
defineTex('br_stone_crack', blocks(BR_PAL.stone, 0, 0.9));
defineTex('br_stone_chip', blocks(BR_PAL.chip, 0.1, 0.4));
defineTex('br_stone_top', blocks(BR_PAL.stone, 0, 0, 16));
/** Arch voussoirs: narrow vertical blocks. */
defineTex('br_arch', (x, y, h) => blocks(BR_PAL.stone)(y, x, h, 0));
/** Road paving: small sandy setts with grassy joints. */
defineTex('br_road', (x, y, h) => {
  const row = y >> 2;
  const off = row & 1 ? 2 : 0;
  const lx = (x + off) & 3;
  const ly = y & 3;
  if (lx === 3 || ly === 3) return hash2(x, y, 831) > 0.75 ? BR_PAL.moss[2] : BR_PAL.road[0];
  const col = BR_PAL.road[1 + Math.floor(hash2((x + off) >> 2, row, 832) * 4)];
  return shade(col, (lx === 0 || ly === 0 ? 1.1 : 0.96) + h(1) * 0.06);
});
/** Red banner with a golden sun emblem and dark hem. */
defineTex('br_banner', (x, y, h) => {
  const B = BR_PAL.banner;
  if (x === 0 || x === 15 || y === 0) return B[0];
  if (y >= 14) return x & 1 ? -1 : B[1];
  const dx = x - 7.5;
  const dy = y - 7;
  const r = Math.hypot(dx, dy);
  if (r < 2.2) return 0xe8b030;
  if (r < 4.5 && ((Math.abs(dx) < 0.8 || Math.abs(dy) < 0.8) || Math.abs(Math.abs(dx) - Math.abs(dy)) < 0.8)) return 0xd49a28;
  return shade(B[2], 0.92 + h(1) * 0.1);
});
