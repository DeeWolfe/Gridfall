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
  bulkOff();
  stillAir();
  // Clear everything EXCEPT the boss proxies — clearBoard would delete them.
  A.G.units.length = 0;
  A.G.enemies = A.G.enemies.filter(e => e.boss);
  A.G.predict = [];
  A.G.held = [];
  A.G.dp = 30;
};
// Mechanic blocks run with the bulkhead OFF so single-hit hull math stays
// exact; the bulkhead and speed-kill blocks switch it back on explicitly.
const BULKS = Object.fromEntries(Object.keys(BOSSDEF).map(k => [k, BOSSDEF[k].bulk]));
const bulkOff = () => Object.keys(BOSSDEF).forEach(k => { BOSSDEF[k].bulk = 0; });
const bulkOn = () => Object.keys(BOSSDEF).forEach(k => { BOSSDEF[k].bulk = BULKS[k]; });

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
  if (subs.length !== 4) F.push(`expected four node-placed honor guards, found ${subs.length}`);
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
  // Every named node on the Crownring map carries a real guard, and the
  // final — the Summit Floor, where the Envoy sits — is gated on all four.
  const wings = A.OPS.crownring.nodes.filter(n => n.boss);
  if (wings.length !== 4) F.push(`crownring map names ${wings.length} guards, wanted 4`);
  wings.forEach(n => {
    if (!BOSSDEF[n.boss] || !BOSSDEF[n.boss].sub) F.push(`${n.id}: names unknown node boss '${n.boss}'`);
    if (n.type !== 'boss') F.push(`${n.id}: guard node is not pinned to a boss mission`);
  });
  const fin = A.OPS.crownring.nodes.find(n => n.role === 'final');
  if (!fin.req || fin.req.length !== 4 || wings.some(n => !fin.req.includes(n.id))) {
    F.push('the Summit Floor is not gated on all four guard wings');
  }
  if (A.bossForOp('crownring') !== 'envoy') F.push('crownring final should seed the Envoy');
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
  // Gantry's field is 20, so a blast of 5 collapses it in four cells and the
  // last two land on hull through plating (5 - 1 each) — area weapons being
  // the anti-boss answer is the whole design.
  A.blast(1, 6, 5, 'test');
  if (A.G.boss.shield !== 0) F.push(`blast left the field at ${A.G.boss.shield}, wanted 0`);
  if (A.bossHp() !== d.hp - 8) F.push(`overkill landed ${d.hp - A.bossHp()} on hull, wanted 8 through plating`);
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
  start('sunderglass');                    // the Prism: unplated (crystal reflects,
  hit(Math.floor(BOSSDEF.prism.hp / 2) - 1);   // it does not armor) — just above half
  if (A.G.boss.phase !== 1) F.push('prism flipped above half hull');
  hit(1);                                  // and the point that reaches it
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
  const want = 6 * BOSSDEF.gantry.cellDmg;
  if (taken !== want) F.push(`phase-two barrage dealt ${taken}, wanted 6 cells x ${BOSSDEF.gantry.cellDmg}`);
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
  const r8 = Math.round(8 * BOSSDEF.prism.reflect);
  const shooter = spawnUnit('rifle', 0, 0, {hp: 10, max: 10, shield: 0});
  hit(8, shooter);
  if (shooter.hp !== 10 - r8) F.push(`reflection returned ${10 - shooter.hp} of 8, wanted ${r8}`);

  const shielded = spawnUnit('wall', 3, 0, {hp: 10, max: 10, shield: 1, regen: false});
  hit(8, shielded);
  if (shielded.hp !== 10 - r8 || shielded.shield !== 1) F.push('reflection was absorbed by a shield');

  const doomed = spawnUnit('rifle', 4, 0, {hp: 1, max: 4, shield: 0, phase: 0});
  const lost = A.G.lost;
  hit(8, doomed);
  if (A.G.units.some(u => u.uid === doomed.uid)) F.push('reflection cannot kill');
  if (A.G.lost !== lost + 1) F.push('a reflection kill went uncounted');

  // Shatter: four fragments in four lanes, growing one a turn to the cap.
  start('sunderglass');
  hit(Math.floor(BOSSDEF.prism.hp / 2) + 2);   // past half, straight to the shatter
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
  if (late.hp !== 10 - r8) F.push('a fragment stopped reflecting');
  console.log(`prism: ${Math.round(BOSSDEF.prism.reflect * 100)}% comes back past shields and can kill; ${d.fragments} fragments grow ${share}->${cap} and stop`);
}

// --- subjecttest: whole it walks and strikes; divided, one flees and mends, one hunts ---
{
  start('lumenspire');
  const d = BOSSDEF.subject;
  if (A.G.boss.k !== 'subject') F.push(`lumenspire seeded ${A.G.boss.k}, wanted Subject One`);

  // Whole: it closes the gap toward the nearest soldier and strikes adjacency.
  const far = spawnUnit('rifle', 4, 0, {hp: 20, max: 20, shield: 0});
  const gap = () => Math.min(...A.G.boss.bodies[0].cells.map(([l, c]) =>
    Math.abs(far.lane - l) + Math.abs(far.col - c)));
  const g0 = gap();
  A.bossTick();
  if (gap() >= g0) F.push('whole, it did not walk toward the nearest soldier');
  if (proxies().length !== d.w * d.h) F.push('the whole body lost cells while walking');

  A.G.units.length = 0;
  const [bl, bc] = A.G.boss.bodies[0].cells[0];
  const beside = spawnUnit('wall', bl, bc - 1, {hp: 20, max: 20, shield: 0});
  const away = spawnUnit('marks', (bl + 3) % A.LANES, 0, {hp: 20, max: 20, shield: 0});
  A.bossTick();
  if (beside.hp >= 20) F.push('a soldier within arm\'s reach was not struck');
  if (away.hp !== 20) F.push('the strike reached across the board');

  // The flip: two one-cell halves with roles; the human half runs deep.
  A.G.units.length = 0;
  spawnUnit('rifle', 2, 0, {hp: 20, max: 20, shield: 0});
  hit(d.hp / 2 + 1);
  if (A.G.boss.phase !== 2) F.push('the splice did not come apart at half hull');
  const human = A.G.boss.bodies.find(b => b.role === 'human');
  const hive = A.G.boss.bodies.find(b => b.role === 'hive');
  if (!human || !hive) F.push('the split did not leave a human half and a hive half');
  if (A.G.boss.bodies.some(b => b.cells.length !== 1)) F.push('a split half kept more than one cell');

  // The human half flees and mends; the hive half hunts and claws.
  hive.hp = Math.max(1, hive.hp - 5);
  const hp0 = hive.hp;
  const hunterGap = () => {
    const u = A.G.units[0];
    const [l, c] = hive.cells[0];
    return Math.abs(u.lane - l) + Math.abs(u.col - c);
  };
  const hg0 = hunterGap();
  A.bossTick();
  if (hive.hp !== Math.min(hive.max, hp0 + d.mendN)) F.push('the human half did not mend the hive half');
  if (hunterGap() >= hg0) F.push('the hive half did not hunt');

  // Kill the human half: the mending stops and the hive half gets worse.
  const humanProxy = proxies().find(e => e.body === human.id);
  A.dmgEnemy(humanProxy, 999, 'test', true);
  if (A.G.bossDown) F.push('one half down counted as the kill');
  A.G.units.length = 0;
  const [hl, hc] = hive.cells[0];
  const prey = spawnUnit('rifle', hl, hc - 1 >= 0 ? hc - 1 : hc + 1, {hp: 20, max: 20, shield: 0});
  const hurt = hive.hp = Math.max(1, hive.hp - 3);
  A.bossTick();
  if (hive.hp !== hurt) F.push('the hive half kept mending with the human half dead');
  if (20 - prey.hp !== d.clawDmg + 1) F.push(`the enraged claw dealt ${20 - prey.hp}, wanted ${d.clawDmg + 1}`);
  A.dmgEnemy(proxies().find(e => e.body === hive.id), 999, 'test', true);
  if (!A.G.bossDown) F.push('both halves dead did not count as the kill');
  console.log(`subject one: walks and strikes ${d.strikeDmg} whole; split leaves a fleeing mender (+${d.mendN}/turn) and a hunter that claws ${d.clawDmg} (+1 enraged)`);
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

// --- plating: every hull hit loses one point, minimum one lands, shields absorb cleanly ---
{
  start('blackmarrow');                    // unshielded: hull takes the tax directly
  const full = A.bossHp();
  hit(5);
  if (full - A.bossHp() !== 4) F.push(`a 5 hit landed ${full - A.bossHp()}, wanted 4 through plating`);
  hit(1);
  if (full - A.bossHp() !== 5) F.push('a 1 hit did not land its minimum 1');

  start('ironveil');                       // shielded: the field absorbs untaxed
  hit(5);
  if (A.G.boss.shield !== BOSSDEF.gantry.shield - 5) F.push('plating taxed the containment field');
  if (A.bossHp() !== BOSSDEF.gantry.hp) F.push('a shield-absorbed hit leaked into hull');
  console.log('plating: 5 lands 4, 1 still lands 1, the field absorbs cleanly');
}

// --- the bulkhead: a hull can only lose so much in one turn ---
{
  start('blackmarrow');
  bulkOn();
  const cap = BOSSDEF.brood.bulk;
  const full = A.bossHp();
  hit(999);
  if (full - A.bossHp() !== cap) F.push(`a 999 volley landed ${full - A.bossHp()}, wanted the ${cap} bulkhead`);
  hit(999);
  if (full - A.bossHp() !== cap) F.push('a second volley leaked past a sealed bulkhead');
  A.G.units.length = 0;
  A.bossTick();                            // the bulkhead recovers on its beat
  const after = A.bossHp();
  hit(999);
  if (after - A.bossHp() !== cap) F.push('the bulkhead did not recover next turn');
  console.log(`bulkhead: ${cap} lands, the rest of the turn glances off, next turn it lands again`);
}

// --- the speed-kill floor: infinite damage per turn cannot beat a boss
// before turn six, and still beats every boss inside the clock ---
{
  const floors = [];
  for (const k of Object.keys(BOSSDEF)) {
    const d = BOSSDEF[k];
    start(d.op, d.sub ? k : undefined);
    bulkOn();
    A.G.units.length = 0;
    let t = 0;
    while (t < 25 && !A.G.bossDown) {
      t++;
      proxies().forEach(p => A.dmgEnemy(p, 999, 'test', true));
      if (A.G.bossDown) break;
      A.bossTick();
      A.G.units.length = 0;                // the sim brings no army to hurt
      A.G.enemies = A.G.enemies.filter(e => e.boss);
    }
    floors.push(`${k}:${t}`);
    if (t < 6) F.push(`${k}: an unlimited-damage deck killed it in ${t} turns — the floor is 6`);
    if (t > d.turns - 4) F.push(`${k}: even unlimited damage took ${t} of ${d.turns} turns — too tight against the clock`);
  }
  console.log('speed-kill floors (turns under infinite damage): ' + floors.join(' '));
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
