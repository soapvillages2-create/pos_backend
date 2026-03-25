# คู่มือ Deploy pos_backend บน VPS (Ubuntu 24.04)

## ข้อมูล VPS ของคุณ
- **IP:** 77.237.236.96
- **OS:** Ubuntu 24.04
- **Node.js & PostgreSQL:** ติดตั้งแล้ว

---

## ขั้นตอนที่ 1: SSH เข้า VPS

```bash
ssh root@77.237.236.96
# หรือใช้ user อื่นถ้ามี
```

---

## ขั้นตอนที่ 2: สร้าง Database บน VPS

```bash
sudo -u postgres psql -c "CREATE DATABASE loyalcloud_db;"
sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'รหัสผ่านที่แข็งแรง';"
```

> เปลี่ยน `รหัสผ่านที่แข็งแรง` เป็นรหัสที่คุณจะใช้ (เก็บไว้ใส่ใน .env)

---

## ขั้นตอนที่ 3: อัปโหลดโปรเจกต์ไปยัง VPS

### วิธีที่ 1: ใช้ Git (แนะนำ ถ้ามี repo)

```bash
cd /var/www  # หรือโฟลเดอร์ที่คุณใช้
git clone <URL_REPO ของคุณ> pos_backend
cd pos_backend
```

### วิธีที่ 2: ใช้ SCP จากเครื่องคุณ (Windows PowerShell)

```powershell
scp -r "c:\Users\HP\OneDrive\Documents\pos_backend" root@77.237.236.96:/var/www/
```

### วิธีที่ 3: ใช้ rsync (จากเครื่อง Linux/Mac)

```bash
rsync -avz --exclude node_modules --exclude .env ./pos_backend root@77.237.236.96:/var/www/
```

---

## ขั้นตอนที่ 4: ตั้งค่าบน VPS

```bash
cd /var/www/pos_backend

# ติดตั้ง dependencies
npm install --production

# สร้างไฟล์ .env
cp .env.production.example .env
nano .env
```

แก้ไขค่าใน `.env`:
```
PORT=3001
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=รหัสผ่านที่ตั้งในขั้นตอน 2
DB_NAME=loyalcloud_db
JWT_SECRET=สร้างรหัสยาวๆ เช่นใช้คำสั่ง openssl rand -hex 32
NODE_ENV=production
```

สร้าง JWT_SECRET:
```bash
openssl rand -hex 32
```
นำค่าที่ได้ไปใส่ใน JWT_SECRET

---

## ขั้นตอนที่ 5: รัน Migrations

```bash
# รันทีละไฟล์ (ตามลำดับ)
sudo -u postgres psql -d loyalcloud_db -f migrations/001_create_tenants_and_users.sql
sudo -u postgres psql -d loyalcloud_db -f migrations/002_add_province_country_terms.sql
sudo -u postgres psql -d loyalcloud_db -f migrations/003_create_products.sql
sudo -u postgres psql -d loyalcloud_db -f migrations/004_create_orders.sql
sudo -u postgres psql -d loyalcloud_db -f migrations/005_create_customers.sql
sudo -u postgres psql -d loyalcloud_db -f migrations/006_add_table_number_to_orders.sql
```

---

## ขั้นตอนที่ 6: ติดตั้ง PM2 และรัน Backend

```bash
# ติดตั้ง PM2 (ถ้ายังไม่มี)
npm install -g pm2

# รันแอป
pm2 start ecosystem.config.cjs

# บันทึกให้รันทุกครั้งที่ reboot
pm2 save
pm2 startup
```

---

## ขั้นตอนที่ 7: เปิด Firewall (ถ้ามีใช้ UFW)

```bash
ufw allow 3001/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
```

---

## ขั้นตอนที่ 8: ทดสอบ

จากเครื่องคุณ เปิดเบราว์เซอร์:
```
http://77.237.236.96:3001/api/status
```

ควรเห็น:
```json
{"status":"success","message":"Backend ของ Loyalcloud CRM ทำงานปกติแล้ว!"}
```

---

## API Base URL สำหรับ POS / CRM

หลังจาก deploy สำเร็จ ให้ใช้:
```
http://77.237.236.96:3001
```
หรือถ้ามี domain ชี้มาที่ IP:
```
https://api.yourdomain.com
```

---

## คำสั่ง PM2 ที่ใช้บ่อย

| คำสั่ง | ความหมาย |
|--------|----------|
| `pm2 status` | ดูสถานะแอป |
| `pm2 logs pos-backend` | ดู log |
| `pm2 restart pos-backend` | รีสตาร์ท |
| `pm2 stop pos-backend` | หยุด |
| `pm2 start pos-backend` | เริ่ม |

---

## (Optional) ตั้งค่า Nginx + SSL

ถ้าต้องการใช้ domain และ HTTPS:
1. ชี้ domain ไปที่ IP 77.237.236.96
2. ติดตั้ง Nginx + Certbot
3. ตั้งค่า reverse proxy ชี้ไปที่ port 3001

บอกได้ถ้าต้องการขั้นตอนละเอียดสำหรับส่วนนี้
