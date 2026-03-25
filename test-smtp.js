/**
 * ทดสอบ Gmail SMTP โดยตรง (ไม่ผ่าน API / ไม่ต้องมี user ใน DB)
 *
 * รัน:
 *   cd pos_backend
 *   node test-smtp.js
 *
 * ส่งไปอีเมลอื่น (ไม่บังคับ — default ส่งหาตัวเองตาม EMAIL_USER):
 *   $env:TEST_TO="luk6cafe@gmail.com"; node test-smtp.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const { createTransporter } = require('./services/emailService');

async function main() {
  const user = (process.env.EMAIL_USER || '').trim();
  const pass = (process.env.EMAIL_APP_PASSWORD || '').replace(/\s/g, '');
  const to = (process.env.TEST_TO || user).trim();

  if (!user || !pass) {
    console.error('ตั้ง EMAIL_USER และ EMAIL_APP_PASSWORD ใน .env');
    process.exit(1);
  }

  console.log('SMTP: smtp.gmail.com:465');
  console.log('Login ผู้ส่ง (From):', user);
  console.log('ผู้รับ (To):', to);
  console.log(
    'TLS:',
    process.env.SMTP_TLS_INSECURE === '1'
      ? 'SMTP_TLS_INSECURE=1 (ข้ามตรวจใบรับรอง — dev)'
      : 'ตรวจใบรับรองปกติ'
  );
  console.log('App Password ความยาว:', pass.length, 'ตัว (ควรเป็น 16)');
  if (pass.length !== 16) {
    console.warn('⚠ ค่าความยาวไม่ใช่ 16 — ตรวจสอบว่าคัดลอก App Password ครบ');
  }

  const transporter = createTransporter();
  if (!transporter) {
    console.error('สร้าง transporter ไม่ได้');
    process.exit(1);
  }

  try {
    await transporter.sendMail({
      from: `"Loyalcloud SMTP test" <${user}>`,
      to,
      subject: '[ทดสอบ] Loyalcloud — Gmail SMTP',
      text: 'ถ้าได้รับอีเมลนี้ แปลว่า EMAIL_USER / EMAIL_APP_PASSWORD ใน .env ถูกต้อง',
    });
    console.log('\n✓ ส่งสำเร็จ — ตรวจกล่อง inbox (และ Spam) ของ', to);
  } catch (err) {
    console.error('\n✗ ส่งไม่สำเร็จ — อ่านข้อความด้านล่างแล้วแก้ตาม Gmail');
    console.error('Message:', err.message);
    if (err.response) console.error('SMTP response:', err.response);
    if (err.code) console.error('Code:', err.code);
    console.error('\nเช็กลิสต์:');
    console.error('  1) Google Account → ความปลอดภัย → เปิด 2-Step Verification');
    console.error('  2) สร้าง App Password ใหม่ (16 ตัว ไม่มีช่องว่าง)');
    console.error('  3) EMAIL_USER ต้อง Gmail เดียวกับที่สร้าง App Password');
    if (/certificate|self-signed|UNABLE_TO_VERIFY/i.test(String(err.message))) {
      console.error('  4) Error เกี่ยวกับใบรับรอง → ใน .env เพิ่มบรรทัด: SMTP_TLS_INSECURE=1 แล้วรันใหม่ (ใช้เฉพาะ dev)');
    }
    process.exit(1);
  }
}

main();
