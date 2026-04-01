# Deploy checklist — `GET /api/pos/catalog` (แก้ 404 multi-POS)

**งานที่ต้องทำบน production (สรุปเดียวกัน — ไม่ใช่สองระบบแยกกัน):**

| รายการ | รายละเอียด |
|--------|-------------|
| **Endpoint จริง** | `GET https://api.loyalcloudcrm.com/api/pos/catalog` |
| **Auth** | ต้องใช้ **`Authorization: Bearer <JWT>`** ตามที่แอปส่ง (ผูก tenant กับร้านที่ล็อกอิน) |
| **Body / response** | โครง snapshot เมนูใน `data` ตามสเปก **`docs/CATALOG_SYNC_API.md`** ใน repo แอป (`pos_crm_app`) — `categories` / `products` / `addonGroups` / `salesSettings` ฯลฯ |

**คู่มือสองไฟล์ใน repo นี้:**

- **`DEPLOY_POS_CATALOG.md` (ไฟล์นี้)** — เช็กลิสต์ deploy, ทดสอบหลัง deploy, handoff ทีมแอป  
- **[`API_POS_CATALOG.md`](API_POS_CATALOG.md)** — รายละเอียด API, `version` / `updatedAt`, rate limit, schema, ตาราง DB  

ทั้งคู่เป็น **งานเดียว (catalog API + ข้อมูลจริงใน `data`)** — แยกไฟล์เพื่ออ่านง่าย (deploy vs สเปก API) ไม่ใช่ “งานคนละระบบ” สองชิ้น

**หน้า hub ชี้ทั้ง deploy / API / สเปกแอป:** [`CATALOG_SYNC_ROADMAP.md`](CATALOG_SYNC_ROADMAP.md)  
ลำดับงานรวม (backend → แอป → phase ถัดไป): ดูที่ไฟล์เดียวกัน

## ฝั่ง Backend — ให้ทำอะไรต่อ (ชัดเจน)

| # | งาน | เหตุผล |
|---|-----|--------|
| **1** | Deploy route **`GET /api/pos/catalog`** บน **`https://api.loyalcloudcrm.com`** ให้ตรง path นี้ (หรือถ้าใช้ path อื่นต้องแจ้งทีมแอปให้แก้ client / Nginx) | ตอนนี้ production ตอบ **ไม่มี route** (เช่น HTML `Cannot GET /api/pos/catalog`) — แอปกด **「ดึงเมนูจากคลาวด์」** จึงยังใช้กับ production ไม่ได้ |
| **2** | **Auth:** รับ `Authorization: Bearer <JWT>` — ผูก tenant กับร้านเดียวกับ login | ให้ตรงกับที่ POS ส่งอยู่แล้ว |
| **3** | พฤติกรรมเมื่อ **ไม่ส่ง token:** ให้ได้ **401** (หรืออย่างน้อย **ไม่ใช่** 404 / HTML **Cannot GET**) เพื่อยืนยันว่า route มี | ใช้ทดสอบว่า deploy ถูก — ตาม section **ทดสอบหลัง deploy** ด้านล่าง |
| **4** | ใส่เมนูจริงใน snapshot (DB / แอดมิน / job sync) หรือให้ตาราง `products` มีข้อมูลเพื่อ derive — ให้ `data` มี `categories`, `products`, `addonGroups` ตามสเปก **`docs/CATALOG_SYNC_API.md`** ใน repo แอป (`pos_crm_app`) | ไม่งั้นแม้ route มีแล้ว แอปดึงได้แต่ชุดว่าง — หลายเครื่องยังไม่เห็นเมนูจริง |
| **5** | (แนะนำ) เติม [`API_POS_CATALOG.md`](API_POS_CATALOG.md) เรื่อง `version`, rate limit ชั้น Nginx/WAF ตามของจริง | ให้ทีมแอป / ops อ้างอิงได้ |

**สิ่งที่ backend ไม่จำเป็นต้องทำเพื่อให้ “ขายได้”:** ไม่จำเป็นต้องรอ catalog / multi-POS เสร็จก่อน ร้านจะขายผ่าน POS + QR แบบเดิมได้ — แต่ **จำเป็น** ถ้าต้องการฟีเจอร์ **ดึงเมนูจากคลาวด์หลายเครื่อง** ให้ครบ

### ทดสอบหลัง deploy (production)

```bash
curl.exe -sS --ssl-no-revoke -i "https://api.loyalcloudcrm.com/api/pos/catalog"
```

**คาดหวัง:** **401** เมื่อไม่ส่ง token — หรือ **200** + JSON เมื่อส่ง `Authorization: Bearer <JWT>` ถูกต้อง  
**ไม่ควรได้:** **404** หรือ body เป็น **HTML** `Cannot GET /api/pos/...`

### สรุปสถานะ (สั้น ๆ)

| สถานะ | ความหมาย |
|--------|----------|
| **ตอนนี้ (ก่อน deploy ครบ)** | Production อาจยังไม่มี endpoint นี้ — สอดคล้องกับที่เคยได้ **404** / **Cannot GET** จากแอป |
| **ตอน dev** | รัน `pos_backend` ในเครื่อง + ตั้ง `API_BASE_URL=http://127.0.0.1:3001` → มักได้ **200** (พร้อม token) หรือ **401** (ไม่ส่ง token) |
| **ขั้นต่อไป** | Backend **deploy route จริง** ขึ้น `api.loyalcloudcrm.com` แล้วทดสอบด้วย **token จริง** (และแอป) อีกครั้ง |

## สาเหตุ HTTP 404 บน production

แอปเรียก `GET {API_BASE_URL}/api/pos/catalog` แล้วได้ **404** แปลว่า **process ของ backend ที่รับ traffic ยังไม่มี route นี้** (มักเป็น image เก่า / ยังไม่ `git pull` โค้ดที่มี `app.use('/api/pos', ...)`)

**ไม่ใช่** เพราะ Nginx บล็อก path — `nginx.conf` ส่ง `location /` ไป `backend:3001` ครบทุก path รวม `/api/pos/*`

## โค้ดที่เกี่ยวข้อง (ใน repo นี้)

| ส่วน | ไฟล์ |
|------|------|
| Mount route | `server.js` → `app.use('/api/pos', require('./routes/pos'))` |
| Handler | `routes/pos.js` → `GET /catalog` → `posCatalogController.getCatalog` |
| Auth | `middlewares/auth` — `Authorization: Bearer <JWT>` → `req.user.tenantId` |
| สเปก response / `version` / rate limit | [`docs/API_POS_CATALOG.md`](API_POS_CATALOG.md) — ดู [`#data-version`](API_POS_CATALOG.md#data-version) และ [`#rate-limiting`](API_POS_CATALOG.md#rate-limiting) |

## ขั้นตอน deploy บน VPS (checklist)

คำสั่งแบบเต็ม (SSH, migration, `docker-compose`, ทดสอบ): [`DEPLOY_VPS.md`](DEPLOY_VPS.md)

1. `cd ~/pos_backend` (หรือ path โปรเจกต์จริง)
2. `git pull` ให้ได้ commit ที่มี `routes/pos.js` และ `server.js` mount `/api/pos`
3. Migration **011** `pos_catalog_snapshots` — ถ้ายังไม่รัน ให้รันตาม [`docs/API_POS_CATALOG.md`](API_POS_CATALOG.md) (ตาราง DB ตัวอย่าง) / `migrations/011_pos_catalog_snapshots.sql`
4. Build + up backend:
   - `docker compose build backend` + `docker compose up -d`  
   - หรือ `docker-compose ...` ตามเครื่อง
5. ตรวจ:
   ```bash
   curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3001/api/pos/catalog
   ```
   คาดหวัง **401** (ไม่ส่ง token) — **ไม่ใช่ 404**  
   ถ้าได้ **404** แปลว่า container ยังเป็น image เก่า / ผิด container
6. (ถ้าทีม backend มีรายละเอียด production) เติมใน [`API_POS_CATALOG.md#data-version`](API_POS_CATALOG.md#data-version) และ [`API_POS_CATALOG.md#rate-limiting`](API_POS_CATALOG.md#rate-limiting)

## สิ่งที่ส่งกลับทีมแอปหลัง deploy

คัดลอกบล็อก **Prompt คัดลอก (handoff)** ด้านล่างไปให้ทีม Flutter / ซัพพอร์ต — รายละเอียด `data.version` / `updatedAt` และ rate limit ชี้ไปที่เอกสารเดียวกัน

| หัวข้อ | รายละเอียด / ลิงก์ |
|--------|---------------------|
| Base URL (production) | `https://api.loyalcloudcrm.com` |
| Endpoint | `GET /api/pos/catalog` |
| **`data.version` และ `updatedAt`** | [`docs/API_POS_CATALOG.md#data-version`](API_POS_CATALOG.md#data-version) |
| **Rate limiting** | [`docs/API_POS_CATALOG.md#rate-limiting`](API_POS_CATALOG.md#rate-limiting) |
| สเปก JSON ฝั่งแอป | `docs/CATALOG_SYNC_API.md` ใน repo แอป (`pos_crm_app`) + [`API_POS_CATALOG.md`](API_POS_CATALOG.md) |

---

### Prompt คัดลอก (handoff ถึงทีมแอป)

```text
[POS Catalog / multi-POS — หลัง deploy]

Base URL (production): https://api.loyalcloudcrm.com
GET /api/pos/catalog
Full URL: https://api.loyalcloudcrm.com/api/pos/catalog

Auth: Authorization: Bearer <JWT> — ข้อมูลตาม tenant ใน token (tenantId)

ยืนยัน: token ร้านถูกต้อง → HTTP 200 + { "success": true, "data": { ... } }
ไม่ส่ง token → 401 (ไม่ควร 404 ถ้า deploy route แล้ว)

รายละเอียด data.version / updatedAt:
  docs/API_POS_CATALOG.md#data-version

รายละเอียด Rate limiting:
  docs/API_POS_CATALOG.md#rate-limiting

สเปก JSON ฝั่งแอป: docs/CATALOG_SYNC_API.md (pos_crm_app)

หมายเหตุ: POST /api/qr/sync-menu คนละ flow กับ catalog pull
```

---

### Handoff — อ้างอิงสเปก (ลิงก์เดียวกับตารางด้านบน)

- **[`data.version` / `updatedAt`](API_POS_CATALOG.md#data-version)** — ความหมาย, พฤติกรรม DB, ตาราง `pos_catalog_snapshots`, ช่องให้ backend เติม Production / Staging  
- **[Rate limiting](API_POS_CATALOG.md#rate-limiting)** — Node ไม่ limit เฉพาะ path; ตารางชั้น Nginx / WAF — ช่องให้ backend เติม  

**Auth:** Header `Authorization: Bearer <JWT>` — ข้อมูลเป็นของ **tenant ใน JWT (`tenantId`) เท่านั้น**

**ยืนยันหลัง deploy:**  
เรียกด้วย token ร้านที่ถูกต้อง → ควรได้ **HTTP 200** + body `{ "success": true, "data": { ... } }`  
ถ้าไม่ส่ง token → **401** (ไม่ใช่ 404)  
ถ้ายัง **404** → backend บน host ที่ `API_BASE_URL` ชี้ยังไม่ใช่เวอร์ชันที่ deploy route นี้

**สเปก JSON:** อ้างอิง `docs/CATALOG_SYNC_API.md` ใน repo แอป (`pos_crm_app`) และ [`docs/API_POS_CATALOG.md`](API_POS_CATALOG.md)

**หมายเหตุ:**  
- **POST `/api/qr/sync-menu`** = ดันเมนูขึ้น VPS สำหรับ QR / web menu — **คนละ flow** กับ catalog pull  
- ร้านยังใช้ QR ได้แม้ catalog ยังไม่ deploy; ปุ่ม **「ดึงเมนูจากคลาวด์」** ต้องรอ `GET /api/pos/catalog` พร้อมบน production

---

## Staging

ถ้ามี staging แยก — ใส่ base URL จริงของ staging ที่ทีม deploy; path เดียวกัน `/api/pos/catalog` — รายละเอียด `version` / rate limit ให้สอดคล้อง [`#data-version`](API_POS_CATALOG.md#data-version) และ [`#rate-limiting`](API_POS_CATALOG.md#rate-limiting)
