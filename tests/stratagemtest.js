// The stratagem class: seeded outside the deck, once per mission, costs DP,
// resolves at the start of the FOLLOWING turn with a marker in between.
import * as A from './support/api.js';
import {failures} from './support/harness.js';
import {spawnUnit, clearBoard, unlockAll} from './support/fixtures.js';

const F = failures();

const start = (lead, deck) => {
  const p = unlockAll(A.blankProfile('ST'), deck || ['rifle', 'marks', 'wall', 'medic']);
  A.enterProfile(p);
  p.lead = lead;
  A.launchSpec({node: null, type: 'stronghold', mod: 'none', reward: 0, salv: 0});
};

// A: seeded by the lead, outside the deck; leads without one seed nothing
{
  start('wildfire');
  if (!A.G.strat || A.G.strat.k !== 'requisition') F.push('no stratagem seeded for Wildfire');
  if (A.G.deck.length + A.G.hand.length !== 4) F.push('the call leaked into the deck or hand');
  start('ironbrand');
  if (A.G.strat) F.push('Ironbrand seeded a stratagem he does not carry');
}

// B: costs DP, refuses when broke, once per mission
{
  start('loneedge');                              // Duel Protocol, 3 DP
  clearBoard();
  const u = spawnUnit('rifle', 2, 1);
  A.G.dp = 2;
  if (A.playStratagem({uid: u.uid})) F.push('played the call without the DP for it');
  A.G.dp = 6;
  if (!A.playStratagem({uid: u.uid})) F.push('could not play an affordable call');
  if (A.G.dp !== 3) F.push('DP not billed, have ' + A.G.dp);
  if (!A.G.strat.played) F.push('call not marked spent');
  if (A.playStratagem({uid: u.uid})) F.push('played the one call twice');
}

// C: armed between turns — the marker shows — and it resolves NEXT turn
{
  start('loneedge');
  clearBoard();
  const u = spawnUnit('rifle', 2, 1);
  A.playStratagem({uid: u.uid});
  if (!A.G.strat.armed) F.push('call did not arm');
  if (!A.stratMarkers().includes(2 * A.COLS + 1)) F.push('no marker on the duelist');
  if (u.dueled) F.push('effect resolved the turn it was played');
  A.G.enemies.length = 0; A.G.predict = []; A.G.held = [];
  A.endTurn();
  if (!u.dueled) F.push('duel did not resolve at the start of the next turn');
  if (A.G.strat.armed) F.push('armed state not cleared after resolution');
  if (A.stratMarkers().length) F.push('marker survived resolution');
  // and it expires after one full turn
  A.G.enemies.length = 0; A.G.predict = []; A.G.held = [];
  A.endTurn();
  if (u.dueled) F.push('duel effect never expired');
}

// D: the duelist hits +4 and cannot be hurt while it holds
{
  start('loneedge');
  clearBoard();
  const u = spawnUnit('rifle', 2, 1, {dueled: true});
  // rifle dmg 2, +4 duel, +2 Lone Edge while isolated
  if (A.dmgPreview(u) !== A.POOL.rifle.dmg + 4 + 2) {
    F.push('duel damage bonus wrong: ' + A.dmgPreview(u));
  }
  A.dmgUnit(u, 5, 'test');
  if (u.hp !== u.max) F.push('duelist took damage while protected');
}

// E: Field Refit restores every Tech unit at resolution
{
  start('skunkworks');
  clearBoard();
  const t1 = spawnUnit('turret', 1, 1);
  const t2 = spawnUnit('wall', 3, 1);
  const r = spawnUnit('rifle', 2, 1);
  t1.hp = 1; t2.hp = 2; r.hp = 1;
  A.playStratagem(null);
  A.G.enemies.length = 0; A.G.predict = []; A.G.held = [];
  A.endTurn();
  // Fabrication also repairs 1/turn — full restore means AT max, so check that.
  if (t1.hp !== t1.max || t2.hp !== t2.max) F.push('refit left tech units damaged');
  if (r.hp >= r.max) F.push('refit healed a non-tech unit to full');
}

// F: Silent Insertion opens any tile for the next three deployments
{
  start('quietstep');
  A.playStratagem(null);
  A.G.enemies.length = 0; A.G.predict = []; A.G.held = [];
  A.endTurn();
  if (A.G.freeDrop !== 3) F.push('insertion did not charge three drops');
  const tiles = A.validTiles('rifle');
  if (!tiles.includes(1 * A.COLS + 6)) F.push('hostile ground not opened by insertion');
  const hand = [...A.G.hand];
  const cid = hand.find(x => x === 'rifle') || hand[0];
  A.G.dp = 6;
  A.deploy(cid, 1, 6);
  if (A.G.freeDrop !== 2) F.push('deployment did not spend an insertion charge');
}

// G: Emergency Requisition pays +4 DP on resolution
{
  start('wildfire');
  A.playStratagem(null);
  A.G.enemies.length = 0; A.G.predict = []; A.G.held = [];
  A.endTurn();
  if (A.G.dp !== A.MAXDP + 4) F.push('requisition paid ' + (A.G.dp - A.MAXDP) + ', expected 4');
}

F.report('stratagems: all checks pass');
