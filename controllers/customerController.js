const customerModel = require('../models/customer');

async function create(req, res) {
  try {
    const tenantId = req.user.tenantId;
    const { name, phone, email, points, notes } = req.body;

    const customer = await customerModel.create(tenantId, {
      name,
      phone,
      email,
      points,
      notes,
    });

    res.status(201).json({
      success: true,
      message: 'เพิ่มลูกค้าสำเร็จ',
      data: customer,
    });
  } catch (err) {
    console.error('Customer create error:', err);
    res.status(400).json({
      success: false,
      message: err.message || 'เกิดข้อผิดพลาด',
    });
  }
}

async function list(req, res) {
  try {
    const tenantId = req.user.tenantId;
    const { search, limit, offset } = req.query;

    const customers = await customerModel.findAllByTenant(tenantId, {
      search: search || undefined,
      limit: limit ? parseInt(limit, 10) : 100,
      offset: offset ? parseInt(offset, 10) : 0,
    });

    // ไม่ส่ง password_hash ออกไป
    const safe = customers.map(({ password_hash, ...rest }) => rest);

    res.json({
      success: true,
      data: safe,
    });
  } catch (err) {
    console.error('Customer list error:', err);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาด',
    });
  }
}

async function getById(req, res) {
  try {
    const tenantId = req.user.tenantId;
    const { id } = req.params;

    const customer = await customerModel.findById(id, tenantId);
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'ไม่พบลูกค้า',
      });
    }

    res.json({
      success: true,
      data: customer,
    });
  } catch (err) {
    console.error('Customer getById error:', err);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาด',
    });
  }
}

async function update(req, res) {
  try {
    const tenantId = req.user.tenantId;
    const { id } = req.params;
    const { name, phone, email, points, notes } = req.body;

    const customer = await customerModel.findById(id, tenantId);
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'ไม่พบลูกค้า',
      });
    }

    const updated = await customerModel.update(id, tenantId, {
      name,
      phone,
      email,
      points,
      notes,
    });

    res.json({
      success: true,
      message: 'อัปเดตลูกค้าสำเร็จ',
      data: updated,
    });
  } catch (err) {
    console.error('Customer update error:', err);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาด',
    });
  }
}

async function updatePoints(req, res) {
  try {
    const tenantId = req.user.tenantId;
    const { id } = req.params;
    const { delta } = req.body;

    const customer = await customerModel.findById(id, tenantId);
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'ไม่พบลูกค้า',
      });
    }

    const updated = await customerModel.updatePoints(id, tenantId, delta);

    res.json({
      success: true,
      message: 'อัปเดตคะแนนสำเร็จ',
      data: updated,
    });
  } catch (err) {
    console.error('Customer updatePoints error:', err);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาด',
    });
  }
}

async function remove(req, res) {
  try {
    const tenantId = req.user.tenantId;
    const { id } = req.params;

    const deleted = await customerModel.remove(id, tenantId);
    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'ไม่พบลูกค้า',
      });
    }

    res.json({
      success: true,
      message: 'ลบลูกค้าสำเร็จ',
    });
  } catch (err) {
    console.error('Customer remove error:', err);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาด',
    });
  }
}

module.exports = {
  create,
  list,
  getById,
  update,
  updatePoints,
  remove,
};
