-- Phase 30.1: Dynamic Template Persistence
-- Create table for storing uploaded dynamic PPAP templates

CREATE TABLE IF NOT EXISTS ppap_dynamic_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  template_json JSONB NOT NULL,
  uploaded_by UUID REFERENCES ppap_users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true
);

-- Add indexes
CREATE INDEX idx_dynamic_templates_template_id ON ppap_dynamic_templates(template_id);
CREATE INDEX idx_dynamic_templates_is_active ON ppap_dynamic_templates(is_active);
CREATE INDEX idx_dynamic_templates_uploaded_by ON ppap_dynamic_templates(uploaded_by);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_dynamic_template_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_dynamic_template_timestamp
  BEFORE UPDATE ON ppap_dynamic_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_dynamic_template_timestamp();

-- RLS Policies
ALTER TABLE ppap_dynamic_templates ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read active templates
CREATE POLICY "Allow authenticated users to read active templates"
  ON ppap_dynamic_templates
  FOR SELECT
  TO authenticated
  USING (is_active = true);

-- Allow admins to insert templates
CREATE POLICY "Allow admins to insert templates"
  ON ppap_dynamic_templates
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM ppap_users
      WHERE ppap_users.id = auth.uid()
      AND ppap_users.role = 'admin'
    )
  );

-- Allow admins to update templates
CREATE POLICY "Allow admins to update templates"
  ON ppap_dynamic_templates
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM ppap_users
      WHERE ppap_users.id = auth.uid()
      AND ppap_users.role = 'admin'
    )
  );

-- Allow admins to delete templates (soft delete via is_active)
CREATE POLICY "Allow admins to delete templates"
  ON ppap_dynamic_templates
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM ppap_users
      WHERE ppap_users.id = auth.uid()
      AND ppap_users.role = 'admin'
    )
  );

-- Add comment
COMMENT ON TABLE ppap_dynamic_templates IS 'Stores dynamically uploaded PPAP document templates (e.g., OEM-specific workbooks)';
