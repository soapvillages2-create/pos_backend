# POS Catalog Cloud Sync — หน้าเดียว (hub)

เอกสารนี้เป็นจุดเริ่มเดียวที่ชี้ไป **สามแหล่ง** — อ่านลำดับงานด้านล่างต่อได้

---

## สรุปให้ทีม backend

- **งานเดียว:** deploy **`GET https://api.loyalcloudcrm.com/api/pos/catalog`** + **`Authorization: Bearer <JWT>`** + ข้อมูล snapshot ใน `data` **ตรงสเปก**
- **แยกไฟล์สองไฟล์ใน `pos_backend/docs/`** = อ่านง่าย — **ไม่ใช่สองระบบ**
  - **`DEPLOY_POS_CATALOG.md`** — URL, เช็กลิสต์, `curl`, prompt handoff
  - **`API_POS_CATALOG.md`** — สเปก API ละเอียด (`version`, rate limit, schema ฝั่งเซิร์ฟเวอร์ / DB)
- **โครง JSON ที่แอปใช้ merge** ยังอ้าง **`docs/CATALOG_SYNC_API.md`** ใน repo **`pos_crm_app`** (ไม่ใช่แค่ backend)

---

## ลิงก์สั้น ๆ — สามแหล่ง

| ลำดับ | ไฟล์ | Repo | ใช้ทำอะไร |
|--------|------|------|------------|
| 1 | [`DEPLOY_POS_CATALOG.md`](DEPLOY_POS_CATALOG.md) | **pos_backend** | Deploy, เช็กลิสต์, ทดสอบ production, handoff ทีมแอป |
| 2 | [`API_POS_CATALOG.md`](API_POS_CATALOG.md) | **pos_backend** | สเปก endpoint, [`#data-version`](API_POS_CATALOG.md#data-version), [`#rate-limiting`](API_POS_CATALOG.md#rate-limiting), schema |
| 3 | `docs/CATALOG_SYNC_API.md` | **pos_crm_app** | สเปก JSON ฝั่ง client (merge ลง SQLite) — **แหล่งอ้างอิงโครง `data`** |

คำสั่ง deploy ทั่วไปบน VPS (SSH, `git pull`, migration, `docker-compose`): [`DEPLOY_VPS.md`](DEPLOY_VPS.md)

เมนูมือถือ QR (`GET /api/public/products`) กับตาราง `qr_menu_products`: [`API_PUBLIC_QR_MENU_PRODUCTS.md`](API_PUBLIC_QR_MENU_PRODUCTS.md)

*(ถ้าเปิดจาก GitHub: ใช้ path เต็มในแต่ละ repo — ไฟล์ที่ 3 ไม่อยู่ใน repo นี้)*

---

## หมายเหตุเรื่อง repo / การแก้เอกสาร

- ทีม backend แก้เอกสารใน **`pos_backend`** ได้ตามปกติ — ให้ **merge ข้อความหรือตารางสรุปด้านบน** ให้ตรงกับ **`pos_crm_app`** เมื่อมีการเปลี่ยนสเปก JSON
- หรือระบุในเอกสารว่า **แหล่งจริงของโครง merge อยู่ที่ `pos_crm_app/docs`** แล้ว backend อ้างอิงแบบ link ก็ได้ — เพื่อไม่ให้สองที่คลาดกัน

---

## ลำดับงาน (backend → แอป → phase ถัดไป)

### 1. ฝั่ง Backend (ต้องมีก่อน ถึงจะ “จบ” เรื่องดึงเมนูจากคลาวด์)

- [ ] Deploy **`GET /api/pos/catalog`** บน `https://api.loyalcloudcrm.com` ให้ตอบ **HTTP 200** (ไม่ใช่ **404**) พร้อมโครง `{ success, data }` ตามสเปก
- [ ] **ยืนยัน JWT** — token ร้านเดียวกับ login → ได้ snapshot ของ **tenant นั้น**เท่านั้น
- [ ] มี **ข้อมูลจริงอย่างน้อย 1 ร้าน** (หรือ staging ที่แอปชี้ได้) เพื่อทีมแอปทดสอบ **end-to-end**
- [ ] เติม [`API_POS_CATALOG.md`](API_POS_CATALOG.md) ในส่วนที่เป็นความจริงของ **production** ([`#data-version`](API_POS_CATALOG.md#data-version), [`#rate-limiting`](API_POS_CATALOG.md#rate-limiting) ฯลฯ)
- [ ] ถ้ายัง **ไม่มีแหล่ง master catalog** — **ตกลงก่อน** ว่า snapshot ในอนาคตจะมาจากไหน (แอดมิน / `POST` จาก POS / import) แล้วค่อยทำทีหลัง — แต่ **route + 200 + payload ตัวอย่าง** ควรมีก่อน (derive จาก `products` + ตารางที่มีอยู่ตามโค้ดปัจจุบันก็เพียงพอสำหรับรอบแรก)

### 2. ฝั่งแอป / QA (ทำคู่กับข้อ 1)

- [ ] ตั้ง **`API_BASE_URL`** ชี้ production (หรือ staging ที่ deploy แล้ว)
- [ ] ล็อกอินเจ้าของร้าน → ตั้งค่า → **ซิงค์ข้อมูล Cloud** (ดึงเมนูจากคลาวด์)
- [ ] ตรวจว่าเมนู/ตั้งค่าในตัวอย่าง **ลง SQLite** ตามที่คาด
- [ ] ทดสอบ **QR + `sync-menu`** แยกต่างหาก — ยังใช้งานได้แม้ catalog จะยังไม่สมบูรณ์ (คนละ flow)

### 3. ทีหลัง (เมื่อ pull ใช้งานได้แล้ว)

- [ ] ออกแบบ **การอัปโหลด / อัปเดต snapshot** บนเซิร์ฟเวอร์ (ถ้าต้องการให้เครื่องหลักหรือแอดมินเป็นคนกำหนดเมนูเป็น master)
- [ ] ปรับข้อความ error / UX เล็กน้อยในแอป (ถ้าต้องการ)

---

## สรุปท้ายเรื่อง

เริ่มจากให้ **backend เปิด `GET /api/pos/catalog` บน production (หรือ staging)** ให้ได้ **200 + ข้อมูลทดสอบ** — **จุดนี้ผ่านก่อน** แล้วค่อยไล่เรื่องแหล่งข้อมูล master และ flow **`POST`** ต่อ
