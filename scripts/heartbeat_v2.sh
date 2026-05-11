#!/bin/bash

# Heartbeat v2: coleta sonda local, persiste fila e envia o ultimo snapshot ao GitHub.
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

set -u

FIREWALL_IP="${FIREWALL_IP:-128.1.0.200}"
INTERNET_TARGET="${INTERNET_TARGET:-1.1.1.1}"
DNS_TARGET="${DNS_TARGET:-github.com}"
STATE_DIR="${STATE_DIR:-/var/lib/ifva-monitor}"
SEQ_FILE="${SEQ_FILE:-$STATE_DIR/seq}"
QUEUE_FILE="${QUEUE_FILE:-$STATE_DIR/queue.jsonl}"

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

if ping -c 1 -W 2 "$INTERNET_TARGET" >/dev/null 2>&1; then
  INTERNET_OK=true
else
  INTERNET_OK=false
fi

if getent hosts "$DNS_TARGET" >/dev/null 2>&1; then
  DNS_OK=true
else
  DNS_OK=false
fi

TS="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

EVENT_LINE=$(cat <<EOF_EVENT
{"ts":"$TS","seq":$SEQ,"probe":{"gateway_ok":$GATEWAY_OK,"internet_ok":$INTERNET_OK,"dns_ok":$DNS_OK}}
EOF_EVENT
)

printf '%s\n' "$EVENT_LINE" >> "$QUEUE_FILE"

PENDING_COUNT="$(wc -l < "$QUEUE_FILE" 2>/dev/null || echo 0)"
if [[ ! "$PENDING_COUNT" =~ ^[0-9]+$ ]]; then
  PENDING_COUNT=1
fi

LAST_EVENT="$(tail -n 1 "$QUEUE_FILE" 2>/dev/null || true)"
if [[ -z "$LAST_EVENT" ]]; then
  LAST_EVENT="$EVENT_LINE"
fi

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
      "dns_ok": $DNS_OK
    },
    "batch": [
      $LAST_EVENT
    ]
  }
}
EOF_PAYLOAD
)

HTTP_CODE=$(curl --silent --show-error --output /tmp/ifva_dispatch_response.txt \
  --write-out "%{http_code}" \
  --tlsv1.2 \
  -X POST \
  -H "Accept: application/vnd.github.v3+json" \
  -H "Authorization: token $GITHUB_TOKEN" \
  "$API_URL" \
  -d "$JSON_PAYLOAD")

if [[ "$HTTP_CODE" = "204" ]]; then
  : > "$QUEUE_FILE"
  echo "Heartbeat v2 enviado com sucesso (seq=$SEQ, pending=$PENDING_COUNT, gateway_ok=$GATEWAY_OK, internet_ok=$INTERNET_OK, dns_ok=$DNS_OK)."
  rm -f /tmp/ifva_dispatch_response.txt
  exit 0
fi

echo "Falha ao enviar heartbeat v2. HTTP=$HTTP_CODE" >&2
cat /tmp/ifva_dispatch_response.txt >&2
exit 1
