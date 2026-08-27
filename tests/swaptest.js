// Cipher's swap: exchanges positions anywhere, respects two-cell footprints,
// and consumes the whole action.
import * as A from './support/api.js';
import {failures} from './support/harness.js';
import {spawnUnit, spawnFoe, clearBoard, unlockAll} from './support/fixtures.js';

const F = failures();
const cell = (l, c) => l * A.COLS + c;

A.enterProfile(unlockAll(A.blankProfile('SW'), ['cipher', 'rifle', 'marks', 'wall']));
A.launchSpec({node: null, type: 'stronghold', mod: 'none', reward: 0, salv: 0});
clearBoard();

// A: swap exchanges the two positions exactly, across the whole board
{
  const cipher = spawnUnit('cipher', 0, 0);
  const rifle = spawnUnit('rifle', 4, 2);
  if (!A.swapTargets(cipher).includes(cell(4, 2))) F.push('distant friendly not offered as a swap');
  A.doSwap(cipher, 4, 2);
  if (!(cipher.lane === 4 && cipher.col === 2)) F.push('cipher did not arrive at the partner cell');
  if (!(rifle.lane === 0 && rifle.col === 0)) F.push('partner did not arrive at cipher cell');
}

// B: the swap consumes the action — no move, no second swap, no fire
{
  clearBoard();
  const cipher = spawnUnit('cipher', 2, 1);
  spawnUnit('rifle', 2, 2);
  A.doSwap(cipher, 2, 2);
  if (!cipher.acted) F.push('swap did not consume the action');
  if (A.moveTargets(cipher).length) F.push('cipher can still move after swapping');
  if (A.swapTargets(cipher).length) F.push('cipher can swap twice in a turn');
}

// C: a non-swap unit offers no swap targets
{
  clearBoard();
  const rifle = spawnUnit('rifle', 2, 1);
  spawnUnit('marks', 2, 3);
  if (A.swapTargets(rifle).length) F.push('a card without the flag offered swaps');
}

// D: a two-cell unit may not swap into a hole it cannot occupy
{
  clearBoard();
  const cipher = spawnUnit('cipher', 1, 7);        // last column
  const aegis = spawnUnit('aegis', 3, 2);          // size 2
  // Aegis would need columns 7 and 8 — 8 is off the board.
  if (A.swapTargets(cipher).includes(cell(3, 2))) F.push('two-cell unit offered an off-board swap');
  A.doSwap(cipher, 3, 2);
  if (cipher.lane !== 1 || cipher.col !== 7) F.push('illegal swap went through anyway');

  // With room to stand, the same swap is legal.
  clearBoard();
  const c2 = spawnUnit('cipher', 1, 3);
  const a2 = spawnUnit('aegis', 3, 2);
  if (!A.swapTargets(c2).includes(cell(3, 2))) F.push('legal two-cell swap not offered');
  A.doSwap(c2, 3, 2);
  if (!(a2.lane === 1 && a2.col === 3 && c2.lane === 3 && c2.col === 2)) F.push('two-cell swap misplaced units');
}

// E: hostiles and civilians in the landing cells veto the swap
{
  clearBoard();
  const cipher = spawnUnit('cipher', 1, 3);
  const aegis = spawnUnit('aegis', 3, 2);
  spawnFoe('crawler', 1, 4);                       // sits where aegis's second cell would land
  if (A.swapTargets(cipher).includes(cell(3, 2))) F.push('swap offered into a hostile-occupied footprint');
}

F.report('cipher swap: all checks pass');
