const pool = require('../config/db');
const productModel = require('./product');
const customerModel = require('./customer');

/** UUID v1–v5 รูปแบบมาตรฐาน */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isValidUuid(s) {
  return typeof s === 'string' && UUID_RE.test(s.trim());
}

function hasCatalogProductId(item) {
  const pid = item.productId ?? item.product_id;
  if (pid == null) return false;
  if (typeof pid === 'number' && pid === 0) return false;
  const str = String(pid).trim();
  return str.length > 0;
}

/** ชื่อสินค้าจาก POS — รองรับทั้ง camelCase และ snake_case */
function itemDisplayName(item) {
  const raw =
    item.productName ?? item.name ?? item.product_name ?? '';
  return String(raw).trim();
}

const PRODUCT_NAME_MAX = 255;

function truncateProductName(s) {
  if (s.length <= PRODUCT_NAME_MAX) return s;
  return s.slice(0, PRODUCT_NAME_MAX);
}

async function getNextOrderNumber(tenantId) {
  const result = await pool.query(
    `SELECT order_number FROM orders 
     WHERE tenant_id = $1 
     ORDER BY created_at DESC LIMIT 1`,
    [tenantId]
  );
  if (result.rows.length === 0) {
    return 'ORD-000001';
  }
  const last = result.rows[0].order_number;
  const match = last.match(/ORD-(\d+)/);
  const num = match ? parseInt(match[1], 10) + 1 : 1;
  return 'ORD-' + num.toString().padStart(6, '0');
}

const ORDER_STATUSES = [
  'pending',
  'completed',
  'cancelled',
  'paid',
];

/**
 * สร้างออเดอร์
 *
 * รายการสินค้า (items) รองรับ 2 แบบ:
 * 1) ผูกแคตตาล็อก: { productId: UUID, quantity|qty } — ถ้า UUID ไม่มีใน DB จะบันทึกเป็นบรรทัดฟรีเท็กซ์จาก request
 * 2) ไม่ผูกแคตตาล็อก: { productName|name|product_name, unitPrice, qty|quantity, totalPrice?, note? }
 */
async function create(tenantId, userId, data) {
  const {
    items,
    customerId,
    notes,
    tableNumber,
    orderNumber: clientOrderNumber,
    status: clientStatus,
  } = data;
  if (!items || !Array.isArray(items) || items.length === 0) {
    throw new Error('กรุณาระบุรายการสินค้า');
  }

  if (customerId) {
    const customer = await customerModel.findById(customerId, tenantId);
    if (!customer) {
      const err = new Error('ไม่พบลูกค้า');
      err.statusCode = 404;
      throw err;
    }
  }

  const rawOrderNum =
    clientOrderNumber != null ? String(clientOrderNumber).trim() : '';
  let orderNumber;
  if (rawOrderNum) {
    orderNumber = rawOrderNum.slice(0, 50);
  } else {
    orderNumber = await getNextOrderNumber(tenantId);
  }

  const normalizedStatus =
    typeof clientStatus === 'string' ? clientStatus.trim().toLowerCase() : '';
  const orderStatus = ORDER_STATUSES.includes(normalizedStatus)
    ? normalizedStatus
    : 'pending';
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    let totalAmount = 0;
    const orderItems = [];

    for (const item of items) {
      if (item == null || typeof item !== 'object') {
        continue;
      }
      const note = item.note != null ? String(item.note) : null;
      let catalogProductId = null;
      let catalogName = null;
      let catalogUnitPrice = null;

      // ถ้าส่ง productId มา: ตรวจรูปแบบ UUID แล้วลองหาในแคตตาล็อก
      // ถ้าพบ → ใช้ข้อมูลจากแคตตาล็อก
      // ถ้าไม่พบ → fall back ใช้ productName/unitPrice จาก request (ไม่ 404)
      if (hasCatalogProductId(item)) {
        const pid = String(item.productId ?? item.product_id).trim();
        if (!isValidUuid(pid)) {
          const err = new Error('productId ต้องเป็น UUID ที่ถูกต้อง');
          err.statusCode = 400;
          throw err;
        }
        const product = await productModel.findById(pid, tenantId);
        if (product) {
          catalogProductId = product.id;
          catalogName = product.name;
          catalogUnitPrice = parseFloat(product.price);
        }
        // ถ้าไม่พบในแคตตาล็อก → ใช้ชื่อ/ราคาจาก request ด้านล่าง
      }

      const productNameRaw = catalogName ?? itemDisplayName(item);
      if (!productNameRaw) {
        throw new Error(
          'แต่ละรายการสินค้าต้องมี productName (หรือ name / product_name)'
        );
      }
      const productName = truncateProductName(productNameRaw);

      const qty = parseInt(item.quantity ?? item.qty, 10) || 1;
      if (qty < 1) {
        throw new Error('จำนวนสินค้าต้องไม่น้อยกว่า 1');
      }

      const unitPrice = catalogUnitPrice
        ?? parseFloat(item.unitPrice ?? item.unit_price ?? NaN);
      if (Number.isNaN(unitPrice) || unitPrice < 0) {
        throw new Error(
          'แต่ละรายการสินค้าต้องมี unitPrice (หรือ unit_price) ที่ถูกต้อง'
        );
      }

      const rawSubtotal = parseFloat(
        item.totalPrice ?? item.total_price ?? item.subtotal ?? NaN
      );
      const subtotal =
        !Number.isNaN(rawSubtotal) && rawSubtotal >= 0
          ? rawSubtotal
          : unitPrice * qty;

      totalAmount += subtotal;
      orderItems.push({
        productId: catalogProductId,
        productName,
        quantity: qty,
        unitPrice,
        subtotal,
        note,
      });
    }

    if (orderItems.length === 0) {
      throw new Error(
        'ไม่มีรายการสินค้าที่ใช้ได้ (ตรวจสอบ items ว่าเป็น object ที่มีชื่อและราคา)'
      );
    }

    const orderResult = await client.query(
      `INSERT INTO orders (tenant_id, order_number, customer_id, total_amount, status, notes, table_number, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        tenantId,
        orderNumber,
        customerId || null,
        totalAmount,
        orderStatus,
        notes || null,
        tableNumber || null,
        userId || null,
      ]
    );
    const order = orderResult.rows[0];

    for (const oi of orderItems) {
      await client.query(
        `INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price, subtotal, note)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          order.id,
          oi.productId,
          oi.productName,
          oi.quantity,
          oi.unitPrice,
          oi.subtotal,
          oi.note,
        ]
      );
    }

    await client.query('COMMIT');

    const itemsResult = await client.query(
      'SELECT * FROM order_items WHERE order_id = $1 ORDER BY created_at',
      [order.id]
    );
    order.items = itemsResult.rows;
    return order;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function findAllByTenant(tenantId, options = {}) {
  const { status, limit = 50, offset = 0 } = options;
  let query = 'SELECT * FROM orders WHERE tenant_id = $1';
  const params = [tenantId];
  let paramIndex = 2;

  if (status) {
    query += ` AND status = $${paramIndex}`;
    params.push(status);
    paramIndex++;
  }

  query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
  params.push(limit, offset);

  const result = await pool.query(query, params);
  return result.rows;
}

async function findById(id, tenantId) {
  const orderResult = await pool.query(
    'SELECT * FROM orders WHERE id = $1 AND tenant_id = $2',
    [id, tenantId]
  );
  const order = orderResult.rows[0];
  if (!order) return null;

  const itemsResult = await pool.query(
    'SELECT * FROM order_items WHERE order_id = $1 ORDER BY created_at',
    [order.id]
  );
  order.items = itemsResult.rows;
  return order;
}

async function updateStatus(id, tenantId, status) {
  const valid = ['pending', 'completed', 'cancelled', 'paid'];
  if (!valid.includes(status)) {
    throw new Error('สถานะไม่ถูกต้อง');
  }
  const result = await pool.query(
    `UPDATE orders SET status = $3, updated_at = CURRENT_TIMESTAMP
     WHERE id = $1 AND tenant_id = $2
     RETURNING *`,
    [id, tenantId, status]
  );
  return result.rows[0];
}

module.exports = {
  create,
  findAllByTenant,
  findById,
  updateStatus,
};
