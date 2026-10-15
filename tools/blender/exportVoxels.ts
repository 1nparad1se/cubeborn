// Dumps the Berserker sculpt as rest-pose voxels (bone, centre, size, colour) for the Blender build.
// npx tsx tools/blender/exportVoxels.ts out.json [voxelSize]
import { writeFileSync } from 'node:fs';

const res = Number(process.argv[3] ?? 0.8);
(globalThis as { __VOX_R?: number }).__VOX_R = res;
const { Vox } = await import('../../src/render/rig/voxSculpt');
const out: { b: string; i: number; j: number; k: number; c: number; g: number }[] = [];
const orig = Vox.prototype.part;
Vox.prototype.part = function (this: InstanceType<typeof Vox>, o?: { jitter?: number }) {
  for (const [key, cell] of this.cells) {
    const [i, j, k] = key.split(',').map(Number);
    out.push({ b: this.bone, i, j, k, c: cell.c, g: cell.g });
  }
  return orig.call(this, o);
};
const { berserkerSculptRig } = await import('../../src/models/classRigs/berserkerSculpt');
const { restLayout } = await import('../../src/render/rig/HeroRig');
const def = berserkerSculptRig();
const L = restLayout(def);
const world = (b: string): [number, number, number] => {
  const l = (L as Record<string, { parent: string | null; at: [number, number, number] }>)[b];
  if (!l) return [0, 0, 0];
  const p = l.parent ? world(l.parent) : [0, 0, 0];
  return [p[0] + l.at[0], p[1] + l.at[1], p[2] + l.at[2]];
};
const bones: Record<string, { at: [number, number, number]; parent: string | null }> = {};
for (const [id, l] of Object.entries(L)) bones[id] = { at: world(id), parent: l.parent };
writeFileSync(process.argv[2], JSON.stringify({ res, scale: def.scale, bones, voxels: out }));
console.log('voxels', out.length);
