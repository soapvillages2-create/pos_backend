# สรุปคำตอบคำถามระบบ Loyalcloud CRM

## 1. Backspace ไม่สามารถลบตัวอักษรได้ในหลายช่อง
**แก้ไขแล้ว:** เพิ่ม `autocorrect: false` และ `enableSuggestions: false` ใน TextFormField เพื่อลดปัญหาการกดแป้นบน Windows  
ถ้ายังมีปัญหา แนะนำอัปเดต Flutter เป็นเวอร์ชันล่าสุด

---

## 2. ระบบ Email Login ใช้งานได้จริงหรือยัง? VPS ทำหน้าที่เหมือน Firebase ไหม?

**ใช้งานได้** เมื่อ Backend รันอยู่ (npm start)

**เปรียบเทียบกับ Firebase:**
| หน้าที่ | Firebase | VPS (pos_backend) |
|--------|----------|-------------------|
| Auth (Login/Register) | ✅ | ✅ API `/api/auth/login`, `/api/auth/register` |
| เก็บข้อมูล | Firestore/Realtime DB | PostgreSQL |
| Hosting | Google | VPS ของคุณ |

VPS ของคุณทำหน้าที่เป็น **Backend ฝั่งตัวเอง** คล้าย Firebase — รับ API, เก็บข้อมูลในฐานข้อมูล และรองรับ Auth

---

## 3. ดูรายการอีเมลลูกค้าที่สมัครไว้ได้จากไหน?

**วิธีที่ 1: ผ่าน API (Backend)**
```bash
# ต้องใส่ Bearer Token ของร้าน
curl -H "Authorization: Bearer <token>" http://localhost:3001/api/customers
```
ตอบเป็นรายการลูกค้า (รวมอีเมล) ของ tenant นั้น

**วิธีที่ 2: ผ่านฐานข้อมูล**
```sql
SELECT id, name, email, phone, points FROM customers WHERE tenant_id = 'shop543180';
```

**อนาคต:** สามารถเพิ่มหน้า "รายชื่อลูกค้าสมาชิก" ใน CRM เพื่อดึงและแสดงจาก API ได้

---

## 4. ลูกค้าลืมรหัสผ่านต้องทำยังไง?

**ตอนนี้:** ยังไม่มีระบบลืมรหัสผ่าน

**แผนที่ต้องทำต่อ:**
1. เพิ่ม API `POST /api/auth/forgot-password` บน Backend
2. ส่งอีเมล reset link (ต้องมี SMTP หรือบริการส่งอีเมล เช่น SendGrid, Resend)
3. เพิ่มหน้า "ลืมรหัสผ่าน" ในแอป และเชื่อมกับ API

**ทางเลือกชั่วคราว:** พนักงานแก้รหัสผ่านให้ในฐานข้อมูลหรือให้ลูกค้าสมัครใหม่ (ถ้าโอเคกับ flow นี้)

---

## 5. API & Shop, สมัครสมาชิก, เข้าสู่ระบบสมาชิก — ยังใช้อยู่หรือเอาออก?

**ลบออกจาก Settings แล้ว** เพราะตอนนี้ flow หลักเป็น B2B (เจ้าของร้าน login/register)

**กรณีอยากใช้ระบบลูกค้าสมาชิก (Loyalty/Points) อีกครั้ง:**
- เพิ่มเมนูใน **CRM** เช่น "สมัครสมาชิก", "เข้าสู่ระบบสมาชิก"
- API & Shop ID ยังใช้ได้ที่ `/settings/vps-backend` (เหลือ route อยู่ แค่ไม่มีปุ่มในเมนู)

ถ้าต้องการปุ่มกลับมา แจ้งได้ จะช่วยเพิ่มกลับเข้า Settings หรือใน CRM ได้
