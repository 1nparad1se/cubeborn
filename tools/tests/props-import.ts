/** Importing camps.ts first (before place.ts / index.ts) must work: no TDZ in the props registry cycle. Run: npx tsx tools/tests/props-import.ts */
import { placeCamp } from '../../src/world/props/camps';
import { Terrain } from '../../src/game/Terrain';

const t = new Terrain(40);
for (let z = 0; z < 40; z++) for (let x = 0; x < 40; x++) t.setTile(x, z, 'grass');
placeCamp(t, 'orc', 'large', 20, 20, 3);
const ok = t.props.length > 20;
console.log((ok ? 'ok   ' : 'FAIL ') + `camps-first import places a large camp (${t.props.length} props)`);
process.exit(ok ? 0 : 1);
