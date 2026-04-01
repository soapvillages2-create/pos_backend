# GET `/api/pos/catalog` — POS Catalog Sync (multi-POS)

**งานเดียวกับ [`DEPLOY_POS_CATALOG.md`](DEPLOY_POS_CATALOG.md)** — ไม่ใช่เอกสารคนละระบบ: เป้าหมายคือ **endpoint จริงบน production + ข้อมูล snapshot ใน `data`** ให้สอดคล้องสเปกแอป

| รายการ | รายละเอียด |
|--------|-------------|
| **Production URL** | `GET https://api.loyalcloudcrm.com/api/pos/catalog` |
| **Auth** | `Authorization: Bearer <JWT>` ตามที่แอปส่ง |
| **โครง payload** | สเปก snapshot เมนู — อ้างอิง **`docs/CATALOG_SYNC_API.md`** ใน repo แอป (`pos_crm_app`) |
| **เช็กลิสต์ deploy / ทดสอบ** | [`DEPLOY_POS_CATALOG.md`](DEPLOY_POS_CATALOG.md) |

ไฟล์นี้ (`API_POS_CATALOG`) = **รายละเอียด API** (schema, `version`, rate limit, ตัวอย่าง JSON, ตาราง DB) — คู่กับ `DEPLOY_POS_CATALOG` ที่เน้น **ขั้นตอน deploy และ handoff**

**ทีม backend** แก้ไขหรือเติมรายละเอียดในไฟล์นี้ได้ (รวม [`#data-version`](#data-version) และ [`#rate-limiting`](#rate-limiting))

**หน้า hub:** [`CATALOG_SYNC_ROADMAP.md`](CATALOG_SYNC_ROADMAP.md) — ชี้ทั้ง deploy, สเปก API นี้, และ `CATALOG_SYNC_API.md` ใน repo แอป  
ลำดับงานรวม (backend / แอป / phase ถัดไป): [`CATALOG_SYNC_ROADMAP.md`](CATALOG_SYNC_ROADMAP.md)

## Overview

ดึง snapshot เดียวของเมนู / หมวด / กลุ่ม addon / ราคา และการตั้งค่าขายที่ merge ได้ สำหรับแอป POS หลายเครื่องให้สอดคล้องกัน (pull จาก API)

**แหล่งความจริงของข้อมูล (ปัจจุบัน)**

- ถ้ามี snapshot ใน `pos_catalog_snapshots.payload` และมีข้อมูลแคตตาล็อก (categories / products / addonGroups อย่างน้อยหนึ่งอย่างไม่ว่าง) → ใช้ snapshot นั้น
- ถ้าไม่มี snapshot หรือ snapshot ยังว่าง → สร้างจากตาราง `products` (+ ดึง `store_name` / `web_menu_logo_url` จาก `qr_web_menu_config` เมื่อมี)

**หมายเหตุ:** การแก้เมนู “ของจริง” ขึ้นกับ flow ที่ร้านใช้ — เช่น แก้ในแอดมิน / CRM, ซิงค์จาก POS เครื่องหลักผ่าน QR menu sync (`menu_extras`), หรือ snapshot ที่อนาคตอาจมี `POST` อัปโหลด — เอกสารนี้อธิบายเฉพาะ **การอ่าน** ผ่าน `GET`

## Environment & base URL

| Environment | Base URL |
|-------------|----------|
| Production | `https://api.loyalcloudcrm.com` (ไม่ต่อพอร์ต — ผ่าน Nginx) |
| Staging | ตามที่ทีม deploy (ไม่ได้ hardcode ใน repo) — ใช้รูปแบบเดียวกัน: `https://<staging-host>` + path ด้านล่าง |

**Full URL:** `{base}/api/pos/catalog`

## Authentication

- **Header:** `Authorization: Bearer <JWT>`
- Token จาก flow login เจ้าของร้าน / session ที่แอปเก็บ (เหมือน API ที่ต้องล็อกอินอื่น ๆ ของ Loyalcloud)
- `tenant_id` ใน JWT กำหนดร้านที่คืนข้อมูล

<a id="data-version"></a>

## `data.version` และ `updatedAt`

### ความหมายของฟิลด์ใน response (`data`)

| Field | Type | ความหมาย |
|-------|------|-----------|
| `version` | integer | เลขรุ่นของ snapshot แคตตาล็อกต่อร้าน — แอปใช้เปรียบเทียบว่ามีการเปลี่ยนแปลงรุ่นของ snapshot หรือไม่ |
| `updatedAt` | string (ISO 8601 UTC) | เวลาอ้างอิงว่า snapshot / ข้อมูลแคตตาล็อก “สด” แค่ไหน — ใช้คู่กับ `version` ตามสเปก client |

### พฤติกรรมในโค้ดปัจจุบัน (`services/posCatalogService.js` + ตาราง `pos_catalog_snapshots`)

| สถานการณ์ | `data.version` | `data.updatedAt` |
|------------|----------------|------------------|
| มีแถวใน `pos_catalog_snapshots` และ payload ถือว่า **มีแคตตาล็อก** (categories / products / addonGroups อย่างใดอย่างหนึ่งไม่ว่าง) | จากคอลัมน์ **`pos_catalog_snapshots.version`** (cast เป็น integer) | จาก **`pos_catalog_snapshots.updated_at`** |
| **ไม่มี** snapshot ที่ถือว่ามีแคตตาล็อก → **derive** จากตาราง `products` (+ sales บางส่วนจาก config) | ค่าเริ่มต้น **`1`** — ถ้ามีแถว snapshot แต่ยัง derive จาก `products` อาจ **ดึง `version` จากแถว snapshot** มาแทนค่าเริ่มต้น (เมื่อมีในคอลัมน์) | เวลาจาก **ความใหม่ของสินค้า** (เช่น `updated_at` ล่าสุดของแถวใน `products`) หรือเวลาปัจจุบันเมื่อ derive |
| **Stub / ก่อน deploy จริงใน `pos_backend`:** ไม่มี route หรือยังไม่ mount `/api/pos` | — | — |

การ **bump `version` อัตโนมัติ** ทุกครั้งที่มีการเปลี่ยนเมนูใน DB — **ยังไม่มีใน backend** จนกว่าจะมี flow อัปโหลด snapshot (`POST` หรือ job) ที่อัปเดตแถว `pos_catalog_snapshots` อย่างชัดเจน

### รายละเอียดเพิ่มเติม (ทีม backend เติมได้)

| หัวข้อ | ค่า / หมายเหตุ |
|--------|----------------|
| Production | _(เติม — เช่น ช่วงเลขที่ใช้จริง หรือนโยบายเมื่อไหร่จะ bump `version`)_ |
| Staging | _(เติม)_ |
| ความสัมพันธ์กับ `updatedAt` | _(เติม — เช่น เมื่อไหร่ควร bump `version` พร้อมเปลี่ยน `updated_at`)_ — แนวทาง: bump `version` เมื่อ payload แคตตาล็อกเปลี่ยนแบบมีนัยสำคัญ; แอปอาจใช้ทั้งคู่หรืออย่างใดอย่างหนึ่งตามสเปก client |

<a id="rate-limiting"></a>

## Rate limiting

โปรเซส **Node/Express** ใน repo นี้ **ไม่ได้กำหนด rate limit เฉพาะ** path `GET /api/pos/catalog` — ถ้ามีการจำกัดจะอยู่ที่ชั้นอื่น (Nginx, CDN, WAF, load balancer, cloud provider, ฯลฯ)

### รายละเอียดตามชั้น (ทีม backend เติมได้)

| ชั้น | Scope | Limit | เมื่อเกิน limit |
|------|--------|-------|------------------|
| Nginx | _(เติม — เช่น `/api/` หรือทั้ง vhost)_ | _(เติม)_ | _(เติม — เช่น 429, ปิด connection)_ |
| WAF / CDN / อื่น ๆ | _(เติม)_ | _(เติม)_ | _(เติม)_ |

**แนะนำ:** ถ้า **ไม่มี** rate limit แยกสำหรับ path นี้หรือทั้ง API — **เขียนชัดในแถวหรือบรรทัดด้านล่าง** (เช่น “ไม่มี / ใช้ค่า default ของโฮสต์เท่านั้น”) เพื่อให้ทีมแอปและซัพพอร์ตไม่ต้องเดา

_(ทีม backend เติมประโยคสรุปที่นี่ — ถ้าไม่มี limit ให้ระบุชัด)_

## Response wrapper

สำเร็จ: HTTP **200**

```json
{
  "success": true,
  "data": { ... }
}
```

ข้อผิดพลาด (สอดคล้อง API อื่น):

```json
{
  "success": false,
  "message": "ข้อความภาษาไทยหรืออังกฤษตามที่ API คืน"
}
```

- **401** — ไม่มี / ไม่ถูกต้อง Bearer token  
- **500** — ข้อผิดพลาดเซิร์ฟเวอร์

แอปฝั่ง Flutter รองรับทั้งกรณีมี wrapper `data` และกรณี root เป็น object เดียวกับ `data` (ดู `catalog_cloud_sync_service.dart`)

## Schema (`data`)

| Field | Type | Description |
|-------|------|-------------|
| `version` | `number` | ดูความหมายและพฤติกรรมใน section [`data.version` / `updatedAt`](#data-version) — อ้างอิงคอลัมน์ `version` ในตาราง `pos_catalog_snapshots` ด้านล่าง |
| `updatedAt` | `string` | ISO 8601 UTC — ดู section [`data.version` / `updatedAt`](#data-version) |
| `categories` | `array` | หมวด — แต่ละอันมี `id` (UUID string), `name`, อาจมี `sortOrder` |
| `addonGroups` | `array` | กลุ่ม addon — `id` (UUID), `name`, `options[]` ครบทุกตัวเลือกในกลุ่ม |
| `products` | `array` | สินค้า — `id` (UUID), `categoryId`, `addonGroupIds`, ราคา, ฯลฯ |
| `salesSettings` | `object` \| `null` | การตั้งค่าขายที่ merge ได้ (optional) |

### ตารางฐานข้อมูลที่เกี่ยวข้อง (ตัวอย่าง — migration `011`)

ตาราง **`pos_catalog_snapshots`** เก็บ snapshot ต่อ tenant; ฟิลด์ `version` ใน JSON response สอดคล้องกับคอลัมน์ **`version`** ในแถวนี้เมื่อใช้ snapshot เป็นต้นทาง — รายละเอียดการคำนวณและกรณี derive ดูที่ section [`#data-version`](#data-version)

| Column | Type | หมายเหตุ |
|--------|------|----------|
| `tenant_id` | `VARCHAR(20)` PK, FK → `tenants` | ร้าน |
| `version` | `INT NOT NULL DEFAULT 1` | map ไป `data.version` เมื่ออ่านจาก snapshot |
| `updated_at` | `TIMESTAMPTZ` | map ไป `data.updatedAt` เมื่ออ่านจาก snapshot |
| `payload` | `JSONB` | เนื้อหาแคตตาล็อก (categories / products / addonGroups / salesSettings ฯลฯ) |

### กฎ ID

- `categories[].id`, `addonGroups[].id`, `products[].id` ต้องเป็น **string UUID** คงที่ข้ามเครื่อง  
- `products[].categoryId` = UUID ของหมวดใน `categories[]`  
- `products[].addonGroupIds` = array ของ UUID ใน `addonGroups[]`  
- `addonGroups[].options[]` ส่งครบทุกครั้งสำหรับกลุ่มนั้น (แอปจะแทนที่ตัวเลือกเดิมในกลุ่ม)

### `salesSettings` (ฟิลด์ที่รองรับ merge — ส่งเฉพาะที่ต้องการอัปเดต)

`storeName`, `storePhone`, `storeAddress`, `storeTaxId`, `vatEnabled`, `vatRate`, `vatIncluded`, `receiptHeader`, `receiptFooter`, `receiptShowLogo`, `receiptLogoSizePercent`, `receiptShowOrderType`, `receiptShowTableNo`, `receiptShowStaffName`, `qrReceiptHeader`, `qrReceiptFooter`, `webMenuLogoUrl`

## Example (full success body)

```json
{
  "success": true,
  "data": {
    "version": 1,
    "updatedAt": "2026-03-30T12:00:00.000Z",
    "categories": [
      { "id": "a1b2c3d4-e5f6-4789-a012-3456789abcde", "name": "เครื่องดื่ม", "sortOrder": 0 }
    ],
    "addonGroups": [
      {
        "id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
        "name": "ระดับความหวาน",
        "options": [
          { "id": "11111111-2222-4333-8444-555555555555", "name": "หวานน้อย", "price": 0 },
          { "id": "66666666-7777-4888-8999-aaaaaaaaaaaa", "name": "หวานมาก", "price": 5 }
        ]
      }
    ],
    "products": [
      {
        "id": "99999999-aaaa-4bbb-8ccc-dddddddddddd",
        "name": "ชาเย็น",
        "categoryId": "a1b2c3d4-e5f6-4789-a012-3456789abcde",
        "price": 45,
        "description": "",
        "imageUrl": "https://example.com/tea.jpg",
        "isActive": true,
        "emoji": "🧋",
        "imageAlignY": 0.5,
        "addonGroupIds": ["f47ac10b-58cc-4372-a567-0e02b2c3d479"]
      }
    ],
    "salesSettings": {
      "storeName": "ร้านตัวอย่าง",
      "vatEnabled": true,
      "vatRate": 7,
      "vatIncluded": false,
      "receiptHeader": "ขอบคุณที่ใช้บริการ",
      "receiptFooter": "",
      "receiptShowLogo": true,
      "receiptLogoSizePercent": 20,
      "receiptShowOrderType": true,
      "receiptShowTableNo": true,
      "receiptShowStaffName": false,
      "qrReceiptHeader": "",
      "qrReceiptFooter": "",
      "webMenuLogoUrl": "https://example.com/logo.png"
    }
  }
}
```

## OpenAPI fragment (paths)

```yaml
paths:
  /api/pos/catalog:
    get:
      summary: POS catalog snapshot for multi-device sync
      security:
        - bearerAuth: []
      responses:
        '200':
          description: Catalog snapshot
          content:
            application/json:
              schema:
                type: object
                properties:
                  success: { type: boolean, example: true }
                  data:
                    type: object
                    properties:
                      version: { type: integer }
                      updatedAt: { type: string, format: date-time }
                      categories: { type: array, items: { type: object } }
                      addonGroups: { type: array, items: { type: object } }
                      products: { type: array, items: { type: object } }
                      salesSettings: { type: object, nullable: true }
        '401':
          description: Missing or invalid JWT
        '500':
          description: Server error
components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
```
