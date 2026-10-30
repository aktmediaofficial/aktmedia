import { pool } from "@workspace/db";
import { logger } from "./logger";

// Idempotent version of lib/db/src/schema/playlists.ts so a fresh production
// database gets its tables on first boot (drizzle-kit push is dev-only).
const PLAYLIST_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS "akt_playlists" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "owner_id" uuid NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "akt_playlists_name_length_check" CHECK (char_length("akt_playlists"."name") between 1 and 80),
  CONSTRAINT "akt_playlists_description_length_check" CHECK ("akt_playlists"."description" is null or char_length("akt_playlists"."description") <= 500)
);

CREATE TABLE IF NOT EXISTS "akt_playlist_tracks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "playlist_id" uuid NOT NULL,
  "track_id" integer NOT NULL,
  "position" integer NOT NULL,
  "added_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "akt_playlist_tracks_playlist_id_akt_playlists_id_fk" FOREIGN KEY ("playlist_id") REFERENCES "akt_playlists"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "akt_playlist_tracks_track_id_check" CHECK ("akt_playlist_tracks"."track_id" > 0),
  CONSTRAINT "akt_playlist_tracks_position_check" CHECK ("akt_playlist_tracks"."position" >= 0)
);

CREATE INDEX IF NOT EXISTS "akt_playlists_owner_updated_idx" ON "akt_playlists" ("owner_id", "updated_at");
CREATE UNIQUE INDEX IF NOT EXISTS "akt_playlist_tracks_playlist_track_idx" ON "akt_playlist_tracks" ("playlist_id", "track_id");
CREATE UNIQUE INDEX IF NOT EXISTS "akt_playlist_tracks_playlist_position_idx" ON "akt_playlist_tracks" ("playlist_id", "position");
CREATE INDEX IF NOT EXISTS "akt_playlist_tracks_playlist_idx" ON "akt_playlist_tracks" ("playlist_id");
`;

export async function ensurePlaylistSchema(): Promise<void> {
  await pool.query(PLAYLIST_SCHEMA_SQL);
  logger.info("Playlist tables are ready");
}
