// Campaign runs: the generated set of missions hanging off an operation's map,
// and which of its nodes are currently reachable.

import {MISSIONS} from '../content/missions.js';
import {MODS} from '../content/modifiers.js';
import {OPS} from '../content/operations.js';
import {active, MAPDEF, setActive, setMapdef} from '../state/session.js';
import {randInt, chance} from '../state/rng.js';
import {commit} from '../save/profile.js';
import {bossForOp} from './boss.js';

/** Roll a fresh set of missions for the active operation. */
export function genRun() {
  if (!active) return;
  active.ops = active.ops || {};
  active.op = active.op || 'ironveil';
  if (!OPS[active.op]) active.op = 'ironveil';

  // Extraction is reserved for the final node — the way out is always the way
  // out, unless the operation has a boss, in which case the way out is through
  // it. Side objectives draw from the objective pool, Helldivers-style.
  const mainPool = Object.keys(MISSIONS).filter(t => t !== 'extract' && t !== 'boss');
  const sidePool = ['crystals', 'specimens', 'uplink', 'blitz'].filter(t => MISSIONS[t]);
  const mods = Object.keys(MODS);
  const map = OPS[active.op];
  const nodes = {};

  map.nodes.forEach(n => {
    const role = n.role || 'main';
    nodes[n.id] = {
      // A node can pin its mission type in the map data (an Archive that is
      // always an uplink, a rescue that is always civilians). Otherwise the
      // first node of an operation is always a straight Defend Stronghold,
      // so a new player meets the base rules before any variant.
      type: n.type || (role === 'start' ? 'stronghold'
        : role === 'final' ? (bossForOp(active.op) ? 'boss' : 'extract')
          : role === 'side' ? sidePool[randInt(sidePool.length)]
            : mainPool[randInt(mainPool.length)]),
      // A chapel node names its own boss; the run row carries it to launch.
      boss: n.boss || null,
      // An operation can name a signature modifier (Blackmarrow's tunnels
      // collapsing underfoot) — still a roll, just weighted toward the
      // theme instead of drawn flat from the full pool every time.
      // The first node teaches the base rules: no modifier, ever. Fog of War
      // on a first mission was also the quiet cause of a flaky test or two.
      mod: role === 'start' ? 'none' : chance(0.45)
        ? (map.modBias && chance(0.65) ? map.modBias : mods[1 + randInt(mods.length - 1)])
        : 'none',
      reward: 70 + randInt(5) * 20 + 5 + randInt(5),
    };
  });

  // The objective missions are markedly harder; pay accordingly.
  Object.values(nodes).forEach(nd => {
    if (nd.type === 'crystals') nd.reward = Math.round(nd.reward * 1.85) + 44;
    if (nd.type === 'specimens') nd.reward = Math.round(nd.reward * 1.55) + 2;
    if (nd.type === 'uplink') nd.reward = Math.round(nd.reward * 1.4) + 2;
    if (nd.type === 'blitz') nd.reward = Math.round(nd.reward * 1.25) + 2;
    if (nd.type === 'boss') nd.reward = Math.round(nd.reward * 2) + 60;
  });

  // A bonus side objective is a detour — it pays like one.
  map.nodes.forEach(n => {
    if (n.role !== 'side') return;
    nodes[n.id].reward = Math.round(nodes[n.id].reward * 1.5) + 3;
  });

  // A hot operation runs every wave over budget (see wave()) — and pays for
  // the trouble, node by node. A node can override the operation's heat when
  // its mission type can't carry the full load (a mandatory Crystals hold).
  // Crystals already pays for its objective by spreading a defence across
  // four points at once; stacking a hot operation's full wave tax on top
  // compounds two difficulties into one, so an auto-rolled Crystals node
  // caps at heat 1 the same way a hand-placed override already does at
  // Shallowhelm — a hand-set `n.heat` in the map data still wins outright.
  if (map.heat) {
    map.nodes.forEach(n => {
      const nd = nodes[n.id];
      let heat = n.heat != null ? n.heat : map.heat;
      if (nd.type === 'crystals' && n.heat == null) heat = Math.min(heat, 1);
      if (!heat) return;
      nd.heat = heat;
      nd.reward = Math.round(nd.reward * (1 + heat * 0.25)) + heat;
    });
  }

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
 * edge has been cleared AND its gate requirements (node.req) are met; the
 * first node of the map is open from the start.
 */
export function nodeState(id) {
  if (!active) return 'locked';
  const r = opRun();
  if (r.cleared.includes(id)) return 'clear';
  const def = MAPDEF.nodes.find(n => n.id === id);
  if (def && def.req && def.req.some(q => !r.cleared.includes(q))) return 'locked';
  if (!r.cleared.length) return id === MAPDEF.nodes[0].id ? 'open' : 'locked';
  return MAPDEF.edges.some(([a, b]) =>
    (r.cleared.includes(a) && b === id) || (r.cleared.includes(b) && a === id)) ? 'open' : 'locked';
}

/**
 * A node that adjacency alone would open, held shut only by its gate — the
 * map lists these with their reqText so the player knows what to go fix.
 */
export function reqBlocked(id) {
  if (!active) return false;
  const r = opRun();
  if (r.cleared.includes(id)) return false;
  const def = MAPDEF.nodes.find(n => n.id === id);
  if (!def || !def.req || !def.req.some(q => !r.cleared.includes(q))) return false;
  return MAPDEF.edges.some(([a, b]) =>
    (r.cleared.includes(a) && b === id) || (r.cleared.includes(b) && a === id));
}

/**
 * The operation is complete when its final node is cleared — bonus side
 * objectives are exactly that. Maps without a marked final (none ship, but
 * imported saves may carry odd data) fall back to all-nodes-cleared.
 */
export function opComplete() {
  if (!active) return false;
  const fin = MAPDEF.nodes.find(n => n.role === 'final');
  const r = opRun();
  return fin ? r.cleared.includes(fin.id) : r.cleared.length >= MAPDEF.nodes.length;
}

/**
 * Has this operation ever been cleared by this commander?
 *
 * Deliberately NOT opComplete(): that reads the run in progress, which a
 * replay, a reroll or an Ironman loss throws away. This reads the career
 * record, so the map still says "you have done this" on a fresh run.
 */
export const opCleared = k => opClears(k) > 0;

/**
 * How many times this operation has been cleared, for the whole career.
 *
 * It was a boolean until v2.43 and the count is what the payout curve reads:
 * the first clear pays full, and every one after it pays less (see
 * `campaignRate` in mission.js). A save from before the count exists reads
 * `true`, which `+` turns into 1 — the right answer for "cleared once".
 */
export const opClears = k => {
  const v = active && active.opsDone ? active.opsDone[k] : 0;
  return typeof v === 'number' ? v : (v ? 1 : 0);
};

/** Record a clear. Returns true only the FIRST time it is called for an
 * operation — which is what pays the first-clear packs. */
export function markOpCleared(k) {
  if (!active || !k) return false;
  active.opsDone = active.opsDone || {};
  const first = opClears(k) === 0;
  active.opsDone[k] = opClears(k) + 1;
  return first;
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
