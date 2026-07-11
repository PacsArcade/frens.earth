# Displaying Bitcoin Time — the house standard

*Codified 2026-07-11 from the admiral's direction. The lore is ours; the
ergonomics are borrowed from the clock every person already reads — the OS
tray. Easy for people. Implementation lives in `src/lib/bb/bft.ts`.*

## The tray-clock widget (GLYPH's item)

Wherever SCAR (and the site) shows the running clock, use the **stacked
tray-clock** layout — time on top, date below, exactly like the OS taskbar
(admiral's screenshot, 2026-07-11):

```
   14:30          ← bftTime(height)   — bigger line
 0018.04.15       ← bftDatePlain(height) — smaller line
```

- Compact, right-aligned corners feel native (the BftClock bubble already
  lives bottom-right).
- Optional third microline for the lore: `beat 124/144 · ▣ 957,580`.
- GLYPH owns the visual pass: type sizes, the ▣/beat garnish, where it
  appears across SCAR. The layout above is the contract.

## How to stamp things (for everyone writing UI)

| you're showing | use | looks like |
|---|---|---|
| a running clock | `bftTime(h)` over `bftDatePlain(h)` | `14:30` / `0018.04.15` |
| when a thing happened (rows, logs, tickets) | `bftDateTime(h)` | `0018.04.15 14:30` |
| a date alone | `bftDatePlain(h)` | `0018.04.15` |
| a ceremonial/formal date | `bftDate(h)` | `a₿ 0018.04.15` |
| the block itself matters | prefix `▣ {h.toLocaleString()} · ` | `▣ 957,580 · 0018.04.15 14:30` |
| an estimated stamp (no recorded block) | prefix `~ ` | `~ 0018.04.15 14:30` |

## The year — bitcoin's age, no explaining required

**Years start at 0** (already true in `bft.ts`: genesis block 0 opens year
`0000`), so **the display year IS bitcoin's age**. We're in `0018` — bitcoin
is 18. One BFT year = 52,416 blocks (13 months × 28 days × 144), about 364
wall-days, so the ₿-birthday drifts slowly off the January calendar — which
is fine, because the calendar is not the reference. The block is.

The one-line explainer, if anyone asks: *"the year is how old bitcoin is."*

Rules of thumb:
- **The `a₿` marker is assumed on new items** (queues, requests, logs) — only
  ceremony surfaces (profiles, certs, keepsakes) wear it.
- **Time is the block-beat**: a BFT day is 144 blocks on a 24-hour clock —
  6 blocks an hour, ten "minutes" a block. `hh:mm` steps by ten.
- **Never show the old calendar.** If a legacy record only has a wall-clock
  timestamp, convert with `estimateHeight(ms)` and mark it `~`.
