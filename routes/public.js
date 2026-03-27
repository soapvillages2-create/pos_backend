const express = require('express');
const router = express.Router();
const pool = require('../config/db');
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

    let webMenu = null;
    try {
      const cfg = await pool.query(
        `SELECT store_name, web_menu_logo_url, url_token, url_token_expiry
         FROM qr_web_menu_config WHERE tenant_id = $1`,
        [tenantId]
      );
      if (cfg.rows.length > 0) webMenu = cfg.rows[0];
    } catch (e) {
      if (e.code !== '42P01') console.warn('Public products webMenu:', e.message);
    }

    res.json({
      success: true,
      data: {
        store: { name: tenant.name, tenantId: tenant.tenant_id },
        webMenu,
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
