// Balance: 40 mission simulations against the near-random bot.
// Informational — this harness reports, it does not pass or fail.
import * as A from './support/api.js';
import {playOut} from './support/bot.js';

const RUNS = 40;
const outcomes = [];
let wins = 0;
let losses = 0;
let errors = 0;
let turnsTotal = 0;

for (let run = 0; run < RUNS; run++) {
  try {
    const p = A.blankProfile('TEST' + run);
    A.setActive(p);
    A.genRun();
    A.launch(A.OPS[p.op].nodes[0].id);

    const r = playOut();
    turnsTotal += r.turns;
    if (!r.over) { errors++; continue; }
    r.won ? wins++ : losses++;
    outcomes.push(r);
  } catch (e) {
    errors++;
    if (errors < 8) console.log('ERR:', e.message, (e.stack || '').split('\n')[1]);
  }
}

const avg = k => (outcomes.reduce((a, b) => a + b[k], 0) / Math.max(1, outcomes.length)).toFixed(1);
console.log(`avg breaches ${avg('breaches')} | avg held ${avg('held')} | ` +
  `avg enemies left ${avg('enemiesLeft')} | avg units lost ${avg('unitsLost')} | avg kills ${avg('kills')}`);
console.log(`sims: wins=${wins} losses=${losses} unresolved/errors=${errors} ` +
  `avgTurns=${(turnsTotal / RUNS).toFixed(1)}`);
