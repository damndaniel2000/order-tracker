-- Link orders to customers. Existing orders have no customer_code, so we
-- create one synthetic "LEGACY-000N" customer per existing order, carrying
-- customer_name over into customers.name (preserves admin-facing history),
-- with a password nobody knows (bcrypt hash of a random value via pgcrypto).
-- These legacy orders become non-trackable by customers after this
-- migration -- acceptable, since no password was ever issued for them to
-- begin with (they used the old order-number + email lookup).

ALTER TABLE orders ADD COLUMN customer_id UUID REFERENCES customers (id);

WITH numbered AS (
  SELECT id AS order_id, customer_name,
         row_number() OVER (ORDER BY created_at) AS rn
  FROM orders
),
inserted AS (
  INSERT INTO customers (customer_code, name, password_hash)
  SELECT
    'LEGACY-' || lpad(rn::text, 4, '0'),
    customer_name,
    extensions.crypt(gen_random_uuid()::text, extensions.gen_salt('bf'))
  FROM numbered
  RETURNING id, customer_code
)
UPDATE orders o
SET customer_id = i.id
FROM numbered n
JOIN inserted i ON i.customer_code = 'LEGACY-' || lpad(n.rn::text, 4, '0')
WHERE o.id = n.order_id;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM orders WHERE customer_id IS NULL) THEN
    RAISE EXCEPTION 'customer_id backfill incomplete -- aborting';
  END IF;
END $$;

ALTER TABLE orders ALTER COLUMN customer_id SET NOT NULL;
CREATE INDEX idx_orders_customer_id ON orders (customer_id);

ALTER TABLE orders DROP COLUMN customer_name;
ALTER TABLE orders DROP COLUMN guest_email;
