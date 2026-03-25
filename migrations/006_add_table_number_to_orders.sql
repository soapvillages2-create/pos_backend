-- Migration: เพิ่ม table_number สำหรับ QR Order
ALTER TABLE orders ADD COLUMN IF NOT EXISTS table_number VARCHAR(20);
