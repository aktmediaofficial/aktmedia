import type { Readable } from "node:stream";
import { Router, type IRouter } from "express";
import { logger } from "../lib/logger";
import {
  ASSET_CONTENT_TYPES,
  getAssetObject,
  MediaNotFoundError,
  objectStorageEnabled,
} from "../lib/media-storage";

const router: IRouter = Router();

/**
 * Site images and beat animation videos live in the private bucket. The server
 * streams them so the bucket never has to be made public (and needs no CORS).
 * Only these folders, and only image/video files, can be requested; audio is
 * served exclusively by /api/audio/stream.
 */
const ASSET_FOLDERS = new Set([
  "Artist Profiles",
  "Beat Animations",
  "Beat Covers",
  "Site Images",
  "Song Covers",
]);

function extensionOf(name: string): string {
  const match = name.match(/\.[a-z0-9]+$/i);
  return match ? match[0].toLowerCase() : "";
}

router.get("/assets/:folder/:file", async (req, res): Promise<void> => {
  const folder = String(req.params["folder"] ?? "");
  const file = String(req.params["file"] ?? "");

  const type = ASSET_CONTENT_TYPES[extensionOf(file)];
  if (
    !ASSET_FOLDERS.has(folder) ||
    !type ||
    file.includes("/") ||
    file.includes("\\") ||
    file.includes("..")
  ) {
    res.status(404).json({ error: "Not found." });
    return;
  }

  if (!objectStorageEnabled()) {
    res.status(404).json({ error: "Media storage is not configured." });
    return;
  }

  try {
    const { object, key } = await getAssetObject(folder, file, req.get("range"));
    if (!object.Body) {
      res.status(502).json({ error: "Media storage returned an empty file." });
      return;
    }

    // The bucket copy decides the real type (e.g. a .jpg request served by a .jpeg file).
    res.setHeader("Content-Type", ASSET_CONTENT_TYPES[extensionOf(key)] ?? type);
    res.setHeader("Cache-Control", "public, max-age=86400, stale-while-revalidate=604800");
    res.setHeader("Content-Disposition", "inline");
    res.setHeader("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Accept-Ranges", object.AcceptRanges ?? "bytes");
    if (object.ETag) res.setHeader("ETag", object.ETag);
    if (object.ContentRange) {
      res.status(206);
      res.setHeader("Content-Range", object.ContentRange);
    }
    if (object.ContentLength !== undefined) {
      res.setHeader("Content-Length", String(object.ContentLength));
    }

    const body = object.Body as Readable;
    body.on("error", (error) => {
      logger.error({ err: error, folder, file }, "Asset stream failed");
      if (res.headersSent) res.destroy(error);
      else res.status(502).json({ error: "Media storage is unavailable." });
    });
    res.on("close", () => body.destroy());
    body.pipe(res);
  } catch (error) {
    if (error instanceof MediaNotFoundError) {
      logger.warn(
        { folder, file, inFolder: error.available.slice(0, 50) },
        "Site asset not found in the bucket",
      );
      res.status(404).json({ error: "Not found." });
      return;
    }
    const status = (error as { $metadata?: { httpStatusCode?: number } })?.$metadata
      ?.httpStatusCode;
    if (status === 416) {
      res.status(416).json({ error: "The requested range is not available." });
      return;
    }
    logger.error({ err: error, folder, file }, "Asset request failed");
    res.status(502).json({ error: "Media storage is unavailable." });
  }
});

export default router;
