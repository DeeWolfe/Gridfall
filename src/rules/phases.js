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
import {G, active, nextUid, clearSelection} from '../state/session.js';
import {hooks} from '../state/hooks.js';
import {leadOf} from '../save/progression.js';
import {unitAt, foeAt, civAt, held, heldEnemyHalf, crystalsHeld, scorched} from './board.js';
import {fire, healPass, dmgUnit, dmgEnemy} from './combat.js';
import {wave, rollDoctrine, predictSpawns} from './waves.js';
import {spawnPhase} from './spawn.js';
import {drawCard} from './deck.js';
import {finish} from './mission.js';
import {clog} from './log.js';

/** Step 2, then reset every unit for the turn ahead. */
export function playerPhase() {
  // Anything the player did not commit this turn falls back to firing.
  G.units.forEach(u => {
    if (u.fresh || u.acted) return;
    fire(u, false);
    healPass(u, false);
  });

  const nanites = leadOf().passive && leadOf().passive.n === 'Nanite Weave';
  G.units.forEach(u => {
    u.acted = false;
    u.moved = false;
    u.fresh = false;
    if (u.tgt && !G.enemies.some(e => e.uid === u.tgt)) u.tgt = null;   // stale lock
    if (u.cd > 0) u.cd--;
    if (u.stun > 0) u.stun--;
    if (u.regenTicks > 0) { u.hp = Math.min(u.max, u.hp + 2); u.regenTicks--; }
    if (nanites) u.hp = Math.min(u.max, u.hp + 1);
    if (u.regen) u.shield = Math.max(u.shield, u.shieldMax || 1);
  });
}

/** A hostile attacking rather than advancing. Civilians in front come first. */
export function strike(e, D, chorus, pressing) {
  const cv = civAt(e.lane, e.col - 1);
  if (cv) {
    cv.hp -= D.dmg + chorus;
    if (cv.hp <= 0) clog('<span class="d">A civilian pod was destroyed.</span>', 'loss');
    return;
  }
  let t = null;
  for (let c = e.col - 1; c >= 0; c--) {
    const u = unitAt(e.lane, c);
    if (u) { t = u; break; }
  }
  if (t) dmgUnit(t, D.dmg + chorus, D.n + (pressing ? ' (pressing)' : ''), e);
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

/** Step 3. Each hostile either moves or attacks — never both in one turn. */
export function enemyPhase() {
  const chorus = G.enemies.some(e => BEST[e.k].aura) ? 1 : 0;

  [...G.enemies].forEach(e => {
    if (e.hp <= 0) return;
    if (e.stun) { e.stun--; return; }
    const D = BEST[e.k];

    if (D.spawn) { sporePulse(e, D); return; }
    if (D.spd === 0) return;

    // Spitters stop at range and shell down the lane.
    if (D.hold !== undefined && e.col <= D.hold) { strike(e, D, chorus); return; }

    const ahead = e.col - 1;
    const blocked = ahead >= 0 && ((unitAt(e.lane, ahead) && !D.tunnel) || civAt(e.lane, ahead));
    const queued = ahead >= 0 && foeAt(e.lane, ahead);
    if (blocked || queued) { strike(e, D, chorus, queued && !blocked); return; }

    // Fractional speeds bank movement across turns.
    e.mv = (e.mv || 0) + D.spd;
    let steps = 0;
    while (e.mv >= 1) { steps++; e.mv--; }

    for (let s = 0; s < steps; s++) {
      const nc = e.col - 1;
      if (nc < 0) {
        G.breaches++;
        G.enemies = G.enemies.filter(x => x.uid !== e.uid);
        clog(`<span class="d">BREACH</span> — ${D.n} crossed the line.`, 'loss');
        break;
      }
      if (G.ter[e.lane][nc] === 'x') break;
      if ((unitAt(e.lane, nc) && !D.tunnel) || foeAt(e.lane, nc) || civAt(e.lane, nc)) break;
      if (scorched(e.lane, nc)) dmgEnemy(e, 2, 'Plasma');
      if (e.hp <= 0) break;
      e.col = nc;
      if (D.convert) G.ter[e.lane][nc] = 'e';   // a Sovereign salts the earth
      if (D.hold !== undefined && e.col <= D.hold) break;
    }
  });
}

/** Step 4. Tiles flip to whoever ends the turn on them; plasma burns down. */
export function territoryPhase() {
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
}

/** Losing conditions checked every turn, in the order the reference used. */
function lossCheck() {
  if (G.type === 'civilians' && G.civ.every(v => v.hp <= 0)) return 'All civilian pods lost.';
  if (G.breaches >= MAXBREACH) return 'Three breaches.';
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
  if (!G.enemies.length || G.extra >= 2) return {win: true};
  return null;
}

export function endTurn() {
  if (!G || G.over || !active) return;

  playerPhase();
  enemyPhase();
  territoryPhase();

  const lost = lossCheck();
  if (lost) return finish(false, lost);
  if (G.type === 'specimens' && G.quotaHit >= G.quota) return finish(true);

  const wasLast = G.turn >= G.waves;
  spawnPhase();                      // deliver exactly what the markers promised

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
  for (let i = 0; i < 2; i++) drawCard();
  clearSelection();
  hooks.invalidate();
}
