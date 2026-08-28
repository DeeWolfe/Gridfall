// The turn.
//
//   1. player deploys and acts     (immediate, irreversible — see actions.js)
//   2. anything untouched auto-fires, healers heal
//   3. hostiles act — each either MOVES or ATTACKS, never both
//   4. territory flips, plasma decays
//   5. win/loss checks
//   6. the previewed wave spawns in its promised lane
//   7. the next wave is rolled and previewed

import {LANES, COLS, MAXDP, MAXBREACH} from '../state/constants.js';
import {BEST} from '../content/hostiles.js';
import {G, active, nextUid, clearSelection, replaying} from '../state/session.js';
import {hooks} from '../state/hooks.js';
import {randInt} from '../state/rng.js';
import {leadOf} from '../save/progression.js';
import {unitAt, foeAt, civAt, held, heldEnemyHalf, crystalsHeld, scorched} from './board.js';
import {fire, healPass, dmgUnit, dmgEnemy, breachAt} from './combat.js';
import {eventTick, eventStrikeMalus} from './events.js';
import {wave, rollDoctrine, predictSpawns} from './waves.js';
import {spawnPhase} from './spawn.js';
import {drawCard} from './deck.js';
import {finish} from './mission.js';
import {clog} from './log.js';
import {tapeBegin, tapeEnd, tapeMark, tapeEvent} from './tape.js';
import {resolveStratagem} from './stratagems.js';

/** Step 2, then reset every unit for the turn ahead. */
export function playerPhase() {
  // Anything the player did not commit this turn falls back to firing.
  G.units.forEach(u => {
    if (u.fresh || u.acted) return;
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
        : '<span class="d">A civilian pod was destroyed.</span>', 'loss');
    }
    return;
  }
  let t = null;
  for (let c = e.col - 1; c >= 0; c--) {
    const u = unitAt(e.lane, c);
    if (u) { t = u; break; }
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

/** One hostile's action for the turn: it moves or it attacks, never both. */
function actHostile(e, chorus) {
  if (e.hp <= 0) return;
  if (e.stun) { e.stun--; return; }
  const D = BEST[e.k];

  if (D.spawn) { sporePulse(e, D); return; }
  if (D.spd === 0) return;

  // A Mender spends its turn healing the most wounded hostile in its lane;
  // with nothing to treat, it advances like the rest.
  if (D.mend) {
    const hurt = G.enemies
      .filter(o => o.uid !== e.uid && o.lane === e.lane && o.hp < BEST[o.k].hp)
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
  // An unarmed hostile blocked in traffic simply waits.
  if (blocked || queued) { if (D.dmg) strike(e, D, chorus, queued && !blocked); return; }

  // Fractional speeds bank movement across turns.
  e.mv = (e.mv || 0) + D.spd;
  let steps = 0;
  while (e.mv >= 1) { steps++; e.mv--; }

  for (let s = 0; s < steps; s++) {
    const nc = e.col - 1;
    if (nc < 0) {
      breachAt(e);
      break;
    }
    if (G.ter[e.lane][nc] === 'x') break;
    const stepUnit = unitAt(e.lane, nc);
    if ((stepUnit && !D.tunnel && !stepUnit.mine) || foeAt(e.lane, nc) || civAt(e.lane, nc)) break;
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
    if (D.convert) G.ter[e.lane][nc] = 'e';   // a Sovereign salts the earth
    if (D.hold !== undefined && e.col <= D.hold) break;
  }
}

/** Step 3. Each hostile either moves or attacks — never both in one turn. */
export function enemyPhase() {
  const chorus = G.enemies.some(e => BEST[e.k].aura) ? 1 : 0;
  [...G.enemies].forEach(e => {
    const moved = e.col;
    actHostile(e, chorus);
    // A frame per hostile that did anything visible: struck, spawned, or moved.
    tapeMark('enemy', e.col !== moved);
  });
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
    else if (u || civAt(l, c)) G.ter[l][c] = 'p';
  }
  Object.keys(G.scorch).forEach(k => {
    G.scorch[k]--;
    if (G.scorch[k] <= 0) delete G.scorch[k];
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

/** Losing conditions checked every turn, in the order the reference used. */
function lossCheck() {
  if (G.type === 'civilians' && G.civ.every(v => v.hp <= 0)) return 'All civilian pods lost.';
  if (G.breaches >= MAXBREACH) {
    return MAXBREACH === 1 ? 'The line was breached.' : MAXBREACH + ' breaches.';
  }
  if (held() < 6) return 'Ground lost — no viable deployment line.';
  return null;
}

/**
 * Objective checks once the last wave has been committed. `G.extra` counts the
 * turns since; three of them and an unmet objective is a failure.
 */
function endgameCheck() {
  if (G.type === 'retake') {
    if (heldEnemyHalf() >= 3) return {win: true};
    if (G.extra >= 3) return {win: false, why: 'Not enough hostile ground taken.'};
    return null;
  }
  if (G.type === 'crystals') {
    if (crystalsHeld() >= 3) return {win: true};
    if (G.extra >= 3) return {win: false, why: `Only ${crystalsHeld()} of 4 crystal nodes held.`};
    return null;
  }
  if (G.type === 'specimens') {
    if (G.quotaHit >= G.quota) return {win: true};
    if (G.extra >= 3) return {win: false, why: `Quota short — ${G.quotaHit} of ${G.quota}.`};
    return null;
  }
  if (G.type === 'uplink') {
    if (G.uplinkHeld >= 3) return {win: true};
    if (G.extra >= 3) return {win: false, why: 'The uplink never came online.'};
    return null;
  }
  if (G.type === 'blitz') {
    if (G.kills >= G.quota) return {win: true};
    if (G.extra >= 3) return {win: false, why: `Purge incomplete — ${G.kills} of ${G.quota} destroyed.`};
    return null;
  }
  if (!G.enemies.length || G.extra >= 2) return {win: true};
  return null;
}

export function endTurn() {
  if (!G || G.over || !active || replaying) return;

  const lostBefore = G.lost;     // Firebrand pays out on blood spilt this cycle
  tapeBegin();
  playerPhase();
  enemyPhase();
  territoryPhase();
  tapeMark('territory', true);   // a deliberate beat as the tiles flip
  if (G.mod === 'crumble' && G.turn % 2 === 0) crumbleTick();

  const lost = lossCheck();
  if (lost) return finish(false, lost);
  if (G.type === 'specimens' && G.quotaHit >= G.quota) return finish(true);
  if (G.type === 'blitz' && G.kills >= G.quota) return finish(true);

  // The uplink counts CONSECUTIVE turns held — losing the tile resets it.
  if (G.type === 'uplink' && G.uplinkAt) {
    if (G.ter[G.uplinkAt.l][G.uplinkAt.c] === 'p') {
      G.uplinkHeld++;
      clog(G.uplinkHeld >= 3 ? '<span class="g">UPLINK ONLINE.</span>'
        : `<span class="g">Uplink charging</span> — ${G.uplinkHeld} of 3 turns held.`, 'order');
      if (G.uplinkHeld >= 3) return finish(true);
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

  if (!wasLast) {
    G.turn++;
    G.manifest = wave(G.turn);
    G.doctrine = rollDoctrine();
    predictSpawns();
    clog(`<span class="t">WAVE ${G.turn}</span> inbound — entry lanes marked.`, 'wave');
  } else {
    G.manifest = null;
    G.predict = [];
    G.extra++;
    if (G.extra === 1) clog('<span class="t">LAST WAVE COMMITTED</span> — hold the line.', 'wave');
    const verdict = endgameCheck();
    if (verdict) return finish(verdict.win, verdict.why);
  }

  G.dp = MAXDP;
  // Dynamos hum: +1 DP each, capped at +2 — greed has a ceiling.
  const dynamos = Math.min(2, G.units.filter(u => u.dynamo).length);
  if (dynamos) {
    G.dp += dynamos;
    clog(`<span class="g">Dynamo</span> — +${dynamos} deploy point${dynamos > 1 ? 's' : ''} generated.`, 'order');
  }
  if (G.event === 'supply') G.dp += 2;
  if (G.event === 'bombard') bombardStrike();
  if (G.event === 'research') spawnResearchTeam();
  if (leadOf().passive && leadOf().passive.n === 'Firebrand' && G.lost > lostBefore) {
    G.dp += 2;
    clog('<span class="g">Firebrand</span> — losses answered with +2 deploy points.', 'order');
  }
  for (let i = 0; i < 2; i++) drawCard();
  // The new turn has begun: last turn's call resolves, short effects expire.
  resolveStratagem();
  clearSelection();
  // The tape goes to whoever presents the game; the default hook declines and
  // we fall back to the plain redraw every harness expects.
  if (!hooks.turnResolved(tapeEnd())) hooks.invalidate();
}
