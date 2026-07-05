# frens.earth — claim your player tag

Standalone registration site for the **@frens** space: free, sovereign Bitcoin
handles (`alice@frens`) with instant [NIP-05](https://github.com/nostr-protocol/nips/blob/master/05.md)
nostr verification (`alice@frens.earth`), anchored on-chain in batches via the
[Spaces protocol](https://spacesprotocol.org). A project of the
[Pac's Arcade](https://pacsarcade.org) non-profit.

## How it works

1. **PICK YOUR TAG** — live availability check against the registry.
2. **GET YOUR KEYS** — NIP-07 extension, paste an `npub`, or forge a fresh
   keypair *in the browser* (guided key ceremony; the secret key never touches
   the server — it's copied, then revealed for a double-check, never stored).
3. **LOCK IT IN** — tag + public key enter the claim queue. NIP-05 verification
   works immediately; the next batch ceremony commits a Merkle root of all
   queued tags to Bitcoin in one transaction.

## Stack

- Next.js 16 (App Router, Turbopack) + Tailwind 4, deployed on Vercel
- Registry storage: **Vercel Blob** in production — one immutable blob per
  claim (`registry/<space>/<handle>.json`); `allowOverwrite: false` makes the
  pathname itself the atomic uniqueness check. Local dev uses a JSON file and
  `predev` clears it, so test claims can never ride into a real batch.
- `nostr-tools` for key generation/encoding (the only crypto dependency)

## Run it

```bash
npm install
npm run dev        # local file registry, cleared on every start
```

Production needs one env var: `BLOB_READ_WRITE_TOKEN` (a Vercel Blob store
connected to the project). Nothing else — no database, no accounts.

## Reuse this for another space

This repo is a template: one deployment = one space.

1. Clone, then set the space in the environment (or edit
   `src/lib/identity-config.ts` defaults):
   ```
   NEXT_PUBLIC_SPACE_NAME=yourspace
   NEXT_PUBLIC_NIP05_DOMAIN=yourspace.example
   ```
2. Create a Vercel project + Blob store for it
   (`vercel blob create-store <name> --access public --yes`).
3. Point the domain at the project. NIP-05 requires the domain in
   `NEXT_PUBLIC_NIP05_DOMAIN` to be the one serving `/.well-known/nostr.json`.
4. Adjust the copy in `src/components/RegistrationPage.tsx` if the space isn't
   a free-for-everyone one.

## Registry data

Each claim is stored as JSON: `{ handle, npub, status: "queued" | "committed",
batchId, requestedAt }`. The batch commit ceremony (run manually with the
space-owner wallet — keys never live on a server) flips entries to
`committed` with their on-chain batch id and inclusion proof.
