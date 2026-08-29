// Balance: how deep the bot gets in Onslaught, and how often it clears a
// full Gauntlet. Informational — this harness reports, it does not pass or fail.
import * as A from './support/api.js';
import {playOut} from './support/bot.js';

const ONSLAUGHT_RUNS = 21;
const GAUNTLET_RUNS = 15;
const GAUNTLET_LEGS = 3;

const waves = [];
for (let i = 0; i < ONSLAUGHT_RUNS; i++) {
  const p = A.blankProfile('O' + i);
  A.setActive(p);
  A.genRun();
  A.launchOnslaught();
  waves.push(playOut({maxTurns: 200}).turns);
}
waves.sort((a, b) => a - b);
console.log('Onslaught waves survived — min', waves[0],
  'median', waves[Math.floor(waves.length / 2)], 'max', waves[waves.length - 1]);

let cleared = 0;
for (let i = 0; i < GAUNTLET_RUNS; i++) {
  const p = A.blankProfile('G' + i);
  A.setActive(p);
  A.genRun();

  let legs = 0;
  for (let leg = 0; leg < GAUNTLET_LEGS; leg++) {
    A.launchGauntlet();
    if (!playOut().won) break;
    legs++;
  }
  if (legs >= GAUNTLET_LEGS) cleared++;
}
console.log(`Gauntlet full clears: ${cleared} / ${GAUNTLET_RUNS}`);
