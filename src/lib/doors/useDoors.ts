"use client";

import { useEffect, useState } from "react";
import { SimplePool, type Event, type Filter } from "nostr-tools";
import { DOORS, type DoorFilter } from "./config";
import { currentBlockInfo } from "@/lib/bb/bft";

export type LoadState = "loading" | "done";

/** One REQ per filter against the house relay list, client side. Resolves
    with whatever answered inside the wait; a dark relay never blocks. */
export async function readRelays(filters: Filter[], maxWait = 6000): Promise<Event[]> {
  const pool = new SimplePool();
  try {
    const out = new Map<string, Event>();
    await Promise.all(
      filters.map(async (f) => {
        try {
          for (const e of await pool.querySync(DOORS.relays, f, { maxWait })) out.set(e.id, e);
        } catch {
          /* a failed read is an empty read */
        }
      }),
    );
    return [...out.values()];
  } finally {
    try {
      pool.close(DOORS.relays);
    } catch {
      /* already closed */
    }
  }
}

/** Apply the allow list to a base filter. */
export function withAllow(base: Filter, allow: DoorFilter): Filter {
  const f: Filter = { ...base };
  if (allow.authors.length) f.authors = allow.authors;
  if (allow.tags.length) f["#t"] = allow.tags;
  return f;
}

/** Latest-version-wins for addressable events (same pubkey, kind, d). */
export function dedupeAddressable(events: Event[]): Event[] {
  const m = new Map<string, Event>();
  for (const e of events) {
    const d = e.tags.find((t) => t[0] === "d")?.[1] ?? "";
    const k = `${e.kind}:${e.pubkey}:${d}`;
    const cur = m.get(k);
    if (!cur || cur.created_at < e.created_at) m.set(k, e);
  }
  return [...m.values()];
}

export function useRelayEvents(build: () => Filter[], deps: unknown[] = []) {
  const [events, setEvents] = useState<Event[]>([]);
  const [state, setState] = useState<LoadState>("loading");
  useEffect(() => {
    let live = true;
    readRelays(build()).then((e) => {
      if (!live) return;
      setEvents(e);
      setState("done");
    });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return { events, state };
}

/** The chain tip once, for BFT dates. `tip` null = could not read (dates then
    fall back to the site's own genesis-anchored estimate). */
export function useTip() {
  const [tip, setTip] = useState<{ height: number | null; at: number; ready: boolean }>({
    height: null,
    at: 0,
    ready: false,
  });
  useEffect(() => {
    let live = true;
    currentBlockInfo().then((b) => {
      if (live) setTip({ height: b.estimated ? null : b.height, at: Date.now(), ready: true });
    });
    return () => {
      live = false;
    };
  }, []);
  return tip;
}

/** kind 0 display names for a set of pubkeys. */
export function useNames(pubkeys: string[]): Record<string, string> {
  const key = [...new Set(pubkeys)].sort().join(",");
  const [names, setNames] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!key) return;
    let live = true;
    readRelays([{ kinds: [0], authors: key.split(",") }], 5000).then((evs) => {
      if (!live) return;
      const best = new Map<string, Event>();
      for (const e of evs) {
        const c = best.get(e.pubkey);
        if (!c || c.created_at < e.created_at) best.set(e.pubkey, e);
      }
      const out: Record<string, string> = {};
      for (const [pk, e] of best) {
        try {
          const j = JSON.parse(e.content);
          const n = String(j.display_name || j.name || "").trim();
          if (n) out[pk] = n.slice(0, 40);
        } catch {
          /* bad kind 0 */
        }
      }
      setNames(out);
    });
    return () => {
      live = false;
    };
  }, [key]);
  return names;
}

/** Wall clock in ms, read after mount (render stays pure). */
export function useNowMs(): number {
  const [now, setNow] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setNow(Date.now()), 0);
    return () => clearTimeout(t);
  }, []);
  return now;
}
