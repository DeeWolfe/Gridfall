// Achievements.
//
// The rule the list is built on: every badge is a pure function of what the
// save already holds. A counter added for a badge is a counter that will one
// day disagree with the badge, so this guards the property rather than the
// wording — every entry has to compute on a brand-new record, on a maxed one,
// and on a record from an older version that predates the field it reads.
import './support/install-dom.js';
import * as A from './support/api.js';
import {get} from './support/dom.js';
import {failures} from './support/harness.js';
import {POOL} from '../src/content/cards.js';
import {GEAR} from '../src/content/gear.js';
import {BEST} from '../src/content/hostiles.js';
import {LEADS} from '../src/content/leads.js';
import {OPS} from '../src/content/operations.js';
import {SCHEMES} from '../src/render/sprites.js';
import {openPanel} from '../src/render/panels.js';

const F = failures();

/** Read the rendered Achievements tab back as {name: earned}. */
function badges(p) {
  A.enterProfile(p);
  p.settings.hints = {record: 1};
  openPanel('record');
  // The tab lives behind a control; the panel re-renders when it is clicked.
  // The same query openPanel wired, so the stub hands back the same objects.
  const tab = [...document.querySelectorAll('#pbody [data-rectab]')].find(b => b.dataset.rectab === 'ach');
  if (!tab || !tab.onclick) { F.push('no wired Achievements tab in the Service Record'); return {list: {}, html: ''}; }
  tab.onclick();
  const html = get('pbody')._html;
  const out = {};
  for (const m of html.matchAll(/[◆◇]\s([^<]+)<\/b>/g)) out[m[1].trim()] = html.indexOf('◆ ' + m[1].trim()) >= 0;
  return {list: out, html};
}

// --- a brand-new record earns nothing and crashes on nothing ---
let names = [];
{
  const p = A.blankProfile('FRESH');
  const {list, html} = badges(p);
  names = Object.keys(list);
  if (names.length < 20) F.push(`only ${names.length} achievements rendered`);
  if (/NaN|undefined|Infinity/.test(html)) F.push('a fresh record produced a broken achievement row');
  const earned = (html.match(/◆ /g) || []).length;
  if (earned) F.push(`a brand-new commander has already earned ${earned}`);
  console.log('achievements on file:', names.length);
}

// --- a maxed record earns all of them ---
{
  const p = A.blankProfile('MAXED');
  p.stats = {deployments: 500, held: 99, lost: 0, breaches: 0, kills: 5000, unitsLost: 40, opsCleared: 9};
  p.progress = {rank: A.RANKS.length, xp: 99999, credits: 9999, packMeter: 0};
  p.unlocks = {
    cards: Object.keys(POOL), enemies: Object.keys(BEST), gear: Object.keys(GEAR),
    leads: Object.keys(LEADS), schemes: Object.keys(SCHEMES),
  };
  p.loadout.deck = Object.keys(POOL).filter(c => !POOL[c].attach).slice(0, A.DECKSIZE);
  p.loadout.gear = {};
  Object.keys(GEAR).slice(0, 8).forEach((gi, i) => { p.loadout.gear[p.loadout.deck[i]] = gi; });
  p.usage = Object.fromEntries(Object.keys(POOL).map(c => [c, 200]));
  p.bests = {onslaught: 40, run: 9, runsDone: 4};
  p.daily = {date: null, done: false, streak: 30};
  p.ops = Object.fromEntries(Object.values(OPS).map(o => [o.k, {cleared: o.nodes.map(n => n.id), nodes: {}}]));

  const {html} = badges(p);
  if (/NaN|undefined|Infinity/.test(html)) F.push('a maxed record produced a broken achievement row');
  const unearned = [...html.matchAll(/◇\s([^<]+)<\/b>/g)].map(m => m[1].trim());
  if (unearned.length) F.push('unreachable achievements: ' + unearned.join(', '));
  console.log('a maxed record earns all', names.length);
}

// --- a record from before the daily/uniform fields still renders ---
{
  const old = A.migrate({
    version: 4, callsign: 'OLD',
    unlocks: {cards: ['rifle'], gear: [], enemies: [], leads: []},
    loadout: {deck: ['rifle']},
    progress: {rank: 2, xp: 10, credits: 40},
    stats: {deployments: 3, held: 1, lost: 0, breaches: 1, kills: 12, unitsLost: 2},
  });
  const {html} = badges(old);
  if (/NaN|undefined|Infinity/.test(html)) F.push('an old record broke an achievement that reads a newer field');
  if (html.includes('◆ Not One Step')) F.push('a record that has allowed a breach earned the no-breach badge');
}

// --- the no-breach badge collapses the moment a lane opens ---
{
  const p = A.blankProfile('CLEAN');
  p.stats.deployments = 30;
  p.stats.breaches = 0;
  if (!badges(p).html.includes('◆ Not One Step')) F.push('thirty clean deployments did not earn the badge');
  p.stats.breaches = 1;
  if (badges(p).html.includes('◆ Not One Step')) F.push('the badge survived a breach');
}

F.report('achievements: every badge computes from the save, on any version of it');
