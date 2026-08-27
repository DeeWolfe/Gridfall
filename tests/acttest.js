// Immediate actions: move, attack and ability all commit the unit on the spot.
import * as A from './support/api.js';
import {failures} from './support/harness.js';
import {spawnUnit, spawnFoe, clearBoard, unlockAll} from './support/fixtures.js';

const F = failures();
A.enterProfile(unlockAll(A.blankProfile('AC'), ['rifle', 'archer', 'assassin', 'lancer']));
A.launch(Object.keys(A.opRun().nodes)[0]);
clearBoard();

// 1. movement is immediate and commits the unit
{
  const u = spawnUnit('rifle', 2, 1);
  if (!A.moveTargets(u).length) {
    F.push('no move targets');
  } else {
    A.doMove(u, 2, 2);
    if (u.col !== 2) F.push('move was not applied immediately');
    if (!u.acted) F.push('moving did not commit the unit');
    if (A.moveTargets(u).length) F.push('a committed unit can still move');
  }
}

// 2. a chain works naturally because moves apply as you go
{
  clearBoard();
  const a = spawnUnit('rifle', 1, 1);
  const b = spawnUnit('rifle', 1, 2);
  A.doMove(b, 1, 3);
  A.doMove(a, 1, 2);
  if (!(a.col === 2 && b.col === 3)) F.push(`chain failed: ${a.col},${b.col}`);
}

// 3. Archer is single-target with several angles
{
  clearBoard();
  const archer = spawnUnit('archer', 2, 2);
  const foes = [spawnFoe('crawler', 2, 3), spawnFoe('crawler', 2, 4),
    spawnFoe('crawler', 1, 1), spawnFoe('crawler', 3, 1)];

  if (A.geomFor(archer).length !== 4) F.push(`archer geometry should reach 4 cells, got ${A.geomFor(archer).length}`);
  if (A.targetsFor(archer).length !== 1) F.push('archer should resolve to a single target');
  if (A.candidatesFor(archer).length !== 4) F.push('archer should offer 4 choices');

  const before = foes.map(e => e.hp);
  A.doAttack(archer, foes[2]);
  const hit = foes.filter((e, i) => e.hp < before[i]);
  if (hit.length !== 1) F.push(`archer hit ${hit.length} targets, expected 1`);
  else if (hit[0] !== foes[2]) F.push('archer did not hit the chosen target');
  if (!archer.acted) F.push('attacking did not commit the archer');
}

// 4. Assassin likewise
{
  clearBoard();
  const asn = spawnUnit('assassin', 2, 2);
  const foes = [spawnFoe('crawler', 1, 2), spawnFoe('crawler', 3, 2),
    spawnFoe('crawler', 2, 1), spawnFoe('crawler', 2, 3)];

  if (A.candidatesFor(asn).length !== 4) F.push('assassin should offer 4 adjacent choices');
  const before = foes.map(e => e.hp);
  A.doAttack(asn, foes[1]);
  const hit = foes.filter((e, i) => e.hp < before[i]);
  if (hit.length !== 1) F.push(`assassin hit ${hit.length}, expected 1`);
  else if (hit[0] !== foes[1]) F.push('assassin did not hit the chosen target');
}

// 5. multi-target cards still hit everything and offer no choice
{
  clearBoard();
  const lancer = spawnUnit('lancer', 2, 1);
  const foes = [spawnFoe('crawler', 2, 2), spawnFoe('crawler', 2, 3), spawnFoe('crawler', 2, 4)];
  if (A.candidatesFor(lancer).length) F.push('lancer should not offer target choice');

  const before = foes.map(e => e.hp);
  A.doAttack(lancer, null);
  const hit = foes.filter((e, i) => e.hp < before[i]);
  if (hit.length !== 3) F.push(`lancer hit ${hit.length}, expected 3`);
}

// 6. a committed unit cannot act again, and cannot be re-committed
{
  clearBoard();
  const u = spawnUnit('rifle', 2, 1);
  const e = spawnFoe('crawler', 2, 3);
  A.doAttack(u, e);
  const hp = e.hp;
  A.doAttack(u, e);
  if (e.hp !== hp) F.push('a committed unit attacked twice');
  A.doMove(u, 2, 2);
  if (u.col !== 1) F.push('a committed unit still moved');
}

// 7. un-acted units auto-fire at end of turn; acted ones do not
{
  clearBoard();
  const idle = spawnUnit('rifle', 2, 1);
  const spent = spawnUnit('rifle', 3, 1);
  const e1 = spawnFoe('crawler', 2, 3);
  const e2 = spawnFoe('crawler', 3, 3);

  A.doAttack(spent, e2);
  const afterManual = e2.hp;
  const before = e1.hp;
  A.playerPhase();
  if (e1.hp >= before) F.push('idle unit did not auto-fire at end of turn');
  if (e2.hp !== afterManual) F.push('committed unit fired a second time at end of turn');
  if (idle.acted || spent.acted) F.push('acted flags not reset for the new turn');
}

// 8. servo legs allow move then fire
{
  clearBoard();
  const u = spawnUnit('rifle', 2, 1, {servo: true});
  const e = spawnFoe('crawler', 2, 4);
  A.doMove(u, 2, 2);
  if (u.acted) F.push('servo unit committed on move');
  const hp = e.hp;
  A.doAttack(u, e);
  if (e.hp >= hp) F.push('servo unit could not fire after moving');
  if (!u.acted) F.push('servo unit not committed after firing');
}

F.report('immediate actions: all checks pass');
