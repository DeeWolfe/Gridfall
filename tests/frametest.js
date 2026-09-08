// The Frame system: a machine that carries its own kit.
//
// A Proto Frame is a 5 DP Specialist seeded into the opening hand at launch,
// outside the deck. Its kit is NOT in the deck either — it is a pair of
// hardpoints, one weapon and one support, fitted at the armoury and bolted on
// the instant the machine lands.
//
// That is the v2.45 change and the reason for it is measured: as cards inside
// the twelve, a Frame's kit was dead in hand until the machine stood, so a
// fully-kitted Frame won 10-28% of missions where a deck with no Frame won
// 40%, and the same Frame with NO kit won 40-57%. The system punished the
// fantasy in proportion to how much you bought into it. What these guards keep
// true now:
//
//   - the Frame is seeded to hand at launch, outside the deck;
//   - it deploys on held ground with a functional base weapon;
//   - one Frame on the board at a time;
//   - a kit is never a card: not in a deck, not in a hand, not in a pack;
//   - a Frame lands already carrying both its hardpoints;
//   - only kits that fit THIS Frame, in the right slot, and are owned, count;
//   - weapon replaces the weapon, support rides alongside, riposte is a trait;
//   - the reserve cycle never re-deals the machine;
//   - The Code (Bushido) returns the wreck to hand at half hull, kit intact;
//   - Single Mount (Aki-Kaze) flies the weapon and nothing else.
import './support/install-dom.js';
import * as A from './support/api.js';
import {failures} from './support/harness.js';
import {spawnFoe, clearBoard, unlockAll, stillAir} from './support/fixtures.js';
import {POOL} from '../src/content/cards.js';
import {isProto} from '../src/save/progression.js';
import {openPanel} from '../src/render/panels.js';
import {get} from './support/dom.js';

const F = failures();
const FRAMES = Object.keys(POOL).filter(c => isProto(c));
const KITS = Object.keys(POOL).filter(c => POOL[c].frameGear);

let p;
/** A profile in a mission, with `frame` fielded and `hard` bolted to it. */
const start = (frame = 'whitedevil', hard = null, lead = null) => {
  p = unlockAll(A.blankProfile('FRAME'), ['rifle', 'wall', 'medic', 'marks', 'cipher']);
  p.loadout.frame = frame;
  if (frame && hard) p.loadout.hard = {[frame]: hard};
  if (lead) p.lead = lead;
  A.enterProfile(p);
  A.launchSpec({node: null, type: 'stronghold', mod: 'none', reward: 0});
  stillAir();
  clearBoard();
  A.G.predict = [];
  A.G.held = [];
  A.G.dp = 30;
  return p;
};
/** Deploy straight from the hand, pushing the card in if the deal missed it. */
const play = (cid, l, c) => {
  if (!A.G.hand.includes(cid)) A.G.hand.push(cid);
  A.deploy(cid, l, c);
  return A.G.units.find(u => u.id === cid);
};

// --- the shape of the content ---
{
  if (FRAMES.length !== 3) F.push(`expected 3 Proto Frames, found ${FRAMES.length}`);
  FRAMES.forEach(f => {
    const k = POOL[f];
    if (k.t !== 'special') F.push(`${f} is not a Specialist`);
    if (!k.dmg) F.push(`${f} lands with no weapon of its own`);
    if (!k.hp) F.push(`${f} has no hull`);
    // Every Frame must offer both hardpoints, or its armoury page is a lie.
    ['w', 's'].forEach(slot => {
      if (!A.kitsFor(f, slot).length) F.push(`${f} has no ${slot === 'w' ? 'weapon' : 'support'} kit to fit`);
    });
  });
  KITS.forEach(c => {
    const k = POOL[c];
    if (!POOL[k.frameGear]) F.push(`kit ${c} names a Frame that does not exist`);
    if (!['weapon', 'support'].includes(k.slot)) F.push(`kit ${c} sits in no hardpoint`);
  });
}

// --- a kit is not a card ---
//
// The whole point of the rework. A kit may not reach a deck, a hand or a pack;
// if any of those leaks it is back to being a slot tax with extra steps.
{
  start();
  if (A.G.hand.some(c => POOL[c].frameGear)) F.push('a kit was dealt into the opening hand');
  if (A.G.deck.some(c => POOL[c].frameGear)) F.push('a kit was shuffled into the mission deck');
  if (p.loadout.deck.some(c => POOL[c].frameGear)) F.push('a kit survived in the profile deck');

  // unlockAll gives the commander every card; the deck builder must still
  // refuse to file a kit as one of the twelve.
  const all = A.migrate(Object.assign(A.blankProfile('LEAK'), {
    unlocks: {cards: Object.keys(POOL), enemies: [], gear: [], leads: [], schemes: ['standard']},
    loadout: {deck: [...KITS.slice(0, 6), 'rifle'], gear: {}, frame: 'whitedevil'},
  }));
  if (all.loadout.deck.some(c => POOL[c].frameGear)) F.push('migrate left kits in the deck');
  if (!all.loadout.deck.includes('rifle')) F.push('migrate threw away a real card with the kits');

  // ...and a pack never offers one, because it could never be played.
  A.enterProfile(A.blankProfile('PACK'));
  let offered = 0;
  for (let i = 0; i < 300; i++) {
    offered += A.packOffer(i % 4 === 0 ? 'specialist' : 'standard')
      .filter(x => x.id && POOL[x.id] && POOL[x.id].frameGear).length;
  }
  if (offered) F.push(`packs offered a Frame kit ${offered} times in 300 pulls`);
}

// --- seeding: opening hand, outside the deck ---
{
  start();
  if (!A.G.hand.includes('whitedevil')) F.push('the Frame was not seeded into the opening hand');
  if (A.G.deck.includes('whitedevil')) F.push('the Frame is also in the draw pile');
  if (!A.G.frame || A.G.frame.k !== 'whitedevil') F.push('G.frame does not name the fielded machine');

  start(null);
  if (A.G.hand.some(isProto)) F.push('a commander with no Frame was seeded one');
}

// --- a Frame lands already carrying its hardpoints ---
{
  start('whitedevil', {w: 'beamsaber', s: 'booster'});
  const u = play('whitedevil', 2, 1);
  if (!u) { F.push('the Frame did not deploy'); } else {
    if (u.gearW !== 'beamsaber') F.push(`the weapon hardpoint did not fit: ${u.gearW}`);
    if (!u.gearS.includes('booster')) F.push('the support hardpoint did not fit');
    // Beam Saber: 7 damage at contact, and it strikes back.
    if (u.dmg !== POOL.beamsaber.dmg) F.push(`fitted damage ${u.dmg}, wanted ${POOL.beamsaber.dmg}`);
    if (u.tg !== POOL.beamsaber.tg) F.push('the fitted weapon did not set the targeting');
    if (!u.riposte) F.push('the saber riposte did not come with it');
    if (!u.mob) F.push('the booster did not ride alongside');
    // Fitting is free: the machine costs its own DP and nothing more.
    if ((A.G.spent || []).some(c => POOL[c] && POOL[c].frameGear)) {
      F.push('fitting a hardpoint spent a card');
    }
  }
}

// --- and a bare Frame still fights ---
{
  start('whitedevil', null);
  const u = play('whitedevil', 2, 1);
  if (!u) F.push('a Frame with no hardpoints would not deploy');
  else {
    if (u.gearW) F.push('an unfitted Frame arrived carrying a weapon');
    if (u.dmg !== POOL.whitedevil.dmg) F.push('a bare Frame lost its own weapon');
  }
}

// --- only a kit that fits THIS Frame, in the right slot, and is owned ---
{
  start('whitedevil', {w: 'greatsword', s: 'resonator'});   // Seven Blades' kit
  const u = play('whitedevil', 2, 1);
  if (u.gearW === 'greatsword') F.push("another Frame's weapon fitted the wrong machine");
  if (u.gearS.includes('resonator')) F.push("another Frame's support fitted the wrong machine");

  start('whitedevil', {w: 'booster', s: 'beamsaber'});      // slots swapped
  const u2 = play('whitedevil', 2, 1);
  if (u2.gearW === 'booster') F.push('a support card fitted the weapon hardpoint');
  if (u2.gearS.includes('beamsaber')) F.push('a weapon card fitted the support hardpoint');

  // An unowned kit is a free 200-credit weapon if it survives the repair pass.
  const thief = A.migrate(Object.assign(A.blankProfile('THIEF'), {
    unlocks: {cards: ['whitedevil'], enemies: [], gear: [], leads: [], schemes: ['standard']},
    loadout: {deck: ['rifle'], gear: {}, frame: 'whitedevil', hard: {whitedevil: {w: 'beamsaber', s: 'booster'}}},
  }));
  if (thief.loadout.hard.whitedevil) F.push('an unowned kit stayed bolted to the machine');
}

// --- weapon replaces, support rides alongside, riposte is a trait ---
{
  // The greatsword's upgrade is its footprint, not its number: same 5 damage
  // as the arm blade, across all three cells ahead instead of one.
  start('sevenblades', {w: 'greatsword', s: 'resonator'});
  const u = play('sevenblades', 2, 1);
  if (u.gearW !== 'greatsword') F.push('the greatsword did not mount');
  if (u.tg === POOL.sevenblades.tg) F.push('the greatsword did not widen the footprint');
  // Seven Blades answers blows under any sword — the trait is the body's, and
  // a sword that carries its own adds on top.
  if (u.riposte < (POOL.sevenblades.riposte || 0)) F.push('the chassis riposte was lost under a sword');

  start('heavyarms', {w: 'lasergatling', s: 'ammohopper'});
  const h = play('heavyarms', 2, 1);
  if (h.gearW !== 'lasergatling') F.push('the gatling did not mount');
  if (!h.gearS.includes('ammohopper')) F.push('the hopper did not ride alongside');
  if (h.twin !== true) F.push('the hopper did not double the gatling');
}

// --- one Frame on the board at a time ---
{
  start('whitedevil', {w: 'beamrifle', s: null});
  play('whitedevil', 2, 1);
  if (!A.frameGateText('whitedevil')) F.push('a second Frame was not gated');
  if (A.validTiles('whitedevil').length) F.push('a second Frame was offered tiles');
}

// --- the reserve cycle never re-deals the machine ---
{
  start('whitedevil', {w: 'beamrifle', s: null});
  play('whitedevil', 2, 1);
  A.G.deck = [];
  A.G.hand = [];
  for (let i = 0; i < 20; i++) A.drawCard(true);
  if (A.G.hand.some(isProto)) F.push('the reserve cycle dealt the Frame a second time');
  if (A.G.hand.some(c => POOL[c].frameGear)) F.push('the reserve cycle dealt a kit');
}

// --- The Code: the wreck comes home, kit intact ---
{
  start('whitedevil', {w: 'beamsaber', s: 'booster'}, 'salvagerights');
  const u = play('whitedevil', 2, 1);
  const wasSaber = u.gearW;
  // Rushed Assembly is Bushido's cost: the machine comes off the line at half
  // hull. Everyone else's units are untouched.
  if (u.max !== Math.ceil(POOL.whitedevil.hp / 2)) {
    F.push(`Rushed Assembly hull wrong: ${u.max}, wanted ${Math.ceil(POOL.whitedevil.hp / 2)}`);
  }
  if (A.mkUnit('rifle', 3, 1).max !== POOL.rifle.hp) F.push('Rushed Assembly thinned a non-Frame');
  const lost = A.G.lost;
  u.shield = 0;                 // the regen shield eats the first blow
  A.dmgUnit(u, 99, 'test');
  if (A.G.units.some(x => x.uid === u.uid)) F.push('the Frame survived a lethal blow');
  if (A.G.lost !== lost + 1) F.push('a salvaged Frame did not count as a loss');
  if (!A.G.hand.includes('whitedevil')) F.push('The Code did not return the machine to hand');
  // The kit never left the armoury, so redeploying brings it straight back —
  // that is what "kit intact" means now that a kit is not a card.
  if (A.G.hand.some(c => POOL[c].frameGear)) F.push('The Code handed back a kit as a card');
  clearBoard();
  A.G.dp = 30;
  const again = play('whitedevil', 2, 1);
  if (!again) F.push('the salvaged Frame would not redeploy');
  else if (again.gearW !== wasSaber) F.push('the salvaged Frame came back without its weapon');

  // Under any other lead the wreck stays a wreck.
  start('whitedevil', {w: 'beamsaber', s: null}, 'ironbrand');
  const v = play('whitedevil', 2, 1);
  v.shield = 0;
  A.dmgUnit(v, 99, 'test');
  if (A.G.hand.includes('whitedevil')) F.push('a Frame came back without The Code');
}

// --- The Code: 2 DP off every salvage, never more than 2 ---
{
  start('whitedevil', {w: 'beamrifle', s: null}, 'salvagerights');
  const u = play('whitedevil', 2, 1);
  const full = A.costOf('whitedevil');
  u.shield = 0;
  A.dmgUnit(u, 99, 'test');
  const cut = A.costOf('whitedevil');
  if (cut !== Math.max(1, full - 2)) F.push(`salvage discount wrong: ${full} -> ${cut}`);
  clearBoard();
  A.G.dp = 30;
  play('whitedevil', 2, 1);
  if (A.costOf('whitedevil') !== full) F.push('the salvage discount outlived its redeploy');
}

// --- Aki-Kaze: one mount, and it takes anything ---
//
// Single Mount is the cost and Open Mount is what it buys. She is the only
// commander who can fly a Frame carrying a SUPPORT and its own printed weapon;
// everyone else fills two fixed slots or leaves them empty.
{
  start('whitedevil', {w: 'beamsaber', s: 'booster'}, 'fieldrefit');
  const both = A.hardOf('whitedevil');
  if (both.w !== 'beamsaber') F.push('Single Mount stripped the weapon too');
  if (both.s) F.push('Single Mount flew a support as well as a weapon');
  const u = play('whitedevil', 2, 1);
  if (u.gearS.length) F.push('Single Mount put a support on the board');
  if (u.gearW !== 'beamsaber') F.push('Single Mount lost the weapon');

  // Clear the weapon and the same mount carries the support instead.
  start('whitedevil', {w: null, s: 'booster'}, 'fieldrefit');
  const sup = A.hardOf('whitedevil');
  if (sup.s !== 'booster') F.push('Open Mount would not carry a support alone');
  if (sup.w) F.push('Open Mount conjured a weapon');
  const v = play('whitedevil', 2, 1);
  if (!v.gearS.includes('booster')) F.push('the support did not reach the board');
  if (!v.mob) F.push('the support did not take effect');
  if (v.dmg !== POOL.whitedevil.dmg) F.push('a support-only Frame lost its printed weapon');

  // ...and no other lead can do that: they get both slots, or neither.
  start('whitedevil', {w: null, s: 'booster'}, 'ironbrand');
  const other = A.hardOf('whitedevil');
  if (other.s !== 'booster') F.push('a support-only fit was refused for an ordinary lead');
  const w = play('whitedevil', 2, 1);
  if (!w.gearS.includes('booster')) F.push('an ordinary lead lost the support');
}

// --- No Frame: Master Chief's slot may hold a machine, it never flies ---
{
  start('whitedevil', {w: 'beamsaber', s: 'booster'}, 'masterchief');
  if (A.G.hand.some(isProto)) F.push('No Frame seeded a machine anyway');
  if (A.G.frame) F.push('No Frame still named a fielded machine');
}

// --- the v22 migration: kits out of the deck, machine auto-fitted ---
{
  const old = A.migrate({
    version: 21, callsign: 'OLD',
    unlocks: {cards: ['rifle', 'whitedevil', 'beamsaber', 'booster'], enemies: [], gear: [], leads: [], schemes: ['standard']},
    loadout: {deck: ['rifle', 'beamsaber', 'booster'], gear: {}, frame: 'whitedevil'},
    presets: [{n: 'old', deck: ['rifle', 'beamsaber'], frame: 'whitedevil'}],
    progress: {rank: 1, xp: 0, credits: 0},
  });
  if (old.loadout.deck.some(c => POOL[c].frameGear)) F.push('the migration left kits in the deck');
  if (!old.loadout.deck.includes('rifle')) F.push('the migration ate a real card');
  if (old.presets[0].deck.some(c => POOL[c].frameGear)) F.push('the migration left kits in a saved deck');
  // The kits they already paid for are bolted on rather than orphaned.
  const fit = old.loadout.hard && old.loadout.hard.whitedevil;
  if (!fit) F.push('the migration did not fit the kits the commander already owned');
  else {
    if (fit.w !== 'beamsaber') F.push('the migration did not fit the owned weapon');
    if (fit.s !== 'booster') F.push('the migration did not fit the owned support');
  }
  ['beamsaber', 'booster'].forEach(c => {
    if (!old.unlocks.cards.includes(c)) F.push(`the migration confiscated ${c}`);
  });

  // A commander who owns the machine but no kit is left bare, not handed one.
  const bare = A.migrate({
    version: 21, callsign: 'BARE',
    unlocks: {cards: ['rifle', 'whitedevil'], enemies: [], gear: [], leads: [], schemes: ['standard']},
    loadout: {deck: ['rifle'], gear: {}, frame: 'whitedevil'},
    progress: {rank: 1, xp: 0, credits: 0},
  });
  if (bare.loadout.hard.whitedevil) F.push('a commander with no kits was issued one free');
}

// --- the armoury: where a hardpoint is actually chosen ---
//
// The rules can be right and the machine still unbuildable if the Squad screen
// offers no way to bolt anything on. This drives the real panel.
{
  const p2 = A.blankProfile('ARMOURY');
  p2.unlocks.cards = [...p2.unlocks.cards, 'whitedevil', 'beamsaber', 'beamrifle', 'booster'];
  p2.loadout.frame = 'whitedevil';
  A.enterProfile(p2);
  openPanel('squad');
  const body = () => get('pbody')._html;

  const rows = document.querySelectorAll('#pbody [data-hard]');
  if (!rows.length) { F.push('the armoury offers no hardpoint to fit'); } else {
    if (rows.some(el => !el.onclick)) F.push('a hardpoint chip is not wired');
    const kits = rows.map(el => el.dataset.hardkit).filter(Boolean);
    if (!kits.includes('beamsaber')) F.push('an owned weapon kit was not offered');
    if (!kits.includes('booster')) F.push('an owned support kit was not offered');
    if (kits.includes('greatsword')) F.push("another Frame's kit was offered");

    // Fit one, and it sticks — on the profile and in the next render.
    rows.find(el => el.dataset.hardkit === 'beamsaber').onclick();
    if (!p2.loadout.hard.whitedevil || p2.loadout.hard.whitedevil.w !== 'beamsaber') {
      F.push('fitting a hardpoint did not reach the profile');
    }
    openPanel('squad');
    if (!body().includes(POOL.beamsaber.n)) F.push('the armoury does not say what is bolted on');

    // ...and clearing it puts the machine back to bare.
    document.querySelectorAll('#pbody [data-hard]')
      .find(el => el.dataset.hardslot === 'w' && !el.dataset.hardkit).onclick();
    if (p2.loadout.hard.whitedevil && p2.loadout.hard.whitedevil.w) {
      F.push('clearing a hardpoint left the kit bolted on');
    }
  }

  // A kit is never offered as a deck card in the reserve.
  openPanel('squad');
  const reserveKits = document.querySelectorAll('#pbody [data-focus]')
    .filter(el => POOL[el.dataset.focus] && POOL[el.dataset.focus].frameGear
      && el.dataset.mode !== 'shop');
  if (reserveKits.length) F.push(`${reserveKits.length} kits are still filed as deck cards`);

  // The Quartermaster shelves them with their machine instead.
  openPanel('quartermaster');
  const shop = get('pbody')._html;
  if (!shop.includes('qm:kit:whitedevil')) F.push('the shop has no shelf for the White Devil kit');
  if (!shop.includes(POOL.beamsaber.n)) F.push('the shop does not stock the kit at all');
}

F.report('Frames: kits are hardpoints, and the machine carries them in');
