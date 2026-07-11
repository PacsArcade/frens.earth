# NUMBER ONE ON THE FLOOR — the @no1 bridge (spec, not build)

*Commissioned 0018.04.15 a₿ by the admiral: "I want to talk to my agent from
the chat app." This document is the design — nothing here ships code. It
binds to the house rules (docs/house-rules.md) in full, and it rides the
chat stack documented in RTFM 004 (the gated door, the NIP-29 floor).*

## The ask

The admiral opens the chat floor (the orbee door at chat.frens.earth),
types `@no1 what's in the merge queue?`, and the ship's agent answers —
on the floor, in front of the crew, signed by its own key.

## The one law before all others

**@no1 is its own creature.** It gets a dedicated nostr keypair, generated
on the VPS and living only there. It is NEVER the admiral's key, never a
fren's key, never a key that signs merges or certs. If the bridge box burns,
the blast radius is one chat identity — rotate by ceremony and sail on.

## Architecture

```
the floor (NIP-29 relay, e.g. stations.frens.earth)
   │  wss — subscribe kind 9, h=<station>
   ▼
the bridge (small daemon on the VPS — Python or Node, staff meeting picks)
   │  · trigger check (addressed? rate ok? muted?)
   │  · context assembly (thread snippet, station name, house prompt)
   ▼
Claude (runtime TBD — Claude API vs headless Claude Code, see open questions)
   │  reply text
   ▼
the bridge signs kind 9 with @no1's key, h=<station>, reply-tagged
   ▼
the floor — the crew sees @no1 answer
```

Components:

- **The keypair** — see key ceremony below. Stored on the VPS only
  (file mode 0600, service user `no1`, no backups that leave the box).
- **The bridge service** — one small daemon (systemd unit) holding two
  secrets: @no1's nostr key and one Claude credential. It speaks
  WebSocket to the station relay and HTTPS to the Claude runtime.
  No inbound ports; it dials out.
- **The floor** — the same NIP-29 station the crew already uses. The
  bridge is just another member with a funny job.

## Identity — the key ceremony (phase ①)

1. On the VPS, as the `no1` service user: generate the keypair
   (`nak key generate` or equivalent), write to `/etc/no1/nsec` (0600).
   The private key is displayed to no one — not even the admiral.
2. Publish @no1's kind-0 profile from the box: name `no1`, about
   "the ship's number one — the agent's voice on the floor", picture
   from the house art (no Disney, obviously).
3. Give it a checkable name per house rule 8: NIP-05 `no1@frens.earth`
   in the registry, so anyone can verify the bot is THE bot.
4. The admiral (station admin) adds @no1 to the station. Membership is
   visible — the crew always knows the agent is in the room.
5. Record the ceremony in the ship's log with the block height.

Rotation = repeat the ceremony, retire the old npub in the registry,
announce on the floor. Compromise = same, faster.

## Conduct — consent and rate rules

- **Speaks only when spoken to.** @no1 replies only when addressed: an
  explicit `@no1` mention or a direct reply to one of its own messages.
  It never initiates, never DMs first, never comments unprompted.
  (Phase ③ announcements are the one exception — see below — and those
  are operator-configured, not model-decided.)
- **Rate limits, both directions:** per-fren cooldown (default: 1 open
  request at a time, max N replies per fren per hour) and a global
  ceiling per day tied to the spend limit. Over the limit → an honest
  "I'm rate-limited, try after block X" — never silence.
- **The mute switch.** Any operator npub can post `@no1 mute` on the
  floor (or touch a kill file on the box) and the bridge goes read-only
  until `@no1 unmute`. The mute state is announced honestly.
- **Honest failures.** Claude unreachable, budget exhausted, relay down —
  @no1 says so in plain words, or the operator sees it in the journal.
  No pretending (house rule: honest states).
- **No impersonation.** @no1 speaks as itself. It never signs as, quotes
  private words of, or claims the authority of the admiral. Its word
  authorizes nothing — SCAR signatures remain the only approvals.
- **The floor is untrusted input.** Everything read from the relay is
  treated as adversarial (prompt injection is table stakes on a public
  protocol). The bridge's system prompt states it; phase ② gives the
  model no tools, so the worst a poisoned message can do is produce a
  bad paragraph — which the crew can see and mock.

## Keys and secrets — what lives where

| secret | lives | never |
|---|---|---|
| @no1 nsec | `/etc/no1/nsec` on the VPS, 0600 | in the repo, in env on Vercel, in chat, on the dev machine |
| Claude credential | VPS service env (systemd `LoadCredential` or 0600 env file) | in the repo, in logs |
| admiral's keys | wherever they already live | ANYWHERE near this service |

## Phases

- **① Key ceremony + read-only presence.** Generate, profile, NIP-05,
  join the station, lurk. Deliverable: @no1 visible in the member list,
  verifiable at `no1@frens.earth`, zero posts. Proves identity plumbing
  with no model in the loop.
- **② Mention-reply bridge.** The daemon subscribes, trigger-checks,
  assembles context (the addressed message + a short thread window +
  a house system prompt), calls the runtime, posts one signed reply.
  Rate rules and the mute switch ship IN this phase, not after it.
- **③ SCAR integration.** Crew-board updates flow TO the floor:
  task_complete summaries, merge-queue counts, finding reports —
  operator-configured announcement rules, strictly one-way
  (SCAR → floor). The floor never writes to SCAR, the repo, or the
  queue through @no1. If the admiral wants actions, he asks his real
  console — the bot is a voice, not a hand.

## Open questions for the staff meeting

1. **Which runtime hosts the brain?**
   - *Claude API (Messages)* — smallest surface, predictable per-token
     spend, no tools, stateless; the bridge stays ~200 lines.
   - *Headless Claude Code* — can actually look things up (repo, SCAR
     state) before answering; but a far bigger blast radius on a box
     holding a signing key, and permissions need real design.
   - Middle road: API-only in phase ②, revisit for ③ with a read-only
     tool allowlist. (Recommended default; decide at the meeting.)
2. **Spend limits.** Hard daily cap? Who watches the meter, and does
   @no1 announce its own budget exhaustion on the floor?
3. **Logging.** The floor is semi-public, but bridge logs (full context
   windows, errors) hold more than the floor shows. Proposal: journald
   only, 14-day rotation, no message bodies at error level. Confirm
   retention and whether logs count as crew records for the ship's log.
4. **Which box.** The relay's VPS, or a separate small instance so the
   floor and the voice don't share fate?
5. **Does @no1 get a Spaces handle** (protocol-level name, per the
   RTFM 004 fleet table) or is NIP-05 enough for a deckhand?
6. **Moderation powers: none proposed.** @no1 holds no admin role on
   the station. Confirm, or argue at the meeting.
