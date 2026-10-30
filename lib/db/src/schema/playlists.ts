import { createInsertSchema } from "drizzle-zod";
import {
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { z } from "zod/v4";

export const playlistsTable = pgTable(
  "akt_playlists",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ownerId: uuid("owner_id").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("akt_playlists_owner_updated_idx").on(table.ownerId, table.updatedAt),
    check(
      "akt_playlists_name_length_check",
      sql`char_length(${table.name}) between 1 and 80`,
    ),
    check(
      "akt_playlists_description_length_check",
      sql`${table.description} is null or char_length(${table.description}) <= 500`,
    ),
  ],
);

export const playlistTracksTable = pgTable(
  "akt_playlist_tracks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    playlistId: uuid("playlist_id")
      .notNull()
      .references(() => playlistsTable.id, { onDelete: "cascade" }),
    trackId: integer("track_id").notNull(),
    position: integer("position").notNull(),
    addedAt: timestamp("added_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("akt_playlist_tracks_playlist_track_idx").on(
      table.playlistId,
      table.trackId,
    ),
    uniqueIndex("akt_playlist_tracks_playlist_position_idx").on(
      table.playlistId,
      table.position,
    ),
    check("akt_playlist_tracks_track_id_check", sql`${table.trackId} > 0`),
    check(
      "akt_playlist_tracks_position_check",
      sql`${table.position} >= 0`,
    ),
    index("akt_playlist_tracks_playlist_idx").on(table.playlistId),
  ],
);

export const insertPlaylistSchema = createInsertSchema(playlistsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertPlaylistTrackSchema = createInsertSchema(
  playlistTracksTable,
).omit({
  id: true,
  addedAt: true,
});

export type InsertPlaylist = z.infer<typeof insertPlaylistSchema>;
export type Playlist = typeof playlistsTable.$inferSelect;
export type InsertPlaylistTrack = z.infer<typeof insertPlaylistTrackSchema>;
export type PlaylistTrack = typeof playlistTracksTable.$inferSelect;
