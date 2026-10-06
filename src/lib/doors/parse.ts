import type { Event } from "nostr-tools";
import { firstUrl, tag, tagsAll } from "./format";

export type EventType = "meetup" | "class" | "room";

export interface CalEvent {
  id: string;
  pubkey: string;
  d: string;
  title: string;
  startMs: number;
  endMs?: number;
  allDay: boolean;
  place?: string;
  roomLink?: string;
  desc: string;
  type: EventType;
  image?: string;
  coord: string;
}

function typeOf(ev: Event): EventType {
  const t = tagsAll(ev, "t").map((x) => x.toLowerCase());
  if (t.some((x) => /^(room|rooms|hangout|hangouts|virtual|audio)/.test(x))) return "room";
  if (t.some((x) => /^(class|classes|lesson|workshop)/.test(x))) return "class";
  return "meetup";
}

export function parseCal(ev: Event): CalEvent | null {
  if (ev.kind !== 31922 && ev.kind !== 31923) return null;
  const startRaw = tag(ev, "start");
  if (!startRaw) return null;
  const allDay = ev.kind === 31922;
  const toMs = (v?: string) => {
    if (!v) return undefined;
    if (allDay) {
      const t = Date.parse(`${v}T00:00:00Z`);
      return Number.isFinite(t) ? t : undefined;
    }
    const n = Number(v);
    return Number.isFinite(n) ? n * 1000 : undefined;
  };
  const startMs = toMs(startRaw);
  if (startMs == null) return null;
  const d = tag(ev, "d") ?? "";
  const loc = tag(ev, "location");
  return {
    id: ev.id,
    pubkey: ev.pubkey,
    d,
    title: (tag(ev, "title") ?? tag(ev, "name") ?? "Untitled event").slice(0, 140),
    startMs,
    endMs: toMs(tag(ev, "end")),
    allDay,
    place: loc && !/^https?:\/\//i.test(loc) ? loc.slice(0, 140) : undefined,
    roomLink: firstUrl(ev, ["r", "streaming", "url", "location"]),
    desc: ev.content.slice(0, 4000),
    type: typeOf(ev),
    image: firstUrl(ev, ["image"]),
    coord: `${ev.kind}:${ev.pubkey}:${d}`,
  };
}

export interface Listing {
  id: string;
  pubkey: string;
  d: string;
  title: string;
  summary: string;
  desc: string;
  sats: number | null;
  priceRaw?: string;
  free: boolean;
  period?: string;
  place?: string;
  images: string[];
  cats: string[];
  status: string;
  at: number;
}

export function parseListing(ev: Event): Listing | null {
  if (ev.kind !== 30402) return null;
  const p = ev.tags.find((t) => t[0] === "price");
  let sats: number | null = null;
  let priceRaw: string | undefined;
  let free = false;
  if (p && p[1] !== undefined) {
    const n = Number(p[1]);
    const cur = (p[2] ?? "").toUpperCase();
    if (Number.isFinite(n)) {
      if (n === 0) free = true;
      else if (cur === "SATS" || cur === "SAT" || cur === "SATOSHI") sats = Math.round(n);
      else if (cur === "BTC") sats = Math.round(n * 1e8);
      else priceRaw = `${n.toLocaleString("en-US")} ${cur}`.trim();
    }
  }
  const pub = Number(tag(ev, "published_at"));
  return {
    id: ev.id,
    pubkey: ev.pubkey,
    d: tag(ev, "d") ?? "",
    title: (tag(ev, "title") ?? "Untitled listing").slice(0, 140),
    summary: (tag(ev, "summary") ?? "").slice(0, 400),
    desc: ev.content.slice(0, 6000),
    sats,
    priceRaw,
    free,
    period: p?.[3],
    place: tag(ev, "location")?.slice(0, 80),
    images: tagsAll(ev, "image").filter((u) => /^https?:\/\//i.test(u)).slice(0, 8),
    cats: tagsAll(ev, "t").map((t) => t.toLowerCase()),
    status: (tag(ev, "status") ?? "active").toLowerCase(),
    at: Number.isFinite(pub) && pub > 0 ? pub : ev.created_at,
  };
}

export const satsLabel = (n: number, period?: string) =>
  `${n.toLocaleString("en-US")} sats${period ? ` / ${period}` : ""}`;

export interface LiveRoom {
  id: string;
  pubkey: string;
  title: string;
  summary: string;
  status: "live" | "planned";
  link?: string;
  listeners?: number;
  startMs?: number;
}

export function parseRoom(ev: Event): LiveRoom | null {
  if (ev.kind !== 30311) return null;
  const status = (tag(ev, "status") ?? "").toLowerCase();
  if (status !== "live" && status !== "planned") return null;
  const cp = Number(tag(ev, "current_participants"));
  const st = Number(tag(ev, "starts"));
  return {
    id: ev.id,
    pubkey: ev.pubkey,
    title: (tag(ev, "title") ?? "Untitled room").slice(0, 120),
    summary: (tag(ev, "summary") ?? "").slice(0, 240),
    status,
    link: firstUrl(ev, ["streaming", "service", "r", "url"]),
    listeners: Number.isFinite(cp) && cp > 0 ? cp : undefined,
    startMs: Number.isFinite(st) && st > 0 ? st * 1000 : undefined,
  };
}
