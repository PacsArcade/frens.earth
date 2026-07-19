# The Store Addon — frens.earth + store

*Scaffolded 2026-07-19 during the crossing (the 4.5-hour backup window). Plans-first: this
doc is the contract; the code on `feat/store-addon` is the skeleton that proves it.*

## Canon

Pac's ruling, 2026-07-09: **"onecocreation = frens.earth + store addon, a fren's site."**
The storefront is not a fork and not a separate product — it is an **addon to the
fren-node template**. Any tenant of the template (one repo, N branded Vercel tenants)
turns the store on by shipping product files and pointing at their own BTCPay store.
No products or no store id → the `/store` surface stays a closed shutter.

## House values (binding)

- **Non-custodial, always.** The BTCPay API key is watch-only (cancreateinvoice +
  canviewinvoices, store-scoped, never server-admin). It can never move a sat.
  Sats go straight to the operator's own wallet.
- **No KYC.** Pay in sats. No accounts required to buy; a signed-in fren gets their
  tag on the order, that's all.
- **Zero platform fees.** The template takes nothing; the operator keeps everything.
- **Color canon:** coin = money only. Prices render in coin. Nothing else does.
- **Fren language:** "fren" never "friend"; shelf, coin slot, INSERT COIN.

## Architecture (three layers, all already proven elsewhere)

1. **Content layer — git is the database.** One JSON per product at
   `content/products/<slug>.json` (`src/lib/store/products.ts`), exactly the
   campaigns pattern from pacsarcade-org. Products are code-reviewed and
   sign-off-gated like everything else.
2. **Money layer — BTCPay is the source of truth.** `src/lib/btcpay.ts` (ported from
   pacsarcade-org; keep in sync until the shared package exists). One invoice per
   order; the order line rides invoice metadata (`store:<slug> x<qty>`) until the v2
   order store exists. Settlement discovered by polling in v1.
3. **Identity layer — already there.** NIP-07 nostr sign-in (`useFrenSession`) gives a
   buyer identity for free; buying never requires it.

## Env contract (per tenant)

| var | meaning |
|---|---|
| `BTCPAY_URL` | the operator's BTCPay server |
| `BTCPAY_API_KEY` | watch-only Greenfield key (see scope above) |
| `BTCPAY_STORE_ID` | ONE store for the whole shop (unlike campaigns' per-campaign stores) |

## API surface (live in this branch)

- `POST /api/store/<slug>/invoice` — `{ qty?, name? }` → invoice (price = product
  file × qty; the client never sets an amount). Digital + live products only.
- `GET /api/store/<slug>/invoice/<invoiceId>` — status poll for the pay modal.

## UI status

`/store` (shelf) and `/store/<slug>` (product page) render through the brand tokens —
scaffold only; **the design pass owns the final look** (GLYPH / design team). The
INSERT COIN pay modal is a straight port of the campaigns `ContributeModal`
(QR via `qrcode.react`, 4s poll) — **deferred to the new ship** because it needs an
`npm install` we don't run mid-backup.

## v1 scope — digital first (Pac's call, 2026-07-19)

Sells items with **no shipping surface**: supporter packs, class seats, cert-linked
goods, digital deliverables. Fastest to real sats, zero address handling.

## v2 design — physical merch (∞/21M merch and beyond)

Designed here so v1 doesn't paint us into a corner; **not wired**.

- `kind: "physical"` products exist in the schema now; the invoice route refuses them
  with "ships in v2" until the below lands.
- **Shipping data = the privacy problem.** Options, in house-values order:
  1. **BTCPay checkout form** collects shipping directly (data lives on the operator's
     own box, never in Vercel) — preferred;
  2. encrypted nostr DM to the operator's npub with the order id — the cypherpunk path,
     worth prototyping;
  3. a form field in our modal → invoice metadata — simplest, weakest (metadata is
     visible to anyone with store access); use only if 1 fails.
  Decision deferred to Pac at v2 kickoff.
- **Order store + webhook.** A durable order record (ordered → settled → fulfilled →
  shipped) and a BTCPay webhook receiver. The webhook wants a stable host — the POKE
  node, not Vercel; design alongside Fleet Ops.
- **Supply caps** (`supply`) enforced at invoice time once the order store can count.

## Open questions for the admiral

1. First real product(s) for the shelf? (The sample `supporter-pack.json` is a marked
   draft placeholder.)
2. Which BTCPay store backs the fren-store — the existing crowdfund store or a fresh
   one? (Fresh recommended: clean books per surface.)
3. Does the store get a door on the sign-in (BrandDoor with `accent: "coin"`)?
4. v2 shipping path: BTCPay form vs nostr DM prototype?

## TODO on the new ship (not during the crossing)

- [ ] `npm install` + build, fix any type drift (scaffold written against Next 16.2.4
      conventions read from this repo, but never compiled — the backup owned the disk).
- [ ] Port `ContributeModal` → `BuyModal` (qrcode.react) and wire INSERT COIN.
- [ ] Extract the shared package (btcpay + fren-auth + identity-config are now
      duplicated in THREE places — org, frens-earth, and this addon).
- [ ] Real first product + Pac's price + flip to `live` on his go.
- [ ] Storefront brand: onecocreation as first external tenant proof.
