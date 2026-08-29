// Turning a card into a unit on the board, and the friendly buffs acting on it.

import {POOL} from '../content/cards.js';
import {G, nextUid} from '../state/session.js';
import {gearOf, leadOf} from '../save/progression.js';
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
  const hardened = lead.passive && lead.passive.n === 'Hardened Frames' && k.hp ? 1 : 0;
  const fabricated = lead.passive && lead.passive.n === 'Field Fabrication' && k.tech && k.hp ? 2 : 0;
  const hp = k.hp + (g && g.hp ? g.hp : 0) + hardened + fabricated;
  const shield = (k.regen ? 1 : 0) + (g && g.shield ? g.shield : 0);

  return {
    uid: nextUid(),
    id: cid,
    n: k.n,
    t: k.t,
    lane: l,
    col: c,
    size: k.size || 1,
    hp,
    max: hp,
    mob: !!k.mob,
    tg: k.tg || 'none',
    dmg: (k.dmg || 0) + (g && g.dmg ? g.dmg : 0),
    indirect: !!k.indirect || !!(g && g.indirect),
    rearsight: !!(g && g.rearsight),
    // NOTE: the reference build dropped this flag on the floor, which quietly
    // turned every single-target card into an area attack in live play. The
    // data, the spec, the targeting UI and the test suite all assume it is
    // here; see docs/NOTES.md for the balance impact of putting it back.
    single: !!k.single,
    blocker: !!k.blocker,
    aura: k.aura || 0,
    colBuff: k.col || 0,
    laneB: k.laneB || 0,
    techBuff: k.techBuff || null,
    sustain: k.sustain || null,
    dampen: k.dampen || 0,
    swap: !!k.swap,
    charge: k.charge || 0,
    push: !!k.push,
    mine: k.mine || 0,
    recharge: !!k.recharge,
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
    choose: !!k.choose,
    tgt: null,
    pristine: k.pristine || 0,
    dynamo: k.dynamo || 0,
    tech: !!k.tech,
    regen: !!k.regen,
    riposte: k.riposte || 0,
    servo: !!(g && g.servo),
    ab: k.ab || null,
    att: {},
    acted: false,
    moved: false,
    repositioned: false,
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
  if (lead.passive && lead.passive.n === 'Lone Edge') {
    const alone = !G.units.some(o =>
      o.uid !== u.uid && Math.abs(o.lane - u.lane) + Math.abs(o.col - u.col) === 1);
    if (alone) b += 2;
  }
  return b;
}

/** Damage this unit would deal right now, buffs and pristine bonus included. */
export function dmgPreview(u) {
  const pristine = u.pristine && u.hp >= u.max ? u.pristine : 0;
  return Math.max(0, u.dmg + buffOf(u) + leadBonus(u) + pristine + eventTechBonus(u));
}
