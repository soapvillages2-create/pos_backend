-- บรรทัดออเดอร์จาก POS แบบไม่ผูกสินค้าในแคตตาล็อก — เก็บหมายเหตุรายการ
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS note TEXT;
