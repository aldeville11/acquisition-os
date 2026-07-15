/** Sprint 3 — AuditEvent foundation (ADR 0009). Separate from domain_events. */
export const MIGRATION_002_SPRINT3_AUDIT = `
CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY,
  action TEXT NOT NULL,
  actor_user_id TEXT,
  organization_id TEXT,
  workspace_id TEXT,
  resource_type TEXT,
  resource_id TEXT,
  permission TEXT,
  outcome TEXT NOT NULL CHECK (outcome IN ('success', 'failure')),
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS audit_events_org_idx ON audit_events(organization_id);
CREATE INDEX IF NOT EXISTS audit_events_actor_idx ON audit_events(actor_user_id);
CREATE INDEX IF NOT EXISTS audit_events_action_idx ON audit_events(action);
CREATE INDEX IF NOT EXISTS audit_events_created_idx ON audit_events(created_at);
`;
