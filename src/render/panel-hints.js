// One-time coach cards for the hold panels — Squad, Quartermaster, Database,
// Service Record. Same gold coach-card chrome as the combat briefing
// (tutorial.js: .tutcard/.tuttitle/.tutbody/.tutacts), so introducing a
// screen never looks different from introducing a mechanic mid-mission.
//
// Each panel shows its card once ever per commander, the first time that
// panel opens. Settings carries a Replay row (see panels.js) that clears the
// seen-state so all four show again on next visit — the same "runs once, or
// again on request" contract the combat briefing already uses.

import {active} from '../state/session.js';
import {commit} from '../save/profile.js';
import {$} from './dom.js';

const HINTS = {
  squad: {
    title: 'Squad',
    body: 'Your lead sets the squad\'s passive — pick one before you touch the deck. ' +
      'Tap any card to inspect it, fit gear, or move it between deck and reserve.',
  },
  quartermaster: {
    title: 'Quartermaster',
    body: 'Credits buy cards and uniforms, salvage buys gear — spend accordingly. ' +
      'A duplicate from a requisition drop promotes the card instead of wasting the pull, ' +
      'so nothing here is ever a dead end.',
  },
  database: {
    title: 'Database',
    body: 'Every asset, piece of gear, and hostile you have ever met gets an entry here. ' +
      'A hostile\'s file unlocks the moment you land the kill that reveals it.',
  },
  record: {
    title: 'Service Record',
    body: 'Your service history, earned commendations, veteran roster, and operation ' +
      'progress — tap a tab above to switch views.',
  },
};

/** Called every time a hold panel opens. Shows the coach card if this commander hasn't seen it. */
export function maybeShowPanelHint(key) {
  const h = HINTS[key];
  active.settings.hints = active.settings.hints || {};
  if (!h || active.settings.hints[key]) return;
  renderPanelHint(key, h);
}

function dismissPanelHint(key) {
  active.settings.hints[key] = true;
  commit();
  $('paneltut').classList.remove('on');
  $('paneltut').innerHTML = '';
}

function renderPanelHint(key, h) {
  $('paneltut').innerHTML = `<div class="tutcard">
    <div class="tuttitle">${h.title}</div>
    <div class="tutbody">${h.body}</div>
    <div class="tutacts" style="justify-content:flex-end">
      <button class="btn gold" data-tut="ok">Got it</button>
    </div>
  </div>`;
  $('paneltut').classList.add('on');
  document.querySelectorAll('#paneltut [data-tut]').forEach(el => { el.onclick = () => dismissPanelHint(key); });
}
