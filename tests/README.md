# Test suite

30 guards and 3 balance harnesses. Run them all with `npm test`, one at a time
with `node tests/run-all.js <name>`, or directly with `node tests/<name>.js`.

The guards must pass. The balance harnesses only report — their numbers come
from a bot that plays close to randomly, so every win rate is a floor.

## Logic — no DOM stub at all

These import `src/` directly and run in plain Node. That they need no stub is
the point: the rules layer touches no DOM, and if one of these ever starts
needing `install-dom.js`, something has leaked out of `src/render/`.

| Harness | Covers |
|---|---|
| `acttest` | Immediate actions: move/attack/ability commit and lock the unit |
| `movetest` | Movement legality, chains, swaps, blocked cells |
| `aimtest` | Manual target locks, stale-lock fallback, multi-target cards offer no choice |
| `clashtest` | Spawn-cell combat: all four outcomes |
| `spawntest` | Spawn-marker contract over ~800 spawns; fire-on-play exactly once |
| `opentest` | Opening-play cards: Pathfinder, Vanguard, Supply Cache |
| `swaptest` | Cipher's swap: exchanges anywhere, respects two-cell footprints, consumes the action |
| `pushtest` | Outrider: charge reach, push-back, safe failure at edges and occupied cells |
| `zonetest` | Deployment zones (Forward Base, Minefield) and the mine's one-shot entry trigger |
| `hecatetest` | Board-wide furthest targeting through blockers; the recharge cycle |
| `cardtest` | Every card x every gear deployed in live missions; none may throw |
| `packtest` | Requisition packs: offers, fallback chain, full reveal flow |
| `maptest` | Map roles: final is always Extraction, gates hold, side pay bonus, op completes on final; the uplink and blitz objectives |

`packtest` and `aimtest` do install the stub for their final render checks.

## Renderer

These import `./support/install-dom.js` **first**. Import order matters: ES
module imports all evaluate before any statement in the importing file, and
`src/save/store.js` probes `localStorage` at evaluation time, so calling
`installDom()` from the test body would be too late.

| Harness | Guards against |
|---|---|
| `playtest` | Full playthrough; every screen, panel, mission type, and wired control |
| `hltest` | Support and buff targeting per unit type, and the panel copy for it |
| `leadtest` | Team lead passives and actives, Drop Pod, enemy doctrines, dialogs |
| `repro` | Corrupted and legacy save handling; every screen with a null profile |
| `actbar` | Contextual action bar states |
| `csstest` | Duplicate/missing DOM ids; exactly one screen visible at every step |

## What actually ships

These read `dist/gridfall.html`, so they check the built page rather than the
sources. They exist because real shipped bugs were invisible to the logic
tests — a duplicate `#combat` display rule once pinned one screen permanently
visible while all 39 playability checks passed.

| Harness | Guards against |
|---|---|
| `cssdup` | Duplicate top-level selectors; rules hiding elements nothing re-shows |
| `headtest` | Combat header cannot overlap; title and lead badge share a row |
| `navtest` | Every screen's navigation sits after its body |
| `scaletest` | Root clamp scales 1.6x+; no fixed font sizes; components stay viewport-relative |
| `handtest` | Combat layout; "hull" never rendered as "HP"; the Database's three tabs share one row format |
| `buildtest` | The bundle evaluates and plays a mission through |

## Interface

| Harness | Guards against |
|---|---|
| `uitest` | The desktop/compact swap: preference round trip, both swap controls, the stamped desktop layer, the combat log |
| `tapetest` | Turn playback: tape off until enabled, frames are snapshots, replay restores G exactly, input holds off |
| `tuttest` | First-mission briefing: fresh commanders only, do-it advancement, completion sticks, replay from Settings |
| `sndtest` | Sound is a silent no-op without WebAudio and a persistent switch; import repairs, replaces by id, refuses overflow |
| `arttest` | Every card has a placeholder portrait, no two cards share one, real art still wins |

`packtest` also pins the economy rules: standard packs are Commons/Tech only,
one slot guarantees an unowned card, duplicates arrive as +12-deployment
promotions, and the campaign drip is one pack per two nodes secured.

## Balance — informational, no pass/fail

| Harness | Reports |
|---|---|
| `test` | 40 mission simulations, win rate and end state |
| `mtest` | Win rate per mission type across all three operations |
| `onstest` | Onslaught waves survived, Gauntlet full clears |

## Shared support

| File | What it is |
|---|---|
| `support/api.js` | One namespace over the game's public surface, so harnesses read like the game |
| `support/install-dom.js` | Side-effecting: installs the DOM stub on import |
| `support/dom.js` | The stub itself, including markup scanning and deferred timers |
| `support/fixtures.js` | Places units and hostiles, building units through the real `mkUnit()` |
| `support/bot.js` | The near-random bot the three balance harnesses share |
| `support/harness.js` | Failure collector, and the built-page loader |

Fixtures go through `mkUnit()` on purpose. The reference suite hand-rolled its
unit literals, and that is precisely how it missed a bug where `mkUnit()` was
dropping a field every test set by hand — see `docs/NOTES.md`.
