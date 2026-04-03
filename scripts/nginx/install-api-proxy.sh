#!/usr/bin/env bash
# ติดตั้ง proxy /api/ → PM2 ที่ 127.0.0.1:3001 (ไม่ต้องใช้ nano)
# รันบน VPS: sudo bash install-api-proxy.sh
set -euo pipefail

SNIPPET_DST="/etc/nginx/snippets/loyalcloud-api-proxy.conf"
INCLUDE_LINE='    include /etc/nginx/snippets/loyalcloud-api-proxy.conf;'

echo "==> Loyalcloud API proxy installer"

if [[ $(id -u) -ne 0 ]]; then
  echo "ต้องรันด้วย sudo: sudo bash $0"
  exit 1
fi

mkdir -p /etc/nginx/snippets
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ -f "$SCRIPT_DIR/loyalcloud-api-proxy.conf" ]]; then
  cp -f "$SCRIPT_DIR/loyalcloud-api-proxy.conf" "$SNIPPET_DST"
else
  cat > "$SNIPPET_DST" << 'EOF'
client_max_body_size 20m;

location /api/ {
    proxy_pass http://127.0.0.1:3001;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
EOF
fi
echo "==> Wrote $SNIPPET_DST"

CONF=""
for d in /etc/nginx/sites-enabled /etc/nginx/conf.d; do
  if [[ -d "$d" ]]; then
    CONF=$(grep -rl "api\.loyalcloudcrm\.com" "$d" 2>/dev/null | head -1 || true)
    [[ -n "$CONF" ]] && break
  fi
done

if [[ -z "$CONF" ]]; then
  echo "ไม่พบ server_name api.loyalcloudcrm.com ใน /etc/nginx/sites-enabled หรือ conf.d"
  echo "ใส่มือใน server { listen 443 } บรรทัดเดียว:"
  echo "$INCLUDE_LINE"
  exit 1
fi

echo "==> Config file: $CONF"

if grep -q "loyalcloud-api-proxy.conf" "$CONF"; then
  echo "==> มี include อยู่แล้ว — ไม่แทรกซ้ำ"
else
  BACKUP="${CONF}.bak.$(date +%Y%m%d%H%M%S)"
  cp -a "$CONF" "$BACKUP"
  echo "==> Backup: $BACKUP"

  LINE_NUM=$(grep -nE "server_name[[:space:]].*api\.loyalcloudcrm\.com" "$CONF" | head -1 | cut -d: -f1 || true)
  if [[ -z "${LINE_NUM:-}" ]]; then
    echo "ไม่พบบรรทัด server_name ที่มี api.loyalcloudcrm.com"
    exit 1
  fi

  awk -v LINE="$LINE_NUM" -v INS="$INCLUDE_LINE" '
    NR == LINE { print; print INS; next }
    { print }
  ' "$CONF" > "${CONF}.tmp"
  mv "${CONF}.tmp" "$CONF"
  echo "==> แทรก include หลังบรรทัด $LINE_NUM"
fi

nginx -t
nginx -s reload
echo "==> nginx OK — reload แล้ว"
echo ""
echo "ทดสอบ:"
echo "  curl -s -X POST https://api.loyalcloudcrm.com/api/pos/staff-sync -H 'Content-Type: application/json' -d '{\"staff\":[]}'"
