# Gridfall: Zanshin Protocol

A lane-defence tactics game for the browser. Five lanes, eight columns, twelve
cards, and a horde that tells you exactly which lane it is coming down.

You are the task force commander. A team lead runs the squad in the field and
answers to you.

You hold ground to deploy, and you deploy to hold ground. Tiles flip to whoever
ends the turn standing on them, and you may only play cards onto tiles you
already hold — so every card you commit is a bid on territory, and every tile
you lose narrows what you can do next turn. Chevrons on the hostile edge promise
which lane each incoming hostile will enter, and that promise is kept.

## Running it

No dependencies, no install step.

```sh
npm run dev      # http://localhost:8080 — serves src/ as real ES modules
npm run build    # -> dist/gridfall.html, one self-contained file
npm test         # builds, then runs every guard and the balance sims
```

`dist/gridfall.html` is the whole game in a single file: open it from disk, host
it anywhere, no server required.

## Layout

```
src/
  content/    the game's data — cards, gear, hostiles, leads, missions, maps
  state/      constants, session singletons, randomness, presentation hooks
  save/       storage shim, profile migration, derived profile readings
  rules/      the game itself. no DOM, anywhere in here
  render/     screens, panels, overlays, and the boot wiring
tests/        33 harnesses; see tests/README.md
tools/        content generator, content check, dev server
reference/    the original single-file build and its extracted data
```

## Two layouts

`compact` stacks and scrolls; `pc` is a denser three-column desktop board with a
combat log, hover states and number-key deployment. The player picks in Settings
or from the chip in the hold footer, and `auto` follows the display.
`src/render/uimode.js` resolves the choice and stamps `data-ui` on the root, so
the stylesheet describes the desktop layout exactly once.

**The rules layer touches no DOM.** Combat maths, targeting, spawning, packs and
save migration are all plain functions over plain objects; when something
changes that the player should see, the rules call a hook (`src/state/hooks.js`)
and the renderer, which installed those hooks at boot, redraws. That is why
every logic harness runs in plain Node with no DOM stub at all — and it is the
property to protect if you change anything in here.

## Content is generated

`src/content/*.js` and `src/state/constants.js` are generated from
`reference/gridfall-data.json`, which is the source of truth for every number
and every string in the game.

```sh
npm run gen:content     # regenerate after editing the JSON
npm run check:content   # prove the modules still match (runs as part of npm test)
npm run gen:art         # embed card art from art/sources/ (dev-only; needs Pillow)
```

Balance changes are one-line edits to the JSON. Do not hand-edit the generated
modules — renaming a card id there would silently strip that card out of every
live save the next time `migrate()` ran.

## The build

`build.js` walks the module graph from `src/main.js`, orders it depth-first,
strips the import/export syntax, and concatenates every module body into a
single flat scope inside `dist/gridfall.html`.

The flat scope is deliberate: it is what lets the structural harnesses evaluate
the shipped script directly, and it means the build can check that **no two
modules declare the same top-level name**. The reference build shipped that bug
twice — two functions defined in different places with different return types —
so it is now a build error rather than a runtime surprise.

The bundler is intentionally small and imposes three rules on source: no
`export default`, no namespace imports (`import * as`), and no dynamic
`import()`. All three are checked; violating one fails the build with the file
name.

## Testing

```sh
npm test                      # everything
node tests/run-all.js --no-build
node tests/run-all.js acttest # one harness
```

30 guards must pass. Three balance harnesses report win rates and never fail —
their numbers come from a bot that plays close to randomly, so read every figure
as a floor rather than a measurement.

Several of the guards check the built page as text rather than as code: the CSS
integrity, header layout, navigation order and scaling harnesses exist because
real shipped bugs were invisible to the logic tests. A duplicate `#combat`
display rule once pinned one screen permanently visible while all 39
playability checks passed. Keep them.

## Where to go next

`docs/NOTES.md` records what changed in this rewrite and what is still open —
including a targeting bug found in the reference build, what fixing it did to
the balance numbers, and the known economy and difficulty issues carried over
from the handoff. `docs/SPEC.md` is the mechanics reference.
