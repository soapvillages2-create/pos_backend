# Loyalcloud CRM — Backend API (Production-oriented)
# Path context: รากโปรเจกต์ pos_backend (มี package.json, server.js)

# -----------------------------------------------------------------------------
# Stage: ติดตั้ง dependencies (production only)
# bcrypt อาจต้อง compile บน Alpine — ติดตั้ง toolchain ชั่วคราวในสเตจนี้
# -----------------------------------------------------------------------------
FROM node:20-alpine AS deps
WORKDIR /app

RUN apk add --no-cache python3 make g++

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# -----------------------------------------------------------------------------
# Stage: รันแอป
# -----------------------------------------------------------------------------
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# wget สำหรับ HEALTHCHECK (image node:alpine ไม่รวมไว้โดยค่าเริ่มต้น)
RUN apk add --no-cache wget

# รันแอปด้วย user ไม่ใช่ root
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001 -G nodejs

COPY --from=deps /app/node_modules ./node_modules
COPY --chown=nodejs:nodejs . .

USER nodejs

# PORT กำหนดจาก environment ตอนรัน (docker-compose ใช้ 3001)
EXPOSE 3001

# ต้องสอดคล้องกับ PORT ใน docker-compose / .env (ค่าเริ่มต้น 3001)
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3001/api/status || exit 1

CMD ["node", "server.js"]
