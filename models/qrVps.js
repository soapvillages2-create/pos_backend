const pool = require('../config/db');

function normalizeItems(items) {
  if (!Array.isArray(items)) return [];
  return items.map((it) => ({
    productName: String(it.productName ?? it.name ?? ''),
    qty: Math.max(1, parseInt(it.qty, 10) || 1),
    unitPrice: parseFloat(it.unitPrice) || 0,
    ...(it.note != null && String(it.note).trim() !== '' ? { note: String(it.note) } : {}),
  }));
}

async function createPendingOrder(tenantId, { tableNo, items, customerNote, status = 'pending' }) {
  const norm = normalizeItems(items);
  if (norm.length === 0) throw new Error('กรุณาระบุรายการสินค้า');
  const result = await pool.query(
    `INSERT INTO qr_pending_orders (tenant_id, table_no, status, items, customer_note)
     VALUES ($1, $2, $3, $4::jsonb, $5)
     RETURNING *`,
    [tenantId, (tableNo || '').trim(), status, JSON.stringify(norm), customerNote || null]
  );
  return result.rows[0];
}

async function listPendingOrders(tenantId) {
  const result = await pool.query(
    `SELECT id, tenant_id, table_no, status, items, customer_note, created_at, updated_at
     FROM qr_pending_orders
     WHERE tenant_id = $1 AND status = 'pending'
     ORDER BY created_at ASC`,
    [tenantId]
  );
  return result.rows;
}

async function findPendingById(id, tenantId) {
  const result = await pool.query(
    'SELECT * FROM qr_pending_orders WHERE id = $1 AND tenant_id = $2',
    [id, tenantId]
  );
  return result.rows[0];
}

async function updatePendingStatus(id, tenantId, status) {
  const result = await pool.query(
    `UPDATE qr_pending_orders SET status = $3, updated_at = CURRENT_TIMESTAMP
     WHERE id = $1 AND tenant_id = $2
     RETURNING *`,
    [id, tenantId, status]
  );
  return result.rows[0];
}

async function markTableOrdersPaid(tenantId, tableNo) {
  const t = (tableNo || '').trim();
  await pool.query(
    `UPDATE qr_pending_orders SET status = 'paid', updated_at = CURRENT_TIMESTAMP
     WHERE tenant_id = $1 AND table_no = $2 AND status IN ('pending', 'confirmed')`,
    [tenantId, t]
  );
}

async function upsertTableLastPayment(tenantId, tableNo, lastPaymentAt) {
  const t = (tableNo || '').trim();
  const at = lastPaymentAt instanceof Date ? lastPaymentAt : new Date(lastPaymentAt);
  await pool.query(
    `INSERT INTO qr_table_last_payment (tenant_id, table_no, last_payment_at)
     VALUES ($1, $2, $3)
     ON CONFLICT (tenant_id, table_no) DO UPDATE SET
       last_payment_at = EXCLUDED.last_payment_at,
       updated_at = CURRENT_TIMESTAMP`,
    [tenantId, t, at]
  );
}

async function upsertTableSnapshot(tenantId, tableNo, items) {
  const t = (tableNo || '').trim();
  const norm = normalizeItems(items);
  await pool.query(
    `INSERT INTO qr_table_snapshots (tenant_id, table_no, items, updated_at)
     VALUES ($1, $2, $3::jsonb, CURRENT_TIMESTAMP)
     ON CONFLICT (tenant_id, table_no) DO UPDATE SET
       items = EXCLUDED.items,
       updated_at = CURRENT_TIMESTAMP`,
    [tenantId, t, JSON.stringify(norm)]
  );
}

async function deleteTableSnapshot(tenantId, tableNo) {
  await pool.query(
    'DELETE FROM qr_table_snapshots WHERE tenant_id = $1 AND table_no = $2',
    [tenantId, (tableNo || '').trim()]
  );
}

async function getTableSnapshot(tenantId, tableNo) {
  const result = await pool.query(
    'SELECT items, updated_at FROM qr_table_snapshots WHERE tenant_id = $1 AND table_no = $2',
    [tenantId, (tableNo || '').trim()]
  );
  return result.rows[0];
}

async function upsertTableCart(tenantId, tableNo, items) {
  const t = (tableNo || '').trim();
  const norm = normalizeItems(items);
  await pool.query(
    `INSERT INTO qr_table_carts (tenant_id, table_no, items, updated_at)
     VALUES ($1, $2, $3::jsonb, CURRENT_TIMESTAMP)
     ON CONFLICT (tenant_id, table_no) DO UPDATE SET
       items = EXCLUDED.items,
       updated_at = CURRENT_TIMESTAMP`,
    [tenantId, t, JSON.stringify(norm)]
  );
}

async function getTableCart(tenantId, tableNo) {
  const result = await pool.query(
    'SELECT items, updated_at FROM qr_table_carts WHERE tenant_id = $1 AND table_no = $2',
    [tenantId, (tableNo || '').trim()]
  );
  return result.rows[0];
}

async function insertCallForPayment(tenantId, tableNo) {
  const result = await pool.query(
    `INSERT INTO qr_call_for_payment (tenant_id, table_no, at)
     VALUES ($1, $2, CURRENT_TIMESTAMP)
     RETURNING id, table_no, at`,
    [tenantId, (tableNo || '').trim()]
  );
  return result.rows[0];
}

async function fetchAndClearCallForPayment(tenantId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const sel = await client.query(
      `SELECT id, table_no, at FROM qr_call_for_payment
       WHERE tenant_id = $1
       ORDER BY at ASC
       FOR UPDATE`,
      [tenantId]
    );
    const rows = sel.rows;
    if (rows.length > 0) {
      await client.query('DELETE FROM qr_call_for_payment WHERE tenant_id = $1', [tenantId]);
    }
    await client.query('COMMIT');
    return rows;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

async function upsertWebMenuConfig(tenantId, { storeName, webMenuLogoUrl, urlToken, urlTokenExpiry }) {
  await pool.query(
    `INSERT INTO qr_web_menu_config (tenant_id, store_name, web_menu_logo_url, url_token, url_token_expiry, updated_at)
     VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
     ON CONFLICT (tenant_id) DO UPDATE SET
       store_name = COALESCE(EXCLUDED.store_name, qr_web_menu_config.store_name),
       web_menu_logo_url = COALESCE(EXCLUDED.web_menu_logo_url, qr_web_menu_config.web_menu_logo_url),
       url_token = COALESCE(EXCLUDED.url_token, qr_web_menu_config.url_token),
       url_token_expiry = COALESCE(EXCLUDED.url_token_expiry, qr_web_menu_config.url_token_expiry),
       updated_at = CURRENT_TIMESTAMP`,
    [
      tenantId,
      storeName || null,
      webMenuLogoUrl || null,
      urlToken || null,
      urlTokenExpiry ? new Date(urlTokenExpiry) : null,
    ]
  );
}

module.exports = {
  normalizeItems,
  createPendingOrder,
  listPendingOrders,
  findPendingById,
  updatePendingStatus,
  markTableOrdersPaid,
  upsertTableLastPayment,
  upsertTableSnapshot,
  deleteTableSnapshot,
  getTableSnapshot,
  upsertTableCart,
  getTableCart,
  insertCallForPayment,
  fetchAndClearCallForPayment,
  upsertWebMenuConfig,
};
