# REVIEW: glass doors (lane C1, reading only)

Branch `glass/doors` (from `glass/round-3`). Local only, not pushed.
Revision: `4381c22`

## Routes
- `/calendar`, `/calendar/[id]` (id = event id, 64 hex), `/market`, `/market/[id]` (id = listing event id), `/rooms`. Each in the site shell with ArcadeHeader and EarthFooter. Server wrapper plus a client view; relay reads run in the browser.
- Nav: header links SHELF, CALENDAR, MARKET, ROOMS, PLAY, LEARN, GROW. The phone menu renders the header links under the menuSlot rows, so it reads SIGN IN, WELCOME, SHELF, CALENDAR, MARKET, ROOMS, PLAY, LEARN, GROW (verified in menu-390.png). `FrenMenu.tsx` was not touched. `tickerSlot` and StripClock were not touched.
- Phone bottom tab bar: not built. It would stack with the floating clock and the header menu at 390; left for round 4.

## Data reads (client side, nostr-tools SimplePool, maxWait 6 s)
- Config: `content/doors.json`. Relays: relay.damus.io, nos.lol, relay.nostr.band, relay.primal.net, nostr.wine. `authors` empty for all three doors (the Admiral fills them), `tags` = ["frens"] (filter `#t`).
- Calendar: kinds 31922, 31923, limit 300, allow list applied. Latest addressable version wins. RSVP count on the event page: kind 31925 with `#a` of the event coordinate, unique pubkeys with status accepted. Host name: kind 0 (display_name, else name), else `npub1...<last4>`.
- Market: kind 30402, limit 400, allow list applied. Price tag `["price", n, cur, period]`: SATS/SAT shown as sats, BTC converted to sats, 0 = free, other currencies printed as given (no USD conversion; the site has no rate helper). Sold listings hidden. Categories from `t` tags (house tags hidden), counts, search, With pictures, Sats only, 16 per page.
- Rooms: kind 30311 (allow list applied; status live or planned only) plus kind 31923 with `#t` room or rooms (authors from the allow list). Source chip from the room link host ("Corny Chat" for cornychat hosts).
- Dates: BFT first via the site's `estimateHeightAt` anchored on the live tip (`currentBlockInfo`), old date small and second. Past and future dates are an estimate from the tip, so the old date is always printed. Month grid = BFT month of the tip, 7 by 4, Back and Next buttons. No weekday headers (BFT has none).
- No sample rows anywhere. Empty and loading states are real states.

## Disabled, and why
- Going, Maybe, Can't go (event page) and Message seller, Zap seller (listing page) are `disabled` with the note "Signer needed, coming next." No posting in this lane.

## Marks applied
Calendar list scrolls on its own while the month stays put (sticky, phones month first); filters All, Meetups, Classes, Rooms one equal group. Event: host name or npub1...last4, centred equal row of three. Listing: "Message seller" and "Zap seller", centred, same size. Market: category column with counts, filter and pager buttons flush right, same size, no bad wrapping at 390. Rooms: Join centred on each card. Room video: note only, not built.

## Strings (new)
"Nothing published yet." / "Events anyone with a key can publish will show here. ..." / "Listening to the relays" / "Reading {what} from public nostr relays. This can take a few seconds." / "Signer needed, coming next." / "That event is not on the relays we read." / "That listing is not on the relays we read." / "No live rooms right now." / "Nothing scheduled yet." / "Join" / "No room link published." / "Meet in person or trade on trust. Nobody here holds the money." Calendar filter "Rooms" kept per brief (the Admiral's note suggested hangouts or virtual; open for his word).

## Gates
- `npm run lint`: `✖ 40 problems (38 errors, 2 warnings)` (identical to the branch base, delta zero).
- `npm run build`: `✓ Compiled successfully in 2.4s`, `✓ Generating static pages using 15 workers (29/29)`; routes listed: /calendar, /calendar/[id], /market, /market/[id], /rooms.
- Layout check (round 3 method, own CDP script, true 1440 and 390): no sideways scroll on any page, no off-centre buttons, equal button groups, no square buttons. Empty-state set: ALL CLEAN. Populated set (see below): remaining lone-last-word hits are only relay content (long place names and one garbage title from a public relay), plus nothing in fixed copy. Titles are now clamped to 3 lines after that run (CSS only, not re-shot).

## Pictures
`/home/pac/dev/apps/frens-glass-969999/shots-real-doors/`
- With real relay data (shot with a temporary tags-free config, then restored to ["frens"]): calendar, event, market, listing, rooms at -1440 and -390, plus menu-390.png.
- Real config, empty states: calendar-empty, market-empty, rooms-empty at -1440 and -390 (event-empty and listing-empty are the same detail pages by id).
