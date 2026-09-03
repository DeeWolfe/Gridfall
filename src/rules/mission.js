// Starting a mission, and settling up when it ends.
//
// finish() computes the whole result — rewards, records, queued packs — and
// parks a description of it on `G.result`. It renders nothing: the presentation
// layer reads `G.result` when the showResult hook fires. That keeps the reward
// maths testable and the result card free to change shape.

import {LANES, COLS, MAXDP, GROUND_FLOOR} from '../state/constants.js';
import {POOL} from '../content/cards.js';
import {BEST} from '../content/hostiles.js';
import {MISSIONS} from '../content/missions.js';
import {MODS} from '../content/modifiers.js';
import {G, active, setG, MAPDEF, clearSelection} from '../state/session.js';
import {shuffle, randInt, chance} from '../state/rng.js';
import {hooks} from '../state/hooks.js';
import {commit} from '../save/profile.js';
import {deckCapOf, leadOf, deckProblems} from '../save/progression.js';
import {held, heldEnemyHalf, crystalsHeld, breachAllowance, ENDGAME_TURNS} from './board.js';
import {wave, rollDoctrine, predictSpawns} from './waves.js';
import {opRun, genRun, opComplete} from './run.js';
import {queuePack} from './packs.js';
import {tapeEnd} from './tape.js';
import {seedFrame} from './frames.js';
import {seedBoss, bossHp} from './boss.js';
import {BOSSDEF} from '../content/bosses.js';
import {EVENTS, rollEvent} from './events.js';
import {clog} from './log.js';

/** Hostile types that can be set as an Acquire Specimens quota. */
const QUOTA_TYPES = ['crawler', 'breacher', 'spitter', 'hulk'];

// The handoff shipped four legs and roughly one full clear in fifteen attempts.
// Three legs is the difference between a mode and a lottery ticket.
export const GAUNTLET_LEGS = 3;

/** Node wins per free standard pack — the hold readout counts down to this. */
export const PACK_METER_GOAL = 3;

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
 * Roll the four crystal nodes fresh each mission, one per lane. Standard ops
 * keep the safe split — two on your own ground, two in the neutral band,
 * never hostile ground, so holding is still the game rather than a rout —
 * just randomized within it instead of the same four spots every time. A
 * deep-zone (heat) operation opens the whole board: any node can land past
 * the midline, in hostile ground, for a harder mission that has to be
 * fought for rather than sat on.
 */
function rollCrystals(heat) {
  const lanes = shuffle([0, 1, 2, 3, 4]).slice(0, 4);
  if (heat > 0) return lanes.map(l => ({l, c: randInt(COLS)}));
  const cols = [randInt(3), randInt(3), 3 + randInt(2), 3 + randInt(2)];
  return lanes.map((l, i) => ({l, c: cols[i]}));
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
  // A short-manifest lead (Coronet, Quartermaster) refuses a deck built over
  // its ceiling — caught here so it fails loudly at the door, not at deploy.
  if (deck.length > deckCapOf()) {
    hooks.notify('Deck over limit', `${leadOf().call} fields at most ${deckCapOf()} cards — ` +
      `your deck holds ${deck.length}. Trim it in Squad or change leads.`);
    return false;
  }
  // The one-line rule and Lone Spartan: warned on the Squad page, refused here.
  const broken = deckProblems(deck, active.loadout.frame);
  if (broken.length) {
    hooks.notify(broken[0].n, broken[0].d);
    return false;
  }

  setG({
    node: nd.node, op: nd.op || null, type: nd.type, mod: nd.mod, reward: nd.reward,
    // A map node can name its own boss (Shallowhelm's chapel sub-bosses);
    // without one, a boss mission falls back to the operation's final target.
    bossK: nd.boss || null,
    heat: nd.heat || 0, endless: !!nd.endless, gauntlet: !!nd.gauntlet, daily: !!nd.daily,
    waves: nd.endless ? 9999 : m.waves,
    turn: 1, dp: Math.max(1, MAXDP + (leadOf().dpMod || 0)), breaches: 0, over: false,
    ter: freshTerritory(), scorch: {}, rubble: {}, burrowAt: null,
    // Fog of war rides the modifier; a boss fight is never fogged — the
    // machine IS the board, and hiding it would hide the fight.
    fog: nd.mod === 'fog' && nd.type !== 'boss', reveal: false,
    deck: shuffle([...deck]), hand: [], units: [], enemies: [],
    logs: [], kills: 0, lost: 0, extra: 0, doctrine: 'probe',
    capNoted: false,
    civ: [], crystals: [], quota: 0, quotaK: null, quotaHit: 0,
    civGoal: 0, extracts: 0,
    uplinkAt: null, uplinkHeld: 0,
    calls: [], frame: null, freeDrop: 0,
    gridCharge: Array(LANES).fill(1), event: null, eventNext: null,
    predict: [], held: [], result: null,
  });

  if (G.mod === 'breach') for (let c = 0; c < COLS; c++) G.ter[0][c] = 'x';
  if (G.type === 'civilians') {
    // The shelter anchors the lane it's in; harder ops (heat) ask for more
    // extracts and put survivors out faster (CIV_SPAWN_EVERY, phases.js) —
    // that's what raises the stakes, not a tougher shelter or walkers.
    // One survivor is already moving at the drop so turn 1 isn't dead air.
    const l = randInt(LANES);
    G.civ = [{l, c: 2, hp: 20, building: true}, {l, c: 1, hp: 4, walking: true}];
    G.civGoal = 3 + G.heat;
  }
  if (G.type === 'crystals') G.crystals = rollCrystals(G.heat);
  if (G.type === 'specimens') {
    G.quotaK = QUOTA_TYPES[randInt(QUOTA_TYPES.length)];
    G.quota = BEST[G.quotaK].threat <= 2 ? 4 : 3;
  }
  // The relay tile sits in the neutral band, middle lanes — contested by
  // definition, and reachable without holding hostile ground.
  if (G.type === 'uplink') G.uplinkAt = {l: 1 + randInt(3), c: 4};
  if (G.type === 'blitz') G.quota = 9;
  if (G.type === 'boss') {
    // A boss fight is its own weather: the machine spawns its own adds outside
    // the wave budget, field events sit the fight out, and the mission wants a
    // point more room per turn than a standard drop (boss-patch economy note).
    G.noEvents = true;
    G.dp = Math.max(1, MAXDP + 1 + (leadOf().dpMod || 0));
    seedBoss();
  }

  for (let i = 0; i < Math.min(5, G.deck.length); i++) G.hand.push(G.deck.pop());
  seedFrame();                   // the fielded Proto Frame, outside the deck
  // The first field event can land as early as turn 2 — telegraphed now.
  G.eventNext = G.noEvents ? null : rollEvent();
  if (G.eventNext) clog(`Field report: <span style="color:var(--violet)">${EVENTS[G.eventNext].n}</span> expected next turn.`, 'info');
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
  if (G.daily) clog(`<span class="t">DAILY CHALLENGE</span> — today's op. A loss does not cost your streak; only the win of the day does.`);

  hooks.enterCombat();
  return true;
}

/** Campaign: launch the mission sitting on map node `nodeId`. */
export function launch(nodeId) {
  if (!active) return false;
  const nd = opRun().nodes[nodeId];
  if (!nd) return false;
  return launchSpec({node: nodeId, op: active.op, type: nd.type, mod: nd.mod, reward: nd.reward, heat: nd.heat, boss: nd.boss});
}

/** Onslaught: one board, waves that never stop and scale 1.9x each time. */
export function launchOnslaught() {
  if (!active) return false;
  return launchSpec({node: null, type: 'stronghold', mod: 'none', reward: 0, endless: true});
}

/** Gauntlet: three missions back to back. One loss ends the chain. */
export function launchGauntlet() {
  if (!active) return false;
  if (!active.gaunt || active.gaunt.i >= GAUNTLET_LEGS) {
    // A boss encounter belongs to its operation's final node — the random
    // modes draw from everything else.
    const types = Object.keys(MISSIONS).filter(t => t !== 'boss');
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
  if (!MISSIONS[leg.type] || leg.type === 'boss') leg.type = 'stronghold';
  return launchSpec({
    node: null, type: leg.type, mod: leg.mod,
    reward: 85 + active.gaunt.i * 52,
    gauntlet: true,
  });
}

/** Calendar-day key in the commander's own local time, e.g. "2026-08-28". */
function dateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export const todayKey = () => dateKey(new Date());
const yesterdayKey = () => { const d = new Date(); d.setDate(d.getDate() - 1); return dateKey(d); };

// A small hash of the date string, not the shared gameplay RNG — every
// commander gets the same mission and modifier on a given day, but the
// spawns and cards inside that mission still shuffle fresh per attempt.
function dayHash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) >>> 0;
  return h;
}

function dailyPick(key) {
  const types = Object.keys(MISSIONS).filter(t => t !== 'boss');
  const mods = Object.keys(MODS).filter(k => k !== 'none');
  return {
    type: types[dayHash(key + ':type') % types.length],
    mod: mods[dayHash(key + ':mod') % mods.length],
  };
}

/** Daily challenge: one fixed mission+modifier per calendar day, for everyone. */
export function launchDaily() {
  if (!active) return false;
  const key = todayKey();
  const {type, mod} = dailyPick(key);
  const streak = Math.min((active.daily && active.daily.streak) || 0, 10);
  return launchSpec({
    node: null, type, mod, daily: true,
    reward: 128 + streak * 17,
  });
}

/** Walk away mid-mission. A gauntlet run is forfeit. */
export function abortMission() {
  const wasEndless = G && G.endless;
  const wasGauntlet = G && G.gauntlet;
  const wasDaily = G && G.daily;
  if (wasGauntlet) active.gaunt = null;
  setG(null);
  clearSelection();
  commit();
  return {wasEndless, wasGauntlet, wasDaily};
}

/**
 * The objective as an order rather than a scoreboard, plus live progress and
 * the two conditions that lose the mission.
 *
 * The header span this replaces printed a bare score — and was display:none
 * on every compact layout, so on a phone the objective was never on screen at
 * all. This answers "what am I doing", which is the question a player has on
 * turn one and never had anywhere to read. `total` of 0 means the goal has no countable progress —
 * surviving is not a tally — so the readout falls back to the wave clock.
 *
 * @returns {{goal:string, done:number, total:number, lose:string, clock:string}}
 */
export function objBrief() {
  const m = MISSIONS[G.type];
  const allow = breachAllowance(G.type);
  const lose = `Lose if you hold under <b>${GROUND_FLOOR}</b> tiles, or take <b>${allow}</b> breach${allow > 1 ? 'es' : ''}.`;
  // Past the last wave the wave counter is meaningless — what matters is how
  // many turns are left to finish the job.
  const left = ENDGAME_TURNS(G.type) - G.extra;
  const clock = G.endless ? `Wave ${G.turn}`
    : G.extra > 0 ? `Last wave committed — ${Math.max(0, left)} turn${left === 1 ? '' : 's'} to secure`
      : G.waves > 900 ? `Turn ${G.turn} — no clock`
        : `Wave ${Math.min(G.turn, G.waves)} / ${G.waves}`;

  // Every field here is stated the same way for the whole mission — the loss
  // terms never change, and the presentation no longer shows and hides them by
  // how close a threshold is. That conditional cost the panel a resize every
  // few turns, which shunted everything under it; the terms simply stay up.
  const b = (goal, done, total) => ({goal, done, total, lose, clock});
  switch (G.type) {
    case 'boss': {
      // The clock is the wave counter wearing its true name: running out of
      // turns is a loss here, not an endgame grace.
      const def = G.boss ? BOSSDEF[G.boss.k] : null;
      const name = G.boss ? BEST[G.boss.k].n : 'the target';
      if (G.waves > 900) {
        return b('Bring down ' + (G.boss ? BEST[G.boss.k].n : 'the target') + '. Beware when they become enraged.', 0, 0);
      }
      const left = Math.max(0, G.waves - G.turn + 1);
      return {
        goal: `Bring down ${name} before the clock runs out.`,
        done: def ? Math.max(0, def.hp - bossHp()) : 0, total: def ? def.hp : 1,
        lose: (G.boss && G.boss.shield > 0
          ? `Containment field at <b>${G.boss.shield}</b>. ` : '') + lose,
        clock: `Turn ${Math.min(G.turn, G.waves)} / ${G.waves} — ${left} left on the clock`,
      };
    }
    case 'retake':
      return b('Hold 3 tiles in hostile ground at the clock.', heldEnemyHalf(), 3);
    case 'crystals':
      return b('Hold 3 of the 4 crystal nodes at the clock.', crystalsHeld(), 3);
    case 'specimens':
      return b(`Destroy ${G.quota} ${BEST[G.quotaK].n}s. Other kills do not count.`, G.quotaHit, G.quota);
    case 'uplink':
      return b(`Hold the relay tile in lane ${G.uplinkAt.l + 1} for three turns running.`,
        G.uplinkHeld, 3);
    case 'blitz':
      return b(`Destroy ${G.quota} hostiles before the waves run out.`, G.kills, G.quota);
    case 'civilians': {
      const bld = G.civ.find(v => v.building);
      return {
        goal: `Walk ${G.civGoal} survivors out. Keep the shelter standing.`,
        done: G.extracts, total: G.civGoal,
        lose: `Shelter at <b>${bld ? bld.hp : 0}</b> hull. ` + lose, clock,
      };
    }
    case 'extract':
      return b('Short and heavy. Hold out to extraction.', 0, 0);
    default:
      return b(`Hold the line through all ${G.waves} waves.`, 0, 0);
  }
}

/** Why the mission was won — the line a loss has always had and a win never did. */
export function winWhy() {
  switch (G.type) {
    case 'boss': return G.waves > 900
      ? `${G.boss ? BEST[G.boss.k].n : 'The target'} destroyed on turn ${G.turn}. Both halves. All of it.`
      : `${G.boss ? BEST[G.boss.k].n : 'The target'} destroyed with ${Math.max(0, G.waves - G.turn)} turn${G.waves - G.turn === 1 ? '' : 's'} to spare.`;
    case 'retake': return `${heldEnemyHalf()} tiles held inside hostile ground.`;
    case 'crystals': return `${crystalsHeld()} of 4 crystal nodes held when the clock ran out.`;
    case 'specimens':
      return `Quota filled — ${G.quotaHit} ${BEST[G.quotaK].n}${G.quotaHit === 1 ? '' : 's'} destroyed.`;
    case 'uplink': return 'Uplink online — the relay held three turns running.';
    case 'blitz': return `Zone purged — ${G.kills} hostiles destroyed.`;
    case 'civilians': return `${G.extracts} survivors extracted, shelter intact.`;
    // Two genuinely different wins live here: you either outlasted the waves
    // or you cleared the field. Which one you got is the story of the mission,
    // and the card never said either.
    case 'extract': return G.enemies.length
      ? 'Extraction reached — the squad is out.'
      : 'Field cleared, then out. Nothing followed you.';
    default: return G.enemies.length
      ? `The line held. ${G.waves} waves, no breakthrough.`
      : 'Field cleared — nothing left standing.';
  }
}

function settleOnslaught() {
  const previous = active.bests.onslaught || 0;
  const best = Math.max(previous, G.turn);
  const record = best > previous;
  active.bests.onslaught = best;

  const cr = G.turn * 12 + Math.floor(G.turn * 1.5);
  active.progress.credits += cr;
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
    payout: {cr},
  };
}

function settleGauntlet(win, why) {
  let cr = 0;
  let title;

  if (win) {
    active.gaunt.i++;
    cr = G.reward;
    active.progress.credits += cr;
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
    title, why,
    lines: [`Hostiles destroyed · ${G.kills}`, `Units lost · ${G.lost}`],
    payout: win ? {cr} : null,
  };
}

function settleCampaign(win, why) {
  let cr = 0;

  if (win) {
    cr = G.reward + Math.floor(G.kills / 5);
    active.progress.credits += cr;
    opRun().cleared.push(G.node);
    active.stats.held++;
    active.progress.xp += 20;
    if (active.progress.xp >= active.progress.rank * 60) active.progress.rank++;
    // A pack every third node secured — slowed from every second (and,
    // before that, every) node once a bigger card pool alone wasn't enough
    // to keep the collection from finishing in a weekend.
    active.progress.packMeter = (active.progress.packMeter || 0) + 1;
    if (active.progress.packMeter >= PACK_METER_GOAL) {
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
    why,
    lines: [`Hostiles destroyed · ${G.kills}`, `Units lost · ${G.lost}`,
      `Ground held · ${held()} tiles`],
    payout: win ? {cr} : null,
  };
}

// Losing a daily attempt does not touch `active.daily` at all — same-day
// retries stay free, and only a win writes the date, so the streak can only
// ever be built or broken by a result that actually landed.
function settleDaily(win, why) {
  active.daily = active.daily || {date: null, done: false, streak: 0};
  const key = todayKey();
  const alreadyToday = active.daily.date === key && active.daily.done;
  let cr = 0;

  if (win && !alreadyToday) {
    const streak = active.daily.date === yesterdayKey() ? active.daily.streak + 1 : 1;
    active.daily = {date: key, done: true, streak};
    cr = G.reward;
    active.progress.credits += cr;
    active.stats.held++;
    queuePack(streak % 5 === 0 ? 'specialist' : 'standard', `Daily challenge · streak ${streak}`);
  } else if (!win) {
    active.stats.lost++;
  }

  active.stats.deployments++;
  active.stats.kills += G.kills;
  active.stats.unitsLost += G.lost;
  active.stats.breaches += G.breaches;
  commit();

  return {
    kind: win ? 'win' : 'lose',
    cleared: win,
    title: win ? (alreadyToday ? 'DAILY ALREADY CLEARED' : 'DAILY CHALLENGE CLEARED') : 'DAILY CHALLENGE FAILED',
    why,
    lines: [
      `Hostiles destroyed · ${G.kills}`, `Units lost · ${G.lost}`,
      win ? `Streak · ${active.daily.streak}${alreadyToday ? ' — already banked today' : ''}`
        : 'Loss doesn\'t cost the streak — try again today.',
    ].filter(Boolean),
    payout: win && !alreadyToday ? {cr} : null,
  };
}

/** End the mission, pay out, and describe the outcome on `G.result`. */
export function finish(win, why) {
  tapeEnd();                     // the result card takes over; drop the tape
  G.over = true;
  G.result = G.endless ? settleOnslaught()
    : G.gauntlet ? settleGauntlet(win, why)
      : G.daily ? settleDaily(win, why)
        : settleCampaign(win, why);
  hooks.showResult();
  hooks.invalidate();
}
