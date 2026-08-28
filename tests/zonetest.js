// Deployment zones: Forward Base needs held ground in column 3+, Minefield
// takes any ground in column 3+ — and the mine's entry trigger fires once.
import * as A from './support/api.js';
import {failures} from './support/harness.js';
import {spawnUnit, spawnFoe, clearBoard, unlockAll, stillAir} from './support/fixtures.js';

const F = failures();
const cell = (l, c) => l * A.COLS + c;

A.enterProfile(unlockAll(A.blankProfile('ZN'), ['fob', 'mine', 'rifle', 'wall']));
A.launchSpec({node: null, type: 'stronghold', mod: 'none', reward: 0});
  stillAir();
clearBoard();

// The fresh board: columns 0-2 yours, 3-4 neutral, 5-7 hostile.

// A: Forward Base — held ground only, column 3 and beyond
{
  const tiles = A.validTiles('fob');
  if (tiles.some(i => i % A.COLS < 3)) F.push('Forward Base offered columns 0-2');
  if (tiles.length) F.push('Forward Base deployable with no held ground past column 2');
  A.G.ter[2][3] = 'p';
  const after = A.validTiles('fob');
  if (!after.includes(cell(2, 3))) F.push('Forward Base rejects a held tile in its zone');
  if (after.some(i => A.G.ter[(i / A.COLS) | 0][i % A.COLS] !== 'p')) {
    F.push('Forward Base offered unheld ground');
  }
  A.G.ter[2][3] = 'n';
}

// B: Minefield — any ground from column 3, hostile ground included
{
  const tiles = A.validTiles('mine');
  if (tiles.some(i => i % A.COLS < 3)) F.push('Minefield offered columns 0-2');
  if (!tiles.includes(cell(1, 6))) F.push('Minefield rejects hostile ground in its zone');
  if (!tiles.includes(cell(1, 3))) F.push('Minefield rejects neutral ground in its zone');
}

// C: hostiles walk onto a mine rather than stopping to attack it
{
  clearBoard();
  const m = spawnUnit('mine', 2, 4);
  const e = spawnFoe('crawler', 2, 5, 20);
  const t = A.forecastThreat();
  if (t.atk[e.uid]) F.push('a mine drew a strike instead of an entry');
  A.enemyPhase();
  if (A.G.units.some(x => x.uid === m.uid)) F.push('mine survived detonation');
  if (e.hp !== 20 - 6) F.push('mine damage wrong: ' + (20 - e.hp));
}

// D: the mine is spent on the first body — the second walks through free
{
  clearBoard();
  spawnUnit('mine', 3, 4);
  const first = spawnFoe('crawler', 3, 5, 20);
  const second = spawnFoe('crawler', 3, 6, 20);
  A.enemyPhase();
  const total = (20 - first.hp) + (20 - second.hp);
  if (total !== 6) F.push('mine dealt ' + total + ' across the wave, expected 6 once');
}

// E: a lethal detonation kills and stops the hostile
{
  clearBoard();
  spawnUnit('mine', 1, 4);
  spawnFoe('crawler', 1, 5, 3);
  const kills = A.G.kills;
  A.enemyPhase();
  if (A.G.kills !== kills + 1) F.push('lethal mine kill not recorded');
  if (A.G.enemies.length) F.push('dead hostile still on the board');
}

F.report('deployment zones and mines: all checks pass');
