# Bitcoin Holidays — the official Pac's Arcade calendar (BFT-mapped)

Commissioned by the admiral's order, 0018.04.15 a₿ — every day the chain
remembers, mapped onto Bitcoin Federated Time. Verified against the chain
itself (block heights via mempool.space timestamp lookups, tip 957,605 at
research time) and the sources below.

| holiday | the story (one line) | old-calendar date | anchor | block height | BFT date | recurrence note |
|---|---|---|---|---|---|---|
| Whitepaper Day | Nine pages land on the metzdowd cryptography list on Halloween: "Bitcoin: A Peer-to-Peer Electronic Cash System." | Oct 31, 2008 | pre-genesis (b₿) | — (no blocks yet) | 0000.03.08 b₿ | annual Oct 31; drifts +1–2 BFT days/yr |
| Satoshi's Birthday | The birthday Satoshi chose: the day gold was seized (EO 6102, 1933) and the year it was freed (1975) — symbolic, never proven | Apr 5, 1975 | pre-genesis (b₿) | — | ≈ 0033.12.07 b₿ | annual Apr 5; lore-grade, keep it light |
| Genesis Block Day | Satoshi mines block 0 with the Times headline folded inside: "Chancellor on brink of second bailout for banks." | Jan 3, 2009 | block-native | 0 | 0000.01.01 a₿ | the pure anniversary is every 52,416 blocks — BFT New Year's Day, yyyy.01.01; gregorian Jan 3 drifts +1–2 BFT days/yr |
| Running Bitcoin Day (Hal Finney Day) | Hal Finney tweets "Running bitcoin" — the first believer, out loud | Jan 10, 2009 (Jan 11 UTC) | gregorian-bridge | ≈ 78 | 0000.01.01 a₿ | annual Jan 10; the tweet came before block 144 existed, so Hal shares BFT day one with genesis |
| Bitcoin Pizza Day | Laszlo Hanyecz pays 10,000 BTC for two Papa John's pizzas — the first real-world purchase, the most expensive dinner ever | May 22, 2010 | gregorian-bridge | 57,043 | 0001.02.05 a₿ | annual May 22; drifts +1–2 BFT days/yr |
| Satoshi Vanishing Day | Post #575, his last: DoS patches shipped, then quiet — the chain keeps going without him | Dec 12, 2010 | gregorian-bridge | ≈ 97,230 (est.) | 0001.12.04 a₿ | observed by some on Dec 12; modest adoption |
| First Halving | The subsidy halves, 50 → 25 BTC — the schedule holds | Nov 28, 2012 | block-native | 210,000 | 0004.01.03 a₿ | one-time; halving season returns every 210,000 blocks |
| HODL Day | GameKyuubi, whiskey in hand, mid-crash: "I AM HODLING" — a typo becomes a creed | Dec 18, 2013 | gregorian-bridge | ≈ 275,603 | 0005.04.10 a₿ | annual Dec 18; drifts +1–2 BFT days/yr |
| Second Halving | 25 → 12.5 BTC — the schedule holds | Jul 9, 2016 | block-native | 420,000 | 0008.01.05 a₿ | one-time |
| Bitcoin Independence Day | BIP-148 flag day: users, not miners, enforce the rules — big blocks fork off as BCH (block 478,558) and SegWit's path clears | Aug 1, 2017 | gregorian-bridge | ≈ 478,479 (flag-day start) | 0009.02.19 a₿ | annual Aug 1; drifts +1–2 BFT days/yr |
| SegWit Day | SegWit activates at block 481,824 — malleability fixed, Lightning unlocked | Aug 24, 2017 | block-native | 481,824 | 0009.03.15 a₿ | one-time; modest adoption |
| Proof of Keys Day | Trace Mayer's yearly drill on genesis day: pull your coins off the exchanges and prove they're yours | Jan 3, annually since 2019 | gregorian-bridge | first: ≈ 556,759 | 0010.09.03 a₿ (first observance) | annual Jan 3, riding with Genesis Day |
| Third Halving | 12.5 → 6.25 BTC — the schedule holds, even mid-pandemic | May 11, 2020 | block-native | 630,000 | 0012.01.08 a₿ | one-time |
| Taproot Day | Schnorr signatures land — and 709,632 = 176 × 4,032, so it activated exactly on a BFT month boundary | Nov 14, 2021 | block-native | 709,632 | 0013.08.01 a₿ | one-time; modest adoption |
| Fourth Halving | 6.25 → 3.125 BTC — mined on 4/20, because of course it was | Apr 20, 2024 | block-native | 840,000 | 0016.01.10 a₿ | one-time |
| Fifth Halving (next) | 3.125 → 1.5625 BTC — the fifth tightening, already on the books | ≈ Apr 2028 (estimates run Mar–May) | block-native | 1,050,000 | 0020.01.12 a₿ | future; the date drifts with hashrate, the block does not |

**Calendar notes:**

- Every halving so far — and the next — lands in **BFT month 1**, each one
  2⅓ days later than the last (days 1, 3, 5, 8, 10, 12…). The BFT year
  opens with halving season every fourth year, and that holds until the
  12th halving (block 2,520,000, ~2056) finally rolls into month 2.
- Pre-genesis (b₿) dates count backward from block 0 in the same 28-day
  months, 364-day years — a house convention, flagged where used.
- Considered and left off: the Silk Road seizure (Oct 2013 — a bust isn't
  a birthday) and difficulty-adjustment days (every 2,016 blocks is
  rhythm, not holiday).

## The 18th birthday

Bitcoin turns 18 on **January 3, 2027** — eighteen gregorian years of
unbroken chain. Because blocks have averaged a touch under ten minutes,
BFT already rang in year 0018 at block 943,488 (~early April 2026); the
Jan 3 party is the gregorian birthday, and it's the one the admiral
ordered blocked off.

- **Birthday:** Jan 3, 2027 ≈ **block 983,100** (estimated from tip
  957,605; re-pin the height as the date approaches) = **0018.10.24 a₿**
- **The blocked week** (standing order — the 7 days / 1,008 blocks
  before, reserved on the official calendar):
  - **Start:** ≈ block 982,100 — **0018.10.17 a₿** — ≈ Dec 27, 2026
  - **End:** ≈ block 983,100 — **0018.10.24 a₿** — Jan 3, 2027, the day
- Coming of age: 18 years is ~946,000+ blocks, four halvings survived,
  and no bailout headline needed since the first one.

## Sources checked

- https://mempool.space/docs/api/rest (block-height-at-timestamp lookups: 2009-01-11 → h78, 2010-05-22 → h57,041, 2010-12-12 → h97,228, 2013-12-18 → h275,603, 2017-08-01 → h478,478, 2019-01-03 → h556,758; tip 957,605)
- https://x.com/halfin/status/1110302988
- https://www.cointribune.com/en/hal-finney-bitcoin-pioneer-honored-17-years-after-tweet/
- https://en.bitcoin.it/wiki/Laszlo_Hanyecz
- https://www.forbes.com/sites/colinharper/2025/05/22/the-man-behind-bitcoin-pizza-day-spent-more-bitcoin-than-you-think/
- https://www.metzdowd.com/pipermail/cryptography/2008-October/014810.html
- https://satoshi.nakamotoinstitute.org/emails/cryptography/
- https://bitbo.io/halving/
- https://www.swanbitcoin.com/education/bitcoin-halving-dates/
- https://www.coingecko.com/en/coins/bitcoin/bitcoin-halving
- https://www.citadel21.com/bitcointalk-chronicles-the-origin-of-hodl
- https://bitbo.io/calendar/hodl/
- https://hackernoon.com/not-your-keys-not-your-bitcoin-jan3bitcoin-z6k3ktb
- https://bitcoinmagazine.com/culture/video-trace-mayer-on-proof-of-keys-sovereignty-and-bitcoin-privacy
- https://blockworks.com/news/satoshi-nakamoto-last-online
- https://news.bitcoin.com/satoshi-walked-away-15-years-ago-the-575th-forum-post-marked-the-moment-bitcoin-stood-on-its-own/
- https://en.wikipedia.org/wiki/Satoshi_Nakamoto
- https://decrypt.co/313481/happy-birthday-satoshi-nakamoto-bitcoin
- https://bitbo.io/calendar/bitcoin-independence-day/
- https://bitcoinmagazine.com/culture/bitcoin-independence-day-how-this-watershed-day-defines-community-consensus
- https://bitcoinmagazine.com/technical/segregated-witness-activates-bitcoin-what-expect
- https://bitcoinannotated.com/entries/taproot/
