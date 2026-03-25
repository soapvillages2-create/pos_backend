# โครงสร้างระบบ Loyalcloud CRM (POS Backend + Flutter App)

เอกสารนี้อธิบายโครงสร้างการทำงานปัจจุบัน เพื่อให้ Gemini หรือผู้พัฒนาอื่นตรวจสอบว่าการ implement ถูกต้องหรือไม่

---

## 1. โครงสร้างโปรเจกต์โดยรวม

| โปรเจกต์ | เทคโนโลยี | บทบาท |
|----------|----------|--------|
| **pos_backend** | Node.js, Express, PostgreSQL, Socket.io | Backend API สำหรับ CRM, สมาชิก, สั่งอาหาร |
| **pos_crm_app** (posnew/pos_crm_app) | Flutter | แอป POS สำหรับ Windows/Android — จัดการคำสั่ง, สินค้า, ลูกค้าสมาชิก |

---

## 2. โครงสร้างฐานข้อมูล (PostgreSQL)

### ตารางหลัก
- **tenants** — ร้านค้า (tenant_id เช่น shop543180, name, province, country)
- **users** — พนักงาน/เจ้าของร้าน (tenant_id, email, password_hash, full_name, role)
- **customers** — ลูกค้าสมาชิก (tenant_id, name, phone, email, points, **password_hash**)
- **products**, **orders**, **order_items** — สินค้าและคำสั่งซื้อ

### การแยกประเภทผู้ใช้
- **users** = พนักงาน/เจ้าของ (เข้าสู่ระบบด้วย email + รหัส) → API `/api/auth/login`
- **customers** = ลูกค้าสมาชิก (สมัครและเข้าสู่ระบบด้วยอีเมล) → API `/api/auth/register-member`, `/api/auth/login-member`

---

## 3. Auth APIs (pos_backend)

| Endpoint | Method | วัตถุประสงค์ | Request Body |
|----------|--------|-------------|--------------|
| `/api/auth/register` | POST | สมัครร้านใหม่ (สร้าง tenant + user admin) | storeName, email, password, province, country, agreedToTerms |
| `/api/auth/login` | POST | เข้าสู่ระบบพนักงาน/เจ้าของ | email, password |
| `/api/auth/register-member` | POST | สมัครสมาชิก (ลูกค้า) | tenantId, email, password, name?, phone? |
| `/api/auth/login-member` | POST | เข้าสู่ระบบลูกค้าสมาชิก | email, password, tenantId? (ถ้าไม่มีจะค้นหาจากอีเมลทั่วทั้งระบบ) |
| `/api/auth/me` | GET | ตรวจสอบ token ปัจจุบัน | Header: Authorization: Bearer &lt;token&gt; |

### login-member — โครงสร้างการทำงาน
1. รับ `email`, `password` (บังคับ) และ `tenantId` (ถ้ามี)
2. ถ้ามี `tenantId` → ค้นหาในตาราง `customers` ที่ tenant_id + email
3. ถ้าไม่มี `tenantId` → ใช้ `findByEmailGlobal` ค้นจากอีเมลทั่วทั้งระบบ
   - ถ้ามี 1 รายการ → login ได้
   - ถ้ามีมากกว่า 1 รายการ → ส่ง error "พบอีเมลนี้ในหลายร้าน กรุณาติดต่อพนักงาน"
4. ตรวจรหัสผ่านด้วย bcrypt
5. ส่งคืน JWT และข้อมูล member

---

## 4. โครงสร้าง Flutter App (pos_crm_app)

### Flow การเปิดแอป
1. **หน้าแรก** — `/welcome` (MemberGatewayPage)
   - ปุ่ม "สมัครสมาชิก" → `/member-register`
   - ปุ่ม "เข้าสู่ระบบ" → `/member-login`
   - ปุ่ม "พนักงาน" → `/login` (staff)

2. **ลูกค้าสมาชิก**
   - สมัคร: `/member-register` (MemberRegisterPage) — เรียก `POST /api/auth/register-member`
   - เข้าสู่ระบบ: `/member-login` (MemberLoginPage) — เรียก `POST /api/auth/login-member`

3. **พนักงาน**
   - `/login` (LoginPage) — เลือกพนักงานจากรายชื่อ (SQLite local)
   - `/pin` (PinPage) — กรอกรหัส PIN
   - จากนั้นเข้า MainScaffold (Orders, Products, Reports, CRM, Settings)

### การเชื่อมต่อ Backend
- **VpsApiService** — ใช้ `baseUrl` และ `tenantId` (Shop ID) จาก StoreSettings
- ตั้งค่าได้ที่ Settings → Backend VPS (vpsBaseUrl, shopId)
- ถ้า `shopId` ว่าง → login-member จะไม่ส่ง tenantId (ค้นหาจากอีเมลทั่วทั้งระบบ)

### การเก็บ Token
- ตอนนี้หลัง login สมาชิกสำเร็จ **ยังไม่ได้เก็บ JWT** — มี TODO ไว้สำหรับใช้กับ CRM/ส่วนลดสมาชิก
- authMiddleware ฝั่ง backend ออกแบบสำหรับ staff (userId) ไม่ใช่ member (customerId)

---

## 5. ไฟล์สำคัญ

### pos_backend
- `server.js` — Express + CORS + auth, products, orders, customers, public routes
- `routes/auth.js` — เส้นทาง auth ทั้งหมด
- `controllers/authController.js` — register, login, registerMember, loginMember, me
- `models/customer.js` — findByEmail, findByEmailGlobal, create
- `middlewares/auth.js` — ตรวจ JWT สำหรับ staff (userId)

### pos_crm_app
- `lib/core/router/app_router.dart` — initialLocation: `/welcome`
- `lib/features/auth/presentation/pages/member_gateway_page.dart` — หน้าหลักแรก
- `lib/features/auth/presentation/pages/member_register_page.dart`
- `lib/features/auth/presentation/pages/member_login_page.dart`
- `lib/core/services/vps_api_service.dart` — register(), loginMember()
- `lib/core/providers/store_settings_provider.dart` — vpsBaseUrl, shopId

---

## 6. จุดที่อาจต้องตรวจสอบ (สำหรับ Gemini)

1. **login-member ไม่ส่ง tenantId** — Flutter ส่ง tenantId เมื่อ `shopId.trim().isNotEmpty` เท่านั้น ถูกต้องหรือไม่?
2. **authMiddleware** — ตอนนี้รองรับเฉพาะ staff (userId) หากมี API สำหรับ member ที่ต้องส่ง token (customerId) ต้องปรับ middleware หรือไม่
3. **FormatException: &lt;!DOCTYPE html&gt;** — ถ้าได้ HTML แทน JSON แสดงว่า URL หรือ path ของ API อาจผิด หรือ backend ไม่ได้รัน
4. **การเก็บ member token** — ตอนนี้ยังไม่ได้ persist; ถ้าต้องการใช้ member ใน CRM หรือส่วนลด ควรมี provider/store และส่ง token ใน Header

---

## 7. การทดสอบ API

```bash
# Health check
curl http://localhost:3001/api/status

# Login member (ไม่ส่ง tenantId)
curl -X POST http://localhost:3001/api/auth/login-member \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"123456"}'

# Login member (มี tenantId)
curl -X POST http://localhost:3001/api/auth/login-member \
  -H "Content-Type: application/json" \
  -d '{"tenantId":"shop123","email":"user@example.com","password":"123456"}'
```

---

*เอกสารนี้สรุปจากโค้ดปัจจุบัน (มี.ค. 2026)*
