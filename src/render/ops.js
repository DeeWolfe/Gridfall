// Operation select: three maps, each with its own progress.

import {OPS} from '../content/operations.js';
import {active, setMapdef} from '../state/session.js';
import {commit} from '../save/profile.js';
import {genRun} from '../rules/run.js';
import {$, show} from './dom.js';
import {leadCardHTML, leadTilesHTML, toggleRoster, foldRoster, opThumb} from './hold.js';
import {leadUnlocked, leadGateText} from '../save/progression.js';
import {notify} from './dialog.js';
import {renderMap} from './map.js';

export function renderOps() {
  if (!active) return;
  active.ops = active.ops || {};

  $('opsbody').innerHTML = leadCardHTML() + leadTilesHTML('squad') +
    `<div class="sect" style="margin-top:16px">Select an operation</div>
  <div class="opgrid">${Object.values(OPS).map(o => {
    const run = active.ops[o.k];
    const done = run ? run.cleared.length : 0;
    const current = active.op === o.k;
    return `<button class="opcard${current ? ' cur' : ''}" data-op="${o.k}" style="--oc:${o.col}">
      <div class="opname">${o.n}</div><div class="opsub">${o.sub}</div>
      ${opThumb(o, run)}
      <div class="opfoot"><span>${done} / ${o.nodes.length} cleared</span>
        <span style="color:${o.col}">${current ? 'ACTIVE ▸' : 'Deploy ▸'}</span></div></button>`;
  }).join('')}</div>
  <div class="mnote">Each operation is its own map with its own missions. Progress is tracked separately — switch between them freely.</div>`;

  document.querySelectorAll('#opsbody [data-rosterbtn]').forEach(b => {
    b.onclick = () => { toggleRoster(); renderOps(); };
  });
  document.querySelectorAll('#opsbody [data-lead]').forEach(b => {
    b.onclick = () => {
      const k = b.dataset.lead;
      if (!leadUnlocked(k)) {
        notify('Not on the roster', 'Recruit this lead at the Quartermaster — ' + leadGateText(k) + '.');
        return;
      }
      active.lead = k;
      commit();
      foldRoster('#opsbody', renderOps);
    };
  });
  document.querySelectorAll('#opsbody [data-op]').forEach(b => {
    b.onclick = () => {
      active.op = b.dataset.op;
      setMapdef(active.op);
      if (!active.ops[active.op]) genRun();
      commit();
      show('map');
      renderMap();
    };
  });
}
