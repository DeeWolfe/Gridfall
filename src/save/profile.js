// Profile creation, migration and persistence.
//
// migrate() is the load-bearing piece: it runs unconditionally on every load,
// whatever the version stamp says, and REPAIRS rather than rejects. A profile
// that references a card or gear id which no longer exists is stripped down to
// something playable instead of being thrown away. Renaming a card id without
// this would corrupt every live save that had it in a deck.

import {SAVE_VERSION, STARTER} from '../state/constants.js';
import {BOSSDEF} from '../content/bosses.js';
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
    loadout: {deck: [...STARTER], gear: {}, scheme: 'standard', frame: null},
    stats: {deployments: 0, held: 0, lost: 0, breaches: 0, kills: 0, unitsLost: 0},
    ship: 'ANVIL-7',
    lead: 'ironbrand',
    usage: {},
    op: 'ironveil',
    ops: {},
    // Operations cleared at least once, ever. Survives a replay, a reroll and
    // an Ironman wipe — `ops` is the run in progress, this is the career.
    opsDone: {},
    mode: 'campaign',
    ironman: false,
    gaunt: null,
    // The Deep Run in progress: its own map, deck, gear and lead. Null between
    // runs, and never merged into the profile loadout in either direction.
    run: null,
    bests: {onslaught: 0, gauntlet: 0, run: 0, runsDone: 0},
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

  // v3 and earlier stored a single in-progress campaign run on `p.run`; v4
  // keys campaign runs by operation and drops it. The key was later reused for
  // the Deep Run, which is a different shape entirely — deleting it here keeps
  // a v3 save from arriving at the Deep Run repair pass wearing its clothes.
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

  // v7: the Crystal Longsword became the Seven Blades' standard weapon, and
  // its gear slot became the Arm-Mounted Blade. Anyone who owned or fitted
  // the longsword gets the blade — a straight swap, nothing lost.
  if (p.version < 7) {
    p.version = 7;
    p.unlocks.gear = p.unlocks.gear || [];
    const i = p.unlocks.gear.indexOf('longsword');
    if (i >= 0) p.unlocks.gear[i] = 'armblade';
    p.loadout = p.loadout || {};
    p.loadout.gear = p.loadout.gear || {};
    Object.keys(p.loadout.gear).forEach(k => {
      if (p.loadout.gear[k] === 'longsword') p.loadout.gear[k] = 'armblade';
    });
  }

  // v8: Shallowhelm became the four-chapel pilgrimage. The Reliquary no
  // longer exists as an encounter (the Communion replaced it), so its
  // bestiary unlock goes, and any run rolled against the OLD map would
  // reference nodes that no longer mean what they meant — drop it and let
  // genRun deal a fresh one on the next visit.
  if (p.version < 8) {
    p.version = 8;
    if (p.unlocks && p.unlocks.enemies) {
      p.unlocks.enemies = p.unlocks.enemies.filter(k => k !== 'reliquary');
    }
    if (p.ops && p.ops.shallowhelm) delete p.ops.shallowhelm;
  }

  // v9: the four-wing pilgrimage moved to Crownring where it always belonged
  // — the Fallen Frames became the summit's hijacked honor guards, the
  // Communion became the Concord, and Shallowhelm got its fortress map and
  // the Reliquary back. Bestiary kills carry across under the new names;
  // both operations' stored runs reset (their node ids changed meaning).
  if (p.version < 9) {
    p.version = 9;
    const renamed = {immolant: 'pyreguard', drowned: 'rimeguard',
      conduit: 'stormguard', ossified: 'shardguard', communion: 'concord'};
    if (p.unlocks && p.unlocks.enemies) {
      p.unlocks.enemies = [...new Set(p.unlocks.enemies.map(k => renamed[k] || k))];
    }
    if (p.ops && p.ops.shallowhelm) delete p.ops.shallowhelm;
    if (p.ops && p.ops.crownring) delete p.ops.crownring;
  }

  // v10: the Concord is shelved for a later chapter — the Envoy is
  // Crownring's final again, and the Summit Floor is the last node. Stored
  // crownring runs reference the removed Concord node, so they reset.
  if (p.version < 10) {
    p.version = 10;
    if (p.unlocks && p.unlocks.enemies) {
      p.unlocks.enemies = p.unlocks.enemies.filter(k => k !== 'concord');
    }
    if (p.ops && p.ops.crownring) delete p.ops.crownring;
  }

  // v11: the Aperture joins the Concord on the shelf — SUBJECT ONE holds
  // Lumenspire now. The map itself is unchanged, so runs survive.
  if (p.version < 11) {
    p.version = 11;
    if (p.unlocks && p.unlocks.enemies) {
      p.unlocks.enemies = p.unlocks.enemies.filter(k => k !== 'aperture');
    }
  }

  // v12: the pro/con lead roster. Wildfire retired (the fallback below hands
  // any Wildfire commander to Ironbrand), and Coldwire moved behind the
  // Quartermaster counter — anyone from the free era keeps her.
  if (p.version < 12) {
    p.version = 12;
    p.unlocks = p.unlocks || {};
    p.unlocks.leads = p.unlocks.leads || [];
    if (!p.unlocks.leads.includes('coldwire')) p.unlocks.leads.push('coldwire');
  }

  // v13: the Frame rework. The Pilot is retired and the armoury's nine Frame
  // weapons became gear CARDS inside the deck — anything bought under the old
  // system refunds at full price, so nobody pays for the redesign. Ironwright
  // rotated out for the two new Frame leads; her commanders get Graham.
  if (p.version < 13) {
    p.version = 13;
    p.unlocks = p.unlocks || {};
    p.progress = p.progress || {};
    const refunds = {pilot: 70};
    const oldGear = {greatsword: 520, armblade: 520, lasergat: 500, missilegat: 540,
      beamrifle: 440, beamsaber: 480, javelin: 480, napalm: 520, railcannon: 560};
    if ((p.unlocks.cards || []).includes('pilot')) {
      p.progress.credits = (p.progress.credits || 0) + refunds.pilot;
    }
    (p.unlocks.gear || []).forEach(g => {
      if (oldGear[g]) p.progress.credits = (p.progress.credits || 0) + oldGear[g];
    });
    p.unlocks.gear = (p.unlocks.gear || []).filter(g => !oldGear[g]);
    p.unlocks.leads = p.unlocks.leads || [];
    const iw = p.unlocks.leads.indexOf('ironwright');
    if (iw >= 0) p.unlocks.leads[iw] = 'salvagerights';
    if (p.lead === 'ironwright') p.lead = 'salvagerights';
    delete p.pilotName;
  }

  // v14: the balance pass. Ten cards left the roster — every one refunds at
  // the price it sold for. The Turret came free with the starter set and its
  // job passed to the Rampart, so a Turret commander gets the Rampart in its
  // place (deck slot included); one who already owned both is paid instead.
  if (p.version < 14) {
    p.version = 14;
    p.unlocks = p.unlocks || {};
    p.progress = p.progress || {};
    p.loadout = p.loadout || {};
    const cards = p.unlocks.cards || [];
    const refunds = {knight: 145, vanguard: 145, biomed: 280, pulse: 110, suppressor: 150,
      battery: 160, bore: 165, cache: 115, sapper: 280};
    Object.keys(refunds).forEach(id => {
      if (cards.includes(id)) p.progress.credits = (p.progress.credits || 0) + refunds[id];
    });
    if (cards.includes('turret')) {
      if (cards.includes('rampart')) {
        p.progress.credits = (p.progress.credits || 0) + 100;
      } else {
        cards.push('rampart');
        p.loadout.deck = (p.loadout.deck || []).map(c => (c === 'turret' ? 'rampart' : c));
      }
    }
    p.unlocks.cards = cards;
  }

  // v15: the roster review. Thirteen cards left, every one refunded at its
  // sale price; the Fireteam Zaku became the Fireteam Specialist (its owners
  // are paid for the old card, not handed the new one); the lane fields were
  // re-cast as an elemental set and three of them changed id, so a saved
  // Scrambler / Degausser / Resonance Lens becomes a Pyre / Volt / Crystal.
  if (p.version < 15) {
    p.version = 15;
    p.unlocks = p.unlocks || {};
    p.progress = p.progress || {};
    p.loadout = p.loadout || {};
    p.loadout.gear = p.loadout.gear || {};
    p.usage = p.usage || {};
    const refunds = {pikewall: 120, sentry: 100, backstop: 260, ram: 310, beacon: 125, supply: 95,
      longshot: 160, herald: 110, relay: 115, reactor: 165, dynamo: 110, requisition: 190, zaku: 100};
    (p.unlocks.cards || []).forEach(id => {
      if (refunds[id]) p.progress.credits = (p.progress.credits || 0) + refunds[id];
    });
    const swap = {scrambler: 'pyre', degausser: 'volt', lens: 'crystal'};
    const re = id => swap[id] || id;
    p.unlocks.cards = [...new Set((p.unlocks.cards || []).map(re))];
    p.loadout.deck = (p.loadout.deck || []).map(re);
    Object.keys(swap).forEach(old => {
      if (p.loadout.gear[old]) { p.loadout.gear[swap[old]] = p.loadout.gear[old]; delete p.loadout.gear[old]; }
      if (p.usage[old]) { p.usage[swap[old]] = (p.usage[swap[old]] || 0) + p.usage[old]; delete p.usage[old]; }
    });
  }

  // v16: the Fireteam line. The generic Fireteam and its four kits refund;
  // the four named teams and six armour abilities are bought fresh.
  if (p.version < 16) {
    p.version = 16;
    p.unlocks = p.unlocks || {};
    p.progress = p.progress || {};
    const refunds = {fireteam: 300, noble: 170, shadow: 170, osiris: 180, majestic: 180};
    (p.unlocks.cards || []).forEach(id => {
      if (refunds[id]) p.progress.credits = (p.progress.credits || 0) + refunds[id];
    });
  }

  // v17: a run's node types are rolled once and stored, so an operation
  // dealt before its boss existed still ends in an Extraction. Retype the
  // final node of every stored run to the boss its operation now has.
  if (p.version < 17) {
    p.version = 17;
    const bossOf = {};
    Object.entries(BOSSDEF).forEach(([k, b]) => { if (b.op && !b.sub) bossOf[b.op] = k; });
    Object.entries(p.ops || {}).forEach(([op, run]) => {
      const map = OPS[op];
      if (!map || !bossOf[op] || !run || !run.nodes) return;
      const fin = map.nodes.find(n => n.role === 'final');
      if (fin && run.nodes[fin.id] && run.nodes[fin.id].type !== 'boss') run.nodes[fin.id].type = 'boss';
    });
  }

  // v18: the Ordnance Drop became the X-Grenade — same slot, same price, new id.
  if (p.version < 18) {
    p.version = 18;
    p.unlocks = p.unlocks || {};
    p.loadout = p.loadout || {};
    p.usage = p.usage || {};
    const re = id => (id === 'ordnance' ? 'xgrenade' : id);
    p.unlocks.cards = [...new Set((p.unlocks.cards || []).map(re))];
    p.loadout.deck = (p.loadout.deck || []).map(re);
    (p.presets || []).forEach(pr => { if (pr && Array.isArray(pr.deck)) pr.deck = pr.deck.map(re); });
    if (p.usage.ordnance) { p.usage.xgrenade = (p.usage.xgrenade || 0) + p.usage.ordnance; delete p.usage.ordnance; }
  }

  // v19: the five Fireteam weapons moved from the deck into the armoury.
  // Anyone who bought them as cards is refunded; they buy them as gear now.
  if (p.version < 19) {
    p.version = 19;
    p.unlocks = p.unlocks || {};
    p.progress = p.progress || {};
    const refunds = {rocket: 190, shotgun: 180, sniper: 200, esword: 190, gravhammer: 190};
    (p.unlocks.cards || []).forEach(id => {
      if (refunds[id]) p.progress.credits = (p.progress.credits || 0) + refunds[id];
    });
    p.unlocks.cards = (p.unlocks.cards || []).filter(id => !refunds[id]);
  }

  // v20: the Fireteam weapon gear is cut. Refund at cost, unfit it.
  if (p.version < 20) {
    p.version = 20;
    p.unlocks = p.unlocks || {};
    p.progress = p.progress || {};
    p.loadout = p.loadout || {};
    const refunds = {"rocket": 190, "shotgun": 180, "sniper": 200, "esword": 190, "gravhammer": 190};
    (p.unlocks.gear || []).forEach(gi => {
      if (refunds[gi]) p.progress.credits = (p.progress.credits || 0) + refunds[gi];
    });
    p.unlocks.gear = (p.unlocks.gear || []).filter(gi => !refunds[gi]);
    Object.keys(p.loadout.gear || {}).forEach(c => { if (refunds[p.loadout.gear[c]]) delete p.loadout.gear[c]; });
  }

  // v21: operations remember they were cleared, permanently. `ops` holds the
  // run in progress and is thrown away by a replay, a reroll or an Ironman
  // wipe, so it could never answer "have I finished this one before?". The
  // record moves outside it — and back-fills from any stored run whose final
  // node is already cleared, which is the only evidence an old save carries.
  if (p.version < 21) {
    p.version = 21;
    p.opsDone = p.opsDone || {};
    Object.entries(p.ops || {}).forEach(([op, run]) => {
      const map = OPS[op];
      if (!map || !run || !Array.isArray(run.cleared)) return;
      const fin = map.nodes.find(n => n.role === 'final');
      if (fin && run.cleared.includes(fin.id)) p.opsDone[op] = true;
    });
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

  // The Proto Frame slot sits beside the deck, not inside it. Anything that
  // ended up in the twelve — a v6 save, a pack drop from before the slot
  // existed — moves out rather than being deleted.
  const strayFrame = p.loadout.deck.find(c => POOL[c] && POOL[c].chassis === 'proto');
  p.loadout.frame = POOL[p.loadout.frame] && POOL[p.loadout.frame].chassis === 'proto'
    ? p.loadout.frame : (strayFrame || null);
  p.loadout.deck = p.loadout.deck.filter(c => !(POOL[c] && POOL[c].chassis === 'proto'));

  // Strip anything that points at content we no longer ship — and gear
  // fitted to a card that no longer has a slot for it (kit cards, calls,
  // instants, attachments, the Frames themselves).
  p.loadout.deck = p.loadout.deck.filter(c => POOL[c]);
  p.unlocks.cards = p.unlocks.cards.filter(c => POOL[c]);
  Object.keys(p.loadout.gear).forEach(k => {
    const card = POOL[k];
    const slotless = card && (card.frameGear || card.strat || card.instant
      || card.attach || card.chassis === 'proto');
    if (!GEAR[p.loadout.gear[k]] || !card || slotless) delete p.loadout.gear[k];
  });

  p.stats = p.stats || {deployments: 0, held: 0, lost: 0, breaches: 0, kills: 0, unitsLost: 0};
  p.stats.opsCleared = p.stats.opsCleared || 0;
  p.ops = p.ops || {};
  p.opsDone = (p.opsDone && typeof p.opsDone === 'object') ? p.opsDone : {};
  Object.keys(p.opsDone).forEach(k => { if (!OPS[k]) delete p.opsDone[k]; });
  p.op = OPS[p.op] ? p.op : 'ironveil';
  p.mode = p.mode || 'campaign';
  p.bests = p.bests || {onslaught: 0, gauntlet: 0};
  p.bests.run = p.bests.run || 0;
  p.bests.runsDone = p.bests.runsDone || 0;
  p.gaunt = p.gaunt || null;

  // A Deep Run survives a save round trip whole — it is plain data and holds
  // no references into the profile. What it can hold is content we no longer
  // ship, so those entries are dropped; a run whose map did not survive is
  // dropped entirely rather than half-restored into something unplayable.
  if (p.run && typeof p.run === 'object' && p.run.map
    && Array.isArray(p.run.map.nodes) && p.run.map.nodes.length
    && p.run.nodes && typeof p.run.nodes === 'object') {
    p.run.cleared = Array.isArray(p.run.cleared) ? p.run.cleared : [];
    p.run.deck = (Array.isArray(p.run.deck) ? p.run.deck : []).filter(c => POOL[c]);
    p.run.gear = (p.run.gear && typeof p.run.gear === 'object') ? p.run.gear : {};
    Object.keys(p.run.gear).forEach(k => {
      if (!POOL[k] || !GEAR[p.run.gear[k]]) delete p.run.gear[k];
    });
    p.run.lead = LEADS[p.run.lead] ? p.run.lead : null;
    p.run.depth = p.run.depth || 0;
    p.run.over = !!p.run.over;
  } else {
    p.run = null;
  }
  p.usage = p.usage || {};
  p.settings = p.settings || {};
  // Saved decks: name, the twelve, the Frame slot. Never more than a handful.
  p.presets = Array.isArray(p.presets) ? p.presets.filter(x => x && Array.isArray(x.deck)).slice(0, 6) : [];
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
