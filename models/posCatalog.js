const pool = require('../config/db');

async function getSnapshot(tenantId) {
  const r = await pool.query(
    `SELECT version, updated_at, payload FROM pos_catalog_snapshots WHERE tenant_id = $1`,
    [tenantId]
  );
  return r.rows[0] || null;
}

async function getQrWebMenuConfig(tenantId) {
  const r = await pool.query(
    `SELECT store_name, web_menu_logo_url, updated_at FROM qr_web_menu_config WHERE tenant_id = $1`,
    [tenantId]
  );
  return r.rows[0] || null;
}

module.exports = {
  getSnapshot,
  getQrWebMenuConfig,
};
