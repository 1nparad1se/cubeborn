/**
 * Prefab preview (dev tool): renders hand-made structures on a small flat world with the game's
 * block renderer. Open /tools/preview/index.html?k=house_cottage,house_timber[&rot=0][&zoom=1]
 * [&yaw=45][&ground=grass][&night=1]. Used with Playwright to screenshot new prefabs.
 */
import * as THREE from 'three';
import { Terrain } from '../../src/game/Terrain';
import { MAPS } from '../../src/data/maps';
import { WorldRenderer } from '../../src/render/WorldRenderer';
import { PREFABS, collectBuild, placeInst } from '../../src/game/world/build/prefabs';
import '../../src/game/world/build/all';
import { CONTINENT_MAP } from '../../src/data/continentMap';

const q = new URLSearchParams(location.search);
const kinds = (q.get('k') ?? Object.keys(PREFABS).join(',')).split(',').filter((k) => PREFABS[k]);
const rot = Number(q.get('rot') ?? 0);
const yawDeg = Number(q.get('yaw') ?? 45);
const zoom = Number(q.get('zoom') ?? 1);
const ground = q.get('ground') ?? 'grass';
const pitchDeg = Number(q.get('pitch') ?? 52);
const map = q.get('map') === 'forest' ? MAPS[0] : CONTINENT_MAP;

// layout the prefabs in a row with 4 cells between them
const gap = 4;
let x = 8;
let maxD = 0;
const insts = kinds.map((k, i) => {
  const params = (q.get('p') ?? '').split(';')[i]?.split('|').filter(Boolean).map(Number) ?? [];
  const inst = placeInst(k, x, 8, rot, 1234 + i * 77, params.length ? params : undefined);
  x += inst.w + gap;
  maxD = Math.max(maxD, inst.d);
  return inst;
});
const size = Math.max(32, Math.ceil(Math.max(x + 8, maxD + 16) / 2) * 2);
const t = new Terrain(size);
for (const name of Object.keys(map.palette.tiles)) t.tileId(name);
for (let z = 0; z < size; z++) for (let xx = 0; xx < size; xx++) t.setTile(xx, z, ground);
for (const inst of insts) {
  t.builds.push(inst);
  const b = collectBuild(inst, t);
  if (b) for (const l of b.lights) t.lights.push(l);
}
const lbl = document.getElementById('lbl')!;
lbl.textContent = kinds.join('  ·  ');

const gl = new THREE.WebGLRenderer({ antialias: true });
gl.outputColorSpace = THREE.SRGBColorSpace;
gl.toneMapping = THREE.ACESFilmicToneMapping;
gl.toneMappingExposure = 1.2;
gl.shadowMap.enabled = true;
gl.shadowMap.type = THREE.PCFSoftShadowMap;
gl.setSize(innerWidth, innerHeight);
document.body.appendChild(gl.domElement);
const scene = new THREE.Scene();
const p = map.palette;
scene.background = new THREE.Color(p.sky);
const night = q.get('night') === '1';
const hemi = new THREE.HemisphereLight(new THREE.Color(p.ambient).lerp(new THREE.Color(0xa8d8e8), 0.3), new THREE.Color(p.hemiGround).lerp(new THREE.Color(0x284c5a), 0.45), p.ambientIntensity * 3 * (night ? 0.25 : 1));
const sun = new THREE.DirectionalLight(new THREE.Color(p.sun).lerp(new THREE.Color(0xffe0b0), 0.35), p.sunIntensity * 2.4 * (night ? 0.15 : 1));
const cx = (x - gap) / 2 + 4;
const cz = 8 + maxD / 2;
sun.position.set(cx - 30, 50, cz + 20);
sun.target.position.set(cx, 0, cz);
sun.castShadow = true;
sun.shadow.mapSize.set(4096, 4096);
const span = Math.max(x, maxD) * 0.8 + 10;
Object.assign(sun.shadow.camera, { left: -span, right: span, top: span, bottom: -span, near: 1, far: 200 });
sun.shadow.bias = -0.0008;
sun.shadow.normalBias = 0.03;
scene.add(hemi, sun, sun.target);
if (night) for (const l of t.lights.slice(0, 16)) {
  const pl = new THREE.PointLight(l.color, l.intensity * 6, 8, 1.5);
  pl.position.set(l.x, l.y, l.z);
  scene.add(pl);
}
const wr = new WorldRenderer(t, map, null as unknown as THREE.Texture, 'high', false);
scene.add(wr.group);
const fit = Math.max(x - gap, maxD * 1.6) * 0.62 / zoom + 6;
const cam = new THREE.PerspectiveCamera(30, innerWidth / innerHeight, 0.5, 600);
const yaw = (yawDeg * Math.PI) / 180;
const pitch = (pitchDeg * Math.PI) / 180;
const dist = fit / Math.tan((15 * Math.PI) / 180) * 0.55;
cam.position.set(cx + Math.sin(yaw) * Math.cos(pitch) * dist, Math.sin(pitch) * dist, cz + Math.cos(yaw) * Math.cos(pitch) * dist);
cam.lookAt(cx, 2, cz);
wr.uniforms.uFocus.value.set(0, 0, -999);
let time = 0;
function frame() {
  time += 0.016;
  wr.update(time, 0);
  gl.render(scene, cam);
  requestAnimationFrame(frame);
}
frame();
(window as unknown as { previewReady: boolean }).previewReady = true;
