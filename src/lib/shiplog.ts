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
    height: 957634,
    title: "THE BUDDY WAKES UP",
    bullets: [
      "/bb action buttons fixed — root cause was TWO CLOCKS: doAction stamped reactions in Date.now() epoch ms while the canvas loop compared them against the requestAnimationFrame timestamp (performance.now() timebase, ~57 years apart), so the sprite sat 'reacting' forever at progress 0 — no animation, idle dance suppressed, buttons read dead. One clock now; talk gained a sway + a small happiness lift so every action moves a stat, shows on the sprite, and persists",
      "The moon stops lying — the device footer hardcoded a 🌙 crescent glyph beside the real phase NAME, so mid-month it read '🌙 Full'. Now glyph + name + BFT day render from one source of truth (D15 🌕 Full today); the helper mapping verified honest: day 1 = 🌑 New, mid-month = 🌕 Full",
      "The garden behind the buddy is now BFT-procedural — everything seeded from the chain: the beat (0–143) sets dawn/day/dusk/night light, the moon phase draws the moon and brightens the night, the 13 months turn a seasonal palette wheel, the year-animal hangs as a faint constellation, the hills reseed on every block, and a soft shimmer sweeps the scene when the block breaks (tip polled each minute, the BftClock cadence)",
      "Scene cached per block into an offscreen canvas (the /bb perf lesson, one level up) — the rAF loop only blits; honors prefers-reduced-motion; heights render the honest ~ when the tip is an offline estimate; night-garden palette only, no gold — no money on this screen",
    ],
  },
  {
    height: 957627,
    title: "THE FLEET WEARS YOUR NAME",
    bullets: [
      "RTFM 004 shipped — Wear Your Own Name: the two door patterns (the arcade's straight redirect vs our gated rewrite, DNS steps for both), running + branding your own orbee floor (verified against imperviousinc/orbee: station names are runtime config, the app's skin is a fork — no docker in that repo, honest flag raised; Apache-2.0 fork route documented), and one fleet, many doors via /a/chat",
      "Scope grew mid-voyage on the admiral's order: THE WHOLE FLEET WEARS YOUR NAME — masking table for every tool in the suite (orbee, Matrix classrooms, the MUD, BTCPay, the spaced node, RTFM, the console); Matrix headline verified: server_name is a tattoo (set once, forever), Element re-brands by config.json alone — the arcade's portal cabinet is the live proof",
      "NUMBER ONE ON THE FLOOR spec parked at docs/number-one-bridge.md — @no1 gets its own key ceremony (never the admiral's key), a VPS bridge daemon, speaks-only-when-spoken-to rules, operator mute, three phases (presence → mention-reply → SCAR announcements), staff-meeting questions listed",
      "RTFM 005 commissioned: CLASSROOM SETUPS & MANAGEMENT — the Matrix homeserver drill",
    ],
  },
  {
    height: 957625,
    title: "THE TREASURY RESCUE DRILL",
    bullets: [
      "RTFM 003 shipped — Treasury Rescue: the BTCPay damage-control playbook, written from the admiral's live drill (locked himself out on purpose, then found the treasury reading 0 with confirmed sats on the chain)",
      "Phase A: back into a locked panel via SSH — btcpay-admin.sh reset-server-policy → rescue account → set-user-admin, plus the prevention kit (second admin, SMTP, recovery codes off-box)",
      "Phase B: the sats-not-moving diagnosis ladder — mempool.space → getblockchaininfo (blocks vs headers) → lightning getinfo → rescan LAST; the sats were never gone, the node was mid-book",
      "Phase C: the standing sync runbook — docker logs, df -h (the lifetime-VPS silent killer), restart sequence smallest-hammer-first, reindex only when the logs say so, and the ten-minute monthly drill box",
      "SCAR ops todos opened (docs/ops-todos.md): DR debrief + playbook adoption, and lightning sync on the VPS with the block height reported back — commands verified against docs.btcpayserver.org",
    ],
  },
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
    height: 957618,
    title: "THE ARTIST DOOR OPENS",
    bullets: [
      "Artist Registry shipped (/artist) — the brand kit's sibling to the tag claim: request your name on the Spaces protocol, read the live auction board, watch names per-npub",
      "Gated behind the artist-training entitlement — operator-editable npub roster (ARTIST_NPUBS bootstrap), with the honest LEVEL LOCKED screen for everyone else",
      "Every auction surface degrades honestly: no node → says so, node down → says why, never a fake board",
      "Request lifecycle laid down: REQUESTED → AUCTION → WON/LOST → ANCHORED; the crew bids from the node wallet — keys never touch the app",
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
