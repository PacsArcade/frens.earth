# Merge authority — the admiral's signature is the only door into `main`

*The rule that #39 taught us: nothing merges except through the SCAR sign-off.*

## The principle

**Your signature is the authorization.** Every change to `main` must pass through the
operator's key-signed sign-off in the SCAR merge queue (`/a/scar`). No exceptions, no
side doors — a merge that skips the signature skips the authority.

## How the flow works

1. **An agent (or a human) opens a PR** against `main` — and stops there. Opening the
   PR *is* the trigger: it appears automatically in the SCAR merge queue via
   `listOpenPrs()`.
2. **The operator reviews it in `/a/scar`** — the change list, the brief, the diff.
3. **The operator signs** a `PACS-MERGE-<pr>-<headSha>-<timestamp>` event (nostr
   kind 22242) with a key on the operator allowlist. The signature is **sha-bound** to
   the exact head commit — it authorizes *that* code, nothing else.
4. **The app verifies the signature and executes the merge** with its GitHub token, and
   **records the signed event in the audit log** (`src/lib/merges.ts`). The merge is now
   provably traced to the operator's key.

## The rule for agents (and everyone)

- **`gh pr create` — yes. `gh pr merge` — never.** Do not merge, do not enable
  auto-merge. Leave every PR open for the operator's sign-off, and tell them it's
  waiting in the SCAR queue.
- Marking a PR "ready for review" is fine (it surfaces the PR); **merging is the
  operator's key alone.**

## Merge is not deploy

frens.earth has **no git auto-deploy**. A signed merge updates `main`; it does **not**
publish. Going live is a separate, deliberate CLI step
(`npx vercel deploy --prod --yes`) — so the operator controls *both* what lands in the
record and what reaches the world.

## Enforcement

Convention (this doc + agent discipline) is the current gate. Structural enforcement —
GitHub branch protection that makes the signed path the *only* physical way to merge —
requires GitHub Pro or a public repository; until then, the queue and this rule hold the
line.

*Tick tock — nothing merges but the block you signed.*
