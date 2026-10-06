import * as THREE from 'three';
import { getModel, PROJECTILE_MODELS, PICKUP_MODELS } from '../models';
import { buildVoxelGeometry } from './VoxelGeometry';
import { makeVoxelMaterial } from './Materials';
import { makeBlockTexture } from './Textures';

let gl: THREE.WebGLRenderer | null = null;
let scene: THREE.Scene;
let camera: THREE.PerspectiveCamera;
let material: THREE.MeshLambertMaterial;
const cache = new Map<string, string>();
const SIZE = 160;

function init(): boolean {
  if (gl) return true;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = SIZE;
    gl = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
    gl.setPixelRatio(1);
    gl.setSize(SIZE, SIZE, false);
    gl.outputColorSpace = THREE.SRGBColorSpace;
    scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xffffff, 0x404050, 1.6));
    const sun = new THREE.DirectionalLight(0xffffff, 2.2);
    sun.position.set(3, 6, 5);
    scene.add(sun);
    camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
    material = makeVoxelMaterial({ map: makeBlockTexture() });
    return true;
  } catch {
    gl = null;
    return false;
  }
}

/**
 * Renders a voxel model to a transparent PNG data URL (3/4 view) for menu cards.
 * One shared offscreen context; results are cached by id.
 */
export function modelThumb(id: string, opts: { silhouette?: boolean } = {}): string {
  const key = id + (opts.silhouette ? ':s' : '');
  const hit = cache.get(key);
  if (hit) return hit;
  const model = getModel(id) ?? PROJECTILE_MODELS[id] ?? PICKUP_MODELS[id];
  if (!model || !init() || !gl) return '';
  const geo = buildVoxelGeometry(model, { frame: -1 });
  geo.computeBoundingBox();
  const bb = geo.boundingBox!;
  const center = bb.getCenter(new THREE.Vector3());
  const size = bb.getSize(new THREE.Vector3());
  const mat = opts.silhouette ? new THREE.MeshBasicMaterial({ color: 0x14121c }) : material;
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.sub(center);
  mesh.rotation.y = 0;
  const pivot = new THREE.Group();
  pivot.add(mesh);
  pivot.rotation.y = -0.55;
  scene.add(pivot);
  const r = Math.max(size.x, size.y, size.z) * 0.62 + 0.05;
  const dist = r / Math.tan((camera.fov * Math.PI) / 360);
  camera.position.set(0, dist * 0.32, dist);
  camera.lookAt(0, 0, 0);
  gl.setClearColor(0x000000, 0);
  gl.render(scene, camera);
  const url = gl.domElement.toDataURL('image/png');
  scene.remove(pivot);
  geo.dispose();
  if (opts.silhouette) (mat as THREE.Material).dispose();
  cache.set(key, url);
  return url;
}

export function thumbImg(id: string, cls = 'thumb', silhouette = false): HTMLImageElement {
  const img = new Image();
  img.className = cls;
  img.alt = '';
  img.draggable = false;
  const url = modelThumb(id, { silhouette });
  if (url) img.src = url;
  return img;
}
