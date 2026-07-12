# SCAR Ops To-Dos — the standing orders

*Opened ▣ 957,625 · 0018.04.15 a₿, from the admiral's treasury drill. House
rules bind everything here ([house-rules.md](house-rules.md)) — BFT dates
only, honest states, the record is the drill. Owner: the admiral + crew.*

## Open orders

1. **BTCPay lockout DR drill — debrief + playbook adoption**
   The admiral locked himself out of the treasury panel on purpose
   (0018.04.15 a₿) and fought his way back in. The playbook is now written:
   **[RTFM 003 — Treasury Rescue](../rtfm/003-treasury-rescue.html)**,
   Phase A.
   - [ ] debrief: walk Phase A against what the admiral actually did; note
         any step the article missed
   - [ ] fit the prevention kit on the live VPS: second admin account
         (credentials stored separately), SMTP configured, 2FA recovery
         codes off-box
   - [ ] adopt: RTFM 003 is the standing DR playbook for every captain's
         treasury; link it from the captain onboarding trail
   - **done when**: a second admin can sign in today, and the drill date +
     result are logged below

2. **Lightning sync on the VPS — run Phase C, report the height**
   The treasury read 0 with confirmed sats on the chain — classic unsynced
   node (5k sats deposited, 25k inbound, balance 0). The sats were never
   gone; the node was mid-book. Runbook:
   **[RTFM 003 — Treasury Rescue](../rtfm/003-treasury-rescue.html)**,
   Phases B + C.
   - [ ] run the Phase B ladder on the VPS: mempool.space confirm →
         `getblockchaininfo` (blocks vs headers) → lightning `getinfo` →
         rescan only if needed
   - [ ] unstick per Phase C: logs, `df -h` (the lifetime-VPS disk is the
         prime suspect — pruning is the plan, not an option), restart
         sequence
   - [ ] **report the block height reached** (BFT-stamp it) and confirm the
         5k + 25k sats show in the treasury balance
   - [ ] schedule the monthly drill (Phase C drill box) — first entry in
         the drill log below
   - **done when**: `blocks == headers`, lightning height matches, balance
     honest, height logged

3. **Self-host mempool.space on the VPS — stop phoning a third party**
   Opened ▣ 957,660 · 0018.04.15 a₿, from the admiral's sovereignty fix. The
   fleet now reads the block tip + mempool fill through a CONFIGURABLE chain
   node (`mempoolUrl`, GUI-editable at `/a/mempool`), with the public
   mempool.space only as the fallback. The node itself is the last piece:
   - [ ] stand up mempool.space on the VPS against our own bitcoind (the
         mempool/mempool Docker stack → REST at `/api/blocks/tip/height` and
         `/api/mempool`, the shape the fleet already reads)
   - [ ] skin it in Pac's Arcade branding (the mempool frontend is a config +
         theme fork — same "wear your own name" drill as orbee/Element)
   - [ ] point `mempoolUrl` at it from `/a/mempool` (POINT · SAVE · TEST) and
         confirm the panel reads REACHABLE with a real tip — the fleet stops
         phoning a third party
   - **done when**: `/a/mempool` shows YOUR NODE — SAVED HERE, the tip matches
     the chain, and the BftClock + /bb read through it (source ≠ `default`)

## Drill log

| stamp (▣ height · BFT) | drill | result |
|---|---|---|
| _none yet — the first monthly drill writes this row_ | | |
