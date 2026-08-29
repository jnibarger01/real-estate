#!/usr/bin/env bash
# Probe /api/health for cron or an uptime checker.
# Usage: scripts/check-health.sh [BASE_URL]
set -euo pipefail
BASE="${1:-${HEALTH_URL:-http://127.0.0.1:3000}}"
BODY="$(curl -fsS "$BASE/api/health")"
echo "$BODY"
python3 - <<'PY' <<<"$BODY"
import json,sys
body=json.loads(sys.stdin.read())
status=body.get("status")
if status not in ("ok",):
    raise SystemExit(f"unhealthy status={status}")
if not body.get("queryReadiness",{}).get("ok"):
    raise SystemExit("queryReadiness failed")
if not body.get("ingestFreshness",{}).get("ok", True):
    raise SystemExit("ingestFreshness failed")
print("ok")
PY
