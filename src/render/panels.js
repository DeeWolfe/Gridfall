// The four hold panels — Squad, Quartermaster, Database, Service Record —
// plus Settings. Each is a function returning markup; openPanel() drops it in
// and re-wires the delegated handlers.

import {DECKSIZE} from '../state/constants.js';
import {POOL} from '../content/cards.js';
import {GEAR} from '../content/gear.js';
import {BEST} from '../content/hostiles.js';
import {OPS} from '../content/operations.js';
import {TIERNAME} from '../content/ranks.js';
import {active} from '../state/session.js';
import {store} from '../save/store.js';
import {commit} from '../save/profile.js';
import {rankName, costOf, vetOf} from '../save/progression.js';
import {genRun} from '../rules/run.js';
import {$, attr} from './dom.js';
import {sigil} from './art.js';
import {ask} from './dialog.js';
import {cardEl} from './card-html.js';
import {focusCard, focusEnemy, focusGear} from './focus.js';
import {leadCardHTML, paintHold} from './hold.js';

const TIERS = ['common', 'special', 'tech'];
let dbTab = 'cards';

const cardGrid = (ids, mode) => `<div class="cgrid">${ids.map(c => cardEl(c, mode)).join('')}</div>`;

function squadPanel() {
  const deck = active.loadout.deck;
  const reserve = active.unlocks.cards.filter(c => !deck.includes(c));
  return `<div class="sect">Team lead</div>${leadCardHTML()}
   <div class="sect">Deck</div>
   <div class="bar"><div><b>${deck.length}</b> / ${DECKSIZE} in deck · <b style="color:var(--cyan)">${Object.keys(active.loadout.gear).length}</b> geared</div>
     <div style="color:var(--dim);font-size:0.5625rem">Tap any card to enlarge it — inspect, fit gear, add or remove</div></div>
   <div class="sect">Active deck</div>
   ${deck.length ? cardGrid(deck, 'gear') : '<div class="cgrid"><div style="color:var(--dim);font-size:0.625rem">Empty.</div></div>'}
   <div class="sect">Reserve — ${reserve.length}</div>
   ${reserve.length ? cardGrid(reserve, 'gear') : '<div class="cgrid"><div style="color:var(--dim);font-size:0.625rem">Nothing in reserve.</div></div>'}`;
}

function quartermasterPanel() {
  const tier = t => `<div class="sect">${TIERNAME[t]} — credits</div>` +
    cardGrid(Object.keys(POOL).filter(c => POOL[c].t === t), 'shop');

  const gearGrid = `<div class="sect" style="color:var(--cyan)">Gear — salvage</div>
     <div class="cgrid">${Object.keys(GEAR).map(gi => {
       const g = GEAR[gi];
       const owned = active.unlocks.gear.includes(gi);
       const affordable = active.progress.salvage >= g.cost;
       return `<button class="gcard t-tech${owned ? ' owned' : affordable ? '' : ' cant'}" data-gear="${gi}"
         title="${attr(g.n + ' — ' + g.cost + ' salvage\n' + g.d)}">
         <div class="gart">${sigil(gi, 'tech')}<div class="gcost" style="background:var(--cyan);color:#06121a">◈</div></div>
         <div class="gname">${g.n}</div><div class="gtype">Gear</div>
         <div class="gfoot ${owned ? 'own' : affordable ? 'buy' : 'no'}">${owned ? 'Owned' : g.cost + ' sv'}</div></button>`;
     }).join('')}</div>`;

  return `<div class="bar"><div>Credits <b>${active.progress.credits}</b> · Salvage <b style="color:var(--cyan)">${active.progress.salvage}</b></div>
     <div style="color:var(--dim);font-size:0.5625rem">Tap a card to enlarge and buy. Credits buy cards, salvage buys gear.</div></div>
   ${TIERS.map(tier).join('')}${gearGrid}`;
}

const dbTabs = () => `<div class="tabs">
     <button class="tab${dbTab === 'cards' ? ' on' : ''}" data-tab="cards">Assets</button>
     <button class="tab${dbTab === 'gear' ? ' on' : ''}" data-tab="gear">Gear</button>
     <button class="tab${dbTab === 'foes' ? ' on' : ''}" data-tab="foes">Hostiles</button></div>`;

function databasePanel() {
  if (dbTab === 'cards') {
    const tier = t => {
      const ids = Object.keys(POOL).filter(c => POOL[c].t === t);
      const owned = ids.filter(i => active.unlocks.cards.includes(i)).length;
      return `<div class="sect">${TIERNAME[t]} — ${owned}/${ids.length} owned</div>` + cardGrid(ids, 'info');
    };
    return `<div class="bar"><div>Assets on file <b>${Object.keys(POOL).length}</b></div>
       <div style="color:var(--dim);font-size:0.5625rem">Tap a card to enlarge — full stats, targeting and abilities</div></div>${dbTabs()}
       ${TIERS.map(tier).join('')}`;
  }

  if (dbTab === 'gear') {
    const rows = Object.keys(GEAR).map(gi => {
      const g = GEAR[gi];
      const owned = active.unlocks.gear.includes(gi);
      const fittedTo = Object.keys(active.loadout.gear).find(k => active.loadout.gear[k] === gi);
      return `<div class="row" data-gear="${gi}" style="cursor:pointer"><span><b style="color:var(--cyan)">${g.n}</b>
         <div style="font-size:0.5312rem;color:var(--dim);margin-top:4px">${g.d}${fittedTo ? ` · fitted to ${POOL[fittedTo].n}` : ''}</div></span>
         <span class="r${owned ? '' : ' hot'}">${owned ? 'Owned' : g.cost + ' sv'}</span></div>`;
    }).join('');
    return `<div class="bar"><div>Gear on file <b>${Object.keys(GEAR).length}</b></div>
     <div style="color:var(--dim);font-size:0.5625rem">One slot per card, bought with salvage</div></div>${dbTabs()}
     <div class="sect">Field gear</div><div class="rows">${rows}</div>`;
  }

  const seen = active.unlocks.enemies;
  const tier = t => {
    const ids = Object.keys(BEST).filter(k => BEST[k].t === t);
    const rows = ids.map(k => {
      const b = BEST[k];
      const on = seen.includes(k);
      return `<div class="row${on ? '' : ' locked'}"${on ? ` data-foe="${k}" style="cursor:pointer"` : ''}>
         <span><b style="color:${on ? 'var(--mag)' : 'var(--dim)'}">${on ? b.n : '████████'}</b>
         <div style="font-size:0.5312rem;color:var(--dim);margin-top:4px;line-height:1.5">${on ? b.d : 'No contact logged.'}</div></span>
         <span class="r">${on ? b.hp + ' HP · threat ' + b.threat : '—'}</span></div>`;
    }).join('');
    return `<div class="sect">${TIERNAME[t]} — ${ids.filter(k => seen.includes(k)).length}/${ids.length}</div>
     <div class="rows">${rows}</div>`;
  };
  return `<div class="bar"><div>Hostiles logged <b>${seen.length}</b> / ${Object.keys(BEST).length}</div>
     <div style="color:var(--dim);font-size:0.5625rem">Entries unlock on first kill</div></div>${dbTabs()}
     ${TIERS.map(tier).join('')}`;
}

function recordPanel() {
  const s = active.stats;
  const fieldRecord = [
    ['Deployments', s.deployments], ['Objectives secured', s.held], ['Operations failed', s.lost],
    ['Hostiles destroyed', s.kills], ['Units lost', s.unitsLost], ['Breaches allowed', s.breaches],
    ['Enlisted', new Date(active.created).toLocaleDateString()],
  ].map(([k, v]) => `<div class="row"><span>${k}</span><span class="r">${v}</span></div>`).join('');

  const veterans = Object.keys(active.usage || {})
    .sort((a, b) => active.usage[b] - active.usage[a]).slice(0, 8)
    .map(id => {
      const v = vetOf(id);
      return `<div class="row"><span>${POOL[id] ? POOL[id].n : id}
       <span style="color:${v.col};font-size:0.5625rem"> · ${v.n}</span></span>
       <span class="r">${v.u} deployments</span></div>`;
    }).join('') || '<div class="row"><span style="color:var(--dim)">No deployments logged yet.</span></div>';

  const operations = Object.values(OPS).map(o => {
    const r = active.ops[o.k];
    const done = r ? r.cleared.length : 0;
    return `<div class="row"><span>${o.n}</span><span class="r${done ? ' hot' : ''}">${done} / ${o.nodes.length} cleared</span></div>`;
  }).join('');

  return `
   <div class="bar"><div>${active.callsign} · <b style="color:var(--cyan)">${rankName(active.progress.rank)}</b></div>
     <div style="color:var(--dim);font-size:0.5625rem">XP ${active.progress.xp}</div></div>
   <div class="sect">Field record</div><div class="rows">${fieldRecord}</div>
   <div class="sect">Veteran roster</div><div class="rows">${veterans}</div>
   <div class="sect">Modes</div><div class="rows">
   <div class="row"><span>Onslaught best</span><span class="r hot">${active.bests.onslaught || 0} waves</span></div>
   <div class="row"><span>Gauntlets completed</span><span class="r hot">${active.bests.gauntlet || 0}</span></div>
   <div class="row"><span>Ironman</span><span class="r">${active.ironman ? 'Enabled' : 'Off'}</span></div></div>
   <div class="sect">Operations</div><div class="rows">${operations}</div>`;
}

const settingsPanel = () => `<div class="sect">System</div><div class="rows">
   <div class="row"><span>Storage</span><span class="r">${store.ephemeral ? 'Blocked — session only' : 'This device'}</span></div>
   <div class="row"><span>Save version</span><span class="r">v${active.version}</span></div>
   <div class="row" id="shipren" style="cursor:pointer"><span>Dropship name</span><span class="r hot">DS ${active.ship || 'ANVIL-7'}</span></div>
   <div class="row" id="expo" style="cursor:pointer"><span>Export save</span><span class="r hot">Copy JSON</span></div>
   <div class="row" id="newrun" style="cursor:pointer"><span>Regenerate current operation</span><span class="r" style="color:var(--mag)">Reroll missions</span></div></div>
   <div class="sect">Controls</div><div class="rows">
   <div class="row"><span>End turn</span><span class="r">Space</span></div>
   <div class="row"><span>Deselect / close</span><span class="r">Escape</span></div>
   <div class="row"><span>Inspect a hand card</span><span class="r">⌕ badge</span></div></div>`;

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

export function openPanel(key) {
  if (!active || !PANELS[key]) return;
  $('ptitle').textContent = TITLES[key] || key;
  $('pbody').innerHTML = PANELS[key]();
  $('panel').classList.add('on');

  const each = (sel, fn) => document.querySelectorAll('#pbody ' + sel).forEach(el => { el.onclick = () => fn(el); });
  each('[data-lead]', el => { active.lead = el.dataset.lead; commit(); openPanel('squad'); });
  each('[data-focus]', el => focusCard(el.dataset.focus, el.dataset.mode));
  each('[data-foe]', el => focusEnemy(el.dataset.foe));
  each('[data-gear]', el => focusGear(el.dataset.gear));
  each('[data-tab]', el => { dbTab = el.dataset.tab; openPanel('database'); });

  const exportRow = $('expo');
  if (exportRow) {
    exportRow.onclick = () => {
      if (navigator.clipboard) navigator.clipboard.writeText(JSON.stringify(active));
      exportRow.querySelector('.r').textContent = 'Copied';
    };
  }
  const renameRow = $('shipren');
  if (renameRow) renameRow.onclick = () => renameShip(() => openPanel('settings'));

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
