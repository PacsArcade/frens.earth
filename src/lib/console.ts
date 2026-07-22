import { NIP05_DOMAIN, SPACE_NAME } from "./identity-config";

/**
 * The operator console manifest — the console is a MODULE, not frens.earth
 * furniture (Pac, 0018.04.11 a₿). Sites templated from this repo (pacsarcade-org,
 * onecocreation, every fork) get the same console as CONFIGURATION: the site
 * identity and the room registry live here, and the SCAR·LET shell (elbow
 * ribbon + mobile bottom bar) renders from it. Adding a room = one entry;
 * rebranding the console = the theme.
 *
 * SCAR Console v2 alignment: the five rooms are the canonical v2 decks —
 * BRIDGE · DUTY ROSTER · SIMULATOR · BOT DECK · FLEET MAP — laid over the
 * existing boards (nothing lost, everything re-berthed). The v2 theme seam
 * (Pac's Arcade ↔ LCARS tribute) lives in the shell as a token remap, never
 * a markup fork.
 */

/** house accents — the semantic contract (gold/coin = MONEY only) */
export type ConsoleTone = "neon" | "cyan" | "pink" | "ghost" | "coin";

/** An accordion sub-item under a room in the elbow ribbon. */
export interface ConsoleRoomSub {
  key: string;
  label: string;
  /** route or anchor ("/a/briefs", "/a/connections#chat") */
  href: string;
  /** cut but not wired — renders as a disabled SOON berth */
  soon?: boolean;
  /** key into /api/admin/counts — renders the label-left / count-right pill */
  countKey?: string;
  /** level-2 filters — PROGRESSIVE accordion: they open only when the captain
      clicks this level-1 item, never on room enter (level 1 only then) */
  children?: ConsoleRoomSub[];
}

export interface ConsoleRoom {
  key: string;
  href: string;
  label: string;
  /** compact ribbon label (the rail column is narrow) */
  short: string;
  blurb: string;
  /** semantic accent — the colour law holds (coin = money ONLY, so no coin here) */
  tone: ConsoleTone;
  /** registered but its route hasn't landed yet — renders as an honest
      disabled SOON berth in the ribbon (never a dead link) */
  soon?: boolean;
  subs?: ConsoleRoomSub[];
}

/** The site this console administers — the way back out of the bridge. */
export const CONSOLE_SITE = {
  home: "/",
  domain: NIP05_DOMAIN,
  space: SPACE_NAME,
};

/**
 * The ship node — the v2 sidebar's node block, restored (the lost trio).
 * The name is config, not code: a templated site names its own ship.
 */
export const CONSOLE_NODE = {
  name: process.env.NEXT_PUBLIC_NODE_NAME ?? "EARTHSHIP-01",
};

/**
 * Pac's identity ruling (binding): pacster@pacsarcade is THE ADMIN;
 * pacster@frens.earth is THE CAPTAIN. Display / copy / role-labels ONLY —
 * never auth logic (the key is the operator; OPERATOR_NPUBS stays the gate).
 * The v2 prototype's old ops alias is NOT owned and must never appear.
 */
export interface ConsoleOfficer {
  role: string; // the office as the console names it
  handle: string; // registry handle (matching only)
  space: string; // registry space (matching only)
  display: string; // the tag exactly as the ruling writes it
}
export const CONSOLE_OFFICERS: ConsoleOfficer[] = [
  { role: "THE CAPTAIN", handle: "pacster", space: "frens", display: "pacster@frens.earth" },
  { role: "THE ADMIN", handle: "pacster", space: "pacsarcade", display: "pacster@pacsarcade" },
];

/**
 * The console FRONT PAGE — the room the ◗ SCAR·LET brand block opens. Not a
 * numbered room (the readout reads ◉ HOME there), so it lives beside the
 * registry rather than in it. Deliberately CALM — the decks live in the ribbon.
 */
export const CONSOLE_OVERVIEW: ConsoleRoom = {
  key: "overview",
  href: "/a",
  label: "SCAR·LET Overview",
  short: "OVERVIEW",
  blurb: "the console front page — site health, what needs you, where a first captain begins",
  tone: "cyan",
};

/**
 * The five decks of SCAR Console v2, mapped onto the console's REAL boards.
 * Accents honour the house colour law (gold = money ONLY): pink = your
 * action, neon = live/test, cyan = info/systems. Sub-items with a `countKey`
 * wear a live count pill; ones with `children` open a level-2 filter rail
 * progressively (level 1 only on room enter). Adding a room is still one
 * entry; the ribbon, breadcrumb, readouts and mobile bottom bar all render
 * from this list.
 */
export const CONSOLE_ROOMS: ConsoleRoom[] = [
  {
    key: "bridge",
    href: "/a/status",
    label: "BRIDGE",
    short: "BRIDGE",
    blurb: "the live board — status reports + the briefs library",
    tone: "cyan",
    subs: [
      {
        key: "reports",
        label: "STATUS REPORTS",
        href: "/a/status",
        children: [
          { key: "flight", label: "IN FLIGHT", href: "/a/status#flight", countKey: "flight" },
          { key: "sign", label: "SIGN", href: "/a/status#sign", countKey: "sign" },
          { key: "review", label: "REVIEW", href: "/a/status#review", countKey: "review" },
          { key: "vote", label: "VOTE", href: "/a/status#vote", countKey: "vote" },
        ],
      },
      {
        key: "briefs",
        label: "BRIEFS",
        href: "/a/briefs",
        children: [
          { key: "shared", label: "SHARED", href: "/a/briefs#shared", countKey: "briefsShared" },
          { key: "personal", label: "PERSONAL", href: "/a/briefs#personal", countKey: "briefsPersonal" },
        ],
      },
    ],
  },
  {
    key: "duty",
    href: "/a/action",
    label: "DUTY ROSTER",
    short: "DUTY ROSTER",
    blurb: "everything that needs your key, then the crew board — missions, rank track, ship's log",
    // pink = your action (the admiral rules here); not coin — gold = money only (Pac's house law)
    tone: "pink",
    subs: [
      { key: "signoffs", label: "SIGN-OFFS", href: "/a/action#signoffs", countKey: "signoffs" },
      { key: "approvals", label: "APPROVALS", href: "/a/action#approvals" },
      { key: "decisions", label: "DECISIONS", href: "/a/action#decisions", countKey: "decisions" },
      {
        key: "crew",
        label: "CREW BOARD",
        href: "/a/testing",
        children: [
          { key: "inflight", label: "IN FLIGHT", href: "/a/testing#inflight" },
          { key: "roster", label: "TICKETS", href: "/a/testing#roster", countKey: "tickets" },
          { key: "rank", label: "RANK TRACK", href: "/a/testing#rank" },
          { key: "log", label: "SHIP'S LOG", href: "/a/testing#log" },
        ],
      },
    ],
  },
  {
    key: "sim",
    href: "/a/sim",
    label: "SIMULATOR",
    short: "SIMULATOR",
    blurb: "the sim deck — play money only — and the training modules berth",
    tone: "neon",
    subs: [
      { key: "deck", label: "SIM DECK", href: "/a/sim#deck" },
      { key: "modules", label: "TRAINING MODULES", href: "/a/sim#modules", soon: true },
    ],
  },
  {
    key: "bots",
    href: "/a/bots",
    label: "BOT DECK",
    short: "BOT DECK",
    blurb: "owner-toggled add-ons — OFF by default, your call always",
    tone: "cyan",
  },
  {
    key: "fleet",
    href: "/a/connections",
    label: "FLEET MAP",
    short: "FLEET MAP",
    blurb: "your nodes & doors, plus the dressing room — nothing here is hardwired",
    tone: "cyan",
    subs: [
      {
        key: "nodes",
        label: "NODES & DOORS",
        href: "/a/connections",
        children: [
          { key: "spaces", label: "SPACES", href: "/a/connections#spaces" },
          { key: "seat", label: "SEAT NAME", href: "/a/connections#seat" },
          { key: "chat", label: "CHAT", href: "/a/connections#chat" },
          { key: "mud", label: "MUD", href: "/a/connections#mud" },
          { key: "chain", label: "CHAIN", href: "/a/connections#chain" },
          { key: "briefs-src", label: "BRIEFS", href: "/a/connections#briefs" },
          { key: "deploy", label: "SHIP", href: "/a/connections#deploy" },
          { key: "torrents", label: "TORRENTS", href: "/a/connections#torrents" },
        ],
      },
      {
        key: "dressing",
        label: "DRESSING ROOM",
        href: "/a/brand",
        children: [
          { key: "certs", label: "CERT FOUNDRY", href: "/a/brand#certs" },
          { key: "tester", label: "BRAND KIT", href: "/a/brand#tester" },
        ],
      },
    ],
  },
  {
    /* the STORE room — landed from feat/store-framework; /a/store is open,
       so the berth flag came off at the union of the two branches. */
    key: "store",
    href: "/a/store",
    label: "STORE",
    short: "STORE",
    blurb: "the shelf manager — wares, prices, the order book",
    tone: "neon",
  },
];

/** Every level-1 + level-2 sub of a room, flattened (for path matching). */
function allSubs(room: ConsoleRoom): ConsoleRoomSub[] {
  return (room.subs ?? []).flatMap((s) => [s, ...(s.children ?? [])]);
}

/**
 * Which room a console pathname lives in — "/a" exactly is the Overview front
 * page (◉ HOME), then the exact room href, then a sub route at any accordion
 * level (Briefs lives under BRIDGE; the crew board under DUTY ROSTER), then
 * the longest room-href prefix.
 */
export function roomForPath(pathname: string): ConsoleRoom {
  if (pathname === CONSOLE_OVERVIEW.href) return CONSOLE_OVERVIEW;
  const exact = CONSOLE_ROOMS.find((r) => r.href === pathname);
  if (exact) return exact;
  const bySub = CONSOLE_ROOMS.find((r) =>
    allSubs(r).some((s) => !s.soon && s.href.split("#")[0] === pathname)
  );
  if (bySub) return bySub;
  const byPrefix = CONSOLE_ROOMS.filter(
    (r) => r.href !== "/a" && pathname.startsWith(`${r.href}/`)
  ).sort((a, b) => b.href.length - a.href.length)[0];
  return byPrefix ?? CONSOLE_ROOMS.find((r) => r.key === "duty") ?? CONSOLE_ROOMS[0];
}
