#!/usr/bin/env node
/**
 * สร้าง Tenant + User admin คนแรก (รหัสผ่านผ่าน bcrypt เหมือน flow สมัครในแอป)
 *
 * ใช้บนเครื่องที่มี .env ชี้ DB จริง (เช่น บน VPS หลัง docker compose up)
 *
 * ตั้งค่าใน .env ชั่วคราวหรือ export ก่อนรัน:
 *   ADMIN_EMAIL=you@example.com
 *   ADMIN_PASSWORD=your_secure_password
 *   ADMIN_STORE_NAME=ร้านตัวอย่าง
 *   ADMIN_PROVINCE=กรุงเทพมหานคร
 *   ADMIN_COUNTRY=ประเทศไทย
 *   ADMIN_FULL_NAME=ผู้ดูแลระบบ
 *
 * รัน:
 *   node scripts/create-admin.js
 *
 * หรือจาก container backend:
 *   docker compose exec backend node scripts/create-admin.js
 * (ต้องใส่ตัวแปร ADMIN_* ใน env ของ container — ใช้ docker compose exec -e หรือเพิ่มใน .env ชั่วคราวแล้ว restart)
 */

require('dotenv').config();

const bcrypt = require('bcrypt');
const pool = require('../config/db');
const tenantModel = require('../models/tenant');
const userModel = require('../models/user');

function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

async function main() {
  const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || '';
  const storeName = (process.env.ADMIN_STORE_NAME || 'ร้านหลัก').trim();
  const province = (process.env.ADMIN_PROVINCE || 'กรุงเทพมหานคร').trim();
  const country = (process.env.ADMIN_COUNTRY || 'ประเทศไทย').trim();
  const fullName = (process.env.ADMIN_FULL_NAME || storeName).trim();

  if (!email || !isValidEmail(email)) {
    console.error('❌ ตั้งค่า ADMIN_EMAIL ให้ถูกต้องใน environment');
    process.exit(1);
  }
  if (!password || password.length < 6) {
    console.error('❌ ตั้งค่า ADMIN_PASSWORD อย่างน้อย 6 ตัวอักษร');
    process.exit(1);
  }

  const existing = await userModel.getUserByEmail(email);
  if (existing) {
    console.error('❌ มีผู้ใช้อีเมลนี้แล้ว:', email);
    process.exit(1);
  }

  const tenant = await tenantModel.createTenant(storeName, province, country);
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await userModel.createUser(
    tenant.tenant_id,
    email,
    passwordHash,
    fullName,
    'admin',
    new Date()
  );

  console.log('✅ สร้างสำเร็จ');
  console.log('   tenant_id:', tenant.tenant_id);
  console.log('   email:', user.email);
  console.log('   role:', user.role);
  await pool.end();
  process.exit(0);
}

main().catch(async (err) => {
  console.error('❌ Error:', err.message || err);
  try {
    await pool.end();
  } catch (_) {
    /* ignore */
  }
  process.exit(1);
});
