# Drop-ship fulfillment — Printful (real) + Fourthwall (honest subset)

Ported from vanilla-template's Lane C (S6 ruling 6: *"Printful/Fourthwall
IN v1 — frens.earth needs it, onecocreation likely"*) and adapted to this
repo's own idioms: single-item checkout (no cart), BTCPay as the only
live money rail, and the plain `/a/store` operator screen (no console/glass
component kit). See `~/dev/pacsarcade/design-briefs/lumenbtc-merch-flow.md`
for the instance-level flow (lumenbtc merch on frens.earth) this port
serves. This doc is the runbook: what shipped, how to turn it on, the
draft→confirm flow, and the honest limits of what's here.

## The two honest facts first

1. **Printful and Fourthwall are NOT symmetric, and this build doesn't
   pretend they are.** Printful's Orders API lets a third party create an
   order (as a free DRAFT) and later confirm it for real fulfillment —
   that's a genuine drop-ship integration, built here. Fourthwall's public
   API, as far as this build could confirm without a live shop to test
   against, is catalog- and checkout-oriented: it hands a buyer off to
   Fourthwall's OWN hosted checkout, where Fourthwall charges the card and
   owns fulfillment end to end. No endpoint could be confirmed that lets
   this codebase charge the buyer on its own rail (sats) and then tell
   Fourthwall "please fulfill this" the way Printful's API does. So
   Fourthwall's v1 here is a **manual bridge** — an item can still sell
   through this store's own checkout, but its fulfillment record lands in
   `manual_bridge` state and the admin desk points the operator at the
   item's own Fourthwall product link to re-create the order there by
   hand, then mark it fulfilled once it ships. If a live Fourthwall account
   turns up a real order-submission API, `fourthwall.ts` is written to
   extend the same shape `printful.ts` already uses.
2. **Every Printful endpoint below is marked ⚠ FIRST-VERIFIED-BY-THE-
   OPERATOR'S-SANDBOX.** No network call in this build reached Printful's
   servers — every request/response shape is built from Printful's
   documented v1 Orders API contract, not a live round-trip. The operator's
   sandbox run (the test plan below) is the first real test. Printful's
   webhook verification specifically has NO confirmed HMAC scheme in their
   classic API docs — rather than invent one and present it as fact, this
   build uses a shared secret embedded in the webhook URL instead (see
   "Webhook" below). **v1 only** — a signed-webhook (v2-beta) upgrade is a
   separate, queued task, not attempted here.

## The draft → confirm flow (no auto-spend, said plainly)

The standing rule — no automated action spends a real balance without an
explicit human click — is enforced structurally, not just by convention:

1. **Payment settles first.** BTCPay confirms the charge through the
   existing `recordChargeEvent()` → order state `settled`. Nothing
   drop-ship-related runs before this.
2. **A DRAFT is created automatically.** The moment an order carrying a
   partner-fulfilled line settles, `settleDropshipFromOrder()` (in
   `src/lib/dropship.ts`) runs from the same two settle-fanout points every
   other reconcile trigger uses: the BTCPay webhook
   (`src/app/api/store/webhook/btcpay/route.ts`) and the receipt page's own
   reconcile poll (`src/app/api/store/orders/[id]/route.ts`). For Printful,
   this is a real `POST /orders` call with `confirm: false` — Printful
   holds the order as a draft, which **costs the artist's account
   nothing**. For Fourthwall, nothing is called at all; the record goes
   straight to `manual_bridge`.
3. **An operator explicitly confirms.** The admin desk's "Confirm & submit"
   button (a browser `confirm()` dialog names the spend before it fires) is
   the ONLY caller of `confirmOrder()` / `POST /orders/{id}/confirm` — the
   one call that actually spends against the artist's Printful balance. No
   webhook, settle helper, or cron ever calls it.
4. **Shipping status flows back two ways**: the admin desk's "Refresh
   status" button polls `GET /orders/{id}` directly, and (if
   `PRINTFUL_WEBHOOK_SECRET` is set) Printful's own webhook can push a
   `package_shipped` event. Either path lands in the same
   `applyDropshipStatus()`, which sets tracking info and flips the ORDER's
   own state to `fulfilled` through the one sanctioned `markFulfilled()` —
   the artist never reconciles two separate fulfillment stories.

The states an order's `dropship` record walks through (`src/lib/store.ts`'s
`DropshipState`): `draft_pending` (not configured, or not yet tried) →
`draft_created` (free, awaiting confirm) → `submitted` (spent, in
production) → `shipped` (tracking known, order flips to fulfilled).
`draft_failed`/`submit_failed` are retryable dead ends with a loud
`lastError`, never a silent stall. `cancel_needed` appears if an order is
refunded or disputed AFTER it was already submitted — Printful's
cancel-after-submit API wasn't confirmed either, so this is a loud "go
cancel it by hand" flag, not a silent no-op.

## Setup — Printful

1. Get an API key from Printful's dashboard (Settings → Stores → API) and
   set `PRINTFUL_API_KEY` in `.env.local`.
2. If the account has more than one connected store, also set
   `PRINTFUL_STORE_ID` (the API needs `X-PF-Store-Id` on a multi-store
   account token; a single-store account can leave it blank).
3. In the admin item editor (`/a/store`), pick a "merch (you ship)" item,
   the fulfillment-partner selector shows once it's live — choose
   **Printful** and enter the Printful **sync variant id** for each size
   (find it on Printful's own product page: Store → Products → the item →
   the variant), formatted as `S:sync-id, M:sync-id`. An item with no
   mapping can still be listed and sold, but a real drop-ship order can
   never be placed for it — the desk shows "no Printful variant mapping"
   honestly instead of guessing one.
4. (Optional) Set `PRINTFUL_WEBHOOK_SECRET` to any random string, and
   register `https://<your-site>/api/store/webhook/printful?key=<that
   string>` as a webhook URL in Printful's dashboard for the
   `package_shipped` event. Without this, the admin desk's manual "Refresh
   status" button is the only way shipped status arrives — which still
   works, just isn't automatic.

## Setup — Fourthwall

Set `FOURTHWALL_API_TOKEN` (or `FOURTHWALL_API_KEY`) to unlock the partner
option in the admin editor — this only gates whether the option appears
and whether the pending-fulfillment desk treats the item as a real
partner line; it is NOT used to call any order-submission endpoint (there
isn't a confirmed one). Also fill in the item's **partner product URL** —
the URL the admin desk points the operator at to re-create a paid order
there by hand.

## Shipping addresses

A self-fulfilled ("the artist packs it") item has always collected a
plain name + free-text address at checkout (`BuyPanel.tsx`). Printful's
Orders API needs **structured** fields instead (`address1`, `city`,
`state`, `country`, `zip` as separate values, not one blob to parse
apart) — so a partner-fulfilled line now renders structured fields
instead, and `/api/store/checkout` refuses honestly (400, before any
charge) if a partner line is present without a complete structured address
(`hasStructuredAddress()` in `dropship.ts`). Both may ride on the same
order — `shipping.address` (free text) and `shipping.address1`/`city`/
`state`/`zip`/`country` (structured) are independent fields on the same
private order record every order already uses (dev files locally, KV in
prod) — never logged, never public.

## The admin desk

`/a/store` grew a **Pending fulfillment** section
(`src/components/console/DropshipDesk.tsx`) — every order carrying a
partner-fulfilled line, newest first, with the button appropriate to its
current state (Create draft / Confirm & submit / Retry / Refresh status /
Mark fulfilled for the Fourthwall bridge). The page's own "NEEDS YOU"
block (the plain self-fulfilled mark-fulfilled flow) now explicitly
excludes any order carrying a `dropship` record (see
`api/admin/store/orders/route.ts`'s `needsAttention` filter) — those route
through this desk's own flow instead, so an operator can't accidentally
skip the draft/confirm/ship story with the generic one-click button.

The item list's shelf row shows whether the partner's env is actually
configured, not just whether the item's `partner` field is set — this
matters if a catalog record ever carries `partner: "printful"` written
outside the admin PUT (which otherwise strips an unconfigured partner on
save).

## Test plan (the operator's sandbox — the first real test)

1. Set `PRINTFUL_API_KEY` (and `PRINTFUL_STORE_ID` if needed) to a
   Printful **sandbox or low-risk** account's key.
2. In `/a/store`, add or edit a merch item, set its partner to Printful,
   and map its sizes to REAL sync variant ids from that account's own
   product.
3. Buy it through the storefront with a real structured US address (or
   another country Printful ships to) — small/free item if possible.
4. Confirm the order settles (BTCPay), then check `/a/store`'s Pending
   fulfillment desk: it should show `draft ready — needs your confirm`
   and, if it doesn't, the exact `lastError` string it hit (wrong key,
   wrong variant id, incomplete address, etc. — never a silent stall).
5. Press "Confirm & submit," verify Printful's own dashboard shows the
   order moved out of draft, and that the artist's Printful balance was
   charged (the point of the confirm gate — verify it fires exactly once).
6. Either wait for the webhook (if configured) or press "Refresh status"
   once Printful marks it shipped; confirm tracking appears on the desk
   AND the order's own receipt page, and that the order's state reads
   `fulfilled`.
7. Disconnect the sandbox key when done, same discipline as any other
   sandbox rail test.

## Files touched

New: `src/lib/dropship.ts`, `src/lib/printful.ts`, `src/lib/fourthwall.ts`,
`src/app/api/admin/store/dropship/route.ts`,
`src/app/api/store/webhook/printful/route.ts`,
`src/components/console/DropshipDesk.tsx`,
`scripts/dropship-lane-c.test.mjs`, `scripts/lib/ts-loose-resolve.mjs`.

Modified: `src/lib/store.ts` (`StoreItem.partner`/`partnerVariantIds`/
`partnerProductUrl`, `OrderRecord.shipping`'s structured fields,
`OrderRecord.dropship`/`DropshipRecord`/`DropshipState`, `setDropship()`,
`stripPrivateMedia()` now also strips `partnerVariantIds`, `validateItem()`
validates the new fields), `src/app/api/store/checkout/route.ts` (structured-
address refusal + shipping now rides for a partner line too),
`src/app/api/store/webhook/btcpay/route.ts` (settle-fanout call),
`src/app/api/store/orders/[id]/route.ts` (settle-fanout call on the
reconcile poll), `src/app/api/admin/store/route.ts` (`partners` env state
in GET, partner-field trim/gate in PUT), `src/app/api/admin/store/orders/
route.ts` (`needsAttention` excludes drop-ship orders), `src/components/
store/BuyPanel.tsx` (structured address fields for a partner item),
`src/app/a/store/page.tsx` (partner selector, variant-id/product-URL
fields, the Pending fulfillment desk mounted), `.env.example`.

Not touched: `src/lib/payments.ts` (a fulfillment partner is a different
concern from a payment rail — no changes needed there), booking/session
checkout — drop-ship only applies to physical goods, sessions were never
in scope. No cart route exists in this repo (single-item checkout only,
v1 scope said out loud in `checkout/route.ts`'s own header) — the source
port's CartPanel changes have no target here and were not ported.
