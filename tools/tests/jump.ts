/** Headless checks for the jump: arc, no double jump, buffering, walls still block. Run: npx tsx tools/tests/jump.ts */
import { Run } from '../../src/game/Run';
import { NullFx } from '../../src/game/types';
import { MAP_BY_ID } from '../../src/data/maps';
import { HERO_BY_ID } from '../../src/data/heroes';
import { DIFFICULTY_BY_ID } from '../../src/data/difficulty';
import { BALANCE } from '../../src/config/balance';

const run = new Run({
  map: MAP_BY_ID.blightwood, diff: DIFFICULTY_BY_ID.normal, hero: HERO_BY_ID.sorceress, permanent: {}, mode: 'campaign',
  fx: NullFx, settings: { damageNumbers: false }, tr: (k: string) => k, seed: 7,
});
run.debug.god = true;
const p = run.player;
const dt = 1 / 60;
let fails = 0;
const ok = (c: boolean, msg: string) => {
  console.log((c ? 'ok   ' : 'FAIL ') + msg);
  if (!c) fails++;
};
p.requestJump();
let maxY = 0;
let t = 0;
let pressedMidAir = false;
while (t < 2) {
  run.update(dt, 0, 0);
  t += dt;
  maxY = Math.max(maxY, p.jumpY);
  if (!pressedMidAir && p.jumpPhase === 'air' && p.jumpY > 0.8 && p.jumpV > 0) {
    pressedMidAir = true;
    p.requestJump(); // too early for the buffer: must not double jump
  }
}
ok(Math.abs(maxY - BALANCE.jump.height) < 0.08, `apex ${maxY.toFixed(2)} ≈ ${BALANCE.jump.height}`);
ok(run.stats.jumps === 1, `no double jump (jumps=${run.stats.jumps})`);
ok(p.jumpY === 0 && p.jumpPhase === 'ground', 'landed');
// buffered press just before landing
p.requestJump();
let landed = 0;
let second = false;
for (let i = 0; i < 200; i++) {
  run.update(dt, 0, 0);
  if (p.jumpPhase === 'air' && p.jumpV < 0 && p.jumpY < 0.15 && !second) {
    second = true;
    p.requestJump();
  }
  if (p.jumpPhase === 'land') landed++;
}
ok(run.stats.jumps === 3, `buffered press re-jumps after landing (jumps=${run.stats.jumps})`);
// walls: jump straight at a wall, hero must not cross it
const tr = run.terrain;
let wx = -1;
let wz = -1;
for (let z = 20; z < tr.size - 20 && wx < 0; z++)
  for (let x = 20; x < tr.size - 20; x++)
    if (tr.blocksWalker(x, z) && !tr.blocksWalker(x - 1, z) && !tr.blocksWalker(x - 2, z) && !tr.blocksWalker(x - 3, z) && tr.blocksWalker(x + 1, z)) {
      wx = x;
      wz = z;
      break;
    }
p.x = wx - 2.5;
p.z = wz + 0.5;
for (let i = 0; i < 120; i++) {
  if (i % 40 === 0) p.requestJump();
  run.update(dt, 1, 0);
}
ok(p.x < wx, `walls block in the air (x=${p.x.toFixed(2)} wall at ${wx})`);
// dying in the air cancels the jump
run.debug.god = false;
p.cancelJump();
p.requestJump();
for (let i = 0; i < 12; i++) run.update(dt, 0, 0);
const wasAir = p.jumpY > 0.2;
p.hurt(1e9, null, true);

ok(wasAir && p.dead && p.jumpY === 0 && p.jumpPhase === 'ground', 'death mid-air drops to the ground');
process.exit(fails ? 1 : 0);
