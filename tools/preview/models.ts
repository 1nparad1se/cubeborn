/**
 * Model preview (dev tool): creature/NPC models from getModel(id) in a row on flat ground.
 * /tools/preview/models.html?k=orc_grunt,orc_brute[&yaw=30][&pitch=35][&zoom=1][&cols=8]
 * Enemy defs' size multiplier is applied. Screenshot with models-shot.mjs.
 */
import * as THREE from 'three';
import { getModel } from '../../src/models';
import { ENEMY_BY_ID } from '../../src/data/enemies';
import { buildVoxelGeometry } from '../../src/render/VoxelGeometry';
import { getSkinMaterial } from '../../src/render/creatureSkins';

const q = new URLSearchParams(location.search);
const ids = (q.get('k') ?? '').split(',').filter((k) => getModel(k));
const cols = Number(q.get('cols') ?? Math.min(ids.length, 8));
const yaw = (Number(q.get('yaw') ?? 25) * Math.PI) / 180;
const pitch = (Number(q.get('pitch') ?? 30) * Math.PI) / 180;
const zoom = Number(q.get('zoom') ?? 1);
const gap = 2.4;

const gl = new THREE.WebGLRenderer({ antialias: true });
gl.outputColorSpace = THREE.SRGBColorSpace;
gl.toneMapping = THREE.ACESFilmicToneMapping;
gl.setSize(innerWidth, innerHeight);
document.body.appendChild(gl.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9cc4d8);
scene.add(new THREE.HemisphereLight(0xdfefff, 0x5a6a4a, 2.2));
const sun = new THREE.DirectionalLight(0xfff0d8, 2.4);
sun.position.set(-6, 12, 8);
scene.add(sun);
const rows = Math.ceil(ids.length / cols);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(cols * gap + 6, rows * gap + 6), new THREE.MeshLambertMaterial({ color: 0x6a9a4a }));
ground.rotation.x = -Math.PI / 2;
scene.add(ground);
ids.forEach((id, i) => {
  const m = getModel(id)!;
  const mat = getSkinMaterial(m, {});
  const g = buildVoxelGeometry(m, { skin: !!mat });
  const mesh = new THREE.Mesh(g, mat ?? new THREE.MeshLambertMaterial({ vertexColors: true }));
  const s = ENEMY_BY_ID[id]?.size ?? 1;
  mesh.scale.setScalar(s);
  mesh.position.set(((i % cols) - (cols - 1) / 2) * gap, 0, (Math.floor(i / cols) - (rows - 1) / 2) * gap);
  scene.add(mesh);
});
document.getElementById('lbl')!.textContent = ids.map((id, i) => (i % cols === 0 && i ? '\n' : '') + id).join('  ');
const cam = new THREE.PerspectiveCamera(30, innerWidth / innerHeight, 0.1, 200);
const dist = (Math.max(cols * gap, rows * gap * 1.6) * 1.1 + 2) / zoom;
cam.position.set(Math.sin(yaw) * Math.cos(pitch) * dist, Math.sin(pitch) * dist + 0.6, Math.cos(yaw) * Math.cos(pitch) * dist);
cam.lookAt(0, 0.7, 0);
gl.render(scene, cam);
(window as unknown as { previewReady: boolean }).previewReady = true;
