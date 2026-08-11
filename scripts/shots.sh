#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────
# shots.sh — captura as telas da interface em 1920×1080 para conferir
# lado a lado com os renders do PSD em docs/psd/.
#
# ⚠ Três calibragens, todas necessárias, todas silenciosas se erradas:
#
#   1. O Chrome headless reserva ~87px de altura para o cromo do navegador,
#      então `--window-size=1920,1080` entrega um viewport de 1920×993 — e
#      como todo o layout escala por `100vh / 108`, tudo sai 8% menor sem
#      nenhum aviso. `--window-size=1920,1167` é o que dá viewport de 1080.
#
#   2. O headless ainda redimensiona o viewport durante a carga, e a captura
#      acaba saindo numa escala e as medidas do DOM em outra. Por isso o
#      `?rem=10`: fixa a escala raiz no grid de 1920×1080 do PSD. É um gancho
#      só de conferência — o launcher do kiosk nunca o passa.
#
#   3. O `--screenshot` captura no tamanho da JANELA (1167), não do viewport,
#      então a imagem leva 87px de sobra embaixo. O recorte no fim tira essa
#      faixa sem reamostrar — redimensionar distorceria a comparação.
#
#   scripts/shots.sh [porta]     → docs/shots/*.png
# ─────────────────────────────────────────────────────────────────
set -euo pipefail

PORT="${1:-8791}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="$ROOT/docs/shots"
CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
BASE="http://127.0.0.1:$PORT"

WINDOW_H=1167   # → viewport de 1080; ver calibragem 1

[ -x "$CHROME" ] || { echo "Chrome não encontrado em: $CHROME"; exit 1; }
curl -sf -o /dev/null "$BASE/config.json" || {
  echo "Nada servindo em $BASE — suba o servidor primeiro:"
  echo "  python3 -m http.server $PORT --bind 127.0.0.1"
  exit 1
}

mkdir -p "$OUT"

shoot() {   # shoot <nome> <query>
  "$CHROME" --headless=new --disable-gpu \
    --window-size=1920,$WINDOW_H --force-device-scale-factor=1 \
    --hide-scrollbars --virtual-time-budget=5000 \
    --screenshot="$OUT/$1.png" "$BASE/?$2&rem=10" >/dev/null 2>&1
  python3 -c "import sys;from PIL import Image;p=sys.argv[1];im=Image.open(p);im.height>1080 and im.crop((0,0,1920,1080)).save(p)" "$OUT/$1.png"
  echo "  docs/shots/$1.png"
}

shoot capa                    "screen=splash"
shoot menu                    "screen=menu"

for torre in legitimo autentico; do
  shoot "$torre"                "screen=menu&path=$torre"
  shoot "$torre-subsolos"       "screen=viewer&path=$torre/subsolos"
  shoot "$torre-areas-comuns"   "screen=viewer&path=$torre/areas-comuns"
  shoot "$torre-apartamentos"   "screen=viewer&path=$torre/apartamentos"
  shoot "$torre-fachada"        "screen=menu&path=$torre/fachada"
  shoot "$torre-fachada-imagem" "screen=viewer&path=$torre/fachada/imagem"
  shoot "$torre-fachada-video"  "screen=viewer&path=$torre/fachada/video"
done

shoot le-club-lacoste         "screen=viewer&path=le-club-lacoste"

echo
echo "Referência do PSD: docs/psd/"
