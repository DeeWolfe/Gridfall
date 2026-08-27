// The operation map: nodes, the edges that gate them, and the briefing list.

import {MAXDP} from '../state/constants.js';
import {MISSIONS} from '../content/missions.js';
import {MODS} from '../content/modifiers.js';
import {OPS} from '../content/operations.js';
import {active, MAPDEF, setMapdef} from '../state/session.js';
import {opRun, nodeState} from '../rules/run.js';
import {launch} from '../rules/mission.js';
import {$} from './dom.js';

const CLEARED = '#5dffa0';
const DARK = '#2b2558';

function edgesSvg(run) {
  const node = id => MAPDEF.nodes.find(n => n.id === id);
  return MAPDEF.edges.map(([a, b]) => {
    const A = node(a);
    const B = node(b);
    const done = run.cleared.includes(a) && run.cleared.includes(b);
    const live = (run.cleared.includes(a) && nodeState(b) === 'open') ||
      (run.cleared.includes(b) && nodeState(a) === 'open');
    const stroke = done ? CLEARED : live ? MAPDEF.col : DARK;
    return `<line x1="${A.x}" y1="${A.y}" x2="${B.x}" y2="${B.y}" stroke="${stroke}" stroke-width="${done || live ? 2 : 1.2}" stroke-dasharray="${done || live ? '' : '3 3'}" opacity="${done || live ? 0.9 : 0.5}"/>`;
  }).join('');
}

function nodesSvg(run) {
  return MAPDEF.nodes.map(n => {
    const st = nodeState(n.id);
    const m = MISSIONS[run.nodes[n.id].type];
    // Open nodes get a breathing ring so the eye lands on what is playable.
    const pulse = st === 'open'
      ? `<circle cx="${n.x}" cy="${n.y}" r="14" fill="none" stroke="${MAPDEF.col}" stroke-width="1" opacity=".5">
        <animate attributeName="r" values="11;19;11" dur="2.3s" repeatCount="indefinite"/>
        <animate attributeName="opacity" values=".6;0;.6" dur="2.3s" repeatCount="indefinite"/></circle>`
      : '';
    const tick = st === 'clear'
      ? `<path d="M${n.x - 4.5},${n.y} l3.4,3.4 l5.6,-6.6" stroke="#0d0b1c" stroke-width="2.2" fill="none"/>`
      : '';
    return `<g data-n="${n.id}" style="cursor:${st === 'open' ? 'pointer' : 'default'};opacity:${st === 'locked' ? 0.45 : 1}">
      ${pulse}
      <circle cx="${n.x}" cy="${n.y}" r="10" fill="${st === 'clear' ? CLEARED : '#0d0b1c'}" stroke="${st === 'clear' ? '#9dffc6' : st === 'open' ? MAPDEF.col : DARK}" stroke-width="2.4"/>
      ${tick}
      <text x="${n.x}" y="${n.y + 23}" fill="${st === 'locked' ? '#4a4477' : '#d3d0ea'}" font-size="7" text-anchor="middle" letter-spacing="1.1" font-family="ui-monospace,monospace">${m.n.toUpperCase()}</text></g>`;
  }).join('');
}

function zonesSvg() {
  const shapes = MAPDEF.zones
    .map(z => `<polygon points="${z.p}" fill="#141033" stroke="#3a2f7a" stroke-width="1.2" opacity=".7"/>`).join('');
  const labels = MAPDEF.zones.map(z => {
    const coords = z.p.split(' ');
    const xs = coords.map(q => +q.split(',')[0]);
    const ys = coords.map(q => +q.split(',')[1]);
    return `<text x="${Math.min(...xs) + 14}" y="${Math.max(...ys) - 9}" fill="#6a5fae" font-size="8" letter-spacing="2.4" font-family="ui-monospace,monospace">${z.l}</text>`;
  }).join('');
  return shapes + labels;
}

export function renderMap() {
  if (!active) return;
  if (!OPS[active.op]) active.op = 'ironveil';
  setMapdef(active.op);

  const run = opRun();
  $('maptitle').textContent = MAPDEF.n;

  const open = MAPDEF.nodes.filter(n => nodeState(n.id) === 'open');
  const briefings = open.map(n => {
    const nd = run.nodes[n.id];
    const m = MISSIONS[nd.type];
    const md = MODS[nd.mod];
    return `<div class="row" data-go="${n.id}" style="cursor:pointer">
        <span><b style="color:var(--cyan)">${m.n}</b>${nd.mod !== 'none' ? ` <span style="color:var(--violet)">· ${md.n}</span>` : ''}
        <div style="font-size:0.5312rem;color:var(--dim);margin-top:4px;line-height:1.5">${m.d}${md.d ? ' ' + md.d : ''}</div></span>
        <span class="r hot">${nd.reward} cr · ${nd.salv} sv ▸</span></div>`;
  }).join('') || '<div class="row"><span style="color:var(--dim)">Operation complete.</span></div>';

  $('mapbody').innerHTML = `<div class="mapwrap"><div class="mapsvg">
    <svg viewBox="0 0 440 300" style="width:100%;display:block">
      <defs><pattern id="gr" width="8" height="8" patternUnits="userSpaceOnUse">
        <path d="M8 0H0V8" fill="none" stroke="#181340" stroke-width=".5"/></pattern></defs>
      <rect width="440" height="300" fill="#080714"/><rect width="440" height="300" fill="url(#gr)"/>
      ${zonesSvg()}${edgesSvg(run)}${nodesSvg(run)}</svg></div>
    <div><div class="sect">Available — ${open.length}</div><div class="rows">${briefings}</div>
    <div class="sect">Loadout</div><div class="rows">
      <div class="row"><span>Deck size</span><span class="r${active.loadout.deck.length < 6 ? '' : ' hot'}">${active.loadout.deck.length} cards</span></div>
      <div class="row"><span>Gear fitted</span><span class="r">${Object.keys(active.loadout.gear).length}</span></div>
      <div class="row"><span>Deploy points</span><span class="r hot">${MAXDP} per turn</span></div></div>
    </div></div>`;

  document.querySelectorAll('#mapbody [data-n],#mapbody [data-go]').forEach(el => {
    const id = el.dataset.n || el.dataset.go;
    if (nodeState(id) === 'open') el.onclick = () => launch(id);
  });
}
