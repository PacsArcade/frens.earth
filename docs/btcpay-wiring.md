# Wiring your money rail — the BTCPay runbook

*For every earthship artist. Your store, your node, your sats — the site
never touches your money; it only asks your BTCPay to mint invoices and
listens for "paid." Worked example: frens.earth on the arcade's node.
~15 minutes, five steps, all copy-paste.*

**You need:** admin sign-in to a BTCPay Server (your own, or your host's —
frens.earth uses `https://btcpay.pacsarcade.org`), and access to the site's
Vercel project dashboard.

---

## Step 1 — create YOUR store (one store per site, never shared)

BTCPay left sidebar → **Create Store**.

- Name: your site's name (worked example: `frens.earth`)
- Default currency: `SATS` (or your fiat unit — either works; prices convert)
- Connect your wallet under **Wallets → Bitcoin** (and Lightning if your
  node has it) — sats land HERE, in your wallet, never anywhere else.

Then grab the **Store ID**: Store → **Settings → General** → copy the ID
string. You'll paste it in Step 4 as:

```
BTCPAY_STORE_ID
```

## Step 2 — mint the API key (least privilege — this matters)

Click your **avatar (top right) → Manage Account → API Keys →
Generate Key**.

- Label: `<your-site> web` (example: `frens.earth web`)
- Check **ONLY** these two permissions, and use "select specific stores" to
  pin them to the store from Step 1:

```
btcpay.store.cancreateinvoice
btcpay.store.canviewinvoices
```

- ⚠ **Nothing more.** Never grant store-modify or server permissions to a
  website key — a full key could re-point where your money goes. Invoices
  in, invoices read, that's all the site ever needs.
- **Generate**, copy the key NOW (it shows once). It becomes:

```
BTCPAY_API_KEY
```

## Step 3 — the webhook (how "paid" reaches your site)

Store → **Settings → Webhooks → Create Webhook**.

- Payload URL — copy-paste, swap the domain for yours:

```
https://frens.earth/api/store/webhook/btcpay
```

- Events: **Send all events** is fine (the site ignores noise), or pick the
  invoice set (settled / expired / invalid / processing / payment received).
- Save, then copy the **webhook secret** BTCPay generated. This is a
  SEPARATE credential from the API key — without it your site cannot tell a
  real "paid" from a forged one. It becomes:

```
BTCPAY_WEBHOOK_SECRET
```

## Step 4 — hand the three values to your site

Vercel dashboard → your project (⚠ check the project name in the header —
frens.earth lives on the **frens-earth** project) → **Settings →
Environment Variables** → environment: **Production**. Add:

| name | value |
|---|---|
| `BTCPAY_URL` | your server, e.g. `https://btcpay.pacsarcade.org` |
| `BTCPAY_STORE_ID` | from Step 1 |
| `BTCPAY_API_KEY` | from Step 2 |
| `BTCPAY_WEBHOOK_SECRET` | from Step 3 |

Dashboard is the safe path (values never transit a chat or a shell
history). If you must use the CLI, this pipe form works on Linux/macOS:

```
printf '%s' 'PASTE_VALUE' | npx vercel env add BTCPAY_STORE_ID production
```

⚠ Never use a PowerShell pipe for this — it sets BLANK values silently
(the house learned this the hard way, 0018.04).

## Step 5 — the order vault (the Redis/KV store)

**What this is:** your catalog (the public shelf) lives in public storage —
fine, it's a shopfront. But **orders** carry private things: who bought
what, a shipping address, an email. Those must live in a **private**
database, and on Vercel that's a Redis (KV) store. No KV = the site
refuses checkout on purpose rather than put buyer data anywhere public.

Vercel dashboard → **Storage** tab → **Create Database → Redis (Upstash,
free tier is plenty)** → then the step people miss: **Connect Project** →
pick your project (frens-earth). If it asks for an env prefix, use `KV` so
these two appear automatically:

```
KV_REST_API_URL
KV_REST_API_TOKEN
```

## Step 6 — redeploy and verify

Env changes need a redeploy (house rule 9). From the repo:

```
npx vercel deploy --prod --yes --scope adminpacmans-projects
```

Then look at `/store` — the "◌ payment rail not connected" banner is gone.
Or ask the API directly; `rail` should name btcpay with both rails:

```
curl -s https://frens.earth/api/store/catalog
```

## Step 7 — stock your first ware

Sign in and open **`/a/store`** → ADD A WARE → title, blurb, price in sats
→ **GO LIVE**. Buy it yourself for the maiden voyage: small price, pay the
lightning invoice, watch the receipt page flip PAID, then hit MARK
FULFILLED in the order book. If all of that worked, your shelf is open. 💜

---

## When something's off

- **Shelf still says browse-only after redeploy** → one of the three BTCPay
  values is missing or blank on the *Production* environment of the *right
  project*. Check names AND the project header.
- **Paid but the receipt never flips** → webhook. Confirm the payload URL
  matches your live domain exactly and `BTCPAY_WEBHOOK_SECRET` matches the
  webhook's secret (not the API key). BTCPay → your webhook → "Recent
  deliveries" shows every attempt and the response code.
- **Checkout says "order store not configured"** → Step 5's **Connect
  Project** didn't happen, or the env prefix isn't `KV`.
