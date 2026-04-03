const posStaffModel = require('../models/posStaff');

/**
 * GET /api/pos/staff — ดึง staff ทั้งหมดของร้าน (JWT required)
 */
async function getStaff(req, res) {
  try {
    const tenantId = req.user.tenantId;
    const staff = await posStaffModel.getAllStaff(tenantId);
    return res.status(200).json({ ok: true, staff });
  } catch (err) {
    console.error('GET /api/pos/staff error:', err);
    return res.status(500).json({ ok: false, error: 'ไม่สามารถโหลดรายการพนักงานได้' });
  }
}

/**
 * POST /api/pos/staff/sync — sync staff list (JWT required)
 * Body: { staff: [{name, pin, role, isActive, permissionsJson}] }
 */
async function syncStaff(req, res) {
  try {
    const tenantId = req.user.tenantId;
    const { staff } = req.body;
    if (!Array.isArray(staff)) {
      return res.status(400).json({ ok: false, error: 'staff[] required' });
    }
    const synced = await posStaffModel.syncStaff(tenantId, staff);
    return res.status(200).json({ ok: true, synced });
  } catch (err) {
    console.error('POST /api/pos/staff/sync error:', err);
    return res.status(500).json({ ok: false, error: 'sync staff ไม่สำเร็จ' });
  }
}

module.exports = { getStaff, syncStaff };
