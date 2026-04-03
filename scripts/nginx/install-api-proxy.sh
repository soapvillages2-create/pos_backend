#!/usr/bin/env bash
# ติดตั้ง proxy /api/ → PM2 ที่ 127.0.0.1:3001
# รันบน VPS: sudo bash install-api-proxy.sh
# ถ้าหา config ไม่เจอ: sudo NGINX_CONF=/path/to/site.conf bash install-api-proxy.sh
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

CONF="${NGINX_CONF:-}"

if [[ -n "$CONF" && -f "$CONF" ]]; then
  echo "==> ใช้ไฟล์จาก NGINX_CONF: $CONF"
elif [[ -n "$CONF" ]]; then
  echo "NGINX_CONF ชี้ไฟล์ที่ไม่มี: $CONF"
  exit 1
fi

# หาไฟล์ config (หลายแบบที่พบบน VPS)
if [[ -z "$CONF" ]]; then
  for d in /etc/nginx/sites-enabled /etc/nginx/conf.d; do
    [[ -d "$d" ]] || continue
    CONF=$(grep -rl "api\.loyalcloudcrm\.com" "$d" 2>/dev/null | head -1 || true)
    [[ -n "$CONF" ]] && break
  done
fi

if [[ -z "$CONF" ]]; then
  CONF=$(grep -ril "loyalcloudcrm\|loyalcloud" /etc/nginx/ 2>/dev/null | grep -vE "\.bak|\.default" | head -1 || true)
fi

if [[ -z "$CONF" ]]; then
  # ไฟล์ที่มี listen 443 (HTTPS)
  CONF=$(grep -ril "listen.*443" /etc/nginx/sites-enabled 2>/dev/null | head -1 || true)
fi

if [[ -z "$CONF" ]]; then
  CONF=$(grep -ril "listen.*443" /etc/nginx/conf.d 2>/dev/null | head -1 || true)
fi

if [[ -z "$CONF" ]]; then
  echo "==> ไม่พบไฟล์ nginx ที่เหมาะสมอัตโนมัติ"
  echo "รันคำสั่งนี้แล้วดูว่าไฟล์ไหนเป็นเว็บ API ของคุณ:"
  echo "  sudo grep -rE 'server_name|listen.*443' /etc/nginx/sites-enabled/ /etc/nginx/conf.d/ 2>/dev/null"
  echo ""
  echo "แล้วรัน (แทน PATH ด้วยไฟล์จริง):"
  echo "  sudo NGINX_CONF=PATH bash $0"
  echo ""
  echo "หรือใส่มือใน server { listen 443 ... } บรรทัดเดียว:"
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

  # แทรกหลังบรรทัด server_name แรก (มักอยู่ใน server block ของ 443)
  LINE_NUM=$(grep -nE "^[[:space:]]*server_name[[:space:]]" "$CONF" | head -1 | cut -d: -f1 || true)
  if [[ -z "${LINE_NUM:-}" ]]; then
    # ไม่มี server_name — ลองหลัง listen 443
    LINE_NUM=$(grep -nE "^[[:space:]]*listen[[:space:]]+443" "$CONF" | head -1 | cut -d: -f1 || true)
  fi
  if [[ -z "${LINE_NUM:-}" ]]; then
    echo "ไม่พบ server_name หรือ listen 443 ใน $CONF — แก้มือ"
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
