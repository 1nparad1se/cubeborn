// Dev-only prop sheet: every prop of a category in a grid under the game camera.
// ?cat=lights&night=1&t=1.5&w=1800&h=1000&ids=campfire,lamp_post&cols=6&zoom=1
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { Terrain } from '../../src/game/Terrain';
import { PROPS, propsOf, type PropCategory } from '../../src/world/props/index';
import { footprintSize, placeProp } from '../../src/world/props/place';
import { PropKit } from '../../src/world/render/PropRenderer';
import { paintTile } from '../../src/world/textures/atlas';

const q = new URLSearchParams(location.search);
const cat = (q.get('cat') ?? 'lights') as PropCategory;
const night = q.get('night') === '1';
const T = Number(q.get('t') ?? 1.3);
const W = Number(q.get('w') ?? 1800);
const H = Number(q.get('h') ?? 1000);
const zoom = Number(q.get('zoom') ?? 1);
const defs = q.get('ids') ? q.get('ids')!.split(',').map((id) => PROPS[id]).filter(Boolean) : propsOf(cat);
const cols = Number(q.get('cols') ?? Math.ceil(Math.sqrt(defs.length * 1.6)));

const gl = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
gl.setSize(W, H);
gl.outputColorSpace = THREE.SRGBColorSpace;
gl.toneMapping = THREE.ACESFilmicToneMapping;
gl.toneMappingExposure = 1.2;
gl.shadowMap.enabled = true;
gl.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(gl.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(night ? 0x0c1430 : 0x9fd2ec);
scene.add(new THREE.HemisphereLight(night ? 0x3a4c8a : 0xd6ecff, night ? 0x141a30 : 0x5a7a34, night ? 0.9 : 1.9));
const sun = new THREE.DirectionalLight(night ? 0x7a90d0 : 0xfff1d6, night ? 0.5 : 2.6);
sun.castShadow = true;
scene.add(sun, sun.target);

// lay the props out in a grid on a flat terrain
const cell = 5;
const rows = Math.ceil(defs.length / cols);
const size = Math.ceil((cols + rows) * cell * 0.75) + 12;
const t = new Terrain(size);
const spots: { name: string; x: number; z: number }[] = [];
defs.forEach((d, i) => {
  const [sx, sz] = footprintSize(d, { length: 4 });
  // grid along the screen axes: right = (1, -1)/√2, down = (1, 1)/√2
  const c = (i % cols) - (cols - 1) / 2;
  const r = Math.floor(i / cols) - (rows - 1) / 2;
  const x = Math.round(size / 2 + (c + r) * cell * Math.SQRT1_2) + (sx % 2 ? 0.5 : 0);
  const z = Math.round(size / 2 + (r - c) * cell * Math.SQRT1_2) + (sz % 2 ? 0.5 : 0);
  placeProp(t, d.id, x, z, { variant: q.get('v') ? Number(q.get('v')) : (d.variants ?? 1) > 1 ? 1 : 0, params: { length: 4 } });
  spots.push({ name: d.name + ' · ' + d.id, x, z });
});
const gx = size / 2;
const gz = size / 2;

const grassPx = paintTile('grass_top');
const gtex = new THREE.DataTexture(grassPx, 16, 16, THREE.RGBAFormat);
gtex.magFilter = gtex.minFilter = THREE.NearestFilter;
gtex.wrapS = gtex.wrapT = THREE.RepeatWrapping;
gtex.repeat.set(size * 2, size * 2);
gtex.colorSpace = THREE.SRGBColorSpace;
gtex.needsUpdate = true;
const ground = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshLambertMaterial({ map: gtex }));
ground.rotation.x = -Math.PI / 2;
ground.position.set(size / 2, 0, size / 2);
ground.receiveShadow = true;
scene.add(ground);

const u = { uTime: { value: T }, uNight: { value: night ? 1 : 0 }, uFocus: { value: new THREE.Vector3(0, 0, 9999) }, uCamDir: { value: new THREE.Vector2(Math.SQRT1_2, Math.SQRT1_2) } };
const kit = new PropKit(u, false);
for (const m of kit.build(t.props, true)) scene.add(m);
// every prop light as a real point light (the game uses the nearest few)
for (const l of t.lights) {
  const k = night ? 1.45 : l.day ?? 1;
  const p = new THREE.PointLight(l.color, l.intensity * k * 3, (l.radius ?? 7) * (night ? 1.3 : 1), 1.6);
  p.position.set(l.x, l.y, l.z);
  scene.add(p);
}

// game camera: 45° yaw, 52° pitch, narrow lens
const cam = new THREE.PerspectiveCamera(30, W / H, 1, 600);
const span = Math.max(cols * cell * 0.62, rows * cell * 1.1);
const dist = (span * 1.45 + 6) / zoom;
const pitch = (52 * Math.PI) / 180;
cam.position.set(gx + Math.SQRT1_2 * dist * Math.cos(pitch), dist * Math.sin(pitch), gz + Math.SQRT1_2 * dist * Math.cos(pitch));
cam.lookAt(gx, 0, gz);
sun.position.set(gx - 20, 40, gz + 8);
sun.target.position.set(gx, 0, gz);
const sc = sun.shadow.camera;
sc.left = sc.bottom = -span;
sc.right = sc.top = span;
sc.far = 120;
sun.shadow.mapSize.set(4096, 4096);
sun.shadow.bias = -0.0005;

const composer = new EffectComposer(gl);
composer.addPass(new RenderPass(scene, cam));
composer.addPass(new UnrealBloomPass(new THREE.Vector2(W / 2, H / 2), 0.55, 0.5, 1.05));
composer.addPass(new OutputPass());

cam.updateMatrixWorld();
for (const s of spots) {
  const v = new THREE.Vector3(s.x + 1.1, 0, s.z + 1.1).project(cam);
  const el = document.createElement('div');
  el.className = 'lb';
  el.textContent = s.name;
  el.style.left = ((v.x + 1) / 2) * W + 'px';
  el.style.top = ((1 - v.y) / 2) * H + 'px';
  document.body.appendChild(el);
}

let frames = 0;
const anim = q.get('anim') === '1';
function loop() {
  if (anim) u.uTime.value = T + performance.now() / 1000;
  composer.render();
  if (++frames === 3) (window as unknown as { __done: boolean }).__done = true;
  requestAnimationFrame(loop);
}
loop();
