// Balance: how deep the bot gets in Onslaught, and how far down a Deep
// Descent it gets. Informational — this harness reports, it does not pass or
// fail.
//
// The bot cannot judge a draft, so it takes the first offer every time. That
// makes the depth numbers a floor twice over — a floor player with a floor
// deck — and the number to watch is the shape of the distribution rather than
// the median: a mode where nobody clears layer 1 is broken, one where the tail
// reaches the target is working.
import * as A from './support/api.js';
import {playOut} from './support/bot.js';

const ONSLAUGHT_RUNS = 21;
const DESCENT_RUNS = 24;

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

const depths = [];
let finished = 0;
const bot = A.blankProfile('DESCENT');
A.setActive(bot);
A.genRun();
for (let i = 0; i < DESCENT_RUNS; i++) {
  A.setPackQueue([]);
  A.startRun();
  const r = A.active.run;
  const draft = () => { const o = A.runDraftOffer(); if (o.length) A.runDraftTake(o[0]); };
  draft();
  let guard = 0;
  while (A.runActive() && guard++ < 30) {
    // Always take the deepest thing on offer: the question is how far down it
    // gets, not how much of one layer it can mop up.
    const open = r.map.nodes.filter(n => A.runNodeState(n.id) === 'open')
      .sort((a, b) => A.runDepthOf(r.map, b.id) - A.runDepthOf(r.map, a.id));
    if (!open.length || !A.launchRunNode(open[0].id)) break;
    playOut({maxTurns: 40, advance: true});
    if (!A.G.over) A.finish(false, 'timeout');
    A.setG(null);
    if (A.runActive()) draft();
  }
  if (A.runComplete()) finished++;
  depths.push(A.active.run.depth || 0);
  A.active.run = null;
}
depths.sort((a, b) => a - b);
const hist = {};
depths.forEach(d => { hist[d] = (hist[d] || 0) + 1; });
console.log('Deep Descent layers cleared — min', depths[0],
  'median', depths[Math.floor(depths.length / 2)], 'max', depths[depths.length - 1],
  '| spread', JSON.stringify(hist));
console.log(`Deep Descent full clears: ${finished} / ${DESCENT_RUNS}`);
