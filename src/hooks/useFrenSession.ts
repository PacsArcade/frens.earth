"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * The fren session, shared: one /api/frens/session fetch per page load,
 * one source of truth for every header piece (chip, menu, footer) and the
 * profile editor. A module-level external store — sign-out or a door
 * switch in one corner updates every subscriber, no stale "you're in".
 */

export interface FrenSession {
  handle: string;
  space: string;
  /** From the registry — lets the client tune this fren's kind-0 signal. */
  npub: string | null;
}

export interface FrenAccount {
  handle: string;
  space: string;
}

interface SessionState {
  fren: FrenSession | null;
  /** Every door signed in on this browser (first = active). */
  accounts: FrenAccount[];
  /** false until the first answer lands — render nothing judgmental before it. */
  checked: boolean;
}

let state: SessionState = { fren: null, accounts: [], checked: false };
let fetched = false;
const listeners = new Set<() => void>();

function emit(next: SessionState) {
  state = next;
  listeners.forEach((l) => l());
}

/** LoginPanel (and the door switcher) call this after the server answers so
    the whole header flips without a hard navigation. */
export function applyFrenSession(fren: FrenSession | null, accounts?: FrenAccount[]) {
  fetched = true;
  emit({
    fren,
    accounts: accounts ?? (fren ? [{ handle: fren.handle, space: fren.space }] : []),
    checked: true,
  });
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
          accounts: d?.ok ? (d.accounts ?? [{ handle: d.handle, space: d.space }]) : [],
          checked: true,
        })
      )
      .catch(() => emit({ fren: null, accounts: [], checked: true }));
  }
  return () => {
    listeners.delete(listener);
  };
}

const getSnapshot = () => state;
const SERVER_STATE: SessionState = { fren: null, accounts: [], checked: false };
const getServerSnapshot = () => SERVER_STATE;

export default function useFrenSession() {
  const { fren, accounts, checked } = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const signOut = useCallback(async () => {
    await fetch("/api/frens/session", { method: "DELETE" });
    applyFrenSession(null);
  }, []);

  /** Switch to another signed-in door (or a same-key tag) — no re-signing. */
  const switchTo = useCallback(async (handle: string, space: string): Promise<boolean> => {
    try {
      const res = await fetch("/api/frens/session", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handle, space }),
      });
      const d = await res.json();
      if (!d.ok) return false;
      applyFrenSession({ handle: d.handle, space: d.space, npub: d.npub ?? null }, d.accounts);
      return true;
    } catch {
      return false;
    }
  }, []);

  return { fren, accounts, checked, signOut, switchTo };
}
