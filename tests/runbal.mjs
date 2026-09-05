// Informational: how deep the balance bot gets in a Deep Run. Not a guard.
import './support/install-dom.js';
import * as A from './support/api.js';
import {playOut} from './support/bot.js';

const RUNS = +(process.argv[2] || 60);
const depths = [];
let clears = 0;
const p = A.blankProfile('BOT');
A.enterProfile(p);

for (let i = 0; i < RUNS; i++) {
  A.setPackQueue([]);
  A.startRun();
  const r = A.active.run;
  // The bot cannot judge a draft, so it takes the first offer every time —
  // a floor, the same way the mission bot is a floor.
  const draft = () => { const o = A.runDraftOffer(); if (o.length) A.runDraftTake(o[0]); };
  draft();
  let guard = 0;
  while (A.runActive() && guard++ < 30) {
    const open = r.map.nodes.filter(n => A.runNodeState(n.id) === 'open');
    if (!open.length) break;
    const next = open.sort((a, b) => A.runDepthOf(r.map, b.id) - A.runDepthOf(r.map, a.id))[0];
    if (!A.launchRunNode(next.id)) break;
    playOut({maxTurns: 40, advance: true});
    if (!A.G.over) A.finish(false, 'timeout');
    A.setG(null);
    if (A.runActive()) draft();
  }
  if (A.runComplete()) clears++;
  depths.push(A.active.run.depth || 0);
  A.active.run = null;
}

depths.sort((a, b) => a - b);
const hist = {};
depths.forEach(d => { hist[d] = (hist[d] || 0) + 1; });
console.log(`Deep Run — ${RUNS} bot runs`);
console.log('  layers cleared: min', depths[0], 'median', depths[depths.length >> 1], 'max', depths[depths.length - 1]);
console.log('  distribution:', JSON.stringify(hist));
console.log('  full clears:', clears, '/', RUNS);
