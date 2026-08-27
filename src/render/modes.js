// Mode select: Campaign, Onslaught, Gauntlet, plus the Ironman toggle.

import {OPS} from '../content/operations.js';
import {active} from '../state/session.js';
import {commit} from '../save/profile.js';
import {launchOnslaught, launchGauntlet, GAUNTLET_LEGS} from '../rules/mission.js';
import {$, show} from './dom.js';
import {renderOps} from './ops.js';

export function renderModes() {
  if (!active) return;
  active.bests = active.bests || {onslaught: 0, gauntlet: 0};
  active.ops = active.ops || {};
  const g = active.gaunt;
  const cleared = Object.values(OPS).reduce((a, o) => a + ((active.ops[o.k] || {cleared: []}).cleared.length), 0);

  $('modesbody').innerHTML = `<div class="sect">Choose how you deploy</div>
  <div class="modegrid">
    <button class="modecard live" style="--oc:#4de8ff" id="goCampaign">
      <div class="mname">Campaign</div>
      <div class="mdesc">Work an operation node by node. Progress, credits and salvage persist between missions. Three operations available, each its own map.</div>
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
}
