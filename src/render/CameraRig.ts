import * as THREE from 'three';

/** Diagonal (isometric-style) follow camera with trauma-based screen shake. */
export class CameraRig {
  readonly camera: THREE.PerspectiveCamera;
  private trauma = 0;
  private tx = 0;
  private tz = 0;
  height = 20;
  back = 13.5;
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
    this.camera = new THREE.PerspectiveCamera(36, aspect, 0.5, 200);
  }

  resize(w: number, h: number) {
    const aspect = w / h;
    this.camera.aspect = aspect;
    // keep at least ~20 world units visible horizontally on narrow screens
    this.camera.fov = aspect < 1 ? 58 : aspect < 1.4 ? 44 : 36;
    this.camera.updateProjectionMatrix();
  }

  get distance(): number {
    return Math.hypot(this.height, this.back) * this.zoom;
  }

  addShake(amount: number) {
    if (this.shake <= 0) return;
    this.trauma = Math.min(1, this.trauma + amount * this.shake);
  }

  snap(x: number, z: number) {
    this.tx = x;
    this.tz = z;
  }

  update(dt: number, x: number, z: number, lead = { x: 0, z: 0 }) {
    const k = 1 - Math.exp(-8 * dt);
    this.tx += (x + lead.x - this.tx) * k;
    this.tz += (z + lead.z - this.tz) * k;
    this.trauma = Math.max(0, this.trauma - dt * 1.6);
    const s = this.trauma * this.trauma * 0.6;
    const ox = (Math.random() * 2 - 1) * s;
    const oz = (Math.random() * 2 - 1) * s;
    this.autoZoom += (this.autoTarget - this.autoZoom) * (1 - Math.exp(-1.5 * dt));
    const h = this.height * this.zoom * this.autoZoom;
    const b = this.back * this.zoom * this.autoZoom;
    this.camera.position.set(this.tx + this.toCam.x * b + ox, h, this.tz + this.toCam.z * b + oz);
    this.camera.lookAt(this.tx + ox * 0.5, 0, this.tz + oz * 0.5);
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

  get target(): { x: number; z: number } {
    return { x: this.tx, z: this.tz };
  }
}
