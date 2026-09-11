#!/usr/bin/env bash
# Start a preview server for the CURRENT dist, on a known port, and prove it.
#
# Replaces the `pkill -f "vite preview"` habit, which matched the very shell
# running it: the shell died (exit 144), the old server survived, a second
# instance bound to the next free port, and browser checks kept hitting a
# stale bundle on 4173. Every visual/perf finding taken that way was suspect.
#
# Two guards:
#   1. the previous server is killed by PID from a pidfile, and anything still
#      holding the port is killed by port — never by command-line pattern
#   2. the served entry bundle is compared against dist/ and the script exits
#      non-zero if they differ, so a stale server cannot silently pass
#
# Usage: scripts/preview.sh [port]
set -euo pipefail

PORT="${1:-4173}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PIDFILE="$ROOT/.preview.pid"
LOG="$ROOT/.preview.log"

cd "$ROOT"

# 1. stop the previous instance by PID, never by pattern
if [[ -f "$PIDFILE" ]]; then
  OLD="$(cat "$PIDFILE" || true)"
  if [[ -n "${OLD:-}" ]] && kill -0 "$OLD" 2>/dev/null; then
    kill "$OLD" 2>/dev/null || true
    sleep 1
  fi
  rm -f "$PIDFILE"
fi

# 2. and anything else still holding the port
if command -v fuser >/dev/null 2>&1; then
  fuser -k "${PORT}/tcp" 2>/dev/null || true
  sleep 1
fi

setsid node node_modules/vite/bin/vite.js preview --port "$PORT" --strictPort \
  > "$LOG" 2>&1 < /dev/null &
echo $! > "$PIDFILE"

# 3. wait for it to answer
for _ in $(seq 1 40); do
  if curl -fsS -o /dev/null "http://localhost:${PORT}/"; then break; fi
  sleep 0.5
done

if ! curl -fsS -o /dev/null "http://localhost:${PORT}/"; then
  echo "preview did not start on ${PORT}" >&2
  cat "$LOG" >&2
  exit 1
fi

# 4. prove the served bundle is the one on disk
SERVED="$(curl -fsS "http://localhost:${PORT}/" | grep -oE 'assets/index-[A-Za-z0-9_-]+\.js' | head -1)"
ON_DISK="$(cd dist && ls assets/index-*.js | head -1)"

if [[ "$SERVED" != "$ON_DISK" ]]; then
  echo "STALE SERVER: serving '$SERVED' but dist has '$ON_DISK'" >&2
  exit 1
fi

echo "preview on ${PORT} serving ${SERVED} (matches dist) pid $(cat "$PIDFILE")"
