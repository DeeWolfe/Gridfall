// One namespace over the game's public surface, so a harness can say
// `A.doMove(...)` rather than carrying twenty import lines.
//
// Nothing in src/ imports this — it exists purely so the tests read like the
// game does. Everything here is a real export of a real module; the file adds
// no behaviour of its own.

export {blankProfile, migrate, loadAll, saveAll, commit, initProfiles} from '../../src/save/profile.js';
export {store, KEY} from '../../src/save/store.js';
export {rankName, ago, vetOf, gearOf, costOf, leadOf} from '../../src/save/progression.js';

export {POOL} from '../../src/content/cards.js';
export {GEAR} from '../../src/content/gear.js';
export {BEST} from '../../src/content/hostiles.js';
export {LEADS} from '../../src/content/leads.js';
export {MISSIONS} from '../../src/content/missions.js';
export {MODS} from '../../src/content/modifiers.js';
export {OPS} from '../../src/content/operations.js';
export {DOCTRINE} from '../../src/content/doctrines.js';
export {TGNAME} from '../../src/content/targeting-names.js';
export {TIERNAME, RANKS, VET} from '../../src/content/ranks.js';

export {LANES, COLS, MAXDP, MAXBREACH, DECKSIZE, SAVE_VERSION, STARTER} from '../../src/state/constants.js';
export {shuffle, randInt, takeOne, chance} from '../../src/state/rng.js';
export {hooks, setHooks} from '../../src/state/hooks.js';
export {
  active, profiles, G, MAPDEF, sel, mover, packQueue, replaying,
  setActive, setProfiles, setG, setMapdef, setSel, setMover, setPackQueue, setReplaying,
  nextUid, clearSelection,
} from '../../src/state/session.js';

export {genRun, opRun, nodeState, enterProfile, reqBlocked, opComplete} from '../../src/rules/run.js';
export {
  unitAt, foeAt, civAt, held, heldEnemyHalf, crystalsHeld, scorched,
  cellPassable, validTiles,
} from '../../src/rules/board.js';
export {wave, laneScore, rollDoctrine, predictSpawns} from '../../src/rules/waves.js';
export {mkUnit, buffOf, dmgPreview} from '../../src/rules/units.js';
export {laneJammed, laneFloor, laneAhead, geomFor, candidatesFor, targetsFor} from '../../src/rules/targeting.js';
export {dampenIn, dmgEnemy, blast, dmgUnit, fire, healPass} from '../../src/rules/combat.js';
export {useAbility} from '../../src/rules/abilities.js';
export {moveTargets, doMove, doAttack, doAbility, swapTargets, doSwap} from '../../src/rules/actions.js';
export {deploy} from '../../src/rules/deploy.js';
export {drawCard} from '../../src/rules/deck.js';
export {spawnClash, resolveSpawn, spawnPhase} from '../../src/rules/spawn.js';
export {playerPhase, enemyPhase, strike, territoryPhase, endTurn} from '../../src/rules/phases.js';
export {
  launch, launchSpec, launchOnslaught, launchGauntlet, abortMission, objText, finish,
} from '../../src/rules/mission.js';
export {packOffer, claimPack, queuePack, purchasePack, PACK_PRICE, PRIORITY_CHANCE} from '../../src/rules/packs.js';
export {forecastThreat, supportTargets, influenceCells, supportLabel} from '../../src/rules/forecast.js';
export {clog} from '../../src/rules/log.js';
