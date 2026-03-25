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
 * ส่งอีเมลรีเซ็ตรหัสผ่าน (เจ้าของร้าน)
 * @param {string} to - อีเมลผู้รับ
 * @param {string} resetToken - token แบบสุ่ม (เก็บใน DB)
 */
async function sendResetPasswordEmail(to, resetToken) {
  const transporter = createTransporter();
  if (!transporter) {
    throw new Error('ยังไม่ได้ตั้งค่า EMAIL_USER หรือ EMAIL_APP_PASSWORD');
  }

  const baseUrl = (process.env.FRONTEND_URL || 'http://localhost').replace(/\/$/, '');
  const resetUrl = `${baseUrl}/reset-password?token=${encodeURIComponent(resetToken)}&email=${encodeURIComponent(to)}`;

  const mailOptions = {
    from: `"Loyalcloud CRM" <${process.env.EMAIL_USER}>`,
    to,
    subject: 'รีเซ็ตรหัสผ่าน — Loyalcloud CRM',
    text: [
      'สวัสดีครับ/ค่ะ',
      '',
      '【แอป Windows — แนะนำ】',
      '1) เปิด Loyalcloud CRM',
      '2) หน้าเข้าสู่ระบบ → กด 「มีโค้ดจากอีเมลแล้ว? ตั้งรหัสผ่านใหม่」',
      '3) วางโค้ดด้านล่างนี้ + ตั้งรหัสผ่านใหม่',
      '',
      '--- โค้ด (คัดลอกทั้งบรรทัด) ---',
      resetToken,
      '---',
      '',
      'คุณได้ขอรีเซ็ตรหัสผ่านสำหรับบัญชี Loyalcloud CRM',
      '',
      '【ทางเลือก — เปิดในเบราว์เซอร์ / Flutter Web หรือโดเมนออนไลน์】',
      resetUrl,
      '',
      'โค้ดและลิงก์หมดอายุใน 15 นาที · หากไม่ได้เป็นผู้ขอ ให้ละเว้นอีเมลนี้',
    ].join('\n'),
    html: `
      <div style="font-family:Segoe UI,Roboto,sans-serif;font-size:15px;line-height:1.55;color:#333;max-width:560px;">
        <p style="margin:0 0 10px 0;">สวัสดีครับ/ค่ะ</p>
        <div style="margin:0 0 18px 0;padding:14px 16px;background:#ecfdf5;border:1px solid #a7f3d0;border-radius:10px;">
          <p style="margin:0 0 8px 0;font-weight:700;color:#065f46;">แอป Windows (แนะนำ)</p>
          <ol style="margin:0;padding-left:20px;color:#064e3b;font-size:14px;">
            <li>เปิด Loyalcloud CRM</li>
            <li>หน้าเข้าสู่ระบบ → <strong>มีโค้ดจากอีเมลแล้ว? ตั้งรหัสผ่านใหม่</strong></li>
            <li>วางโค้ดด้านล่าง แล้วตั้งรหัสผ่านใหม่</li>
          </ol>
        </div>
        <p style="margin:0 0 6px 0;font-size:12px;font-weight:600;color:#334155;">โค้ด (คัดลอกทั้งบล็อก)</p>
        <div style="margin:0 0 20px 0;padding:12px 14px;background:#f1f5f9;border-radius:8px;border:1px solid #e2e8f0;word-break:break-all;font-family:Consolas,monospace;font-size:12px;color:#0f172a;">
          ${escapeHtml(resetToken)}
        </div>
        <p style="margin:0 0 8px 0;font-size:13px;color:#64748b;">คุณได้ขอ<strong>รีเซ็ตรหัสผ่าน</strong>สำหรับบัญชี Loyalcloud CRM</p>
        <p style="margin:0 0 10px 0;font-size:12px;color:#94a3b8;">ทางเลือก — คลิกลิงก์ (ใช้ได้เมื่อมี Flutter Web / โดเมนออนไลน์ หรือหน้าช่วยบน API)</p>
        <p style="margin:0 0 14px 0;">
          <a href="${escapeHtml(resetUrl)}" style="display:inline-block;padding:10px 16px;background:#64748b;color:#fff !important;text-decoration:none;border-radius:8px;font-size:13px;">เปิดลิงก์รีเซ็ต (เบราว์เซอร์)</a>
        </p>
        <p style="margin:0;font-size:11px;word-break:break-all;color:#94a3b8;">${escapeHtml(resetUrl)}</p>
        <p style="margin:14px 0 0 0;font-size:12px;color:#64748b;">โค้ดและลิงก์หมดอายุใน <strong>15 นาที</strong></p>
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
