// The hold: the between-missions home screen.

import {LEADS} from '../content/leads.js';
import {STRATAGEMS} from '../content/stratagems.js';
import {LEADGATES} from '../content/lead-unlocks.js';
import {OPS} from '../content/operations.js';
import {active, MAPDEF, setMapdef} from '../state/session.js';
import {rankName, leadUnlocked, leadGateText, leadPrice} from '../save/progression.js';
import {enterProfile, opRun} from '../rules/run.js';
import {$, show} from './dom.js';
import {portrait} from './art.js';
import {startScene} from './battlefield.js';
import {applyUiMode, uiModeLabel} from './uimode.js';

// The Squad roster stays folded into the lead's portrait until the portrait
// is tapped; picking a lead folds it back in with a one-shot absorb pulse.
let rosterOpen = false;
let rosterPulse = false;

export function toggleRoster() { rosterOpen = !rosterOpen; }
export function closeRoster(pulse) { rosterOpen = false; rosterPulse = !!pulse; }

/**
 * Play the suck-back animation on an open roster, then fold it and repaint
 * via `then`. Falls straight through when there is nothing to animate.
 */
export function foldRoster(scope, then) {
  const r = document.querySelectorAll(scope + ' .leadroster')[0];
  if (r && r.classList && r.classList.contains('open')) {
    if (r.classList.contains('closing')) return;
    r.classList.add('closing');
    setTimeout(() => { closeRoster(true); then(); }, 230);
  } else {
    closeRoster(true);
    then();
  }
}

/** The team lead card; its portrait doubles as the roster toggle. */
export function leadCardHTML() {
  const id = (active.lead && LEADS[active.lead]) ? active.lead : 'ironbrand';
  const L = LEADS[id];
  const def = L.stratagem ? STRATAGEMS[L.stratagem] : null;
  const pulse = rosterPulse;
  rosterPulse = false;

  return `<div class="leadcard" style="--lc:${L.col}">
    <div class="leadpic${pulse ? ' absorb' : ''}" data-rosterbtn role="button" tabindex="0"
      title="${rosterOpen ? 'Fold the roster away' : 'Tap to open the roster and swap leads'}">
      ${portrait(id)}<div class="leadname">${L.call}</div>
      <div class="lswap">${rosterOpen ? '✕' : '⇄'}</div></div>
    <div class="leadinfo">
      <div class="leadrole">${L.role} <span>·</span> ${L.n}</div>
      <div class="leadbio">${L.bio}</div>
      ${L.passive ? `<div class="leadperk"><b>Passive · ${L.passive.n}</b>${L.passive.d}</div>` : ''}
      ${def ? `<div class="leadperk strat"><b>Stratagem · ${def.n} · ${def.dp} DP</b>${def.d} Once per mission; resolves at the start of the following turn.</div>` : ''}
      <div class="leadchain">Runs the squad. Reports to <b>${active.callsign}</b> · ${rankName(active.progress.rank)}</div>
    </div></div>`;
}

/**
 * The lead roster as a tile grid — the same tiles serve the Squad panel
 * (assigning, folded behind the portrait) and the Quartermaster (buying,
 * always spread out); `mode` decides both the action and the wrapper.
 */
export function leadTilesHTML(mode) {
  const current = (active.lead && LEADS[active.lead]) ? active.lead : 'ironbrand';
  const grid = `<div class="leadgrid">${Object.keys(LEADS).map((k, i) => {
    const o = LEADS[k];
    const open = leadUnlocked(k);
    const def = o.stratagem ? STRATAGEMS[o.stratagem] : null;
    const perk = o.passive ? o.passive.n : def ? def.n : '';
    const foot = mode === 'shop'
      ? (open ? (LEADGATES[k] ? 'Owned' : 'Standard issue') : leadPrice(k) + ' cr')
      : (k === current ? 'Assigned' : open ? 'Tap to assign' : leadPrice(k) + ' cr · Quartermaster');
    const attr = mode === 'shop' ? (open ? '' : ` data-leadbuy="${k}"`) : ` data-lead="${k}"`;
    return `<button class="leadtile${mode === 'squad' && k === current ? ' on' : ''}${open ? '' : ' locked'}"
        ${attr} style="--lc:${o.col};--i:${i}" title="${o.call} — ${o.role}. ${o.bio}">
      <span class="ltpic">${portrait(k)}</span>
      <span class="ltname">${open ? '' : '🔒 '}${o.call}</span>
      <span class="ltrole">${o.role}</span>
      <span class="ltperk">${o.passive ? '◈ ' + perk : ''}${o.passive && def ? ' · ' : ''}${def ? '⬡ ' + def.n : ''}</span>
      <span class="ltfoot${open ? '' : ' price'}">${foot}</span>
    </button>`;
  }).join('')}</div>`;
  if (mode === 'shop') return grid;
  return `<div class="leadroster${rosterOpen ? ' open' : ''}">
    <div class="sect">Roster — tap a lead to assign</div>${grid}</div>`;
}

/** Refresh the hold's readouts from the active profile. */
export function paintHold() {
  if (!active) return;
  const p = active;
  p.op = OPS[p.op] ? p.op : 'ironveil';
  setMapdef(p.op);

  $('h-cs').textContent = p.callsign;
  $('h-rk').textContent = rankName(p.progress.rank) + ' · Rank ' + p.progress.rank;
  $('h-cr').textContent = p.progress.credits;
  $('h-sa').textContent = p.progress.salvage;
  $('sectorname').textContent = MAPDEF.n.replace('OPERATION ', '');
  $('shipname').textContent = 'DS ' + (p.ship || 'ANVIL-7');

  // The profile carries the interface preference, so re-apply it on entry.
  applyUiMode();
  const chip = $('uiswap');
  if (chip) chip.textContent = 'UI · ' + uiModeLabel();

  const left = MAPDEF.nodes.length - opRun().cleared.length;
  $('deploysub').textContent = left > 0
    ? `${MAPDEF.n} · ${left} mission${left > 1 ? 's' : ''} remaining. Choose another operation at any time.`
    : `${MAPDEF.n} complete. Select a new operation.`;
}

/** Take a profile into play and land on the hold screen. */
export function enter(p) {
  enterProfile(p);
  show('hold');
  paintHold();
  startScene();
}
