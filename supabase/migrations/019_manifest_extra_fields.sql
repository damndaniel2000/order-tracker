-- The real manifest also carries Ref No., ODA Y/N and Chargable Weight.
-- Store them so the delivery report can be downloaded in exactly the same
-- layout the admin uploads. (No. Of Boxes goes into order_items.quantity,
-- which already exists.)
-- oda is kept as the sheet's own text ("YES"/"NO") so it round-trips as-is.

ALTER TABLE orders ADD COLUMN IF NOT EXISTS ref_no TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS oda TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS chargeable_weight NUMERIC;
