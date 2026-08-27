# Rewrite notes

What changed moving from the single-file reference build to the module layout,
and what is still open. `docs/HANDOFF.md` is the original brief; `docs/SPEC.md`
is the mechanics reference.

## The one behavioural change

**`mkUnit()` never copied the `single` flag.**

Fifteen cards are marked `single: 1` in the data. `candidatesFor()` and
`targetsFor()` both branch on `u.single`, the targeting UI is built around it,
and the test suite asserts single-target behaviour throughout — but the function
that turns a card into a unit on the board simply never copied the field across.
Every deployed "single-target" card therefore hit its **entire firing geometry**
in live play. An Archer, documented and rendered as picking one of four cells,
was quietly hitting all four.

The test suite missed it because every harness that checks targeting builds its
units by hand, with `single` set explicitly. The reference passes its own suite
either way.

This is fixed in `src/rules/units.js`. The data, the spec, the UI copy and the
tests all agree on the intended behaviour, so the odd one out was the bug.

**It costs win rate.** Three runs of `tests/mtest.js` each way, aggregated:

| Mission type | Reference behaviour | With the fix | Δ |
|---|---|---|---|
| Defend Stronghold | 76% | 68% | −8 |
| Retake Ground | 73% | 68% | −5 |
| Fight for Crystals | 39% | 28% | −11 |
| Extraction | 91% | 87% | −4 |
| Acquire Specimens | 41% | 42% | ~0 |
| Protect Civilians | 96% | 95% | ~0 |

Crystals takes the worst of it, which makes known issue #2 from the handoff
(Crystals and Specimens sitting near 30%) **worse, not better**. If that mission
type is meant to be winnable by an ordinary player it now needs a balance pass
rather than a wait-and-see. Reverting is a one-line change, but it means
shipping a card set whose printed rules do not match what the cards do.

## Dead code removed

Both of these were no-ops in the reference; neither changes behaviour.

- **The duplicated claim block in `deploy()`.** Pathfinder and Drop Beacon ran
  their tile-claiming loop twice. The second pass re-checked `!== 'p'` on cells
  the first pass had already flipped, so it never claimed anything — it only
  emitted a spurious `0 cells claimed` line into the combat log.
- **A `purge` mission branch in `wave()`.** There is no `purge` mission type;
  the branch could never be reached.

## Structural changes

- **Rules are DOM-free.** Where the reference called `drawAll()` from inside
  `deploy()`, `doMove()` and `endTurn()`, the rules now call
  `hooks.invalidate()`. The renderer installs the real implementations in
  `boot()`. Same for dialogs (`hooks.notify` / `hooks.ask`), entering combat and
  showing the result card.
- **`finish()` computes, it does not render.** It settles rewards, records and
  queued packs, then parks a description of the outcome on `G.result`
  (`{kind, cleared, title, lines, payout}`). `src/render/result.js` reads it.
  Nothing has to scrape `#rt`'s text content to find out whether the player won
  any more — the balance harnesses used to do exactly that.
- **`abortMission()` split in two.** The rules-level function forfeits the
  mission and reports what kind it was; `leaveCombat()` in the renderer decides
  which screen to go back to.
- **Content generated from the data file.** See the README. `npm run
  check:content` runs as part of `npm test`.
- **The bundler checks for duplicate top-level declarations.** The handoff
  called out "two functions defined twice with different return types" as a real
  shipped bug; that class of mistake is now a build failure.

## Test suite

All 18 harnesses transferred, plus one new one.

- **Logic harnesses** (`acttest`, `movetest`, `aimtest`, `clashtest`,
  `spawntest`, `opentest`, `cardtest`, `packtest`) import `src/` directly and
  run with **no DOM stub at all**. That is the clearest proof the rules layer
  stayed clean.
- **Renderer harnesses** (`hltest`, `leadtest`, `repro`, `playtest`, `actbar`,
  `csstest`) import `tests/support/install-dom.js` first — import order matters,
  because `src/save/store.js` probes `localStorage` at module-evaluation time.
- **Structural harnesses** (`cssdup`, `headtest`, `navtest`, `scaletest`, and
  the static half of `csstest`) read `dist/gridfall.html`, so they check what
  actually ships.
- **`buildtest` is new.** It evaluates the built page's script in the stub DOM
  and plays a mission through it — the one harness that tests the bundle as code
  rather than as text.
- Hand-rolled unit literals were replaced with `tests/support/fixtures.js`,
  which builds units through the real `mkUnit()`. That is what would have caught
  the `single` bug: fixtures that disagree with the code they test can hide it
  indefinitely.
- The three balance harnesses share one bot (`tests/support/bot.js`) instead of
  carrying three copies of the same loop.

## Combat layout pass

Play-testing feedback, actioned:

- **The hand is a row of upright cards across the bottom.** It was a stack of
  wide horizontal bars in the side rail, two to a row, each mostly empty space.
  It is now a full-width strip of portrait cards that scrolls sideways —
  roughly nine visible at 1440px, eight at 820px. The card shows cost, name and
  a four-line blurb; the full text lives in the details panel and behind the ⌕
  badge.
- **The details panel moved beside the board.** With the hand out of the rail,
  the rail carries only the selection panel, so it sits directly next to the
  grid and grows into the space the hand used to take. In the stacked layout
  the grid rows no longer stretch (`align-content:start`), so the panel sits
  tight under the board rather than floating in a gap. The rail also narrowed
  from `clamp(260px,21vw,520px)` to `clamp(212px,17vw,340px)`, giving the board
  the width back.
- **The inbound wave strip is properly scrollable.** It always had
  `overflow-x:auto`, but the CSS explicitly hid the scrollbar
  (`scrollbar-width:none` plus a `::-webkit-scrollbar{display:none}`), so there
  was no sign the rest of the wave was there. The scrollbar is now a slim
  styled bar, and the chips carry `flex:0 0 auto` so a long wave overflows and
  scrolls instead of squashing.

`tests/handtest.js` is new and guards the layout contract: the footer holds the
hand and the action bar, the details panel sits in the main area before it, the
hand is a flex row of clamped-width upright cards, and the details panel is the
element that grows. `headtest.js` gained the matching checks for the inbound
strip. Both were verified to fail when the old rules are put back.

## Content and framing pass

- **Drop Pod is gear, not a card.** It left the 39-card pool and became the
  ninth piece of gear at 150 salvage. It *widens* where its card may be played
  rather than replacing the rule — the fitted card keeps every tile it could
  normally use and gains the hostile cells on top, and the crush only fires when
  the chosen cell actually holds something. Without that, fitting it to a Medic
  would have been a trap. Specialist-tier hostiles are still immune.
- **Knight dropped to Common**, and lost the `tech` flag with it (so Breachers
  no longer hunt it, a Medic can patch it and a Tech Medic cannot). Its riposte
  came down 3 → 1 and its price 210 → 200. The nerf is an internal-consistency
  argument rather than a win-rate one: at 3 DP it beat Bulwark on hull-for-
  damage *and* carried a riposte of 3, higher than the 5 DP Specialist Aegis
  Knights' 2. At riposte 1 it trades Bulwark's Brace for a point of damage and a
  light counter, and sits under the Specialist where it belongs. Three `mtest`
  runs after the change: stronghold 72%, retake 74%, extraction 94%, civilians
  96%, specimens 35%, crystals 33% — all within noise of the previous build.
- **One word for the stat: hull.** The hand tile said `12 HP` and the hostile
  list said `10 HP · threat 4` while the focus card, the pack card and the
  selection panel all said hull. Everything says hull now, and `handtest`
  fails on a stray player-facing "HP".
- **The Database reads the same way on all three tabs.** Assets was a grid of
  card tiles while Gear and Hostiles were lists; all three now go through one
  `dbRow()` builder — name, what it does, and the one number that matters on the
  right. Guarded in `handtest`.
- **The player is the commander.** The rank ladder used to start at Recruit,
  which put the player below the team lead they command. It runs Acting
  Commander → Marshal now, the lead card states who it reports to, and the Squad
  page heads the section "Team lead — answers to you".
- **The login screen is a console.** It was a wordmark over three buttons; it is
  now a framed terminal with a status bar, a staggered boot log, uplink
  readouts, and a `>` prompt with a blinking caret for authentication. Built
  from the existing tokens — same palette, same mono, no new visual language.

No save-version bump was needed. `migrate()` strips the now-missing `dropod`
card id out of decks and collections on load, which is exactly the case
`repro.js` covers; the gear id of the same name is new, so nothing collides.

## Two layouts, and a battlefield

**A desktop layout, chosen by the player.** `compact` is the touch-first layout
that stacks and scrolls; `pc` is a denser three-column board — combat log on the
left, board centre, selection panel right, hand strip across the bottom — with
hover states, tighter chrome and number-key deployment (1–9 pick the nth card,
Enter joins Space for end turn).

The preference has three values (`auto` / `pc` / `compact`) and lives in
`active.settings.ui`, but **the DOM only ever carries a concrete one**:
`src/render/uimode.js` resolves `auto` against
`(min-width:1200px) and (pointer:fine)` and stamps `data-ui="pc"` or
`data-ui="compact"` on the root. That is a deliberate call — it keeps the
stylesheet to a single set of `:root[data-ui="pc"]` blocks rather than a media
query and an attribute selector that have to be kept identical by hand, which is
exactly the kind of drift `cssdup` exists to catch. `auto` re-resolves on resize.

Two swap controls: a chip in the hold footer that cycles, and a three-way picker
in Settings that also reports which layout is in force. `uitest.js` covers the
round trip through storage, the cycle, both controls, and the shape of the
desktop layer.

**The combat log finally has a home.** The engine has kept `G.logs` since the
reference build and nothing ever rendered it. It fills the desktop layout's left
rail, colour-coded by category, and is hidden in compact where there is no room.

**The hold screen is a battlefield.** `src/render/sky.js` became
`src/render/battlefield.js`. Over the same parallax ridgelines: gunships cross
the horizon and release bombs that fall under gravity, tracer fire climbs from
the ridge and bursts into flak, and shells land out on the plain — each with a
flash, a shock ring and smoke that rises and thins.

Two things make it read rather than just move. It is **event-driven**: each of
the three events waits out a randomised cooldown (sorties every 7–16s, ground
fire every 1.6–4.5s, shelling every 2.2–6s), so the horizon is quiet often
enough that a strike registers. And the **nearest ridge is painted last**, so it
occludes the base of everything happening behind it — without that the scene is
flat and the explosions look pasted on. Entity counts are capped, and
`prefers-reduced-motion` gets the terrain held still.

The canvas stub in `tests/support/dom.js` grew the operations the scene needs
(`createRadialGradient`, `stroke`, `strokeStyle`, `lineWidth`, `save`/`restore`).

## Still open

Carried over from the handoff, in the order it recommended.

1. **Economy is mistuned.** The shop alone is ~86 mission wins for the full
   collection. Shop prices were set before requisition packs existed and have
   not been revisited since.
2. **Crystals is now the outlier**, at ~28%. Specimens sits near 42%. See above.
3. **Gauntlet completes about 1 in 15.** Four legs compounding at ~70% each. If
   it is meant to be finishable, cut it to three.
4. **No audio, no art.** Everything visual is procedural SVG
   (`src/render/art.js`) and CSS. That was right for one file; it is probably not
   right for the real thing. `art.js` is the seam — every caller wants an HTML
   string and does not care how it was made.
5. **Every win rate above comes from a near-random bot.** It never plans, rarely
   repositions and never uses manual targeting. Treat the numbers as floors.

Two things the structure now makes cheap:

- **More operations.** The map generator is data-driven — a new operation is an
  entry in `reference/gridfall-data.json` under `operations`, not code.
- **Cloud saves.** The save layer is versioned and sits behind `src/save/store.js`
  with a memory fallback. Swapping the backing store is the whole job.
