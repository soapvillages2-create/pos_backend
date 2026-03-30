const pool = require('../config/db');

async function createUser(tenantId, email, passwordHash, fullName, role = 'admin', agreedToTermsAt = null) {
  const result = await pool.query(
    `INSERT INTO users (tenant_id, email, password_hash, full_name, role, agreed_to_terms_at)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, tenant_id, email, full_name, role, agreed_to_terms_at, created_at`,
    [tenantId, email.toLowerCase(), passwordHash, fullName, role, agreedToTermsAt]
  );
  return result.rows[0];
}

async function getUserByEmail(email) {
  const result = await pool.query(
    'SELECT * FROM users WHERE email = $1',
    [email.toLowerCase()]
  );
  return result.rows[0];
}

async function getUserById(id) {
  const result = await pool.query(
    'SELECT id, tenant_id, email, full_name, role, created_at FROM users WHERE id = $1',
    [id]
  );
  return result.rows[0];
}

/** แถว users ครบ รวม password_hash — ใช้เฉพาะ flow ที่ต้องตรวจรหัส (เช่น ลบบัญชี) */
async function getUserByIdWithPassword(id) {
  const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
  return result.rows[0];
}

/** บันทึก token รีเซ็ตรหัสผ่าน + เวลาหมดอายุ */
async function setResetPasswordToken(userId, token, expiresAt) {
  const result = await pool.query(
    `UPDATE users
     SET reset_password_token = $2, reset_password_expires = $3
     WHERE id = $1
     RETURNING id, email`,
    [userId, token, expiresAt]
  );
  return result.rows[0];
}

/** ค้นหา user ที่อีเมล + token ตรง และ token ยังไม่หมดอายุ */
async function findUserByEmailAndValidResetToken(email, token) {
  const result = await pool.query(
    `SELECT * FROM users
     WHERE email = $1
       AND reset_password_token = $2
       AND reset_password_expires IS NOT NULL
       AND reset_password_expires > CURRENT_TIMESTAMP`,
    [email.toLowerCase(), token]
  );
  return result.rows[0];
}

/** อัปเดตรหัสผ่านใหม่และล้าง token */
async function updatePasswordAndClearResetToken(userId, passwordHash) {
  const result = await pool.query(
    `UPDATE users
     SET password_hash = $2,
         reset_password_token = NULL,
         reset_password_expires = NULL
     WHERE id = $1
     RETURNING id, tenant_id, email, full_name, role`,
    [userId, passwordHash]
  );
  return result.rows[0];
}

module.exports = {
  createUser,
  getUserByEmail,
  getUserById,
  getUserByIdWithPassword,
  setResetPasswordToken,
  findUserByEmailAndValidResetToken,
  updatePasswordAndClearResetToken,
};
