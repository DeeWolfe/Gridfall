// Operation select: three maps, each with its own progress.

import {OPS} from '../content/operations.js';
import {active, setMapdef} from '../state/session.js';
import {commit} from '../save/profile.js';
import {genRun, opCleared} from '../rules/run.js';
import {$, show} from './dom.js';
import {leadCardHTML, leadTilesHTML, toggleRoster, opThumb} from './hold.js';
import {focusLead} from './focus.js';
import {renderMap} from './map.js';
import {playIntro} from './codec.js';

export function renderOps() {
  if (!active) return;
  active.ops = active.ops || {};

  $('opsbody').innerHTML = leadCardHTML() + leadTilesHTML('squad', 'ops') +
    `<div class="sect" style="margin-top:16px">Select an operation</div>
  <div class="opgrid">${Object.values(OPS).map(o => {
    const run = active.ops[o.k];
    const done = run ? run.cleared.length : 0;
    const final = o.nodes.find(n => n.role === 'final');
    const complete = !!(run && final && run.cleared.includes(final.id));
    // Two different facts, and they part company the moment a map is replayed:
    // `complete` is this run, `cleared` is the career. The tick belongs to the
    // career — an operation you have finished stays finished on the shelf, and
    // a fresh roll of it shows the tick beside a progress count of 0.
    const cleared = opCleared(o.k);
    const current = active.op === o.k;
    return `<button class="opcard${current ? ' cur' : ''}" data-op="${o.k}" style="--oc:${o.col}">
      <div class="opname">${o.n}${o.heat ? `<span class="heatpips" title="Deep zone — +${o.heat} threat every wave">${'▲'.repeat(o.heat)}</span>` : ''}${cleared ? ' <span style="color:var(--gold)" title="Cleared — you have finished this operation">✓</span>' : ''}</div>
      <div class="opsub">${o.sub}</div>
      ${opThumb(o, run)}
      <div class="opfoot"><span${complete ? ' style="color:var(--gold)"' : ''}>${complete ? 'Complete'
      : `${done} / ${o.nodes.length} cleared${cleared ? ' · replaying' : ''}`}</span>
        <span style="color:${o.col}">${current ? 'ACTIVE ▸' : 'Deploy ▸'}</span></div></button>`;
  }).join('')}</div>
  <div class="mnote">Each operation is its own map with its own missions. Progress is tracked separately — switch between them freely.</div>`;

  document.querySelectorAll('#opsbody [data-rosterbtn]').forEach(b => {
    b.onclick = () => { toggleRoster(); renderOps(); };
  });
  document.querySelectorAll('#opsbody [data-leadfocus]').forEach(b => {
    b.onclick = () => focusLead(b.dataset.leadfocus, b.dataset.lctx);
  });
  document.querySelectorAll('#opsbody [data-op]').forEach(b => {
    b.onclick = () => {
      active.op = b.dataset.op;
      setMapdef(active.op);
      if (!active.ops[active.op]) genRun();
      commit();
      // The first time a commander opens an operation, Central Command calls
      // ahead of the drop. The map waits behind the transmission.
      const go = () => { show('map'); renderMap(); };
      if (!playIntro(active.op, go)) go();
    };
  });
}
