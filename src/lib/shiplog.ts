/**
 * The ship's log — the daily work summaries, bulleted, riding the SCAR duty
 * roster (Pac, 2026-07-11: "send the logs like you do now, but added to the
 * roster"). Static and committed on purpose: every deploy carries its log,
 * the log survives every store, and the repo IS the record. Newest first.
 * Stamps are block heights — rendered in the BFT standard, marker assumed.
 */

export interface ShipLogEntry {
  height: number; // block at log time — BFT-stamped in the UI
  title: string;
  bullets: string[];
}

export const SHIP_LOG: ShipLogEntry[] = [
  {
    height: 957620,
    title: "THE DOOR GETS A GATE",
    bullets: [
      "/chat is the fren gate in front of the floor — signed-in frens bounce 307 to the configured chat node, anonymous visitors meet /login; the node URL is never exposed raw",
      "chat.frens.earth now points at THIS ship (DNS → the frens-earth Vercel project): the host's root rewrites to /chat so the gate runs before any door opens — the arcade redirects its chat host straight out, ours checks who's knocking",
      "No node linked? The gate says so honestly instead of chasing its own tail (the default still names the door domain itself)",
      "Console's OPEN THE CHAT ▸ goes through the gate too; parked for GLYPH: THE ARCADE STYLE BAND (orbee pixel critters + Spiral terminal magenta) and artist cards round 2 on the aceo 3D card tech",
    ],
  },
  {
    height: 957619,
    title: "THE FLOOR GETS A DOOR",
    bullets: [
      "CHAT room joins the console manifest — the deck and bridge rail pick it up from lib/console.ts, nothing re-coded",
      "/a/chat: point·save·test your orbee door (chatUrl in the nodeconfig store, dual-driver), honest REACHABLE/UNREACHABLE states, OPEN THE CHAT ▸ in a new tab",
      "Mirrors the arcade's lesson: orbee is the nostr NIP-29 floor and its domain is a DOOR, not an iframe — unset deployments fall back to the house floor at chat.frens.earth",
    ],
  },
  {
    height: 957580,
    title: "THE DAY THE EARTHSHIP CAME ALIVE",
    bullets: [
      "Production login raised from the dead — four causes deep (missing redeploy, misleading error copy, wrong signer profile, malformed operator npub); first successful login in frens.earth history, then the admiral himself walked in",
      "Round-2 stack shipped: earth-sprout brand, fork fixes, registry perf index, admin console (/a), tickets (/support + /a/scar), RTFM knowledge repo, instant-start template",
      "Cert cases forged: NES box art with rarity minted by Bitcoin time — grey/silver/GOLD (the Zelda)/crystal/astronomical",
      "SCAR merge queue armed: merges authorized by key signature, sha-bound, audit-logged; forged signatures refused",
      "Spaces console v2: URL boxes (point·save·test), the 🗑 for bad registrations, NODE/ANCHOR/CEREMONY tabs, welcome-letter config per POKE node",
      "Specs parked for GLYPH: the wardrobe (+ ADD A PORTAL), SCAR Fleet ranks (BLOCK→EPOCH→HALVING→ASTRONOMICAL ADMIRAL), the /bb wishlist",
      "The old calendar burned — dates and times read in blocks now",
    ],
  },
];
