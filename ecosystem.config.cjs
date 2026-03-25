/**
 * PM2 Configuration - สำหรับ Deploy บน VPS
 * รัน: pm2 start ecosystem.config.cjs
 */
module.exports = {
  apps: [{
    name: 'pos-backend',
    script: 'server.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '300M',
    env: {
      NODE_ENV: 'production',
    },
  }],
};
