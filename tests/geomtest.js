// geomCells(): where a weapon reaches, versus what it hits.
//
// The board highlight and the card's hitbox diagram both read geomCells(),
// while damage still resolves through geomFor(). That split is only safe while
// one is a strict superset of the other — the moment they disagree, the game
// draws a lie: a hostile struck from a tile that never lit up, or a lit tile
// that turns out to be out of reach.
//
// So the load-bearing check here is randomised rather than hand-picked: every
// firing pattern, scattered across hundreds of boards with friendly blockers
// in the way, asserting that everything geomFor() strikes stands on a cell
// geomCells() lit. It caught a real off-by-one in `range3` on the first run.
import './support/install-dom.js';
import * as A from './support/api.js';
import {failures} from './support/harness.js';
import {geomFor, geomCells} from '../src/rules/targeting.js';
import {POOL} from '../src/content/cards.js';
import {GEAR} from '../src/content/gear.js';
import {BEST} from '../src/content/hostiles.js';
import {LANES, COLS} from '../src/state/constants.js';

const F = failures();
const p = A.blankProfile('GEOM');
A.setActive(p);
p.unlocks.cards = Object.keys(POOL);

// Every pattern the game can put on the board, from cards AND from gear — a
// Frame's weapon replaces its printed one, so three geometries (wings, sweep,
// cross3) exist only on gear and would otherwise never be sampled here at all.
const GEAR_TG = Object.values(GEAR).filter(g => g.tg);
const TGS = [...new Set([
  ...Object.values(POOL).map(k => k.tg),
  ...GEAR_TG.map(g => g.tg),
].filter(t => t && t !== 'none'))];
// One representative card per pattern. A gear-only pattern is exercised by
// fitting that weapon to the Frame it belongs to.
// A Frame carries one weapon at a time, and two of the gear-only patterns live
// on the same Frame — so the weapon is fitted per trial, not once up front, or
// the second assignment silently swallows the first.
const SAMPLE = TGS.map(tg => {
  const onCard = Object.keys(POOL).find(k => POOL[k].tg === tg);
  if (onCard) return {tg, id: onCard, gear: null};
  const gi = Object.keys(GEAR).find(g => GEAR[g].tg === tg);
  // A gear-only pattern rides a Frame (bound piece) or any Fireteam (line piece).
  const host = GEAR[gi].frame || Object.keys(POOL).find(k => POOL[k].line === GEAR[gi].fits);
  return {tg, id: host, gear: gi};
});

let uid = 90000;
const place = (id, lane, col) => {
  const u = A.mkUnit(id, lane, col);
  u.uid = ++uid;
  return u;
};

let checked = 0;
const seen = {};
const rand = n => Math.floor(Math.random() * n);

for (let trial = 0; trial < 400; trial++) {
  A.launchSpec({node: null, type: 'stronghold', mod: 'none', reward: 0, heat: 1});
  const G = A.G;
  G.units = [];
  G.enemies = [];

  for (const {id, gear} of SAMPLE) {
    // Fit this pattern's weapon just before building the unit that carries it.
    if (gear) p.loadout.gear[GEAR[gear].frame] = gear;
    G.units.push(place(id, rand(LANES), rand(3)));
    if (gear) delete p.loadout.gear[GEAR[gear].frame];
  }
  // Friendly blockers, so the beam-cutting path is exercised rather than
  // assumed — that is where the two functions are most likely to drift.
  for (let i = 0; i < 3; i++) G.units.push(place('wall', rand(LANES), 2 + rand(4)));
  // Hostiles never share a cell with a unit; the real board cannot either,
  // and letting them overlap would fake a blocker standing on its own target.
  for (let i = 0; i < 14; i++) {
    const lane = rand(LANES);
    const col = rand(COLS);
    if (G.units.some(u => u.lane === lane && u.col === col)) continue;
    if (G.enemies.some(e => e.lane === lane && e.col === col)) continue;
    G.enemies.push({uid: ++uid, k: 'crawler', lane, col, hp: 3});
  }

  for (const u of G.units) {
    if (!u.tg || u.tg === 'none' || !u.dmg) continue;
    const cells = new Set(geomCells(u));
    seen[u.tg] = (seen[u.tg] || 0) + 1;
    for (const e of geomFor(u)) {
      checked++;
      if (!cells.has(e.lane * COLS + e.col)) {
        F.push(`${u.tg}: struck a hostile at ${e.lane},${e.col} that geomCells() never lit ` +
          `(unit at ${u.lane},${u.col})`);
      }
    }
  }
}

const missed = TGS.filter(t => !seen[t]);
console.log(`patterns exercised: ${Object.keys(seen).length} / ${TGS.length}`);
if (missed.length) F.push('patterns never exercised: ' + missed.join(', '));
console.log(`hit/cell pairs checked: ${checked}`);
if (checked < 1000) F.push(`only ${checked} pairs checked — the fixture stopped producing hits`);

// --- the geometry itself, pinned at a known origin ---
// `at` lets the diagram render a pattern without a live board, so it has to
// produce the same shape the board would. Origin far from every edge.
{
  A.launchSpec({node: null, type: 'stronghold', mod: 'none', reward: 0, heat: 1});
  A.G.units = [];
  A.G.enemies = [];
  const shape = (id, lane, col) => {
    const u = place(id, 0, 0);
    return geomCells(u, {lane, col}).map(i => [Math.floor(i / COLS), i % COLS])
      .map(([l, c]) => `${l - lane},${c - col}`).sort().join(' ');
  };
  const CASES = [
    ['rifle', 'first', '0,1 0,2 0,3 0,4 0,5 0,6'],
    ['lancer', 'ahead3', '0,1 0,2 0,3'],
    ['naginata', 'around', '-1,-1 -1,0 -1,1 0,-1 0,1 1,-1 1,0 1,1'],
    ['samurai', 'sweep5', '-1,0 -1,1 0,1 1,0 1,1'],
    ['rearguard', 'rearvert3', '-1,-1 0,-1 1,-1'],
    ['mortar', 'cross4', '-1,4 0,3 0,4 0,5 1,4'],
    ['plasma', 'blast4', '-1,3 -1,4 -1,5 0,3 0,4 0,5 1,3 1,4 1,5'],
    ['archer', 'archer', '-1,-1 0,1 0,2 1,-1'],
  ];
  for (const [id, label, want] of CASES) {
    const got = shape(id, 2, 1);
    console.log(`${label}: ${got}`);
    if (got !== want) F.push(`${label} shape is "${got}", expected "${want}"`);
  }
}

// --- a weapon with nothing to fire never lights anything ---
{
  A.launchSpec({node: null, type: 'stronghold', mod: 'none', reward: 0, heat: 1});
  A.G.units = [];
  A.G.enemies = [];
  const medic = place('medic', 2, 1);       // tg 'none', no damage
  if (geomCells(medic).length) F.push('a unit with no weapon lit cells anyway');
  console.log('unarmed unit lights nothing:', geomCells(medic).length === 0);
}

// --- your own wall cuts your own beam, and the highlight admits it ---
{
  A.launchSpec({node: null, type: 'stronghold', mod: 'none', reward: 0, heat: 1});
  A.G.enemies = [];
  const gun = place('rifle', 2, 1);
  const wall = place('wall', 2, 3);
  A.G.units = [gun, wall];
  const cells = geomCells(gun).map(i => i % COLS);
  console.log('rifle behind a wall at col 3 reaches:', cells);
  if (cells.length !== 1 || cells[0] !== 2) {
    F.push(`blocked rifle lit ${cells.join(',')} — expected only column 2`);
  }
}

// --- the diagram: every weapon gets one, nothing else does ---
{
  const {hitboxFor, hitboxForFoe} = await import('../src/render/hitbox.js');
  const count = (h, cls) => (h.match(new RegExp(`class="${cls}"`, 'g')) || []).length;

  let withDiagram = 0;
  for (const id of Object.keys(POOL)) {
    const k = POOL[id];
    const h = hitboxFor(id);
    const armed = !!(k.tg && k.tg !== 'none' && k.dmg);
    if (h) withDiagram++;
    if (!!h !== armed) F.push(`${id}: diagram=${!!h} but armed=${armed}`);
    if (h && count(h, 'me') !== 1) F.push(`${id}: diagram has ${count(h, 'me')} unit markers`);
  }
  console.log(`cards with a hitbox diagram: ${withDiagram} / ${Object.keys(POOL).length}`);

  // Every hostile gets one too, in its own palette — a hostile diagram
  // wearing the card colours would read as something you control.
  for (const kid of Object.keys(BEST)) {
    const h = hitboxForFoe(kid);
    if (!h) { F.push(`${kid}: no diagram at all`); continue; }
    if (count(h, 'hbfoe') !== 1) F.push(`${kid}: ${count(h, 'hbfoe')} hostile markers`);
    const leaked = count(h, 'hbhit') + count(h, 'hbreach') + count(h, 'me');
    if (leaked) F.push(`${kid}: ${leaked} cells drawn in the card palette`);
    const marked = count(h, 'hbstrike') + count(h, 'hbthreat') + count(h, 'hbinfl');
    if (!marked) F.push(`${kid}: diagram marks no ground at all`);
  }
  console.log(`hostiles with a hitbox diagram: ${Object.keys(BEST).length} / ${Object.keys(BEST).length}`);
}

F.report('geomCells: reach matches what is struck, in every pattern');
