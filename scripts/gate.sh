#!/usr/bin/env bash
# frens.earth gate: one command, GATES GREEN or GATES RED. No step swallows an
# exit code. Run from anywhere:  npm run gate   (or  bash scripts/gate.sh)
# Steps: install check, no-server tests, lint + type RATCHETS, audit WATCH,
# build, live tests against the built site on a local port, WATCH block.
# Never run lint and build at the same time in one worktree (Turbopack fails
# with "next/font/google queries have exactly one entry"): steps run in turn.
set -uo pipefail
cd "$(dirname "$0")/.."
SCRATCH="${TMPDIR:-/tmp}/frens-gate.$$"
mkdir -p "$SCRATCH"
trap 'rm -rf "$SCRATCH"' EXIT

# One switch: set to 1 to make a high-severity npm audit finding fail the gate
# (left at 0 while the Next.js update lands on its own branch).
AUDIT_FAILS=0

fail=0
watch=()
tree_before=$(git status --porcelain 2>/dev/null || true)
t_start=$SECONDS

# 1. install check: reinstall when package-lock.json changed since the last run
lock_now=$(md5sum package-lock.json | cut -c1-32)
lock_seen=$(cat node_modules/.gate-lock.md5 2>/dev/null || true)
if [ "$lock_now" != "$lock_seen" ]; then
  echo "lockfile changed -> npm ci"
  timeout 900 npm ci >"$SCRATCH/ci.log" 2>&1; rc=$?
  if [ $rc -ne 0 ]; then
    if grep -q "EALLOWREMOTE" "$SCRATCH/ci.log"; then
      echo "INSTALL BLOCKED: npm 12 refuses the arcade-ui package address, owner's call"
    else
      echo "NPM CI FAILED"; tail -5 "$SCRATCH/ci.log"
    fi
    fail=1
  else
    echo "$lock_now" > node_modules/.gate-lock.md5
  fi
else
  echo "install: lockfile unchanged"
fi

# 2. tests that need no server (a file marked "gate:live" in its header is
#    run live in step 6; door-sweep also has a static mode, run here)
if [ $fail -eq 0 ]; then
  for f in scripts/*.test.mjs; do
    if grep -q "gate:live" "$f"; then
      case "$f" in *door-sweep*) args="--static" ;; *) continue ;; esac
    else
      args=""
    fi
    out=$(timeout 300 node "$f" $args 2>&1); rc=$?
    echo "$f $args: $(echo "$out" | tail -1)"
    [ $rc -ne 0 ] && { echo "$out" | tail -8; fail=1; }
  done
fi

# 3. ratchets: eslint and tsc counts may not go up
base() { node -e 'console.log(require("./scripts/gate-baseline.json")[process.argv[1]])' "$1"; }
ratchet() { # name now baseline
  if [ "$2" -gt "$3" ]; then echo "$1 $2 > baseline $3: RATCHET BROKEN"; fail=1
  elif [ "$2" -lt "$3" ]; then echo "$1 $2 < baseline $3: lower the number in scripts/gate-baseline.json"
  else echo "$1 $2 (baseline $3)"; fi
}
if [ $fail -eq 0 ]; then
  timeout 300 npx eslint --format json -o "$SCRATCH/eslint.json" >/dev/null 2>&1
  if [ -s "$SCRATCH/eslint.json" ]; then
    counts=$(node -e 'const r=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));let e=0,w=0;for(const f of r){e+=f.errorCount;w+=f.warningCount}console.log(e+" "+w)' "$SCRATCH/eslint.json")
    ratchet "eslint errors" "${counts% *}" "$(base eslintErrors)"
    ratchet "eslint warnings" "${counts#* }" "$(base eslintWarnings)"
  else echo "ESLINT DID NOT RUN"; fail=1; fi
  timeout 300 npx tsc --noEmit >"$SCRATCH/tsc.log" 2>&1
  tsc_n=$(grep -c "error TS" "$SCRATCH/tsc.log" || true)
  ratchet "tsc errors" "$tsc_n" "$(base tscErrors)"
fi

# 4. audit: a WATCH line for now
if [ $fail -eq 0 ]; then
  timeout 120 npm audit --omit=dev --audit-level=high >"$SCRATCH/audit.log" 2>&1; rc=$?
  if [ $rc -eq 0 ]; then echo "audit: no high findings"
  else
    summary=$(grep -E "vulnerabilities" "$SCRATCH/audit.log" | tail -1)
    watch+=("WATCH: npm audit --omit=dev --audit-level=high exit $rc: ${summary:-see npm audit}")
    echo "audit: WATCH (exit $rc)"
    [ "$AUDIT_FAILS" = "1" ] && fail=1
  fi
fi

# 5. build (after lint, never beside it)
if [ $fail -eq 0 ]; then
  timeout 600 npx next build >"$SCRATCH/build.log" 2>&1; rc=$?
  if [ $rc -eq 0 ]; then echo "build ok"; else echo "BUILD FAILED"; grep -i error "$SCRATCH/build.log" | head -3; fail=1; fi
fi

# 6. live tests against the built site on a local port (starts and stops it)
if [ $fail -eq 0 ]; then
  timeout 600 node scripts/gate-live.mjs >"$SCRATCH/live.log" 2>&1; rc=$?
  grep -v "^WATCH:" "$SCRATCH/live.log"
  while IFS= read -r line; do watch+=("$line"); done < <(grep "^WATCH:" "$SCRATCH/live.log" || true)
  [ $rc -ne 0 ] && fail=1
fi

# 7. the tests may not dirty the tree
tree_after=$(git status --porcelain 2>/dev/null || true)
if [ "$tree_before" != "$tree_after" ]; then
  echo "TREE CHANGED during the gate:"; diff <(echo "$tree_before") <(echo "$tree_after") | head -10
  fail=1
fi

echo "---- WATCH ----"
for w in "${watch[@]+"${watch[@]}"}"; do echo "$w"; done
echo "---- took $((SECONDS - t_start))s ----"
[ $fail -eq 0 ] && echo "GATES GREEN" || echo "GATES RED"
exit $fail
