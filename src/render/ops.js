// Operation select: three maps, each with its own progress.

import {OPS} from '../content/operations.js';
import {active, setMapdef} from '../state/session.js';
import {commit} from '../save/profile.js';
import {genRun} from '../rules/run.js';
import {$, show} from './dom.js';
import {leadCardHTML} from './hold.js';
import {renderMap} from './map.js';

/** A thumbnail of an operation's map: zones, edges, and cleared nodes. */
function opThumb(o, run) {
  const node = id => o.nodes.find(n => n.id === id);
  return `<svg viewBox="0 0 440 300" class="opmini">
        ${o.zones.map(z => `<polygon points="${z.p}" fill="${o.col}" opacity=".10" stroke="${o.col}" stroke-width="2" stroke-opacity=".35"/>`).join('')}
        ${o.edges.map(([a, b]) => {
          const A = node(a);
          const B = node(b);
          return `<line x1="${A.x}" y1="${A.y}" x2="${B.x}" y2="${B.y}" stroke="${o.col}" stroke-width="1.6" opacity=".4"/>`;
        }).join('')}
        ${o.nodes.map(n => `<circle cx="${n.x}" cy="${n.y}" r="7" fill="${run && run.cleared.includes(n.id) ? '#5dffa0' : '#0d0b1c'}" stroke="${o.col}" stroke-width="2.4"/>`).join('')}
      </svg>`;
}

export function renderOps() {
  if (!active) return;
  active.ops = active.ops || {};

  $('opsbody').innerHTML = leadCardHTML() + `<div class="sect" style="margin-top:16px">Select an operation</div>
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

  document.querySelectorAll('#opsbody [data-lead]').forEach(b => {
    b.onclick = () => { active.lead = b.dataset.lead; commit(); renderOps(); };
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
