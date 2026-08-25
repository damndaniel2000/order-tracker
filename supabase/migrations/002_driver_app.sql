-- Driver app schema (run after 001_schema.sql)
-- Adds drivers, phone/assignment/POD fields, failed status, delivery_attempts

-- Add failed to order_status enum
DO $$ BEGIN
  ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'failed';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Drivers
CREATE TABLE IF NOT EXISTS drivers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL,
  phone TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Service read drivers" ON drivers FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Service insert drivers" ON drivers FOR INSERT WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Extend orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_phone TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS assigned_driver_id UUID REFERENCES drivers (id) ON DELETE SET NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_remarks TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS proof_photo_url TEXT;

CREATE INDEX IF NOT EXISTS idx_orders_assigned_driver ON orders (assigned_driver_id, status);

-- Delivery attempts audit
CREATE TABLE IF NOT EXISTS delivery_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
  driver_id UUID NOT NULL REFERENCES drivers (id) ON DELETE CASCADE,
  outcome TEXT NOT NULL CHECK (outcome IN ('delivered', 'failed')),
  remarks TEXT,
  photo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_delivery_attempts_order ON delivery_attempts (order_id, created_at DESC);

ALTER TABLE delivery_attempts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Public read attempts" ON delivery_attempts FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Service insert attempts" ON delivery_attempts FOR INSERT WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Seed demo driver: driver@lamatic.test / TestDriver123!
INSERT INTO drivers (email, password_hash, display_name, phone)
VALUES (
  'driver@lamatic.test',
  '$2b$10$eZ2jDRCkmEA3.ZFDokTmje2ecx1P0DzuUDyC7uNTRpk2vheFm0tAm',
  'Arjun Mehta',
  '+91-98765-43210'
)
ON CONFLICT (email) DO NOTHING;

-- Phones + assign active orders to demo driver
UPDATE orders SET customer_phone = '+91-98450-12345'
WHERE order_number = 'ORD-2024-1001' AND customer_phone IS NULL;

UPDATE orders SET customer_phone = '+91-99870-65432'
WHERE order_number = 'ORD-2024-1002' AND customer_phone IS NULL;

UPDATE orders SET customer_phone = '+91-97110-98765'
WHERE order_number = 'ORD-2024-1003' AND customer_phone IS NULL;

UPDATE orders o
SET assigned_driver_id = d.id
FROM drivers d
WHERE d.email = 'driver@lamatic.test'
  AND o.order_number IN ('ORD-2024-1001', 'ORD-2024-1002')
  AND o.assigned_driver_id IS NULL;
