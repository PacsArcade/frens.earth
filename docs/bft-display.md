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

## The year — lead with block time, and explain it

**Years start at 0** (genesis block 0 opens year `0000` in `bft.ts`), and one
BFT year = **52,416 blocks** (13 months × 28 days × 144). So the year is simply
`⌊height / 52,416⌋`. **Year `0018` began at block 943,488** (18 × 52,416) and
we're well past it — so the year is **`0018`, and that's correct.** Block time
is the reference, not the sun. **The block doesn't lie.**

Someone will notice the old calendar disagrees — so here's the honest answer,
and why we still lead with the block:

- **By the block (what we keep):** bitcoin has lived **18** block-years → year `0018`.
- **By the sun (the old way):** born Jan 3, 2009, so by birthdays it turns 18 on
  Jan 3, 2027 (2027 − 2009 = 18) — the old count still says "17" today.

Both are honest; they just read different clocks. They diverge because **block
time runs ahead of sun time** — early blocks came faster than ten minutes, and a
BFT year is a clean 364 days — roughly **eight months ahead** right now. And they
**meet at Day 0**: the new moon just after bitcoin's eighteenth birthday (the
birthday is Jan 3, 2027 ≈ block 983,100; the new moon that opens the new calendar
falls ~Jan 7, 2027 ≈ block 983,664), when the sun has counted to 18 and agrees
with what the block already knew. That convergence is why **Day 0 is where the new
calendar begins.**

We lead with the block because it has kept honest time since block 1, while the
old calendar was shoved around by emperors and popes for centuries. *the year is
how old bitcoin is — measured by the only clock that never lied.*

Rules of thumb:
- **The `a₿` marker is assumed on new items** (queues, requests, logs) — only
  ceremony surfaces (profiles, certs, keepsakes) wear it.
- **Time is the block-beat**: a BFT day is 144 blocks on a 24-hour clock —
  6 blocks an hour, ten "minutes" a block. `hh:mm` steps by ten.
- **Never show the old calendar.** If a legacy record only has a wall-clock
  timestamp, convert with `estimateHeight(ms)` and mark it `~`.
