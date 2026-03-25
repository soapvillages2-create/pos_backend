-- Migration: สร้างตาราง customers สำหรับแต่ละ tenant
-- Run: psql -U postgres -d loyalcloud_db -f migrations/005_create_customers.sql

CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(20) NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  email VARCHAR(255),
  points INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_customers_tenant_id ON customers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(tenant_id, phone);
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(tenant_id, name);
