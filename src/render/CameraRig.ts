import * as THREE from 'three';

/**
 * Minecraft Dungeons style follow camera: fixed diagonal yaw, pitched ~52 degrees down from a
 * fair distance with a narrow lens, so the hero is small and cliff faces read. Trauma-based shake.
 */
export class CameraRig {
  readonly camera: THREE.PerspectiveCamera;
  private trauma = 0;
  private tx = 0;
  private tz = 0;
  /** Followed ground height (eased, so steps and cliffs glide). */
  private ty = 0;
  /** Downward pitch of the view (radians from horizontal). */
  readonly pitch = (52 * Math.PI) / 180;
  /** Camera distance to the target at zoom 1. */
  readonly baseDist = 34;
  /** Vertical field of view on wide screens (narrow lens for the near-orthographic MCD look). */
  readonly baseFov = 30;
  height = 34 * Math.sin((52 * Math.PI) / 180);
  back = 34 * Math.cos((52 * Math.PI) / 180);
  /** Rotation of the view around the vertical axis: 45° gives the diagonal dungeon-crawler look. */
  readonly yaw = Math.PI / 4;
  /** Horizontal unit vector from the target toward the camera. */
  readonly toCam = { x: Math.sin(Math.PI / 4), z: Math.cos(Math.PI / 4) };
  /** Screen shake strength 0..1 from settings. */
  shake = 1;
  zoom = 1;
  /** Automatic pull-back for big fights (multiplies zoom), eased toward autoTarget. */
  autoZoom = 1;
  autoTarget = 1;
  private ray = new THREE.Raycaster();
  private ndc = new THREE.Vector2();
  private plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private hit = new THREE.Vector3();

  constructor(aspect: number) {
    this.camera = new THREE.PerspectiveCamera(this.baseFov, aspect, 1, 240);
  }

  resize(w: number, h: number) {
    const aspect = w / h;
    this.camera.aspect = aspect;
    // keep at least ~20 world units visible horizontally on narrow screens
    const f = this.baseFov;
    this.camera.fov = aspect < 1 ? f * 1.55 : aspect < 1.4 ? f * 1.2 : f;
    this.camera.updateProjectionMatrix();
  }

  get distance(): number {
    return Math.hypot(this.height, this.back) * this.zoom;
  }

  addShake(amount: number) {
    if (this.shake <= 0) return;
    this.trauma = Math.min(1, this.trauma + amount * this.shake);
  }

  snap(x: number, z: number, y = this.ty) {
    this.tx = x;
    this.tz = z;
    this.ty = y;
  }

  update(dt: number, x: number, z: number, lead = { x: 0, z: 0 }, y = 0) {
    const k = 1 - Math.exp(-8 * dt);
    this.tx += (x + lead.x - this.tx) * k;
    this.tz += (z + lead.z - this.tz) * k;
    this.ty += (y - this.ty) * (1 - Math.exp(-4 * dt));
    this.trauma = Math.max(0, this.trauma - dt * 1.6);
    const s = this.trauma * this.trauma * 0.6;
    const ox = (Math.random() * 2 - 1) * s;
    const oz = (Math.random() * 2 - 1) * s;
    this.autoZoom += (this.autoTarget - this.autoZoom) * (1 - Math.exp(-1.5 * dt));
    const h = this.height * this.zoom * this.autoZoom;
    const b = this.back * this.zoom * this.autoZoom;
    this.camera.position.set(this.tx + this.toCam.x * b + ox, this.ty + h, this.tz + this.toCam.z * b + oz);
    this.camera.lookAt(this.tx + ox * 0.5, this.ty, this.tz + oz * 0.5);
  }

  /** Turns a screen-space input direction (x right, z down) into a world direction. */
  screenToWorld(ix: number, iz: number): [number, number] {
    const c = Math.cos(this.yaw);
    const s = Math.sin(this.yaw);
    return [ix * c + iz * s, -ix * s + iz * c];
  }

  /** World point on the ground plane (height y) under a screen pixel. */
  groundPoint(px: number, py: number, w: number, h: number, y = 0): [number, number] | null {
    this.ndc.set((px / w) * 2 - 1, -(py / h) * 2 + 1);
    this.ray.setFromCamera(this.ndc, this.camera);
    this.plane.constant = -y;
    const p = this.ray.ray.intersectPlane(this.plane, this.hit);
    return p ? [p.x, p.z] : null;
  }

  /**
   * World point on the terrain under a screen pixel: marches the view ray down to the first
   * ground (plus `lift`) it meets, so clicks land on hill tops and cliff feet alike.
   */
  terrainPoint(px: number, py: number, w: number, h: number, ground: (x: number, z: number) => number, lift = 0): [number, number] | null {
    this.ndc.set((px / w) * 2 - 1, -(py / h) * 2 + 1);
    this.ray.setFromCamera(this.ndc, this.camera);
    const o = this.ray.ray.origin;
    const d = this.ray.ray.direction;
    if (d.y >= -0.01) return this.groundPoint(px, py, w, h, this.ty + lift);
    const step = 0.35;
    let prev = 0;
    for (let t = 0; t < 400; t += step) {
      const x = o.x + d.x * t;
      const y = o.y + d.y * t;
      const z = o.z + d.z * t;
      if (y <= ground(x, z) + lift) {
        // refine between the last point above ground and this one
        let a = prev;
        let b = t;
        for (let i = 0; i < 6; i++) {
          const m = (a + b) / 2;
          if (o.y + d.y * m <= ground(o.x + d.x * m, o.z + d.z * m) + lift) b = m;
          else a = m;
        }
        return [o.x + d.x * b, o.z + d.z * b];
      }
      prev = t;
      if (y < -2) break;
    }
    return this.groundPoint(px, py, w, h, lift);
  }

  get target(): { x: number; y: number; z: number } {
    return { x: this.tx, y: this.ty, z: this.tz };
  }
}
