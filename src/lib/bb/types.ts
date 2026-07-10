/**
 * Bitcoin Buddy (BB) — core types.
 *
 * BB is a token-based virtual pet that lives at frens.earth/bb (design notes:
 * C:\dev\pet-game-design-notes.md). A Buddy is CO-OWNED by a SET of nostr
 * pubkeys (the "dog collar", Part 6) — any fren on the collar can care for it,
 * and care actions are signed nostr events (NIP-07). Nothing here needs a
 * backend; the on-chain/nostr wiring comes later.
 *
 * ── Nostr event-kind plan (PROPOSED — not registered) ────────────────────
 * From the design notes Part 6 ("state as a nostr replaceable event") and the
 * open item "spec the nostr event kinds first". These numbers are placeholders
 * pending Pac's spec; see BB_EVENT_KINDS below. The intent:
 *
 *   • BUDDY_DEFINITION — addressable/replaceable (`d` = buddy id): the birth
 *     certificate. owners[] (npubs), name, bornBlock, on-chain biology traits.
 *   • BUDDY_STATE      — addressable/replaceable (`d` = buddy id): live vitals
 *     + last-fed block. Every fren's client recomputes the SAME stats
 *     deterministically from current block height — no trusted server.
 *   • CARE_ACTION      — regular event that a-tags the buddy: feed / play /
 *     talk, signed by ANY owner npub via NIP-07 (co-custody, Part 6).
 */

/** A nostr public key in npub bech32 form (`npub1…`). */
export type Npub = string;

/**
 * Life stages from the reference teardown (design notes Part 1). `ghost` is
 * the v2 afterlife on the "Before Bitcoin" negative-time chain (Part 4).
 */
export type BuddyStage = "baby" | "child" | "teen" | "adult" | "ghost";

/** The three 0–100 vitals (design notes Part 1). Any hitting 0 = death. */
export interface BuddyVitals {
  hunger: number;
  happiness: number;
  energy: number;
}

/** A Bitcoin Buddy — a co-custodied virtual pet. */
export interface Buddy {
  /** Stable id — the ordinal inscription id once minted; a local id before. */
  id: string;
  /** The minted collar name, e.g. `petname.bb@frens.earth` (design notes Part 6). */
  name: string;
  /**
   * Co-custody: the SET of nostr pubkeys allowed to care for this buddy.
   * Reuses the door-switcher / add-2nd-key `npubs[]` shape.
   */
  owners: Npub[];
  /** BFT block height at birth — the pet's on-chain birthday (design notes Part 3). */
  bornBlock: number;
  /** Current life stage; derived from age but cached for quick reads. */
  stage?: BuddyStage;
  /** false once it dies of neglect → gravestone (design notes Part 4). */
  alive?: boolean;
}

/**
 * PROPOSED nostr event kinds for BB (see the plan comment above). No kind is
 * registered yet — do not treat these as final. Kept in the addressable
 * (30000–39999) / regular (1000–9999) ranges so state events replace cleanly.
 */
export const BB_EVENT_KINDS = {
  /** Birth certificate — addressable/replaceable, `d` = buddy id. */
  BUDDY_DEFINITION: 31337,
  /** Live vitals + last-fed block — addressable/replaceable, `d` = buddy id. */
  BUDDY_STATE: 31338,
  /** A single care action, signed by an owner via NIP-07. */
  CARE_ACTION: 1337,
} as const;

/** A care action a fren can take on a buddy (design notes Part 1). */
export type BuddyCareAction = "feed" | "play" | "sleep" | "talk";

/**
 * Shape of a CARE_ACTION before signing — the payload the app hands to
 * `window.nostr.signEvent` (block-timed so every client agrees on cooldowns).
 */
export interface BuddyCareEventDraft {
  kind: typeof BB_EVENT_KINDS.CARE_ACTION;
  /** The buddy this action targets (its `id`). */
  buddyId: string;
  action: BuddyCareAction;
  /** Block height the action was taken at — drives the shared cooldown (Part 2). */
  atBlock: number;
}
