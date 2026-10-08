// Dev-only contact sheet of every hero rig: ?view=front|back|side|top|game&anim=idle|walk|run|attack...&t=seconds
import * as THREE from 'three';
import { ALL_RIGS as HERO_RIGS, CLASS_IDS } from './rigsList';
import { HeroRig } from '../../src/render/rig/HeroRig';
import { HeroAnimator } from '../../src/render/rig/Animator';
import { makeHeroTexture } from '../../src/render/Textures';

const q = new URLSearchParams(location.search);
const view = q.get('view') ?? 'front';
const animName = q.get('anim') ?? 'idle';
const t = Number(q.get('t') ?? '0.6');
const only = q.get('hero');
const W = 1800, H = 700;
const gl = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
gl.setSize(W, H);
gl.outputColorSpace = THREE.SRGBColorSpace;
gl.shadowMap.enabled = true;
document.body.appendChild(gl.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(view === 'game' ? 0x4a6a3a : 0x2a2f3e);
scene.add(new THREE.HemisphereLight(0xe4ecff, 0x3a3444, 1.6));
const key = new THREE.DirectionalLight(0xfff0dc, 2.6);
key.position.set(3, 8, 5);
key.castShadow = true;
key.shadow.camera.left = -12; key.shadow.camera.right = 12; key.shadow.camera.top = 6; key.shadow.camera.bottom = -6;
scene.add(key, key.target);
const rim = new THREE.DirectionalLight(0x8fc4ff, 2.0);
rim.position.set(-2, 4, -6);
scene.add(rim);
const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 30), new THREE.MeshLambertMaterial({ color: view === 'game' ? 0x5a7a42 : 0x353b4c }));
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);
const tex = makeHeroTexture();
const ids = only ? only.split(',') : CLASS_IDS;
const gap = view === 'game' ? 1.6 : 2.1;
ids.forEach((id, i) => {
  const rig = new HeroRig(HERO_RIGS[id], tex, { shadows: true });
  const a = new HeroAnimator(rig);
  rig.root.position.x = (i - (ids.length - 1) / 2) * gap;
  rig.root.rotation.y = view === 'back' ? Math.PI : view === 'side' ? Math.PI / 2 : view === 'front' ? 0.35 : 0;
  scene.add(rig.root);
  if (animName === 'walk' || animName === 'run') a.forceGait = animName;
  else if (animName === 'jumprise' || animName === 'jumpfall') {
    a.air = true;
    a.airV = animName === 'jumprise' ? 0.8 : -0.8;
    rig.root.position.y = 1.1;
  } else if (animName === 'crouch') a.crouch = 1;
  else if (animName !== 'idle') a.play(animName as never, { force: true });
  const steps = Math.round(t / 0.01);
  for (let k = 0; k < steps; k++) a.update(0.01);
  if (steps === 0) a.update(0.0001);
});
const cam = new THREE.PerspectiveCamera(view === 'game' ? 40 : 22, W / H, 0.1, 100);
const span = ids.length * gap;
if (view === 'top' || view === 'game') {
  cam.position.set(-6, 14, 9);
  cam.lookAt(0, 0, 0);
  if (view === 'game') { cam.position.set(-5.5, 9.5, 5.5); cam.lookAt(0, 0.5, 0); }
} else {
  const d = (span / 2) / Math.tan((22 * Math.PI) / 360) / (W / H) * 1.05 + 2;
  cam.position.set(0, 1.6, Math.max(8, d));
  cam.lookAt(0, 1.0, 0);
}
gl.render(scene, cam);
(window as any).__done = true;
