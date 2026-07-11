# The Ship's Calendar — public time for every fren (spec)

*The admiral's direction, 0018.04.15 a₿. Lanes: plumbing = Claude ·
design = GLYPH. First plumbing already sailing: SCARLET surfaces the
GitHub key's real expiry and hands out an `.ics` renewal event (PR #20).*

## Why

Three needs arrived together:

1. **Key renewal** — a GitHub key expires every 90 days. Connecting one
   should create a calendar event to review/renew it, and the upcoming
   expiry is a line item on the SCAR brief.
2. **The remote captain's welcome** — when a new captain stands up a
   frens.hip, they get a **meeting invite** with the admiral (or someone
   in a similar position) to approve their setup. Onboarding is a
   ceremony with a human in it, not a form.
3. **Ceremonies are dates** — anchor batches, newsletters, drills, rank
   reviews. The crew needs one public place to see what's coming.

## The shape

- **Public calendar page** (`/calendar`) — everyone can read it, no login.
  Operators add/edit from the console (a CALENDAR room on the deck).
- **`.ics` both directions** — every event downloads as `.ics` (works in
  every calendar app on earth), and the operator can import `.ics` files
  in. The wire format is the old calendar (that's what the world's
  calendar apps speak); the **display is BFT** — `0018.04.15 a₿`, blocks
  till the event (`▣ ~2,160 blocks out`). The bridge, not a surrender.
- **Auto-events** (plumbing writes them, nobody has to remember):
  - key connected at SCARLET → "renew the GitHub key" event 7 days before
    expiry (GitHub reports the real expiry on every API response —
    already captured);
  - new deployment claims its first operator → "welcome ceremony" invite
    template (the admiral-or-peer approval meeting);
  - anchor ceremony recorded → its date on the public record.
- **SCAR brief line** — "KEYS: 1 expiring within ▣ 2,016 blocks (14 days)"
  joins the reporting.

## Build order

1. `lib/calendar.ts` dual-driver store (same pattern as tickets/merges):
   `{ id, title, whenUtc, blocksHint, kind: key-renewal|ceremony|meeting|
   custom, ics: derived }`.
2. `/calendar` public page + CALENDAR console room (add to
   `CONSOLE_ROOMS`).
3. `.ics` export per event + feed (`/calendar.ics` — subscribable);
   import box in the console room.
4. Meeting-invite template for the welcome ceremony (attendee emails →
   `.ics` with ORGANIZER; sending stays manual — the operator's mail is
   theirs).
5. SCAR brief hook: expiring keys + next 3 events.

House rules that bind this: BFT on every displayed date (rule 3) ·
honest empty states ("no events yet — the sea is calm") · no fren data
leaves the ship (invites are files you send, not emails we send).
