// The hold: the between-missions home screen.

import {LEADS} from '../content/leads.js';
import {STRATAGEMS} from '../content/stratagems.js';
import {OPS} from '../content/operations.js';
import {active, MAPDEF, setMapdef} from '../state/session.js';
import {rankName, leadUnlocked, leadGateText} from '../save/progression.js';
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
      <div class="leadswap">${Object.keys(LEADS).map(k => {
        const o = LEADS[k];
        const open = leadUnlocked(k);
        return `<button class="leadchip${k === id ? ' on' : ''}${open ? '' : ' locked'}"
          data-lead="${k}" style="--lc:${o.col}"
          title="${open ? o.call : 'Locked — ' + leadGateText(k)}">${open ? o.call : '🔒 ' + o.call}</button>`;
      }).join('')}</div>
    </div></div>`;
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
