const pool = require('../config/db');

async function getAllStaff(tenantId) {
  try {
    const r = await pool.query(
      `SELECT name, pin, role, is_active AS "isActive", permissions_json AS "permissionsJson"
       FROM pos_staff WHERE tenant_id = $1 ORDER BY created_at`,
      [tenantId]
    );
    return r.rows;
  } catch {
    return [];
  }
}

/** สร้าง tenant อัตโนมัติถ้ายังไม่มี — รองรับ store ใหม่ที่ยังไม่ถูก migrate */
async function ensureTenantExists(client, tenantId) {
  await client.query(
    `INSERT INTO tenants (tenant_id, name)
     VALUES ($1, $1)
     ON CONFLICT (tenant_id) DO NOTHING`,
    [tenantId]
  );
}

async function syncStaff(tenantId, staffList) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await ensureTenantExists(client, tenantId);

    const names = staffList.map((s) => s.name);

    for (const s of staffList) {
      await client.query(
        `INSERT INTO pos_staff (tenant_id, name, pin, role, is_active, permissions_json, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
         ON CONFLICT (tenant_id, name) DO UPDATE SET
           pin = EXCLUDED.pin,
           role = EXCLUDED.role,
           is_active = EXCLUDED.is_active,
           permissions_json = EXCLUDED.permissions_json,
           updated_at = CURRENT_TIMESTAMP`,
        [
          tenantId,
          s.name,
          s.pin || '',
          s.role || 'staff',
          s.isActive !== false,
          s.permissionsJson || null,
        ]
      );
    }

    // ลบ staff ที่ไม่อยู่ใน list ที่ส่งมา
    if (names.length > 0) {
      await client.query(
        `DELETE FROM pos_staff WHERE tenant_id = $1 AND name != ALL($2::text[])`,
        [tenantId, names]
      );
    } else {
      await client.query(`DELETE FROM pos_staff WHERE tenant_id = $1`, [tenantId]);
    }

    await client.query('COMMIT');
    return staffList.length;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

module.exports = { getAllStaff, syncStaff };
