# คู่มือละเอียด: ตั้งค่า Nginx ให้ส่ง `/api/` ไป Node (PM2) พอร์ต 3001

## วิธีเร็ว (ไม่ต้องใช้ nano) — รันสคริปต์บน VPS

```bash
cd /root/pos_backend && git pull origin main
sudo bash scripts/nginx/install-api-proxy.sh
```

สคริปต์จะ: สร้าง `/etc/nginx/snippets/loyalcloud-api-proxy.conf` → แทรก `include` ในไฟล์ที่มี `api.loyalcloudcrm.com` → `nginx -t` → reload

ถ้าไม่มี clone repo บน VPS:

```bash
curl -fsSL -o /tmp/install-api-proxy.sh \
  https://raw.githubusercontent.com/soapvillages2-create/pos_backend/main/scripts/nginx/install-api-proxy.sh
sudo bash /tmp/install-api-proxy.sh
```

(สคริปต์จะสร้าง snippet ใน `/etc/nginx/snippets/` เองถ้ายังไม่มี)

---

ใช้เมื่อ:
- รัน backend ด้วย **PM2** ที่ `127.0.0.1:3001`
- โดเมน **`https://api.loyalcloudcrm.com`** ชี้มาที่ VPS นี้
- อาการ: `curl http://127.0.0.1:3001/api/...` **ใช้ได้** แต่ `curl https://api.loyalcloudcrm.com/api/...` ได้ **404** หรือ HTML `Cannot POST`

---

## ส่วน A — เตรียมก่อนแก้ nginx

### A1) เข้า VPS ด้วย SSH

จากเครื่อง Windows (PowerShell หรือ Terminal):

```text
ssh root@<IP_VPS>
```

(ใช้ IP หรือโดเมนที่คุณใช้จริง)

### A2) ตรวจว่า Node ฟังพอร์ต 3001 อยู่

```bash
ss -tlnp | grep 3001
```

ควรเห็นบรรทัดประมาณ `LISTEN ... 0.0.0.0:3001`

### A3) ตรวจว่า API ตรงพอร์ตทำงาน (ไม่ผ่าน nginx)

```bash
curl -s http://127.0.0.1:3001/api/status
```

ควรได้ JSON ประมาณ `"status":"success"` หรือข้อความว่า backend ทำงาน

```bash
curl -s -X POST http://127.0.0.1:3001/api/pos/staff-sync \
  -H "Content-Type: application/json" \
  -d '{"staff":[]}'
```

ควรได้ **JSON** (เช่น `ไม่พบ Token`) — **ไม่ใช่** HTML `Cannot POST`

ถ้าขั้น A3 ไม่ผ่าน ให้แก้ PM2 / โค้ดใน `/var/www/pos_backend` ก่อน อย่าไปแก้ nginx

---

## ส่วน B — หาไฟล์ config ของ Nginx ที่แก้ได้

### B1) ดูว่า nginx โหลดไฟล์จากไหนบ้าง

```bash
sudo nginx -T 2>/dev/null | grep -E "configuration file|# configuration file"
```

มักจะเห็น `/etc/nginx/nginx.conf` และไฟล์ใน `sites-enabled` / `conf.d`

### B2) หาไฟล์ที่มีโดเมน API

```bash
sudo grep -r "api.loyalcloudcrm.com" /etc/nginx/ 2>/dev/null
```

จด **path ไฟล์** ที่ขึ้นมา (เช่น `/etc/nginx/sites-available/xxx` หรือ `conf.d/xxx.conf`)

ถ้าไม่เจอชื่อโดเมน ลอง:

```bash
sudo grep -r "listen.*443" /etc/nginx/ 2>/dev/null
```

แล้วเปิดไฟล์ที่น่าจะเป็นเว็บหลักของเซิร์ฟเวอร์

### B3) สำรองไฟล์ก่อนแก้ (แนะนำ)

แทน `PATH_ไฟล์` ด้วย path จริงที่เจอจาก B2:

```bash
sudo cp PATH_ไฟล์ PATH_ไฟล์.bak.$(date +%Y%m%d)
```

---

## ส่วน C — แก้ไฟล์ด้วย nano (ทำทีละบรรทัด)

### C1) เปิดไฟล์

```bash
sudo nano PATH_ไฟล์
```

### C2) หา `server {` ที่รับ HTTPS

- มองหา `listen 443` หรือ `listen 443 ssl`
- ใน block เดียวกันควรมี `server_name` ที่มี `api.loyalcloudcrm.com` (หรือ `_` ถ้า default server)

### C3) ใส่หรือแก้ `location /api/`

**กฎสำคัญ**
- ถ้ามีทั้ง `location /api/` และ `location /` ให้ **`location /api/` อยู่เหนือ / ก่อน** (ข้างบนในไฟล์) เพื่อให้ `/api/...` ไม่ถูก `location /` กลืน
- `proxy_pass` ต้องเป็น **`http://127.0.0.1:3001`** ถ้า PM2 ใช้พอร์ต 3001 (ตรวจจาก `.env` `PORT=...`)

**บล็อกที่แนะนำ** (วาง **ภายใน** `server { ... }` เดียวกับ 443):

```nginx
    client_max_body_size 20m;

    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
```

ถ้ามี `client_max_body_size` อยู่แล้วใน `http { }` หรือ `server { }` — ไม่ต้องใส่ซ้ำถ้าไม่ต้องการ (แต่ `20m` ช่วยกัน error 413 ตอน body ใหญ่)

### C4) ถ้าเดิมมี `location / { proxy_pass http://127.0.0.1:XXXX; }`

- ถ้า `XXXX` ไม่ใช่ 3001 และคุณย้ายมาใช้ PM2 ที่ 3001 แล้ว — แก้ให้ตรงกัน **หรือ** ให้เฉพาะ `/api/` ไป 3001 และ path อื่นไปที่อื่นตามที่ออกแบบไว้
- แบบทั่วไปสำหรับ API เดียว: ให้ **`location /api/`** ไป **3001** ชัดเจน

### C5) บันทึกใน nano

- กด **Ctrl+O** → Enter (บันทึก)
- กด **Ctrl+X** (ออก)

---

## ส่วน D — ตรวจ syntax และ reload

```bash
sudo nginx -t
```

- ขึ้น `syntax is ok` และ `test is successful` ถึงจะ reload ได้

```bash
sudo nginx -s reload
```

ถ้า `nginx -t` error:
- อ่านบรรทัดที่ nginx บอก (มักเป็นวงเล็บ `}` ไม่ครบ หรือ `;` หลุด)
- แก้แล้วรัน `sudo nginx -t` ใหม่  
- หรือคืนค่า: `sudo cp PATH_ไฟล์.bak.วันที่ PATH_ไฟล์`

---

## ส่วน E — ทดสอบหลังแก้

### E1) จาก VPS

```bash
curl -s -X POST https://api.loyalcloudcrm.com/api/pos/staff-sync \
  -H "Content-Type: application/json" \
  -d '{"staff":[]}'
```

คาดหวัง: ข้อความ JSON (เช่น `ไม่พบ Token`) — **ไม่ใช่** `<!DOCTYPE html>...Cannot POST`

### E2) จาก Windows (PowerShell)

```powershell
curl.exe -s -X POST "https://api.loyalcloudcrm.com/api/pos/staff-sync" -H "Content-Type: application/json" -d "{\"staff\":[]}"
```

### E3) ในแอป Flutter

- Hot restart แล้วไป **Staff Management** → **Save** พนักงาน  
- ดู log ว่ามี `[StaffSync] pushed` ไม่มี `404`

---

## ส่วน F — ปัญหาที่พบบ่อย

| อาการ | สาเหตุที่เป็นไปได้ |
|--------|---------------------|
| `nginx -t` บอก unexpected `}` | วงเล็บ `server`/`location` ไม่ครบ — เทียบกับไฟล์ `.bak` |
| ยัง 404 ทาง HTTPS | `proxy_pass` ยังชี้พอร์ตผิด / แก้ไฟล์ผิด server block / ยังไม่ reload |
| 502 Bad Gateway | Node ไม่รันที่พอร์ตนั้น — `pm2 status`, `ss -tlnp` |
| 413 Request Entity Too Large | เพิ่ม `client_max_body_size 20m;` ใน `server` หรือ `http` |

---

## ส่วน G — หลังอัปเดตโค้ด backend

โค้ดอยู่ที่ `/root/pos_backend` (git) แต่ PM2 มักรันจาก `/var/www/pos_backend`:

```bash
cd /root/pos_backend && git pull origin main
rsync -av --exclude node_modules --exclude .git --exclude .env /root/pos_backend/ /var/www/pos_backend/
cd /var/www/pos_backend && npm install --production
pm2 restart all
```

รายละเอียดอื่นดู `DEPLOY_VPS.md` ใน repo เดียวกัน
