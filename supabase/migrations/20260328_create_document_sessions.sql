-- Phase 22 - Backend Persistence for Document Engine
-- Replace localStorage with database-backed storage for document sessions

-- Table 1: Document Sessions
-- Stores session metadata and links to PPAP records (nullable for standalone mode)
CREATE TABLE IF NOT EXISTS ppap_document_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  ppap_id UUID REFERENCES ppap(id) ON DELETE CASCADE,
  created_by TEXT,  -- Placeholder for Phase 23 (user system integration)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Ensure unique session names within a PPAP context
  UNIQUE(ppap_id, name)
);

-- Table 2: Generated Documents
-- Stores document drafts, edits, validation results, and metadata
CREATE TABLE IF NOT EXISTS ppap_generated_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES ppap_document_sessions(id) ON DELETE CASCADE,
  template_id TEXT NOT NULL,
  document_data JSONB NOT NULL,      -- Generated document content
  editable_data JSONB NOT NULL,      -- User edits to document
  validation_results JSONB,          -- Validation errors and status
  metadata JSONB,                    -- Owner + status (Phase 20)
  timestamps JSONB,                  -- Document generation timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Ensure one document per template per session
  UNIQUE(session_id, template_id)
);

-- Table 3: Session State
-- Stores session-level state (BOM data, active step)
CREATE TABLE IF NOT EXISTS ppap_session_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES ppap_document_sessions(id) ON DELETE CASCADE,
  bom_data JSONB,                    -- Normalized BOM data
  active_step TEXT,                  -- Current active template
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- One state record per session
  UNIQUE(session_id)
);

-- Indexes for performance
CREATE INDEX idx_document_sessions_ppap_id ON ppap_document_sessions(ppap_id);
CREATE INDEX idx_generated_documents_session_id ON ppap_generated_documents(session_id);
CREATE INDEX idx_session_state_session_id ON ppap_session_state(session_id);

-- RLS Policies
ALTER TABLE ppap_document_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ppap_generated_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE ppap_session_state ENABLE ROW LEVEL SECURITY;

-- Sessions: Allow authenticated users to view and modify all sessions
CREATE POLICY "Users can view all sessions"
  ON ppap_document_sessions
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert sessions"
  ON ppap_document_sessions
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update sessions"
  ON ppap_document_sessions
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete sessions"
  ON ppap_document_sessions
  FOR DELETE
  TO authenticated
  USING (true);

-- Generated Documents: Allow authenticated users to view and modify all documents
CREATE POLICY "Users can view all generated documents"
  ON ppap_generated_documents
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert generated documents"
  ON ppap_generated_documents
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update generated documents"
  ON ppap_generated_documents
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete generated documents"
  ON ppap_generated_documents
  FOR DELETE
  TO authenticated
  USING (true);

-- Session State: Allow authenticated users to view and modify all session state
CREATE POLICY "Users can view all session state"
  ON ppap_session_state
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert session state"
  ON ppap_session_state
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update session state"
  ON ppap_session_state
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete session state"
  ON ppap_session_state
  FOR DELETE
  TO authenticated
  USING (true);

-- Updated_at triggers
CREATE OR REPLACE FUNCTION update_document_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER document_sessions_updated_at
  BEFORE UPDATE ON ppap_document_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_document_sessions_updated_at();

CREATE OR REPLACE FUNCTION update_generated_documents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER generated_documents_updated_at
  BEFORE UPDATE ON ppap_generated_documents
  FOR EACH ROW
  EXECUTE FUNCTION update_generated_documents_updated_at();

CREATE OR REPLACE FUNCTION update_session_state_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER session_state_updated_at
  BEFORE UPDATE ON ppap_session_state
  FOR EACH ROW
  EXECUTE FUNCTION update_session_state_updated_at();

-- Comments
COMMENT ON TABLE ppap_document_sessions IS 'Phase 22: Document Engine session metadata (replaces localStorage)';
COMMENT ON TABLE ppap_generated_documents IS 'Phase 22: Generated document drafts, edits, and validation results';
COMMENT ON TABLE ppap_session_state IS 'Phase 22: Session-level state (BOM data, active step)';
