# Review: glass round 3 on the real site

Branch `glass/round-3` (from origin/main 2fe9072). Local commits only, not pushed.

## What changed per file
- `src/app/globals.css` (+190): one unlayered "GLASS ROUND 3" block at the end. Glass buttons for `.button`, the `.btn-pill` family, arcade-ui `.pa-btn*`, and the header burger/chip (`header button[aria-label="Menu"]`). New helpers `.glass-btn` (`--money`, `--danger`, `--secondary`) and `.btn-row`. Card rules (`.card` flex column, single-line h3), `.shelf-card*` fixed-size store card, footer-to-bottom rule, text-wrap balance/pretty.
- `src/app/store/page.tsx`: ItemCard uses the `.shelf-card` parts: square stage, 2-line name slot, 2-line blurb slot, fixed sizes row, price pinned to the bottom with USD on its own line.
- `src/components/store/BuyPanel.tsx`: size chips = `btn-pill` (aria-pressed), buy = gold money glass.
- `src/components/ArcadeHeader.tsx`: SHELF (/store) added; order SHELF, PLAY, LEARN, GROW. No /calendar, /market, /rooms.
- `src/components/FrenMenu.tsx`: phone menu = SIGN IN (emoji dropped), WELCOME (/welcome), then the doors. Signed in: identity, profile rows, WELCOME, then doors.
- `TagClaim.tsx`, `me/MePanel.tsx`: small-size `!px !py !text` overrides removed (one size); button pairs get equal basis; arrow and em dash removed from button labels.
- `SignerDoors.tsx`, `Kind0Doors.tsx`: second button of a pair is `btn-pill`, equal basis.
- `welcome/WelcomeWizard.tsx`: step chips are `btn-pill` with aria-pressed.
- `not-found.tsx`, `BbConsole.tsx`, `LoginPanel.tsx`, `GameOverTag.tsx`, `u/[handle]/not-found.tsx`, `ArtistRegistry.tsx`, `ArtUpload.tsx`, `ChatPanel.tsx`, `store/[id]/page.tsx`: arrows (and one em dash) removed from button/CTA labels.

## Recipe values
radius 12px; blur(14px) saturate(1.3); `--glass-hi: inset 0 1px 0 rgba(255,255,255,.22)`; primary teal `rgba(83,224,212,.34 to .16)` + 1.5px ring `rgba(83,224,212,.85)`; secondary white `.12 to .05`, ring `.28`; money gold `rgba(247,201,72,.34 to .14)`; danger rose `rgba(255,92,138,.18 to .06)`, ring #ff5c8a; height `--pb-h` 36px, 44px under 860; Roboto 700 .82rem, tracking .12em, uppercase, nowrap.

## Not matched or skipped
- 501(c)(3): footer already read "A NON-PROFIT IN FORMATION" on main; no "501" copy in src (only a hardware part number in a public rtfm file). Nothing to fix.
- "Message the seller" / "Zap the seller": not in the real site, skipped.
- Home "two account cards", and the kit's calendar/market/rooms/cart, do not exist in the real site, skipped. Home 4-up cards were already equal height; single-line titles are now enforced.
- Footer-to-bottom is a CSS rule on `main.min-h-screen:has(> footer)` (flex column, footer margin-top auto, children width 100%). The root 404 has no header/footer, so none appears there.
- The BuyPanel money button is not visible in shots (payment rail not connected locally); same class.
- Welcome step chips: GO PLAY wraps to a second line at 390 (pre-existing chip row).
- /a console components keep their LCARS styling beyond what `.btn-pill` inherits; link-style text buttons were left as links.
- Shots used a dev catalog copied from the kit (`data/store-catalog.json`, gitignored).
- `npm ci` refused (npm 12 blocks the remote-tarball dependency); node_modules was copied from the main checkout (same lockfile).
- Em dashes remain in untouched body copy (hero paragraph, footer, welcome); only labels I touched were fixed.

## Gates
lint: 40 problems (38 errors, 2 warnings), identical to origin/main (delta zero). build: green.

Revision: `e9e8576`

## Screenshots (/home/pac/dev/apps/frens-glass-969999/shots-real-r3/)
home, store, product, me, welcome, menu, 404, each as `<page>-1440.png` and `<page>-390.png`.

## Round 3b: the clock strip

The Admiral: the old clock at the bottom right should be gone in the new design.

- Removed the floating corner clock (BftClock, fixed bottom-3 right-3) from src/app/layout.tsx. BftClock.tsx itself is untouched. Nothing else on the site is fixed to the bottom right.
- The same numbers now sit on one thin dark-glass line directly under the header (ArcadeHeader.tsx, .clock-strip in strip-clock.css): `0018.07.17  22:26:48 aB`, BFT date then hh:mm:ss then aB, no block height. Far right on wide screens, centred full width at phone size. It is in normal flow, never fixed, so it cannot cover content.
- No new engine: StripClock and strip-clock-engine.ts run as before (house node first, held at 9:59); the CSS only restyles their DOM (ghost ring, flip chrome, height and old calendar hidden). The date line now reads "aB" in text instead of the lone glyph.
- Checked at 1440 and 390: home, /store, /welcome, /me. The 404 has no header, so no strip and no corner clock.
- Pictures: /home/pac/dev/apps/frens-glass-969999/shots-real-r3/strip-<page>-<width>.png

Revision: `d6b526d`
