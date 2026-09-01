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
import {unitAt, foeAt} from './board.js';
import {dmgUnit, pierceUnit} from './combat.js';
import {mkFoe} from './spawn.js';
import {clog} from './log.js';
import {tapeEvent} from './tape.js';

/** The boss guarding this operation's final node, if it has one. */
export const bossForOp = op => Object.keys(BOSSDEF).find(k => BOSSDEF[k].op === op) || null;

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

/** Seed the operation's boss onto the board at mission start. */
export function seedBoss() {
  const k = bossForOp(G.op);
  if (!k) return;
  const d = BOSSDEF[k];
  const cells = [];
  for (let l = d.l; l < d.l + d.h; l++) for (let c = d.c; c < d.c + d.w; c++) cells.push([l, c]);
  G.boss = {k, phase: 1, shield: d.shield || 0, turns: 0, marks: [],
    bodies: [{id: 1, hp: d.hp, max: d.hp, cells, dir: 1}], nextBody: 2};
  G.bossDown = false;
  addBodyProxies(G.boss.bodies[0]);
  cells.forEach(([l, c]) => { G.ter[l][c] = 'e'; });
  clog(`<span class="d">TARGET: ${BEST[k].n.toUpperCase()}</span> — ${d.hp} hull` +
    (d.shield ? ` behind a ${d.shield}-point containment field` : '') +
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

function gantryTick(def) {
  const B = G.boss;
  // Fabrication ramps 1-2-3 and holds — and it does NOT stop in phase two.
  const count = def.ramp[Math.min(B.turns - 1, def.ramp.length - 1)];
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
    G.enemies.push(mkFoe(def.add, l, at, BEST[def.add].hp));
    made++;
  }
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

function broodTick(def) {
  const B = G.boss;

  // Yesterday's marked breaches erupt first. A unit standing on the mark takes
  // the damage INSTEAD of anything surfacing — occupying a breach is a choice.
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

  // Tomorrow's breaches, telegraphed now: anywhere on the board, your half
  // included. Two per turn once it has split.
  const want = B.phase === 2 ? 2 : 1;
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

/** The boss's whole turn. Runs after the horde acts, before territory flips. */
export function bossTick() {
  const B = G.boss;
  if (!B || G.over || !B.bodies.length) return;
  B.turns++;
  const def = BOSSDEF[B.k];
  if (B.k === 'gantry') gantryTick(def);
  if (B.k === 'brood') broodTick(def);
  if (B.k === 'prism') prismTick(def);
}
