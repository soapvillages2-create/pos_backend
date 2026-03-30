const orderModel = require('../models/order');

/**
 * POST /api/orders — tenantId ใน body (ถ้ามี) คือ shop/tenant ของร้านที่ POS อ้างอิง (ควรตรงกับ JWT ตอน login ร้าน);
 * ฝั่ง API ใช้ tenantId จาก Bearer token เป็นหลักเท่านั้น ไม่ได้อ่าน body.tenantId ไปบันทึกออเดอร์ — ถ้าอนาคตบังคับให้ body ตรง token ให้ยืนยันกับทีม POS ว่าส่งค่าตรงกัน
 */
async function create(req, res) {
  try {
    const tenantId = req.user.tenantId;
    const userId = req.user.userId;
    const {
      items,
      customerId,
      notes,
      note,
      tableNumber,
      tableNo,
      orderNumber,
      status,
    } = req.body;

    const order = await orderModel.create(tenantId, userId, {
      items: items || [],
      customerId,
      notes: notes ?? note,
      tableNumber: tableNumber ?? tableNo,
      orderNumber,
      status,
    });

    res.status(201).json({
      success: true,
      message: 'สร้างคำสั่งซื้อสำเร็จ',
      data: order,
    });
  } catch (err) {
    console.error('Order create error:', err);
    if (err.code === '23505') {
      return res.status(409).json({
        success: false,
        message: 'เลขออเดอร์ซ้ำ (orderNumber ถูกใช้แล้วใน tenant นี้)',
      });
    }
    const status = err.statusCode || 400;
    res.status(status).json({
      success: false,
      message: err.message || 'เกิดข้อผิดพลาด',
    });
  }
}

async function list(req, res) {
  try {
    const tenantId = req.user.tenantId;
    const { status, limit, offset } = req.query;

    const orders = await orderModel.findAllByTenant(tenantId, {
      status: status || undefined,
      limit: limit ? parseInt(limit, 10) : 50,
      offset: offset ? parseInt(offset, 10) : 0,
    });

    res.json({
      success: true,
      data: orders,
    });
  } catch (err) {
    console.error('Order list error:', err);
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

    const order = await orderModel.findById(id, tenantId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'ไม่พบคำสั่งซื้อ',
      });
    }

    res.json({
      success: true,
      data: order,
    });
  } catch (err) {
    console.error('Order getById error:', err);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาด',
    });
  }
}

async function updateStatus(req, res) {
  try {
    const tenantId = req.user.tenantId;
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        message: 'กรุณาระบุ status',
      });
    }

    const order = await orderModel.findById(id, tenantId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'ไม่พบคำสั่งซื้อ',
      });
    }

    const updated = await orderModel.updateStatus(id, tenantId, status);

    res.json({
      success: true,
      message: 'อัปเดตสถานะสำเร็จ',
      data: updated,
    });
  } catch (err) {
    console.error('Order updateStatus error:', err);
    res.status(400).json({
      success: false,
      message: err.message || 'เกิดข้อผิดพลาด',
    });
  }
}

module.exports = {
  create,
  list,
  getById,
  updateStatus,
};
