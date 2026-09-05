// The operation map: nodes, the edges that gate them, and the briefing list.
//
// The SVG builders take the map definition, the run and a node-state function
// rather than reaching for MAPDEF and nodeState directly, because the Deep Run
// draws its generated map through exactly the same code. One map renderer is
// the point: a second one would have drifted from this one by the second patch.

import {MAXDP} from '../state/constants.js';
import {MISSIONS} from '../content/missions.js';
import {MODS} from '../content/modifiers.js';
import {OPS} from '../content/operations.js';
import {active, MAPDEF, setMapdef} from '../state/session.js';
import {opRun, nodeState, reqBlocked, opComplete, genRun} from '../rules/run.js';
import {bossForOp} from '../rules/boss.js';
import {launch} from '../rules/mission.js';
import {commit} from '../save/profile.js';
import {$} from './dom.js';
import {ask} from './dialog.js';
import {playBossBrief} from './codec.js';

const CLEARED = '#5dffa0';
const DARK = '#2b2558';

function edgesSvg(def, run, complete, stateOf) {
  const node = id => def.nodes.find(n => n.id === id);
  return def.edges.map(([a, b]) => {
    const A = node(a);
    const B = node(b);
    const done = complete || (run.cleared.includes(a) && run.cleared.includes(b));
    const live = !complete && ((run.cleared.includes(a) && stateOf(b) === 'open') ||
      (run.cleared.includes(b) && stateOf(a) === 'open'));
    const stroke = done ? CLEARED : live ? def.col : DARK;
    return `<line x1="${A.x}" y1="${A.y}" x2="${B.x}" y2="${B.y}" stroke="${stroke}" stroke-width="${done || live ? 2 : 1.2}" stroke-dasharray="${done || live ? '' : '3 3'}" opacity="${done || live ? 0.9 : 0.5}"/>`;
  }).join('');
}

const GOLD = '#ffc94d';

// Once the final node is cleared the run stays on the board as a finished
// map — every node shown filled and ticked, whatever side objectives were
// actually collected — rather than snapping back to a fresh roll unasked.
function nodesSvg(def, run, complete, stateOf, blocked, labelOf) {
  return def.nodes.map(n => {
    const st = complete ? 'clear' : stateOf(n.id);
    const m = MISSIONS[run.nodes[n.id].type];
    const gated = !complete && blocked(n.id);
    // Open nodes get a breathing ring so the eye lands on what is playable.
    const pulse = st === 'open'
      ? `<circle cx="${n.x}" cy="${n.y}" r="14" fill="none" stroke="${def.col}" stroke-width="1" opacity=".5">
        <animate attributeName="r" values="11;19;11" dur="2.3s" repeatCount="indefinite"/>
        <animate attributeName="opacity" values=".6;0;.6" dur="2.3s" repeatCount="indefinite"/></circle>`
      : '';
    const tick = st === 'clear'
      ? `<path d="M${n.x - 4.5},${n.y} l3.4,3.4 l5.6,-6.6" stroke="#0d0b1c" stroke-width="2.2" fill="none"/>`
      : '';
    // Role markers: the extraction point wears gold, side objectives a dashed
    // halo, and a gate held shut shows its bar.
    const halo = n.role === 'final'
      ? `<circle cx="${n.x}" cy="${n.y}" r="14.5" fill="none" stroke="${GOLD}" stroke-width="1.4" opacity=".85"/>`
      : n.role === 'side'
        ? `<circle cx="${n.x}" cy="${n.y}" r="14" fill="none" stroke="${def.col}" stroke-width="1" stroke-dasharray="3 3" opacity=".6"/>`
        : '';
    const gate = gated
      ? `<path d="M${n.x - 4},${n.y - 1} h8 M${n.x},${n.y - 5} v8" stroke="${GOLD}" stroke-width="1.6" transform="rotate(45 ${n.x} ${n.y})"/>`
      : '';
    const [line1, line2] = labelOf(n, m);
    return `<g data-n="${n.id}" style="cursor:${st === 'open' ? 'pointer' : 'default'};opacity:${st === 'locked' && !gated ? 0.45 : 1}">
      ${pulse}${halo}
      <circle cx="${n.x}" cy="${n.y}" r="10" fill="${st === 'clear' ? CLEARED : '#0d0b1c'}" stroke="${st === 'clear' ? '#9dffc6' : st === 'open' ? def.col : n.role === 'final' ? GOLD : DARK}" stroke-width="2.4"/>
      ${tick}${gate}
      <text x="${n.x}" y="${n.y + 23}" fill="${st === 'locked' ? '#4a4477' : '#d3d0ea'}" font-size="9" text-anchor="middle" letter-spacing="1" font-family="ui-monospace,monospace">${line1}</text>
      ${line2 ? `<text x="${n.x}" y="${n.y + 31}" fill="${n.role === 'side' && !n.l ? GOLD : '#8d86bd'}" font-size="8" text-anchor="middle" letter-spacing="1.2" font-family="ui-monospace,monospace">${line2}</text>` : ''}</g>`;
  }).join('');
}

function zonesSvg(def) {
  const shapes = def.zones
    .map(z => `<polygon points="${z.p}" fill="#141033" stroke="#3a2f7a" stroke-width="1.2" opacity=".7"/>`).join('');
  const labels = def.zones.map(z => {
    const coords = z.p.split(' ');
    const xs = coords.map(q => +q.split(',')[0]);
    const ys = coords.map(q => +q.split(',')[1]);
    return `<text x="${Math.min(...xs) + 14}" y="${Math.max(...ys) - 9}" fill="#847cb8" font-size="10" letter-spacing="2.2" font-family="ui-monospace,monospace">${z.l}</text>`;
  }).join('');
  return shapes + labels;
}

const NEVER_GATED = () => false;

/**
 * An operation node's two label lines: its own name over the mission it holds,
 * or just the mission when the node is unnamed. The Deep Run passes its own —
 * its nodes are unnamed and its mission names are too long for the spacing a
 * generated map has.
 */
const OP_LABEL = (n, m) => [
  (n.l || m.n).toUpperCase(),
  n.l ? m.n.toUpperCase() : n.role === 'side' ? 'BONUS' : '',
];

/**
 * The whole map as one SVG. Shared by the operation map and the Deep Run —
 * pass the map definition, the run holding `cleared` and `nodes`, and the
 * node-state walk that belongs to that mode.
 */
export function mapSvg(def, run, complete, stateOf, blocked, labelOf) {
  const gate = blocked || NEVER_GATED;
  const label = labelOf || OP_LABEL;
  return `<svg viewBox="0 0 440 300" style="width:100%;display:block">
      <defs><pattern id="gr" width="8" height="8" patternUnits="userSpaceOnUse">
        <path d="M8 0H0V8" fill="none" stroke="#181340" stroke-width=".5"/></pattern></defs>
      <rect width="440" height="300" fill="#080714"/><rect width="440" height="300" fill="url(#gr)"/>
      ${zonesSvg(def)}${edgesSvg(def, run, complete, stateOf)}${nodesSvg(def, run, complete, stateOf, gate, label)}</svg>`;
}

export function renderMap() {
  if (!active) return;
  if (!OPS[active.op]) active.op = 'ironveil';
  setMapdef(active.op);

  const run = opRun();
  const complete = opComplete();
  $('maptitle').textContent = MAPDEF.n;

  const open = complete ? [] : MAPDEF.nodes.filter(n => nodeState(n.id) === 'open');
  const briefings = complete
    // The final node is down — the map stays up showing every node secured,
    // rather than snapping to a fresh roll before the player has seen it.
    ? `<div class="row" style="flex-direction:column;align-items:flex-start;gap:10px;padding:16px 4px">
        <span style="color:var(--gold);letter-spacing:1px">作戦完了 · OPERATION COMPLETE</span>
        <span style="font-size:0.6562rem;color:var(--dim);line-height:1.5">The first clear paid its requisition bundle. A replay pays credits and node drops as usual — the bundle is a one-time thing, and this operation stays on your record whatever you roll next.</span>
        <span style="font-size:0.6562rem;color:var(--dim);line-height:1.5">Every node on this map has been secured. Any unclaimed bonus objectives are forfeit — replay to roll a fresh set of missions here.</span>
        <button class="btn gold" id="opreplay">↺ Replay operation</button>
      </div>`
    : open.map(n => {
      const nd = run.nodes[n.id];
      const m = MISSIONS[nd.type];
      const md = MODS[nd.mod];
      const tag = n.role === 'final'
        ? ` <span style="color:var(--gold)">· ${nd.type === 'boss' ? 'PRIORITY TARGET' : 'EXTRACTION'} — ends the operation</span>`
        : n.role === 'side' ? ' <span style="color:var(--gold)">· BONUS OBJECTIVE</span>' : '';
      return `<div class="row" data-go="${n.id}" style="cursor:pointer">
        <span><b style="color:var(--zan)">${n.l ? n.l + ' — ' : ''}${m.n}</b>${nd.mod !== 'none' ? ` <span style="color:var(--violet)">· ${md.n}</span>` : ''}${tag}
        <div style="font-size:0.6562rem;color:var(--dim);margin-top:4px;line-height:1.5">${n.lore ? n.lore + ' ' : ''}${m.d}${md.d ? ' ' + md.d : ''}</div></span>
        <span class="r hot">${nd.reward} cr ▸</span></div>`;
    }).join('') || '<div class="row"><span style="color:var(--dim)">Operation complete.</span></div>';

  // Gated nodes the player could otherwise reach: say what is holding them.
  const gatedRows = complete ? '' : MAPDEF.nodes.filter(n => reqBlocked(n.id)).map(n =>
    `<div class="row locked"><span><b style="color:var(--gold)">⛒ ${n.l || 'Sealed route'}</b>
      <div style="font-size:0.6562rem;color:var(--dim);margin-top:4px;line-height:1.5">${n.reqText || 'Requirements not met.'}</div></span></div>`).join('');

  $('mapbody').innerHTML = `<div class="mapwrap"><div><div class="mapsvg">
    ${mapSvg(MAPDEF, run, complete, nodeState, reqBlocked)}</div>
    ${MAPDEF.lore ? `<div class="sect">状況 · Situation report</div>
      <div class="oplore" style="border-color:${MAPDEF.col}">${MAPDEF.lore}</div>` : ''}</div>
    <div><div class="sect">${complete ? 'Status' : 'Available — ' + open.length}</div><div class="rows">${briefings}${gatedRows}</div>
    <div class="sect">Loadout</div><div class="rows">
      <div class="row"><span>Deck size</span><span class="r${active.loadout.deck.length < 6 ? '' : ' hot'}">${active.loadout.deck.length} cards</span></div>
      <div class="row"><span>Gear fitted</span><span class="r">${Object.keys(active.loadout.gear).length}</span></div>
      <div class="row"><span>Deploy points</span><span class="r hot">${MAXDP} per turn</span></div></div>
    </div></div>`;

  document.querySelectorAll('#mapbody [data-n],#mapbody [data-go]').forEach(el => {
    const id = el.dataset.n || el.dataset.go;
    if (!complete && nodeState(id) === 'open') {
      el.onclick = () => {
        // The first launch against an operation boss opens with the sitrep
        // call — the drop itself waits for the channel to close. Every launch
        // after falls straight through: a briefing is a briefing, not a toll.
        if (run.nodes[id].type === 'boss' &&
          playBossBrief(run.nodes[id].boss || bossForOp(active.op), () => launch(id))) return;
        launch(id);
      };
    }
  });

  const replayBtn = $('opreplay');
  if (replayBtn) {
    replayBtn.onclick = () => ask('Replay operation',
      `Roll a fresh set of missions for <b>${MAPDEF.n}</b>?`,
      ok => {
        if (!ok) return;
        genRun();
        commit();
        renderMap();
      }, {ok: 'Replay'});
  }
}
