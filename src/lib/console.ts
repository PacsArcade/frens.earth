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

export const CONSOLE_ROOMS: ConsoleRoom[] = [
  {
    key: "scar",
    href: "/a/scar",
    label: "SCAR",
    blurb: "the duty roster — tickets, merges, the ship's log",
    accent: "border-coin/50 text-coin",
  },
  {
    key: "spaces",
    href: "/a/spaces",
    label: "SPACES NODE",
    blurb: "connect spaced · queue · anchor ceremony",
    accent: "border-neon/50 text-neon",
  },
  {
    key: "mud",
    href: "/a/mud",
    label: "MUD NODE",
    blurb: "point at your P.O.K.E. node — test — verified",
    accent: "border-cyan/50 text-cyan",
  },
  {
    key: "brand",
    href: "/a/brand",
    label: "DRESSING ROOM",
    blurb: "brand cartridges — preview candidate looks",
    accent: "border-pink/50 text-pink",
  },
];
