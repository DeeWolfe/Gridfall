// The four hold panels — Squad, Quartermaster, Database, Service Record —
// plus Settings. Each is a function returning markup; openPanel() drops it in
// and re-wires the delegated handlers.

import {DECKSIZE} from '../state/constants.js';
import {POOL} from '../content/cards.js';
import {GEAR} from '../content/gear.js';
import {BEST} from '../content/hostiles.js';
import {OPS} from '../content/operations.js';
import {TIERNAME, RANKS} from '../content/ranks.js';
import {LEADS} from '../content/leads.js';
import {active, profiles, setActive} from '../state/session.js';
import {store} from '../save/store.js';
import {commit, migrate, saveAll} from '../save/profile.js';
import {rankName, costOf, vetOf, leadUnlocked} from '../save/progression.js';
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
  return TIERS.map(t => {
    const inTier = sortCards(ids.filter(c => POOL[c].t === t));
    if (!inTier.length) return '';
    return `<div class="subsect">${TIERNAME[t]} <span class="ct">${inTier.length}</span></div>` +
      cardGrid(inTier, 'gear');
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

function squadPanel() {
  const deck = active.loadout.deck;
  const reserve = active.unlocks.cards.filter(c => !deck.includes(c));
  return `<div class="sect">Team lead — answers to you</div>${leadCardHTML()}
   ${leadTilesHTML('squad')}
   <div class="sect">Deck</div>
   <div class="bar"><div><b>${deck.length}</b> / ${DECKSIZE} in deck · <b style="color:var(--cyan)">${Object.keys(active.loadout.gear).length}</b> geared</div>
     <div style="color:var(--dim);font-size:0.6875rem">Tap any card to enlarge it — inspect, fit gear, add or remove</div></div>
   <div class="sect">Active deck</div>
   ${deck.length ? cardGrid(deck, 'gear') : cardGridEmpty('Empty.')}
   <div class="sect">Reserve — ${reserve.length}</div>
   ${squadControls()}
   ${reserveCards(reserve)}
   ${gearLocker()}`;
}

function quartermasterPanel() {
  const tier = t => `<div class="sect">${TIERNAME[t]}</div>` +
    cardGrid(Object.keys(POOL).filter(c => POOL[c].t === t), 'shop');

  const gearGrid = `<div class="sect" style="color:var(--cyan)">Gear</div>
     <div class="cgrid">${Object.keys(GEAR).map(gi => {
       const g = GEAR[gi];
       const owned = active.unlocks.gear.includes(gi);
       const affordable = active.progress.credits >= g.cost;
       return `<button class="gcard t-tech${owned ? ' owned' : affordable ? '' : ' cant'}" data-gear="${gi}"
         title="${attr(g.n + ' — ' + g.cost + ' cr\n' + g.d)}">
         <div class="inkmark">${sigil(gi, 'tech')}</div>
         <div class="tn">${g.n}</div>
         <div class="gfoot ${owned ? 'own' : affordable ? 'buy' : 'no'}">${owned ? 'Owned' : g.cost + ' cr'}</div></button>`;
     }).join('')}</div>`;

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
       <div style="color:var(--dim);font-size:0.6875rem">Tap an entry to enlarge — full stats, targeting and abilities</div></div>${dbTabs()}
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
