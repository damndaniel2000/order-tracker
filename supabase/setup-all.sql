-- Order tracking schema for Supabase
-- Run in Supabase SQL Editor or via CLI

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Order status enum
CREATE TYPE order_status AS ENUM (
  'pending',
  'confirmed',
  'processing',
  'shipped',
  'out_for_delivery',
  'delivered',
  'cancelled'
);

CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT NOT NULL UNIQUE,
  guest_email TEXT,
  customer_name TEXT NOT NULL,
  status order_status NOT NULL DEFAULT 'pending',
  total_cents INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'INR',
  shipping_address TEXT NOT NULL,
  delivery_lat DOUBLE PRECISION,
  delivery_lng DOUBLE PRECISION,
  estimated_delivery TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE order_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
  status order_status NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  location_label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_order_events_order_id ON order_events (order_id, created_at DESC);

CREATE TABLE delivery_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
  driver_name TEXT NOT NULL DEFAULT 'Delivery Driver',
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  heading DOUBLE PRECISION,
  speed_kmh DOUBLE PRECISION,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_delivery_locations_order_id ON delivery_locations (order_id, recorded_at DESC);

CREATE TABLE admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price_cents INTEGER NOT NULL DEFAULT 0
);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- RLS: enabled with NO public policies. All reads/writes go through the
-- Next.js API layer using the service_role key, which bypasses RLS
-- entirely. Do not add USING (true)/WITH CHECK (true) policies here --
-- those apply to the public anon key shipped in the browser bundle too.
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE admins ENABLE ROW LEVEL SECURITY;

-- ========== SEED DATA (test orders + admin) ==========
-- Password for admin@lamatic.test: TestAdmin123!

-- bcrypt hash of "TestAdmin123!" (cost 10) - generate via app or use this demo hash
INSERT INTO admins (email, password_hash, display_name)
VALUES (
  'admin@lamatic.test',
  '$2b$10$2dJ3B.nBpqE7A5TqqzskreRuZGaigEHPkpjZNAug31Fv1T260oURW',
  'Demo Admin'
)
ON CONFLICT (email) DO NOTHING;

-- Guest tracking (order number only): ORD-2024-1001, ORD-2024-1002, ORD-2024-1003

INSERT INTO orders (
  order_number, guest_email, customer_name, status, total_cents,
  shipping_address, delivery_lat, delivery_lng, estimated_delivery
) VALUES
(
  'ORD-2024-1001',
  'priya.sharma@example.com',
  'Priya Sharma',
  'out_for_delivery',
  259700,
  '142, 100 Feet Road, Indiranagar, Bengaluru, Karnataka 560038',
  12.9784,
  77.6408,
  now() + interval '2 hours'
),
(
  'ORD-2024-1002',
  'rohan.verma@example.com',
  'Rohan Verma',
  'shipped',
  539800,
  '14, Marine Drive, Mumbai, Maharashtra 400020',
  18.9432,
  72.8235,
  now() + interval '1 day'
),
(
  'ORD-2024-1003',
  'demo@guest.test',
  'Ananya Rao',
  'delivered',
  79900,
  '27, Connaught Place, New Delhi, Delhi 110001',
  28.6315,
  77.2167,
  now() - interval '1 day'
)
ON CONFLICT (order_number) DO NOTHING;

-- Order events for ORD-2024-1001
INSERT INTO order_events (order_id, status, title, description, location_label, created_at)
SELECT o.id, e.status::order_status, e.title, e.description, e.location_label, e.created_at
FROM orders o
CROSS JOIN (VALUES
  ('pending', 'Order placed', 'We received your order.', 'Online', now() - interval '3 days'),
  ('confirmed', 'Order confirmed', 'Payment verified.', 'Warehouse', now() - interval '2 days 20 hours'),
  ('processing', 'Being prepared', 'Items picked and packed.', 'Fulfillment Center', now() - interval '2 days'),
  ('shipped', 'Shipped', 'Package left our facility.', 'Bengaluru Hub', now() - interval '1 day'),
  ('out_for_delivery', 'Out for delivery', 'Driver is on the way.', 'Near Indiranagar', now() - interval '1 hour')
) AS e(status, title, description, location_label, created_at)
WHERE o.order_number = 'ORD-2024-1001';

INSERT INTO order_events (order_id, status, title, description, location_label, created_at)
SELECT o.id, e.status::order_status, e.title, e.description, e.location_label, e.created_at
FROM orders o
CROSS JOIN (VALUES
  ('pending', 'Order placed', 'We received your order.', 'Online', now() - interval '2 days'),
  ('confirmed', 'Order confirmed', NULL, 'Warehouse', now() - interval '1 day 18 hours'),
  ('shipped', 'Shipped', 'In transit to destination.', 'Regional Hub', now() - interval '6 hours')
) AS e(status, title, description, location_label, created_at)
WHERE o.order_number = 'ORD-2024-1002';

INSERT INTO order_items (order_id, name, quantity, unit_price_cents)
SELECT o.id, i.name, i.qty, i.price
FROM orders o
CROSS JOIN (VALUES
  ('Wireless Earbuds', 1, 199900),
  ('USB-C Cable', 2, 29900)
) AS i(name, qty, price)
WHERE o.order_number = 'ORD-2024-1001';

INSERT INTO order_items (order_id, name, quantity, unit_price_cents)
SELECT o.id, i.name, i.qty, i.price
FROM orders o
CROSS JOIN (VALUES
  ('Smart Watch', 1, 499900),
  ('Screen Protector', 1, 39900)
) AS i(name, qty, price)
WHERE o.order_number = 'ORD-2024-1002';

-- Delivery driver trail (OpenStreetMap coordinates near destination)
INSERT INTO delivery_locations (order_id, driver_name, lat, lng, heading, speed_kmh, recorded_at)
SELECT o.id, 'Arjun Mehta', p.lat, p.lng, p.heading, p.speed, p.recorded_at
FROM orders o
CROSS JOIN (VALUES
  (12.9850, 77.6300, 180.0, 35.0, now() - interval '45 minutes'),
  (12.9820, 77.6350, 195.0, 38.0, now() - interval '30 minutes'),
  (12.9800, 77.6380, 210.0, 32.0, now() - interval '15 minutes'),
  (12.9790, 77.6400, 225.0, 28.0, now() - interval '5 minutes')
) AS p(lat, lng, heading, speed, recorded_at)
WHERE o.order_number = 'ORD-2024-1001';

INSERT INTO delivery_locations (order_id, driver_name, lat, lng, heading, speed_kmh, recorded_at)
SELECT o.id, 'Kavya Nair', p.lat, p.lng, p.heading, p.speed, p.recorded_at
FROM orders o
CROSS JOIN (VALUES
  (18.9500, 72.8100, 90.0, 40.0, now() - interval '2 hours'),
  (18.9460, 72.8180, 95.0, 42.0, now() - interval '1 hour')
) AS p(lat, lng, heading, speed, recorded_at)
WHERE o.order_number = 'ORD-2024-1002';
