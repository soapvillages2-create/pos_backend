-- รัน migrations ทั้งหมดใน loyalcloud_db
-- เปิด pgAdmin > Query Tool > วางโค้ดนี้ > กด F5 (Execute)

-- 001: tenants, users
CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(20) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(20) NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'admin',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(email)
);

CREATE INDEX IF NOT EXISTS idx_users_tenant_id ON users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_tenants_tenant_id ON tenants(tenant_id);

-- 002: province, country
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS province VARCHAR(100);
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS country VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS agreed_to_terms_at TIMESTAMP WITH TIME ZONE;

-- 003: products
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

-- 004: orders, order_items
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(20) NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  order_number VARCHAR(50) NOT NULL,
  customer_id UUID,
  total_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  notes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_id, order_number)
);

CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  product_name VARCHAR(255) NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price DECIMAL(12, 2) NOT NULL,
  subtotal DECIMAL(12, 2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_orders_tenant_id ON orders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);

-- 005: customers
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

-- 006: table_number
ALTER TABLE orders ADD COLUMN IF NOT EXISTS table_number VARCHAR(20);

-- 007: password_hash สำหรับลูกค้าสมาชิก
ALTER TABLE customers ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);
CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_tenant_email ON customers(tenant_id, email) WHERE email IS NOT NULL AND email != '';

-- 008: รีเซ็ตรหัสผ่าน (เจ้าของร้าน / users)
ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_password_token VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_password_expires TIMESTAMP WITH TIME ZONE;
CREATE INDEX IF NOT EXISTS idx_users_reset_token ON users(reset_password_token)
  WHERE reset_password_token IS NOT NULL;

-- 009: QR VPS (รัน migrations/009_qr_vps.sql แยกได้ — รวมไว้ที่นี่เพื่อความสะดวก)
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

-- 010: หมายเหตุรายการออเดอร์ (บรรทัดแบบไม่ผูก product ในแคตตาล็อก)
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS note TEXT;

-- 011: POS catalog snapshot (GET /api/pos/catalog)
CREATE TABLE IF NOT EXISTS pos_catalog_snapshots (
  tenant_id VARCHAR(20) PRIMARY KEY REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  version INT NOT NULL DEFAULT 1,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb
);
