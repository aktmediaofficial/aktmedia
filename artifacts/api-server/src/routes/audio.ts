import { access } from "node:fs/promises";
import type { Readable } from "node:stream";
import { Router, type IRouter, type Request, type Response } from "express";
import { logger } from "../lib/logger";
import { getMediaObject, objectStorageEnabled } from "../lib/media-storage";
import { playlistSession } from "../middlewares/playlist-session";
import {
  isAllowedAudioRequest,
  issueAudioToken,
  MEDIA_TRACKS,
  mediaFilePath,
  verifyAudioToken,
  type MediaTrack,
} from "../lib/media";

const router: IRouter = Router();

router.use("/audio", playlistSession);

function ownerId(req: Request): string {
  return req.res?.locals["playlistOwnerId"] as string;
}

function requestIsAllowed(req: Request): boolean {
  return isAllowedAudioRequest(
    req.get("origin"),
    req.get("referer"),
    req.get("host"),
    req.get("sec-fetch-site"),
  );
}

function setAudioHeaders(res: Response, track: MediaTrack): void {
  res.setHeader("Cache-Control", "private, no-store, max-age=0");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Content-Type", track.mime);
  res.setHeader("Content-Disposition", "inline");
  res.setHeader("Content-Security-Policy", "default-src 'none'");
  res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
}

function objectStorageStatus(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null) return undefined;

  const name = (error as { name?: unknown }).name;
  if (name === "NoSuchKey" || name === "NotFound") return 404;
  if (name === "InvalidRange") return 416;

  const status = (error as { $metadata?: { httpStatusCode?: unknown } })
    .$metadata?.httpStatusCode;
  return typeof status === "number" ? status : undefined;
}

router.post("/audio/token", (req, res): void => {
  if (!requestIsAllowed(req)) {
    res.status(403).json({ error: "This audio request was not allowed." });
    return;
  }

  const trackId = Number((req.body as { trackId?: unknown } | undefined)?.trackId);
  const track = Number.isInteger(trackId) ? MEDIA_TRACKS[trackId] : undefined;
  if (!track) {
    res.status(404).json({ error: "Track not found." });
    return;
  }

  const issued = issueAudioToken(
    track.id,
    ownerId(req),
    req.get("user-agent") ?? "",
  );
  const token = encodeURIComponent(issued.token);

  res.setHeader("Cache-Control", "private, no-store, max-age=0");
  res.setHeader("Pragma", "no-cache");
  res.json({
    url: `/api/audio/stream/${track.id}?token=${token}`,
    expiresAt: new Date(issued.expiresAt).toISOString(),
    expiresIn: issued.expiresIn,
  });
});

router.get("/audio/stream/:trackId", async (req, res): Promise<void> => {
  if (!requestIsAllowed(req)) {
    res.status(403).json({ error: "This audio request was not allowed." });
    return;
  }

  const trackId = Number(req.params["trackId"]);
  const track = Number.isInteger(trackId) ? MEDIA_TRACKS[trackId] : undefined;
  if (!track) {
    res.status(404).json({ error: "Track not found." });
    return;
  }

  const token = String(req.query["token"] ?? "");
  if (!verifyAudioToken(token, track.id, ownerId(req), req.get("user-agent") ?? "")) {
    res
      .status(403)
      .json({ error: "This audio link is invalid or has expired." });
    return;
  }

  setAudioHeaders(res, track);

  if (objectStorageEnabled()) {
    try {
      const object = await getMediaObject(track, req.get("range"));
      if (!object.Body) {
        res.status(502).json({ error: "Audio storage returned an empty file." });
        return;
      }

      const body = object.Body as Readable;
      if (object.ContentRange) {
        res.status(206);
        res.setHeader("Content-Range", object.ContentRange);
      }
      if (object.ContentLength !== undefined) {
        res.setHeader("Content-Length", String(object.ContentLength));
      }
      res.setHeader("Accept-Ranges", object.AcceptRanges ?? "bytes");

      body.on("error", (error) => {
        logger.error({ err: error, trackId }, "Object storage stream failed");
        if (res.headersSent) res.destroy(error);
        else res.status(502).json({ error: "Audio storage is unavailable." });
      });
      res.on("close", () => body.destroy());
      body.pipe(res);
      return;
    } catch (error) {
      const status = objectStorageStatus(error);
      if (status === 404) {
        res.status(404).json({ error: "Audio file is not available." });
        return;
      }
      if (status === 416) {
        res.status(416).json({ error: "The requested audio range is not available." });
        return;
      }
      logger.error({ err: error, trackId }, "Object storage request failed");
      res.status(502).json({ error: "Audio storage is unavailable." });
      return;
    }
  }

  const filePath = mediaFilePath(track);
  try {
    await access(filePath);
  } catch {
    res.status(404).json({ error: "Audio file is not available." });
    return;
  }

  res.sendFile(
    filePath,
    {
      acceptRanges: true,
      cacheControl: false,
      dotfiles: "deny",
      etag: false,
      lastModified: false,
    },
    (error) => {
      if (!error) return;
      if (res.headersSent) return;
      res.status(404).json({ error: "Audio file is not available." });
    },
  );
});

export default router;
