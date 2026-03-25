#!/usr/bin/env bash
# สำรอง PostgreSQL ใน Docker (service: db) — รันบน Linux/VPS จากโฟลเดอร์ pos_backend
# ใช้: bash scripts/backup-db.sh
# หรือ: chmod +x scripts/backup-db.sh && ./scripts/backup-db.sh
#
# ตัวแปรเลือกได้:
#   BACKUP_DIR=/path/to/backups  (ค่าเริ่มต้น ./backups)
#   RETENTION_DAYS=7             (ลบไฟล์ .sql.gz เก่ากว่า N วัน — 0 = ไม่ลบ)

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

BACKUP_DIR="${BACKUP_DIR:-$ROOT/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"
mkdir -p "$BACKUP_DIR"

if docker compose version &>/dev/null 2>&1; then
  DC=(docker compose)
else
  DC=(docker-compose)
fi

STAMP="$(date +%Y%m%d_%H%M%S)"
FILE="$BACKUP_DIR/loyalcloud_db_${STAMP}.sql.gz"

echo "→ กำลังสำรอง DB (pg_dump ใน container db) …"

"${DC[@]}" exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner' \
  | gzip > "$FILE"

echo "✅ สำเร็จ: $FILE"
ls -lh "$FILE"

if [[ "$RETENTION_DAYS" =~ ^[0-9]+$ ]] && [[ "$RETENTION_DAYS" -gt 0 ]]; then
  echo "→ ลบไฟล์สำรองเก่ากว่า ${RETENTION_DAYS} วัน (ถ้ามี) …"
  find "$BACKUP_DIR" -maxdepth 1 -name 'loyalcloud_db_*.sql.gz' -type f -mtime "+${RETENTION_DAYS}" -print -delete 2>/dev/null || true
fi

echo "ทดสอบไฟล์ (ควรเห็นข้อความ SQL/SQL header):"
gunzip -c "$FILE" | head -n 5
