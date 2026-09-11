-- Manifests will now carry a driver mobile-number column. Phone is a much
-- more reliable match than a hand-typed first name, so try it first; fall
-- back to the existing username/display_name match for sheets that don't
-- have a phone column (keeps older uploads working unchanged). Numbers are
-- compared by their last 10 digits so formatting differences (+91, dashes,
-- spaces) between what's on the sheet and what's stored on the driver don't
-- break the match.
-- Signature changed (new p_driver_phone param), so drop + recreate rather
-- than CREATE OR REPLACE.

DROP FUNCTION IF EXISTS create_uploaded_order(
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, TEXT
);

CREATE FUNCTION create_uploaded_order(
  p_order_number TEXT,
  p_customer_code TEXT,
  p_customer_name TEXT,
  p_password_hash TEXT,
  p_shipping_address TEXT,
  p_pincode TEXT,
  p_city TEXT,
  p_receiver_name TEXT,
  p_consignee_name TEXT,
  p_pickup_at TIMESTAMPTZ,
  p_driver_username TEXT,
  p_driver_phone TEXT
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

  IF p_password_hash IS NOT NULL THEN
    INSERT INTO customers (customer_code, name, password_hash)
    VALUES (p_customer_code, p_customer_name, p_password_hash)
    ON CONFLICT (customer_code) DO NOTHING
    RETURNING id INTO v_customer_id;
  END IF;

  IF v_customer_id IS NOT NULL THEN
    v_is_new_customer := true;
  ELSE
    SELECT id INTO v_customer_id FROM customers WHERE customer_code = p_customer_code;
  END IF;

  IF v_customer_id IS NULL THEN
    RAISE EXCEPTION 'Customer "%" does not exist and no password was generated for it.', p_customer_code;
  END IF;

  IF p_driver_phone IS NOT NULL AND btrim(p_driver_phone) <> '' THEN
    SELECT id INTO v_driver_id FROM drivers
    WHERE is_active
      AND phone IS NOT NULL
      AND right(regexp_replace(phone, '\D', '', 'g'), 10) =
          right(regexp_replace(p_driver_phone, '\D', '', 'g'), 10);
  END IF;

  IF v_driver_id IS NULL AND p_driver_username IS NOT NULL AND btrim(p_driver_username) <> '' THEN
    SELECT id INTO v_driver_id FROM drivers
    WHERE is_active
      AND (username = lower(btrim(p_driver_username))
           OR lower(display_name) = lower(btrim(p_driver_username)));
  END IF;

  IF v_driver_id IS NULL
     AND ((p_driver_phone IS NOT NULL AND btrim(p_driver_phone) <> '')
          OR (p_driver_username IS NOT NULL AND btrim(p_driver_username) <> '')) THEN
    v_driver_warning := format(
      'Driver "%s" not found or inactive; order left unassigned.',
      COALESCE(NULLIF(btrim(p_driver_username), ''), p_driver_phone)
    );
  END IF;

  IF p_order_number IS NOT NULL AND btrim(p_order_number) <> '' THEN
    v_order_number := btrim(p_order_number);
  ELSE
    v_order_number := 'ORD-' || to_char(now(), 'YYYY') || '-' ||
      lpad(nextval('order_number_seq')::text, 4, '0');
  END IF;

  INSERT INTO orders (
    order_number, customer_id, shipping_address, status, assigned_driver_id,
    pincode, city, receiver_name, consignee_name, pickup_at
  )
  VALUES (
    v_order_number, v_customer_id, p_shipping_address, 'booked', v_driver_id,
    p_pincode, p_city, p_receiver_name, p_consignee_name, p_pickup_at
  )
  RETURNING id INTO v_order_id;

  INSERT INTO order_items (order_id, name, quantity)
  VALUES (v_order_id, 'Package', 1);

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

REVOKE EXECUTE ON FUNCTION create_uploaded_order(
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, TEXT, TEXT
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_uploaded_order(
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, TEXT, TEXT
) TO service_role;
