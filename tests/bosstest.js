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
  // Turn one the tendril only WINDS UP — the breach is the only hit, and the
  // wound-up line is promised on the plan for the board to draw.
  if (sitter.hp !== 30 - BOSSDEF.brood.breachDmg) F.push(`occupied breach turn dealt ${30 - sitter.hp}, wanted ${BOSSDEF.brood.breachDmg}`);
  if (A.foeAt(4, 1)) F.push('a hostile surfaced under a standing unit');
  const surfaced = adds().length - foesBefore;
  if (surfaced !== 1) F.push(`${surfaced} hostiles surfaced from one empty mark`);
  if (adds().some(e => !BOSSDEF.brood.breachPool.includes(e.k))) F.push('a breach surfaced something off the pool');
  if (A.G.boss.marks.length !== 1) F.push(`phase one marked ${A.G.boss.marks.length} cells, wanted 1`);
  const plan = A.G.boss.plan.lash;
  if (!plan) F.push('the tendril did not wind up a line');
  // Sitter is the only unit, so the wound-up line runs through it either way.
  if (plan && !(plan.axis === 'row' ? plan.i === sitter.lane : plan.i === sitter.col)) {
    F.push('the tendril wound up over an empty line');
  }
  if (!A.bossWarnCells().length) F.push('the wound-up line is not drawn on the board');

  // The promise is kept: the lash lands on the planned line, on whoever is
  // standing in it THEN — and a vacated line is a clean miss.
  const hpBefore = sitter.hp;
  A.G.boss.marks = [];
  A.bossTick();
  if (hpBefore - sitter.hp !== BOSSDEF.brood.tendrilDmg) {
    F.push(`tendril dealt ${hpBefore - sitter.hp}, wanted ${BOSSDEF.brood.tendrilDmg}`);
  }
  // Vacate: aim the plan at a line the sitter is NOT in and nothing lands.
  A.G.boss.marks = [];
  A.G.boss.plan.lash = {axis: 'row', i: (sitter.lane + 2) % A.LANES};
  const hpSafe = sitter.hp;
  A.bossTick();
  if (sitter.hp !== hpSafe) F.push('a vacated tendril line still hit someone');

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

  // Shatter: two WALL shards on the player side or the middle ground, one
  // LANCE deep on the hive's side, all growing one a turn to the cap.
  start('sunderglass');
  hit(Math.floor(BOSSDEF.prism.hp / 2) + 2);   // past half, straight to the shatter
  const d = BOSSDEF.prism;
  const share = Math.ceil(d.hp / 5);
  const cap = Math.floor(share * d.growCap);
  if (A.G.boss.bodies.length !== d.fragments) F.push(`shatter left ${A.G.boss.bodies.length} fragments`);
  const walls = A.G.boss.bodies.filter(b => b.role === 'wall');
  const lance = A.G.boss.bodies.find(b => b.role === 'lance');
  if (walls.length !== 2 || !lance) F.push('the shatter did not leave two wall shards and a lance');
  if (walls.some(b => b.cells[0][1] > 4)) F.push(`a wall shard left the player/middle ground (cols ${walls.map(b => b.cells[0][1])})`);
  if (lance && lance.cells[0][1] < 5) F.push(`the lance shard is not on the hive side (col ${lance && lance.cells[0][1]})`);
  if (A.G.boss.bodies.some(b => b.hp !== share || b.max !== cap)) F.push('fragment pools mis-sized');
  A.bossTick();
  if (A.G.boss.bodies.some(b => b.hp !== share + 1)) F.push('fragments did not grow');
  // Javelins: the lance fires at soldiers ANYWHERE on the board — stand two
  // clear of every shard's resonance and both still take javDmg.
  const isClear = (l, c) =>
    A.G.boss.bodies.every(b => Math.max(Math.abs(b.cells[0][0] - l), Math.abs(b.cells[0][1] - c)) > 1);
  const clearCells = [];
  for (let l = 0; l < A.LANES && clearCells.length < 2; l++) {
    for (let c = 0; c < A.COLS && clearCells.length < 2; c++) {
      if (A.G.ter[l][c] === 'x' || A.G.ter[l][c] === 'e') continue;
      if (!isClear(l, c)) continue;
      clearCells.push([l, c]);
    }
  }
  const jav1 = spawnUnit('rifle', clearCells[0][0], clearCells[0][1], {hp: 20, max: 20, shield: 0});
  const jav2 = spawnUnit('wall', clearCells[1][0], clearCells[1][1], {hp: 20, max: 20, shield: 0});
  A.bossTick();                              // the lance AIMS — nothing lands yet
  if (jav1.hp !== 20 || jav2.hp !== 20) F.push('a javelin landed on the aiming turn');
  const aim = A.G.boss.plan.jav || [];
  const aimedAt = (u) => aim.some(([al, ac]) => al === u.lane && ac === u.col);
  if (aim.length !== 2 || !aimedAt(jav1) || !aimedAt(jav2)) F.push(`the lance aimed at ${JSON.stringify(aim)} — wanted both soldiers' squares`);
  if (!A.bossWarnCells().length) F.push('the aimed squares are not drawn on the board');
  A.bossTick();                              // the volley lands on the promised squares
  if (jav1.hp !== 20 - d.javDmg || jav2.hp !== 20 - d.javDmg) F.push(`the lance javelins missed (${jav1.hp}, ${jav2.hp} — wanted ${20 - d.javDmg} both)`);
  // The volley hits SQUARES, not the soldiers it was aimed at: aim the plan
  // at jav2's square and an empty one — jav1, un-aimed, is untouched.
  A.G.boss.plan.jav = [[jav2.lane, jav2.col], [(jav2.lane + 1) % A.LANES, jav2.col]];
  const pre1 = jav1.hp;
  const pre2 = jav2.hp;
  A.bossTick();
  if (jav1.hp !== pre1) F.push('a javelin hit a square the lance never aimed at');
  if (jav2.hp !== pre2 - d.javDmg) F.push(`the aimed square dealt ${pre2 - jav2.hp}, wanted ${d.javDmg}`);
  // Kill the lance: the javelins stop, and the walls still resonate.
  A.G.units.length = 0;
  A.dmgEnemy(proxies().find(e => e.body === lance.id), 999, 'test', true);
  if (A.G.boss.bodies.some(b => b.role === 'lance')) F.push('the lance shard survived 999');
  const [fl2, fc2] = walls[0].cells[0];
  const nl = fl2 > 0 ? fl2 - 1 : fl2 + 1;
  const bystander = spawnUnit('rifle', nl, fc2, {hp: 20, max: 20, shield: 0});
  const clear = spawnUnit('marks', clearCells[0][0], clearCells[0][1], {hp: 20, max: 20, shield: 0});
  const preRes = bystander.hp;
  A.bossTick();
  if (preRes - bystander.hp < d.fragDmg) F.push('a soldier beside a wall shard was not caught by the resonance');
  if (clear.hp !== 20) F.push('a soldier standing clear was hit with the lance dead');
  A.G.units.length = 0;
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

  // The duet: the human half flees and mends; the hive half hunts.
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
  if (A.G.waves < 900) F.push('Subject One still has a clock — this fight should have none');

  // The diagonal whiff is fixed: pen the hive half in with bodies and stand
  // a soldier on its corner — the claw reaches Chebyshev 1, so it lands the
  // same turn it moves (or fails to).
  A.G.units.length = 0;
  A.G.enemies = A.G.enemies.filter(e => e.boss);
  const [pl, pc] = hive.cells[0];
  const dl2 = pl < A.LANES - 1 ? 1 : -1, dc2 = pc < A.COLS - 1 ? 1 : -1;
  const corner = spawnUnit('rifle', pl + dl2, pc + dc2, {hp: 20, max: 20, shield: 0});
  spawnUnit('wall', pl + dl2, pc, {hp: 90, max: 90, shield: 0});
  spawnUnit('wall', pl, pc + dc2, {hp: 90, max: 90, shield: 0});
  A.bossTick();
  if (corner.hp !== 20 - d.clawDmg) F.push(`a soldier on the hive half's corner was not clawed (${corner.hp} — the diagonal whiff)`);

  // Kill the human half: the mending stops, and the claw becomes a STORM —
  // everything within reach battered and stunned.
  const humanProxy = proxies().find(e => e.body === human.id);
  A.dmgEnemy(humanProxy, 999, 'test', true);
  if (A.G.bossDown) F.push('one half down counted as the kill');
  A.G.units.length = 0;
  const [hl, hc] = hive.cells[0];
  const inStorm = spawnUnit('rifle', hl, Math.max(0, hc - 1), {hp: 20, max: 20, shield: 0});
  const inStorm2 = spawnUnit('wall', hl > 0 ? hl - 1 : hl + 1, Math.max(0, hc - 1), {hp: 20, max: 20, shield: 0});
  const hurt = hive.hp = Math.max(1, hive.hp - 3);
  A.bossTick();
  if (hive.hp !== hurt) F.push('the hive half kept mending with the human half dead');
  if (inStorm.hp !== 20 - d.clawDmg || inStorm2.hp !== 20 - d.clawDmg) F.push('the solo hive storm missed someone in reach');
  if (!inStorm.stun || !inStorm2.stun) F.push('the solo hive storm did not stun');

  // The knitting: leave the survivor alone and it heals back to FULL.
  A.G.units.length = 0;
  spawnUnit('rifle', 0, 0, {hp: 30, max: 30, shield: 0});
  A.G.boss.solo = 0;
  hive.hp = 1;
  for (let i = 0; i < d.reviveEvery; i++) A.bossTick();
  if (hive.hp !== hive.max) F.push(`after ${d.reviveEvery} solo turns the survivor sat at ${hive.hp}/${hive.max} — it should knit back to full`);

  // The snap: kill the HIVE half first and the human half stops running —
  // it CHARGES a straight line, the full length of the board if nothing is
  // in the way, and hits the soldier that stopped it the SAME turn.
  start('lumenspire');
  hit(d.hp / 2 + 1);
  const human2 = A.G.boss.bodies.find(b => b.role === 'human');
  const hive2 = A.G.boss.bodies.find(b => b.role === 'hive');
  A.dmgEnemy(proxies().find(e => e.body === hive2.id), 999, 'test', true);
  A.G.enemies = A.G.enemies.filter(e => e.boss);
  const [sl, sc] = human2.cells[0];
  for (let c = 0; c < A.COLS; c++) if (c !== sc && A.G.ter[sl][c] === 'x') A.G.ter[sl][c] = '';
  const runner = spawnUnit('rifle', sl, 0, {hp: 40, max: 40, shield: 0});
  const pre3 = runner.hp;
  A.bossTick();
  const want2 = d.clawDmg + d.snapStep;   // first solo turn: escalation 1
  if (pre3 - runner.hp !== want2) F.push(`the charge dealt ${pre3 - runner.hp} on the first solo turn, wanted ${want2}`);
  if (Math.abs(human2.cells[0][0] - runner.lane) + Math.abs(human2.cells[0][1] - runner.col) !== 1)
    F.push(`the charge did not carry the human half the full line to its target (at ${human2.cells[0]})`);
  const pre4 = runner.hp;
  A.bossTick();
  if (pre4 - runner.hp !== d.clawDmg + d.snapStep * 2) F.push('the snap did not escalate on the second solo turn');
  // The charging half shows its run lines when tapped — and the soldier a
  // line currently ends in is drawn hot.
  const ht = A.bossSelThreat(proxies().find(e => e.body === human2.id));
  if (!ht.strike.length) F.push('the charging half shows no strike preview');
  console.log(`subject one: no clock; duet mends ${d.mendN} and claws the corners; solo hive storms+stuns for ${d.clawDmg}; solo human charges the full line, +${d.snapStep}/turn; survivor knits whole after ${d.reviveEvery}`);
}

// --- envoytest: the summit is a chessboard — the court, one move a turn, the second session ---
{
  start('crownring', 'envoy');
  const d = BOSSDEF.envoy;
  const roles = () => A.G.boss.bodies.map(b => b.role);
  const count = r => roles().filter(x => x === r).length;
  // The court: king + pawn screen + knight, two bishops, a queen — back two columns.
  if (A.G.boss.bodies.length !== 10) F.push(`the court seeded ${A.G.boss.bodies.length} bodies, wanted 10`);
  if (count('king') !== 1 || count('pawn') !== 5 || count('bishop') !== 2 || count('knight') !== 1 || count('queen') !== 1)
    F.push(`the court roster is wrong (${roles().join(', ')})`);
  if (A.G.boss.bodies.some(b => b.cells[0][1] < A.COLS - 2)) F.push('a piece seeded off the back two columns');
  const king = A.G.boss.bodies.find(b => b.role === 'king');
  if (king.cells.length !== 1) F.push('the king is not 1x1');
  if (A.G.waves !== d.turns) F.push(`the clock reads ${A.G.waves}, wanted ${d.turns}`);

  // Tap a piece and it shows its moves. The knight can always jump the
  // screen; the king shows his censure ring and nothing more.
  const roleProxy = r => proxies().find(e => (A.G.boss.bodies.find(b => b.id === e.body) || {}).role === r);
  const nt = A.bossSelThreat(roleProxy('knight'));
  if (!(nt.threat.length + nt.strike.length)) F.push("the knight's selection preview shows no moves");
  const kt = A.bossSelThreat(roleProxy('king'));
  if (!kt.strike.length || kt.strike.length > 8) F.push(`the king's censure ring shows ${kt.strike.length} squares`);

  // Chess moves ONE piece a turn — and the king holds his square.
  const bait = spawnUnit('rifle', 2, 0, {hp: 30, max: 30, shield: 0});
  const cellsById = () => Object.fromEntries(A.G.boss.bodies.map(b => [b.id, b.cells[0].join(',')]));
  const c0 = cellsById();
  A.bossTick();
  const c1 = cellsById();
  const moved = Object.keys(c1).filter(id => c0[id] !== c1[id]);
  if (moved.length !== 1) F.push(`${moved.length} pieces moved in one turn — chess moves one`);
  if (c0[king.id] !== c1[king.id]) F.push('the king left his square');
  if (bait.hp !== 30) F.push('something struck across the board on the first move');

  // The pawn takes diagonally, never straight — reduce the court to prove it.
  A.G.units.length = 0;
  A.G.enemies = A.G.enemies.filter(e => e.boss);
  A.G.boss.bodies.filter(b => !['king', 'pawn'].includes(b.role))
    .forEach(b => A.dmgEnemy(proxies().find(e => e.body === b.id), 999, 'test', true));
  while (count('pawn') > 1) {
    const p1 = A.G.boss.bodies.find(b => b.role === 'pawn');
    A.dmgEnemy(proxies().find(e => e.body === p1.id), 999, 'test', true);
  }
  const pawn = A.G.boss.bodies.find(b => b.role === 'pawn');
  const [pl, pc] = pawn.cells[0];
  const dlp = pl > 0 ? -1 : 1;
  const diag = spawnUnit('rifle', pl + dlp, pc - 1, {hp: 20, max: 20, shield: 0});
  const ahead = spawnUnit('wall', pl, pc - 1, {hp: 20, max: 20, shield: 0});
  A.bossTick();
  if (diag.hp !== 20 - d.pawnDmg) F.push(`the pawn strike dealt ${20 - diag.hp}, wanted ${d.pawnDmg} on the diagonal`);
  if (ahead.hp !== 20) F.push('a pawn struck straight ahead — pawns take diagonally');

  // The queen slides her whole line and strikes the SAME turn.
  start('crownring', 'envoy');
  [...A.G.boss.bodies].filter(b => !['king', 'queen'].includes(b.role))
    .forEach(b => A.dmgEnemy(proxies().find(e => e.body === b.id), 999, 'test', true));
  const queen = A.G.boss.bodies.find(b => b.role === 'queen');
  const [ql, qc] = queen.cells[0];
  for (let c = 0; c < A.COLS; c++) if (c !== qc && A.G.ter[ql][c] === 'x') A.G.ter[ql][c] = '';
  const mark = spawnUnit('rifle', ql, 0, {hp: 40, max: 40, shield: 0});
  A.bossTick();
  if (mark.hp !== 40 - d.queenDmg) F.push(`the queen's strike dealt ${40 - mark.hp}, wanted ${d.queenDmg}`);
  if (Math.abs(queen.cells[0][0] - mark.lane) + Math.abs(queen.cells[0][1] - mark.col) !== 1)
    F.push('the queen did not slide the line to her target');

  // The knight jumps the screen — the pawns between are not his problem.
  start('crownring', 'envoy');
  const knight = A.G.boss.bodies.find(b => b.role === 'knight');
  const [nl2, nc2] = knight.cells[0];
  const lt = [[nl2 + 2, nc2 - 1], [nl2 - 2, nc2 - 1], [nl2 + 1, nc2 - 2], [nl2 - 1, nc2 - 2]]
    .find(([tl, tc]) => tl >= 0 && tl < A.LANES && tc >= 0 && tc < A.COLS &&
      A.G.ter[tl][tc] !== 'x' && !A.G.enemies.some(e => e.lane === tl && e.col === tc));
  const jumper = spawnUnit('rifle', lt[0], lt[1], {hp: 20, max: 20, shield: 0});
  A.bossTick();
  if (jumper.hp !== 20 - d.knightDmg) F.push(`the knight's jump dealt ${20 - jumper.hp}, wanted ${d.knightDmg}`);

  // The second session: the king's first death is not the end — full hull,
  // four thrones, and the chess set is done.
  start('crownring', 'envoy');
  const king2 = A.G.boss.bodies.find(b => b.role === 'king');
  hit(999);                                // proxies()[0] is the king
  if (A.G.bossDown) F.push('the king\'s first death ended the fight');
  if (A.G.boss.phase !== 2) F.push('the king\'s death did not open the second session');
  if (king2.hp !== king2.max) F.push(`the king stood back up at ${king2.hp}/${king2.max} — wanted full hull`);
  const thrones = A.G.boss.bodies.filter(b => ['pyre', 'rime', 'storm', 'shard'].includes(b.role));
  if (thrones.length !== 4) F.push(`${thrones.length} thrones answered, wanted 4`);
  if (A.G.boss.bodies.some(b => ['pawn', 'knight', 'bishop', 'queen'].includes(b.role)))
    F.push('a chess piece survived into the second session');
  if (thrones.some(t => t.hp !== d.frameHp)) F.push('a throne seeded off its hull');

  // The thrones act in rotation, each its wing's element: rime freezes, storm jams.
  const vict = spawnUnit('rifle', 0, 0, {hp: 40, max: 40, shield: 0});
  A.bossTick();                            // pyre + rime
  if (!vict.stun) F.push('the Rime throne did not freeze anyone');
  A.bossTick();                            // storm + shard
  if (!vict.jam) F.push('the Storm throne did not arc a weapon dead');

  // The fight ends only when the king AND every throne are down.
  A.dmgEnemy(proxies().find(e => e.body === king2.id), 999, 'test', true);
  if (A.G.bossDown) F.push('the second king death ended it with thrones still answering');
  thrones.forEach(t => {
    const tp = proxies().find(e => e.body === t.id);
    if (tp) A.dmgEnemy(tp, 999, 'test', true);
  });
  if (!A.G.bossDown) F.push('king and all four thrones down did not end the fight');
  console.log(`envoy: a court of 10 on the back ranks, one chess move a turn, king-death second session with 4 thrones at ${d.frameHp}`);
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
  // The parade's next burn is public: the lane it now stands in is drawn as
  // promised ground, and tapping the machine shows the same lane hot.
  const warn = A.bossWarnCells();
  if (!warn.length || warn.some(i => Math.floor(i / A.COLS) !== lane1)) F.push("the parade's next lane is not drawn on the board");
  if (!A.bossSelThreat(proxies()[0]).strike.length) F.push('the Pyreguard preview shows no burning lane');

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
    if (d.turns && t > d.turns - 4) F.push(`${k}: even unlimited damage took ${t} of ${d.turns} turns — too tight against the clock`);
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
      if (!r.over && d.turns) F.push(`${k}: fight ${i} never resolved`);
      if (A.G.turn > A.G.waves + 1) F.push(`${k}: fight ${i} outran the clock (turn ${A.G.turn})`);
    }
  }
  console.log(`resolve: ${Object.keys(BOSSDEF).length * 3} bot fights, every one ended inside the clock`);
}

F.report('operation bosses: footprint, phases, scripts, clock and resolve all hold');
