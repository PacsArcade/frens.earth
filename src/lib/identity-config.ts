/**
 * Identity domain configuration.
 *
 * The registration page is one shareable machine that adapts to the domain
 * serving it: players claim @frens tags on frens.earth, campaign artists claim
 * @pacsarcade tags on pacsarcade.org. Add a row here for every space we own.
 * Env vars remain as fallbacks for local dev and one-off deployments.
 */
export const NIP05_DOMAIN =
  process.env.NEXT_PUBLIC_NIP05_DOMAIN ?? "frens.earth";

export const SPACE_NAME = process.env.NEXT_PUBLIC_SPACE_NAME ?? "frens";
export const SPACE_TAG = `@${SPACE_NAME}`;

/**
 * Anchor ceremony ETA in blocks — "seven ate nine", about seven weeks. The
 * one source for the registration success screen and every profile badge:
 * estimated anchor block = current tip + ANCHOR_BLOCKS_OUT.
 */
export const ANCHOR_BLOCKS_OUT = 6789;

export interface SpaceConfig {
  space: string;
  nip05Domain: string;
}

export const SPACE_HOSTS: Record<string, SpaceConfig> = {
  "frens.earth": { space: "frens", nip05Domain: "frens.earth" },
  "www.frens.earth": { space: "frens", nip05Domain: "frens.earth" },
  "pacsarcade.org": { space: "pacsarcade", nip05Domain: "pacsarcade.org" },
  "www.pacsarcade.org": { space: "pacsarcade", nip05Domain: "pacsarcade.org" },
  // Degen Wonderland — @degen tags on degenwonderland.com (themeable sign-in).
  "degenwonderland.com": { space: "degen", nip05Domain: "degenwonderland.com" },
  "www.degenwonderland.com": { space: "degen", nip05Domain: "degenwonderland.com" },
};

/**
 * Every space that may have a claim registry on this deployment: the spaces
 * mapped in SPACE_HOSTS, plus the configured SPACE_NAME. Deriving this (rather
 * than hardcoding a list) is what lets a FORK work — a fork sets
 * NEXT_PUBLIC_SPACE_NAME to its own space, and if that space isn't in this set
 * `findHandleByNpub` never scans it, so returning sign-in silently fails.
 * SPACE_NAME goes first so the host's own space is checked first.
 */
export const KNOWN_SPACES: readonly string[] = Array.from(
  new Set<string>([SPACE_NAME, ...Object.values(SPACE_HOSTS).map((c) => c.space)])
);

export function spaceForHost(host?: string | null): SpaceConfig {
  const h = (host ?? "").toLowerCase().split(":")[0];
  return SPACE_HOSTS[h] ?? { space: SPACE_NAME, nip05Domain: NIP05_DOMAIN };
}

/** The canonical domain for a space — the reverse of SPACE_HOSTS. */
export function domainForSpace(space: string): string {
  for (const cfg of Object.values(SPACE_HOSTS)) {
    if (cfg.space === space) return cfg.nip05Domain;
  }
  return NIP05_DOMAIN;
}

/** What each door is for — the two-door model, config not copy. */
export const SPACE_ROLES: Record<string, string> = {
  frens: "PLAY",
  pacsarcade: "SCHOOL",
  degen: "WONDER",
};
