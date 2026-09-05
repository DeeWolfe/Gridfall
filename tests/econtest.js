// The credit economy: what each mode pays, and the relationships between them.
//
// Every check here drives real play — clear a real operation, survive real
// Onslaught waves, walk a real Descent — and reads the credits that actually
// landed in the profile. Asserting the constants would pass forever while the
// curves that use them drifted underneath.
//
// The relationships are the point. Any single number here is a balance
// decision and will move again; what must not move is the shape:
//   · a repeatable grind must never out-earn the modes that carry stakes
//   · depth must pay more than breadth in both endless modes
//   · a reward the player cannot perceive is not a reward
import './support/install-dom.js';
import * as A from './support/api.js';
import {get} from './support/dom.js';
import {failures} from './support/harness.js';
import {unlockAll} from './support/fixtures.js';
import {renderMap} from '../src/render/map.js';

const F = failures();

const fresh = name => {
  const p = unlockAll(A.blankProfile(name));
  A.enterProfile(p);
  A.setPackQueue([]);
  return p;
};

/**
 * Clear every node of the active operation.
 *
 * Returns the credits earned, the face value of the nodes played, and the
 * realized rate between them — the map rerolls on every replay, so comparing
 * raw totals would be comparing two different dice rolls. The rate is the
 * thing under test.
 */
function clearOp() {
  const before = A.active.progress.credits;
  let nodes = 0;
  let face = 0;
  let guard = 0;
  while (!A.opComplete() && guard++ < 40) {
    const open = Object.keys(A.opRun().nodes).filter(id => A.nodeState(id) === 'open');
    if (!open.length) break;
    face += A.opRun().nodes[open[0]].reward;
    A.launch(open[0]);
    A.G.kills = 0;                 // hold the kill bounty out of the comparison
    A.finish(true, '');
    A.setG(null);
    nodes++;
  }
  const cr = A.active.progress.credits - before;
  return {cr, nodes, face, rate: cr / face};
}

// 1. the campaign replay curve, driven rather than asserted
//
// The measurement that forced this: an operation could be cleared, rerolled
// from its own completion panel and cleared again at full rate, forever, and
// Crownring was the best cr/mission in the game by a distance. A repeatable
// loop that dominates every mode with stakes is the bug.
{
  fresh('REPLAY');
  A.active.op = 'ironveil';
  A.genRun();

  if (A.opClears('ironveil') !== 0) F.push('a fresh commander already had a clear on record');
  const first = clearOp();
  if (!A.opComplete()) F.push('could not clear the operation');
  if (A.opClears('ironveil') !== 1) F.push('the first clear was not counted');

  A.genRun();
  const second = clearOp();
  if (A.opClears('ironveil') !== 2) F.push('the second clear was not counted');

  A.genRun();
  const third = clearOp();

  if (first.rate < 0.99) F.push(`a first clear realized ${first.rate.toFixed(2)} of face value`);
  if (!(second.rate < first.rate)) F.push(`replay realized ${second.rate.toFixed(2)} against a first clear's ${first.rate.toFixed(2)}`);
  if (!(third.rate < second.rate)) F.push(`the third clear realized ${third.rate.toFixed(2)}, not less than the second's ${second.rate.toFixed(2)}`);

  // ...and it stops falling rather than decaying to nothing: a replay has to
  // stay worth playing for the packs, which still come every third node.
  A.genRun();
  const fourth = clearOp();
  A.genRun();
  const fifth = clearOp();
  if (Math.abs(fifth.rate - fourth.rate) > 0.02) F.push('the replay rate never found its floor');
  if (fifth.rate < A.CAMPAIGN_REPLAY_FLOOR - 0.02) F.push('a replay fell through the floor');
  if (!fifth.cr) F.push('a replay eventually paid nothing at all');
}

// 2. the floor is a floor, and the first pass is the windfall
{
  if (A.campaignRate(0) !== 1) F.push('a first clear did not pay full rate');
  for (let c = 1; c < 40; c++) {
    if (A.campaignRate(c) > A.campaignRate(c - 1)) F.push('the replay rate rose at clear ' + c);
    if (A.campaignRate(c) < A.CAMPAIGN_REPLAY_FLOOR) F.push('the replay rate fell through its floor');
  }
}

// 3. the grind floor must not beat the modes that carry stakes
//
// This is the whole reason the curve exists, so it is checked as a relation
// between measured rates rather than as two constants that happen to differ.
{
  fresh('RATES');
  A.active.op = 'crownring';
  A.genRun();
  let guard = 0;
  while (A.opClears('crownring') < 4 && guard++ < 8) { clearOp(); A.genRun(); }
  A.genRun();
  const ground = clearOp();
  const campaignFloor = ground.cr / ground.nodes;

  // Onslaught at a chosen depth, settled through the real path.
  //
  // Deliberately NOT played out with endTurn: an endless run settles itself
  // the moment the line falls, so a loop that then called finish() again
  // counted the payout twice and read 175 credits for an 8-wave run that pays
  // 108. The wave count is the input to the curve under test, so it is set
  // rather than survived.
  const onslaughtAt = waves => {
    A.setPackQueue([]);
    const before = A.active.progress.credits;
    A.launchOnslaught();
    A.G.turn = waves;
    A.finish(false, '');
    const cr = A.active.progress.credits - before;
    A.setG(null);
    return cr;
  };
  const onslaught8 = onslaughtAt(8);

  if (!(campaignFloor < onslaught8)) {
    F.push(`a ground-out campaign node pays ${Math.round(campaignFloor)}, an 8-wave Onslaught ${onslaught8} — the grind still wins`);
  }

  // Onslaught has to pay for depth, not attendance: doubling the waves must
  // more than double the payout or "credits scale with how deep you get" is
  // decoration.
  const onslaught16 = onslaughtAt(16);
  if (!(onslaught16 > onslaught8 * 2)) {
    F.push(`16 waves paid ${onslaught16} against ${onslaught8} for 8 — the curve is flat`);
  }
}

// 4. the Descent pays for depth, and not mostly on completion
{
  const layers = [1, 2, 3, 4, 5].map(A.runRewardAt);
  for (let i = 1; i < layers.length; i++) {
    if (layers[i] <= layers[i - 1]) F.push('layer ' + (i + 1) + ' paid no more than the one above it');
    // The gap has to widen too — a straight line charges the same premium for
    // the fourth layer as for the second, which is not what it costs you.
    if (i > 1 && (layers[i] - layers[i - 1]) <= (layers[i - 1] - layers[i - 2])) {
      F.push('the depth curve stopped steepening at layer ' + (i + 1));
    }
  }

  // The completion bonus was a third of a full run, so a run that died early
  // earned the same rate as a mode with no stakes at all. It is a bonus now,
  // not the payout.
  fresh('DESCENT');
  A.startRun();
  const r = A.active.run;
  r.lead = 'ironbrand';
  const before = A.active.progress.credits;
  let guard = 0;
  while (!A.runComplete() && guard++ < 30) {
    const open = r.map.nodes.filter(n => A.runNodeState(n.id) === 'open')
      .sort((a, b) => A.runDepthOf(r.map, b.id) - A.runDepthOf(r.map, a.id));
    if (!open.length || !A.launchRunNode(open[0].id)) break;
    A.G.kills = 0;
    A.finish(true, '');
    A.setG(null);
  }
  if (!A.runComplete()) F.push('could not walk a Descent to the target');
  const total = A.active.progress.credits - before;
  const laid = r.map.layers.length;
  const fromLayers = r.cleared.reduce((a, id) => a + A.runRewardAt(A.runDepthOf(r.map, id)), 0);
  const bonusShare = (total - fromLayers) / total;
  if (bonusShare > 0.25) {
    F.push(`the completion bonus is ${Math.round(bonusShare * 100)}% of a full Descent — it should be a bonus, not the payout`);
  }
  // And finishing still has to be worth the walk.
  if (total <= fromLayers) F.push('putting the target down paid nothing extra');
  if (laid < 4) F.push('a Descent map came out shorter than four layers');
}

// 5. rewards the player can actually perceive
//
// The kill bounty was floor(kills / 5) — one credit over a measured average of
// eight kills a mission. The research pod paid 60 against a 300-credit node.
{
  fresh('BOUNTY');
  A.active.op = 'ironveil';
  A.genRun();
  const nodeId = Object.keys(A.opRun().nodes).find(id => A.nodeState(id) === 'open');
  const face = A.opRun().nodes[nodeId].reward;

  const payWith = kills => {
    const before = A.active.progress.credits;
    A.launch(nodeId);
    A.G.kills = kills;
    A.finish(true, '');
    A.setG(null);
    const cr = A.active.progress.credits - before;
    // Undo the clear so the next launch sees the same node at the same rate.
    A.opRun().cleared = A.opRun().cleared.filter(x => x !== nodeId);
    return cr;
  };
  const quiet = payWith(0);
  const busy = payWith(8);
  if (busy - quiet < 15) {
    F.push(`eight kills were worth ${busy - quiet} credits — below noticing`);
  }
  if (busy - quiet > face) F.push('the kill bounty outgrew the node it was a bonus on');
}

// 6. the map quotes what a node will actually pay
//
// A payout curve the player cannot see is a bug report waiting to be filed.
{
  fresh('QUOTE');
  A.active.op = 'ironveil';
  A.genRun();
  renderMap();
  const full = get('mapbody').innerHTML;
  const faceRow = +(full.match(/>(\d+) cr ▸</) || [])[1];
  const face = A.opRun().nodes[
    Object.keys(A.opRun().nodes).find(id => A.nodeState(id) === 'open')].reward;
  if (faceRow !== face) F.push(`a first-pass node quoted ${faceRow} against a face value of ${face}`);
  if (/replay pay/.test(full)) F.push('a first pass advertised a replay rate');

  // Now stand the commander on a third clear and look again.
  A.active.opsDone.ironveil = 3;
  A.genRun();
  renderMap();
  const worn = get('mapbody').innerHTML;
  const wornRow = +(worn.match(/>(\d+) cr ▸</) || [])[1];
  const wornFace = A.opRun().nodes[
    Object.keys(A.opRun().nodes).find(id => A.nodeState(id) === 'open')].reward;
  if (!/replay pay 30%/.test(worn)) F.push('the map did not say what a replay pays');
  if (wornRow >= wornFace) F.push(`a replay node quoted ${wornRow} against a face value of ${wornFace} — full price`);
  if (Math.abs(wornRow - wornFace * A.campaignRate(3)) > 1) {
    F.push(`the quote (${wornRow}) does not match the rate (${Math.round(wornFace * A.campaignRate(3))})`);
  }
}

F.report('credit economy: the curves hold and no repeatable grind dominates');
