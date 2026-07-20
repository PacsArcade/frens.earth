# The Store Framework — a business in a box, clonable (spec v2)

*v1 written ~0018.04.23 a₿ (tip ~958,888, explorer-estimated; no ship's node
yet). v2 same day: the six-lens web-team panel (architecture · payments ·
identity · Matrix · commerce/brand · security) returned 36 findings, merged
into 12 amendments — all applied below. Status: **v2 — build-ready except the
captain's calls.***

## ⚑ Captain's calls — RESOLVED ~0018.04.23 a₿

1. **Matrix homeserver model: two plans, offered honestly.**
   **(a) Sovereign** — the artist runs their own homeserver (needs a
   VPS-class box; a Conduit-class server runs light — a small Zap-Hosting
   VPS qualifies). **(b) Arcade-hosted** — for artists who can't host, Pac's
   Arcade hosts their space as a service tier built into the plan model,
   with the custody note said out loud in the plan copy (the arcade admin
   *can* read rooms and deactivate accounts — that's what hosting means),
   namespaced localparts (`@name.artist:server`), and per-clone scoped bots.
   The choice is **permanent per community** (no Matrix migration exists) —
   the plan page says that too.
   **Ruled out:** Plesk-style *webspace* (incl. Zap's Webspace XXL: 20 GB /
   100 mailboxes / 100 MySQL) cannot host Matrix — shared PHP hosting runs
   no persistent daemons. It stays in the model for what it IS good at:
   **static class-file hosting** and **the email path** (mailboxes for
   newsletter/receipts — the house's missing email capability; shared-IP
   deliverability caveat applies).
2. **Anchor network: MAINNET — with the mistype window before the chain.**
   The admiral's ruling (~0018.04.23): we anchor on the real chain, and a
   mistyped name must be catchable. The physics: nothing cancels an etched
   mainnet transaction — that permanence IS the product — so cancel-ability
   lives entirely **pre-broadcast, by design**:
   - A `queued` subname is freely editable/cancelable until the batch
     ceremony. The ceremony GUI shows a **final review manifest** — read the
     roll before you etch it — with per-name removal, then the one confirm.
   - On-chain `@spacename` bids get the same confirm-with-review step (sats
     committed at bid time; the GUI never one-clicks money onto the chain).
   - After the etch there is no cancel, and the copy says so proudly.
   Two legs, honestly distinguished: **top-level `@spacenames` auction on
   mainnet today** — requests/bids run from the **Pac's Arcade auction
   surface** (graduated from "future addon" to real S7 work; pacman's own
   pending space registrations are its first live cargo). **Subnames** go
   mainnet as soon as the subspaces batch-commit RPC is confirmed there
   against the running node; ceremonies before that are labeled rehearsals.
3. **Buyer privacy: minimum, private, then gone.** Collect only what
   fulfillment needs; all of it on the private driver; contact/shipping
   **purged ~4,320 blocks (~30 days) after `fulfilled`** (returns window;
   artist can export their own records before purge); shipping data is
   visible to the artist alone, never shared, never sold, never a byproduct.
   We aren't trying to share anyone's shipping data — we're trying to
   forget it on schedule.

## The mission

frens.earth is the **master template**; every artist's site is a **clone**.
This spec adds the store half of "a business in a box." A trained artist
takes a clone and has, under their own name, on their own rails:

1. their **name on Bitcoin** (a Spaces `@artist` primary space),
2. **/join** — their people claim `name@artist` subnames → the community,
3. those names as **nostr identities** (NIP-05) → the social layer,
4. a **Matrix space** — community rooms + tier-gated classes incl. video,
5. a **storefront** they manage themselves,
6. **bitcoin on-chain + lightning first** (their own BTCPay); fiat adapter
   slots pinned now for **Square AND Stripe**, wired later,
7. **Fourthwall import** — drop-ship merch pulled in by API, no inventory.

**The principle:** their brand, their money, their community — the framework
supplies the rails and never holds any of it.

## What already exists (build on, don't rebuild)

| need | existing house piece |
|---|---|
| `@artist` name | `/artist`: request → auction → anchored ([artist-registry.md](artist-registry.md)) |
| subnames | claim + batch anchoring w/ Merkle proofs ([spaces-anchoring.md](spaces-anchoring.md)) |
| nostr identity | claim → NIP-05 → NIP-07 sign-in (built) |
| gated access | the LEVEL-LOCKED gate; the API is the gate, screens are courtesy |
| config/storage | dual-driver (blob prod / `data/*.json` dev) — **see the private-driver mandate below** |
| ops console | SCAR·LET `/a` (LCARS rebuild is its own track) |
| theming | brand cartridge / `BrandTheme` |

## Module 1 — the storefront (`/store`)

- **Catalog** — `src/lib/store.ts`; single-doc dual-driver is acceptable for
  the catalog only (public by nature, single operator; last-write-wins
  between a running Fourthwall SYNC and a manual edit is an explicit,
  documented trade). Every store document carries **`schemaVersion` from day
  one**.
- **Item schema** — `{ id, schemaVersion, title, blurb, images[], kind,
  price, sale?, fulfillment: 'self'|'fourthwall'|'digital'|'service'|'package',
  status: 'live'|'hidden'|'soldout', entitlementTier? }`.
- **Money representation, pinned now** (migration if late): `sats` is an
  integer; `fiat` is `{ amount: <integer minor units>, currency: <ISO-4217> }`
  — the exact shape Stripe and Square demand. **Validity rule:** an item
  needs at least one denomination to go `live`. When both are set, sats is
  authoritative for the BTCPay rail; fiat for card rails.
- **Display:** sats-primary with a **fiat hint** (`~$30`) — the hint needs
  only a rate source (template-contract knob; default BTCPay's rate
  endpoint), NOT a live fiat rail. Sale price rides the gold rail; `soldout`
  is a neutral, visible, honest label — never a silently shrinking shelf.
- **Inventory:** stock decrements at **settle**, not charge-creation;
  oversell resolves via the refund path.
- Honest empty state: "No wares on the shelf yet."

### Route gate matrix (`/api/store/*`) — the API is the gate

| route class | gate |
|---|---|
| catalog read | public |
| checkout / order status | public (order id is the capability) |
| digital-goods delivery | fren session + tier check, per `artistFromRequest` precedent |
| management (`/a/store` APIs) | operator session; **stakes model below** |
| webhooks | signature verification only — never a session |

### /a/store stakes model

Per house rule 7 and `operator-auth.ts`'s own premise (the 30-day session
exists *because* high-stakes actions take per-action signatures):

- **Session-only:** cosmetic catalog edits (copy, images, hide/show).
- **Per-action nostr signature** (the merge-authorization pattern):
  money-rail configuration (BTCPay URL/token), tier grants/revokes, roster
  edits, refunds.
- All mutations: Origin check + `SameSite=Strict` (the cookie alone is CSRF
  bait). Known limit, documented: the HMAC operator token has no session id —
  no per-session revocation short of rotating `SEAT_SECRET` for everyone.

## Module 2 — payments

**v1 ships bitcoin-only, non-custodial:** the artist's own BTCPay, on-chain +
lightning. Sats land in their node; we never touch them.

### The order state machine (canonical, all adapters map into it)

```
created → charge_created → processing → settled → fulfilled
                     ↘ expired · underpaid · canceled     (re-chargeable)
          settled →  refunded · disputed                  (revoke hook fires)
```

Per-adapter mapping table maintained in `store.ts`: BTCPay
New/Processing/Settled/Expired/Invalid/PaidPartial → the above; Stripe
PaymentIntent states; Square Payment states. `processing` is where on-chain
buyers actually sit (10–60+ min) — it is a first-class state with its own UX,
not a spinner.

### The Order record

One blob per order at `store/orders/<id>.json`, created with
`allowOverwrite:false` (the `registry.ts` per-record pattern — **NOT** the
`tickets.ts` last-write-wins board doc; a concurrent webhook flip + new
checkout on a board doc drops a write on a money path). The webhook rewrites
only its own record. The A3 `reindex()` write-through index backs the
`/a/store` order list (per-order blobs are N+1 without it — the index is not
optional). Schema:

```
{ id, schemaVersion, state, lineItems[], priceSnapshot, adapterId,
  chargeIds[],            // one order, many charges — BTCPay invoices expire ~15 min
  entitlementSubject?,    // REQUIRED for package/digital — see module 5
  contact?, shipping?,    // fulfillment:'self' only
  createdAt~, settledAt~ }  // BFT stamps via estimateHeight(ms), wear the ~
```

`priceSnapshot` = `{ amount, currency, rate, rateSource, at }` captured at
charge creation — without it a refund's "50k sats or $21?" is unanswerable.

### ⛔ The private-driver mandate (prerequisite for S1)

Every existing dual-driver write is `access:'public'` + deterministic path —
world-readable URLs. Fine for the registry (public by design); **unacceptable
for orders (PII), digital goods, and any stored credential.** Before S1: a
**private-access storage driver** (private blob or KV) for orders, digital
files, and GUI-entered secrets. Digital goods are delivered only via a
gate-checked route or short-TTL signed URLs — never a stable public URL.

### The adapter interface (pinned so Square/Stripe are wire-only)

```ts
interface PaymentAdapter {
  id: 'btcpay' | 'square' | 'stripe'
  rails: ('onchain' | 'lightning' | 'card')[]
  createCharge(order: OrderCharge, idempotencyKey: string): Promise<{
    chargeId: string
    payUrl: string                       // hosted redirect — ALWAYS (Stripe Checkout
                                         // Session / Square Payment Link shape)
    extras?: { bolt11?: string, onchainAddress?: string }  // native BTCPay QR
  }>
  status(chargeId): Promise<CanonicalChargeState>   // the reconcile path
  verifyWebhook(rawBody, headers): Promise<ChargeEvent | null>
  refund?(chargeId, amount): Promise<RefundHandle>  // BTCPay = pull-based claim
}                                                   // link; Stripe/Square = direct
type ChargeEvent = { type: 'settled'|'processing'|'expired'|'invalid'
                          |'refunded'|'disputed', chargeId, amount, raw }
```

- `idempotencyKey` derives from orderId (Stripe header; Square mandatory
  field) — a lost createCharge response must not mint a duplicate invoice.
- `refunded`/`disputed` events fire the **revoke hook**: tier revoked, Matrix
  kick, content lock. Card rails contractually deliver chargebacks; a
  charged-back purchase must not keep gated access forever. v1 refund UI may
  be "contact the artist," but the capability shape exists now.

### The webhook route (specified end-to-end)

- **`BTCPAY_WEBHOOK_SECRET` is a separate credential** from the store token —
  it joins the template contract, and webhook registration joins clone
  onboarding (without it, "signature-checked, always" is unachievable and a
  forged POST grants free tiers).
- The route reads the **raw body** (`req.text()` before any JSON parse) —
  all three processors HMAC raw bytes. Stripe adds a timestamp replay window;
  Square signs URL+body, so the configured URL must byte-match the deployed
  one.
- Flip to `settled` **only on InvoiceSettled** — never
  InvoiceReceivedPayment or partial events; bind event invoiceId + amount to
  the stored order.
- **Fulfillment pipeline on serverless (no background worker):** record the
  settled flip on the order first, behind a real idempotency check; every
  downstream effect (tier grant, Matrix invite, content unlock) is
  independently idempotent and re-derivable from order state; `status()`
  polling is the sanctioned reconcile path through the *same* commit
  function; `/a/store` shows a **"settled but ungranted" reconcile view**
  with a manual re-run — the honest-empty-state of ops.

### The buyer's checkout (the surface S1 actually ships)

- **Single-item checkout, no cart** (v1 scope, said out loud).
- Order-status/receipt page polls the adapter's `status()` **against the
  processor** (rewritten blobs are CDN-stale; the order blob is the record of
  fact, not the live feed). `/a/store` renders from its own mutation
  responses.
- Explicit UX for `processing` ("your payment is on the chain — this takes
  10–60 min; this page will update"), `expired` (mint a fresh charge, same
  order), `underpaid` (top-up or refund path).
- **Invoice-expiry countdown, BFT ruling written down:** relative durations
  ("expires in 12:41") are exempt from bitcoin time; absolute order/receipt
  stamps wear `~estimateHeight` per [bft-display.md](bft-display.md). Buyer
  identity on receipts shows the **tag**; npub only as fallback (house law).
- **The no-coiner moment, honest:** the buy button never ambushes anyone
  with a raw BTCPay invoice. Bitcoin-only copy at the point of sale —
  "bitcoin only, here's how" + the pacBOT on-ramp pointer; rails that aren't
  live get honest disabled labels, never dead ends.
- **Post-purchase notification rail, v1:** the receipt page + the Matrix
  invite (for tiers). Nostr-DM/email receipts are a later phase, named here
  so their absence is a choice.

## Module 3 — Fourthwall import

- **Import, don't iframe** — but with honesty rulings, not sentiment:
  Fourthwall items display **fiat-primary** (a gold sats price the buyer can
  never pay in sats would break the money-rail law) with a **"fulfilled +
  charged by Fourthwall"** badge on card AND item page, before the click.
- A Fourthwall purchase writes **no order record in our store** (their
  checkout, their order) — and the buyer is told exactly that, with the
  return leg ("you'll get Fourthwall's confirmation; come back for the rest
  of the shelf") specified.
- **⟲ SYNC**: idempotent upsert by Fourthwall product id; price refresh
  writes the `fiat` field (schema above); paginated/chunked against Vercel
  function-duration caps with a defined mid-death state (partial upsert is
  visible, re-run completes it); single-operator last-write-wins documented.
- Per-clone env: `FOURTHWALL_API_TOKEN` (**read-only scope**), shop id.

## Module 4 — classes & community (Matrix)

**Hosting model per captain's call #1:** sovereign (artist's own VPS
homeserver) or arcade-hosted as a plan tier — chosen per community, before
the FIRST room is created, permanent once chosen. Whatever the model:

- **Invite automation (OQ2, answered):** a **per-clone regular bot account**
  holding elevated power levels only inside that clone's space — **never** a
  Synapse admin token/API (on any shared server that's a fleet-wide blast
  radius: clone A could deactivate clone B's members). Invites issue
  server-side from the settled flip only; never a client-triggered "claim
  invite" route. Revocation is the same bot: refund/dispute/expiry → kick +
  tier revoke — ships with S2, not later; refunds arrive in week one.
- **Room bootstrap is scripted, never manual Element clicks** — every
  setting is a one-way door, set at creation: class rooms **encryption OFF**
  (Element defaults private rooms to E2EE, which can never be disabled and
  denies pre-join history — the exact "buy tier C after three classes
  posted" case) with `history_visibility: shared`; gated rooms
  `join_rule: invite` — never the space-restricted default (any space member
  could walk into a paid room); **per-room-type federation policy**:
  community rooms federate, gated class rooms set `m.federate: false` at
  creation (federation permanently replicates paid media to remote servers;
  kick claws nothing back).
- **MXID provisioning moves into S2** (was "round 2" — you cannot invite a
  member who has no MXID): provision-at-purchase or a verified "link your
  Matrix ID" step, with a stored subname↔MXID mapping and localpart
  namespacing (`@name.artist:server`) if any server is shared.
- **Video (S4), realities priced in:** upload is **direct
  client-to-homeserver** with app-issued auth — a Next.js route cannot proxy
  past Vercel's ~4.5 MB body cap; explicit size/length ceiling (Synapse
  `max_upload_size` defaults 50 MB; no transcoding, no adaptive bitrate,
  single non-resumable POST — scope v1 to short, pre-compressed videos);
  authenticated-media path designed for gated web-page playback (post-1.11
  mxc URLs cannot be hot-linked); per-user upload quotas so one artist can't
  fill a shared disk. **PeerTube graduation trigger, named:** when a class
  video needs >1 resolution, >30 min runtime, or mobile streaming complaints
  become real — see Appendix A.
- **Backup rail:** unlisted YouTube/Vimeo embeds inside gated surfaces —
  always a fallback, never the default. onecocreation's Zap forever-webspace
  can host their class files if needed.
- **Template contract addition:** the per-clone re-branded Element client is
  a hosted service and is listed as such.

## Module 5 — /join (the front door)

- `/join` = the claim machine as a clone's front door: pick `name@artist` →
  NIP-05 immediately → `queued` for batch anchor. NIP-05 is honestly
  `name@<clone-domain>` — it coincides with `name@artist` only when the
  artist's domain is configured as the space's nip05Domain.
- **The entitlement subject, named:** a tier attaches to the **mutable
  registry record** (`handle@space`, keyed by npub via `findHandleByNpub`) —
  the on-chain anchor is historical record, **never the live gate key**.
  Operator-mediated **npub rebind** policy: a lost nsec loses the key, not
  the paid tiers (the anchor can't re-anchor; the registry record rebinds).
- Package/digital checkout **requires NIP-07 sign-in**, and the checkout UI
  confirms **which tag is buying** (fren-auth carries up to 8 sessions;
  `sessions[0]` is silent ambiguity). Merch checkout may stay anonymous but
  captures contact/shipping. `createCharge` persists the entitlement subject
  on the order — the webhook is server-to-server; the order is the only
  identity source at grant time.
- **Honest degradation:** /join consumes the same tri-state as the auction
  board. No node linked (this ship's literal current state) → "queued;
  anchoring opens when this ship links its node" — never the hardcoded
  tip+6789 ETA promising a ~7-week anchor nothing will fulfill.
- **@artist ownership transfer** (gates the first real clone, not S1–S2):
  the auction is won by the registry node's wallet, but the clone's node must
  own the space to sign batch commits (`getspaceowner`). Spec the transfer
  ceremony — or sanction the named interim mode: "the master node anchors on
  the clone's behalf" (today's pacsarcade-powers-frens.earth arrangement,
  written down instead of implicit).

## Module 6 — mobile (the same identity in your pocket)

The admiral's requirement (~0018.04.24): the experience syncs everywhere —
a fren signs in on their phone, an artist manages the shelf or pulls an
inventory report from a mobile app. NIP-07 is a **desktop browser
extension** API; phones need the signer paths nostr already has:

- **Sign-in parity, three doors, one session:** NIP-07 (desktop extension) ·
  **NIP-55** (Android signer apps — Amber-class: the key lives in the signer
  app, ours never sees it) · **NIP-46** (remote signer / bunker — covers iOS
  and any browser). All three produce the same signed challenge → the same
  fren/operator session. The login door detects and offers what the device
  has; keys never touch the app on ANY platform (house law, unchanged).
- **Mobile management = the same API.** `/api/store` and `/api/admin/store`
  are already the gate; a mobile surface (PWA first — the console and shelf
  are responsive web; a native wrapper later consumes the identical routes)
  adds no second backend. Per-action signatures for high-stakes ops work on
  mobile the same way — the signer app signs them.
- **Inventory report:** an operator-gated `/api/admin/store/report` (counts,
  sold, settled totals in sats, needs-attention) — S2 work, shaped for both
  the console room and the mobile team's screens.

## Module 7 — the connection rails (orbee · nostr · matrix)

The admiral's comms doctrine (~0018.04.24), one identity across three
layers — the `name@space` tag is the passport on all of them:

1. **orbee — the first connection.** Realtime chat: NIP-29 groups on the
   house relay (strfry, `relay.frens.earth`), served through the clone's
   **branded orbee floor** (the `/chat` door — exists today, gated behind
   sign-in, never public without it). Because orbee IS nostr, the fren's
   key/tag is the identity automatically — no second account, the
   @spacename rails carry straight in. Per-clone: every ship points
   `chatUrl` at its own floor (moves from `CHAT_URL_DEFAULT` in code to
   stored config — already on the de-house-ing checklist).
2. **nostr — the social layer.** Posting, profiles, zaps, calendar sync and
   event meetups (calendar-event kinds on the same relay), NIP-05 identity.
3. **matrix — the long room.** Extended hangouts, gaming together, safe
   community spaces, tier-gated classes (module 4). Heavier, roomier,
   slower-burning — the clubhouse, not the counter.

Contract additions: the clone's orbee floor + relay row (hosted services,
listed honestly like the Element client).

## Backend variant — the Zap webspace as the heavy-lifting host

The admiral's ruling (~0018.04.24): a clone may run **Vercel as the front,
Zap-Hosting webspace as the back** — pictures and data live on the
webspace so the home host stays light. The store's storage is already
behind driver interfaces, so this is a driver implementation, not a
rewrite:

- **Images/assets driver → the webspace** (20 GB static hosting,
  DDoS-protected): product images, class files, brand assets. Upload via
  the webspace's FTP/WebDAV or a small authenticated upload endpoint on
  the webspace itself.
- **Catalog + orders driver → the webspace's MySQL** (private — satisfies
  the private-vault mandate): requires Plesk's "remote MySQL access"
  enabled with TLS, credentials in env like every other rail. Honest
  caveat for the builder: serverless functions must pool conservatively —
  shared-host MySQL has low connection ceilings.
- Vercel stays compute-only; nothing heavy transits the home connection.
- Rides the S7 clone track; the KV/Blob drivers stay the default.

## Module 8 — community rails (later kit modules, admiral-sparked ~0018.04.24)

Three nostr-native modules that ride the SAME relay + identity the kit
already has — none block S1–S2; each is a bolt-on when its moment comes:

- **Fundraising — NIP-75 zap goals.** A goal event (target in msats, the
  relays that count it) + zap receipts tallying toward it, verifiable by
  anyone. Kit shapes: an **event fund** ("raise for the Degen New Year
  venue"), a **commission fund** (a business commissions a mural → the
  artist's goal page collects the crowd's half), and the receipts trail
  doubling as **spend accountability** (zap receipts are the public books).
  Flourish (the admiral likes it): funders of a goal can receive an
  **ordinal/rune memento** — the mural's patrons etched, patron-wall style.
- **Live — NIP-53 live activities.** Live event notices (streams, classes
  in session, meetup-now) published from the clone's key; the BFT clock
  badge already knows how to wear "LIVE."
- **Classifieds — NIP-99.** The honest craigslist: structured listings
  (title, price in sats, location, images) signed by real `name@space`
  identities on the community relay — farmers-market stalls, event booths,
  local trades. Moderation = the relay's own write policy; reputation =
  the tag's history, checkable by anyone.

All three are read/write against the house relay (Module 7) — no new
infrastructure, just new event kinds and their surfaces.

## The template contract v2 (what a clone must configure)

| knob | via | notes |
|---|---|---|
| brand cartridge | GUI | exists |
| NIP-05 domain / host→space map | **stored config** | move `SPACE_HOSTS` out of source — hardcoded rows contradict "no code edits" |
| `SPACES_NODE_URL/TOKEN` | env → GUI later | exists |
| `BTCPAY_URL` + store token | env-only **until the private driver ships**, then GUI knob | token scope: **invoice create/view only** — a full key can swap the derivation xpub (custody loss via the app) |
| `BTCPAY_WEBHOOK_SECRET` | env | separate credential; registration step in onboarding |
| Matrix homeserver + bot token | env → GUI later | model per captain's call #1 |
| Element client hosting | hosted service | per clone, listed honestly |
| rate source | env, default BTCPay rate endpoint | powers the fiat hint |
| `FOURTHWALL_API_TOKEN` | env → GUI later | read-only scope |
| fiat adapter creds + webhook secrets | S5 | Square needs the recovered account first |

**Sequencing rule (the one resolved lens conflict):** end-state is
GUI-knob credentials with env as bootstrap (an artist can't CLI-redeploy to
rotate a token — house rule 9); but the GUI path is **gated on the private
storage driver**, because today's nodeconfig pattern writes tokens into a
public blob. Until then the table says env-only, out loud.

**Clone distribution model:** git fork per artist with upstream merges
(default; matches "everyone clones the master"), plus a **de-house-ing
checklist**: RESERVED names in `registry.ts`, default repos in
`nodeconfig.ts`, `CHAT_URL_DEFAULT`, `SPACE_HOSTS` rows, and the
`@pacsarcade/arcade-ui` tarball pin (move to a tagged release so UI upgrades
don't require per-clone package.json edits). `schemaVersion` on every store
doc from day one.

## Phases v2 (panel-revised)

- **S0 — design freeze: ✓ this document.** Order machine, Order schema,
  private-driver decision, adapter + hand-off contract, webhook route shape,
  entitlement subject, checkout surface, money representation — all pinned
  above. Remaining S0 item: choose the private storage driver (private blob
  vs KV).
- **S1 — shelf + sats:** catalog + `/store` + `/a/store` (with the stakes
  model + CSRF defenses) + BTCPay adapter end-to-end **including** the
  receipt/status page, processing/expired UX, and the reconcile view.
- **S1.5 — mobile sign-in parity** (parallel, with the mobile team): NIP-55 +
  NIP-46 doors beside NIP-07, one session model; PWA pass over /store and
  /a/store; the inventory-report endpoint.
- **S2 — packages + the gate:** *prerequisites:* the clone's hosting-model
  choice recorded (call #1), scripted room bootstrap with the one-way
  settings, MXID provisioning/link. Then:
  package → tier grant → Matrix invite, **plus manual revocation** (kick +
  revoke) from day one.
- **S3 — Fourthwall** (independent of S2; may run parallel or earlier — it's
  the only rail a card-only buyer can use today).
- **S4 — classes video:** direct-to-homeserver upload path (pre-committed in
  S0), gated playback, ceilings + quotas.
- **S5 — fiat:** genuinely wire-only now — Square first (after account
  recovery), then Stripe; their webhook secrets and dispute events are
  already in the contract and event union.
- **S6 — booking:** services wired to the ship's-calendar work.
- **S7 — the clone track** (parallel): distribution model mechanics,
  de-house-ing checklist execution, @artist transfer ceremony, and the
  **Pac's Arcade @spacename auction surface** (request → review → bid →
  registered, from the GUI, node wallet signing — pacman's pending space
  registrations ride first). The identity leg's "permanent" copy gated on
  mainnet batch-commit confirmation (call #2).

## Residual risks (the panel's, kept honest)

1. The "name on Bitcoin" leg rests on an unconfirmed testnet4 dev-branch
   RPC and an unsolved @artist transfer — clone identity promises may
   outrun the chain; the copy must not.
2. Matrix hosting is a one-way door with no portability; shared hosting
   quietly contradicts the sovereignty story, per-clone hosting is real
   recurring ops per artist.
3. Non-custodial refunds stay operationally painful (pull-based claim
   links, after-the-fact addresses, rate disputes) — and a merch store meets
   them in week one, burden on the artist.
4. Vercel serverless is a weak substrate for webhook-driven fulfillment;
   growth may force a queue/worker outside this architecture.
5. Template drift until the distribution model ships — every clone diverges
   from the master as the fleet grows.
6. PII concentration on a sovereignty brand — mitigated by call #3's
   purge-on-schedule ruling; residual = the ~30-day window itself.

## Appendix A — PeerTube, what hosting it actually takes

*(the admiral asked; honest rundown, no rose tint)*

- **What it is:** self-hosted video platform (ActivityPub-federated), proper
  player, streaming/transcoding, channels, unlisted/private videos.
- **The box:** a VPS with ≥2 CPU / 4 GB RAM; docker-compose is the sane
  path. Own (sub)domain + TLS.
- **The real costs:** transcoding is CPU-hungry (every upload burns cores
  for minutes-to-hours); storage grows fast (multiple resolutions per video;
  S3-compatible offload supported and recommended); one more service to
  update, back up, and monitor.
- **Access control:** private/internal videos + OAuth plugins exist, but
  wiring to OUR entitlement gate is custom work (token-gated embeds).
- **Verdict:** graduate to it on the named trigger in Module 4 — multiple
  resolutions, long runtimes, or real mobile-streaming demand. Until then
  the media repo + unlisted-embed fallback carries v1.
