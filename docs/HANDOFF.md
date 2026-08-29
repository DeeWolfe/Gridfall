# Gridfall — handoff to Claude Code

## What this is

A finished, playable browser game in a single 152KB HTML file. Design is locked; it has been played and iterated on. This is not a prototype to extend — it is a **reference implementation to rewrite properly**.

**Do not port this file. Rewrite it in modules, and make the test suite pass before adding anything.**

## What you're given

| File | What it is |
|---|---|
| `gridfall-reference.html` | The working game. Every rule below is implemented here. When the spec and the code disagree, the code is right. |
| `gridfall-data.json` | All content extracted as data — 39 cards, 11 hostiles, 8 gear, 3 leads, 6 mission types, 5 modifiers, 3 operations. Import this rather than retyping it. |
| `tests/` | 21 harnesses, ~200 assertions. These transfer with minimal changes and are the most valuable thing here. |
| `SPEC.md` | The rules, written out. |

## The job

1. Rewrite as ES modules with a build step. Suggested split: `state/`, `rules/`, `render/`, `content/`, `save/`.
2. **Keep the game logic pure and DOM-free.** In the reference it is already close — combat maths, targeting, spawning and save migration touch no DOM. That separation is what makes the tests portable. Preserve it.
3. Port the test suite first. Every harness calls exported functions, not UI. Where a test reaches into a stubbed DOM (the render checks), rewrite it against your renderer.
4. Then the renderer.

## Non-negotiables

These are load-bearing. Changing them silently will break the game in ways the tests may not catch:

- **The spawn-marker contract.** Chevrons shown on the enemy edge promise which lane hostiles enter next turn. They are computed *before* the player's turn and consumed *after* it. If a lane is genuinely full the hostile holds at the edge and arrives next turn in the same lane. It never diverts. `spawntest.js` checks this over ~700 spawns.
- **Deployment is territory-gated.** You may only deploy on tiles you hold. Tiles flip to whoever ends the turn standing on them. This is the core loop; everything else is decoration on it.
- **One action per unit per turn**, committed immediately and irreversible. Units that the player does not touch auto-fire at end of turn.
- **Save migration must repair, not reject.** `migrate()` runs unconditionally and strips references to cards and gear that no longer exist. Renaming a card without this will corrupt live saves. `repro.js` covers four bad-save scenarios.

## Known issues, in priority order

1. **Economy is mistuned.** The shop alone is ~86 mission wins for the full collection. Requisition packs mostly fix the pace, but shop prices were set before packs existed and have not been revisited.
2. **Crystals and Specimens sit at ~30% win rate** for a near-random bot, against 60–90% for everything else. Might be correct difficulty, might be broken. Unresolved.
3. **Gauntlet completes about 1 in 15.** Four legs at ~60% each compounds hard. If it should be finishable, cut it to three legs.
4. **No audio, no art.** All visuals are procedural SVG (card sigils, lead portraits) and CSS. That was right for a single file; it is probably not right for the real thing.
5. **Balance numbers come from a bot that plays near-randomly.** It never plans, rarely repositions, and does not use manual targeting. Treat every win rate as a floor, not a measurement.

## What to build next, once it runs

In the order I would do it:

1. Fix the economy curve.
2. Real art pipeline for cards and leads.
3. More operations — the map generator is data-driven, so this is content not code.
4. Audio.
5. Accounts and cloud saves, if it is ever going online. The save layer is already versioned and isolated behind a `store` shim with a memory fallback, so this is a swap not a rewrite.

## Testing

```
node tests/playtest.js     # full playthrough, every screen and mission type
node tests/test.js         # 40 balance simulations
node tests/mtest.js        # per-mission-type win rates
node tests/cssdup.js       # CSS integrity
```

All 21 pass on the reference. Get them passing on the rewrite before adding features.

Worth knowing: several bugs in development were invisible to the JS tests and only caught by the CSS and DOM guards — a duplicate `#combat` display rule that pinned one screen permanently visible, two class-name collisions, a duplicated result modal, and two functions defined twice with different return types. Keep `cssdup.js`, `csstest.js`, `headtest.js` and `navtest.js`. They earn their place.
