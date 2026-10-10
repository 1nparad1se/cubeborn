// Screenshot a prefab preview: node tools/preview/shot.mjs "<query>" out.png [width height]
// Needs a vite dev server on PREVIEW_URL (default http://localhost:5190).
import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';
const [query, out, w = '1280', h = '800'] = process.argv.slice(2);
const base = process.env.PREVIEW_URL ?? 'http://localhost:5190';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: Number(w), height: Number(h) } });
page.on('console', (m) => { if (m.type() === 'error') console.log('console:', m.text().slice(0, 300)); });
page.on('pageerror', (e) => console.log('pageerror:', e.message));
await page.goto(`${base}/tools/preview/index.html?${query}`, { waitUntil: 'load', timeout: 180000 });
await page.waitForFunction(() => window.previewReady, null, { timeout: 180000 });
await page.waitForTimeout(2500);
await page.screenshot({ path: out, timeout: 180000 });
await browser.close();
console.log('saved', out);
