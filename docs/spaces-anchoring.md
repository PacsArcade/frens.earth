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

## Architecture — a decoupled handoff

The web app owns the **queue + proof storage + verification surface**. The node
owns the **wallet + the on-chain commit**. They meet at two operator-gated
HTTP endpoints, so the node can live anywhere and can be re-pointed at will:

```
  Spaces node / operator (holds wallet)              frens.earth web app
  ───────────────────────────────────               ───────────────────
   1. GET  /api/admin/batch/export  ───────────────▶  the queued subspace set
   2. commit batch on-chain with space-cli
      (owner wallet) → Merkle root + proofs
   3. POST /api/admin/batch/commit  ───────────────▶  flip queued→committed,
        { batchId, items:[{handle, proof}] }           store batchId + proof
```

The app never calls the node and never holds a key; the node calls two stable
app endpoints. Re-homing the node (pacsarcade → frens.earth's own box) changes
nothing in the app.

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

The exact node side depends on your `spaced`/subspaces build. To finish A1:

1. **Batch-commit interface** — is it an RPC method on `spaced`, or a
   `space-cli` command run on the node host? (Shapes step 2 + who calls
   `/commit` — the node directly, or an operator script.)
2. **Subspace record** — does a committed subspace store the **nostr pubkey**
   (so the on-chain record can back NIP-05), or only the name? Determines
   whether `/export` should also hand over each `npub` for the commit (it
   currently does).
3. **Proof format** — what does a per-name inclusion proof look like, and is
   there a matching **verify** call? (Drives the future public verification
   surface + how `batchId` maps to the on-chain root/txid.)
4. **Network** — testnet4 or mainnet for the first real batch?

## Still to build (follow-ups)

- **Verification surface** — serve each committed name's inclusion proof + root
  so anyone can independently verify "etched on Bitcoin". (`FrenProfile`
  already renders the committed/pending badge from `status`.)
- **Admin ceremony UI** — an operator screen in `/admin` to run export → commit
  (today the endpoints are driven by the node/an operator script).
- **`SPACES_NODE_URL` config** — only if we later let the app *call* the node
  (the current design has the node call the app, so this may stay unneeded).
- **A1 × A3 cache coordination** — once the aggregated read-index (PR #6)
  lands, route `commitBatch()`'s status flips through its `reindex()` hook so
  NIP-05 / login reflect committed status without waiting for a cache rebuild
  (marked `TODO(A1xA3)` in `registry.ts`).
