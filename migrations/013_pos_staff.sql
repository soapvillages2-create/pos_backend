-- Staff sync across POS devices — GET/POST /api/pos/staff
CREATE TABLE IF NOT EXISTS pos_staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(20) NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  pin VARCHAR(10) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'staff',
  is_active BOOLEAN NOT NULL DEFAULT true,
  permissions_json TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (tenant_id, name)
);

CREATE INDEX IF NOT EXISTS idx_pos_staff_tenant ON pos_staff(tenant_id);
