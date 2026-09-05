// The Deep Run: the generated map, the draft, and the run's own loadout.
//
// The mode's whole promise is that it is the same run for everybody, so most
// of what is checked here is what the run does NOT read: unlocks, the profile
// deck, the profile gear, the profile lead. The rest is the map contract the
// renderer relies on — every node reachable, every node leading somewhere.
import './support/install-dom.js';
import * as A from './support/api.js';
import {get, flushTimers} from './support/dom.js';
import {failures} from './support/harness.js';
import {unlockAll} from './support/fixtures.js';
import {renderRun} from '../src/render/deeprun.js';
import {showPack, burstPack, takePack, packPicks} from '../src/render/packs.js';

const F = failures();

const fresh = name => {
  const p = A.blankProfile(name);
  A.enterProfile(p);
  A.setPackQueue([]);
  return p;
};

// 1. map integrity, over enough rolls that a rare shape cannot hide
//
// The renderer walks these edges to decide what is open, so a node with no way
// in is a dead run and a node with no way out is a dead end. Neither may exist.
{
  fresh('MAPS');
  let broken = 0;
  let minNodes = 99;
  let maxNodes = 0;
  const heats = new Set();
  for (let i = 0; i < 400; i++) {
    const m = A.genRunMap();
    const ids = m.nodes.map(n => n.id);
    minNodes = Math.min(minNodes, ids.length);
    maxNodes = Math.max(maxNodes, ids.length);

    if (new Set(ids).size !== ids.length) { broken++; continue; }
    if (m.nodes[0].role !== 'start' || m.nodes[m.nodes.length - 1].role !== 'final') { broken++; continue; }
    if (m.nodes.filter(n => n.role === 'final').length !== 1) { broken++; continue; }
    if (m.edges.some(([a, b]) => !ids.includes(a) || !ids.includes(b))) { broken++; continue; }

    // Reachability, walked the way runNodeState walks it.
    const seen = new Set([m.nodes[0].id]);
    for (let pass = 0; pass < ids.length; pass++) {
      m.edges.forEach(([a, b]) => { if (seen.has(a)) seen.add(b); });
    }
    if (seen.size !== ids.length) { broken++; continue; }
    // Every node but the target leads somewhere.
    const stuck = m.nodes.filter(n => n.role !== 'final' && !m.edges.some(([a]) => a === n.id));
    if (stuck.length) { broken++; continue; }

    m.nodes.forEach(n => heats.add(A.runHeatAt(A.runDepthOf(m, n.id))));
  }
  if (broken) F.push(`${broken} of 400 generated maps were broken`);
  if (minNodes < 6) F.push('a run map came out with only ' + minNodes + ' nodes');
  if (maxNodes > 20) F.push('a run map came out with ' + maxNodes + ' nodes');
  // Depth has to actually mean something, or the back half is the front half.
  if (!heats.has(0)) F.push('no run node was ever flat');
  if (Math.max(...heats) < 2) F.push('run heat never climbed past ' + Math.max(...heats));
}

// 2. heat and payout climb with depth, monotonically
{
  for (let d = 1; d < 8; d++) {
    if (A.runHeatAt(d + 1) < A.runHeatAt(d)) F.push('heat fell going from layer ' + d + ' to ' + (d + 1));
    if (A.runRewardAt(d + 1) <= A.runRewardAt(d)) F.push('payout did not rise at layer ' + (d + 1));
  }
  if (A.runHeatAt(1) !== 0) F.push('the drop point is not flat');
}

// 3. the run ignores the collection entirely
//
// A commander with everything and a commander with nothing start the same run.
// This is the mode's contract, and it is the one thing a well-meaning change
// to the loadout code could silently break.
{
  const poor = fresh('POOR');
  A.startRun();
  const poorDeck = [...A.active.run.deck];

  const rich = A.blankProfile('RICH');
  unlockAll(rich, ['samurai', 'lancer', 'mortar']);
  rich.unlocks.gear = Object.keys(A.GEAR);
  rich.unlocks.leads = Object.keys(A.LEADS);
  rich.lead = 'coldwire';
  A.enterProfile(rich);
  A.startRun();
  const richDeck = [...A.active.run.deck];

  if (poorDeck.join() !== richDeck.join()) {
    F.push(`the starting manifest depends on unlocks: ${poorDeck} vs ${richDeck}`);
  }
  if (poorDeck.join() !== A.RUN_STARTER.join()) F.push('a run did not start on the starter manifest');
  if (A.active.run.lead !== null) F.push('a run started with a lead already chosen');
  if (Object.keys(A.active.run.gear).length) F.push('a run started with gear fitted');
  if (poor.loadout.deck.join() === '') F.push('starting a run emptied the profile deck');
}

// 4. the draft: leads once, then cards to the cap, then gear — and never a
//    duplicate of something the run already holds
{
  fresh('DRAFT');
  A.startRun();
  const r = A.active.run;

  const first = A.runDraftOffer();
  if (first.length !== 3) F.push('a draft offered ' + first.length + ' things, expected 3');
  if (first.some(x => x.kind !== 'lead')) F.push('the first draft was not the lead choice');
  if (new Set(first.map(x => x.id)).size !== first.length) F.push('the lead draft repeated an offer');
  A.runDraftTake(first[0]);
  if (r.lead !== first[0].id) F.push('taking a lead did not set it on the run');
  if (A.active.lead === first[0].id && A.blankProfile('X').lead !== first[0].id) {
    // ironbrand is the profile default; a drafted lead must not overwrite it
    F.push('a drafted lead leaked onto the profile');
  }

  // Cards until the run's own cap, then gear. Never the profile's cap.
  let guard = 0;
  while (r.deck.length < A.runDeckCap() && guard++ < 60) {
    const off = A.runDraftOffer();
    if (off.some(x => x.kind !== 'card')) { F.push('a mid-run draft offered a non-card'); break; }
    if (off.some(x => r.deck.includes(x.id))) F.push('the draft offered a card already in the deck');
    if (off.some(x => A.POOL[x.id].chassis === 'proto')) F.push('the draft offered a Proto Frame');
    if (new Set(off.map(x => x.id)).size !== off.length) F.push('a draft repeated an offer');
    A.runDraftTake(off[0]);
  }
  if (r.deck.length !== A.runDeckCap()) F.push('drafting never filled the deck');

  const gearOff = A.runDraftOffer();
  if (!gearOff.length || gearOff.some(x => x.kind !== 'gear')) {
    F.push('a full deck did not turn the draft over to gear');
  } else {
    A.runDraftTake(gearOff[0]);
    if (!Object.values(r.gear).includes(gearOff[0].id)) F.push('drafted gear was not fitted');
    if (Object.keys(A.active.loadout.gear).length) F.push('drafted gear leaked onto the profile loadout');
  }
  if (A.active.unlocks.cards.length !== A.blankProfile('Y').unlocks.cards.length) {
    F.push('a run draft added to the collection');
  }
}

// 5. a run mission fields the run's kit, not the profile's
{
  const p = fresh('KIT');
  unlockAll(p);
  p.loadout.deck = ['samurai', 'lancer', 'mortar'];
  p.loadout.frame = Object.keys(A.POOL).find(c => A.POOL[c].chassis === 'proto') || null;
  p.lead = 'coldwire';
  A.startRun();
  const r = A.active.run;
  r.lead = 'ironbrand';

  const start = r.map.nodes[0].id;
  if (A.runNodeState(start) !== 'open') F.push('the drop point was not open at the start of a run');
  if (r.map.nodes.slice(1).some(n => A.runNodeState(n.id) !== 'locked')) {
    F.push('a node past the drop point was open before anything was cleared');
  }
  if (!A.launchRunNode(start) || !A.G) {
    F.push('could not launch the drop point');
  } else {
    if (!A.G.run) F.push('a run mission did not set G.run');
    const fielded = new Set([...A.G.deck, ...A.G.hand]);
    if ([...fielded].some(c => !A.RUN_STARTER.includes(c))) {
      F.push('a run mission fielded a card the run never drafted: ' + [...fielded].join());
    }
    if (fielded.has('samurai')) F.push('a run mission fielded the profile deck');
    if (A.leadOf().call !== A.LEADS.ironbrand.call) F.push('a run mission answered to the profile lead');
  }

  // Play it out. The reserve cycle is the leak that a launch-time check alone
  // would miss: it reshuffles from "the loadout", and if that is read off the
  // profile the run quietly starts dealing the commander's own shelf.
  {
    let guard = 0;
    const seen = new Set([...A.G.deck, ...A.G.hand]);
    while (!A.G.over && guard++ < 40) {
      A.endTurn();
      [...A.G.deck, ...A.G.hand].forEach(c => seen.add(c));
    }
    const stray = [...seen].filter(c => !A.RUN_STARTER.includes(c));
    if (stray.length) F.push('the reserve cycle dealt a card from outside the run: ' + stray.join());
    if (A.G.frame) F.push('a run fielded the profile Proto Frame');
  }

  // ...and the moment the mission is over, the profile is back in charge.
  A.setG(null);
  if (A.leadOf().call !== A.LEADS.coldwire.call) F.push('the run lead outlived the run mission');
  if (A.deckCapOf() !== (A.LEADS.coldwire.deckCap || A.DECKSIZE)) F.push('the profile deck cap did not come back');
}

// 6. settling a node: cleared, paid, and the next layer opens with a draft owed
{
  fresh('SETTLE');
  A.startRun();
  const r = A.active.run;
  r.lead = 'ironbrand';
  const start = r.map.nodes[0].id;
  const before = A.active.progress.credits;

  A.launchRunNode(start);
  A.finish(true, '');
  const paid = A.active.progress.credits - before;
  if (paid < A.runRewardAt(1)) F.push(`clearing the drop paid ${paid}, expected at least ${A.runRewardAt(1)}`);
  if (!r.cleared.includes(start)) F.push('a cleared node did not go on the run');
  if (!A.packQueue.some(x => x.draft)) F.push('clearing a layer owed no draft');
  if (A.packQueue.some(x => !x.draft)) F.push('clearing a layer paid a collection pack');
  A.setG(null);

  const nowOpen = r.map.nodes.filter(n => A.runNodeState(n.id) === 'open');
  if (!nowOpen.length) F.push('clearing the drop opened nothing');
  if (nowOpen.some(n => n.id === start)) F.push('a cleared node stayed open');
  if (!A.runActive()) F.push('the run ended after one win');
}

// 7. one loss ends it — and ending it does not touch the profile's own run state
{
  fresh('LOSS');
  A.startRun();
  const r = A.active.run;
  r.lead = 'ironbrand';
  A.setPackQueue([]);
  A.launchRunNode(r.map.nodes[0].id);
  A.finish(false, 'The line broke.');
  if (!r.over) F.push('a loss did not end the run');
  if (A.runActive()) F.push('a dead run still reported active');
  if (A.packQueue.length) F.push('a lost run still paid out');
  A.setG(null);
  if (A.launchRunNode(r.map.nodes[0].id)) F.push('a node launched inside a dead run');
  A.setG(null);
}

// 8. walking the whole map: the target ends it and pays the completion bundle
{
  fresh('CLEAR');
  A.startRun();
  const r = A.active.run;
  r.lead = 'ironbrand';
  A.setPackQueue([]);
  const before = A.active.progress.credits;

  let guard = 0;
  while (!A.runComplete() && guard++ < 30) {
    const open = r.map.nodes.filter(n => A.runNodeState(n.id) === 'open');
    if (!open.length) break;
    // Always take the deepest thing on offer, so the walk actually reaches
    // the target rather than wandering along one layer.
    const next = open.sort((a, b) => A.runDepthOf(r.map, b.id) - A.runDepthOf(r.map, a.id))[0];
    if (!A.launchRunNode(next.id)) { F.push('could not launch an open run node'); break; }
    A.finish(true, '');
    A.setG(null);
  }

  if (!A.runComplete()) F.push('walking every open node never reached the target');
  if (A.runActive()) F.push('completing the run left it active');
  if (A.active.bests.runsDone !== 1) F.push('a completed run was not recorded');
  if (A.active.bests.run !== r.map.layers.length) {
    F.push(`best depth recorded ${A.active.bests.run}, expected ${r.map.layers.length}`);
  }
  const bundle = A.packQueue.filter(x => !x.draft);
  if (bundle.filter(x => x.tier === 'standard').length !== 1
    || bundle.filter(x => x.tier === 'specialist').length !== 1) {
    F.push('completing a run did not pay one standard and one specialist pack');
  }
  // The clear bonus is on top of the last node's own payout.
  if (A.active.progress.credits - before < 400 + A.runRewardAt(r.map.layers.length)) {
    F.push('the completion bonus was not paid');
  }
}

// 9. a run in progress survives a save round trip whole
{
  fresh('SAVE');
  A.startRun();
  const r = A.active.run;
  r.lead = 'ironbrand';
  A.launchRunNode(r.map.nodes[0].id);
  A.finish(true, '');
  A.setG(null);
  A.commit();

  const back = A.initProfiles().find(x => x.callsign === 'SAVE');
  if (!back || !back.run) { F.push('the run did not survive a save'); } else {
    if (back.run.cleared.join() !== r.cleared.join()) F.push('the cleared list did not survive');
    if (back.run.deck.join() !== r.deck.join()) F.push('the run deck did not survive');
    if (back.run.lead !== r.lead) F.push('the run lead did not survive');
    if (back.run.map.nodes.length !== r.map.nodes.length) F.push('the run map did not survive');
    if (!back.run.map.layers) F.push('the run map lost its layers, so depth is unreadable');
  }

  // A garbage run is dropped rather than half-restored into something unplayable.
  const junk = A.migrate(Object.assign(A.blankProfile('JUNK'), {run: {map: {}, cleared: 'nope'}}));
  if (junk.run !== null) F.push('a malformed run was not dropped on load');
}

// 10. the screen itself: the map draws, the route is clickable, and the draft
//     comes through the pack overlay rather than a second one of its own
{
  fresh('SCREEN');
  renderRun();
  const body = () => get('runbody').innerHTML;
  if (!/runstart/.test(body())) F.push('the Deep Run screen offered no way to begin');

  A.startRun();
  const r = A.active.run;

  // The draft rides the pack queue, so the overlay is the pack overlay.
  A.queueDraft('Deep Run · choose your lead');
  if (!showPack()) F.push('the draft did not open the pack overlay');
  if (!packPicks.length || packPicks.some(x => x.kind !== 'lead')) {
    F.push('the draft overlay did not offer the lead choice');
  }
  if (!/SALVAGE/.test(get('packstage').innerHTML)) F.push('a draft rendered as a requisition pack');
  burstPack();
  flushTimers();
  const chosen = packPicks[0].id;
  takePack(0);
  if (r.lead !== chosen) F.push('taking a draft pick did not write it into the run');
  if (A.active.lead === chosen && chosen !== 'ironbrand') F.push('a drafted lead was assigned to the profile');
  if (/added to your collection/.test(get('packfoot').innerHTML)) {
    F.push('a draft claimed to add to the collection');
  }

  renderRun();
  if (!/<svg/.test(body())) F.push('the run map did not draw');
  const marked = [...body().matchAll(/data-n="(\w+)"/g)].map(m => m[1]);
  if (marked.length !== r.map.nodes.length) {
    F.push(`the map drew ${marked.length} nodes for a ${r.map.nodes.length}-node run`);
  }
  // Only the drop point may be live on the board before anything is cleared —
  // a map drawn as already-complete would still emit every node.
  const live = (body().match(/data-n="\w+" style="cursor:pointer/g) || []).length;
  if (live !== 1) F.push(`the fresh map drew ${live} playable nodes, expected 1`);
  const rows = [...body().matchAll(/data-go="(\w+)"/g)].map(m => m[1]);
  if (rows.join() !== r.map.nodes[0].id) F.push('the route list did not show exactly the drop point');
  if (!/Manifest — \d+ \/ /.test(body())) F.push('the screen did not show the run manifest');
  A.setPackQueue([]);
}

F.report('Deep Run: map, draft, kit isolation and settlement all hold');
