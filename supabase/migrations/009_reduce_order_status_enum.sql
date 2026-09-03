-- Collapse pending/confirmed/processing -> booked, shipped -> arrived_at_hub,
-- failed -> undelivered. Postgres can't drop/reorder enum values in place,
-- so recreate the type and re-point both columns that use it via a
-- CASE-based USING clause, remapping existing row data (not just new rows).

CREATE TYPE order_status_new AS ENUM (
  'booked',
  'arrived_at_hub',
  'out_for_delivery',
  'delivered',
  'undelivered',
  'cancelled'
);

ALTER TABLE orders ALTER COLUMN status DROP DEFAULT;

ALTER TABLE orders
  ALTER COLUMN status TYPE order_status_new
  USING (
    CASE status::text
      WHEN 'pending' THEN 'booked'
      WHEN 'confirmed' THEN 'booked'
      WHEN 'processing' THEN 'booked'
      WHEN 'shipped' THEN 'arrived_at_hub'
      WHEN 'out_for_delivery' THEN 'out_for_delivery'
      WHEN 'delivered' THEN 'delivered'
      WHEN 'failed' THEN 'undelivered'
      WHEN 'cancelled' THEN 'cancelled'
    END
  )::order_status_new;

ALTER TABLE orders ALTER COLUMN status SET DEFAULT 'booked';

ALTER TABLE order_events
  ALTER COLUMN status TYPE order_status_new
  USING (
    CASE status::text
      WHEN 'pending' THEN 'booked'
      WHEN 'confirmed' THEN 'booked'
      WHEN 'processing' THEN 'booked'
      WHEN 'shipped' THEN 'arrived_at_hub'
      WHEN 'out_for_delivery' THEN 'out_for_delivery'
      WHEN 'delivered' THEN 'delivered'
      WHEN 'failed' THEN 'undelivered'
      WHEN 'cancelled' THEN 'cancelled'
    END
  )::order_status_new;

DROP TYPE order_status;
ALTER TYPE order_status_new RENAME TO order_status;
