# Displaying Bitcoin Time — the house standard

*Codified 0018.04.15 a₿ from the admiral's direction. The lore is ours; the
ergonomics are borrowed from the clock every person already reads — the OS
tray. Easy for people. Implementation lives in `src/lib/bb/bft.ts`.*

## The tray-clock widget (GLYPH's item)

Wherever SCAR (and the site) shows the running clock, use the **stacked
tray-clock** layout — time on top, date below, exactly like the OS taskbar
(admiral's screenshot, 0018.04.15 a₿):

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
| a ceremonial/formal date | `bftDate(h)` | `0018.04.15 a₿` — the marker rides AFTER the date (amended 0018.04.15 a₿); pre-genesis wears `b₿` the same way |
| the block itself matters | prefix `▣ {h.toLocaleString()} · ` | `▣ 957,580 · 0018.04.15 14:30` |
| an estimated stamp (no recorded block) | prefix `~ ` | `~ 0018.04.15 14:30` |

## The month — why 04 isn't April (or July)

The admiral's question, 0018.04.15 a₿: *"it says month 4 — what month is
it really?"* Both calendars are real; they just count from different
starting lines:

- A BFT month is **28 days (4,032 blocks)**, and there are **13** of
  them — they never line up with the old months.
- The BFT year doesn't start January 1. It starts when the chain crosses
  a year boundary: year 0018 opened at **block 943,488** (≈ old-calendar
  early April 2026).
- So "month 04" means: **the 4th 28-day month since the bitcoin new
  year**. Today's arithmetic: 957,607 − 943,488 = 14,119 blocks in →
  3 full months (12,096) + 2,023 → month 04, day 15, beat 007 — exactly
  what the clock's microline shows.
- The bitcoin new year **walks backward** through the old calendar ~1–2
  days a year (a BFT year is 364 wall-days), so no fixed lookup will
  ever hold. The block is the truth; the old months are scenery.
- Want to feel it instead of computing it? The `/bday` date-picker
  converts any old date — today included.

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
