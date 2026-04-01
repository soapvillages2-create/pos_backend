# `GET /api/public/products/:tenantId` — เมนูมือถือ / QR

## หลักการ

- **ต้องอ่านจากตาราง `qr_menu_products`** — ข้อมูลมาจาก **`POST /api/qr/sync-menu`** (แอป POS ดันเมนูขึ้น) เท่านั้น  
- **ไม่ใช้** รายการจาก catalog หลักในตาราง `products` แบบรวมทุกแถว — เพราะแถวใน `products` อาจมาจาก CRM / API อื่น ทำให้เมนูบนมือถือลูกค้าไม่ตรงกับ POS แม้กด sync แล้ว

## Path

- **Production:** `GET https://api.loyalcloudcrm.com/api/public/products/{tenantId}`  
- พารามิเตอร์ **`tenantId`** = รหัสร้าน / **shopId** (เดียวกับ `tenant_id`)

## ฐานข้อมูล

| ตาราง | บทบาท |
|--------|--------|
| `qr_menu_products` | แหล่งที่ public API อ่าน — sync-menu upsert แถวที่นี่ (และยัง upsert `products` สำหรับ flow อื่น) |
| `products` | Catalog รวม (รวมสินค้าจากช่องทางอื่น) — **ไม่ใช้** เป็นแหล่งเดียวสำหรับหน้าเมนู QR อีกต่อไป |

Migration: `migrations/012_qr_menu_products.sql`

## สิ่งที่ backend production ต้องทำ (ตามลำดับ)

1. **`git pull`** — ให้ได้โค้ดที่มีตาราง `qr_menu_products` และ route อ่านจากตารางนี้  
2. **รัน migration `012`** — ไฟล์ `migrations/012_qr_menu_products.sql` (สร้างตาราง + backfill จากแถว `products` ที่มี `sync_key`)  
3. **`build` + `up` backend** — เช่น `docker-compose build backend` แล้ว `docker-compose up -d`

**หลังทำครบ:** `GET /api/public/products/{tenantId}` จะอ่านจากตารางที่ **`sync-menu` เขียนลง** (`qr_menu_products`) → เมนูบนมือถือลูกค้าจะตรงกับร้านนั้น (สิ่งที่ POS ซิงค์ขึ้น) ไม่ปนกับ catalog หลักใน `products` แบบเดิม

**วิธีทำแบบละเอียด (ทีละขั้น, คำสั่งครบ, ทดสอบ):** [`DEPLOY_VPS.md#runbook-012`](DEPLOY_VPS.md#runbook-012)
