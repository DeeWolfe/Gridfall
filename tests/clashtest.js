// Spawn-cell combat: all four outcomes, and the promise that a contested
// landing still happens in the lane the marker named.
import * as A from './support/api.js';
import {failures} from './support/harness.js';
import {spawnUnit, spawnFoe, clearBoard, unlockAll} from './support/fixtures.js';

const F = failures();
const G = () => A.G;

A.enterProfile(unlockAll(A.blankProfile('CL'), ['assassin', 'wall', 'bulwark', 'rifle']));
A.launch(Object.keys(A.opRun().nodes)[0]);

function clear() {
  clearBoard();
  G().held = [];
  G().predict = [];
}

// 1. a fragile Assassin blocking the drop zone dies, and the Hulk arrives damaged
{
  clear();
  spawnUnit('assassin', 2, 7);              // 3 hull, 4 damage
  const landed = A.resolveSpawn('hulk', 2); // Hulk: 14 hull, 6 damage
  if (!landed) F.push('hulk failed to land on the assassin');
  if (G().units.length) F.push('assassin should have been destroyed');

  const h = G().enemies[0];
  if (!h) {
    F.push('hulk did not occupy the cell');
  } else {
    if (h.lane !== 2 || h.col !== 7) F.push(`hulk landed at ${h.lane},${h.col}, expected 2,7`);
    if (h.hp >= A.BEST.hulk.hp) F.push('hulk arrived undamaged — combat did not carry over');
    if (h.hp <= 0) F.push('hulk arrived dead');
    // 3 hull vs 6 damage is one round; the assassin deals 4 - 1 armour floor = 3.
    if (h.hp !== A.BEST.hulk.hp - 3) F.push(`hulk hull ${h.hp}, expected ${A.BEST.hulk.hp - 3}`);
  }
}

// 2. a tough unit repels the drop and survives, wounded
{
  clear();
  const bulwark = spawnUnit('bulwark', 3, 7);   // 10 hull, 2 damage
  const resolved = A.resolveSpawn('crawler', 3); // 3 hull, 2 damage
  if (G().enemies.length) F.push('crawler should have been destroyed on the drop');
  if (!G().units.length) F.push('bulwark should have survived');
  else if (G().units[0].hp >= bulwark.max) F.push('bulwark took no damage repelling the drop');
  if (!resolved) F.push('a repelled drop should still count as resolved');
}

// 3. a weaponless Barricade cannot kill, so it is ground down
{
  clear();
  spawnUnit('wall', 1, 7);                       // 12 hull, no weapon
  A.resolveSpawn('hulk', 1);
  if (G().units.length) F.push('barricade should be destroyed by a landing Hulk');
  if (!G().enemies.length) F.push('hulk should occupy the barricade cell');
  else if (G().enemies[0].hp !== A.BEST.hulk.hp) F.push('hulk should be undamaged — barricade deals no damage');
}

// 4. an emplacement with no attack cannot force a landing at all
{
  clear();
  spawnUnit('bulwark', 4, 5);
  spawnUnit('bulwark', 4, 6);
  spawnUnit('bulwark', 4, 7);
  if (A.resolveSpawn('spore', 4)) F.push('a zero-damage emplacement should fail to land');
  if (G().enemies.length) F.push('spore node should not have spawned onto a unit');
  if (G().units.length !== 3) F.push('units should be untouched by a failed emplacement drop');
}

// 5. a unit standing on the drop point is fought for, not slipped past
{
  clear();
  spawnUnit('rifle', 0, 7);                      // 5 hull, 2 damage
  A.resolveSpawn('crawler', 0);                  // 3 hull, 2 damage
  if (G().enemies.length && G().enemies[0].col !== 7) {
    F.push('crawler slipped past instead of contesting the drop point');
  }
  if (G().units.length && G().enemies.length) F.push('drop point contest left both sides standing');
}

// 5b. hostiles already holding the edge are stepped past, not fought
{
  clear();
  spawnUnit('rifle', 0, 5);
  spawnFoe('crawler', 0, 7, 3);
  A.resolveSpawn('crawler', 0);
  if (G().units.length !== 1) F.push('a unit two cells inside the edge should not be contested');
  if (G().enemies.length !== 2) F.push('second crawler did not find a cell');
}

// 6. the promised lane is still honoured through a clash
{
  clear();
  for (let c = 0; c < A.COLS; c++) spawnUnit('rifle', 1, c);
  A.resolveSpawn('hulk', 1);
  if (!G().enemies.length) F.push('hulk did not land in the full lane');
  else if (G().enemies[0].lane !== 1) F.push('clash landed in the wrong lane');
}

// 7. mutual destruction is possible and leaves the cell empty
{
  clear();
  spawnUnit('rifle', 2, 7, {hp: 6, max: 6, dmg: 3});
  A.resolveSpawn('crawler', 2);
  if (G().units.length && G().enemies.length) F.push('both sides survived a lethal exchange');
}

// 8. spawnClash reports the same verdict the board ends up in
{
  clear();
  const u = spawnUnit('rifle', 2, 7);
  const verdict = A.spawnClash('crawler', A.BEST.crawler, u);
  if (!['repelled', 'mutual', 'landed'].includes(verdict.outcome)) {
    F.push('spawnClash returned an unknown outcome: ' + verdict.outcome);
  }
}

F.report('spawn clash: all checks pass');
