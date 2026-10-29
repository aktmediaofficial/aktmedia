CREATE TABLE IF NOT EXISTS playlists (
  id SERIAL PRIMARY KEY,
  session_id VARCHAR NOT NULL,
  title VARCHAR NOT NULL,
  tracks JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_playlists_session_id ON playlists(session_id);