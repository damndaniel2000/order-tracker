-- "DEF YES / NO" on the manifest: whether the driver collected the
-- defective unit when delivering the replacement. Recorded by the driver at
-- drop-off; NULL means not recorded (failed deliveries, older app versions).

ALTER TABLE orders ADD COLUMN IF NOT EXISTS defective_collected BOOLEAN;
