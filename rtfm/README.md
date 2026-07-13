# RTFM

**Read The F***ing Manual.** And it's exactly the point.

We put real work into all of this — the tags, the block, the box, the world.
The knowledge is here for anyone who wants it. You don't have to read it. But
the frens who do get the good stuff. **There's magic in every article for
those who look hard enough.**

This is the knowledge repo of the SCAR world: manuals, runbooks, and
explainers, written to be actually read. One house style, so they read as one
body of work.

## The articles

| # | Article | What it is |
|---|---------|------------|
| [001](001-the-sovereign-box.html) | **The Sovereign Box** | Wipe Windows, install Arch forever, keep it a gaming rig, host the stack. |
| [002](002-first-deployment.html) | **Your First Deployment** | The git ceremony in arrows — clone → run → deploy, terse bullets for total beginners. |
| [003](003-treasury-rescue.html) | **Treasury Rescue** | BTCPay damage control — locked out of the panel, sats "not moving", and the lightning sync runbook that keeps it from recurring. |
| [004](004-wear-your-own-name.html) | **Wear Your Own Name** | Mask every door behind your brand — DNS doors vs gated rewrites, your own orbee floor (what's config, what's a fork), and the whole-fleet masking table. |
| [006](006-ship-it.html) | **Ship It** | Deploy frens.earth from SCAR with your signature — connect the repo, turn off Vercel auto-deploy, wire a deploy hook, arm the signed ▲ SHIP button. |

_(more to come — 005 CLASSROOM SETUPS & MANAGEMENT is commissioned.)_

## Writing a new one

1. Copy [`_template.html`](_template.html) to `NNN-the-slug.html` (next number).
2. Set the `<title>`, the eyebrow (`RTFM · NNN · …`), the headline, and the
   one-line subtitle (who it's for + the one thing they can do after).
3. Write it. Commands go in `.term` blocks; the load-bearing warnings go in
   `.call.danger`; "it worked" goes in `.call.check`. Keep prose near 68
   characters wide.
4. **Keep the magic.** Every article ends with a Konami-code reward
   (`↑↑↓↓←→←→ b a`) and a faint hint in the footer. Change the secret word to
   fit the article, and wire it to a real reward when we have one.
5. Add a row to the table above.

## House rules

- **Self-contained** — one HTML file, inline CSS/JS, no external fonts or
  scripts. It opens anywhere, forever, offline.
- **Both themes** — the tokens handle light + dark; never hardcode a color.
- **Night-garden, terminal treatment** — the frens.earth palette (loam,
  sprout-neon, verification-teal, harvest-gold, heartlight-purple). Gold is for
  money and warnings only.
- **Honest** — if something is flaky or unproven, say so, with a date.

> Tick tock — the knowledge gets tied to the block too.
