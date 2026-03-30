-- Snapshot เมนู/หมวด/addon ต่อ tenant — GET /api/pos/catalog อ่านได้
-- ถ้า payload ว่างหรือยังไม่มีแถว ระบบจะสร้าง catalog จากตาราง products แทน
CREATE TABLE IF NOT EXISTS pos_catalog_snapshots (
  tenant_id VARCHAR(20) PRIMARY KEY REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  version INT NOT NULL DEFAULT 1,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb
);
