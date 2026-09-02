// The enlarged card view: full stats, gear fitting, and buy/add actions.

import {DECKSIZE} from '../state/constants.js';
import {POOL} from '../content/cards.js';
import {GEAR} from '../content/gear.js';
import {BEST} from '../content/hostiles.js';
import {LEADS} from '../content/leads.js';
import {STRATAGEMS} from '../content/stratagems.js';
import {TGNAME} from '../content/targeting-names.js';
import {TIERNAME, VET} from '../content/ranks.js';
import {active, setSel, setMover} from '../state/session.js';
import {commit} from '../save/profile.js';
import {costOf, gearOf, vetOf, gearFits, frameWeapon, isProto, CHASSIS_NAME, leadUnlocked, leadPrice, leadGateText, cardName, setPilotName} from '../save/progression.js';
import {$, attr} from './dom.js';
import {sigil, artFor, portrait, bokehLayer} from './art.js';
import {notify} from './dialog.js';
import {hitboxFor, hitboxForFoe} from './hitbox.js';

// Set by wiring.js — breaks what would otherwise be a focus <-> panels cycle.
let onAfterFocusAction = () => {};
export const setFocusFollowUp = fn => { onAfterFocusAction = fn; };

// Also set by wiring.js: what to re-render after a lead is assigned or
// recruited from the focus view — each roster surface folds its own way.
let onLeadDone = () => {};
export const setLeadFollowUp = fn => { onLeadDone = fn; };

export function closeFocus() {
  $('focus').classList.remove('on');
  $('fwrap').innerHTML = '';
  $('fbg').innerHTML = '';
}

/**
 * Every stat row worth showing for this card, skipping the ones it lacks.
 *
 * Deploy cost, hull and class are deliberately absent: all three are already
 * printed on the card above this block — the cost badge, the HULL readout on
 * the art, and the subtitle — and repeating them was the bulk of the noise.
 * Footprint only appears when it is not the 1 cell 59 of 62 cards occupy, and
 * targeting is gone entirely in favour of the diagram, which says it better.
 */
function statRows(id) {
  const k = POOL[id];
  const g = gearOf(id);
  // Frame gear replaces rather than adds, so the damage row has to read the
  // weapon when there is one — printing "4 + 8" for a Beam Rifle would be a lie
  // about a number the player is choosing between two of.
  const w = frameWeapon(id);
  return [
    isProto(id) ? ['Crew', 'Needs a Frame Pilot on or beside the cells it fills'] : null,
    k.pilot ? ['Purpose', 'Unarmed. A Frame deploys onto it and takes it aboard'] : null,
    // Only worth a row when the geared cost differs from the printed one.
    (g && g.dp) ? ['Deploy cost', costOf(id) + ' DP (geared)'] : null,
    (k.hp && g && g.hp) ? ['Hull', k.hp + ' +' + g.hp] : null,
    // An instant never lands, so it has no footprint to report.
    (!k.instant && (k.size > 1 || k.attach)) ? ['Footprint', k.size > 1 ? k.size + ' cells' : 'Attachment'] : null,
    (w && w.dmg) ? ['Damage', `${w.dmg} — ${w.n}`] : null,
    (!w && k.dmg) ? ['Damage', (k.dmg + (g && g.dmg ? g.dmg : 0)) + (k.burst ? ` (${k.burst} on play)` : '')] : null,
    k.recharge ? ['Rate of fire', 'Every other turn — needs a turn to cycle'] : null,
    k.charge ? ['Charge', `Moves up to ${k.charge} cells forward`] : null,
    k.push ? ['On hit', 'Drives the survivor back one cell'] : null,
    k.swap ? ['Action', 'Trades places with any friendly unit, anywhere'] : null,
    k.squad ? ['Deployment', `${k.squad} bodies from one card`] : null,
    k.techBuff ? ['Support', `Tech unit ahead: +${k.techBuff.dmg} damage, repairs ${k.techBuff.repair}/turn`] : null,
    k.sustain ? ['Support', `Adjacent: repair ${k.sustain.repair}/turn, cooldowns tick faster`] : null,
    k.mine ? ['Trap', `${k.mine} damage to the first hostile in, then spent`] : null,
    k.zoneMin ? ['Deployment', `Column ${k.zoneMin} and beyond${k.anyGround ? ', any ground' : ', held ground only'}`] : null,
    k.drop ? ['Deployment', 'Any tile, including hostile ground'] : null,
    k.regen ? ['Shield', 'Regenerates each turn'] : null,
    (k.riposte || (w && w.riposte)) ? ['Riposte', ((k.riposte || 0) + ((w && w.riposte) || 0)) + ' back to attackers'] : null,
    k.pristine ? ['Pristine bonus', '+' + k.pristine + ' damage at full hull'] : null,
    k.claim ? ['On deployment', 'Claims ' + k.claim + ' tiles ahead'] : null,
    k.instant ? ['Type', 'Instant — no body left behind'] : null,
    k.gain ? ['Deploy points', `+${k.gain} this turn`] : null,
    k.draw ? ['Cards called in', '+' + k.draw] : null,
    k.homestrike ? ['Home volley', `${k.homestrike} to every hostile in your two home columns`] : null,
    k.crater ? ['Demolition', `Craters the chosen tile for good — ${k.blastDmg} blast damage around it`] : null,
    k.chill ? ['Field', 'Hostiles in its lane advance at half speed'] : null,
    k.lensBoost ? ['Amplifier', `+${k.lensBoost} to friendly fire passing through its cell`] : null,
    k.degauss ? ['Field', 'Hostiles in its lane lose their armour floors'] : null,
    k.discard ? ['Cost', 'One card at random from your hand'] : null,
    g && g.crush ? ['Deployment', 'Onto a hostile — crushes it outright'] : null,
    (k.heal || k.hot) ? ['Support', 'Heals ' + (k.healType === 'tech' ? 'Tech' : 'Common') + ' units'] : null,
  ].filter(Boolean);
}

/** Yes/no facts read better as chips than as a row each. */
function cardChips(id) {
  const k = POOL[id];
  const g = gearOf(id);
  const out = [];
  if (k.indirect || (g && g.indirect)) out.push(['hot', 'Indirect']);
  if (g && g.rearsight) out.push(['hot', 'Rear guard']);
  if (k.instant) out.push(['gold', 'Instant']);
  if (k.drop) out.push(['', 'Any tile']);
  if (k.blocker) out.push(['', 'Blocker']);
  if (!out.length) return '';
  return `<div class="tagrow">${out
    .map(([c, t]) => `<span class="tag${c ? ' ' + c : ''}">${t}</span>`).join('')}</div>`;
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
  if (mode === 'proto') {
    if (!owned) {
      return affordable
        ? `<button class="btn gold" data-fbuy="${id}">Buy · ${k.price} cr</button>${close}`
        : `<button class="btn ghost" data-close="1">Need ${k.price} cr</button>`;
    }
    // One slot, so fielding a second Frame replaces the first rather than
    // failing — the alternative is asking the player to unfield one by hand
    // before they can try the other.
    const here = active.loadout.frame === id;
    const other = active.loadout.frame && POOL[active.loadout.frame];
    return (here
      ? `<button class="btn ghost" data-fframe="none">Remove from the Frame slot</button>`
      : `<button class="btn" data-fframe="${id}">Field it${other ? ` — replaces ${other.n}` : ''}</button>`)
      + close;
  }
  if (mode === 'hand') {
    return `<button class="btn" data-fsel="${id}">Select for deployment</button>${close}`;
  }
  return close;
}

// Owned gear groups by its dominant stat (see reference/gridfall-data.json)
// rather than staying one flat list — a pool this small doesn't need it yet,
// but it stops the fitting list from becoming a wall as the pool grows.
const GEAR_ROLES = [['offense', 'Offense'], ['defense', 'Defense'], ['utility', 'Utility']];
const ROLE_NAME = Object.fromEntries(GEAR_ROLES);
// A role this size or smaller reads fine without a filter on top of it.
const GEAR_SEARCH_THRESHOLD = 10;

/** Which card is wearing `gi` right now, if any. One piece exists per profile. */
export function gearWearer(gi) {
  return Object.keys(active.loadout.gear).find(k => active.loadout.gear[k] === gi) || null;
}

/**
 * One fitting row: the piece, what it does, and where it is.
 *
 * The chips this replaces printed nineteen names and nothing else, so choosing
 * gear meant remembering nineteen rules texts — which players plainly were not
 * doing. The rules text is the row now, and the right-hand state answers the
 * other half of the confusion: exactly one of each piece exists, so fitting one
 * that is already somewhere quietly strips it off that card. Saying so before
 * the tap is cheaper than discovering it afterwards.
 */
function gearRow(id, gi) {
  const g = GEAR[gi];
  const here = active.loadout.gear[id] === gi;
  const on = here ? null : gearWearer(gi);
  const where = here ? '<span class="gwhere on">Fitted</span>'
    : on ? `<span class="gwhere moved">On ${POOL[on].n}</span>`
      : '<span class="gwhere">Free</span>';
  return `<button class="grow${here ? ' on' : ''}" data-fitgear="${id}:${gi}"
      data-gname="${attr((g.n + ' ' + g.d).toLowerCase())}">
    <span class="gtop"><span class="gn">${g.n}</span>${where}</span>
    <span class="gd">${g.d}</span></button>`;
}

/**
 * The weapon block for a Frame.
 *
 * A Frame's gear does not ride on top of the card, it IS the card's weapon —
 * so this reads as a loadout choice rather than an accessory slot, and a bare
 * Frame has to say what it is carrying instead of reading as empty. Role tabs
 * would be silly over two pieces, so the list is flat.
 */
function frameWeaponBlock(id, mode) {
  const k = POOL[id];
  // Two different questions: what is FITTED (any Frame gear — the Arm-Mounted
  // Blade included) versus what WEAPON it carries (only gear with a firing
  // pattern replaces the printed one). Conflating them once left an ability
  // drive with no way to be removed at all.
  const g = gearOf(id);
  const fitted = g && g.frame === id ? g : null;
  const w = frameWeapon(id);
  const carried = w ? `${w.n}`
    : fitted ? `${k.n} service weapon + ${fitted.n}`
      : `${k.n} service weapon`;
  const rules = fitted ? fitted.d
    : `${TGNAME[k.tg] || k.tg} · ${k.dmg} damage. Fit a weapon in Squad to change it.`;

  // The picker belongs on both surfaces a Frame is reachable from: the deck
  // grid ('gear') and the Frame slot ('proto'). It used to check only the
  // first, and moving Frames out of the deck therefore left no way at all to
  // change what one was carrying.
  if (mode !== 'gear' && mode !== 'proto') {
    return `<div class="fab"><b>Weapon · ${carried}</b>${rules}</div>`;
  }

  const owned = active.unlocks.gear.filter(gi => gearFits(id, gi));
  const all = Object.keys(GEAR).filter(gi => GEAR[gi].frame === id);
  if (!owned.length) {
    return `<div class="fab"><b>Weapon · ${carried}</b>${rules}
      <div style="margin-top:8px;color:var(--dim)">No ${k.n} weapon owned yet — ${all.length} exist,
        and they fit nothing else. The Quartermaster has them.</div></div>`;
  }
  const rows = owned.map(gi => gearRow(id, gi)).join('');
  return `<div class="fab"><b>Weapon · ${carried}</b>${rules}
      <div class="glist" style="margin-top:8px">${rows}</div>
      ${fitted ? `<button class="mini" data-fitgear="${id}:none" style="color:var(--mag);margin-top:8px">${w ? 'Back to the service weapon' : `Remove ${fitted.n}`}</button>` : ''}</div>`;
}

function gearBlock(id, mode) {
  const k = POOL[id];
  // An attachment card is gear in card form; it has no slot of its own.
  if (k.attach) return '';
  // A Frame is a closed kit and reads as one.
  if (isProto(id)) return frameWeaponBlock(id, mode);
  const g = gearOf(id);

  // Everywhere but the fitting surface this is a readout, not a control — and
  // it is the readout the hand tray stopped printing, so it has to carry the
  // rules text rather than just the piece's name.
  if (mode !== 'gear') {
    return g ? `<div class="fab"><b>Gear fitted · ${g.n}</b>${g.d}</div>` : '';
  }

  // Frame weapons never appear here, and general gear never appears on a
  // Frame — one predicate, both directions, so the rule cannot be enforced on
  // one surface and forgotten on the other.
  const owned = active.unlocks.gear.filter(gi => gearFits(id, gi));
  if (!owned.length) {
    return `<div class="fab"><b>Gear slot</b>Empty.
      <div style="margin-top:8px;color:var(--dim)">No gear owned. Visit the Quartermaster.</div></div>`;
  }

  const grouped = {offense: [], defense: [], utility: []};
  owned.forEach(gi => grouped[GEAR[gi].role || 'utility'].push(gi));

  const showSearch = GEAR_ROLES.some(([r]) => grouped[r].length > GEAR_SEARCH_THRESHOLD);

  const tabs = GEAR_ROLES.map(([r, label], i) =>
    `<button class="tab${i === 0 ? ' on' : ''}" data-groletab="${r}">${label}<span class="ct">${grouped[r].length}</span></button>`).join('');

  const groups = GEAR_ROLES.map(([r], i) => `<div class="ggroup${i === 0 ? ' show' : ''}" data-grole="${r}">
      <div class="glist">${grouped[r].map(gi => gearRow(id, gi)).join('')
    || '<span style="color:var(--dim);font-size:0.6875rem">None owned in this role.</span>'}</div></div>`).join('');

  return `<div class="fab"><b>Gear slot · ${g ? g.n : 'empty'}</b>${g ? g.d : 'Fit one piece to this card.'}
      <div class="tabs">${tabs}</div>
      ${showSearch ? '<input class="gsearch" type="text" placeholder="Filter by name or effect…" data-gsearch="1">' : ''}
      <div style="margin-top:8px">${groups}</div>
      ${g ? `<button class="mini" data-fitgear="${id}:none" style="color:var(--mag);margin-top:8px">Strip ${g.n}</button>` : ''}</div>`;
}

export function focusCard(id, mode) {
  const k = POOL[id];
  const g = gearOf(id);
  const v = vetOf(id);
  $('fwrap').dataset.fmode = mode || '';
  const progress = v.next ? Math.min(100, (v.u - VET[v.t].at) / (v.next - VET[v.t].at) * 100) : 100;

  $('fwrap').innerHTML = `<div class="fcard t-${k.t} v${v.t}">
      <div class="fart">${artFor(id, k.t, 118, v.t >= 2 ? v.col : null)}<div class="fcost">${costOf(id)}</div>
        ${v.t ? `<div class="pips big">${'◆'.repeat(v.t)}</div>` : ''}
        ${k.hp ? `<div class="fhp">${k.hp + (g && g.hp ? g.hp : 0)} HULL</div>` : ''}</div>
      <div class="fname">${cardName(id)}</div>
      <div class="ftype">${k.pilot && active && active.pilotName ? k.n + ' · ' : ''}${CHASSIS_NAME[k.chassis] || TIERNAME[k.t]}${k.instant ? '' : ' · ' + (k.attach ? 'Attachment'
    : k.mob ? (g && g.servo ? 'Mobile · fires moving' : 'Mobile') : 'Anchored')}${g ? ' · ' + g.n : ''}</div>
      ${cardChips(id)}
      <div class="vetbar"><div class="vlab"><span style="color:${v.col}">${v.n}</span>
        <span>${v.u} deployments${v.next ? ` · ${v.next - v.u} to ${VET[v.t + 1].n}` : ' · max rank'}</span></div>
        <div class="vtrack"><i style="width:${progress}%;background:${v.col}"></i></div></div>
      <div class="ftxt">${k.d}</div>
      ${hitboxFor(id)}
      ${(() => {
    // With the duplicated rows gone, plenty of cards have nothing left to
    // list. Emit no block at all rather than an empty bordered box.
    const rows = statRows(id);
    return rows.length ? `<div class="fstats">${rows.map(([a, b]) =>
      `<div class="fstat"><span class="k">${a}</span><span class="v">${b}</span></div>`).join('')}</div>` : '';
  })()}
      ${k.ab ? `<div class="fab"><b>Ability · ${k.ab.n}${k.ab.cd ? ` · ${k.ab.cd} turn cooldown` : ''}</b>${k.ab.d}</div>` : ''}
      ${k.pilot && (mode === 'deck' || mode === 'gear') ? `<div class="fab">
        <b>Callsign</b>Name your pilot — it is what the field reports will call them.
        <div class="pnrow"><input id="pnamein" maxlength="14" placeholder="Frame Pilot"
          value="${active && active.pilotName ? active.pilotName : ''}">
        <button class="mini" data-pname="1">Set</button></div></div>` : ''}
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
  // Hull, threat and class are already on the art and the subtitle above —
  // same duplication the cards carried, cut the same way.
  const stats = [
    ['Damage', b.dmg || '—'],
    b.floor ? ['Armour', `−${b.floor} from every hit`] : null,
  ].filter(Boolean);

  $('fwrap').innerHTML = `<div class="fcard t-${b.t}" style="border-color:var(--mag);box-shadow:0 0 60px rgba(255,77,143,.3)">
      <div class="fart" style="background:radial-gradient(ellipse at 50% 118%,#5a1233 0%,#0b0918 74%)">
        ${sigil(id, 'x', 118, '#ff4d8f')}
        <div class="fcost" style="background:var(--mag);color:#1a0510">${b.threat}</div>
        <div class="fhp" style="color:var(--mag)">${b.hp} HULL</div></div>
      <div class="fname" style="color:#ff8fb5">${b.n}</div>
      <div class="ftype">Hostile · ${TIERNAME[b.t]} · ${b.spd === 0 ? 'Immobile'
    : b.spd === 0.5 ? 'Every other turn' : b.spd + ' / turn'}</div>
      <div class="ftxt">${b.d}</div>
      ${hitboxForFoe(id)}
      ${stats.length ? `<div class="fstats">${stats.map(([a, c]) =>
    `<div class="fstat"><span class="k">${a}</span><span class="v" style="color:#ff8fb5">${c}</span></div>`).join('')}</div>` : ''}
      ${b.counter ? `<div class="fab"><b>Counter</b>${b.counter}</div>` : ''}
    </div><div class="facts"><button class="btn ghost" data-close="1">Close</button></div>`;
  $('fbg').innerHTML = bokehLayer(['#ff4d8f', '#9d6bff', '#c23a5e']);
  $('focus').classList.add('on');
  wireFocus();
}

/**
 * Which way round you are fitting.
 *
 * Fitting from the card answers "what should this unit carry"; fitting from
 * the piece answers "where should this go", which is the question the Gear
 * locker opens with and the one the game had no answer for at all. Both end in
 * the same one-slot-per-card, one-copy-per-profile assignment.
 *
 * The list is folded behind the current answer. Which card is carrying this
 * piece is the fact you came here for; a twelve-row picker unfurled above it
 * buries that fact under the means of changing it. Tap the name to change it.
 */
function gearFitList(gi) {
  // Frame gear is bound to one Frame; general gear goes anywhere but a Frame.
  const deck = active.loadout.deck.filter(c => POOL[c] && !POOL[c].attach && gearFits(c, gi));
  const on = gearWearer(gi);
  if (!deck.length) {
    const bound = GEAR[gi].frame;
    return `<div class="fab"><b>Linked card</b><span style="color:var(--dim)">${bound
      ? `This is a ${POOL[bound].n} weapon. It fits nothing else, and the ${POOL[bound].n} is not in your deck.`
      : 'No card in the deck can carry gear yet.'}</span></div>`;
  }
  const rows = deck.map(c => {
    const worn = active.loadout.gear[c];
    const here = worn === gi;
    // Fitting displaces whatever that card already wears — say which piece,
    // because the swap is silent once it happens.
    const state = here ? '<span class="gwhere on">Fitted</span>'
      : worn ? `<span class="gwhere moved">Replaces ${GEAR[worn].n}</span>`
        : '<span class="gwhere">Slot free</span>';
    return `<button class="grow${here ? ' on' : ''}" data-wear="${gi}:${c}">
      <span class="gtop"><span class="gn">${POOL[c].n}</span>${state}</span>
      <span class="gd">${TIERNAME[POOL[c].t]} · ${costOf(c)} DP${POOL[c].hp ? ' · ' + POOL[c].hp + ' hull' : ''}</span></button>`;
  }).join('');
  const none = `<button class="grow${on ? '' : ' on'}" data-wear="${gi}:none">
    <span class="gtop"><span class="gn">None</span>${on ? '' : '<span class="gwhere on">Current</span>'}</span>
    <span class="gd">Leave it in the locker, fitted to nothing.</span></button>`;

  return `<div class="fab"><b>Linked card</b>
    <button class="gpick" data-gtoggle="1" aria-expanded="false">
      <span class="gpickn">${on ? POOL[on].n : 'None'}</span><span class="gcar">▾</span></button>
    <div class="glist gfold" data-gfold="1">${rows}${none}</div></div>`;
}

/**
 * `viewOnly` shows the piece without buy actions — used over a pack offer.
 * `fit` adds the fit-to list, for the Gear locker in Squad.
 */
export function focusGear(gi, viewOnly, fit) {
  const g = GEAR[gi];
  const owned = active.unlocks.gear.includes(gi);
  const affordable = active.progress.credits >= g.cost;
  const on = owned ? gearWearer(gi) : null;

  $('fwrap').innerHTML = `<div class="fcard t-tech">
      <div class="fart">${sigil(gi, 'tech', 118)}<div class="fcost" style="background:var(--cyan);color:#06121a">◈</div></div>
      <div class="fname">${g.n}</div><div class="ftype">Gear · one slot per card</div>
      <div class="ftxt">${g.d}</div>
      <div class="fstats"><div class="fstat"><span class="k">Cost</span><span class="v">${g.cost} cr</span></div>
      <div class="fstat"><span class="k">${owned && fit ? 'Role' : 'Fitted to'}</span><span class="v">${
    owned && fit ? ROLE_NAME[g.role] || 'Utility'
      : owned ? (on ? POOL[on].n : 'Nothing') : 'Not owned'}</span></div></div>
      ${owned && fit ? gearFitList(gi) : ''}
    </div><div class="facts">${viewOnly ? '<button class="btn ghost" data-close="1">Close</button>'
    : owned ? `<button class="btn ghost" data-close="1">${fit ? 'Done' : 'Owned — fit it in Squad'}</button>`
      : affordable ? `<button class="btn" data-fgear="${gi}">Buy · ${g.cost} cr</button><button class="btn ghost" data-close="1">Close</button>`
        : `<button class="btn ghost" data-close="1">Need ${g.cost} cr</button>`}</div>`;
  $('fbg').innerHTML = bokehLayer(['#4de8ff', '#5dffa0', '#9d6bff']);
  $('focus').classList.add('on');
  wireFocus();
}

/** The enlarged team-lead view: the dossier, both perks, and the same
 * assign/recruit actions the tiles used to carry inline. `ctx` names the
 * surface the popup opened from ('squad' | 'shop' | 'ops') so the follow-up
 * can fold and re-render the right roster. */
export function focusLead(k, ctx) {
  const L = LEADS[k];
  if (!L) return;
  const def = L.stratagem ? STRATAGEMS[L.stratagem] : null;
  const open = leadUnlocked(k);
  const assigned = ((active.lead && LEADS[active.lead]) ? active.lead : 'ironbrand') === k;
  const price = leadPrice(k);
  const affordable = active.progress.credits >= price;
  const close = '<button class="btn ghost" data-close="1">Close</button>';

  const acts = assigned ? '<button class="btn ghost" data-close="1">Assigned — close</button>'
    : open ? `<button class="btn" data-fassign="${k}" data-fctx="${ctx}">Assign lead</button>${close}`
      : affordable ? `<button class="btn gold" data-frecruit="${k}" data-fctx="${ctx}">Recruit · ${price} cr</button>${close}`
        : `<button class="btn ghost" data-close="1">Need ${price} cr</button>`;

  $('fwrap').innerHTML = `<div class="fcard flead" style="border-color:${L.col}">
      <div class="fart">${portrait(k)}</div>
      <div class="fname" style="color:${L.col}">${open ? '' : '🔒 '}${L.call}</div>
      <div class="ftype">${L.role} · ${L.n}</div>
      <div class="ftxt">${L.bio}</div>
      ${L.passive ? `<div class="fab"><b>Passive · ${L.passive.n}</b>${L.passive.d}</div>` : ''}
      ${def ? `<div class="fab"><b>Stratagem · ${def.n} · ${def.dp} DP</b>${def.d} Once per mission; ${def.now ? 'lands at the end of the turn you call it' : 'resolves at the start of the following turn'}.</div>` : ''}
      <div class="fstats"><div class="fstat"><span class="k">Status</span>
        <span class="v">${assigned ? 'Assigned' : open ? 'On the roster' : leadGateText(k)}</span></div></div>
    </div><div class="facts">${acts}</div>`;
  $('fbg').innerHTML = bokehLayer([L.col, '#9d6bff', '#4de8ff']);
  $('focus').classList.add('on');
  wireFocus();
}

const each = (attrName, fn) =>
  document.querySelectorAll('#fwrap [' + attrName + ']').forEach(b => { b.onclick = () => fn(b); });

/** Filters the visible gear role's chips by whatever the search box holds. */
function filterGear() {
  const q = ($('fwrap').querySelector('[data-gsearch]')?.value || '').trim().toLowerCase();
  document.querySelectorAll('#fwrap [data-gname]').forEach(chip => {
    chip.style.display = !q || chip.dataset.gname.includes(q) ? '' : 'none';
  });
}

function wireFocus() {
  each('data-close', () => closeFocus());

  // The Pilot's callsign: save, then repaint the popup so the new name is on
  // the card face immediately. An empty field restores "Frame Pilot".
  each('data-pname', () => {
    const input = $('fwrap').querySelector('#pnamein');
    if (!input) return;
    setPilotName(input.value);
    commit();
    const pid = Object.keys(POOL).find(c => POOL[c].pilot);
    if (pid) focusCard(pid, $('fwrap').dataset.fmode || 'deck');
  });

  each('data-groletab', b => {
    document.querySelectorAll('#fwrap [data-groletab]').forEach(x => x.classList.toggle('on', x === b));
    document.querySelectorAll('#fwrap [data-grole]').forEach(g =>
      g.classList.toggle('show', g.dataset.grole === b.dataset.groletab));
    const search = $('fwrap').querySelector('[data-gsearch]');
    if (search) search.value = '';
    filterGear();
  });

  const gearSearch = $('fwrap').querySelector('[data-gsearch]');
  if (gearSearch) gearSearch.oninput = filterGear;

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
    if (active.unlocks.gear.includes(gi) || active.progress.credits < g.cost) return;
    active.progress.credits -= g.cost;
    active.unlocks.gear.push(gi);
    commit();
    closeFocus();
    onAfterFocusAction('quartermaster');
  });

  each('data-fassign', b => {
    const k = b.dataset.fassign;
    if (!leadUnlocked(k)) return;
    active.lead = k;
    commit();
    closeFocus();
    onLeadDone(b.dataset.fctx, 'assign');
  });

  each('data-frecruit', b => {
    const k = b.dataset.frecruit;
    const price = leadPrice(k);
    if (leadUnlocked(k) || active.progress.credits < price) return;
    active.progress.credits -= price;
    active.unlocks.leads.push(k);
    commit();
    closeFocus();
    notify('Aboard', `<b style="color:var(--zan)">${LEADS[k].call}</b> has joined the task force. Assign them from their card.`);
    onLeadDone(b.dataset.fctx, 'recruit');
  });

  // Fitting from the piece's side. Same assignment as data-fitgear, arguments
  // the other way round, and it stays on the piece so you can see where it
  // landed instead of being thrown back to the roster.
  // The picker folds. `hidden` is avoided on purpose: the stub DOM the guards
  // run against does not honour it, and a class keeps the rows in the markup
  // either way so the tests can still read them.
  each('data-gtoggle', b => {
    const list = $('fwrap').querySelector('[data-gfold]');
    if (!list) return;
    const open = !list.classList.contains('open');
    list.classList.toggle('open', open);
    b.setAttribute('aria-expanded', open ? 'true' : 'false');
    const car = b.querySelector('.gcar');
    if (car) car.textContent = open ? '\u25b4' : '\u25be';
  });

  each('data-wear', b => {
    const [gi, cid] = b.dataset.wear.split(':');
    if (cid !== 'none' && !gearFits(cid, gi)) return;
    const was = gearWearer(gi);
    // Tapping the card it is already on is a no-op, not a silent strip — the
    // Strip button below the list is the one control that takes gear off.
    if (was === cid) return;
    if (was) delete active.loadout.gear[was];
    if (cid !== 'none') active.loadout.gear[cid] = gi;
    commit();
    onAfterFocusAction('squad', true);
    focusGear(gi, false, true);
  });

  each('data-fitgear', b => {
    const [id, gi] = b.dataset.fitgear.split(':');
    // The lists are already filtered; this is the rule itself, enforced where
    // the assignment actually happens rather than only where it is offered.
    if (gi !== 'none' && !gearFits(id, gi)) return;
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

  each('data-fframe', b => {
    const id = b.dataset.fframe;
    active.loadout.frame = id === 'none' ? null : id;
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
