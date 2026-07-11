# The Wardrobe — many tags, one front (round-3 spec)

*Spec'd 0018.04.15 a₿ from the admiral's direction: users carry
many identities (Pac tests with 6–7), profiles should link a fren's tags
across spaces, and a fren presents as ONE name while switching freely.
Division of labor: **frens.earth plumbing = Claude (this repo)**;
**rack/wardrobe design language = GLYPH**.*

## The idea

A fren's identity is a wardrobe: many doors (tags), one **front** — the name
they present as everywhere. Linking is cryptographic, switching is one press,
and any nostr identity can hang in the closet. This spec subsumes the
open-door directive ("any user with a space or nostr address gets in").

## 1. Links are dual-signed attestations — never database rows

A link between two tags exists only when **both keys have signed it**:

```
LINK = { a: "pacster@frens",  b: "pacster@pacsarcade",
         sigA: <a's key signs "PACS-LINK-a-b-<ts>">,
         sigB: <b's key signs "PACS-LINK-a-b-<ts>"> }
```

- Same key holds both tags → one signature covers the pair (whois already
  proves co-ownership).
- Nobody — not the operator, not the server — can link tags for you.
- Stored app-side first (registry sidecar `links/`), published as a nostr
  event later (portable, relay-hosted). Verifiable by anyone forever.

## 2. NIP-05 is the federation layer

To verify a link that points OFF this board (`pacster@pacsarcade`,
`alice@nostrplebs.com`), the server reads the other space's **public
`/.well-known/nostr.json`** and checks the claimed name resolves to the
signing key. No shared store, no new protocol:

- any Spaces deployment, and any plain nostr NIP-05 domain, is linkable;
- this IS the open door — a visitor with any NIP-05 identity walks in as
  that identity (visitor session: npub + verified external name), and
  claiming a @frens tag upgrades visitor → resident.

## 3. Present as one — the front tag

- The profile has one **front** tag: what the header chip, /bb rail, roster
  and profile lead with.
- Linked tags render as small chips under the front, each with a **private
  toggle** — linked-but-hidden for the names a fren doesn't wear publicly.
- Switching the front = one press (the existing door-switcher PUT; same-key
  doors and cookie-resident doors never re-sign). Session cookie holds 8
  doors (`MAX_SESSIONS`).

## 4. The rack (GLYPH's canvas)

In the menu and in profile edit: the fren's doors as a vertical rack —
front tag lit on top, others one `⇄` press below, **“+ ADD A PORTAL”** at the
bottom (signs in another key, joins the cookie). Minimal, fun-side; think
character-select, not settings page. GLYPH owns the visual language here
(rack, portals, the lit-front treatment); the plumbing exposes:

- `GET /api/frens/links?tag=` — verified links for a tag (public)
- `POST /api/frens/links` — submit a signed link half (fren-gated)
- `PUT /api/frens/session` — the existing switcher (front changes ride it)
- `GET /api/frens/whois?npub=` — co-ownership proof (shipped)

## Build order (plumbing)

1. `links` store + attestation verify (content `PACS-LINK-…`, both sigs,
   NIP-05 fetch for off-board names) — mirrors the merges.ts pattern.
2. `front` preference on the profile record + the switcher honoring it.
3. Visitor sessions (any valid nostr signature → npub session, external
   NIP-05 shown when it verifies) — the open door.
4. Profile edit: link/unlink + private toggles + front picker (GLYPH's rack).

House rules that bind this spec: keys never leave the signer · the server
verifies, never vouches · npub is plumbing, tags are names · every claim a
fren makes about identity must be checkable by anyone.
