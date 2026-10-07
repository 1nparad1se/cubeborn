import * as THREE from 'three';

/** Top-down angled follow camera with trauma-based screen shake. */
export class CameraRig {
  readonly camera: THREE.PerspectiveCamera;
  private trauma = 0;
  private tx = 0;
  private tz = 0;
  height = 19.5;
  back = 11.5;
  /** Screen shake strength 0..1 from settings. */
  shake = 1;
  zoom = 1;

  constructor(aspect: number) {
    this.camera = new THREE.PerspectiveCamera(40, aspect, 0.5, 200);
  }

  resize(w: number, h: number) {
    const aspect = w / h;
    this.camera.aspect = aspect;
    // keep at least ~20 world units visible horizontally on narrow screens
    this.camera.fov = aspect < 1 ? 62 : aspect < 1.4 ? 48 : 40;
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
    const h = this.height * this.zoom;
    const b = this.back * this.zoom;
    this.camera.position.set(this.tx + ox, h, this.tz + b + oz);
    this.camera.lookAt(this.tx + ox * 0.5, 0, this.tz + oz * 0.5);
  }

  get target(): { x: number; z: number } {
    return { x: this.tx, z: this.tz };
  }
}
