-- Localize demo data to India (currency, addresses, phone numbers, coordinates)

ALTER TABLE orders ALTER COLUMN currency SET DEFAULT 'INR';

UPDATE orders SET
  customer_name = 'Priya Sharma',
  guest_email = 'priya.sharma@example.com',
  total_cents = 259700,
  currency = 'INR',
  shipping_address = '142, 100 Feet Road, Indiranagar, Bengaluru, Karnataka 560038',
  delivery_lat = 12.9784,
  delivery_lng = 77.6408,
  customer_phone = '+91-98450-12345'
WHERE order_number = 'ORD-2024-1001';

UPDATE orders SET
  customer_name = 'Rohan Verma',
  guest_email = 'rohan.verma@example.com',
  total_cents = 539800,
  currency = 'INR',
  shipping_address = '14, Marine Drive, Mumbai, Maharashtra 400020',
  delivery_lat = 18.9432,
  delivery_lng = 72.8235,
  customer_phone = '+91-99870-65432'
WHERE order_number = 'ORD-2024-1002';

UPDATE orders SET
  customer_name = 'Ananya Rao',
  total_cents = 79900,
  currency = 'INR',
  shipping_address = '27, Connaught Place, New Delhi, Delhi 110001',
  delivery_lat = 28.6315,
  delivery_lng = 77.2167,
  customer_phone = '+91-97110-98765'
WHERE order_number = 'ORD-2024-1003';

UPDATE order_items i SET unit_price_cents = 199900
FROM orders o WHERE i.order_id = o.id AND o.order_number = 'ORD-2024-1001' AND i.name = 'Wireless Earbuds';
UPDATE order_items i SET unit_price_cents = 29900
FROM orders o WHERE i.order_id = o.id AND o.order_number = 'ORD-2024-1001' AND i.name = 'USB-C Cable';
UPDATE order_items i SET unit_price_cents = 499900
FROM orders o WHERE i.order_id = o.id AND o.order_number = 'ORD-2024-1002' AND i.name = 'Smart Watch';
UPDATE order_items i SET unit_price_cents = 39900
FROM orders o WHERE i.order_id = o.id AND o.order_number = 'ORD-2024-1002' AND i.name = 'Screen Protector';

UPDATE drivers SET display_name = 'Arjun Mehta', phone = '+91-98765-43210'
WHERE email = 'driver@lamatic.test';

DELETE FROM delivery_locations
WHERE order_id IN (SELECT id FROM orders WHERE order_number IN ('ORD-2024-1001', 'ORD-2024-1002'));
