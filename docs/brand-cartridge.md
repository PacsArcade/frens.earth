# The Brand Cartridge — /a/brand goes SCAR (spark for GLYPH)

*Sparked 2026-07-11 by the admiral, from GLYPH's own "Brand Cartridge"
wireframe. Two halves: GLYPH restyles the dressing room; Claude plumbs the
sovereign cartridge format underneath.*

## The ask

`/a/brand` (the BrandTester) doesn't match the rest of the admin — bring it
into the SCAR house style, redesigned as GLYPH's cartridge wireframe:

- **INSERT A CARTRIDGE** — every theme is a game cartridge on a shelf:
  swatch strip + name + vibe line (`frens.earth · NIGHT GARDEN`,
  `pac's arcade · MIDNIGHT NEON`, `degen wonderland · WONDER`). The inserted
  cartridge glows `▸ INSERTED`.
- **LIVE PREVIEW** — the right pane re-skins a real component stack
  instantly on insert; the pick is remembered.
- **`my home space` cartridge** — resolved from YOUR key (the space your tag
  lives in supplies your default look).
- **the empty slot** — a dashed `+ INSERT THEME HERE` inviting a fren to
  bring their own community's cartridge. The "?" opens the explainer.

## The plumbing underneath (Claude's half, round-3+)

The wireframe's thesis, worth building exactly as written: **every space
publishes its brand — colors, fonts, copy — as a signed nostr note.**

- Serialize `BrandTheme` (src/lib/brand/contract.ts already IS the schema)
  into a nostr event signed by the space's key; fetch + verify + apply at
  runtime. Nothing hardcoded — all pointers.
- Cartridge picks persist per fren; "my home space" resolves via the
  wardrobe (tag → space → its published cartridge).
- Verification rule stays house-standard: a cartridge is only "signed" if
  the note verifies against the space's known key (NIP-05 / registry).
- This subsumes the themeable-signin migration (docs/
  themeable-signin-plugin.md B2/B3) — the copy moves into the cartridge.

Ties: [wardrobe](wardrobe.md) (key→space resolution) · brand contract
(`src/lib/brand/`) · the dressing room becomes the cartridge shelf.
