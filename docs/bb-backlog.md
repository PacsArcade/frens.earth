# Bitcoin Buddy — the admiral's wishlist (GLYPH's round)

*Parked 2026-07-11. Design lead: GLYPH. Reference build: the earlier /bb
prototype in `C:\dev\aceo-playground` (has the SHOW CARD pattern) plus
`C:\dev\bitcoin-buddy-prototype.html` / `bb-cartridge-wireframe.html` and
`C:\dev\pet-game-design-notes.md`. Plumbing hooks below are Claude's lane.*

1. **SHOW CARD** — a flip/expand for the buddy's details (stage, age, traits,
   born-block lore) so the top of /bb declutters. The old aceo-playground
   build had this; port the pattern, GLYPH restyles.
2. **World time = Bitcoin time** — the buddy's scene runs on the BFT clock
   (`src/lib/bb/bft.ts`), defaulting to a 24-hour display synced to blocks,
   and the sky shows the ACTUAL block-timed moon (`moonPhase(height)` — one
   lunation per 28-day BFT month). Day/night from the block, not the OS.
3. **Moon/time effects** — buddies react to the calendar: full-moon behavior,
   new-year confetti, halving-shadow rare moods. Same deterministic time-lore
   system as cert cases and fleet ranks: look at the block.
4. **CAMERA — a photo WITH your buddy, posted to nostr** — getUserMedia +
   canvas composite (buddy sprite over the frame), then a kind-1 note signed
   by the fren's key. Defaults: posts to THEIR profile, includes the @frens
   tag/hashtags pointing at this site (#bitcoinbuddy #frens + a link).
   Plumbing: composite + NIP-07 signEvent + relay publish; GLYPH: the frame,
   the sticker sheet, the moment.

5. **TOP-OF-PAGE CUTOFF** (screenshot 2026-07-11) — the /bb header area
   clips/blurs under the main frens.earth menu on some viewports; the KEY
   CONNECTED card gets cut. Layout/overflow pass on the /bb page top —
   assigned to GLYPH with the rest of the /bb visual round.

House rules apply: keys never leave the signer; posting is one explicit
button, never automatic; npub is plumbing, the tag is the name.
