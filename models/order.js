const pool = require('../config/db');
const productModel = require('./product');
const customerModel = require('./customer');

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

async function create(tenantId, userId, data) {
  const { items, customerId, notes, tableNumber } = data;
  if (!items || !Array.isArray(items) || items.length === 0) {
    throw new Error('กรุณาระบุรายการสินค้า');
  }

  if (customerId) {
    const customer = await customerModel.findById(customerId, tenantId);
    if (!customer) throw new Error('ไม่พบลูกค้า');
  }

  const orderNumber = await getNextOrderNumber(tenantId);
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    let totalAmount = 0;
    const orderItems = [];

    for (const item of items) {
      const { productId, quantity } = item;
      if (!productId || quantity < 1) continue;

      const product = await productModel.findById(productId, tenantId);
      if (!product) {
        throw new Error(`ไม่พบสินค้า: ${productId}`);
      }

      const qty = parseInt(quantity, 10) || 1;
      const unitPrice = parseFloat(product.price);
      const subtotal = unitPrice * qty;
      totalAmount += subtotal;

      orderItems.push({
        productId: product.id,
        productName: product.name,
        quantity: qty,
        unitPrice,
        subtotal,
      });
    }

    if (orderItems.length === 0) {
      throw new Error('ไม่พบรายการสินค้าที่ถูกต้อง');
    }

    const orderResult = await client.query(
      `INSERT INTO orders (tenant_id, order_number, customer_id, total_amount, status, notes, table_number, created_by)
       VALUES ($1, $2, $3, $4, 'pending', $5, $6, $7)
       RETURNING *`,
      [tenantId, orderNumber, customerId || null, totalAmount, notes || null, tableNumber || null, userId || null]
    );
    const order = orderResult.rows[0];

    for (const oi of orderItems) {
      await client.query(
        `INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price, subtotal)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [order.id, oi.productId, oi.productName, oi.quantity, oi.unitPrice, oi.subtotal]
      );
    }

    await client.query('COMMIT');

    const itemsResult = await client.query(
      'SELECT * FROM order_items WHERE order_id = $1',
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
  const valid = ['pending', 'completed', 'cancelled'];
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
