-- More demo orders assigned to the seeded driver, for continued testing
-- after the earlier batch was marked delivered/failed.

INSERT INTO orders (
  order_number, guest_email, customer_name, status, total_cents, currency,
  shipping_address, delivery_lat, delivery_lng, estimated_delivery, customer_phone
) VALUES
(
  'ORD-2024-1004',
  'kavita.iyer@example.com',
  'Kavita Iyer',
  'shipped',
  349900,
  'INR',
  '58, Anna Salai, Chennai, Tamil Nadu 600002',
  13.0604,
  80.2496,
  now() + interval '3 hours',
  '+91-98765-11223'
),
(
  'ORD-2024-1005',
  'suresh.reddy@example.com',
  'Suresh Reddy',
  'shipped',
  189900,
  'INR',
  '221, Banjara Hills, Hyderabad, Telangana 500034',
  17.4126,
  78.4482,
  now() + interval '4 hours',
  '+91-99887-44556'
),
(
  'ORD-2024-1006',
  'meera.joshi@example.com',
  'Meera Joshi',
  'shipped',
  249900,
  'INR',
  '12, FC Road, Pune, Maharashtra 411005',
  18.5246,
  73.8483,
  now() + interval '5 hours',
  '+91-97654-99887'
)
ON CONFLICT (order_number) DO NOTHING;

INSERT INTO order_events (order_id, status, title, description, location_label, created_at)
SELECT o.id, e.status::order_status, e.title, e.description, e.location_label, e.created_at
FROM orders o
CROSS JOIN (VALUES
  ('pending', 'Order placed', 'We received your order.', 'Online', now() - interval '2 days'),
  ('confirmed', 'Order confirmed', 'Payment verified.', 'Warehouse', now() - interval '1 day 20 hours'),
  ('processing', 'Being prepared', 'Items picked and packed.', 'Fulfillment Center', now() - interval '1 day'),
  ('shipped', 'Shipped', 'Package left our facility.', 'Chennai Hub', now() - interval '6 hours')
) AS e(status, title, description, location_label, created_at)
WHERE o.order_number = 'ORD-2024-1004';

INSERT INTO order_events (order_id, status, title, description, location_label, created_at)
SELECT o.id, e.status::order_status, e.title, e.description, e.location_label, e.created_at
FROM orders o
CROSS JOIN (VALUES
  ('pending', 'Order placed', 'We received your order.', 'Online', now() - interval '2 days'),
  ('confirmed', 'Order confirmed', 'Payment verified.', 'Warehouse', now() - interval '1 day 18 hours'),
  ('processing', 'Being prepared', 'Items picked and packed.', 'Fulfillment Center', now() - interval '1 day'),
  ('shipped', 'Shipped', 'Package left our facility.', 'Hyderabad Hub', now() - interval '5 hours')
) AS e(status, title, description, location_label, created_at)
WHERE o.order_number = 'ORD-2024-1005';

INSERT INTO order_events (order_id, status, title, description, location_label, created_at)
SELECT o.id, e.status::order_status, e.title, e.description, e.location_label, e.created_at
FROM orders o
CROSS JOIN (VALUES
  ('pending', 'Order placed', 'We received your order.', 'Online', now() - interval '1 day 12 hours'),
  ('confirmed', 'Order confirmed', 'Payment verified.', 'Warehouse', now() - interval '1 day 6 hours'),
  ('processing', 'Being prepared', 'Items picked and packed.', 'Fulfillment Center', now() - interval '18 hours'),
  ('shipped', 'Shipped', 'Package left our facility.', 'Pune Hub', now() - interval '4 hours')
) AS e(status, title, description, location_label, created_at)
WHERE o.order_number = 'ORD-2024-1006';

INSERT INTO order_items (order_id, name, quantity, unit_price_cents)
SELECT o.id, i.name, i.qty, i.price
FROM orders o
CROSS JOIN (VALUES
  ('Bluetooth Speaker', 1, 299900),
  ('USB-C Cable', 1, 49900)
) AS i(name, qty, price)
WHERE o.order_number = 'ORD-2024-1004';

INSERT INTO order_items (order_id, name, quantity, unit_price_cents)
SELECT o.id, i.name, i.qty, i.price
FROM orders o
CROSS JOIN (VALUES
  ('Wired Earphones', 2, 79900),
  ('Phone Case', 1, 29900)
) AS i(name, qty, price)
WHERE o.order_number = 'ORD-2024-1005';

INSERT INTO order_items (order_id, name, quantity, unit_price_cents)
SELECT o.id, i.name, i.qty, i.price
FROM orders o
CROSS JOIN (VALUES
  ('Power Bank', 1, 199900),
  ('Charging Cable', 1, 49900)
) AS i(name, qty, price)
WHERE o.order_number = 'ORD-2024-1006';

UPDATE orders o
SET assigned_driver_id = d.id
FROM drivers d
WHERE d.email = 'driver@likhit.test'
  AND o.order_number IN ('ORD-2024-1004', 'ORD-2024-1005', 'ORD-2024-1006')
  AND o.assigned_driver_id IS NULL;
