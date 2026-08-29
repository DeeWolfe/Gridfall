// The seam between the rules and whatever is presenting them.
//
// Rules code never touches the DOM. When something happens that the player
// should see, it calls a hook. The renderer installs real implementations at
// boot; under test they stay no-ops, which is why every logic harness runs in
// plain Node with no DOM stub at all.

export const hooks = {
  /** The board state changed — redraw the combat screen. */
  invalidate() {},
  /**
   * A turn finished resolving; `frames` is the recorded tape. Return true to
   * take over presentation (play it back), false to fall through to a plain
   * invalidate. The default declines, which is what every test relies on.
   */
  turnResolved(_frames) { return false; },
  /** A mission just started — switch to the combat screen. */
  enterCombat() {},
  /** The mission ended. `G.result` holds what to show. */
  showResult() {},
  /** A message with no decision attached. */
  notify(_title, _msg) {},
  /** A yes/no (or text-entry) prompt. Default answer is "no". */
  ask(_title, _msg, cb) { if (cb) cb(false); },
  /** The active profile was just written to storage. */
  saved() {},
};

/** Install presentation hooks. Called once, by the renderer's boot(). */
export function setHooks(impl) {
  Object.assign(hooks, impl);
}
