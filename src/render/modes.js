// Mode select: Campaign, Onslaught, Gauntlet, plus the Ironman toggle.

import {OPS} from '../content/operations.js';
import {active} from '../state/session.js';
import {commit} from '../save/profile.js';
import {launchOnslaught, launchGauntlet, launchDaily, todayKey, GAUNTLET_LEGS} from '../rules/mission.js';
import {$, show} from './dom.js';
import {renderOps} from './ops.js';

export function renderModes() {
  if (!active) return;
  active.bests = active.bests || {onslaught: 0, gauntlet: 0};
  active.ops = active.ops || {};
  active.daily = active.daily || {date: null, done: false, streak: 0};
  const g = active.gaunt;
  const cleared = Object.values(OPS).reduce((a, o) => a + ((active.ops[o.k] || {cleared: []}).cleared.length), 0);
  const doneToday = active.daily.date === todayKey() && active.daily.done;

  $('modesbody').innerHTML = `<div class="sect">Choose how you deploy</div>
  <div class="modegrid">
    <button class="modecard live" style="--oc:#4de8ff" id="goCampaign">
      <div class="mname">Campaign</div>
      <div class="mdesc">Work an operation node by node. Progress and credits persist between missions. Three operations available, each its own map.</div>
      <div class="mfoot"><span>${cleared} missions cleared</span>
        <span style="color:#4de8ff">Select ▸</span></div></button>
    <button class="modecard live" style="--oc:#ff4d8f" id="goOnslaught">
      <div class="mname">Onslaught</div>
      <div class="mdesc">One board. The waves never stop and keep getting heavier. Survive as long as you can — credits scale with how deep you get.</div>
      <div class="mfoot"><span>Best · ${active.bests.onslaught || 0} waves</span><span style="color:#ff4d8f">Deploy ▸</span></div></button>
    <button class="modecard live" style="--oc:#ffc94d" id="goGauntlet">
      <div class="mname">Gauntlet</div>
      <div class="mdesc">Three missions back to back, escalating rewards and heavier modifiers each leg. A single loss ends the chain.</div>
      <div class="mfoot"><span>${g ? `In progress — leg ${g.i + 1} of ${GAUNTLET_LEGS}` : `Completed · ${active.bests.gauntlet || 0}`}</span>
        <span style="color:#ffc94d">${g ? 'Resume ▸' : 'Begin ▸'}</span></div></button>
    <button class="modecard live" style="--oc:#9d6bff" id="goDaily">
      <div class="mname">Daily Challenge</div>
      <div class="mdesc">One mission and modifier, the same for every commander today. The first win of the day pays out and builds your streak — a loss just means try again.</div>
      <div class="mfoot"><span>${doneToday ? `Cleared today · streak ${active.daily.streak}` : active.daily.streak ? `Streak ${active.daily.streak} — not yet today` : 'Streak 0'}</span>
        <span style="color:#9d6bff">${doneToday ? 'Replay ▸' : 'Deploy ▸'}</span></div></button>
  </div>
  <div class="rows" style="margin-top:18px"><div class="row"><span>Ironman — losing a Campaign mission rerolls the whole operation</span>
    <label class="iron"><input type="checkbox" id="ironbox"${active.ironman ? ' checked' : ''}> ${active.ironman ? 'Enabled' : 'Off'}</label></div></div>`;

  const ironbox = $('ironbox');
  if (ironbox) {
    ironbox.onchange = () => { active.ironman = ironbox.checked; commit(); renderModes(); };
  }
  $('goCampaign').onclick = () => { show('ops'); renderOps(); };
  // A successful launch fires the enterCombat hook, which does the screen swap.
  $('goOnslaught').onclick = () => launchOnslaught();
  $('goGauntlet').onclick = () => launchGauntlet();
  $('goDaily').onclick = () => launchDaily();
}
