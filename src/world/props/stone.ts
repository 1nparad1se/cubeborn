import '../textures/stone';
import { Model, flame, ivy, lantern, pick, post, rr, stone, torch } from './kit';
import type { BuildCtx, PropDef } from './types';

/**
 * Sheet 3 «Скалы и каменистая местность»: crags (low / medium / high / sharp / cliff), ten rock
 * textures (rock_block variants), block shapes, mountain paths and stairs, slopes and terraces,
 * cave entrances, cave interior props, ruins, ruin buildings and the extra stone objects
 * (obelisk, statues, fire pit, shrine). Everything is built from chunky 12-16 px stone cubes with
 * moss caps and grass tufts like the sheet. Stairs, paths, terraces and platforms are walkable
 * through `deck` (heights in whole terrain blocks = 24 px).
 */

const CELL = 24; // one map cell / terrain block in px

/** Section 2 textures, in sheet order (rock_block variants). */
const ROCK_TEX = ['rock_grey', 'rock_dark', 'rock_speckled', 'rock_sandstone', 'rock_red', 'rock_weathered', 'rock_moss', 'rock_cracked', 'rock_dirt', 'rock_snow'];
const TINTS = [0xffffff, 0xf0eaf2, 0xe2dce6, 0xfaf4f0, 0xd8d2dc];

type R = () => number;

/** One rock cube with a tiny random tint / yaw jitter. */
function cube(m: Model, r: R, x: number, y: number, z: number, w: number, h: number, d: number, tex = 'rock_grey', jitter = true) {
  return m.cbox(x, y, z, w, h, d, { side: tex, top: tex === 'rock_grey' ? 'rock_top' : tex, bottom: 'rock_dark' }, {
    tint: pick(r, TINTS),
    rot: jitter ? { y: (r() - 0.5) * 0.12 } : undefined,
  });
}

/** Moss cap and a few grass tufts on top of a column (the green tops of the sheet). */
function mossTop(m: Model, r: R, x: number, y: number, z: number, w: number, d: number, amt = 0.6) {
  if (r() > amt) return;
  m.cbox(x + rr(r, -1, 1), y, z + rr(r, -1, 1), w * rr(r, 0.5, 0.9), 1.5, d * rr(r, 0.5, 0.9), 'moss', { bevel: 0.5 });
  const n = 1 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++)
    m.cbox(x + rr(r, -w / 3, w / 3), y + 1.5, z + rr(r, -d / 3, d / 3), 2, rr(r, 2, 5), 2, 'grass_top', { bevel: 0, anim: { kind: 'sway', amp: 0.01, speed: 1.8 } });
}

/** Moss drips down a front face. */
function mossDrip(m: Model, r: R, x: number, y: number, z: number, len: number) {
  m.box(x, y - len, z, rr(r, 2, 4), len, 1, 'moss', { bevel: 0 });
}

/**
 * A crag: a grid of stacked stone columns whose height comes from `hf(u, v)` (u, v in -1..1).
 * Columns are broken into 1-2 cubes with offsets so the silhouette steps like the sheet.
 */
function crag(m: Model, r: R, W: number, D: number, cs: number, hf: (u: number, v: number) => number, tex = 'rock_grey', moss = 0.6) {
  const nx = Math.max(1, Math.round(W / cs));
  const nz = Math.max(1, Math.round(D / cs));
  const cw = W / nx;
  const cd = D / nz;
  for (let i = 0; i < nx; i++)
    for (let j = 0; j < nz; j++) {
      const u = nx === 1 ? 0 : (i / (nx - 1)) * 2 - 1;
      const v = nz === 1 ? 0 : (j / (nz - 1)) * 2 - 1;
      let h = hf(u, v) * rr(r, 0.82, 1.15);
      if (h < 4) continue;
      h = Math.round(h / 4) * 4;
      const x = -W / 2 + cw * (i + 0.5) + rr(r, -1, 1);
      const z = -D / 2 + cd * (j + 0.5) + rr(r, -1, 1);
      // split tall columns into stacked cubes, each a bit narrower
      let y = 0;
      let k = 0;
      while (y < h) {
        const seg = Math.min(h - y, Math.round(rr(r, 1, 1.6) * cs / 4) * 4);
        const sh = 1 - k * 0.06;
        cube(m, r, x + rr(r, -1, 1), y, z + rr(r, -1, 1), cw * sh + 0.5, seg, cd * sh + 0.5, tex);
        y += seg;
        k++;
      }
      mossTop(m, r, x, h, z, cw, cd, moss);
      if (j === nz - 1 && r() < moss * 0.5 && h > 16) mossDrip(m, r, x - 1, h, z + cd / 2, rr(r, 4, h * 0.5));
    }
}

const dome = (peak: number, base: number, p = 1.4) => (u: number, v: number) => base + (peak - base) * Math.max(0, 1 - Math.pow(Math.hypot(u, v) / 1.42, p));

// ---------------------------------------------------------------- 1. crags

const rockLow = (c: BuildCtx) => {
  const m = new Model();
  crag(m, c.rnd, 44, 44, 11, dome(34, 10), ROCK_TEX[[0, 6, 2][c.variant]], 0.7);
  return m;
};
const rockMid = (c: BuildCtx) => {
  const m = new Model();
  crag(m, c.rnd, 46, 46, 11.5, dome(64, 12, 1.2), ROCK_TEX[[0, 6, 5][c.variant]], 0.6);
  return m;
};
const rockHigh = (c: BuildCtx) => {
  const m = new Model();
  crag(m, c.rnd, 46, 46, 11.5, dome(96, 20, 1.1), ROCK_TEX[[0, 6, 9][c.variant]], 0.55);
  return m;
};
/** Sharp rocks: clustered tapering spires. */
const rockSharp = (c: BuildCtx) => {
  const m = new Model();
  const r = c.rnd;
  const tex = ROCK_TEX[[0, 1, 9][c.variant]];
  crag(m, r, 46, 46, 11.5, dome(18, 8), tex, 0.8);
  const spires: [number, number, number][] = [[0, -2, 100], [-12, 6, 64], [12, 8, 56], [6, -12, 72], [-10, -10, 44]];
  for (const [x, z, H] of spires) {
    let y = 8;
    let w = 16;
    while (y < H && w > 3) {
      const seg = rr(r, 10, 16);
      cube(m, r, x + rr(r, -1, 1), y, z + rr(r, -1, 1), w, seg, w, tex);
      y += seg;
      w -= rr(r, 2.5, 4);
    }
    mossTop(m, r, x, 8, z + 6, 8, 4, 0.8);
  }
  return m;
};
/** Cliff: a long tall wall of columns with hanging moss; front stops at mid height. */
const cliff = (c: BuildCtx) => {
  const m = new Model();
  const r = c.rnd;
  const tex = ROCK_TEX[[0, 6, 1][c.variant]];
  crag(m, r, 70, 46, 11.5, (u, v) => 92 - Math.max(0, v) * 30 - Math.abs(u) * 10, tex, 0.7);
  for (let i = 0; i < 6; i++) mossDrip(m, r, rr(r, -32, 30), rr(r, 50, 80), 23.5, rr(r, 10, 34));
  ivy(m, -20, 20, 70, 23, r, 'pz', 6);
  ivy(m, 18, 10, 60, 23, r, 'pz', 5);
  return m;
};

// ---------------------------------------------------------------- 3. block shapes

/** 2x2x2 cube of 8px blocks with per-block tint (the "base block" look). */
function blockGrid(m: Model, r: R, x0: number, y0: number, z0: number, nx: number, ny: number, nz: number, s: number, tex: string, hole?: (i: number, j: number, k: number) => boolean) {
  for (let i = 0; i < nx; i++)
    for (let j = 0; j < ny; j++)
      for (let k = 0; k < nz; k++) {
        if (hole?.(i, j, k)) continue;
        // only outer shell (inner blocks are invisible)
        if (i > 0 && i < nx - 1 && k > 0 && k < nz - 1 && j < ny - 1 && !hole) continue;
        m.box(x0 + i * s, y0 + j * s, z0 + k * s, s, s, s, { side: tex, top: tex, bottom: 'rock_dark' }, { tint: pick(r, TINTS) });
      }
}

const rockBlock = (c: BuildCtx) => {
  const m = new Model();
  blockGrid(m, c.rnd, -16, 0, -16, 2, 2, 2, 16, ROCK_TEX[c.variant]);
  return m;
};
const rockCorner = (c: BuildCtx) => {
  const m = new Model();
  blockGrid(m, c.rnd, -16, 0, -16, 3, 3, 3, 32 / 3, 'rock_grey', (i, j, k) => j > 0 && (i > j - 1 + 0) && k > 2 - j);
  return m;
};
const rockStep = (c: BuildCtx) => {
  const m = new Model();
  blockGrid(m, c.rnd, -16, 0, -16, 3, 3, 3, 32 / 3, 'rock_grey', (_i, j, k) => k > 2 - j);
  return m;
};
const rockSlope = (c: BuildCtx) => {
  const m = new Model();
  const r = c.rnd;
  m.cbox(0, 0, 0, 32, 10, 32, { side: 'rock_grey', top: 'rock_top' }, { tint: 0xf0f0f0 });
  // sloped boulder: a tilted slab over a core
  m.cbox(0, 6, -4, 28, 20, 20, 'rock_weathered', { rot: { x: -0.45 } });
  m.cbox(-6, 10, -8, 14, 16, 12, 'rock_grey', { tint: pick(r, TINTS) });
  return m;
};
const rockSlab = (c: BuildCtx) => {
  const m = new Model();
  blockGrid(m, c.rnd, -16, 0, -12, 4, 1, 3, 8, 'rock_grey');
  blockGrid(m, c.rnd, -12, 8, -8, 2, 1, 2, 8, 'rock_grey');
  return m;
};
const rockColumn = (c: BuildCtx) => {
  const m = new Model();
  const r = c.rnd;
  for (let y = 0; y < 64; y += 16) blockGrid(m, r, -10 + rr(r, -1, 1), y, -10 + rr(r, -1, 1), 2, 1, 2, 10, 'rock_grey');
  mossTop(m, r, 0, 64, 0, 18, 18, 0.7);
  return m;
};
const rockArch = (c: BuildCtx) => {
  const m = new Model();
  const r = c.rnd;
  for (const x of [-16, 8]) blockGrid(m, r, x, 0, -6, 1, 5, 1, 10, 'rock_grey');
  m.box(-18, 50, -7, 36, 10, 14, 'rock_grey', { tint: 0xeeeeee });
  m.box(-6, 44, -6, 12, 6, 12, 'rock_grey');
  ivy(m, -12, 30, 58, 5, r, 'pz', 4);
  return m;
};
const rockJoint = (c: BuildCtx) => {
  const m = new Model();
  const r = c.rnd;
  blockGrid(m, r, -20, 0, -10, 2, 4, 2, 10, 'rock_grey');
  blockGrid(m, r, 0, 0, -16, 2, 5, 2, 10, 'rock_weathered');
  blockGrid(m, r, -6, 0, 4, 2, 2, 1, 10, 'rock_grey');
  return m;
};
const rockCliffBlock = (c: BuildCtx) => {
  const m = new Model();
  crag(m, c.rnd, 36, 30, 9, (u, v) => 70 - Math.max(0, v) * 20 - Math.abs(u) * 6, 'rock_grey', 0.8);
  return m;
};
const rockMossy = (c: BuildCtx) => {
  const m = new Model();
  crag(m, c.rnd, 36, 36, 9, dome(56, 24), 'rock_moss', 1);
  ivy(m, 0, 10, 50, 18, c.rnd, 'pz', 8);
  return m;
};
/** The five tall formations of the third row. */
const rockTall = (c: BuildCtx) => {
  const m = new Model();
  const r = c.rnd;
  switch (c.variant) {
    case 0: // stepped stack
      crag(m, r, 36, 36, 12, (u, v) => 72 - (u + 1) * 14 - (v + 1) * 8, 'rock_grey', 0.5);
      break;
    case 1: // thin pillar with a moss foot
      cube(m, r, 0, 0, 0, 24, 12, 24, 'rock_grey');
      for (let y = 12; y < 80; y += 16) blockGrid(m, r, -8, y, -8, 2, 2, 2, 8, 'rock_grey');
      mossTop(m, r, 0, 12, 10, 20, 6, 1);
      break;
    case 2: // twin columns
      crag(m, r, 36, 30, 12, (u) => (Math.abs(u) > 0.5 ? 72 : 36), 'rock_weathered', 0.7);
      break;
    case 3: // leaning blocks
      crag(m, r, 30, 30, 10, (u, v) => 76 - (u + 1) * 12 + v * 6, 'rock_grey', 0.3);
      break;
    default: // mossy tower
      crag(m, r, 36, 36, 12, dome(78, 40, 2), 'rock_moss', 1);
      ivy(m, 0, 10, 70, 18, r, 'pz', 8);
  }
  return m;
};

// ---------------------------------------------------------------- 4/5. paths, stairs, slopes

/** Flagstone path piece (flat, walkable) bordered by rocks and grass; width in cells. */
function pathPiece(wc: number) {
  return (c: BuildCtx) => {
    const m = new Model();
    const r = c.rnd;
    const W = wc * CELL;
    const L = 3 * CELL;
    m.cbox(0, 0, 0, W - 8, 2, L, 'path_flag', { bevel: 0.5 });
    for (const sx of [-1, 1]) {
      for (let z = -L / 2 + 6; z < L / 2; z += rr(r, 9, 16)) {
        if (r() < 0.7) stone(m, sx * (W / 2 - 4), 0, z, rr(r, 6, 11), r, 'rock_grey');
        else m.cbox(sx * (W / 2 - 3), 0, z, 5, rr(r, 3, 6), 5, 'grass_top', { bevel: 0, anim: { kind: 'sway', amp: 0.01, speed: 1.7 } });
      }
    }
    if (wc >= 3) {
      // wide road: a wooden edge rail and a torch on a post
      post(m, W / 2 - 6, 2, -L / 2 + 10, 18, 4, 'beam_dark');
      m.add(torch(W / 2 - 6, 22, -L / 2 + 10, 6));
    }
    return m;
  };
}

/** Steps rising toward -z over `rows` cells up to `rise` px; side walls of rock. */
function stairs(m: Model, r: R, W: number, rows: number, rise: number, steps: number, tex = 'path_flag', walls = true) {
  const L = rows * CELL;
  const sd = L / steps;
  const sh = rise / steps;
  for (let k = 0; k < steps; k++) {
    const z1 = L / 2 - sd * k;
    m.box(-W / 2, 0, z1 - sd, W, sh * (k + 1), sd, { side: 'rock_grey', top: tex }, { tint: pick(r, TINTS) });
  }
  if (walls)
    for (const sx of [-1, 1])
      for (let k = 0; k < steps; k += 2) {
        const z1 = L / 2 - sd * k;
        cube(m, r, sx * (W / 2 + 5), 0, z1 - sd, 10, sh * (k + 2) + 6, sd * 2, 'rock_grey');
        mossTop(m, r, sx * (W / 2 + 5), sh * (k + 2) + 6, z1 - sd, 10, sd * 2, 0.5);
      }
}
/** deck for stairs that climb toward -z: back row highest. */
const climbDeck = (rows: number, top: number) => (_fx: number, fz: number) => Math.round(((rows - 1 - fz) / (rows - 1)) * top);

const mountainStair = (c: BuildCtx) => {
  const m = new Model();
  stairs(m, c.rnd, 36, 3, 48, 8);
  m.add(torch(26, 30, -24, 8));
  return m;
};
const dangerPath = (c: BuildCtx) => {
  const m = new Model();
  const r = c.rnd;
  // two rock ledges with a plank walkway across the gap between them
  crag(m, r, 44, 18, 11, () => 24, 'rock_grey', 0.6);
  m.parts.forEach((p) => (p.z -= 26));
  const k = m.mark;
  crag(m, r, 44, 18, 11, () => 24, 'rock_grey', 0.6);
  for (let i = k; i < m.parts.length; i++) m.parts[i].z += 26;
  for (let z = -17; z < 17; z += 5) m.box(-10, 22, z, 20, 2, 4, 'plank_old', { rot: { z: rr(r, -0.06, 0.06) } });
  for (const x of [-11, 11]) m.box(x - 0.5, 23, -18, 1, 1, 36, 'rope');
  for (const x of [-11, 11]) post(m, x, 24, -18, 10, 2, 'beam_dark', false);
  m.add(torch(14, 24, -26, 8));
  m.emit({ kind: 'mist', x: 0, y: 4, z: 0, count: 6, spread: 16, height: 8, size: 8 });
  return m;
};
const slopeGentle = (c: BuildCtx) => {
  const m = new Model();
  stairs(m, c.rnd, 44, 3, 24, 6, 'rock_top', false);
  return m;
};
const slopeSteep = (c: BuildCtx) => {
  const m = new Model();
  stairs(m, c.rnd, 26, 3, 48, 8, 'path_flag', false);
  // a steep rock bank on the right of the steps
  const k = m.mark;
  crag(m, c.rnd, 12, 70, 12, (_u, v) => 60 - (v + 1) * 22, 'rock_grey', 0.6);
  for (let i = k; i < m.parts.length; i++) m.parts[i].x += 19;
  return m;
};
const stoneStair = (c: BuildCtx) => {
  const m = new Model();
  const r = c.rnd;
  stairs(m, r, 30, 3, 48, 8, 'path_flag', false);
  for (const sx of [-1, 1])
    for (let k = 0; k < 6; k++) blockGrid(m, r, sx * 15 + (sx < 0 ? -12 : 0), 0, 24 - k * 12, 1, Math.min(6, k + 2), 1, 12, 'rock_grey');
  for (const sx of [-1, 1]) m.add(torch(sx * 21, 52, 8, 8));
  return m;
};
const terraces = (c: BuildCtx) => {
  const m = new Model();
  const r = c.rnd;
  for (let row = 0; row < 3; row++) {
    const h = (2 - row) * 24 + 4;
    const z = -CELL + row * CELL;
    for (let x = -30; x < 36; x += 12) cube(m, r, x, 0, z, 12.5, h, CELL, 'rock_grey', false);
    m.cbox(0, h, z, 70, 1.5, CELL - 4, 'moss', { bevel: 0 });
    for (let i = 0; i < 3; i++) m.cbox(rr(r, -30, 30), h + 1.5, z + rr(r, -6, 6), 3, rr(r, 3, 6), 3, 'grass_top', { bevel: 0, anim: { kind: 'sway', amp: 0.01, speed: 1.7 } });
  }
  return m;
};

// ---------------------------------------------------------------- 6. caves

/**
 * Cave mouth in a rock face: the opening (w x h px) is a dark recess on +z, framed by crag
 * columns. Returns the model; deco by caller.
 */
function caveMouth(m: Model, r: R, W: number, D: number, H: number, ow: number, oh: number, tex = 'rock_grey') {
  crag(m, r, W, D, 12, (u, v) => {
    const x = (u * W) / 2;
    if (v > 0.3 && Math.abs(x) < ow / 2) return 0; // keep the doorway clear
    return H - Math.abs(u) * 14 + (v < 0 ? 6 : 0);
  }, tex, 0.7);
  // lintel over the doorway and the black recess
  m.box(-ow / 2 - 4, oh, D / 2 - 18, ow + 8, H - oh, 18, { side: tex, top: 'rock_top' }, { tint: 0xe8e2ea });
  m.box(-ow / 2, 0, D / 2 - 26, ow, oh, 2, 'cave_dark', { bevel: 0 });
  m.box(-ow / 2, 0, D / 2 - 26, 2, oh, 26, tex);
  m.box(ow / 2 - 2, 0, D / 2 - 26, 2, oh, 26, tex);
  m.box(-ow / 2, 0, D / 2 - 26, ow, 0.5, 26, 'path_flag', { bevel: 0 });
  ivy(m, -ow / 2 - 6, oh - 4, H, D / 2, r, 'pz', 5);
}

const caveSmall = (c: BuildCtx) => {
  const m = new Model();
  caveMouth(m, c.rnd, 56, 48, 56, 18, 24);
  m.add(torch(14, 0, 22, 14));
  return m;
};
const caveMedium = (c: BuildCtx) => {
  const m = new Model();
  caveMouth(m, c.rnd, 70, 54, 70, 26, 34);
  for (const sx of [-1, 1]) m.add(torch(sx * 20, 0, 26, 16));
  m.light(0, 14, 10, 0xff8a2a, 0.8, 6, 0.7);
  return m;
};
const caveLarge = (c: BuildCtx) => {
  const m = new Model();
  caveMouth(m, c.rnd, 94, 64, 88, 40, 48);
  for (const sx of [-1, 1]) m.add(torch(sx * 28, 0, 30, 18));
  for (let i = 0; i < 4; i++) stone(m, rr(c.rnd, -40, 40), 0, rr(c.rnd, 26, 32), rr(c.rnd, 6, 10), c.rnd, 'rock_grey');
  return m;
};
/** Mine entrance: timber frame, rails running in, hanging lantern. */
const caveMine = (c: BuildCtx) => {
  const m = new Model();
  const r = c.rnd;
  caveMouth(m, r, 70, 54, 70, 30, 36);
  for (const sx of [-1, 1]) post(m, sx * 14, 0, 22, 38, 4, 'beam_dark', false);
  m.box(-18, 38, 20, 36, 5, 5, { side: 'beam_dark', end: 'wood_end' });
  m.box(-6, 0, -2, 12, 0.8, 30, 'rail_track', { bevel: 0 });
  m.add(lantern(0, 26, 22, 's'));
  m.box(-0.5, 41, 21.5, 1, 1, 1, 'metal');
  return m;
};
/** Cave into ruins: carved stone frame with a waterfall veil and blue glow. */
const caveRuins = (c: BuildCtx) => {
  const m = new Model();
  const r = c.rnd;
  caveMouth(m, r, 70, 54, 76, 28, 40, 'rock_moss');
  for (const sx of [-1, 1]) blockGrid(m, r, sx * 16 - (sx < 0 ? 8 : 0), 0, 18, 1, 5, 1, 8, 'stone');
  m.box(-20, 40, 18, 40, 8, 8, 'stone');
  m.box(-10, 0, 22, 20, 74, 1, 'waterfall', { glow: 0.3, bevel: 0, anim: { kind: 'flag', axis: [0, 0, 1], amp: 0.01, speed: 4 } });
  m.cbox(0, 0, 28, 28, 1, 10, 'waterfall', { glow: 0.2, bevel: 0 });
  m.emit({ kind: 'mist', x: 0, y: 2, z: 26, count: 8, spread: 12, height: 10, size: 7 });
  m.emit({ kind: 'drips', x: 0, y: 70, z: 23, count: 8, spread: 8, height: 70, color: 0xa8e0ff });
  m.light(0, 20, 26, 0x5ab0ff, 0.9, 6, 0, 0.5);
  return m;
};

// ---------------------------------------------------------------- 7. cave interiors

const crystalCluster = (c: BuildCtx) => {
  const m = new Model();
  const r = c.rnd;
  const blue = c.variant === 1;
  const tex = blue ? 'crystal_blue' : 'crystal_purple';
  const col = blue ? 0x4aa0ff : 0xa060ff;
  crag(m, r, 30, 30, 10, dome(10, 6), 'rock_dark', 0);
  const sh: [number, number, number, number, number][] = [[0, 0, 30, 0, 0], [-8, 4, 18, -0.35, 0.2], [8, -2, 22, 0.3, -0.2], [3, 8, 14, 0.15, 0.4], [-5, -7, 16, -0.2, -0.4]];
  for (const [x, z, h, rz, rx] of sh) {
    m.cbox(x, 6, z, 6, h, 6, tex, { glow: 1.1, rot: { z: rz, x: rx, pivot: [x, 6, z] }, noAO: true });
    m.cbox(x, 6 + h - 1, z, 3, 4, 3, tex, { glow: 1.4, rot: { z: rz, x: rx, pivot: [x, 6, z] }, noAO: true });
  }
  m.light(0, 20, 0, col, 1.1, 7, 0.1, 0.6);
  m.emit({ kind: 'motes', x: 0, y: 14, z: 0, count: 6, spread: 12, height: 24, color: col, size: 1.5 });
  return m;
};
const mineRails = (c: BuildCtx) => {
  const m = new Model();
  const r = c.rnd;
  m.cbox(0, 0, 0, 20, 1, 72, 'rail_track', { bevel: 0 });
  if (c.variant === 1) {
    // mine cart on the rails
    m.cbox(0, 3, 4, 18, 12, 22, { side: 'plank_dark', top: 'coal' }, {});
    for (const z of [-4, 12]) for (const x of [-10, 10]) m.cbox(x, 0, z, 2, 5, 5, 'metal_dark');
    m.cbox(0, 15, 4, 19, 1.5, 23, 'metal_dark', { bevel: 0.5 });
    for (let i = 0; i < 4; i++) stone(m, rr(r, -5, 5), 15, 4 + rr(r, -6, 6), 5, r, 'coal');
  }
  return m;
};
const mineSupport = (_c: BuildCtx) => {
  const m = new Model();
  for (const sx of [-1, 1]) post(m, sx * 30, 0, 0, 56, 6, 'beam_dark', false);
  m.cbox(0, 56, 0, 70, 7, 8, { side: 'beam_dark', end: 'wood_end' });
  for (const sx of [-1, 1]) m.box(sx * 30 - 2, 40, -2, 4, 22, 4, 'beam_dark', { rot: { z: sx * 0.8, pivot: [sx * 30, 42, 0] } });
  m.add(lantern(14, 41, 0, 's'));
  m.box(13.5, 56, -0.5, 1, 1, 1, 'chain');
  return m;
};
const stalagmites = (c: BuildCtx) => {
  const m = new Model();
  const r = c.rnd;
  for (let i = 0; i < 5; i++) {
    const x = rr(r, -16, 16);
    const z = rr(r, -16, 16);
    let w = rr(r, 8, 12);
    let y = 0;
    const H = rr(r, 14, 40);
    while (y < H && w > 2) {
      cube(m, r, x, y, z, w, 8, w, 'rock_dark');
      y += 8;
      w -= 2.5;
    }
  }
  if (c.variant === 1) m.emit({ kind: 'drips', x: 0, y: 70, z: 0, count: 5, spread: 14, height: 70, color: 0x9ad8ff });
  return m;
};
const cavePool = (c: BuildCtx) => {
  const m = new Model();
  const r = c.rnd;
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    stone(m, Math.cos(a) * 30, 0, Math.sin(a) * 30, rr(r, 9, 14), r, 'rock_dark');
  }
  m.cbox(0, 0, 0, 56, 1.5, 56, 'waterfall', { glow: 0.55, bevel: 0, tint: 0x7ad0ff });
  m.cbox(0, 0, 0, 10, 4, 10, 'glowstone', { glow: 1.4, flicker: 0.1 });
  m.light(0, 8, 0, 0x6ad0ff, 1.0, 8, 0.05, 0.6);
  m.emit({ kind: 'motes', x: 0, y: 4, z: 0, count: 8, spread: 22, height: 18, color: 0xffd070, size: 1.4 });
  return m;
};
/** Cave temple hall pillar with a red banner and a fire bowl. */
const templePillar = (c: BuildCtx) => {
  const m = new Model();
  const r = c.rnd;
  m.cbox(0, 0, 0, 22, 6, 22, 'stone');
  m.cbox(0, 6, 0, 16, 60, 16, { side: 'stone', end: 'stone_smooth' }, { tint: 0xd8d0dc });
  m.cbox(0, 66, 0, 22, 6, 22, 'stone');
  const k = m.mark;
  m.box(-6, 22, 8.2, 12, 36, 0.8, 'banner_gold', { bevel: 0 });
  m.animate(k, { kind: 'flag', pivot: [0, 58, 8.6], axis: [0, 0, 1], amp: 0.02, speed: 2.2 });
  m.cbox(14, 0, 12, 6, 12, 6, 'stone_smooth');
  m.cbox(14, 12, 12, 10, 3, 10, 'metal_dark');
  m.add(flame(14, 15, 12, 3, { smoke: r() < 0.5 }));
  return m;
};

// ---------------------------------------------------------------- 8. ruins

/** Broken wall: a row of block columns with a jagged top. */
function wall(m: Model, r: R, x0: number, x1: number, z: number, H: number, th = 12, tex = 'stone_mossy', jag = 0.5) {
  for (let x = x0; x < x1; x += 10) {
    const h = Math.round((H * (1 - jag * r())) / 8) * 8;
    blockGrid(m, r, x, 0, z - th / 2, 1, Math.max(1, h / 8), 1, 8, tex);
    if (r() < 0.5) mossTop(m, r, x + 4, Math.max(8, h), z, 8, th, 0.9);
  }
}

const ruinWall = (c: BuildCtx) => {
  const m = new Model();
  const r = c.rnd;
  for (let x = -34; x < 34; x += 8) {
    const h = Math.max(8, Math.round((52 - Math.abs(x + 10) * 1.1 + rr(r, -12, 6)) / 8) * 8);
    blockGrid(m, r, x, 0, -6, 1, h / 8, 1, 8, r() < 0.4 ? 'stone_mossy' : 'stone_cracked');
    if (r() < 0.4) mossTop(m, r, x + 4, h, -2, 8, 8, 1);
  }
  for (let i = 0; i < 5; i++) stone(m, rr(r, -30, 30), 0, rr(r, 6, 18), rr(r, 5, 9), r, 'stone');
  ivy(m, 0, 4, 40, 2, r, 'pz', 6);
  return m;
};
const ruinColumns = (c: BuildCtx) => {
  const m = new Model();
  const r = c.rnd;
  const hs = [64, 44, 72];
  [-18, 0, 18].forEach((x, i) => {
    const z = i === 1 ? 6 : -6;
    m.cbox(x, 0, z, 14, 5, 14, 'stone');
    m.cbox(x, 5, z, 10, hs[i] - 10, 10, { side: 'stone_mossy', end: 'stone_smooth' });
    if (hs[i] > 60) m.cbox(x, hs[i] - 5, z, 14, 5, 14, 'stone');
    ivy(m, x, 6, hs[i] - 8, z + 5, r, 'pz', 4);
  });
  stone(m, 8, 0, 14, 8, r, 'stone');
  return m;
};
const ruinArch = (c: BuildCtx) => {
  const m = new Model();
  const r = c.rnd;
  for (const x of [-26, 14]) blockGrid(m, r, x, 0, -6, 1, 7, 1, 12, 'stone_mossy');
  // stepped arch of blocks
  for (let i = 0; i < 5; i++) {
    const x = -16 + i * 7;
    const y = 72 - [8, 4, 0, 4, 8][i] - 8;
    m.box(x - 4, y, -6, 8, 72 - y + 4, 12, 'stone', { tint: pick(r, TINTS) });
  }
  m.box(-28, 76, -7, 56, 6, 14, 'stone_cracked');
  ivy(m, -20, 30, 80, 6, r, 'pz', 6);
  return m;
};
const ruinStairs = (c: BuildCtx) => {
  const m = new Model();
  const r = c.rnd;
  stairs(m, r, 40, 2, 24, 4, 'stone_mossy', false);
  for (const sx of [-1, 1]) blockGrid(m, r, sx * 24 - 4, 0, -24, 1, sx < 0 ? 4 : 2, 3, 8, 'stone_mossy');
  ivy(m, -22, 2, 24, 0, r, 'pz', 5);
  for (let i = 0; i < 3; i++) stone(m, rr(r, -18, 18), 0, 22, 6, r, 'stone');
  return m;
};
const ruinPlatform = (c: BuildCtx) => {
  const m = new Model();
  const r = c.rnd;
  m.cbox(0, 0, 0, 48, 24, 48, { side: 'stone_mossy', top: 'stone_cracked' });
  // broken columns at the corners and a front stair notch
  for (const [x, z, h] of [[-20, -20, 40], [20, -20, 28], [-20, 20, 16], [20, 20, 8]] as const) m.cbox(x, 24, z, 8, h, 8, { side: 'stone', end: 'stone_smooth' });
  for (let i = 0; i < 4; i++) mossTop(m, r, rr(r, -16, 16), 24, rr(r, -16, 16), 10, 10, 0.9);
  ivy(m, 0, 2, 22, 24, r, 'pz', 6);
  return m;
};

// ---------------------------------------------------------------- 9. ruin buildings

function banner(m: Model, x: number, y: number, z: number, w = 10, h = 22) {
  const k = m.mark;
  m.box(x - w / 2, y - h, z, w, h, 0.8, 'banner_gold', { bevel: 0 });
  m.box(x - w / 2 - 1, y, z - 0.5, w + 2, 2, 2, 'beam_dark');
  m.animate(k, { kind: 'flag', pivot: [x, y, z], axis: [0, 0, 1], amp: 0.02, speed: 2.2 });
}
function battlements(m: Model, r: R, cx: number, y: number, cz: number, W: number, D: number) {
  for (let x = -W / 2; x < W / 2; x += 8)
    for (const z of [-D / 2, D / 2 - 6])
      if (((x + W / 2) / 8) % 2 === 0) m.box(cx + x, y, cz + z, 6, 6, 6, 'stone', { tint: pick(r, TINTS) });
  for (let z = -D / 2 + 8; z < D / 2 - 6; z += 8)
    for (const x of [-W / 2, W / 2 - 6])
      if (((z + D / 2) / 8) % 2 === 0) m.box(cx + x, y, cz + z, 6, 6, 6, 'stone', { tint: pick(r, TINTS) });
}

const tower = (c: BuildCtx) => {
  const m = new Model();
  const r = c.rnd;
  m.cbox(0, 0, 0, 44, 14, 44, 'stone_mossy');
  m.cbox(0, 14, 0, 32, 70, 32, { side: 'stone', top: 'stone_smooth' }, { tint: 0xeeeaf0 });
  m.cbox(0, 84, 0, 38, 4, 38, 'stone');
  battlements(m, r, 0, 88, 0, 38, 38);
  m.box(-5, 14, 15.6, 10, 16, 1, 'cave_dark', { bevel: 0 });
  m.box(-2, 54, 15.6, 4, 8, 1, 'cave_dark', { bevel: 0 });
  banner(m, 0, 78, 16.4, 12, 22);
  ivy(m, -12, 10, 70, 16, r, 'pz', 6);
  m.add(torch(10, 18, 18, 6));
  return m;
};
const roundTower = (c: BuildCtx) => {
  const m = new Model();
  const r = c.rnd;
  // octagon-ish: rings of rotated boxes
  for (const a of [0, Math.PI / 4]) {
    m.cbox(0, 0, 0, 40, 12, 40, 'stone_mossy', { rot: { y: a } });
    m.cbox(0, 12, 0, 34, 66, 34, 'stone', { rot: { y: a }, tint: 0xeeeaf0 });
    m.cbox(0, 78, 0, 40, 4, 40, 'stone', { rot: { y: a } });
  }
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    m.cbox(Math.cos(a) * 17, 82, Math.sin(a) * 17, 7, 7, 7, 'stone', { rot: { y: -a } });
  }
  m.box(-5, 12, 18, 10, 16, 1, 'cave_dark', { bevel: 0 });
  for (const y of [38, 58]) m.box(-2, y, 18, 4, 7, 1, 'cave_dark', { bevel: 0 });
  ivy(m, 10, 6, 60, 17, r, 'pz', 5);
  return m;
};
const castle = (c: BuildCtx) => {
  const m = new Model();
  const r = c.rnd;
  // curtain walls
  m.cbox(0, 0, -18, 68, 40, 12, 'stone');
  m.cbox(0, 0, 26, 68, 34, 10, 'stone');
  m.cbox(-30, 0, 4, 10, 34, 34, 'stone');
  m.cbox(30, 0, 4, 10, 34, 34, 'stone');
  battlements(m, r, 0, 40, -18, 68, 12);
  battlements(m, r, 0, 34, 26, 68, 10);
  // corner towers
  for (const [x, z] of [[-30, -22], [30, -22], [-30, 26], [30, 26]] as const) {
    m.cbox(x, 0, z, 20, 58, 20, { side: 'stone', top: 'stone_smooth' }, { tint: 0xeeeaf0 });
    battlements(m, r, x, 58, z, 20, 20);
  }
  // keep and gate
  m.cbox(0, 0, -2, 30, 70, 26, { side: 'stone', top: 'stone_smooth' }, { tint: 0xe6e2ea });
  battlements(m, r, 0, 70, -2, 30, 26);
  m.box(-8, 0, 30.6, 16, 22, 1, 'cave_dark', { bevel: 0 });
  m.box(-9, 22, 30.6, 18, 2, 1.5, 'plank_dark');
  banner(m, -30, 50, 36.4, 10, 20);
  banner(m, 0, 62, 11.4, 12, 24);
  ivy(m, 20, 4, 30, 31, r, 'pz', 5);
  return m;
};
const temple = (c: BuildCtx) => {
  const m = new Model();
  const r = c.rnd;
  stairs(m, r, 30, 1, 12, 3, 'stone', false);
  m.parts.forEach((p) => (p.z += 26));
  m.cbox(0, 0, -6, 70, 12, 56, { side: 'stone_mossy', top: 'stone' });
  for (const x of [-26, -10, 10, 26]) m.cbox(x, 12, 14, 8, 44, 8, { side: 'stone', end: 'stone_smooth' });
  m.cbox(0, 12, -14, 60, 44, 28, 'stone_mossy');
  m.cbox(0, 56, 0, 70, 6, 50, 'stone');
  m.cbox(0, 62, 0, 50, 6, 36, 'stone');
  m.cbox(0, 68, 0, 30, 6, 22, 'stone_cracked');
  m.box(-8, 12, 0.2, 16, 26, 1, 'cave_dark', { bevel: 0 });
  banner(m, 18, 52, 19, 10, 22);
  for (const x of [-30, 30]) m.add(flame(x, 12, 20, 3));
  for (const x of [-30, 30]) m.cbox(x, 12, 20, 6, 0.5, 6, 'ember_bed', { glow: 1 });
  ivy(m, -24, 14, 54, 18, r, 'pz', 6);
  return m;
};
const overgrownRuins = (c: BuildCtx) => {
  const m = new Model();
  const r = c.rnd;
  wall(m, r, -36, 34, -24, 56, 12, 'stone_mossy', 0.6);
  for (let z = -16; z < 24; z += 10) blockGrid(m, r, -36, 0, z, 1, Math.max(1, Math.round(rr(r, 1, 5))), 1, 10, 'stone_mossy');
  stairs(m, r, 24, 2, 24, 4, 'stone_mossy', false);
  m.parts.slice(-4).forEach((p) => (p.x += 16));
  for (let i = 0; i < 10; i++) m.cbox(rr(r, -30, 30), 0, rr(r, -16, 30), rr(r, 4, 9), rr(r, 3, 8), rr(r, 4, 9), 'leaves', { bevel: 0, anim: { kind: 'sway', amp: 0.008, speed: 1.6 } });
  ivy(m, -10, 8, 50, -18, r, 'pz', 10);
  return m;
};

// ---------------------------------------------------------------- 10. extra objects

const obelisk = (c: BuildCtx) => {
  const m = new Model();
  const r = c.rnd;
  m.cbox(0, 0, 0, 26, 6, 26, 'stone_mossy');
  m.cbox(0, 6, 0, 20, 6, 20, 'stone');
  m.cbox(0, 12, 0, 13, 50, 13, { side: 'stone_smooth', end: 'stone_smooth' }, { tint: 0xc8c0cc });
  m.cbox(0, 62, 0, 9, 5, 9, 'stone_smooth', { tint: 0xc8c0cc });
  m.cbox(0, 67, 0, 4, 4, 4, 'stone_smooth', { tint: 0xc8c0cc });
  for (let y = 22; y < 56; y += 9) m.box(-2, y, 6.6, 4, 4, 0.6, 'stone_dark', { bevel: 0 });
  mossTop(m, r, 0, 12, 10, 18, 4, 1);
  return m;
};
/** Statue of a robed figure (or broken: no head, cracked arm, rubble). */
function statue(broken: boolean) {
  return (c: BuildCtx) => {
    const m = new Model();
    const r = c.rnd;
    const t = { side: broken ? 'stone_cracked' : 'stone_smooth', end: 'stone_smooth' };
    m.cbox(0, 0, 0, 28, 6, 26, 'stone_mossy');
    m.cbox(0, 6, 0, 22, 6, 20, 'stone');
    m.cbox(0, 12, 0, 16, 20, 12, t, { tint: 0xc0b8c4 }); // robe / legs
    m.cbox(0, 32, 0, 18, 16, 12, t, { tint: 0xc8c0cc }); // torso
    m.cbox(-11, 26, 0, 5, 20, 6, t, { tint: 0xc0b8c4 }); // left arm
    if (!broken) {
      m.cbox(11, 26, 0, 5, 20, 6, t, { tint: 0xc0b8c4 });
      m.cbox(0, 48, 0, 11, 11, 11, t, { tint: 0xd0c8d4 }); // head
      m.cbox(0, 55, 0, 12, 3, 12, t, { tint: 0xb8b0bc }); // hood
      m.cbox(12, 12, 6, 3, 50, 3, 'stone_smooth', { tint: 0xa8a0ac }); // staff
    } else {
      m.cbox(11, 38, 0, 5, 8, 6, t, { tint: 0xc0b8c4 }); // stump
      m.cbox(1, 48, 0, 6, 3, 6, 'stone_cracked'); // neck stump
      stone(m, 16, 0, 16, 9, r, 'stone_cracked');
      stone(m, -14, 0, 18, 7, r, 'stone_cracked');
      m.cbox(10, 0, 18, 10, 9, 9, t, { tint: 0xd0c8d4, rot: { y: 0.6, z: 0.3 } }); // fallen head
    }
    mossTop(m, r, 0, 12, 8, 20, 6, 1);
    ivy(m, -6, 8, broken ? 40 : 30, 6, r, 'pz', broken ? 6 : 3);
    return m;
  };
}
const firePit = (c: BuildCtx) => {
  const m = new Model();
  const r = c.rnd;
  m.cbox(0, 0, 0, 40, 2, 40, 'path_flag', { bevel: 0 });
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    m.cbox(Math.cos(a) * 15, 2, Math.sin(a) * 15, 9, rr(r, 5, 8), 9, 'stone', { rot: { y: -a }, tint: pick(r, TINTS) });
  }
  m.cbox(0, 2, 0, 18, 1, 18, 'ember_bed', { glow: 1.3, flicker: 0.6, bevel: 0 });
  for (let i = 0; i < 3; i++) m.cbox(0, 3, 0, 3, 3, 16, { side: 'bark', end: 'log_end' }, { rot: { y: (i * Math.PI) / 3 } });
  m.add(flame(0, 4, 0, 7, { smoke: true, lightK: 1.4 }));
  return m;
};
const shrine = (c: BuildCtx) => {
  const m = new Model();
  const r = c.rnd;
  m.cbox(0, 0, 0, 34, 6, 34, 'stone_mossy');
  m.cbox(0, 6, 0, 26, 6, 26, 'stone');
  m.cbox(0, 12, 0, 14, 36, 14, { side: 'stone_smooth', end: 'stone_smooth' }, { tint: 0xc0b8c8 });
  m.cbox(0, 48, 0, 10, 8, 10, 'stone_smooth', { tint: 0xc0b8c8 });
  m.cbox(0, 56, 0, 4, 6, 4, 'stone_smooth', { tint: 0xc0b8c8 });
  // glowing blue gem set into the front
  m.box(-3.5, 26, 6.6, 7, 12, 1.5, 'crystal_blue', { glow: 1.8, bevel: 0, noAO: true });
  for (const [x, z] of [[-13, 13], [13, 13]] as const) m.cbox(x, 12, z, 3, 6, 3, 'crystal_blue', { glow: 1.3, noAO: true });
  m.light(0, 32, 10, 0x4a9aff, 1.1, 7, 0.05, 0.6);
  m.emit({ kind: 'motes', x: 0, y: 20, z: 6, count: 8, spread: 10, height: 40, color: 0x7ac0ff, size: 1.4 });
  mossTop(m, r, 0, 12, 10, 20, 6, 1);
  return m;
};

// ---------------------------------------------------------------- registry

const T = 'stone' as const;
export const STONE_PROPS: PropDef[] = [
  // 1. crags
  { id: 'rock_low', name: 'Низкие скалы', category: T, size: [2, 2], solid: true, variants: 3, tags: ['rock'], build: rockLow },
  { id: 'rock_mid', name: 'Средние скалы', category: T, size: [2, 2], solid: true, variants: 3, tags: ['rock'], build: rockMid },
  { id: 'rock_high', name: 'Высокие скалы', category: T, size: [2, 2], solid: true, variants: 3, tags: ['rock'], build: rockHigh },
  { id: 'rock_sharp', name: 'Острые скалы', category: T, size: [2, 2], solid: true, variants: 3, tags: ['rock'], build: rockSharp },
  { id: 'cliff', name: 'Обрывы / утёсы', category: T, size: [3, 2], solid: true, variants: 3, tags: ['rock', 'cliff'], build: cliff },
  // 2+3. block shapes (rock_block variants = the ten textures)
  { id: 'rock_block', name: 'Базовый блок', category: T, size: [1, 1], solid: true, variants: ROCK_TEX.length, tags: ['rock', 'block'], build: rockBlock },
  { id: 'rock_corner', name: 'Угловой блок', category: T, size: [1, 1], solid: true, tags: ['rock', 'block'], build: rockCorner },
  { id: 'rock_step', name: 'Ступень', category: T, size: [1, 1], solid: true, tags: ['rock', 'block'], build: rockStep },
  { id: 'rock_slope', name: 'Наклонный блок', category: T, size: [1, 1], solid: true, tags: ['rock', 'block'], build: rockSlope },
  { id: 'rock_slab', name: 'Плита', category: T, size: [1, 1], solid: false, deck: () => 0, tags: ['rock', 'block'], build: rockSlab },
  { id: 'rock_column', name: 'Колонна', category: T, size: [1, 1], solid: true, tags: ['rock', 'block'], build: rockColumn },
  { id: 'rock_arch', name: 'Арка', category: T, size: [2, 1], solid: false, tags: ['rock', 'block'], build: rockArch },
  { id: 'rock_joint', name: 'Соединение', category: T, size: [2, 1], solid: true, tags: ['rock', 'block'], build: rockJoint },
  { id: 'rock_cliff_block', name: 'Обрыв', category: T, size: [2, 1], solid: true, tags: ['rock', 'block'], build: rockCliffBlock },
  { id: 'rock_mossy', name: 'Камень с мхом', category: T, size: [2, 2], solid: true, tags: ['rock', 'block'], build: rockMossy },
  { id: 'rock_tall', name: 'Высокая скала', category: T, size: [2, 2], solid: true, variants: 5, tags: ['rock', 'block'], build: rockTall },
  // 4. mountain paths (decks so they can bridge uneven ground)
  { id: 'path_narrow', name: 'Узкая тропа', category: T, size: [1, 3], solid: false, deck: () => 0, tags: ['path'], build: pathPiece(1.5) },
  { id: 'path_medium', name: 'Средняя тропа', category: T, size: [2, 3], solid: false, deck: () => 0, tags: ['path'], build: pathPiece(2) },
  { id: 'path_wide', name: 'Широкая тропа', category: T, size: [3, 3], solid: false, deck: () => 0, tags: ['path'], build: pathPiece(3) },
  { id: 'mountain_stair', name: 'Лестница в горе', category: T, size: [2, 3], solid: false, deck: climbDeck(3, 2), tags: ['path', 'stairs'], build: mountainStair },
  { id: 'danger_path', name: 'Опасный путь', category: T, size: [2, 3], solid: false, deck: () => 1, tags: ['path', 'bridge'], build: dangerPath },
  // 5. slopes and transitions
  { id: 'slope_gentle', name: 'Плавный склон', category: T, size: [2, 3], solid: false, deck: climbDeck(3, 1), tags: ['slope'], build: slopeGentle },
  { id: 'slope_steep', name: 'Крутой склон', category: T, size: [2, 3], solid: false, deck: climbDeck(3, 2), tags: ['slope', 'stairs'], build: slopeSteep },
  { id: 'stone_stair', name: 'Каменная лестница', category: T, size: [2, 3], solid: false, deck: climbDeck(3, 2), tags: ['stairs'], build: stoneStair },
  { id: 'terraces', name: 'Террасы', category: T, size: [3, 3], solid: false, deck: climbDeck(3, 2), tags: ['slope'], build: terraces },
  // 6. caves
  { id: 'cave_small', name: 'Малый вход', category: T, size: [3, 2], solid: (fx, fz) => !(fx === 1 && fz === 1), tags: ['cave'], build: caveSmall },
  { id: 'cave_medium', name: 'Средний вход', category: T, size: [3, 3], solid: (fx, fz) => !(fx === 1 && fz >= 1), tags: ['cave'], build: caveMedium },
  { id: 'cave_large', name: 'Большой вход', category: T, size: [4, 3], solid: (fx, fz) => !((fx === 1 || fx === 2) && fz >= 1), tags: ['cave'], build: caveLarge },
  { id: 'cave_mine', name: 'В шахту', category: T, size: [3, 3], solid: (fx, fz) => !(fx === 1 && fz >= 1), tags: ['cave', 'mine'], build: caveMine },
  { id: 'cave_ruins', name: 'В руины', category: T, size: [3, 3], solid: (fx, fz) => !(fx === 1 && fz >= 1), tags: ['cave', 'ruins'], build: caveRuins },
  // 7. cave interiors
  { id: 'crystal_cluster', name: 'С кристаллами', category: T, size: [1, 1], solid: true, variants: 2, tags: ['cave', 'magic'], build: crystalCluster },
  { id: 'mine_rails', name: 'Рельсы шахты', category: T, size: [1, 3], solid: (_x, _z, c) => c.variant === 1, variants: 2, tags: ['cave', 'mine'], build: mineRails },
  { id: 'mine_support', name: 'Шахта (крепь)', category: T, size: [3, 1], solid: (fx) => fx !== 1, tags: ['cave', 'mine'], build: mineSupport },
  { id: 'stalagmites', name: 'Обычная пещера', category: T, size: [2, 2], solid: true, variants: 2, tags: ['cave'], build: stalagmites },
  { id: 'cave_pool', name: 'Подземное озеро', category: T, size: [3, 3], solid: true, tags: ['cave', 'water'], build: cavePool },
  { id: 'temple_pillar', name: 'Зал / пещерный храм', category: T, size: [1, 1], solid: true, tags: ['cave', 'temple'], build: templePillar },
  // 8. ruins
  { id: 'ruin_wall', name: 'Разрушенная стена', category: T, size: [3, 1], solid: true, tags: ['ruins'], build: ruinWall },
  { id: 'ruin_columns', name: 'Колонны', category: T, size: [2, 1], solid: true, tags: ['ruins'], build: ruinColumns },
  { id: 'ruin_arch', name: 'Арка руин', category: T, size: [3, 1], solid: (fx) => fx !== 1, tags: ['ruins'], build: ruinArch },
  { id: 'ruin_stairs', name: 'Лестница руин', category: T, size: [2, 2], solid: false, deck: (_x, fz) => (fz === 0 ? 1 : 0), tags: ['ruins', 'stairs'], build: ruinStairs },
  { id: 'ruin_platform', name: 'Площадка', category: T, size: [2, 2], solid: false, deck: () => 1, tags: ['ruins'], build: ruinPlatform },
  // 9. ruin buildings
  { id: 'ruin_tower', name: 'Башня', category: T, size: [2, 2], solid: true, tags: ['ruins', 'building'], build: tower },
  { id: 'round_tower', name: 'Круглая башня', category: T, size: [2, 2], solid: true, tags: ['ruins', 'building'], build: roundTower },
  { id: 'castle', name: 'Замок / крепость', category: T, size: [3, 3], solid: true, tags: ['ruins', 'building'], build: castle },
  { id: 'temple', name: 'Храм', category: T, size: [3, 3], solid: (_x, fz) => fz < 2, tags: ['ruins', 'building'], build: temple },
  { id: 'overgrown_ruins', name: 'Заросшие руины', category: T, size: [3, 3], solid: (fx, fz) => fz === 0 || fx === 0, tags: ['ruins'], build: overgrownRuins },
  // 10. extra objects
  { id: 'obelisk', name: 'Каменный обелиск', category: T, size: [1, 1], solid: true, tags: ['ruins'], build: obelisk },
  { id: 'statue', name: 'Статуя', category: T, size: [1, 1], solid: true, tags: ['ruins'], build: statue(false) },
  { id: 'statue_broken', name: 'Разрушенная статуя', category: T, size: [1, 1], solid: true, tags: ['ruins'], build: statue(true) },
  { id: 'fire_pit', name: 'Кострище', category: T, size: [2, 2], solid: true, height: 0.5, tags: ['fire', 'camp'], build: firePit },
  { id: 'shrine', name: 'Святилище', category: T, size: [1, 1], solid: true, tags: ['magic', 'ruins'], build: shrine },
];
