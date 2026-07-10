/**
 * Bitcoin Buddy — local persistence (v1).
 *
 * Buddies are stored in localStorage keyed by the owner's npub, so a signed-in
 * fren's buddies survive reloads and are private to their browser. This is the
 * stand-in for the nostr BUDDY_DEFINITION/BUDDY_STATE events (see types.ts):
 * same shape, so swapping this store for signed nostr reads/writes is a drop-in.
 */

import type { StoredBuddy, Npub } from "./types";

const key = (npub: Npub) => `bb:buddies:${npub}`;

function available(): boolean {
  return typeof window !== "undefined" && !!window.localStorage;
}

export function loadBuddies(npub: Npub | null | undefined): StoredBuddy[] {
  if (!npub || !available()) return [];
  try {
    const raw = window.localStorage.getItem(key(npub));
    const list = raw ? (JSON.parse(raw) as StoredBuddy[]) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function saveBuddies(npub: Npub, list: StoredBuddy[]): void {
  if (!available()) return;
  try {
    window.localStorage.setItem(key(npub), JSON.stringify(list));
  } catch {
    /* quota / private mode — best effort */
  }
}

export function upsertBuddy(npub: Npub, buddy: StoredBuddy): StoredBuddy[] {
  const list = loadBuddies(npub);
  const i = list.findIndex((b) => b.id === buddy.id);
  if (i >= 0) list[i] = buddy;
  else list.push(buddy);
  saveBuddies(npub, list);
  return list;
}

export function removeBuddy(npub: Npub, id: string): StoredBuddy[] {
  const list = loadBuddies(npub).filter((b) => b.id !== id);
  saveBuddies(npub, list);
  return list;
}

/** A short local id until an ordinal inscription id exists (design notes Part 3). */
export function newBuddyId(): string {
  const rand = Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, "0");
  return `bb_${Date.now().toString(36)}${rand}`;
}
