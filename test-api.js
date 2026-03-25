/**
 * ทดสอบ POST /api/auth/forgot-password (ไม่ต้องใช้ Postman)
 *
 * รัน (หลังจากเปิดเซิร์ฟเวอร์ด้วย npm run dev ในอีก Terminal แล้ว):
 *   cd pos_backend
 *   node test-api.js
 *
 * เปลี่ยนอีเมล:
 *   $env:TEST_EMAIL="other@mail.com"; node test-api.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const http = require('http');

const port = process.env.PORT || 3000;
const BASE_URL =
  process.env.API_BASE || `http://127.0.0.1:${port}`;
const EMAIL = process.env.TEST_EMAIL || 'loyalcloudcrm@gmail.com';

function postJson(urlString, bodyObj) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlString);
    const data = JSON.stringify(bodyObj);
    const opts = {
      hostname: u.hostname,
      port: u.port || (u.protocol === 'https:' ? 443 : 80),
      path: u.pathname + u.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data, 'utf8'),
      },
    };

    const req = http.request(opts, (res) => {
      let chunks = '';
      res.on('data', (c) => (chunks += c));
      res.on('end', () => {
        resolve({ status: res.statusCode, raw: chunks });
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function main() {
  const path = '/api/auth/forgot-password';
  const url = `${BASE_URL.replace(/\/$/, '')}${path}`;
  const body = { email: EMAIL };

  console.log('(ใช้พอร์ตจาก .env PORT =', port + ', หรือกำหนด API_BASE)');
  console.log('POST', url);
  console.log('Body:', JSON.stringify(body));

  let status;
  let raw;
  try {
    ({ status, raw } = await postJson(url, body));
  } catch (err) {
    if (err.code === 'ECONNREFUSED') {
      console.error('\n❌ ECONNREFUSED — ไม่มีโปรแกรมรับที่พอร์ตนี้');
      console.error('   1) เปิด Terminal อีกหน้าต่าง แล้วรัน:  cd pos_backend  →  npm run dev');
      console.error('   2) รอจนเห็น: Loyalcloud CRM Backend running on http://0.0.0.0:' + port);
      console.error('   3) ค่อยรัน node test-api.js อีกครั้งในหน้าต่างนี้\n');
      process.exit(1);
    }
    throw err;
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = raw;
  }

  console.log('Status:', status);
  console.log('Response:', parsed);

  if (status === 200 && parsed && parsed.success === true) {
    console.log(
      '\n✓ API ตอบ success: true — ตรวจสอบกล่องจดหมาย (และ Spam) ว่ามีอีเมลรีเซ็ตหรือไม่'
    );
  } else if (status === 503) {
    console.log('\n✗ ส่งอีเมลไม่สำเร็จ (ตรวจ EMAIL_USER / EMAIL_APP_PASSWORD ใน .env)');
  } else {
    console.log('\n✗ ดู Status และ Response ด้านบน');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
