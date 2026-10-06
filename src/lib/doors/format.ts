import { nip19 } from "nostr-tools";
import { BLOCKS_PER_DAY, BLOCKS_PER_MONTH, bftDatePlain, bftTime, estimateHeightAt } from "@/lib/bb/bft";

/** Shown when no kind 0 name is found: npub1...last4. */
export function shortNpub(pubkey: string): string {
  try {
    const n = nip19.npubEncode(pubkey);
    return `npub1...${n.slice(-4)}`;
  } catch {
    return "npub1...";
  }
}

/** BFT height for a wall-clock time, anchored on the live tip when known.
    Future and past dates are an estimate from the tip, so the old date is
    always printed small beside it. */
export function heightFor(ms: number, tip: number | null, tipAtMs: number): number {
  return estimateHeightAt(ms, tip, tipAtMs);
}

export function bftStamp(ms: number, tip: number | null, tipAtMs: number, withTime = true): string {
  const h = heightFor(ms, tip, tipAtMs);
  return withTime ? `${bftDatePlain(h)} ${bftTime(h)}` : bftDatePlain(h);
}

export function oldDate(ms: number, withTime = false): string {
  const d = new Date(ms);
  const day = d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
  return withTime ? `${day}, ${d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}` : day;
}

export function ago(sec: number, nowMs: number): string {
  const s = Math.max(0, Math.floor(nowMs / 1000) - sec);
  if (s < 3600) return `${Math.max(1, Math.floor(s / 60))}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

export const monthStartOf = (tip: number) => Math.floor(tip / BLOCKS_PER_MONTH) * BLOCKS_PER_MONTH;
export { BLOCKS_PER_DAY, BLOCKS_PER_MONTH };

export function tag(ev: { tags: string[][] }, name: string): string | undefined {
  return ev.tags.find((t) => t[0] === name)?.[1];
}
export function tagsAll(ev: { tags: string[][] }, name: string): string[] {
  return ev.tags.filter((t) => t[0] === name && t[1]).map((t) => t[1]);
}
const URL_RE = /^https?:\/\//i;
export function firstUrl(ev: { tags: string[][] }, names: string[]): string | undefined {
  for (const n of names) for (const v of tagsAll(ev, n)) if (URL_RE.test(v)) return v;
  return undefined;
}
export function sourceChip(url?: string): string {
  if (!url) return "Room";
  try {
    const h = new URL(url).hostname.replace(/^www\./, "");
    return /cornychat/i.test(h) ? "Corny Chat" : h;
  } catch {
    return "Room";
  }
}
