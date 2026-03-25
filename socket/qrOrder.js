const jwt = require('jsonwebtoken');
const orderModel = require('../models/order');
const tenantModel = require('../models/tenant');

const TENANT_ROOM_PREFIX = 'tenant:';

function setupQrOrder(io) {
  io.on('connection', async (socket) => {
    const tenantId = socket.handshake.query?.tenantId;
    const token = socket.handshake.auth?.token;

    // POS: มี token = เข้าระบบแล้ว ให้ join room ตาม tenant
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const posTenantId = decoded.tenantId;
        const room = TENANT_ROOM_PREFIX + posTenantId;
        socket.join(room);
        socket.tenantId = posTenantId;
        socket.role = 'pos';
        console.log(`POS connected: ${socket.id} -> ${room}`);
      } catch (err) {
        socket.emit('error', { message: 'Token ไม่ถูกต้อง' });
        socket.disconnect(true);
        return;
      }
    }
    // Customer (QR): ส่งเฉพาะ tenantId จาก QR ไม่มี token
    else if (tenantId) {
      try {
        const tenant = await tenantModel.getTenantByTenantId(tenantId);
        if (!tenant) {
          socket.emit('error', { message: 'ไม่พบร้านค้า' });
          socket.disconnect(true);
          return;
        }
        socket.tenantId = tenantId;
        socket.role = 'customer';
        console.log(`Customer (QR) connected: ${socket.id} -> tenant ${tenantId}`);
      } catch (err) {
        socket.emit('error', { message: 'เกิดข้อผิดพลาด' });
        socket.disconnect(true);
        return;
      }
    } else {
      socket.emit('error', { message: 'กรุณาระบุ tenantId หรือส่ง token' });
      socket.disconnect(true);
      return;
    }

    // Customer ใช้ place_order ส่งคำสั่งซื้อ
    socket.on('place_order', async (payload, callback) => {
      if (socket.role !== 'customer') {
        if (callback) callback({ success: false, message: 'ไม่สามารถสั่งซื้อได้' });
        return;
      }
      const { items, tableNumber, notes } = payload || {};
      if (!items || !Array.isArray(items) || items.length === 0) {
        if (callback) callback({ success: false, message: 'กรุณาระบุรายการสินค้า' });
        return;
      }

      try {
        const order = await orderModel.create(socket.tenantId, null, {
          items,
          tableNumber: tableNumber || null,
          notes: notes || null,
        });

        // แจ้ง POS แบบ real-time
        const room = TENANT_ROOM_PREFIX + socket.tenantId;
        io.to(room).emit('order:new', {
          order,
          source: 'qr',
        });

        if (callback) callback({ success: true, data: order });
      } catch (err) {
        console.error('QR place_order error:', err);
        if (callback) callback({ success: false, message: err.message || 'เกิดข้อผิดพลาด' });
      }
    });

    // POS อัปเดตสถานะ order
    socket.on('order:status_update', async (payload, callback) => {
      if (socket.role !== 'pos') {
        if (callback) callback({ success: false, message: 'ไม่มีสิทธิ์' });
        return;
      }
      const { orderId, status } = payload || {};
      if (!orderId || !status) {
        if (callback) callback({ success: false, message: 'กรุณาระบุ orderId และ status' });
        return;
      }

      try {
        const updated = await orderModel.updateStatus(orderId, socket.tenantId, status);
        const room = TENANT_ROOM_PREFIX + socket.tenantId;
        io.to(room).emit('order:status_changed', { orderId, status, order: updated });
        if (callback) callback({ success: true, data: updated });
      } catch (err) {
        if (callback) callback({ success: false, message: err.message || 'เกิดข้อผิดพลาด' });
      }
    });

    socket.on('disconnect', () => {
      console.log(`Client disconnected: ${socket.id} (${socket.role || 'unknown'})`);
    });
  });
}

module.exports = { setupQrOrder };
