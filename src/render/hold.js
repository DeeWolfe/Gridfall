// The hold: the between-missions home screen.

import {LEADS} from '../content/leads.js';
import {STRATAGEMS} from '../content/stratagems.js';
import {LEADGATES} from '../content/lead-unlocks.js';
import {OPS} from '../content/operations.js';
import {active, MAPDEF, setMapdef} from '../state/session.js';
import {rankName, leadUnlocked, leadPrice} from '../save/progression.js';
import {enterProfile, opRun} from '../rules/run.js';
import {$, show} from './dom.js';
import {portrait} from './art.js';
import {startScene} from './battlefield.js';
import {applyUiMode} from './uimode.js';
import {syncMusic} from './music.js';

/** A thumbnail of an operation's map: zones, edges, and cleared nodes. */
export function opThumb(o, run) {
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
    </div></div>`;
}

/**
 * The lead roster as a tile grid — the same tiles serve the Squad panel
 * (assigning, folded behind the portrait) and the Quartermaster (buying,
 * always spread out); `mode` decides both the action and the wrapper.
 */
export function leadTilesHTML(mode, ctx) {
  const current = (active.lead && LEADS[active.lead]) ? active.lead : 'ironbrand';
  const surface = ctx || mode;
  const grid = `<div class="leadgrid">${Object.keys(LEADS).map((k, i) => {
    const o = LEADS[k];
    const open = leadUnlocked(k);
    const def = o.stratagem ? STRATAGEMS[o.stratagem] : null;
    const perk = [o.passive ? '◈ ' + o.passive.n : '', def ? '⬡ ' + def.n : '']
      .filter(Boolean).join(' · ');
    const foot = mode === 'shop'
      ? (open ? (LEADGATES[k] ? 'Owned' : 'Standard issue') : leadPrice(k) + ' cr')
      : (k === current ? 'Assigned' : open ? 'On the roster' : leadPrice(k) + ' cr');
    return `<button class="leadtile${mode === 'squad' && k === current ? ' on' : ''}${open ? '' : ' locked'}"
        data-leadfocus="${k}" data-lctx="${surface}" style="--lc:${o.col};--i:${i}"
        title="${o.call} — ${o.role}.${perk ? ' ' + perk + '.' : ''} ${o.bio}">
      ${open ? '' : '<span class="ltlock">🔒</span>'}
      <span class="ltcore"><span class="ltname">${o.call}</span>
        <span class="ltrole">${o.role}</span></span>
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
  syncMusic();

  const left = MAPDEF.nodes.length - opRun().cleared.length;
  $('deploysub').textContent = left > 0
    ? `${MAPDEF.n} · ${left} mission${left > 1 ? 's' : ''} remaining. Choose another operation at any time.`
    : `${MAPDEF.n} complete. Select a new operation.`;

  paintReadout();
  paintTicker();
}

/**
 * The current-deployment readout under the menu tiles: the active operation's
 * map and how far off the next requisition drop is. The whole card is a
 * shortcut straight onto the sector map (wired at boot).
 */
function paintReadout() {
  const el = $('readout');
  if (!el) return;
  const run = opRun();
  const meter = active.progress.packMeter || 0;
  el.innerHTML = `<span class="dmap">${opThumb(MAPDEF, run)}</span>
    <span class="dinfo">
      <span class="dhead">作戦 · Current deployment</span>
      <span class="drow"><b>${MAPDEF.n}</b></span>
      <span class="drow">Requisition drop · <b>${meter >= 1 ? 'one node out' : 'two nodes out'}</b>
        <span class="rqpips"><span class="rqpip${meter >= 1 ? ' on' : ''}"></span><span class="rqpip"></span></span></span>
      <span class="dgo">Open the sector map ▸</span>
    </span>`;
}

// The service ticker: 残心ネット chatter crawling above the footer. Two copies
// of the line and a −50% translate make the loop seamless.
const TICKERPOOL = [
  '残心ネット · uplink stable',
  'zanshin protocol in effect — every action deliberate',
  '警告 · hive activity rising across the shelf',
  'quartermaster reports fresh requisition stock',
  'descent vector locked · hull integrity nominal',
  '通信 · listening posts report movement in the dark',
  'hold the line — the grid remembers',
];

function paintTicker() {
  const el = $('ticker');
  if (!el) return;
  const line = [
    `operation ${MAPDEF.n.replace('OPERATION ', '')} in progress`,
    `${active.callsign} on deck · rank ${active.progress.rank}`,
    ...TICKERPOOL,
  ].join('  ···  ') + '  ···  ';
  el.textContent = line + line;
}

/** Take a profile into play and land on the hold screen. */
export function enter(p) {
  enterProfile(p);
  show('hold');
  paintHold();
  startScene();
}
