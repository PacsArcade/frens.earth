# On-chain anchoring — the Spaces batch ceremony (A1)

How a `queued` tag becomes **permanent on Bitcoin**. This is the back-half of
the frens.earth pitch; the front-half (claim → NIP-05 verify → sign-in) is
already built.

## What the Spaces protocol gives us

`@frens` is a **primary space** on the [Spaces protocol](https://spacesprotocol.org).
Each `alice@frens` is a **subspace** the space owner issues *off-chain* and
commits in **batches**: the owner's node writes a single **Merkle root** of the
batch on-chain, every name gets a **Merkle inclusion proof** linking to that
root, and each batch carries **exclusion proofs** (the name did not exist in a
prior batch). Verifiable, uncensorable, permanent — with one Bitcoin
transaction for thousands of names. This is a native Spaces feature (subspaces,
currently on testnet4 / the `subspaces` branch), not something we invent.

## The standalone principle

Anchoring runs against a **Spaces node (`spaced`) that each deployment runs for
itself.** The node connects to Bitcoin Core and holds the space owner's
**wallet** — the wallet that signs the on-chain commit.

- Every space runs **its own node**. Nothing here is hardcoded to any one host.
- Today a node on **@pacsarcade** temporarily powers frens.earth, just to stand
  it up; frens.earth will run its own node later. The design must not bake that
  in — the node is a **configurable, swappable** dependency.
- **Keys/wallet never touch this web app** — same rule as the fren secret key.

## Architecture — admin GUI drives the node over RPC

All operator-facing and all web GUI: an **"admiral"** signs into the admin area
(`/admin`, `fe-operator` session) and runs everything from a browser. The app
backend talks to this deployment's own **`spaced` node over JSON-RPC**; the node
holds the **wallet** and performs every on-chain action. The app never holds a
key.

```
  admiral ─▶ /admin GUI ─▶ frens.earth backend ─JSON-RPC─▶ spaced node
                                                            (wallet, Bitcoin Core)
   connect node · view queue · commit a batch · register a name
```

- **Connect** — configure + test the node link: `getserverinfo` (chain tip →
  "look at the block") and `getspaceowner` (confirm the wallet owns @<space>).
  Backbone route today: `GET /api/admin/spaces/status`.
- **Anchor a batch** — the GUI reads the queued set, calls the node's subspace
  batch-commit (wallet-signed on the node), then flips `queued→committed` with
  the returned root + proofs via `commitBatch()`.
- **Register one name** — the same commit path for a single subspace, on demand.

**Reachability:** `spaced` RPC is localhost-only and unauthenticated, so a
serverless frens.earth must reach it through an authenticating proxy
(`SPACES_NODE_URL` + `SPACES_NODE_TOKEN`), or run co-located with its own node.
Each deployment points at its **own** node — the pacsarcade node powering
frens.earth today is temporary and nothing here hardcodes it.

## Endpoint contracts (built in this PR)

Both gate on the existing operator session (`fe-operator` cookie — a NIP-07
`PACS-CONSOLE` sign-in against the `OPERATOR_NPUBS` allowlist).

**`GET /api/admin/batch/export?space=<space>`** → the ceremony input:
```json
{ "ok": true, "space": "frens", "count": 128,
  "entries": [ { "handle": "alice", "npub": "npub1…",
                 "requestedAt": "2026-07-10T…", "blockHeight": 957510 } ] }
```

**`POST /api/admin/batch/commit`** → record the outcome:
```json
// request
{ "space": "frens", "batchId": "<on-chain root / txid>",
  "items": [ { "handle": "alice", "proof": "<opaque inclusion proof>" } ] }
// response
{ "ok": true, "batchId": "…", "committed": ["alice", …],
  "skipped": [ { "handle": "bob", "reason": "already committed" } ] }
```

`commitBatch()` (in `src/lib/registry.ts`) is the one sanctioned
`queued → committed` flip: it stamps `batchId` + the inclusion `proof` +
`committedAt` on each name and marks it permanent. Already-committed names are
skipped, so a retried callback is safe. Per-handle blobs stay authoritative;
`proof` is stored **opaque** (whatever the node emits) so the app never has to
understand the proof format.

## Open — needs confirming against the running node

Interface is decided: **all web GUI over `spaced` JSON-RPC** (localhost `:7225`
by default). Remaining:

1. **Reachability / auth** — how does the app reach the node? Its RPC is
   localhost-only + unauthenticated. Expose it via an authenticating proxy
   (`SPACES_NODE_URL` + `SPACES_NODE_TOKEN`), or co-locate the app with the
   node? (frens.earth is on Vercel today; its own node later may change this.)
2. **Batch-commit RPC** — the exact `spaced` method + params that commits a
   subspace batch with the wallet: a dev-branch (`subspaces`) call not in the
   stable server API. Need the method name/shape from the running node.
3. **Subspace record** — does a committed subspace store the **nostr pubkey**
   (so the on-chain record can back NIP-05), or only the name?
4. **Proof format** — what a per-name inclusion proof looks like, and the
   matching verify call (`getrootanchors` / `buildchainproof` / `getcommitment`?).
5. **Network** — testnet4 or mainnet for the first real batch?

## Still to build (follow-ups)

Toward the primary goal — frens.earth as a ready-to-go **template** whose
operator can self-set-up:

- **Admin setup + ceremony GUI** in `/admin` — connect/test the node (the
  `GET /api/admin/spaces/status` backbone exists), view the queue, commit a
  batch, and register one name on demand. This "admin link to set yourself up"
  is the core frens.earth need.
- **Node batch-commit call** — the `spaces.ts` client method that drives the
  node's subspace commit (pending the dev-branch RPC spec above), then
  `commitBatch()` flips status.
- **Verification surface** — serve each committed name's inclusion proof + root
  so anyone can independently verify "etched on Bitcoin". (`FrenProfile`
  already renders the committed/pending badge from `status`.)
- **A1 × A3 cache coordination** — once the aggregated read-index (PR #6)
  lands, route `commitBatch()`'s status flips through its `reindex()` hook
  (marked `TODO(A1xA3)` in `registry.ts`).

**Pac's Arcade addons — future, not built here:** an auction / registration
site to register a client's name live in a meeting, plus a "look at the block"
teaching UI. These layer on the same foundation on pacsarcade later.
