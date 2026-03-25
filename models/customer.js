const pool = require('../config/db');

async function create(tenantId, data) {
  const { name, phone, email, points, notes, passwordHash } = data;
  const displayName = (name && name.trim()) ? name.trim() : (email ? email.split('@')[0] : 'ลูกค้า');
  const result = await pool.query(
    `INSERT INTO customers (tenant_id, name, phone, email, points, notes, password_hash)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [tenantId, displayName, phone || null, email || null, parseInt(points, 10) || 0, notes || null, passwordHash || null]
  );
  return result.rows[0];
}

async function findByEmail(email, tenantId) {
  const result = await pool.query(
    'SELECT * FROM customers WHERE tenant_id = $1 AND LOWER(email) = LOWER($2)',
    [tenantId, email]
  );
  return result.rows[0];
}

/** หาลูกค้าจากอีเมลทั่วทั้งระบบ (มี password_hash) — สำหรับ login โดยไม่ต้องระบุร้าน */
async function findByEmailGlobal(email) {
  const result = await pool.query(
    `SELECT * FROM customers 
     WHERE LOWER(email) = LOWER($1) AND password_hash IS NOT NULL 
     ORDER BY created_at DESC`,
    [email]
  );
  return result.rows;
}

async function findAllByTenant(tenantId, options = {}) {
  const { search, limit = 100, offset = 0 } = options;
  let query = 'SELECT * FROM customers WHERE tenant_id = $1';
  const params = [tenantId];
  let paramIndex = 2;

  if (search && search.trim()) {
    const term = `%${search.trim()}%`;
    query += ` AND (name ILIKE $${paramIndex} OR phone ILIKE $${paramIndex} OR email ILIKE $${paramIndex})`;
    params.push(term);
    paramIndex++;
  }

  query += ` ORDER BY name ASC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
  params.push(limit, offset);

  const result = await pool.query(query, params);
  return result.rows;
}

async function findById(id, tenantId) {
  const result = await pool.query(
    'SELECT * FROM customers WHERE id = $1 AND tenant_id = $2',
    [id, tenantId]
  );
  return result.rows[0];
}

async function findByPhone(phone, tenantId) {
  const result = await pool.query(
    'SELECT * FROM customers WHERE tenant_id = $1 AND phone = $2',
    [tenantId, phone]
  );
  return result.rows[0];
}

async function update(id, tenantId, data) {
  const { name, phone, email, points, notes } = data;
  const result = await pool.query(
    `UPDATE customers SET
      name = COALESCE($3, name),
      phone = COALESCE($4, phone),
      email = COALESCE($5, email),
      points = COALESCE($6, points),
      notes = COALESCE($7, notes),
      updated_at = CURRENT_TIMESTAMP
     WHERE id = $1 AND tenant_id = $2
     RETURNING *`,
    [id, tenantId, name, phone, email, points != null ? parseInt(points, 10) : null, notes]
  );
  return result.rows[0];
}

async function updatePoints(id, tenantId, delta) {
  const result = await pool.query(
    `UPDATE customers SET points = GREATEST(0, points + $3), updated_at = CURRENT_TIMESTAMP
     WHERE id = $1 AND tenant_id = $2
     RETURNING *`,
    [id, tenantId, parseInt(delta, 10) || 0]
  );
  return result.rows[0];
}

async function remove(id, tenantId) {
  const result = await pool.query(
    'DELETE FROM customers WHERE id = $1 AND tenant_id = $2 RETURNING id',
    [id, tenantId]
  );
  return result.rows[0];
}

module.exports = {
  create,
  findAllByTenant,
  findById,
  findByPhone,
  findByEmail,
  findByEmailGlobal,
  update,
  updatePoints,
  remove,
};
