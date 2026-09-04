// Campaign map structure: the final node is always Extraction — or the
// operation's boss, on the three ops that have one — gates hold routes shut
// until their requirement is cleared, side objectives are optional and pay a
// bonus, and the operation completes on the final node alone.
import * as A from './support/api.js';
import {failures} from './support/harness.js';

const F = failures();

// A: every operation declares exactly one start, one final, and some sides
for (const opKey of Object.keys(A.OPS)) {
  const map = A.OPS[opKey];
  const finals = map.nodes.filter(n => n.role === 'final');
  const starts = map.nodes.filter(n => n.role === 'start');
  if (finals.length !== 1) F.push(`${opKey}: expected one final node, got ${finals.length}`);
  if (starts.length !== 1) F.push(`${opKey}: expected one start node, got ${starts.length}`);
  if (!map.nodes.some(n => n.role === 'side')) F.push(`${opKey}: no bonus side objective`);
  if (!map.lore || map.lore.length < 60) F.push(`${opKey}: missing its situation report`);
  // Gates must point at real nodes.
  map.nodes.forEach(n => (n.req || []).forEach(q => {
    if (!map.nodes.some(x => x.id === q)) F.push(`${opKey}: ${n.id} requires unknown node ${q}`);
  }));
}

// B: generation respects roles, across many rolls
for (const opKey of Object.keys(A.OPS)) {
  for (let roll = 0; roll < 8; roll++) {
    const p = A.blankProfile('M' + roll);
    p.op = opKey;
    A.setActive(p);
    A.setMapdef(opKey);
    A.genRun();
    const run = p.ops[opKey];
    for (const n of A.OPS[opKey].nodes) {
      const nd = run.nodes[n.id];
      const finalType = A.bossForOp(opKey) ? 'boss' : 'extract';
      if (n.role === 'final' && nd.type !== finalType) F.push(`${opKey} final rolled ${nd.type}, wanted ${finalType}`);
      if (n.role === 'start' && nd.type !== 'stronghold') F.push(`${opKey} start rolled ${nd.type}`);
      // A boss belongs on the final node — or on a map node that names its
      // own (Shallowhelm's chapels). Extraction stays final-only.
      if (n.role !== 'final' && nd.type === 'extract') F.push(`${opKey} ${n.id}: extract off the final node`);
      if (n.role !== 'final' && nd.type === 'boss' && !n.boss) F.push(`${opKey} ${n.id}: boss off the final node with no chapel key`);
      if (n.type && nd.type !== n.type) F.push(`${opKey} ${n.id}: pinned type ${n.type}, rolled ${nd.type}`);
      if (n.role === 'side') {
        const pool = n.type ? [n.type] : ['crystals', 'specimens', 'uplink', 'blitz'];
        if (!pool.includes(nd.type)) F.push(`${opKey} side node rolled ${nd.type}`);
      }
      let wantHeat = A.OPS[opKey].heat ? (n.heat != null ? n.heat : A.OPS[opKey].heat) : 0;
      // Crystals caps at heat 1 when auto-rolled — it already pays for its
      // objective by spreading a defence across four points (run.js).
      if (nd.type === 'crystals' && n.heat == null) wantHeat = Math.min(wantHeat, 1);
      if (wantHeat !== (nd.heat || 0)) {
        F.push(`${opKey} ${n.id}: heat ${nd.heat}, expected ${wantHeat}`);
      }
    }
  }
}

// C: the Blackmarrow gate — The Throat stays locked until the Power Junction
{
  const p = A.blankProfile('GATE');
  p.op = 'blackmarrow';
  A.enterProfile(p);
  const run = A.opRun();
  run.cleared.push('n1', 'n2', 'n3');
  if (A.nodeState('n4') !== 'locked') F.push('n4 open with the power still off');
  if (!A.reqBlocked('n4')) F.push('n4 not reported as gate-blocked');
  run.cleared.push('n6', 'n7');
  if (A.nodeState('n4') !== 'open') F.push('n4 still locked after the Power Junction cleared');
  if (A.reqBlocked('n4')) F.push('n4 still reported gate-blocked');
}

// D: the operation completes on the final node — side objectives are optional
{
  const p = A.blankProfile('FIN');
  p.op = 'ironveil';
  A.enterProfile(p);
  const run = A.opRun();
  run.cleared.push('n1', 'n2', 'n3');
  if (A.opComplete()) F.push('operation complete before the final node');
  run.cleared.push('n6');                      // final cleared; n4, n5, n7 untouched
  if (!A.opComplete()) F.push('operation not complete with the final node cleared');
}

// E: the uplink mission — consecutive holds win, losing the tile resets
{
  const p = A.blankProfile('UP');
  A.enterProfile(p);
  A.launchSpec({node: null, type: 'uplink', mod: 'none', reward: 0});
  const {l, c} = A.G.uplinkAt;
  if (c !== 4 || l < 1 || l > 3) F.push(`uplink tile in the wrong band: ${l},${c}`);
  // Keep the board quiet so only the tile's ownership drives the outcome.
  const calm = () => { A.G.enemies.length = 0; A.G.predict = []; A.G.held = []; };
  calm(); A.G.ter[l][c] = 'p';
  A.endTurn(); calm();
  A.endTurn(); calm();
  if (A.G.uplinkHeld !== 2) F.push('uplink held count wrong: ' + A.G.uplinkHeld);
  A.G.ter[l][c] = 'e';                          // tile lost
  A.endTurn(); calm();
  if (A.G.uplinkHeld !== 0) F.push('losing the tile did not reset the charge');
  // A wall on the tile: a fresh spawn fast enough to reach column 4 in one
  // enemy phase could otherwise flip it on the winning turn — the flake.
  A.G.units.push(A.mkUnit('wall', l, c));
  A.G.ter[l][c] = 'p';
  A.endTurn(); calm(); A.G.ter[l][c] = 'p';
  A.endTurn(); calm(); A.G.ter[l][c] = 'p';
  A.endTurn();
  if (!A.G.over || !A.G.result || A.G.result.kind !== 'win') F.push('three consecutive holds did not win');
}

// F: the blitz mission — hitting the kill quota wins immediately
{
  const p = A.blankProfile('BZ');
  A.enterProfile(p);
  A.launchSpec({node: null, type: 'blitz', mod: 'none', reward: 0});
  if (A.G.quota !== 9) F.push('blitz quota not set');
  A.G.kills = 9;
  A.endTurn();
  if (!A.G.over || A.G.result.kind !== 'win') F.push('meeting the blitz quota did not win');
}

// G: Crownring — the guards bar the floor, and the floor is the finale
{
  const p = A.blankProfile('CR');
  p.op = 'crownring';
  A.enterProfile(p);
  const run = A.opRun();
  run.cleared.push('n1');
  // From the concourse every wing gallery opens — the hub — but not the floor.
  ['n2', 'n4', 'n6', 'n8'].forEach(id => {
    if (A.nodeState(id) !== 'open') F.push(`wing ${id} not open from the concourse`);
  });
  if (A.nodeState('n10') !== 'locked' || !A.reqBlocked('n10')) F.push('the Summit Floor open with the guards standing');
  run.cleared.push('n2', 'n3', 'n4', 'n5', 'n6', 'n7');
  if (A.nodeState('n10') !== 'locked') F.push('the Summit Floor open with one guard standing');
  run.cleared.push('n8', 'n9');
  if (A.nodeState('n10') !== 'open') F.push('breaking all four guards did not open the floor');
  // The wing nodes carry their guards into the rolled run; the final is the
  // Envoy's fight by way of bossForOp, no node key needed.
  [['n3', 'pyreguard'], ['n5', 'rimeguard'], ['n7', 'stormguard'], ['n9', 'shardguard']].forEach(([id, k]) => {
    if (run.nodes[id].type !== 'boss' || run.nodes[id].boss !== k) F.push(`${id} rolled without its guard (${k})`);
  });
  if (run.nodes.n10.type !== 'boss') F.push('the Summit Floor did not roll as a Kill Order');
}

// H: Shallowhelm — the Cleanse needs power, and the way out needs the Cleanse
{
  const p = A.blankProfile('SH');
  p.op = 'shallowhelm';
  A.enterProfile(p);
  const run = A.opRun();
  run.cleared.push('n1');
  if (A.nodeState('n6') !== 'locked' || !A.reqBlocked('n6')) F.push('Cleanse Antechamber open with the power out');
  if (A.nodeState('n8') !== 'locked' || !A.reqBlocked('n8')) F.push('Gatehouse final open with the Cleanse unarmed');
  run.cleared.push('n2', 'n3');
  if (A.nodeState('n6') !== 'open') F.push('restoring power did not open the Antechamber');
  run.cleared.push('n6', 'n7');
  if (A.nodeState('n8') !== 'open') F.push('arming the Cleanse did not open the way home');
  if (run.nodes['n8'].type !== 'boss') F.push('shallowhelm final is not the Reliquary kill order');
}

// I: heat runs the wave budget over — wave 1 spends exactly its budget
{
  const p = A.blankProfile('HT');
  A.enterProfile(p);
  const spend = heat => {
    A.launchSpec({node: null, type: 'stronghold', mod: 'none', reward: 0, heat});
    return Object.entries(A.G.manifest).reduce((a, [k, c]) => a + A.BEST[k].threat * c, 0);
  };
  const flat = spend(0);
  if (A.G.heat !== 0) F.push('heat leaked into a plain mission');
  if (spend(6) !== flat + 6) F.push(`heat did not raise the wave budget by its own value: ${flat} -> ${spend(6)}`);
  if (A.G.heat !== 6) F.push('G.heat not carried into the mission');
}

F.report('campaign maps: all checks pass');
