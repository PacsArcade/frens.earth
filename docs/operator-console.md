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
| notifications | `Notice` | per-id, drop in anywhere |
| ship's log | `ShipsLog`, `lib/shiplog` | committed entries |
| time | `lib/bb/bft` + `docs/bft-display.md` | the standard |

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
