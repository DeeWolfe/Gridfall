// The turn.
//
//   1. player deploys and acts     (immediate, irreversible — see actions.js)
//   2. anything untouched auto-fires, healers heal
//   3. hostiles act — each either MOVES or ATTACKS, never both
//   4. territory flips, plasma decays
//   5. win/loss checks
//   6. the previewed wave spawns in its promised lane
//   7. the next wave is rolled and previewed

import {LANES, COLS, MAXDP, GROUND_FLOOR} from '../state/constants.js';
import {BEST} from '../content/hostiles.js';
import {G, active, nextUid, clearSelection, replaying} from '../state/session.js';
import {hooks} from '../state/hooks.js';
import {randInt} from '../state/rng.js';
import {leadOf} from '../save/progression.js';
import {unitAt, foeAt, civAt, held, heldEnemyHalf, crystalsHeld, scorched, breachAllowance, ENDGAME_TURNS} from './board.js';
import {fire, healPass, dmgUnit, dmgEnemy, breachAt} from './combat.js';
import {eventTick, eventStrikeMalus} from './events.js';
import {wave, rollDoctrine, predictSpawns, laneScore} from './waves.js';
import {spawnPhase, mkFoe} from './spawn.js';
import {drawCard} from './deck.js';
import {finish, winWhy} from './mission.js';
import {clog} from './log.js';
import {tapeBegin, tapeEnd, tapeMark, tapeEvent} from './tape.js';
import {resolveStratagem, resolveStratagemEnd} from './stratagems.js';
import {bossTick} from './boss.js';

/** Step 2, then reset every unit for the turn ahead. */
export function playerPhase() {
  // Anything the player did not commit this turn falls back to firing.
  // A mind-controlled unit isn't the player's to command — it sits this
  // fallback out; controlledUnitsAct() (enemyPhase) is what it does instead.
  G.units.forEach(u => {
    if (u.fresh || u.acted || u.controlled) return;
    fire(u, false);
    healPass(u, false);
    tapeMark('fire');            // one frame per unit that actually did something
  });

  const nanites = leadOf().passive && leadOf().passive.n === 'Nanite Weave';
  const fabrication = leadOf().passive && leadOf().passive.n === 'Field Fabrication';
  G.units.forEach(u => {
    u.acted = false;
    // Riptide reads last turn's repositioning during the coming enemy phase,
    // so the flag is stashed before the reset clears it.
    u.repositioned = u.moved;
    u.moved = false;
    u.fresh = false;
    if (u.tgt && !G.enemies.some(e => e.uid === u.tgt)) u.tgt = null;   // stale lock
    if (u.cd > 0) u.cd--;
    if (u.cycling > 0) u.cycling--;
    if (u.stun > 0) u.stun--;
    if (u.jam > 0) u.jam--;
    if (u.regenTicks > 0) { u.hp = Math.min(u.max, u.hp + 2); u.regenTicks--; }
    if (nanites) u.hp = Math.min(u.max, u.hp + 1);
    if (fabrication && u.tech) u.hp = Math.min(u.max, u.hp + 1);
    if (u.regen) u.shield = Math.max(u.shield, u.shieldMax || 1);
  });

  // Field support: an Engineer repairs the Tech unit ahead; a Forward Base
  // repairs its neighbours and hurries their cooldowns — but the extra step
  // never brings a cooldown to zero, Coolant Core stacked or not.
  G.units.forEach(u => {
    if (u.techBuff) {
      const t = G.units.find(o => o.lane === u.lane && o.col === u.col + u.size && o.tech);
      if (t && t.hp < t.max) t.hp = Math.min(t.max, t.hp + u.techBuff.repair);
    }
    if (u.sustain) {
      G.units.forEach(o => {
        if (o.uid === u.uid || Math.abs(o.lane - u.lane) + Math.abs(o.col - u.col) !== 1) return;
        if (o.hp < o.max) o.hp = Math.min(o.max, o.hp + u.sustain.repair);
        for (let i = 0; i < u.sustain.cooldown; i++) if (o.cd > 1) o.cd--;
      });
    }
  });

  // Stim Injector: the host burns 1 hull a turn, and yes, it can burn out.
  [...G.units].forEach(u => {
    if (!u.decay) return;
    u.hp -= 1;
    if (u.hp <= 0) {
      G.units = G.units.filter(x => x.uid !== u.uid);
      G.lost++;
      clog(`<span class="d">Stim Injector</span> burned out your ${u.n}.`, 'loss');
    }
  });
}

/** A hostile attacking rather than advancing. Civilians in front come first. */
export function strike(e, D, chorus, pressing) {
  const dmg = Math.max(1, D.dmg + chorus - eventStrikeMalus());
  const cv = civAt(e.lane, e.col - 1);
  if (cv) {
    cv.hp -= dmg;
    if (cv.hp <= 0) {
      clog(cv.research ? '<span class="d">Research Team lost — the specimen got away.</span>'
        : cv.building ? '<span class="d">The shelter was destroyed.</span>'
          : cv.walking ? '<span class="d">A civilian was caught in the open.</span>'
            : '<span class="d">A civilian pod was destroyed.</span>', 'loss');
    }
    return;
  }
  let t = null;
  for (let c = e.col - 1; c >= 0; c--) {
    const u = unitAt(e.lane, c);
    // A controlled unit still blocks the lane — it's just not a target the
    // Puppeteer's owner will shoot at.
    if (u) { if (!u.controlled) t = u; break; }
  }
  if (!t) return;
  // Any strike that is not against the adjacent cell arcs in — an I-Field
  // shrugs it off entirely. forecastThreat mirrors this; keep them together.
  if (t.ifield && t.col + t.size - 1 < e.col - 1) {
    clog(`${t.n}'s I-Field absorbed ${D.n}'s ranged fire.`, 'info');
    return;
  }
  dmgUnit(t, dmg, D.n + (pressing ? ' (pressing)' : ''), e);
}

/** Spore Node: release a Crawler into the first free cell behind it. */
function sporePulse(e, D) {
  e.acc = (e.acc || 0) + 1;
  if (e.acc < D.spawn) return;
  e.acc = 0;
  let c = e.col;
  while (c > 0 && (foeAt(e.lane, c) || unitAt(e.lane, c))) c--;
  if (c >= 0 && !foeAt(e.lane, c) && !unitAt(e.lane, c)) {
    G.enemies.push({uid: nextUid(), k: 'crawler', lane: e.lane, col: c,
      hp: BEST.crawler.hp, acc: 0, mv: 0, stun: 0, src: 'spore'});
    clog('<span class="d">Spore Node</span> released a Crawler.', 'wave');
  }
}

const MINDCTRL_TURNS = 2;

/** Puppeteer: seizes the nearest un-controlled friendly in its lane, turning
 * it against the player until it breaks free or the Puppeteer dies. Checked
 * ahead of the spd===0 return — its own stillness must not swallow the cast. */
function mindControlPulse(e, D) {
  e.acc = (e.acc || 0) + 1;
  if (e.acc < D.mindctrl) return;
  e.acc = 0;
  const targets = G.units.filter(u => u.lane === e.lane && !u.controlled);
  if (!targets.length) return;
  const t = targets.sort((a, b) => b.col - a.col)[0];   // closest to the Puppeteer
  t.controlled = true;
  t.ctrlTurns = MINDCTRL_TURNS;
  t.ctrlBy = e.uid;
  clog(`<span class="d">Puppeteer</span> seized control of ${t.n}.`, 'loss');
}

/**
 * Sideways.
 *
 * A hostile whose lane runs out — a bombardment crater it cannot cross, a
 * traffic jam behind a slower body — used to stand there until the obstacle
 * cleared, which turned a crater into a free permanent wall and let a Hulk
 * plug a lane for the whole mission. It steps into an open lane instead.
 *
 * The lane the horde ARRIVES in is still the promise the markers make (see
 * waves.js) — nothing re-rolls a spawn. This only governs what a body already
 * on the board does once its own road is shut.
 *
 * A player's unit standing in front is not a dead end and never triggers this:
 * that is the game. So is a civilian. Only terrain and other hostiles are.
 *
 * Preference order: a lane it can keep advancing down beats one that is merely
 * open, and among equals the softest lane wins — the same reading of the board
 * the spawn doctrine uses, so a flank is the horde being consistent rather than
 * the horde cheating.
 *
 * @param {boolean} loud whether the move is worth a log line — a crater
 *   rerouting the horde explains itself, a queue shuffling does not.
 * @returns {boolean} whether it actually moved
 */
function flankStep(e, D, loud) {
  // An emplacement is placed, not driven; a tunneller has no obstacles to dodge.
  if (!D.spd || D.tunnel) return false;
  const free = l => G.ter[l][e.col] !== 'x'
    && !unitAt(l, e.col) && !foeAt(l, e.col) && !civAt(l, e.col);
  const open = [e.lane - 1, e.lane + 1].filter(l => l >= 0 && l < LANES && free(l));
  if (!open.length) return false;

  const ahead = e.col - 1;
  const stuck = l => ahead >= 0 && (G.ter[l][ahead] === 'x' || foeAt(l, ahead));
  const to = open.map(l => ({l, v: (stuck(l) ? 100 : 0) + laneScore(l)}))
    .sort((a, b) => a.v - b.v)[0].l;

  const dir = to > e.lane ? 'down' : 'up';
  e.lane = to;
  tapeEvent({type: 'spawn', lane: to, col: e.col});
  if (loud) {
    clog(`<span class="d">${D.n}</span> broke ${dir} into lane ${to + 1} — its own was cratered.`, 'wave');
  }
  return true;
}

/**
 * How much softer an adjacent lane has to look before a `flank` hostile will
 * cross into it. Without a margin it would drift on rounding noise; with one
 * it commits to the thin lane and then holds it, because laneScore reads the
 * player's units and moving does not change them.
 */
const FLANK_GAIN = 1.5;

/**
 * The Oni Frame's signature: it does not wait to be stopped. Every step it
 * re-reads the line and crosses into the thinner lane while it still has the
 * choice — which is the whole counter-play, since it will always end up
 * wherever you left a gap.
 */
function seekFlank(e) {
  const free = l => G.ter[l][e.col] !== 'x'
    && !unitAt(l, e.col) && !foeAt(l, e.col) && !civAt(l, e.col);
  const best = [e.lane - 1, e.lane + 1]
    .filter(l => l >= 0 && l < LANES && free(l))
    .map(l => ({l, v: laneScore(l)}))
    .sort((a, b) => a.v - b.v)[0];
  if (!best || best.v + FLANK_GAIN > laneScore(e.lane)) return false;
  e.lane = best.l;
  tapeEvent({type: 'spawn', lane: best.l, col: e.col});
  return true;
}

/**
 * Whether a strike from here would land on anything. Mirrors strike()'s own
 * search, and exists so a hostile only trades a shot for a sidestep when the
 * shot was going to hit nothing. Keep the two in step.
 */
function hasStrikeTarget(e) {
  if (!BEST[e.k].dmg) return false;
  if (civAt(e.lane, e.col - 1)) return true;
  for (let c = e.col - 1; c >= 0; c--) {
    const u = unitAt(e.lane, c);
    if (u) return !u.controlled;
  }
  return false;
}

/** One hostile's action for the turn: it moves or it attacks, never both. */
function actHostile(e, chorus) {
  if (e.hp <= 0) return;
  if (e.stun) { e.stun--; return; }
  const D = BEST[e.k];

  if (D.spawn) { sporePulse(e, D); return; }
  if (D.mindctrl) { mindControlPulse(e, D); return; }
  if (D.spd === 0) return;

  // A Mender spends its turn healing the most wounded hostile in its lane;
  // with nothing to treat, it advances like the rest.
  if (D.mend) {
    // Boss proxies mirror a shared body pool — healing one directly would
    // desync the mirror, so the knitting never touches a boss cell.
    const hurt = G.enemies
      .filter(o => o.uid !== e.uid && o.lane === e.lane && !o.boss && o.hp < BEST[o.k].hp)
      .sort((a, b) => a.hp / BEST[a.k].hp - b.hp / BEST[b.k].hp)[0];
    if (hurt) {
      hurt.hp = Math.min(BEST[hurt.k].hp, hurt.hp + D.mend);
      clog(`<span class="d">Mender</span> knit ${D.mend} hull back into ${BEST[hurt.k].n}.`, 'wave');
      return;
    }
  }

  // Spitters stop at range and shell down the lane.
  if (D.hold !== undefined && e.col <= D.hold) { strike(e, D, chorus); return; }

  const ahead = e.col - 1;
  const aheadUnit = ahead >= 0 ? unitAt(e.lane, ahead) : null;
  // A minefield does not read as an obstacle — hostiles walk straight onto it.
  const blocked = ahead >= 0 && ((aheadUnit && !D.tunnel && !aheadUnit.mine) || civAt(e.lane, ahead));
  const queued = ahead >= 0 && foeAt(e.lane, ahead);
  // A body in front is a fight, not a wall — that is the whole game, and no
  // amount of open lane either side changes it.
  if (blocked) { if (D.dmg) strike(e, D, chorus); return; }
  // Queued behind another hostile with a shot to take: take it. Firing past
  // the body in front is the horde working as intended, and trading that for a
  // sidestep handed the player a measured 14 points of win rate.
  if (queued && hasStrikeTarget(e)) { if (D.dmg) strike(e, D, chorus, true); return; }

  // Fractional speeds bank movement across turns. A sidestep spends one of
  // those steps rather than the whole turn, so a Crawler flows round a crater
  // without losing tempo and a Hulk pays for the detour — which is the
  // difference between rerouting the horde and stalling it.
  e.mv = (e.mv || 0) + D.spd;
  let steps = 0;
  while (e.mv >= 1) { steps++; e.mv--; }

  let advanced = false;
  for (let s = 0; s < steps; s++) {
    // A flanker spends a step crossing before it spends one advancing.
    if (D.flank && seekFlank(e)) { advanced = true; continue; }
    const nc = e.col - 1;
    if (nc < 0) {
      breachAt(e);
      advanced = true;
      break;
    }
    // Cratered ground is a wall that never comes down, so the horde routes
    // round it rather than parking in front of it for the rest of the mission.
    if (G.ter[e.lane][nc] === 'x') {
      if (!flankStep(e, D, true)) break;
      advanced = true;
      continue;
    }
    const stepUnit = unitAt(e.lane, nc);
    if ((stepUnit && !D.tunnel && !stepUnit.mine) || civAt(e.lane, nc)) break;
    // Traffic: go round it if there is room, otherwise wait it out.
    if (foeAt(e.lane, nc)) {
      if (!flankStep(e, D, false)) break;
      advanced = true;
      continue;
    }
    // First body in detonates the minefield; the mine is spent either way.
    if (stepUnit && stepUnit.mine) {
      G.units = G.units.filter(x => x.uid !== stepUnit.uid);
      tapeEvent({type: 'clash', lane: e.lane, col: nc});
      clog(`<span class="d">${D.n}</span> walked onto a <span class="g">Minefield</span> — ${stepUnit.mine} damage.`, 'kill');
      dmgEnemy(e, stepUnit.mine, 'Minefield', true);
    }
    if (scorched(e.lane, nc)) dmgEnemy(e, 2, 'Plasma');
    if (e.hp <= 0) break;
    e.col = nc;
    advanced = true;
    if (D.convert) G.ter[e.lane][nc] = 'e';   // a Sovereign salts the earth
    if (D.hold !== undefined && e.col <= D.hold) break;
  }
  // Nowhere to go at all — no road forward, no lane either side. It still has
  // a weapon, and standing still is not a reason to holster it.
  //
  // `steps` guards this: a half-speed hostile banking its move has not been
  // stopped by anything, and letting it shell the lane on its off turn is a
  // quiet damage buff to every slow type on the board.
  if (steps > 0 && !advanced && D.dmg && e.hp > 0) strike(e, D, chorus);
}

/** Hijacked units fight for the hive: whichever of the player's own units
 * is nearest in-lane takes the hit. Unarmed types (Scouts, Medics) just
 * stand there controlled — nothing to hijack a weapon out of. */
function controlledUnitsAct() {
  G.units.filter(u => u.controlled && u.dmg > 0).forEach(u => {
    const targets = G.units.filter(o => o !== u && o.lane === u.lane && !o.controlled);
    if (!targets.length) return;
    const t = targets.sort((a, b) => Math.abs(a.col - u.col) - Math.abs(b.col - u.col))[0];
    dmgUnit(t, u.dmg, u.n + ' (hijacked)');
  });
}

/** Step 3. Each hostile either moves or attacks — never both in one turn. */
export function enemyPhase() {
  const chorus = G.enemies.some(e => BEST[e.k].aura) ? 1 : 0;
  [...G.enemies].forEach(e => {
    const wasCol = e.col;
    const wasLane = e.lane;
    actHostile(e, chorus);
    // A frame per hostile that did anything visible: struck, spawned, advanced
    // — or broke sideways into another lane, which is movement too.
    tapeMark('enemy', e.col !== wasCol || e.lane !== wasLane);
  });
  controlledUnitsAct();
}

/** Step 4. Tiles flip to whoever ends the turn on them; plasma burns down. */
export function territoryPhase() {
  // Bombardment rubble runs its own clock, separate from the permanent 'x'
  // Hull Breach/Crumbling Ground set — clear it back to neutral before the
  // flip pass below picks the tile up again on its own merits.
  Object.keys(G.rubble).forEach(k => {
    G.rubble[k]--;
    if (G.rubble[k] <= 0) {
      delete G.rubble[k];
      const [l, c] = k.split(',').map(Number);
      G.ter[l][c] = 'n';
    }
  });
  for (let l = 0; l < LANES; l++) for (let c = 0; c < COLS; c++) {
    if (G.ter[l][c] === 'x') continue;
    const u = unitAt(l, c);
    const e = foeAt(l, c);
    if (e && !scorched(l, c)) G.ter[l][c] = 'e';
    // A hijacked unit is fighting for the hive now — its tile flips with it.
    else if (u && u.controlled) G.ter[l][c] = 'e';
    else if (u || civAt(l, c)) G.ter[l][c] = 'p';
  }
  Object.keys(G.scorch).forEach(k => {
    G.scorch[k]--;
    if (G.scorch[k] <= 0) delete G.scorch[k];
  });
  G.units.filter(u => u.controlled).forEach(u => {
    u.ctrlTurns--;
    if (u.ctrlTurns > 0) return;
    u.controlled = false;
    u.ctrlBy = null;
    clog(`<span class="g">${u.n} breaks free</span> of the Puppeteer's hold.`, 'order');
  });
  // The Research Team event's clock — a plain civilian pod otherwise, ticking
  // down to extraction instead of just sitting there waiting to be lost.
  G.civ.filter(v => v.research && v.hp > 0).forEach(v => {
    v.timer--;
    if (v.timer > 0) return;
    G.civ = G.civ.filter(x => x !== v);
    active.progress.credits += 60;
    clog('<span class="g">Research team extracted</span> — specimen data logged, +60 credits.', 'order');
  });
}

/**
 * Crumbling Ground modifier: every couple of turns, one open tile collapses
 * for good — impassable to both sides for the rest of the mission, the same
 * 'x' Hull Breach sets at the start, just carved out mid-fight instead.
 * Never an objective tile (a crystal, the uplink relay) or one anything is
 * standing on, so it can't softlock a mission or bury a unit.
 */
function crumbleTick() {
  const open = [];
  for (let l = 0; l < LANES; l++) for (let c = 0; c < COLS; c++) {
    if (G.ter[l][c] === 'x') continue;
    if (unitAt(l, c) || foeAt(l, c) || civAt(l, c)) continue;
    if (G.crystals.some(x => x.l === l && x.c === c)) continue;
    if (G.uplinkAt && G.uplinkAt.l === l && G.uplinkAt.c === c) continue;
    open.push([l, c]);
  }
  if (!open.length) return;
  const [l, c] = open[randInt(open.length)];
  G.ter[l][c] = 'x';
  clog(`<span style="color:var(--violet)">Structural collapse</span> — lane ${l + 1}, col ${c + 1} is impassable now.`, 'order');
}

const RUBBLE_TURNS = 3;
const RESEARCH_HP = 5;
const RESEARCH_TURNS = 3;
const RESEARCH_REWARD = 60;

/**
 * The Bombardment event lands: a hive artillery strike on three consecutive
 * cells in one lane, direct damage to anything caught standing in it, then
 * rubble that blocks the same three tiles — both sides — for a few turns
 * after. Kept out of columns 5+ (deep hostile ground): the threat is to
 * ground you're actually contesting, not empty tiles neither side is near.
 */
function bombardStrike() {
  const l = randInt(LANES);
  const start = randInt(3); // a run of 3 somewhere inside columns 0-4
  clog('<span style="color:var(--violet)">BOMBARDMENT</span> inbound.', 'loss');
  for (let i = 0; i < 3; i++) {
    const c = start + i;
    const u = unitAt(l, c);
    if (u) dmgUnit(u, 6, 'Bombardment');
    G.ter[l][c] = 'x';
    G.rubble[l + ',' + c] = RUBBLE_TURNS;
  }
  clog(`Lane ${l + 1}, columns ${start + 1}-${start + 3} cratered — impassable for ${RUBBLE_TURNS} turns.`, 'loss');
}

/**
 * The Research Team event lands: a field team drops onto open neutral ground
 * to tag a specimen. It rides G.civ — same fragile, defend-in-place object a
 * civilian pod already is, so every hostile-targeting and territory rule
 * already treats it correctly — flagged `research` and carrying its own
 * countdown so territoryPhase() can extract it once it survives long enough.
 * Fizzles quietly if there's nowhere open to put it down.
 */
function spawnResearchTeam() {
  const open = [];
  for (let l = 0; l < LANES; l++) for (let c = 3; c <= 4; c++) {
    if (unitAt(l, c) || foeAt(l, c) || civAt(l, c)) continue;
    open.push([l, c]);
  }
  if (!open.length) return;
  const [l, c] = open[randInt(open.length)];
  G.civ.push({l, c, hp: RESEARCH_HP, research: true, timer: RESEARCH_TURNS});
  clog(`<span style="color:var(--violet)">Research Team</span> on the ground — lane ${l + 1}. Hold ${RESEARCH_TURNS} turns for extraction.`, 'order');
}

/**
 * The Burrow Breach event is announced the instant it becomes G.eventNext —
 * a full turn before it lands, same as every other event, but this one also
 * names a tile so the warning has somewhere to point. Drawn from ground you
 * actually hold; fizzles quietly if you hold none.
 */
function pickBurrowTile() {
  const open = [];
  for (let l = 0; l < LANES; l++) for (let c = 0; c < COLS; c++) {
    if (G.ter[l][c] === 'p') open.push([l, c]);
  }
  if (!open.length) { G.burrowAt = null; return; }
  const [l, c] = open[randInt(open.length)];
  G.burrowAt = {l, c};
}

/**
 * The Burrow Breach event lands: the marked tile gives way. Whatever is
 * standing on it falls through with the ground itself — not a hit, so a
 * shield, riposte or Phase Cloak has nothing to answer — then a burrower
 * claws up out of the breach and holds the cell.
 */
function burrowErupt() {
  if (!G.burrowAt) return;
  const {l, c} = G.burrowAt;
  G.burrowAt = null;
  const u = unitAt(l, c);
  if (u) {
    G.units = G.units.filter(x => x.uid !== u.uid);
    G.lost++;
    clog(`<span class="d">The ground opens under ${u.n}</span> — swallowed whole.`, 'loss');
  }
  G.enemies.push(mkFoe('burrower', l, c, BEST.burrower.hp));
  clog(`<span style="color:var(--violet)">Burrow Breach</span> — a burrower claws up at lane ${l + 1}.`, 'loss');
}

const CIV_SPAWN_HP = 4;
// A mission runs roughly 10 turns (waves + grace). Every-3-turns was the
// first cut and it under-shipped badly — 3 spawns can't reach a goal of 4,
// full stop, before anything even gets in a walker's way. Every turn, flat
// across heat, leaves real margin for losses along the way; the goal
// (civGoal, mission.js) is the difficulty knob instead of the spawn rate.
const CIV_SPAWN_EVERY = () => 1;

/**
 * Civilian Extract: every survivor the shelter puts out walks toward your
 * own edge one cell a turn — blocked by anything that would block a unit,
 * same as it holding still, so it just waits out a hostile or a crater
 * instead of forcing a crossing. Stepping off column 0 is the extraction.
 */
function civilianWalk() {
  [...G.civ].forEach(v => {
    if (!v.walking || v.hp <= 0) return;
    const nc = v.c - 1;
    if (nc < 0) {
      G.civ = G.civ.filter(x => x !== v);
      G.extracts++;
      clog(`<span class="g">Civilian extracted</span> — ${G.extracts} of ${G.civGoal} clear.`, 'order');
      return;
    }
    if (G.ter[v.l][nc] === 'x' || unitAt(v.l, nc) || foeAt(v.l, nc) || civAt(v.l, nc)) return;
    v.c = nc;
  });
}

/** The shelter puts out one more survivor, one cell clear of itself so the
 * two never share a tile. Fizzles quietly if that cell isn't open. */
function civilianSpawnTick() {
  const bld = G.civ.find(v => v.building && v.hp > 0);
  if (!bld || bld.c <= 0) return;
  const c = bld.c - 1;
  if (G.ter[bld.l][c] === 'x' || unitAt(bld.l, c) || foeAt(bld.l, c) || civAt(bld.l, c)) return;
  G.civ.push({l: bld.l, c, hp: CIV_SPAWN_HP, walking: true});
  clog('<span class="g">Civilians moving</span> — one more heading for extraction.', 'order');
}

/** Losing conditions checked every turn, in the order the reference used. */
function lossCheck() {
  if (G.type === 'civilians') {
    const bld = G.civ.find(v => v.building);
    if (!bld || bld.hp <= 0) return 'The shelter was destroyed.';
  }
  const allow = breachAllowance(G.type);
  if (G.breaches >= allow) {
    return allow === 1 ? 'The line was breached.' : allow + ' breaches.';
  }
  if (held() < GROUND_FLOOR) return 'Ground lost — no viable deployment line.';
  return null;
}

/**
 * Objective checks once the last wave has been committed. `G.extra` counts the
 * turns since; three of them and an unmet objective is a failure.
 */
function endgameCheck() {
  // A boss mission runs on a hard clock, not a wave count with a grace period:
  // the last turn ends and the target either fell (checked in endTurn, before
  // this) or it did not.
  if (G.type === 'boss') return {win: false, why: 'The clock ran out — the target still stands.'};
  if (G.type === 'retake') {
    if (heldEnemyHalf() >= 3) return {win: true, why: winWhy()};
    if (G.extra >= ENDGAME_TURNS(G.type)) return {win: false, why: 'Not enough hostile ground taken.'};
    return null;
  }
  if (G.type === 'crystals') {
    if (crystalsHeld() >= 3) return {win: true, why: winWhy()};
    // One extra endgame turn over every other objective type — the mission
    // spreads a defence across four points by design, so it earns a beat
    // longer to consolidate a hold before the clock calls it.
    if (G.extra >= ENDGAME_TURNS(G.type)) return {win: false, why: `Only ${crystalsHeld()} of 4 crystal nodes held.`};
    return null;
  }
  if (G.type === 'specimens') {
    if (G.quotaHit >= G.quota) return {win: true, why: winWhy()};
    if (G.extra >= ENDGAME_TURNS(G.type)) return {win: false, why: `Quota short — ${G.quotaHit} of ${G.quota}.`};
    return null;
  }
  if (G.type === 'uplink') {
    if (G.uplinkHeld >= 3) return {win: true, why: winWhy()};
    if (G.extra >= ENDGAME_TURNS(G.type)) return {win: false, why: 'The uplink never came online.'};
    return null;
  }
  if (G.type === 'blitz') {
    if (G.kills >= G.quota) return {win: true, why: winWhy()};
    if (G.extra >= ENDGAME_TURNS(G.type)) return {win: false, why: `Purge incomplete — ${G.kills} of ${G.quota} destroyed.`};
    return null;
  }
  if (G.type === 'civilians') {
    if (G.extracts >= G.civGoal) return {win: true, why: winWhy()};
    if (G.extra >= ENDGAME_TURNS(G.type)) return {win: false, why: `Extraction incomplete — ${G.extracts} of ${G.civGoal} got out.`};
    return null;
  }
  if (!G.enemies.length || G.extra >= ENDGAME_TURNS(G.type)) return {win: true, why: winWhy()};
  return null;
}

export function endTurn() {
  if (!G || G.over || !active || replaying) return;

  const lostBefore = G.lost;     // Firebrand pays out on blood spilt this cycle
  tapeBegin();
  playerPhase();
  enemyPhase();
  bossTick();                    // the boss's own script: fabrication, breaches, growth
  // A short-beat call (Breaching Charge) lands here: after the horde has moved,
  // before the tiles flip, so the column it clears is ground you then hold.
  resolveStratagemEnd();
  if (G.type === 'civilians') civilianWalk();
  territoryPhase();
  tapeMark('territory', true);   // a deliberate beat as the tiles flip
  if (G.mod === 'crumble' && G.turn % 2 === 0) crumbleTick();

  const lost = lossCheck();
  if (lost) return finish(false, lost);
  if (G.type === 'boss' && G.bossDown) return finish(true, winWhy());
  if (G.type === 'specimens' && G.quotaHit >= G.quota) return finish(true, winWhy());
  if (G.type === 'blitz' && G.kills >= G.quota) return finish(true, winWhy());
  if (G.type === 'civilians') {
    if (G.extracts >= G.civGoal) return finish(true, winWhy());
    if (G.turn % CIV_SPAWN_EVERY(G.heat) === 0) civilianSpawnTick();
  }

  // The uplink counts CONSECUTIVE turns held — losing the tile resets it.
  if (G.type === 'uplink' && G.uplinkAt) {
    if (G.ter[G.uplinkAt.l][G.uplinkAt.c] === 'p') {
      G.uplinkHeld++;
      clog(G.uplinkHeld >= 3 ? '<span class="g">UPLINK ONLINE.</span>'
        : `<span class="g">Uplink charging</span> — ${G.uplinkHeld} of 3 turns held.`, 'order');
      if (G.uplinkHeld >= 3) return finish(true, winWhy());
    } else if (G.uplinkHeld) {
      G.uplinkHeld = 0;
      clog('<span class="d">Relay tile lost — uplink charge reset.</span>', 'loss');
    }
  }

  const wasLast = G.turn >= G.waves;
  spawnPhase();                      // deliver exactly what the markers promised

  // The event clock advances BEFORE the next wave is rolled, so a surge or
  // dead-air event shapes the manifest it was telegraphed against.
  eventTick();
  // Burrow Breach names its tile the instant it's announced, not when it
  // lands — the warning needs a full turn on the board same as the event.
  if (G.eventNext === 'burrow') pickBurrowTile();

  if (!wasLast) {
    G.turn++;
    G.manifest = wave(G.turn);
    G.doctrine = rollDoctrine();
    predictSpawns();
    if (G.type === 'boss') {
      clog(`<span class="t">TURN ${G.turn}</span> — ${G.waves - G.turn + 1} left on the clock.`, 'wave');
    } else {
      clog(`<span class="t">WAVE ${G.turn}</span> inbound — entry lanes marked.`, 'wave');
    }
  } else {
    G.manifest = null;
    G.predict = [];
    G.extra++;
    if (G.extra === 1) clog('<span class="t">LAST WAVE COMMITTED</span> — hold the line.', 'wave');
    const verdict = endgameCheck();
    if (verdict) return finish(verdict.win, verdict.why);
  }

  G.dp = MAXDP + (G.type === 'boss' ? 1 : 0);   // a boss fight runs a point richer
  // Dynamos hum: +1 DP each, capped at +2 — greed has a ceiling.
  const dynamos = Math.min(2, G.units.filter(u => u.dynamo).length);
  if (dynamos) {
    G.dp += dynamos;
    clog(`<span class="g">Dynamo</span> — +${dynamos} deploy point${dynamos > 1 ? 's' : ''} generated.`, 'order');
  }
  if (G.event === 'supply') G.dp += 2;
  if (G.event === 'bombard') bombardStrike();
  if (G.event === 'research') spawnResearchTeam();
  if (G.event === 'burrow') burrowErupt();
  if (leadOf().passive && leadOf().passive.n === 'Firebrand' && G.lost > lostBefore) {
    G.dp += 2;
    clog('<span class="g">Firebrand</span> — losses answered with +2 deploy points.', 'order');
  }
  // The turn draw respects the hand cap: a held card is not discarded, it
  // stays on the deck. Said once when it starts happening rather than every
  // turn it keeps happening — the hand's own FULL chip is the standing
  // reminder, so repeating it here would just be filling the log.
  let drawn = 0;
  for (let i = 0; i < 2; i++) if (drawCard()) drawn++;
  if (drawn < 2 && !G.capNoted) {
    clog(`<span class="d">Hand full</span> — requisition is held back until you deploy. Nothing is lost.`, 'info');
  }
  G.capNoted = drawn < 2;
  // The new turn has begun: last turn's call resolves, short effects expire.
  resolveStratagem();
  clearSelection();
  // The tape goes to whoever presents the game; the default hook declines and
  // we fall back to the plain redraw every harness expects.
  if (!hooks.turnResolved(tapeEnd())) hooks.invalidate();
}
