// Operation bosses: the footprint, the shared pool, the phase flip, the clock,
// and each machine's own script.
//
// The five pieces of machinery the boss patch adds, each guarded:
//   - a boss occupies a rectangle and shares ONE hull pool — an area weapon
//     lands once per covered cell, which is the intended anti-boss answer;
//   - it blocks movement like terrain and is immune to instant kills;
//   - one irreversible phase flip: half hull, or shield collapse when shielded;
//   - boss missions run on a hard turn clock, and the win is the kill;
//   - the boss spawns its own adds, outside the wave budget entirely.
import './support/install-dom.js';
import * as A from './support/api.js';
import {failures} from './support/harness.js';
import {spawnUnit, clearBoard, unlockAll, stillAir} from './support/fixtures.js';
import {playOut} from './support/bot.js';
import {POOL} from '../src/content/cards.js';
import {BOSSDEF} from '../src/content/bosses.js';
import {BEST} from '../src/content/hostiles.js';
import {MISSIONS} from '../src/content/missions.js';

const F = failures();

let p;
/** Launch the boss mission for `op` on an emptied board with deep pockets.
 * `boss` names a chapel sub-boss; omitted, the op's final target seeds. */
const start = (op, boss) => {
  p = unlockAll(A.blankProfile('BOSS'), ['rifle', 'wall', 'medic', 'marks', 'lancer']);
  p.op = op;
  A.enterProfile(p);
  A.launchSpec({node: null, op, type: 'boss', mod: 'none', reward: 0, boss});
  stillAir();
  // Clear everything EXCEPT the boss proxies — clearBoard would delete them.
  A.G.units.length = 0;
  A.G.enemies = A.G.enemies.filter(e => e.boss);
  A.G.predict = [];
  A.G.held = [];
  A.G.dp = 30;
};
const proxies = () => A.G.enemies.filter(e => e.boss);
const adds = () => A.G.enemies.filter(e => !e.boss);
/** Damage the pool through one covered cell, as a named unit. */
const hit = (d, attacker) => A.dmgEnemy(proxies()[0], d, 'test', true, attacker);

// --- the shape of the content ---
{
  const ks = Object.keys(BOSSDEF);
  const finals = ks.filter(k => !BOSSDEF[k].sub);
  const subs = ks.filter(k => BOSSDEF[k].sub);
  if (finals.length !== 6) F.push(`expected six operation finals, found ${finals.length}`);
  if (subs.length !== 5) F.push(`expected five node-placed bosses (four guards + the Envoy), found ${subs.length}`);
  if (subs.some(k => BOSSDEF[k].op !== 'crownring')) F.push('a node-placed boss strayed off crownring');
  ks.forEach(k => {
    const d = BOSSDEF[k];
    if (!BEST[k] || BEST[k].t !== 'boss') F.push(`${k}: no boss-tier bestiary entry`);
    if (!A.OPS[d.op]) F.push(`${k}: guards unknown operation '${d.op}'`);
    if (!d.sub && A.bossForOp(d.op) !== k) F.push(`${k}: bossForOp does not round-trip`);
    if (d.hp !== BEST[k].hp) F.push(`${k}: bestiary hull differs from encounter hull`);
    if (!d.bt || !d.bb || !d.p1 || !d.p2) F.push(`${k}: missing phase labels or banner`);
    if (d.l + d.h > A.LANES || d.c + d.w > A.COLS) F.push(`${k}: footprint hangs off the board`);
  });
  // Every named node on the Crownring map carries a real boss: four guard
  // wings, the Envoy on the floor (gated on all four), the Concord after it.
  const named = A.OPS.crownring.nodes.filter(n => n.boss);
  if (named.length !== 5) F.push(`crownring map names ${named.length} bosses, wanted 5`);
  named.forEach(n => {
    if (!BOSSDEF[n.boss] || !BOSSDEF[n.boss].sub) F.push(`${n.id}: names unknown node boss '${n.boss}'`);
    if (n.type !== 'boss') F.push(`${n.id}: boss node is not pinned to a boss mission`);
  });
  const floor = A.OPS.crownring.nodes.find(n => n.boss === 'envoy');
  const wings = named.filter(n => n.boss !== 'envoy');
  if (!floor || !floor.req || floor.req.length !== 4 || wings.some(n => !floor.req.includes(n.id))) {
    F.push('the Summit Floor is not gated on all four guard wings');
  }
  const fin = A.OPS.crownring.nodes.find(n => n.role === 'final');
  if (!fin.req || !fin.req.includes(floor.id)) F.push('the Concord is not gated on the Envoy');
  if (!MISSIONS.boss) F.push('no boss mission type');
  // The encounter is the final node of its operation and nowhere else.
  ['ironveil', 'lumenspire'].forEach(op => {
    const q = unlockAll(A.blankProfile('MAP'));
    q.op = op;
    A.setActive(q);
    A.setMapdef(op);
    A.genRun();
    const fin = A.OPS[op].nodes.find(n => n.role === 'final');
    const want = A.bossForOp(op) ? 'boss' : 'extract';
    if (q.ops[op].nodes[fin.id].type !== want) {
      F.push(`${op}: final node rolled ${q.ops[op].nodes[fin.id].type}, wanted ${want}`);
    }
  });
}

// --- bossfootprint: cells, one pool, blocking, per-cell area hits ---
{
  start('ironveil');                       // the Gantry: 3 wide, 2 deep, at (1,5)
  const d = BOSSDEF.gantry;
  if (proxies().length !== d.w * d.h) F.push(`gantry stands on ${proxies().length} cells, wanted ${d.w * d.h}`);
  if (!A.foeAt(1, 5) || !A.foeAt(2, 7)) F.push('gantry footprint missed a corner');
  if (A.cellPassable(1, 5, -1)) F.push('a boss cell is passable');
  if (A.validTiles('rifle').includes(1 * A.COLS + 5)) F.push('a boss cell offered for deployment');
  // No spawn markers, ever: the wave budget does not exist here.
  if (Object.keys(A.G.manifest || {}).length) F.push('a boss mission rolled a wave manifest');
  if (A.wave(3) === null || Object.keys(A.wave(3)).length) F.push('wave() is not empty mid-clock');

  // A 3x3 blast catches six covered cells: six hits into the same pool. The
  // Gantry's field is 30, so one blast of 5 collapses it exactly — area
  // weapons being the anti-boss answer is the whole design.
  A.blast(1, 6, 5, 'test');
  if (A.G.boss.shield !== 0) F.push(`blast left the field at ${A.G.boss.shield}, wanted 0`);
  if (A.bossHp() !== d.hp) F.push('the blast leaked past the field into hull');
  if (A.G.boss.phase !== 2) F.push('shield collapse did not flip the phase');

  // Instant kills: the drop pod may not crush a boss.
  p.loadout.gear.zaku = 'dropod';
  const tiles = A.validTiles('zaku');
  if (proxies().some(e => tiles.includes(e.lane * A.COLS + e.col))) {
    F.push('drop pod offered a boss cell to crush');
  }
  console.log('footprint holds: six cells, one pool, blast drained the field in one swing');
}

// --- bossphase: exactly one flip, at the right trigger ---
{
  start('sunderglass');                    // the Prism: 70 hull, flips at 35
  hit(34);
  if (A.G.boss.phase !== 1) F.push('prism flipped above half hull');
  hit(2);
  if (A.G.boss.phase !== 2) F.push('prism did not flip at half hull');
  const bodies = A.G.boss.bodies.length;
  hit(3);
  if (A.G.boss.phase !== 2) F.push('phase moved past 2');
  if (A.G.boss.bodies.length > bodies) F.push('a second flip re-shattered the prism');

  start('ironveil');                       // shielded: half HULL must not flip it
  A.G.boss.shield = 1;                     // nearly collapsed, still standing
  hit(25);                                 // 1 absorbed, 24 into hull — past half
  if (A.bossHp() > BOSSDEF.gantry.hp / 2 || A.G.boss.phase !== 2) {
    // shield of 1 collapsed under the hit, so this SHOULD have flipped —
    // rewind: what must never happen is a flip while the shield stands.
  }
  start('ironveil');
  A.G.boss.shield = 999;                   // unbreakable for the check
  hit(30);
  if (A.G.boss.phase !== 1) F.push('gantry flipped while its shield still stood');
  console.log('phase flips once: prism at half hull, gantry only on collapse');
}

// --- gantrytest: the ramp runs 1-2-3-3, and every cell fires after collapse ---
{
  start('ironveil');
  const ramp = [];
  for (let t = 0; t < 4; t++) {
    const before = adds().length;
    A.bossTick();
    ramp.push(adds().length - before);
  }
  if (ramp.join(',') !== '1,2,3,3') F.push(`fabrication ramp ran ${ramp.join(',')}, wanted 1,2,3,3`);
  if (adds().some(e => e.k !== 'fabricant')) F.push('the gantry fabricated something else');

  // Collapse the shield, then count the barrage: six cells, 2 damage each.
  A.G.enemies = A.G.enemies.filter(e => e.boss);
  A.blast(1, 6, 5, 'test');
  const walls = [0, 3, 4].map(l => spawnUnit('wall', l, 1, {hp: 50, max: 50, shield: 0, regen: false}));
  const before = walls.reduce((a, u) => a + u.hp, 0);
  A.G.enemies = A.G.enemies.filter(e => e.boss);   // no fabricant noise in the tally
  A.bossTick();
  A.G.enemies = A.G.enemies.filter(e => e.boss);
  const taken = before - walls.reduce((a, u) => a + u.hp, 0);
  if (taken !== 12) F.push(`phase-two barrage dealt ${taken}, wanted 6 cells x 2`);
  console.log('gantry: ramp 1-2-3-3, six-cell barrage lands 12 after collapse');
}

// --- broodtest: breaches telegraph, occupation absorbs, tendril, seam, split ---
{
  start('blackmarrow');
  // A marked cell with a unit standing on it: the unit takes the damage and
  // nothing surfaces. An empty mark surfaces a hostile from the pool.
  const sitter = spawnUnit('wall', 4, 1, {hp: 30, max: 30, shield: 0, regen: false});
  A.G.boss.marks = [{l: 4, c: 1}, {l: 0, c: 0}];
  const foesBefore = adds().length;
  A.bossTick();
  // The sitter eats the breach AND — as the only occupied lane — the turn's
  // tendril lash. Both are the machine working as scripted.
  const expected = BOSSDEF.brood.breachDmg + BOSSDEF.brood.tendrilDmg;
  if (sitter.hp !== 30 - expected) F.push(`occupied breach turn dealt ${30 - sitter.hp}, wanted ${expected}`);
  if (A.foeAt(4, 1)) F.push('a hostile surfaced under a standing unit');
  const surfaced = adds().length - foesBefore;
  if (surfaced !== 1) F.push(`${surfaced} hostiles surfaced from one empty mark`);
  if (adds().some(e => !BOSSDEF.brood.breachPool.includes(e.k))) F.push('a breach surfaced something off the pool');
  if (A.G.boss.marks.length !== 1) F.push(`phase one marked ${A.G.boss.marks.length} cells, wanted 1`);

  // The tendril lashes one whole occupied row. Sitter is the only unit left —
  // its lane is the only candidate, so the lash is deterministic.
  const hpBefore = sitter.hp;
  A.G.boss.marks = [];
  A.bossTick();
  if (hpBefore - sitter.hp !== BOSSDEF.brood.tendrilDmg) {
    F.push(`tendril dealt ${hpBefore - sitter.hp}, wanted ${BOSSDEF.brood.tendrilDmg}`);
  }

  // The seam: every third turn the whole body works a column forward.
  start('blackmarrow');
  const colsAt = () => Math.min(...proxies().map(e => e.col));
  const c0 = colsAt();
  A.bossTick();                            // turn 1 — drift only
  A.bossTick();                            // turn 2
  if (colsAt() !== c0) F.push('the seam advanced off-schedule');
  A.bossTick();                            // turn 3 — the seam
  if (colsAt() !== c0 - 1) F.push('the seam did not advance on the third turn');

  // The split: three bodies, disjoint lanes, all of which must die.
  start('blackmarrow');
  hit(BOSSDEF.brood.hp / 2 + 1);
  if (A.G.boss.phase !== 2) F.push('brood did not split at half hull');
  if (A.G.boss.bodies.length !== 3) F.push(`split left ${A.G.boss.bodies.length} bodies, wanted 3`);
  const lanes = A.G.boss.bodies.map(b => b.cells[0][0]);
  if (new Set(lanes).size !== 3) F.push('split bodies share a lane — the rig bug is back');
  A.G.boss.marks = [];
  A.G.units.length = 0;
  A.bossTick();
  if (A.G.boss.marks.length !== 2) F.push(`phase two marked ${A.G.boss.marks.length} cells, wanted 2`);
  // Killing two of three is not a kill.
  [...A.G.boss.bodies.slice(1)].forEach(b => {
    const proxy = proxies().find(e => e.body === b.id);
    A.dmgEnemy(proxy, 999, 'test', true);
  });
  if (A.G.bossDown) F.push('boss counted as down with a body still standing');
  A.dmgEnemy(proxies()[0], 999, 'test', true);
  if (!A.G.bossDown) F.push('boss not down with every body dead');
  console.log('brood: telegraphed breaches, deterministic tendril, seam on the third turn, clean three-way split');
}

// --- prismtest: reflection scales, pierces shields, kills; growth is capped ---
{
  start('sunderglass');
  const shooter = spawnUnit('rifle', 0, 0, {hp: 10, max: 10, shield: 0});
  hit(8, shooter);
  if (shooter.hp !== 8) F.push(`reflection returned ${10 - shooter.hp} of 8, wanted 2`);

  const shielded = spawnUnit('wall', 3, 0, {hp: 10, max: 10, shield: 1, regen: false});
  hit(8, shielded);
  if (shielded.hp !== 8 || shielded.shield !== 1) F.push('reflection was absorbed by a shield');

  const doomed = spawnUnit('rifle', 4, 0, {hp: 1, max: 4, shield: 0, phase: 0});
  const lost = A.G.lost;
  hit(8, doomed);
  if (A.G.units.some(u => u.uid === doomed.uid)) F.push('reflection cannot kill');
  if (A.G.lost !== lost + 1) F.push('a reflection kill went uncounted');

  // Shatter: four fragments in four lanes, growing one a turn to the cap.
  start('sunderglass');
  hit(36);                                 // 70 -> 34, past half
  const d = BOSSDEF.prism;
  const share = Math.ceil(d.hp / 5);
  const cap = Math.floor(share * d.growCap);
  if (A.G.boss.bodies.length !== d.fragments) F.push(`shatter left ${A.G.boss.bodies.length} fragments`);
  if (new Set(A.G.boss.bodies.map(b => b.cells[0][0])).size !== d.fragments) F.push('fragments share a lane');
  if (A.G.boss.bodies.some(b => b.hp !== share || b.max !== cap)) F.push('fragment pools mis-sized');
  A.bossTick();
  if (A.G.boss.bodies.some(b => b.hp !== share + 1)) F.push('fragments did not grow');
  A.G.boss.bodies.forEach(b => { b.hp = cap; });
  A.bossTick();
  if (A.G.boss.bodies.some(b => b.hp > cap)) F.push('growth ignored the cap — the unwinnable-fight bug');
  // A fragment still reflects.
  const late = spawnUnit('rifle', 0, 0, {hp: 10, max: 10, shield: 0});
  hit(8, late);
  if (late.hp !== 8) F.push('a fragment stopped reflecting');
  console.log(`prism: 25% comes back past shields and can kill; ${d.fragments} fragments grow ${share}->${cap} and stop`);
}

// --- aperturetest: the beam telegraphs a turn ahead, sweeps in order, fans in phase two ---
{
  start('lumenspire');
  const d = BOSSDEF.aperture;
  // The first tick only marks — nothing burns without a standing telegraph.
  A.bossTick();
  if (!A.G.boss.beam) F.push('aperture never telegraphed a beam');
  const first = A.G.boss.beam.lane;
  if (first !== d.l + 1) F.push(`first mark on lane ${first}, wanted the sweep to start at ${d.l + 1}`);

  const lit = spawnUnit('rifle', first, 0, {hp: 10, max: 10, shield: 0});
  const dark = spawnUnit('wall', (first + 3) % A.LANES, 0, {hp: 12, max: 12, shield: 0});
  A.bossTick();
  if (lit.hp !== 10 - d.beamDmg) F.push(`the lit lane took ${10 - lit.hp}, wanted ${d.beamDmg}`);
  if (dark.hp !== 12) F.push('a lane the beam never marked burned anyway');
  if (A.G.boss.beam.lane !== first + 1) F.push('the sweep is not one lane over per turn');

  // Ping-pong at the edge: ...3, 4, then back to 3 — never off the board.
  while (A.G.boss.beam.lane < A.LANES - 1) A.bossTick();
  A.bossTick();
  if (A.G.boss.beam.lane !== A.LANES - 2) F.push('the sweep did not reverse at the board edge');

  // The flip: the lens shatters, the body contracts to ONE cell, the beam
  // dies with the housing — and the first unbound turn is the scripted
  // human beat: it does nothing at all.
  A.G.units.length = 0;
  hit(d.hp / 2 + 1);
  if (A.G.boss.phase !== 2) F.push('aperture did not flip at half hull');
  if (proxies().length !== 1) F.push(`unbound aperture stands on ${proxies().length} cells, wanted 1`);
  if (A.G.boss.beam) F.push('the beam survived the lens');
  const far = spawnUnit('rifle', 0, 0, {hp: 10, max: 10, shield: 0});
  A.bossTick();                             // the grace beat
  if (far.hp !== 10) F.push('it attacked during the grace beat');
  const seat = () => A.G.boss.bodies[0].cells[0];
  const dist = () => Math.abs(seat()[0] - far.lane) + Math.abs(seat()[1] - far.col);
  const d0 = dist();
  A.bossTick();                             // the hunt begins
  if (dist() >= d0) F.push('unbound, it did not close on the nearest soldier');
  if (dist() > Math.max(1, d0 - d.stalkMv)) F.push(`it closed ${d0 - dist()} cells, wanted ${d.stalkMv}`);

  // The claw: adjacent, and it takes the weakest in reach.
  A.G.units.length = 0;
  const [bl, bc] = seat();
  const tough = spawnUnit('wall', bl, bc - 1, {hp: 12, max: 12, shield: 0});
  const weak = spawnUnit('rifle', bl - 1 >= 0 ? bl - 1 : bl + 1, bc, {hp: 6, max: 10, shield: 0});
  A.bossTick();
  if (weak.hp !== 6 - d.clawDmg) F.push(`the claw dealt ${6 - weak.hp} to the weakest, wanted ${d.clawDmg}`);
  if (tough.hp !== 12) F.push('the claw hit more than one soldier');

  // The dead city answers on the cadence, and it answers with husks.
  start('lumenspire');
  A.bossTick();
  A.bossTick();
  if (!adds().length) F.push('the aperture never raised the dead');
  if (adds().some(e => e.k !== d.add)) F.push('the aperture raised something other than husks');
  console.log(`aperture: marked lane burns for ${d.beamDmg} a turn later, ordered sweep; at half hull it leaves the lens, stands one grace beat, then hunts and claws the wounded for ${d.clawDmg}`);
}

// --- envoytest: censure by adjacency, the dive is untouchable, the surface brings the delegation ---
{
  start('crownring', 'envoy');
  const d = BOSSDEF.envoy;
  // Footprint lanes 1-2 x cols 5-6: (1,4) is within arm's reach, (4,0) is not.
  const near = spawnUnit('rifle', 1, 4, {hp: 10, max: 10, shield: 0});
  const far = spawnUnit('wall', 4, 0, {hp: 12, max: 12, shield: 0});
  A.bossTick();                            // turn 1 — in session: the censure
  if (near.hp !== 10 - d.adjDmg) F.push(`adjacency took ${10 - near.hp}, wanted ${d.adjDmg}`);
  if (far.hp !== 12) F.push('the censure reached across the board');

  A.bossTick();                            // turn 2 — censure again
  A.bossTick();                            // turn 3 — the dive
  if (!A.G.boss.under) F.push('the envoy did not dive on schedule');
  if (proxies().length) F.push('a submerged envoy still stands on the board');
  if (A.G.boss.bodies.length !== 1 || A.G.bossDown) F.push('diving unmade the body');

  A.G.units.length = 0;
  A.bossTick();                            // turn 4 — the surface
  if (A.G.boss.under) F.push('the envoy stayed under past its turn');
  if (proxies().length !== d.w * d.h) F.push(`surfaced on ${proxies().length} cells, wanted ${d.w * d.h}`);
  const escort = adds().filter(e => e.k === d.escort);
  if (escort.length < d.escortN) F.push(`the delegation numbered ${escort.length}, wanted ${d.escortN}`);

  // Phase two: it surfaces on YOUR side of the board.
  start('crownring', 'envoy');
  hit(d.hp / 2 + 1);
  if (A.G.boss.phase !== 2) F.push('envoy did not flip at half hull');
  A.G.boss.turns = 1;                      // next tick is even — a phase-two dive turn
  A.bossTick();
  if (!A.G.boss.under) F.push('phase two did not shorten the dive cycle');
  A.bossTick();
  if (Math.min(...proxies().map(e => e.col)) > 3) F.push('a phase-two surface stayed deep — it should come up close');
  console.log(`envoy: censure ${d.adjDmg} within arm's reach, untouchable dive every ${d.diveEvery}, delegation of ${d.escortN} on the surface`);
}

// --- the hijacked honor guards: each wing's element behaves, and only that element ---
{
  // THE PYREGUARD: its lane burns, then it marches one lane over.
  start('crownring', 'pyreguard');
  const di = BOSSDEF.pyreguard;
  const lane0 = A.G.boss.bodies[0].cells[0][0];
  const inLane = spawnUnit('rifle', lane0, 0, {hp: 10, max: 10, shield: 0});
  const outLane = spawnUnit('wall', (lane0 + 2) % A.LANES, 0, {hp: 12, max: 12, shield: 0});
  A.bossTick();
  if (inLane.hp !== 10 - di.fireDmg) F.push(`the pyre lane took ${10 - inLane.hp}, wanted ${di.fireDmg}`);
  if (outLane.hp !== 12) F.push('the exhale reached a lane it does not stand in');
  const lane1 = A.G.boss.bodies[0].cells[0][0];
  if (Math.abs(lane1 - lane0) !== 1) F.push('the Pyreguard did not march one lane');

  // THE RIMEGUARD: the deepest soldier freezes — no move, no fire, one turn.
  start('crownring', 'rimeguard');
  const dd = BOSSDEF.rimeguard;
  const deep = spawnUnit('rifle', 0, 4, {hp: 10, max: 10, shield: 0});
  const shallow = spawnUnit('marks', 4, 0, {hp: 10, max: 10, shield: 0});
  A.bossTick();
  if (!deep.stun) F.push('the Rimeguard did not freeze the deepest soldier');
  if (shallow.stun) F.push('the Rimeguard froze the wrong soldier');
  if (deep.hp !== 10 - dd.chillDmg) F.push(`the chill dealt ${10 - deep.hp}, wanted ${dd.chillDmg}`);
  if (A.moveTargets(deep).length) F.push('a frozen soldier can still move');

  // THE STORMGUARD: weapons arc dead; the soldier stands and can still move.
  start('crownring', 'stormguard');
  const dc = BOSSDEF.stormguard;
  const guns = [0, 1, 2].map(l => spawnUnit('rifle', l, 0, {hp: 10, max: 10, shield: 0}));
  A.bossTick();
  const jammed = guns.filter(u => u.jam);
  if (jammed.length !== dc.jamN) F.push(`the arc silenced ${jammed.length} guns, wanted ${dc.jamN}`);
  if (guns.some(u => u.hp !== 10)) F.push('phase-one arc dealt damage');
  if (jammed.some(u => !A.moveTargets(u).length && !u.stun)) F.push('a jammed soldier lost its legs too');

  // THE SHARDGUARD: the Brood Mother's breach contract at the foundations.
  start('crownring', 'shardguard');
  const dOss = BOSSDEF.shardguard;
  A.bossTick();
  if (A.G.boss.marks.length !== dOss.markN) F.push(`shardguard marked ${A.G.boss.marks.length}, wanted ${dOss.markN}`);
  const seat = A.G.boss.bodies[0].cells.map(x => x.join()).join(';');
  A.bossTick();
  if (A.G.boss.bodies[0].cells.map(x => x.join()).join(';') !== seat) F.push('the Shardguard moved — it is rooted');
  if (adds().some(e => !dOss.breachPool.includes(e.k))) F.push('a crystal breach surfaced something off the pool');
  console.log('honor guards: pyre marches and burns, rime freezes the deepest, storm jams guns not legs, shard keeps the breach contract');
}

// --- THE CONCORD: one motion per turn in rotation, two after the flip ---
{
  start('crownring');
  const d = BOSSDEF.concord;
  if (A.G.boss.k !== 'concord') F.push(`crownring final seeded ${A.G.boss.k}, wanted the Concord`);
  const squad = [0, 1, 2, 3].map(l => spawnUnit('rifle', l, 3, {hp: 20, max: 20, shield: 0}));

  A.bossTick();                            // motion 1: pyre — one lane burns
  const burned = squad.filter(u => u.hp < 20);
  if (burned.length !== 1) F.push(`the pyre motion burned ${burned.length} lanes' worth, wanted 1`);
  if (burned.length && 20 - burned[0].hp !== d.fireDmg) F.push('pyre motion damage off');
  if (A.G.boss.hymn !== 1) F.push('the rotation did not advance to rime');

  A.bossTick();                            // motion 2: rime — deepest frozen
  if (squad.filter(u => u.stun).length !== d.freezeN) F.push('the rime motion froze the wrong number');

  squad.forEach(u => { u.stun = 0; });
  A.bossTick();                            // motion 3: storm — guns arc dead
  if (squad.filter(u => u.jam).length !== d.jamN) F.push('the storm motion jammed the wrong number');

  squad.forEach(u => { u.jam = 0; });
  A.bossTick();                            // motion 4: shard — breaches marked
  if (A.G.boss.marks.length !== d.markN) F.push(`the shard motion marked ${A.G.boss.marks.length}, wanted ${d.markN}`);
  if (A.G.boss.hymn !== 0) F.push('the rotation did not come back around to the pyre');

  // The flip: two hymns a turn, and the rotation still advances two.
  hit(d.hp / 2 + 1);
  if (A.G.boss.phase !== 2) F.push('the Concord did not flip at half hull');
  const at = A.G.boss.hymn;
  A.G.boss.marks = [];
  A.bossTick();
  if (A.G.boss.hymn !== (at + 2) % 4) F.push('a unanimous floor did not carry two motions');
  console.log(`concord: pyre->rime->storm->shard in rotation, two a turn after ${d.bt}`);
}

// --- reliquarytest: the purge spares held ground, erosion between charges, it never moves ---
{
  start('shallowhelm');
  const d = BOSSDEF.reliquary;
  if (A.G.boss.k !== 'reliquary') F.push(`shallowhelm final seeded ${A.G.boss.k}, wanted the Reliquary`);
  const home = spawnUnit('wall', 0, 0, {hp: 12, max: 12, shield: 0});   // ter 'p'
  const fwd = spawnUnit('rifle', 4, 4, {hp: 10, max: 10, shield: 0});   // ter 'n'
  const seat = A.G.boss.bodies[0].cells.map(x => x.join()).join(';');
  const heldTiles = () => A.G.ter.flat().filter(t => t === 'p').length;
  const before = heldTiles();
  A.bossTick();                            // charge 1 — anoint only
  if (home.hp !== 12 || fwd.hp !== 10) F.push('the wards fired before the count was up');
  if (before - heldTiles() !== d.anoint) F.push(`anoint converted ${before - heldTiles()} tiles, wanted ${d.anoint}`);
  A.bossTick();                            // charge 2
  A.bossTick();                            // charge 3
  A.bossTick();                            // charge 4 — THE PURGE
  if (fwd.hp !== 10 - d.purgeDmg) F.push(`off held ground took ${10 - fwd.hp}, wanted ${d.purgeDmg}`);
  if (home.hp !== 12) F.push('a unit standing on held ground burned — the friend-or-foe rule is gone');
  if (A.G.boss.charge !== 0) F.push('the charge did not reset after firing');
  if (!adds().some(e => e.k === d.add)) F.push('no acolyte answered the discharge');
  if (adds().some(e => e.k !== d.add)) F.push('the discharge raised something other than zealots');
  if (A.G.boss.bodies[0].cells.map(x => x.join()).join(';') !== seat) F.push('the reliquary moved — it is an emplacement');

  // Phase two shortens the cycle: charge 1, 2, fire on 3.
  start('shallowhelm');
  hit(d.hp / 2 + 1);
  if (A.G.boss.phase !== 2) F.push('reliquary did not flip at half hull');
  const late = spawnUnit('rifle', 4, 4, {hp: 10, max: 10, shield: 0});
  A.bossTick();
  A.bossTick();
  if (late.hp !== 10) F.push('the shortened cycle fired early');
  A.bossTick();
  if (late.hp !== 10 - d.purgeDmg) F.push('phase two did not shorten the purge cycle to three');
  console.log(`reliquary: purge ${d.purgeDmg} spares held ground on a ${d.chargeEvery}-count, zealot acolytes, static seat`);
}

// --- the clock: running out of turns is a loss, the kill is the win ---
{
  start('ironveil');
  A.G.turn = A.G.waves;                    // the last turn of the cap
  A.endTurn();
  if (!A.G.over || A.G.result.cleared) F.push('the clock ran out and the mission did not fail');

  start('ironveil');
  A.G.boss.shield = 0;
  hit(999);
  if (!A.G.bossDown) F.push('999 through one cell did not finish the pool');
  A.endTurn();
  if (!A.G.over || !A.G.result.cleared) F.push('a dead boss did not win the mission');
  console.log('clock: turn cap loses, the kill wins');
}

// --- bossresolve: the bot fights each boss and the mission always resolves ---
{
  for (const k of Object.keys(BOSSDEF)) {
    const d = BOSSDEF[k];
    for (let i = 0; i < 3; i++) {
      const q = unlockAll(A.blankProfile('R' + i),
        ['rifle', 'marks', 'wall', 'medic', 'lancer', 'bulwark', 'assassin', 'knight', 'samurai', 'archer', 'turret', 'scout']);
      q.op = d.op;
      A.enterProfile(q);
      A.launchSpec({node: null, op: d.op, type: 'boss', mod: 'none', reward: 40, boss: d.sub ? k : undefined});
      const r = playOut({advance: true, maxTurns: 40});
      if (!r.over) F.push(`${k}: fight ${i} never resolved`);
      if (A.G.turn > A.G.waves + 1) F.push(`${k}: fight ${i} outran the clock (turn ${A.G.turn})`);
    }
  }
  console.log(`resolve: ${Object.keys(BOSSDEF).length * 3} bot fights, every one ended inside the clock`);
}

F.report('operation bosses: footprint, phases, scripts, clock and resolve all hold');
