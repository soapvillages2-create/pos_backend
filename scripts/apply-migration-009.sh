#!/usr/bin/env sh
# รัน migration QR VPS บน PostgreSQL ใน container `db`
# ใช้จากโฟลเดอร์ pos_backend:  chmod +x scripts/apply-migration-009.sh && ./scripts/apply-migration-009.sh
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
SQL="$ROOT/migrations/009_qr_vps.sql"
if [ ! -f "$SQL" ]; then
  echo "ไม่พบไฟล์: $SQL" >&2
  exit 1
fi

# เซิร์ฟเวอร์บางตัว (เช่น Docker เก่า) มีแค่ docker-compose — ลองแบบนี้ก่อนเพื่อไม่ให้ error จาก docker compose
if docker-compose version >/dev/null 2>&1; then
  DC="docker-compose"
elif docker compose version >/dev/null 2>&1; then
  DC="docker compose"
else
  echo "ไม่พบ docker-compose หรือ docker compose — ติดตั้ง Docker Compose หรือปลั๊กอิน compose" >&2
  exit 1
fi

$DC exec -T db sh -c 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -f -' < "$SQL"
echo "OK: 009_qr_vps.sql ใช้กับฐานข้อมูลแล้ว — รีสตาร์ท backend: $DC restart backend"
