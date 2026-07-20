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
    height: 958910,
    title: "THE CONSOLE WEARS THE V2 CHART",
    bullets: [
      "SCAR Console v2 ported onto the SCAR·LET shell — the five decks land as the room registry (BRIDGE · DUTY ROSTER · SIMULATOR · BOT DECK · FLEET MAP) over the same boards and routes; the Overview stays the calm front page; a soon-flagged STORE berth holds the slip for the storefront build landing in parallel",
      "The lost trio restored: RANK TRACK on the crew board (registry claim → Bitcoin-time tenure → the SCAR fleet ladder; points = your logged resolutions; commendations = the duty roster's own resolved counts, honest crew:prefix until crew link their tags) plus the header rank chip · the SOUNDS button (the v2 WebAudio bleeps — tab tick, coin, buzz — DEFAULT OFF, your call always) · the SHIP NODE block (NODE: EARTHSHIP-01 — the name is config, not code)",
      "The v2 theme seam in the header: Pac's Arcade (default) ↔ LCARS tribute — a token-level remap on data-console-theme (palette, condensed faces, matte glows, round corners), never a markup fork. Officers named per the admiral's binding ruling: pacster@pacsarcade is THE ADMIN, pacster@frens.earth is THE CAPTAIN — display only, never auth; the un-owned @pacsarcade-ops appears nowhere",
      "Dead-pill sweep passed: every visible affordance behind /a resolves — a real link, a real action, or an honest disabled SOON berth (training modules, bot toggles, torrents, store). The SIM DECK fronts the operator's real MUD node or says plainly that none is linked; the console never fakes a battle terminal",
    ],
  },
  {
    height: 957728,
    title: "THE BRIEFINGS GROW A BUTTON",
    bullets: [
      "The admiral's ask, actioned (0018.04.16 a₿: the briefings are good data but 'i wish it was actionable — i want to be prompted with the actions, and some recommendations, all from the web GUI'). New DECISIONS room at /a/decisions: the pending rulings surface as ACTION CARDS — the question big, the context line, the options as selectable chips, and one click to record. No more reading a briefing and wondering what to do with it",
      "Number One recommends on every card: the recommended option wears a ✦ RECOMMENDED badge in neon with a plain-words why, so the call comes with a reason attached. Ten rulings seeded (THE DESK's name, the arrow law, the satoshi mark, the BFT README front door, the historian's name, the flagship format, ranks & access, onecocreation, the media-page money gold, the beat-index canon) — each carrying its recommendation, committed as defaults so the board stands up with zero infra",
      "lib/decisions is the ship's-log pattern turned interactive: SEED_DECISIONS are committed (the board IS the record), and a recorded choice is the only thing that hits a store — dual-driver like tickets (Vercel Blob in prod, data/decisions.json in dev, gitignored). recordDecision validates the choice against the decision's own options and block-stamps it; listDecisions merges the recorded rulings over the seeds. Operator-cookie-gated both ways at /api/admin/decisions",
      "Decided rulings collapse into a BFT-stamped list (the block IS the timestamp); honest empty state when the board's clear ('no decisions waiting 🌱'). Registered on the console manifest, so the deck card + bridge rail picked it up with no re-code — the module pattern holding",
    ],
  },
  {
    height: 957661,
    title: "COPY A ₿ WITHOUT LEAVING HOME",
    bullets: [
      "MEDIA / ASSETS page shipped (/media) — the emojipedia replacement, but ours: one-click copy for the house bitcoin glyphs (₿ U+20BF, the SATOSHI mark, the BFT markers a₿ / b₿ / ▣, and ⚡ lightning), the frens.earth mark (view · DOWNLOAD SVG · COPY SVG straight from public/frens-mark.svg), the FRENS.EARTH wordmark in the house pixel type, the night-garden palette as click-to-copy hex swatches, and a press one-liner + short paragraph for anyone writing about us — every button an honest COPIED ✓ (and a truthful COPY FAILED when the clipboard is blocked), motion-safe, mobile-first, no wireframe arrows",
      "Gold stayed money-only, enforced: coin gold rides ONLY the ₿ and the sat mark (sats ARE money); the a₿ / b₿ / ▣ markers wear cyan because they're TIME not money, and ⚡ wears neon as the live rail — the palette shows every hex but labels coin 'money ONLY'",
      "The house SATOSHI mark lands as a PROPOSAL — Candidate A, 'the struck ess' (a lowercase gold s pierced by ₿'s two hash-bars), composited inline because there is no Unicode codepoint for the satoshi (only ₿ was ever encoded); clearly badged 'house proposal — pending the admiral's pick' among four candidates, with the honest copyable value being the text fallback 'sats' — the word wallets already print",
      "Discoverable-not-loud: a small MEDIA / PRESS link tucked into EarthFooter. Shipped onto a main a bad merge broke earlier today — branched clean off the healed origin/main, tsc --noEmit green",
    ],
  },
  {
    height: 957660,
    title: "THE FLEET STOPS PHONING OUT",
    bullets: [
      "The admiral's sovereignty fix — the fleet hardcoded mempool.space for the block tip + mempool fill; chain data is now read through a CONFIGURABLE node. effectiveMempoolNode() resolves stored (mempoolUrl, GUI-editable) → env (MEMPOOL_NODE_URL) → the public mempool.space, with an honest source: 'default' that tells exactly when we're still phoning a third party",
      "One door for the whole fleet: /api/chain/tip (public, read-only) reads the configured node's /api/blocks/tip/height + /api/mempool, falls back to mempool.space server-side if the node's dark, and returns { ok:false } on total failure so the client keeps its genesis estimate (the honest ~). currentBlock() (bft.ts), the BftClock ring fill, /bb (BbConsole + BuddyDevice ride currentBlockInfo), and the tag-claim tip all route through it; the server-side claim route reads effectiveMempoolNode() directly",
      "New CHAIN NODE room on the console manifest (/a/mempool) — POINT · SAVE · TEST, the same rail as chat/spaces/mud; honest 'using the public mempool.space (fallback) — point your own below', REACHABLE/UNREACHABLE pills, the live tip + a BFT ~ stamp on the test, and no token (read-only public chain data, no key ever touches it)",
      "Left as TODO: FrenProfile's timestamp→height backfill hits a different mempool.space endpoint the tip proxy doesn't serve yet — a low-stakes best-effort read, noted in place. ops-todos opened: self-host mempool.space on the VPS against our own bitcoind, skin it in Pac's Arcade branding, point mempoolUrl at it — then the fleet stops phoning out for good",
    ],
  },
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
