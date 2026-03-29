-- Phase 24 - Document Version Control and Audit Trail
-- Create document versions table for historical tracking and immutable approved versions

-- Document versions table
CREATE TABLE IF NOT EXISTS ppap_document_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL,  -- Logical document identifier (consistent across versions)
  session_id UUID NOT NULL REFERENCES ppap_document_sessions(id) ON DELETE CASCADE,
  template_id TEXT NOT NULL,  -- e.g., 'PROCESS_FLOW', 'PFMEA', etc.
  version_number INTEGER NOT NULL,
  document_data JSONB NOT NULL,  -- Generated document content
  editable_data JSONB NOT NULL,  -- User-edited document content
  metadata JSONB,  -- DocumentMetadata (ownerId, status, approvedBy, etc.)
  created_by UUID REFERENCES ppap_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_approved BOOLEAN NOT NULL DEFAULT FALSE,
  
  -- Ensure version uniqueness per document
  UNIQUE(document_id, version_number)
);

-- Indexes for performance
CREATE INDEX idx_document_versions_document_id ON ppap_document_versions(document_id);
CREATE INDEX idx_document_versions_session_id ON ppap_document_versions(session_id);
CREATE INDEX idx_document_versions_template_id ON ppap_document_versions(template_id);
CREATE INDEX idx_document_versions_is_approved ON ppap_document_versions(is_approved);
CREATE INDEX idx_document_versions_created_at ON ppap_document_versions(created_at DESC);

-- RLS Policies
ALTER TABLE ppap_document_versions ENABLE ROW LEVEL SECURITY;

-- Users can view versions of their own sessions
CREATE POLICY "Users can view own session versions"
  ON ppap_document_versions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM ppap_document_sessions
      WHERE id = session_id
      AND (created_by = auth.uid() OR created_by IS NULL)
    )
  );

-- Users can insert versions for their own sessions
CREATE POLICY "Users can insert versions for own sessions"
  ON ppap_document_versions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM ppap_document_sessions
      WHERE id = session_id
      AND (created_by = auth.uid() OR created_by IS NULL)
    )
  );

-- Users cannot update or delete versions (immutable audit trail)
-- Updates only allowed via database triggers for approval status

-- Function to get next version number for a document
CREATE OR REPLACE FUNCTION get_next_version_number(doc_id UUID)
RETURNS INTEGER AS $$
DECLARE
  next_version INTEGER;
BEGIN
  SELECT COALESCE(MAX(version_number), 0) + 1
  INTO next_version
  FROM ppap_document_versions
  WHERE document_id = doc_id;
  
  RETURN next_version;
END;
$$ LANGUAGE plpgsql;

-- Comments
COMMENT ON TABLE ppap_document_versions IS 'Phase 24: Document version history and audit trail';
COMMENT ON COLUMN ppap_document_versions.document_id IS 'Logical document ID (consistent across versions)';
COMMENT ON COLUMN ppap_document_versions.version_number IS 'Sequential version number (1, 2, 3...)';
COMMENT ON COLUMN ppap_document_versions.is_approved IS 'Whether this version has been approved (immutable once approved)';
COMMENT ON FUNCTION get_next_version_number IS 'Phase 24: Helper function to get next version number for a document';
