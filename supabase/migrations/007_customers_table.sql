-- Real customer accounts: persistent password per customer (not per order),
-- recognized across repeat orders via an admin-assigned customer_code.
-- Locked down like every other table -- no policies, service_role only,
-- matching the deny-by-default convention from 003_lockdown_rls.sql.

CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER customers_updated_at
  BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
