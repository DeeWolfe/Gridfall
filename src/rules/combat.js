// Damage: dealing it, taking it, and repairing it.

import {LANES, COLS} from '../state/constants.js';
import {POOL} from '../content/cards.js';
import {BEST} from '../content/hostiles.js';
import {G, active, nextUid} from '../state/session.js';
import {unitAt, foeAt, civAt, scorched} from './board.js';
import {buffOf, leadBonus, packBonus} from './units.js';
import {recycleLineCard} from './deck.js';
import {leadOf} from '../save/progression.js';
import {targetsFor, laneFloor} from './targeting.js';
import {eventTechBonus} from './events.js';
import {dmgBoss} from './boss.js';
import {salvageFrame} from './frames.js';
import {clog} from './log.js';
import {tapeEvent} from './tape.js';

/** Scramblers shave 1 off every hostile attack in their lane. Does not stack. */
/** The strongest damping field in the lane. Fields do not stack with each
 * other — two Scramblers are still one point off — but the value on the card
 * is honoured, which it was not while this read a flat 1. */
export const dampenIn = l => G.units.reduce((m, o) => (o.lane === l && o.dampen > m ? o.dampen : m), 0);

/** The Singer's hymn: a hostile standing within two cells of her strikes
 * softer. Reads the ATTACKER's position, so it is where the horde stands
 * that matters, not where it hits. Two Singers do not stack. */
export const hymnAt = (lane, col) => (lane === undefined || col === undefined ? 0
  : G.units.reduce((m, o) => (o.hymn > m && Math.max(Math.abs(o.lane - lane), Math.abs(o.col - col)) <= 2 ? o.hymn : m), 0));

/** A Cryo Projector halves every hostile's advance in its lane. Does not stack. */
export const chillFactor = l => (G.units.some(o => o.chill && o.lane === l) ? 0.5 : 1);

/**
 * Resonance Lenses standing strictly between a shooter and its mark, in the
 * one lane all three share, each add their boost to the hit. Direct fire only
 * in spirit — but the rule is honest geometry, so an indirect shell that
 * happens to cross the lens's cell rides the same wave.
 */
export function lensBonus(u, e) {
  if (e.lane !== u.lane) return 0;
  const front = u.col + u.size - 1;
  return G.units
    .filter(o => o.lensBoost && o.lane === u.lane && o.col > front && o.col < e.col)
    .reduce((s, o) => s + o.lensBoost, 0);
}

/** Record a first kill so the hostile's Database entry unlocks. */
function logContact(k) {
  if (active && !active.unlocks.enemies.includes(k)) active.unlocks.enemies.push(k);
}

/**
 * Apply `d` damage to a hostile. Armour floors subtract from it and always
 * leave at least 1 through, unless the source penetrates (`pen`).
 *
 * A boss proxy routes everything into the shared pool instead — no floors, no
 * instant kills, and the attacking unit rides along so a reflective boss knows
 * whose barrel to answer.
 */
export function dmgEnemy(e, d, src, pen, attacker) {
  if (e.boss) { dmgBoss(e, d, src, attacker); return; }
  const dealt = pen ? d : Math.max(1, d - laneFloor(e));
  e.hp -= dealt;
  tapeEvent({type: 'hit', foe: true, lane: e.lane, col: e.col, amount: dealt, died: e.hp <= 0});
  if (e.hp > 0) return;

  G.enemies = G.enemies.filter(x => x.uid !== e.uid);
  G.kills++;
  if (G.quotaK === e.k) G.quotaHit++;
  if (G.mod === 'scavenge') G.dp++;
  clog(`<span class="g">${src}</span> destroyed ${BEST[e.k].n}.`, 'kill');
  logContact(e.k);

  G.units.filter(u => u.ctrlBy === e.uid).forEach(u => {
    u.controlled = false;
    u.ctrlTurns = 0;
    u.ctrlBy = null;
    clog(`<span class="g">${u.n} breaks free</span> — its controller is dead.`, 'order');
  });

  const D = BEST[e.k];
  if (D.split) huskSplit(e, D.split);
  if (D.deathrush) screamerRush(e);
}

/**
 * A hostile crossing the line. Each lane carries one Last-Stand charge: the
 * first breach in a lane fires the defense grid instead of counting — the
 * breacher and every hostile in the lane are destroyed (through dmgEnemy, so
 * kills, quotas, splits and screams all resolve normally) and the lane goes
 * naked. Breaches in a spent lane count against the mission's allowance.
 */
export function breachAt(e, how) {
  G.enemies = G.enemies.filter(x => x.uid !== e.uid);
  if (G.gridCharge && G.gridCharge[e.lane]) {
    G.gridCharge[e.lane] = 0;
    tapeEvent({type: 'clash', lane: e.lane, col: 0});
    clog(`<span class="g">LAST-STAND PROTOCOL</span> — lane ${e.lane + 1}'s grid charge fires. The lane is swept clean.`, 'order');
    e.hp = 1;
    G.enemies.push(e);                    // back in play so the grid can claim it
    // The purge is a save, not a harvest: kills and quota progress it would
    // have earned are rolled back, though splits and screams still resolve.
    const kills = G.kills;
    const quota = G.quotaHit;
    // The grid saves the lane; it does not delete a boss standing in it.
    [...G.enemies].filter(x => x.lane === e.lane && !x.boss)
      .forEach(x => { if (x.hp > 0) dmgEnemy(x, 999, 'Defense Grid', true); });
    G.kills = kills;
    G.quotaHit = quota;
    return;
  }
  G.breaches++;
  tapeEvent({type: 'breach', lane: e.lane});
  clog(`<span class="d">BREACH</span> — ${BEST[e.k].n} ${how || 'crossed the line'}.`, 'loss');
}

/** A Husk falls apart: Crawlers spill into its cell and the free ground around it. */
function huskSplit(e, count) {
  const spots = [[e.lane, e.col], [e.lane, e.col + 1], [e.lane, e.col - 1],
    [e.lane - 1, e.col], [e.lane + 1, e.col]];
  let placed = 0;
  for (const [l, c] of spots) {
    if (placed >= count) break;
    if (l < 0 || l >= LANES || c < 0 || c >= COLS) continue;
    if (G.ter[l][c] === 'x' || unitAt(l, c) || foeAt(l, c) || civAt(l, c)) continue;
    // Tagged board-born: these were never promised by a spawn marker.
    G.enemies.push({uid: nextUid(), k: 'crawler', lane: l, col: c,
      hp: BEST.crawler.hp, mv: 0, acc: 0, stun: 0, src: 'husk'});
    placed++;
  }
  if (placed) clog(`<span class="d">The Husk falls apart</span> — ${placed} Crawler${placed > 1 ? 's' : ''} crawl out of the wreck.`, 'wave');
}

// A rush can kill (plasma, mines) and those kills must not scream in turn —
// one scream per causal chain keeps it resolvable.
let rushing = false;

/** A Screamer's death sends every hostile on the board one step forward. */
function screamerRush(e) {
  if (rushing) return;
  rushing = true;
  clog('<span class="d">THE SCREAM</span> — every hostile surges a step forward.', 'loss');
  [...G.enemies].sort((a, b) => a.col - b.col).forEach(o => {
    if (o.hp <= 0 || BEST[o.k].spd === 0) return;
    const nc = o.col - 1;
    if (nc < 0) {
      breachAt(o, 'carried over the line by the scream');
      return;
    }
    if (G.ter[o.lane][nc] === 'x') return;
    const su = unitAt(o.lane, nc);
    if ((su && !BEST[o.k].tunnel && !su.mine) || foeAt(o.lane, nc) || civAt(o.lane, nc)) return;
    if (su && su.mine) {
      G.units = G.units.filter(x => x.uid !== su.uid);
      clog(`<span class="d">${BEST[o.k].n}</span> surged onto a <span class="g">Minefield</span> — ${su.mine} damage.`, 'kill');
      dmgEnemy(o, su.mine, 'Minefield', true);
    }
    if (o.hp <= 0) return;
    if (scorched(o.lane, nc)) dmgEnemy(o, 2, 'Burning ground');
    if (o.hp <= 0) return;
    o.col = nc;
  });
  rushing = false;
}

/** 3x3 splash centred on (l, c). */
export function blast(l, c, d, src) {
  if (!d) return;
  G.enemies
    .filter(e => Math.abs(e.lane - l) <= 1 && Math.abs(e.col - c) <= 1)
    .forEach(e => dmgEnemy(e, d, src));
}

/**
 * Apply `d` damage to one of your units. Shields eat a whole blow each,
 * riposte answers back, and a Phase Cloak converts the first killing blow
 * into a single point of hull.
 */
export function dmgUnit(u, d, src, attacker) {
  // Firebrand's Exposed: her whole line takes +1. Added before the Scrambler's
  // shave so damping still buys exactly one point back.
  if (leadOf().con && leadOf().con.n === 'Exposed') d += 1;
  d = Math.max(1, d - dampenIn(u.lane) - (attacker ? hymnAt(attacker.lane, attacker.col) : 0));

  // Armor Lock: the blow lands on nothing at all — not even a riposte.
  if (u.locked) {
    clog(`<span class="g">Armor Lock</span> holds — ${u.n} takes nothing.`, 'info');
    return;
  }
  if (u.riposte && attacker && attacker.hp > 0) {
    dmgEnemy(attacker, u.riposte, u.n + ' riposte', false);
  }
  // Duel Protocol: the duelist cannot be touched until the player's next turn.
  if (u.dueled) {
    clog(`${u.n} slips the blow — Duel Protocol holds.`, 'info');
    return;
  }
  if (u.shield > 0) {
    u.shield--;
    u.att.shield = false;
    tapeEvent({type: 'shield', lane: u.lane, col: u.col});
    clog(`${u.n}'s shield held.`, 'loss');
    return;
  }

  u.hp -= d;
  tapeEvent({type: 'hit', foe: false, lane: u.lane, col: u.col, amount: d,
    died: u.hp <= 0 && !(u.phase && !u.phased)});
  if (u.hp <= 0 && u.phase && !u.phased) {
    u.phased = true;
    u.hp = 1;
    clog(`<span class="g">Phase Cloak</span> — ${u.n} slipped the killing blow.`, 'loss');
    return;
  }
  if (u.hp <= 0) {
    G.units = G.units.filter(x => x.uid !== u.uid);
    G.lost++;
    clog(`<span class="d">${src}</span> destroyed your ${u.n}.`, 'loss');
    salvageFrame(u);
    recycleLineCard(u);
  }
}

/**
 * Damage that goes around the shield: straight to hull, though a Phase Cloak
 * still converts a killing blow. Exists for the Prism's reflection, which the
 * brief specifies pierces shields and can kill.
 */
export function pierceUnit(u, d, src) {
  u.hp -= d;
  tapeEvent({type: 'hit', foe: false, lane: u.lane, col: u.col, amount: d,
    died: u.hp <= 0 && !(u.phase && !u.phased)});
  if (u.hp <= 0 && u.phase && !u.phased) {
    u.phased = true;
    u.hp = 1;
    clog(`<span class="g">Phase Cloak</span> — ${u.n} slipped the killing blow.`, 'loss');
    return;
  }
  if (u.hp <= 0) {
    G.units = G.units.filter(x => x.uid !== u.uid);
    G.lost++;
    clog(`<span class="d">${src}</span> destroyed your ${u.n}.`, 'loss');
    salvageFrame(u);
    recycleLineCard(u);
  } else {
    clog(`<span class="d">${src}</span> — ${d} into ${u.n}, past any shield.`, 'info');
  }
}

/**
 * Fire this unit's weapon. `onPlay` swaps in the card's opening burst value —
 * gear damage rides along on top of it — and a Shoulder Cannon fires twice.
 */
export function fire(u, onPlay) {
  // A jammed weapon (the Conduit's arc, the Communion's dynamo hymn) sits
  // out the turn — the soldier still moves; only the gun is dead.
  if (u.tg === 'none' || !u.dmg || u.stun || u.jam) return;
  const k = POOL[u.id];
  const pristine = u.pristine && u.hp >= u.max ? u.pristine : 0;
  const gearBonus = u.dmg - (k.dmg || 0);
  // Resonance Core: the frame swings harder for every hostile at its side.
  const resonance = u.resonate
    ? u.resonate * G.enemies.filter(e =>
      Math.abs(e.lane - u.lane) + Math.abs(e.col - u.col) === 1).length
    : 0;
  const base = (onPlay && k.burst ? k.burst + gearBonus : u.dmg)
    + buffOf(u) + leadBonus(u) + pristine + resonance + packBonus(u) + eventTechBonus(u);

  let fired = false;
  for (let shot = 0; shot < (u.twin ? 2 : 1); shot++) {
    const ts = targetsFor(u);
    if (!ts.length) break;
    fired = true;
    ts.forEach(e => dmgEnemy(e, base + lensBonus(u, e), u.n, u.pen, u));

    // A recharge weapon spends the next turn cycling. Set to 2 because the
    // end-of-turn reset decrements once immediately after this fires.
    if (u.recharge) u.cycling = 2;

    // Outrider: survivors of the hit are driven back a cell. The push fails
    // quietly if the cell behind is occupied or off the board — damage stands,
    // and two bodies never share a cell.
    if (u.push) {
      // A boss body is not driven anywhere — the footprint holds its ground.
      ts.filter(e => e.hp > 0 && !e.boss).forEach(e => {
        const back = e.col + 1;
        if (back >= COLS || G.ter[e.lane][back] === 'x') return;
        if (G.enemies.some(o => o.uid !== e.uid && o.lane === e.lane && o.col === back)) return;
        if (G.units.some(o => o.lane === e.lane && back >= o.col && back < o.col + o.size)) return;
        if (G.civ.some(v => v.l === e.lane && v.c === back && v.hp > 0)) return;
        e.col = back;
        clog(`${u.n} drove ${BEST[e.k].n} back a cell.`, 'order');
      });
    }

    // Ember Lance: the ground under every hostile it hits burns for one turn
    // — through the enemy phase and the capture pass, gone at the end of it.
    if (u.ember) ts.forEach(t => { G.scorch[t.lane + ',' + t.col] = Math.max(G.scorch[t.lane + ',' + t.col] || 0, 1); });

    // Plasma lingers on the first target's 3x3 for two turns.
    if (u.scorch && ts.length) {
      const t = ts[0];
      for (let dl = -1; dl <= 1; dl++) for (let dc = -1; dc <= 1; dc++) {
        const nl = t.lane + dl;
        const nc = t.col + dc;
        if (nl >= 0 && nl < LANES && nc >= 0 && nc < COLS) G.scorch[nl + ',' + nc] = 2;
      }
    }
  }

  // Recoilless Team: the backblast hits whoever stands directly behind it,
  // shields and all — one shot, one point, no matter how many targets fell.
  // Active Camo: the shot gives the team away until its next turn.
  if (u.camo && fired) u.cloaked = false;

  if (u.backblast && fired) {
    const behind = G.units.find(o => o.lane === u.lane && o.col + o.size === u.col);
    if (behind) dmgUnit(behind, u.backblast, u.n + ' backblast');
  }
}

/**
 * Run this unit's support pass. Regenerators refresh their ticks; healers top
 * up the unit ahead or the whole column, filtered to the type they can treat
 * (Tech Medic repairs Knights, Bio Medic cannot).
 */
export function healPass(u, onPlay) {
  if (u.hot) {
    G.units
      .filter(o => o.col === u.col && o.uid !== u.uid && !o.tech)
      .forEach(o => { o.regenTicks = 2; });
    return;
  }
  if (!u.heal) return;

  const k = POOL[u.id];
  const amount = onPlay ? (k.healPlay || u.heal) : u.heal;
  const list = u.healMode === 'front'
    ? G.units.filter(o => o.lane === u.lane && o.col === u.col + 1)
    : u.healMode === 'adjacent'
      ? G.units.filter(o => Math.abs(o.lane - u.lane) + Math.abs(o.col - u.col) === 1)
      : G.units.filter(o => o.col === u.col && o.uid !== u.uid);

  list
    .filter(o => (u.healType === 'tech' ? o.tech : !o.tech))
    .forEach(o => { if (o.hp < o.max) o.hp = Math.min(o.max, o.hp + amount); });
}
