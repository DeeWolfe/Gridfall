// The new hostiles: the Husk's death split, the Mender's triage, and the
// Screamer's death rush — each fires under its condition and nowhere else.
import * as A from './support/api.js';
import {failures} from './support/harness.js';
import {spawnUnit, spawnFoe, clearBoard, unlockAll, stillAir} from './support/fixtures.js';

const F = failures();

const start = () => {
  A.enterProfile(unlockAll(A.blankProfile('FO'), ['rifle', 'marks', 'wall', 'medic']));
  A.launchSpec({node: null, type: 'stronghold', mod: 'none', reward: 0});
  stillAir();
  clearBoard();
};

// A: a Husk's death spills two Crawlers into the free ground around it
{
  start();
  const h = spawnFoe('husk', 2, 4, 1);
  A.dmgEnemy(h, 9, 'test', true);
  const crawlers = A.G.enemies.filter(e => e.k === 'crawler');
  if (crawlers.length !== 2) F.push('husk split into ' + crawlers.length + ' crawlers, expected 2');
  const cells = A.G.enemies.map(e => e.lane + ',' + e.col);
  if (new Set(cells).size !== cells.length) F.push('split stacked bodies');
  if (!crawlers.some(c => c.lane === 2 && c.col === 4)) F.push('no crawler in the wreck cell');
}

// B: a boxed-in Husk splits only into what fits; a wounded Husk does not split
{
  start();
  spawnUnit('wall', 1, 3);
  spawnUnit('wall', 1, 5);
  spawnUnit('rifle', 0, 4);
  spawnUnit('marks', 2, 4);
  const h = spawnFoe('husk', 1, 4, 1);
  A.dmgEnemy(h, 9, 'test', true);
  // The wreck cell itself is always vacated, so exactly one fits.
  const spilled = A.G.enemies.filter(e => e.k === 'crawler');
  if (spilled.length !== 1) F.push('boxed-in husk should spill exactly 1, got ' + spilled.length);

  const h2 = spawnFoe('husk', 3, 4, 6);
  A.dmgEnemy(h2, 2, 'test', true);
  if (A.G.enemies.filter(e => e.k === 'crawler').length > spilled.length) {
    F.push('a merely wounded husk split');
  }
}

// C: the Mender heals the most wounded hostile instead of moving or striking
{
  start();
  const m = spawnFoe('mender', 2, 5, 8);
  const badly = spawnFoe('hulk', 2, 6, 4);       // 4/14
  const lightly = spawnFoe('breacher', 2, 7, 6); // 6/7
  A.enemyPhase();
  if (badly.hp !== 6) F.push('mender healed ' + (badly.hp - 4) + ', expected 2 into the worst case');
  if (lightly.hp !== 6 + 0) F.push('mender healed the wrong patient');
  if (m.col !== 5) F.push('mender moved on a turn it healed');
}

// D: with nothing to treat it advances, and blocked with no weapon it waits
{
  start();
  const m = spawnFoe('mender', 1, 5, 8);
  A.enemyPhase();
  if (m.col !== 4) F.push('idle mender should advance, col ' + m.col);
  clearBoard();
  const m2 = spawnFoe('mender', 3, 5, 8);
  const u = spawnUnit('wall', 3, 4);
  A.enemyPhase();
  if (m2.col !== 5) F.push('blocked mender moved');
  if (u.hp !== u.max) F.push('an unarmed mender struck for damage');
  const t = A.forecastThreat();
  if (t.atk[m2.uid]) F.push('forecast shows an unarmed hostile striking');
}

// E: the Scream — everything steps forward once; blockers still block
{
  start();
  const s = spawnFoe('screamer', 2, 5, 1);
  const far = spawnFoe('crawler', 0, 6, 20);
  const held = spawnFoe('crawler', 1, 5, 20);
  spawnUnit('wall', 1, 4);                       // holds that one in place
  A.dmgEnemy(s, 9, 'test', true);
  if (far.col !== 5) F.push('the scream did not carry a free hostile forward');
  if (held.col !== 5) F.push('the scream pushed a hostile through a blocker');
}

// F: a scream at the line converts front-runners into breaches
{
  start();
  const s = spawnFoe('screamer', 2, 5, 1);
  spawnFoe('crawler', 4, 0, 20);                 // already at your edge
  A.G.gridCharge[4] = 0;                         // lane's Last-Stand already spent
  const before = A.G.breaches;
  A.dmgEnemy(s, 9, 'test', true);
  if (A.G.breaches !== before + 1) F.push('a scream at the line should breach');
  if (A.G.enemies.some(e => e.col < 0)) F.push('an enemy walked off the board instead of breaching');
}

F.report('new hostiles: all checks pass');
