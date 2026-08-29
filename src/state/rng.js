// Randomness, in one place. Every roll in the game funnels through here so a
// seeded generator can be dropped in later without touching the rules.

/** Uniform integer in [0, n). */
export const randInt = n => (Math.random() * n) | 0;

/** Remove and return one element of `a` at random. Mutates `a`. */
export const takeOne = a => a.splice(randInt(a.length), 1)[0];

/** Fisher-Yates, in place. Returns the same array for chaining. */
export const shuffle = a => {
  for (let i = a.length - 1; i > 0; i--) {
    const j = randInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

/** True with probability p. */
export const chance = p => Math.random() < p;
