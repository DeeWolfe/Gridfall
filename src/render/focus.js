// The enlarged card view: full stats, gear fitting, and buy/add actions.

import {DECKSIZE} from '../state/constants.js';
import {POOL} from '../content/cards.js';
import {GEAR} from '../content/gear.js';
import {BEST} from '../content/hostiles.js';
import {TGNAME} from '../content/targeting-names.js';
import {TIERNAME, VET} from '../content/ranks.js';
import {active, setSel, setMover} from '../state/session.js';
import {commit} from '../save/profile.js';
import {costOf, gearOf, vetOf} from '../save/progression.js';
import {$} from './dom.js';
import {sigil, artFor, bokehLayer} from './art.js';

// Set by wiring.js — breaks what would otherwise be a focus <-> panels cycle.
let onAfterFocusAction = () => {};
export const setFocusFollowUp = fn => { onAfterFocusAction = fn; };

export function closeFocus() {
  $('focus').classList.remove('on');
  $('fwrap').innerHTML = '';
  $('fbg').innerHTML = '';
}

/** Every stat row worth showing for this card, skipping the ones it lacks. */
function statRows(id) {
  const k = POOL[id];
  const g = gearOf(id);
  return [
    ['Deploy cost', costOf(id) + ' DP' + (g && g.dp ? ' (geared)' : '')],
    k.hp ? ['Hull', k.hp + (g && g.hp ? ' +' + g.hp : '')] : null,
    ['Class', TIERNAME[k.t]],
    ['Footprint', k.size > 1 ? '2 cells' : k.attach ? 'Attachment' : '1 cell'],
    ['Mobility', k.attach ? '—' : k.mob ? (g && g.servo ? 'Mobile · fires while moving' : 'Mobile') : 'Anchored'],
    k.dmg ? ['Damage', (k.dmg + (g && g.dmg ? g.dmg : 0)) + (k.burst ? ` (${k.burst} on play)` : '')] : null,
    k.tg && k.tg !== 'none' ? ['Targeting', TGNAME[k.tg] || k.tg] : null,
    k.indirect ? ['Line of fire', 'Indirect — fires over blockers'] : null,
    k.drop ? ['Deployment', 'Any tile, including hostile ground'] : null,
    k.regen ? ['Shield', 'Regenerates each turn'] : null,
    k.riposte ? ['Riposte', k.riposte + ' back to attackers'] : null,
    k.pristine ? ['Pristine bonus', '+' + k.pristine + ' damage at full hull'] : null,
    k.claim ? ['On deployment', 'Claims ' + k.claim + ' tiles ahead'] : null,
    k.instant ? ['Type', 'Instant — no body left behind'] : null,
    g && g.crush ? ['Deployment', 'Onto a hostile — crushes it outright'] : null,
    (k.heal || k.hot) ? ['Support', 'Heals ' + (k.healType === 'tech' ? 'Tech' : 'Common') + ' units'] : null,
  ].filter(Boolean);
}

function actionsFor(id, mode) {
  const k = POOL[id];
  const owned = active.unlocks.cards.includes(id);
  const inDeck = active.loadout.deck.includes(id);
  const affordable = active.progress.credits >= k.price;
  const close = '<button class="btn ghost" data-close="1">Close</button>';

  if (mode === 'shop') {
    if (owned) return '<button class="btn ghost" data-close="1">Owned — close</button>';
    if (k.price === 0) return '<button class="btn ghost" data-close="1">Issued — close</button>';
    return affordable
      ? `<button class="btn gold" data-fbuy="${id}">Buy · ${k.price} cr</button>${close}`
      : `<button class="btn ghost" data-close="1">Need ${k.price} cr</button>`;
  }
  if (mode === 'deck' || mode === 'gear') {
    const toggle = inDeck
      ? `<button class="btn ghost" data-fdeck="${id}">Remove from deck</button>`
      : active.loadout.deck.length >= DECKSIZE
        ? (mode === 'gear' ? '<button class="btn ghost" disabled>Deck full</button>'
          : '<button class="btn ghost" data-close="1">Deck full</button>')
        : `<button class="btn" data-fdeck="${id}">Add to deck</button>`;
    if (mode === 'deck' && !inDeck && active.loadout.deck.length >= DECKSIZE) return toggle;
    return toggle + close;
  }
  if (mode === 'hand') {
    return `<button class="btn" data-fsel="${id}">Select for deployment</button>${close}`;
  }
  return close;
}

function gearBlock(id, mode) {
  const k = POOL[id];
  if (mode !== 'gear' || k.attach) return '';
  const g = gearOf(id);
  const owned = active.unlocks.gear;
  const chips = owned.map(gi => {
    const lit = active.loadout.gear[id] === gi ? 'color:var(--green);border-color:var(--green)' : '';
    return `<button class="mini" data-fitgear="${id}:${gi}" style="${lit}">${GEAR[gi].n}</button>`;
  }).join('') || '<span style="color:var(--dim)">No gear owned. Visit the Quartermaster.</span>';

  return `<div class="fab"><b>Gear slot</b>${g ? g.n + ' — ' + g.d : 'Empty.'}
      <div style="display:flex;flex-wrap:wrap;gap:5px;margin-top:8px">
      ${chips}
      ${g ? `<button class="mini" data-fitgear="${id}:none" style="color:var(--mag)">Strip</button>` : ''}</div></div>`;
}

export function focusCard(id, mode) {
  const k = POOL[id];
  const g = gearOf(id);
  const v = vetOf(id);
  const progress = v.next ? Math.min(100, (v.u - VET[v.t].at) / (v.next - VET[v.t].at) * 100) : 100;

  $('fwrap').innerHTML = `<div class="fcard t-${k.t} v${v.t}">
      <div class="fart">${artFor(id, k.t, 118, v.t >= 2 ? v.col : null)}<div class="fcost">${costOf(id)}</div>
        ${v.t ? `<div class="pips big">${'◆'.repeat(v.t)}</div>` : ''}
        ${k.hp ? `<div class="fhp">${k.hp + (g && g.hp ? g.hp : 0)} HULL</div>` : ''}</div>
      <div class="fname">${k.n}</div>
      <div class="ftype">${TIERNAME[k.t]}${k.attach ? ' · Attachment' : ''}${g ? ' · ' + g.n : ''}</div>
      <div class="vetbar"><div class="vlab"><span style="color:${v.col}">${v.n}</span>
        <span>${v.u} deployments${v.next ? ` · ${v.next - v.u} to ${VET[v.t + 1].n}` : ' · max rank'}</span></div>
        <div class="vtrack"><i style="width:${progress}%;background:${v.col}"></i></div></div>
      <div class="ftxt">${k.d}</div>
      <div class="fstats">${statRows(id).map(([a, b]) =>
        `<div class="fstat"><span class="k">${a}</span><span class="v">${b}</span></div>`).join('')}</div>
      ${k.ab ? `<div class="fab"><b>Ability · ${k.ab.n}${k.ab.cd ? ` · ${k.ab.cd} turn cooldown` : ''}</b>${k.ab.d}</div>` : ''}
      ${gearBlock(id, mode)}
    </div><div class="facts">${actionsFor(id, mode)}</div>`;

  const tint = k.t === 'special' ? ['#ffc94d', '#9d6bff', '#ff4d8f']
    : k.t === 'tech' ? ['#4de8ff', '#9d6bff', '#5dffa0'] : null;
  $('fbg').innerHTML = bokehLayer(tint);
  $('focus').classList.add('on');
  wireFocus();
}

export function focusEnemy(id) {
  const b = BEST[id];
  const stats = [['Hull', b.hp], ['Damage', b.dmg || '—'], ['Threat value', b.threat],
    ['Speed', b.spd === 0 ? 'Immobile' : b.spd + ' cells / turn'], ['Class', TIERNAME[b.t]]];

  $('fwrap').innerHTML = `<div class="fcard t-${b.t}" style="border-color:var(--mag);box-shadow:0 0 60px rgba(255,77,143,.3)">
      <div class="fart" style="background:radial-gradient(ellipse at 50% 118%,#5a1233 0%,#0b0918 74%)">
        ${sigil(id, 'x', 118, '#ff4d8f')}
        <div class="fcost" style="background:var(--mag);color:#1a0510">${b.threat}</div>
        <div class="fhp" style="color:var(--mag)">${b.hp} HULL</div></div>
      <div class="fname" style="color:#ff8fb5">${b.n}</div>
      <div class="ftype">Hostile · ${TIERNAME[b.t]}</div><div class="ftxt">${b.d}</div>
      <div class="fstats">${stats.map(([a, c]) =>
        `<div class="fstat"><span class="k">${a}</span><span class="v" style="color:#ff8fb5">${c}</span></div>`).join('')}</div>
    </div><div class="facts"><button class="btn ghost" data-close="1">Close</button></div>`;
  $('fbg').innerHTML = bokehLayer(['#ff4d8f', '#9d6bff', '#c23a5e']);
  $('focus').classList.add('on');
  wireFocus();
}

export function focusGear(gi) {
  const g = GEAR[gi];
  const owned = active.unlocks.gear.includes(gi);
  const affordable = active.progress.salvage >= g.cost;

  $('fwrap').innerHTML = `<div class="fcard t-tech">
      <div class="fart">${sigil(gi, 'tech', 118)}<div class="fcost" style="background:var(--cyan);color:#06121a">◈</div></div>
      <div class="fname">${g.n}</div><div class="ftype">Gear · one slot per card</div>
      <div class="ftxt">${g.d}</div>
      <div class="fstats"><div class="fstat"><span class="k">Cost</span><span class="v">${g.cost} salvage</span></div>
      <div class="fstat"><span class="k">Owned</span><span class="v">${owned ? 'Yes' : 'No'}</span></div></div>
    </div><div class="facts">${owned ? '<button class="btn ghost" data-close="1">Owned — fit it in Squad</button>'
      : affordable ? `<button class="btn" data-fgear="${gi}">Buy · ${g.cost} salvage</button><button class="btn ghost" data-close="1">Close</button>`
        : `<button class="btn ghost" data-close="1">Need ${g.cost} salvage</button>`}</div>`;
  $('fbg').innerHTML = bokehLayer(['#4de8ff', '#5dffa0', '#9d6bff']);
  $('focus').classList.add('on');
  wireFocus();
}

const each = (attrName, fn) =>
  document.querySelectorAll('#fwrap [' + attrName + ']').forEach(b => { b.onclick = () => fn(b); });

function wireFocus() {
  each('data-close', () => closeFocus());

  each('data-fbuy', b => {
    const id = b.dataset.fbuy;
    const k = POOL[id];
    if (active.unlocks.cards.includes(id) || active.progress.credits < k.price) return;
    active.progress.credits -= k.price;
    active.unlocks.cards.push(id);
    commit();
    closeFocus();
    onAfterFocusAction('quartermaster');
  });

  each('data-fgear', b => {
    const gi = b.dataset.fgear;
    const g = GEAR[gi];
    if (active.unlocks.gear.includes(gi) || active.progress.salvage < g.cost) return;
    active.progress.salvage -= g.cost;
    active.unlocks.gear.push(gi);
    commit();
    closeFocus();
    onAfterFocusAction('quartermaster');
  });

  each('data-fitgear', b => {
    const [id, gi] = b.dataset.fitgear.split(':');
    if (gi === 'none') {
      delete active.loadout.gear[id];
    } else {
      // One piece of gear exists per profile: fitting it strips it off whatever
      // was wearing it before.
      Object.keys(active.loadout.gear).forEach(k => {
        if (active.loadout.gear[k] === gi) delete active.loadout.gear[k];
      });
      active.loadout.gear[id] = gi;
    }
    commit();
    closeFocus();
    onAfterFocusAction('squad');
  });

  each('data-fdeck', b => {
    const id = b.dataset.fdeck;
    const deck = active.loadout.deck;
    const i = deck.indexOf(id);
    if (i >= 0) deck.splice(i, 1);
    else {
      if (deck.length >= DECKSIZE) return;
      deck.push(id);
    }
    commit();
    closeFocus();
    onAfterFocusAction('squad');
  });

  each('data-fsel', b => {
    setSel(b.dataset.fsel);
    setMover(null);
    closeFocus();
    onAfterFocusAction(null);
  });
}
