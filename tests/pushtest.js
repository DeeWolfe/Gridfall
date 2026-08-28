// Outrider: the charge move and the push-back, which must never stack bodies.
import * as A from './support/api.js';
import {failures} from './support/harness.js';
import {spawnUnit, spawnFoe, clearBoard, unlockAll, stillAir} from './support/fixtures.js';

const F = failures();
const cell = (l, c) => l * A.COLS + c;

A.enterProfile(unlockAll(A.blankProfile('PU'), ['outrider', 'rifle', 'marks', 'wall']));
A.launchSpec({node: null, type: 'stronghold', mod: 'none', reward: 0, salv: 0});
  stillAir();
clearBoard();

// A: charge offers two cells forward, but only through a clear path
{
  const u = spawnUnit('outrider', 2, 1);
  const t = A.moveTargets(u);
  if (!t.includes(cell(2, 2))) F.push('one forward missing');
  if (!t.includes(cell(2, 3))) F.push('charge to two forward missing');
  if (t.includes(cell(2, 4))) F.push('charge overshoots its reach');

  clearBoard();
  const v = spawnUnit('outrider', 2, 1);
  spawnUnit('wall', 2, 2);
  if (A.moveTargets(v).includes(cell(2, 3))) F.push('charged straight through a blocker');
}

// B: a non-charger gets no extra reach
{
  clearBoard();
  const r = spawnUnit('rifle', 2, 1);
  if (A.moveTargets(r).includes(cell(2, 3))) F.push('a plain unit was offered a charge');
}

// C: push drives the survivor back one cell; damage lands either way
{
  clearBoard();
  const u = spawnUnit('outrider', 1, 2);
  const e = spawnFoe('hulk', 1, 3, 40);
  A.doAttack(u, e);
  if (e.hp >= 40) F.push('no damage dealt');
  if (e.col !== 4) F.push('survivor was not pushed back, col ' + e.col);
}

// D: push fails against the board edge — damage still applies, no wraparound
{
  clearBoard();
  const u = spawnUnit('outrider', 1, A.COLS - 2);
  const e = spawnFoe('hulk', 1, A.COLS - 1, 40);
  A.doAttack(u, e);
  if (e.hp >= 40) F.push('edge case: no damage dealt');
  if (e.col !== A.COLS - 1) F.push('pushed off the board, col ' + e.col);
}

// E: push fails into an occupied cell — never two bodies on one cell
{
  clearBoard();
  const u = spawnUnit('outrider', 3, 2);
  const e = spawnFoe('hulk', 3, 3, 40);
  const behind = spawnFoe('crawler', 3, 4, 40);
  A.doAttack(u, e);
  if (e.col !== 3) F.push('pushed into an occupied cell');
  if (behind.col !== 4) F.push('bystander moved');
  const bodies = A.G.enemies.filter(x => x.lane === 3 && x.col === 4).length;
  if (bodies !== 1) F.push('two bodies share a cell');
}

// F: a kill needs no push — the target is simply gone
{
  clearBoard();
  const u = spawnUnit('outrider', 4, 2);
  spawnFoe('crawler', 4, 3, 1);
  const before = A.G.kills;
  A.doAttack(u, A.G.enemies[A.G.enemies.length - 1]);
  if (A.G.kills !== before + 1) F.push('kill not recorded');
  if (A.G.enemies.some(x => x.lane === 4)) F.push('dead hostile still on the board');
}

F.report('outrider charge and push: all checks pass');
