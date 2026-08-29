// The spawn-marker contract, stressed over hundreds of spawns, plus the
// promise that a freshly played unit fires exactly once on the turn it lands.
import * as A from './support/api.js';
import {failures} from './support/harness.js';
import {unlockAll, stillAir} from './support/fixtures.js';

const F = failures();
const RUNS = 30;
const TURNS = 8;

// ---- A. every spawn lands in the lane its marker promised ----
let promised = 0;
let honoured = 0;

for (let run = 0; run < RUNS; run++) {
  A.enterProfile(unlockAll(A.blankProfile('S' + run), Object.keys(A.POOL).slice(0, 12)));
  A.launch(Object.keys(A.opRun().nodes)[0]);
  stillAir();

  for (let t = 0; t < TURNS && A.G && !A.G.over; t++) {
    // Play cards so lanes get congested and the promise is actually stressed.
    for (let n = 0; n < 8; n++) {
      const card = [...A.G.hand].find(x => A.POOL[x].dp <= A.G.dp);
      if (!card) break;
      const tiles = A.validTiles(card);
      if (!tiles.length) break;
      const tile = tiles[A.randInt(tiles.length)];
      A.deploy(card, (tile / A.COLS) | 0, tile % A.COLS);
    }

    const before = A.G.enemies.map(e => e.uid);
    const marked = {};
    (A.G.predict || []).concat(A.G.held || []).forEach(x => { marked[x.lane] = (marked[x.lane] || 0) + 1; });

    A.endTurn();
    if (!A.G || A.G.over) break;

    // Spore Nodes release Crawlers mid-board; those carry no marker by design.
    // Board-born hostiles (spore releases, husk splits) carry a src tag and
    // were never promised by a marker — the contract does not cover them.
    const arrived = A.G.enemies.filter(e => !before.includes(e.uid) && !e.src);
    const got = {};
    arrived.forEach(e => { got[e.lane] = (got[e.lane] || 0) + 1; });

    Object.keys(got).forEach(l => {
      promised += got[l];
      if (marked[l] >= got[l]) honoured += got[l];
      else F.push(`lane ${l}: ${got[l]} spawned, only ${marked[l] || 0} marked`);
    });
  }
}
console.log(`spawns checked: ${promised} | honoured the marker: ${honoured}`);
if (promised < 200) F.push(`only ${promised} spawns exercised — the contract is barely tested`);

// ---- B. a freshly played unit fires exactly once ----
{
  const p = A.blankProfile('F');
  p.loadout.deck = ['rifle'];
  A.enterProfile(p);
  A.launch(Object.keys(A.opRun().nodes)[0]);
  stillAir();
  for (let t = 0; t < 3; t++) A.endTurn();

  const foe = A.G.enemies.find(e => e.col >= 2);
  if (!foe) {
    F.push('no enemy available for fresh-fire test');
  } else {
    // Isolate the lane so 'first' targeting can only resolve to this foe.
    A.G.enemies = A.G.enemies.filter(e => e.lane !== foe.lane || e.uid === foe.uid);
    A.G.units = A.G.units.filter(u => u.lane !== foe.lane);
    foe.hp = 99;
    const hp0 = foe.hp;

    const u = Object.assign(A.mkUnit('rifle', foe.lane, 0), {fresh: true});
    A.G.units.push(u);

    A.fire(u, true);              // the on-play shot
    const afterPlay = foe.hp;
    A.playerPhase();              // end-of-turn resolution
    const afterTurn = foe.hp;

    if (afterPlay === hp0) F.push('unit did not engage on the turn it was played');
    if (afterTurn !== afterPlay) F.push('fresh unit fired a second time in the same turn');
    if (u.fresh) F.push('fresh flag not cleared after the turn');

    A.playerPhase();              // next turn: it should fire again
    if (foe.hp === afterTurn && foe.hp > 0) F.push('unit stopped firing on subsequent turns');
  }
}

F.report('spawn contract + engage-on-play: all checks pass');
