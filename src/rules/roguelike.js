// The Deep Run: a generated roguelike run.
//
// The campaign asks what your collection can do. This asks what you can do with
// what the run hands you: a fixed five-card starter, a lead chosen from three,
// and everything after that drafted between nodes. Your unlocks are not
// consulted anywhere in here — that is the whole point of the mode, and it is
// why a commander who owns nine cards and one who owns eighty-six get the same
// game out of it.
//
// The map is generated rather than authored, but it is generated in exactly the
// shape an operation map has (`zones`, `nodes`, `edges`), so renderMap, the
// node-state walk and the map thumbnail all read it without knowing it is not
// one of the six. That compatibility is deliberate and worth preserving: the
// alternative was a second map renderer that would drift from the first.
//
// Difficulty is depth. `heat` is the dial the wave budget already respects, so
// a node four layers in is genuinely heavier rather than merely later.

import {MISSIONS} from '../content/missions.js';
import {MODS} from '../content/modifiers.js';
import {BOSSDEF} from '../content/bosses.js';
import {POOL} from '../content/cards.js';
import {GEAR} from '../content/gear.js';
import {LEADS} from '../content/leads.js';
import {DECKSIZE} from '../state/constants.js';
import {active} from '../state/session.js';
import {randInt, shuffle, chance} from '../state/rng.js';
import {commit} from '../save/profile.js';

/** What every run starts with. Five commons: a gun, eyes, a patch, a wall and
 * reach — enough to play turn one, not enough to have a plan yet. */
export const RUN_STARTER = ['rifle', 'scout', 'medic', 'wall', 'marks'];

/**
 * Layers between the drop and the target, inclusive of neither.
 *
 * Four or five layers all told. Six was the first shape and it was wrong twice
 * over: a mode where one loss ends everything cannot ask for six fights before
 * it pays, and six columns across a 440-wide canvas leaves 66px a node, which
 * is narrower than the shortest mission label.
 */
const RUN_MIDDLE_LAYERS = [2, 3];
/** Nodes per middle layer. Two is a choice; three is a choice with a cost. */
const RUN_LAYER_WIDTH = [2, 3];

/** The finales a run can end at — the six operation bosses. The four honor
 * guards are wing fights and stay in Crownring where they mean something. */
const RUN_BOSSES = Object.keys(BOSSDEF).filter(k => !BOSSDEF[k].sub);

/**
 * Node payout: a flat base plus this much per layer of depth.
 *
 * A run node pays more than a campaign node of the same shape, and it should:
 * the campaign lets you retreat to the hold, rebuild the deck and come back,
 * and a run does not. The whole run is forfeit the moment you lose, so the
 * question the mode asks — push one layer deeper or take the target now — has
 * to have a real number on both sides of it.
 */
const RUN_NODE_BASE = 55;
const RUN_NODE_DEPTH = 35;
export const runRewardAt = depth => RUN_NODE_BASE + depth * RUN_NODE_DEPTH;

/** Heat by depth: the drop is flat, and it climbs one step every two layers. */
export const runHeatAt = depth => Math.max(0, Math.floor((depth - 1) / 2));

/** The mission pool a run node draws from — everything but the boss fight. */
const runTypePool = () => Object.keys(MISSIONS).filter(t => t !== 'boss');

/**
 * Generate the run's map: a layered graph from one drop point to one target.
 *
 * Every node in a layer is joined to at least one in the next, and every node
 * in the next has at least one way in — so no branch is ever a dead end and no
 * node is unreachable. That is checked by the guard rather than assumed here.
 */
export function genRunMap() {
  const layers = [];
  layers.push(['n0']);
  const mid = RUN_MIDDLE_LAYERS[randInt(RUN_MIDDLE_LAYERS.length)];
  let id = 1;
  for (let l = 0; l < mid; l++) {
    const w = RUN_LAYER_WIDTH[randInt(RUN_LAYER_WIDTH.length)];
    layers.push(Array.from({length: w}, () => 'n' + id++));
  }
  layers.push(['n' + id]);

  // Positions on the same 440x300 canvas an operation map uses.
  const nodes = [];
  const X0 = 58;
  const X1 = 388;
  layers.forEach((row, li) => {
    const x = Math.round(X0 + (X1 - X0) * (li / (layers.length - 1)));
    row.forEach((nid, i) => {
      const span = 210;
      const y = row.length === 1 ? 150
        : Math.round(150 - span / 2 + (span * i) / (row.length - 1));
      nodes.push({id: nid, x, y});
    });
  });

  const edges = [];
  for (let l = 0; l < layers.length - 1; l++) {
    const from = layers[l];
    const to = layers[l + 1];
    // Everything downstream must be reachable...
    to.forEach((t, i) => edges.push([from[i % from.length], t]));
    // ...and every node upstream must lead somewhere.
    from.forEach((f, i) => {
      if (!edges.some(([a]) => a === f)) edges.push([f, to[i % to.length]]);
      // A second exit, sometimes, so a route is a real choice rather than a
      // corridor with scenery.
      if (to.length > 1 && chance(0.55)) {
        const t = to[(i + 1) % to.length];
        if (!edges.some(([a, b]) => a === f && b === t)) edges.push([f, t]);
      }
    });
  }

  const first = nodes[0];
  const last = nodes[nodes.length - 1];
  first.role = 'start';
  first.l = 'Drop Point';
  last.role = 'final';
  last.l = 'The Target';

  return {
    k: 'run',
    n: 'DEEP RUN',
    sub: 'Unsurveyed ground · one way in',
    col: '#9d6bff',
    zones: [
      {l: 'APPROACH', p: '18,58 156,44 168,150 152,258 22,244'},
      {l: 'DEEP GROUND', p: '160,44 300,50 312,150 296,254 156,258'},
      {l: 'THE TARGET', p: '304,50 424,62 428,240 300,254 314,150'},
    ],
    nodes,
    edges,
    lore: 'No survey, no briefing, no resupply. What you take in is what the ' +
      'ground gives you on the way down — and the thing at the far end of it ' +
      'has been waiting for somebody to walk this far.',
    layers,
  };
}

/** How many layers deep a node sits. The drop is depth 1. */
export function runDepthOf(map, nodeId) {
  const li = (map.layers || []).findIndex(row => row.includes(nodeId));
  return li < 0 ? 1 : li + 1;
}

/** Roll the mission sitting on every node of a generated map. */
function runNodeSpecs(map) {
  const pool = runTypePool();
  const mods = Object.keys(MODS).filter(k => k !== 'none');
  const out = {};
  map.nodes.forEach(n => {
    const depth = runDepthOf(map, n.id);
    if (n.role === 'start') {
      // The drop teaches the run's own rules with nothing else in the way.
      out[n.id] = {type: 'stronghold', mod: 'none', heat: 0, depth, reward: runRewardAt(depth)};
      return;
    }
    if (n.role === 'final') {
      out[n.id] = {type: 'boss', mod: 'none', heat: runHeatAt(depth), depth,
        reward: runRewardAt(depth), boss: RUN_BOSSES[randInt(RUN_BOSSES.length)]};
      return;
    }
    // Modifiers thicken with depth rather than arriving on a flat coin flip.
    const modChance = Math.min(0.75, 0.2 + depth * 0.12);
    out[n.id] = {
      type: pool[randInt(pool.length)],
      mod: chance(modChance) ? mods[randInt(mods.length)] : 'none',
      heat: runHeatAt(depth),
      depth,
      reward: runRewardAt(depth),
    };
  });
  return out;
}

/** The mission spec sitting on one run node. */
export function runNodeSpec(id) {
  const r = active && active.run;
  return r ? r.nodes[id] || null : null;
}

/** The run's deck ceiling — its own drafted lead's, never the profile's. */
export function runDeckCap() {
  const r = active && active.run;
  const L = r && LEADS[r.lead];
  return (L && L.deckCap) || DECKSIZE;
}

/** Is a run in progress? */
export const runActive = () => !!(active && active.run && !active.run.over);

/** The run's map, or null. */
export const runMap = () => (active && active.run ? active.run.map : null);

/**
 * Begin a fresh run. The deck is the starter and nothing else — no unlocks are
 * read, so this is identical for every commander on the roster.
 */
export function startRun() {
  if (!active) return null;
  const map = genRunMap();
  active.run = {
    map,
    nodes: runNodeSpecs(map),
    cleared: [],
    deck: [...RUN_STARTER],
    gear: {},
    lead: null,          // chosen from three at the first draft
    depth: 0,
    over: false,
  };
  commit();
  return active.run;
}

/** 'clear' | 'open' | 'locked' for a run node — the same walk the campaign map
 * uses, against the run's own cleared list. */
export function runNodeState(id) {
  const r = active && active.run;
  if (!r) return 'locked';
  if (r.cleared.includes(id)) return 'clear';
  if (!r.cleared.length) return id === r.map.nodes[0].id ? 'open' : 'locked';
  return r.map.edges.some(([a, b]) =>
    (r.cleared.includes(a) && b === id) || (r.cleared.includes(b) && a === id))
    ? 'open' : 'locked';
}

/** The run is won when the target falls. */
export function runComplete() {
  const r = active && active.run;
  if (!r) return false;
  const fin = r.map.nodes.find(n => n.role === 'final');
  return !!(fin && r.cleared.includes(fin.id));
}

/** Deepest layer the run has actually taken — what the payout is scaled by. */
export function runDepthReached() {
  const r = active && active.run;
  if (!r || !r.cleared.length) return 0;
  return Math.max(...r.cleared.map(id => runDepthOf(r.map, id)));
}

// ---- the draft --------------------------------------------------------------

const DRAFT_SIZE = 3;

/**
 * What the next draft offers.
 *
 * Leads first, once, because choosing who you are answering to is the run's
 * opening decision and it should not be buried behind a card. After that the
 * run drafts cards until the deck is full and gear once it is — so a full deck
 * turns the draft from "another body" into "make one of these better", which
 * is the shape the back half of a run wants.
 */
export function runDraftOffer() {
  const r = active && active.run;
  if (!r) return [];
  if (!r.lead) {
    return shuffle(Object.keys(LEADS)).slice(0, DRAFT_SIZE).map(id => ({kind: 'lead', id}));
  }
  if (r.deck.length < runDeckCap()) {
    // A Proto Frame is a deck-defining commitment and its kit is three more
    // cards; that is a whole run's worth of drafting and it stays out of this
    // slice rather than arriving as a card you cannot support.
    const pool = Object.keys(POOL).filter(id => {
      const k = POOL[id];
      if (k.chassis === 'proto' || k.frameGear) return false;
      if (r.deck.includes(id)) return false;
      return true;
    });
    return shuffle(pool).slice(0, DRAFT_SIZE).map(id => ({kind: 'card', id}));
  }
  const worn = new Set(Object.values(r.gear));
  const pool = Object.keys(GEAR).filter(gi => !worn.has(gi) && !GEAR[gi].fits && !GEAR[gi].frame);
  return shuffle(pool).slice(0, DRAFT_SIZE).map(id => ({kind: 'gear', id}));
}

/** Take one draft pick into the run. */
export function runDraftTake(pick) {
  const r = active && active.run;
  if (!r || !pick) return;
  if (pick.kind === 'lead') r.lead = pick.id;
  else if (pick.kind === 'card' && r.deck.length < runDeckCap()) r.deck.push(pick.id);
  else if (pick.kind === 'gear') {
    // Onto whichever card in the deck is carrying nothing; failing that, the
    // first that can take it at all.
    const fits = r.deck.filter(c => POOL[c] && POOL[c].hp);
    const bare = fits.find(c => !r.gear[c]);
    const host = bare || fits[0];
    if (host) r.gear[host] = pick.id;
  }
  commit();
}
