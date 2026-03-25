const pool = require('../config/db');

async function createTenant(name, province = null, country = null) {
  const maxRetries = 5;
  for (let i = 0; i < maxRetries; i++) {
    const tenantId = 'shop' + Math.floor(100000 + Math.random() * 900000).toString();
    try {
      const result = await pool.query(
        'INSERT INTO tenants (tenant_id, name, province, country) VALUES ($1, $2, $3, $4) RETURNING id, tenant_id, name, province, country, created_at',
        [tenantId, name, province || null, country || null]
      );
      return result.rows[0];
    } catch (err) {
      if (err.code === '23505' && i < maxRetries - 1) continue; // unique violation, retry
      throw err;
    }
  }
}

async function getTenantByTenantId(tenantId) {
  const result = await pool.query(
    'SELECT * FROM tenants WHERE tenant_id = $1',
    [tenantId]
  );
  return result.rows[0];
}

async function isTenantIdExists(tenantId) {
  const result = await pool.query(
    'SELECT 1 FROM tenants WHERE tenant_id = $1',
    [tenantId]
  );
  return result.rows.length > 0;
}

module.exports = {
  createTenant,
  getTenantByTenantId,
  isTenantIdExists,
};
