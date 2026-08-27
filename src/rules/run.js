// Campaign runs: the generated set of missions hanging off an operation's map,
// and which of its nodes are currently reachable.

import {MISSIONS} from '../content/missions.js';
import {MODS} from '../content/modifiers.js';
import {OPS} from '../content/operations.js';
import {active, MAPDEF, setActive, setMapdef} from '../state/session.js';
import {randInt, chance} from '../state/rng.js';
import {commit} from '../save/profile.js';

/** Roll a fresh set of missions for the active operation. */
export function genRun() {
  if (!active) return;
  active.ops = active.ops || {};
  active.op = active.op || 'ironveil';
  if (!OPS[active.op]) active.op = 'ironveil';

  const types = Object.keys(MISSIONS);
  const mods = Object.keys(MODS);
  const map = OPS[active.op];
  const nodes = {};

  map.nodes.forEach((n, i) => {
    nodes[n.id] = {
      // The first node of an operation is always a straight Defend Stronghold,
      // so a new player meets the base rules before any variant.
      type: i === 0 ? 'stronghold' : types[randInt(types.length)],
      mod: chance(0.45) ? mods[1 + randInt(mods.length - 1)] : 'none',
      reward: 60 + randInt(5) * 15,
      salv: 3 + randInt(5),
    };
  });

  // The two objective missions are markedly harder; pay accordingly.
  Object.values(nodes).forEach(nd => {
    if (nd.type === 'crystals') { nd.reward = Math.round(nd.reward * 1.85) + 40; nd.salv += 4; }
    if (nd.type === 'specimens') { nd.reward = Math.round(nd.reward * 1.35); nd.salv += 2; }
  });

  active.ops[active.op] = {cleared: [], nodes};
}

/** The run in progress for the active operation, generating one if needed. */
export function opRun() {
  if (!active) return {cleared: [], nodes: {}};
  active.ops = active.ops || {};
  active.op = active.op || 'ironveil';
  if (!OPS[active.op]) active.op = 'ironveil';
  if (!active.ops[active.op]) genRun();
  return active.ops[active.op];
}

/**
 * 'clear' | 'open' | 'locked'. A node opens once any node joined to it by an
 * edge has been cleared; the first node of the map is open from the start.
 */
export function nodeState(id) {
  if (!active) return 'locked';
  const r = opRun();
  if (r.cleared.includes(id)) return 'clear';
  if (!r.cleared.length) return id === MAPDEF.nodes[0].id ? 'open' : 'locked';
  return MAPDEF.edges.some(([a, b]) =>
    (r.cleared.includes(a) && b === id) || (r.cleared.includes(b) && a === id)) ? 'open' : 'locked';
}

/**
 * Make `p` the profile being played. DOM-free: the renderer wraps this to also
 * switch to the hold screen.
 */
export function enterProfile(p) {
  setActive(p);
  p.op = p.op || 'ironveil';
  setMapdef(p.op);
  if (!p.ops[p.op]) genRun();
  commit();
  return p;
}
