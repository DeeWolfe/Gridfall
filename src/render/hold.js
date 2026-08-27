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

/** The team lead card, with the swap chips. Shared with the operations screen. */
export function leadCardHTML() {
  const id = (active.lead && LEADS[active.lead]) ? active.lead : 'ironbrand';
  const L = LEADS[id];
  const def = L.stratagem ? STRATAGEMS[L.stratagem] : null;

  return `<div class="leadcard" style="--lc:${L.col}">
    <div class="leadpic">${portrait(id)}<div class="leadname">${L.call}</div></div>
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
 * (assigning) and the Quartermaster (buying); `mode` decides the action.
 */
export function leadTilesHTML(mode) {
  const current = (active.lead && LEADS[active.lead]) ? active.lead : 'ironbrand';
  return `<div class="leadgrid">${Object.keys(LEADS).map(k => {
    const o = LEADS[k];
    const open = leadUnlocked(k);
    const def = o.stratagem ? STRATAGEMS[o.stratagem] : null;
    const perk = o.passive ? o.passive.n : def ? def.n : '';
    const foot = mode === 'shop'
      ? (open ? (LEADGATES[k] ? 'Owned' : 'Standard issue') : leadPrice(k) + ' cr')
      : (k === current ? 'Assigned' : open ? 'Tap to assign' : leadPrice(k) + ' cr · Quartermaster');
    const attr = mode === 'shop' ? (open ? '' : ` data-leadbuy="${k}"`) : ` data-lead="${k}"`;
    return `<button class="leadtile${mode === 'squad' && k === current ? ' on' : ''}${open ? '' : ' locked'}"
        ${attr} style="--lc:${o.col}" title="${o.call} — ${o.role}. ${o.bio}">
      <span class="ltpic">${portrait(k)}</span>
      <span class="ltname">${open ? '' : '🔒 '}${o.call}</span>
      <span class="ltrole">${o.role}</span>
      <span class="ltperk">${o.passive ? '◈ ' + perk : ''}${o.passive && def ? ' · ' : ''}${def ? '⬡ ' + def.n : ''}</span>
      <span class="ltfoot${open ? '' : ' price'}">${foot}</span>
    </button>`;
  }).join('')}</div>`;
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
