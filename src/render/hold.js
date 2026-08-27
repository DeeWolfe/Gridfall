// The hold: the between-missions home screen.

import {LEADS} from '../content/leads.js';
import {OPS} from '../content/operations.js';
import {active, MAPDEF, setMapdef} from '../state/session.js';
import {rankName} from '../save/progression.js';
import {enterProfile, opRun} from '../rules/run.js';
import {$, show} from './dom.js';
import {portrait} from './art.js';
import {startSky} from './sky.js';

/** The team lead card, with the swap chips. Shared with the operations screen. */
export function leadCardHTML() {
  const id = (active.lead && LEADS[active.lead]) ? active.lead : 'ironbrand';
  const L = LEADS[id];
  const perk = L.passive || L.active;

  return `<div class="leadcard" style="--lc:${L.col}">
    <div class="leadpic">${portrait(id)}<div class="leadname">${L.call}</div></div>
    <div class="leadinfo">
      <div class="leadrole">${L.role} <span>·</span> ${L.n}</div>
      <div class="leadbio">${L.bio}</div>
      <div class="leadperk"><b>${L.passive ? 'Passive' : 'Active'} · ${perk.n}</b>${perk.d}</div>
      <div class="leadswap">${Object.keys(LEADS).map(k => {
        const o = LEADS[k];
        return `<button class="leadchip${k === id ? ' on' : ''}" data-lead="${k}" style="--lc:${o.col}">${o.call}</button>`;
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
  startSky();
}
