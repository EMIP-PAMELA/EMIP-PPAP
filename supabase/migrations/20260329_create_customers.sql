-- Phase 31: Customer Profiles and Template Assignment
-- Create tables for customer management and template assignment

-- Customers table
CREATE TABLE IF NOT EXISTS ppap_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Customer template assignments
CREATE TABLE IF NOT EXISTS ppap_customer_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES ppap_customers(id) ON DELETE CASCADE,
  template_id TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes
CREATE INDEX idx_customers_name ON ppap_customers(name);
CREATE INDEX idx_customer_templates_customer_id ON ppap_customer_templates(customer_id);
CREATE INDEX idx_customer_templates_template_id ON ppap_customer_templates(template_id);

-- Prevent duplicate template assignments per customer
CREATE UNIQUE INDEX idx_customer_templates_unique ON ppap_customer_templates(customer_id, template_id);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_customer_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_customer_timestamp
  BEFORE UPDATE ON ppap_customers
  FOR EACH ROW
  EXECUTE FUNCTION update_customer_timestamp();

-- RLS Policies
ALTER TABLE ppap_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE ppap_customer_templates ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read customers
CREATE POLICY "Allow authenticated users to read customers"
  ON ppap_customers
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow admins to manage customers
CREATE POLICY "Allow admins to insert customers"
  ON ppap_customers
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM ppap_users
      WHERE ppap_users.id = auth.uid()
      AND ppap_users.role = 'admin'
    )
  );

CREATE POLICY "Allow admins to update customers"
  ON ppap_customers
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM ppap_users
      WHERE ppap_users.id = auth.uid()
      AND ppap_users.role = 'admin'
    )
  );

CREATE POLICY "Allow admins to delete customers"
  ON ppap_customers
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM ppap_users
      WHERE ppap_users.id = auth.uid()
      AND ppap_users.role = 'admin'
    )
  );

-- Allow all authenticated users to read customer template assignments
CREATE POLICY "Allow authenticated users to read customer templates"
  ON ppap_customer_templates
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow admins to manage customer template assignments
CREATE POLICY "Allow admins to insert customer templates"
  ON ppap_customer_templates
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM ppap_users
      WHERE ppap_users.id = auth.uid()
      AND ppap_users.role = 'admin'
    )
  );

CREATE POLICY "Allow admins to delete customer templates"
  ON ppap_customer_templates
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM ppap_users
      WHERE ppap_users.id = auth.uid()
      AND ppap_users.role = 'admin'
    )
  );

-- Add comments
COMMENT ON TABLE ppap_customers IS 'Customer/OEM profiles for PPAP template assignment';
COMMENT ON TABLE ppap_customer_templates IS 'Template assignments per customer';
