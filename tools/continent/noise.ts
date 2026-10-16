// Deterministic noise helpers (detail only — the continent itself is hand-authored in design.ts).
export function hash2(ix: number, iy: number, seed: number): number {
  let h = (ix * 374761393 + iy * 668265263 + seed * 1442695041) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
/** Value noise in [0,1]. */
export function vnoise(x: number, y: number, seed: number): number {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = fade(x - ix), fy = fade(y - iy);
  const a = hash2(ix, iy, seed), b = hash2(ix + 1, iy, seed);
  const c = hash2(ix, iy + 1, seed), d = hash2(ix + 1, iy + 1, seed);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}
/** fBm in roughly [-1,1]. */
export function fbm(x: number, y: number, seed: number, oct = 4): number {
  let s = 0, amp = 1, norm = 0, f = 1;
  for (let i = 0; i < oct; i++) {
    s += (vnoise(x * f, y * f, seed + i * 101) * 2 - 1) * amp;
    norm += amp; amp *= 0.5; f *= 2.03;
  }
  return s / norm;
}
/** Ridged multifractal in [0,1]: sharp crests, used to break ridges into spurs and gullies. */
export function ridged(x: number, y: number, seed: number, oct = 5): number {
  let s = 0, amp = 0.5, f = 1, w = 1, norm = 0;
  for (let i = 0; i < oct; i++) {
    let n = 1 - Math.abs(vnoise(x * f, y * f, seed + i * 57) * 2 - 1);
    n *= n; n *= w; w = Math.min(1, n * 2);
    s += n * amp; norm += amp; amp *= 0.5; f *= 2.1;
  }
  return s / norm;
}
