-- เมนูสำหรับหน้าเว็บ/มือถือ QR — เขียนจาก POST /api/qr/sync-menu เท่านั้น
-- GET /api/public/products/:tenantId อ่านจากตารางนี้ ไม่ใช่ catalog หลัก (products ทั้งก้อนที่อาจมีจาก CRM)
CREATE TABLE IF NOT EXISTS qr_menu_products (
  id UUID PRIMARY KEY,
  tenant_id VARCHAR(20) NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  sync_key VARCHAR(64) NOT NULL,
  name VARCHAR(255) NOT NULL,
  price DECIMAL(12, 2) NOT NULL DEFAULT 0,
  description TEXT,
  image_url TEXT,
  category VARCHAR(100),
  is_active BOOLEAN NOT NULL DEFAULT true,
  menu_extras JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (tenant_id, sync_key)
);

CREATE INDEX IF NOT EXISTS idx_qr_menu_products_tenant ON qr_menu_products(tenant_id);
CREATE INDEX IF NOT EXISTS idx_qr_menu_products_active ON qr_menu_products(tenant_id, is_active);

-- แถวที่เคยซิงค์ไว้ในตาราง products อยู่แล้ว — คัดลอกมาเป็นจุดเริ่ม
INSERT INTO qr_menu_products (id, tenant_id, sync_key, name, price, description, image_url, category, is_active, menu_extras, created_at, updated_at)
SELECT id, tenant_id, sync_key, name, price, description, image_url, category, is_active, menu_extras, created_at, updated_at
FROM products
WHERE sync_key IS NOT NULL
ON CONFLICT (tenant_id, sync_key) DO UPDATE SET
  name = EXCLUDED.name,
  price = EXCLUDED.price,
  description = EXCLUDED.description,
  image_url = EXCLUDED.image_url,
  category = EXCLUDED.category,
  is_active = EXCLUDED.is_active,
  menu_extras = EXCLUDED.menu_extras,
  updated_at = EXCLUDED.updated_at;
