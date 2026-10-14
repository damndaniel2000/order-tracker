-- The driver app used to write the name typed at drop-off into
-- receiver_name, overwriting the "Receiver Name" that came from the uploaded
-- manifest. Keep the two apart: receiver_name stays exactly what the sheet
-- said, received_by holds who actually took the parcel.
-- No backfill -- for older deliveries the sheet value was already overwritten
-- so there's no way to tell which of the two it is.

ALTER TABLE orders ADD COLUMN IF NOT EXISTS received_by TEXT;
