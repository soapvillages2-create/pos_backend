#!/usr/bin/env bash
# กู้คืนฐานข้อมูลจากไฟล์สำรอง (.sql หรือ .sql.gz) — ทับข้อมูลปัจจุบัน
# ใช้: bash scripts/restore-db.sh /path/to/loyalcloud_db_YYYYMMDD_HHMMSS.sql.gz
#
# ⚠️ อันตราย: จะลบ/แทนที่ object ตามที่อยู่ใน dump (--clean จาก backup-db.sh)
# แนะนำ: หยุดการใช้งานแอปชั่วคราว + สำรองก่อน restore เสมอ

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ $# -lt 1 ]] || [[ ! -f "$1" ]]; then
  echo "ใช้: $0 <ไฟล์สำรอง.sql.gz หรือ .sql>" >&2
  exit 1
fi

# path แบบ relative ให้ยึดจากรากโปรเจกต์
if [[ "$1" = /* ]]; then
  BACKUP_FILE="$1"
else
  BACKUP_FILE="$ROOT/$1"
fi

if docker compose version &>/dev/null 2>&1; then
  DC=(docker compose)
else
  DC=(docker-compose)
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "⚠️  กู้คืน DB จาก: $BACKUP_FILE"
echo "    ฐานข้อมูลเป้าหมาย: ค่า POSTGRES_DB ใน container db"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
read -r -p "พิมพ์ YES เพื่อดำเนินการต่อ: " confirm
if [[ "$confirm" != "YES" ]]; then
  echo "ยกเลิก"
  exit 0
fi

echo "→ หยุด backend ชั่วคราว (ลดการเขียนขณะ restore) …"
"${DC[@]}" stop backend || true

cleanup() {
  echo "→ สตาร์ท backend ใหม่ …"
  "${DC[@]}" start backend || true
}
trap cleanup EXIT

echo "→ กำลัง restore …"

if [[ "$BACKUP_FILE" == *.gz ]]; then
  gunzip -c "$BACKUP_FILE" | "${DC[@]}" exec -T db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -f -'
else
  "${DC[@]}" exec -T db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -f -' < "$BACKUP_FILE"
fi

echo "✅ restore เสร็จ (trap จะ start backend ให้อัตโนมัติ)"
