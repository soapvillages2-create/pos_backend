#!/bin/bash
# รัน migrations ทั้งหมดบน VPS
# ใช้: ./scripts/run-migrations.sh หรือ bash scripts/run-migrations.sh

cd "$(dirname "$0")/.."
DB_NAME="${DB_NAME:-loyalcloud_db}"

echo "Running migrations for database: $DB_NAME"

for f in migrations/*.sql; do
  echo "Running $f..."
  psql -U postgres -d "$DB_NAME" -f "$f" 2>/dev/null || true
done

echo "Migrations completed."
