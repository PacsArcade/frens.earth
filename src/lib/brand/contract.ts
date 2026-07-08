/**
 * Brand contract — the injectable theme a consumer app hands the sign-in.
 *
 * The sign-in package (TagClaim / LoginPanel / the ceremony dialogs) renders
 * itself entirely through CSS custom properties and a small copy object. One
 * package therefore serves frens.earth, pacsarcade.org and degenwonderland.com
 * — each passes its own `BrandTheme` and the same components render in its
 * colors, fonts and words. Nothing here is signer-specific: the flow stays
 * signer-agnostic NIP-07 (nos2x / Alby today, Arcade Signer later).
 *
 * Three layers of a brand:
 *   1. tokens — the color surfaces + accents (become CSS variables)
 *   2. fonts  — the three type roles (become CSS variables)
 *   3. copy / doors / roleLabels — the words and information architecture
 */

/**
 * Color slots. Surfaces (void/panel/edge) and the flair accent (pink) are the
 * two knobs an arcade owner already gets via arcade-ui `data-arcade-theme`.
 * The four semantic hues (coin/neon/cyan/ghost) are LOCKED for arcade-family
 * brands (money / live / info / danger) — see arcade-ui THEMING.md — but a
 * non-arcade brand such as Degen Wonderland may re-map them to its own palette.
 * The legacy base vars drive the shared `.button` and page background.
 */
export interface BrandTokens {
  // surfaces
  void: string;
  panel: string;
  edge: string;
  // semantic accents (arcade contract: money / live / info / danger)
  coin: string;
  neon: string;
  cyan: string;
  ghost: string;
  // flair accent (the one freely-moving accent)
  pink: string;
  // legacy base (arcade-ui globals: body + .button)
  background: string;
  foreground: string;
  primary: string;
  secondary: string;
  border: string;
  accent: string;
}

export interface BrandFonts {
  /** Display / marquee face → --font-arcade */
  arcade: string;
  /** Pixel label face → --font-pixel */
  pixel: string;
  /** Body copy face → --font-body */
  body: string;
  /**
   * Optional override for the shared `.button` face. arcade-ui's `.button`
   * reads --font-press-start directly; leave undefined to keep the host's
   * next/font value (frens), set it to re-face buttons for a non-arcade brand.
   */
  button?: string;
}

/** Which semantic accent tints a door card (kept to the locked palette so
    Tailwind can generate the static classes). */
export type DoorAccent = "cyan" | "pink" | "coin" | "neon";

/** A "character-select" door on the sign-in — data, not hard-coded JSX. */
export interface BrandDoor {
  /** e.g. "@FRENS" */
  tag: string;
  /** e.g. "THE PLAY ACCOUNT" */
  role: string;
  blurb: string;
  href: string;
  cta: string;
  accent: DoorAccent;
}

/** The brand words the sign-in surfaces. Auth/protocol strings (the
    PACS-LOGIN challenge, event kinds) are NOT here — those are shared wire
    constants, not branding. */
export interface BrandCopy {
  productName: string;
  /** "fren" / "degen" — the member noun used throughout. */
  memberNoun: string;
  loginKicker: string;
  loginTitle: string;
  returningTitle: string;
  returningBlurb: string;
  signInCta: string;
  signingCta: string;
  doorsHeading: string;
  doorsFootnote: string;
}

export interface BrandTheme {
  /** Stable id, also emitted as data-brand for CSS/debug hooks. */
  id: string;
  label: string;
  tokens: BrandTokens;
  fonts: BrandFonts;
  copy: BrandCopy;
  doors: BrandDoor[];
  /** SPACE_ROLES labels this brand owns (space id → door role, e.g. PLAY). */
  roleLabels: Record<string, string>;
}
