"use client";

import { useCallback, useEffect, useState } from "react";
import { nip19, SimplePool } from "nostr-tools";

/**
 * The fren's live signal: their kind-0 profile as the nostr network sees it
 * right now. Read-only, best-effort — callers never block on relays.
 * Lifted out of FrenProfile so the header chip and the profile editor share
 * one implementation (and one cache: the chip rides on every page, and must
 * not open three websockets per navigation).
 */

/* Public relays we read kind-0 profiles from — same set the registration
   machine broadcasts to, so a fresh starter profile is found. */
export const PROFILE_RELAYS = ["wss://relay.damus.io", "wss://nos.lol", "wss://relay.primal.net"];

export interface NostrProfile {
  name?: string;
  display_name?: string;
  about?: string;
  picture?: string;
  banner?: string;
  website?: string;
  lud16?: string;
  nip05?: string;
}

/** The whole kind-0, unfiltered — the editor needs every field other apps
    set (not just the ones we render) to merge without clobbering. */
export interface RawKind0 {
  content: Record<string, unknown>;
  created_at: number;
  tags: string[][];
}

export type SignalState = "tuning" | "found" | "silent";

/* sessionStorage cache: {at, event|null}. Negative results cache too —
   a silent fren shouldn't cost three websockets per page either. */
const CACHE_TTL_MS = 5 * 60 * 1000;
const cacheKey = (npub: string) => `pa-k0-${npub}`;

interface CachedEvent {
  content: string;
  created_at: number;
  tags: string[][];
}

function readCache(npub: string): { event: CachedEvent | null } | null {
  try {
    const raw = sessionStorage.getItem(cacheKey(npub));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { at: number; event: CachedEvent | null };
    if (Date.now() - parsed.at > CACHE_TTL_MS) return null;
    return { event: parsed.event };
  } catch {
    return null;
  }
}

function writeCache(npub: string, event: CachedEvent | null) {
  try {
    sessionStorage.setItem(cacheKey(npub), JSON.stringify({ at: Date.now(), event }));
  } catch {
    /* private mode etc. — cache is a nicety */
  }
}

function parseEvent(event: CachedEvent): { profile: NostrProfile; raw: RawKind0 } | null {
  try {
    const content = JSON.parse(event.content) as Record<string, unknown>;
    return {
      profile: content as NostrProfile,
      raw: { content, created_at: event.created_at, tags: event.tags ?? [] },
    };
  } catch {
    return null;
  }
}

export default function useNostrProfile(npub: string | null | undefined) {
  const [state, setState] = useState<SignalState>("tuning");
  const [profile, setProfile] = useState<NostrProfile | null>(null);
  const [raw, setRaw] = useState<RawKind0 | null>(null);

  useEffect(() => {
    if (!npub) return;

    let alive = true;
    let pool: SimplePool | null = null;
    (async () => {
      /* one tick off the render path — lint's cascading-render rule is right */
      await Promise.resolve();
      if (!alive) return;

      const cached = readCache(npub);
      if (cached) {
        const parsed = cached.event && parseEvent(cached.event);
        if (parsed) {
          setProfile(parsed.profile);
          setRaw(parsed.raw);
          setState("found");
        } else {
          setState("silent");
        }
        return;
      }

      pool = new SimplePool();
      try {
        const decoded = nip19.decode(npub);
        if (decoded.type !== "npub") throw new Error();
        const event = await Promise.race([
          pool.get(PROFILE_RELAYS, { kinds: [0], authors: [decoded.data as string] }),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 6000)),
        ]);
        if (!alive) return;
        if (event) {
          const slim: CachedEvent = {
            content: event.content,
            created_at: event.created_at,
            tags: event.tags,
          };
          writeCache(npub, slim);
          const parsed = parseEvent(slim);
          if (parsed) {
            setProfile(parsed.profile);
            setRaw(parsed.raw);
            setState("found");
          } else {
            setState("silent");
          }
        } else {
          writeCache(npub, null);
          setState("silent");
        }
      } catch {
        if (alive) setState("silent");
      } finally {
        pool?.close(PROFILE_RELAYS);
      }
    })();
    return () => {
      alive = false;
    };
  }, [npub]);

  /** Optimistic local apply after the editor publishes — the page (and the
      cache other pages read) shows the new signal without re-tuning. */
  const applyLocal = useCallback(
    (content: Record<string, unknown>, created_at: number) => {
      if (!npub) return;
      const slim: CachedEvent = { content: JSON.stringify(content), created_at, tags: raw?.tags ?? [] };
      writeCache(npub, slim);
      setProfile(content as NostrProfile);
      setRaw({ content, created_at, tags: raw?.tags ?? [] });
      setState("found");
    },
    [npub, raw]
  );

  return { state, profile, raw, applyLocal };
}
