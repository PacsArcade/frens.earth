"use client";

import { SimplePool } from "nostr-tools";
import type { Event as NostrEvent } from "nostr-tools";
import { PROFILE_RELAYS } from "@/hooks/useNostrProfile";

/**
 * Kind-0 broadcast with the truth kept: one attempt per relay, one result
 * per relay. The old Promise.any path ("one relay is enough") is still the
 * SUCCESS rule — the network gossips from a single accept — but the fren
 * sees exactly which relays took the card and which didn't. Honest states,
 * house law: a screen never pretends.
 */

export interface RelayResult {
  relay: string;
  ok: boolean;
  /** The relay's own words (or our timeout) when it refused. */
  note?: string;
}

const RELAY_TIMEOUT_MS = 8000;

export async function publishKind0(
  event: NostrEvent,
  relays: string[] = PROFILE_RELAYS
): Promise<RelayResult[]> {
  const pool = new SimplePool();
  try {
    const attempts = pool.publish(relays, event);
    return await Promise.all(
      attempts.map(async (p, i) => {
        try {
          await Promise.race([
            p,
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error("no answer in 8s")), RELAY_TIMEOUT_MS)
            ),
          ]);
          return { relay: relays[i], ok: true };
        } catch (e) {
          return {
            relay: relays[i],
            ok: false,
            note: e instanceof Error && e.message ? e.message : "refused",
          };
        }
      })
    );
  } finally {
    pool.close(relays);
  }
}

/** Success rule: one accepting relay carries the signal to the rest. */
export function anyAccepted(results: RelayResult[]): boolean {
  return results.some((r) => r.ok);
}

/** Short display name for a relay URL — "relay.damus.io", not the wss soup. */
export function relayLabel(url: string): string {
  return url.replace(/^wss?:\/\//, "").replace(/\/$/, "");
}
