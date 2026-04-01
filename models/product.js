const pool = require('../config/db');
const qrMenuProduct = require('./qrMenuProduct');

async function create(tenantId, data) {
  const { name, price, description, imageUrl, category, isActive = true } = data;
  const result = await pool.query(
    `INSERT INTO products (tenant_id, name, price, description, image_url, category, is_active)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [tenantId, name, parseFloat(price) || 0, description || null, imageUrl || null, category || null, isActive !== false]
  );
  return result.rows[0];
}

/** ดึงสินค้าทั้งหมดของ tenant สำหรับซิงค์เมนู (ไม่ paginate) */
async function findAllForCatalog(tenantId) {
  const result = await pool.query(
    `SELECT * FROM products WHERE tenant_id = $1
     ORDER BY category NULLS LAST, name ASC`,
    [tenantId]
  );
  return result.rows;
}

async function findAllByTenant(tenantId, options = {}) {
  const { category, isActive, limit = 100, offset = 0 } = options;
  let query = 'SELECT * FROM products WHERE tenant_id = $1';
  const params = [tenantId];
  let paramIndex = 2;

  if (category != null && category !== '') {
    query += ` AND category = $${paramIndex}`;
    params.push(category);
    paramIndex++;
  }
  if (isActive !== undefined) {
    query += ` AND is_active = $${paramIndex}`;
    params.push(isActive);
    paramIndex++;
  }

  query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
  params.push(limit, offset);

  const result = await pool.query(query, params);
  return result.rows;
}

async function findById(id, tenantId) {
  const result = await pool.query(
    'SELECT * FROM products WHERE id = $1 AND tenant_id = $2',
    [id, tenantId]
  );
  return result.rows[0];
}

async function update(id, tenantId, data) {
  const { name, price, description, imageUrl, category, isActive } = data;
  const result = await pool.query(
    `UPDATE products SET
      name = COALESCE($3, name),
      price = COALESCE($4, price),
      description = COALESCE($5, description),
      image_url = COALESCE($6, image_url),
      category = COALESCE($7, category),
      is_active = COALESCE($8, is_active),
      updated_at = CURRENT_TIMESTAMP
     WHERE id = $1 AND tenant_id = $2
     RETURNING *`,
    [id, tenantId, name, price != null ? parseFloat(price) : null, description, imageUrl, category, isActive]
  );
  return result.rows[0];
}

async function remove(id, tenantId) {
  const result = await pool.query(
    'DELETE FROM products WHERE id = $1 AND tenant_id = $2 RETURNING id',
    [id, tenantId]
  );
  return result.rows[0];
}

/**
 * Sync เมนูจากแอป (QR) — จับคู่ด้วย sync_key = id จาก SQLite ฝั่งแอป
 */
async function upsertFromQrMenuSync(tenantId, products) {
  if (!Array.isArray(products) || products.length === 0) return;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const p of products) {
      const syncKey = String(p.id ?? p.syncKey ?? '');
      if (!syncKey) continue;
      const name = String(p.name || '').trim() || 'ไม่มีชื่อ';
      const price = parseFloat(p.price) || 0;
      const category =
        p.categoryName != null
          ? String(p.categoryName)
          : p.category != null
            ? String(p.category)
            : null;
      const imageUrl =
        p.imageUrl != null && String(p.imageUrl).trim() !== ''
          ? String(p.imageUrl)
          : null;
      const isActive = p.isActive !== false;
      const menuExtras = {
        imageAlignY: p.imageAlignY,
        emoji: p.emoji,
        addons: p.addons,
      };

      const menuExtrasJson = JSON.stringify(menuExtras);
      const existing = await client.query(
        'SELECT id FROM products WHERE tenant_id = $1 AND sync_key = $2',
        [tenantId, syncKey]
      );
      let productId;
      if (existing.rows.length > 0) {
        productId = existing.rows[0].id;
        await client.query(
          `UPDATE products SET
            name = $3, price = $4, image_url = COALESCE($5, image_url), category = COALESCE($6, category),
            is_active = $7, menu_extras = $8::jsonb, updated_at = CURRENT_TIMESTAMP
           WHERE tenant_id = $1 AND sync_key = $2`,
          [tenantId, syncKey, name, price, imageUrl, category, isActive, menuExtrasJson]
        );
      } else {
        const ins = await client.query(
          `INSERT INTO products (tenant_id, name, price, description, image_url, category, is_active, sync_key, menu_extras)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
           RETURNING id`,
          [tenantId, name, price, null, imageUrl, category, isActive, syncKey, menuExtrasJson]
        );
        productId = ins.rows[0].id;
      }
      await qrMenuProduct.upsertRow(client, {
        id: productId,
        tenantId,
        syncKey,
        name,
        price,
        description: null,
        imageUrl,
        category,
        isActive,
        menuExtrasJson,
      });
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  create,
  findAllByTenant,
  findAllForCatalog,
  findById,
  update,
  remove,
  upsertFromQrMenuSync,
};
