-- V3.3A.8: Create PPAP Activities table for user-posted feed entries
-- System events remain in ppap_events, user posts go here

CREATE TABLE ppap_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ppap_id UUID NOT NULL REFERENCES ppap_records(id) ON DELETE CASCADE,
  
  -- Activity details
  activity_type VARCHAR(50) NOT NULL CHECK (activity_type IN ('note', 'issue', 'update')),
  priority VARCHAR(20) DEFAULT 'normal' CHECK (priority IN ('normal', 'issue', 'risk')),
  message TEXT NOT NULL,
  
  -- User info (who posted)
  user_id VARCHAR(255),
  user_name VARCHAR(255),
  user_role VARCHAR(50),
  
  -- Optional metadata
  metadata JSONB,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT valid_activity_type CHECK (activity_type IN ('note', 'issue', 'update'))
);

-- Indexes for performance
CREATE INDEX idx_ppap_activities_ppap_id ON ppap_activities(ppap_id);
CREATE INDEX idx_ppap_activities_created_at ON ppap_activities(created_at DESC);
CREATE INDEX idx_ppap_activities_priority ON ppap_activities(priority);

-- RLS policies
ALTER TABLE ppap_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all authenticated users to read ppap_activities"
  ON ppap_activities FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow all authenticated users to insert ppap_activities"
  ON ppap_activities FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Comments
COMMENT ON TABLE ppap_activities IS 'V3.3A.8: User-posted activity feed entries (notes, issues, updates). System events remain in ppap_events.';
COMMENT ON COLUMN ppap_activities.activity_type IS 'Type of user post: note (comment), issue (flagged problem), update (status update)';
COMMENT ON COLUMN ppap_activities.priority IS 'Priority level: normal, issue (warning), risk (critical)';
