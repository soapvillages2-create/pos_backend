require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

/** รายการ origin ที่อนุญาต (คั่นด้วย comma) — ถ้าไม่ตั้ง = เปิดกว้างเหมือนเดิม */
const corsAllowed = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

// Socket.io - bind กับ HTTP Server พร้อมใช้งาน
const io = new Server(server, {
  cors: {
    origin: corsAllowed.length > 0 ? corsAllowed : '*',
    methods: ['GET', 'POST'],
  },
  allowEIO3: true,
});

// Middleware — CORS สำหรับ Express (Flutter Web / เบราว์เซอร์)
if (corsAllowed.length > 0) {
  app.use(cors({ origin: corsAllowed, credentials: true }));
} else {
  app.use(cors());
}
app.use(express.json());

// Health Check API
app.get('/api/status', (req, res) => {
  res.json({
    status: 'success',
    message: 'Backend ของ Loyalcloud CRM ทำงานปกติแล้ว!',
  });
});

/**
 * ลิงก์รีเซ็ตในอีเมลมักชี้มาที่พอร์ต API (เช่น localhost:3001) เพราะ FRONTEND_URL ตั้งผิด
 * ถ้ามี FRONTEND_WEB_URL (เช่น Flutter Web http://localhost:8080) จะ redirect ไปหน้ารีเซ็ตจริง
 * ถ้าไม่มี แสดงหน้า HTML บอกให้ใช้แอป / คัดลอกโค้ด
 */
app.get('/reset-password', (req, res) => {
  const token = typeof req.query.token === 'string' ? req.query.token : '';
  const email = typeof req.query.email === 'string' ? req.query.email : '';
  const webBase = (process.env.FRONTEND_WEB_URL || '').trim().replace(/\/$/, '');

  if (webBase && /^https?:\/\//i.test(webBase)) {
    const q = new URLSearchParams({ token, email }).toString();
    return res.redirect(302, `${webBase}/reset-password?${q}`);
  }

  const esc = (s) =>
    String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  res.type('html').send(`<!DOCTYPE html>
<html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>รีเซ็ตรหัสผ่าน — Loyalcloud CRM</title>
<style>
body{font-family:Segoe UI,sans-serif;max-width:520px;margin:40px auto;padding:0 16px;line-height:1.5;color:#1e293b}
.box{background:#f1f5f9;border:1px solid #e2e8f0;border-radius:8px;padding:12px;word-break:break-all;font-family:Consolas,monospace;font-size:13px}
h1{font-size:20px}
.note{color:#64748b;font-size:14px}
</style></head>
<body>
<h1>รีเซ็ตรหัสผ่าน</h1>
<p>ลิงก์นี้เปิดที่<strong>เซิร์ฟเวอร์ API</strong> (พอร์ต ${esc(
    String(process.env.PORT || 3000)
  )}) ไม่ใช่หน้าแอปโดยตรง</p>
<p class="note">แนะนำ: ตั้งค่า <code>FRONTEND_WEB_URL</code> ในไฟล์ <code>.env</code> ของ backend เป็น URL ของ Flutter Web (เช่น <code>http://localhost:8080</code>) แล้วรีสตาร์ทเซิร์ฟเวอร์ — ครั้งถัดไปคลิกลิงก์ในอีเมลจะพาไปหน้ารีเซ็ตในเบราว์เซอร์อัตโนมัติ</p>
<hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0">
<p><strong>หรือใช้แอป Windows:</strong> เปิด Loyalcloud CRM → หน้าเข้าสู่ระบบ → <strong>มีโค้ดจากอีเมลแล้ว? ตั้งรหัสผ่านใหม่</strong> แล้วกรอกข้อมูลด้านล่าง</p>
<p>อีเมล</p>
<div class="box">${esc(email)}</div>
<p style="margin-top:16px">โค้ด (Token)</p>
<div class="box">${esc(token)}</div>
</body></html>`);
});

// Auth Routes
app.use('/api/auth', require('./routes/auth'));

// Products Routes (ต้อง Login ก่อน)
app.use('/api/products', require('./routes/products'));

// Orders Routes (ต้อง Login ก่อน)
app.use('/api/orders', require('./routes/orders'));

// Customers Routes (ต้อง Login ก่อน)
app.use('/api/customers', require('./routes/customers'));

// Public Routes (สำหรับ QR Order - ไม่ต้อง Login)
app.use('/api/public', require('./routes/public'));

// QR Order API (VPS) — ต้องล็อกอิน POS + Bearer JWT
app.use('/api/qr', require('./routes/qr'));

// POS — แคตตาล็อกซิงค์หลายเครื่อง (Bearer JWT)
app.use('/api/pos', require('./routes/pos'));

// Initialize Database connection
require('./config/db');

// Socket.io - QR Order Real-time
require('./socket/qrOrder').setupQrOrder(io);

// Export io สำหรับใช้ใน routes อื่นๆ
app.set('io', io);

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Loyalcloud CRM Backend running on http://0.0.0.0:${PORT}`);
});
