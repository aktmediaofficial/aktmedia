import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { Router, type IRouter, type Response } from "express";
import {
  AddTrackToPlaylistBody,
  AddTrackToPlaylistParams,
  AddTrackToPlaylistResponse,
  CreatePlaylistBody,
  CreatePlaylistResponse,
  DeletePlaylistParams,
  DeletePlaylistResponse,
  GetPlaylistParams,
  GetPlaylistResponse,
  ListPlaylistsResponse,
  RemoveTrackFromPlaylistParams,
  RemoveTrackFromPlaylistResponse,
  ReorderPlaylistTracksBody,
  ReorderPlaylistTracksParams,
  ReorderPlaylistTracksResponse,
  UpdatePlaylistBody,
  UpdatePlaylistParams,
  UpdatePlaylistResponse,
  type ApiError,
} from "@workspace/api-zod";
import {
  db,
  playlistTracksTable,
  playlistsTable,
} from "@workspace/db";
import { MEDIA_TRACKS } from "../lib/media";
import { playlistSession } from "../middlewares/playlist-session";

const router: IRouter = Router();
const MAX_PLAYLISTS_PER_SESSION = 100;
const MAX_TRACKS_PER_PLAYLIST = 500;
const AVAILABLE_TRACK_IDS = new Set(Object.keys(MEDIA_TRACKS).map(Number));

router.use("/playlists", playlistSession);

function ownerId(res: Response): string {
  return res.locals["playlistOwnerId"] as string;
}

function sendApiError(res: Response, status: number, message: string): void {
  const payload: ApiError = { error: message };
  res.status(status).json(payload);
}

function sendValidationError(
  res: Response,
  message: string,
): void {
  sendApiError(res, 400, message);
}

async function readOwnedPlaylist(sessionId: string, playlistId: string) {
  const [playlist] = await db
    .select()
    .from(playlistsTable)
    .where(
      and(
        eq(playlistsTable.id, playlistId),
        eq(playlistsTable.ownerId, sessionId),
      ),
    )
    .limit(1);

  if (!playlist) return null;

  const tracks = await db
    .select({
      trackId: playlistTracksTable.trackId,
      position: playlistTracksTable.position,
      addedAt: playlistTracksTable.addedAt,
    })
    .from(playlistTracksTable)
    .where(eq(playlistTracksTable.playlistId, playlist.id))
    .orderBy(asc(playlistTracksTable.position), asc(playlistTracksTable.addedAt));

  return {
    ...playlist,
    trackCount: tracks.length,
    tracks,
  };
}

router.get("/playlists", async (_req, res): Promise<void> => {
  const sessionId = ownerId(res);
  const playlists = await db
    .select()
    .from(playlistsTable)
    .where(eq(playlistsTable.ownerId, sessionId))
    .orderBy(desc(playlistsTable.updatedAt), asc(playlistsTable.name));

  const playlistIds = playlists.map((playlist) => playlist.id);
  const trackRows = playlistIds.length
    ? await db
        .select({
          playlistId: playlistTracksTable.playlistId,
          trackId: playlistTracksTable.trackId,
          position: playlistTracksTable.position,
          addedAt: playlistTracksTable.addedAt,
        })
        .from(playlistTracksTable)
        .where(inArray(playlistTracksTable.playlistId, playlistIds))
        .orderBy(asc(playlistTracksTable.position), asc(playlistTracksTable.addedAt))
    : [];
  const tracksByPlaylist = new Map<
    string,
    Array<{ trackId: number; position: number; addedAt: Date }>
  >();

  for (const track of trackRows) {
    const playlistTracks = tracksByPlaylist.get(track.playlistId) ?? [];
    playlistTracks.push({
      trackId: track.trackId,
      position: track.position,
      addedAt: track.addedAt,
    });
    tracksByPlaylist.set(track.playlistId, playlistTracks);
  }

  const response = playlists.map((playlist) => {
    const tracks = tracksByPlaylist.get(playlist.id) ?? [];
    return { ...playlist, tracks, trackCount: tracks.length };
  });

  res.json(ListPlaylistsResponse.parse(response));
});

router.post("/playlists", async (req, res): Promise<void> => {
  const parsed = CreatePlaylistBody.safeParse(req.body);
  if (!parsed.success) {
    sendValidationError(res, parsed.error.issues.map((issue) => issue.message).join("; "));
    return;
  }

  const name = parsed.data.name.trim();
  if (!name) {
    sendValidationError(res, "Playlist name cannot be blank.");
    return;
  }

  const sessionId = ownerId(res);
  const existing = await db
    .select({ id: playlistsTable.id })
    .from(playlistsTable)
    .where(eq(playlistsTable.ownerId, sessionId))
    .limit(MAX_PLAYLISTS_PER_SESSION);
  if (existing.length >= MAX_PLAYLISTS_PER_SESSION) {
    sendApiError(res, 409, "This browser has reached its playlist limit.");
    return;
  }

  const [created] = await db
    .insert(playlistsTable)
    .values({
      ownerId: sessionId,
      name,
      description: parsed.data.description?.trim() || null,
    })
    .returning();

  const playlist = await readOwnedPlaylist(sessionId, created.id);
  if (!playlist) {
    sendApiError(res, 500, "The playlist could not be loaded after creation.");
    return;
  }
  res.status(201).json(CreatePlaylistResponse.parse(playlist));
});

router.get("/playlists/:playlistId", async (req, res): Promise<void> => {
  const params = GetPlaylistParams.safeParse(req.params);
  if (!params.success) {
    sendValidationError(res, params.error.issues.map((issue) => issue.message).join("; "));
    return;
  }

  const playlist = await readOwnedPlaylist(ownerId(res), params.data.playlistId);
  if (!playlist) {
    sendApiError(res, 404, "Playlist not found.");
    return;
  }
  res.json(GetPlaylistResponse.parse(playlist));
});

router.patch("/playlists/:playlistId", async (req, res): Promise<void> => {
  const params = UpdatePlaylistParams.safeParse(req.params);
  if (!params.success) {
    sendValidationError(res, params.error.issues.map((issue) => issue.message).join("; "));
    return;
  }
  const parsed = UpdatePlaylistBody.safeParse(req.body);
  if (!parsed.success) {
    sendValidationError(res, parsed.error.issues.map((issue) => issue.message).join("; "));
    return;
  }
  if (Object.keys(parsed.data).length === 0) {
    sendValidationError(res, "Provide a playlist name or description to update.");
    return;
  }
  if (parsed.data.name !== undefined && !parsed.data.name.trim()) {
    sendValidationError(res, "Playlist name cannot be blank.");
    return;
  }

  const changes: {
    name?: string;
    description?: string | null;
    updatedAt: Date;
  } = { updatedAt: new Date() };
  if (parsed.data.name !== undefined) changes.name = parsed.data.name.trim();
  if (Object.hasOwn(parsed.data, "description")) {
    changes.description =
      parsed.data.description === null
        ? null
        : parsed.data.description?.trim() || null;
  }

  const sessionId = ownerId(res);
  const [updated] = await db
    .update(playlistsTable)
    .set(changes)
    .where(
      and(
        eq(playlistsTable.id, params.data.playlistId),
        eq(playlistsTable.ownerId, sessionId),
      ),
    )
    .returning({ id: playlistsTable.id });
  if (!updated) {
    sendApiError(res, 404, "Playlist not found.");
    return;
  }

  const playlist = await readOwnedPlaylist(sessionId, updated.id);
  if (!playlist) {
    sendApiError(res, 404, "Playlist not found.");
    return;
  }
  res.json(UpdatePlaylistResponse.parse(playlist));
});

router.delete("/playlists/:playlistId", async (req, res): Promise<void> => {
  const params = DeletePlaylistParams.safeParse(req.params);
  if (!params.success) {
    sendValidationError(res, params.error.issues.map((issue) => issue.message).join("; "));
    return;
  }

  const deleted = await db
    .delete(playlistsTable)
    .where(
      and(
        eq(playlistsTable.id, params.data.playlistId),
        eq(playlistsTable.ownerId, ownerId(res)),
      ),
    )
    .returning({ id: playlistsTable.id });
  if (!deleted.length) {
    sendApiError(res, 404, "Playlist not found.");
    return;
  }
  DeletePlaylistResponse.parse(undefined);
  res.status(204).end();
});

router.post(
  "/playlists/:playlistId/tracks",
  async (req, res): Promise<void> => {
    const params = AddTrackToPlaylistParams.safeParse(req.params);
    if (!params.success) {
      sendValidationError(res, params.error.issues.map((issue) => issue.message).join("; "));
      return;
    }
    const parsed = AddTrackToPlaylistBody.safeParse(req.body);
    if (!parsed.success) {
      sendValidationError(res, parsed.error.issues.map((issue) => issue.message).join("; "));
      return;
    }
    if (!AVAILABLE_TRACK_IDS.has(parsed.data.trackId)) {
      sendValidationError(res, "This track is not available in the current library.");
      return;
    }

    const sessionId = ownerId(res);
    const playlistId = params.data.playlistId;
    const result = await db.transaction(async (tx) => {
      const [playlist] = await tx
        .select({ id: playlistsTable.id })
        .from(playlistsTable)
        .where(
          and(
            eq(playlistsTable.id, playlistId),
            eq(playlistsTable.ownerId, sessionId),
          ),
        )
        .for("update");
      if (!playlist) return "missing" as const;

      const tracks = await tx
        .select({
          trackId: playlistTracksTable.trackId,
          position: playlistTracksTable.position,
        })
        .from(playlistTracksTable)
        .where(eq(playlistTracksTable.playlistId, playlistId))
        .orderBy(asc(playlistTracksTable.position));
      if (tracks.some((track) => track.trackId === parsed.data.trackId)) {
        return "existing" as const;
      }
      if (tracks.length >= MAX_TRACKS_PER_PLAYLIST) return "limit" as const;

      const lastPosition = tracks.reduce(
        (maxPosition, track) => Math.max(maxPosition, track.position),
        -1,
      );
      await tx.insert(playlistTracksTable).values({
        playlistId,
        trackId: parsed.data.trackId,
        position: lastPosition + 1,
      });
      await tx
        .update(playlistsTable)
        .set({ updatedAt: new Date() })
        .where(eq(playlistsTable.id, playlistId));
      return "added" as const;
    });

    if (result === "missing") {
      sendApiError(res, 404, "Playlist not found.");
      return;
    }
    if (result === "limit") {
      sendApiError(res, 409, "This playlist has reached its track limit.");
      return;
    }

    const playlist = await readOwnedPlaylist(sessionId, playlistId);
    if (!playlist) {
      sendApiError(res, 404, "Playlist not found.");
      return;
    }
    res.status(201).json(AddTrackToPlaylistResponse.parse(playlist));
  },
);

router.delete(
  "/playlists/:playlistId/tracks/:trackId",
  async (req, res): Promise<void> => {
    const params = RemoveTrackFromPlaylistParams.safeParse(req.params);
    if (!params.success) {
      sendValidationError(res, params.error.issues.map((issue) => issue.message).join("; "));
      return;
    }

    const sessionId = ownerId(res);
    const { playlistId, trackId } = params.data;
    const result = await db.transaction(async (tx) => {
      const [playlist] = await tx
        .select({ id: playlistsTable.id })
        .from(playlistsTable)
        .where(
          and(
            eq(playlistsTable.id, playlistId),
            eq(playlistsTable.ownerId, sessionId),
          ),
        )
        .for("update");
      if (!playlist) return "missing" as const;

      const deleted = await tx
        .delete(playlistTracksTable)
        .where(
          and(
            eq(playlistTracksTable.playlistId, playlistId),
            eq(playlistTracksTable.trackId, trackId),
          ),
        )
        .returning({ id: playlistTracksTable.id });
      if (!deleted.length) return "track-missing" as const;

      const remaining = await tx
        .select({
          trackId: playlistTracksTable.trackId,
          position: playlistTracksTable.position,
        })
        .from(playlistTracksTable)
        .where(eq(playlistTracksTable.playlistId, playlistId))
        .orderBy(asc(playlistTracksTable.position));
      if (remaining.length) {
        const maxPosition = remaining.reduce(
          (maxValue, track) => Math.max(maxValue, track.position),
          -1,
        );
        const temporaryOffset = maxPosition + remaining.length + 1;
        await tx
          .update(playlistTracksTable)
          .set({
            position: sql`${playlistTracksTable.position} + ${temporaryOffset}`,
          })
          .where(eq(playlistTracksTable.playlistId, playlistId));
        for (const [position, track] of remaining.entries()) {
          await tx
            .update(playlistTracksTable)
            .set({ position })
            .where(
              and(
                eq(playlistTracksTable.playlistId, playlistId),
                eq(playlistTracksTable.trackId, track.trackId),
              ),
            );
        }
      }
      await tx
        .update(playlistsTable)
        .set({ updatedAt: new Date() })
        .where(eq(playlistsTable.id, playlistId));
      return "removed" as const;
    });

    if (result === "missing" || result === "track-missing") {
      sendApiError(
        res,
        404,
        result === "missing"
          ? "Playlist not found."
          : "Track was not found in this playlist.",
      );
      return;
    }

    const playlist = await readOwnedPlaylist(sessionId, playlistId);
    if (!playlist) {
      sendApiError(res, 404, "Playlist not found.");
      return;
    }
    res.json(RemoveTrackFromPlaylistResponse.parse(playlist));
  },
);

router.put(
  "/playlists/:playlistId/track-order",
  async (req, res): Promise<void> => {
    const params = ReorderPlaylistTracksParams.safeParse(req.params);
    if (!params.success) {
      sendValidationError(res, params.error.issues.map((issue) => issue.message).join("; "));
      return;
    }
    const parsed = ReorderPlaylistTracksBody.safeParse(req.body);
    if (!parsed.success) {
      sendValidationError(res, parsed.error.issues.map((issue) => issue.message).join("; "));
      return;
    }

    const sessionId = ownerId(res);
    const playlistId = params.data.playlistId;
    const trackIds = parsed.data.trackIds;
    const result = await db.transaction(async (tx) => {
      const [playlist] = await tx
        .select({ id: playlistsTable.id })
        .from(playlistsTable)
        .where(
          and(
            eq(playlistsTable.id, playlistId),
            eq(playlistsTable.ownerId, sessionId),
          ),
        )
        .for("update");
      if (!playlist) return "missing" as const;

      const currentTracks = await tx
        .select({
          trackId: playlistTracksTable.trackId,
          position: playlistTracksTable.position,
        })
        .from(playlistTracksTable)
        .where(eq(playlistTracksTable.playlistId, playlistId))
        .orderBy(asc(playlistTracksTable.position));
      const currentIds = new Set(currentTracks.map((track) => track.trackId));
      if (
        trackIds.length !== currentTracks.length ||
        trackIds.some((trackId) => !currentIds.has(trackId))
      ) {
        return "stale" as const;
      }

      if (trackIds.length) {
        const maxPosition = currentTracks.reduce(
          (maxValue, track) => Math.max(maxValue, track.position),
          -1,
        );
        const temporaryOffset = maxPosition + currentTracks.length + 1;
        await tx
          .update(playlistTracksTable)
          .set({
            position: sql`${playlistTracksTable.position} + ${temporaryOffset}`,
          })
          .where(eq(playlistTracksTable.playlistId, playlistId));
        for (const [position, trackId] of trackIds.entries()) {
          await tx
            .update(playlistTracksTable)
            .set({ position })
            .where(
              and(
                eq(playlistTracksTable.playlistId, playlistId),
                eq(playlistTracksTable.trackId, trackId),
              ),
            );
        }
      }
      await tx
        .update(playlistsTable)
        .set({ updatedAt: new Date() })
        .where(eq(playlistsTable.id, playlistId));
      return "updated" as const;
    });

    if (result === "missing") {
      sendApiError(res, 404, "Playlist not found.");
      return;
    }
    if (result === "stale") {
      sendApiError(res, 409, "The playlist changed. Reload it and try again.");
      return;
    }

    const playlist = await readOwnedPlaylist(sessionId, playlistId);
    if (!playlist) {
      sendApiError(res, 404, "Playlist not found.");
      return;
    }
    res.json(ReorderPlaylistTracksResponse.parse(playlist));
  },
);

export default router;
