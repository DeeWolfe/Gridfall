// Turning a card into a unit on the board, and the friendly buffs acting on it.

import {POOL} from '../content/cards.js';
import {G, nextUid} from '../state/session.js';
import {gearOf, leadOf, cardName} from '../save/progression.js';
import {eventTechBonus} from './events.js';

/** Buffs stack but are capped, so a Scout/Relay/Herald stack cannot run away. */
const MAX_BUFF = 2;

/**
 * Build the live unit for card `cid` landing at (l, c). Gear and the team
 * lead's passive are folded in here, once, so nothing downstream has to
 * remember to ask about them.
 */
export function mkUnit(cid, l, c) {
  const k = POOL[cid];
  const g = gearOf(cid);
  const lead = leadOf();
  const hardened = lead.passive && lead.passive.n === 'Hardened Armor' && k.hp ? 1 : 0;
  const fabricated = lead.passive && lead.passive.n === 'Field Fabrication' && k.tech && k.hp ? 2 : 0;
  // Skunkworks' trade: the machines get the workshop, the infantry gets thin
  // rations. Floored at 1 so a Scout is fragile rather than stillborn.
  const thinned = lead.passive && lead.passive.n === 'Field Fabrication'
    && k.t === 'common' && k.hp ? -2 : 0;
  let hp = Math.max(1, k.hp + (g && g.hp ? g.hp : 0) + hardened + fabricated + thinned);
  // Salvage Rights' Rushed Assembly: the machine that always comes back is
  // never built whole. Rounded up, so a 15-hull frame fields at 8, not 7.
  if (lead.con && lead.con.n === 'Rushed Assembly' && k.chassis === 'proto') {
    hp = Math.max(1, Math.ceil(hp / 2));
  }
  // Mjolnir Plating grants the regenerating shield a card can also print.
  const regen = !!k.regen || !!(g && g.regen);
  const shield = (regen ? 1 : 0) + (g && g.shield ? g.shield : 0);

  return {
    uid: nextUid(),
    id: cid,
    n: cardName(cid),

    t: k.t,
    lane: l,
    col: c,
    size: k.size || 1,
    hp,
    max: hp,
    mob: !!k.mob,
    // A weapon gear (the Fireteam armoury) replaces the card's gun outright;
    // any other gear only adds to it.
    tg: (g && g.tg) || k.tg || 'none',
    dmg: g && g.tg ? (g.dmg || 0) : (k.dmg || 0) + (g && g.dmg ? g.dmg : 0),
    indirect: !!k.indirect || !!(g && g.indirect),
    rearsight: !!(g && g.rearsight),
    // NOTE: the reference build dropped this flag on the floor, which quietly
    // turned every single-target card into an area attack in live play. The
    // data, the spec, the targeting UI and the test suite all assume it is
    // here; see docs/NOTES.md for the balance impact of putting it back.
    single: g && g.tg ? !!g.single : !!k.single,
    blocker: !!k.blocker,
    // Firing Step: a blocker friendly direct fire shoots over. Still a wall
    // to the horde and to the wave scorer; only the beam walk ignores it.
    // A Fireteam never stands in the way of the line's fire: Spartans are
    // shot over, whatever they block.
    parapet: !!k.parapet || !!k.line,
    // Banner Bearer: +pack damage per adjacent friendly, outside the buff cap.
    pack: k.pack || 0,
    // Ember Lance: the cell under anything it hits burns for a turn.
    ember: !!k.ember,
    // Recoilless Team: the friendly directly behind eats this much per shot.
    backblast: k.backblast || 0,
    // Pile Bunker Blade: the second cell in a two-deep thrust takes half.
    falloff: !!k.falloff,
    // Guardian Field / Core Booster: an aura and a mobility grant, both read
    // off the fitted support rather than the base card.
    auraShield: false,
    mobGrant: false,
    // The Fireteam line: hosts carry a line, armour abilities set the flags.
    line: k.line || null,
    camo: false,
    cloaked: false,
    jet: false,
    locked: false,
    holo: false,
    // Fog of war: how far this unit sees. One cell unless the card says more.
    sight: k.sight || 0,
    // A VISR Visor adds to whatever the card sees, default included.
    sightUp: (g && g.sight) || 0,
    // Kit Rack: two armour abilities at once. Recovery Beacon: a lost team
    // card comes back to the hand instead of the deck.
    rack: !!(g && g.kitrack),
    recover: !!(g && g.recover),
    aura: k.aura || 0,
    colBuff: k.col || 0,
    laneB: k.laneB || 0,
    techBuff: k.techBuff || null,
    sustain: k.sustain || null,
    dampen: k.dampen || 0,
    // Pyre Emitter: every hostile in the lane burns for this each enemy phase.
    burnLane: k.burnLane || 0,
    // Singer: hostiles within two cells of her strike this much softer.
    hymn: k.hymn || 0,
    chill: k.chill || 0,
    lensBoost: k.lensBoost || 0,
    degauss: !!k.degauss,
    swap: !!k.swap,
    charge: k.charge || 0,
    push: !!k.push || !!(g && g.push),
    mine: k.mine || 0,
    recharge: !!k.recharge || !!(g && g.recharge),
    cycling: 0,
    decay: !!(g && g.decay),
    ifield: !!(g && g.immuneIndirect),
    heal: k.heal || 0,
    hot: k.hot || 0,
    healType: k.healType,
    healMode: k.healMode,
    pen: !!k.pen || !!(g && g.pen),
    scorch: !!k.scorch,
    cool: !!(g && g.cool),
    phase: !!(g && g.phase),
    choose: !!k.choose || !!(g && g.choose),
    tgt: null,
    pristine: k.pristine || 0,
    dynamo: k.dynamo || 0,
    tech: !!k.tech,
    regen,
    riposte: k.riposte || 0,
    // A Proto Frame moves and still acts in the same turn — the machine's
    // stride is not its whole turn. Servo gear grants the same to anyone.
    servo: !!(g && g.servo) || k.chassis === 'proto',
    // Shoulder Cannon. It was a card that landed on a unit mid-mission; as
    // gear it is chosen at the armoury instead, so the second shot is a
    // property of the unit from the moment it deploys.
    twin: !!k.twin || !!(g && g.twin),
    // Gear can grant an ability of its own (the Arm-Mounted Blade's thrust);
    // a card's printed ability wins if it somehow has both.
    ab: k.ab || (g && g.ab) || null,
    // Proto Frames fight facing either way and step diagonally — the machine
    // turns; the grid does not care which way it was parked.
    omni: !!k.omni,
    // The Frame system: the machine's gear state. gearW holds the fitted
    // weapon card, gearS the support cards riding alongside.
    frame: k.chassis === 'proto',
    gearW: null,
    gearS: [],
    // A long stride on the card itself (Osiris), or from a Thruster Pack later.
    boost: !!k.boost,
    resonate: 0,
    // Devil's Drive: a flat damage bonus from a SUPPORT card, which must
    // survive a later weapon swap — the weapon-fit path adds this back in
    // rather than zeroing dmg to the new gun's bare number.
    gearDmg: 0,
    att: {},
    acted: false,
    moved: false,
    dueled: false,
    cd: 0,
    stun: 0,
    regenTicks: 0,
    phased: false,
    fresh: true,
    shieldMax: shield,
    shield,
    controlled: false,
    ctrlTurns: 0,
    ctrlBy: null,
  };
}

/** Total friendly damage buff on `u` from auras, column relays and lane standards. */
export function buffOf(u) {
  let b = 0;
  G.units.forEach(o => {
    if (o.uid === u.uid) return;
    if (o.aura && Math.abs(o.lane - u.lane) + Math.abs(o.col - u.col) === 1) b += o.aura;
    if (o.colBuff && o.col === u.col) b += o.colBuff;
    if (o.laneB && o.lane === u.lane) b += o.laneB;
    // An Engineer boosts only the Tech unit directly ahead of it.
    if (o.techBuff && u.tech && u.lane === o.lane && u.col === o.col + o.size) b += o.techBuff.dmg;
  });
  return Math.min(b, MAX_BUFF);
}

/**
 * Lead-granted damage riders, outside the buff cap: Lone Edge pays +2 for a
 * unit standing with no friendly in the four orthogonal cells, and an armed
 * Duel Protocol pays +4 to its duelist.
 */
export function leadBonus(u) {
  let b = u.dueled ? 4 : 0;
  const lead = leadOf();
  // Lone Edge cuts both ways now: the duelist alone hits +3, and standing in
  // formation costs 1 — the lead is a bias to build around, not a bonus.
  if (lead.passive && lead.passive.n === 'Lone Edge') {
    const alone = !G.units.some(o =>
      o.uid !== u.uid && Math.abs(o.lane - u.lane) + Math.abs(o.col - u.col) === 1);
    b += alone ? 3 : -1;
  }
  // Firebrand: everything hits harder. Everything. (The other half of the
  // trade lives in dmgUnit — her units take +1 too.)
  if (lead.passive && lead.passive.n === 'Firebrand') b += 1;
  return b;
}

/**
 * The Banner Bearer's own rally: +pack for every friendly in the four cells
 * around it, and deliberately outside MAX_BUFF — the cap exists to stop
 * support stacking, and this is the swarm paying off, not support.
 */
export function packBonus(u) {
  if (!u.pack) return 0;
  return u.pack * G.units.filter(o =>
    o.uid !== u.uid && Math.abs(o.lane - u.lane) + Math.abs(o.col - u.col) === 1).length;
}

/** Damage this unit would deal right now, buffs and pristine bonus included. */
export function dmgPreview(u) {
  const pristine = u.pristine && u.hp >= u.max ? u.pristine : 0;
  return Math.max(0, u.dmg + buffOf(u) + leadBonus(u) + pristine + packBonus(u) + eventTechBonus(u));
}
