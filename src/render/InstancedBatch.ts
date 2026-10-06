import * as THREE from 'three';

const m4 = new THREE.Matrix4();
const q = new THREE.Quaternion();
const e = new THREE.Euler();
const pos = new THREE.Vector3();
const scl = new THREE.Vector3();
const col = new THREE.Color();

/**
 * InstancedMesh wrapper filled from scratch every frame. Grows capacity on demand;
 * zero allocations in steady state.
 */
export class InstancedBatch {
  mesh: THREE.InstancedMesh;
  private flash: THREE.InstancedBufferAttribute | null = null;
  count = 0;
  private cap: number;

  constructor(
    private geometry: THREE.BufferGeometry,
    private material: THREE.Material,
    private scene: THREE.Object3D,
    capacity = 64,
    private withFlash = false,
    private castShadow = false,
  ) {
    this.cap = capacity;
    this.mesh = this.create(capacity);
  }

  private create(cap: number): THREE.InstancedMesh {
    const mesh = new THREE.InstancedMesh(this.geometry, this.material, cap);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3).fill(1), 3);
    mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
    if (this.withFlash) {
      this.flash = new THREE.InstancedBufferAttribute(new Float32Array(cap), 1);
      this.flash.setUsage(THREE.DynamicDrawUsage);
      this.geometry.setAttribute('aFlash', this.flash);
    }
    mesh.frustumCulled = false;
    mesh.castShadow = this.castShadow;
    mesh.receiveShadow = false;
    mesh.count = 0;
    this.scene.add(mesh);
    return mesh;
  }

  begin() {
    this.count = 0;
  }

  private ensure() {
    if (this.count < this.cap) return;
    const old = this.mesh;
    const oldFlash = this.flash;
    this.cap *= 2;
    this.scene.remove(old);
    const mesh = this.create(this.cap);
    mesh.instanceMatrix.array.set(old.instanceMatrix.array);
    (mesh.instanceColor!.array as Float32Array).set(old.instanceColor!.array as Float32Array);
    if (oldFlash && this.flash) (this.flash.array as Float32Array).set(oldFlash.array as Float32Array);
    old.dispose();
    this.mesh = mesh;
  }

  /** Adds an instance with yaw/roll rotation and non-uniform scale. */
  push(x: number, y: number, z: number, yaw: number, sx: number, sy: number, sz: number, color = 0xffffff, flash = 0, roll = 0, pitch = 0, bright = 1) {
    this.ensure();
    const i = this.count++;
    pos.set(x, y, z);
    e.set(pitch, yaw, roll, 'YXZ');
    q.setFromEuler(e);
    scl.set(sx, sy, sz);
    m4.compose(pos, q, scl);
    m4.toArray(this.mesh.instanceMatrix.array, i * 16);
    col.setHex(color);
    const c = this.mesh.instanceColor!.array as Float32Array;
    c[i * 3] = col.r * bright;
    c[i * 3 + 1] = col.g * bright;
    c[i * 3 + 2] = col.b * bright;
    if (this.flash) (this.flash.array as Float32Array)[i] = flash;
  }

  /** Fast path: yaw only + uniform scale + raw rgb multiplier. */
  pushFast(x: number, y: number, z: number, yaw: number, s: number, sy: number, r: number, g: number, b: number, flash = 0) {
    this.ensure();
    const i = this.count++;
    const a = this.mesh.instanceMatrix.array as Float32Array;
    const o = i * 16;
    const cy = Math.cos(yaw);
    const sn = Math.sin(yaw);
    a[o] = cy * s;
    a[o + 1] = 0;
    a[o + 2] = -sn * s;
    a[o + 3] = 0;
    a[o + 4] = 0;
    a[o + 5] = sy;
    a[o + 6] = 0;
    a[o + 7] = 0;
    a[o + 8] = sn * s;
    a[o + 9] = 0;
    a[o + 10] = cy * s;
    a[o + 11] = 0;
    a[o + 12] = x;
    a[o + 13] = y;
    a[o + 14] = z;
    a[o + 15] = 1;
    const c = this.mesh.instanceColor!.array as Float32Array;
    c[i * 3] = r;
    c[i * 3 + 1] = g;
    c[i * 3 + 2] = b;
    if (this.flash) (this.flash.array as Float32Array)[i] = flash;
  }

  end() {
    this.mesh.count = this.count;
    if (this.count > 0) {
      this.mesh.instanceMatrix.clearUpdateRanges();
      this.mesh.instanceMatrix.addUpdateRange(0, this.count * 16);
      this.mesh.instanceMatrix.needsUpdate = true;
      this.mesh.instanceColor!.clearUpdateRanges();
      this.mesh.instanceColor!.addUpdateRange(0, this.count * 3);
      this.mesh.instanceColor!.needsUpdate = true;
      if (this.flash) {
        this.flash.clearUpdateRanges();
        this.flash.addUpdateRange(0, this.count);
        this.flash.needsUpdate = true;
      }
    }
  }

  dispose() {
    this.scene.remove(this.mesh);
    this.mesh.dispose();
  }
}
