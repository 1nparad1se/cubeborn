import * as THREE from 'three';
import type { BoneId, HeroRig } from './HeroRig';

/**
 * Binds a ready-made 3D model (for example a .glb made by an artist or an image-to-3D tool) to the
 * game skeleton, so every existing clip, IK and effect drives it. The model is scaled to the rig's
 * height, stood on the ground facing +z, then cut along the skeleton: each triangle goes to the
 * bone segment it sits closest to and is re-expressed in that bone's rest space (rigid skinning,
 * the usual way stylised armoured characters are split for animation).
 */

export interface BindOptions {
  /** Model height in world units (default: the rig's own height estimate). */
  height?: number;
  /** Extra turn (degrees) when the model was made facing another way. */
  yaw?: number;
  /** Rig part meshes to keep (default none: the model replaces the whole body, weapon included). */
  keepBones?: BoneId[];
}

interface Seg {
  bone: BoneId;
  a: THREE.Vector3;
  b: THREE.Vector3;
  /** Distance bias: thin limbs must win near their axis, the torso is broad. */
  w: number;
}

const A = new THREE.Vector3();
const B = new THREE.Vector3();
const C = new THREE.Vector3();

function segDist(p: THREE.Vector3, s: Seg): number {
  A.subVectors(s.b, s.a);
  const t = Math.max(0, Math.min(1, B.subVectors(p, s.a).dot(A) / Math.max(1e-6, A.lengthSq())));
  C.copy(s.a).addScaledVector(A, t);
  return p.distanceTo(C) * s.w;
}

/** Bone segments of the rig in rest pose (root space). */
function segments(rig: HeroRig): Seg[] {
  const saved = rig.root.matrix.clone();
  rig.root.position.set(0, 0, 0);
  rig.root.rotation.set(0, 0, 0);
  rig.root.updateMatrixWorld(true);
  const w = (id: BoneId) => rig.bones[id].getWorldPosition(new THREE.Vector3());
  const off = (id: BoneId, x: number, y: number, z: number) => w(id).add(new THREE.Vector3(x, y, z));
  const headTop = w('head').y + (w('head').y - w('chest').y) * 1.1;
  const list: Seg[] = [
    { bone: 'hips', a: w('hips').setY(w('hips').y - 0.05), b: w('spine'), w: 1.15 },
    { bone: 'spine', a: w('spine'), b: w('chest'), w: 1.1 },
    { bone: 'chest', a: w('chest'), b: w('head'), w: 1.0 },
    { bone: 'head', a: w('head'), b: new THREE.Vector3(0, headTop, 0), w: 0.9 },
    // cloth behind the back follows the cape springs
    { bone: 'capeA', a: w('capeA'), b: w('capeB'), w: 0.8 },
    { bone: 'capeB', a: w('capeB'), b: w('capeB').setY(Math.max(0.05, w('capeB').y - (w('capeA').y - w('capeB').y))), w: 0.8 },
  ];
  for (const s of ['L', 'R'] as const) {
    const hand = w(('hand' + s) as BoneId);
    const fore = w(('fore' + s) as BoneId);
    const handEnd = hand.clone().add(hand.clone().sub(fore).multiplyScalar(0.45));
    list.push(
      { bone: ('arm' + s) as BoneId, a: w(('arm' + s) as BoneId), b: fore, w: 0.9 },
      { bone: ('fore' + s) as BoneId, a: fore, b: hand, w: 0.85 },
      { bone: ('hand' + s) as BoneId, a: hand, b: handEnd, w: 0.8 },
      { bone: ('leg' + s) as BoneId, a: w(('leg' + s) as BoneId), b: w(('shin' + s) as BoneId), w: 0.9 },
      { bone: ('shin' + s) as BoneId, a: w(('shin' + s) as BoneId), b: w(('foot' + s) as BoneId), w: 0.9 },
      { bone: ('foot' + s) as BoneId, a: w(('foot' + s) as BoneId), b: off(('foot' + s) as BoneId, 0, 0, 0.12), w: 0.85 },
    );
  }
  rig.root.matrix.copy(saved);
  rig.root.matrix.decompose(rig.root.position, rig.root.quaternion, rig.root.scale);
  rig.root.updateMatrixWorld(true);
  return list;
}

/** Rough rig height from its skeleton (feet to the top of the head). */
export function rigHeight(rig: HeroRig): number {
  rig.root.updateMatrixWorld(true);
  const head = rig.bones.head.getWorldPosition(new THREE.Vector3()).y - rig.root.position.y;
  const chest = rig.bones.chest.getWorldPosition(new THREE.Vector3()).y - rig.root.position.y;
  return head + (head - chest) * 1.1;
}

/**
 * Cuts `model` along the rig's skeleton and attaches the pieces to the bones. Returns the meshes
 * added (so callers can toggle shadows). The rig's own part meshes are hidden.
 */
export function bindModel(rig: HeroRig, model: THREE.Object3D, o: BindOptions = {}): THREE.Mesh[] {
  const segs = segments(rig);
  const height = o.height ?? rigHeight(rig);
  // normalise: facing, scale to height, feet on the ground, centred
  const holder = new THREE.Group();
  holder.add(model);
  holder.rotation.y = ((o.yaw ?? 0) * Math.PI) / 180;
  holder.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(holder);
  const s = height / Math.max(1e-6, box.max.y - box.min.y);
  const norm = new THREE.Matrix4()
    .makeScale(s, s, s)
    .premultiply(new THREE.Matrix4().makeTranslation(-((box.min.x + box.max.x) / 2) * s, -box.min.y * s, -((box.min.z + box.max.z) / 2) * s));

  // rest-space inverse of every bone
  rig.root.updateMatrixWorld(true);
  const rootInv = rig.root.matrixWorld.clone().invert();
  const boneInv = new Map<BoneId, THREE.Matrix4>();
  for (const sg of segs) if (!boneInv.has(sg.bone)) boneInv.set(sg.bone, new THREE.Matrix4().multiplyMatrices(rootInv, rig.bones[sg.bone].matrixWorld).invert());

  // hide the rig's own body
  const keep = new Set(o.keepBones ?? []);
  for (const id of Object.keys(rig.bones) as BoneId[]) {
    for (const ch of rig.bones[id].children) if ((ch as THREE.Mesh).isMesh && !keep.has(id)) ch.visible = false;
  }

  const out: THREE.Mesh[] = [];
  const P = new THREE.Vector3();
  const N = new THREE.Vector3();
  holder.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;
    const g0 = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry;
    const world = new THREE.Matrix4().multiplyMatrices(norm, mesh.matrixWorld);
    const nmat = new THREE.Matrix3().getNormalMatrix(world);
    const pos = g0.getAttribute('position');
    const nor = g0.getAttribute('normal');
    const uv = g0.getAttribute('uv');
    const col = g0.getAttribute('color');
    const per = new Map<BoneId, { p: number[]; n: number[]; uv: number[]; c: number[] }>();
    const tri = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
    for (let i = 0; i < pos.count; i += 3) {
      for (let k = 0; k < 3; k++) tri[k].fromBufferAttribute(pos, i + k).applyMatrix4(world);
      const cen = P.copy(tri[0]).add(tri[1]).add(tri[2]).multiplyScalar(1 / 3);
      let best = segs[0];
      let bd = Infinity;
      for (const sg of segs) {
        const d = segDist(cen, sg);
        if (d < bd) {
          bd = d;
          best = sg;
        }
      }
      let bucket = per.get(best.bone);
      if (!bucket) per.set(best.bone, (bucket = { p: [], n: [], uv: [], c: [] }));
      const inv = boneInv.get(best.bone)!;
      for (let k = 0; k < 3; k++) {
        const v = tri[k].clone().applyMatrix4(inv);
        bucket.p.push(v.x, v.y, v.z);
        if (nor) {
          N.fromBufferAttribute(nor, i + k).applyMatrix3(nmat).normalize();
          // bone rest rotations are identity, so world normals are bone normals
          bucket.n.push(N.x, N.y, N.z);
        }
        if (uv) bucket.uv.push(uv.getX(i + k), uv.getY(i + k));
        if (col) bucket.c.push(col.getX(i + k), col.getY(i + k), col.getZ(i + k));
      }
    }
    for (const [bone, b] of per) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(b.p, 3));
      if (b.n.length) g.setAttribute('normal', new THREE.Float32BufferAttribute(b.n, 3));
      else g.computeVertexNormals();
      if (b.uv.length) g.setAttribute('uv', new THREE.Float32BufferAttribute(b.uv, 2));
      if (b.c.length) g.setAttribute('color', new THREE.Float32BufferAttribute(b.c, 3));
      const m = new THREE.Mesh(g, mesh.material);
      m.castShadow = true;
      m.name = 'bound:' + bone;
      rig.bones[bone].add(m);
      out.push(m);
    }
  });
  return out;
}

/** Loads a .glb / .gltf and binds it (resolves to the added meshes). */
export async function loadAndBind(rig: HeroRig, url: string, o: BindOptions = {}): Promise<THREE.Mesh[]> {
  const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
  const gltf = await new GLTFLoader().loadAsync(url);
  return bindModel(rig, gltf.scene, o);
}
