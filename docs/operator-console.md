# The Operator Console — a module, not furniture

*Declared 0018.04.15 a₿ (Pac): the console is a GENERAL FRAMEWORK to template
when building sites from this repository. First consumers besides
frens.earth: **pacsarcade-org** and **onecocreation**.*

## What the module is

Everything behind `/a`, as one portable layer:

| piece | file(s) | configured by |
|---|---|---|
| the gate (key-is-the-operator) | `OperatorGate`, `lib/operator-auth` | `OPERATOR_NPUBS`, `SEAT_SECRET` |
| the bridge rail + deck | `AdminNav`, `app/a/page` | **`lib/console.ts` — the manifest** |
| room registry | `CONSOLE_ROOMS` in `lib/console.ts` | add/remove entries |
| site identity (the ⌂ way out) | `CONSOLE_SITE` | `NEXT_PUBLIC_NIP05_DOMAIN` / `SPACE_NAME` |
| tickets (raise/work) | `TicketsPanel`, `lib/tickets` | works with zero infra |
| merge queue (sign to authorize) | `MergeQueue`, `lib/merges` | `GITHUB_TOKEN`, `GITHUB_REPO` |
| node links (spaced / MUD) | `SpacesPanel`, `MudPanel`, `lib/nodeconfig` | from the GUI |
| chat floor (the orbee door) | `ChatPanel`, `lib/nodeconfig` | from the GUI; falls back to `CHAT_NODE_URL`, then chat.frens.earth |
| the chat gate (public side) | `app/chat/route.ts` + `next.config.ts` rewrite | fren session required — see below |
| notifications | `Notice` | per-id, drop in anywhere |
| ship's log | `ShipsLog`, `lib/shiplog` | committed entries |
| time | `lib/bb/bft` + `docs/bft-display.md` | the standard |

## The chat door — gated, never raw (0018.04.15 a₿)

The floor is for signed-in frens; the node URL is never exposed to the
anonymous public. `/chat` (`src/app/chat/route.ts`) is the gate: a fren
session (`frenFromRequest`) bounces you 307 on to the configured chat node
(`effectiveChatNode()`); no session lands you on `/login`. If no real node is
linked (the default still points at the door domain itself), the gate says so
honestly instead of chasing its own tail.

**DNS: `chat.frens.earth` must point at the frens-earth Vercel project** —
not at orbee. `next.config.ts` rewrites that host's root to `/chat` so the
gate runs before any door opens. (The arcade redirects chat.pacsarcade.org
straight out to orbee; ours goes through the gate on purpose.) Every door in
the UI — the console's OPEN THE CHAT ▸ included — links `/chat`, never the
raw node.

## How a templated site gets its console

1. Fork/template this repo (`npm install && npm run dev` is the install).
2. Set the env identity (`NEXT_PUBLIC_SPACE_NAME`, `NEXT_PUBLIC_NIP05_DOMAIN`,
   `OPERATOR_NPUBS`, `GITHUB_REPO`) — the deck kicker, the ⌂ exit, and the
   merge queue follow automatically.
3. Edit `CONSOLE_ROOMS` for the site's rooms (drop MUD, add your own).
4. The brand cartridge (docs/brand-cartridge.md) re-skins the whole console.

## Modularization ledger — what's done, what's next

- ✅ Rooms + site identity → the manifest (`lib/console.ts`); AdminNav and
  the deck render from it; the ⌂ exit derives from env.
- ⏳ Room panels still carry `FRENS.EARTH` kicker strings — sweep them onto
  `CONSOLE_SITE.domain` next pass.
- ⏳ Extract to a package (with arcade-ui) once both consumer sites exist —
  until then the template IS the distribution.
