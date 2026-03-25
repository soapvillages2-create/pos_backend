-- Migration: สร้างตาราง products สำหรับแต่ละ tenant
-- Run: psql -U postgres -d loyalcloud_db -f migrations/003_create_products.sql

CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(20) NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  price DECIMAL(12, 2) NOT NULL DEFAULT 0,
  description TEXT,
  image_url VARCHAR(500),
  category VARCHAR(100),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_products_tenant_id ON products(tenant_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(tenant_id, category);
CREATE INDEX IF NOT EXISTS idx_products_is_active ON products(tenant_id, is_active);
