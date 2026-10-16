// Скриншоты схемы: node tools/continent/shots.mjs [outDir]
// Требует собранный viewer/site и playwright (из репозитория или /opt/node-tools).
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { extname, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const here = dirname(fileURLToPath(import.meta.url));
const site = join(here, 'viewer', 'site');
const out = process.argv[2] || '/tmp/claude-0/continent_shots';
await mkdir(out, { recursive: true });
const req = createRequire(import.meta.url);
let pw; try { pw = req('playwright'); } catch { pw = req('/opt/node-tools/node_modules/playwright'); }
const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.bin': 'application/octet-stream' };
const srv = createServer(async (q, r) => {
  const p = join(site, decodeURIComponent(q.url.split('?')[0]).replace(/\/$/, '/index.html'));
  try { const b = await readFile(p); r.writeHead(200, { 'content-type': types[extname(p)] || 'application/octet-stream' }); r.end(b); } catch { r.writeHead(404); r.end(); }
}).listen(0);
const port = srv.address().port;
const browser = await pw.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
page.on('console', m => { if (m.type() === 'error') console.log('console:', m.text()); });
page.on('pageerror', e => console.log('pageerror:', e.message));
await page.goto(`http://localhost:${port}/index.html`);
await page.waitForFunction(() => window.continent && window.continent.ready, null, { timeout: 180000 });
const custom = process.env.CUSTOM ? JSON.parse(process.env.CUSTOM) : null; // {name: {t,d,az,el,mode}}
const shots = custom ? Object.keys(custom) : (process.env.SHOTS || 'overview,topBiome,topHeight,north,canyon,falls,rift,zelenodol,snezhny,peschany').split(',');
for (const v of shots) {
  await page.evaluate(n => window.continent.setView(n), custom ? custom[v] : v);
  await page.waitForTimeout(200); await page.waitForFunction(() => !window.continent.busy(), null, { timeout: 300000 }); await page.evaluate(() => window.continent.renderNow());
  await page.screenshot({ timeout: 300000, animations: 'disabled', path: join(out, `${v}.jpg`), type: 'jpeg', quality: 85 });
  console.log('shot', v);
}
await browser.close(); srv.close();
