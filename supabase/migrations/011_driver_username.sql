-- Driver login switches from email to username entirely. Email stays as an
-- optional contact field but is no longer used for authentication.

ALTER TABLE drivers ADD COLUMN username TEXT;

UPDATE drivers SET username = 'arjun.mehta'
WHERE email = 'driver@likhit.test' AND username IS NULL;

-- Safety net for any other driver rows that might exist.
UPDATE drivers SET username = lower(split_part(email, '@', 1))
WHERE username IS NULL AND email IS NOT NULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM drivers WHERE username IS NULL) THEN
    RAISE EXCEPTION 'driver username backfill incomplete -- aborting';
  END IF;
END $$;

ALTER TABLE drivers ALTER COLUMN username SET NOT NULL;
ALTER TABLE drivers ADD CONSTRAINT drivers_username_key UNIQUE (username);
ALTER TABLE drivers ALTER COLUMN email DROP NOT NULL;
