---
description: Deploy SKIBKK to VPS with aaPanel + PostgreSQL + Nginx
---

# Deploy SKIBKK to VPS (aaPanel)

## Prerequisites ✅
- aaPanel installed
- Nginx installed
- PostgreSQL Manager installed
- Node.js version manager installed (v20)
- PM2 installed globally (`npm install -g pm2`)

---

## Step 1: สร้าง PostgreSQL Database

เข้า **aaPanel → PostgreSQL Manager → Add Database**:
- **Database name**: `skibkk`
- **Username**: `skibkk`
- **Password**: ตั้งรหัสที่ปลอดภัย (จดไว้!)

---

## Step 2: สร้างเว็บไซต์ใน aaPanel

เข้า **aaPanel → Website → Add Site**:
- **Domain**: `skibkk.com` (หรือ domain ที่ใช้)
- **PHP Version**: Static (ไม่ต้องใช้ PHP)
- **Database**: None (สร้างแล้วใน Step 1)

---

## Step 3: Clone โปรเจค

```bash
cd /www/wwwroot/skibkk.com
rm -rf .htaccess 404.html index.html
git clone https://github.com/YOUR_USERNAME/skibkk.git .
```

> ⚠️ เปลี่ยน `YOUR_USERNAME` เป็น GitHub username จริง

---

## Step 4: สร้างไฟล์ .env

```bash
cd /www/wwwroot/skibkk.com
nano .env
```

ใส่ค่าดังนี้ (เปลี่ยน password ตามที่ตั้งใน Step 1):

```env
# PostgreSQL (Local)
DATABASE_URL="postgresql://skibkk:YOUR_DB_PASSWORD@localhost:5432/skibkk"

# SMTP - Gmail
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=ae1nt14@gmail.com
SMTP_PASS=pxdpfsgtsewlqqgx
SMTP_FROM="SKIBKK" <ae1nt14@gmail.com>

# JWT
JWT_SECRET=skibkk-jwt-secret-2026-production

# Cron
CRON_SECRET=skibkk-cron-2026

# Production
NODE_ENV=production
AUTO_VERIFY_PAYMENTS=false
```

**บันทึก**: Ctrl+O → Enter → Ctrl+X

---

## Step 5: ติดตั้ง dependencies + build

```bash
cd /www/wwwroot/skibkk.com
npm install
npx prisma db push
npm run build
```

---

## Step 6: Seed ข้อมูลเริ่มต้น

```bash
# Start temporarily to run seed
npm start &
sleep 5
curl http://localhost:3000/api/seed?action=seed
kill %1
```

---

## Step 7: เริ่ม app ด้วย PM2

```bash
cd /www/wwwroot/skibkk.com
pm2 start npm --name "skibkk" -- start
pm2 save
pm2 startup
```

---

## Step 8: ตั้ง Nginx Reverse Proxy

เข้า **aaPanel → Website → skibkk.com → Reverse Proxy → Add**:
- **Proxy Name**: `skibkk`
- **Target URL**: `http://127.0.0.1:3000`
- **Send Domain**: `$host`

หรือแก้ Nginx config ตรงๆ (**Website → skibkk.com → Config**):

```nginx
location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_cache_bypass $http_upgrade;
}
```

---

## Step 9: ติด SSL (Let's Encrypt)

เข้า **aaPanel → Website → skibkk.com → SSL → Let's Encrypt** → กด Apply

---

## Step 10: ตั้ง Cron Job (Optional)

เข้า **aaPanel → Cron → Add Cron**:
- **Task Type**: Shell Script
- **Schedule**: ทุกวัน เวลา 08:00
- **Script**:
```bash
curl -s https://skibkk.com/api/cron/reminders?secret=skibkk-cron-2026
```

---

## การอัพเดท (ภายหลัง)

```bash
cd /www/wwwroot/skibkk.com
git pull
npm install
npx prisma db push
npm run build
pm2 restart skibkk
```
