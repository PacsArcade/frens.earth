# The Artist Registry — the brand kit's artist door (`/artist`)

*Written 0018.04.15 a₿. Ships in the Pac's Arcade **branding kit / artist
training package** — this module is how a trained artist gets their name onto
the Spaces protocol, the same way `/` is how a fren gets their tag.*

## What it is

The "claim your fren tag" machine has a sibling for **artists**. A fren claims
a *subspace* (`alice@frens`); an artist who's been through the training package
requests a **top-level space** (`@alice`) — a name auctioned on Bitcoin via the
[Spaces protocol](https://spacesprotocol.org). One page, three surfaces:

1. **REQUEST** — ask for your name. A request is a **queue entry**, never an
   on-chain action from this app.
2. **AUCTION BOARD** — the open/rolling space-name auctions, read live from
   this deployment's own `spaced` node.
3. **WATCH YOUR NAME** — a per-npub watchlist that follows the artist's key
   across machines and sessions.

## The gate — the training-package entitlement

v1 entitlement = **a fren session whose npub is on the artist roster**:

- The roster is **operator-configurable**: `GET/PUT /api/admin/artists`
  (operator session), stored dual-driver like every other config — Vercel Blob
  (`artist/roster.json`) in prod, `data/artists.json` in dev. `ARTIST_NPUBS`
  (comma-separated env) stays as the bootstrap fallback so a fresh fork works
  from `.env` alone; the stored roster wins once set (the nodeconfig pattern).
- Gate order on `/artist`: signed out → sign-in nudge · signed in but not on
  the roster → the honest **"🔒 LEVEL LOCKED — the artist training package
  opens this door"** screen (the house level-locked pattern; no fake preview,
  no teaser data) · on the roster → the registry.
- Every `/api/artist/*` route re-checks the gate server-side
  (`artistFromRequest` in `src/lib/artist.ts`): 401 without a session, 403
  without the entitlement. The client screens are a courtesy; the API is the
  gate.

Later rounds can swap "npub on a list" for a real training credential (a
signed cert from the training package) without touching the surfaces — the
gate is one function.

## The Spaces auction flow

```
artist                       crew / operator                Bitcoin
  │ REQUEST @name  ──────▶  request queue (SPC-0001)
  │                          │ open/bid from the NODE WALLET
  │                          ▼
  │                        AUCTION ── highest bid at close wins
  │   watches the board      │
  │                          ├── WON  ──▶ ANCHORED (on-chain, permanent)
  │                          └── LOST ──▶ name goes to the winner; re-request later
```

- **Request** — the artist files `@name` (+ an optional note). Stored on the
  request board with the bitcoin tip stamped (`blockHeight`), status
  `requested`.
- **Auction** — the crew opens the auction / places the bid **from the spaced
  node's own wallet**. Keys never touch this web app (house law: keys never
  leave the signer; the wallet lives on the node). Spaces are auctioned on
  Bitcoin — the protocol rolls names toward auction windows, highest bid at
  close takes the name.
- **Won / lost** — the outcome flips the request's status (with the txid when
  there is one). `updateRequestStatus()` in `src/lib/artist.ts` is the one
  sanctioned flip; the operator GUI for it is round 2.
- **Anchored** — the name is on-chain and permanent; the request board shows
  `▣ ANCHORED`.

Statuses: `requested → auction → won | lost → anchored`. Semantic colors hold:
cyan = info (requested), pink = in play, neon = won/anchored, ghost = lost —
and **gold is money only** (bid amounts in sats, block heights on the money
rail; never status decoration).

## The auction board

`GET /api/artist/auctions` asks the node `getserverinfo` + `getrollout` and
returns an honest tri-state — the `/a/spaces` NODE-tab pattern:

- **`configured: false`** — no node linked. The board says "NO NODE
  CONNECTED" and explains; it never fakes an auction. This is the normal dev
  state (no `spaced` running).
- **`reachable: false`** — node linked but down; the reason is shown verbatim.
- **live** — chain, tip (rendered as a BFT date via `src/lib/bb/bft.ts` —
  bitcoin time only), and the rollout entries (name + bid in sats). Rollout
  shapes are normalized defensively and kept loose until confirmed against a
  running node (the `spaces.ts` precedent).

Per-name lookups (`GET /api/artist/name?name=…`) classify `getspace` answers
into `available / rollout / auction / registered` with an explicit `unknown`
when the node answers in a shape we don't classify yet — honest over clever.

## Watch your name

`GET/POST/DELETE /api/artist/watches` — the artist's watchlist, keyed by
npub so it follows the key, not the browser. Storage is the house dual-driver
(`src/lib/tickets.ts` pattern): Vercel Blob (`artist/watches.json`) in prod,
`data/artist-watches.json` in dev. **`data/*.json` is never tracked** (house
law; the new stores are gitignored). Watch rows carry the tip at add-time and
render BFT stamps (`▣ height · date` real, `~` estimated). The board's ☆ WATCH
button and the watchlist's ＋ WATCH feed the same list; CHECK asks the node
for a name's latest state and degrades exactly like the board.

## Shipping in the brand kit

This module rides the Pac's Arcade brand kit for **artist onboarding**: a
templated deployment gets `/artist` + `/api/artist/*` + the roster switch out
of the box, themed by the same cartridge as the rest of the site. The training
package teaches the craft; the registry is where a graduate's **name** becomes
theirs — requested, auctioned, anchored to the block.

Lore note for the kit's copy: **PAK the artist is not PAC the admiral** — if
kit material references the Clock research, keep the two distinct.

## Round 2 (stubbed on purpose)

- Operator console room for the roster + request lifecycle (the API and the
  sanctioned `updateRequestStatus()` flip exist; the GUI doesn't yet).
- Live bid tracking against a running node (`getrollout` shape confirmation,
  per-auction close heights), and status auto-flips from chain state.
- The real training credential replacing the npub roster.
