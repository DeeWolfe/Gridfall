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

// 1. a fresh commander gets the briefing; it opens on the grid step
{
  enter(unlockAll(A.blankProfile('NEW'), ['rifle', 'wall', 'scout', 'marks']));
  A.launch(firstNode());
  stillAir();
  if (!tutorialActive()) F.push('briefing did not start for a fresh commander');
  if (!shown()) F.push('briefing overlay not visible');
  if (!/Command briefing/.test(card())) F.push('briefing did not open on the first step');
  if (/undefined|NaN|\[object/.test(card())) F.push('briefing render artefact');
}

// 2. the deploy step waits for a real deploy, not a click
{
  clickTut('next');
  if (!/Deploy a card to continue/.test(card())) F.push('step 2 is not waiting on a deploy');

  A.endTurn();   // ending the turn is not deploying — it must not advance
  if (!/Deploy a card to continue/.test(card())) F.push('step 2 advanced without a deploy');

  const cid = A.G.hand.find(c => A.validTiles(c).length);
  const tile = A.validTiles(cid)[0];
  A.deploy(cid, (tile / A.COLS) | 0, tile % A.COLS);
  if (!/chevrons/i.test(card())) F.push('deploying did not advance the briefing');
}

// 3. the end-turn step waits for the turn to actually end
{
  clickTut('next');
  if (!/End the turn to continue/.test(card())) F.push('step 4 is not waiting on end turn');
  const turn = A.G.turn;
  A.endTurn();
  if (A.G.turn === turn) F.push('endTurn did not advance the mission');
  if (!/Hold the line/.test(card())) F.push('ending the turn did not advance the briefing');

  // The briefing is the one place that teaches the loss conditions, and it
  // taught the wrong ones for a whole version: it described the free ⛨ charge
  // every lane used to carry, which v2.39 replaced with a card you buy. A new
  // commander was being promised five saves they no longer had. The rule it
  // states has to be the rule the engine runs, so the guard reads both.
  const held = card();
  if (!/LAST-STAND PROTOCOL/i.test(held)) {
    F.push('the briefing never says how a breach can be stopped');
  }
  if (/charge on each lane|每|every lane/i.test(held)) {
    F.push('the briefing still promises a free charge in every lane');
  }
  // The two numbers it quotes are the two the rules enforce.
  if (!held.includes(String(A.GROUND_FLOOR))) {
    F.push(`the briefing does not name the ground floor (${A.GROUND_FLOOR} tiles)`);
  }
  // A fresh mission starts with NO lane armed — the sentence above is only
  // true while that holds.
  if ((A.G.gridCharge || []).some(Boolean)) {
    F.push('a lane starts armed — the briefing says nothing stops a breach on its own');
  }
}

// 4. dismissing marks it done, permanently, and it survives a save round trip
{
  clickTut('next');
  if (tutorialActive()) F.push('briefing still active after dismissal');
  if (shown()) F.push('briefing overlay still visible after dismissal');
  if (A.active.settings.tutorial !== 'done') F.push('completion was not recorded');

  A.launch(firstNode());
  stillAir();
  if (tutorialActive()) F.push('briefing re-ran for a commander who finished it');

  const reloaded = A.initProfiles().find(p => p.callsign === 'NEW');
  if (!reloaded || reloaded.settings.tutorial !== 'done') F.push('completion did not persist');
}

// 5. a veteran commander never sees it
{
  const vet = unlockAll(A.blankProfile('VET'), ['rifle', 'wall', 'scout', 'marks']);
  vet.stats.deployments = 12;
  enter(vet);
  A.launch(firstNode());
  stillAir();
  if (tutorialActive()) F.push('briefing ran for a veteran commander');
}

// 6. skip works from any step and also sticks
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

// 7. Settings queues a replay, and the replay actually runs — once
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

// 8. the briefing never runs in Onslaught, and an aborted run leaves no overlay
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
