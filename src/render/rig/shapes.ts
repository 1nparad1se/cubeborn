import * as THREE from 'three';

export type V3 = [number, number, number];

/** Primitive kinds a rig part can use. All are flat shaded to keep the stylized voxel look. */
export type ShapeKind = 'box' | 'rbox' | 'cyl' | 'ball' | 'gem';

/**
 * One piece of a character model, in voxel units relative to its bone's joint.
 * Boxes can taper and shear their top face, which is what turns blocks into torsos,
 * robes, boots, hoods and helmets.
 */
export interface RigPart {
  /** Bone the part is attached to. */
  b: string;
  s?: ShapeKind;
  /** Centre of the part. */
  p: V3;
  /** Size (w, h, d). For 'cyl' w/d are diameters. */
  d: V3;
  c: number;
  /** Top face scale (x, z) relative to the bottom face. */
  t?: [number, number];
  /** Top face offset (x, z) in voxels. */
  sh?: [number, number];
  /** Rotation in degrees around the part centre. */
  r?: V3;
  /** Cylinder segment count. */
  n?: number;
  /** Rendered bright regardless of light (eyes, runes, crystals). */
  g?: boolean;
  /** Visibility group: toggled by animation clips (e.g. an arrow nocked during a draw). */
  grp?: string;
  /** Skips the painted bottom-to-top shading (small details, glowing bits). */
  flat?: boolean;
  /** 'rbox' chamfers: vertical edges, top edges and bottom edges (voxels). */
  bv?: [number, number?, number?];
}

const tmpC = new THREE.Color();
const tmpV = new THREE.Vector3();
const tmpN = new THREE.Vector3();
const e1 = new THREE.Vector3();
const e2 = new THREE.Vector3();
const euler = new THREE.Euler();
const quat = new THREE.Quaternion();
const DEG = Math.PI / 180;

/** Collects triangles for one mesh: positions, flat normals, uvs, colors and glow. */
export class GeoSink {
  pos: number[] = [];
  nor: number[] = [];
  uv: number[] = [];
  col: number[] = [];
  glow: number[] = [];

  get empty(): boolean {
    return this.pos.length === 0;
  }

  build(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setAttribute('aGlow', new THREE.Float32BufferAttribute(this.glow, 1));
    g.computeBoundingSphere();
    return g;
  }
}

/**
 * Appends a part to a sink. Coordinates are scaled by `scale` (world units per voxel).
 * Vertex colors get a soft painted gradient: darker toward the bottom of each part and
 * brighter on up-facing faces, which reads as hand-painted shading from the game camera.
 */
export function addPart(sink: GeoSink, part: RigPart, scale: number) {
  const tris = shapeTriangles(part);
  const [w, h, d] = part.d;
  euler.set((part.r?.[0] ?? 0) * DEG, (part.r?.[1] ?? 0) * DEG, (part.r?.[2] ?? 0) * DEG);
  quat.setFromEuler(euler);
  tmpC.setHex(part.c);
  const glow = part.g ? 1 : 0;
  const shade = !part.flat && !part.g;
  for (let i = 0; i < tris.length; i += 9) {
    // flat normal from the untransformed triangle, then rotated
    e1.set(tris[i + 3] - tris[i], tris[i + 4] - tris[i + 1], tris[i + 5] - tris[i + 2]);
    e2.set(tris[i + 6] - tris[i], tris[i + 7] - tris[i + 1], tris[i + 8] - tris[i + 2]);
    tmpN.crossVectors(e1, e2).normalize().applyQuaternion(quat);
    const up = tmpN.y;
    for (let k = 0; k < 3; k++) {
      const lx = tris[i + k * 3];
      const ly = tris[i + k * 3 + 1];
      const lz = tris[i + k * 3 + 2];
      tmpV.set(lx, ly, lz).applyQuaternion(quat);
      sink.pos.push((tmpV.x + part.p[0]) * scale, (tmpV.y + part.p[1]) * scale, (tmpV.z + part.p[2]) * scale);
      sink.nor.push(tmpN.x, tmpN.y, tmpN.z);
      // uv: planar by the dominant normal axis so the pixel texture keeps a constant density
      const ax = Math.abs(tmpN.x);
      const ay = Math.abs(tmpN.y);
      const az = Math.abs(tmpN.z);
      if (ay >= ax && ay >= az) sink.uv.push(lx * 0.5, lz * 0.5);
      else if (ax >= az) sink.uv.push(lz * 0.5, ly * 0.5);
      else sink.uv.push(lx * 0.5, ly * 0.5);
      let m = 1;
      if (shade) {
        const fy = h > 0 ? (ly + h / 2) / h : 0.5;
        m = 0.8 + 0.2 * Math.min(1, Math.max(0, fy));
        if (up > 0.6) m *= 1.08;
        else if (up < -0.6) m *= 0.78;
      }
      sink.col.push(Math.min(1, tmpC.r * m), Math.min(1, tmpC.g * m), Math.min(1, tmpC.b * m));
      sink.glow.push(glow);
    }
  }
  void w;
  void d;
}

/** Triangles (x,y,z * 3 per tri) of a part centred at the origin, before rotation. */
function shapeTriangles(part: RigPart): number[] {
  switch (part.s ?? 'box') {
    case 'cyl':
      return cylinder(part);
    case 'ball':
      return polyhedron(part, new THREE.IcosahedronGeometry(1, 1));
    case 'gem':
      return polyhedron(part, new THREE.OctahedronGeometry(1, 0));
    case 'rbox':
      return roundedBox(part);
    default:
      return box(part);
  }
}

function quad(out: number[], a: V3, b: V3, c: V3, d: V3) {
  out.push(...a, ...b, ...c, ...a, ...c, ...d);
}

function box(part: RigPart): number[] {
  const [w, h, d] = part.d;
  const tx = part.t?.[0] ?? 1;
  const tz = part.t?.[1] ?? 1;
  const sx = part.sh?.[0] ?? 0;
  const sz = part.sh?.[1] ?? 0;
  const x0 = -w / 2;
  const x1 = w / 2;
  const z0 = -d / 2;
  const z1 = d / 2;
  const y0 = -h / 2;
  const y1 = h / 2;
  const X0 = x0 * tx + sx;
  const X1 = x1 * tx + sx;
  const Z0 = z0 * tz + sz;
  const Z1 = z1 * tz + sz;
  // bottom corners b**, top corners t**
  const b00: V3 = [x0, y0, z0];
  const b10: V3 = [x1, y0, z0];
  const b11: V3 = [x1, y0, z1];
  const b01: V3 = [x0, y0, z1];
  const t00: V3 = [X0, y1, Z0];
  const t10: V3 = [X1, y1, Z0];
  const t11: V3 = [X1, y1, Z1];
  const t01: V3 = [X0, y1, Z1];
  const o: number[] = [];
  quad(o, b01, b11, t11, t01); // front +z
  quad(o, b10, b00, t00, t10); // back -z
  quad(o, b11, b10, t10, t11); // right +x
  quad(o, b00, b01, t01, t00); // left -x
  quad(o, t01, t11, t10, t00); // top
  quad(o, b00, b10, b11, b01); // bottom
  return o;
}

/**
 * Box with chamfered vertical edges and bevelled top (and optionally bottom) edges: an
 * octagonal prism in three or four rings. Keeps the blocky read while losing the hard cube.
 */
function roundedBox(part: RigPart): number[] {
  const [w, h, d] = part.d;
  const tx = part.t?.[0] ?? 1;
  const tz = part.t?.[1] ?? 1;
  const sx = part.sh?.[0] ?? 0;
  const sz = part.sh?.[1] ?? 0;
  const side = Math.min(part.bv?.[0] ?? Math.min(w, d) * 0.22, Math.min(w, d) * 0.45);
  const top = Math.min(part.bv?.[1] ?? Math.min(w, h, d) * 0.18, h * 0.45);
  const bot = Math.min(part.bv?.[2] ?? 0, h * 0.45);
  // octagon in the unit footprint: corners cut by `side`
  const poly = (hw: number, hd: number, c: number): [number, number][] => {
    const cx = Math.min(c, hw * 0.9);
    const cz = Math.min(c, hd * 0.9);
    return [
      [hw - cx, hd], [-(hw - cx), hd], [-hw, hd - cz], [-hw, -(hd - cz)],
      [-(hw - cx), -hd], [hw - cx, -hd], [hw, -(hd - cz)], [hw, hd - cz],
    ];
  };
  const level = (y: number, inset: number): V3[] => {
    const f = (y + h / 2) / h;
    const kx = 1 + (tx - 1) * f;
    const kz = 1 + (tz - 1) * f;
    const hw = Math.max(0.01, (w / 2) * kx - inset);
    const hd = Math.max(0.01, (d / 2) * kz - inset);
    return poly(hw, hd, side + inset * 0.6).map(([x, z]) => [x + sx * f, y, z + sz * f] as V3);
  };
  const rings: V3[][] = [];
  if (bot > 0) rings.push(level(-h / 2, bot), level(-h / 2 + bot, 0));
  else rings.push(level(-h / 2, 0));
  rings.push(level(h / 2 - top, 0), level(h / 2, top));
  const o: number[] = [];
  const n = 8;
  // sides: polygon is ordered clockwise seen from above, so walk it in reverse for outward faces
  for (let r = 0; r + 1 < rings.length; r++) {
    const a = rings[r];
    const b = rings[r + 1];
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      quad(o, a[j], a[i], b[i], b[j]);
    }
  }
  const capT = rings[rings.length - 1];
  const capB = rings[0];
  const ct: V3 = [capT.reduce((s, p) => s + p[0], 0) / n, capT[0][1], capT.reduce((s, p) => s + p[2], 0) / n];
  const cb: V3 = [capB.reduce((s, p) => s + p[0], 0) / n, capB[0][1], capB.reduce((s, p) => s + p[2], 0) / n];
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    o.push(...ct, ...capT[j], ...capT[i]);
    o.push(...cb, ...capB[i], ...capB[j]);
  }
  return o;
}

function cylinder(part: RigPart): number[] {
  const n = part.n ?? 8;
  const [w, h, d] = part.d;
  const tx = part.t?.[0] ?? 1;
  const tz = part.t?.[1] ?? tx;
  const sx = part.sh?.[0] ?? 0;
  const sz = part.sh?.[1] ?? 0;
  const o: number[] = [];
  const y0 = -h / 2;
  const y1 = h / 2;
  const ring = (top: boolean, i: number): V3 => {
    const a = ((i + 0.5) / n) * Math.PI * 2;
    const rx = (w / 2) * (top ? tx : 1);
    const rz = (d / 2) * (top ? tz : 1);
    return [Math.sin(a) * rx + (top ? sx : 0), top ? y1 : y0, Math.cos(a) * rz + (top ? sz : 0)];
  };
  const topC: V3 = [sx, y1, sz];
  const botC: V3 = [0, y0, 0];
  for (let i = 0; i < n; i++) {
    const b0 = ring(false, i);
    const b1 = ring(false, i + 1);
    const t0 = ring(true, i);
    const t1 = ring(true, i + 1);
    const topR = Math.abs(t0[0] - t1[0]) + Math.abs(t0[2] - t1[2]) > 1e-4;
    if (topR) quad(o, b0, b1, t1, t0);
    else o.push(...b0, ...b1, ...t0); // cone apex
    if (topR) o.push(...topC, ...t0, ...t1);
    o.push(...botC, ...b1, ...b0);
  }
  return o;
}

function polyhedron(part: RigPart, g: THREE.BufferGeometry): number[] {
  const [w, h, d] = part.d;
  const src = g.index ? g.toNonIndexed() : g;
  const a = src.attributes.position.array as ArrayLike<number>;
  const o: number[] = [];
  for (let i = 0; i < a.length; i += 3) o.push((a[i] * w) / 2, (a[i + 1] * h) / 2, (a[i + 2] * d) / 2);
  g.dispose();
  if (src !== g) src.dispose();
  return o;
}
