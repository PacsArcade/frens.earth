/**
 * Client-safe npub-door helpers. Mirrors NPUB_SPACE in src/lib/fren-auth.ts
 * — that module is server-only (node crypto), so the space name is restated
 * here for the header chip, menu, /me and the npub profile page (the same
 * reason MePanel restates MAX_SESSIONS). Keep the two in sync.
 */

export const NPUB_DOOR_SPACE = "npub";

export function isNpubDoorSpace(space: string): boolean {
  return space === NPUB_DOOR_SPACE;
}

export const NPUB_RE = /^npub1[02-9ac-hj-np-z]{58}$/;

/** npub1abcd…wxyz — enough to recognize, short enough for a marquee. */
export function shortNpub(npub: string): string {
  if (npub.length <= 14) return npub;
  return `${npub.slice(0, 9)}…${npub.slice(-4)}`;
}
