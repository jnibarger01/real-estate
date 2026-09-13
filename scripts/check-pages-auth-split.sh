#!/usr/bin/env bash
# Guard the Pages vs authenticated-product split.
# Pages may only ship the public shell. Secret-named Vite env and dashboard/API
# credentials must never be injected into the Pages workflow or the static bundle.
#
# Usage:
#   scripts/check-pages-auth-split.sh           # policy + build + scan
#   scripts/check-pages-auth-split.sh --policy  # workflow/source policy only
#   scripts/check-pages-auth-split.sh --scan    # scan existing dist/ only
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

MODE="${1:-all}"

# Public Vite env the Pages workflow may inject.
ALLOWED_PAGES_VITE='VITE_API_BASE_URL'

# Forbidden Vite env names (and name families). Accidentally wiring any of these
# into a Pages build must fail CI.
FORBIDDEN_VITE_REGEX='VITE_(API_KEY|ALLOW_FIXTURE_ADAPTER|DASHBOARD_|SESSION_|RENTCAST_|GEMINI_|BRIDGE_|RESO_|[^[:space:]]*PASSWORD[^[:space:]]*|[^[:space:]]*SECRET[^[:space:]]*|[^[:space:]]*TOKEN[^[:space:]]*|[^[:space:]]*_KEY)'

# Canaries prove a secret-named Vite env would embed if referenced / not stripped.
CANARY_API_KEY='PAGES_GUARD_CANARY_API_KEY_7f3a9c'
CANARY_DASH_PASS='PAGES_GUARD_CANARY_DASH_PASS_7f3a9c'
CANARY_SESSION='PAGES_GUARD_CANARY_SESSION_7f3a9c'
CANARY_RENTCAST='PAGES_GUARD_CANARY_RENTCAST_7f3a9c'
CANARY_GEMINI='PAGES_GUARD_CANARY_GEMINI_7f3a9c'
CANARY_TOKEN='PAGES_GUARD_CANARY_TOKEN_7f3a9c'

fail() {
  echo "$*" >&2
  exit 1
}

check_policy() {
  local wf=".github/workflows/deploy-pages.yml"
  local ci=".github/workflows/ci.yml"

  # Pages deploy must not assign forbidden VITE_* names.
  if grep -E "[[:space:]]${FORBIDDEN_VITE_REGEX}:" "$wf" >/dev/null; then
    grep -E "[[:space:]]${FORBIDDEN_VITE_REGEX}:" "$wf" >&2 || true
    fail "deploy-pages.yml injects forbidden Vite env into the Pages build"
  fi
  # Only VITE_API_BASE_URL is expected under the Pages build step env.
  if grep -E '[[:space:]]VITE_[A-Z0-9_]+:' "$wf" | grep -v -E "[[:space:]]${ALLOWED_PAGES_VITE}:"; then
    fail "deploy-pages.yml sets a Vite env other than ${ALLOWED_PAGES_VITE}"
  fi

  # CI must not inject forbidden secrets as build inputs except intentional canaries
  # (those live inside this script, not as workflow env keys).
  if grep -E "[[:space:]]${FORBIDDEN_VITE_REGEX}:" "$ci" >/dev/null; then
    grep -E "[[:space:]]${FORBIDDEN_VITE_REGEX}:" "$ci" >&2 || true
    fail "ci.yml injects forbidden Vite env into a Pages build"
  fi

  # Source may only read allowlisted import.meta.env.VITE_* keys.
  # VITE_API_KEY / VITE_ALLOW_FIXTURE_ADAPTER are permitted solely in runtime.ts.
  # Scan the working tree (not only tracked git files) so new local files fail too.
  local hits bad
  hits="$(grep -R -n -E "import\.meta\.env\.${FORBIDDEN_VITE_REGEX}" src \
    --include='*.ts' --include='*.tsx' --include='*.js' --include='*.jsx' || true)"
  if [[ -n "$hits" ]]; then
    bad="$(echo "$hits" | grep -v -E '^src/config/runtime\.ts:' || true)"
    if [[ -n "$bad" ]]; then
      echo "$bad" >&2
      fail "Forbidden import.meta.env.VITE_* reference outside src/config/runtime.ts"
    fi
  fi

  echo "pages-auth-split policy: ok"
}

scan_dist() {
  [[ -d dist ]] || fail "dist/ missing; run a Pages build first"

  local hits
  hits="$(grep -R -l -E "$FORBIDDEN_VITE_REGEX" dist || true)"
  if [[ -n "$hits" ]]; then
    echo "$hits" >&2
    fail "Pages bundle contains a forbidden Vite env identifier"
  fi

  # Server-side credential names that must never ship in the public shell.
  hits="$(grep -R -l -E 'DASHBOARD_AUTH_PASSWORD|DASHBOARD_AUTH_USERS|SESSION_SECRET|RENTCAST_API_KEY|GEMINI_API_KEY|BRIDGE_RESO_ACCESS_TOKEN|RESO_SYNC_TOKEN' dist || true)"
  if [[ -n "$hits" ]]; then
    echo "$hits" >&2
    fail "Pages bundle contains dashboard/API secret identifiers"
  fi

  hits="$(grep -R -l -E 'ZILLOW_MCP_SERVER_URL|PRIVATE KEY-----' dist || true)"
  if [[ -n "$hits" ]]; then
    echo "$hits" >&2
    fail "Potential secret material found in Pages dist"
  fi

  # Boundary before sk- avoids Tailwind mask utility false positives (sk-image-*).
  hits="$(grep -R -l -E '((^|[^A-Za-z0-9_-])sk-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|(api[_-]?key|secret|token)["'"'"'= :]+[A-Za-z0-9_-]{32,})' dist || true)"
  if [[ -n "$hits" ]]; then
    echo "$hits" >&2
    fail "Potential shaped secret material found in Pages dist"
  fi

  for canary in \
    "$CANARY_API_KEY" \
    "$CANARY_DASH_PASS" \
    "$CANARY_SESSION" \
    "$CANARY_RENTCAST" \
    "$CANARY_GEMINI" \
    "$CANARY_TOKEN"
  do
    if grep -R -l -F "$canary" dist; then
      fail "Pages bundle embedded canary secret value ($canary) — secret-named Vite env leaked"
    fi
  done

  echo "pages-auth-split dist scan: ok"
}

build_and_scan() {
  # Poison the build with secret-named Vite env. If any path embeds them, scan fails.
  env \
    VITE_API_BASE_URL="${VITE_API_BASE_URL:-https://example.invalid}" \
    VITE_API_KEY="$CANARY_API_KEY" \
    VITE_DASHBOARD_AUTH_PASSWORD="$CANARY_DASH_PASS" \
    VITE_SESSION_SECRET="$CANARY_SESSION" \
    VITE_RENTCAST_API_KEY="$CANARY_RENTCAST" \
    VITE_GEMINI_API_KEY="$CANARY_GEMINI" \
    VITE_BRIDGE_RESO_ACCESS_TOKEN="$CANARY_TOKEN" \
    bun run build:pages

  scan_dist
}

case "$MODE" in
  --policy) check_policy ;;
  --scan) scan_dist ;;
  all|--all|"")
    check_policy
    build_and_scan
    ;;
  *)
    fail "unknown mode: $MODE (use --policy, --scan, or omit for all)"
    ;;
esac
