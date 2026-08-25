-- Security fix: the original policies in 001/002 used USING (true) with no
-- role restriction, which Postgres applies to PUBLIC — including the anon
-- key that ships in the browser bundle. That made every table (including
-- drivers/admins password hashes) readable, and orders writable, directly
-- via the Supabase REST API, completely bypassing the Next.js API layer.
--
-- All real read/write access in this app goes through Next.js API routes
-- using the service_role key, which bypasses RLS entirely regardless of
-- policies. So these tables need zero public policies — RLS stays enabled
-- with no matching policy, which denies anon/authenticated by default.

DROP POLICY IF EXISTS "Public read orders" ON orders;
DROP POLICY IF EXISTS "Public read events" ON order_events;
DROP POLICY IF EXISTS "Public read locations" ON delivery_locations;
DROP POLICY IF EXISTS "Public read items" ON order_items;
DROP POLICY IF EXISTS "Public read delivery_locations realtime" ON delivery_locations;
DROP POLICY IF EXISTS "Service update orders" ON orders;
DROP POLICY IF EXISTS "Service insert orders" ON orders;
DROP POLICY IF EXISTS "Service insert events" ON order_events;
DROP POLICY IF EXISTS "Service insert locations" ON delivery_locations;
DROP POLICY IF EXISTS "Service read admins" ON admins;
DROP POLICY IF EXISTS "Service read drivers" ON drivers;
DROP POLICY IF EXISTS "Service insert drivers" ON drivers;
DROP POLICY IF EXISTS "Public read attempts" ON delivery_attempts;
DROP POLICY IF EXISTS "Service insert attempts" ON delivery_attempts;
