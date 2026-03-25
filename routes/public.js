const express = require('express');
const router = express.Router();
const productModel = require('../models/product');
const tenantModel = require('../models/tenant');
const qrController = require('../controllers/qrController');

// เมนูสินค้าแบบ public (สำหรับ QR Order - ไม่ต้อง Login)
router.get('/products/:tenantId', async (req, res) => {
  try {
    const { tenantId } = req.params;
    const tenant = await tenantModel.getTenantByTenantId(tenantId);
    if (!tenant) {
      return res.status(404).json({
        success: false,
        message: 'ไม่พบร้านค้า',
      });
    }

    const products = await productModel.findAllByTenant(tenantId, {
      isActive: true,
      limit: 200,
    });

    res.json({
      success: true,
      data: {
        store: { name: tenant.name, tenantId: tenant.tenant_id },
        products,
      },
    });
  } catch (err) {
    console.error('Public products error:', err);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาด',
    });
  }
});

// ลูกค้าส่งออเดอร์จากหน้าเมนู QR (ไม่ต้องล็อกอิน) — เก็บเป็นคิว pending ให้ POS ดึงผ่าน GET /api/qr/pending-orders
router.post('/qr-order', qrController.publicGuestOrder);

// ลูกค้ากดเรียกเก็บเงิน — POS ดึงผ่าน GET /api/qr/call-for-payment-events
router.post('/qr-call-for-payment', qrController.publicCallForPayment);

module.exports = router;
