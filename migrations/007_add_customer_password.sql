-- Migration: เพิ่ม password_hash สำหรับลูกค้าสมาชิก (member login)
ALTER TABLE customers ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);
CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_tenant_email ON customers(tenant_id, email) WHERE email IS NOT NULL AND email != '';
