-- New fields needed to match the real courier-manifest upload format:
-- consignee company ("To"), receiver name, pincode/city as their own
-- filterable fields (not folded into the free-text address), and the
-- pickup date/time read off the manifest.

ALTER TABLE orders
  ADD COLUMN consignee_name TEXT,
  ADD COLUMN receiver_name TEXT,
  ADD COLUMN pincode TEXT,
  ADD COLUMN city TEXT,
  ADD COLUMN pickup_at TIMESTAMPTZ;
