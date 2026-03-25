# คู่มือ Deploy Loyalcloud CRM (Phase 1) — Contabo VPS + Docker + Nginx

เอกสารนี้สรุปขั้นตอนที่ต้องทำบน **Ubuntu** (VPS Contabo) เพื่อรัน **Backend (Node.js + Express + Socket.io)** และ **PostgreSQL** ภายใต้ **Docker Compose** โดยมี **Nginx** เป็น reverse proxy ที่โดเมน **`api.loyalcloudcrm.com`**

> **ข้อควรระวัง (โปรดักต์ขายจริง):** ห้าม commit ไฟล์ `.env` ขึ้น Git — ใช้รหัสผ่านยาวและสุ่ม, เปิด HTTPS ก่อนเปิดให้ลูกค้าใช้งานจริง, และวางแผนสำรองข้อมูลฐานข้อมูล

---

## 1. สิ่งที่คุณต้องมีก่อนเริ่ม

| รายการ | รายละเอียด |
|--------|-------------|
| VPS | Ubuntu 22.04 LTS (แนะนำ) หรือ 24.04 |
| DNS | สร้าง **A record** ชื่อ `api` ชี้ไปที่ **Public IP** ของ VPS |
| โดเมน | `api.loyalcloudcrm.com` ชี้ IP ถูกต้อง (ทดสอบด้วย `ping` หรือ `dig`) |
| โค้ด | โฟลเดอร์ `pos_backend` บนเครื่อง VPS (git clone / scp / zip) |

---

## 2. โครงสร้างโปรเจกต์ที่เกี่ยวข้อง (สำหรับอ้างอิง path)

รากโปรเจกต์ backend มีไฟล์หลักดังนี้ (ใช้เป็น **build context** ของ Docker):

```
pos_backend/
├── server.js              # entry point
├── package.json
├── package-lock.json
├── Dockerfile
├── docker-compose.yml
├── nginx/
│   ├── nginx.conf         # reverse proxy → backend:3001 + WebSocket
│   └── ssl.conf.example   # ตัวอย่าง HTTPS หลังมีใบรับรอง
├── migrations/
│   └── run_all.sql        # รวม migration (หรือรันทีละไฟล์ตามลำดับ)
├── .env.docker.example    # แม่แบบ environment
└── DEPLOYMENT_GUIDE.md    # เอกสารนี้
```

แอป Flutter (`pos_crm_app`) อยู่คนละโฟลเดอร์ — หลัง API ขึ้นแล้วให้ตั้ง **`API_BASE_URL=https://api.loyalcloudcrm.com`** (หรือ `http://` ช่วงทดสอบก่อนมี SSL)

---

## 3. อัปเดตระบบและติดตั้งแพ็กเกจพื้นฐาน

รันด้วย user ที่มีสิทธิ์ `sudo`:

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y ca-certificates curl gnupg git ufw
```

---

## 4. ติดตั้ง Docker Engine + Docker Compose plugin

แนวทางตามเอกสารทางการของ Docker (เวอร์ชันล่าสุดให้ดูที่ [docs.docker.com](https://docs.docker.com/engine/install/ubuntu/)) — โครงสร้างคำสั่งโดยทั่วไป:

```bash
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker "$USER"
```

ออกจาก SSH แล้วเข้าใหม่ (หรือ `newgrp docker`) เพื่อให้กลุ่ม `docker` มีผล

ทดสอบ:

```bash
docker compose version
docker run --rm hello-world
```

---

## 5. Firewall (UFW)

เปิดเฉพาะพอร์ตที่จำเป็น:

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status verbose
```

> **หมายเหตุ:** อย่าเปิดพอร์ต PostgreSQL (5432) ออกอินเทอร์เน็ต — ให้เข้าถึงได้เฉพาะภายใน Docker network

---

## 6. เตรียมไฟล์ environment บน VPS

ในโฟลเดอร์โปรเจกต์ `pos_backend`:

```bash
cd /path/to/pos_backend
cp .env.docker.example .env
nano .env   # หรือ editor อื่น
```

- ตั้ง **`DB_USER`**, **`DB_PASSWORD`**, **`DB_NAME`**, **`JWT_SECRET`** ให้เป็นค่าจริงและไม่ซ้ำกับ dev
- ตั้ง **`FRONTEND_URL`** เป็น `https://api.loyalcloudcrm.com` (หลังมี SSL) หรือ `http://...` ช่วงทดสอบชั่วคราว
- กรอก **`EMAIL_USER`** / **`EMAIL_APP_PASSWORD`** ถ้าใช้ลืมรหัสผ่าน

ไฟล์ `.env` ถูกอ้างอิงจาก `docker-compose.yml` ผ่าน `env_file` — **ไม่มีการ hardcode รหัสผ่านใน compose**

---

## 7. รัน Docker Compose

```bash
cd /path/to/pos_backend
docker compose up -d --build
docker compose ps
docker compose logs -f backend
```

ทดสอบจากเครื่องคุณ (หรือบน VPS):

```bash
curl -sS http://api.loyalcloudcrm.com/api/status
```

ถ้า DNS ยังไม่ชี้ ให้ทดสอบด้วย IP:

```bash
curl -sS -H "Host: api.loyalcloudcrm.com" http://YOUR_VPS_IP/api/status
```

---

## 8. Migration ฐานข้อมูล (ครั้งแรกหลัง DB ว่าง)

รันจากโฟลเดอร์โปรเจกต์ โดยส่งไฟล์ SQL เข้า container `db` (ชื่อ service ใน `docker-compose.yml`):

```bash
cd /path/to/pos_backend
set -a && source .env && set +a
docker compose exec -T db psql -U "$DB_USER" -d "$DB_NAME" < migrations/run_all.sql
```

ถ้า `run_all.sql` ไม่เหมาะกับ DB ที่มีข้อมูลอยู่แล้ว ให้สำรองก่อน แล้วปรับตาม migration แยกไฟล์ตามลำดับในโฟลเดอร์ `migrations/`

---

## 9. Let's Encrypt (HTTPS) — แนวทางที่สอดคล้องกับไฟล์ที่เตรียมไว้

1. ให้แน่ใจว่า **พอร์ต 80** เปิด และ **`api.loyalcloudcrm.com`** ชี้มาที่ VPS แล้ว
2. รัน **certbot** แบบ **webroot** โดยใช้ volume เดียวกับ Nginx (`/var/www/certbot`)

หลัง `docker compose up -d` แล้ว (Nginx เปิดพอร์ต 80 และชี้โดเมนถูกต้อง) รันคำสั่งนี้จากโฟลเดอร์โปรเจกต์ — service `certbot` ใช้ profile `cert` เพื่อไม่ให้รันคู่กับ stack หลักโดยไม่ตั้งใจ:

```bash
cd /path/to/pos_backend
docker compose --profile cert run --rm certbot certonly \
  --webroot -w /var/www/certbot \
  -d api.loyalcloudcrm.com \
  --email YOUR_EMAIL@example.com \
  --agree-tos \
  --non-interactive
```

> หมายเหตุ: ถ้าได้ error เรื่อง webroot ให้ตรวจว่า Nginx ยังรันอยู่ และ path `/.well-known/acme-challenge/` ตรงกับ volume `certbot-www` ตาม `docker-compose.yml`

หลังได้ใบรับรองแล้ว:

1. แก้ `nginx/nginx.conf` โดยเพิ่มบล็อก `listen 443 ssl` ตาม **`nginx/ssl.conf.example`**
2. ตรวจ path ไฟล์ใน `/etc/letsencrypt/live/api.loyalcloudcrm.com/`
3. Reload Nginx:

```bash
docker compose exec nginx nginx -t
docker compose exec nginx nginx -s reload
```

4. (แนะนำ) ตั้ง **renew** (cron หรือ systemd timer) ตามเอกสาร certbot

---

## 10. Socket.io / WebSocket

ไฟล์ `nginx/nginx.conf` ตั้งค่า:

- `Upgrade` / `Connection` สำหรับ WebSocket
- `proxy_read_timeout` / `proxy_send_timeout` ยาวสำหรับ long polling

แอปฝั่ง client ควรเชื่อมต่อไปที่ **`https://api.loyalcloudcrm.com`** (path มาตรฐานของ Socket.io คือ `/socket.io/`)

---

## 11. คำสั่งที่ใช้บ่อย

| งาน | คำสั่ง |
|-----|--------|
| ดู log | `docker compose logs -f backend` / `nginx` / `db` |
| รีสตาร์ท backend | `docker compose restart backend` |
| อัปเดตโค้ด | `git pull` แล้ว `docker compose up -d --build` |
| สำรอง DB | `docker compose exec db pg_dump -U "$DB_USER" "$DB_NAME" > backup.sql` |

---

## 12. Checklist ก่อนเปิดให้ลูกค้าใช้จริง

- [ ] HTTPS เปิดใช้งาน และ HTTP redirect ไป HTTPS (ถ้าตั้งค่าแล้ว)
- [ ] `.env` บน VPS ไม่ถูก commit และรหัสผ่านแข็งแรง
- [ ] `JWT_SECRET` ไม่ซ้ำกับเครื่อง dev
- [ ] มีแผนสำรองและทดสอบ restore ฐานข้อมูล
- [ ] ทบทวน CORS / โดเมนที่อนุญาตใน `server.js` ให้เหมาะกับ production (ปัจจุบันอาจเปิดกว้าง — ควรปรับตามช่องทางลูกค้า)

---

## 13. สร้างบัญชี Admin คนแรก (สคริปต์ — รหัสผ่านผ่าน bcrypt)

ระบบมี API `POST /api/auth/register` สำหรับสมัครแบบปกติอยู่แล้ว — ถ้าต้องการสร้างจากเซิร์ฟเวอร์โดยไม่เปิดแอป ให้ใช้สคริปต์ `scripts/create-admin.js`

1. บน VPS ในโฟลเดอร์โปรเจกต์ ตั้งค่าใน `.env` (ชั่วคราว) แล้วรันในคอนเทนเนอร์ backend:

```bash
cd /root/pos_backend
# เพิ่มใน .env ชั่วคราวแล้วบันทึก (อย่า commit):
# ADMIN_EMAIL=admin@yourdomain.com
# ADMIN_PASSWORD=รหัสที่อย่างน้อย_6_ตัว
# ADMIN_STORE_NAME=ร้านตัวอย่าง
# ADMIN_PROVINCE=กรุงเทพมหานคร
# ADMIN_COUNTRY=ประเทศไทย

docker compose exec backend npm run create-admin
```

หรือส่งค่าแบบไม่เขียนลงไฟล์:

```bash
docker compose exec -e ADMIN_EMAIL=admin@example.com -e ADMIN_PASSWORD='YourPass123' \
  backend npm run create-admin
```

หลังใช้งานแล้ว **ลบบรรทัด `ADMIN_*` ออกจาก `.env`** หรือหมุนรหัสผ่านใหม่ตามนโยบายความปลอดภัย

---

## 14. อัปเดตโค้ดบน VPS (ไม่มี CI/CD)

แนวทางพื้นฐานที่เสถียรสำหรับทีมเล็ก:

1. แก้โค้ดบนเครื่อง dev → commit → push ไป Git remote (GitHub/GitLab/private)
2. SSH เข้า VPS → `cd /root/pos_backend` → `git pull`
3. `docker compose up -d --build` และทดสอบ `https://api.loyalcloudcrm.com/api/status`

ถ้าไม่ใช้ Git บน VPS: ใช้ `scp` / rsync / SFTP อัปโหลดโฟลเดอร์แทน แล้ว `docker compose up -d --build` เหมือนกัน

---

## 15. CI/CD (อัตโนมัติเมื่อ push) — แนวทางที่ใช้งานกับ Contabo ได้

| แนวทาง | เหมาะกับ | หมายเหตุ |
|--------|-----------|----------|
| **GitHub Actions** | โค้ดอยู่ GitHub | Workflow: SSH เข้า VPS รัน `git pull && docker compose up -d --build` — เก็บ SSH key ใน Secrets |
| **GitLab CI** | โค้ดอยู่ GitLab | ใช้ `deploy` script คล้ายกัน + SSH key ใน CI/CD variables |
| **Webhook** | ทุก Git | ติดตั้ง webhook บน VPS รับ POST จาก GitHub/GitLab แล้วรันสคริปต์ deploy (ต้องยืนยันตัวตนและล็อกให้แคบ) |
| **Watchtower** | อัปเดตเฉพาะ image จาก registry | ต้อง build image แล้ว push ไป Docker Hub / GHCR → Watchtower ดึง image ใหม่ |

สำหรับ Phase นี้ **แนะนำเริ่มจาก Git pull + compose แบบมือ** ก่อน แล้วค่อยเพิ่ม GitHub Actions แบบ deploy ทีละ branch (เช่น `main`) เมื่อ flow นิ่งแล้ว

ตัวอย่างแนวคิด GitHub Actions (ไม่ใส่ใน repo ให้โดยอัตโนมัติ — ต้องปรับ host, user, path):

```yaml
# .github/workflows/deploy.yml (ตัวอย่าง)
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: ssh-agent@v1
      - name: Deploy
        run: ssh -o StrictHostKeyChecking=no user@YOUR_VPS_IP 'cd /root/pos_backend && git pull && docker compose up -d --build'
```

> **ความปลอดภัย:** ใช้ SSH key เฉพาะ deploy, จำกัด IP ใน `sshd` หรือ VPN ถ้าทำได้

---

## 16. กับดักรหัสผ่าน (bcrypt) — ห้าม INSERT รหัส plain text ลง DB

ระบบใช้ **bcrypt** เก็บ `password_hash` ในตาราง `users` — การ login จะ `bcrypt.compare(รหัสที่พิมพ์, password_hash)` กับค่าในฐานข้อมูล

| สิ่งที่ทำ | ผลลัพธ์ |
|----------|---------|
| `INSERT` รหัสเป็น `123456` แบบ plain text | **Login ไม่ผ่าน** เพราะไม่ตรงรูปแบบ hash |
| สมัครผ่าน API `POST /api/auth/register` | ถูกต้อง — backend hash ให้อัตโนมัติ |
| สคริปต์ `npm run create-admin` | ถูกต้อง — ใช้ `bcrypt.hash` ก่อนบันทึก |

**สรุป:** อย่าแก้ผู้ใช้ด้วย SQL ดิบ — ใช้ API สมัครหรือสคริปต์ `scripts/create-admin.js` เท่านั้น

---

## 17. CORS (Cross-Origin Resource Sharing)

ใน `server.js` มี **`app.use(cors())`** อยู่แล้ว — ค่าเริ่มต้น **อนุญาตทุก origin** (เหมาะกับแอป **Desktop / mobile native** ที่ยิง HTTPS ไปที่ API)

- **Flutter Web** หรือเว็บที่โหลดจากโดเมนอื่น อาจต้องจำกัด/ระบุ origin ชัดเจน — ตั้งใน `.env`:

```env
CORS_ORIGIN=https://app.loyalcloudcrm.com,https://loyalcloudcrm.com
```

(คั่นหลาย URL ด้วย comma — ไม่มีช่องว่างหลัง comma ก็ได้) แล้ว `docker compose restart backend`

ถ้า **ไม่ตั้ง** `CORS_ORIGIN` พฤติกรรมเดิมคือเปิดกว้าง — **Socket.io** จะใช้รายการเดียวกันเมื่อมีการตั้งค่า

---

## 18. ดู Log แบบ Real-time (เวลาแอปฟ้อง Error / ต่อ API ไม่ติด)

รันจากโฟลเดอร์โปรเจกต์บน VPS (ที่มี `docker-compose.yml`):

```bash
cd /root/pos_backend
docker compose logs -f backend
```

- **Compose V2 (แนะนำ):** `docker compose` (มีช่องว่าง)
- รุ่นเก่า: `docker-compose logs -f backend` (มีขีด)

กด **Ctrl+C** เพื่อหยุดติดตาม log (ไม่หยุด container)

ดู log บริการอื่น: `docker compose logs -f nginx` หรือ `db`

---

## 19. ต่ออายุ SSL (Let's Encrypt ~90 วัน) กับ Docker

ใบรับรองหมดอายุทุก ~90 วัน — ถ้า Nginx ใน Docker ยึดพอร์ต 80/443 การ `certbot renew` บน host อาจชนกับ container

**แนวทางที่เสถียร**

1. **ทดสอบ renew แบบ dry-run** (ไม่เปลี่ยนใบจริง):

   ```bash
   docker compose --profile cert run --rm certbot renew --dry-run
   ```

2. **ถ้า renew จริงสำเร็จ** — reload Nginx ให้โหลดไฟล์ใบใหม่:

   ```bash
   docker compose exec nginx nginx -s reload
   ```

**ถ้า renew ล้มเหลว** (พอร์ต / webroot ไม่ตรงรูปแบบที่ certbot คาด):

- ลำดับที่มักใช้กู้ชั่วคราว: `docker compose down` → รัน certbot (standalone หรือ webroot ตามที่ตั้งค่าใหม่) → `docker compose up -d`  
- หรือแก้คำสั่ง renew ให้ใช้ **webroot เดียวกับ** `nginx` (`/var/www/certbot`) ตาม `docker-compose.yml`

**ตั้ง cron บน VPS (ตัวอย่าง — ทุกวันจันทร์ 03:30)**

```cron
30 3 * * 1 cd /root/pos_backend && docker compose --profile cert run --rm certbot renew --quiet && docker compose exec nginx nginx -s reload
```

ตรวจว่า path โฟลเดอร์โปรเจกต์ตรงกับเครื่องจริง (`crontab -e`)

**อาการ “กุญแจหาย” ในเบราว์เซอร์** — มักหมายถึงใบหมดอายุหรือ chain ไม่ครบ — ตรวจสอบ `certbot certificates` (ใน container หรือบน host ตามที่ติดตั้ง) แล้ว renew ตามขั้นตอนด้านบน

---

## 20. สำรอง DB + ทดสอบ Restore (PostgreSQL ใน Docker)

ไฟล์สคริปต์อยู่ที่ `scripts/backup-db.sh` และ `scripts/restore-db.sh` — รันบน **VPS (Linux)** จากโฟลเดอร์โปรเจกต์ (เช่น `/root/pos_backend`)

### 20.1 สำรอง (backup)

```bash
cd /root/pos_backend
chmod +x scripts/backup-db.sh scripts/restore-db.sh
./scripts/backup-db.sh
```

- ไฟล์จะอยู่ที่ `backups/loyalcloud_db_YYYYMMDD_HHMMSS.sql.gz`
- ใช้ `pg_dump` ใน container `db` พร้อม `--clean --if-exists` เพื่อให้ restore ทับ schema ได้สมเหตุสมผล
- ลบไฟล์เก่าอัตโนมัติ (ค่าเริ่มต้น **7 วัน**) — ปรับด้วย `RETENTION_DAYS=14 ./scripts/backup-db.sh` หรือ `RETENTION_DAYS=0` เพื่อไม่ลบ

**เก็บสำรองนอกเครื่อง:** คัดลอกไฟล์ `.sql.gz` ไปเครื่องอื่น / object storage / OneDrive เป็นประจำ — ถ้า VPS พังทั้งกล่อง แต่มีไฟล์สำรองอยู่นอกเครื่อง ธุรกิจยังกู้ได้

### 20.2 ทดสอบ restore (บนเครื่องทดสอบหรือหลังสำรองล่าสุด)

> **คำเตือน:** `restore-db.sh` จะ **เขียนทับ** ฐานข้อมูล `POSTGRES_DB` ชุดเดียวกับที่ production ใช้ — ทดสอบบน **VPS แยก / snapshot / DB ชื่ออื่น** จะปลอดภัยกว่า ถ้าเป็นไปได้

ขั้นตอนทดสอบแบบ “จริงจังแต่ควบคุมได้”:

1. สำรองก่อนเสมอ: `./scripts/backup-db.sh`
2. รัน restore จากไฟล์ที่เพิ่งสำรอง (ต้องพิมพ์ `YES` ยืนยัน):

   ```bash
   ./scripts/restore-db.sh backups/loyalcloud_db_20260324_120000.sql.gz
   ```

3. สคริปต์จะ **หยุด `backend` ชั่วคราว** → restore → **สตาร์ท `backend` ใหม่**
4. ทดสอบแอป: ล็อกอิน / ข้อมูลตัวอย่าง

ถ้า restore สำเร็จและแอปใช้ได้ แปลว่าไฟล์สำรองใช้กู้คืนจริงได้

### 20.3 ตั้ง cron สำรองอัตโนมัติ (ตัวอย่าง — ทุกวัน 02:15)

```cron
15 2 * * * cd /root/pos_backend && /usr/bin/env RETENTION_DAYS=14 bash /root/pos_backend/scripts/backup-db.sh >> /var/log/loyalcloud-backup.log 2>&1
```

ตรวจ log: `tail -f /var/log/loyalcloud-backup.log`

---

หากต้องการ Phase ถัดไป (monitoring, หลาย instance + Redis สำหรับ Socket.io) สามารถแยกออกเป็นเอกสารเฉพาะได้
