const pool = require('../config/db');

/**
 * เมนูที่แสดงบนมือถือ/เว็บ QR — แหล่งเดียวกับ POST /api/qr/sync-menu
 * แยกจาก catalog หลัก (`products` ที่อาจสร้างจาก CRM / API อื่น)
 */
async function findAllActiveByTenant(tenantId, limit = 200) {
  const result = await pool.query(
    `SELECT * FROM qr_menu_products
     WHERE tenant_id = $1 AND is_active = true
     ORDER BY category NULLS LAST, name ASC
     LIMIT $2`,
    [tenantId, limit]
  );
  return result.rows;
}

/**
 * @param {import('pg').PoolClient} client
 */
async function upsertRow(client, row) {
  const {
    id,
    tenantId,
    syncKey,
    name,
    price,
    description,
    imageUrl,
    category,
    isActive,
    menuExtrasJson,
  } = row;
  await client.query(
    `INSERT INTO qr_menu_products (
       id, tenant_id, sync_key, name, price, description, image_url, category, is_active, menu_extras, updated_at
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, CURRENT_TIMESTAMP)
     ON CONFLICT (tenant_id, sync_key) DO UPDATE SET
       id = EXCLUDED.id,
       name = EXCLUDED.name,
       price = EXCLUDED.price,
       description = EXCLUDED.description,
       image_url = EXCLUDED.image_url,
       category = EXCLUDED.category,
       is_active = EXCLUDED.is_active,
       menu_extras = EXCLUDED.menu_extras,
       updated_at = CURRENT_TIMESTAMP`,
    [
      id,
      tenantId,
      syncKey,
      name,
      price,
      description ?? null,
      imageUrl ?? null,
      category ?? null,
      isActive,
      menuExtrasJson,
    ]
  );
}

/**
 * หา active product ด้วย id (UUID ที่ sync มาจาก POS) — ใช้ตรวจออเดอร์ก่อนบันทึก
 * คืน row ถ้าเจอ, null ถ้าไม่มีหรือ is_active = false
 */
async function findActiveById(tenantId, productId) {
  const result = await pool.query(
    `SELECT id, name, price FROM qr_menu_products
     WHERE tenant_id = $1 AND id = $2 AND is_active = true`,
    [tenantId, productId]
  );
  return result.rows[0] ?? null;
}

/**
 * ตรวจ items array จากลูกค้าว่าทุกรายการมีในเมนู active ของร้านหรือไม่
 * items ต้องมี productId (UUID ที่ตรงกับ qr_menu_products.id)
 * คืน { valid: true, items: [...enriched] } หรือ { valid: false, invalidNames: [...] }
 */
async function validateAndEnrichItems(tenantId, items) {
  if (!Array.isArray(items) || items.length === 0) {
    return { valid: false, invalidNames: [] };
  }
  const enriched = [];
  const invalidNames = [];
  for (const it of items) {
    const pid = String(it.productId ?? it.product_id ?? '').trim();
    if (!pid) {
      invalidNames.push(String(it.productName ?? it.name ?? '(ไม่มีชื่อ)'));
      continue;
    }
    const product = await findActiveById(tenantId, pid);
    if (!product) {
      invalidNames.push(String(it.productName ?? it.name ?? pid));
      continue;
    }
    enriched.push({
      ...it,
      productId: product.id,
      productName: product.name,
      unitPrice: parseFloat(product.price),
    });
  }
  if (invalidNames.length > 0) {
    return { valid: false, invalidNames };
  }
  return { valid: true, items: enriched };
}

module.exports = {
  findAllActiveByTenant,
  upsertRow,
  findActiveById,
  validateAndEnrichItems,
};
