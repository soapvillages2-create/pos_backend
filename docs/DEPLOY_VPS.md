# Deploy backend บน VPS (Docker + Nginx)

สรุปขั้นตอนมาตรฐานสำหรับ repo **`pos_backend`** บน Linux (เช่น Contabo) — path ตัวอย่าง: `~/pos_backend` หรือ `/root/pos_backend`

**สิ่งที่ต้องมีบน VPS:** Docker, Git, ไฟล์ `.env` ในโฟลเดอร์โปรเจกต์ (ไม่ commit — ใส่ `DB_*`, `JWT_SECRET`, ฯลฯ)

---

<a id="runbook-012"></a>

## Runbook ละเอียด: `git pull` → migration **012** → `build` + `up` backend

**เป้าหมาย:** หลังทำครบทุกขั้น `GET /api/public/products/{tenantId}` จะอ่านจากตาราง **`qr_menu_products`** ที่ **`POST /api/qr/sync-menu`** เขียนลง — เมนูบนมือถือลูกค้าจะตรงกับร้านนั้น (ไม่ปนกับ catalog หลักใน `products` แบบเดิม)  
สเปกและเหตุผล: [`API_PUBLIC_QR_MENU_PRODUCTS.md`](API_PUBLIC_QR_MENU_PRODUCTS.md)

### ขั้น 0 — เข้า VPS และไปที่โปรเจกต์

```bash
ssh root@<IP_เซิร์ฟเวอร์>
cd ~/pos_backend
```

ถ้า clone ไว้ path อื่น (เช่น `/root/pos_backend`) ให้ `cd` ไปที่โฟลเดอร์ที่มี **`docker-compose.yml`** และโฟลเดอร์ **`migrations/`**

ตรวจว่าอยู่ถู่ที่:

```bash
ls docker-compose.yml migrations/012_qr_menu_products.sql
```

ถ้าไฟล์ `012` ไม่มี → ยัง **ไม่ได้ `git pull`** โค้ดล่าสุด หรือ pull ผิด branch

---

### ขั้น 1 — ดึงโค้ดล่าสุด

```bash
git fetch origin
git pull origin main
```

(ถ้าใช้ branch อื่น เช่น `master` หรือ `develop` ให้แทนชื่อ branch)

ถ้ามี conflict ให้แก้ไฟล์ที่ conflict แล้ว `git add` / `git commit` ตามปกติก่อนทำขั้นต่อไป

---

### ขั้น 2 — ตรวจว่า container ฐานข้อมูลรันอยู่

```bash
docker ps --filter name=loyalcloud-db --format '{{.Names}} {{.Status}}'
```

ควรเห็น **`loyalcloud-db`** สถานะ **Up** (หรือ healthy)  
ถ้าไม่มี — รัน stack ก่อน เช่น `docker-compose up -d db` แล้วรอให้ DB พร้อม

---

### ขั้น 3 — รัน migration **012**

รันจาก **โฟลเดอร์โปรเจกต์** โดยส่งไฟล์ SQL เข้า `psql` ใน container **`loyalcloud-db`** (ชื่อตาม `docker-compose.yml`)

```bash
cd ~/pos_backend
docker exec -i loyalcloud-db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -f -' < migrations/012_qr_menu_products.sql
```

- ตัวแปร **`POSTGRES_USER`** / **`POSTGRES_DB`** ถูกตั้งใน container จาก `.env` ของ compose — ไม่ต้องพิมพ์รหัสผ่านใน command นี้ถ้าใช้แบบด้านบน
- ถ้า error เรื่อง authentication ให้ลองระบุ user/db ตรงกับ `.env` เช่น  
  `docker exec -i loyalcloud-db psql -U postgres -d <ชื่อ_db> -f - < migrations/012_qr_menu_products.sql`

**ถ้า migration รันสำเร็จ:** จะมีตาราง `qr_menu_products` และมีการ **backfill** จาก `products` ที่มี `sync_key` (ถ้ามีแถวเดิม)

ตรวจว่ามีตาราง (ไม่บังคับ):

```bash
docker exec -i loyalcloud-db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "\dt qr_menu_products"'
```

**รัน migration ซ้ำ:** โดยทั่วไป `CREATE TABLE IF NOT EXISTS` และ `INSERT ... ON CONFLICT` ในไฟล์ 012 ทำให้รันซ้ำได้ไม่พัง — ถ้าแก้ schema มือแล้วอาจต้องดู log เอง

---

### ขั้น 4 — Build และรีสตาร์ท **backend** เท่านั้น

```bash
cd ~/pos_backend
docker-compose build backend
docker-compose up -d
```

หรือถ้าเครื่องใช้คำสั่ง **Compose v2** (ไม่มีขีด):

```bash
docker compose build backend
docker compose up -d
```

รอให้ build จบ — ดูว่า **`loyalcloud-backend`** ถูก **recreate** ด้วย image ใหม่

```bash
docker ps --filter name=loyalcloud-backend
```

---

### ขั้น 5 — ทดสอบว่า API ใช้โค้ดใหม่

บน VPS:

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3001/api/status
```

ควรได้ **200**

ทดสอบ public products แทน **tenantId จริง** (รหัสร้าน เช่น `shop123456`):

```bash
curl -s -o /dev/null -w "%{http_code}\n" "http://127.0.0.1:3001/api/public/products/shop123456"
```

- ถ้าร้านมีในระบบ → มักได้ **200** และ body เป็น JSON (`success`, `data`)
- ถ้า tenant ไม่มี → **404**

ผ่านโดเมน (จากเครื่องใดก็ได้):

```bash
curl -sS -i "https://api.loyalcloudcrm.com/api/public/products/<tenantId>"
```

---

### สรุปหลังทำครบ

| ขั้น | ผลลัพธ์ |
|------|----------|
| `git pull` | ได้โค้ดที่อ่านเมนู public จาก `qr_menu_products` |
| migration **012** | มีตาราง + ข้อมูลเริ่มต้นจาก sync เดิม (ถ้ามี) |
| `build` + `up` backend | process Node ใช้ logic ใหม่ |
| **หลัง sync-menu จาก POS** | แถวใน `qr_menu_products` อัปเดต — มือถือลูกค้าเห็นเมนูตรงกับร้าน |

**บน Windows (PowerShell)** ไม่รองรับ `< file` แบบ Bash — ให้รัน migration **บน Linux VPS** ตามขั้น 3 หรือใช้ `Get-Content ... | docker exec -i ...` ตามที่เคยใช้ในโปรเจกต์

---

## 1. เข้าเซิร์ฟเวอร์และดึงโค้ด

```bash
ssh root@<IP_เซิร์ฟเวอร์>
cd ~/pos_backend
git pull origin main
```

(แก้ branch ถ้าใช้ชื่ออื่น)

---

## 2. Migration (เมื่อมีไฟล์ SQL ใหม่)

รันจาก **โฟลเดอร์โปรเจกต์** — ส่ง SQL เข้า PostgreSQL ใน container

**ชื่อ container DB ใน `docker-compose.yml`:** `loyalcloud-db`

ตัวอย่าง (แก้ชื่อไฟล์ตามที่ยังไม่รัน เช่น `011` / `012`):

```bash
cd ~/pos_backend
docker exec -i loyalcloud-db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -f -' < migrations/012_qr_menu_products.sql
```

- ถ้า migration รันแล้วจะไม่ error (ใช้ `IF NOT EXISTS` ตามไฟล์)
- **`012_qr_menu_products`** — จำเป็นสำหรับเมนู QR บนมือถือ (`GET /api/public/products`) ดู [`API_PUBLIC_QR_MENU_PRODUCTS.md`](API_PUBLIC_QR_MENU_PRODUCTS.md)
- ถ้าเครื่องมีแค่ `docker-compose` (มีขีด) แต่ไม่มี `docker compose` — ใช้คำสั่ง `docker exec` แบบเดียวกันได้

---

## 3. Build และรีสตาร์ทเฉพาะ backend

```bash
cd ~/pos_backend
docker-compose build backend
docker-compose up -d
```

หรือถ้าติดตั้ง **Docker Compose plugin** แล้ว:

```bash
docker compose build backend
docker compose up -d
```

**ตาม architecture โปรเจกต์:** `git pull` → `docker-compose build backend` → `docker-compose up -d`

---

## 4. ตรวจว่า container ขึ้น

```bash
docker ps --filter name=loyalcloud
```

ควรเห็น `loyalcloud-backend` และ `loyalcloud-db` สถานะ **Up**

---

## 5. ทดสอบ API บนเครื่อง VPS

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3001/api/status
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3001/api/pos/catalog
```

- `/api/status` → ควรได้ **200**
- `/api/pos/catalog` **ไม่ส่ง token** → ควรได้ **401** (ไม่ใช่ **404** ถ้า deploy โค้ดล่าสุดแล้ว)

---

## 6. ทดสอบผ่านโดเมน (production)

```bash
curl.exe -sS --ssl-no-revoke -i "https://api.loyalcloudcrm.com/api/pos/catalog"
```

(บน Linux ใช้ `curl` ธรรมดาได้)

คาดหวัง: **401** เมื่อไม่ส่ง JWT — **ไม่ควร** ได้ **404** หรือ HTML `Cannot GET /api/pos/...`

---

## 7. เมื่อมีปัญหา

| อาการ | สิ่งที่ตรวจ |
|--------|-------------|
| ยัง **404** / **Cannot GET** | ยังไม่ `git pull` โค้ดล่าสุด / ยังไม่ `build backend` / container ยังเป็น image เก่า |
| **docker compose** ใช้ไม่ได้ | ใช้ **`docker-compose`** (มีขีด) แทน หรือติดตั้ง `docker-compose-plugin` |
| Migration error | ตรวจว่า DB ขึ้นแล้ว (`docker ps`), ชื่อ container ตรง `loyalcloud-db` |

รายละเอียดเฉพาะ **catalog endpoint** และ handoff ทีมแอป: [`DEPLOY_POS_CATALOG.md`](DEPLOY_POS_CATALOG.md)
