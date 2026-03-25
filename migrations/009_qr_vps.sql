-- QR Order ผ่าน HTTP (VPS) — คิวออเดอร์จากลูกค้า + ตาราง/ตะกร้า/เมนูเว็บ

-- รูปเมนูจากแอปอาจเป็น base64 ยาว
ALTER TABLE products ALTER COLUMN image_url TYPE TEXT;

ALTER TABLE products ADD COLUMN IF NOT EXISTS sync_key VARCHAR(64);
ALTER TABLE products ADD COLUMN IF NOT EXISTS menu_extras JSONB;
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_tenant_sync_key
  ON products(tenant_id, sync_key)
  WHERE sync_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS qr_pending_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(20) NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  table_no VARCHAR(50) NOT NULL DEFAULT '',
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  items JSONB NOT NULL DEFAULT '[]',
  customer_note TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_qr_pending_tenant_status
  ON qr_pending_orders(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_qr_pending_created
  ON qr_pending_orders(tenant_id, created_at DESC);

CREATE TABLE IF NOT EXISTS qr_table_snapshots (
  tenant_id VARCHAR(20) NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  table_no VARCHAR(50) NOT NULL,
  items JSONB NOT NULL DEFAULT '[]',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (tenant_id, table_no)
);

CREATE TABLE IF NOT EXISTS qr_table_carts (
  tenant_id VARCHAR(20) NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  table_no VARCHAR(50) NOT NULL,
  items JSONB NOT NULL DEFAULT '[]',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (tenant_id, table_no)
);

CREATE TABLE IF NOT EXISTS qr_table_last_payment (
  tenant_id VARCHAR(20) NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  table_no VARCHAR(50) NOT NULL,
  last_payment_at TIMESTAMP WITH TIME ZONE NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (tenant_id, table_no)
);

CREATE TABLE IF NOT EXISTS qr_call_for_payment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(20) NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  table_no VARCHAR(50) NOT NULL,
  at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_qr_cfp_tenant ON qr_call_for_payment(tenant_id, at);

CREATE TABLE IF NOT EXISTS qr_web_menu_config (
  tenant_id VARCHAR(20) PRIMARY KEY REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  store_name VARCHAR(255),
  web_menu_logo_url TEXT,
  url_token VARCHAR(255),
  url_token_expiry TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
