-- Authenticated dashboard saved searches (filter query params + label only).
-- No owner PII columns. Apply after sql/api_dashboard_views.sql.

CREATE SCHEMA IF NOT EXISTS api;

CREATE TABLE IF NOT EXISTS api.saved_searches (
  id uuid PRIMARY KEY,
  username text NOT NULL,
  label text NOT NULL CHECK (char_length(label) BETWEEN 1 AND 120),
  query_params jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS saved_searches_username_created_idx
  ON api.saved_searches (username, created_at DESC);

REVOKE ALL ON TABLE api.saved_searches FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'dashboard_app') THEN
    EXECUTE 'GRANT SELECT, INSERT, DELETE ON TABLE api.saved_searches TO dashboard_app';
  END IF;
END
$$;
