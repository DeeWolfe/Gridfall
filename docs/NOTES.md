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
