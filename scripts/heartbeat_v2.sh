#!/bin/bash

# Heartbeat v2: coleta sonda local, persiste fila e envia o lote completo ao GitHub.
# Requisitos:
# - GITHUB_TOKEN
# - GITHUB_OWNER (ex.: mvmvasconcelos)
# - GITHUB_REPO (ex.: ifva-on-the-line)
# Opcionais:
# - FIREWALL_IP (padrao: 128.1.0.200)
# - INTERNET_TARGET (padrao: 1.1.1.1)
# - DNS_TARGET (padrao: github.com)
# - STATE_DIR (padrao: /var/lib/ifva-monitor)
# - SEQ_FILE (padrao: $STATE_DIR/seq)
# - QUEUE_FILE (padrao: $STATE_DIR/queue.jsonl)
# - LAN_IFACE (padrao: eno1)
# - WIFI_IFACE (padrao: wlp1s2)

set -u

FIREWALL_IP="${FIREWALL_IP:-128.1.0.200}"
INTERNET_TARGET="${INTERNET_TARGET:-1.1.1.1}"
INTERNET_TARGET2="${INTERNET_TARGET2:-8.8.8.8}"
DNS_TARGET="${DNS_TARGET:-github.com}"
STATE_DIR="${STATE_DIR:-/var/lib/ifva-monitor}"
SEQ_FILE="${SEQ_FILE:-$STATE_DIR/seq}"
QUEUE_FILE="${QUEUE_FILE:-$STATE_DIR/queue.jsonl}"
LAN_IFACE="${LAN_IFACE:-eno1}"
WIFI_IFACE="${WIFI_IFACE:-wlp1s2}"

if [[ -z "${GITHUB_TOKEN:-}" || -z "${GITHUB_OWNER:-}" || -z "${GITHUB_REPO:-}" ]]; then
  echo "Erro: configure GITHUB_TOKEN, GITHUB_OWNER e GITHUB_REPO." >&2
  exit 1
fi

mkdir -p "$STATE_DIR"

if [[ ! -f "$SEQ_FILE" ]]; then
  echo "0" > "$SEQ_FILE"
fi

SEQ="$(cat "$SEQ_FILE" 2>/dev/null || echo 0)"
if [[ ! "$SEQ" =~ ^[0-9]+$ ]]; then
  SEQ=0
fi
SEQ=$((SEQ + 1))
echo "$SEQ" > "$SEQ_FILE"

if ping -c 1 -W 2 "$FIREWALL_IP" >/dev/null 2>&1; then
  GATEWAY_OK=true
else
  GATEWAY_OK=false
fi

if ping -c 1 -W 2 "$INTERNET_TARGET" >/dev/null 2>&1 || ping -c 1 -W 2 "$INTERNET_TARGET2" >/dev/null 2>&1; then
  INTERNET_OK=true
else
  INTERNET_OK=false
fi

if getent hosts "$DNS_TARGET" >/dev/null 2>&1; then
  DNS_OK=true
else
  DNS_OK=false
fi

# Deteccao de uplink ativo (LAN vs WiFi) via rota real para o alvo de internet.
# Nao deve travar o script se "ip route" falhar ou vier em formato inesperado.
ROUTE_OUTPUT="$(ip route get "$INTERNET_TARGET" 2>/dev/null || true)"
ACTUAL_IFACE="$(printf '%s\n' "$ROUTE_OUTPUT" | grep -oE 'dev [^ ]+' | head -1 | awk '{print $2}')"

if [[ -z "$ACTUAL_IFACE" ]]; then
  ACTIVE_UPLINK="unknown"
elif [[ "$ACTUAL_IFACE" == "$LAN_IFACE" ]]; then
  ACTIVE_UPLINK="lan"
elif [[ "$ACTUAL_IFACE" == "$WIFI_IFACE" ]]; then
  ACTIVE_UPLINK="wifi"
else
  ACTIVE_UPLINK="unknown"
fi

# Sonda adicional de alcance a api.github.com. Qualquer resposta HTTP real
# (2xx/3xx/401/403) prova que a conexao chegou; so timeout/erro de conexao e false.
GITHUB_API_HTTP_CODE="$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 https://api.github.com 2>/dev/null)"
GITHUB_API_CURL_EXIT=$?
if [[ $GITHUB_API_CURL_EXIT -eq 0 && "$GITHUB_API_HTTP_CODE" =~ ^(2[0-9]{2}|3[0-9]{2}|401|403)$ ]]; then
  GITHUB_API_OK=true
else
  GITHUB_API_OK=false
fi

TS="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
EVENT_LINE=$(cat <<EOF_EVENT
{"ts":"$TS","seq":$SEQ,"probe":{"gateway_ok":$GATEWAY_OK,"internet_ok":$INTERNET_OK,"dns_ok":$DNS_OK,"active_uplink":"$ACTIVE_UPLINK","github_api_ok":$GITHUB_API_OK}}
EOF_EVENT
)

printf '%s\n' "$EVENT_LINE" >> "$QUEUE_FILE"

# Limita a fila a 100 eventos para evitar crescimento ilimitado
QUEUE_LINES=$(wc -l < "$QUEUE_FILE" 2>/dev/null || echo 0)
if [[ "$QUEUE_LINES" -gt 100 ]]; then
  tail -100 "$QUEUE_FILE" > "${QUEUE_FILE}.tmp" && mv "${QUEUE_FILE}.tmp" "$QUEUE_FILE"
fi

PENDING_COUNT="$(grep -c '^{' "$QUEUE_FILE" 2>/dev/null || echo 0)"
if [[ ! "$PENDING_COUNT" =~ ^[0-9]+$ ]]; then
  PENDING_COUNT=1
fi

QUEUE_JSON="$(python3 - "$QUEUE_FILE" <<'PY'
import json
import pathlib
import sys

queue_file = pathlib.Path(sys.argv[1])
items = []
if queue_file.exists():
    for line in queue_file.read_text().splitlines():
        line = line.strip()
        if not line:
            continue
        items.append(json.loads(line))
print(json.dumps(items, separators=(',', ':')))
PY
)"

API_URL="https://api.github.com/repos/$GITHUB_OWNER/$GITHUB_REPO/dispatches"
JSON_PAYLOAD=$(cat <<EOF_PAYLOAD
{
  "event_type": "heartbeat",
  "client_payload": {
    "ts": "$TS",
    "seq": $SEQ,
    "pending_count": $PENDING_COUNT,
    "queue_size": $PENDING_COUNT,
    "probe": {
      "gateway_ok": $GATEWAY_OK,
      "internet_ok": $INTERNET_OK,
      "dns_ok": $DNS_OK,
      "active_uplink": "$ACTIVE_UPLINK",
      "github_api_ok": $GITHUB_API_OK
    },
    "batch": $QUEUE_JSON
  }
}
EOF_PAYLOAD
)

HTTP_CODE=$(curl --silent --show-error --output /tmp/ifva_dispatch_response.txt \
  --write-out "%{http_code}" \
  --ipv4 \
  --max-time 30 \
  -X POST \
  -H "Accept: application/vnd.github.v3+json" \
  -H "Content-Type: application/json" \
  -H "Authorization: token $GITHUB_TOKEN" \
  "$API_URL" \
  -d "$JSON_PAYLOAD")
CURL_EXIT=$?

if [[ "$HTTP_CODE" = "204" ]]; then
  : > "$QUEUE_FILE"
  echo "Heartbeat v2 enviado com sucesso (seq=$SEQ, pending=$PENDING_COUNT, gateway_ok=$GATEWAY_OK, internet_ok=$INTERNET_OK, dns_ok=$DNS_OK)."
  rm -f /tmp/ifva_dispatch_response.txt
  # Auto-heal: reinicia o timer caso tenha parado por algum motivo
  if ! systemctl is-active --quiet ifva-heartbeat.timer 2>/dev/null; then
    systemctl restart ifva-heartbeat.timer 2>/dev/null || true
    echo "Timer reiniciado automaticamente."
  fi
  exit 0
fi

# Dispatch falhou: persiste o diagnostico na ultima linha ja gravada em
# QUEUE_FILE para este ciclo, para que o proximo lote inclua o erro.
if [[ $CURL_EXIT -ne 0 ]]; then
  DELIVERY_ERROR="curl_error_exit_${CURL_EXIT}"
else
  DELIVERY_ERROR="$HTTP_CODE"
fi

python3 - "$QUEUE_FILE" "$DELIVERY_ERROR" <<'PY' 2>/dev/null || true
import json
import pathlib
import sys

queue_file = pathlib.Path(sys.argv[1])
delivery_error = sys.argv[2]

if queue_file.exists():
    lines = queue_file.read_text().splitlines()
    for i in range(len(lines) - 1, -1, -1):
        line = lines[i].strip()
        if not line:
            continue
        try:
            obj = json.loads(line)
        except json.JSONDecodeError:
            continue
        obj["delivery_error"] = delivery_error
        lines[i] = json.dumps(obj, separators=(',', ':'))
        queue_file.write_text("\n".join(lines) + "\n")
        break
PY

echo "Falha ao enviar heartbeat v2. HTTP=$HTTP_CODE" >&2
cat /tmp/ifva_dispatch_response.txt >&2
exit 1
