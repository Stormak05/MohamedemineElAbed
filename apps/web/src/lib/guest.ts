import { useSyncExternalStore } from "react";

// Playing without an account, chosen on the welcome screen (routes/index.tsx). Kept for the tab (sessionStorage), so a
// reload goes back to the game rather than to the welcome screen; signing out clears it.
const KEY = "clausus-guest";
const listeners = new Set<() => void>();

function read() {
  try {
    return sessionStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

let guest = read();

export function setGuest(on: boolean) {
  guest = on;
  try {
    if (on) sessionStorage.setItem(KEY, "1");
    else sessionStorage.removeItem(KEY);
  } catch {
    // Only lasts until the page closes, then.
  }
  for (const l of listeners) l();
}

/** True once the visitor has chosen to play without an account. */
export function useGuest() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => guest,
  );
}
