#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────
#  Flamboyant — Mesa Interativa — local dev kiosk launcher (macOS / Linux)
#
#  Sobe a pasta na :8765 com o python http.server (loopback only),
#  entao abre Chrome em kiosk apontando para http://localhost:8765/?kiosk=1.
#  So para dev local — em producao a mesa roda no Windows via
#  scripts/kiosk-launch.bat (com bin/miniserve.exe).
# ─────────────────────────────────────────────────────────────────
set -euo pipefail

PORT="${PORT:-8765}"
URL="http://localhost:${PORT}/?kiosk=1"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROFILE_DIR="${TMPDIR:-/tmp}/flamboyant-sala-kiosk-profile"

cd "$ROOT"

echo "[kiosk] servindo $ROOT em :$PORT (loopback)"
python3 -m http.server "$PORT" --bind 127.0.0.1 >/dev/null 2>&1 &
SRV=$!
trap 'kill "$SRV" 2>/dev/null || true' EXIT
sleep 1

CHROME_ARGS=(
  --kiosk
  --start-fullscreen
  --window-size=1920,1080
  --window-position=0,0
  --noerrdialogs
  --disable-pinch
  --overscroll-history-navigation=0
  --disable-features=TranslateUI
  --disable-translate
  --disable-infobars
  --no-first-run
  --no-default-browser-check
  --autoplay-policy=no-user-gesture-required
  --user-data-dir="$PROFILE_DIR"
  "$URL"
)

if [[ "$(uname)" == "Darwin" ]]; then
  echo "[kiosk] launching Chrome (macOS)"
  open -na "Google Chrome" --args "${CHROME_ARGS[@]}"
  # block ate python http.server ser morto (Ctrl-C)
  wait "$SRV"
else
  echo "[kiosk] launching Chrome (Linux)"
  if command -v google-chrome >/dev/null; then CHROME=google-chrome
  elif command -v chromium >/dev/null;       then CHROME=chromium
  elif command -v chromium-browser >/dev/null; then CHROME=chromium-browser
  else echo "[kiosk] Chrome/Chromium not found in PATH"; exit 1; fi
  "$CHROME" "${CHROME_ARGS[@]}"
fi
