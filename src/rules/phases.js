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
import {leadOf} from '../save/progression.js';
import {unitAt, foeAt, civAt, held, heldEnemyHalf, crystalsHeld, scorched} from './board.js';
import {fire, healPass, dmgUnit, dmgEnemy} from './combat.js';
import {wave, rollDoctrine, predictSpawns} from './waves.js';
import {spawnPhase} from './spawn.js';
import {drawCard} from './deck.js';
import {finish} from './mission.js';
import {clog} from './log.js';
import {tapeBegin, tapeEnd, tapeMark, tapeEvent} from './tape.js';

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
  G.units.forEach(u => {
    u.acted = false;
    u.moved = false;
    u.fresh = false;
    if (u.tgt && !G.enemies.some(e => e.uid === u.tgt)) u.tgt = null;   // stale lock
    if (u.cd > 0) u.cd--;
    if (u.cycling > 0) u.cycling--;
    if (u.stun > 0) u.stun--;
    if (u.regenTicks > 0) { u.hp = Math.min(u.max, u.hp + 2); u.regenTicks--; }
    if (nanites) u.hp = Math.min(u.max, u.hp + 1);
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
  if (!t) return;
  // Any strike that is not against the adjacent cell arcs in — an I-Field
  // shrugs it off entirely. forecastThreat mirrors this; keep them together.
  if (t.ifield && t.col + t.size - 1 < e.col - 1) {
    clog(`${t.n}'s I-Field absorbed ${D.n}'s ranged fire.`, 'info');
    return;
  }
  dmgUnit(t, D.dmg + chorus, D.n + (pressing ? ' (pressing)' : ''), e);
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

  // Spitters stop at range and shell down the lane.
  if (D.hold !== undefined && e.col <= D.hold) { strike(e, D, chorus); return; }

  const ahead = e.col - 1;
  const aheadUnit = ahead >= 0 ? unitAt(e.lane, ahead) : null;
  // A minefield does not read as an obstacle — hostiles walk straight onto it.
  const blocked = ahead >= 0 && ((aheadUnit && !D.tunnel && !aheadUnit.mine) || civAt(e.lane, ahead));
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
      tapeEvent({type: 'breach', lane: e.lane});
      clog(`<span class="d">BREACH</span> — ${D.n} crossed the line.`, 'loss');
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
  if (!G || G.over || !active || replaying) return;

  tapeBegin();
  playerPhase();
  enemyPhase();
  territoryPhase();
  tapeMark('territory', true);   // a deliberate beat as the tiles flip

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
  // The tape goes to whoever presents the game; the default hook declines and
  // we fall back to the plain redraw every harness expects.
  if (!hooks.turnResolved(tapeEnd())) hooks.invalidate();
}
