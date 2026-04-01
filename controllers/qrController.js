const qrVps = require('../models/qrVps');
const tenantModel = require('../models/tenant');
const productModel = require('../models/product');
const pool = require('../config/db');

const TENANT_ROOM_PREFIX = 'tenant:';

function emitQrOrderNew(req, tenantId, row) {
  const io = req.app.get('io');
  if (!io || !row) return;
  let items = row.items;
  if (typeof items === 'string') {
    try {
      items = JSON.parse(items);
    } catch {
      items = [];
    }
  }
  if (!Array.isArray(items)) items = [];
  io.to(TENANT_ROOM_PREFIX + tenantId).emit('order:new', {
    order: {
      id: row.id,
      tenant_id: tenantId,
      table_number: row.table_no,
      status: row.status,
      items,
      notes: row.customer_note,
      created_at: row.created_at,
    },
    source: 'qr',
  });
}

function mapPendingRow(row) {
  let items = row.items;
  if (typeof items === 'string') {
    try {
      items = JSON.parse(items);
    } catch {
      items = [];
    }
  }
  if (!Array.isArray(items)) items = [];
  return {
    id: String(row.id),
    shopId: row.tenant_id,
    tableNo: row.table_no || '',
    status: row.status || 'pending',
    items,
    customerNote: row.customer_note || null,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
  };
}

/** body/query shopId ต้องตรงกับ JWT claim tenantId (= tenants.tenant_id) แบบ string เทียบหลัง trim */
function requireShopMatch(req, shopId) {
  const sid = shopId != null ? String(shopId).trim() : '';
  const tid = req.user.tenantId != null ? String(req.user.tenantId).trim() : '';
  if (!sid || sid !== tid) return false;
  return true;
}

async function getPendingOrders(req, res) {
  try {
    const shopId = req.query.shopId;
    if (!requireShopMatch(req, shopId)) {
      return res.status(403).json({ success: false, message: 'ไม่ตรงกับร้านที่ล็อกอิน' });
    }
    const rows = await qrVps.listPendingOrders(shopId);
    res.json(rows.map(mapPendingRow));
  } catch (err) {
    console.error('qr pending-orders:', err);
    res.status(500).json({ success: false, message: err.message || 'เกิดข้อผิดพลาด' });
  }
}

async function confirmOrder(req, res) {
  try {
    const { orderId } = req.params;
    const row = await qrVps.findPendingById(orderId, req.user.tenantId);
    if (!row) {
      return res.status(404).json({ success: false, message: 'ไม่พบออเดอร์' });
    }
    const updated = await qrVps.updatePendingStatus(orderId, req.user.tenantId, 'confirmed');
    res.json({ success: true, data: updated });
  } catch (err) {
    console.error('qr confirm:', err);
    res.status(500).json({ success: false, message: err.message || 'เกิดข้อผิดพลาด' });
  }
}

async function pushOrder(req, res) {
  try {
    const { shopId, tableNo, items, status, customerNote } = req.body || {};
    if (!requireShopMatch(req, shopId)) {
      return res.status(403).json({ success: false, message: 'ไม่ตรงกับร้านที่ล็อกอิน' });
    }
    const st = (status || 'confirmed').toLowerCase();
    const row = await qrVps.createPendingOrder(shopId, {
      tableNo,
      items,
      customerNote,
      status: ['pending', 'confirmed', 'paid'].includes(st) ? st : 'confirmed',
    });
    res.status(201).json({ success: true, data: mapPendingRow(row) });
  } catch (err) {
    console.error('qr push-order:', err);
    res.status(400).json({ success: false, message: err.message || 'เกิดข้อผิดพลาด' });
  }
}

async function tableLastPayment(req, res) {
  try {
    const { shopId, tableNo, lastPaymentAt } = req.body || {};
    if (!requireShopMatch(req, shopId)) {
      return res.status(403).json({ success: false, message: 'ไม่ตรงกับร้านที่ล็อกอิน' });
    }
    await qrVps.upsertTableLastPayment(shopId, tableNo, lastPaymentAt || new Date());
    res.json({ success: true });
  } catch (err) {
    console.error('qr table-last-payment:', err);
    res.status(500).json({ success: false, message: err.message || 'เกิดข้อผิดพลาด' });
  }
}

async function markTableOrdersPaid(req, res) {
  try {
    const { shopId, tableNo } = req.body || {};
    if (!requireShopMatch(req, shopId)) {
      return res.status(403).json({ success: false, message: 'ไม่ตรงกับร้านที่ล็อกอิน' });
    }
    await qrVps.markTableOrdersPaid(shopId, tableNo);
    res.json({ success: true });
  } catch (err) {
    console.error('qr mark-table-orders-paid:', err);
    res.status(500).json({ success: false, message: err.message || 'เกิดข้อผิดพลาด' });
  }
}

async function putTableSnapshot(req, res) {
  try {
    const { shopId, tableNo, items } = req.body || {};
    if (!requireShopMatch(req, shopId)) {
      return res.status(403).json({ success: false, message: 'ไม่ตรงกับร้านที่ล็อกอิน' });
    }
    await qrVps.upsertTableSnapshot(shopId, tableNo, items || []);
    res.json({ success: true });
  } catch (err) {
    console.error('qr table-order-snapshot PUT:', err);
    res.status(500).json({ success: false, message: err.message || 'เกิดข้อผิดพลาด' });
  }
}

async function deleteTableSnapshot(req, res) {
  try {
    const shopId = req.query.shopId;
    const tableNo = req.query.tableNo;
    if (!requireShopMatch(req, shopId)) {
      return res.status(403).json({ success: false, message: 'ไม่ตรงกับร้านที่ล็อกอิน' });
    }
    await qrVps.deleteTableSnapshot(shopId, tableNo);
    res.json({ success: true });
  } catch (err) {
    console.error('qr table-order-snapshot DELETE:', err);
    res.status(500).json({ success: false, message: err.message || 'เกิดข้อผิดพลาด' });
  }
}

async function syncMenu(req, res) {
  try {
    const { shopId, storeName, webMenuLogoUrl, urlToken, urlTokenExpiry, products } = req.body || {};
    const sid = shopId != null ? String(shopId).trim() : '';
    if (!sid) {
      return res.status(400).json({
        success: false,
        message: 'กรุณาระบุ shopId ใน body',
        code: 'SHOP_ID_REQUIRED',
      });
    }
    if (!requireShopMatch(req, shopId)) {
      return res.status(403).json({
        success: false,
        message:
          'shopId ต้องตรงกับรหัสร้าน (tenantId) ของบัญชีที่ล็อกอิน — ตั้งค่า Shop ID ใน POS ให้ตรงกับค่า tenantId หลังล็อกอิน / ในระบบ Admin',
        code: 'SHOP_TENANT_MISMATCH',
      });
    }
    const tenant = await tenantModel.getTenantByTenantId(shopId);
    if (!tenant) {
      return res.status(404).json({ success: false, message: 'ไม่พบร้านค้า' });
    }

    if (storeName && String(storeName).trim()) {
      await pool.query('UPDATE tenants SET name = $2 WHERE tenant_id = $1', [shopId, String(storeName).trim()]);
    }

    await qrVps.upsertWebMenuConfig(shopId, {
      storeName: storeName || null,
      webMenuLogoUrl: webMenuLogoUrl || null,
      urlToken: urlToken || null,
      urlTokenExpiry: urlTokenExpiry || null,
    });

    if (Array.isArray(products) && products.length > 0) {
      await productModel.upsertFromQrMenuSync(shopId, products);
    }

    res.json({ success: true });
  } catch (err) {
    console.error('qr sync-menu:', err);
    res.status(500).json({ success: false, message: err.message || 'เกิดข้อผิดพลาด' });
  }
}

async function patchWebMenuToken(req, res) {
  try {
    const { shopId, urlToken, urlTokenExpiry } = req.body || {};
    if (!requireShopMatch(req, shopId)) {
      return res.status(403).json({ success: false, message: 'ไม่ตรงกับร้านที่ล็อกอิน' });
    }
    await qrVps.upsertWebMenuConfig(shopId, {
      storeName: null,
      webMenuLogoUrl: null,
      urlToken: urlToken || null,
      urlTokenExpiry: urlTokenExpiry || null,
    });
    res.json({ success: true });
  } catch (err) {
    console.error('qr web-menu-config-token:', err);
    res.status(500).json({ success: false, message: err.message || 'เกิดข้อผิดพลาด' });
  }
}

async function getCallForPaymentEvents(req, res) {
  try {
    const shopId = req.query.shopId;
    if (!requireShopMatch(req, shopId)) {
      return res.status(403).json({ success: false, message: 'ไม่ตรงกับร้านที่ล็อกอิน' });
    }
    const rows = await qrVps.fetchAndClearCallForPayment(shopId);
    const out = rows.map((r) => ({
      tableNo: r.table_no,
      at: r.at ? new Date(r.at).toISOString() : null,
    }));
    res.json(out);
  } catch (err) {
    console.error('qr call-for-payment-events:', err);
    res.status(500).json({ success: false, message: err.message || 'เกิดข้อผิดพลาด' });
  }
}

async function getTableCart(req, res) {
  try {
    const shopId = req.query.shopId;
    const tableNo = req.query.tableNo;
    if (!requireShopMatch(req, shopId)) {
      return res.status(403).json({ success: false, message: 'ไม่ตรงกับร้านที่ล็อกอิน' });
    }
    const row = await qrVps.getTableCart(shopId, tableNo);
    res.json({ items: row && row.items ? row.items : [] });
  } catch (err) {
    console.error('qr table-cart GET:', err);
    res.status(500).json({ success: false, message: err.message || 'เกิดข้อผิดพลาด' });
  }
}

async function putTableCart(req, res) {
  try {
    const { shopId, tableNo, items } = req.body || {};
    if (!requireShopMatch(req, shopId)) {
      return res.status(403).json({ success: false, message: 'ไม่ตรงกับร้านที่ล็อกอิน' });
    }
    await qrVps.upsertTableCart(shopId, tableNo, items || []);
    res.json({ success: true });
  } catch (err) {
    console.error('qr table-cart PUT:', err);
    res.status(500).json({ success: false, message: err.message || 'เกิดข้อผิดพลาด' });
  }
}

/** POST /api/public/qr-order — ไม่ต้อง auth */
async function publicGuestOrder(req, res) {
  try {
    const { shopId, tableNo, items, customerNote } = req.body || {};
    const sid = String(shopId || '').trim();
    if (!sid) {
      return res.status(400).json({ success: false, message: 'กรุณาระบุ shopId' });
    }
    const tenant = await tenantModel.getTenantByTenantId(sid);
    if (!tenant) {
      return res.status(404).json({ success: false, message: 'ไม่พบร้านค้า' });
    }
    const row = await qrVps.createPendingOrder(sid, {
      tableNo,
      items,
      customerNote,
      status: 'pending',
    });
    emitQrOrderNew(req, sid, row);
    res.status(201).json({ success: true, data: mapPendingRow(row) });
  } catch (err) {
    console.error('public qr-order:', err);
    res.status(400).json({ success: false, message: err.message || 'เกิดข้อผิดพลาด' });
  }
}

async function publicCallForPayment(req, res) {
  try {
    const { shopId, tableNo } = req.body || {};
    const sid = String(shopId || '').trim();
    if (!sid || !String(tableNo || '').trim()) {
      return res.status(400).json({ success: false, message: 'กรุณาระบุ shopId และ tableNo' });
    }
    const tenant = await tenantModel.getTenantByTenantId(sid);
    if (!tenant) {
      return res.status(404).json({ success: false, message: 'ไม่พบร้านค้า' });
    }
    await qrVps.insertCallForPayment(sid, tableNo);
    res.json({ success: true });
  } catch (err) {
    console.error('public qr-call-for-payment:', err);
    res.status(500).json({ success: false, message: err.message || 'เกิดข้อผิดพลาด' });
  }
}

module.exports = {
  getPendingOrders,
  confirmOrder,
  pushOrder,
  tableLastPayment,
  markTableOrdersPaid,
  putTableSnapshot,
  deleteTableSnapshot,
  syncMenu,
  patchWebMenuToken,
  getCallForPaymentEvents,
  getTableCart,
  putTableCart,
  publicGuestOrder,
  publicCallForPayment,
};
