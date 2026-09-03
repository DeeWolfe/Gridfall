// The four hold panels — Squad, Quartermaster, Database, Service Record —
// plus Settings. Each is a function returning markup; openPanel() drops it in
// and re-wires the delegated handlers.

import {POOL} from '../content/cards.js';
import {GEAR} from '../content/gear.js';
import {BEST} from '../content/hostiles.js';
import {OPS} from '../content/operations.js';
import {TIERNAME, RANKS} from '../content/ranks.js';
import {LEADS} from '../content/leads.js';
import {active, profiles, setActive} from '../state/session.js';
import {store} from '../save/store.js';
import {commit, migrate, saveAll} from '../save/profile.js';
import {rankName, costOf, vetOf, leadUnlocked, deckCapOf, leadBan, leadOf, deckProblems} from '../save/progression.js';
import {genRun} from '../rules/run.js';
import {purchasePack, PACK_PRICE} from '../rules/packs.js';
import {$, attr, show, markSwipe} from './dom.js';
import {sigil} from './art.js';
import {ask, notify} from './dialog.js';
import {cardEl} from './card-html.js';
import {unitSprite, SCHEMES} from './sprites.js';
import {focusCard, focusEnemy, focusGear, focusLead} from './focus.js';
import {leadCardHTML, leadTilesHTML, toggleRoster, paintHold, enter} from './hold.js';
import {renderSlots} from './boot-screen.js';
import {stopScene} from './battlefield.js';
import {showPack, setAfterPacks} from './packs.js';
import {soundOn, toggleSound} from './sound.js';
import {musicOn, toggleMusic} from './music.js';
import {UI_MODES, UI_LABELS, uiPreference, uiModeLabel, setUiMode} from './uimode.js';
import {maybeShowPanelHint} from './panel-hints.js';
import {replayIntros} from './codec.js';

const TIERS = ['common', 'special', 'tech'];
let dbTab = 'cards';
let squadTab = 'deck';
let recTab = 'field';

const cardGrid = (ids, mode) => `<div class="cgrid">${ids.map(c => cardEl(c, mode)).join('')}</div>`;

// An empty state has to span the grid, or it wraps inside one card column.
const cardGridEmpty = text => `<div class="cgrid"><div class="cempty">${text}</div></div>`;

/**
 * How the Squad reserve is arranged. Both choices are the player's and both are
 * remembered on the profile: a commander who thinks in classes should not have
 * to re-say so every time they open the panel.
 *
 * Only the RESERVE sorts. The active deck is twelve cards you chose one at a
 * time and it is the thing you learn the position of — rearranging that on a
 * preference is taking something away, not adding one. The reserve is the pile
 * you hunt through, and the pile that grows to fifty.
 *
 * "Level" is veteran rank first, then deployments inside a rank, so the two
 * Elites sort by which one has actually done the work.
 */
const SQUAD_SORTS = [
  ['name', 'A–Z'],
  ['level', 'Level'],
  ['cost', 'Cost'],
  ['gear', 'Geared'],
];

const squadPref = key => (active.settings && active.settings[key]) || null;

const squadSort = () => squadPref('squadSort') || 'name';
// Split by class the way the Quartermaster shelf does, which is where players
// learned the pool in the first place.
const squadGroup = () => squadPref('squadGroup') !== 'flat';

function sortCards(ids) {
  const by = squadSort();
  return [...ids].sort((a, b) => {
    if (by === 'cost') return costOf(a) - costOf(b) || POOL[a].n.localeCompare(POOL[b].n);
    if (by === 'level') {
      const va = vetOf(a); const vb = vetOf(b);
      return vb.t - va.t || vb.u - va.u || POOL[a].n.localeCompare(POOL[b].n);
    }
    if (by === 'gear') {
      // Geared first, then alphabetical inside each half — the point of this
      // one is to see at a glance which cards are still carrying nothing.
      const ga = active.loadout.gear[a] ? 0 : 1;
      const gb = active.loadout.gear[b] ? 0 : 1;
      return ga - gb || POOL[a].n.localeCompare(POOL[b].n);
    }
    return POOL[a].n.localeCompare(POOL[b].n);
  });
}

/** The reserve: one grid, or one grid per class with its own subheading. */
function reserveCards(ids) {
  if (!ids.length) return cardGridEmpty('Nothing in reserve.');
  if (!squadGroup()) return cardGrid(sortCards(ids), 'gear');
  const sub = (label, list) => (list.length
    ? `<div class="subsect">${label} <span class="ct">${list.length}</span></div>` + cardGrid(list, 'gear')
    : '');
  return TIERS.map(t => {
    const inTier = ids.filter(c => POOL[c].t === t);
    if (!inTier.length) return '';
    // Tech splits in two: field tech, and the Frame kits that only ever bolt
    // onto a machine — different shopping lists, different shelves.
    if (t === 'tech') {
      const kit = c => POOL[c].frameGear || POOL[c].fits;
      return sub(TIERNAME.tech, sortCards(inTier.filter(c => !kit(c))))
        + sub('Kit Tech', sortCards(inTier.filter(kit)));
    }
    return sub(TIERNAME[t], sortCards(inTier));
  }).join('');
}

const squadControls = () => `<div class="orgbar">
   <span class="orglab">Sort</span>
   <span class="orgset">${SQUAD_SORTS.map(([k, label]) =>
    `<button class="mini${squadSort() === k ? ' on' : ''}" data-sqsort="${k}">${label}</button>`).join('')}</span>
   <span class="orglab">Split</span>
   <span class="orgset">
     <button class="mini${squadGroup() ? ' on' : ''}" data-sqgroup="class">By class</button>
     <button class="mini${squadGroup() ? '' : ' on'}" data-sqgroup="flat">One list</button></span></div>`;

/**
 * The gear locker: the same tile the Quartermaster shelf and the card grids
 * use, so a piece of gear looks like a piece of gear everywhere in the game.
 * The footer answers the question the locker exists for — which card is
 * carrying it — and a tap opens the piece to change that.
 */
function gearLocker() {
  const owned = active.unlocks.gear;
  if (!owned.length) {
    return `<div class="sect" style="color:var(--cyan)">Gear locker</div>
     <div class="stub"><b>Nothing issued</b>Gear is bought from the Quartermaster.
       One piece per card, one copy of each piece.</div>`;
  }
  const fitted = Object.keys(active.loadout.gear).length;
  const tiles = owned.map(gi => {
    const g = GEAR[gi];
    const on = Object.keys(active.loadout.gear).find(k => active.loadout.gear[k] === gi);
    return `<button class="gcard t-tech${on ? ' indeck' : ''}" data-gearfit="${gi}"
       title="${attr(g.n + '\n' + g.d + (on ? '\nFitted to ' + POOL[on].n : '\nNot fitted'))}">
       <div class="inkmark">${sigil(gi, 'tech')}</div>
       <div class="tn">${g.n}</div>
       <div class="gfoot ${on ? 'own' : 'add'}">${on ? POOL[on].n : 'Fit'}</div></button>`;
  }).join('');
  return `<div class="sect" style="color:var(--cyan)">Gear locker — ${fitted} of ${owned.length} fitted</div>
   <div class="bar"><div>Tap a piece to read it and choose which card carries it</div>
     <div style="color:var(--dim);font-size:0.6875rem">One slot per card · one copy of each piece</div></div>
   <div class="cgrid">${tiles}</div>`;
}

/**
 * The Frame you are actually taking, shown with the deck it deploys alongside.
 *
 * One tile, the equipped one, hanging off the bottom of the Active deck on a
 * violet rail: the rail says "attached to this", the gap above says "not one of
 * the twelve". Deliberately NOT the collection — a row of three prototypes
 * beside your deck answers "what could I take", and the only question the deck
 * screen should be answering there is "what am I taking".
 *
 * Choosing between them is a different job and lives in its own section below.
 */
function deckFrame() {
  const fielded = active.loadout.frame;
  const owned = active.unlocks.cards.filter(c => POOL[c].chassis === 'proto');
  const head = `<div class="slothead">Proto Frame
     <span class="ct">${fielded ? 1 : 0} / 1</span></div>`;
  if (!fielded) {
    return `<div class="frameslot">${head}
     <div class="framehint">${owned.length
      ? 'Nothing fielded — pick one in the Proto Frame slot below.'
      : 'No prototype on strength. The Quartermaster carries them.'}</div></div>`;
  }
  return `<div class="frameslot">${head}
   ${cardGrid([fielded], 'proto')}
   <div class="framehint">Seeded into your opening hand — outside the deck, one on the board at a time.</div></div>`;
}

/**
 * The Proto Frame picker: every prototype on strength, fielded one first.
 * Its own section because choosing one is its own decision, and because it is
 * a shelf rather than a loadout — the deck screen above already says which one
 * is going with you.
 */
function frameSlot() {
  const owned = active.unlocks.cards.filter(c => POOL[c].chassis === 'proto');
  const all = Object.keys(POOL).filter(c => POOL[c].chassis === 'proto');
  const fielded = active.loadout.frame;
  if (!owned.length) {
    return `<div class="sect" style="color:var(--violet)">Proto Frame slot</div>
     <div class="stub"><b>No prototype on strength</b>${all.length} Proto Frames exist.
       The fielded one is seeded straight into your opening hand — outside the
       deck and its size — and its gear cards ride inside the deck.</div>`;
  }
  // Fielded first: the answer, then what you could swap it for.
  const order = [...owned].sort((a, b) => (b === fielded ? 1 : 0) - (a === fielded ? 1 : 0)
    || POOL[a].n.localeCompare(POOL[b].n));
  return `<div class="sect" style="color:var(--violet)">Proto Frame slot — ${fielded ? POOL[fielded].n : 'empty'}</div>
   <div class="bar"><div>Seeded into your opening hand — one Frame on the board at a time</div>
     <div style="color:var(--dim);font-size:0.6875rem">Tap to field it; its gear cards go in the deck</div></div>
   ${cardGrid(order, 'proto')}`;
}

function squadPanel() {
  const deck = active.loadout.deck;
  // Proto Frames live in their own slot and never in the twelve, so they are
  // filtered out of both grids rather than competing for a deck place.
  const reserve = active.unlocks.cards.filter(c => !deck.includes(c) && POOL[c].chassis !== 'proto');
  // A Frame with no Pilot in the deck is a dead slot, and the deck screen is
  // the only place that can say so before the mission starts. Cheap to check,
  // and the alternative is finding out on the board with six DP spent.
  const fielded = active.loadout.frame;
  // Gear whose Frame is not the fielded one is a blank card for the whole
  // mission — say so here, before the mission finds out.
  // A kit is stranded when its host is not coming: a Frame kit whose Frame
  // is not in the slot, a Fireteam kit with no Fireteam in the twelve.
  const strays = deck.filter(c => (POOL[c].frameGear && (POOL[POOL[c].frameGear].chassis === 'proto'
    ? POOL[c].frameGear !== fielded : !deck.includes(POOL[c].frameGear)))
    || (POOL[c].fits && !deck.some(d => POOL[d].line === POOL[c].fits)));
  const orphan = strays.length
    ? `<div class="bar"><div style="color:var(--gold)"><b style="color:var(--gold)">⚠</b>
        ${strays.map(c => POOL[c].n).join(', ')} — ${strays.length > 1 ? 'their Frames are' : 'its Frame is'} not coming</div>
        <div style="color:var(--dim);font-size:0.6875rem">A kit is dead in hand unless the body it fits is on the board</div></div>`
    : '';
  // A deck that breaks the active lead's rules must be obvious HERE, at the
  // build table — not discovered as a dead card at deploy or a refusal at
  // the launch door.
  const over = deck.length > deckCapOf()
    ? `<div class="bar"><div style="color:var(--red)"><b style="color:var(--red)">⚠</b>
        ${leadOf().call} fields at most ${deckCapOf()} cards — trim ${deck.length - deckCapOf()} to deploy</div></div>`
    : '';
  const rules = deckProblems(deck, fielded).map(p =>
    `<div class="bar"><div style="color:var(--red)"><b style="color:var(--red)">⚠</b> ${p.n}</div>
        <div style="color:var(--dim);font-size:0.6875rem">${p.d}</div></div>`).join('');
  const banned = deck.filter(c => leadBan(c));
  const refused = banned.length
    ? `<div class="bar"><div style="color:var(--red)"><b style="color:var(--red)">⚠</b>
        ${leadOf().call} will not field ${banned.map(c => POOL[c].n).join(', ')}</div>
        <div style="color:var(--dim);font-size:0.6875rem">${leadOf().con.n} — these stay dead in hand until you swap them or the lead</div></div>`
    : '';
  const tabs = `<div class="tabs">
     <button class="tab${squadTab === 'deck' ? ' on' : ''}" data-sqtab="deck">Deck</button>
     <button class="tab${squadTab === 'saved' ? ' on' : ''}" data-sqtab="saved">Saved decks${(active.presets || []).length ? ` · ${active.presets.length}` : ''}</button></div>`;
  if (squadTab === 'saved') {
    return `<div class="sect">Team lead — answers to you</div>${leadCardHTML()}
   ${leadTilesHTML('squad')}${tabs}${savedDecksTab()}`;
  }
  return `<div class="sect">Team lead — answers to you</div>${leadCardHTML()}
   ${leadTilesHTML('squad')}${tabs}
   <div class="sect">Deck</div>
   <div class="bar"><div><b${deck.length > deckCapOf() ? ' style="color:var(--red)"' : ''}>${deck.length}</b> / ${deckCapOf()} in deck ·
       <b style="color:var(--cyan)">${Object.keys(active.loadout.gear).length}</b> geared ·
       <b style="color:var(--violet)">${fielded ? 1 : 0}</b> / 1 Proto Frame</div>
     <div style="color:var(--dim);font-size:0.6875rem">Tap any card to enlarge it — inspect, fit gear, add or remove</div></div>
   ${orphan}${over}${rules}${refused}
   <div class="sect">Active deck</div>
   ${deck.length ? cardGrid(deck, 'gear') : cardGridEmpty('Empty.')}
   ${deckFrame()}
   <div class="sect">Reserve — ${reserve.length}</div>
   ${squadControls()}
   ${reserveCards(reserve)}
   ${frameSlot()}
   ${gearLocker()}`;
}

/**
 * Saved decks — its own tab beside Deck. A preset is the twelve plus the
 * Frame slot under a name: a Fireteam deck, a Frame deck, a gun line,
 * swapped in with one tap. Cards the profile no longer owns are dropped on
 * load rather than refused, and a loaded deck is checked against the same
 * rules the Deck tab warns about.
 */
const PRESET_CAP = 6;
function savedDecksTab() {
  const list = active.presets || [];
  const deck = active.loadout.deck;
  const live = p => p.deck.length === deck.length && p.deck.every(c => deck.includes(c)) && (p.frame || null) === (active.loadout.frame || null);
  const lineOf = p => p.deck.some(c => POOL[c] && POOL[c].line === 'fireteam') ? 'Fireteam line'
    : p.frame && POOL[p.frame] ? `Frame line · ${POOL[p.frame].n}` : '';
  const rows = list.map((p, i) => {
    const names = p.deck.filter(c => POOL[c]).map(c => POOL[c].n).join(' · ');
    const probs = deckProblems(p.deck, p.frame);
    return `<div class="bar preset${live(p) ? ' on' : ''}">
      <div><b style="color:var(--gold)">${p.n}</b> <span style="color:var(--dim)">· ${p.deck.length} cards${lineOf(p) ? ' · ' + lineOf(p) : ''}${live(p) ? ' · <span style="color:var(--green)">active</span>' : ''}</span></div>
      <div style="color:var(--dim);font-size:0.6875rem">${names || 'Empty.'}</div>
      ${probs.length ? `<div style="color:var(--red);font-size:0.6875rem">⚠ ${probs[0].n}</div>` : ''}
      <div class="presets"><button class="mini" data-preset-load="${i}">Load</button><button class="mini x" data-preset-del="${i}">Delete</button></div></div>`;
  }).join('');
  return `<div class="sect">Saved decks — ${list.length} / ${PRESET_CAP}</div>
   ${rows || '<div class="bar"><div style="color:var(--dim)">None yet. Build a deck on the Deck tab, then save it here.</div></div>'}
   <div class="bar presets">${list.length < PRESET_CAP && deck.length
    ? '<button class="mini gold" data-preset-save>Save current deck</button>'
    : `<span style="color:var(--dim)">${deck.length ? 'Six is the shelf. Delete one to save another.' : 'The active deck is empty.'}</span>`}</div>`;
}

function quartermasterPanel() {
  const tier = t => `<div class="sect">${TIERNAME[t]}</div>` +
    cardGrid(Object.keys(POOL).filter(c => POOL[c].t === t), 'shop');

  // Frame weapons are shelved separately and say which Frame they need. A
  // Beam Saber bought without a White Devil is a wasted 480 credits, and the
  // shop is the last place that can say so before the money is gone.
  const gearTile = gi => {
    const g = GEAR[gi];
    const owned = active.unlocks.gear.includes(gi);
    const affordable = active.progress.credits >= g.cost;
    const needsFrame = (g.frame && !active.unlocks.cards.includes(g.frame))
      || (g.fits && !active.unlocks.cards.some(c => POOL[c] && POOL[c].line === g.fits));
    const foot = owned ? '<div class="gfoot own">Owned</div>'
      : needsFrame ? `<div class="gfoot no">Needs ${g.frame ? POOL[g.frame].n : 'a Fireteam'}</div>`
        : `<div class="gfoot ${affordable ? 'buy' : 'no'}">${g.cost} cr</div>`;
    return `<button class="gcard t-tech${owned ? ' owned' : (affordable && !needsFrame) ? '' : ' cant'}" data-gear="${gi}"
       title="${attr(g.n + ' — ' + g.cost + ' cr\n' + g.d +
         (g.frame ? '\nFits the ' + POOL[g.frame].n + ' and nothing else.' : g.fits ? '\nFits any Fireteam and nothing else.' : ''))}">
       <div class="inkmark">${sigil(gi, 'tech')}</div>
       <div class="tn">${g.n}</div>${foot}</button>`;
  };
  const general = Object.keys(GEAR).filter(gi => !GEAR[gi].frame && !GEAR[gi].fits);
  const frameGear = Object.keys(GEAR).filter(gi => GEAR[gi].frame);
  const lineGear = Object.keys(GEAR).filter(gi => GEAR[gi].fits);
  const gearGrid = `<div class="sect" style="color:var(--cyan)">Gear</div>
     <div class="cgrid">${general.map(gearTile).join('')}</div>` +
    (frameGear.length ? `<div class="sect" style="color:var(--violet)">Frame weapons</div>
     <div class="bar"><div>Each one fits a single Frame and replaces its service weapon</div>
       <div style="color:var(--dim);font-size:0.6875rem">Buy the Frame first — a weapon with no Frame does nothing</div></div>
     <div class="cgrid">${frameGear.map(gearTile).join('')}</div>` : '') +
    (lineGear.length ? `<div class="sect" style="color:var(--violet)">Fireteam weapons</div>
     <div class="bar"><div>Each one fits any Fireteam and replaces the team's own gun — chosen at the hold, carried all mission</div>
       <div style="color:var(--dim);font-size:0.6875rem">One gear per card: a team with a weapon carries nothing else from the armoury</div></div>
     <div class="cgrid">${lineGear.map(gearTile).join('')}</div>` : '');

  const schemeGrid = `<div class="sect" style="color:var(--gold)">Uniforms</div>
     <div class="cgrid">${Object.keys(SCHEMES).map(k => {
       const sc = SCHEMES[k];
       const owned = active.unlocks.schemes.includes(k);
       const applied = (active.loadout.scheme || 'standard') === k;
       const affordable = active.progress.credits >= sc.price;
       const foot = applied ? '<div class="gfoot own">Applied</div>'
         : owned ? '<div class="gfoot add">Tap to apply</div>'
           : `<div class="gfoot ${affordable ? 'buy' : 'no'}">${sc.price} cr</div>`;
       return `<button class="gcard t-common${applied ? ' indeck' : ''}${!owned && !affordable ? ' cant' : ''}" data-scheme="${k}"
         title="${attr(sc.n + ' — a field-plate recolour for every soldier on the grid.')}">
         <div class="swpre">${unitSprite('rifle', 0, k)}</div>
         <div class="tn">${sc.n}</div>${foot}</button>`;
     }).join('')}</div>`;

  const canBuyPack = active.progress.credits >= PACK_PRICE;
  return `<div class="bar"><div>Credits <b>${active.progress.credits}</b></div>
     <div style="color:var(--dim);font-size:0.6875rem">Tap a card to enlarge and buy. Cards, gear and uniforms all spend the same credits.</div></div>
   <div class="bar"><div><b>Requisition drop</b>
     <div style="color:var(--dim);font-size:0.6875rem;margin-top:3px">Three offers, keep one — duplicates promote the card instead. Now and then one arrives as a priority requisition.</div></div>
     <button class="btn${canBuyPack ? '' : ' ghost'}" id="buypack"${canBuyPack ? '' : ' disabled'}>Buy pack · ${PACK_PRICE} cr</button></div>
   ${TIERS.map(tier).join('')}
   ${gearGrid}
   ${schemeGrid}
   <div class="sect">Team leads</div>${leadTilesHTML('shop')}`;
}

const dbTabs = () => `<div class="tabs">
     <button class="tab${dbTab === 'cards' ? ' on' : ''}" data-tab="cards">Assets</button>
     <button class="tab${dbTab === 'gear' ? ' on' : ''}" data-tab="gear">Gear</button>
     <button class="tab${dbTab === 'foes' ? ' on' : ''}" data-tab="foes">Hostiles</button></div>`;

// One entry in a Database list. Assets, Gear and Hostiles all read the same
// way: name, what it does, and the one number that matters on the right.
const dbRow = ({label, body, right, hot, locked, attrs}) =>
  `<div class="row${locked ? ' locked' : ''}"${attrs || ''} style="cursor:pointer">
     <span><b style="color:${locked ? 'var(--dim)' : 'var(--zan)'}">${label}</b>
     <div style="font-size:0.6562rem;color:var(--dim);margin-top:4px;line-height:1.5">${body}</div></span>
     <span class="r${hot ? ' hot' : ''}">${right}</span></div>`;

function databasePanel() {
  if (dbTab === 'cards') {
    const tier = t => {
      const ids = Object.keys(POOL).filter(c => POOL[c].t === t);
      const owned = ids.filter(i => active.unlocks.cards.includes(i)).length;
      const rows = ids.map(id => {
        const k = POOL[id];
        const has = active.unlocks.cards.includes(id);
        return dbRow({
          label: k.n,
          body: k.d,
          right: has ? `${costOf(id)} DP${k.hp ? ' · ' + k.hp + ' hull' : ''}` : `${k.price} cr`,
          hot: !has,
          attrs: ` data-focus="${id}" data-mode="info"`,
        });
      }).join('');
      return `<div class="sect">${TIERNAME[t]} — ${owned}/${ids.length} owned</div>` +
        `<div class="rows">${rows}</div>`;
    };
    return `<div class="bar"><div>Assets on file <b>${Object.keys(POOL).length}</b></div>
       <div style="color:var(--dim);font-size:0.6875rem">Every entry is a fireteam, not a soldier · tap one to enlarge</div></div>${dbTabs()}
       ${TIERS.map(tier).join('')}`;
  }

  if (dbTab === 'gear') {
    const rows = Object.keys(GEAR).map(gi => {
      const g = GEAR[gi];
      const owned = active.unlocks.gear.includes(gi);
      const fittedTo = Object.keys(active.loadout.gear).find(k => active.loadout.gear[k] === gi);
      return dbRow({
        label: g.n,
        body: g.d + (fittedTo ? ` · fitted to ${POOL[fittedTo].n}` : ''),
        right: owned ? 'Owned' : g.cost + ' cr',
        hot: !owned,
        attrs: ` data-gear="${gi}"`,
      });
    }).join('');
    return `<div class="bar"><div>Gear on file <b>${Object.keys(GEAR).length}</b></div>
     <div style="color:var(--dim);font-size:0.6875rem">One slot per card, bought with credits</div></div>${dbTabs()}
     <div class="sect">Field gear</div><div class="rows">${rows}</div>`;
  }

  const seen = active.unlocks.enemies;
  const tier = t => {
    const ids = Object.keys(BEST).filter(k => BEST[k].t === t);
    const rows = ids.map(k => {
      const b = BEST[k];
      const on = seen.includes(k);
      return dbRow({
        label: on ? b.n : '████████',
        body: on ? b.d : 'No contact logged.',
        right: on ? `${b.hp} hull · threat ${b.threat}` : '—',
        locked: !on,
        attrs: on ? ` data-foe="${k}"` : '',
      });
    }).join('');
    return `<div class="sect">${TIERNAME[t]} — ${ids.filter(k => seen.includes(k)).length}/${ids.length}</div>
     <div class="rows">${rows}</div>`;
  };
  return `<div class="bar"><div>Hostiles logged <b>${seen.length}</b> / ${Object.keys(BEST).length}</div>
     <div style="color:var(--dim);font-size:0.6875rem">Entries unlock on first kill</div></div>${dbTabs()}
     ${TIERS.map(tier).join('')}`;
}

/** Achievements are pure functions of the profile — nothing new is tracked,
 * so they can never desync from the record they sit beside. That constraint is
 * also the design rule: if an achievement cannot be computed from what the save
 * already holds, it does not get added, because a counter added for a badge is
 * a counter that will one day disagree with the badge. */
function achievementList() {
  const s = active.stats;
  const opsDone = Object.values(OPS).filter(o => {
    const r = active.ops[o.k];
    return r && r.cleared.length >= o.nodes.length;
  }).length;
  const vets = Object.keys(active.usage || {}).map(id => vetOf(id).t);
  const maxVet = Math.max(0, ...vets);
  const daily = active.daily || {streak: 0};
  const deck = active.loadout.deck;
  const gearedInDeck = deck.filter(c => active.loadout.gear[c]).length;
  // "No breach yet" is not a stored flag, it is the absence of one: progress
  // reads as deployments while the breach count is nil and collapses to zero
  // the moment a lane opens, which is exactly what the badge means.
  const clean = s.breaches === 0 ? s.deployments : 0;

  // The newer classes read straight out of usage and unlocks, same rule:
  // Frames and their kits, command calls, the board-control cards.
  const usage = active.usage || {};
  const protos = Object.keys(POOL).filter(c => POOL[c].chassis === 'proto');
  const framesFlown = protos.filter(c => (usage[c] || 0) > 0).length;
  const frameSorties = protos.reduce((a, c) => a + (usage[c] || 0), 0);
  const gearIds = Object.keys(POOL).filter(c => POOL[c].frameGear);
  const gearFitted = gearIds.reduce((a, c) => a + (usage[c] || 0), 0);
  const hosts = [...new Set(gearIds.map(c => POOL[c].frameGear))];
  const kitDone = hosts.some(f => gearIds.filter(c => POOL[c].frameGear === f)
    .every(c => active.unlocks.cards.includes(c))) ? 1 : 0;
  const callIds = Object.keys(POOL).filter(c => POOL[c].strat);
  const callsMade = callIds.reduce((a, c) => a + (usage[c] || 0), 0);
  const callsDistinct = callIds.filter(c => (usage[c] || 0) > 0).length;
  const fieldKit = ['demo', 'cryo', 'crystal', 'volt']
    .filter(c => active.unlocks.cards.includes(c)).length;

  return [
    {n: 'First Strike', d: 'Secure your first objective.', have: s.held, need: 1},
    {n: 'Line Holder', d: 'Secure ten objectives.', have: s.held, need: 10},
    {n: 'Iron Wall', d: 'Secure twenty-five objectives.', have: s.held, need: 25},
    {n: 'Long War', d: 'Deploy on a hundred missions.', have: s.deployments, need: 100},
    {n: 'Exterminator', d: 'Destroy 100 hostiles.', have: s.kills, need: 100},
    {n: 'Annihilator', d: 'Destroy 1,000 hostiles.', have: s.kills, need: 1000},
    {n: 'Not One Step', d: 'Reach twenty-five deployments having never allowed a breach.',
      have: clean, need: 25},
    {n: 'Zero Ground', d: 'Clear every node of one operation.', have: opsDone, need: 1},
    {n: 'Theatre Commander', d: 'Clear every operation on the shelf.', have: opsDone, need: Object.keys(OPS).length},
    {n: 'Sworn Officer', d: 'Reach rank 5.', have: active.progress.rank, need: 5},
    {n: 'Marshal', d: `Reach the top of the ladder — ${RANKS[RANKS.length - 1]}.`,
      have: active.progress.rank, need: RANKS.length},
    {n: 'Living Legend', d: 'Raise any card to Legend rank.', have: maxVet, need: 3},
    {n: 'Veteran Corps', d: 'Raise five cards to Veteran rank or better.',
      have: vets.filter(t => t >= 1).length, need: 5},
    {n: 'Full Manifest', d: 'Own every card in the pool.', have: active.unlocks.cards.length, need: Object.keys(POOL).length},
    {n: 'Armourer', d: 'Own every piece of gear.', have: active.unlocks.gear.length, need: Object.keys(GEAR).length},
    {n: 'Well Found', d: 'Field a deck with eight cards carrying gear at once.',
      have: gearedInDeck, need: 8},
    {n: 'Colours Flying', d: 'Own every uniform in the Quartermaster.',
      have: (active.unlocks.schemes || []).length, need: Object.keys(SCHEMES).length},
    {n: 'Head-hunter', d: 'Recruit every team lead.', have: Object.keys(LEADS).filter(leadUnlocked).length, need: Object.keys(LEADS).length},
    {n: 'Bestiary', d: 'Log every hostile in the Database.', have: active.unlocks.enemies.length, need: Object.keys(BEST).length},
    {n: 'Stormbreaker', d: 'Hold ten waves in one Onslaught.', have: active.bests.onslaught || 0, need: 10},
    {n: 'Deep Water', d: 'Hold twenty-five waves in one Onslaught.', have: active.bests.onslaught || 0, need: 25},
    {n: 'Chainrunner', d: 'Complete a Gauntlet chain.', have: active.bests.gauntlet || 0, need: 1},
    {n: 'Chain of Command', d: 'Complete five Gauntlet chains.', have: active.bests.gauntlet || 0, need: 5},
    {n: 'Standing Order', d: 'Carry a seven-day Daily Challenge streak.',
      have: daily.streak || 0, need: 7},
    {n: 'Machine Spirit', d: 'Field a Proto Frame for the first time.', have: frameSorties, need: 1},
    {n: 'Rollout Complete', d: 'Field all three Proto Frames at least once.', have: framesFlown, need: 3},
    {n: 'Ace of the Line', d: 'Fly twenty-five Frame sorties.', have: frameSorties, need: 25},
    {n: 'Closed Kit', d: 'Own every gear card of one Frame\'s kit.', have: kitDone, need: 1},
    {n: 'Gunsmith', d: 'Fit Frame gear fifteen times.', have: gearFitted, need: 15},
    {n: 'Fire Mission', d: 'Arm your first command call.', have: callsMade, need: 1},
    {n: 'Full Spectrum', d: 'Play every command call at least once.', have: callsDistinct, need: callIds.length},
    {n: 'Ground Writer', d: 'Own the whole board-control kit — Demo Charge, Cryo Projector, Resonance Lens, Field Degausser.',
      have: fieldKit, need: 4},
  ];
}

const recTabs = () => `<div class="tabs">
     <button class="tab${recTab === 'field' ? ' on' : ''}" data-rectab="field">Record</button>
     <button class="tab${recTab === 'ach' ? ' on' : ''}" data-rectab="ach">Achievements</button>
     <button class="tab${recTab === 'vets' ? ' on' : ''}" data-rectab="vets">Veterans</button>
     <button class="tab${recTab === 'ops' ? ' on' : ''}" data-rectab="ops">Operations</button></div>`;

function recordPanel() {
  const s = active.stats;
  const bar = `<div class="bar"><div>${active.callsign} · <b style="color:var(--zan)">${rankName(active.progress.rank)}</b></div>
     <div style="color:var(--dim);font-size:0.6875rem">Task force command · XP ${active.progress.xp}</div></div>${recTabs()}`;

  if (recTab === 'ach') {
    const list = achievementList();
    return bar + `<div class="sect">Achievements — ${list.filter(a => a.have >= a.need).length} / ${list.length} earned</div>
   <div class="rows">${list.map(a => {
      const done = a.have >= a.need;
      return `<div class="row${done ? '' : ' locked'}"><span><b style="color:${done ? 'var(--gold)' : 'var(--dim)'}">${done ? '◆' : '◇'} ${a.n}</b>
     <div style="font-size:0.6562rem;color:var(--dim);margin-top:4px">${a.d}</div></span>
     <span class="r${done ? ' hot' : ''}">${done ? 'Earned' : Math.min(a.have, a.need) + ' / ' + a.need}</span></div>`;
    }).join('')}</div>`;
  }

  if (recTab === 'vets') {
    const veterans = Object.keys(active.usage || {})
      .sort((a, b) => active.usage[b] - active.usage[a]).slice(0, 8)
      .map(id => {
        const v = vetOf(id);
        return `<div class="row"><span>${POOL[id] ? POOL[id].n : id}
       <span style="color:${v.col};font-size:0.6875rem"> · ${v.n}</span></span>
       <span class="r">${v.u} deployments</span></div>`;
      }).join('') || '<div class="row"><span style="color:var(--dim)">No deployments logged yet.</span></div>';
    return bar + `<div class="sect">Veteran roster</div><div class="rows">${veterans}</div>`;
  }

  if (recTab === 'ops') {
    const operations = Object.values(OPS).map(o => {
      const r = active.ops[o.k];
      const done = r ? r.cleared.length : 0;
      return `<div class="row"><span>${o.n}</span><span class="r${done ? ' hot' : ''}">${done} / ${o.nodes.length} cleared</span></div>`;
    }).join('');
    return bar + `<div class="sect">Operations</div><div class="rows">${operations}</div>`;
  }

  const fieldRecord = [
    ['Deployments', s.deployments], ['Objectives secured', s.held], ['Operations failed', s.lost],
    ['Hostiles destroyed', s.kills], ['Units lost', s.unitsLost], ['Breaches allowed', s.breaches],
    ['Enlisted', new Date(active.created).toLocaleDateString()],
  ].map(([k, v]) => `<div class="row"><span>${k}</span><span class="r">${v}</span></div>`).join('');
  return bar + `<div class="sect">Field record</div><div class="rows">${fieldRecord}</div>
   <div class="sect">Modes</div><div class="rows">
   <div class="row"><span>Onslaught best</span><span class="r hot">${active.bests.onslaught || 0} waves</span></div>
   <div class="row"><span>Gauntlets completed</span><span class="r hot">${active.bests.gauntlet || 0}</span></div>
   <div class="row"><span>Ironman</span><span class="r">${active.ironman ? 'Enabled' : 'Off'}</span></div></div>`;
}

const settingsPanel = () => `<div class="sect">Interface</div><div class="rows">
   <div class="row"><span>Layout<div style="font-size:0.6562rem;color:var(--dim);margin-top:4px;line-height:1.5">
     Desktop is a denser three-column board with a combat log and number-key deployment.
     Compact stacks and scrolls. Automatic picks by display.</div></span>
     <span class="uipick">${UI_MODES.map(m =>
       `<button class="mini${uiPreference() === m ? ' on' : ''}" data-ui="${m}">${UI_LABELS[m]}</button>`).join('')}</span></div>
   <div class="row"><span>In force</span><span class="r hot">${uiModeLabel()}</span></div>
   <div class="row" id="sndrow" style="cursor:pointer"><span>Sound effects<div style="font-size:0.6562rem;color:var(--dim);margin-top:4px">All synthesized — nothing to download.</div></span>
     <span class="r hot">${soundOn() ? 'On' : 'Off'}</span></div>
   <div class="row" id="musrow" style="cursor:pointer"><span>Atmosphere<div style="font-size:0.6562rem;color:var(--dim);margin-top:4px">A synthwave loop, generated live — no track to download.</div></span>
     <span class="r hot">${musicOn() ? 'On' : 'Off'}</span></div></div>
   <div class="sect">System</div><div class="rows">
   <div class="row"><span>Storage</span><span class="r">${store.ephemeral ? 'Blocked — session only' : 'This device'}</span></div>
   <div class="row"><span>Save version</span><span class="r">v${active.version}</span></div>
   <div class="row" id="shipren" style="cursor:pointer"><span>Dropship name</span><span class="r hot">DS ${active.ship || 'ANVIL-7'}</span></div>
   <div class="row" id="swrec" style="cursor:pointer"><span>Switch record<div style="font-size:0.6562rem;color:var(--dim);margin-top:4px">Back to command authentication.</div></span>
     <span class="r hot">Sign out</span></div>
   <div class="row" id="expo" style="cursor:pointer"><span>Export save</span><span class="r hot">Copy JSON</span></div>
   <div class="row" id="impo" style="cursor:pointer"><span>Import save<div style="font-size:0.6562rem;color:var(--dim);margin-top:4px">Paste an exported record — it is repaired to the current version on the way in.</div></span>
     <span class="r hot">Paste JSON</span></div>
   <div class="row" id="newrun" style="cursor:pointer"><span>Regenerate current operation</span><span class="r" style="color:var(--mag)">Reroll missions</span></div>
   <div class="row" id="tutreplay" style="cursor:pointer"><span>Combat briefing<div style="font-size:0.6562rem;color:var(--dim);margin-top:4px">Runs at the start of your next campaign mission.</div></span>
     <span class="r hot">${active.settings.tutorial === 'replay' ? 'Queued' : 'Replay'}</span></div>
   <div class="row" id="hintreplay" style="cursor:pointer"><span>Panel briefings<div style="font-size:0.6562rem;color:var(--dim);margin-top:4px">Squad, Quartermaster, Database and Service Record each show a one-time coach card.</div></span>
     <span class="r hot">Replay</span></div>
   <div class="row" id="introreplay" style="cursor:pointer"><span>Command transmissions<div style="font-size:0.6562rem;color:var(--dim);margin-top:4px">The codec call that opens an operation plays once. Reset it to take every call again.</div></span>
     <span class="r hot">Replay</span></div></div>
   <div class="sect">Controls</div><div class="rows">
   <div class="row"><span>End turn</span><span class="r">Space · Enter</span></div>
   <div class="row"><span>Deploy the nth card in hand</span><span class="r">1 – 9</span></div>
   <div class="row"><span>Deselect / close</span><span class="r">Escape</span></div>
   <div class="row"><span>Inspect a hand card</span><span class="r">Select it · View card</span></div></div>`;

export const PANELS = {
  squad: squadPanel,
  quartermaster: quartermasterPanel,
  database: databasePanel,
  record: recordPanel,
  settings: settingsPanel,
};

const TITLES = {
  squad: 'Squad', quartermaster: 'Quartermaster', database: 'Database',
  record: 'Service Record', settings: 'Settings',
};

/** Prompt for a new dropship name, then repaint. */
export function renameShip(after) {
  ask('Dropship designation', 'Name the ship that carries your task force.',
    v => {
      if (!v || !String(v).trim()) return;
      active.ship = String(v).trim().toUpperCase().slice(0, 14);
      commit();
      paintHold();
      if (after) after();
    },
    {input: active.ship || 'ANVIL-7', ok: 'Commit'});
}

/**
 * Paste-and-import an exported record. Reachable from the title screen and
 * from Settings; `after` runs once a record lands, e.g. to refresh the slots.
 */
export function importRecordFlow(after) {
  ask('Import record',
    'Paste the exported JSON. The record is repaired to the current version on import.',
    raw => {
      if (!raw || typeof raw !== 'string' || !raw.trim()) return;
      let p = null;
      try { p = migrate(JSON.parse(raw)); } catch { p = null; }
      if (!p) { notify('Import failed', 'That is not a readable record.'); return; }

      const i = profiles.findIndex(x => x.id === p.id);
      if (i >= 0) profiles[i] = p;
      else if (profiles.length >= 3) {
        notify('No free slot', 'All three record slots hold commanders. Erase one from the login screen first.');
        return;
      } else {
        profiles.push(p);
      }
      saveAll(profiles);
      // Importing over the record being played swaps it in live.
      if (active && active.id === p.id) enter(p);
      notify('Record imported', `<b style="color:var(--zan)">${p.callsign}</b> is on file.`);
      if (after) after(p);
    }, {paste: true, ok: 'Import'});
}

export function openPanel(key, quiet) {
  if (!active || !PANELS[key]) return;
  $('ptitle').textContent = TITLES[key] || key;
  $('pbody').innerHTML = PANELS[key]();
  $('panel').classList.add('on');
  if (!quiet) maybeShowPanelHint(key);
  markSwipe('.tabs', $('pbody'));

  const each = (sel, fn) => document.querySelectorAll('#pbody ' + sel).forEach(el => { el.onclick = () => fn(el); });
  each('[data-rosterbtn]', () => { toggleRoster(); openPanel('squad'); });
  each('[data-leadfocus]', el => focusLead(el.dataset.leadfocus, el.dataset.lctx));
  each('[data-focus]', el => focusCard(el.dataset.focus, el.dataset.mode));
  each('[data-foe]', el => focusEnemy(el.dataset.foe));
  each('[data-gear]', el => focusGear(el.dataset.gear));
  each('[data-scheme]', el => {
    const k = el.dataset.scheme;
    const sc = SCHEMES[k];
    if (!sc) return;
    if (active.unlocks.schemes.includes(k)) {
      active.loadout.scheme = k;
      commit();
      openPanel('quartermaster');
      return;
    }
    if (active.progress.credits < sc.price) {
      notify('Insufficient credits', `The ${sc.n} refit costs ${sc.price} cr. You hold ${active.progress.credits}.`);
      return;
    }
    ask(`Refit uniforms — ${sc.n}`,
      `Recolours the field plate of every soldier on the grid. Yours for good once bought.<br><br>Buy and apply for <b style="color:var(--gold)">${sc.price} cr</b>?`,
      ok => {
        if (!ok) return;
        active.progress.credits -= sc.price;
        active.unlocks.schemes.push(k);
        active.loadout.scheme = k;
        commit();
        openPanel('quartermaster');
      }, {ok: 'Refit'});
  });
  each('[data-gearfit]', el => focusGear(el.dataset.gearfit, false, true));
  // Both arrangement choices live on the profile, so they survive the panel
  // closing, the session ending and the record moving to another device.
  each('[data-sqtab]', el => { squadTab = el.dataset.sqtab; openPanel('squad', true); });
  each('[data-preset-save]', () => {
    const n = (active.presets || []).length + 1;
    ask('Save deck', 'Name this deck. It saves the twelve and the Frame slot as they stand.', name => {
      if (name === false) return;
      const label = String(name || '').trim().slice(0, 18) || `Deck ${n}`;
      active.presets = active.presets || [];
      active.presets.push({n: label, deck: [...active.loadout.deck], frame: active.loadout.frame || null});
      commit();
      openPanel('squad', true);
    }, {input: `Deck ${n}`, ok: 'Save'});
  });
  each('[data-preset-load]', el => {
    const p = (active.presets || [])[Number(el.dataset.presetLoad)];
    if (!p) return;
    active.loadout.deck = p.deck.filter(c => POOL[c] && active.unlocks.cards.includes(c) && POOL[c].chassis !== 'proto');
    active.loadout.frame = p.frame && POOL[p.frame] && active.unlocks.cards.includes(p.frame) ? p.frame : null;
    commit();
    openPanel('squad', true);
  });
  each('[data-preset-del]', el => {
    const i = Number(el.dataset.presetDel);
    const p = (active.presets || [])[i];
    if (!p) return;
    ask('Delete deck', `Forget <b>${p.n}</b>? The cards stay yours; only the list entry goes.`, ok => {
      if (!ok) return;
      active.presets.splice(i, 1);
      commit();
      openPanel('squad', true);
    }, {ok: 'Delete'});
  });
  each('[data-sqsort]', el => {
    active.settings.squadSort = el.dataset.sqsort;
    commit();
    openPanel('squad', true);
  });
  each('[data-sqgroup]', el => {
    active.settings.squadGroup = el.dataset.sqgroup;
    commit();
    openPanel('squad', true);
  });
  each('[data-tab]', el => { dbTab = el.dataset.tab; openPanel('database'); });
  each('[data-rectab]', el => { recTab = el.dataset.rectab; openPanel('record'); });
  each('[data-ui]', el => { setUiMode(el.dataset.ui); paintHold(); openPanel('settings'); });

  const buyPack = $('buypack');
  if (buyPack) {
    buyPack.onclick = () => {
      if (!purchasePack()) return;
      setAfterPacks(() => openPanel('quartermaster'));
      showPack();
    };
  }

  const exportRow = $('expo');
  if (exportRow) {
    exportRow.onclick = () => {
      if (navigator.clipboard) navigator.clipboard.writeText(JSON.stringify(active));
      exportRow.querySelector('.r').textContent = 'Copied';
    };
  }
  const renameRow = $('shipren');
  if (renameRow) renameRow.onclick = () => renameShip(() => openPanel('settings'));

  const soundRow = $('sndrow');
  if (soundRow) soundRow.onclick = () => { toggleSound(); openPanel('settings'); };

  const musicRow = $('musrow');
  if (musicRow) musicRow.onclick = () => { toggleMusic(); openPanel('settings'); };

  const swRow = $('swrec');
  if (swRow) {
    swRow.onclick = () => {
      $('panel').classList.remove('on');
      commit();
      stopScene();
      setActive(null);
      show('boot');
      renderSlots();
    };
  }

  const importRow = $('impo');
  if (importRow) importRow.onclick = () => importRecordFlow();

  const tutRow = $('tutreplay');
  if (tutRow) {
    tutRow.onclick = () => {
      active.settings = active.settings || {};
      active.settings.tutorial = 'replay';
      commit();
      openPanel('settings');
    };
  }

  const hintRow = $('hintreplay');
  if (hintRow) {
    hintRow.onclick = () => {
      active.settings.hints = {};
      commit();
      notify('Panel briefings reset', 'They\'ll show again the next time you open each panel.');
    };
  }

  const introRow = $('introreplay');
  if (introRow) {
    introRow.onclick = () => {
      replayIntros();
      notify('Transmissions reset', 'Central Command will call ahead of every operation again.');
    };
  }

  const rerollRow = $('newrun');
  if (rerollRow) {
    rerollRow.onclick = () => ask('Reroll operation',
      'Every mission in this operation will be regenerated. Cleared progress is lost.',
      ok => {
        if (!ok) return;
        genRun();
        commit();
        paintHold();
        $('panel').classList.remove('on');
      }, {ok: 'Reroll'});
  }
}
