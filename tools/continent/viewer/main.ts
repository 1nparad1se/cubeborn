import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

type P = [number, number];
interface Feat {
  world: number; sea: number; grid: number; sub: string[];
  stats: { biomes: { landPct: Record<string, number>; maxY: Record<string, number> }; landSharePct: number };
  rivers: { id: string; ru: string; pts: number[][] }[];
  routes: { id: string; ru: string; kind: string; legs: { mode: string; label?: string; pts: P[] }[] }[];
  bridges: { at: P; kind: string; ru: string; length: number }[];
  tunnels: { a: P; b: P; ru: string }[];
  passes: { ru: string; at: P }[];
  villages: { id: string; ru: string; at: P }[];
  landmarks: { id: string; ru: string; at: P; kind: string }[];
  waterfalls: { river: string; at: P; height: number }[];
  regions: { id: string; ru: string; lv: [number, number]; biome: string; centroid: P; poly?: P[] }[];
  ridges: { ru: string; at: P }[];
}
interface World {
  villages: { ru: string; buildings: { ru: string; type: string; at: P; size: [number, number]; rot: number }[] }[];
  sites: { id: string; ru: string; kind: string; at: P; cave?: { typeRu: string; lv: [number, number]; entrances: { at: P }[] } }[];
  camps: { id: string; ru: string; at: P; lvMin: number; lvMax: number; total: number; patrolR: number; unique: boolean; danger: string | null }[];
}
const lvCol = (lv: number) => { const t = Math.min(1, Math.max(0, (lv - 1) / 49)); return `hsl(${Math.round(120 - t * 120)},85%,${t > 0.85 ? 42 : 52}%)`; };

const PAL = ['#2a5d8f', '#3f86b8', '#e8d9a0', '#8cc04f', '#4f8f3a', '#5f7a45', '#a3b866', '#3f6e48', '#cdbf6c',
  '#4d6f5a', '#eef3f7', '#a9b4bf', '#d2eaf6', '#b89a6c', '#ebd08a', '#b5553a', '#6fb04a', '#8d8478', '#efe9dc', '#000000'];
const MAJOR = { green: '#7fbf4a', winter: '#e6eef5', desert: '#e3c27a' };
const ROUTE_COL: Record<string, string> = { main: '#fff1b8', alt: '#ffc35a', danger: '#ff5f4a', secret: '#d79bff', secondary: '#e8d2a6', forest_path: '#9fd68a', mountain_path: '#c9c3ff', caravan: '#ffb070', abandoned: '#9a8f86' };
const SIDE = new Set(['secondary', 'forest_path', 'mountain_path', 'caravan', 'abandoned']);
const ROUTE_RU: Record<string, string> = { main: 'Главный тракт', alt: 'Объезд / ответвление', danger: 'Опасная тропа', secret: 'Тайный ход (штольня)', secondary: 'Второстепенная дорога', forest_path: 'Лесная тропа', mountain_path: 'Горная тропа / серпантин', caravan: 'Караванный путь', abandoned: 'Заброшенная дорога' };

const app = document.getElementById('app')!;
const labelsEl = document.getElementById('labels')!;
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
renderer.setSize(window.innerWidth, window.innerHeight);
app.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color('#9fc4de');
scene.fog = new THREE.Fog('#9fc4de', 14000, 30000);
const persp = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, 40, 60000);
const ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 60000);
let camera: THREE.Camera = persp;
let controls: OrbitControls = new OrbitControls(persp as THREE.Camera, renderer.domElement);

const state = { color: 'biome', ex: 1.5, top: false, layers: { water: true, roads: true, regions: true, regionNames: true, places: true, ridges: false, grid: false, side: true, buildings: true, caves: true, camps: true, regionPoly: false } as Record<string, boolean> };

async function loadImageData(url: string): Promise<ImageData> {
  const blob = await (await fetch(url)).blob();
  const bmp = await createImageBitmap(blob, { colorSpaceConversion: 'none', premultiplyAlpha: 'none' });
  const c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height;
  const ctx = c.getContext('2d', { willReadFrequently: true })!; ctx.drawImage(bmp, 0, 0);
  return ctx.getImageData(0, 0, bmp.width, bmp.height);
}

async function main() {
  const [hbuf, maps, feat] = await Promise.all([
    fetch('./data/height_2048.wasm').then(r => r.arrayBuffer()),
    loadImageData('./data/maps_2048.png'),
    fetch('./data/features.json').then(r => r.json() as Promise<Feat>),
  ]);
  const world: World = await fetch('./data/world.json').then(r => r.json()).catch(() => ({ villages: [], sites: [], camps: [] }));
  const N = feat.grid, WORLD = feat.world, SEA = feat.sea;
  const hu = new Uint16Array(hbuf);
  const H = (x: number, y: number) => { const cx = Math.max(0, Math.min(N - 1, Math.floor(x / WORLD * N))), cy = Math.max(0, Math.min(N - 1, Math.floor(y / WORLD * N))); return Math.max(SEA, hu[cy * N + cx] / 64); };

  // текстура высот (half float, линейная фильтрация)
  const half = new Uint16Array(N * N); for (let i = 0; i < N * N; i++) half[i] = THREE.DataUtils.toHalfFloat(hu[i] / 64);
  const hTex = new THREE.DataTexture(half, N, N, THREE.RedFormat, THREE.HalfFloatType);
  hTex.magFilter = hTex.minFilter = THREE.LinearFilter; hTex.flipY = false; hTex.needsUpdate = true;
  const mTex = new THREE.DataTexture(new Uint8Array(maps.data.buffer), N, N, THREE.RGBAFormat, THREE.UnsignedByteType);
  mTex.magFilter = mTex.minFilter = THREE.NearestFilter; mTex.needsUpdate = true;

  // оверлей: реки, дороги, мосты, туннели, сетка
  const OV = 4096; const ov = document.createElement('canvas'); ov.width = ov.height = OV;
  const octx = ov.getContext('2d')!; const oTex = new THREE.CanvasTexture(ov);
  oTex.minFilter = THREE.LinearMipmapLinearFilter; oTex.magFilter = THREE.LinearFilter; oTex.anisotropy = 8; oTex.flipY = false;
  const k = OV / WORLD;
  function drawOverlay() {
    octx.clearRect(0, 0, OV, OV); octx.lineCap = 'round'; octx.lineJoin = 'round';
    if (state.layers.grid) {
      octx.strokeStyle = 'rgba(255,255,255,0.35)'; octx.lineWidth = 2;
      for (let g = 1000; g < WORLD; g += 1000) { octx.beginPath(); octx.moveTo(g * k, 0); octx.lineTo(g * k, OV); octx.moveTo(0, g * k); octx.lineTo(OV, g * k); octx.stroke(); }
    }
    if (state.layers.water) for (const r of feat.rivers) {
      for (let i = 1; i < r.pts.length; i++) {
        const a = r.pts[i - 1], b = r.pts[i];
        octx.strokeStyle = '#3d9be0'; octx.lineWidth = Math.max(1.6, b[3] * 2 * k);
        octx.beginPath(); octx.moveTo(a[0] * k, a[1] * k); octx.lineTo(b[0] * k, b[1] * k); octx.stroke();
      }
    }
    if (state.layers.roads) {
      for (const r of feat.routes) for (const leg of r.legs) {
        const pts = leg.pts; if (pts.length < 2) continue;
        if (SIDE.has(r.kind) && !state.layers.side) continue;
        const col = ROUTE_COL[r.kind] ?? '#ffffff';
        const path = () => { octx.beginPath(); octx.moveTo(pts[0][0] * k, pts[0][1] * k); for (const p of pts) octx.lineTo(p[0] * k, p[1] * k); };
        if (leg.mode === 'tunnel') { octx.setLineDash([10, 8]); octx.strokeStyle = '#d79bff'; octx.lineWidth = 4; path(); octx.stroke(); octx.setLineDash([]); continue; }
        if (leg.mode === 'bridge') { octx.strokeStyle = '#2a1d10'; octx.lineWidth = 11; path(); octx.stroke(); octx.strokeStyle = '#f5f5f5'; octx.lineWidth = 7; path(); octx.stroke(); continue; }
        octx.setLineDash(r.kind === 'danger' ? [12, 7] : r.kind === 'secret' ? [4, 6] : r.kind === 'abandoned' ? [6, 6] : r.kind === 'forest_path' || r.kind === 'mountain_path' ? [8, 4] : []);
        const side = SIDE.has(r.kind);
        octx.strokeStyle = 'rgba(40,25,10,0.85)'; octx.lineWidth = r.kind === 'main' ? 7 : side ? 4 : 5.5; path(); octx.stroke();
        octx.strokeStyle = col; octx.lineWidth = r.kind === 'main' ? 4 : side ? 2 : 3; path(); octx.stroke(); octx.setLineDash([]);
      }
      for (const b of feat.bridges) {
        octx.fillStyle = b.kind === 'ford' ? '#7fd3ff' : '#ffffff'; octx.strokeStyle = '#1b130a'; octx.lineWidth = 3;
        octx.beginPath(); octx.arc(b.at[0] * k, b.at[1] * k, 8, 0, Math.PI * 2); octx.fill(); octx.stroke();
      }
      for (const t of feat.tunnels) for (const p of [t.a, t.b]) {
        octx.fillStyle = '#2b1640'; octx.strokeStyle = '#d79bff'; octx.lineWidth = 4;
        octx.beginPath(); octx.arc(p[0] * k, p[1] * k, 11, Math.PI, 0); octx.lineTo(p[0] * k + 11, p[1] * k + 6); octx.lineTo(p[0] * k - 11, p[1] * k + 6); octx.closePath(); octx.fill(); octx.stroke();
      }
      for (const p of feat.passes) { octx.strokeStyle = '#ff9be0'; octx.lineWidth = 5; octx.beginPath(); octx.arc(p.at[0] * k, p.at[1] * k + 10, 18, Math.PI * 1.15, Math.PI * 1.85); octx.stroke(); }
    }
    if (state.layers.regionPoly) for (const r of feat.regions) if (r.poly && r.poly.length > 2) {
      octx.strokeStyle = 'rgba(255,230,90,0.95)'; octx.lineWidth = 3; octx.setLineDash([14, 6]);
      octx.beginPath(); octx.moveTo(r.poly[0][0] * k, r.poly[0][1] * k); for (const p of r.poly) octx.lineTo(p[0] * k, p[1] * k); octx.closePath(); octx.stroke(); octx.setLineDash([]);
    }
    if (state.layers.buildings) for (const v of world.villages) for (const b of v.buildings) {
      const [w, d] = b.rot % 2 ? [b.size[1], b.size[0]] : b.size;
      octx.fillStyle = '#c0703a'; octx.strokeStyle = '#2a1608'; octx.lineWidth = 1;
      octx.fillRect((b.at[0] - w / 2) * k, (b.at[1] - d / 2) * k, Math.max(2, w * k), Math.max(2, d * k)); octx.strokeRect((b.at[0] - w / 2) * k, (b.at[1] - d / 2) * k, Math.max(2, w * k), Math.max(2, d * k));
    }
    if (state.layers.camps) for (const c of world.camps) {
      octx.strokeStyle = lvCol(c.lvMax); octx.lineWidth = 2; octx.beginPath(); octx.arc(c.at[0] * k, c.at[1] * k, Math.max(4, c.patrolR * k), 0, Math.PI * 2); octx.stroke();
      octx.fillStyle = lvCol(c.lvMax); octx.strokeStyle = c.unique ? '#ff00ff' : '#140a05'; octx.lineWidth = c.unique ? 3 : 1.5;
      octx.beginPath(); octx.arc(c.at[0] * k, c.at[1] * k, 5, 0, Math.PI * 2); octx.fill(); octx.stroke();
    }
    if (state.layers.caves) for (const s of world.sites) if (s.cave) for (const e of s.cave.entrances) {
      const x = e.at[0] * k, y = e.at[1] * k; octx.fillStyle = '#1a1a1a'; octx.strokeStyle = '#ffb347'; octx.lineWidth = 2.5;
      octx.beginPath(); octx.arc(x, y, 7, Math.PI, 0); octx.lineTo(x + 7, y + 4); octx.lineTo(x - 7, y + 4); octx.closePath(); octx.fill(); octx.stroke();
    }
    oTex.needsUpdate = true;
  }
  drawOverlay();

  const uniforms = {
    uH: { value: hTex }, uM: { value: mTex }, uO: { value: oTex }, uEx: { value: state.ex }, uSea: { value: SEA }, uWorld: { value: WORLD },
    uTexel: { value: 1 / N }, uMode: { value: 0 }, uWater: { value: 1 }, uRegions: { value: 1 }, uDetail: { value: new THREE.Vector4(-1, -1, -1, -1) },
    uPal: { value: PAL.map(c => new THREE.Color(c)) },
    uMajor: { value: [new THREE.Color(MAJOR.green), new THREE.Color(MAJOR.winter), new THREE.Color(MAJOR.desert)] },
  };
  const vert = /* glsl */`
    uniform sampler2D uH; uniform float uEx; uniform float uSea; uniform float uWorld;
    varying vec2 vUv; varying float vY;
    void main() {
      vUv = vec2(uv.x, 1.0 - uv.y);
      float h = max(texture2D(uH, vUv).r, uSea);
      vY = h;
      vec3 p = vec3(position.x, (h - uSea) * uEx, position.z);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
    }`;
  const frag = /* glsl */`
    uniform sampler2D uH; uniform sampler2D uM; uniform sampler2D uO; uniform float uEx; uniform float uSea; uniform float uWorld; uniform float uTexel;
    uniform int uMode; uniform float uWater; uniform float uRegions; uniform vec4 uDetail; uniform vec3 uPal[20]; uniform vec3 uMajor[3];
    varying vec2 vUv; varying float vY;
    vec3 hyps(float y) {
      vec3 c0 = vec3(0.30,0.55,0.25), c1 = vec3(0.62,0.72,0.34), c2 = vec3(0.80,0.70,0.42), c3 = vec3(0.60,0.47,0.33), c4 = vec3(0.62,0.62,0.64), c5 = vec3(0.97,0.98,1.0);
      if (y < 70.0) return mix(c0, c1, (y - 40.0) / 30.0);
      if (y < 120.0) return mix(c1, c2, (y - 70.0) / 50.0);
      if (y < 200.0) return mix(c2, c3, (y - 120.0) / 80.0);
      if (y < 320.0) return mix(c3, c4, (y - 200.0) / 120.0);
      return mix(c4, c5, clamp((y - 320.0) / 120.0, 0.0, 1.0));
    }
    int idxAt(vec2 uv, int ch) { vec4 m = texture2D(uM, uv); return int(floor((ch == 0 ? m.r : ch == 1 ? m.g : m.b) * 255.0 + 0.5)); }
    void main() {
      vec2 wp = vUv * uWorld; if (wp.x > uDetail.x && wp.y > uDetail.y && wp.x < uDetail.z && wp.y < uDetail.w) discard;
      float t = uTexel;
      float hl = max(texture2D(uH, vUv - vec2(t, 0.0)).r, uSea), hr = max(texture2D(uH, vUv + vec2(t, 0.0)).r, uSea);
      float hd = max(texture2D(uH, vUv - vec2(0.0, t)).r, uSea), hu = max(texture2D(uH, vUv + vec2(0.0, t)).r, uSea);
      float cell = uWorld * t;
      vec3 n = normalize(vec3((hl - hr) * uEx, 2.0 * cell, (hd - hu) * uEx));
      vec3 L = normalize(vec3(-0.55, 0.75, -0.45));
      float diff = clamp(dot(n, L), 0.0, 1.0);
      float shade = 0.42 + 0.68 * diff;
      vec4 m = texture2D(uM, vUv);
      int b = int(floor(m.r * 255.0 + 0.5)); int wf = int(floor(m.g * 255.0 + 0.5)); int w = wf - (wf / 16) * 16;
      vec3 col;
      if (uMode == 0) col = uPal[b];
      else if (uMode == 1) col = hyps(vY);
      else { col = b <= 1 ? uPal[b] : (b == 9 || b == 10 || b == 11 || b == 12) ? uMajor[1] : (b == 13 || b == 14 || b == 15 || b == 16 || b == 18) ? uMajor[2] : uMajor[0]; }
      if (uMode == 1 && b <= 1) col = uPal[b];
      // контурные линии в режиме высот
      if (uMode == 1 && vY > uSea + 1.0) { float c = fract(vY / 20.0); float fw = fwidth(vY / 20.0) * 1.2; col *= 1.0 - 0.28 * (1.0 - smoothstep(0.0, fw, min(c, 1.0 - c))); }
      if (uWater > 0.5) {
        if (w == 1) col = mix(uPal[1], uPal[0], 0.0);
        if (w == 2) col = vec3(0.24, 0.61, 0.88);
        if (w == 3) col = vec3(0.22, 0.54, 0.84);
        if (w == 4) col = vec3(0.30, 0.48, 0.42);
      } else if (w == 1 && uMode != 2) col = vec3(0.55, 0.62, 0.7);
      vec3 lit = col * (w == 1 || w == 3 ? 0.95 : shade);
      if (b <= 1 && w == 1) lit = col * (0.9 + 0.1 * diff);
      if (uRegions > 0.5) {
        int r0 = idxAt(vUv, 2);
        float e = 0.0;
        for (int i = 0; i < 4; i++) {
          vec2 o = i == 0 ? vec2(t, 0.0) : i == 1 ? vec2(-t, 0.0) : i == 2 ? vec2(0.0, t) : vec2(0.0, -t);
          int r1 = idxAt(vUv + o, 2);
          if (r1 != r0 && r1 != 255 && r0 != 255) e = 1.0;
        }
        lit = mix(lit, vec3(0.98, 0.86, 0.35), e * 0.85);
      }
      vec4 o = texture2D(uO, vUv);
      lit = mix(lit, o.rgb, o.a);
      gl_FragColor = vec4(lit, 1.0);
    }`;
  const mat = new THREE.ShaderMaterial({ uniforms, vertexShader: vert, fragmentShader: frag, extensions: { derivatives: true } as never });
  let mesh: THREE.Mesh | null = null;
  const buildMesh = (seg: number) => {
    if (mesh) { scene.remove(mesh); mesh.geometry.dispose(); }
    const g = new THREE.PlaneGeometry(WORLD, WORLD, seg, seg); g.rotateX(-Math.PI / 2); g.translate(WORLD / 2, 0, WORLD / 2);
    mesh = new THREE.Mesh(g, mat); mesh.frustumCulled = false; scene.add(mesh);
  };
  buildMesh(1023);
  // «юбка» океана вокруг карты
  const oceanG = new THREE.PlaneGeometry(WORLD * 6, WORLD * 6); oceanG.rotateX(-Math.PI / 2); oceanG.translate(WORLD / 2, -4, WORLD / 2);
  scene.add(new THREE.Mesh(oceanG, new THREE.MeshBasicMaterial({ color: PAL[0] })));

  // ─── блочная детализация: тайлы 1 блок/отсчёт, воксельные столбики вокруг точки фокуса ───
  interface Manifest { tile: number; tiles: number; list: string[]; mat: Record<string, number> }
  const manifest: Manifest | null = await fetch('./data/tiles/manifest.json').then(r => r.ok ? r.json() : null).catch(() => null);
  const MATCOL: string[] = [...PAL.slice(0, 19), '#000000', '#3d9be0', '#3a8fd6', '#2f6fa8', '#4f7f73', '#c9a46a', '#a88b5c'];
  const matRGB = MATCOL.map(c => new THREE.Color(c));
  scene.add(new THREE.AmbientLight(0xffffff, 0.55));
  const sun = new THREE.DirectionalLight(0xffffff, 1.6); sun.position.set(-0.55, 0.75, -0.45); scene.add(sun);
  const detail = { on: true, busy: false, key: '', group: new THREE.Group(), cache: new Map<string, THREE.BufferGeometry>() };
  scene.add(detail.group);
  const detailMat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  const bldMats = new Map<string, THREE.Material>();
  const bldMat = (t: string) => { let m = bldMats.get(t); if (!m) { m = new THREE.MeshLambertMaterial({ color: t === 'pen' ? '#8a6a3e' : t === 'well' ? '#8d8d8d' : t === 'watchtower' || t === 'guard_post' ? '#6e5a44' : t === 'tavern' ? '#b0442c' : t === 'smithy' ? '#4a4a52' : '#c0703a' }); bldMats.set(t, m); } return m; };
  const atlasCache = new Map<string, Promise<ImageData>>();
  async function tileData(tx: number, ty: number) {
    // tiles are packed 4x4 into 1024² atlases (static hosting caps the file count)
    const ak = `a_${tx >> 2}_${ty >> 2}`;
    let ap = atlasCache.get(ak); if (!ap) { ap = loadImageData(`./data/atlas/${ak}.png`); atlasCache.set(ak, ap); }
    const img = await ap; const W = img.width;
    const T = manifest!.tile; const hh = new Int16Array(T * T), mm = new Uint8Array(T * T);
    const ox = (tx & 3) * T, oy = (ty & 3) * T;
    for (let z = 0; z < T; z++) for (let x = 0; x < T; x++) { const i = z * T + x, o = ((oy + z) * W + ox + x) * 4; hh[i] = Math.floor(((img.data[o] << 8) | img.data[o + 1]) / 16); mm[i] = img.data[o + 2]; }
    return { hh, mm };
  }
  function buildVoxel(tx: number, ty: number, hh: Int16Array, mm: Uint8Array) {
    const T = manifest!.tile; const pos: number[] = [], nor: number[] = [], col: number[] = [], ind: number[] = [];
    const x0 = tx * T, z0 = ty * T; const c = new THREE.Color();
    const hAt = (lx: number, lz: number) => lx >= 0 && lz >= 0 && lx < T && lz < T ? hh[lz * T + lx] : Math.floor(H(x0 + lx + 0.5, z0 + lz + 0.5));
    const quad = (a: number[], b: number[], cc: number[], d: number[], n: number[], k: number) => {
      const base = pos.length / 3; for (const v of [a, b, cc, d]) { pos.push(v[0], v[1], v[2]); nor.push(n[0], n[1], n[2]); col.push(c.r * k, c.g * k, c.b * k); }
      ind.push(base, base + 1, base + 2, base, base + 2, base + 3);
    };
    for (let lz = 0; lz < T; lz++) for (let lx = 0; lx < T; lx++) {
      const i = lz * T + lx, y = Math.max(hh[i], SEA - 1) + 1, m = mm[i];
      c.copy(matRGB[m] ?? matRGB[3]);
      const j = ((lx * 73856093) ^ (lz * 19349663) ^ (tx * 83492791)) >>> 0; const jit = 0.92 + 0.12 * ((j % 1000) / 1000);
      const x = x0 + lx, z = z0 + lz;
      quad([x, y, z], [x, y, z + 1], [x + 1, y, z + 1], [x + 1, y, z], [0, 1, 0], jit);
      if (m >= 20 && m <= 23) continue;
      const side = (nh: number, a: number[], b: number[], n: number[]) => { const y2 = Math.max(nh, SEA - 1) + 1; if (y2 < y) quad([a[0], y2, a[1]], [a[0], y, a[1]], [b[0], y, b[1]], [b[0], y2, b[1]], n, jit * 0.82); };
      side(hAt(lx + 1, lz), [x + 1, z + 1], [x + 1, z], [1, 0, 0]);
      side(hAt(lx - 1, lz), [x, z], [x, z + 1], [-1, 0, 0]);
      side(hAt(lx, lz + 1), [x, z + 1], [x + 1, z + 1], [0, 0, 1]);
      side(hAt(lx, lz - 1), [x + 1, z], [x, z], [0, 0, -1]);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Int8BufferAttribute(Int8Array.from(nor, v => v * 127), 3, true));
    g.setAttribute('color', new THREE.Uint8BufferAttribute(Uint8Array.from(col, v => Math.min(255, v * 255)), 3, true));
    g.setIndex(pos.length / 3 > 65535 ? new THREE.Uint32BufferAttribute(ind, 1) : new THREE.Uint16BufferAttribute(ind, 1));
    return g;
  }
  async function loadDetail(fx: number, fz: number) {
    if (!manifest || !detail.on) return;
    const T = manifest.tile;
    const ax = Math.max(0, Math.min(manifest.tiles - 2, Math.round(fx / T) - 1)), az = Math.max(0, Math.min(manifest.tiles - 2, Math.round(fz / T) - 1));
    const key = `${ax},${az}`; if (key === detail.key) return;
    detail.key = key; detail.busy = true;
    const want: [number, number][] = [[ax, az], [ax + 1, az], [ax, az + 1], [ax + 1, az + 1]];
    const geos: THREE.BufferGeometry[] = [];
    for (const [tx, ty] of want) {
      const k = `${tx},${ty}`; let g = detail.cache.get(k);
      if (!g) { if (!manifest.list.includes(`t_${tx}_${ty}`)) continue; const d = await tileData(tx, ty); g = buildVoxel(tx, ty, d.hh, d.mm); detail.cache.set(k, g); }
      geos.push(g);
    }
    if (detail.key !== key) return;
    for (const [k, g] of detail.cache) if (!want.some(([a, b]) => `${a},${b}` === k)) { g.dispose(); detail.cache.delete(k); }
    detail.group.clear();
    for (const g of geos) detail.group.add(new THREE.Mesh(g, detailMat));
    if (state.layers.buildings) for (const v of world.villages) for (const bd of v.buildings) {
      if (bd.at[0] < ax * T || bd.at[1] < az * T || bd.at[0] >= (ax + 2) * T || bd.at[1] >= (az + 2) * T) continue;
      const [w, d] = bd.rot % 2 ? [bd.size[1], bd.size[0]] : bd.size; const hgt = bd.type === 'watchtower' || bd.type === 'guard_post' ? 12 : bd.type === 'pen' || bd.type === 'well' ? 1.5 : 6;
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, hgt, d), bldMat(bd.type)); m.position.set(bd.at[0], Math.floor(H(bd.at[0], bd.at[1])) + 1 + hgt / 2, bd.at[1]); detail.group.add(m);
    }
    detail.group.scale.y = state.ex; detail.group.position.y = -SEA * state.ex;
    uniforms.uDetail.value.set(ax * T + 0.5, az * T + 0.5, (ax + 2) * T - 0.5, (az + 2) * T - 0.5);
    detail.busy = false; kickRender();
  }
  const clearDetail = () => { detail.key = ''; detail.group.clear(); uniforms.uDetail.value.set(-1, -1, -1, -1); };
  let kickRender = () => {};

  // ─── подписи ───
  interface Lbl { el: HTMLDivElement; x: number; z: number; y: number; layer: string; }
  const labels: Lbl[] = [];
  const addLabel = (html: string, cls: string, at: P, layer: string, lift = 0) => {
    const el = document.createElement('div'); el.className = 'lbl ' + cls; el.innerHTML = html; labelsEl.appendChild(el);
    labels.push({ el, x: at[0], z: at[1], y: H(at[0], at[1]) + lift, layer });
  };
  for (const v of feat.villages) addLabel(v.ru, 'village', v.at, 'places');
  for (const l of feat.landmarks) if (l.kind !== 'canyon') addLabel(l.ru, 'landmark', l.at, 'places', 6);
  addLabel('Каньон Багровый Разлом', 'ridge', [3300, 6150], 'places');
  for (const r of feat.regions) addLabel(`${r.ru}<small>ур. ${r.lv[0]}–${r.lv[1]}</small>`, 'region', r.centroid, 'regionNames', 30);
  for (const p of feat.passes) addLabel(p.ru, 'pass', p.at, 'roads', 4);
  for (const b of feat.bridges) if (b.kind === 'canyon') addLabel(b.ru, 'bridge', b.at, 'roads', 8);
  for (const t of feat.tunnels) { addLabel('Штольня (юг)', 'tunnel', t.a, 'roads', 4); addLabel('Штольня (север)', 'tunnel', t.b, 'roads', 4); }
  for (const r of feat.ridges) addLabel(r.ru, 'ridge', r.at, 'ridges', 40);
  for (const s of world.sites) if (s.cave) addLabel(`${s.ru}<small>${s.cave.typeRu} · ур. ${s.cave.lv[0]}–${s.cave.lv[1]} · входов ${s.cave.entrances.length}</small>`, 'cave', s.at, 'caves', 4);
  else addLabel(s.ru, 'site', s.at, 'places', 3);
  for (const c of world.camps) addLabel(`<span style="color:${lvCol(c.lvMax)}">${c.ru}</span><small>ур. ${c.lvMin}–${c.lvMax} · ${c.total} шт.${c.unique ? ' · уникальный' : ''}</small>`, 'camp', c.at, 'camps', 3);
  const v3 = new THREE.Vector3();
  const updateLabels = () => {
    const w = renderer.domElement.clientWidth, hh = renderer.domElement.clientHeight;
    const placed: number[][] = [];
    for (const l of labels) {
      if (!state.layers[l.layer]) { l.el.style.display = 'none'; continue; }
      v3.set(l.x, (l.y - SEA) * state.ex, l.z).project(camera);
      if (v3.z > 1 || v3.z < -1 || Math.abs(v3.x) > 1.1 || Math.abs(v3.y) > 1.1) { l.el.style.display = 'none'; continue; }
      const sx = (v3.x * 0.5 + 0.5) * w, sy = (-v3.y * 0.5 + 0.5) * hh;
      const bw = l.el.textContent!.length * 3.6 + 8, bh = 11;
      if (placed.some(p => Math.abs(p[0] - sx) < p[2] + bw && Math.abs(p[1] - sy) < p[3] + bh)) { l.el.style.display = 'none'; continue; }
      placed.push([sx, sy, bw, bh]);
      l.el.style.display = 'block'; l.el.style.left = `${sx}px`; l.el.style.top = `${sy}px`;
    }
  };

  // ─── легенда ───
  const bp = feat.stats.biomes.landPct;
  const legend = document.getElementById('legend')!;
  const subShown = [3, 4, 6, 5, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 18, 2, 17];
  legend.innerHTML = `<h1>Легенда</h1>
    <div class="bar"><span style="width:${bp.green}%;background:${MAJOR.green}"></span><span style="width:${bp.desert}%;background:${MAJOR.desert}"></span><span style="width:${bp.winter}%;background:${MAJOR.winter}"></span></div>
    <div class="row"><span><i class="sw" style="background:${MAJOR.green}"></i>Зелёные земли</span><b>${bp.green}%</b></div>
    <div class="row"><span><i class="sw" style="background:${MAJOR.desert}"></i>Пустыня</span><b>${bp.desert}%</b></div>
    <div class="row"><span><i class="sw" style="background:${MAJOR.winter}"></i>Зима</span><b>${bp.winter}%</b></div>
    <div style="color:var(--muted);font-size:11px">доля площади суши (суша = ${feat.stats.landSharePct}% карты); высшая точка Y ${feat.stats.biomes.maxY.winter}</div>
    <h2>Подбиомы</h2>${subShown.map(i => `<div><i class="sw" style="background:${PAL[i]}"></i>${feat.sub[i]}</div>`).join('')}
    <div><i class="sw" style="background:#3d9be0"></i>Реки и озёра</div>
    <h2>Дороги</h2>${Object.keys(ROUTE_COL).map(kk => `<div><i class="sw" style="background:${ROUTE_COL[kk]}"></i>${ROUTE_RU[kk]}</div>`).join('')}
    <div><i class="sw" style="background:#fff;border-radius:50%"></i>Мост · <i class="sw" style="background:#7fd3ff;border-radius:50%"></i>Брод</div>
    <div><i class="sw" style="background:#ff9be0"></i>Перевал · <i class="sw" style="background:#2b1640;border-color:#d79bff"></i>Вход в штольню</div>
    <div><i class="sw" style="background:#f9dc5a"></i>Граница региона</div>
    <h2>Мир (этапы 3–5)</h2><div><i class="sw" style="background:#c0703a"></i>Здания деревень</div>
    <div><i class="sw" style="background:#1a1a1a;border-color:#ffb347"></i>Вход в пещеру / подземелье</div>
    <div>Лагеря по уровню: ${[1, 10, 20, 30, 40, 50].map(l => `<i class="sw" style="background:${lvCol(l)}"></i>${l}`).join(' ')}</div>
    <div><i class="sw" style="background:#888;border:2px solid #f0f"></i>Уникальный (без респавна)</div>`;

  // ─── виды ───
  const VIEWS: Record<string, { ru: string; t: P; d: number; az: number; el: number; top?: boolean; mode?: string }> = {
    overview: { ru: 'Обзор', t: [4000, 4200], d: 9600, az: 0, el: 46 },
    topBiome: { ru: 'Сверху: биомы', t: [4000, 4000], d: 0, az: 0, el: 90, top: true, mode: 'biome' },
    topHeight: { ru: 'Сверху: высоты', t: [4000, 4000], d: 0, az: 0, el: 90, top: true, mode: 'height' },
    north: { ru: 'Ледяная Корона', t: [4100, 1300], d: 3600, az: 10, el: 24 },
    canyon: { ru: 'Багровый Разлом', t: [3500, 6100], d: 1500, az: -35, el: 32 },
    falls: { ru: 'Грохочущий Водопад', t: [6265, 2500], d: 950, az: 15, el: 24 },
    zelenodol: { ru: 'Зеленодол', t: [3780, 3930], d: 1300, az: 20, el: 38 },
    snezhny: { ru: 'Снежный Предел', t: [3230, 1760], d: 1400, az: 0, el: 30 },
    peschany: { ru: 'Песчаный Приют', t: [4440, 6650], d: 1300, az: 15, el: 38 },
    rift: { ru: 'Золотая Струна', t: [4740, 5700], d: 750, az: 150, el: 30 },
  };
  const viewsEl = document.getElementById('views')!;
  const setTop = (on: boolean) => {
    state.top = on; (document.getElementById('top') as HTMLInputElement).checked = on;
    controls.dispose();
    if (on) {
      camera = ortho; const a = innerWidth / innerHeight; const half = WORLD * 0.54;
      ortho.left = -half * a; ortho.right = half * a; ortho.top = half; ortho.bottom = -half; ortho.zoom = 1; ortho.updateProjectionMatrix();
      ortho.position.set(WORLD / 2, 20000, WORLD / 2); ortho.up.set(0, 0, -1); ortho.lookAt(WORLD / 2, 0, WORLD / 2);
      controls = new OrbitControls(ortho, renderer.domElement); controls.enableRotate = false; controls.target.set(WORLD / 2, 0, WORLD / 2);
      controls.screenSpacePanning = true;
    } else { camera = persp; controls = new OrbitControls(persp, renderer.domElement); }
    controls.update(); kick();
  };
  const setMode = (m: string) => { state.color = m; uniforms.uMode.value = m === 'biome' ? 0 : m === 'height' ? 1 : 2; (document.querySelector(`input[name=col][value=${m}]`) as HTMLInputElement).checked = true; };
  const setView = (name: string | { t: P; d: number; az: number; el: number; mode?: string }) => {
    const v = typeof name === 'string' ? VIEWS[name] : { ru: '', ...name }; if (!v) return;
    document.querySelectorAll('#views button').forEach(b => b.classList.toggle('on', (b as HTMLElement).dataset.v === name));
    setMode(v.mode ?? 'biome');
    if (v.top) { clearDetail(); setTop(true); return; }
    setTop(false);
    const ty = (H(v.t[0], v.t[1]) - SEA) * state.ex;
    const el = v.el * Math.PI / 180, az = v.az * Math.PI / 180;
    persp.position.set(v.t[0] + Math.sin(az) * Math.cos(el) * v.d, ty + Math.sin(el) * v.d, v.t[1] + Math.cos(az) * Math.cos(el) * v.d);
    controls.target.set(v.t[0], ty, v.t[1]); controls.update();
    if (v.d <= 1600) void loadDetail(v.t[0], v.t[1]); else clearDetail();
  };
  for (const [key, v] of Object.entries(VIEWS)) { const b = document.createElement('button'); b.textContent = v.ru; b.dataset.v = key; b.onclick = () => setView(key); viewsEl.appendChild(b); }

  // ─── элементы управления ───
  document.querySelectorAll<HTMLInputElement>('input[name=col]').forEach(r => r.onchange = () => setMode(r.value));
  const ex = document.getElementById('ex') as HTMLInputElement;
  ex.oninput = () => { state.ex = +ex.value; uniforms.uEx.value = state.ex; detail.group.scale.y = state.ex; detail.group.position.y = -SEA * state.ex; document.getElementById('exv')!.textContent = `×${state.ex.toFixed(1)}`; for (const l of labels) void l; };
  (document.getElementById('top') as HTMLInputElement).onchange = e => setTop((e.target as HTMLInputElement).checked);
  (document.getElementById('hi') as HTMLInputElement).onchange = e => buildMesh((e.target as HTMLInputElement).checked ? 1023 : 511);
  document.querySelectorAll<HTMLInputElement>('input[data-layer]').forEach(c => c.onchange = () => {
    state.layers[c.dataset.layer!] = c.checked;
    uniforms.uWater.value = state.layers.water ? 1 : 0; uniforms.uRegions.value = state.layers.regions ? 1 : 0;
    if (['water', 'roads', 'grid', 'side', 'buildings', 'caves', 'camps', 'regionPoly'].includes(c.dataset.layer!)) drawOverlay();
  });
  const setLayer = (name: string, on: boolean) => { const c = document.querySelector<HTMLInputElement>(`input[data-layer=${name}]`); if (c) { c.checked = on; c.onchange!(new Event('change')); } };

  addEventListener('resize', () => {
    renderer.setSize(innerWidth, innerHeight); persp.aspect = innerWidth / innerHeight; persp.updateProjectionMatrix();
    if (state.top) setTop(true);
  });
  let frames = 0; let dirty = 2;
  const kick = () => { dirty = 2; };
  renderer.domElement.addEventListener('pointerdown', kick); renderer.domElement.addEventListener('wheel', kick, { passive: true });
  addEventListener('pointermove', e => { if (e.buttons) kick(); }); addEventListener('input', kick); addEventListener('change', kick); addEventListener('click', kick);
  // рендер по требованию: кадр рисуется только когда что-то изменилось (экономит батарею и работает в программном GL)
  renderer.setAnimationLoop(() => { if (controls.update()) dirty = 2; if (dirty <= 0) return; dirty--; renderer.render(scene, camera); updateLabels(); frames++; });
  kickRender = kick;
  (document.getElementById('blocks') as HTMLInputElement).onchange = e => { detail.on = (e.target as HTMLInputElement).checked; if (!detail.on) clearDetail(); else void loadDetail(controls.target.x, controls.target.z); kick(); };
  let autoT = 0;
  controls.addEventListener('change', () => {
    clearTimeout(autoT);
    autoT = window.setTimeout(() => {
      if (state.top) return;
      const dist = camera.position.distanceTo(controls.target);
      if (dist < 1500) void loadDetail(controls.target.x, controls.target.z); else if (detail.key) { clearDetail(); kick(); }
    }, 350);
  });
  renderer.domElement.addEventListener('dblclick', e => {
    const r = renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    const ray = new THREE.Raycaster(); ray.setFromCamera(ndc, camera);
    const o = ray.ray.origin.clone(), d = ray.ray.direction.clone();
    for (let t = 0; t < 40000; t += 4) {
      const p = o.clone().addScaledVector(d, t);
      if (p.x < 0 || p.z < 0 || p.x > WORLD || p.z > WORLD) continue;
      if (p.y <= (H(p.x, p.z) - SEA) * state.ex) {
        controls.target.set(p.x, p.y, p.z);
        if (!state.top) { const off = camera.position.clone().sub(controls.target).setLength(Math.min(700, camera.position.distanceTo(controls.target))); camera.position.copy(controls.target).add(off); }
        controls.update(); void loadDetail(p.x, p.z); kick(); break;
      }
    }
  });
  const renderNow = () => { controls.update(); renderer.render(scene, camera); updateLabels(); frames++; };
  const qs = new URLSearchParams(location.search);
  setView(qs.get('view') ?? 'overview');
  document.getElementById('loading')!.remove();
  (window as unknown as Record<string, unknown>).continent = { setView: (n: Parameters<typeof setView>[0]) => { setView(n); renderNow(); }, setLayer: (n: string, on: boolean) => { setLayer(n, on); renderNow(); }, setMode, renderNow, frames: () => frames, busy: () => detail.busy, ready: true };
}
main().catch(e => { document.getElementById('loading')!.textContent = 'Ошибка загрузки: ' + e; console.error(e); });
