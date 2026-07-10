/**
 * Placeholder buddy store — NO backend yet.
 *
 * v1 will read Buddies from nostr: one BUDDY_DEFINITION event per pet (see
 * BB_EVENT_KINDS in ./types), filtered to those whose `owners[]` includes the
 * signed-in fren's npub — the co-custody model from the design notes (Part 6).
 * Until the event kinds are specced (an open item for Pac), this returns an
 * empty roster so the /bb gate and the "Your Buddies" shell can render for real.
 */
import type { Buddy, Npub } from "./types";

/** Empty until the hatchery + nostr reads land. In-memory, no persistence. */
const ROSTER: Buddy[] = [];

/**
 * Every Buddy whose collar includes this npub. Returns `[]` for a missing key
 * (a fren with no registry npub is signed in, just has no buddies yet).
 */
export function buddiesForOwner(npub: Npub | null | undefined): Buddy[] {
  if (!npub) return [];
  return ROSTER.filter((b) => b.owners.includes(npub));
}
