-- Migration: เพิ่มคอลัมน์สำหรับรีเซ็ตรหัสผ่าน (เจ้าของร้าน / users)
-- Run: psql -U postgres -d loyalcloud_db -f migrations/008_add_reset_password_users.sql

ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_password_token VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_password_expires TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_users_reset_token ON users(reset_password_token)
  WHERE reset_password_token IS NOT NULL;
