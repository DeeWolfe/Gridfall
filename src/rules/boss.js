// Operation bosses.
//
// A boss occupies a rectangle of cells and shares ONE hull pool across all of
// them. Rather than teaching every system about multi-cell hostiles, each
// covered cell is a proxy entry in G.enemies — so blocking, queueing, lane
// targeting and the drop-fight rules all work unchanged, and an area weapon
// lands once per covered cell against the same pool, which is the intended
// anti-boss answer (BOSS-BRIEF: do not special-case it away).
//
// The bodies themselves live on G.boss.bodies; combat.js routes any damage a
// proxy takes into dmgBoss() below. One irreversible phase flip per fight —
// half hull by default, shield collapse for a shielded boss — and a hard turn
// clock instead of a wave count: G.waves IS the clock on a boss mission.

import {LANES, COLS} from '../state/constants.js';
import {BEST} from '../content/hostiles.js';
import {BOSSDEF} from '../content/bosses.js';
import {G, active, nextUid} from '../state/session.js';
import {randInt, shuffle} from '../state/rng.js';
import {hooks} from '../state/hooks.js';
import {unitAt, foeAt, civAt} from './board.js';
import {dmgUnit, pierceUnit} from './combat.js';
import {mkFoe} from './spawn.js';
import {clog} from './log.js';
import {tapeEvent} from './tape.js';

/** The boss guarding this operation's FINAL node, if it has one. Node-placed
 * bosses (def.sub — Crownring's four honor guards) never come from here. */
export const bossForOp = op =>
  Object.keys(BOSSDEF).find(k => BOSSDEF[k].op === op && !BOSSDEF[k].sub) || null;

/** Remaining hull across every living body. */
export const bossHp = () => (G.boss ? G.boss.bodies.reduce((a, b) => a + b.hp, 0) : 0);

/** Push one proxy enemy per covered cell. `bmax` rides along so the health
 * bar on the board can show the BODY's fraction, not the original total's. */
function addBodyProxies(b) {
  b.cells.forEach(([l, c]) => {
    G.enemies.push({uid: nextUid(), k: G.boss.k, lane: l, col: c,
      hp: b.hp, bmax: b.max, mv: 0, acc: 0, stun: 0, boss: true, body: b.id});
  });
}

const bodyProxies = b => G.enemies.filter(e => e.boss && e.body === b.id);

function removeBodyProxies(b) {
  G.enemies = G.enemies.filter(e => !(e.boss && e.body === b.id));
}

function setBodyHp(b) {
  bodyProxies(b).forEach(e => { e.hp = b.hp; e.bmax = b.max; });
}

/** Seed this mission's boss onto the board at mission start — the node's own
 * when the map names one, the operation's final otherwise. */
export function seedBoss() {
  const k = G.bossK || bossForOp(G.op);
  if (!k || !BOSSDEF[k]) return;
  const d = BOSSDEF[k];
  const cells = [];
  for (let l = d.l; l < d.l + d.h; l++) for (let c = d.c; c < d.c + d.w; c++) cells.push([l, c]);
  G.boss = {k, phase: 1, shield: d.shield || 0, turns: 0, marks: [],
    charge: 0, dealt: 0, sealed: false,
    bodies: [{id: 1, hp: d.hp, max: d.hp, cells, dir: 1}], nextBody: 2};
  G.bossDown = false;
  // Each machine sets its own clock. turns: 0 means NO clock — the mission
  // runs until the kill or the line breaks (Subject One's duet).
  G.waves = d.turns || 999;
  addBodyProxies(G.boss.bodies[0]);
  cells.forEach(([l, c]) => { G.ter[l][c] = 'e'; });
  clog(`<span class="d">TARGET: ${BEST[k].n.toUpperCase()}</span> — ${d.hp} hull` +
    (d.shield ? ` behind a ${d.shield}-point containment field` : '') +
    (d.plate ? `, plated — armor shrugs ${d.plate} off every hit` : '') +
    (d.bulk ? `. Bulkhead: it cannot lose more than ${d.bulk} hull in one turn` : '') +
    (d.turns ? `. ${d.turns} turns on the clock.` : '. No clock — it ends when one of you does.'), 'loss');
  clog(`<span style="color:var(--violet)">${d.p1}</span>`, 'info');
  if (k === 'envoy') envoyFormation(d);
}

/**
 * All damage a boss proxy takes lands here (routed from dmgEnemy). No armour
 * floors and no instant kills — a boss is damaged or it is nothing.
 */
export function dmgBoss(e, d, src, attacker) {
  const B = G.boss;
  if (!B) return;
  const def = BOSSDEF[B.k];
  const body = B.bodies.find(b => b.id === e.body);
  if (!body || body.hp <= 0) return;

  // The Prism: a share of every hit comes straight back up the barrel that
  // fired it — past shields, and it can kill.
  if (def.reflect && attacker && attacker.hp > 0 && attacker.uid !== undefined && attacker.max) {
    const r = Math.round(d * def.reflect);
    if (r > 0) pierceUnit(attacker, r, `${BEST[B.k].n} reflection`);
  }

  let dealt = d;
  if (B.shield > 0) {
    const absorbed = Math.min(B.shield, dealt);
    B.shield -= absorbed;
    dealt -= absorbed;
    tapeEvent({type: 'shield', lane: e.lane, col: e.col});
    if (B.shield <= 0) {
      clog('<span class="d">The containment field is DOWN.</span>', 'kill');
      if (B.phase === 1) phaseFlip();
    } else {
      clog(`${src} — the field absorbs it. <b>${B.shield}</b> holding.`, 'info');
    }
  }
  if (dealt > 0) {
    // Plating: the hull shrugs a point off EVERY hit (minimum 1 through).
    // Ten pings from massed small arms lose ten damage; two heavy shells
    // lose two — the anti-swarm tax that makes big guns and area strikes
    // the boss answer. The containment field above absorbs cleanly; only
    // damage that reaches armor is taxed.
    if (def.plate) dealt = Math.max(1, dealt - def.plate);
    // The bulkhead: a boss can only LOSE so much hull in one turn — the
    // anti-burst ceiling that plating is not. An alpha-strike deck fills
    // the ceiling and the rest of the volley glances off until next turn,
    // so every boss fight has a guaranteed minimum length; decks that
    // never reach the ceiling never feel it.
    // Only the Envoy's KING is bulkheaded — his pieces and thrones are fair
    // game for a full volley, or thinning the formation would take all day.
    if (def.bulk && (B.k !== 'envoy' || body.role === 'king')) {
      const room = Math.max(0, def.bulk - (B.dealt || 0));
      if (dealt > room) {
        dealt = room;
        if (!B.sealed) {
          B.sealed = true;
          clog('<span style="color:var(--violet)">The bulkhead seals</span> — the rest of the volley glances off until it recovers.', 'info');
        }
      }
      B.dealt = (B.dealt || 0) + dealt;
      if (dealt <= 0) return;
    }
    body.hp -= dealt;
    setBodyHp(body);
    tapeEvent({type: 'hit', foe: true, lane: e.lane, col: e.col, amount: dealt, died: body.hp <= 0});
  }

  if (body.hp <= 0) {
    // The Envoy's first death is not the end of the session: the king stands
    // back up at full hull and the honor guards answer — the phase flip here
    // is on the KING'S death, never on a hull fraction.
    if (B.k === 'envoy' && B.phase === 1 && body.role === 'king') {
      phaseFlip();
      return;
    }
    removeBodyProxies(body);
    B.bodies = B.bodies.filter(b => b !== body);
    G.kills++;
    if (!B.bodies.length) {
      G.bossDown = true;
      if (active && !active.unlocks.enemies.includes(B.k)) active.unlocks.enemies.push(B.k);
      clog(`<span class="g">TARGET DESTROYED</span> — ${BEST[B.k].n} is down.`, 'kill');
    } else {
      clog(`<span class="g">${src}</span> destroyed one of ${BEST[B.k].n}'s bodies — ${B.bodies.length} remain${B.bodies.length === 1 ? 's' : ''}.`, 'kill');
    }
    return;
  }

  // Half hull is the default flip. A shielded boss flips on collapse instead —
  // that is the Gantry, and the shield is protecting the player from phase two.
  if (B.phase === 1 && !def.shield && !def.kingFlip && bossHp() <= def.hp / 2) phaseFlip();
}

/** The one irreversible transition. Loud on purpose — a boss that quietly
 * changes behaviour reads as a bug (BOSS-BRIEF). */
function phaseFlip() {
  const B = G.boss;
  const def = BOSSDEF[B.k];
  if (B.phase === 2) return;
  B.phase = 2;
  const [fl, fc] = B.bodies.length ? B.bodies[0].cells[0] : [0, 0];
  tapeEvent({type: 'clash', lane: fl, col: fc});
  clog(`<span class="d">${def.bt}</span> — ${def.p2}.`, 'loss');
  if (B.k === 'brood') broodSplit(def);
  if (B.k === 'prism') prismShatter(def);
  if (B.k === 'subject') subjectSplit();
  if (B.k === 'envoy') envoySecondSession();
  hooks.notify(`⚠ ${def.bt}`, def.bb);
}

/** Nearest free column to `c0` in lane `l` a 1x1 body could stand in. */
function freeColNear(l, c0) {
  for (let dc = 0; dc < COLS; dc++) {
    for (const c of dc ? [c0 + dc, c0 - dc] : [c0]) {
      if (c < 0 || c >= COLS) continue;
      if (G.ter[l][c] === 'x' || unitAt(l, c) || foeAt(l, c)) continue;
      return c;
    }
  }
  return null;
}

/** Anything standing where a boss body rolls counts as rolled over. Hive
 * bodies are displaced without ceremony; yours are crushed, no ejection. */
function crushCell(l, c, who) {
  const u = unitAt(l, c);
  if (u) {
    G.units = G.units.filter(x => x.uid !== u.uid);
    G.lost++;
    clog(`<span class="d">${who}</span> rolled over your ${u.n} — crushed.`, 'loss');
  }
  const f = foeAt(l, c);
  if (f && !f.boss) G.enemies = G.enemies.filter(x => x.uid !== f.uid);
}

/** Move one body to `cells`, crushing into any newly covered ground. */
function moveBody(b, cells, who) {
  const had = new Set(b.cells.map(([l, c]) => l + ',' + c));
  cells.forEach(([l, c]) => { if (!had.has(l + ',' + c)) crushCell(l, c, who); });
  const ps = bodyProxies(b);
  b.cells = cells;
  cells.forEach(([l, c], i) => {
    if (ps[i]) { ps[i].lane = l; ps[i].col = c; }
    G.ter[l][c] = 'e';
  });
}

// --- The Brood Mother: split at half hull ---
function broodSplit(def) {
  const B = G.boss;
  const main = B.bodies[0];
  if (!main) return;
  const share = Math.max(1, Math.ceil(main.hp / (def.splitBodies || 3)));
  const [al, ac] = main.cells[0];
  // The main body contracts to a single cell...
  removeBodyProxies(main);
  main.cells = [[al, ac]];
  main.hp = share;
  main.max = share;
  addBodyProxies(main);
  // ...and the work continues from lanes the main body does NOT occupy — the
  // rig's split once produced two bodies instead of three by colliding with
  // the contracted main; picking disjoint lanes is the whole fix.
  const lanes = shuffle([...Array(LANES).keys()].filter(l => l !== al));
  let placed = 0;
  for (const l of lanes) {
    if (placed >= (def.splitBodies || 3) - 1) break;
    const c = freeColNear(l, ac);
    if (c == null) continue;
    const nb = {id: B.nextBody++, hp: share, max: share, cells: [[l, c]], dir: 1};
    B.bodies.push(nb);
    addBodyProxies(nb);
    G.ter[l][c] = 'e';
    placed++;
  }
}

// --- The Prism: shatter at half hull — the shards SCATTER, into your half ---
function prismShatter(def) {
  const B = G.boss;
  const main = B.bodies[0];
  if (!main) return;
  const share = Math.max(1, Math.ceil(def.hp / 5));
  // The cap matters: without it the fragments outgrow any damage the player
  // can apply, and an unwinnable fight presents as tuning (BOSS-BRIEF).
  const cap = Math.max(share, Math.floor(share * def.growCap));
  removeBodyProxies(main);
  B.bodies = [];
  // Two WALL shards dig in between your line and the third — each picks your
  // side of the board or the middle ground at random. The LANCE takes the
  // hive's side and fires over them: the walls are what it hides behind.
  const spots = [];
  const freeIn = (cMin, cMax) => {
    for (const l of shuffle([...Array(LANES).keys()])) {
      for (let c = cMin; c <= cMax; c++) {
        if (G.ter[l][c] === 'x' || unitAt(l, c) || foeAt(l, c) || civAt(l, c)) continue;
        if (spots.some(([sl, sc]) => sl === l && sc === c)) continue;
        return [l, c];
      }
    }
    return null;
  };
  const wallBand = () => (randInt(2) === 0 ? [0, 2] : [3, 4]);
  [wallBand(), wallBand(), [5, COLS - 1]].forEach(([cMin, cMax], i) => {
    const at = freeIn(cMin, cMax) || freeIn(0, COLS - 1);
    if (!at) return;
    spots.push(at);
    const nb = {id: B.nextBody++, hp: share, max: cap, grow: 1, cells: [at], dir: 1,
      role: i === 2 ? 'lance' : 'wall'};
    B.bodies.push(nb);
    addBodyProxies(nb);
    G.ter[at[0]][at[1]] = 'e';
  });
}

// --- per-boss turn scripts, run after the horde has acted ---

/** Place `count` of `kind` onto the board, mid-field first — the shared
 * "the boss brings its own escort" placement every machine uses. */
function summonAdds(kind, count) {
  let made = 0;
  for (let i = 0; i < count; i++) {
    const l = randInt(LANES);
    let at = null;
    for (const c of [4, 5, 6, 7, 3, 2, 1, 0]) {
      if (c >= COLS) continue;
      if (G.ter[l][c] === 'x' || unitAt(l, c) || foeAt(l, c)) continue;
      at = c;
      break;
    }
    if (at == null) continue;
    G.enemies.push(mkFoe(kind, l, at, BEST[kind].hp));
    made++;
  }
  return made;
}

function gantryTick(def) {
  const B = G.boss;
  // Fabrication ramps 1-2-3 and holds — and it does NOT stop in phase two.
  const count = def.ramp[Math.min(B.turns - 1, def.ramp.length - 1)];
  const made = summonAdds(def.add, count);
  if (made) clog(`<span class="d">The Gantry</span> fabricates — ${made} ${BEST[def.add].n}${made > 1 ? 's' : ''} walk off the line.`, 'wave');

  // Shield down: every covered cell picks its own random friendly and fires.
  if (B.phase === 2) {
    const cells = B.bodies.flatMap(b => b.cells);
    cells.forEach(([l, c]) => {
      if (!G.units.length) return;
      const t = G.units[randInt(G.units.length)];
      const proxy = G.enemies.find(e => e.boss && e.lane === l && e.col === c);
      dmgUnit(t, def.cellDmg, 'The Gantry', proxy);
    });
    if (G.units.length) clog(`<span class="d">Every emitter fires</span> — ${cells.length} bolts across the line.`, 'loss');
  }
}

/** Yesterday's marked breaches erupt. A unit standing on the mark takes the
 * damage INSTEAD of anything surfacing — occupying a breach is a choice. The
 * Brood Mother and the Shardguard keep this same contract. */
function eruptMarks(def) {
  const B = G.boss;
  const due = B.marks;
  B.marks = [];
  due.forEach(({l, c}) => {
    const u = unitAt(l, c);
    if (u) {
      dmgUnit(u, def.breachDmg, 'Breach eruption');
      clog(`<span class="g">${u.n}</span> held the breach — nothing surfaced.`, 'order');
      return;
    }
    if (G.ter[l][c] === 'x' || foeAt(l, c)) return;
    const k = def.breachPool[randInt(def.breachPool.length)];
    G.enemies.push(mkFoe(k, l, c, BEST[k].hp));
    clog(`<span class="d">Breach</span> — a ${BEST[k].n} surfaces at lane ${l + 1}.`, 'wave');
  });
}

/** Telegraph fresh breach marks — anywhere workable, your half included. */
function markBreaches(want) {
  const B = G.boss;
  let tries = 0;
  while (B.marks.length < want && tries++ < 40) {
    const l = randInt(LANES);
    const c = randInt(COLS);
    if (G.ter[l][c] === 'x') continue;
    if (foeAt(l, c)) continue;
    if (B.marks.some(m => m.l === l && m.c === c)) continue;
    B.marks.push({l, c});
  }
  if (B.marks.length) {
    clog(`<span style="color:var(--violet)">The ground groans</span> — breach marked at ${B.marks
      .map(m => `lane ${m.l + 1}·col ${m.c + 1}`).join(', ')}. It erupts next turn.`, 'info');
  }
}

function broodTick(def) {
  const B = G.boss;
  eruptMarks(def);

  // Lateral drift, reversing at the board edge; every third turn it works the
  // seam one column forward. Without the seam its whole suffocation threat is
  // inert (the rig proved it) — the seam is what brings it to your ground.
  B.bodies.forEach(b => {
    const lanes = b.cells.map(([l]) => l);
    if (Math.min(...lanes) + b.dir < 0 || Math.max(...lanes) + b.dir >= LANES) b.dir *= -1;
    const drifted = b.cells.map(([l, c]) => [l + b.dir, c]);
    // Never drift into another body of itself.
    const others = new Set(B.bodies.filter(x => x !== b)
      .flatMap(x => x.cells.map(([l, c]) => l + ',' + c)));
    if (!drifted.some(([l, c]) => others.has(l + ',' + c))) {
      moveBody(b, drifted, BEST[B.k].n);
    }
    if (B.turns % def.seamEvery === 0) {
      const cols = b.cells.map(([, c]) => c);
      if (Math.min(...cols) > 0) {
        const seam = b.cells.map(([l, c]) => [l, c - 1]);
        if (!seam.some(([l, c]) => others.has(l + ',' + c))) {
          moveBody(b, seam, BEST[B.k].n);
          clog('<span class="d">The seam advances</span> — the Brood Mother works a column forward.', 'loss');
        }
      }
    }
  });

  // One tendril lash per turn — a whole ROW or a whole COLUMN, its pick, no
  // warning. The breaches are what you plan around; the tendril is what you
  // eat, and now no formation axis is safe from it.
  if (G.units.length) {
    if (randInt(2) === 0) {
      const armed = [...new Set(G.units.map(u => u.lane))];
      const l = armed[randInt(armed.length)];
      const hit = G.units.filter(u => u.lane === l);
      hit.forEach(u => dmgUnit(u, def.tendrilDmg, 'Tendril lash'));
      clog(`<span class="d">Tendril</span> lashes lane ${l + 1} — ${hit.length} unit${hit.length > 1 ? 's' : ''} struck.`, 'loss');
    } else {
      const armed = [...new Set(G.units.map(u => u.col))];
      const c = armed[randInt(armed.length)];
      const hit = G.units.filter(u => u.col === c);
      hit.forEach(u => dmgUnit(u, def.tendrilDmg, 'Tendril lash'));
      clog(`<span class="d">Tendril</span> sweeps column ${c + 1} — ${hit.length} unit${hit.length > 1 ? 's' : ''} struck.`, 'loss');
    }
  }

  // Tomorrow's breaches, telegraphed now — two per turn once it has split.
  markBreaches(B.phase === 2 ? 2 : 1);
}

function prismTick(def) {
  const B = G.boss;
  // Fragments knit themselves back together, one point a turn, up to the cap.
  let grew = false;
  B.bodies.forEach(b => {
    if (!b.grow || b.hp >= b.max) return;
    b.hp = Math.min(b.max, b.hp + 1);
    setBodyHp(b);
    grew = true;
  });
  if (grew) clog('<span class="d">The fragments grow</span> — crystal knitting back along its planes.', 'info');
  // The wall shards hum — everything standing beside one burns for it.
  if (def.fragDmg && B.phase === 2) {
    let caught = 0;
    G.units.forEach(u => {
      B.bodies.forEach(b => {
        if (b.role === 'lance') return;
        const [l, c] = b.cells[0];
        if (Math.max(Math.abs(u.lane - l), Math.abs(u.col - c)) === 1) {
          dmgUnit(u, def.fragDmg, 'Prism resonance');
          caught++;
        }
      });
    });
    if (caught) clog(`<span class="d">The wall shards resonate</span> — ${caught} soldier${caught > 1 ? 's' : ''} caught beside the crystal.`, 'loss');
  }
  // The lance fires from the deep field: crystal javelins, straight onto the
  // squares your soldiers hold. Range is not its problem — the walls are yours.
  if (def.javDmg && B.phase === 2 && B.bodies.some(b => b.role === 'lance')) {
    const struck = shuffle([...G.units]).slice(0, def.javN || 1);
    struck.forEach(u => dmgUnit(u, def.javDmg, 'Prism javelin'));
    if (struck.length) clog(`<span class="d">The deep shard fires</span> — crystal javelins into ${struck.length} soldier${struck.length > 1 ? 's' : ''}.`, 'loss');
  }
}

// --- SUBJECT ONE: whole, it walks at your line; divided, it comes apart ---

/** A lone half endures: after reviveEvery solo turns, the splice knits the
 * survivor back to FULL health. There is no clock on this fight — the
 * pressure is finishing the second kill before the first one un-happens. */
function soloBeat(B, def, survivor) {
  B.solo = (B.solo || 0) + 1;
  if (def.reviveEvery && B.solo >= def.reviveEvery) {
    B.solo = 0;
    survivor.hp = survivor.max;
    setBodyHp(survivor);
    clog('<span class="d">THE SPLICE KNITS ITSELF WHOLE</span> — the surviving half heals back to full.', 'loss');
  } else if (def.reviveEvery) {
    clog(`<span style="color:var(--violet)">The splice is knitting</span> — the survivor heals to full in ${def.reviveEvery - B.solo} turn${def.reviveEvery - B.solo > 1 ? 's' : ''}.`, 'info');
  }
}

/** One free step for a 1-cell body. `away` flees the nearest soldier;
 * otherwise the step closes on them, wider axis first. */
function stepBody(body, away) {
  const [l, c] = body.cells[0];
  const near = [...G.units].sort((a, b) =>
    (Math.abs(a.lane - l) + Math.abs(a.col - c)) - (Math.abs(b.lane - l) + Math.abs(b.col - c)) ||
    a.uid - b.uid)[0];
  if (!near) return false;
  const free = ([nl, nc]) => nl >= 0 && nl < LANES && nc >= 0 && nc < COLS &&
    G.ter[nl][nc] !== 'x' && !unitAt(nl, nc) && !foeAt(nl, nc) && !civAt(nl, nc);
  const distTo = ([nl, nc]) => Math.abs(near.lane - nl) + Math.abs(near.col - nc);
  if (away) {
    const cand = [[l - 1, c], [l + 1, c], [l, c - 1], [l, c + 1]].filter(free)
      .sort((a, b) => distTo(b) - distTo(a) || b[1] - a[1] || a[0] - b[0])[0];
    if (!cand || distTo(cand) <= distTo([l, c])) return false;
    moveBody(body, [cand], BEST[G.boss.k].n);
    return true;
  }
  if (distTo([l, c]) <= 1) return false;
  const dl = Math.sign(near.lane - l);
  const dc = Math.sign(near.col - c);
  const steps = Math.abs(near.col - c) >= Math.abs(near.lane - l)
    ? [[l, c + dc], [l + dl, c]] : [[l + dl, c], [l, c + dc]];
  const next = steps.find(free);
  if (!next) return false;
  moveBody(body, [next], BEST[G.boss.k].n);
  return true;
}

/** The snapped human half does not walk — it CHARGES. It picks a straight
 * line and travels flat out until a wall, terrain, or a body ends the run;
 * a soldier at the end of the line is the one it hits, the same turn. There
 * is no movement cap — the board is the cap. Returns the soldier it slammed
 * into, or null when the line ended in anything else. */
function chargeBody(body) {
  const [l, c] = body.cells[0];
  const runs = [[-1, 0], [1, 0], [0, -1], [0, 1]].map(([dl, dc]) => {
    let nl = l, nc = c, run = 0;
    for (;;) {
      const tl = nl + dl, tc = nc + dc;
      if (tl < 0 || tl >= LANES || tc < 0 || tc >= COLS || G.ter[tl][tc] === 'x' ||
        foeAt(tl, tc) || civAt(tl, tc)) return {run, stop: [nl, nc], prey: null};
      const u = unitAt(tl, tc);
      if (u) return {run, stop: [nl, nc], prey: u};
      nl = tl; nc = tc; run++;
    }
  });
  // A line that ends in a soldier wins — the nearest one. Otherwise take the
  // slide that leaves it closest to the nearest soldier, lining up next turn.
  const hit = runs.filter(r => r.prey).sort((a, b) => a.run - b.run)[0];
  if (hit) {
    if (hit.run) moveBody(body, [hit.stop], BEST[G.boss.k].n);
    return hit.prey;
  }
  const near = [...G.units].sort((a, b) =>
    (Math.abs(a.lane - l) + Math.abs(a.col - c)) - (Math.abs(b.lane - l) + Math.abs(b.col - c)) ||
    a.uid - b.uid)[0];
  if (!near) return null;
  const dist = ([nl, nc]) => Math.abs(near.lane - nl) + Math.abs(near.col - nc);
  const slide = runs.filter(r => r.run).sort((a, b) => dist(a.stop) - dist(b.stop))[0];
  if (slide && dist(slide.stop) < dist([l, c])) moveBody(body, [slide.stop], BEST[G.boss.k].n);
  return null;
}

/** The flip: the splice tears in two. The human half bolts for open ground
 * away from your line; the hive half stands where the body stood. */
function subjectSplit() {
  const B = G.boss;
  const main = B.bodies[0];
  if (!main) return;
  const share = Math.max(1, Math.ceil(main.hp / 2));
  const cells = [...main.cells];
  removeBodyProxies(main);
  // The hive half keeps the first cell of the old footprint...
  main.cells = [cells[0]];
  main.hp = share;
  main.max = share;
  main.role = 'hive';
  addBodyProxies(main);
  // ...and the human half surfaces as deep from your line as the board allows.
  let placed = null;
  for (let c = COLS - 1; c >= 0 && !placed; c--) {
    for (let l = 0; l < LANES && !placed; l++) {
      if (G.ter[l][c] === 'x' || unitAt(l, c) || foeAt(l, c) || civAt(l, c)) continue;
      placed = [l, c];
    }
  }
  if (!placed) placed = cells[1] || cells[0];
  const human = {id: B.nextBody++, hp: share, max: share, cells: [placed], dir: 1, role: 'human'};
  B.bodies.push(human);
  addBodyProxies(human);
  G.ter[placed[0]][placed[1]] = 'e';
  clog('<span class="d">The human half runs</span> — and the hive half watches you instead.', 'loss');
}

function subjectTick(def) {
  const B = G.boss;

  if (B.phase === 1) {
    // Whole: the footprint walks one cell at your line, crushing what it
    // covers, then strikes everything within arm's reach.
    const body = B.bodies[0];
    if (!body) return;
    const cellsOf = b => b.cells;
    const near = [...G.units].sort((a, b) => {
      const da = Math.min(...cellsOf(body).map(([l, c]) => Math.abs(a.lane - l) + Math.abs(a.col - c)));
      const db = Math.min(...cellsOf(body).map(([l, c]) => Math.abs(b.lane - l) + Math.abs(b.col - c)));
      return da - db || a.uid - b.uid;
    })[0];
    if (near) {
      const [al, ac] = body.cells[0];
      const dl = Math.sign(near.lane - al);
      const dc = Math.sign(near.col - ac);
      const shifts = Math.abs(near.col - ac) >= Math.abs(near.lane - al)
        ? [[0, dc], [dl, 0]] : [[dl, 0], [0, dc]];
      // It walks up TO your line, never over it — the strike is the threat,
      // not a free crush. Cells it already covers don't block its own shift.
      const own = new Set(body.cells.map(([l, c]) => l + ',' + c));
      for (const [sl, sc] of shifts) {
        if (!sl && !sc) continue;
        const moved = body.cells.map(([l, c]) => [l + sl, c + sc]);
        if (moved.some(([l, c]) => l < 0 || l >= LANES || c < 0 || c >= COLS || G.ter[l][c] === 'x' ||
          (!own.has(l + ',' + c) && (unitAt(l, c) || foeAt(l, c) || civAt(l, c))))) continue;
        moveBody(body, moved, BEST[B.k].n);
        clog('<span style="color:var(--violet)">Subject One walks</span> — it is coming to your line.', 'info');
        break;
      }
    }
    const own = new Set(body.cells.map(([l, c]) => l + ',' + c));
    const adj = new Set();
    body.cells.forEach(([l, c]) => [[l - 1, c], [l + 1, c], [l, c - 1], [l, c + 1]]
      .forEach(([al2, ac2]) => {
        if (al2 < 0 || al2 >= LANES || ac2 < 0 || ac2 >= COLS) return;
        if (!own.has(al2 + ',' + ac2)) adj.add(al2 + ',' + ac2);
      }));
    const struck = G.units.filter(u => adj.has(u.lane + ',' + u.col));
    struck.forEach(u => dmgUnit(u, def.strikeDmg, 'Subject One'));
    if (struck.length) clog(`<span class="d">Subject One strikes</span> — ${struck.length} unit${struck.length > 1 ? 's' : ''} within arm's reach.`, 'loss');
  } else {
    const hive = B.bodies.find(b => b.role === 'hive');
    const human = B.bodies.find(b => b.role === 'human');

    if (hive && human) {
      // The duet: the human half flees your line and knits the hive half
      // back together; the hive half hunts and claws.
      for (let i = 0; i < def.fleeMv; i++) if (!stepBody(human, true)) break;
      if (hive.hp < hive.max) {
        hive.hp = Math.min(hive.max, hive.hp + def.mendN);
        setBodyHp(hive);
        clog(`<span class="d">The human half will not let it die</span> — ${def.mendN} hull knit back into the hive half.`, 'info');
      }
      // Move AND attack, same turn — and the claw reaches the corners too, so
      // penning it in with bodies no longer buys the diagonal soldier a pass.
      for (let i = 0; i < def.huntMv; i++) if (!stepBody(hive, false)) break;
      const [l, c] = hive.cells[0];
      const prey = G.units.filter(u => Math.max(Math.abs(u.lane - l), Math.abs(u.col - c)) === 1)
        .sort((a, b) => a.hp - b.hp || a.uid - b.uid)[0];
      if (prey) {
        dmgUnit(prey, def.clawDmg, 'Subject One');
        clog(`<span class="d">The hive half claws ${prey.n}</span>.`, 'loss');
      }
      B.solo = 0;
      B.snap = 0;
    } else if (hive && !human) {
      // The smaller partner is gone. The big form stops choosing targets:
      // the claw becomes a storm — everything in reach, and it STUNS.
      for (let i = 0; i < def.huntMv; i++) if (!stepBody(hive, false)) break;
      const [l, c] = hive.cells[0];
      const caught = G.units.filter(u => Math.abs(u.lane - l) + Math.abs(u.col - c) <= def.aoeR);
      caught.forEach(u => { dmgUnit(u, def.clawDmg, 'Subject One'); if (u.hp > 0) u.stun = 1; });
      if (caught.length) clog(`<span class="d">The hive half rages</span> — ${caught.length} soldier${caught.length > 1 ? 's' : ''} battered and STUNNED within its storm.`, 'loss');
      soloBeat(B, def, hive);
    } else if (human && !hive) {
      // The big form is gone. The human half stops running — it CHARGES:
      // a straight line, flat out until a wall or a soldier ends the run, and
      // the soldier that ends it is hit the same turn. Harder every turn.
      B.snap = (B.snap || 0) + 1;
      const prey = chargeBody(human);
      const dmg = def.clawDmg + def.snapStep * B.snap;
      if (prey) {
        dmgUnit(prey, dmg, 'Subject One');
        clog(`<span class="d">What is left of the researcher slams into ${prey.n}</span> — ${dmg}, and it is still accelerating.`, 'loss');
      } else {
        clog(`<span style="color:var(--violet)">The human half charges</span> — flat out, harder every turn it is alone.`, 'info');
      }
      soloBeat(B, def, human);
    }
  }

  // What is left of the staff answer when it screams — in either phase.
  if (B.turns % def.addEvery === 0) {
    const made = summonAdds(def.add, 1);
    if (made) clog(`It screams — a ${BEST[def.add].n} answers.`, 'wave');
  }
}

// --- The Envoy: the summit is a chessboard — one piece moves a turn ---

/** Glyph and name per body role, shared with the renderer so a piece reads
 * as a piece on the board, not as five copies of the Envoy. */
export const PIECE_GLYPH = {pawn: '♟', knight: '♞', bishop: '♝', queen: '♛', king: '♚',
  pyre: '🜂', rime: '🜄', storm: '🜁', shard: '🜃'};
export const PIECE_NAME = {pawn: 'Pawn', knight: 'Knight', bishop: 'Bishop', queen: 'Queen', king: 'King',
  pyre: 'Pyre', rime: 'Rime', storm: 'Storm', shard: 'Shard'};

/** Nearest free cell to (l, c) a 1-cell body can stand in — same-spot first,
 * then rings outward along the axes. */
function pieceSpot(l, c) {
  for (let d = 0; d < COLS; d++) {
    for (const [tl, tc] of d === 0 ? [[l, c]] : [[l, c - d], [l - d, c], [l + d, c], [l, c + d]]) {
      if (tl < 0 || tl >= LANES || tc < 0 || tc >= COLS) continue;
      if (G.ter[tl][tc] === 'x' || unitAt(tl, tc) || foeAt(tl, tc) || civAt(tl, tc)) continue;
      return [tl, tc];
    }
  }
  return null;
}

/** The first session deploys as a chess set. The board is five lanes, so the
 * back rank is a COLUMN — knight, bishop, KING, queen, bishop — with a pawn
 * screen one column forward. Every piece is a body of the same machine,
 * individually killable; only the king is bulkheaded. */
function envoyFormation(def) {
  const B = G.boss;
  const back = COLS - 1, front = COLS - 2;
  B.bodies[0].role = 'king';
  [['knight', 0, back], ['bishop', 1, back], ['queen', 3, back], ['bishop', 4, back],
    ['pawn', 0, front], ['pawn', 1, front], ['pawn', 2, front], ['pawn', 3, front], ['pawn', 4, front],
  ].forEach(([role, l, c]) => {
    const at = pieceSpot(l, c);
    if (!at) return;
    const hp = def[role + 'Hp'];
    const nb = {id: B.nextBody++, hp, max: hp, cells: [at], dir: 1, role};
    B.bodies.push(nb);
    addBodyProxies(nb);
    G.ter[at[0]][at[1]] = 'e';
  });
  clog('<span style="color:var(--violet)">The delegation takes the floor</span> — a pawn screen, a knight, two bishops, a queen. The Envoy holds the back rank.', 'info');
}

/** Every legal move for one piece, chess rules on a 5×8 grid. A move onto a
 * soldier's square is a strike; sliding pieces stop on the square before a
 * surviving target (`stop`), and take the square itself only on a kill. */
function pieceMoves(body) {
  const [l, c] = body.cells[0];
  const out = [];
  const openAt = (tl, tc) => tl >= 0 && tl < LANES && tc >= 0 && tc < COLS &&
    G.ter[tl][tc] !== 'x' && !foeAt(tl, tc) && !civAt(tl, tc);
  if (body.role === 'pawn') {
    // Forward is toward YOUR line; the strike is diagonal, never straight.
    if (openAt(l, c - 1) && !unitAt(l, c - 1)) out.push({body, to: [l, c - 1], stop: [l, c - 1], prey: null});
    [[l - 1, c - 1], [l + 1, c - 1]].forEach(([tl, tc]) => {
      const u = openAt(tl, tc) ? unitAt(tl, tc) : null;
      if (u) out.push({body, to: [tl, tc], stop: [l, c], prey: u});
    });
  } else if (body.role === 'knight') {
    [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]].forEach(([dl, dc]) => {
      const tl = l + dl, tc = c + dc;
      if (!openAt(tl, tc)) return;
      out.push({body, to: [tl, tc], stop: [l, c], prey: unitAt(tl, tc) || null});
    });
  } else {
    const rays = body.role === 'bishop' ? [[-1, -1], [-1, 1], [1, -1], [1, 1]]
      : [[-1, -1], [-1, 1], [1, -1], [1, 1], [-1, 0], [1, 0], [0, -1], [0, 1]];
    rays.forEach(([dl, dc]) => {
      let prev = [l, c];
      for (let s = 1; s < COLS; s++) {
        const tl = l + dl * s, tc = c + dc * s;
        if (!openAt(tl, tc)) break;
        const u = unitAt(tl, tc);
        if (u) { out.push({body, to: [tl, tc], stop: prev, prey: u}); break; }
        out.push({body, to: [tl, tc], stop: [tl, tc], prey: null});
        prev = [tl, tc];
      }
    });
  }
  return out;
}

/** One move per turn, like the game it is imitating. A strike outranks any
 * advance and the hardest hitter takes it; otherwise the formation closes on
 * your line, minor pieces first so the queen is not spent as a scout. */
function envoyMove(def) {
  const B = G.boss;
  const moves = B.bodies.filter(b => b.role && b.role !== 'king').flatMap(pieceMoves);
  if (!moves.length) return;
  const dmgOf = b => def[b.role + 'Dmg'] || 0;
  const gapTo = ([l, c]) => G.units.length
    ? Math.min(...G.units.map(u => Math.abs(u.lane - l) + Math.abs(u.col - c))) : COLS + LANES;
  moves.forEach(m => {
    m.score = m.prey ? 1000 + dmgOf(m.body) * 10 - m.prey.hp * 0.01
      : 100 - gapTo(m.to) - (m.body.role === 'queen' ? 2 : 0);
  });
  const m = shuffle(moves).sort((a, b) => b.score - a.score)[0];
  const [bl, bc] = m.body.cells[0];
  if (m.prey) {
    const dmg = dmgOf(m.body);
    dmgUnit(m.prey, dmg, 'The delegation');
    const died = !G.units.some(u => u.uid === m.prey.uid);
    const dest = died ? m.to : m.stop;
    if (dest[0] !== bl || dest[1] !== bc) moveBody(m.body, [dest], BEST[B.k].n);
    clog(`<span class="d">${PIECE_GLYPH[m.body.role]} The ${m.body.role} takes ${m.prey.n}</span> — ${dmg}${died ? ', and the square' : ''}.`, 'loss');
  } else {
    moveBody(m.body, [m.to], BEST[B.k].n);
    clog(`<span style="color:var(--violet)">${PIECE_GLYPH[m.body.role]} The ${m.body.role} moves</span> — lane ${m.to[0] + 1}.`, 'info');
  }
}

/** The king holds his square and censures the floor around it — all eight
 * squares, the way a king threatens. */
function kingCensure(def) {
  const king = G.boss.bodies.find(b => b.role === 'king');
  if (!king) return;
  const [l, c] = king.cells[0];
  const struck = G.units.filter(u => Math.max(Math.abs(u.lane - l), Math.abs(u.col - c)) === 1);
  struck.forEach(u => dmgUnit(u, def.adjDmg, 'The Envoy'));
  if (struck.length) clog(`<span class="d">♚ The Envoy censures the floor</span> — ${struck.length} unit${struck.length > 1 ? 's' : ''} beside the throne struck.`, 'loss');
}

/** The flip: the king's first death. The formation falls with him, he stands
 * back up at FULL hull — and the four honor guards beaten in the wings take
 * the thrones around him, each running its own element until it dies. */
function envoySecondSession() {
  const B = G.boss;
  const def = BOSSDEF[B.k];
  const king = B.bodies.find(b => b.role === 'king');
  if (!king) return;
  B.bodies.filter(b => b !== king).forEach(removeBodyProxies);
  B.bodies = [king];
  king.hp = king.max;
  setBodyHp(king);
  const [kl, kc] = king.cells[0];
  [['pyre', kl - 2, kc - 1], ['rime', kl - 1, kc - 1], ['storm', kl + 1, kc - 1], ['shard', kl + 2, kc - 1]]
    .forEach(([role, l, c]) => {
      const at = pieceSpot(Math.max(0, Math.min(LANES - 1, l)), Math.max(0, Math.min(COLS - 1, c)));
      if (!at) return;
      const nb = {id: B.nextBody++, hp: def.frameHp, max: def.frameHp, cells: [at], dir: 1, role};
      B.bodies.push(nb);
      addBodyProxies(nb);
      G.ter[at[0]][at[1]] = 'e';
    });
  B.frameIx = 0;
  clog('<span class="d">The Envoy stands back up</span> — full hull. The delegation is done pretending.', 'loss');
  clog('<span class="d">The four honor guards take the thrones</span> — Pyre, Rime, Storm, Shard, seated around the floor.', 'loss');
}

/** One throne acts: each guard keeps the element it fought with in the wings,
 * on the wing fight's own numbers. Kill a throne and its element goes quiet. */
function frameAct(f) {
  if (f.role === 'pyre') {
    const lane = f.cells[0][0];
    const n = elemBurn([lane], BOSSDEF.pyreguard.fireDmg, 'The Pyre throne');
    clog(`<span class="d">🜂 The Pyre throne exhales</span> — lane ${lane + 1} burns${n ? `, ${n} caught` : ''}.`, n ? 'loss' : 'info');
  }
  if (f.role === 'rime') elemFreeze(BOSSDEF.rimeguard.freezeN, BOSSDEF.rimeguard.chillDmg, 'The Rime throne');
  if (f.role === 'storm') elemJam(BOSSDEF.stormguard.jamN, BOSSDEF.stormguard.arcDmg, 'The Storm throne');
  if (f.role === 'shard') { eruptMarks(BOSSDEF.shardguard); markBreaches(BOSSDEF.shardguard.markN); }
}

function envoyTick(def) {
  const B = G.boss;
  kingCensure(def);
  if (B.phase === 1) { envoyMove(def); return; }
  // Second session: the surviving thrones act in rotation, two a turn.
  const frames = B.bodies.filter(b => ['pyre', 'rime', 'storm', 'shard'].includes(b.role));
  if (!frames.length) return;
  const acts = Math.min(def.frameActs || 2, frames.length);
  for (let i = 0; i < acts; i++) frameAct(frames[(B.frameIx + i) % frames.length]);
  B.frameIx = ((B.frameIx || 0) + acts) % frames.length;
}

// --- the four elements of the Shallowhelm chapels, shared with the final ---

/** Fire: every unit in `lanes` burns. */
function elemBurn(lanes, dmg, who) {
  const caught = G.units.filter(u => lanes.includes(u.lane));
  caught.forEach(u => dmgUnit(u, dmg, who));
  return caught.length;
}

/** Frost: the deepest un-frozen soldiers stop cold — no move, no fire. */
function elemFreeze(n, chill, who) {
  const take = [...G.units].filter(u => !u.stun)
    .sort((a, b) => b.col - a.col || a.uid - b.uid).slice(0, n);
  take.forEach(u => { u.stun = 1; if (chill) dmgUnit(u, chill, who); });
  if (take.length) clog(`<span class="d">${who}</span> — ${take.map(u => u.n).join(', ')} frozen solid. No move, no fire, one turn.`, 'loss');
  return take.length;
}

/** Volt: arcs weapons dead for a turn. The soldier stands; the gun does not. */
function elemJam(n, arc, who) {
  const take = shuffle(G.units.filter(u => !u.jam && u.dmg)).slice(0, n);
  take.forEach(u => { u.jam = 1; if (arc) dmgUnit(u, arc, who); });
  if (take.length) clog(`<span class="d">${who}</span> arcs — ${take.map(u => u.n).join(', ')}: weapon${take.length > 1 ? 's' : ''} dead this turn${arc ? ', and the arc burns' : ''}.`, 'loss');
  return take.length;
}

// --- The Reliquary: the ward purge on a countdown, erosion between ---
function reliquaryTick(def) {
  const B = G.boss;
  const every = B.phase === 2 ? Math.max(2, def.chargeEvery - 1) : def.chargeEvery;
  B.charge++;

  if (B.charge >= every) {
    B.charge = 0;
    // The purge: the old friend-or-foe logic survived, inverted — ground
    // your line HOLDS is the only floor the wards spare.
    const caught = G.units.filter(u => G.ter[u.lane][u.col] !== 'p');
    caught.forEach(u => dmgUnit(u, def.purgeDmg, 'Ward purge'));
    clog(caught.length
      ? `<span class="d">THE WARDS FIRE</span> — ${caught.length} unit${caught.length > 1 ? 's' : ''} caught off held ground.`
      : '<span class="g">THE WARDS FIRE</span> — your line stood on held ground. Nothing burns.',
      caught.length ? 'loss' : 'order');
    const made = summonAdds(def.add, def.addN || 1);
    if (made) clog(`${made > 1 ? 'Acolytes answer' : 'An acolyte answers'} the discharge — ${made} ${BEST[def.add].n}${made > 1 ? 's' : ''} walk${made > 1 ? '' : 's'}.`, 'wave');
    return;
  }

  // Anoint: unheld, unoccupied claim is unmade tile by tile. Standing a unit
  // on a converted tile re-claims it next territory flip — the counterplay
  // is presence, same as the purge's.
  const n = def.anoint + (B.phase === 2 ? 1 : 0);
  const cands = [];
  for (let l = 0; l < LANES; l++) for (let c = 0; c < COLS; c++) {
    if (G.ter[l][c] === 'p' && !unitAt(l, c)) cands.push([l, c]);
  }
  const took = shuffle(cands).slice(0, n);
  took.forEach(([l, c]) => { G.ter[l][c] = 'e'; });
  if (took.length) clog(`<span class="d">The Reliquary anoints</span> — ${took.length} tile${took.length > 1 ? 's' : ''} of held ground converted.`, 'loss');
  clog(`<span style="color:var(--violet)">Ward charge ${B.charge} of ${every}</span> — the purge fires in ${every - B.charge} turn${every - B.charge > 1 ? 's' : ''}. Held ground is safe.`, 'info');
}

// --- THE PYREGUARD: exhale down its lane, then march one lane over ---
function pyreguardTick(def) {
  const B = G.boss;
  const body = B.bodies[0];
  if (!body) return;
  const lanes = [...new Set(body.cells.map(([l]) => l))];
  const n = elemBurn(lanes, def.fireDmg + (B.phase === 2 ? 1 : 0), 'The Pyreguard');
  clog(`<span class="d">The Pyreguard exhales</span> — lane ${lanes[0] + 1} burns${n ? ` — ${n} unit${n > 1 ? 's' : ''} caught` : ''}.`, n ? 'loss' : 'info');
  // The march: one lane over, reversing at the edges. Predictable on purpose.
  if (Math.min(...lanes) + body.dir < 0 || Math.max(...lanes) + body.dir >= LANES) body.dir *= -1;
  moveBody(body, body.cells.map(([l, c]) => [l + body.dir, c]), 'The Pyreguard');
  clog(`<span style="color:var(--gold)">The parade steps</span> — lane ${body.cells[0][0] + 1} burns next.`, 'info');
  if (B.phase === 2 || B.turns % def.escEvery === 0) {
    if (summonAdds(def.escort, 1)) clog(`A ${BEST[def.escort].n} falls in behind it.`, 'wave');
  }
}

// --- THE RIMEGUARD: stop the deepest soldier cold ---
function rimeguardTick(def) {
  const B = G.boss;
  elemFreeze(def.freezeN + (B.phase === 2 ? 1 : 0), def.chillDmg, 'The Rimeguard');
  if (B.turns % def.escEvery === 0) {
    if (summonAdds(def.escort, 1)) clog(`A ${BEST[def.escort].n} surfaces in the frost.`, 'wave');
  }
}

// --- THE STORMGUARD: arc weapons dead; overload adds a burn ---
function stormguardTick(def) {
  const B = G.boss;
  elemJam(def.jamN + (B.phase === 2 ? 1 : 0), B.phase === 2 ? def.arcDmg : 0, 'The Stormguard');
  if (B.turns % def.escEvery === 0) {
    if (summonAdds(def.escort, 1)) clog(`A ${BEST[def.escort].n} takes position by the ring.`, 'wave');
  }
}

// --- THE SHARDGUARD: breaches on the Brood Mother's contract ---
function shardguardTick(def) {
  const B = G.boss;
  eruptMarks(def);
  markBreaches(def.markN + (B.phase === 2 ? 1 : 0));
}

/** The boss's whole turn. Runs after the horde acts, before territory flips. */
export function bossTick() {
  const B = G.boss;
  if (!B || G.over || !B.bodies.length) return;
  B.turns++;
  // The bulkhead recovers on the boss's own beat — next turn's fire lands.
  B.dealt = 0;
  B.sealed = false;
  const def = BOSSDEF[B.k];
  if (B.k === 'gantry') gantryTick(def);
  if (B.k === 'brood') broodTick(def);
  if (B.k === 'prism') prismTick(def);
  if (B.k === 'envoy') envoyTick(def);
  if (B.k === 'subject') subjectTick(def);
  if (B.k === 'reliquary') reliquaryTick(def);
  if (B.k === 'pyreguard') pyreguardTick(def);
  if (B.k === 'rimeguard') rimeguardTick(def);
  if (B.k === 'stormguard') stormguardTick(def);
  if (B.k === 'shardguard') shardguardTick(def);
}
