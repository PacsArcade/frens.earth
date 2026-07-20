# The Operator Console — a module, not furniture

*Declared 0018.04.15 a₿ (Pac): the console is a GENERAL FRAMEWORK to template
when building sites from this repository. First consumers besides
frens.earth: **pacsarcade-org** and **onecocreation**.*

## The SCAR·LET shell

Everything behind `/a` wears the approved SCAR·LET LCARS shell (design
source: the signed-off `scar-lcars-wireframe`), mounted once by
`src/app/a/layout.tsx` after the operator key clears:

- **`ConsoleShell`** (`components/console/`) — the frame: the sticky top bar
  (breadcrumb + `SCAR 0x/05` readout; `◉ HOME` on the Overview), the footer
  brandline (the ONE brand statement per page), and the Option-B mobile
  chrome — a persistent bottom elbow bar (room · readout · tray-clock) whose
  ▲ MENU raises the ribbon as a bottom sheet.
- **`ScarRail`** — the elbow RIBBON: ⌂ site-exit elbow, the ◗ SCAR·LET brand
  block (opens the Overview front page and lights up while you're home), the
  room blocks (the five v2 decks, plus honest SOON berths for registered-but-
  unlanded rooms), the ship-node block, and the active room's **progressive accordion** — room
  enter shows level 1 only; a level-1 item with children opens its level-2
  filter rail only when clicked. Sub-items with a `countKey` wear a
  label-left / count-right pill (uniform min-width) fed by ONE read of
  `/api/admin/counts`, so the rail and the boards always agree.
- **`BftTrayClock`** — the ONE BFT tray-clock (ribbon foot on desktop, bottom
  bar on mobile): hh:mm:ss over yyyy.mm.dd from `lib/bb/bft` (never
  reimplemented), the ★-box block height through the fleet's own door, the
  a₿ era marker.
- **`ReaderDrawer`** (`ScarConsole`) — the shared right-side READER: closed
  by default, opens top-aligned on selecting a board item, ⤢ EXPAND fills
  the board area (the ribbon stays), ✕/Escape closes. Reused by sign-offs,
  status reports, and the briefs library.

The colour law is strict everywhere in the shell: **gold/coin = MONEY only**
(plus the BFT clock's coin tint), neon = live, cyan = info, ghost = danger,
pink = your-action/flair. The structural frame itself is muted ops-green.

## The rooms — the five decks of SCAR Console v2 (0018.04.24 a₿)

The registry wears the canonical SCAR Console v2 chart; the boards and
routes underneath are unchanged.

| deck | route(s) | what it is |
|---|---|---|
| **Overview** (◉ HOME) | `/a` | the CALM front page the ◗ SCAR·LET block opens — site health (live tip, nodes wired), the needs-you counts (each a door), first-captain onboarding |
| **01 Bridge** | `/a/status` + `/a/briefs` | where everything stands: in-flight (now/next/later) + sign/review/vote aggregated live from the boards, stat-card filters, reader drawer; the briefs library beside it |
| **02 Duty Roster** | `/a/action` + `/a/testing` | the signature desk (sign-offs `#signoffs` · merge→ship approvals `#approvals` · decisions `#decisions`) + the **crew board** (in-flight testing, tickets, the restored **rank track** `#rank`, the ship's log) |
| **03 Simulator** | `/a/sim` | the SIM DECK — the door to the operator's own P.O.K.E. MUD node (play money only; honest empty state when none is linked); TRAINING MODULES is an honest SOON berth |
| **04 Bot Deck** | `/a/bots` | PACBOT · POKE-ENGINEER · POKE-COUNSEL · ARCHITECT as honest OFF berths — owner-toggled add-ons, wired only when the swarm-carrying node links |
| **05 Fleet Map** | `/a/connections` + `/a/brand` | the nodes & doors — spaces · chat · mud · chain · briefs · ship · torrents — plus the Dressing Room (brand cartridges + the cert foundry) as the verse-identity berth |
| *(store)* | `/a/store` | soon-flagged berth held for the storefront module building on its own slip |

## The header tweaks + the ship node (the restored trio)

- **Theme seam** — Pac's Arcade (default) ↔ **LCARS tribute**, toggled in
  the top bar: a token-level remap on `data-console-theme` (palette,
  condensed faces, matte glows, round corners) — never a markup fork.
- **Sounds** — the v2 WebAudio bleeps (tab tick · coin · buzz), DEFAULT
  OFF, persisted per browser; the SND-ON flip confirms itself audibly.
- **Rank chip** — the operator's office/ladder rank in the top bar, one
  read of `/api/admin/rank`; opens the crew board's rank track (tenure in
  blocks since the tag claim → the SCAR fleet ladder; points = logged
  resolutions; commendations = the duty roster's own resolved counts).
  Honor-only, pink, never coin gold.
- **Ship node block** — `NODE: EARTHSHIP-01` in the ribbon foot
  (`NEXT_PUBLIC_NODE_NAME` — config, not code) with the officers per the
  admiral's binding identity ruling: **pacster@pacsarcade is THE ADMIN;
  pacster@frens.earth is THE CAPTAIN** (display/copy only — the key stays
  the operator; the prototype's un-owned ops alias appears nowhere).

## What the module is

Everything behind `/a`, as one portable layer:

| piece | file(s) | configured by |
|---|---|---|
| the gate (key-is-the-operator) | `OperatorGate`, `lib/operator-auth` | `OPERATOR_NPUBS`, `SEAT_SECRET` |
| the SCAR·LET shell | `components/console/*`, `app/a/layout` | **`lib/console.ts` — the manifest** |
| room registry + accordion (+ counts keys) | `CONSOLE_ROOMS`, `CONSOLE_OVERVIEW` in `lib/console.ts` | add/remove entries |
| site identity (the ⌂ way out) | `CONSOLE_SITE` | `NEXT_PUBLIC_NIP05_DOMAIN` / `SPACE_NAME` |
| the count pills | `app/api/admin/counts` | cheap store reads only — no GitHub calls |
| status reports | `StatusReportsPanel`, `lib/status-flight` | `SEED_FLIGHT` (committed); the rest reads the live boards |
| sign-offs (cross-project approvals) | `SignoffsPanel`, `lib/signoffs` | `SEED_SIGNOFFS` (committed); works with zero infra |
| tickets (raise/work) | `TicketsPanel`, `lib/tickets` | works with zero infra |
| decisions (pending rulings → action cards) | `DecisionsPanel`, `lib/decisions` | `SEED_DECISIONS` (committed); works with zero infra |
| merge queue (sign to authorize) | `MergeQueue`, `lib/merges` | `GITHUB_TOKEN`, `GITHUB_REPO` |
| briefs library (reviewable tickets) | `BriefsPanel`, `lib/briefs` | sources set in Connections |
| node links (spaced / MUD) | `SpacesPanel`, `MudPanel`, `lib/nodeconfig` | from the GUI |
| chat floor (the orbee door) | `ChatPanel`, `lib/nodeconfig` | from the GUI; falls back to `CHAT_NODE_URL`, then chat.frens.earth |
| chain node (block tip + mempool fill) | `MempoolPanel`, `app/api/chain/tip`, `lib/nodeconfig` | from the GUI; falls back to `MEMPOOL_NODE_URL`, then public mempool.space |
| the chat gate (public side) | `app/chat/route.ts` + `next.config.ts` rewrite | fren session required — see below |
| notifications | `Notice` | per-id, drop in anywhere |
| ship's log | `ShipsLog`, `lib/shiplog` | committed entries |
| time | `lib/bb/bft` + `docs/bft-display.md` | the standard |

## The signed-action model

Every approval is a nostr event the operator key signs locally (nsec never
leaves the device), verified server-side on the same ladder — shape →
freshness (5-minute window) → operator allowlist → schnorr signature — then
recorded **block-stamped** (the block is the record). Action strings:

- merges: `PACS-MERGE-<pr>-<headSha>-<ts>` · deploys: `PACS-DEPLOY-…`
- briefs: `PACS-BRIEF-<tier>-<slug>-<ts>-<signoff|sendback>`
- sign-offs: `PACS-SIGNOFF-<id>-<ts>-sign` (+ `\n<comment>` — the signature
  covers the comment's exact words)

Stores follow the per-entry-blob rule (one blob per ruling/review/sign-off)
so eventually-consistent reads can never clobber a sibling record.

## The chat door — gated, never raw (0018.04.15 a₿)

The floor is for signed-in frens; the node URL is never exposed to the
anonymous public. `/chat` (`src/app/chat/route.ts`) is the gate: a fren
session (`frenFromRequest`) bounces you 307 on to the configured chat node
(`effectiveChatNode()`); no session lands you on `/login`. If no real node is
linked (the default still points at the door domain itself), the gate says so
honestly instead of chasing its own tail.

**DNS: `chat.frens.earth` must point at the frens-earth Vercel project** —
not at orbee. `next.config.ts` rewrites that host's root to `/chat` so the
gate runs before any door opens. (The arcade redirects chat.pacsarcade.org
straight out to orbee; ours goes through the gate on purpose.) Every door in
the UI — the console's OPEN THE CHAT ▸ included — links `/chat`, never the
raw node.

## How a templated site gets its console

1. Fork/template this repo (`npm install && npm run dev` is the install).
2. Set the env identity (`NEXT_PUBLIC_SPACE_NAME`, `NEXT_PUBLIC_NIP05_DOMAIN`,
   `OPERATOR_NPUBS`, `GITHUB_REPO`) — the ⌂ exit, the breadcrumb, and the
   merge queue follow automatically.
3. Edit `CONSOLE_ROOMS` for the site's rooms (drop MUD, add your own) — the
   ribbon, accordion, readouts, and mobile bottom bar all render from it.
4. The brand cartridge (docs/brand-cartridge.md) re-skins the whole console.

## Modularization ledger — what's done, what's next

- ✅ Rooms + site identity → the manifest (`lib/console.ts`); the SCAR·LET
  shell renders from it; the ⌂ exit derives from env.
- ✅ Phase 2: Overview front page · Status Reports · the reader drawer ·
  count pills + stat-card filters · cross-project sign-offs.
- ⏳ Phase 3: in-flight reorder/repriority from the GUI (needs a store
  write) · stat-card filters on Action Items/Testing · a "your call" bucket
  when it has a real source · sweep the room panels' `FRENS.EARTH` kicker
  strings onto `CONSOLE_SITE.domain`.
- ⏳ Extract to a package (with arcade-ui) once both consumer sites exist —
  until then the template IS the distribution.
