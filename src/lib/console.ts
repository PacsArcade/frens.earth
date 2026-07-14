import { NIP05_DOMAIN, SPACE_NAME } from "./identity-config";

/**
 * The operator console manifest — the console is a MODULE, not frens.earth
 * furniture (Pac, 2026-07-11). Sites templated from this repo (pacsarcade-org,
 * onecocreation, every fork) get the same console as CONFIGURATION: the site
 * identity and the room registry live here, and the SCAR·LET shell (elbow
 * ribbon + mobile bottom bar) renders from it. Adding a room = one entry;
 * rebranding the console = the theme.
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
  subs?: ConsoleRoomSub[];
}

/** The site this console administers — the way back out of the bridge. */
export const CONSOLE_SITE = {
  home: "/",
  domain: NIP05_DOMAIN,
  space: SPACE_NAME,
};

/**
 * The console is SCAR·LET — five rooms in the left elbow ribbon, each with its
 * accordion sub-nav. Accents honour the house colour law (gold = money ONLY):
 * pink = your action, neon = live/test, cyan = info/systems. STATUS leads (the
 * wireframe's landing room — its Reports sub-page is phase 2; Briefs is live).
 * Adding a room is still one entry; the ribbon, breadcrumb, readouts and
 * mobile bottom bar all render from this list.
 */
export const CONSOLE_ROOMS: ConsoleRoom[] = [
  {
    key: "status",
    href: "/a/briefs",
    label: "STATUS",
    short: "STATUS",
    blurb: "where everything stands — status reports + the briefs library",
    tone: "cyan",
    subs: [
      // the Status Reports board is cut in the approved wireframe — wired in phase 2
      { key: "reports", label: "STATUS REPORTS", href: "", soon: true },
      { key: "briefs", label: "BRIEFS", href: "/a/briefs" },
    ],
  },
  {
    key: "action",
    href: "/a",
    label: "ACTION ITEMS",
    short: "ACTION",
    blurb: "approvals + the decision board — everything that needs your signature",
    // pink = your action (the admiral rules here); not coin — gold = money only (Pac's house law)
    tone: "pink",
    subs: [
      { key: "approvals", label: "APPROVALS", href: "/a#approvals" },
      { key: "decisions", label: "DECISIONS", href: "/a#decisions" },
    ],
  },
  {
    key: "testing",
    href: "/a/testing",
    label: "BUG TESTING",
    short: "TESTING",
    blurb: "signed & shipped — test it live, work the board, read the ship's log",
    tone: "neon",
    subs: [
      { key: "inflight", label: "IN FLIGHT", href: "/a/testing#inflight" },
      { key: "roster", label: "DUTY ROSTER", href: "/a/testing#roster" },
      { key: "log", label: "SHIP'S LOG", href: "/a/testing#log" },
    ],
  },
  {
    key: "connections",
    href: "/a/connections",
    label: "CONNECTIONS",
    short: "CONNECT",
    blurb: "your nodes & doors — spaces · chat · mud · chain · torrents",
    tone: "cyan",
    subs: [
      { key: "spaces", label: "SPACES", href: "/a/connections#spaces" },
      { key: "chat", label: "CHAT", href: "/a/connections#chat" },
      { key: "mud", label: "MUD", href: "/a/connections#mud" },
      { key: "chain", label: "CHAIN", href: "/a/connections#chain" },
      { key: "briefs-src", label: "BRIEFS", href: "/a/connections#briefs" },
      { key: "deploy", label: "SHIP", href: "/a/connections#deploy" },
      { key: "torrents", label: "TORRENTS", href: "/a/connections#torrents" },
    ],
  },
  {
    key: "brand",
    href: "/a/brand",
    label: "DRESSING ROOM",
    short: "DRESSING",
    blurb: "brand cartridges + the cert foundry shelf — preview candidate looks",
    tone: "pink",
    subs: [
      { key: "certs", label: "CERT FOUNDRY", href: "/a/brand#certs" },
      { key: "tester", label: "BRAND KIT", href: "/a/brand#tester" },
    ],
  },
];

/**
 * Which room a console pathname lives in — exact room href first, then a sub
 * route (Briefs lives under STATUS), then the longest room-href prefix. "/a"
 * only matches exactly (every room shares it as a prefix).
 */
export function roomForPath(pathname: string): ConsoleRoom {
  const exact = CONSOLE_ROOMS.find((r) => r.href === pathname);
  if (exact) return exact;
  const bySub = CONSOLE_ROOMS.find((r) =>
    r.subs?.some((s) => !s.soon && s.href.split("#")[0] === pathname)
  );
  if (bySub) return bySub;
  const byPrefix = CONSOLE_ROOMS.filter(
    (r) => r.href !== "/a" && pathname.startsWith(`${r.href}/`)
  ).sort((a, b) => b.href.length - a.href.length)[0];
  return byPrefix ?? CONSOLE_ROOMS.find((r) => r.key === "action") ?? CONSOLE_ROOMS[0];
}
