// Breaching Charge: sweeps one column, killing everything at or below the
// hull threshold, sparing everything above it, blockers no protection.
import * as A from './support/api.js';
import {failures} from './support/harness.js';
import {spawnUnit, spawnFoe, clearBoard, unlockAll, stillAir} from './support/fixtures.js';

const F = failures();

const start = () => {
  const p = unlockAll(A.blankProfile('BR'), ['rifle', 'marks', 'wall', 'medic']);
  A.enterProfile(p);
  p.lead = 'firebrand';                            // carries Breaching Charge
  A.launchSpec({node: null, type: 'stronghold', mod: 'none', reward: 0, salv: 0});
  stillAir();
  clearBoard();
};

// A: kills at or below the threshold, spares above, leaves other columns alone
{
  start();
  const weak = spawnFoe('crawler', 1, 5, A.BREACH_HULL);       // exactly at it
  const tough = spawnFoe('hulk', 2, 5, A.BREACH_HULL + 1);     // just over
  const bystander = spawnFoe('crawler', 3, 6, 3);              // other column
  const kills = A.G.kills;
  A.playStratagem({col: 5});
  A.resolveStratagem();
  if (A.G.enemies.some(e => e.uid === weak.uid)) F.push('at-threshold hostile survived');
  if (!A.G.enemies.some(e => e.uid === tough.uid)) F.push('over-threshold hostile died');
  if (!A.G.enemies.some(e => e.uid === bystander.uid)) F.push('the charge leaked into another column');
  if (A.G.kills !== kills + 1) F.push('kill not recorded');
}

// B: blockers are no protection — the charge reaches behind your own wall
{
  start();
  spawnUnit('wall', 2, 3);                         // friendly blocker in the lane
  const dugIn = spawnFoe('spitter', 2, 6, 5);
  A.playStratagem({col: 6});
  A.resolveStratagem();
  if (A.G.enemies.length) F.push('a blocker shielded the target from the charge');
}

// C: armour floors do not blunt it — the kill is outright
{
  start();
  // A hulk reduces incoming damage by 1, but a wounded one still dies.
  const wounded = spawnFoe('hulk', 0, 4, 6);
  A.playStratagem({col: 4});
  A.resolveStratagem();
  if (A.G.enemies.length) F.push('armour floor blunted the breaching charge');
}

F.report('breaching charge: all checks pass');
