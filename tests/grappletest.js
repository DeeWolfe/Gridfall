// Grapple Net: drags a lane's hostiles two cells toward their edge, clamped
// at the last column, blocked by bodies, never stacking two on a cell.
// Resolution is invoked directly so the drag is measured in isolation; the
// delayed-timing contract itself is stratagemtest's job.
import * as A from './support/api.js';
import {failures} from './support/harness.js';
import {spawnUnit, spawnFoe, clearBoard, unlockAll, stillAir} from './support/fixtures.js';

const F = failures();

const start = () => {
  const p = unlockAll(A.blankProfile('GR'), ['rifle', 'marks', 'wall', 'medic']);
  A.enterProfile(p);
  p.lead = 'riptide';                              // carries Grapple Net
  A.launchSpec({node: null, type: 'stronghold', mod: 'none', reward: 0});
  stillAir();
  clearBoard();
};

// A: a clear lane drags everything two cells back; other lanes untouched
{
  start();
  const a = spawnFoe('crawler', 2, 3, 30);
  const b = spawnFoe('crawler', 2, 6, 30);
  const c = spawnFoe('crawler', 3, 3, 30);
  A.playStratagem({lane: 2});
  A.resolveStratagem();
  if (a.col !== 5) F.push('mid-lane drag wrong: ' + a.col);
  if (b.col !== A.COLS - 1) F.push('edge-bound drag not clamped: ' + b.col);
  if (c.col !== 3) F.push('grapple crossed lanes');
}

// B: clamped at the last column, stopped by a standing unit
{
  start();
  spawnUnit('wall', 1, 5);
  const near = spawnFoe('crawler', 1, 3, 30);
  const edge = spawnFoe('crawler', 1, 7, 30);
  A.playStratagem({lane: 1});
  A.resolveStratagem();
  if (edge.col !== 7) F.push('edge hostile moved off the board: ' + edge.col);
  if (near.col !== 4) F.push('drag passed through a unit: ' + near.col);
  const cells = A.G.enemies.map(e => e.lane + ',' + e.col);
  if (new Set(cells).size !== cells.length) F.push('two hostiles stacked on one cell');
}

// C: a file compresses toward the edge without stacking (farthest first)
{
  start();
  const front = spawnFoe('crawler', 4, 5, 30);
  const back = spawnFoe('crawler', 4, 6, 30);
  A.playStratagem({lane: 4});
  A.resolveStratagem();
  if (back.col !== 7) F.push('rear of the file should reach the edge: ' + back.col);
  if (front.col !== 6) F.push('front of the file should stop behind it: ' + front.col);
  const cells = A.G.enemies.map(e => e.lane + ',' + e.col);
  if (new Set(cells).size !== cells.length) F.push('file drag stacked bodies');
}

F.report('grapple net: all checks pass');
