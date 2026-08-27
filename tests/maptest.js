// Campaign map structure: the final node is always Extraction, gates hold
// routes shut until their requirement is cleared, side objectives are optional
// and pay a bonus, and the operation completes on the final node alone.
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
      if (n.role === 'final' && nd.type !== 'extract') F.push(`${opKey} final rolled ${nd.type}`);
      if (n.role === 'start' && nd.type !== 'stronghold') F.push(`${opKey} start rolled ${nd.type}`);
      if (n.role !== 'final' && nd.type === 'extract') F.push(`${opKey} ${n.id}: extract off the final node`);
      if (n.role === 'side') {
        if (!['crystals', 'specimens', 'uplink', 'blitz'].includes(nd.type)) {
          F.push(`${opKey} side node rolled ${nd.type}`);
        }
        if (nd.salv < 8) F.push(`${opKey} side node salvage not boosted: ${nd.salv}`);
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
  A.launchSpec({node: null, type: 'uplink', mod: 'none', reward: 0, salv: 0});
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
  A.launchSpec({node: null, type: 'blitz', mod: 'none', reward: 0, salv: 0});
  if (A.G.quota !== 10) F.push('blitz quota not set');
  A.G.kills = 10;
  A.endTurn();
  if (!A.G.over || A.G.result.kind !== 'win') F.push('meeting the blitz quota did not win');
}

F.report('campaign maps: all checks pass');
