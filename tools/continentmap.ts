/**
 * Renders the generated continent to a PNG overview (1 px per 2 cells) for checking layout.
 * Usage: npx tsx tools/continentmap.ts out.png
 */
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import '../src/game/world/build/all';
import { CONTINENT_MAP } from '../src/data/continentMap';
import { CELL } from '../src/game/Terrain';
import { generateContinent } from '../src/game/world/continent/generate';
import { buildPlaces } from '../src/game/world/continent/places';

const T0 = performance.now();
const g = generateContinent();
const T1 = performance.now();
const L = buildPlaces(g);
const T2 = performance.now();
console.log(`generate ${Math.round(T1 - T0)}ms, places ${Math.round(T2 - T1)}ms`);
console.log(g.log.join('\n'));
const t = g.t;
const S = 2;
const W = Math.floor(g.n / S);
const img = Buffer.alloc(W * W * 3);
const pal = CONTINENT_MAP.palette.tiles as Record<string, number[]>;
const names = t.tileNames;
const put = (px: number, pz: number, c: number) => {
  if (px < 0 || pz < 0 || px >= W || pz >= W) return;
  const o = (pz * W + px) * 3;
  img[o] = c >> 16;
  img[o + 1] = (c >> 8) & 255;
  img[o + 2] = c & 255;
};
for (let pz = 0; pz < W; pz++)
  for (let px = 0; px < W; px++) {
    const i = pz * S * g.n + px * S;
    const nm = names[t.tile[i]];
    let c: number = (nm ? pal[nm]?.[0] : undefined) ?? 0xff00ff;
    if (t.elev[i] > 0) {
      const k = Math.min(1, 0.55 + t.elev[i] * 0.06);
      c = ((Math.min(255, ((c >> 16) * k) | 0)) << 16) | ((Math.min(255, (((c >> 8) & 255) * k) | 0)) << 8) | Math.min(255, ((c & 255) * k) | 0);
    }
    if (g.road[i]) c = g.road[i] === 3 ? 0xd8c8a0 : g.road[i] === 2 ? 0xb8a478 : 0x9a8460;
    if (g.occ[i]) c = 0x804020;
    if (t.cell[i] === CELL.wall) c = 0x000000;
    put(px, pz, c);
  }
const dot = (x: number, z: number, r: number, c: number) => {
  for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) put(Math.round(x / S) + dx, Math.round(z / S) + dz, c);
};
for (const c of L.camps) dot(c.x, c.z, 1, 0xff3030);
for (const d of L.dungeons) dot(d.x, d.z, 3, 0x9040ff);
for (const w of L.waystones) dot(w.x, w.z, 3, 0x30ffff);
for (const l of L.lairs) dot(l.x, l.z, 4, 0xff0000);
dot(L.start.x, L.start.z, 5, 0xffff00);
console.log(`towns ${L.towns.length} waystones ${L.waystones.length} dungeons ${L.dungeons.length} sites ${L.sites.length} camps ${L.camps.length} lairs ${L.lairs.length} npcs ${L.npcs.length} builds ${t.builds.length}`);
const raw = Buffer.alloc((W * 3 + 1) * W);
for (let y = 0; y < W; y++) img.copy(raw, y * (W * 3 + 1) + 1, y * W * 3, (y + 1) * W * 3);
const crc = (b: Buffer) => {
  let c = ~0;
  for (const x of b) {
    c ^= x;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
};
const chunk = (type: string, data: Buffer) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const cr = Buffer.alloc(4);
  cr.writeUInt32BE(crc(td));
  return Buffer.concat([len, td, cr]);
};
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0);
ihdr.writeUInt32BE(W, 4);
ihdr[8] = 8;
ihdr[9] = 2;
writeFileSync(process.argv[2] ?? 'continent.png', Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
