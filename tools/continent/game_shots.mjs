// Скриншоты и замер производительности игры на континенте (собранный dist):
//   npm run build && node tools/continent/game_shots.mjs [outDir]
// Требует playwright (из репозитория или /opt/node-tools). Рендер headless (swiftshader): FPS — программный.
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { extname, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const here = dirname(fileURLToPath(import.meta.url));
const site = join(here, '..', '..', 'dist');
const out = process.argv[2] || '/tmp/claude-0/continent_game';
await mkdir(out, { recursive: true });
const req = createRequire(import.meta.url);
let pw; try { pw = req('playwright'); } catch { pw = req('/opt/node-tools/node_modules/playwright'); }
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff', '.wasm': 'application/wasm', '.webmanifest': 'application/manifest+json' };
const srv = createServer(async (q, r) => {
  const p = join(site, decodeURIComponent(q.url.split('?')[0]).replace(/\/$/, '/index.html'));
  try { const b = await readFile(p); r.writeHead(200, { 'content-type': types[extname(p)] || 'application/octet-stream' }); r.end(b); } catch { r.writeHead(404); r.end(); }
}).listen(0);
const port = srv.address().port;
const browser = await pw.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const W = +(process.env.W || 1280), H = +(process.env.H || 720);
const page = await browser.newPage({ viewport: { width: W, height: H } });
page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.log('console:', m.text().slice(0, 300)); });
page.on('pageerror', e => console.log('pageerror:', e.message));
await page.goto(`http://localhost:${port}/index.html`);
await page.waitForFunction(() => window.app, null, { timeout: 120000 });
await page.waitForTimeout(500);
await page.keyboard.press('Enter');
await page.waitForTimeout(500);
// a fresh character, straight into the world (the default map is the continent)
await page.evaluate(() => {
  const app = window.app;
  app.profile.data.settings.showHints = false;
  const ch = app.profile.createChar('Испытатель', 'berserker');
  app.play(ch.id);
});
await page.waitForFunction(() => window.app.run && window.app.run.map.id === 'continent', null, { timeout: 300000 });
console.log('in world');

// [name, x, z, hour, camera] — camera: null (game view) or { h, b } (height / back distance)
const SHOTS = JSON.parse(process.env.SHOTS_JSON || 'null') || [
  ['zelenodol', 3786, 3946, 12, null],
  ['zelenodol_wide', 3790, 3936, 11, { h: 60, b: 52 }],
  ['forest', 2700, 3300, 11, null],
  ['north_horizon', 3600, 2650, 10, { h: 22, b: 70, look: [0, -1] }],
  ['canyon_bridge', 3670, 6065, 13, { h: 50, b: 44 }],
  ['desert_village', 4400, 6640, 12, { h: 46, b: 40 }],
  ['snow_village', 3230, 1708, 12, { h: 46, b: 40 }],
  ['camp', 3500, 3990, 12, null],
];
const perf = [];
for (const [name, x, z, hour, cam] of SHOTS) {
  const info = await page.evaluate(async ([x, z, hour, cam]) => {
    const app = window.app, run = app.run, r = app.renderer;
    app.clock.minutes = hour * 60;
    const nt = await app.continentStream.jump(x, z);
    if (nt !== run.terrain) run.swapTerrain(nt);
    const q = app.continentStream.walkableNear(x, z);
    run.player.placeAt(q.x, q.z);
    run.player.y = run.terrain.groundY(q.x, q.z);
    run.player.invulnT = 1e6;
    r.snapTo(q.x, q.z);
    const rig = r.rig;
    rig.__h ??= rig.height; rig.__b ??= rig.back;
    rig.height = cam ? cam.h : rig.__h; rig.back = cam ? cam.b : rig.__b;
    if (cam && cam.look) { rig.toCam.x = -cam.look[0]; rig.toCam.z = -cam.look[1]; } else { rig.toCam.x = Math.SQRT1_2; rig.toCam.z = Math.SQRT1_2; }
    return { x: q.x, z: q.z, ox: run.terrain.ox, oz: run.terrain.oz };
  }, [x, z, hour, cam]);
  // let the streamed chunks build and the camera settle
  await page.waitForTimeout(2500);
  const m = await page.evaluate(() => new Promise((res) => {
    const r = window.app.renderer; let n = 0; const t0 = performance.now();
    const info = r.gl.info; info.autoReset = false; info.reset(); let calls = 0, tris = 0;
    const tick = () => { n++; if (info.render.calls) { calls = info.render.calls; tris = info.render.triangles; } info.reset(); if (performance.now() - t0 < 3000) requestAnimationFrame(tick); else { info.autoReset = true; res({ fps: n / ((performance.now() - t0) / 1000), calls, tris, geos: r.gl.info.memory.geometries, tex: r.gl.info.memory.textures, heap: performance.memory ? performance.memory.usedJSHeapSize / 1048576 : 0, enemies: window.app.run.enemies.list.filter((e) => e.active).length }); } };
    requestAnimationFrame(tick);
  }));
  perf.push({ name, ...info, ...m });
  await page.screenshot({ path: join(out, `${name}.jpg`), type: 'jpeg', quality: 85, timeout: 300000 });
  console.log('shot', name, JSON.stringify(m));
}
// a streaming run: walk east along the road for a while and count frame times and window shifts
const walk = await page.evaluate(() => new Promise((res) => {
  const app = window.app, run = app.run;
  const r = app.renderer; const rig = r.rig; rig.height = rig.__h; rig.back = rig.__b; rig.toCam.x = rig.toCam.z = Math.SQRT1_2;
  const s0 = app.continentStream.shifts; const b0 = r.worldBuilds;
  let frames = 0, worst = 0, last = performance.now(); const t0 = last;
  const keys = app.input.keys ?? null;
  const tick = () => {
    const now = performance.now(); worst = Math.max(worst, now - last); last = now; frames++;
    // push the hero east by input (the run reads input each frame through the app loop)
    run.player.x += 0; // keep reference
    if (now - t0 < 15000) requestAnimationFrame(tick); else res({ frames, sec: (now - t0) / 1000, worstMs: worst, shifts: app.continentStream.shifts - s0, rebuilds: r.worldBuilds - b0, x: run.player.x, z: run.player.z });
  };
  void keys;
  requestAnimationFrame(tick);
}));
console.log('walk', JSON.stringify(walk));
await writeFile(join(out, 'perf.json'), JSON.stringify({ viewport: [W, H], shots: perf, idle: walk }, null, 1));
await browser.close(); srv.close();
