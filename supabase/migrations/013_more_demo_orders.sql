-- Replace demo data made untrackable by the customer_id backfill (008) with
-- real demo customers that have a known password, so the customer tracker's
-- quick-demo buttons and general testing keep working end to end.
-- Password for both demo customers: TestOrder123!
-- pgcrypto's crypt()+gen_salt('bf') produces a real bcrypt hash, compatible
-- with bcryptjs's bcrypt.compare() in the Node API routes.

INSERT INTO customers (customer_code, name, password_hash)
VALUES
  ('DEMO-001', 'Priya Sharma', extensions.crypt('TestOrder123!', extensions.gen_salt('bf'))),
  ('DEMO-002', 'Rohan Verma', extensions.crypt('TestOrder123!', extensions.gen_salt('bf')))
ON CONFLICT (customer_code) DO NOTHING;

INSERT INTO orders (order_number, customer_id, status, shipping_address, delivery_lat, delivery_lng, estimated_delivery, assigned_driver_id)
SELECT
  'ORD-2024-1007',
  (SELECT id FROM customers WHERE customer_code = 'DEMO-001'),
  'booked',
  '142, 100 Feet Road, Indiranagar, Bengaluru, Karnataka 560038',
  12.9784,
  77.6408,
  now() + interval '1 day',
  NULL
WHERE NOT EXISTS (SELECT 1 FROM orders WHERE order_number = 'ORD-2024-1007');

INSERT INTO orders (order_number, customer_id, status, shipping_address, delivery_lat, delivery_lng, estimated_delivery, assigned_driver_id)
SELECT
  'ORD-2024-1008',
  (SELECT id FROM customers WHERE customer_code = 'DEMO-002'),
  'arrived_at_hub',
  '14, Marine Drive, Mumbai, Maharashtra 400020',
  18.9432,
  72.8235,
  now() + interval '6 hours',
  (SELECT id FROM drivers WHERE username = 'arjun.mehta')
WHERE NOT EXISTS (SELECT 1 FROM orders WHERE order_number = 'ORD-2024-1008');

INSERT INTO orders (order_number, customer_id, status, shipping_address, delivery_lat, delivery_lng, estimated_delivery, assigned_driver_id)
SELECT
  'ORD-2024-1009',
  (SELECT id FROM customers WHERE customer_code = 'DEMO-001'),
  'out_for_delivery',
  '27, Connaught Place, New Delhi, Delhi 110001',
  28.6315,
  77.2167,
  now() + interval '2 hours',
  (SELECT id FROM drivers WHERE username = 'arjun.mehta')
WHERE NOT EXISTS (SELECT 1 FROM orders WHERE order_number = 'ORD-2024-1009');

INSERT INTO order_items (order_id, name, quantity)
SELECT o.id, i.name, i.qty
FROM orders o
CROSS JOIN (VALUES ('Bluetooth Speaker', 1), ('USB-C Cable', 1)) AS i(name, qty)
WHERE o.order_number = 'ORD-2024-1007'
  AND NOT EXISTS (SELECT 1 FROM order_items WHERE order_id = o.id);

INSERT INTO order_items (order_id, name, quantity)
SELECT o.id, i.name, i.qty
FROM orders o
CROSS JOIN (VALUES ('Wired Earphones', 2)) AS i(name, qty)
WHERE o.order_number = 'ORD-2024-1008'
  AND NOT EXISTS (SELECT 1 FROM order_items WHERE order_id = o.id);

INSERT INTO order_items (order_id, name, quantity)
SELECT o.id, i.name, i.qty
FROM orders o
CROSS JOIN (VALUES ('Power Bank', 1), ('Charging Cable', 1)) AS i(name, qty)
WHERE o.order_number = 'ORD-2024-1009'
  AND NOT EXISTS (SELECT 1 FROM order_items WHERE order_id = o.id);

INSERT INTO order_events (order_id, status, title, description, location_label, created_at)
SELECT o.id, 'booked'::order_status, 'Order booked', 'We received your order.', 'Online', now() - interval '1 hour'
FROM orders o
WHERE o.order_number = 'ORD-2024-1007'
  AND NOT EXISTS (SELECT 1 FROM order_events WHERE order_id = o.id);

INSERT INTO order_events (order_id, status, title, description, location_label, created_at)
SELECT o.id, e.status::order_status, e.title, e.description, e.location_label, e.created_at
FROM orders o
CROSS JOIN (VALUES
  ('booked', 'Order booked', 'We received your order.', 'Online', now() - interval '1 day'),
  ('arrived_at_hub', 'Arrived at hub', 'Package arrived at the regional hub.', 'Mumbai Hub', now() - interval '2 hours')
) AS e(status, title, description, location_label, created_at)
WHERE o.order_number = 'ORD-2024-1008'
  AND NOT EXISTS (SELECT 1 FROM order_events WHERE order_id = o.id);

INSERT INTO order_events (order_id, status, title, description, location_label, created_at)
SELECT o.id, e.status::order_status, e.title, e.description, e.location_label, e.created_at
FROM orders o
CROSS JOIN (VALUES
  ('booked', 'Order booked', 'We received your order.', 'Online', now() - interval '2 days'),
  ('arrived_at_hub', 'Arrived at hub', 'Package arrived at the regional hub.', 'Delhi Hub', now() - interval '1 day'),
  ('out_for_delivery', 'Out for delivery', 'Driver is on the way.', 'Near Connaught Place', now() - interval '30 minutes')
) AS e(status, title, description, location_label, created_at)
WHERE o.order_number = 'ORD-2024-1009'
  AND NOT EXISTS (SELECT 1 FROM order_events WHERE order_id = o.id);
