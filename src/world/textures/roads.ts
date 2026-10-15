import { defineTex, mix, shade } from './atlas';
import { GROUND_TILES, ROAD_PAL } from './groundTiles';

/**
 * Sheet 10 «Дороги» prop textures: atlas copies of every road ground tile variant (`gt_<tile>_<v>`,
 * used by the road sample props so the prop viewer shows the surfaces) and decal textures for the
 * detail props (puddle water, leaf litter, wet mud, moss, footprint dirt).
 */

for (const [name, def] of Object.entries(GROUND_TILES)) for (let v = 0; v < 4; v++) defineTex(`gt_${name}_${v}`, (x, y) => def.paint(x, y, v));

defineTex('road_puddle', (x, y, h) => {
  const W = ROAD_PAL.water;
  if (h(x, y) > 0.95) return W[3];
  if ((x + y * 3) % 11 === 0) return mix(W[2], W[3], 0.4);
  return shade(W[1 + (h(x >> 1, y >> 1) > 0.6 ? 1 : 0)], 0.92 + h(x, y + 3) * 0.1);
});
defineTex('road_puddle_mud', (x, y, h) => (h(x, y) > 0.93 ? 0x6a8a8a : shade(0x2e3a34, 0.85 + h(x >> 1, y >> 1) * 0.3)));
defineTex('road_leaves', (x, y, h) => {
  const r = h(x >> 1, y >> 1);
  return shade([0x8a4a20, 0xb0602a, 0xd08a30, 0xc07040, 0x6a7a2a][Math.floor(r * 5)], 0.88 + h(x, y) * 0.2);
});
defineTex('road_mud', (x, y, h) => shade(ROAD_PAL.mud[1 + Math.floor(h(x >> 1, y >> 1) * 2)], h(x, y) > 0.9 ? 1.4 : 0.9 + h(x, y + 1) * 0.15));
defineTex('road_moss', (x, y, h) => shade(ROAD_PAL.moss[Math.floor(h(x >> 1, y >> 1) * 3)], 0.88 + h(x, y) * 0.24));
defineTex('road_grass', (x, y, h) => shade(ROAD_PAL.grass[1 + Math.floor(h(x, y >> 1) * 3)], 0.9 + h(x, y) * 0.15));
defineTex('road_dirt_dark', (x, y, h) => shade(ROAD_PAL.dirt[Math.floor(h(x >> 1, y >> 1) * 2)], 0.9 + h(x, y) * 0.15));
defineTex('road_sand_patch', (x, y, h) => shade(ROAD_PAL.sand[2 + Math.floor(h(x >> 1, y) * 3)], (x + y * 2) % 6 === 0 ? 0.92 : 1));
defineTex('road_pebble', (x, y, h) => shade(ROAD_PAL.stone[1 + Math.floor(h(x >> 1, y >> 1) * 4)], y < 3 ? 1.1 : 0.95 + h(x, y) * 0.1));
