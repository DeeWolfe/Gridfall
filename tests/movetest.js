// Movement legality: chains, blocked cells, and one move per unit per turn.
import * as A from './support/api.js';
import {failures} from './support/harness.js';
import {spawnUnit, spawnFoe, clearBoard, unlockAll, stillAir} from './support/fixtures.js';

const F = failures();
const cell = (l, c) => l * A.COLS + c;

A.enterProfile(unlockAll(A.blankProfile('MV'), ['scout', 'rifle', 'marks', 'wall']));
A.launch(Object.keys(A.opRun().nodes)[0]);
  stillAir();
clearBoard();

// A: an occupied cell is blocked
const scout = spawnUnit('scout', 2, 1);
const rifle = spawnUnit('rifle', 2, 2);
if (A.moveTargets(scout).includes(cell(2, 2))) F.push('scout should not enter an occupied cell');

// B: once the occupant actually moves, the cell opens
A.doMove(rifle, 2, 3);
if (rifle.col !== 3) F.push('rifleman did not move immediately');
if (!A.moveTargets(scout).includes(cell(2, 2))) F.push('vacated cell still blocked');
A.doMove(scout, 2, 2);
if (scout.col !== 2) F.push('scout did not follow into the vacated cell');

// C: a three-unit column shuffles forward, front first
{
  clearBoard();
  const a = spawnUnit('rifle', 1, 1);
  const b = spawnUnit('rifle', 1, 2);
  const c = spawnUnit('rifle', 1, 3);
  A.doMove(c, 1, 4);
  A.doMove(b, 1, 3);
  A.doMove(a, 1, 2);
  if (!(a.col === 2 && b.col === 3 && c.col === 4)) F.push(`chain failed: ${a.col},${b.col},${c.col}`);
}

// D: moving out of order simply fails for the blocked unit
{
  clearBoard();
  const first = spawnUnit('rifle', 3, 1);
  spawnUnit('rifle', 3, 2);
  A.doMove(first, 3, 2);
  if (first.col !== 1) F.push('unit moved onto an occupied cell');
}

// E: committed units cannot move again
{
  clearBoard();
  const u = spawnUnit('rifle', 4, 1);
  A.doMove(u, 4, 2);
  A.doMove(u, 4, 3);
  if (u.col !== 2) F.push('a committed unit moved twice');
}

// F: still cannot walk onto a hostile
{
  clearBoard();
  const u = spawnUnit('rifle', 0, 1);
  spawnFoe('crawler', 0, 2, 3);
  if (A.moveTargets(u).includes(cell(0, 2))) F.push('unit allowed to move onto a hostile');
}

// G: cellPassable agrees with moveTargets about the board edges
if (A.cellPassable(-1, 0) || A.cellPassable(0, A.COLS)) F.push('off-board cells reported passable');

F.report('movement: all checks pass');
