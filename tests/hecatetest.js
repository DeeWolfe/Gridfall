// Hecate Platform: board-wide furthest-column targeting through blockers, and
// the recharge cycle that forbids firing on consecutive turns.
import * as A from './support/api.js';
import {failures} from './support/harness.js';
import {spawnUnit, spawnFoe, clearBoard, unlockAll} from './support/fixtures.js';

const F = failures();

A.enterProfile(unlockAll(A.blankProfile('HC'), ['hecate', 'rifle', 'wall', 'marks']));
A.launchSpec({node: null, type: 'stronghold', mod: 'none', reward: 0, salv: 0});
clearBoard();

// A: targets the highest column anywhere — not its own lane's first hostile
{
  const u = spawnUnit('hecate', 0, 1);
  spawnFoe('crawler', 0, 3, 30);          // nearest, own lane
  const deep = spawnFoe('spitter', 4, 7, 30);   // deepest, far lane
  const g = A.geomFor(u);
  if (g.length !== 1) F.push('expected exactly one target, got ' + g.length);
  if (g[0].uid !== deep.uid) F.push('did not pick the furthest hostile on the board');
}

// B: blockers do not cut the shot
{
  clearBoard();
  const u = spawnUnit('hecate', 2, 1);
  spawnUnit('wall', 2, 3);                       // own blocker in the lane
  const deep = spawnFoe('hulk', 2, 6, 30);
  const g = A.geomFor(u);
  if (!g.length || g[0].uid !== deep.uid) F.push('a blocker cut the board-wide shot');
}

// C: firing starts the cycle — no target offered next turn, then ready again
{
  clearBoard();
  const u = spawnUnit('hecate', 1, 1);
  const e = spawnFoe('crawler', 1, 6, 60);   // no armour floor — the full 8 lands
  A.doAttack(u, e);
  if (e.hp !== 60 - 8) F.push('hecate hit for ' + (60 - e.hp) + ', expected 8');
  if (u.cycling <= 0) F.push('firing did not start the recharge cycle');

  A.playerPhase();                               // end of the firing turn
  if (u.cycling !== 1) F.push('cycle should hold through the next turn, got ' + u.cycling);
  if (A.geomFor(u).length) F.push('offered a target while cycling');
  const hpMid = e.hp;
  A.playerPhase();                               // it auto-fires nothing while cycling
  if (e.hp !== hpMid) F.push('fired while cycling');
  if (u.cycling !== 0) F.push('cycle did not clear');
  if (!A.geomFor(u).length) F.push('no target offered after the cycle cleared');
}

// D: holding fire keeps it ready — the cycle only follows a shot
{
  clearBoard();
  const u = spawnUnit('hecate', 3, 1);
  if (u.cycling) F.push('fresh platform starts mid-cycle');
  A.playerPhase();
  spawnFoe('crawler', 3, 5, 30);
  if (!A.geomFor(u).length) F.push('an idle platform should be ready to fire');
}

F.report('hecate platform: all checks pass');
