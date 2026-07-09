/**
 * POKEMUD public profile hook — the game node's read-only window onto a
 * fren's arcade life (knowledge-engine `GET /u/<name>`, no token needed).
 * Fetched server-side so the browser never needs CORS or the node's address.
 *
 * Honest states, nothing hidden: the hook exposes level/xp/runes and the
 * moderation bench. Mutes are session-scoped by design and never sent — so
 * they never appear on a profile.
 */

export interface PokeModeration {
  banned: boolean;
  ban_reason: string;
  /** -1 = permanent, 0 = not banned, else seconds remaining */
  ban_left_s: number;
  /** seconds of chat bench remaining */
  timeout_s: number;
}

export interface PokeProfile {
  /** MUD player name (may differ from the fren tag) */
  name: string;
  /** the fren tag this player belongs to */
  fren: string;
  level: number;
  xp: number;
  /** verse rank title from the node itself ('' when the verse has no ladder;
      absent on nodes older than the rank field) */
  rank?: string;
  runes: number;
  verse: string;
  world: string;
  online: boolean;
  /** practice mode: nothing etches to Bitcoin yet */
  demo_mode: boolean;
  moderation: PokeModeration;
}

/* FALLBACK ONLY — nodes now send their verse's own rank title in the hook
   (`rank`), so this mirror of the verse packs (knowledge-engine
   services/mud/verses/<id>/verse.json) only covers nodes older than that
   field. Unknown verses show LEVEL n with no title. */
const VERSE_RANKS: Record<string, [level: number, title: string][]> = {
  pacsarcade: [
    [1, "Fren"],
    [3, "Student"],
    [5, "Scholar"],
    [8, "Teacher"],
    [12, "Oracle's Peer"],
  ],
  /* the FRENS Starship — frens.earth's own node */
  "frens-hub": [
    [1, "Ensign"],
    [3, "Crewman"],
    [5, "Lieutenant"],
    [8, "Commander"],
    [12, "Captain"],
    [20, "Server Admiral"],
  ],
};

/** Highest rank whose level requirement the player meets ('' when unknown). */
export function rankFor(verse: string, level: number): string {
  let title = "";
  for (const [lvl, t] of VERSE_RANKS[verse] ?? []) {
    if (level >= lvl) title = t;
  }
  return title;
}

/**
 * Best-effort by design: the profile page renders fine without the arcade
 * panel, so a dark node, a 404, or a slow answer all come back as null —
 * never a throw, never an error splash.
 */
export async function getPokeProfile(handle: string): Promise<PokeProfile | null> {
  const nodeUrl = (
    process.env.POKE_NODE_URL ??
    process.env.NEXT_PUBLIC_POKE_NODE_URL ??
    "http://127.0.0.1:4001"
  ).replace(/\/+$/, "");
  try {
    const res = await fetch(`${nodeUrl}/u/${encodeURIComponent(handle)}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(1500),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as PokeProfile;
    /* The node's lookup also matches bare MUD player names — only wear stats
       that belong to THIS fren tag, or /u/pacster could show pacman's score. */
    if ((data.fren ?? "").replace(/^@/, "").toLowerCase() !== handle.toLowerCase()) return null;
    if (!data.moderation) return null;
    return data;
  } catch {
    return null;
  }
}
