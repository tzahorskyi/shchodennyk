ALTER TABLE schedule_versions ADD COLUMN effective_until TEXT;

CREATE INDEX idx_schedule_versions_period
  ON schedule_versions(effective_from, effective_until);
