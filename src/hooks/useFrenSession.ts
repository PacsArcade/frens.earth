"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * The fren session, shared: one /api/frens/session fetch per page load,
 * one source of truth for every header piece (chip, menu, footer) and the
 * profile editor. A module-level external store — sign-out in one corner
 * updates every subscriber, no stale "you're in" left behind.
 */

export interface FrenSession {
  handle: string;
  space: string;
  /** From the registry — lets the client tune this fren's kind-0 signal. */
  npub: string | null;
}

interface SessionState {
  fren: FrenSession | null;
  /** false until the first answer lands — render nothing judgmental before it. */
  checked: boolean;
}

let state: SessionState = { fren: null, checked: false };
let fetched = false;
const listeners = new Set<() => void>();

function emit(next: SessionState) {
  state = next;
  listeners.forEach((l) => l());
}

/** LoginPanel calls this right after a successful sign-in so the whole
    header flips without a hard navigation. */
export function applyFrenSession(fren: FrenSession | null) {
  fetched = true;
  emit({ fren, checked: true });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!fetched) {
    fetched = true;
    fetch("/api/frens/session")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) =>
        emit({
          fren: d?.ok ? { handle: d.handle, space: d.space, npub: d.npub ?? null } : null,
          checked: true,
        })
      )
      .catch(() => emit({ fren: null, checked: true }));
  }
  return () => {
    listeners.delete(listener);
  };
}

const getSnapshot = () => state;
const SERVER_STATE: SessionState = { fren: null, checked: false };
const getServerSnapshot = () => SERVER_STATE;

export default function useFrenSession() {
  const { fren, checked } = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const signOut = useCallback(async () => {
    await fetch("/api/frens/session", { method: "DELETE" });
    applyFrenSession(null);
  }, []);
  return { fren, checked, signOut };
}
