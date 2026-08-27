// The first-mission briefing.
//
// Five steps over the combat screen, and the two that matter advance only when
// the player actually does the thing — deploys a card, ends the turn — not
// when they click past a wall of text. The whole thing is presentation: rules
// know nothing about it, and progress lives in the profile so the briefing
// runs once per commander (or again on request, from Settings).

import {G, active, replaying} from '../state/session.js';
import {commit} from '../save/profile.js';
import {$} from './dom.js';

const STEPS = [
  {
    title: 'Command briefing',
    body: 'This is the grid, Commander. The cyan tiles are yours — you may only ' +
      'deploy on ground you hold, and tiles flip to whoever ends the turn ' +
      'standing on them. Hold ground to deploy; deploy to hold ground.',
    btn: 'Begin',
  },
  {
    title: 'Deploy',
    body: 'Tap a card in your hand, then a lit tile. Every card costs deploy ' +
      'points — you get 6 a turn, and unspent points are lost. The ⌕ badge on ' +
      'a card shows its full record.',
    wait: 'Deploy a card to continue',
    done: () => G && G.units.length > 0,
  },
  {
    title: 'Read the chevrons',
    body: 'The ◀ markers on the right edge promise which lane each hostile ' +
      'enters next turn — and that promise is kept. The strip at the top shows ' +
      'what is coming. Shape your line around both.',
    btn: 'Next',
  },
  {
    title: 'End the turn',
    body: 'Each unit acts once per turn, committed the moment you give the ' +
      'order. Any unit you leave alone fires on its own. End the turn (Space) ' +
      'and watch the resolution play out.',
    wait: 'End the turn to continue',
    done: () => G && G.turn > 1,
  },
  {
    title: 'Hold the line',
    body: 'Three breaches loses the mission. Falling below 6 tiles loses the ' +
      'mission. Everything else is yours to decide. Good hunting, Commander.',
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
  const wants = active && G && !G.endless && !G.gauntlet && (
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
    <div class="tutbody">${s.body}</div>
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
