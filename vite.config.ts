import { defineConfig, type Plugin } from 'vite';
import { cpSync, existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';

/**
 * The continent «Расколотые Земли» data (baked by tools/continent, committed under
 * tools/continent/viewer/site/data) is served at `continent/` in dev and copied into the build.
 * Only the files the game reads: atlases (64 PNG), overview heights and maps, world/feature JSON,
 * detail instances. Everything uses served extensions (.png, .json, .wasm).
 */
const CONTINENT_SRC = resolve(__dirname, 'tools/continent/viewer/site/data');
const CONTINENT_FILES = ['height_2048.wasm', 'maps_2048.png', 'world.json', 'features.json', 'detail.wasm', 'detail_kinds.json', 'atlas'];
const TYPES: Record<string, string> = { '.png': 'image/png', '.json': 'application/json', '.wasm': 'application/wasm' };

function continentData(): Plugin {
  let outDir = 'dist';
  return {
    name: 'continent-data',
    configResolved(c) {
      outDir = resolve(c.root, c.build.outDir);
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = decodeURIComponent((req.url ?? '').split('?')[0]);
        const m = url.match(/\/continent\/(.+)$/);
        if (!m) return next();
        const p = join(CONTINENT_SRC, m[1]);
        if (!p.startsWith(CONTINENT_SRC) || !existsSync(p) || !statSync(p).isFile()) return next();
        res.setHeader('content-type', TYPES[extname(p)] ?? 'application/octet-stream');
        res.end(readFileSync(p));
      });
    },
    closeBundle() {
      for (const f of CONTINENT_FILES) {
        const src = join(CONTINENT_SRC, f);
        if (!existsSync(src)) throw new Error(`continent data missing: ${src}`);
        if (statSync(src).isDirectory()) {
          for (const g of readdirSync(src)) if (TYPES[extname(g)]) cpSync(join(src, g), join(outDir, 'continent', f, g));
        } else cpSync(src, join(outDir, 'continent', f));
      }
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [continentData()],
  build: {
    target: 'es2020',
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 1500,
  },
});
