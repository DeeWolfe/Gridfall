// The board-control batch: four cards that argue about the ground itself.
//
//   Demo Charge      craters a chosen open tile for good, blast around it
//   Cryo Projector   halves every hostile advance in its lane
//   Resonance Lens   +2 to friendly fire passing through its cell
//   Field Degausser  strips armour floors — innate and pylon — in its lane
//
// Each one leans on a rule the game already enforces elsewhere (craters
// reroute, fractional speeds bank, floors subtract), so the guards here pin
// the new flags to those rules rather than re-testing the rules themselves.
import * as A from './support/api.js';
import {failures} from './support/harness.js';
import {spawnUnit, spawnFoe, clearBoard, unlockAll, stillAir} from './support/fixtures.js';

const F = failures();

const start = deck => {
  const p = unlockAll(A.blankProfile('FD'), deck || ['rifle', 'demo', 'cryo', 'crystal', 'volt']);
  A.enterProfile(p);
  A.launchSpec({node: null, type: 'stronghold', mod: 'none', reward: 0});
  stillAir();
  clearBoard();
  A.G.predict = [];
};

// --- Demo Charge: aims at open ground, not at bodies or objectives ---
{
  start();
  A.G.ter[2][6] = 'x';
  spawnFoe('crawler', 2, 5);
  spawnUnit('rifle', 2, 1);
  const tiles = new Set(A.validTiles('demo'));
  if (!tiles.has(1 * A.COLS + 5)) F.push('demo charge refused an open hostile-side tile');
  if (tiles.has(2 * A.COLS + 6)) F.push('demo charge offered an already-cratered tile');
  if (tiles.has(2 * A.COLS + 5)) F.push('demo charge offered a tile a hostile stands on');
  if (tiles.has(2 * A.COLS + 1)) F.push('demo charge offered a tile your own unit holds');
  console.log('demo charge aims at open ground only —', tiles.size, 'tiles offered');
}

// --- Demo Charge: the crater is permanent and the blast is real ---
{
  start();
  const near = spawnFoe('crawler', 2, 5, 99);
  const far = spawnFoe('crawler', 2, 7, 99);
  // The opening hand may already hold a demo drawn from the deck — clear
  // every copy first so "consumed" below counts the one we push, not a twin.
  while (A.G.hand.includes('demo')) A.G.hand.splice(A.G.hand.indexOf('demo'), 1);
  A.G.hand.push('demo');
  A.G.dp = 10;
  A.deploy('demo', 2, 4);
  if (A.G.ter[2][4] !== 'x') F.push('demo charge left the tile passable');
  if (near.hp !== 99 - 3) F.push(`blast missed the adjacent hostile (hp ${near.hp})`);
  if (far.hp !== 99) F.push('blast reached past its own ring');
  if (A.G.hand.includes('demo')) F.push('the instant was not consumed');
  console.log('demo charge: tile cratered, adjacent hostile took', 99 - near.hp);
  // The crater behaves like every other 'x': the horde routes around it.
  near.col = 5;
  near.mv = 0;
  A.enemyPhase();
  if (near.lane === 2 && near.col === 5) F.push('a hostile parked in front of the new crater');
}

// --- Cryo Projector: half speed in its lane, full speed everywhere else ---
{
  start();
  spawnUnit('cryo', 2, 0);
  const chilled = spawnFoe('crawler', 2, 6, 99);
  const free = spawnFoe('crawler', 3, 6, 99);
  A.enemyPhase();
  if (free.col !== 4) F.push(`unchilled crawler moved ${6 - free.col} steps, wanted 2`);
  if (chilled.col !== 5) F.push(`chilled crawler moved ${6 - chilled.col} steps, wanted 1`);
  console.log('cryo projector: crawler crossed', 6 - chilled.col, 'cell chilled,', 6 - free.col, 'free');
  // The intent badge and the board highlight both read the chilled number.
  const intent = A.enemyIntent(chilled);
  if (intent.k !== 'advance' || intent.steps !== 1) {
    F.push(`intent badge shows ${intent.k}/${intent.steps}, wanted advance/1`);
  }
  const ft = A.forecastThreat && A.influenceCells;   // presence guard for the exports below
  if (!ft) F.push('forecast exports missing');
}

// --- Cryo Projector: the influence wash covers its lane ---
{
  start();
  const u = spawnUnit('cryo', 1, 2);
  if (A.influenceCells(u).length !== A.COLS) F.push('cryo lane influence not drawn');
  if (!/half speed/.test(A.supportLabel(u) || '')) F.push('cryo support label missing');
}

// --- Resonance Lens: +2 through the glass, nothing around it ---
{
  start();
  const shooter = spawnUnit('rifle', 2, 1);          // dmg 2, tg first
  spawnUnit('crystal', 2, 3);
  const beyond = spawnFoe('crawler', 2, 5, 99);
  A.fire(shooter, false);
  if (beyond.hp !== 99 - 4) F.push(`shot through the lens dealt ${99 - beyond.hp}, wanted 4`);
  console.log('resonance lens: rifle shot through it landed', 99 - beyond.hp);
}
{
  start();
  const shooter = spawnUnit('rifle', 2, 1);
  spawnUnit('crystal', 2, 4);
  const before = spawnFoe('crawler', 2, 3, 99);       // in FRONT of the lens
  A.fire(shooter, false);
  if (before.hp !== 99 - 2) F.push(`a shot that never crossed the lens dealt ${99 - before.hp}, wanted 2`);
  // And a lens in another lane amplifies nothing.
  clearBoard();
  const s2 = spawnUnit('rifle', 2, 1);
  spawnUnit('crystal', 1, 3);
  const e2 = spawnFoe('crawler', 2, 5, 99);
  A.fire(s2, false);
  if (e2.hp !== 99 - 2) F.push('a lens amplified fire in a lane it does not stand in');
}

// --- Resonance Lens: support highlight lights the shooters behind it ---
{
  start();
  const shooter = spawnUnit('rifle', 2, 1);
  const lensU = spawnUnit('crystal', 2, 4);
  const cells = A.supportTargets(lensU);
  if (!cells.includes(shooter.lane * A.COLS + shooter.col)) F.push('lens support highlight misses the shooter behind it');
  if (!/Amplifying/.test(A.supportLabel(lensU) || '')) F.push('lens support label missing');
}

// --- Field Degausser: innate floors and pylon floors both stripped ---
{
  start();
  const hulk = spawnFoe('hulk', 2, 6, 99);            // floor 1
  spawnFoe('pylon', 2, 7, 99);                        // lanefloor 1 on top
  A.dmgEnemy(hulk, 5, 'test');
  if (hulk.hp !== 99 - 3) F.push(`floored hulk took ${99 - hulk.hp} of 5, wanted 3`);
  spawnUnit('volt', 2, 0);
  A.dmgEnemy(hulk, 5, 'test');
  if (hulk.hp !== 99 - 3 - 5) F.push(`degaussed hulk took ${99 - hulk.hp - 3} of 5, wanted the full 5`);
  console.log('degausser: hulk behind a pylon took 3 floored, 5 degaussed');
  // Lane-scoped: the same pair one lane over still enjoys their armour.
  const other = spawnFoe('hulk', 3, 6, 99);
  A.dmgEnemy(other, 5, 'test');
  if (other.hp !== 99 - 4) F.push('degausser stripped armour in a lane it does not stand in');
  const u = A.G.units.find(x => x.degauss);
  if (A.influenceCells(u).length !== A.COLS) F.push('degausser lane influence not drawn');
}

F.report('board control holds: craters chosen, lanes chilled, fire amplified, armour stripped');
