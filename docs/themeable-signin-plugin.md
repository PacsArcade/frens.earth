# Themeable sign-in plugin

*Turning the frens.earth nostr sign-in into a standalone, brand-themeable package
that frens.earth, pacsarcade.org and degenwonderland.com can each consume in their
own colors, fonts and words — while staying signer-agnostic NIP-07.*

Status: **design + proof-of-concept** on branch `feat/themeable-signin` (frens-earth
only; never merged, never deployed). Author: pac@pacsarcade.org.

---

## 1. What the sign-in is, today

The sign-in is a handful of React client components plus a thin server/lib layer:

| Layer | Files | Job |
|---|---|---|
| Claim UI | `src/components/TagClaim.tsx` (900 lines) | pick a tag, forge/paste/connect a key, the key-safety ceremony, claim, starter kind-0 |
| Login UI | `src/components/LoginPanel.tsx` | returning-user sign-in (sign a challenge), the "two doors" for new users |
| Support UI | `SignerNudge.tsx`, `SigningExplainer.tsx`, `RegistrationPage.tsx` | no-signer nudge, "what am I signing", the marquee page wrapper |
| Session | `src/hooks/useFrenSession.ts` | one shared session store for the header |
| Server | `src/lib/fren-auth.ts`, `src/app/api/frens/session/route.ts`, `src/lib/registry.ts` | verify signed challenge, HMAC cookie, claim registry |
| Identity | `src/lib/identity-config.ts` | the space model: `SPACE_HOSTS`, `KNOWN_SPACES`, `SPACE_ROLES` |
| Styling | arcade-ui `@pacsarcade/arcade-ui/tailwind` + `src/app/globals.css` | color tokens, fonts, glows, `.button` |

**pacsarcade.org already ships a byte-identical copy** of `LoginPanel.tsx`,
`TagClaim.tsx`, `SignerNudge.tsx`, `identity-config.ts`, `useFrenSession.ts`,
`fren-auth.ts` and `registry.ts`. So the "plugin" is really *consolidating a fork
that already exists* — the two apps have drifted from copy-paste and will keep
drifting. That is the core motivation, independent of Degen Wonderland.

### Signer-agnostic already ✔

The flow never talks to a specific signer. It calls the NIP-07 surface only —
`window.nostr.getPublicKey()` and `window.nostr.signEvent(...)` (see
`src/types/nip07.d.ts`). It works with nos2x / Alby today and will work with the
planned **Arcade Signer** (`design-briefs/arcade-signer-extension.md`) with zero
changes. The theme contract below is deliberately compatible with the Arcade
Signer's "per-site brand accent" idea: the accent a site passes to the sign-in is
the same accent the signer can mirror on its popup.

---

## 2. The coupling: what's hard-wired vs. already parameterized

### Already parameterized (good — keep as-is)

- **Space / domain.** `TagClaim` and `RegistrationPage` take `space` +
  `nip05Domain` **props**; the host→space map lives in `identity-config.ts`
  (`SPACE_HOSTS` / `spaceForHost`). Adding a space is a data edit, not a code edit.
- **Color as CSS variables.** This is the key lever. Every visible color is a
  Tailwind utility (`text-cyan`, `bg-panel`, `border-edge`, `text-coin`, …) that
  arcade-ui compiles to `color: var(--color-cyan)` etc. from its Tailwind v4
  `@theme` block. arcade-ui *already* re-themes by overriding those variables via
  `data-arcade-theme="vapor|terminal|arctic"` (see `arcade-ui/THEMING.md`,
  `css/themes.css`). **So re-coloring the whole sign-in needs no className edits —
  only a variable override on a wrapping scope.** That insight is the whole
  architecture.
- **Fonts as CSS variables.** `--font-arcade` / `--font-pixel` / `--font-body`
  (and legacy `--font-press-start`, `--font-roboto`) — overridable the same way.

### Hard-coded to Pac's Arcade / frens (the real coupling)

1. **Brand copy & nouns.** "fren", "arcade", "PLAYER REGISTERED", "INSERT KEY",
   "RETURNING FREN?", "seven ate nine", the anchor/Bitcoin-ceremony language — all
   string literals inside `TagClaim` / `LoginPanel` / `RegistrationPage`.
2. **Information architecture.** `LoginPanel`'s **"two doors"** (play `@frens` /
   school `@pacsarcade`) with hard-coded `href="https://frens.earth"` and
   `/register`. This is Pac's-Arcade IA; DW's is different (one "rabbit hole" door).
3. **Space role labels.** `SPACE_ROLES = { frens: "PLAY", pacsarcade: "SCHOOL" }`.
4. **The `.button` / `.glow-*` classes** read a few *legacy* base vars
   (`--primary`, `--background`, `--accent`) and hard-coded rgba glows — they
   re-color if those base vars are overridden, but glow hues are fixed.
5. **The arcade semantic contract.** arcade-ui *locks* coin=money, neon=live,
   cyan=info, ghost=danger, and only lets surfaces + the pink flair move. That's
   great for the arcade family, but Degen Wonderland is a *different brand* and may
   re-map the semantic hues to its purple/gold palette. The plugin's contract must
   therefore allow the full palette to move, while still *recommending* the locked
   semantics for arcade-family consumers.
6. **Wire/protocol constants that only LOOK like branding.** The login challenge
   `PACS-LOGIN-<ts>` is matched by a server regex in `fren-auth.ts`
   (`/^PACS-LOGIN-(\d+)$/`) and the event `kind: 22242`. **These are not themeable**
   — they are a shared protocol between client and server. Renaming them is a
   coordinated cross-repo change, not a per-brand knob (see §7 Remaining work).

---

## 3. Architecture: an injectable brand contract

One package. Two channels, both driven by a single `BrandTheme` object:

```
BrandTheme
├─ tokens   → CSS custom properties  (colors, surfaces, base)   ── channel 1
├─ fonts    → CSS custom properties  (type roles)               ── channel 1
├─ copy     → React context (words)                             ── channel 2
├─ doors    → React context (the character-select IA)           ── channel 2
└─ roleLabels → SPACE_ROLES for this brand's spaces             ── channel 2
```

- **Channel 1 (color/font)** needs **zero component edits**: a `<BrandProvider>`
  writes the theme's tokens as CSS variables on a wrapper `<div>`, and every
  arcade-ui utility class underneath resolves to them. This is exactly arcade-ui's
  `data-arcade-theme` mechanism, generalized to an arbitrary token set.
- **Channel 2 (copy/IA)** is a React context read via `useBrand()`. The default
  context is the **frens theme**, so any component rendered *without* a provider
  (i.e. the live frens.earth / pacsarcade.org pages today) is byte-identical.

### Files added (PoC, all under `src/lib/brand/`)

| File | Contents |
|---|---|
| `contract.ts` | `BrandTheme`, `BrandTokens`, `BrandFonts`, `BrandCopy`, `BrandDoor`, `DoorAccent` — types only |
| `themes/frens.ts` | `frensTheme` — current values extracted verbatim (the default) |
| `themes/degen.ts` | `degenTheme` — Degen Wonderland palette + copy |
| `BrandProvider.tsx` | `<BrandProvider theme>`, `useBrand()`, `brandCssVars(theme)` |
| `index.ts` | barrel + `THEMES` registry |

### The CSS-variable contract (`brandCssVars`)

`tokens` → variables the components already read:

```
void/panel/edge          → --color-void / --color-panel / --color-edge
coin/neon/cyan/ghost     → --color-coin / --color-neon / --color-cyan / --color-ghost   (semantic)
pink                     → --color-pink                                                 (flair)
background/foreground    → --background / --foreground                                  (body, legacy)
primary/secondary        → --primary / --secondary                                      (.button, legacy)
border/accent            → --border / --accent                                          (.button, legacy)
fonts.arcade/pixel/body  → --font-arcade / --font-pixel / --font-body
fonts.button? (optional) → --font-press-start   (only emitted when set; re-faces .button)
```

A consumer never edits a className — it hands over a `BrandTheme` and the same
markup renders in its brand. `data-brand="<id>"` is also stamped on the wrapper for
CSS/debug hooks.

### How this maps to the Arcade Signer

The `pink` flair token and per-door `accent` are the exact "per-site brand accent"
the signer brief wants to mirror on its popup. A site can expose its accent (e.g.
via a `<meta>` or the `data-brand` attribute) and the Arcade Signer can read it to
tint its chrome — keeping the "same key, same accent, everywhere" story. No coupling
either direction: the sign-in still only speaks NIP-07.

---

## 4. Adding a new space (the Degen Wonderland rows)

Adding a brand-new space is still a **data edit** in `identity-config.ts` (done in
this PoC):

```ts
// SPACE_HOSTS
"degenwonderland.com":      { space: "degen", nip05Domain: "degenwonderland.com" },
"www.degenwonderland.com":  { space: "degen", nip05Domain: "degenwonderland.com" },

// KNOWN_SPACES
export const KNOWN_SPACES = ["frens", "pacsarcade", "degen"] as const;

// SPACE_ROLES
degen: "WONDER",
```

`registry.ts` reads `KNOWN_SPACES`/`SPACE_NAME` through `normalizeSpace`, so the new
space is claimable the moment it's listed — no other server change. (If DW wants an
alt handle-space like `degenz`, add another `KNOWN_SPACES` entry + the host row; it's
the same three-line change.) `RESERVED` names in `registry.ts` are global; add any
DW-specific reserved names there if needed.

---

## 5. What the PoC actually builds (branch `feat/themeable-signin`)

Additive, reversible, no auth/crypto touched:

- **New** `src/lib/brand/*` — the contract, the two themes, the provider (above).
- **Edited** `src/components/LoginPanel.tsx` — reads `useBrand()` for the returning
  card copy, the doors heading/footnote, and renders **doors from data** (`brand.doors`)
  instead of hard-coded JSX. Door tints use a static `DOOR_ACCENT` lookup so Tailwind
  still sees literal classes. The one hard-coded `#ff00ff` box-shadow became
  `var(--color-pink)` so it re-themes too. Default theme = frens ⇒ live pages unchanged.
- **Edited** `src/lib/identity-config.ts` — the `degen` space rows (§4).
- **New** `src/app/brand-preview/page.tsx` — a **dev-only, unlinked** route that
  renders the *same* `LoginPanel` and `RegistrationPage/TagClaim` twice, once under
  `<BrandProvider theme={frensTheme}>` and once under `<BrandProvider theme={degenTheme}>`,
  side by side. This is the visible proof that one package renders in two brands.
  Safe to delete; `robots: noindex`.

**Validation:** `npx tsc --noEmit` → clean. `npx next build` → success;
`/brand-preview` prerenders. TagClaim/LoginPanel were **not** rewritten line-by-line
— color re-theming is free via the variable channel; only `LoginPanel`'s brand copy
was migrated to the contract as the worked example.

### Known PoC limitations (honest list)

- **DW copy inside `TagClaim`** (the 900-line claim ceremony: "PLAYER REGISTERED",
  "seven ate nine", the Bitcoin-anchor language) is **not yet** migrated to
  `copy` — TagClaim still shows arcade wording even under the DW theme. Colors DO
  re-theme. Migrating TagClaim's copy is mechanical but large; it's the bulk of the
  remaining work (§7).
- **Fonts in preview.** The DW column references `'Lewis Carroll'`, which isn't
  installed in frens-earth, so the preview falls back to serif. In the real DW app
  the font is present (`@font-face` in its globals.css), so this is a preview-only
  cosmetic gap.
- **`.glow-*` hues are fixed** (hard-coded rgba in arcade-ui). Under the DW theme,
  text re-colors but its glow keeps the arcade hue. Fixing this is a small arcade-ui
  change (make glows read the token vars).

---

## 6. Consumption guide

### 6a. pacsarcade.org — the easy consumer (already arcade-ui)

pacsarcade.org already imports arcade-ui and already has the `pacsarcade` space in
its own `identity-config.ts`. To consume the extracted package it does **nothing to
its styling** — it is the default (`frensTheme`) look. Steps once the sign-in is a
shared package (e.g. `@pacsarcade/signin`):

1. Delete its forked copies of `LoginPanel.tsx`, `TagClaim.tsx`, `SignerNudge.tsx`,
   `useFrenSession.ts`, `fren-auth.ts`, `registry.ts`, `identity-config.ts` and
   import them from the package instead.
2. Keep `@import "@pacsarcade/arcade-ui/tailwind"` and the
   `@source ".../@pacsarcade/arcade-ui/react"` line in `globals.css` (already there).
3. **Theme:** optional. If it wants the school door styling it can pass a
   `pacsarcade` theme (same tokens as `frensTheme`, pink-forward doors); otherwise the
   default is fine. If wrapped, do it once high in the tree:
   ```tsx
   import { BrandProvider, frensTheme } from "@pacsarcade/signin";
   <BrandProvider theme={frensTheme}>{children}</BrandProvider>
   ```
4. **Space:** already registered (`pacsarcade` in `SPACE_HOSTS`/`KNOWN_SPACES`/`SPACE_ROLES`).
5. **Env:** unchanged — `SEAT_SECRET` (session HMAC), `BLOB_READ_WRITE_TOKEN` +
   `VERCEL=1` (or `REGISTRY_DRIVER=blob`) for the blob registry, optional
   `NEXT_PUBLIC_NIP05_DOMAIN` / `NEXT_PUBLIC_SPACE_NAME`.

*No code edits to pacsarcade-org were made (verified by reading it — its LoginPanel
is identical to frens-earth's, confirming it can consume the package as-is).*

### 6b. degenwonderland.com — the new consumer (not arcade-ui today)

DW is a different stack: JS + CSS Modules, Next 16 / React 19 / Tailwind v4,
**no arcade-ui, no nostr deps**, static export for Plesk. To host the sign-in it
must add the sign-in's runtime:

1. **Add deps:** `@pacsarcade/signin`, `@pacsarcade/arcade-ui` (the sign-in's
   styling substrate), `nostr-tools`, `@vercel/blob`.
2. **Server runtime:** the sign-in needs the `/api/frens/*` routes + a session cookie,
   so DW's `output: 'export'` static export must become a server deploy for the
   sign-in routes (or host them on a small companion service). **This is the biggest
   lift for DW and a Pac decision** (§7).
3. **Tailwind:** add to `globals.css`, keeping DW's own `@theme`:
   ```css
   @import "@pacsarcade/arcade-ui/tailwind";
   @source "../../node_modules/@pacsarcade/arcade-ui/react";
   ```
   The DW theme overrides arcade-ui's tokens per-scope via `BrandProvider`, so the
   two token sets don't collide (DW's `--color-bg-void` etc. are separate names).
4. **Theme:** pass the ready-made DW theme:
   ```tsx
   import { BrandProvider, degenTheme } from "@pacsarcade/signin";
   import LoginPanel from "@pacsarcade/signin/LoginPanel";
   <BrandProvider theme={degenTheme}><LoginPanel /></BrandProvider>
   ```
   `degenTheme` (in `themes/degen.ts`) is built from DW's **real** globals.css palette
   (see §8 for the exact mapping and the one open color question).
5. **Font:** DW already ships `'Lewis Carroll'` via `@font-face`; the theme references
   it by name, so it "just works" in the DW app.
6. **Space:** already registered here (`degen` → `degenwonderland.com`).
7. **Env:** DW must set `SEAT_SECRET` (its own, independent of Pac's Arcade) and, for
   a persistent registry, `BLOB_READ_WRITE_TOKEN` (+ `VERCEL=1` or `REGISTRY_DRIVER=blob`).
   Optional `NEXT_PUBLIC_NIP05_DOMAIN=degenwonderland.com`.

*No code edits to degenwonderland were made (verified by reading it — it can consume
the theme; the only blocker is the static-export → server decision).*

---

## 7. Remaining work / decisions for Pac

1. **Migrate `TagClaim` copy** into `BrandCopy` (the 900-line ceremony). Mechanical
   but sizeable; deliberately left out of the PoC to avoid a risky sweeping rewrite.
2. **Extract to a real package.** This PoC lives inside frens-earth. The real step is
   a `@pacsarcade/signin` package (or a folder in the arcade-ui monorepo) that both
   apps import, killing the copy-paste fork. Decide: separate repo vs. arcade-ui
   subpath export.
3. **The `PACS-LOGIN` / `kind:22242` constants.** Shared client↔server protocol
   strings, not branding. If you want a neutral name (e.g. `SIGNIN-`), that's a
   coordinated change in both `LoginPanel` and `fren-auth.ts` — a small, separate PR,
   **not** a per-brand knob. Left untouched here (rules: no auth-behavior changes).
4. **DW hosting.** DW is static-export today; the sign-in needs a server runtime for
   `/api/frens/*` + cookies. Decide: promote DW to a server deploy, or run the sign-in
   on a companion service/subdomain.
5. **The DW ember (`#FF4500`).** The brief calls DW's signature a 624 nm orange-red,
   but **degenwonderland's committed `globals.css` has no orange-red — it's purple/gold.**
   In `degenTheme` the ember is used only for the *flair* slot + button CTA (which
   globals.css leaves unpinned); the surfaces and semantic hues come from the real DW
   palette. **Decision:** keep the ember flair, or go pure-purple (set `pink`/`primary`
   to purple-glow `#9d8bc4`). One-line change in `themes/degen.ts`.
6. **Semantic contract for DW.** arcade-ui locks coin/neon/cyan/ghost. `degenTheme`
   *re-maps* them to DW's gold/green/cyan/pink. Recommend keeping the *meanings*
   (money/live/info/danger) even in DW colors — it's good UX and matches the signer's
   teaching. Confirm.
7. **`.glow-*` + `.button` font** token-ization in arcade-ui (small) so non-arcade
   brands re-glow and re-face fully.

---

## 8. Appendix — Degen Wonderland token mapping

From `degenwonderland/src/app/globals.css` (the real, committed palette) onto the
arcade-ui semantic slots:

| slot (meaning) | arcade-ui var | frens (default) | DW value | DW source |
|---|---|---|---|---|
| void (surface) | `--color-void` | `#050505` | `#0a0810` | `--color-bg-void` |
| panel (surface) | `--color-panel` | `#1a1a1a` | `#1a1428` | `--color-bg-card` |
| edge (surface) | `--color-edge` | `#333333` | `#382e4d` | `--color-purple-mid` |
| coin (money) | `--color-coin` | `#ffd700` | `#d4a843` | `--color-accent-gold` |
| neon (live) | `--color-neon` | `#39ff14` | `#3de08c` | `--color-accent-green` |
| cyan (info) | `--color-cyan` | `#00ffff` | `#00cec9` | `--color-accent-cyan` |
| ghost (danger) | `--color-ghost` | `#e91e63` | `#e84393` | `--color-accent-pink` |
| pink (flair) | `--color-pink` | `#ff00ff` | `#ff4500` | 624 nm ember (see §7.5) |
| foreground | `--foreground` | `#ffffff` | `#eee8f5` | `--color-text-primary` |
| button accent | `--accent` | `#E91E63` | `#9d8bc4` | `--color-purple-glow` |
| body font | `--font-body` | Roboto | `'Inter'` | `--font-body` |
| display font | `--font-arcade` | Retronoid | `'Lewis Carroll'` | `--font-brand` |
