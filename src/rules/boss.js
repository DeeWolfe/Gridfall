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
    under: false, charge: 0, grace: 0,
    bodies: [{id: 1, hp: d.hp, max: d.hp, cells, dir: 1}], nextBody: 2};
  G.bossDown = false;
  // Each machine sets its own clock — a doubled hull earns a longer siege.
  if (d.turns) G.waves = d.turns;
  addBodyProxies(G.boss.bodies[0]);
  cells.forEach(([l, c]) => { G.ter[l][c] = 'e'; });
  clog(`<span class="d">TARGET: ${BEST[k].n.toUpperCase()}</span> — ${d.hp} hull` +
    (d.shield ? ` behind a ${d.shield}-point containment field` : '') +
    (d.plate ? `, plated — armor shrugs ${d.plate} off every hit` : '') +
    `. ${d.turns} turns on the clock.`, 'loss');
  clog(`<span style="color:var(--violet)">${d.p1}</span>`, 'info');
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
    body.hp -= dealt;
    setBodyHp(body);
    tapeEvent({type: 'hit', foe: true, lane: e.lane, col: e.col, amount: dealt, died: body.hp <= 0});
  }

  if (body.hp <= 0) {
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
  if (B.phase === 1 && !def.shield && bossHp() <= def.hp / 2) phaseFlip();
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

// --- The Prism: shatter at half hull ---
function prismShatter(def) {
  const B = G.boss;
  const main = B.bodies[0];
  if (!main) return;
  const share = Math.max(1, Math.ceil(def.hp / 5));
  // The cap matters: without it the fragments outgrow any damage the player
  // can apply, and an unwinnable fight presents as tuning (BOSS-BRIEF).
  const cap = Math.max(share, Math.floor(share * def.growCap));
  const col = main.cells[0][1];
  removeBodyProxies(main);
  B.bodies = [];
  const lanes = shuffle([...Array(LANES).keys()]);
  let placed = 0;
  for (const l of lanes) {
    if (placed >= def.fragments) break;
    const c = freeColNear(l, col);
    if (c == null) continue;
    const nb = {id: B.nextBody++, hp: share, max: cap, grow: 1, cells: [[l, c]], dir: 1};
    B.bodies.push(nb);
    addBodyProxies(nb);
    G.ter[l][c] = 'e';
    placed++;
  }
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

  // One tendril lash per turn, a whole row, no warning — the breaches are what
  // you plan around, the tendril is what you eat.
  const armed = [...new Set(G.units.map(u => u.lane))];
  if (armed.length) {
    const l = armed[randInt(armed.length)];
    const hit = G.units.filter(u => u.lane === l);
    hit.forEach(u => dmgUnit(u, def.tendrilDmg, 'Tendril lash'));
    clog(`<span class="d">Tendril</span> lashes lane ${l + 1} — ${hit.length} unit${hit.length > 1 ? 's' : ''} struck.`, 'loss');
  }

  // Tomorrow's breaches, telegraphed now — two per turn once it has split.
  markBreaches(B.phase === 2 ? 2 : 1);
}

function prismTick() {
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
}

// --- SUBJECT ONE: whole, it walks at your line; divided, it comes apart ---

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

    // The human half flees your line — and knits the hive half back together.
    if (human) {
      for (let i = 0; i < def.fleeMv; i++) if (!stepBody(human, true)) break;
      if (hive && hive.hp < hive.max) {
        hive.hp = Math.min(hive.max, hive.hp + def.mendN);
        setBodyHp(hive);
        clog(`<span class="d">The human half will not let it die</span> — ${def.mendN} hull knit back into the hive half.`, 'info');
      }
    }

    // The hive half hunts — harder, once there is no one left to hold it back.
    if (hive) {
      const rage = human ? 0 : 1;
      for (let i = 0; i < def.huntMv + rage; i++) if (!stepBody(hive, false)) break;
      const [l, c] = hive.cells[0];
      const prey = G.units.filter(u => Math.abs(u.lane - l) + Math.abs(u.col - c) === 1)
        .sort((a, b) => a.hp - b.hp || a.uid - b.uid)[0];
      if (prey) {
        dmgUnit(prey, def.clawDmg + rage, 'Subject One');
        clog(`<span class="d">The hive half claws ${prey.n}</span>${rage ? " — there is nothing holding it back now" : ''}.`, 'loss');
      }
    }
  }

  // What is left of the staff answer when it screams — in either phase.
  if (B.turns % def.addEvery === 0) {
    const made = summonAdds(def.add, 1);
    if (made) clog(`It screams — a ${BEST[def.add].n} answers.`, 'wave');
  }
}

// --- The Envoy: censure, dive, surface with the delegation ---
function envoyTick(def) {
  const B = G.boss;
  const body = B.bodies[0];
  if (!body) return;
  const every = B.phase === 2 ? Math.max(2, def.diveEvery - 1) : def.diveEvery;

  if (B.under) {
    // Surface. Candidate anchors where the footprint fits; it avoids your
    // units when it can (crushing a fresh deploy with no tell reads as a
    // cheat), and in phase two it comes up on YOUR side of the board.
    const spots = [];
    for (let l = 0; l + def.h <= LANES; l++) for (let c = 0; c + def.w <= COLS; c++) {
      const cells = [];
      for (let dl = 0; dl < def.h; dl++) for (let dc = 0; dc < def.w; dc++) cells.push([l + dl, c + dc]);
      if (cells.some(([cl, cc]) => G.ter[cl][cc] === 'x' || foeAt(cl, cc))) continue;
      spots.push({cells, c, units: cells.filter(([cl, cc]) => unitAt(cl, cc)).length});
    }
    if (!spots.length) return;  // board jammed solid — it stays under a turn
    const close = B.phase === 2 ? spots.filter(s => s.c <= 2) : spots;
    const pool = close.length ? close : spots;
    const clear = Math.min(...pool.map(s => s.units));
    const pick = shuffle(pool.filter(s => s.units === clear))[0];
    B.under = false;
    pick.cells.forEach(([l, c]) => crushCell(l, c, BEST[B.k].n));
    body.cells = pick.cells;
    addBodyProxies(body);
    pick.cells.forEach(([l, c]) => { G.ter[l][c] = 'e'; });
    clog(`<span class="d">The Envoy surfaces</span> at lane ${pick.cells[0][0] + 1} — the floor is wherever it says it is.`, 'loss');
    const n = def.escortN + (B.phase === 2 ? 1 : 0);
    const made = summonAdds(def.escort, n);
    if (made) clog(`The delegation comes up with it — ${made} ${BEST[def.escort].n}${made > 1 ? 's' : ''}.`, 'wave');
    return;
  }

  if (B.turns % every === 0) {
    // Dive: the proxies leave the board. Nothing can touch it until it
    // surfaces — the clock keeps running, which is the whole cost.
    removeBodyProxies(body);
    B.under = true;
    clog('<span style="color:var(--violet)">The Envoy dives</span> beneath the wards — untouchable until it surfaces.', 'info');
    return;
  }

  // Censure: everything standing adjacent to the floor it holds is struck.
  const own = new Set(body.cells.map(([l, c]) => l + ',' + c));
  const adj = new Set();
  body.cells.forEach(([l, c]) => [[l - 1, c], [l + 1, c], [l, c - 1], [l, c + 1]]
    .forEach(([al, ac]) => {
      if (al < 0 || al >= LANES || ac < 0 || ac >= COLS) return;
      if (!own.has(al + ',' + ac)) adj.add(al + ',' + ac);
    }));
  const struck = G.units.filter(u => adj.has(u.lane + ',' + u.col));
  struck.forEach(u => dmgUnit(u, def.adjDmg, 'The Envoy'));
  if (struck.length) clog(`<span class="d">The Envoy censures the floor</span> — ${struck.length} unit${struck.length > 1 ? 's' : ''} within arm's reach struck.`, 'loss');
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
