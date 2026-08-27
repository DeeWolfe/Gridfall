// Every card, with and without every piece of gear, deployed into a live
// mission and played out. 39 x 9 = 351 combinations; none may throw.
import * as A from './support/api.js';
import {failures} from './support/harness.js';

const F = failures();
const ids = Object.keys(A.POOL);
const gears = Object.keys(A.GEAR);
const TURNS = 10;
const PLAYS_PER_TURN = 4;

for (const id of ids) {
  for (const gi of [null, ...gears]) {
    const label = id + (gi ? '+' + gi : '');
    try {
      const p = A.blankProfile('C');
      p.unlocks.cards = [...ids];
      p.loadout.deck = [id];
      if (gi) p.loadout.gear = {[id]: gi};
      // A high usage count forces the veterancy paths to render too.
      p.usage = {[id]: 80};

      A.setActive(p);
      A.genRun();
      A.launch(Object.keys(p.ops[p.op].nodes)[0]);

      for (let turn = 0; turn < TURNS && A.G && !A.G.over; turn++) {
        for (let n = 0; n < PLAYS_PER_TURN; n++) {
          const card = [...A.G.hand].find(x => A.costOf(x) <= A.G.dp);
          if (!card) break;
          const tiles = A.validTiles(card);
          if (!tiles.length) break;
          const tile = tiles[A.randInt(tiles.length)];
          A.deploy(card, (tile / A.COLS) | 0, tile % A.COLS);
        }
        A.endTurn();
      }
    } catch (e) {
      F.push(label + ': ' + e.message);
    }
  }
}

console.log(`cards x gear combos tested: ${ids.length * (gears.length + 1)}`);
F.report('all combinations ran clean');
