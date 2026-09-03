-- Phone number and pricing are not part of this business's data model at all.

ALTER TABLE orders DROP COLUMN customer_phone;
ALTER TABLE orders DROP COLUMN total_cents;
ALTER TABLE orders DROP COLUMN currency;
ALTER TABLE order_items DROP COLUMN unit_price_cents;
