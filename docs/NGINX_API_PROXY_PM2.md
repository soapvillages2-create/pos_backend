# Nginx → Node (PM2) ที่พอร์ต 3001

ใช้เมื่อรัน backend ด้วย **PM2** ที่ `127.0.0.1:3001` และโดเมน **`https://api.loyalcloudcrm.com`** ต้องส่ง `/api/*` ไปที่ Node ให้ตรง

ถ้า `curl http://127.0.0.1:3001/api/pos/staff-sync` ได้ **401** แต่ `curl https://api.loyalcloudcrm.com/...` ได้ **404** = ปัญหาอยู่ที่ nginx (ชี้พอร์ตผิด หรือไม่มี `location /api/`)

---

## ขั้น 1 — หาไฟล์ config ที่ใช้จริง

```bash
sudo nginx -T 2>/dev/null | grep -E "server_name|listen 443" | head -40
```

หรือ:

```bash
sudo grep -r "api.loyalcloudcrm.com" /etc/nginx/
```

จด path ไฟล์ที่มี `server_name api.loyalcloudcrm.com` และ `listen 443`

---

## ขั้น 2 — แก้ใน `server { ... }` ของ HTTPS (443)

เปิดไฟล์ด้วย `nano` หรือ `vim` (แทนพาธด้วยของจริง):

```bash
sudo nano /etc/nginx/sites-available/default
```

**ต้องมี** บล็อกนี้ (หรือแก้ `proxy_pass` เดิมให้เป็น **3001**):

```nginx
    # ขนาด body (กัน 413 ตอน sync-menu ใหญ่)
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

**อย่า** ให้ `location /api/` ชี้ไปพอร์ตอื่น (เช่น 3000) ถ้า PM2 รันที่ 3001

ถ้ามี `location / { proxy_pass ... }` อยู่แล้ว — ให้ใส่ **`location /api/` ก่อน** `location /` (nginx เลือก location ที่เฉพาะเจาะจงก่อน)

---

## ขั้น 3 — รีโหลด nginx

```bash
sudo nginx -t
sudo nginx -s reload
```

ถ้า `nginx -t` error แก้ syntax ในไฟล์ก่อน

---

## ขั้น 4 — ทดสอบ

จาก VPS:

```bash
curl -s -X POST https://api.loyalcloudcrm.com/api/pos/staff-sync \
  -H "Content-Type: application/json" \
  -d '{"staff":[]}'
```

คาดหวัง JSON แบบ **ไม่พบ Token** — ไม่ใช่ HTML `Cannot POST`

จาก Windows:

```powershell
curl.exe -s -X POST "https://api.loyalcloudcrm.com/api/pos/staff-sync" -H "Content-Type: application/json" -d "{\"staff\":[]}"
```

---

## หมายเหตุ

- **Backend ทำแก้ nginx แทนคุณไม่ได้** — ต้องมีสิทธิ์ root บน VPS
- หลัง deploy โค้ดใหม่: `git pull` ที่ `/root/pos_backend` แล้ว **rsync → `/var/www/pos_backend`** + `pm2 restart` (ดู `DEPLOY_VPS.md`)
