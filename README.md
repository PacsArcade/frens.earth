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

Production needs two secrets: `BLOB_READ_WRITE_TOKEN` (a Vercel Blob store
connected to the project — the registry) and `SEAT_SECRET` (any long random
string; it signs the sign-in cookie — without it, returning login, tag
release, and `/admin` all 500). Set `OPERATOR_NPUBS` too if you want the
operator console. No database, no user accounts — see
[`.env.example`](.env.example) for the full list.

## Fork this for your own space

This repo is a template: one deployment = one space, and the space is pure
configuration. Copy [`.env.example`](.env.example) to `.env.local` (or set the
same vars in your Vercel project) and change two values:

```
NEXT_PUBLIC_SPACE_NAME=yourspace          # tag = name@yourspace
NEXT_PUBLIC_NIP05_DOMAIN=yourspace.example # domain serving this site
```

Then:

1. Create a Vercel project + Blob store for it
   (`vercel blob create-store <name> --access public --yes`), and set
   `BLOB_READ_WRITE_TOKEN` + `SEAT_SECRET` (and `OPERATOR_NPUBS` for `/admin`).
2. Point your domain at the project. NIP-05 requires the domain in
   `NEXT_PUBLIC_NIP05_DOMAIN` to be the one serving `/.well-known/nostr.json`.
3. Reserved names live in `src/lib/registry.ts` (`RESERVED`) — review them for
   your community.
4. **Rebrand.** The registry / claim / NIP-05 core is config-driven, but the
   visible copy is not yet fully themeable (that migration is tracked in
   [`docs/themeable-signin-plugin.md`](docs/themeable-signin-plugin.md)). Until
   it lands, hand-edit the Pac's Arcade branding in the hero + cards
   (`src/components/RegistrationPage.tsx`), the claim ceremony
   (`src/components/TagClaim.tsx`), header nav + footer (`ArcadeHeader.tsx`,
   `EarthFooter.tsx`), the profile (`FrenProfile.tsx`), page metadata
   (`src/app/layout.tsx`, `page.tsx`), and the brand theme
   (`src/lib/brand/themes/`). If you own only one space, you can also trim the
   multi-space host map in `src/lib/identity-config.ts` to your own domain.

## Registry data

Each claim is stored as JSON: `{ handle, npub, status: "queued" | "committed",
batchId, requestedAt }`. A claimed tag is `queued` and verifies over NIP-05
immediately.

> **Status:** the Spaces-protocol batch ceremony — computing the Merkle root,
> committing it to Bitcoin with the space-owner wallet, and flipping entries to
> `committed` with an inclusion proof — is **not yet built**. Tags stay
> `queued` (and fully usable on nostr) until that tooling lands; the
> `committed` / `batchId` fields are reserved for it.
