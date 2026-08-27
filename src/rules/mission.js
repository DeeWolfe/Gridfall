// Starting a mission, and settling up when it ends.
//
// finish() computes the whole result — rewards, records, queued packs — and
// parks a description of it on `G.result`. It renders nothing: the presentation
// layer reads `G.result` when the showResult hook fires. That keeps the reward
// maths testable and the result card free to change shape.

import {LANES, COLS, MAXDP} from '../state/constants.js';
import {POOL} from '../content/cards.js';
import {BEST} from '../content/hostiles.js';
import {MISSIONS} from '../content/missions.js';
import {MODS} from '../content/modifiers.js';
import {G, active, setG, MAPDEF, clearSelection} from '../state/session.js';
import {shuffle, randInt, chance} from '../state/rng.js';
import {hooks} from '../state/hooks.js';
import {commit} from '../save/profile.js';
import {held, heldEnemyHalf, crystalsHeld} from './board.js';
import {wave, rollDoctrine, predictSpawns} from './waves.js';
import {opRun, genRun, opComplete} from './run.js';
import {queuePack} from './packs.js';
import {tapeEnd} from './tape.js';
import {seedStratagem} from './stratagems.js';
import {clog} from './log.js';

/** Hostile types that can be set as an Acquire Specimens quota. */
const QUOTA_TYPES = ['crawler', 'breacher', 'spitter', 'hulk'];

// The handoff shipped four legs and roughly one full clear in fifteen attempts.
// Three legs is the difference between a mode and a lottery ticket.
export const GAUNTLET_LEGS = 3;

/** Fresh, neutral-in-the-middle territory grid. */
function freshTerritory() {
  const ter = [];
  for (let l = 0; l < LANES; l++) {
    const row = [];
    for (let c = 0; c < COLS; c++) row.push(c < 3 ? 'p' : c > 4 ? 'e' : 'n');
    ter.push(row);
  }
  return ter;
}

/**
 * Start a mission. `nd` carries the node's type, modifier and payout, plus the
 * endless/gauntlet flags that change how finish() settles up.
 */
export function launchSpec(nd) {
  if (!active) return false;
  const m = MISSIONS[nd.type];
  if (!m) return false;

  const deck = active.loadout.deck.filter(c => POOL[c]);
  if (!deck.length) {
    hooks.notify('No deck', 'Your deck is empty. Build one in Squad before deploying.');
    return false;
  }

  setG({
    node: nd.node, type: nd.type, mod: nd.mod, reward: nd.reward, salv: nd.salv,
    heat: nd.heat || 0, endless: !!nd.endless, gauntlet: !!nd.gauntlet,
    waves: nd.endless ? 9999 : m.waves,
    turn: 1, dp: MAXDP, breaches: 0, over: false,
    ter: freshTerritory(), scorch: {},
    deck: shuffle([...deck]), hand: [], units: [], enemies: [],
    logs: [], kills: 0, lost: 0, extra: 0, doctrine: 'probe', leadUsed: false,
    civ: [], crystals: [], quota: 0, quotaK: null, quotaHit: 0,
    uplinkAt: null, uplinkHeld: 0,
    strat: null, freeDrop: 0,
    predict: [], held: [], result: null,
  });

  if (G.mod === 'breach') for (let c = 0; c < COLS; c++) G.ter[0][c] = 'x';
  if (G.type === 'civilians') G.civ = [{l: 1, c: 0, hp: 6}, {l: 2, c: 0, hp: 6}, {l: 3, c: 0, hp: 6}];
  // Two nodes start on player ground, two sit in the neutral band. Never in
  // hostile ground (c > 4) — holding a tile behind the spawn line all game is
  // a different mission than contesting the middle, and a much worse one.
  if (G.type === 'crystals') G.crystals = [{l: 0, c: 1}, {l: 1, c: 4}, {l: 3, c: 2}, {l: 4, c: 4}];
  if (G.type === 'specimens') {
    G.quotaK = QUOTA_TYPES[randInt(QUOTA_TYPES.length)];
    G.quota = BEST[G.quotaK].threat <= 2 ? 4 : 3;
  }
  // The relay tile sits in the neutral band, middle lanes — contested by
  // definition, and reachable without holding hostile ground.
  if (G.type === 'uplink') G.uplinkAt = {l: 1 + randInt(3), c: 4};
  if (G.type === 'blitz') G.quota = 9;

  for (let i = 0; i < Math.min(5, G.deck.length); i++) G.hand.push(G.deck.pop());
  seedStratagem();               // the lead's one call, outside the deck
  G.manifest = wave(1);
  G.doctrine = rollDoctrine();
  predictSpawns();
  clearSelection();

  clog(`<span class="t">${m.n.toUpperCase()}</span> — ${m.d}`);
  if (G.type === 'specimens') clog(`Quota: destroy <span class="d">${G.quota} ${BEST[G.quotaK].n}</span>.`);
  if (G.type === 'uplink') clog(`Relay tile marked — lane ${G.uplinkAt.l + 1}, col ${G.uplinkAt.c}. Hold it three turns running.`);
  if (G.type === 'blitz') clog(`Quota: <span class="d">${G.quota}</span> hostiles destroyed before the waves run out.`);
  if (G.mod !== 'none') clog(`Modifier: <span style="color:var(--violet)">${MODS[G.mod].n}</span> ${MODS[G.mod].d}`);
  if (G.heat) clog(`<span class="d">Deep-zone operation</span> — hive pressure +${G.heat} threat every wave.`);
  if (G.endless) clog('<span class="t">ONSLAUGHT</span> — the waves do not stop. See how far you get.');
  if (G.gauntlet) clog(`<span class="t">GAUNTLET ${active.gaunt.i + 1} of ${GAUNTLET_LEGS}</span> — one loss ends the chain.`);

  hooks.enterCombat();
  return true;
}

/** Campaign: launch the mission sitting on map node `nodeId`. */
export function launch(nodeId) {
  if (!active) return false;
  const nd = opRun().nodes[nodeId];
  if (!nd) return false;
  return launchSpec({node: nodeId, type: nd.type, mod: nd.mod, reward: nd.reward, salv: nd.salv, heat: nd.heat});
}

/** Onslaught: one board, waves that never stop and scale 1.9x each time. */
export function launchOnslaught() {
  if (!active) return false;
  return launchSpec({node: null, type: 'stronghold', mod: 'none', reward: 0, salv: 0, endless: true});
}

/** Gauntlet: three missions back to back. One loss ends the chain. */
export function launchGauntlet() {
  if (!active) return false;
  if (!active.gaunt || active.gaunt.i >= GAUNTLET_LEGS) {
    const types = Object.keys(MISSIONS);
    const mods = Object.keys(MODS);
    active.gaunt = {
      i: 0,
      // The first leg comes clean; the modifiers ramp in behind it. With the
      // full bestiary in the pool, three modified legs stopped being a mode.
      legs: Array.from({length: GAUNTLET_LEGS}, (_, i) => ({
        type: types[randInt(types.length)],
        mod: i > 0 && chance(0.5) ? mods[1 + randInt(mods.length - 1)] : 'none',
      })),
    };
    commit();
  }
  const leg = active.gaunt.legs[active.gaunt.i];
  return launchSpec({
    node: null, type: leg.type, mod: leg.mod,
    reward: 80 + active.gaunt.i * 50,
    salv: 5 + active.gaunt.i * 2,
    gauntlet: true,
  });
}

/** Walk away mid-mission. A gauntlet run is forfeit. */
export function abortMission() {
  const wasEndless = G && G.endless;
  const wasGauntlet = G && G.gauntlet;
  if (wasGauntlet) active.gaunt = null;
  setG(null);
  clearSelection();
  commit();
  return {wasEndless, wasGauntlet};
}

/** The objective line shown in the combat header. */
export function objText() {
  const m = MISSIONS[G.type];
  if (G.type === 'retake') return `Hostile tiles held: ${heldEnemyHalf()} / 3`;
  if (G.type === 'crystals') return `Crystal nodes held: ${crystalsHeld()} / 4 — need 3`;
  if (G.type === 'specimens') return `${BEST[G.quotaK].n} destroyed: ${G.quotaHit} / ${G.quota}`;
  if (G.type === 'uplink') return `Uplink held: ${G.uplinkHeld} / 3 turns running`;
  if (G.type === 'blitz') return `Hostiles destroyed: ${G.kills} / ${G.quota}`;
  if (G.type === 'civilians') return `Civilian pods alive: ${G.civ.filter(v => v.hp > 0).length} / 3`;
  return m.d;
}

function settleOnslaught() {
  const previous = active.bests.onslaught || 0;
  const best = Math.max(previous, G.turn);
  const record = best > previous;
  active.bests.onslaught = best;

  const cr = G.turn * 12;
  const sv = Math.floor(G.turn * 1.5);
  active.progress.credits += cr;
  active.progress.salvage += sv;
  active.stats.deployments++;
  active.stats.kills += G.kills;
  commit();

  for (let i = 0; i < Math.floor(G.turn / 5); i++) queuePack('standard', `Onslaught · wave ${(i + 1) * 5}`);

  return {
    kind: 'lose', cleared: false, title: 'ONSLAUGHT ENDED',
    lines: [
      `Waves survived · <b style="color:var(--cyan)">${G.turn}</b>${record ? ' — new best' : ''}`,
      `Personal best · ${active.bests.onslaught}`,
      `Hostiles destroyed · ${G.kills}`,
    ],
    payout: {cr, sv},
  };
}

function settleGauntlet(win, why) {
  let cr = 0;
  let sv = 0;
  let title;

  if (win) {
    active.gaunt.i++;
    cr = G.reward;
    sv = G.salv;
    active.progress.credits += cr;
    active.progress.salvage += sv;
    active.stats.held++;
    const done = active.gaunt.i >= GAUNTLET_LEGS;
    queuePack('standard', 'Gauntlet leg cleared');
    if (done) {
      active.bests.gauntlet = (active.bests.gauntlet || 0) + 1;
      cr += 250;
      active.progress.credits += 250;
      active.gaunt = null;
      queuePack('specialist', 'Gauntlet complete');
    }
    title = done ? 'GAUNTLET COMPLETE' : `LEG ${active.gaunt ? active.gaunt.i : GAUNTLET_LEGS} CLEARED`;
  } else {
    active.gaunt = null;
    active.stats.lost++;
    title = 'GAUNTLET BROKEN';
  }

  active.stats.deployments++;
  active.stats.kills += G.kills;
  commit();

  return {
    kind: win ? 'win' : 'lose',
    cleared: win,
    title,
    lines: [why, `Hostiles destroyed · ${G.kills}`, `Units lost · ${G.lost}`].filter(Boolean),
    payout: win ? {cr, sv} : null,
  };
}

function settleCampaign(win, why) {
  let cr = 0;
  let sv = 0;

  if (win) {
    cr = G.reward;
    sv = G.salv + Math.floor(G.kills / 5);
    active.progress.credits += cr;
    active.progress.salvage += sv;
    opRun().cleared.push(G.node);
    active.stats.held++;
    active.progress.xp += 20;
    if (active.progress.xp >= active.progress.rank * 60) active.progress.rank++;
    // A pack every second node secured — the drip that filled the collection
    // in a weekend when it came with every win.
    active.progress.packMeter = (active.progress.packMeter || 0) + 1;
    if (active.progress.packMeter >= 2) {
      active.progress.packMeter = 0;
      queuePack('standard', 'Node secured');
    }
    if (opComplete()) {
      active.stats.opsCleared = (active.stats.opsCleared || 0) + 1;
      queuePack('specialist', MAPDEF.n + ' complete');
    }
  } else {
    active.stats.lost++;
    if (active.ironman) { genRun(); clog('Ironman — operation reset.'); }
  }

  active.stats.deployments++;
  active.stats.kills += G.kills;
  active.stats.unitsLost += G.lost;
  active.stats.breaches += G.breaches;
  commit();

  return {
    kind: win ? 'win' : 'lose',
    cleared: win,
    title: win ? 'OBJECTIVE SECURED' : 'OPERATION FAILED',
    lines: [why, `Hostiles destroyed · ${G.kills}`, `Units lost · ${G.lost}`,
      `Ground held · ${held()} tiles`].filter(Boolean),
    payout: win ? {cr, sv} : null,
  };
}

/** End the mission, pay out, and describe the outcome on `G.result`. */
export function finish(win, why) {
  tapeEnd();                     // the result card takes over; drop the tape
  G.over = true;
  G.result = G.endless ? settleOnslaught()
    : G.gauntlet ? settleGauntlet(win, why)
      : settleCampaign(win, why);
  hooks.showResult();
  hooks.invalidate();
}
