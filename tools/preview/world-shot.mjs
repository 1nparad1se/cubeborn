// Starts the continent open world in a headless browser and takes screenshots.
// node tools/preview/world-shot.mjs out-prefix [x z]   (needs a vite server on GAME_URL, default http://localhost:5198)
import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';
const [out = '/tmp/w', tx, tz] = process.argv.slice(2);
const base = process.env.GAME_URL ?? 'http://localhost:5198';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on('console', (m) => { if (m.type() === 'error' || m.text().startsWith('[w]')) console.log('console:', m.text().slice(0, 400)); });
page.on('pageerror', (e) => console.log('pageerror:', e.message, e.stack?.slice(0, 600)));
await page.goto(base + '/', { waitUntil: 'load', timeout: 180000 });
await page.waitForFunction(() => window.app, null, { timeout: 60000 });
const t0 = Date.now();
await page.evaluate(() => window.app.startRunNow('berserker', 'blightwood', 'normal', 'world'));
console.log('start ms', Date.now() - t0);
await page.evaluate(([x, z]) => {
  const run = window.app.run;
  if (x !== undefined) run.world.moveHero(Number(x), Number(z));
  const p = run.player;
  console.log('[w] at', p.x.toFixed(1), p.z.toFixed(1), 'place', JSON.stringify(run.world.place().loc), 'lv', run.world.levelAt(p.x, p.z), 'npcs', run.world.npcs.length, 'stations', run.world.layout.stations.length);
}, [tx, tz]);
await page.waitForTimeout(6000);
await page.screenshot({ path: out + '-a.png' });
const info = await page.evaluate(() => { const r = window.app.run; return { fps: r ? 'ok' : 'no run', enemies: r.enemies.list.filter((e) => e.active).length, vis: r.world.visibleNpcs.length, st: r.world.nearStation()?.kind ?? null }; });
console.log(JSON.stringify(info));
await browser.close();
