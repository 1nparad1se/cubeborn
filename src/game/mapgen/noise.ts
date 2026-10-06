import { hash2 } from '../../core/Rng';

function smooth(t: number) {
  return t * t * (3 - 2 * t);
}

/** Value noise in [0,1]. */
export function vnoise(x: number, z: number, seed: number): number {
  const x0 = Math.floor(x);
  const z0 = Math.floor(z);
  const fx = smooth(x - x0);
  const fz = smooth(z - z0);
  const a = hash2(x0, z0, seed);
  const b = hash2(x0 + 1, z0, seed);
  const c = hash2(x0, z0 + 1, seed);
  const d = hash2(x0 + 1, z0 + 1, seed);
  return a + (b - a) * fx + (c - a) * fz + (a - b - c + d) * fx * fz;
}

/** Fractal noise, two octaves. */
export function fbm(x: number, z: number, seed: number): number {
  return vnoise(x, z, seed) * 0.65 + vnoise(x * 2.1, z * 2.1, seed + 17) * 0.35;
}
