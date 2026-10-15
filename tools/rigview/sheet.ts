// Dev-only turnaround sheet of one hero, like a character design sheet:
// ?hero=berserker&anim=idle&t=0.6&views=front,angle,left,back,right,game&w=1800&h=640
import * as THREE from 'three';
import { ALL_RIGS } from './rigsList';
import { berserkerSculptRig } from '../../src/models/classRigs/berserkerSculpt';
import { HeroRig } from '../../src/render/rig/HeroRig';
import { HeroAnimator } from '../../src/render/rig/Animator';
import { makeHeroTexture } from '../../src/render/Textures';

const q = new URLSearchParams(location.search);
const id = q.get('hero') ?? 'berserker';
const animName = q.get('anim') ?? 'idle';
const t = Number(q.get('t') ?? '0.6');
const views = (q.get('views') ?? 'front,angle,left,back,right,game').split(',');
const W = Number(q.get('w') ?? 1800);
const H = Number(q.get('h') ?? 640);
const zoom = Number(q.get('zoom') ?? 1);
const gl = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
gl.setSize(W, H);
gl.outputColorSpace = THREE.SRGBColorSpace;
gl.shadowMap.enabled = true;
gl.setScissorTest(true);
document.body.appendChild(gl.domElement);
const tex = makeHeroTexture();
const YAW: Record<string, number> = { front: 0, angle: -0.6, left: Math.PI / 2, back: Math.PI, right: -Math.PI / 2, game: 0 };
const cw = W / views.length;
views.forEach((v, i) => {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(v === 'game' ? 0x4a6a3a : 0x1d1e24);
  scene.add(new THREE.HemisphereLight(0xe4ecff, 0x3a3444, 1.5));
  const key = new THREE.DirectionalLight(0xfff0dc, 2.6);
  key.position.set(3, 8, 5);
  key.castShadow = true;
  scene.add(key, key.target);
  const rim = new THREE.DirectionalLight(0xff8a80, 1.4);
  rim.position.set(-2, 4, -6);
  scene.add(rim);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.MeshLambertMaterial({ color: v === 'game' ? 0x5a7a42 : 0x26272e }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  const base = id === 'berserker_sculpt' ? berserkerSculptRig() : ALL_RIGS[id];
  const st = q.get('stance');
  const def = st || q.get('noik') ? { ...base, anim: { ...base.anim, stance: st ? JSON.parse(st) : base.anim.stance, twoHand: q.get('noik') ? undefined : base.anim.twoHand } } : base;
  const rig = new HeroRig(def, tex, { shadows: true });
  const a = new HeroAnimator(rig);
  rig.root.rotation.y = YAW[v] ?? 0;
  if (q.get('nosword')) rig.bones.gripR.visible = false;
  scene.add(rig.root);
  if (animName === 'walk' || animName === 'run') a.forceGait = animName;
  else if (animName !== 'idle') a.play(animName as never, { force: true });
  const steps = Math.round(t / 0.01);
  for (let k = 0; k < steps; k++) a.update(0.01);
  if (steps === 0) a.update(0.0001);
  const cam = new THREE.PerspectiveCamera(v === 'game' ? 30 : 24 / zoom, cw / H, 0.1, 100);
  if (v === 'game') {
    cam.position.set(-5.5 / zoom, 9.5 / zoom, 5.5 / zoom);
    cam.lookAt(0, 0.6, 0);
  } else {
    cam.position.set(0, 1.25, 7.5);
    cam.lookAt(0, 1.0, 0);
  }
  gl.setViewport(i * cw, 0, cw, H);
  gl.setScissor(i * cw, 0, cw, H);
  gl.render(scene, cam);
});
(window as unknown as { __done: boolean }).__done = true;
