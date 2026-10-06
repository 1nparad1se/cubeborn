import * as THREE from 'three';

interface Req {
  x: number;
  y: number;
  z: number;
  color: number;
  intensity: number;
  radius: number;
  score: number;
}

interface Flash {
  x: number;
  z: number;
  color: number;
  intensity: number;
  radius: number;
  t: number;
  dur: number;
}

/**
 * Fixed set of point lights reassigned every frame to the most important sources
 * (explosions, torches, glowing projectiles). Fixed count keeps shaders stable.
 */
export class LightPool {
  readonly lights: THREE.PointLight[] = [];
  private reqs: Req[] = [];
  private nReq = 0;
  private flashes: Flash[] = [];

  constructor(scene: THREE.Scene, count: number) {
    for (let i = 0; i < count; i++) {
      const l = new THREE.PointLight(0xffffff, 0, 6, 1.6);
      l.castShadow = false;
      scene.add(l);
      this.lights.push(l);
    }
    for (let i = 0; i < 128; i++) this.reqs.push({ x: 0, y: 0, z: 0, color: 0, intensity: 0, radius: 0, score: 0 });
  }

  begin() {
    this.nReq = 0;
  }

  request(x: number, y: number, z: number, color: number, intensity: number, radius: number, cx: number, cz: number) {
    if (this.nReq >= this.reqs.length || this.lights.length === 0) return;
    const d2 = (x - cx) ** 2 + (z - cz) ** 2;
    if (d2 > 26 * 26) return;
    const r = this.reqs[this.nReq++];
    r.x = x;
    r.y = y;
    r.z = z;
    r.color = color;
    r.intensity = intensity;
    r.radius = radius;
    r.score = intensity / (1 + d2 * 0.02);
  }

  flash(x: number, z: number, color: number, intensity: number, radius: number, dur: number) {
    if (this.flashes.length > 24) this.flashes.shift();
    this.flashes.push({ x, z, color, intensity, radius, t: dur, dur });
  }

  end(dt: number, cx: number, cz: number) {
    for (let i = this.flashes.length - 1; i >= 0; i--) {
      const f = this.flashes[i];
      f.t -= dt;
      if (f.t <= 0) {
        this.flashes.splice(i, 1);
        continue;
      }
      this.request(f.x, 1.2, f.z, f.color, f.intensity * (f.t / f.dur) * 1.5, f.radius, cx, cz);
    }
    const used = this.reqs.slice(0, this.nReq).sort((a, b) => b.score - a.score);
    for (let i = 0; i < this.lights.length; i++) {
      const l = this.lights[i];
      const r = used[i];
      if (!r) {
        l.intensity = 0;
        continue;
      }
      l.position.set(r.x, r.y, r.z);
      l.color.setHex(r.color);
      l.intensity = r.intensity * 3;
      l.distance = r.radius;
    }
  }
}
