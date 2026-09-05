// The first-mission briefing.
//
// The contract: it runs exactly once, for a commander who has never deployed;
// the do-it steps advance on the player's real actions, not on clicks; done or
// skipped, it never auto-runs again; and Settings can queue a replay.
import './support/install-dom.js';
import * as A from './support/api.js';
import {get} from './support/dom.js';
import {failures} from './support/harness.js';
import {unlockAll, stillAir} from './support/fixtures.js';
import {tutorialActive, skipTutorial} from '../src/render/tutorial.js';
import {openPanel} from '../src/render/panels.js';
import {boot} from '../src/render/wiring.js';
import {enter} from '../src/render/hold.js';

boot();

const F = failures();
const shown = () => get('tut')._cls.has('on');
const card = () => get('tut')._html;
const clickTut = which => {
  const el = document.querySelectorAll('#tut [data-tut]').find(x => x.dataset.tut === which);
  if (!el || !el.onclick) { F.push(`no wired ${which} control on the briefing`); return; }
  el.onclick();
};
const firstNode = () => Object.keys(A.opRun().nodes)[0];

/**
 * Walk the whole briefing the way a player would: press Next on a step that
 * has a button, and do the actual thing on a step that is waiting for one.
 *
 * Returns every card body it saw. Counting clicks would have to be rewritten
 * every time a step is added and would silently pass if one were removed, so
 * nothing here knows how many steps there are.
 */
function walkBriefing() {
  const seen = [];
  for (let i = 0; i < 25 && tutorialActive(); i++) {
    seen.push(card());
    const next = document.querySelectorAll('#tut [data-tut]').find(x => x.dataset.tut === 'next');
    if (next && next.onclick) { next.onclick(); continue; }

    // A waiting step. Do the thing it is waiting for — and check first that
    // the WRONG thing does not satisfy it.
    const waiting = card();
    if (/Place a soldier/i.test(waiting)) {
      A.endTurn();
      if (card() !== waiting) F.push('the deploy step advanced on an ended turn');
      const cid = A.G.hand.find(c => A.validTiles(c).length);
      const tile = A.validTiles(cid)[0];
      A.deploy(cid, (tile / A.COLS) | 0, tile % A.COLS);
      if (card() === waiting) F.push('deploying did not advance the briefing');
    } else if (/End turn/i.test(waiting)) {
      const turn = A.G.turn;
      A.endTurn();
      if (A.G.turn === turn) F.push('endTurn did not advance the mission');
      if (card() === waiting) F.push('ending the turn did not advance the briefing');
    } else {
      F.push('the briefing stalled on a step with no button and no known prompt');
      break;
    }
  }
  return seen;
}

// 1. a fresh commander gets the briefing; it opens on the what-am-I-doing step
{
  enter(unlockAll(A.blankProfile('NEW'), ['rifle', 'wall', 'scout', 'marks']));
  A.launch(firstNode());
  stillAir();
  if (!tutorialActive()) F.push('briefing did not start for a fresh commander');
  if (!shown()) F.push('briefing overlay not visible');
  if (!/here to do/i.test(card())) F.push('briefing did not open on the first step');
  if (/undefined|NaN|\[object/.test(card())) F.push('briefing render artefact');
}

// 2. walk it through, and check it explains what a newcomer cannot guess
//
// The briefing is the only place the game explains itself. The pieces a new
// player has no way to work out on their own are the order, the strip of
// incoming hostiles, the lane arrows and the log — every one has to be named
// somewhere in the walk, and none of it may lean on jargon.
{
  const cards = walkBriefing();
  const all = cards.join(' ');

  [
    [/objective/i, 'the objective panel'],
    [/\blog\b/i, 'the combat log'],
    [/deploy points/i, 'deploy points, spelled out'],
    [/◀/, 'the lane arrows'],
    [/strip/i, 'the incoming strip'],
    [/end turn/i, 'the End turn button, by name'],
  ].forEach(([re, what]) => {
    if (!re.test(all)) F.push(`the briefing never explains ${what}`);
  });

  // Written for somebody new to games: no abbreviation it has not spelled out,
  // and none of the genre words that assume you already know the shape.
  [[/\bDP\b/, 'DP'], [/\bAoE\b/i, 'AoE'], [/\bmeta\b/i, 'meta'], [/\bbuff/i, 'buff']]
    .forEach(([re, word]) => {
      if (re.test(all)) F.push(`the briefing uses "${word}" without explaining it`);
    });

  // The last card is the one that teaches the loss conditions, and it taught
  // the wrong ones for a whole version: it described the free ⛨ charge every
  // lane used to carry, which v2.39 replaced with a card you buy. A new
  // commander was being promised five saves they did not have. The rule it
  // states has to be the rule the engine runs, so the guard reads both.
  // The last card the walk SAW — pressing Dismiss on it closes the overlay, so
  // reading the live card here would read an empty one.
  const held = cards[cards.length - 1] || '';
  if (!/How you lose/i.test(held)) F.push('the briefing does not end on the loss conditions');
  if (!/LAST-STAND PROTOCOL/i.test(held)) {
    F.push('the briefing never says how a breach can be stopped');
  }
  if (/charge on each lane|every lane/i.test(held)) {
    F.push('the briefing still promises a free charge in every lane');
  }
  if (!held.includes(String(A.GROUND_FLOOR))) {
    F.push(`the briefing does not name the ground floor (${A.GROUND_FLOOR} tiles)`);
  }
  // A fresh mission starts with NO lane armed — the sentence above is only
  // true while that holds.
  if ((A.G.gridCharge || []).some(Boolean)) {
    F.push('a lane starts armed — the briefing says nothing stops a breach on its own');
  }
}

// 3. walking it to the end marks it done, permanently, and that survives a
//    save round trip
{
  if (tutorialActive()) F.push('briefing still active after dismissal');
  if (shown()) F.push('briefing overlay still visible after dismissal');
  if (A.active.settings.tutorial !== 'done') F.push('completion was not recorded');

  A.launch(firstNode());
  stillAir();
  if (tutorialActive()) F.push('briefing re-ran for a commander who finished it');

  const reloaded = A.initProfiles().find(p => p.callsign === 'NEW');
  if (!reloaded || reloaded.settings.tutorial !== 'done') F.push('completion did not persist');
}

// 4. a veteran commander never sees it
{
  const vet = unlockAll(A.blankProfile('VET'), ['rifle', 'wall', 'scout', 'marks']);
  vet.stats.deployments = 12;
  enter(vet);
  A.launch(firstNode());
  stillAir();
  if (tutorialActive()) F.push('briefing ran for a veteran commander');
}

// 5. skip works from any step and also sticks
{
  const p = unlockAll(A.blankProfile('SKIP'), ['rifle', 'wall', 'scout', 'marks']);
  enter(p);
  A.launch(firstNode());
  stillAir();
  if (!tutorialActive()) F.push('briefing did not start for the skip test');
  skipTutorial();
  if (tutorialActive() || shown()) F.push('skip did not close the briefing');
  if (p.settings.tutorial !== 'done') F.push('skip was not recorded as done');
}

// 6. Settings queues a replay, and the replay actually runs — once
{
  openPanel('settings');
  if (!get('pbody')._html.includes('tutreplay')) F.push('Settings has no briefing replay row');
  const row = get('tutreplay');
  if (!row.onclick) F.push('replay row is not wired');
  else {
    row.onclick();
    if (A.active.settings.tutorial !== 'replay') F.push('replay was not queued');
    A.launch(firstNode());
  stillAir();
    if (!tutorialActive()) F.push('queued replay did not run');
    skipTutorial();
    if (A.active.settings.tutorial !== 'done') F.push('finishing the replay did not settle back to done');
  }
}

// 7. the briefing never runs in Onslaught, and an aborted run leaves no overlay
{
  const p = unlockAll(A.blankProfile('ONS'), ['rifle', 'wall', 'scout', 'marks']);
  enter(p);
  A.launch(firstNode());
  stillAir();
  if (!tutorialActive()) F.push('briefing did not start before the abort test');
  A.abortMission();
  A.launchOnslaught();
  if (tutorialActive() || shown()) F.push('briefing overlay survived into Onslaught');
}

F.report('first-mission briefing: all checks pass');
