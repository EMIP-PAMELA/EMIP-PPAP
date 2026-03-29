-- Phase 23 - User System and Role-Based Approval Authority
-- Create ppap_users table and integrate with Supabase Auth

-- User roles enum
CREATE TYPE user_role AS ENUM ('engineer', 'qa', 'manager', 'admin');

-- Users table linked to Supabase auth
CREATE TABLE IF NOT EXISTS ppap_users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'engineer',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX idx_ppap_users_email ON ppap_users(email);
CREATE INDEX idx_ppap_users_role ON ppap_users(role);

-- RLS Policies
ALTER TABLE ppap_users ENABLE ROW LEVEL SECURITY;

-- Allow users to view all users (for assignment dropdowns, etc.)
CREATE POLICY "Users can view all users"
  ON ppap_users
  FOR SELECT
  TO authenticated
  USING (true);

-- Users can update their own record
CREATE POLICY "Users can update own profile"
  ON ppap_users
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Only admins can insert new users (via trigger or admin function)
CREATE POLICY "Admins can insert users"
  ON ppap_users
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM ppap_users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_ppap_users_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ppap_users_updated_at
  BEFORE UPDATE ON ppap_users
  FOR EACH ROW
  EXECUTE FUNCTION update_ppap_users_updated_at();

-- Function to auto-create user record when auth user is created
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO ppap_users (id, email, name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    'engineer' -- Default role
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-create ppap_users record when auth.users record is created
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- Add created_by column to ppap_document_sessions (reference to ppap_users)
ALTER TABLE ppap_document_sessions
  DROP COLUMN IF EXISTS created_by;

ALTER TABLE ppap_document_sessions
  ADD COLUMN created_by UUID REFERENCES ppap_users(id) ON DELETE SET NULL;

-- Create index for session ownership queries
CREATE INDEX idx_document_sessions_created_by ON ppap_document_sessions(created_by);

-- Update RLS policies for ppap_document_sessions to filter by user
DROP POLICY IF EXISTS "Users can view all sessions" ON ppap_document_sessions;
CREATE POLICY "Users can view own sessions and shared sessions"
  ON ppap_document_sessions
  FOR SELECT
  TO authenticated
  USING (
    created_by = auth.uid() OR
    created_by IS NULL -- Backward compatibility for sessions without owner
  );

DROP POLICY IF EXISTS "Users can insert sessions" ON ppap_document_sessions;
CREATE POLICY "Users can insert own sessions"
  ON ppap_document_sessions
  FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "Users can update sessions" ON ppap_document_sessions;
CREATE POLICY "Users can update own sessions"
  ON ppap_document_sessions
  FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid() OR created_by IS NULL)
  WITH CHECK (created_by = auth.uid() OR created_by IS NULL);

DROP POLICY IF EXISTS "Users can delete sessions" ON ppap_document_sessions;
CREATE POLICY "Users can delete own sessions"
  ON ppap_document_sessions
  FOR DELETE
  TO authenticated
  USING (created_by = auth.uid() OR created_by IS NULL);

-- Comments
COMMENT ON TABLE ppap_users IS 'Phase 23: User accounts with role-based permissions';
COMMENT ON TYPE user_role IS 'Phase 23: User roles for approval authority (engineer, qa, manager, admin)';
COMMENT ON COLUMN ppap_document_sessions.created_by IS 'Phase 23: Session owner (linked to ppap_users)';
