import { NIP05_DOMAIN, SPACE_NAME } from "./identity-config";

/**
 * The operator console manifest — the console is a MODULE, not frens.earth
 * furniture (Pac, 2026-07-11). Sites templated from this repo (pacsarcade-org,
 * onecocreation, every fork) get the same console as CONFIGURATION: the site
 * identity and the room registry live here, and AdminNav + the deck render
 * from it. Adding a room = one entry; rebranding the console = the theme.
 */

export interface ConsoleRoom {
  key: string;
  href: string;
  label: string;
  blurb: string;
  /** house accents — semantic contract colors */
  accent: string;
}

/** The site this console administers — the way back out of the bridge. */
export const CONSOLE_SITE = {
  home: "/",
  domain: NIP05_DOMAIN,
  space: SPACE_NAME,
};

/**
 * The console is SCAR — five tabs, collapsed from the old eight rooms. The
 * land page (/a) is ACTION ITEMS. Accents honour the house colour law (gold =
 * money ONLY, so no coin here): pink = your action, neon = live/test, cyan =
 * systems. Adding a tab is still one entry; AdminNav + the tabs render from
 * this list, and each tab's `key` is what its page passes to AdminNav.
 */
export const CONSOLE_ROOMS: ConsoleRoom[] = [
  {
    key: "action",
    href: "/a",
    label: "ACTION ITEMS",
    blurb: "approvals + the decision board — everything that needs your signature",
    // pink = your action (the admiral rules here); not coin — gold = money only (Pac's house law)
    accent: "border-pink/50 text-pink",
  },
  {
    key: "testing",
    href: "/a/testing",
    label: "BUG TESTING",
    blurb: "signed & shipped — test it live, work the board, read the ship's log",
    accent: "border-neon/50 text-neon",
  },
  {
    key: "connections",
    href: "/a/connections",
    label: "CONNECTIONS",
    blurb: "your nodes & doors — spaces · chat · mud · chain · torrents",
    accent: "border-cyan/50 text-cyan",
  },
  {
    key: "brand",
    href: "/a/brand",
    label: "DRESSING ROOM",
    blurb: "brand cartridges + the cert foundry shelf — preview candidate looks",
    accent: "border-pink/50 text-pink",
  },
  {
    key: "briefs",
    href: "/a/briefs",
    label: "BRIEFS LIBRARY",
    blurb: "the design briefs as reviewable tickets — read, comment, sign off (private)",
    // cyan = systems/reference (the library surface); gold = money only (Pac's house law)
    accent: "border-cyan/50 text-cyan",
  },
];
