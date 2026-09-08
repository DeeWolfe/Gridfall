// v2.46: a second kit for every Frame, and the two hostiles that were
// duplicates of something else.
//
// Six new hardpoints bring six mechanics the game did not have: a weapon that
// deals no damage at all, a riposte that answers the huddle instead of the
// swinger, a per-turn free blow, armour-piercing granted by a SUPPORT rather
// than the gun, and — on the hostile side — a mender that heals its whole lane
// and the first hostile in the game that buffs another hostile.
//
// Each of those is a rule, not a number, so each gets a guard that drives the
// real code path. The numbers themselves (8 at contact, 4 across three lanes)
// live in reference data and are deliberately NOT asserted here; what is
// asserted is that the mechanic exists, fires under its condition, and does
// nothing outside it.
import * as A from './support/api.js';
import {failures} from './support/harness.js';
import {spawnUnit, spawnFoe, clearBoard, unlockAll, stillAir} from './support/fixtures.js';
import {hitboxFor} from '../src/render/hitbox.js';

const F = failures();

/** A mission with `frame` fielded and `hard` bolted to it. */
const start = (frame = 'whitedevil', hard = null) => {
  const p = unlockAll(A.blankProfile('KIT'), ['rifle', 'wall', 'medic', 'marks']);
  p.loadout.frame = frame;
  if (frame && hard) p.loadout.hard = {[frame]: hard};
  A.enterProfile(p);
  A.launchSpec({node: null, type: 'stronghold', mod: 'none', reward: 0});
  stillAir();
  clearBoard();
  A.G.predict = [];
  A.G.held = [];
  A.G.dp = 30;
};
const play = (cid, l, c) => {
  if (!A.G.hand.includes(cid)) A.G.hand.push(cid);
  A.deploy(cid, l, c);
  return A.G.units.find(u => u.id === cid);
};

// --- every new kit is a hardpoint, never a card ------------------------------
{
  const NEW = ['hypermace', 'hyperbazooka', 'zanshinstance', 'phaseshift',
    'suppressionbarrage', 'targetinguplink'];
  NEW.forEach(id => {
    const k = A.POOL[id];
    if (!k) { F.push(`${id} is not in the pool`); return; }
    if (!k.frameGear) F.push(`${id} is not bolted to a Frame`);
    if (k.slot !== 'weapon' && k.slot !== 'support') F.push(`${id} sits in no hardpoint`);
    if (!A.kitsFor(k.frameGear, k.slot === 'weapon' ? 'w' : 's').includes(id)) {
      F.push(`${id} is not offered for ${k.frameGear}'s ${k.slot} mount`);
    }
  });
  // Every chassis now has a real choice in both mounts.
  ['whitedevil', 'sevenblades', 'heavyarms'].forEach(fr => {
    ['w', 's'].forEach(sl => {
      const n = A.kitsFor(fr, sl).length;
      if (n < 2) F.push(`${fr}'s ${sl} mount offers ${n} kit — no choice to make`);
    });
  });
}

// --- every Frame weapon draws its own footprint -------------------------------
// The three places that read a weapon's pattern all began by rejecting a
// weapon with no damage, which is right until a weapon deals none on purpose.
// A Suppression Barrage you cannot see the reach of is unaimable.
{
  Object.keys(A.POOL).filter(id => A.POOL[id].frameGear && A.POOL[id].slot === 'weapon')
    .forEach(id => {
      const box = hitboxFor(id);
      if (!box) F.push(`${A.POOL[id].n} draws no footprint diagram`);
    });
}

// --- a kit card may never quote a damage figure it does not deal --------------
//
// Every one of the eleven kits the v2.46 rebalance touched had its number
// changed and its card text left alone, so eight cards were advertising damage
// the weapon no longer dealt. This is the guard that makes that a build
// failure rather than something a player discovers mid-mission.
//
// The exemption list is for kits whose text describes the shape and leaves the
// figure to the stat row. That is a legitimate way to write a card; quoting the
// WRONG figure is not.
{
  const QUIET = ['dualblades'];
  Object.keys(A.POOL).filter(id => A.POOL[id].frameGear && A.POOL[id].slot === 'weapon')
    .forEach(id => {
      const k = A.POOL[id];
      const nums = (k.d.match(/\b\d+\b/g) || []);
      if (QUIET.includes(id)) {
        if (nums.length) F.push(`${id} is on the quiet list but quotes ${nums.join(', ')}`);
        return;
      }
      if (!k.dmg) {
        // A weapon that deals nothing has to SAY it deals nothing.
        if (!/no damage/i.test(k.d)) F.push(`${k.n} deals nothing and does not say so`);
        return;
      }
      if (!nums.includes(String(k.dmg))) {
        F.push(`${k.n} deals ${k.dmg} but its card says ${nums.length ? nums.join('/') : 'nothing'}`);
      }
    });
}

// --- Hyper Mace: contact damage that drives the survivor back ----------------
{
  start('whitedevil', {w: 'hypermace'});
  const wd = play('whitedevil', 2, 1);
  if (!wd) { F.push('the White Devil did not deploy'); }
  else {
    if (wd.gearW !== 'hypermace' || wd.tg !== 'adj') F.push('Hyper Mace did not fit');
    if (!wd.push) F.push('Hyper Mace does not drive anything back');
    const tough = spawnFoe('crawler', 2, 2, 40);
    wd.fresh = false; wd.acted = false;
    A.fire(wd, false);
    if (tough.hp >= 40) F.push('Hyper Mace did not connect at contact');
    if (tough.col !== 3) F.push(`the survivor stood at col ${tough.col}, wanted to be driven to 3`);
  }
}

// --- Hyper Bazooka: three lanes, one rank out, blind at contact --------------
{
  start('whitedevil', {w: 'hyperbazooka'});
  const wd = play('whitedevil', 2, 1);
  const reach = wd.col + wd.size - 1 + 3;
  const cells = new Set(A.geomCells(wd));
  if (cells.size !== 3) F.push(`Hyper Bazooka lights ${cells.size} cells, wanted 3`);
  [1, 2, 3].forEach(l => {
    if (!cells.has(l * A.COLS + reach)) F.push(`Hyper Bazooka misses lane ${l}`);
  });
  const close = spawnFoe('crawler', 2, 2, 20);
  const out = spawnFoe('crawler', 2, reach, 20);
  wd.fresh = false; wd.acted = false;
  A.fire(wd, false);
  if (close.hp !== 20) F.push('Hyper Bazooka hit something standing at contact');
  if (out.hp >= 20) F.push('Hyper Bazooka missed the rank it is aimed at');
}

// --- Zanshin Stance: the riposte answers the huddle --------------------------
{
  start('sevenblades', {s: 'zanshinstance'});
  const sb = play('sevenblades', 2, 1);
  if (!sb.riposteAll) F.push('Zanshin Stance did not arm the wide riposte');
  if (!sb.riposte) F.push('the Seven Blades lost its riposte');
  const swinger = spawnFoe('crawler', 2, sb.col + sb.size, 20);
  const beside = spawnFoe('crawler', 1, sb.col, 20);
  const away = spawnFoe('crawler', 4, 6, 20);
  sb.shield = 0;
  A.dmgUnit(sb, 1, 'test', swinger);
  if (swinger.hp >= 20) F.push('the swinger took no riposte');
  if (beside.hp >= 20) F.push('Zanshin Stance did not answer the hostile at its side');
  if (away.hp !== 20) F.push('Zanshin Stance reached a hostile nowhere near it');

  // Without the stance, only the swinger is answered.
  start('sevenblades', {s: null});
  const bare = play('sevenblades', 2, 1);
  const s2 = spawnFoe('crawler', 2, bare.col + bare.size, 20);
  const b2 = spawnFoe('crawler', 1, bare.col, 20);
  bare.shield = 0;
  A.dmgUnit(bare, 1, 'test', s2);
  if (s2.hp >= 20) F.push('a bare Seven Blades did not riposte at all');
  if (b2.hp !== 20) F.push('a bare Seven Blades answered a hostile that did not strike it');
}

// --- Phase Shift: one blow a turn, then the hull ------------------------------
{
  start('sevenblades', {s: 'phaseshift'});
  const sb = play('sevenblades', 2, 1);
  if (!sb.negateFirst) F.push('Phase Shift did not fit');
  sb.shield = 0;
  const hp = sb.hp;
  A.dmgUnit(sb, 3, 'test');
  if (sb.hp !== hp) F.push('Phase Shift did not pass the first blow through');
  A.dmgUnit(sb, 3, 'test');
  if (sb.hp === hp) F.push('Phase Shift ate the second blow of the same turn');
  const after = sb.hp;
  A.playerPhase();
  sb.shield = 0;
  A.dmgUnit(sb, 3, 'test');
  if (sb.hp !== after) F.push('Phase Shift did not come back for the next turn');
}

// --- Suppression Barrage: a gun with no damage that still does a job ---------
{
  start('heavyarms', {w: 'suppressionbarrage'});
  const ha = play('heavyarms', 2, 1);
  if (!ha.suppress) F.push('Suppression Barrage did not fit');
  if (ha.dmg) F.push('Suppression Barrage carries damage it should not');
  // The cross is centred three cells out, so the footprint must still light
  // even though the weapon deals nothing.
  const centre = ha.col + ha.size - 1 + 3;
  if (A.geomCells(ha).length !== 5) {
    F.push(`Suppression Barrage lights ${A.geomCells(ha).length} cells, wanted the cross of 5`);
  }
  const hit = spawnFoe('hulk', 2, centre, 30);
  const clear = spawnFoe('hulk', 4, 1, 30);
  ha.fresh = false; ha.acted = false;
  A.fire(ha, false);
  if (hit.hp !== 30) F.push('Suppression Barrage dealt damage');
  if (!hit.supp) F.push('Suppression Barrage did not pin what it covered');
  if (clear.supp) F.push('Suppression Barrage pinned a hostile outside the cross');

  const D = A.BEST.hulk;
  const pinned = A.foeStrike(hit, D, 0);
  const free = A.foeStrike(clear, D, 0);
  if (!(pinned < free)) F.push(`a pinned hostile swings for ${pinned}, a free one for ${free}`);
  // The board must quote what the swing delivers, or the forecast lies.
  const wall = spawnUnit('wall', 2, centre - 1);
  if (wall) {
    const seen = A.forecastThreat().hits[wall.uid];
    if (seen !== undefined && seen > free) F.push('the forecast quoted more than a free hostile deals');
  }
  // Suppression buys exactly one enemy turn.
  A.enemyPhase();
  if (hit.supp) F.push('suppression carried past the turn it was bought for');
}

// --- Targeting Uplink: a SUPPORT that changes how the weapon lands -----------
{
  start('heavyarms', {w: 'lasergatling', s: 'targetinguplink'});
  const ha = play('heavyarms', 2, 1);
  if (!ha.pen) F.push('Targeting Uplink did not grant armour piercing');
  // Refitting the weapon must not wipe a grant the support still holds.
  A.applyFrameGear(ha, 'missilegatling');
  if (!ha.pen) F.push('a weapon swap wiped the Uplink');

  start('heavyarms', {w: 'lasergatling'});
  const bare = play('heavyarms', 2, 1);
  if (bare.pen) F.push('a Heavy Arms pierces armour with no Uplink fitted');

  // And it must actually reach the damage: a floor'd hostile takes the lot.
  const armoured = Object.keys(A.BEST).find(k => A.BEST[k].floor > 0);
  if (!armoured) F.push('no armoured hostile to test the Uplink against');
  else {
    start('heavyarms', {w: 'lasergatling', s: 'targetinguplink'});
    const up = play('heavyarms', 2, 1);
    const a1 = spawnFoe(armoured, 1, up.col + up.size, 60);
    up.fresh = false; up.acted = false;
    A.fire(up, false);
    const withUplink = 60 - a1.hp;

    start('heavyarms', {w: 'lasergatling'});
    const nb = play('heavyarms', 2, 1);
    const a2 = spawnFoe(armoured, 1, nb.col + nb.size, 60);
    nb.fresh = false; nb.acted = false;
    A.fire(nb, false);
    const without = 60 - a2.hp;
    if (!(withUplink > without)) {
      F.push(`Uplink landed ${withUplink} into armour, bare landed ${without}`);
    }
  }
}

// --- Choir Warden: heals the whole lane, not the worst case ------------------
{
  start(null);
  const w = spawnFoe('choirwarden', 2, 5, 8);
  const a = spawnFoe('hulk', 2, 4, 3);
  const b = spawnFoe('hulk', 2, 6, 4);
  const other = spawnFoe('hulk', 0, 4, 3);
  const mend = A.BEST.choirwarden.mend;
  A.enemyPhase();
  if (a.hp !== 3 + mend) F.push(`the warden put ${a.hp - 3} into the first patient, wanted ${mend}`);
  if (b.hp !== 4 + mend) F.push('the warden left a second wounded hostile alone');
  if (other.hp !== 3) F.push('the warden healed out of its lane');
  if (w.col !== 5) F.push('the warden moved on a turn it sang');

  // Nothing to knit: it walks like anything else.
  start(null);
  const w2 = spawnFoe('choirwarden', 1, 5, 8);
  A.enemyPhase();
  if (w2.col !== 4) F.push('an idle warden should advance');
}

// --- The Lector: the first hostile that makes another hostile hit harder -----
{
  start(null);
  const D = A.BEST.zealot;
  const buff = A.BEST.lector.buffDmg;
  const z = spawnFoe('zealot', 2, 4, 20);
  const alone = A.foeStrike(z, D, 0);
  spawnFoe('lector', 2, 6, 20);
  const preached = A.foeStrike(z, D, 0);
  if (preached !== alone + buff) F.push(`the sermon added ${preached - alone}, wanted ${buff}`);

  // Only the named kind, only in the lane, and never the preacher himself.
  const brute = spawnFoe('hulk', 2, 5, 20);
  if (A.sermonAt(brute)) F.push('the sermon reached a hostile it does not name');
  const far = spawnFoe('zealot', 0, 4, 20);
  if (A.sermonAt(far)) F.push('the sermon carried into another lane');
  const lec = A.G.enemies.find(e => e.k === 'lector');
  if (A.sermonAt(lec)) F.push('the preacher preached to himself');

  // Two preachers are still one sermon.
  spawnFoe('lector', 2, 7, 20);
  if (A.sermonAt(z) !== buff) F.push('two Lectors stacked');

  // And the swing itself carries it, not just the projection.
  start(null);
  const u = spawnUnit('wall', 3, 1);
  u.shield = 0;
  const z2 = spawnFoe('zealot', 3, 2, 20);
  spawnFoe('lector', 3, 6, 20);
  const before = u.hp;
  A.strike(z2, D, 0);
  if (before - u.hp !== alone + buff) {
    F.push(`the preached zealot swung for ${before - u.hp}, wanted ${alone + buff}`);
  }
}

// --- Emplacements arrive at wave 2, not wave 4 -------------------------------
{
  start(null);
  A.G.waves = 10;
  const roll = t => {
    const out = new Set();
    for (let i = 0; i < 300; i++) Object.keys(A.wave(t) || {}).forEach(k => out.add(k));
    return out;
  };
  const seen = new Set([...roll(2), ...roll(3)]);
  ['spore', 'pylon', 'mender'].forEach(k => {
    if (!seen.has(k)) F.push(`${k} never appeared across waves 2-3`);
  });
  if (seen.has('jammer')) F.push('the Jammer came early — it is meant to hold at wave 4');
  const early = roll(1);
  ['spore', 'pylon', 'mender', 'jammer'].forEach(k => {
    if (early.has(k)) F.push(`${k} appeared on wave 1`);
  });
}

F.report('second kits and reworked hostiles: all checks pass');
