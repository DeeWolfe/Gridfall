// Profile creation, migration and persistence.
//
// migrate() is the load-bearing piece: it runs unconditionally on every load,
// whatever the version stamp says, and REPAIRS rather than rejects. A profile
// that references a card or gear id which no longer exists is stripped down to
// something playable instead of being thrown away. Renaming a card id without
// this would corrupt every live save that had it in a deck.

import {SAVE_VERSION, STARTER} from '../state/constants.js';
import {POOL} from '../content/cards.js';
import {GEAR} from '../content/gear.js';
import {LEADS} from '../content/leads.js';
import {OPS} from '../content/operations.js';
import {store, KEY} from './store.js';
import {active, profiles, setProfiles} from '../state/session.js';
import {hooks} from '../state/hooks.js';

export function blankProfile(callsign) {
  return {
    version: SAVE_VERSION,
    id: 'p' + Date.now().toString(36),
    callsign: callsign.toUpperCase().slice(0, 12),
    created: Date.now(),
    lastPlayed: Date.now(),
    progress: {rank: 1, xp: 0, credits: 420},
    unlocks: {cards: [...STARTER], enemies: [], gear: [], leads: [], schemes: ['standard']},
    loadout: {deck: [...STARTER], gear: {}, scheme: 'standard'},
    stats: {deployments: 0, held: 0, lost: 0, breaches: 0, kills: 0, unitsLost: 0},
    ship: 'ANVIL-7',
    lead: 'ironbrand',
    usage: {},
    op: 'ironveil',
    ops: {},
    mode: 'campaign',
    ironman: false,
    gaunt: null,
    bests: {onslaught: 0, gauntlet: 0},
    settings: {},
  };
}

/**
 * Bring any profile-shaped object up to the current schema. Returns the same
 * object (mutated), or null if it was not an object at all.
 */
export function migrate(p) {
  if (!p || typeof p !== 'object') return null;

  p.id = p.id || 'p' + Math.random().toString(36).slice(2, 9);
  // Names render through innerHTML all over the UI, and an imported record is
  // the one path where they arrive from outside the input fields' own caps.
  p.callsign = String(p.callsign || 'UNNAMED').replace(/[<>&"']/g, '').slice(0, 12) || 'UNNAMED';
  p.ship = String(p.ship || 'ANVIL-7').replace(/[<>&"']/g, '').slice(0, 14) || 'ANVIL-7';
  p.created = p.created || Date.now();
  p.lastPlayed = p.lastPlayed || Date.now();
  p.progress = p.progress || {};
  p.unlocks = p.unlocks || {};
  p.loadout = p.loadout || {};
  p.stats = p.stats || {};

  // v3 and earlier stored a single in-progress run; v4 keys runs by operation.
  if (!p.version || p.version < 4) {
    p.version = 4;
    p.op = 'ironveil';
    p.ops = {};
    p.loadout = p.loadout || {deck: [...STARTER]};
    p.loadout.gear = p.loadout.gear || {};
    p.unlocks.gear = p.unlocks.gear || [];
    p.progress.salvage = p.progress.salvage || 120;
    delete p.run;
  }

  p.progress = p.progress || {rank: 1, xp: 0, credits: 300};
  p.progress.packMeter = p.progress.packMeter || 0;

  // v5 dropped the salvage currency — gear buys with credits now, so any
  // salvage still on the books folds straight into the credits total instead
  // of evaporating.
  if (!p.version || p.version < 5) {
    p.version = 5;
    p.progress.credits = (p.progress.credits || 0) + (p.progress.salvage || 0);
    delete p.progress.salvage;
  }
  // v6 turned the Shoulder Cannon from a card you played onto a unit into a
  // piece of gear you fit at the armoury. Anyone who had bought the card is
  // issued the gear rather than losing the 145 credits when the strip below
  // drops the card id — the piece it becomes costs more, so the conversion is
  // in the commander's favour either way.
  if (!p.version || p.version < 6) {
    p.version = 6;
    p.unlocks.gear = p.unlocks.gear || [];
    if ((p.unlocks.cards || []).includes('cannon') && !p.unlocks.gear.includes('cannon')) {
      p.unlocks.gear.push('cannon');
    }
  }

  p.unlocks = p.unlocks || {};
  p.unlocks.cards = p.unlocks.cards || [...STARTER];
  p.unlocks.enemies = p.unlocks.enemies || [];
  p.unlocks.gear = p.unlocks.gear || [];
  p.unlocks.leads = p.unlocks.leads || [];
  p.loadout = p.loadout || {};
  p.loadout.deck = p.loadout.deck || [...STARTER];
  p.loadout.gear = p.loadout.gear || {};
  p.loadout.scheme = typeof p.loadout.scheme === 'string' ? p.loadout.scheme : 'standard';
  p.unlocks.schemes = Array.isArray(p.unlocks.schemes) ? p.unlocks.schemes : ['standard'];

  // Strip anything that points at content we no longer ship.
  p.loadout.deck = p.loadout.deck.filter(c => POOL[c]);
  p.unlocks.cards = p.unlocks.cards.filter(c => POOL[c]);
  Object.keys(p.loadout.gear).forEach(k => {
    if (!GEAR[p.loadout.gear[k]] || !POOL[k]) delete p.loadout.gear[k];
  });

  p.stats = p.stats || {deployments: 0, held: 0, lost: 0, breaches: 0, kills: 0, unitsLost: 0};
  p.stats.opsCleared = p.stats.opsCleared || 0;
  p.ops = p.ops || {};
  p.op = OPS[p.op] ? p.op : 'ironveil';
  p.mode = p.mode || 'campaign';
  p.bests = p.bests || {onslaught: 0, gauntlet: 0};
  p.gaunt = p.gaunt || null;
  p.usage = p.usage || {};
  p.settings = p.settings || {};
  p.lead = LEADS[p.lead] ? p.lead : 'ironbrand';
  return p;
}

/** Read every stored profile, migrating each. Unreadable storage yields []. */
export function loadAll() {
  try {
    const raw = store.get(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.map(migrate).filter(Boolean);
  } catch {
    console.warn('save unreadable, starting fresh');
    return [];
  }
}

export const saveAll = list => store.set(KEY, JSON.stringify(list));

/** Write the active profile back into the list and persist. */
export function commit() {
  if (!active) return;
  active.lastPlayed = Date.now();
  const i = profiles.findIndex(p => p.id === active.id);
  if (i >= 0) profiles[i] = active; else profiles.push(active);
  saveAll(profiles);
  hooks.saved();
}

/** Load storage into the session. Called once at boot. */
export function initProfiles() {
  setProfiles(loadAll());
  return profiles;
}
