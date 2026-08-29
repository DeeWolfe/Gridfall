// Persistence shim.
//
// localStorage throws outright in some privacy modes, so every access is
// guarded and falls back to an in-memory map for the session. `ephemeral` tells
// the UI to say "session only" rather than claiming a save that will not
// survive the tab. Swapping this for a network-backed store is the whole of the
// work for cloud saves — nothing above it knows where the bytes go.

export const KEY = 'gridfall.profiles.v4';

const memory = {};
let usable = true;
try {
  localStorage.setItem('__gridfall_probe', '1');
  localStorage.removeItem('__gridfall_probe');
} catch {
  usable = false;
}

export const store = {
  ephemeral: !usable,
  get(k) {
    try {
      return usable ? localStorage.getItem(k) : (memory[k] ?? null);
    } catch {
      return memory[k] ?? null;
    }
  },
  set(k, v) {
    try {
      if (usable) localStorage.setItem(k, v); else memory[k] = v;
    } catch {
      memory[k] = v;
    }
  },
};
