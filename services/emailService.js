const nodemailer = require('nodemailer');

function createTransporter() {
  const user = (process.env.EMAIL_USER || '').trim();
  // Gmail App Password ต้องเป็น 16 ตัวไม่มีช่องว่าง (บางครั้งคัดลอกมามี space ระหว่างกลุ่ม)
  const pass = (process.env.EMAIL_APP_PASSWORD || '').replace(/\s/g, '');
  if (!user || !pass) {
    return null;
  }
  // ถ้าเจอ "self-signed certificate in certificate chain" (มักเกิดจาก antivirus / proxy / Windows)
  // ใส่ใน .env: SMTP_TLS_INSECURE=1 — ใช้เฉพาะ dev; production ควรแก้ที่ระบบใบรับรอง
  const skipTlsVerify = process.env.SMTP_TLS_INSECURE === '1';

  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: { user, pass },
    tls: {
      rejectUnauthorized: !skipTlsVerify,
    },
  });
}

/**
 * ส่งอีเมลรีเซ็ตรหัสผ่าน (เจ้าของร้าน) — รหัส OTP 6 หลัก
 * @param {string} to - อีเมลผู้รับ
 * @param {string} otpCode - รหัส 6 หลัก (เก็บใน DB)
 */
async function sendResetPasswordEmail(to, otpCode) {
  const transporter = createTransporter();
  if (!transporter) {
    throw new Error('ยังไม่ได้ตั้งค่า EMAIL_USER หรือ EMAIL_APP_PASSWORD');
  }

  const bodyText = `รหัสของคุณคือ: ${otpCode} (หมดอายุใน 15 นาที)`;

  const mailOptions = {
    from: `"Loyalcloud CRM" <${process.env.EMAIL_USER}>`,
    to,
    subject: 'รหัสยืนยันการรีเซ็ตรหัสผ่าน',
    text: [
      bodyText,
      '',
      '【แอป Windows】',
      '1) เปิด Loyalcloud CRM',
      '2) หน้าเข้าสู่ระบบ → กด 「มีโค้ดจากอีเมลแล้ว? ตั้งรหัสผ่านใหม่」',
      '3) กรอกรหัส 6 หลักด้านบน + ตั้งรหัสผ่านใหม่',
    ].join('\n'),
    html: `
      <div style="font-family:Segoe UI,Roboto,sans-serif;font-size:15px;line-height:1.55;color:#333;max-width:560px;">
        <p style="margin:0 0 14px 0;">${escapeHtml(bodyText)}</p>
        <div style="margin:0 0 18px 0;padding:14px 16px;background:#ecfdf5;border:1px solid #a7f3d0;border-radius:10px;">
          <p style="margin:0 0 8px 0;font-weight:700;color:#065f46;">แอป Windows</p>
          <ol style="margin:0;padding-left:20px;color:#064e3b;font-size:14px;">
            <li>เปิด Loyalcloud CRM</li>
            <li>หน้าเข้าสู่ระบบ → <strong>มีโค้ดจากอีเมลแล้ว? ตั้งรหัสผ่านใหม่</strong></li>
            <li>กรอกรหัส 6 หลักด้านบน แล้วตั้งรหัสผ่านใหม่</li>
          </ol>
        </div>
        <p style="margin:0;font-size:12px;color:#94a3b8;">รหัสหมดอายุใน 15 นาที · หากไม่ได้เป็นผู้ขอ ให้ละเว้นอีเมลนี้</p>
      </div>
    `,
  };

  await transporter.sendMail(mailOptions);
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

module.exports = {
  sendResetPasswordEmail,
  createTransporter,
};
