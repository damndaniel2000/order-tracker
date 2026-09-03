-- Support for bulk order creation via spreadsheet upload:
-- auto-generated order numbers, and an atomic per-row creation function
-- (customer upsert + driver lookup + order + items + initial event).

CREATE SEQUENCE order_number_seq;
SELECT setval(
  'order_number_seq',
  GREATEST(
    (SELECT COALESCE(MAX((regexp_match(order_number, '(\d+)$'))[1]::int), 1000) FROM orders),
    1000
  )
);

-- p_items is a JSONB array like [{"name": "Bluetooth Speaker", "quantity": 1}].
-- p_password_hash is only used if this call ends up creating a NEW customer
-- (decided by the ON CONFLICT DO NOTHING below, not by the caller's belief
-- about whether the customer_code already existed -- this is what makes
-- concurrent uploads of the same new code race-safe).
CREATE OR REPLACE FUNCTION create_uploaded_order(
  p_customer_code TEXT,
  p_customer_name TEXT,
  p_password_hash TEXT,
  p_shipping_address TEXT,
  p_items JSONB,
  p_driver_username TEXT
) RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_customer_id UUID;
  v_is_new_customer BOOLEAN := false;
  v_driver_id UUID;
  v_driver_warning TEXT;
  v_order_id UUID;
  v_order_number TEXT;
BEGIN
  IF p_customer_code IS NULL OR btrim(p_customer_code) = '' THEN
    RAISE EXCEPTION 'customer_code is required';
  END IF;
  IF p_shipping_address IS NULL OR btrim(p_shipping_address) = '' THEN
    RAISE EXCEPTION 'shipping_address is required';
  END IF;
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'at least one item is required';
  END IF;

  INSERT INTO customers (customer_code, name, password_hash)
  VALUES (p_customer_code, p_customer_name, p_password_hash)
  ON CONFLICT (customer_code) DO NOTHING
  RETURNING id INTO v_customer_id;

  IF v_customer_id IS NOT NULL THEN
    v_is_new_customer := true;
  ELSE
    SELECT id INTO v_customer_id FROM customers WHERE customer_code = p_customer_code;
  END IF;

  IF p_driver_username IS NOT NULL AND btrim(p_driver_username) <> '' THEN
    SELECT id INTO v_driver_id FROM drivers
    WHERE username = lower(btrim(p_driver_username)) AND is_active;
    IF v_driver_id IS NULL THEN
      v_driver_warning := format('Driver username "%s" not found or inactive; order left unassigned.', p_driver_username);
    END IF;
  END IF;

  v_order_number := 'ORD-' || to_char(now(), 'YYYY') || '-' ||
    lpad(nextval('order_number_seq')::text, 4, '0');

  INSERT INTO orders (order_number, customer_id, shipping_address, status, assigned_driver_id)
  VALUES (v_order_number, v_customer_id, p_shipping_address, 'booked', v_driver_id)
  RETURNING id INTO v_order_id;

  INSERT INTO order_items (order_id, name, quantity)
  SELECT v_order_id, item ->> 'name', GREATEST((item ->> 'quantity')::int, 1)
  FROM jsonb_array_elements(p_items) AS item;

  INSERT INTO order_events (order_id, status, title, description)
  VALUES (v_order_id, 'booked', 'Order booked', 'Created via bulk upload.');

  RETURN jsonb_build_object(
    'order_id', v_order_id,
    'order_number', v_order_number,
    'customer_id', v_customer_id,
    'is_new_customer', v_is_new_customer,
    'driver_warning', v_driver_warning
  );
END;
$$;

-- CRITICAL: without this, the function is callable via PostgREST RPC by
-- anon/authenticated keys shipped in the browser bundle, bypassing admin
-- auth entirely -- this app already had one real anon-key exposure
-- incident, so this lockdown is not optional.
REVOKE EXECUTE ON FUNCTION create_uploaded_order(TEXT, TEXT, TEXT, TEXT, JSONB, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_uploaded_order(TEXT, TEXT, TEXT, TEXT, JSONB, TEXT) TO service_role;
