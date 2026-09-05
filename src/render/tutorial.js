// The first-mission briefing.
//
// Eight steps over the combat screen, and the two that matter advance only
// when the player actually does the thing — deploys a card, ends the turn —
// not when they click past a wall of text. The whole thing is presentation:
// rules know nothing about it, and progress lives in the profile so the
// briefing runs once per commander (or again on request, from Settings).
//
// It is written for somebody who has not played a game like this before, and
// in some cases for somebody who has not played a game. So: no genre words, no
// abbreviation used before it is spelled out, one idea per step, and every
// step names a thing that is on the screen while it is being read.
//
// Steps that point at furniture take the resolved layout, because the furniture
// moves: on a desktop the order and the log both live in the right-hand rail,
// and on a phone the order sits under the board and the log is behind a button.
// A briefing that told a phone player to look at a rail that is not there would
// be worse than no briefing.

import {MAXDP, GROUND_FLOOR} from '../state/constants.js';
import {G, active, replaying} from '../state/session.js';
import {commit} from '../save/profile.js';
import {$} from './dom.js';
import {resolvedMode} from './uimode.js';

const pc = () => resolvedMode() === 'pc';

const STEPS = [
  {
    title: 'What you are here to do',
    body: () => 'Hostiles come from the right and walk left. You put soldiers ' +
      'down to stop them. If one gets all the way across, the mission is over.',
    btn: 'Begin',
  },
  {
    title: 'The board',
    body: () => 'The blue tiles on the left are yours. You can only place a ' +
      'soldier on ground you already hold, and whoever ends the turn standing ' +
      'on a tile owns it. Ground is not scenery.',
    btn: 'Next',
  },
  {
    title: 'Your orders',
    body: () => `Every mission asks for one thing, and it is written ` +
      `${pc() ? 'in the panel on the right' : 'just under the board'}, under ` +
      'OBJECTIVE: what to do, how far through it you are, and what ends the ' +
      'mission early. Read it first — holding the line is not always the job.',
    btn: 'Next',
  },
  {
    title: 'Placing a soldier',
    body: () => 'The cards along the bottom are who you can call in now. Tap ' +
      `one, then a lit tile. Each costs deploy points: you get ${MAXDP} a turn ` +
      'and any you do not spend are lost.',
    wait: 'Place a soldier to continue',
    done: () => G && G.units.length > 0,
  },
  {
    title: 'Reading what is coming',
    body: () => 'The strip along the top lists next turn\'s hostiles. The ◀ ' +
      'arrows on the right edge say which row each one walks into. That is a ' +
      'promise, not a guess — build where they point.',
    btn: 'Next',
  },
  {
    title: 'Ending the turn',
    body: () => 'Each soldier acts once a turn. Move one and its go is used; ' +
      'leave it alone and it fires by itself. Nothing happens until you press ' +
      'End turn, so take your time.',
    wait: 'Press End turn to continue',
    done: () => G && G.turn > 1,
  },
  {
    title: 'The log',
    body: () => 'Every shot and every move is written down as it happens, ' +
      `${pc() ? 'in the Combat log on the right' : 'behind the Log button below'}. ` +
      'If something died and you did not see why, it is in there.',
    btn: 'Next',
  },
  {
    title: 'How you lose',
    body: () => 'Nothing stops a hostile crossing your line on its own. One ' +
      `getting through ends the mission, and so does being pushed under ` +
      `${GROUND_FLOOR} tiles of ground. A LAST-STAND PROTOCOL card played ` +
      'into a row destroys the next hostile to cross it. An armed row wears ⛨.',
    btn: 'Dismiss',
  },
];

let tutStep = -1;

export const tutorialActive = () => tutStep >= 0;

/**
 * Called on every entry into combat. Starts the briefing for a commander who
 * has never deployed (or asked for a replay); otherwise makes sure no stale
 * overlay survives from an aborted earlier run.
 */
export function maybeStartTutorial() {
  const wants = active && G && !G.endless && (
    (active.settings.tutorial === undefined && active.stats.deployments === 0) ||
    active.settings.tutorial === 'replay'
  );
  if (!wants) {
    if (tutStep >= 0) dismiss();
    return;
  }
  tutStep = 0;
  render();
}

/**
 * Called after every redraw. Advances the do-it steps once their condition
 * holds; sits still during a turn replay so the briefing never reacts to the
 * swapped-in playback frames.
 */
export function tutorialTick() {
  if (tutStep < 0 || replaying) return;
  const s = STEPS[tutStep];
  if (s.done && s.done()) advance();
}

export function skipTutorial() {
  if (tutStep >= 0) finishBriefing();
}

function advance() {
  tutStep++;
  if (tutStep >= STEPS.length) finishBriefing();
  else render();
}

/** Done or skipped: either way it never auto-runs for this commander again. */
function finishBriefing() {
  dismiss();
  if (!active) return;
  active.settings = active.settings || {};
  active.settings.tutorial = 'done';
  commit();
}

function dismiss() {
  tutStep = -1;
  $('tut').classList.remove('on');
  $('tut').innerHTML = '';
}

function render() {
  const s = STEPS[tutStep];
  const pips = STEPS.map((_, i) => `<i${i <= tutStep ? ' class="on"' : ''}></i>`).join('');

  $('tut').innerHTML = `<div class="tutcard">
    <div class="tutpips">${pips}</div>
    <div class="tuttitle">${s.title}</div>
    <div class="tutbody">${typeof s.body === 'function' ? s.body() : s.body}</div>
    ${s.wait ? `<div class="tutwait">${s.wait}</div>` : ''}
    <div class="tutacts">
      <span class="tutskip" data-tut="skip">Skip briefing</span>
      ${s.btn ? `<button class="btn gold" data-tut="next">${s.btn}</button>` : ''}
    </div>
  </div>`;
  $('tut').classList.add('on');

  document.querySelectorAll('#tut [data-tut]').forEach(el => {
    el.onclick = () => (el.dataset.tut === 'skip' ? skipTutorial() : advance());
  });
}
