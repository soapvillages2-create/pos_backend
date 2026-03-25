-- Migration: เพิ่ม province, country ใน tenants และ agreed_to_terms_at ใน users
-- Run: psql -U postgres -d loyalcloud_db -f migrations/002_add_province_country_terms.sql

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS province VARCHAR(100);
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS country VARCHAR(100);

ALTER TABLE users ADD COLUMN IF NOT EXISTS agreed_to_terms_at TIMESTAMP WITH TIME ZONE;
